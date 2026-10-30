// ============================================================================
// NUEVOMOTOR-GRABACIONES.JS
// Motor de Grabación de Escenario (Plan A: Cero Popups de Permiso) + Reproductor
// Estilo minimalista: Fondo blanco, tonos negros/grises, solo SVG, cero emojis.
// ============================================================================

(function () {
    const STORAGE_KEY = 'ubuntu_nuevomotor_grabaciones';
    const WORKER_UPLOAD_URL = 'https://ubuntu-grabaciones-uploader.asoc-ubuntuperu.workers.dev/';
    const bc = typeof BroadcastChannel !== 'undefined' ? new BroadcastChannel('ubuntu_nuevomotor_sync') : null;

    function escapeHtml(str) {
        if (!str) return '';
        return String(str)
            .replace(/&/g, '&amp;')
            .replace(/</g, '&lt;')
            .replace(/>/g, '&gt;')
            .replace(/"/g, '&quot;')
            .replace(/'/g, '&#039;');
    }

    function formatClock(totalSeconds) {
        const sec = Math.max(0, Math.floor(totalSeconds || 0));
        const h = Math.floor(sec / 3600);
        const m = String(Math.floor((sec % 3600) / 60)).padStart(2, '0');
        const s = String(sec % 60).padStart(2, '0');
        return h > 0 ? `${String(h).padStart(2, '0')}:${m}:${s}` : `${m}:${s}`;
    }

    function formatDate(isoStr) {
        if (!isoStr) return '';
        try {
            const d = new Date(isoStr);
            return d.toLocaleDateString('es-PE', {
                day: '2-digit',
                month: '2-digit',
                year: 'numeric',
                hour: '2-digit',
                minute: '2-digit'
            });
        } catch (e) {
            return '';
        }
    }

    const NuevoMotorGrabaciones = {
        // Estado de grabación en vivo (meet.html)
        isRecording: false,
        isPaused: false,
        isSaving: false,
        mediaRecorder: null,
        recordedChunks: [],
        elapsedSeconds: 0,
        timerInterval: null,
        drawInterval: null,
        audioPollInterval: null,

        // Canvas compositor + Mezclador de audio (Plan A: 0 popups)
        canvas: null,
        ctx: null,
        canvasStream: null,
        audioCtx: null,
        audioDest: null,
        keepAliveOsc: null,
        connectedTrackIds: new Set(),
        sourceNodes: [],
        combinedStream: null,

        // Base de datos / Lista de grabaciones
        firestoreDb: null,
        firestoreFns: null,
        recordingsList: [],
        activePlayingId: null,

        // Inicializar con referencia opcional a Firestore
        init(options = {}) {
            if (options.db) this.firestoreDb = options.db;
            if (options.firestoreFns) this.firestoreFns = options.firestoreFns;

            this.loadLocalRecordings();
            this.subscribeFirestoreRecordings();

            if (bc) {
                bc.onmessage = (ev) => {
                    if (ev.data && ev.data.type === 'RECORDINGS_UPDATED') {
                        this.loadLocalRecordings();
                        this.renderRecordingsListUI();
                    }
                };
            }
        },

        loadLocalRecordings() {
            try {
                const raw = localStorage.getItem(STORAGE_KEY);
                if (raw) {
                    const parsed = JSON.parse(raw);
                    if (Array.isArray(parsed)) {
                        this.recordingsList = parsed;
                    }
                }
            } catch (e) {}
        },

        saveLocalRecordings() {
            try {
                localStorage.setItem(STORAGE_KEY, JSON.stringify(this.recordingsList));
                if (bc) bc.postMessage({ type: 'RECORDINGS_UPDATED' });
            } catch (e) {}
        },

        subscribeFirestoreRecordings() {
            if (!this.firestoreDb || !this.firestoreFns || !this.firestoreFns.collection || !this.firestoreFns.onSnapshot) {
                return;
            }
            try {
                const colRef = this.firestoreFns.collection(this.firestoreDb, 'grabaciones_meet');
                this.firestoreFns.onSnapshot(colRef, (snap) => {
                    const items = [];
                    snap.forEach((docSnap) => {
                        items.push({ id: docSnap.id, ...docSnap.data() });
                    });
                    items.sort((a, b) => (b.timestamp || 0) - (a.timestamp || 0));
                    if (items.length > 0 || this.recordingsList.length === 0) {
                        this.recordingsList = items;
                        this.saveLocalRecordings();
                        this.renderRecordingsListUI();
                    }
                }, () => {});
            } catch (e) {}
        },

        // ====================================================================
        // PARTE 1: BARRA DE GRABACIÓN EN MEET.HTML (SOLO ROL = ADMIN)
        // ====================================================================
        mountMeetControls(meetApp) {
            this.meetApp = meetApp;
            const role = String(meetApp?.userRole || '').toLowerCase().trim();
            if (role !== 'admin') {
                const existing = document.getElementById('nuevoMotorRecBar');
                if (existing) existing.remove();
                return;
            }

            let bar = document.getElementById('nuevoMotorRecBar');
            if (!bar) {
                const topLeft = document.querySelector('.call-top-left');
                if (!topLeft) return;
                bar = document.createElement('div');
                bar.id = 'nuevoMotorRecBar';
                bar.style.cssText = 'display:inline-flex;align-items:center;gap:8px;margin-left:10px;';
                topLeft.appendChild(bar);
            }

            this.renderMeetControlsUI();
            this.ensureUploadOverlayInMeet();

            if (!this._unloadBound) {
                this._unloadBound = true;
                window.addEventListener('beforeunload', (e) => {
                    if (this.isRecording) {
                        this.stopAndSave();
                        e.preventDefault();
                        e.returnValue = '';
                    }
                });
            }
        },

        renderMeetControlsUI() {
            const bar = document.getElementById('nuevoMotorRecBar');
            if (!bar) return;

            if (this.isSaving) {
                bar.innerHTML = `
                    <span style="display:inline-flex;align-items:center;gap:6px;padding:4px 12px;border:1px solid #d1d5db;border-radius:999px;font-size:12px;color:#111111;background:#f9fafb;">
                        <span>Guardando grabación...</span>
                    </span>
                `;
                return;
            }

            if (!this.isRecording) {
                bar.innerHTML = `
                    <button type="button" id="btnNuevoMotorStart" style="display:inline-flex;align-items:center;gap:6px;height:30px;padding:0 12px;border:1px solid #9ca3af;border-radius:999px;background:#ffffff;color:#111111;font-size:12px;font-weight:600;cursor:pointer;">
                        <svg width="12" height="12" viewBox="0 0 24 24" fill="currentColor" stroke="none">
                            <circle cx="12" cy="12" r="8"></circle>
                        </svg>
                        <span>Grabar</span>
                    </button>
                `;
                const btnStart = document.getElementById('btnNuevoMotorStart');
                if (btnStart) {
                    btnStart.onclick = () => this.startStageRecording();
                }
                return;
            }

            const timeStr = formatClock(this.elapsedSeconds);
            const stateLabel = this.isPaused ? 'En pausa' : 'Grabando';

            bar.innerHTML = `
                <div style="display:inline-flex;align-items:center;gap:8px;height:30px;padding:0 12px;border:1px solid #111111;border-radius:999px;background:#f9fafb;color:#111111;font-size:12px;font-weight:600;">
                    <svg width="10" height="10" viewBox="0 0 24 24" fill="${this.isPaused ? '#6b7280' : '#111111'}" stroke="none">
                        <circle cx="12" cy="12" r="10"></circle>
                    </svg>
                    <span>${stateLabel}</span>
                    <span id="nuevoMotorTimerText" style="font-size:13.5px;font-weight:400;font-variant-numeric:tabular-nums;letter-spacing:0.01em;">${timeStr}</span>
                </div>

                <button type="button" id="btnNuevoMotorPause" style="display:inline-flex;align-items:center;gap:5px;height:30px;padding:0 11px;border:1px solid #d1d5db;border-radius:999px;background:#ffffff;color:#111111;font-size:12px;font-weight:500;cursor:pointer;">
                    ${this.isPaused ? `
                        <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
                            <polygon points="5 3 19 12 5 21 5 3"></polygon>
                        </svg>
                        <span>Reanudar</span>
                    ` : `
                        <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
                            <rect x="6" y="4" width="4" height="16"></rect>
                            <rect x="14" y="4" width="4" height="16"></rect>
                        </svg>
                        <span>Pausar</span>
                    `}
                </button>

                <button type="button" id="btnNuevoMotorSave" style="display:inline-flex;align-items:center;gap:5px;height:30px;padding:0 12px;border:1px solid #111111;border-radius:999px;background:#111111;color:#ffffff;font-size:12px;font-weight:600;cursor:pointer;">
                    <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
                        <rect x="4" y="4" width="16" height="16" rx="2"></rect>
                    </svg>
                    <span>Guardar grabación</span>
                </button>
            `;

            const btnPause = document.getElementById('btnNuevoMotorPause');
            if (btnPause) btnPause.onclick = () => this.togglePause();

            const btnSave = document.getElementById('btnNuevoMotorSave');
            if (btnSave) btnSave.onclick = () => this.stopAndSave();
        },

        // ====================================================================
        // PLAN A: GRABACIÓN INTERNA DE ESCENARIO (0 POPUPS DE PERMISO)
        // ====================================================================
        startStageRecording() {
            if (this.isRecording || this.isSaving) return false;
            const role = String(this.meetApp?.userRole || '').toLowerCase().trim();
            if (role !== 'admin') return false;

            this.recordedChunks = [];
            this.elapsedSeconds = 0;
            this.isPaused = false;
            this.connectedTrackIds = new Set();
            this.sourceNodes = [];

            // 1. Crear Canvas interno 1920x1080 (Full HD 16:9) que captura todo el escenario con nitidez de texto
            this.canvas = document.createElement('canvas');
            this.canvas.width = 1920;
            this.canvas.height = 1080;
            this.ctx = this.canvas.getContext('2d', { alpha: false });
            if (this.ctx) {
                this.ctx.imageSmoothingEnabled = true;
                this.ctx.imageSmoothingQuality = 'high';
            }

            // Dibujar primer fotograma de inmediato
            this.drawStageFrameToCanvas();
            this.drawInterval = setInterval(() => {
                if (!this.isPaused) {
                    this.drawStageFrameToCanvas();
                }
            }, 50); // 20 FPS constantes incluso si cambia de pestaña

            this.canvasStream = this.canvas.captureStream(20);

            // 2. Mezclador continuo de audio (Micrófono local + Audio de pantalla + Audio remoto)
            const AudioCtx = window.AudioContext || window.webkitAudioContext;
            this.audioCtx = new AudioCtx();
            if (this.audioCtx.state === 'suspended') {
                this.audioCtx.resume().catch(() => {});
            }
            this.audioDest = this.audioCtx.createMediaStreamDestination();

            // Oscilador silencioso para mantener la pista de audio viva aunque todos estén en mute
            try {
                const osc = this.audioCtx.createOscillator();
                const gain = this.audioCtx.createGain();
                gain.gain.value = 0.00001;
                osc.connect(gain);
                gain.connect(this.audioDest);
                osc.start();
                this.keepAliveOsc = osc;
            } catch (e) {}

            this.syncAudioSourcesIntoMixer();
            this.audioPollInterval = setInterval(() => {
                this.syncAudioSourcesIntoMixer();
            }, 400);

            // 3. Combinar pista de video del Canvas + pista de audio del Mezclador
            const videoTrack = this.canvasStream.getVideoTracks()[0];
            if (videoTrack && 'contentHint' in videoTrack) {
                try { videoTrack.contentHint = 'detail'; } catch (e) {}
            }
            const audioTrack = this.audioDest.stream.getAudioTracks()[0];
            const tracks = [videoTrack];
            if (audioTrack) tracks.push(audioTrack);
            this.combinedStream = new MediaStream(tracks);

            const mimeCandidates = [
                'video/mp4;codecs=avc1.64002A,mp4a.40.2',
                'video/mp4;codecs=avc1.640028,mp4a.40.2',
                'video/mp4;codecs=avc1.4D402A,mp4a.40.2',
                'video/mp4;codecs=avc1.4D4028,mp4a.40.2',
                'video/mp4;codecs=avc1,mp4a.40.2',
                'video/mp4;codecs=avc1,opus',
                'video/mp4',
                'video/webm;codecs=vp9,opus',
                'video/webm;codecs=vp8,opus',
                'video/webm;codecs=h264,opus',
                'video/webm'
            ];
            const mimeType = mimeCandidates.find(t => typeof MediaRecorder !== 'undefined' && MediaRecorder.isTypeSupported(t)) || 'video/webm';

            this.mediaRecorder = new MediaRecorder(this.combinedStream, {
                mimeType,
                videoBitsPerSecond: 2500000,
                audioBitsPerSecond: 64000
            });

            this.mediaRecorder.ondataavailable = (e) => {
                if (e.data && e.data.size > 0) {
                    this.recordedChunks.push(e.data);
                    this.updateLiveStatsUI();
                }
            };

            this.mediaRecorder.start(2000);
            this.isRecording = true;
            this.recordingStartMs = Date.now();

            this.timerInterval = setInterval(() => {
                if (!this.isPaused) {
                    this.elapsedSeconds++;
                    this.updateLiveStatsUI();
                }
            }, 1000);

            this.renderMeetControlsUI();
            return true;
        },

        syncAudioSourcesIntoMixer() {
            if (!this.audioCtx || !this.audioDest || !this.meetApp) return;

            const tryConnectTrack = (track) => {
                if (!track || track.kind !== 'audio' || track.readyState !== 'live') return;
                if (this.connectedTrackIds.has(track.id)) return;
                try {
                    const src = this.audioCtx.createMediaStreamSource(new MediaStream([track]));
                    src.connect(this.audioDest);
                    this.connectedTrackIds.add(track.id);
                    this.sourceNodes.push(src);
                } catch (e) {}
            };

            if (this.meetApp.micStream) {
                this.meetApp.micStream.getAudioTracks().forEach(tryConnectTrack);
            }
            if (this.meetApp.screenStream) {
                this.meetApp.screenStream.getAudioTracks().forEach(tryConnectTrack);
            }
            const remoteAudioContainer = document.getElementById('remoteAudios');
            if (remoteAudioContainer) {
                remoteAudioContainer.querySelectorAll('audio').forEach(aud => {
                    if (aud.srcObject && typeof aud.srcObject.getAudioTracks === 'function') {
                        aud.srcObject.getAudioTracks().forEach(tryConnectTrack);
                    }
                });
            }
        },

        drawStageFrameToCanvas() {
            if (!this.ctx || !this.canvas) return;
            const ctx = this.ctx;
            const W = this.canvas.width;
            const H = this.canvas.height;

            // Fondo limpio del escenario (#f9fafb)
            ctx.fillStyle = '#f9fafb';
            ctx.fillRect(0, 0, W, H);

            const stageVideo = document.getElementById('stageVideo');
            const isVideoVisible = stageVideo && stageVideo.classList.contains('is-visible') && stageVideo.videoWidth > 0 && stageVideo.videoHeight > 0;

            if (isVideoVisible) {
                const vw = stageVideo.videoWidth;
                const vh = stageVideo.videoHeight;
                const scale = Math.min(W / vw, H / vh);
                const dw = vw * scale;
                const dh = vh * scale;
                const dx = (W - dw) / 2;
                const dy = (H - dh) / 2;

                ctx.save();
                ctx.imageSmoothingEnabled = true;
                ctx.imageSmoothingQuality = 'high';
                if (this.meetApp && this.meetApp.camEnabled && !this.meetApp.screenEnabled) {
                    ctx.translate(W, 0);
                    ctx.scale(-1, 1);
                    ctx.drawImage(stageVideo, W - dx - dw, dy, dw, dh);
                } else {
                    ctx.drawImage(stageVideo, dx, dy, dw, dh);
                }
                ctx.restore();
            } else {
                // Dibujar el Avatar centrado con su efecto de latido reactivo a voz
                const cx = W / 2;
                const cy = H / 2;
                const baseRadius = 56;
                const lvl = (this.meetApp && typeof this.meetApp.smoothedVoiceLevel === 'number') ? this.meetApp.smoothedVoiceLevel : 0;

                if (lvl > 0.025) {
                    const r2 = baseRadius + 8 + lvl * 28;
                    ctx.beginPath();
                    ctx.arc(cx, cy, r2, 0, Math.PI * 2);
                    ctx.fillStyle = `rgba(17, 17, 17, ${(0.05 + lvl * 0.08).toFixed(3)})`;
                    ctx.fill();

                    const r1 = baseRadius + 4 + lvl * 14;
                    ctx.beginPath();
                    ctx.arc(cx, cy, r1, 0, Math.PI * 2);
                    ctx.fillStyle = `rgba(17, 17, 17, ${(0.12 + lvl * 0.16).toFixed(3)})`;
                    ctx.fill();
                }

                const avatarRadius = baseRadius * (1 + lvl * 0.05);
                ctx.beginPath();
                ctx.arc(cx, cy, avatarRadius, 0, Math.PI * 2);
                ctx.fillStyle = '#ffffff';
                ctx.fill();
                ctx.lineWidth = 2;
                ctx.strokeStyle = lvl > 0.18 ? '#111111' : (lvl > 0.025 ? '#6b7280' : '#d1d5db');
                ctx.stroke();

                const initial = ((this.meetApp && this.meetApp.userName ? this.meetApp.userName.trim()[0] : 'M') || 'M').toUpperCase();
                ctx.fillStyle = '#111111';
                ctx.font = '500 40px -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif';
                ctx.textAlign = 'center';
                ctx.textBaseline = 'middle';
                ctx.fillText(initial, cx, cy + 2);
            }

            // Etiqueta inferior izquierda del participante
            const labelEl = document.getElementById('stageParticipantLabel');
            const labelText = (labelEl && labelEl.textContent) ? labelEl.textContent.trim() : (this.meetApp?.userName || 'Admin');
            ctx.font = '500 16px -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif';
            const textMetrics = ctx.measureText(labelText);
            const padX = 12;
            const boxW = textMetrics.width + padX * 2;
            const boxH = 32;
            const boxX = 24;
            const boxY = H - 24 - boxH;

            ctx.fillStyle = 'rgba(255, 255, 255, 0.9)';
            ctx.fillRect(boxX, boxY, boxW, boxH);
            ctx.strokeStyle = '#e5e7eb';
            ctx.lineWidth = 1;
            ctx.strokeRect(boxX, boxY, boxW, boxH);

            ctx.fillStyle = '#111111';
            ctx.textAlign = 'left';
            ctx.textBaseline = 'middle';
            ctx.fillText(labelText, boxX + padX, boxY + boxH / 2);
        },

        updateLiveStatsUI() {
            const timerEl = document.getElementById('nuevoMotorTimerText');
            if (timerEl) timerEl.textContent = formatClock(this.elapsedSeconds);
        },

        togglePause() {
            if (!this.isRecording || !this.mediaRecorder) return;
            if (this.mediaRecorder.state === 'recording') {
                this.mediaRecorder.pause();
                this.isPaused = true;
            } else if (this.mediaRecorder.state === 'paused') {
                this.mediaRecorder.resume();
                this.isPaused = false;
            }
            this.renderMeetControlsUI();
        },

        stopAndSave() {
            if (!this.isRecording && this.recordedChunks.length === 0) {
                return Promise.resolve(null);
            }
            if (this.isSaving) {
                return this._activeSavePromise || Promise.resolve(null);
            }

            this.isSaving = true;
            this.isRecording = false;
            this.isPaused = false;

            if (this.timerInterval) {
                clearInterval(this.timerInterval);
                this.timerInterval = null;
            }
            if (this.drawInterval) {
                clearInterval(this.drawInterval);
                this.drawInterval = null;
            }
            if (this.audioPollInterval) {
                clearInterval(this.audioPollInterval);
                this.audioPollInterval = null;
            }

            this.renderMeetControlsUI();

            this._activeSavePromise = new Promise((resolve) => {
                const finalizeRecording = async () => {
                    const mimeType = this.mediaRecorder?.mimeType || 'video/webm';
                    let blob = new Blob(this.recordedChunks, { type: mimeType });
                    const durationSec = Math.max(1, this.elapsedSeconds);
                    const durationMs = durationSec * 1000;

                    this.cleanupRecordingResources();

                    if (blob.size < 500) {
                        this.isSaving = false;
                        this.renderMeetControlsUI();
                        resolve(null);
                        return;
                    }

                    // Inyectar duración exacta y reparar encabezados en contenedores MP4 o WebM
                    if (typeof window.ysFixWebmDuration === 'function') {
                        try {
                            blob = await window.ysFixWebmDuration(blob, durationMs);
                        } catch (e) {}
                    }

                    const isMp4 = String(mimeType).toLowerCase().includes('mp4') || String(blob.type).toLowerCase().includes('mp4');
                    const ext = isMp4 ? 'mp4' : 'webm';
                    const roomCode = (this.meetApp && this.meetApp.roomCode) ? this.meetApp.roomCode : 'sala-meet';
                    const instructor = (this.meetApp && this.meetApp.userName) ? this.meetApp.userName : 'Admin';
                    const now = Date.now();
                    const filename = `clase_meet_${roomCode.replace(/[^a-z0-9_-]/gi, '')}_${now}.${ext}`;

                    this.showMeetUploadProgress(0, blob.size, 'Subiendo grabación de clase...');

                    try {
                        const publicUrl = await this.uploadBlobToR2(blob, filename, (pct, loaded, total) => {
                            this.showMeetUploadProgress(pct, total, `Subiendo grabación (${pct}%)...`);
                        });

                        const recItem = {
                            id: 'rec_' + now,
                            title: `Clase en Vivo (${roomCode})`,
                            roomCode: roomCode,
                            instructor: instructor,
                            url: publicUrl,
                            durationSeconds: durationSec,
                            sizeBytes: blob.size,
                            createdAt: new Date(now).toISOString(),
                            timestamp: now
                        };

                        await this.persistNewRecording(recItem);
                        this.showMeetUploadProgress(100, blob.size, 'Grabación guardada con éxito.', true);
                        setTimeout(() => this.hideMeetUploadProgress(), 1800);

                        this.isSaving = false;
                        this.renderMeetControlsUI();
                        resolve(recItem);
                    } catch (err) {
                        console.error('[NuevoMotorGrabaciones] Error subiendo a R2:', err);
                        this.showMeetUploadProgress(0, blob.size, 'Error al subir la grabación.', true);
                        setTimeout(() => this.hideMeetUploadProgress(), 2500);
                        this.isSaving = false;
                        this.renderMeetControlsUI();
                        resolve(null);
                    }
                };

                if (this.mediaRecorder && this.mediaRecorder.state !== 'inactive') {
                    if (this.mediaRecorder.state === 'paused') {
                        try { this.mediaRecorder.resume(); } catch (e) {}
                    }
                    this.mediaRecorder.onstop = finalizeRecording;
                    try { this.mediaRecorder.requestData(); } catch (e) {}
                    try { this.mediaRecorder.stop(); } catch (e) { finalizeRecording(); }
                } else {
                    finalizeRecording();
                }
            });

            return this._activeSavePromise;
        },

        cleanupRecordingResources() {
            if (this.keepAliveOsc) {
                try { this.keepAliveOsc.stop(); } catch (e) {}
                this.keepAliveOsc = null;
            }
            this.sourceNodes.forEach(s => {
                try { s.disconnect(); } catch (e) {}
            });
            this.sourceNodes = [];
            this.connectedTrackIds.clear();

            if (this.canvasStream) {
                this.canvasStream.getTracks().forEach(t => { try { t.stop(); } catch (e) {} });
                this.canvasStream = null;
            }
            if (this.audioCtx) {
                try { this.audioCtx.close(); } catch (e) {}
                this.audioCtx = null;
            }
            this.audioDest = null;
            this.combinedStream = null;
            this.mediaRecorder = null;
            this.recordedChunks = [];
        },

        uploadBlobToR2(blob, filename, onProgress) {
            return new Promise((resolve, reject) => {
                const uploadUrl = `${WORKER_UPLOAD_URL}?filename=${encodeURIComponent(filename)}`;
                const xhr = new XMLHttpRequest();
                xhr.open('PUT', uploadUrl);
                xhr.setRequestHeader('Content-Type', blob.type || 'video/webm');

                xhr.upload.onprogress = (e) => {
                    if (e.lengthComputable && typeof onProgress === 'function') {
                        const pct = Math.round((e.loaded / e.total) * 100);
                        onProgress(pct, e.loaded, e.total);
                    }
                };

                xhr.onload = () => {
                    if (xhr.status >= 200 && xhr.status < 300) {
                        try {
                            const data = JSON.parse(xhr.responseText);
                            if (data && data.url) {
                                resolve(data.url);
                            } else {
                                reject(new Error('Respuesta sin URL pública'));
                            }
                        } catch (e) {
                            reject(new Error('Respuesta JSON inválida del servidor de grabaciones'));
                        }
                    } else {
                        reject(new Error(`HTTP ${xhr.status}`));
                    }
                };

                xhr.onerror = () => reject(new Error('Error de red al subir grabación'));
                xhr.send(blob);
            });
        },

        async persistNewRecording(recItem) {
            this.loadLocalRecordings();
            this.recordingsList = [recItem, ...this.recordingsList.filter(r => r.id !== recItem.id)];
            this.saveLocalRecordings();

            if (this.firestoreDb && this.firestoreFns && this.firestoreFns.doc && this.firestoreFns.setDoc) {
                try {
                    const ref = this.firestoreFns.doc(this.firestoreDb, 'grabaciones_meet', recItem.id);
                    await this.firestoreFns.setDoc(ref, recItem);
                } catch (e) {
                    console.warn('[NuevoMotorGrabaciones] Aviso guardando en Firestore:', e);
                }
            }
        },

        async deleteRecording(recId) {
            this.recordingsList = this.recordingsList.filter(r => r.id !== recId);
            this.saveLocalRecordings();

            if (this.firestoreDb && this.firestoreFns && this.firestoreFns.doc && this.firestoreFns.deleteDoc) {
                try {
                    const ref = this.firestoreFns.doc(this.firestoreDb, 'grabaciones_meet', recId);
                    await this.firestoreFns.deleteDoc(ref);
                } catch (e) {}
            }

            if (this.activePlayingId === recId) {
                this.activePlayingId = this.recordingsList[0]?.id || null;
            }
            this.renderRecordingsListUI();
            this.renderActivePlayerUI();
        },

        ensureUploadOverlayInMeet() {
            if (document.getElementById('nuevoMotorUploadBanner')) return;
            const banner = document.createElement('div');
            banner.id = 'nuevoMotorUploadBanner';
            banner.style.cssText = 'display:none;position:fixed;bottom:84px;left:50%;transform:translateX(-50%);background:#ffffff;color:#111111;border:1px solid #111111;border-radius:10px;padding:10px 18px;font-size:13px;font-weight:500;z-index:9999;box-shadow:0 6px 20px rgba(0,0,0,0.08);min-width:280px;text-align:center;';
            banner.innerHTML = `
                <div id="nuevoMotorUploadText" style="margin-bottom:6px;">Guardando grabación...</div>
                <div style="width:100%;height:4px;background:#e5e7eb;border-radius:999px;overflow:hidden;">
                    <div id="nuevoMotorUploadBar" style="width:0%;height:100%;background:#111111;transition:width 0.15s;"></div>
                </div>
            `;
            document.body.appendChild(banner);
        },

        showMeetUploadProgress(pct, totalBytes, text) {
            this.ensureUploadOverlayInMeet();
            const banner = document.getElementById('nuevoMotorUploadBanner');
            const txtEl = document.getElementById('nuevoMotorUploadText');
            const barEl = document.getElementById('nuevoMotorUploadBar');
            if (banner) banner.style.display = 'block';
            if (txtEl) txtEl.textContent = text;
            if (barEl) barEl.style.width = `${Math.min(100, Math.max(0, pct))}%`;
        },

        hideMeetUploadProgress() {
            const banner = document.getElementById('nuevoMotorUploadBanner');
            if (banner) banner.style.display = 'none';
        },

        // ====================================================================
        // PARTE 2: POPUP "VER GRABACIONES" Y REPRODUCTOR FINO EN INDEX.HTML
        // ====================================================================
        ensureRecordingsModalDOM() {
            if (document.getElementById('nuevoMotorModalOverlay')) return;

            const overlay = document.createElement('div');
            overlay.id = 'nuevoMotorModalOverlay';
            overlay.style.cssText = 'display:none;position:fixed;inset:0;background:rgba(0,0,0,0.45);z-index:99999;align-items:center;justify-content:center;padding:20px;font-family:-apple-system,BlinkMacSystemFont,"Segoe UI",Roboto,sans-serif;';

            overlay.innerHTML = `
                <div style="background:#ffffff;color:#111111;border:1px solid #d1d5db;border-radius:14px;width:100%;max-width:980px;max-height:88vh;display:flex;flex-direction:column;overflow:hidden;box-shadow:0 12px 32px rgba(0,0,0,0.14);">
                    <!-- Header -->
                    <div style="padding:14px 20px;border-bottom:1px solid #e5e7eb;display:flex;align-items:center;justify-content:space-between;background:#ffffff;">
                        <div style="display:flex;align-items:center;gap:10px;">
                            <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="#111111" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round">
                                <rect x="2" y="4" width="20" height="16" rx="2"></rect>
                                <polygon points="10 9 15 12 10 15 10 9"></polygon>
                            </svg>
                            <span style="font-size:15px;font-weight:600;color:#111111;">Grabaciones de Clases (Admin)</span>
                        </div>
                        <button type="button" id="btnNuevoMotorCloseModal" style="border:1px solid #d1d5db;background:#ffffff;color:#111111;padding:5px 12px;border-radius:8px;font-size:12px;font-weight:600;cursor:pointer;">Cerrar</button>
                    </div>

                    <!-- Body -->
                    <div style="flex:1;display:flex;min-height:0;overflow:hidden;background:#ffffff;flex-wrap:wrap;">
                        <!-- Reproductor Fino (Izquierda / Principal) -->
                        <div style="flex:1.6;min-width:320px;padding:18px;border-right:1px solid #e5e7eb;display:flex;flex-direction:column;background:#f9fafb;">
                            <div id="nuevoMotorPlayerArea" style="flex:1;display:flex;flex-direction:column;justify-content:center;"></div>
                        </div>

                        <!-- Lista de Grabaciones (Derecha) -->
                        <div style="flex:1;min-width:280px;max-height:74vh;overflow-y:auto;padding:16px;background:#ffffff;">
                            <div style="font-size:11px;font-weight:600;text-transform:uppercase;color:#6b7280;margin-bottom:10px;padding-bottom:6px;border-bottom:1px solid #e5e7eb;">Historial de grabaciones</div>
                            <div id="nuevoMotorRecordingsList"></div>
                        </div>
                    </div>
                </div>
            `;

            document.body.appendChild(overlay);

            overlay.addEventListener('click', (e) => {
                if (e.target === overlay) this.closeRecordingsModal();
            });
            const btnClose = document.getElementById('btnNuevoMotorCloseModal');
            if (btnClose) btnClose.onclick = () => this.closeRecordingsModal();
        },

        openRecordingsModal() {
            this.ensureRecordingsModalDOM();
            this.loadLocalRecordings();

            if (!this.activePlayingId && this.recordingsList.length > 0) {
                this.activePlayingId = this.recordingsList[0].id;
            }

            this.renderRecordingsListUI();
            this.renderActivePlayerUI();

            const overlay = document.getElementById('nuevoMotorModalOverlay');
            if (overlay) overlay.style.display = 'flex';
        },

        closeRecordingsModal() {
            const videoEl = document.getElementById('nuevoMotorMainVideo');
            if (videoEl) {
                try { videoEl.pause(); } catch (e) {}
            }
            const overlay = document.getElementById('nuevoMotorModalOverlay');
            if (overlay) overlay.style.display = 'none';
        },

        selectRecordingToPlay(recId) {
            this.activePlayingId = recId;
            this.renderRecordingsListUI();
            this.renderActivePlayerUI();
        },

        setPlaybackSpeed(rate, btnEl) {
            const videoEl = document.getElementById('nuevoMotorMainVideo');
            if (videoEl) videoEl.playbackRate = rate;
            document.querySelectorAll('.nm-speed-btn').forEach(b => {
                b.style.background = '#ffffff';
                b.style.color = '#111111';
            });
            if (btnEl) {
                btnEl.style.background = '#111111';
                btnEl.style.color = '#ffffff';
            }
        },

        async downloadRecording(recId, btnEl) {
            const rec = this.recordingsList.find(r => r.id === recId) || this.recordingsList[0];
            if (!rec || !rec.url) return;

            const spanEl = btnEl ? btnEl.querySelector('span') : null;
            const origText = spanEl ? spanEl.textContent : 'Descargar';
            if (btnEl) {
                btnEl.disabled = true;
                btnEl.style.opacity = '0.65';
            }
            if (spanEl) spanEl.textContent = 'Descargando...';

            try {
                const resp = await fetch(rec.url, { mode: 'cors', credentials: 'omit' });
                if (!resp.ok) throw new Error('HTTP ' + resp.status);
                const arrayBuf = await resp.arrayBuffer();
                let u8 = new Uint8Array(arrayBuf);
                const durationMs = Math.max(1, Number(rec.durationSeconds || 0)) * 1000;

                if (typeof window.ysRepairVideoBuffer === 'function') {
                    try {
                        u8 = window.ysRepairVideoBuffer(u8, durationMs);
                    } catch (e) {}
                }

                const isMp4 = (u8.length >= 12 && u8[4] === 0x66 && u8[5] === 0x74 && u8[6] === 0x79 && u8[7] === 0x70) ||
                              String(rec.url).toLowerCase().endsWith('.mp4');
                const mimeType = isMp4 ? 'video/mp4' : 'video/webm';
                const ext = isMp4 ? 'mp4' : 'webm';
                const blob = new Blob([u8.buffer], { type: mimeType });

                let rawName = String(rec.url).split('/').pop().split('?')[0] || `clase_meet_${rec.roomCode || 'ubuntu'}.${ext}`;
                rawName = rawName.replace(/\.(webm|mp4)$/i, '') + '.' + ext;

                const blobUrl = URL.createObjectURL(blob);
                const a = document.createElement('a');
                a.href = blobUrl;
                a.download = rawName;
                a.style.display = 'none';
                document.body.appendChild(a);
                a.click();
                setTimeout(() => {
                    try { document.body.removeChild(a); } catch (e) {}
                    try { URL.revokeObjectURL(blobUrl); } catch (e) {}
                }, 4000);
            } catch (err) {
                console.error('[NuevoMotorGrabaciones] Error en descarga directa:', err);
            } finally {
                if (btnEl) {
                    btnEl.disabled = false;
                    btnEl.style.opacity = '1';
                }
                if (spanEl) spanEl.textContent = origText;
            }
        },

        renderActivePlayerUI() {
            const area = document.getElementById('nuevoMotorPlayerArea');
            if (!area) return;

            const rec = this.recordingsList.find(r => r.id === this.activePlayingId) || this.recordingsList[0];
            if (!rec) {
                area.innerHTML = `
                    <div style="text-align:center;padding:40px 20px;color:#6b7280;font-size:13px;">
                        No hay grabaciones registradas todavía. Inicia una reunión desde "new class" y presiona "Grabar".
                    </div>
                `;
                return;
            }

            this.activePlayingId = rec.id;
            const mbStr = rec.sizeBytes ? `${(rec.sizeBytes / (1024 * 1024)).toFixed(2)} MB` : '';
            const durStr = rec.durationSeconds ? formatClock(rec.durationSeconds) : '';
            const isMp4Url = String(rec.url || '').toLowerCase().includes('.mp4');
            const videoMime = isMp4Url ? 'video/mp4' : 'video/webm';

            area.innerHTML = `
                <div style="display:flex;align-items:center;justify-content:space-between;gap:8px;margin-bottom:10px;flex-wrap:wrap;">
                    <div>
                        <div style="font-size:14px;font-weight:600;color:#111111;">${escapeHtml(rec.title || 'Clase Grabada')}</div>
                        <div style="font-size:12px;color:#6b7280;">${escapeHtml(rec.instructor || 'Admin')} ${rec.createdAt ? ' • ' + formatDate(rec.createdAt) : ''} ${durStr ? ' • ' + durStr : ''} ${mbStr ? ' • ' + mbStr : ''}</div>
                    </div>
                    <div style="display:flex;align-items:center;gap:6px;flex-wrap:wrap;">
                        <div style="display:inline-flex;border:1px solid #d1d5db;border-radius:6px;overflow:hidden;">
                            <button type="button" class="nm-speed-btn" onclick="window.NuevoMotorGrabaciones.setPlaybackSpeed(1, this)" style="border:none;background:#111111;color:#ffffff;padding:4px 8px;font-size:11px;font-weight:600;cursor:pointer;">1x</button>
                            <button type="button" class="nm-speed-btn" onclick="window.NuevoMotorGrabaciones.setPlaybackSpeed(1.25, this)" style="border:none;border-left:1px solid #d1d5db;background:#ffffff;color:#111111;padding:4px 8px;font-size:11px;font-weight:600;cursor:pointer;">1.25x</button>
                            <button type="button" class="nm-speed-btn" onclick="window.NuevoMotorGrabaciones.setPlaybackSpeed(1.5, this)" style="border:none;border-left:1px solid #d1d5db;background:#ffffff;color:#111111;padding:4px 8px;font-size:11px;font-weight:600;cursor:pointer;">1.5x</button>
                            <button type="button" class="nm-speed-btn" onclick="window.NuevoMotorGrabaciones.setPlaybackSpeed(2, this)" style="border:none;border-left:1px solid #d1d5db;background:#ffffff;color:#111111;padding:4px 8px;font-size:11px;font-weight:600;cursor:pointer;">2x</button>
                        </div>
                        <button type="button" id="btnNuevoMotorDownload" onclick="window.NuevoMotorGrabaciones.downloadRecording('${escapeHtml(rec.id)}', this)" style="border:1px solid #d1d5db;background:#ffffff;color:#111111;padding:5px 10px;border-radius:6px;font-size:12px;font-weight:500;cursor:pointer;display:inline-flex;align-items:center;gap:5px;">
                            <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
                                <path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4"></path>
                                <polyline points="7 10 12 15 17 10"></polyline>
                                <line x1="12" y1="15" x2="12" y2="3"></line>
                            </svg>
                            <span>Descargar</span>
                        </button>
                        <a href="${escapeHtml(rec.url)}" target="_blank" style="border:1px solid #d1d5db;background:#ffffff;color:#111111;padding:5px 10px;border-radius:6px;font-size:12px;font-weight:500;text-decoration:none;">Abrir enlace</a>
                    </div>
                </div>

                <div style="border-radius:10px;overflow:hidden;border:1px solid #d1d5db;background:#111111;">
                    <video id="nuevoMotorMainVideo" controls playsinline preload="metadata" style="width:100%;max-height:460px;display:block;background:#111111;outline:none;" src="${escapeHtml(rec.url)}">
                        <source src="${escapeHtml(rec.url)}" type="${videoMime}">
                    </video>
                </div>
            `;
        },

        renderRecordingsListUI() {
            const listEl = document.getElementById('nuevoMotorRecordingsList');
            if (!listEl) return;

            if (this.recordingsList.length === 0) {
                listEl.innerHTML = `<div style="color:#6b7280;font-size:12px;padding:12px 0;">Sin grabaciones aún.</div>`;
                return;
            }

            listEl.innerHTML = this.recordingsList.map((rec) => {
                const isSelected = rec.id === this.activePlayingId;
                const durStr = rec.durationSeconds ? formatClock(rec.durationSeconds) : '00:00';
                const mbStr = rec.sizeBytes ? `${(rec.sizeBytes / (1024 * 1024)).toFixed(1)} MB` : '';

                return `
                    <div style="padding:10px;border:1px solid ${isSelected ? '#111111' : '#e5e7eb'};border-radius:8px;margin-bottom:8px;background:${isSelected ? '#f9fafb' : '#ffffff'};display:flex;flex-direction:column;gap:6px;">
                        <div style="display:flex;align-items:center;justify-content:space-between;gap:6px;">
                            <span style="font-size:13px;font-weight:600;color:#111111;">${escapeHtml(rec.title || rec.roomCode)}</span>
                            <span style="font-size:11px;font-family:monospace;color:#4b5563;background:#f3f4f6;padding:2px 6px;border-radius:4px;">${durStr}</span>
                        </div>
                        <div style="font-size:11px;color:#6b7280;">
                            ${rec.createdAt ? formatDate(rec.createdAt) : ''} ${mbStr ? ' • ' + mbStr : ''}
                        </div>
                        <div style="display:flex;align-items:center;gap:6px;margin-top:2px;">
                            <button type="button" onclick="window.NuevoMotorGrabaciones.selectRecordingToPlay('${escapeHtml(rec.id)}')" style="border:1px solid #111111;background:${isSelected ? '#111111' : '#ffffff'};color:${isSelected ? '#ffffff' : '#111111'};padding:4px 10px;border-radius:6px;font-size:11px;font-weight:600;cursor:pointer;">
                                ${isSelected ? 'Reproduciendo' : 'Reproducir'}
                            </button>
                            <button type="button" onclick="window.NuevoMotorGrabaciones.deleteRecording('${escapeHtml(rec.id)}')" style="border:1px solid #d1d5db;background:#ffffff;color:#4b5563;padding:4px 8px;border-radius:6px;font-size:11px;cursor:pointer;">
                                Eliminar
                            </button>
                        </div>
                    </div>
                `;
            }).join('');
        }
    };

    window.NuevoMotorGrabaciones = NuevoMotorGrabaciones;
})();
