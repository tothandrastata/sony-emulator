/**
 * Web Server for Sony Bravia Emulator
 * Provides HTTP REST API and serves web UI
 */

const fastify = require('fastify');
const fastifyStatic = require('@fastify/static');
const fastifyCors = require('@fastify/cors');
const path = require('path');

class WebServer {
  constructor(emulator, options = {}) {
    this.emulator = emulator;
    this.host = options.host || '0.0.0.0';
    this.port = options.port || 8082;

    this.app = fastify({ logger: false });

    this.setupMiddleware();
    this.setupRoutes();
  }

  setupMiddleware() {
    // Enable CORS
    this.app.register(fastifyCors, {
      origin: true
    });

    // Serve static files
    this.app.register(fastifyStatic, {
      root: path.join(__dirname, 'web', 'static'),
      prefix: '/'
    });
  }

  /**
   * Get emulator state (no conversion needed - single source of truth)
   */
  getWebState() {
    return this.emulator.getState();
  }

  /**
   * Parse input source string to type and number
   */
  parseInputSource(inputStr) {
    const typeMap = { 'HDMI': 1, 'Composite': 3, 'Component': 4, 'Screen Mirroring': 5 };

    // Try to match each type name (handles multi-word names like "Screen Mirroring")
    for (const [typeName, typeValue] of Object.entries(typeMap)) {
      if (inputStr.startsWith(typeName)) {
        const number = parseInt(inputStr.substring(typeName.length).trim()) || 1;
        return { type: typeValue, number };
      }
    }

    // Fallback to HDMI 1
    return { type: 1, number: 1 };
  }

  setupRoutes() {
    // Device status with full info
    this.app.get('/api/status', async (request, reply) => {
      const state = this.getWebState();
      return {
        device: {
          name: process.env.PRODUCT_NAME || 'Sony Bravia SSIP Emulator',
          model: process.env.MODEL_NAME || 'BRAVIA-X100',
          serial: process.env.SERIAL_NUMBER || 'EMULATOR-001',
          version: process.env.VERSION || '1.0.0'
        },
        state
      };
    });

    // Get current state only
    this.app.get('/api/state', async (request, reply) => {
      return { success: true, state: this.getWebState() };
    });

    // Power control
    this.app.put('/api/power', async (request, reply) => {
      const { value } = request.body || {};
      if (!value) {
        return reply.code(400).send({ success: false, error: 'Missing value' });
      }

      const powerValue = value === "On" ? 1 : 0;
      this.emulator.setPowerStatus(powerValue);

      return { success: true, state: this.getWebState() };
    });

    // Volume control
    this.app.put('/api/volume', async (request, reply) => {
      const { value } = request.body || {};
      if (value === undefined || value === null) {
        return reply.code(400).send({ success: false, error: 'Missing value' });
      }

      const volumeValue = Math.max(0, Math.min(100, parseInt(value)));
      this.emulator.setAudioVolume(volumeValue);

      return { success: true, state: this.getWebState() };
    });

    // Mute control
    this.app.put('/api/mute', async (request, reply) => {
      const { value } = request.body || {};
      if (!value) {
        return reply.code(400).send({ success: false, error: 'Missing value' });
      }

      const muteValue = value === "Muted" ? 1 : 0;
      this.emulator.setAudioMute(muteValue);

      return { success: true, state: this.getWebState() };
    });

    // Input selection
    this.app.put('/api/input', async (request, reply) => {
      const { value } = request.body || {};
      if (!value) {
        return reply.code(400).send({ success: false, error: 'Missing value' });
      }

      const { type, number } = this.parseInputSource(value);
      const params = Buffer.alloc(16, 0);
      params[0] = type;
      params[4] = number;

      this.emulator.setInput(params);

      return { success: true, state: this.getWebState() };
    });

    // Scene control
    this.app.put('/api/scene', async (request, reply) => {
      const { value } = request.body || {};
      if (!value) {
        return reply.code(400).send({ success: false, error: 'Missing value' });
      }

      const validScenes = ['auto', 'auto24pSync', 'general'];
      if (!validScenes.includes(value)) {
        return reply.code(400).send({ success: false, error: 'Invalid scene' });
      }

      const params = Buffer.from(value.padEnd(16, '#'));
      this.emulator.setSceneSetting(params);

      return { success: true, state: this.getWebState() };
    });
  }

  async start() {
    try {
      await this.app.listen({ port: this.port, host: this.host });
      console.log('Web UI Server:');
      console.log(`  Port: ${this.port}`);
      console.log(`  URL: http://localhost:${this.port}`);
      console.log('');
    } catch (err) {
      console.error('[Web Server] Failed to start:', err.message);
      process.exit(1);
    }
  }

  async close() {
    if (this.app) {
      await this.app.close();
      console.log('[Web Server] Stopped');
    }
  }
}

module.exports = WebServer;
