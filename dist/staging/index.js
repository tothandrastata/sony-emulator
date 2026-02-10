/**
 * Sony Bravia SSIP Emulator - Main Entry Point
 * Orchestrates TCP Server and Web API
 */

import { BraviaEmulator } from './bravia-emulator.js';
import { TcpServer } from './TcpServer.js';
import { WebServer } from './WebServer.js';

// Configuration
const config = {
  // TCP Server (Disabled by default)
  tcpHost: process.env.TCP_HOST || '0.0.0.0',
  tcpPort: parseInt(process.env.TCP_PORT || '20060', 10),

  // Web UI
  webHost: process.env.WEB_HOST || '0.0.0.0',
  webPort: parseInt(process.env.WEB_PORT || '8085', 10)
};

// Create shared emulator instance
const emulator = new BraviaEmulator();

// Create servers
const tcpServer = new TcpServer(emulator, {
  host: config.tcpHost,
  port: config.tcpPort
});

const webServer = new WebServer(emulator, tcpServer, {
  host: config.webHost,
  port: config.webPort
});

// Start application
async function start() {
  console.log(`
  ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
    Sony Bravia SSIP Emulator
  ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
    Web UI:    http://${config.webHost}:${config.webPort} (Control & Settings)
    TCP Port:  ${config.tcpPort} (Currently: ${tcpServer.isRunning ? 'ENABLED' : 'DISABLED'})
  ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
  `);

  try {
    // Start Web Server immediately
    await webServer.start();

    // NOTE: TCP Server is NOT started automatically.
    // It must be enabled via the Web UI or API.

  } catch (err) {
    console.error('Error starting services:', err);
    process.exit(1);
  }
}

// Graceful shutdown
async function shutdown() {
  console.log('\nShutting down gracefully...');

  try {
    await tcpServer.stop();
    await webServer.stop();
    console.log('Shutdown complete');
    process.exit(0);
  } catch (err) {
    console.error('Error during shutdown:', err);
    process.exit(1);
  }
}

process.on('SIGINT', shutdown);
process.on('SIGTERM', shutdown);

// Start
start();
