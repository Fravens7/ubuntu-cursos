(function (name, definition) {
    if (typeof define === 'function' && define.amd) {
        define(definition);
    } else if (typeof module !== 'undefined' && module.exports) {
        module.exports = definition();
    } else {
        var api = definition();
        window.ysFixWebmDuration = api;
        window.ysRepairVideoBuffer = api.repairBuffer;
    }
})('fix-webm-duration', function () {

    // =========================================================================
    // 1. PARCHEADOR DE DURACIÓN PARA MP4 (ftyp / moov -> mvhd, tkhd, mdhd, mehd)
    // =========================================================================
    function isMp4Buffer(u8) {
        return u8 && u8.length >= 12 &&
            u8[4] === 0x66 && u8[5] === 0x74 && u8[6] === 0x79 && u8[7] === 0x70; // 'ftyp'
    }

    function patchMp4BufferDuration(u8, durationMs) {
        if (!isMp4Buffer(u8) || !(durationMs > 0)) return u8;
        var out = new Uint8Array(u8.length);
        out.set(u8);
        var view = new DataView(out.buffer, out.byteOffset, out.byteLength);
        var containers = { moov: 1, trak: 1, mdia: 1, mvex: 1 };
        var movieTimescale = 1000;

        function writeUint64BE(byteOffset, valNumber) {
            var v = Math.max(0, Math.round(valNumber));
            var hi = Math.floor(v / 4294967296);
            var lo = (v >>> 0);
            view.setUint32(byteOffset, hi, false);
            view.setUint32(byteOffset + 4, lo, false);
        }

        function walk(start, end) {
            var off = start;
            while (off + 8 <= end) {
                var size = view.getUint32(off, false);
                var type = String.fromCharCode(out[off + 4], out[off + 5], out[off + 6], out[off + 7]);
                if (size < 8 || off + size > end) break;

                if (type === 'mvhd') {
                    var ver = out[off + 8];
                    if (ver === 1 && off + 40 <= end) {
                        movieTimescale = view.getUint32(off + 28, false) || 1000;
                        writeUint64BE(off + 32, (durationMs / 1000) * movieTimescale);
                    } else if (ver === 0 && off + 28 <= end) {
                        movieTimescale = view.getUint32(off + 20, false) || 1000;
                        view.setUint32(off + 24, Math.round((durationMs / 1000) * movieTimescale), false);
                    }
                } else if (type === 'tkhd') {
                    var verTk = out[off + 8];
                    var scaledTk = (durationMs / 1000) * movieTimescale;
                    if (verTk === 1 && off + 44 <= end) {
                        writeUint64BE(off + 36, scaledTk);
                    } else if (verTk === 0 && off + 32 <= end) {
                        view.setUint32(off + 28, Math.round(scaledTk), false);
                    }
                } else if (type === 'mdhd') {
                    var verMd = out[off + 8];
                    if (verMd === 1 && off + 40 <= end) {
                        var ts1 = view.getUint32(off + 28, false) || 1000;
                        writeUint64BE(off + 32, (durationMs / 1000) * ts1);
                    } else if (verMd === 0 && off + 28 <= end) {
                        var ts0 = view.getUint32(off + 20, false) || 1000;
                        view.setUint32(off + 24, Math.round((durationMs / 1000) * ts0), false);
                    }
                } else if (type === 'mehd') {
                    var verMe = out[off + 8];
                    var scaledMe = (durationMs / 1000) * movieTimescale;
                    if (verMe === 1 && off + 20 <= end) {
                        writeUint64BE(off + 12, scaledMe);
                    } else if (verMe === 0 && off + 16 <= end) {
                        view.setUint32(off + 12, Math.round(scaledMe), false);
                    }
                }

                if (containers[type]) {
                    walk(off + 8, off + size);
                }
                off += size;
            }
        }

        try {
            walk(0, out.length);
        } catch (e) {}
        return out;
    }

    // =========================================================================
    // 2. REPARADOR DE CLUSTERS Y DURACIÓN PARA WEBM (EBML / Matroska)
    // =========================================================================
    function isWebmBuffer(u8) {
        return u8 && u8.length >= 4 &&
            u8[0] === 0x1a && u8[1] === 0x45 && u8[2] === 0xdf && u8[3] === 0xa3;
    }

    function getVintLength(firstByte) {
        if (!firstByte) return 0;
        var len = 1;
        var mask = 0x80;
        while ((firstByte & mask) === 0 && len < 8) {
            len++;
            mask >>= 1;
        }
        return len;
    }

    function writeVintInPlace(u8, offset, vintLen, value) {
        var maxVal = Math.pow(2, 7 * vintLen) - 2;
        if (value > maxVal) return false;
        var val = value;
        for (var i = vintLen - 1; i >= 0; i--) {
            u8[offset + i] = val % 256;
            val = Math.floor(val / 256);
        }
        u8[offset] |= (1 << (8 - vintLen));
        return true;
    }

    // Corrige el tamaño VINT de todos los Clusters (1F 43 B6 75) para que ningún
    // reproductor de escritorio (Windows Media Player / VLC) corte el video a los 2-3s.
    function repairWebmClustersInPlace(u8, startOffset) {
        var clusters = [];
        var limit = u8.length - 6;
        for (var i = startOffset || 0; i <= limit; i++) {
            if (u8[i] === 0x1f && u8[i + 1] === 0x43 && u8[i + 2] === 0xb6 && u8[i + 3] === 0x75) {
                var vLen = getVintLength(u8[i + 4]);
                if (vLen >= 1 && vLen <= 8 && (i + 4 + vLen) < u8.length && u8[i + 4 + vLen] === 0xe7) {
                    clusters.push({
                        offset: i,
                        vintOffset: i + 4,
                        vintLen: vLen,
                        dataStart: i + 4 + vLen
                    });
                    i += 3 + vLen;
                }
            }
        }

        for (var c = 0; c < clusters.length; c++) {
            var cur = clusters[c];
            var nextOff = (c + 1 < clusters.length) ? clusters[c + 1].offset : u8.length;
            var payloadSize = nextOff - cur.dataStart;
            if (payloadSize >= 0) {
                writeVintInPlace(u8, cur.vintOffset, cur.vintLen, payloadSize);
            }
        }
        return u8;
    }

    var sections = {
        0xa45dfa3: { name: 'EBML', type: 'Container' },
        0x8538067: { name: 'Segment', type: 'Container' },
        0x549a966: { name: 'Info', type: 'Container' },
        0xad7b1: { name: 'TimecodeScale', type: 'Uint' },
        0x489: { name: 'Duration', type: 'Float' }
    };

    function readEbmlVint(u8, offset) {
        if (offset >= u8.length) return null;
        var firstByte = u8[offset];
        if (firstByte === 0) return null;
        var bytes = getVintLength(firstByte);
        if (offset + bytes > u8.length) return null;
        var mask = (1 << (8 - bytes)) - 1;
        var value = firstByte & mask;
        var allOnes = (value === mask);
        for (var i = 1; i < bytes; i++) {
            var b = u8[offset + i];
            if (b !== 0xff) allOnes = false;
            value = (value * 256) + b;
        }
        return { length: bytes, value: allOnes ? -1 : value, rawValue: value };
    }

    function encodeEbmlVint(value) {
        var bytes = 1;
        var limit = 128;
        while (value >= (limit - 1) && bytes < 8) {
            bytes++;
            limit *= 128;
        }
        var out = new Uint8Array(bytes);
        var val = value;
        for (var i = bytes - 1; i >= 0; i--) {
            out[i] = val % 256;
            val = Math.floor(val / 256);
        }
        out[0] |= (1 << (8 - bytes));
        return out;
    }

    function patchInfoSection(infoPayload, durationMs) {
        // Parse children of Info (0x549a966)
        var off = 0;
        var children = [];
        var hasTimecodeScale = false;
        var hasDuration = false;

        while (off < infoPayload.length) {
            var id = readEbmlVint(infoPayload, off);
            if (!id) break;
            var sz = readEbmlVint(infoPayload, off + id.length);
            if (!sz || sz.value < 0) break;
            var bodyStart = off + id.length + sz.length;
            var bodyEnd = Math.min(infoPayload.length, bodyStart + sz.value);
            var body = infoPayload.subarray(bodyStart, bodyEnd);

            if (id.rawValue === 0xad7b1) {
                hasTimecodeScale = true;
                body = new Uint8Array([0x0f, 0x42, 0x40]); // 1,000,000 (1ms)
            } else if (id.rawValue === 0x489) {
                hasDuration = true;
                var dBuf = new ArrayBuffer(8);
                new DataView(dBuf).setFloat64(0, durationMs, false);
                body = new Uint8Array(dBuf);
            }

            children.push({
                idBytes: infoPayload.subarray(off, off + id.length),
                body: body
            });
            off = bodyEnd;
        }

        if (!hasTimecodeScale) {
            children.unshift({
                idBytes: new Uint8Array([0x2a, 0xd7, 0xb1]),
                body: new Uint8Array([0x0f, 0x42, 0x40])
            });
        }
        if (!hasDuration) {
            var durBuf = new ArrayBuffer(8);
            new DataView(durBuf).setFloat64(0, durationMs, false);
            children.push({
                idBytes: new Uint8Array([0x44, 0x89]),
                body: new Uint8Array(durBuf)
            });
        }

        var totalLen = 0;
        var encodedChildren = children.map(function (ch) {
            var szBytes = encodeEbmlVint(ch.body.length);
            totalLen += ch.idBytes.length + szBytes.length + ch.body.length;
            return { idBytes: ch.idBytes, szBytes: szBytes, body: ch.body };
        });

        var out = new Uint8Array(totalLen);
        var ptr = 0;
        for (var i = 0; i < encodedChildren.length; i++) {
            var item = encodedChildren[i];
            out.set(item.idBytes, ptr); ptr += item.idBytes.length;
            out.set(item.szBytes, ptr); ptr += item.szBytes.length;
            out.set(item.body, ptr); ptr += item.body.length;
        }
        return out;
    }

    function fixWebmBuffer(u8, durationMs) {
        if (!isWebmBuffer(u8)) return u8;
        try {
            // 1. Leer encabezado EBML
            var ebmlId = readEbmlVint(u8, 0);
            if (!ebmlId || ebmlId.rawValue !== 0xa45dfa3) return repairWebmClustersInPlace(new Uint8Array(u8), 0);
            var ebmlSize = readEbmlVint(u8, ebmlId.length);
            if (!ebmlSize || ebmlSize.value < 0) return repairWebmClustersInPlace(new Uint8Array(u8), 0);
            var segOffset = ebmlId.length + ebmlSize.length + ebmlSize.value;

            // 2. Leer encabezado Segment (0x18538067)
            var segId = readEbmlVint(u8, segOffset);
            if (!segId || segId.rawValue !== 0x8538067) return repairWebmClustersInPlace(new Uint8Array(u8), 0);
            var segSize = readEbmlVint(u8, segOffset + segId.length);
            if (!segSize) return repairWebmClustersInPlace(new Uint8Array(u8), 0);
            var segBodyStart = segOffset + segId.length + segSize.length;

            // 3. Buscar Info (0x1549A966) al inicio del Segment
            var infoId = readEbmlVint(u8, segBodyStart);
            if (!infoId || infoId.rawValue !== 0x549a966) {
                return repairWebmClustersInPlace(new Uint8Array(u8), segBodyStart);
            }
            var infoSize = readEbmlVint(u8, segBodyStart + infoId.length);
            if (!infoSize || infoSize.value < 0) {
                return repairWebmClustersInPlace(new Uint8Array(u8), segBodyStart);
            }
            var infoBodyStart = segBodyStart + infoId.length + infoSize.length;
            var afterInfoOffset = infoBodyStart + infoSize.value;

            var newInfoBody = (durationMs > 0)
                ? patchInfoSection(u8.subarray(infoBodyStart, afterInfoOffset), durationMs)
                : u8.subarray(infoBodyStart, afterInfoOffset);
            var newInfoSizeBytes = encodeEbmlVint(newInfoBody.length);
            var infoIdBytes = u8.subarray(segBodyStart, segBodyStart + infoId.length);

            // 4. Copiar el resto del Segment (Tracks + todos los Clusters) y reparar cada Cluster individualmente
            var tailBytes = new Uint8Array(u8.length - afterInfoOffset);
            tailBytes.set(u8.subarray(afterInfoOffset));
            repairWebmClustersInPlace(tailBytes, 0);

            var newSegBodyLen = infoIdBytes.length + newInfoSizeBytes.length + newInfoBody.length + tailBytes.length;
            var newSegSizeBytes = encodeEbmlVint(newSegBodyLen);
            var segIdBytes = u8.subarray(segOffset, segOffset + segId.length);
            var ebmlHeaderBytes = u8.subarray(0, segOffset);

            var totalFileLen = ebmlHeaderBytes.length + segIdBytes.length + newSegSizeBytes.length + newSegBodyLen;
            var finalOut = new Uint8Array(totalFileLen);
            var p = 0;
            finalOut.set(ebmlHeaderBytes, p); p += ebmlHeaderBytes.length;
            finalOut.set(segIdBytes, p); p += segIdBytes.length;
            finalOut.set(newSegSizeBytes, p); p += newSegSizeBytes.length;
            finalOut.set(infoIdBytes, p); p += infoIdBytes.length;
            finalOut.set(newInfoSizeBytes, p); p += newInfoSizeBytes.length;
            finalOut.set(newInfoBody, p); p += newInfoBody.length;
            finalOut.set(tailBytes, p);
            return finalOut;
        } catch (e) {
            return repairWebmClustersInPlace(new Uint8Array(u8), 0);
        }
    }

    function repairBuffer(u8, durationMs) {
        if (!u8 || !u8.length) return u8;
        if (isMp4Buffer(u8)) {
            return durationMs > 0 ? patchMp4BufferDuration(u8, durationMs) : u8;
        }
        if (isWebmBuffer(u8)) {
            return fixWebmBuffer(u8, durationMs || 0);
        }
        return u8;
    }

    function fixWebmDuration(blob, duration, callback, options) {
        if (typeof callback === 'object') {
            options = callback;
            callback = undefined;
        }

        if (!callback) {
            return new Promise(function (resolve) {
                fixWebmDuration(blob, duration, resolve, options);
            });
        }

        try {
            var reader = new FileReader();
            reader.onloadend = function () {
                try {
                    var u8 = new Uint8Array(reader.result);
                    var fixed = repairBuffer(u8, duration);
                    var outType = blob.type || (isMp4Buffer(fixed) ? 'video/mp4' : 'video/webm');
                    callback(new Blob([fixed.buffer], { type: outType }));
                } catch (ex) {
                    console.warn('[fix-webm-duration] Warning during patch:', ex);
                    callback(blob);
                }
            };
            reader.onerror = function () {
                callback(blob);
            };
            reader.readAsArrayBuffer(blob);
        } catch (ex) {
            callback(blob);
        }
    }

    fixWebmDuration.default = fixWebmDuration;
    fixWebmDuration.repairBuffer = repairBuffer;
    fixWebmDuration.isMp4Buffer = isMp4Buffer;
    fixWebmDuration.isWebmBuffer = isWebmBuffer;
    return fixWebmDuration;
});
