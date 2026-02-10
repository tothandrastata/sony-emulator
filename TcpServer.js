/**
 * TCP Server for Sony Bravia SSIP Emulator
 * Handles incoming TCP connections and routes packets to emulator
 */

import net from 'net';
import { SSIP } from './ssip-protocol.js';

export class TcpServer {
  constructor(emulator, config = {}) {
    this.emulator = emulator; // BraviaEmulator instance
    this.config = {
      host: config.host || '0.0.0.0',
      port: config.port || 20060,
    };
    this.server = null;
    this.sockets = new Set();
    this.isRunning = false;
  }

  async start() {
    if (this.isRunning) {
      console.log('[TCP] Server already running');
      return;
    }

    return new Promise((resolve, reject) => {
      this.server = net.createServer((socket) => this.handleConnection(socket));

      this.server.on('error', (err) => {
        console.error('[TCP] Server error:', err.message);
        if (err.code === 'EADDRINUSE') {
          console.error(`[TCP] Port ${this.config.port} is already in use`);
        }
        this.isRunning = false;
        reject(err);
      });

      this.server.listen(this.config.port, this.config.host, () => {
        this.isRunning = true;
        console.log(`[TCP] Server listening on ${this.config.host}:${this.config.port}`);
        console.log(`[TCP] Protocol: SSIP (Simple Single-wire IP)`);
        resolve();
      });
    });
  }

  async stop() {
    if (!this.isRunning || !this.server) {
      console.log('[TCP] Server is not running');
      return;
    }

    return new Promise((resolve) => {
      console.log(`[TCP] Stopping server. Closing ${this.sockets.size} active connections...`);

      // Forcefully close all active connections
      for (const socket of this.sockets) {
        socket.destroy();
      }
      this.sockets.clear();

      this.server.close(() => {
        console.log('[TCP] Server closed');
        this.server = null;
        this.isRunning = false;
        resolve();
      });
    });
  }

  handleConnection(socket) {
    const clientId = `${socket.remoteAddress}:${socket.remotePort}`;
    console.log(`[TCP] Client connected: ${clientId}`);

    this.sockets.add(socket);
    this.emulator.addClient(socket);

    let buffer = Buffer.alloc(0);

    socket.on('data', (data) => {
      console.log(`[TCP] RX Raw (${socket.remoteAddress}): ${data.toString('hex')}`);
      buffer = Buffer.concat([buffer, data]);

      // Process complete packets (24 bytes each)
      while (buffer.length >= SSIP.PACKET_SIZE) {
        const packet = buffer.slice(0, SSIP.PACKET_SIZE);
        buffer = buffer.slice(SSIP.PACKET_SIZE);

        try {
          // Handle packet and send response
          const response = this.emulator.handlePacket(packet);
          if (response) {
            socket.write(response);
          }
        } catch (err) {
          console.error('[TCP] Error processing packet:', err.message);
        }
      }
    });

    socket.on('end', () => {
      console.log(`[TCP] Client disconnected: ${clientId}`);
      this.sockets.delete(socket);
      this.emulator.removeClient(socket);
    });

    socket.on('error', (err) => {
      console.error(`[TCP] Socket error (${clientId}):`, err.message);
      this.sockets.delete(socket);
      this.emulator.removeClient(socket);
    });
  }
}
