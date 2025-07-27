import WebSocket, { WebSocketServer } from 'ws';
import { createServer } from 'http';
import express from 'express';
import cors from 'cors';

class SignalingServer {
    constructor() {
        this.app = express();
        this.server = createServer(this.app);
        this.wss = new WebSocketServer({ server: this.server });
        this.sessions = new Map();
        this.clients = new Map();
        
        this.setupExpress();
        this.setupWebSocket();
    }

    setupExpress() {
        this.app.use(cors());
        this.app.use(express.json());
        
        // Health check endpoint
        this.app.get('/health', (req, res) => {
            res.json({ 
                status: 'OK', 
                timestamp: new Date().toISOString(),
                activeSessions: this.sessions.size,
                connectedClients: this.clients.size
            });
        });

        // Get session info
        this.app.get('/session/:id', (req, res) => {
            const sessionId = req.params.id;
            const session = this.sessions.get(sessionId);
            
            if (session) {
                res.json({
                    sessionId,
                    clientCount: session.clients.length,
                    created: session.created
                });
            } else {
                res.status(404).json({ error: 'Session not found' });
            }
        });

        // Serve static files in production
        if (process.env.NODE_ENV === 'production') {
            this.app.use(express.static('public'));
        }
    }

    setupWebSocket() {
        this.wss.on('connection', (ws, req) => {
            const clientId = this.generateClientId();
            this.clients.set(clientId, {
                ws,
                sessionId: null,
                connected: new Date()
            });

            console.log(`Client ${clientId} connected. Total clients: ${this.clients.size}`);

            ws.on('message', (message) => {
                try {
                    const data = JSON.parse(message.toString());
                    this.handleMessage(clientId, data);
                } catch (error) {
                    console.error('Invalid message format:', error);
                    this.sendError(ws, 'Invalid message format');
                }
            });

            ws.on('close', () => {
                this.handleClientDisconnect(clientId);
            });

            ws.on('error', (error) => {
                console.error(`WebSocket error for client ${clientId}:`, error);
                this.handleClientDisconnect(clientId);
            });

            // Send welcome message
            this.sendMessage(ws, {
                type: 'welcome',
                clientId,
                timestamp: new Date().toISOString()
            });
        });

        console.log('WebSocket server initialized');
    }

    handleMessage(clientId, message) {
        const client = this.clients.get(clientId);
        if (!client) return;

        console.log(`Message from ${clientId}:`, message.type);

        switch (message.type) {
            case 'create-session':
                this.handleCreateSession(clientId, message);
                break;
            case 'join-session':
                this.handleJoinSession(clientId, message);
                break;
            case 'offer':
            case 'answer':
            case 'ice-candidate':
                this.handleSignalingMessage(clientId, message);
                break;
            case 'leave-session':
                this.handleLeaveSession(clientId);
                break;
            case 'ping':
                this.sendMessage(client.ws, { type: 'pong' });
                break;
            default:
                console.warn(`Unknown message type: ${message.type}`);
                this.sendError(client.ws, 'Unknown message type');
        }
    }

    handleCreateSession(clientId, message) {
        const { sessionId } = message;
        const client = this.clients.get(clientId);

        if (!client) return;

        // Check if session already exists
        if (this.sessions.has(sessionId)) {
            this.sendError(client.ws, 'Session ID already exists');
            return;
        }

        // Create new session
        const session = {
            id: sessionId,
            host: clientId,
            clients: [clientId],
            created: new Date(),
            lastActivity: new Date()
        };

        this.sessions.set(sessionId, session);
        client.sessionId = sessionId;

        this.sendMessage(client.ws, {
            type: 'session-created',
            sessionId,
            timestamp: session.created.toISOString()
        });

        console.log(`Session ${sessionId} created by client ${clientId}`);
    }

    handleJoinSession(clientId, message) {
        const { sessionId } = message;
        const client = this.clients.get(clientId);
        const session = this.sessions.get(sessionId);

        if (!client) return;

        if (!session) {
            this.sendError(client.ws, 'Session not found');
            return;
        }

        if (session.clients.length >= 2) {
            this.sendError(client.ws, 'Session is full');
            return;
        }

        // Add client to session
        session.clients.push(clientId);
        session.lastActivity = new Date();
        client.sessionId = sessionId;

        // Notify client they joined
        this.sendMessage(client.ws, {
            type: 'session-joined',
            sessionId,
            clientCount: session.clients.length
        });

        // Notify other clients in session
        session.clients.forEach(otherClientId => {
            if (otherClientId !== clientId) {
                const otherClient = this.clients.get(otherClientId);
                if (otherClient) {
                    this.sendMessage(otherClient.ws, {
                        type: 'peer-joined',
                        peerId: clientId,
                        clientCount: session.clients.length
                    });
                }
            }
        });

        console.log(`Client ${clientId} joined session ${sessionId}`);
    }

    handleSignalingMessage(clientId, message) {
        const client = this.clients.get(clientId);
        if (!client || !client.sessionId) return;

        const session = this.sessions.get(client.sessionId);
        if (!session) return;

        // Relay signaling message to other clients in session
        session.clients.forEach(otherClientId => {
            if (otherClientId !== clientId) {
                const otherClient = this.clients.get(otherClientId);
                if (otherClient) {
                    this.sendMessage(otherClient.ws, {
                        ...message,
                        fromClient: clientId
                    });
                }
            }
        });

        session.lastActivity = new Date();
    }

    handleLeaveSession(clientId) {
        const client = this.clients.get(clientId);
        if (!client || !client.sessionId) return;

        const session = this.sessions.get(client.sessionId);
        if (session) {
            // Remove client from session
            session.clients = session.clients.filter(id => id !== clientId);

            // Notify other clients
            session.clients.forEach(otherClientId => {
                const otherClient = this.clients.get(otherClientId);
                if (otherClient) {
                    this.sendMessage(otherClient.ws, {
                        type: 'peer-left',
                        peerId: clientId,
                        clientCount: session.clients.length
                    });
                }
            });

            // Delete session if empty
            if (session.clients.length === 0) {
                this.sessions.delete(client.sessionId);
                console.log(`Session ${client.sessionId} deleted (empty)`);
            }
        }

        client.sessionId = null;
        console.log(`Client ${clientId} left session`);
    }

    handleClientDisconnect(clientId) {
        const client = this.clients.get(clientId);
        if (!client) return;

        console.log(`Client ${clientId} disconnected`);

        // Leave session if in one
        if (client.sessionId) {
            this.handleLeaveSession(clientId);
        }

        // Remove client
        this.clients.delete(clientId);
        console.log(`Total clients: ${this.clients.size}`);
    }

    sendMessage(ws, message) {
        if (ws.readyState === WebSocket.OPEN) {
            ws.send(JSON.stringify(message));
        }
    }

    sendError(ws, errorMessage) {
        this.sendMessage(ws, {
            type: 'error',
            message: errorMessage,
            timestamp: new Date().toISOString()
        });
    }

    generateClientId() {
        return 'client_' + Math.random().toString(36).substr(2, 9) + '_' + Date.now();
    }

    // Cleanup old sessions periodically
    startCleanupTask() {
        setInterval(() => {
            const now = new Date();
            const maxAge = 24 * 60 * 60 * 1000; // 24 hours

            for (const [sessionId, session] of this.sessions.entries()) {
                if (now - session.lastActivity > maxAge) {
                    console.log(`Cleaning up inactive session: ${sessionId}`);
                    this.sessions.delete(sessionId);
                }
            }
        }, 60 * 60 * 1000); // Run every hour
    }

    start(port = 8080) {
        this.server.listen(port, () => {
            console.log(`AirForShare X Signaling Server started on port ${port}`);
            console.log(`WebSocket endpoint: ws://localhost:${port}`);
            console.log(`Health check: http://localhost:${port}/health`);
        });

        this.startCleanupTask();

        // Graceful shutdown
        process.on('SIGTERM', () => {
            console.log('Received SIGTERM, shutting down gracefully');
            this.server.close(() => {
                process.exit(0);
            });
        });

        process.on('SIGINT', () => {
            console.log('Received SIGINT, shutting down gracefully');
            this.server.close(() => {
                process.exit(0);
            });
        });
    }
}

// Start server
const port = process.env.PORT || 8080;
const server = new SignalingServer();
server.start(port);

export default SignalingServer;