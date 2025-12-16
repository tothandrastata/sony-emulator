/**
 * Sony Bravia SSIP TCP Server Emulator
 * Port: 20060 (Standard SSIP port)
 */

import net from 'net';
import { BraviaEmulator } from './bravia-emulator.js';
import { SSIP } from './ssip-protocol.js';

const PORT = 20060;
const HOST = '0.0.0.0';

class SSIPServer {
  constructor(port = PORT, host = HOST) {
    this.port = port;
    this.host = host;
    this.emulator = new BraviaEmulator();
    this.server = null;
  }

  start() {
    this.server = net.createServer((socket) => this.handleConnection(socket));

    this.server.on('error', (err) => {
      console.error('[Server] Error:', err.message);
      if (err.code === 'EADDRINUSE') {
        console.error(`[Server] Port ${this.port} is already in use`);
        process.exit(1);
      }
    });

    this.server.listen(this.port, this.host, () => {
      console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
      console.log('  Sony Bravia SSIP Emulator');
      console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
      console.log(`  Listening on ${this.host}:${this.port}`);
      console.log(`  Protocol: SSIP (Simple Single-wire IP)`);
      console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
      console.log('');
      console.log('Test connection:');
      console.log(`  nc localhost ${this.port}`);
      console.log(`  telnet localhost ${this.port}`);
      console.log('');
      console.log('Device State:');
      this.printState();
      console.log('');
    });
  }

  handleConnection(socket) {
    const clientId = `${socket.remoteAddress}:${socket.remotePort}`;
    console.log(`[Server] Client connected: ${clientId}`);

    this.emulator.addClient(socket);

    let buffer = Buffer.alloc(0);

    socket.on('data', (data) => {
      buffer = Buffer.concat([buffer, data]);

      // Process complete packets (24 bytes each)
      while (buffer.length >= SSIP.PACKET_SIZE) {
        const packet = buffer.slice(0, SSIP.PACKET_SIZE);
        buffer = buffer.slice(SSIP.PACKET_SIZE);

        // Handle packet and send response
        const response = this.emulator.handlePacket(packet);
        if (response) {
          socket.write(response);
        }
      }
    });

    socket.on('end', () => {
      console.log(`[Server] Client disconnected: ${clientId}`);
      this.emulator.removeClient(socket);
    });

    socket.on('error', (err) => {
      console.error(`[Server] Socket error (${clientId}):`, err.message);
      this.emulator.removeClient(socket);
    });
  }

  printState() {
    const state = this.emulator.getState();
    console.log(`  Power:  ${state.power ? 'ON' : 'OFF'}`);
    console.log(`  Volume: ${state.volume} (${state.mute ? 'MUTED' : 'Unmuted'})`);

    const inputTypes = { 1: 'HDMI', 3: 'Composite', 4: 'Component', 5: 'Screen Mirroring' };
    console.log(`  Input:  ${inputTypes[state.input.type]} ${state.input.number}`);
    console.log(`  Scene:  ${state.scene}`);
  }

  stop() {
    if (this.server) {
      this.server.close();
      console.log('[Server] Stopped');
    }
  }
}

// Start the server
const server = new SSIPServer();
server.start();

// Handle graceful shutdown
process.on('SIGINT', () => {
  console.log('\n[Server] Shutting down...');
  server.stop();
  process.exit(0);
});

process.on('SIGTERM', () => {
  console.log('\n[Server] Shutting down...');
  server.stop();
  process.exit(0);
});
