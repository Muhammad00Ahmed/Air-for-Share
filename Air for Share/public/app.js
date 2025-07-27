class AirForShareX {
    constructor() {
        this.ws = null;
        this.pc = null;
        this.dataChannel = null;
        this.sessionId = null;
        this.isHost = false;
        this.files = [];
        this.downloadHistory = [];
        this.encryptionEnabled = false;
        this.encryptionPassword = '';
        this.currentFileTransfer = null;
        this.retryCount = 0;
        this.maxRetries = 3;
        
        // WebRTC Configuration
        this.rtcConfig = {
            iceServers: [
                { urls: 'stun:stun.l.google.com:19302' },
                { urls: 'stun:stun1.l.google.com:19302' },
                { urls: 'stun:stun2.l.google.com:19302' }
            ],
            iceCandidatePoolSize: 10
        };

        this.init();
    }

    init() {
        this.setupEventListeners();
        this.connectWebSocket();
        this.loadHistory();
        this.setupTheme();
    }

    setupEventListeners() {
        // Theme toggle
        document.getElementById('themeToggle').addEventListener('click', this.toggleTheme.bind(this));

        // File upload
        const fileUploadArea = document.getElementById('fileUploadArea');
        const fileInput = document.getElementById('fileInput');

        fileUploadArea.addEventListener('click', () => fileInput.click());
        fileUploadArea.addEventListener('dragover', this.handleDragOver.bind(this));
        fileUploadArea.addEventListener('dragleave', this.handleDragLeave.bind(this));
        fileUploadArea.addEventListener('drop', this.handleDrop.bind(this));
        fileInput.addEventListener('change', this.handleFileSelect.bind(this));

        // Session management
        document.getElementById('createSessionBtn').addEventListener('click', this.createSession.bind(this));
        document.getElementById('joinSessionBtn').addEventListener('click', this.joinSession.bind(this));
        document.getElementById('copySessionBtn').addEventListener('click', this.copySessionCode.bind(this));

        // Encryption
        document.getElementById('encryptionToggle').addEventListener('change', this.toggleEncryption.bind(this));
        document.getElementById('generatePasswordBtn').addEventListener('click', this.generatePassword.bind(this));

        // Modal handlers
        document.getElementById('decryptBtn').addEventListener('click', this.handleDecryption.bind(this));
        document.getElementById('cancelDecryptBtn').addEventListener('click', this.closeDecryptionModal.bind(this));

        // Enter key handlers
        document.getElementById('joinSessionInput').addEventListener('keypress', (e) => {
            if (e.key === 'Enter') this.joinSession();
        });
        document.getElementById('decryptionPassword').addEventListener('keypress', (e) => {
            if (e.key === 'Enter') this.handleDecryption();
        });
    }

    connectWebSocket() {
        const wsUrl = window.location.protocol === 'https:' ? 'wss://localhost:8080' : 'ws://localhost:8080';
        
        try {
            this.ws = new WebSocket(wsUrl);
            
            this.ws.onopen = () => {
                console.log('WebSocket connected');
                this.updateConnectionStatus('waiting', 'Connected to server');
            };

            this.ws.onmessage = this.handleWebSocketMessage.bind(this);
            
            this.ws.onclose = () => {
                console.log('WebSocket disconnected');
                this.updateConnectionStatus('idle', 'Disconnected');
                setTimeout(() => this.connectWebSocket(), 3000);
            };

            this.ws.onerror = (error) => {
                console.error('WebSocket error:', error);
                this.showToast('Connection error. Retrying...', 'error');
            };
        } catch (error) {
            console.error('Failed to connect to WebSocket:', error);
            this.showToast('Failed to connect to server. Using local mode.', 'error');
        }
    }

    async handleWebSocketMessage(event) {
        try {
            const message = JSON.parse(event.data);
            console.log('Received message:', message);

            switch (message.type) {
                case 'session-created':
                    this.handleSessionCreated(message);
                    break;
                case 'session-joined':
                    this.handleSessionJoined(message);
                    break;
                case 'peer-joined':
                    this.handlePeerJoined(message);
                    break;
                case 'offer':
                    this.handleOffer(message);
                    break;
                case 'answer':
                    this.handleAnswer(message);
                    break;
                case 'ice-candidate':
                    this.handleIceCandidate(message);
                    break;
                case 'error':
                    this.showToast(message.message, 'error');
                    break;
            }
        } catch (error) {
            console.error('Error parsing WebSocket message:', error);
        }
    }

    // File handling
    handleDragOver(e) {
        e.preventDefault();
        e.stopPropagation();
        document.getElementById('fileUploadArea').classList.add('drag-over');
    }

    handleDragLeave(e) {
        e.preventDefault();
        e.stopPropagation();
        document.getElementById('fileUploadArea').classList.remove('drag-over');
    }

    handleDrop(e) {
        e.preventDefault();
        e.stopPropagation();
        document.getElementById('fileUploadArea').classList.remove('drag-over');
        
        const files = Array.from(e.dataTransfer.files);
        this.addFiles(files);
    }

    handleFileSelect(e) {
        const files = Array.from(e.target.files);
        this.addFiles(files);
    }

    addFiles(files) {
        if (files.length === 0) return;

        this.files = [...this.files, ...files];
        this.renderFilePreview();
        this.showEncryptionSection();
        
        this.showToast(`${files.length} file(s) added successfully`, 'success');
    }

    renderFilePreview() {
        const preview = document.getElementById('filePreview');
        const fileList = document.getElementById('fileList');
        
        if (this.files.length === 0) {
            preview.style.display = 'none';
            return;
        }

        preview.style.display = 'block';
        fileList.innerHTML = '';

        this.files.forEach((file, index) => {
            const fileItem = document.createElement('div');
            fileItem.className = 'file-item';
            fileItem.innerHTML = `
                <div class="file-info">
                    <div class="file-icon">${this.getFileIcon(file.type)}</div>
                    <div class="file-details">
                        <h4>${file.name}</h4>
                        <p>${this.formatFileSize(file.size)} • ${file.type || 'Unknown type'}</p>
                    </div>
                </div>
                <div class="file-progress" style="display: none;" id="progress-${index}">
                    <div class="progress-info">
                        <span class="progress-text">Ready</span>
                        <span class="progress-percent">0%</span>
                    </div>
                    <div class="progress-bar">
                        <div class="progress-fill" style="width: 0%"></div>
                    </div>
                </div>
                <button class="remove-file" onclick="airForShare.removeFile(${index})">✕</button>
            `;
            fileList.appendChild(fileItem);
        });
    }

    removeFile(index) {
        this.files.splice(index, 1);
        this.renderFilePreview();
        
        if (this.files.length === 0) {
            this.hideEncryptionSection();
        }
    }

    getFileIcon(mimeType) {
        if (!mimeType) return '📄';
        
        if (mimeType.startsWith('image/')) return '🖼️';
        if (mimeType.startsWith('video/')) return '🎥';
        if (mimeType.startsWith('audio/')) return '🎵';
        if (mimeType.includes('pdf')) return '📕';
        if (mimeType.includes('text')) return '📝';
        if (mimeType.includes('zip') || mimeType.includes('rar')) return '📦';
        
        return '📄';
    }

    formatFileSize(bytes) {
        if (bytes === 0) return '0 Bytes';
        const k = 1024;
        const sizes = ['Bytes', 'KB', 'MB', 'GB', 'TB'];
        const i = Math.floor(Math.log(bytes) / Math.log(k));
        return parseFloat((bytes / Math.pow(k, i)).toFixed(2)) + ' ' + sizes[i];
    }

    // Session management
    async createSession() {
        if (!this.ws || this.ws.readyState !== WebSocket.OPEN) {
            this.showToast('Please wait for server connection', 'error');
            return;
        }

        this.sessionId = this.generateSessionId();
        this.isHost = true;

        const message = {
            type: 'create-session',
            sessionId: this.sessionId
        };

        this.ws.send(JSON.stringify(message));
    }

    async joinSession() {
        const input = document.getElementById('joinSessionInput');
        const sessionId = input.value.trim().toUpperCase();

        if (!sessionId) {
            this.showToast('Please enter a session code', 'error');
            return;
        }

        if (!this.ws || this.ws.readyState !== WebSocket.OPEN) {
            this.showToast('Please wait for server connection', 'error');
            return;
        }

        this.sessionId = sessionId;
        this.isHost = false;

        const message = {
            type: 'join-session',
            sessionId: this.sessionId
        };

        this.ws.send(JSON.stringify(message));
    }

    handleSessionCreated(message) {
        this.showSessionInfo();
        this.generateQRCode();
        this.updateConnectionStatus('waiting', 'Waiting for peer to join');
        this.showToast('Session created! Share the code with your peer', 'success');
    }

    handleSessionJoined(message) {
        this.updateConnectionStatus('connecting', 'Joined session, connecting...');
        this.showToast('Joined session successfully', 'success');
        
        if (!this.isHost) {
            this.initiatePeerConnection();
        }
    }

    handlePeerJoined(message) {
        if (this.isHost) {
            this.updateConnectionStatus('connecting', 'Peer joined, establishing connection...');
            this.initiatePeerConnection();
        }
    }

    // WebRTC Connection
    async initiatePeerConnection() {
        try {
            this.pc = new RTCPeerConnection(this.rtcConfig);
            
            this.pc.onicecandidate = (event) => {
                if (event.candidate) {
                    this.sendSignalingMessage({
                        type: 'ice-candidate',
                        candidate: event.candidate
                    });
                }
            };

            this.pc.ondatachannel = (event) => {
                this.setupDataChannel(event.channel);
            };

            if (this.isHost) {
                this.dataChannel = this.pc.createDataChannel('fileTransfer', {
                    ordered: true,
                    maxPacketLifeTime: 3000
                });
                this.setupDataChannel(this.dataChannel);

                const offer = await this.pc.createOffer();
                await this.pc.setLocalDescription(offer);
                
                this.sendSignalingMessage({
                    type: 'offer',
                    offer: offer
                });
            }
        } catch (error) {
            console.error('Error initiating peer connection:', error);
            this.showToast('Failed to establish connection', 'error');
        }
    }

    async handleOffer(message) {
        try {
            await this.pc.setRemoteDescription(new RTCSessionDescription(message.offer));
            
            const answer = await this.pc.createAnswer();
            await this.pc.setLocalDescription(answer);
            
            this.sendSignalingMessage({
                type: 'answer',
                answer: answer
            });
        } catch (error) {
            console.error('Error handling offer:', error);
        }
    }

    async handleAnswer(message) {
        try {
            await this.pc.setRemoteDescription(new RTCSessionDescription(message.answer));
        } catch (error) {
            console.error('Error handling answer:', error);
        }
    }

    async handleIceCandidate(message) {
        try {
            await this.pc.addIceCandidate(new RTCIceCandidate(message.candidate));
        } catch (error) {
            console.error('Error handling ICE candidate:', error);
        }
    }

    setupDataChannel(channel) {
        this.dataChannel = channel;
        
        channel.onopen = () => {
            console.log('Data channel opened');
            this.updateConnectionStatus('connected', 'Connected! Ready to transfer files');
            this.showToast('Connection established successfully!', 'success');
            
            if (this.isHost && this.files.length > 0) {
                this.startFileTransfer();
            }
        };

        channel.onclose = () => {
            console.log('Data channel closed');
            this.updateConnectionStatus('idle', 'Connection closed');
        };

        channel.onerror = (error) => {
            console.error('Data channel error:', error);
            this.showToast('Connection error occurred', 'error');
        };

        channel.onmessage = (event) => {
            this.handleDataChannelMessage(event);
        };
    }

    sendSignalingMessage(message) {
        if (this.ws && this.ws.readyState === WebSocket.OPEN) {
            this.ws.send(JSON.stringify({
                ...message,
                sessionId: this.sessionId
            }));
        }
    }

    // File Transfer
    async startFileTransfer() {
        if (!this.dataChannel || this.dataChannel.readyState !== 'open') {
            this.showToast('Connection not ready for file transfer', 'error');
            return;
        }

        if (this.files.length === 0) {
            this.showToast('No files selected for transfer', 'error');
            return;
        }

        for (let i = 0; i < this.files.length; i++) {
            await this.sendFile(this.files[i], i);
        }

        this.updateConnectionStatus('complete', 'All files sent successfully');
        this.showToast('All files transferred successfully!', 'success');
    }

    async sendFile(file, index) {
        try {
            const progressElement = document.getElementById(`progress-${index}`);
            progressElement.style.display = 'block';
            
            let fileData = await this.readFileAsArrayBuffer(file);
            
            // Encrypt file if encryption is enabled
            if (this.encryptionEnabled && this.encryptionPassword) {
                fileData = await this.encryptFile(fileData, this.encryptionPassword);
            }

            const metadata = {
                type: 'file-metadata',
                name: file.name,
                size: fileData.byteLength,
                mimeType: file.type,
                encrypted: this.encryptionEnabled
            };

            this.dataChannel.send(JSON.stringify(metadata));

            // Send file in chunks
            const chunkSize = 16384; // 16KB chunks
            const totalChunks = Math.ceil(fileData.byteLength / chunkSize);
            let sentChunks = 0;

            for (let i = 0; i < fileData.byteLength; i += chunkSize) {
                const chunk = fileData.slice(i, i + chunkSize);
                
                // Wait for buffer to clear if needed
                while (this.dataChannel.bufferedAmount > chunkSize * 10) {
                    await new Promise(resolve => setTimeout(resolve, 10));
                }

                this.dataChannel.send(chunk);
                sentChunks++;

                // Update progress
                const progress = (sentChunks / totalChunks) * 100;
                this.updateFileProgress(index, progress);
            }

            // Send end marker
            this.dataChannel.send(JSON.stringify({ type: 'file-end' }));
            
        } catch (error) {
            console.error('Error sending file:', error);
            this.showToast(`Failed to send ${file.name}`, 'error');
        }
    }

    updateFileProgress(index, progress) {
        const progressElement = document.getElementById(`progress-${index}`);
        if (progressElement) {
            const progressFill = progressElement.querySelector('.progress-fill');
            const progressPercent = progressElement.querySelector('.progress-percent');
            const progressText = progressElement.querySelector('.progress-text');
            
            progressFill.style.width = `${progress}%`;
            progressPercent.textContent = `${Math.round(progress)}%`;
            progressText.textContent = progress === 100 ? 'Complete' : 'Sending...';
        }
    }

    // File Reception
    handleDataChannelMessage(event) {
        try {
            if (typeof event.data === 'string') {
                const message = JSON.parse(event.data);
                
                if (message.type === 'file-metadata') {
                    this.currentFileTransfer = {
                        name: message.name,
                        size: message.size,
                        mimeType: message.mimeType,
                        encrypted: message.encrypted,
                        chunks: [],
                        receivedSize: 0
                    };
                    
                    this.showToast(`Receiving: ${message.name}`, 'info');
                    
                } else if (message.type === 'file-end') {
                    this.completeFileReception();
                }
            } else {
                // Binary data (file chunk)
                if (this.currentFileTransfer) {
                    this.currentFileTransfer.chunks.push(new Uint8Array(event.data));
                    this.currentFileTransfer.receivedSize += event.data.byteLength;
                    
                    const progress = (this.currentFileTransfer.receivedSize / this.currentFileTransfer.size) * 100;
                    console.log(`Receiving progress: ${Math.round(progress)}%`);
                }
            }
        } catch (error) {
            console.error('Error handling data channel message:', error);
        }
    }

    async completeFileReception() {
        if (!this.currentFileTransfer) return;

        try {
            // Combine chunks
            let fileData = new Uint8Array(this.currentFileTransfer.size);
            let offset = 0;
            
            for (const chunk of this.currentFileTransfer.chunks) {
                fileData.set(chunk, offset);
                offset += chunk.length;
            }

            // Handle encryption
            if (this.currentFileTransfer.encrypted) {
                this.showDecryptionModal(fileData, this.currentFileTransfer);
            } else {
                this.downloadFile(fileData, this.currentFileTransfer);
            }

        } catch (error) {
            console.error('Error completing file reception:', error);
            this.showToast('Failed to receive file', 'error');
        }
    }

    async downloadFile(fileData, fileInfo) {
        try {
            const blob = new Blob([fileData], { type: fileInfo.mimeType });
            const url = URL.createObjectURL(blob);
            
            const a = document.createElement('a');
            a.href = url;
            a.download = fileInfo.name;
            document.body.appendChild(a);
            a.click();
            document.body.removeChild(a);
            
            URL.revokeObjectURL(url);
            
            // Add to history
            this.addToHistory({
                name: fileInfo.name,
                size: fileInfo.size,
                timestamp: new Date(),
                data: fileData,
                mimeType: fileInfo.mimeType
            });
            
            this.showToast(`${fileInfo.name} downloaded successfully!`, 'success');
            this.currentFileTransfer = null;
            
        } catch (error) {
            console.error('Error downloading file:', error);
            this.showToast('Failed to download file', 'error');
        }
    }

    // Encryption/Decryption
    async encryptFile(fileData, password) {
        const wordArray = CryptoJS.lib.WordArray.create(fileData);
        const encrypted = CryptoJS.AES.encrypt(wordArray, password).toString();
        return new TextEncoder().encode(encrypted);
    }

    async decryptFile(encryptedData, password) {
        try {
            const encryptedString = new TextDecoder().decode(encryptedData);
            const decrypted = CryptoJS.AES.decrypt(encryptedString, password);
            const wordArray = decrypted.toString(CryptoJS.enc.Base64);
            return Uint8Array.from(atob(wordArray), c => c.charCodeAt(0));
        } catch (error) {
            throw new Error('Invalid passphrase');
        }
    }

    showDecryptionModal(encryptedData, fileInfo) {
        const modal = document.getElementById('decryptionModal');
        modal.style.display = 'flex';
        
        modal.encryptedData = encryptedData;
        modal.fileInfo = fileInfo;
    }

    closeDecryptionModal() {
        const modal = document.getElementById('decryptionModal');
        modal.style.display = 'none';
        document.getElementById('decryptionPassword').value = '';
    }

    async handleDecryption() {
        const modal = document.getElementById('decryptionModal');
        const password = document.getElementById('decryptionPassword').value;
        
        if (!password) {
            this.showToast('Please enter a passphrase', 'error');
            return;
        }

        try {
            const decryptedData = await this.decryptFile(modal.encryptedData, password);
            this.downloadFile(decryptedData, modal.fileInfo);
            this.closeDecryptionModal();
        } catch (error) {
            this.showToast('Invalid passphrase', 'error');
        }
    }

    // UI Helpers
    showSessionInfo() {
        const sessionInfo = document.getElementById('sessionInfo');
        const sessionCode = document.getElementById('sessionCode');
        
        sessionInfo.style.display = 'block';
        sessionCode.textContent = this.sessionId;
    }

    async generateQRCode() {
        const qrContainer = document.getElementById('qrContainer');
        const sessionUrl = `${window.location.origin}?session=${this.sessionId}`;
        
        try {
            await QRCode.toCanvas(qrContainer, sessionUrl, {
                width: 150,
                margin: 2,
                color: {
                    dark: getComputedStyle(document.documentElement).getPropertyValue('--text-primary').trim(),
                    light: getComputedStyle(document.documentElement).getPropertyValue('--bg-primary').trim()
                }
            });
        } catch (error) {
            console.error('Error generating QR code:', error);
        }
    }

    copySessionCode() {
        const sessionCode = document.getElementById('sessionCode').textContent;
        
        if (navigator.clipboard) {
            navigator.clipboard.writeText(sessionCode).then(() => {
                this.showToast('Session code copied to clipboard!', 'success');
            });
        } else {
            // Fallback for older browsers
            const textArea = document.createElement('textarea');
            textArea.value = sessionCode;
            document.body.appendChild(textArea);
            textArea.select();
            document.execCommand('copy');
            document.body.removeChild(textArea);
            this.showToast('Session code copied to clipboard!', 'success');
        }
    }

    showEncryptionSection() {
        document.getElementById('encryptionSection').style.display = 'block';
    }

    hideEncryptionSection() {
        document.getElementById('encryptionSection').style.display = 'none';
    }

    toggleEncryption() {
        const toggle = document.getElementById('encryptionToggle');
        const options = document.getElementById('encryptionOptions');
        
        this.encryptionEnabled = toggle.checked;
        options.style.display = this.encryptionEnabled ? 'block' : 'none';
        
        if (this.encryptionEnabled && !this.encryptionPassword) {
            this.generatePassword();
        }
    }

    generatePassword() {
        const chars = 'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789!@#$%^&*';
        let password = '';
        for (let i = 0; i < 16; i++) {
            password += chars.charAt(Math.floor(Math.random() * chars.length));
        }
        
        document.getElementById('encryptionPassword').value = password;
        this.encryptionPassword = password;
        
        this.showToast('Secure password generated!', 'success');
    }

    updateConnectionStatus(status, text) {
        const statusElement = document.getElementById('connectionStatus');
        const statusDot = statusElement.querySelector('.status-dot');
        const statusText = statusElement.querySelector('.status-text');
        
        statusDot.className = `status-dot ${status}`;
        statusText.textContent = text;
    }

    addToHistory(file) {
        this.downloadHistory.unshift(file);
        this.saveHistory();
        this.renderHistory();
    }

    renderHistory() {
        const historyEmpty = document.getElementById('historyEmpty');
        const historyTable = document.getElementById('historyTable');
        const historyTableBody = document.getElementById('historyTableBody');
        
        if (this.downloadHistory.length === 0) {
            historyEmpty.style.display = 'block';
            historyTable.style.display = 'none';
            return;
        }
        
        historyEmpty.style.display = 'none';
        historyTable.style.display = 'block';
        
        historyTableBody.innerHTML = '';
        
        this.downloadHistory.forEach((file, index) => {
            const row = document.createElement('tr');
            row.innerHTML = `
                <td>${file.name}</td>
                <td>${this.formatFileSize(file.size)}</td>
                <td>${new Date(file.timestamp).toLocaleString()}</td>
                <td>
                    <button class="btn btn-primary download-btn" onclick="airForShare.redownloadFile(${index})">
                        Download Again
                    </button>
                </td>
            `;
            historyTableBody.appendChild(row);
        });
    }

    redownloadFile(index) {
        const file = this.downloadHistory[index];
        if (file) {
            const blob = new Blob([file.data], { type: file.mimeType });
            const url = URL.createObjectURL(blob);
            
            const a = document.createElement('a');
            a.href = url;
            a.download = file.name;
            document.body.appendChild(a);
            a.click();
            document.body.removeChild(a);
            
            URL.revokeObjectURL(url);
            this.showToast(`${file.name} downloaded again!`, 'success');
        }
    }

    saveHistory() {
        try {
            const historyToSave = this.downloadHistory.map(file => ({
                name: file.name,
                size: file.size,
                timestamp: file.timestamp,
                mimeType: file.mimeType
                // Note: We don't save the actual data to localStorage due to size limits
            }));
            localStorage.setItem('airforshare-history', JSON.stringify(historyToSave));
        } catch (error) {
            console.error('Error saving history:', error);
        }
    }

    loadHistory() {
        try {
            const saved = localStorage.getItem('airforshare-history');
            if (saved) {
                this.downloadHistory = JSON.parse(saved);
                this.renderHistory();
            }
        } catch (error) {
            console.error('Error loading history:', error);
        }
    }

    showToast(message, type = 'info') {
        const container = document.getElementById('toastContainer');
        const toast = document.createElement('div');
        toast.className = `toast ${type}`;
        toast.textContent = message;
        
        container.appendChild(toast);
        
        // Auto remove after 3 seconds
        setTimeout(() => {
            if (toast.parentNode) {
                toast.style.animation = 'toastSlide 0.3s reverse';
                setTimeout(() => toast.remove(), 300);
            }
        }, 3000);
    }

    setupTheme() {
        const savedTheme = localStorage.getItem('airforshare-theme') || 'dark';
        document.body.className = `${savedTheme}-theme`;
        this.updateThemeToggle(savedTheme === 'dark');
    }

    toggleTheme() {
        const isDark = document.body.classList.contains('dark-theme');
        const newTheme = isDark ? 'light' : 'dark';
        
        document.body.className = `${newTheme}-theme`;
        localStorage.setItem('airforshare-theme', newTheme);
        this.updateThemeToggle(newTheme === 'dark');
    }

    updateThemeToggle(isDark) {
        const themeIcon = document.querySelector('.theme-icon');
        themeIcon.textContent = isDark ? '☀️' : '🌙';
    }

    generateSessionId() {
        const chars = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789';
        let result = '';
        for (let i = 0; i < 6; i++) {
            result += chars.charAt(Math.floor(Math.random() * chars.length));
        }
        return result;
    }

    readFileAsArrayBuffer(file) {
        return new Promise((resolve, reject) => {
            const reader = new FileReader();
            reader.onload = () => resolve(reader.result);
            reader.onerror = reject;
            reader.readAsArrayBuffer(file);
        });
    }
}

// Initialize the application
const airForShare = new AirForShareX();

// Handle URL parameters
const urlParams = new URLSearchParams(window.location.search);
const sessionParam = urlParams.get('session');
if (sessionParam) {
    document.getElementById('joinSessionInput').value = sessionParam;
    airForShare.showToast('Session code detected in URL', 'info');
}

// Handle beforeunload
window.addEventListener('beforeunload', (e) => {
    if (airForShare.dataChannel && airForShare.dataChannel.readyState === 'open') {
        e.preventDefault();
        e.returnValue = '';
    }
});