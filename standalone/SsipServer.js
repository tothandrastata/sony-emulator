/**
 * SSIP TCP Server for Sony Bravia Emulator
 * Wraps TCP server logic and connects to emulator instance
 */

const net = require('net');
const os = require('os');
const { SSIP } = require('./ssip-protocol.js');

class SsipServer {
  constructor(emulator, options = {}) {
    this.emulator = emulator;
    this.host = options.host || '0.0.0.0';
    this.port = options.port || 20060;
    this.server = null;
  }

  getNetworkAddresses() {
    const interfaces = os.networkInterfaces();
    const addresses = [];

    for (const name of Object.keys(interfaces)) {
      for (const iface of interfaces[name]) {
        // Skip internal and non-IPv4 addresses
        if (iface.family === 'IPv4' && !iface.internal) {
          addresses.push(iface.address);
        }
      }
    }

    return addresses;
  }

  start() {
    this.server = net.createServer((socket) => this.handleConnection(socket));

    this.server.on('error', (err) => {
      console.error('[SSIP Server] Error:', err.message);
      if (err.code === 'EADDRINUSE') {
        console.error(`[SSIP Server] Port ${this.port} is already in use`);
        process.exit(1);
      }
    });

    this.server.listen(this.port, this.host, () => {
      const addresses = this.getNetworkAddresses();

      console.log('SSIP TCP Server:');
      console.log(`  Port: ${this.port}`);
      console.log(`  Protocol: SSIP (Simple Single-wire IP)`);
      console.log('  Network Addresses:');
      console.log(`    localhost:${this.port}`);
      console.log(`    127.0.0.1:${this.port}`);
      if (addresses.length > 0) {
        addresses.forEach(addr => {
          console.log(`    ${addr}:${this.port}`);
        });
      }
      console.log('');
    });
  }

  handleConnection(socket) {
    const clientId = `${socket.remoteAddress}:${socket.remotePort}`;
    console.log(`[SSIP] Client connected: ${clientId}`);

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
      console.log(`[SSIP] Client disconnected: ${clientId}`);
      this.emulator.removeClient(socket);
    });

    socket.on('error', (err) => {
      console.error(`[SSIP] Socket error (${clientId}):`, err.message);
      this.emulator.removeClient(socket);
    });
  }

  close() {
    if (this.server) {
      this.server.close();
      console.log('[SSIP] Server stopped');
    }
  }
}

module.exports = SsipServer;
