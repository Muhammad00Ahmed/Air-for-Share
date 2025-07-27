# AirForShare X - Ultra-Advanced File Sharing Tool

AirForShare X is a cutting-edge, web-based real-time file sharing application that enables peer-to-peer file transfer over both LAN and WAN connections. Built with modern web technologies including WebRTC and WebSockets, it supports files up to 10GB+ with advanced features like encryption, QR code sharing, and a beautiful glassmorphism UI.

## 🚀 Features

### Core Functionality
- **WebRTC Peer-to-Peer Transfer**: Direct file transfer between browsers without server storage
- **Cross-Network Support**: Works over both LAN and WAN using STUN servers
- **Large File Support**: Handle files up to 10GB+ with chunked transfer and progress tracking
- **Automatic Retries**: Built-in retry mechanism for unstable connections
- **Auto-Download**: Received files are automatically downloaded via blob links

### User Interface
- **Modern Glassmorphism Design**: Beautiful, translucent UI with blur effects
- **Dark/Light Theme Toggle**: Seamless switching between themes
- **Drag & Drop Support**: Intuitive file selection with visual feedback
- **Real-time Progress**: Live progress bars for file transfers
- **Connection Status**: Visual indicators for connection state
- **Download History**: Keep track of all received files

### Advanced Features
- **Session-Based Sharing**: Easy-to-use session codes for connection
- **QR Code Generation**: Quick mobile sharing with QR codes
- **AES-256 Encryption**: Optional end-to-end file encryption
- **Mobile Responsive**: Optimized for all device sizes
- **Multiple File Support**: Send multiple files simultaneously

## 🛠️ Technology Stack

### Frontend
- **Vanilla JavaScript**: No framework dependencies for maximum performance
- **WebRTC**: Peer-to-peer communication
- **WebSocket**: Real-time signaling
- **CSS3**: Modern styling with glassmorphism effects
- **HTML5**: Semantic markup with accessibility

### Backend
- **Node.js**: Server runtime
- **WebSocket (ws)**: Real-time communication
- **Express.js**: HTTP server and API endpoints
- **CORS**: Cross-origin resource sharing

### Security & Encryption
- **CryptoJS**: AES-256 encryption implementation
- **STUN Servers**: NAT traversal for P2P connections

## 📦 Installation & Setup

### Prerequisites
- Node.js 16+ and npm
- Modern web browser with WebRTC support

### Quick Start

1. **Clone and Install**
   ```bash
   git clone <repository-url>
   cd airforshare-x
   npm install
   ```

2. **Start Development Server**
   ```bash
   npm run dev
   ```
   This starts both the frontend (port 3000) and WebSocket server (port 8080)

3. **Production Build**
   ```bash
   npm run build
   npm run preview
   ```

### Environment Configuration

Create a `.env` file from `.env.example`:
```env
PORT=8080
NODE_ENV=production
CORS_ORIGIN=https://your-domain.com
```

## 🚀 Deployment

### Frontend Deployment (Vercel)
```bash
# Build the frontend
npm run build

# Deploy to Vercel
vercel --prod
```

### Backend Deployment (Render/Fly.io)
```bash
# For Render
git push origin main  # Auto-deploy if connected

# For Fly.io
fly deploy
```

### WebSocket Configuration
Update the WebSocket URL in `public/app.js`:
```javascript
const wsUrl = 'wss://your-websocket-server.com';
```

## 📱 Usage Guide

### Sending Files
1. **Select Files**: Drag & drop or click to browse files
2. **Create Session**: Click "Generate Session Code"
3. **Share Code**: Copy the session code or share the QR code
4. **Wait for Connection**: The recipient joins using the code
5. **Transfer Begins**: Files are automatically sent once connected

### Receiving Files
1. **Join Session**: Enter the session code received from sender
2. **Auto-Connect**: Connection is established automatically
3. **Receive Files**: Files are downloaded automatically
4. **Encryption Handling**: Enter passphrase if files are encrypted

### Encryption Setup
1. **Enable Encryption**: Toggle the encryption switch
2. **Set Passphrase**: Enter or generate a secure passphrase
3. **Share Passphrase**: Securely share the passphrase with recipient
4. **Automatic Encryption**: All files are encrypted before sending

## 🏗️ Architecture

### WebRTC P2P Flow
```
Sender Browser ←→ Signaling Server ←→ Receiver Browser
     ↓                                        ↓
     └──────── Direct P2P Connection ─────────┘
```

### File Transfer Process
1. **Signaling**: WebSocket establishes P2P connection
2. **Chunking**: Large files split into 16KB chunks
3. **Transfer**: Direct browser-to-browser transfer
4. **Reassembly**: Chunks combined on receiver side
5. **Download**: Automatic blob URL download

### Security Model
- **No Server Storage**: Files never touch the server
- **End-to-End Encryption**: Optional AES-256 encryption
- **Session-Based**: Temporary connections with auto-cleanup
- **HTTPS Required**: Secure contexts for WebRTC

## 🔧 Configuration Options

### WebRTC Configuration
```javascript
rtcConfig: {
    iceServers: [
        { urls: 'stun:stun.l.google.com:19302' },
        { urls: 'turn:your-turn-server.com', username: 'user', credential: 'pass' }
    ],
    iceCandidatePoolSize: 10
}
```

### Transfer Settings
- **Chunk Size**: 16KB (configurable)
- **Max Retries**: 3 attempts
- **Buffer Limit**: 160KB
- **Session Timeout**: 24 hours

## 🛡️ Security Considerations

### Best Practices
- Always use HTTPS in production
- Consider implementing TURN servers for enterprise use
- Use strong passphrases for encryption
- Regularly update dependencies
- Monitor for XSS vulnerabilities

### Privacy Features
- No file storage on servers
- Session codes expire automatically
- No user accounts required
- Local-only download history

## 🚨 Troubleshooting

### Common Issues

**Connection Failed**
- Check firewall settings
- Verify STUN server accessibility
- Ensure both browsers support WebRTC

**Large File Transfer Issues**
- Check available memory
- Monitor network stability
- Consider using TURN servers for complex networks

**Mobile Compatibility**
- Use HTTPS for mobile browsers
- Test on target mobile platforms
- Verify touch interface functionality

## 🤝 Contributing

1. Fork the repository
2. Create a feature branch
3. Make your changes
4. Add tests if applicable
5. Submit a pull request

## 📄 License

MIT License - see LICENSE file for details

## 🙏 Acknowledgments

- WebRTC specification and browser implementations
- STUN server providers (Google, etc.)
- Modern CSS techniques and glassmorphism design
- Open source WebSocket and crypto libraries

---

**AirForShare X** - Ultra-advanced file sharing for the modern web 🚀