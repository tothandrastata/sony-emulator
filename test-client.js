/**
 * SSIP Test Client - Demonstrates how to communicate with the emulator
 */

import net from 'net';
import { buildPacket, parsePacket, createDecimalParams } from './ssip-protocol.js';

const PORT = 20060;
const HOST = 'localhost';

class SSIPClient {
  constructor(host = HOST, port = PORT) {
    this.host = host;
    this.port = port;
    this.socket = null;
  }

  connect() {
    return new Promise((resolve, reject) => {
      this.socket = net.createConnection(this.port, this.host, () => {
        console.log(`Connected to ${this.host}:${this.port}`);
        resolve();
      });

      this.socket.on('data', (data) => {
        this.handleResponse(data);
      });

      this.socket.on('error', (err) => {
        console.error('Connection error:', err.message);
        reject(err);
      });

      this.socket.on('close', () => {
        console.log('Connection closed');
      });
    });
  }

  handleResponse(data) {
    let buffer = data;
    while (buffer.length >= 24) {
      const packet = buffer.slice(0, 24);
      buffer = buffer.slice(24);

      const parsed = parsePacket(packet);
      if (parsed) {
        console.log(`<- ${parsed.messageType} ${parsed.command} ${parsed.parametersHex}`);

        // Decode common responses
        if (parsed.command === 'POWR') {
          const power = parsed.parametersDecimal ? 'ON' : 'OFF';
          console.log(`   Power: ${power}`);
        } else if (parsed.command === 'VOLU') {
          console.log(`   Volume: ${parsed.parametersDecimal}`);
        } else if (parsed.command === 'AMUT') {
          const mute = parsed.parametersDecimal ? 'MUTED' : 'UNMUTED';
          console.log(`   Mute: ${mute}`);
        }
      }
    }
  }

  sendCommand(messageType, command, parameters) {
    const packet = buildPacket(messageType, command, parameters);
    const parsed = parsePacket(packet);
    console.log(`-> ${parsed.messageType} ${parsed.command} ${parsed.parametersHex}`);
    this.socket.write(packet);
  }

  // Convenience methods
  getPowerStatus() {
    this.sendCommand('E', 'POWR', createDecimalParams(0));
  }

  setPowerOn() {
    this.sendCommand('C', 'POWR', createDecimalParams(1));
  }

  setPowerOff() {
    this.sendCommand('C', 'POWR', createDecimalParams(0));
  }

  getVolume() {
    this.sendCommand('E', 'VOLU', createDecimalParams(0));
  }

  setVolume(volume) {
    this.sendCommand('C', 'VOLU', createDecimalParams(volume));
  }

  getMute() {
    this.sendCommand('E', 'AMUT', createDecimalParams(0));
  }

  setMute(mute) {
    this.sendCommand('C', 'AMUT', createDecimalParams(mute ? 1 : 0));
  }

  setInput(type, number) {
    const params = Buffer.alloc(16, 0);
    params[0] = type;
    params[4] = number;
    this.sendCommand('C', 'INPT', params);
  }

  setScene(sceneName) {
    this.sendCommand('C', 'SCEN', sceneName);
  }

  disconnect() {
    if (this.socket) {
      this.socket.end();
    }
  }
}

// Demo script
async function runDemo() {
  console.log('═══════════════════════════════════════════════════════');
  console.log('  SSIP Client Test');
  console.log('═══════════════════════════════════════════════════════\n');

  const client = new SSIPClient();

  try {
    await client.connect();
    console.log('');

    // Wait helper
    const wait = (ms) => new Promise(resolve => setTimeout(resolve, ms));

    console.log('Test 1: Query Power Status');
    client.getPowerStatus();
    await wait(100);

    console.log('\nTest 2: Turn Power ON');
    client.setPowerOn();
    await wait(100);

    console.log('\nTest 3: Query Power Status');
    client.getPowerStatus();
    await wait(100);

    console.log('\nTest 4: Query Volume');
    client.getVolume();
    await wait(100);

    console.log('\nTest 5: Set Volume to 50');
    client.setVolume(50);
    await wait(100);

    console.log('\nTest 6: Query Volume');
    client.getVolume();
    await wait(100);

    console.log('\nTest 7: Mute Audio');
    client.setMute(true);
    await wait(100);

    console.log('\nTest 8: Query Mute Status');
    client.getMute();
    await wait(100);

    console.log('\nTest 9: Unmute Audio');
    client.setMute(false);
    await wait(100);

    console.log('\nTest 10: Set Input to HDMI 2');
    client.setInput(1, 2);
    await wait(100);

    console.log('\nTest 11: Set Scene to auto');
    client.setScene('auto');
    await wait(100);

    console.log('\nTest 12: Turn Power OFF');
    client.setPowerOff();
    await wait(100);

    console.log('\n═══════════════════════════════════════════════════════');
    console.log('  Tests Complete');
    console.log('═══════════════════════════════════════════════════════\n');

    await wait(500);
    client.disconnect();

  } catch (error) {
    console.error('Error:', error.message);
    process.exit(1);
  }
}

// Run if executed directly
if (import.meta.url === `file://${process.argv[1]}`) {
  runDemo();
}

export { SSIPClient };
