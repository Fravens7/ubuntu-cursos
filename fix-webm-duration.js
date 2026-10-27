(function (name, definition) {
    if (typeof define === 'function' && define.amd) {
        define(definition);
    } else if (typeof module !== 'undefined' && module.exports) {
        module.exports = definition();
    } else {
        window.ysFixWebmDuration = definition();
    }
})('fix-webm-duration', function () {
    var sections = {
        0xa45dfa3: { name: 'EBML', type: 'Container' },
        0x286: { name: 'EBMLVersion', type: 'Uint' },
        0x2f7: { name: 'EBMLReadVersion', type: 'Uint' },
        0x2f2: { name: 'EBMLMaxIDLength', type: 'Uint' },
        0x2f3: { name: 'EBMLMaxSizeLength', type: 'Uint' },
        0x282: { name: 'DocType', type: 'String' },
        0x287: { name: 'DocTypeVersion', type: 'Uint' },
        0x285: { name: 'DocTypeReadVersion', type: 'Uint' },
        0x6c: { name: 'Void', type: 'Binary' },
        0x3f: { name: 'CRC-32', type: 'Binary' },
        0xb538667: { name: 'SignatureSlot', type: 'Container' },
        0x3e8a: { name: 'SignatureAlgo', type: 'Uint' },
        0x3e9a: { name: 'SignatureHash', type: 'Uint' },
        0x3ea5: { name: 'SignaturePublicKey', type: 'Binary' },
        0x3eb5: { name: 'Signature', type: 'Binary' },
        0x3e5b: { name: 'SignatureElements', type: 'Container' },
        0x3e7b: { name: 'SignatureElementList', type: 'Container' },
        0x2532: { name: 'SignedElement', type: 'Binary' },
        0x8538067: { name: 'Segment', type: 'Container' },
        0x14d9b74: { name: 'SeekHead', type: 'Container' },
        0xdbb: { name: 'Seek', type: 'Container' },
        0x13ab: { name: 'SeekID', type: 'Binary' },
        0x13ac: { name: 'SeekPosition', type: 'Uint' },
        0x549a966: { name: 'Info', type: 'Container' },
        0x33a4: { name: 'SegmentUID', type: 'Binary' },
        0x3384: { name: 'SegmentFilename', type: 'String' },
        0x1cb923: { name: 'PrevUID', type: 'Binary' },
        0x1c83ab: { name: 'PrevFilename', type: 'String' },
        0x1eb923: { name: 'NextUID', type: 'Binary' },
        0x1e83bb: { name: 'NextFilename', type: 'String' },
        0x444: { name: 'SegmentFamily', type: 'Binary' },
        0x2924: { name: 'ChapterTranslate', type: 'Container' },
        0x29fc: { name: 'ChapterTranslateEditionUID', type: 'Uint' },
        0x29bf: { name: 'ChapterTranslateCodec', type: 'Uint' },
        0x29a5: { name: 'ChapterTranslateID', type: 'Binary' },
        0xad7b1: { name: 'TimecodeScale', type: 'Uint' },
        0x489: { name: 'Duration', type: 'Float' },
        0x461: { name: 'DateUTC', type: 'Date' },
        0x3ba9: { name: 'Title', type: 'String' },
        0xd80: { name: 'MuxingApp', type: 'String' },
        0x1741: { name: 'WritingApp', type: 'String' },
        0x67: { name: 'Timecode', type: 'Uint' },
        0x1854: { name: 'SilentTracks', type: 'Container' },
        0x18d7: { name: 'SilentTrackNumber', type: 'Uint' },
        0x27: { name: 'Position', type: 'Uint' },
        0x2b: { name: 'PrevSize', type: 'Uint' },
        0x23: { name: 'SimpleBlock', type: 'Binary' },
        0x20: { name: 'BlockGroup', type: 'Container' },
        0x21: { name: 'Block', type: 'Binary' },
        0x22: { name: 'BlockVirtual', type: 'Binary' },
        0x35a1: { name: 'BlockAdditions', type: 'Container' },
        0x26: { name: 'BlockMore', type: 'Container' },
        0x6e: { name: 'BlockAddID', type: 'Uint' },
        0x25: { name: 'BlockAdditional', type: 'Binary' },
        0x1b: { name: 'BlockDuration', type: 'Uint' },
        0x7a: { name: 'ReferencePriority', type: 'Uint' },
        0x7b: { name: 'ReferenceBlock', type: 'Int' },
        0x7d: { name: 'ReferenceVirtual', type: 'Int' },
        0x24: { name: 'CodecState', type: 'Binary' },
        0x35a2: { name: 'DiscardPadding', type: 'Int' },
        0xe: { name: 'Slices', type: 'Container' },
        0x68: { name: 'TimeSlice', type: 'Container' },
        0x4c: { name: 'LaceNumber', type: 'Uint' },
        0x4d: { name: 'FrameNumber', type: 'Uint' },
        0x4b: { name: 'BlockAdditionID', type: 'Uint' },
        0x4e: { name: 'Delay', type: 'Uint' },
        0x4f: { name: 'SliceDuration', type: 'Uint' },
        0x48: { name: 'ReferenceFrame', type: 'Container' },
        0x49: { name: 'ReferenceOffset', type: 'Uint' },
        0x4a: { name: 'ReferenceTimeCode', type: 'Uint' },
        0x2f: { name: 'EncryptedBlock', type: 'Binary' },
        0x654ae6b: { name: 'Tracks', type: 'Container' },
        0x2e: { name: 'TrackEntry', type: 'Container' },
        0x57: { name: 'TrackNumber', type: 'Uint' },
        0x33c5: { name: 'TrackUID', type: 'Uint' },
        0x3: { name: 'TrackType', type: 'Uint' },
        0x39: { name: 'FlagEnabled', type: 'Uint' },
        0x8: { name: 'FlagDefault', type: 'Uint' },
        0x15aa: { name: 'FlagForced', type: 'Uint' },
        0x1c: { name: 'FlagLacing', type: 'Uint' },
        0x2beb: { name: 'DefaultDuration', type: 'Uint' },
        0x1338a: { name: 'MaxBlockAdditionID', type: 'Uint' },
        0x137e: { name: 'Name', type: 'String' },
        0x2b59c: { name: 'Language', type: 'String' },
        0x6: { name: 'CodecID', type: 'String' },
        0x23a2: { name: 'CodecPrivate', type: 'Binary' },
        0x58688: { name: 'CodecName', type: 'String' },
        0x3446: { name: 'AttachmentLink', type: 'Uint' },
        0x1a9697: { name: 'CodecSettings', type: 'String' },
        0x1b4040: { name: 'CodecInfoURL', type: 'String' },
        0x1c8427: { name: 'CodecDownloadURL', type: 'String' },
        0x2a: { name: 'CodecDecodeAll', type: 'Uint' },
        0x2fab: { name: 'TrackOverlay', type: 'Uint' },
        0x16aa: { name: 'CodecDelay', type: 'Uint' },
        0x16bb: { name: 'SeekPreRoll', type: 'Uint' },
        0x60: { name: 'Video', type: 'Container' },
        0x1a: { name: 'FlagInterlaced', type: 'Uint' },
        0x13b8: { name: 'StereoMode', type: 'Uint' },
        0x13c0: { name: 'AlphaMode', type: 'Uint' },
        0x30: { name: 'PixelWidth', type: 'Uint' },
        0x3a: { name: 'PixelHeight', type: 'Uint' },
        0x14aa: { name: 'PixelCropBottom', type: 'Uint' },
        0x14bb: { name: 'PixelCropTop', type: 'Uint' },
        0x14cc: { name: 'PixelCropLeft', type: 'Uint' },
        0x14dd: { name: 'PixelCropRight', type: 'Uint' },
        0x14b0: { name: 'DisplayWidth', type: 'Uint' },
        0x14ba: { name: 'DisplayHeight', type: 'Uint' },
        0x14b2: { name: 'DisplayUnit', type: 'Uint' },
        0x14b3: { name: 'AspectRatioType', type: 'Uint' },
        0xeb524: { name: 'ColourSpace', type: 'Binary' },
        0x61: { name: 'Audio', type: 'Container' },
        0x35: { name: 'SamplingFrequency', type: 'Float' },
        0x38b5: { name: 'OutputSamplingFrequency', type: 'Float' },
        0x1f: { name: 'Channels', type: 'Uint' },
        0x3d7b: { name: 'ChannelPositions', type: 'Binary' },
        0x2264: { name: 'BitDepth', type: 'Uint' },
        0x1c53bb6b: { name: 'Cues', type: 'Container' },
        0x3b: { name: 'CuePoint', type: 'Container' },
        0x33: { name: 'CueTime', type: 'Uint' },
        0x37: { name: 'CueTrackPositions', type: 'Container' },
        0x77: { name: 'CueTrack', type: 'Uint' },
        0x71: { name: 'CueClusterPosition', type: 'Uint' },
        0x70: { name: 'CueRelativePosition', type: 'Uint' },
        0x32: { name: 'CueDuration', type: 'Uint' },
        0x1378: { name: 'CueBlockNumber', type: 'Uint' },
        0x6a: { name: 'CueCodecState', type: 'Uint' },
        0x5b: { name: 'CueReference', type: 'Container' },
        0x16: { name: 'CueRefTime', type: 'Uint' }
    };

    function doInherit(subClass, superClass) {
        subClass.prototype = Object.create(superClass.prototype);
        subClass.prototype.constructor = subClass;
    }

    function WebmBase(name, type) {
        this.name = name || 'Unknown';
        this.type = type || 'Unknown';
    }

    WebmBase.prototype.setSource = function(source) {
        this.source = source;
    };

    function WebmUint(name, type) {
        WebmBase.call(this, name, type);
    }
    doInherit(WebmUint, WebmBase);

    WebmUint.prototype.setValue = function(value) {
        var bytes = [];
        var val = value;
        while (val > 0) {
            bytes.unshift(val % 256);
            val = Math.floor(val / 256);
        }
        if (bytes.length === 0) bytes.push(0);
        this.source = new Uint8Array(bytes);
    };

    function WebmFloat(name, type) {
        WebmBase.call(this, name, type);
    }
    doInherit(WebmFloat, WebmBase);

    WebmFloat.prototype.setValue = function(value) {
        var buffer = new ArrayBuffer(8);
        var view = new DataView(buffer);
        view.setFloat64(0, value, false); // Big endian
        this.source = new Uint8Array(buffer);
    };
    WebmFloat.prototype.getValue = function() {
        if (!this.source) return 0;
        var view = new DataView(this.source.buffer, this.source.byteOffset, this.source.byteLength);
        if (this.source.byteLength === 4) {
            return view.getFloat32(0, false);
        } else if (this.source.byteLength === 8) {
            return view.getFloat64(0, false);
        }
        return 0;
    };

    function WebmContainer(name, type) {
        WebmBase.call(this, name, type);
        this.data = [];
    }
    doInherit(WebmContainer, WebmBase);

    WebmContainer.prototype.readByte = function() {
        return this.source[this.offset++];
    };
    WebmContainer.prototype.readUint = function() {
        var firstByte = this.readByte();
        var bytes = 8 - Math.floor(Math.log2(firstByte));
        var value = firstByte - (1 << (8 - bytes));
        for (var i = 1; i < bytes; i++) {
            value = (value * 256) + this.readByte();
        }
        return { length: bytes, value: value };
    };
    WebmContainer.prototype.readSection = function() {
        if (this.offset >= this.source.length) return null;
        var id = this.readUint();
        var size = this.readUint();
        var section = sections[id.value] || { name: 'Unknown', type: 'Unknown' };
        var constructor = WebmBase;
        if (section.type === 'Container') {
            constructor = WebmContainer;
        } else if (section.type === 'Uint') {
            constructor = WebmUint;
        } else if (section.type === 'Float') {
            constructor = WebmFloat;
        }

        var instance = new constructor(section.name, section.type);
        instance.setSource(this.source.subarray(this.offset, this.offset + size.value));
        this.offset += size.value;
        return { id: id.value, data: instance };
    };
    WebmContainer.prototype.setSource = function(source) {
        this.source = source;
        this.offset = 0;
        this.data = [];
        var section;
        while ((section = this.readSection()) !== null) {
            this.data.push(section);
        }
    };
    WebmContainer.prototype.writeUint = function(value, draft) {
        var bytes = 1;
        var limit = 128;
        while (value >= (limit - 1) && limit <= 0x80000000) {
            bytes++;
            limit = limit << 7;
        }
        if (!draft) {
            var val = value + (1 << (7 * bytes));
            for (var i = bytes - 1; i >= 0; i--) {
                this.source[this.offset + i] = val % 256;
                val = Math.floor(val / 256);
            }
        }
        this.offset += bytes;
    };
    WebmContainer.prototype.writeSections = function(draft) {
        this.offset = 0;
        for (var i = 0; i < this.data.length; i++) {
            var section = this.data[i];
            var content = section.data.source;
            var contentLength = content ? content.length : 0;
            this.writeUint(section.id, draft);
            this.writeUint(contentLength, draft);
            if (!draft && content) {
                this.source.set(content, this.offset);
            }
            this.offset += contentLength;
        }
        return this.offset;
    };
    WebmContainer.prototype.updateByData = function() {
        var length = this.writeSections('draft');
        this.source = new Uint8Array(length);
        this.writeSections();
    };
    WebmContainer.prototype.getSectionById = function(id) {
        for (var i = 0; i < this.data.length; i++) {
            var section = this.data[i];
            if (section.id === id) {
                return section.data;
            }
        }
        return null;
    };

    function WebmFile(source) {
        WebmContainer.call(this, 'File', 'File');
        this.setSource(source);
    }
    doInherit(WebmFile, WebmContainer);

    WebmFile.prototype.fixDuration = function(duration, options) {
        var segmentSection = this.getSectionById(0x8538067);
        if (!segmentSection) return false;

        var infoSection = segmentSection.getSectionById(0x549a966);
        if (!infoSection) return false;

        var timeScaleSection = infoSection.getSectionById(0xad7b1);
        if (!timeScaleSection) return false;

        var durationSection = infoSection.getSectionById(0x489);
        if (durationSection) {
            durationSection.setValue(duration);
        } else {
            durationSection = new WebmFloat('Duration', 'Float');
            durationSection.setValue(duration);
            infoSection.data.push({
                id: 0x489,
                data: durationSection
            });
        }

        timeScaleSection.setValue(1000000); // 1 ms scale
        infoSection.updateByData();
        segmentSection.updateByData();
        this.updateByData();
        return true;
    };

    WebmFile.prototype.toBlob = function(mimeType) {
        return new Blob([this.source.buffer], { type: mimeType || 'video/webm' });
    };

    function fixWebmDuration(blob, duration, callback, options) {
        if (typeof callback === "object") {
            options = callback;
            callback = undefined;
        }

        if (!callback) {
            return new Promise(function(resolve) {
                fixWebmDuration(blob, duration, resolve, options);
            });
        }

        try {
            var reader = new FileReader();
            reader.onloadend = function() {
                try {
                    var file = new WebmFile(new Uint8Array(reader.result));
                    if (file.fixDuration(duration, options)) {
                        blob = file.toBlob(blob.type);
                    }
                } catch (ex) {
                    console.warn("[fix-webm-duration] Warning during patch:", ex);
                }
                callback(blob);
            };
            reader.readAsArrayBuffer(blob);
        } catch (ex) {
            callback(blob);
        }
    }

    fixWebmDuration.default = fixWebmDuration;
    return fixWebmDuration;
});
