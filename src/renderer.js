document.addEventListener('DOMContentLoaded', async () => {
    // --- UI Elements - Global ---
    const navItems = document.querySelectorAll('.nav-item');
    const tabContents = document.querySelectorAll('.tab-content');
    const miniLog = document.getElementById('mini-log');
    const logsBody = document.getElementById('logs-body');
    const monitoringStatus = document.getElementById('monitoring-status');
    const globalResultsPanel = document.getElementById('global-results-panel');
    const mainPanel = document.getElementById('main-panel');

    // --- UI Elements - Multi-Camera ---
    const addCameraBtn = document.getElementById('add-camera-btn');
    const cameraContainer = document.getElementById('camera-container');
    const noCamerasMsg = document.getElementById('no-cameras-msg');
    const cameraCardTemplate = document.getElementById('camera-card-template');
    const autoAiToggle = document.getElementById('auto-ai-toggle');
    const voiceAiToggle = document.getElementById('voice-ai-toggle');

    // --- UI Elements - Manual Capture & Upload ---
    const captureCamBtn = document.getElementById('capture-cam-btn');
    const processCaptureBtn = document.getElementById('process-capture-btn');
    const manualCanvas = document.getElementById('manual-canvas');
    const canvasPlaceholder = document.getElementById('canvas-placeholder');
    const uploadBtn = document.getElementById('upload-btn');
    const processUploadBtn = document.getElementById('process-upload-btn');
    const uploadPrompt = document.getElementById('upload-prompt');
    const previewContainer = document.getElementById('image-preview-container');
    const imagePreview = document.getElementById('image-preview');
    const resStatus = document.getElementById('res-status');
    const resScore = document.getElementById('res-score');
    const resRecommendation = document.getElementById('res-recommendation');
    const resNudge = document.getElementById('res-nudge');
    const resDescription = document.getElementById('res-description');

    // --- State Management ---
    const activeCameras = [];
    const MAX_CAMERAS = 3;
    let cameraIdCounter = 0;
    const ANALYSIS_INTERVAL_MS = 4500;
    const COOLDOWN_MS = 6000;
    let tamilVoice = null;

    // --- Analytics State ---
    const refreshAnalyticsBtn = document.getElementById('refresh-analytics-btn');
    let trendChartInstance = null;
    let distributionChartInstance = null;
    let cameraChartInstance = null;

    function writeMiniLog(message) {
        if (!miniLog) return;
        const time = new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit', second: '2-digit' });
        miniLog.innerHTML = `> [${time}] ${message}<br>` + miniLog.innerHTML;
        if (miniLog.children.length > 30) miniLog.innerHTML = miniLog.innerHTML.split('<br>').slice(0, 30).join('<br>');
    }

    // --- TTS Initializer ---
    function initTTS() {
        const setVoice = () => {
            const voices = window.speechSynthesis.getVoices();
            tamilVoice = voices.find(v => v.lang.includes('ta-IN')) || voices.find(v => v.lang.includes('ta')) || voices[0];
            if (tamilVoice) {
                console.log("TTS Initialized with voice:", tamilVoice.name);
                window.electronAPI.logAction('TTS_INITIALIZED', `Loaded voice: ${tamilVoice.name}`);
            }
        };
        if (window.speechSynthesis.onvoiceschanged !== undefined) {
            window.speechSynthesis.onvoiceschanged = setVoice;
        }
        setVoice();
    }
    initTTS();

    // --- Global Speech Queue Manager ---
    const speechQueue = [];
    let isSpeaking = false;

    function queueSpeech(cameraName, text) {
        if (!voiceAiToggle.checked) return;

        speechQueue.push({ cameraName, text });
        window.electronAPI.logAction('TTS_QUEUE_ADDED', `From: ${cameraName}, Queue Size: ${speechQueue.length}`);

        processNextInQueue();
    }

    function processNextInQueue() {
        if (isSpeaking || speechQueue.length === 0) return;

        isSpeaking = true;
        const entry = speechQueue.shift();
        const announcement = `${entry.cameraName}: ${entry.text}`;
        const utterance = new SpeechSynthesisUtterance(announcement);

        if (tamilVoice) utterance.voice = tamilVoice;
        utterance.lang = 'ta-IN';
        utterance.rate = 0.9;
        utterance.pitch = 1;
        utterance.volume = 1;

        utterance.onstart = () => {
            window.electronAPI.logAction('TTS_SPEAKING_STARTED', entry.cameraName);
            writeMiniLog(`🔊 Announcing: ${entry.cameraName}`);
        };

        utterance.onend = () => {
            isSpeaking = false;
            window.electronAPI.logAction('TTS_SPEAKING_COMPLETED', entry.cameraName);
            // Process next after a tiny delay for natural gap
            setTimeout(processNextInQueue, 500);
        };

        utterance.onerror = (err) => {
            console.error("TTS Error:", err);
            isSpeaking = false;
            processNextInQueue();
        };

        window.speechSynthesis.speak(utterance);
    }

    // --- Analytics Management ---
    async function refreshAnalytics() {
        try {
            writeMiniLog("Fetching latest surveillance analytics...");
            const response = await fetch('https://sit.zethub.in/api/analytics');
            const data = await response.json();

            if (!response.ok) throw new Error(data.error);

            renderTrendChart(data.trends);
            renderDistributionChart(data.distribution);
            renderCameraChart(data.cameraStats);

            writeMiniLog("Analytics Report Updated Successfully.");
        } catch (err) {
            console.error(err);
            writeMiniLog(`[ERROR] Analytics Fetch Failed: ${err.message}`);
        }
    }

    function renderTrendChart(trends) {
        const ctx = document.getElementById('trendChart').getContext('2d');
        const labels = trends.map(t => t.hour);
        const scores = trends.map(t => parseFloat(t.avg_score).toFixed(1));

        if (trendChartInstance) trendChartInstance.destroy();

        trendChartInstance = new Chart(ctx, {
            type: 'line',
            data: {
                labels: labels,
                datasets: [{
                    label: 'Avg Cleanliness Score',
                    data: scores,
                    borderColor: '#6366f1',
                    backgroundColor: 'rgba(99, 102, 241, 0.1)',
                    fill: true,
                    tension: 0.4
                }]
            },
            options: {
                responsive: true,
                maintainAspectRatio: false,
                scales: {
                    y: { beginAtZero: true, max: 100, grid: { color: 'rgba(255,255,255,0.05)' } },
                    x: { grid: { color: 'rgba(255,255,255,0.05)' } }
                }
            }
        });
    }

    function renderDistributionChart(distribution) {
        const ctx = document.getElementById('distributionChart').getContext('2d');
        const labels = distribution.map(d => d.status);
        const counts = distribution.map(d => d.count);

        if (distributionChartInstance) distributionChartInstance.destroy();

        distributionChartInstance = new Chart(ctx, {
            type: 'doughnut',
            data: {
                labels: labels,
                datasets: [{
                    data: counts,
                    backgroundColor: ['#10b981', '#ef4444', '#f59e0b', '#3b82f6', '#8b5cf6'],
                    borderWidth: 0
                }]
            },
            options: {
                responsive: true,
                maintainAspectRatio: false,
                plugins: {
                    legend: { position: 'bottom', labels: { color: '#94a3b8', boxWidth: 12 } }
                }
            }
        });
    }

    function renderCameraChart(cameraStats) {
        const ctx = document.getElementById('cameraChart').getContext('2d');
        const labels = cameraStats.map(c => c.camera_name);
        const scores = cameraStats.map(c => parseFloat(c.avg_score).toFixed(1));

        if (cameraChartInstance) cameraChartInstance.destroy();

        cameraChartInstance = new Chart(ctx, {
            type: 'bar',
            data: {
                labels: labels,
                datasets: [{
                    label: 'Efficiency Rating',
                    data: scores,
                    backgroundColor: '#10b981',
                    borderRadius: 6
                }]
            },
            options: {
                responsive: true,
                maintainAspectRatio: false,
                scales: {
                    y: { beginAtZero: true, max: 100, grid: { color: 'rgba(255,255,255,0.05)' } },
                    x: { grid: { display: false } }
                }
            }
        });
    }

    if (refreshAnalyticsBtn) {
        refreshAnalyticsBtn.addEventListener('click', refreshAnalytics);
    }

    // --- Tab Navigation ---
    navItems.forEach(item => {
        item.addEventListener('click', (e) => {
            e.preventDefault();
            const targetTab = item.getAttribute('data-tab');
            navItems.forEach(nav => nav.classList.remove('active'));
            item.classList.add('active');
            tabContents.forEach(content => {
                content.classList.remove('active');
                if (content.id === targetTab) content.classList.add('active');
            });

            // Adjust layout for Live vs others
            if (targetTab === 'live-tab' || targetTab === 'logs-tab' || targetTab === 'analytics-tab') {
                mainPanel.style.gridColumn = '1 / -1';
                globalResultsPanel.classList.add('hidden');

                if (targetTab === 'analytics-tab') {
                    refreshAnalytics(); // Fetch latest DB data for charts
                }
            } else {
                mainPanel.style.gridColumn = '1 / 2';
                globalResultsPanel.classList.remove('hidden');
            }
            writeMiniLog(`Switched to module: ${targetTab}`);
        });
    });

    // --- Camera Analyzer Class ---
    class CameraAnalyzer {
        constructor(id) {
            this.id = id;
            this.name = `Surveillance Unit ${this.id}`;
            this.stream = null;
            this.mode = 'webcam';
            this.isLive = false;
            this.isProcessing = false;
            this.lastProcessedTime = 0;
            this.intervalId = null;
            this.retryCount = 0;
            this.maxRetries = 3;
            this.lastTamilNudge = "";
            this.isMuted = false;

            this.createUI();
        }

        createUI() {
            const clone = cameraCardTemplate.content.cloneNode(true);
            this.cardElement = clone.querySelector('.camera-card');
            this.cardElement.setAttribute('data-cam-id', this.id);
            this.titleEl = this.cardElement.querySelector('.cam-title');
            this.titleEl.innerText = this.name;

            // Media Elements
            this.videoEl = this.cardElement.querySelector('.cam-video');
            this.ipImgEl = this.cardElement.querySelector('.cam-ip-img');
            this.placeholderEl = this.cardElement.querySelector('.video-placeholder');
            this.badgeDot = this.cardElement.querySelector('.badge-dot');
            this.badgeText = this.cardElement.querySelector('.badge-text');
            this.loaderEl = this.cardElement.querySelector('.cam-analysis-loader');

            // Controls
            this.removeBtn = this.cardElement.querySelector('.remove-cam-btn');
            this.muteBtn = this.cardElement.querySelector('.mute-cam-btn');
            this.srcWebcamRadio = this.cardElement.querySelector('.src-webcam');
            this.srcIpRadio = this.cardElement.querySelector('.src-ip');
            this.webcamCtrls = this.cardElement.querySelector('.webcam-ctrls');
            this.ipCtrls = this.cardElement.querySelector('.ip-ctrls');
            this.cameraListSelect = this.cardElement.querySelector('.cam-list-select');
            this.ipUrlInput = this.cardElement.querySelector('.ip-url-input');

            this.startBtn = this.cardElement.querySelector('.start-btn');
            this.stopBtn = this.cardElement.querySelector('.stop-btn');
            this.connectBtn = this.cardElement.querySelector('.connect-btn');
            this.disconnectBtn = this.cardElement.querySelector('.disconnect-btn');

            // Result Elements
            this.resStatusEl = this.cardElement.querySelector('.res-status');
            this.resScoreEl = this.cardElement.querySelector('.res-score');
            this.resNudgeEl = this.cardElement.querySelector('.res-nudge');
            this.resRecommendationEl = this.cardElement.querySelector('.res-recommendation');
            this.resDescriptionEl = this.cardElement.querySelector('.res-description');

            // Name radios uniquely per card
            const radioGroupName = `src-type-${this.id}`;
            this.srcWebcamRadio.name = radioGroupName;
            this.srcIpRadio.name = radioGroupName;

            this.setupEventListeners();
            this.populateWebcams();
            cameraContainer.appendChild(this.cardElement);
        }

        setupEventListeners() {
            this.removeBtn.addEventListener('click', () => this.destroy());

            this.muteBtn.addEventListener('click', () => {
                this.isMuted = !this.isMuted;
                this.muteBtn.innerHTML = this.isMuted ? '🔇' : '🔊';
                this.muteBtn.style.opacity = this.isMuted ? '0.5' : '1';
                writeMiniLog(`[Unit ${this.id}] Voice Alert ${this.isMuted ? 'Muted' : 'Unmuted'}`);
                window.electronAPI.logAction('VOICE_ALERT_MUTED', `Camera ${this.id} Mute state: ${this.isMuted}`);
            });

            this.srcWebcamRadio.addEventListener('change', () => {
                this.mode = 'webcam';
                this.webcamCtrls.classList.remove('hidden');
                this.ipCtrls.classList.add('hidden');
                this.handleStop();
            });

            this.srcIpRadio.addEventListener('change', () => {
                this.mode = 'ip';
                this.webcamCtrls.classList.add('hidden');
                this.ipCtrls.classList.remove('hidden');
                this.handleStop();
            });

            this.startBtn.addEventListener('click', () => this.startWebcam());
            this.stopBtn.addEventListener('click', () => this.handleStop());
            this.connectBtn.addEventListener('click', () => this.connectIP());
            this.disconnectBtn.addEventListener('click', () => this.handleStop());
        }

        async populateWebcams() {
            try {
                const devices = await navigator.mediaDevices.enumerateDevices();
                const videoDevices = devices.filter(d => d.kind === 'videoinput');
                this.cameraListSelect.innerHTML = videoDevices.map(d => `<option value="${d.deviceId}">${d.label || 'Camera'}</option>`).join('') || '<option value="">No Hardware Detected</option>';
            } catch (err) { console.error(err); }
        }

        async startWebcam() {
            try {
                const constraints = { video: { width: 1280, height: 720 } };
                if (this.cameraListSelect.value) constraints.video.deviceId = { exact: this.cameraListSelect.value };

                this.stream = await navigator.mediaDevices.getUserMedia(constraints);
                this.videoEl.srcObject = this.stream;
                this.videoEl.onloadedmetadata = () => {
                    this.videoEl.play();
                    this.videoEl.classList.remove('hidden');
                    this.ipImgEl.classList.add('hidden');
                    this.placeholderEl.classList.add('hidden');
                    this.isLive = true;
                    this.updateBadge('ACTIVE', 'LIVE');
                    this.startLoop();
                    writeMiniLog(`[Unit ${this.id}] Webcam Started.`);
                };
                this.startBtn.disabled = true;
                this.stopBtn.disabled = false;
            } catch (err) {
                alert(`Camera error: ${err.message}`);
            }
        }

        connectIP() {
            let url = this.ipUrlInput.value.trim();
            if (!url) return alert("URL Required");
            if (!url.startsWith('http')) url = 'http://' + url;
            if (!url.toLowerCase().endsWith('/video') && (url.includes(':8080') || url.includes(':4747'))) {
                url = url + (url.endsWith('/') ? '' : '/') + 'video';
                this.ipUrlInput.value = url;
            }

            writeMiniLog(`[Unit ${this.id}] Connecting to stream...`);
            this.ipImgEl.src = url;
            this.ipImgEl.crossOrigin = "anonymous";

            this.ipImgEl.onload = () => {
                this.isLive = true;
                this.retryCount = 0;
                this.videoEl.classList.add('hidden');
                this.ipImgEl.classList.remove('hidden');
                this.placeholderEl.classList.add('hidden');
                this.updateBadge('ACTIVE', 'MJPEG');
                this.startLoop();
                writeMiniLog(`[Unit ${this.id}] Network Stream Stable.`);
                this.connectBtn.disabled = true;
                this.disconnectBtn.disabled = false;
            };

            this.ipImgEl.onerror = () => {
                if (this.retryCount < this.maxRetries) {
                    this.retryCount++;
                    writeMiniLog(`[Unit ${this.id}] Conn failed. Retry ${this.retryCount}/${this.maxRetries}`);
                    setTimeout(() => { if (this.isLive === false && this.mode === 'ip') this.ipImgEl.src = url + '?t=' + Date.now(); }, 2000);
                } else {
                    writeMiniLog(`[Unit ${this.id}] Stream Offline.`);
                    this.updateBadge('OFFLINE', 'FAIL');
                }
            };
        }

        handleStop() {
            this.stopLoop();
            if (this.stream) {
                this.stream.getTracks().forEach(t => t.stop());
                this.stream = null;
            }
            this.videoEl.srcObject = null;
            this.videoEl.src = "";
            this.ipImgEl.src = "";

            this.videoEl.classList.add('hidden');
            this.ipImgEl.classList.add('hidden');
            this.placeholderEl.classList.remove('hidden');

            this.isLive = false;
            this.updateBadge('OFFLINE', 'STANDBY');
            this.resStatusEl.innerText = 'Standby';

            this.startBtn.disabled = false;
            this.stopBtn.disabled = true;
            this.connectBtn.disabled = false;
            this.disconnectBtn.disabled = true;
        }

        updateBadge(status, text) {
            this.badgeDot.className = `badge-dot dot-${status === 'ACTIVE' ? 'active' : (status === 'ANALYZING' ? 'analyzing' : 'offline')}`;
            this.badgeText.innerText = text;
            this.updateGlobalStatus();
        }

        updateGlobalStatus() {
            const activeCount = activeCameras.filter(c => c.isLive).length;
            if (activeCount > 0) {
                monitoringStatus.innerHTML = `<span class="pulse"></span> 🟢 ${activeCount} Units Monitoring`;
            } else {
                monitoringStatus.innerHTML = `🔴 System Standby`;
            }
        }

        startLoop() {
            if (this.intervalId) clearInterval(this.intervalId);
            this.intervalId = setInterval(() => this.runAnalysis(), ANALYSIS_INTERVAL_MS);
        }

        stopLoop() {
            if (this.intervalId) clearInterval(this.intervalId);
            this.intervalId = null;
        }

        async runAnalysis() {
            if (!this.isLive || this.isProcessing || !autoAiToggle.checked) return;
            if (Date.now() - this.lastProcessedTime < COOLDOWN_MS) return;

            // Basic check if device is ready
            if (this.mode === 'webcam' && this.videoEl.videoWidth === 0) return;
            if (this.mode === 'ip' && this.ipImgEl.naturalWidth === 0) return;

            this.isProcessing = true;
            this.loaderEl.classList.remove('hidden');
            this.updateBadge('ANALYZING', 'SCANNING');

            try {
                const canvas = document.createElement('canvas');
                canvas.width = 640; canvas.height = 480;
                const ctx = canvas.getContext('2d');
                const src = this.mode === 'webcam' ? this.videoEl : this.ipImgEl;
                ctx.drawImage(src, 0, 0, 640, 480);

                const blob = await new Promise(r => canvas.toBlob(r, 'image/jpeg', 0.85));
                const formData = new FormData();
                formData.append('image', blob, `cam-${this.id}.jpg`);
                formData.append('cameraName', this.name);

                const response = await fetch('https://sit.zethub.in/api/detect-behavior', {
                    method: 'POST',
                    body: formData
                });

                if (response.ok) {
                    const data = await response.json();
                    this.updateResults(data);
                    writeMiniLog(`[Unit ${this.id}] Analysis Complete: ${data.cleanliness_status}`);
                    await window.electronAPI.logAction('AI_UNIT_RESPONSE', `Cam ${this.id}: ${data.cleanliness_status}`);
                }
            } catch (err) {
                console.error(err);
                this.resStatusEl.innerText = 'AI Error';
            } finally {
                this.isProcessing = false;
                this.loaderEl.classList.add('hidden');
                this.updateBadge('ACTIVE', this.mode === 'webcam' ? 'LIVE' : 'MJPEG');
                this.lastProcessedTime = Date.now();
            }
        }

        updateResults(data) {
            this.resStatusEl.innerText = data.cleanliness_status || 'Unknown';
            this.resStatusEl.style.color = data.cleanliness_status === 'Clean Area' ? '#10b981' : '#ef4444';
            this.resScoreEl.innerText = `${data.cleanliness_score || 0}/100`;
            this.resNudgeEl.innerText = data.tamil_nudge || '--';
            if (this.resRecommendationEl) this.resRecommendationEl.innerText = data.recommendation || '--';
            if (this.resDescriptionEl) this.resDescriptionEl.innerText = data.image_description || '--';

            // Trigger TTS if Nudge changed and status is valid
            if (data.tamil_nudge && data.tamil_nudge !== this.lastTamilNudge && data.tamil_nudge !== '--' && data.cleanliness_status !== 'Invalid Scene') {
                this.speakNudge(data.tamil_nudge);
                this.lastTamilNudge = data.tamil_nudge;
            }
        }

        speakNudge(text) {
            if (!voiceAiToggle.checked || this.isMuted) return;

            // Queue via global manager (prevents overlap)
            queueSpeech(this.name, text);
            writeMiniLog(`[Unit ${this.id}] Nudge Queued.`);
        }

        destroy() {
            this.handleStop();
            this.cardElement.remove();
            const idx = activeCameras.findIndex(c => c.id === this.id);
            if (idx > -1) activeCameras.splice(idx, 1);
            this.updateGlobalStatus();
            if (activeCameras.length === 0) noCamerasMsg.classList.remove('hidden');
            writeMiniLog(`[Unit ${this.id}] Unit Removed.`);
        }
    }

    // --- Global Controls ---
    addCameraBtn.addEventListener('click', () => {
        if (activeCameras.length >= MAX_CAMERAS) {
            return alert("Control Room capacity reached (Max 3 Cameras allowed).");
        }
        noCamerasMsg.classList.add('hidden');
        cameraIdCounter++;
        const newCam = new CameraAnalyzer(cameraIdCounter);
        activeCameras.push(newCam);
        writeMiniLog(`Installed New Monitoring Unit: ${newCam.name}`);
        window.electronAPI.logAction('CAMERA_ADDED', `New surveillance card created with ID ${cameraIdCounter}`);
    });

    // --- Manual Tab Logic ---
    captureCamBtn.addEventListener('click', () => {
        if (activeCameras.length === 0 || !activeCameras[0].isLive) return alert("Start at least one camera first!");
        const firstCam = activeCameras[0];
        manualCanvas.width = 640; manualCanvas.height = 480;
        const src = firstCam.mode === 'webcam' ? firstCam.videoEl : firstCam.ipImgEl;
        manualCanvas.getContext('2d').drawImage(src, 0, 0, 640, 480);
        canvasPlaceholder.classList.add('hidden');
        processCaptureBtn.disabled = false;
        writeMiniLog("Manual Frame Captured from Unit 1.");
    });

    processCaptureBtn.addEventListener('click', async () => {
        const blob = await new Promise(r => manualCanvas.toBlob(r, 'image/jpeg'));
        triggerGlobalAI(blob);
    });

    uploadBtn.addEventListener('click', async () => {
        const res = await window.electronAPI.selectImage();
        if (res) {
            imagePreview.src = res.path;
            previewContainer.classList.remove('hidden');
            uploadPrompt.classList.add('hidden');
            processUploadBtn.disabled = false;
        }
    });

    processUploadBtn.addEventListener('click', async () => {
        const blob = await (await fetch(imagePreview.src)).blob();
        triggerGlobalAI(blob);
    });

    async function triggerGlobalAI(blob) {
        resStatus.innerText = 'Analyzing...';
        resStatus.classList.add('waiting');
        try {
            const formData = new FormData();
            formData.append('image', blob, 'manual-check.jpg');
            formData.append('cameraName', 'Manual Check Unit');
            const response = await fetch('https://sit.zethub.in/api/detect-behavior', { method: 'POST', body: formData });
            const data = await response.json();

            resStatus.innerText = data.cleanliness_status;
            resStatus.classList.remove('waiting');
            resScore.innerText = `${data.cleanliness_score}/100`;
            resRecommendation.innerText = data.recommendation;
            resNudge.innerText = data.tamil_nudge;
            resDescription.innerText = data.image_description;

            // Global manual TTS if status is valid
            if (data.tamil_nudge && voiceAiToggle.checked && data.cleanliness_status !== 'Invalid Scene') {
                queueSpeech("Manual Check", data.tamil_nudge);
            }
        } catch (err) {
            resStatus.innerText = 'Service Offline';
        }
    }

    // --- Log System ---
    async function refreshLogs() {
        try {
            const logs = await window.electronAPI.getLogs();
            if (!logsBody) return;
            logsBody.innerHTML = logs.map(log => `
                <tr>
                    <td>${log.timestamp}</td>
                    <td style="font-weight:600; font-size:0.75rem;">${log.type}</td>
                    <td style="color:var(--text-muted); font-size:0.8rem;">${log.description}</td>
                    <td><span style="color:${!/ERROR|FAILED/.test(log.type) ? '#10b981' : '#f87171'}">${log.status}</span></td>
                </tr>
            `).join('');
        } catch (err) { }
    }
    setInterval(refreshLogs, 10000);
    refreshLogs();
});
