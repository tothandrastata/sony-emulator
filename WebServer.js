/**
 * Web Server for Sony Bravia Emulator
 * REST API and Web UI hosting
 */

import Fastify from 'fastify';
import fastifyStatic from '@fastify/static';
import fastifyCors from '@fastify/cors';
import path from 'path';
import { fileURLToPath } from 'url';

import fs from 'fs';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

// Read package.json
const packageJson = JSON.parse(fs.readFileSync(path.join(__dirname, 'package.json'), 'utf8'));
const version = packageJson.version;

export class WebServer {
    constructor(emulator, tcpServer, config = {}) {
        this.emulator = emulator; // BraviaEmulator instance
        this.tcpServer = tcpServer; // TcpServer instance
        this.config = {
            host: config.host || '0.0.0.0',
            port: config.port || 8082, // Default to 8082 to match Nginx and avoid conflict with Panasonic (8084) / LG (8085)
        };
        this.app = Fastify({
            logger: false
        });

        this.setupRoutes();
    }

    setupRoutes() {
        // Register CORS
        this.app.register(fastifyCors, {
            origin: true
        });

        // Register static file serving
        this.app.register(fastifyStatic, {
            root: path.join(__dirname, 'standalonewebstatic'),
            prefix: '/',
            cacheControl: false,
            etag: false,
            lastModified: false
        });

        // API Routes
        this.app.register((instance, opts, done) => {
            // Status endpoint
            instance.get('/status', async (request, reply) => {
                const status = {
                    device: {
                        model: 'Sony Bravia Emulator',
                        version: version,
                    },
                    clientCount: this.emulator.clients.size,
                    clientIPs: Array.from(this.emulator.clients).map(s => s.remoteAddress),
                    tcpServerEnabled: this.tcpServer.isRunning,
                    tcpPort: this.tcpServer.config.port,
                    state: this.emulator.getState()
                };
                return status;
            });

            // TCP Control Routes
            instance.post('/tcp/enable', async (request, reply) => {
                try {
                    await this.tcpServer.start();
                    return { success: true, message: 'TCP Server enabled' };
                } catch (err) {
                    return reply.code(500).send({ error: err.message });
                }
            });

            instance.post('/tcp/disable', async (request, reply) => {
                try {
                    await this.tcpServer.stop();
                    return { success: true, message: 'TCP Server disabled' };
                } catch (err) {
                    return reply.code(500).send({ error: err.message });
                }
            });

            // Emulator Control Routes
            instance.put('/power', async (request, reply) => {
                const { value } = request.body;
                // value: 'On' or 'Off'
                const isOn = value === 'On' || value === true || value === 1;
                this.emulator.setPowerStatus(isOn ? 1 : 0);
                return { success: true, state: this.emulator.getState() };
            });

            instance.put('/volume', async (request, reply) => {
                const { value } = request.body;
                const vol = parseInt(value, 10);
                if (!isNaN(vol)) {
                    this.emulator.setAudioVolume(vol);
                    return { success: true, state: this.emulator.getState() };
                }
                return reply.code(400).send({ error: 'Invalid volume' });
            });

            instance.put('/mute', async (request, reply) => {
                const { value } = request.body;
                // value: 'Muted' or 'Unmuted'
                const isMuted = value === 'Muted' || value === true || value === 1;
                this.emulator.setAudioMute(isMuted ? 1 : 0);
                return { success: true, state: this.emulator.getState() };
            });

            instance.put('/input', async (request, reply) => {
                const { value } = request.body;
                // value: "HDMI 1", "HDMI 2", etc.
                try {
                    // Helper to parse friendly name to type/number
                    // Simple parsing logic derived from implementation
                    const parts = value.split(' ');
                    const typeMap = {
                        'HDMI': 1,
                        'Composite': 3,
                        'Component': 4,
                        'Mirroring': 5,
                        'PC': 5 // Assuming PC map
                    };
                    const typeName = parts[0];
                    const number = parseInt(parts[parts.length - 1], 10) || 1;
                    const type = typeMap[typeName] || 1;

                    // We need to construct parameters to call setInput or just update state directly?
                    // BraviaEmulator.setInput expects parameters buffer or we can expose a direct setter.
                    // Let's expose a direct setter in Emulator or synthesize parameters.
                    // Better: update Emulator to have a setInputFriendly method or logic.
                    // For now, let's manually update state and notify.

                    // Construct pseudo-buffer params for notify
                    // Using ASCII format "000000TT000000NN" (8 chars Type + 8 chars Number)
                    const typeStr = type.toString().padStart(8, '0');
                    const numStr = number.toString().padStart(8, '0');
                    const params = Buffer.from(typeStr + numStr);

                    this.emulator.setInput(params);

                    return { success: true, state: this.emulator.getState() };
                } catch (err) {
                    return reply.code(400).send({ error: err.message });
                }
            });

            done();
        }, { prefix: '/api' });
    }

    async start() {
        try {
            await this.app.listen({
                host: this.config.host,
                port: this.config.port
            });
            console.log(`[Web] Server listening on http://${this.config.host}:${this.config.port}`);
        } catch (err) {
            console.error('[Web] Error starting server:', err.message);
            process.exit(1);
        }
    }

    async stop() {
        await this.app.close();
        console.log('[Web] Server closed');
    }
}
