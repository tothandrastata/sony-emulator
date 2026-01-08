/**
 * Sony Bravia SSIP Emulator - Main Entry Point
 * Starts both SSIP TCP server and Web UI server
 */

require('dotenv').config();
const { BraviaEmulator } = require('./SonyEmulator');
const SsipServer = require('./SsipServer');
const WebServer = require('./WebServer');

console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
console.log('  Sony Bravia SSIP Emulator');
console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
console.log(`  Model: ${process.env.MODEL_NAME || 'BRAVIA-X100'}`);
console.log(`  Version: ${process.env.VERSION || '1.0.0'}`);
console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
console.log('');

// Create shared emulator instance
const emulator = new BraviaEmulator();

// Start SSIP TCP server
const ssipServer = new SsipServer(emulator, {
  host: process.env.SSIP_HOST || '0.0.0.0',
  port: parseInt(process.env.SSIP_PORT) || 20060
});

ssipServer.start();

// Start Web UI server (if enabled)
let webServer = null;
if (process.env.WEB_UI_ENABLED !== 'false') {
  webServer = new WebServer(emulator, {
    host: process.env.WEB_UI_HOST || '0.0.0.0',
    port: parseInt(process.env.WEB_UI_PORT) || 8082
  });

  webServer.start();
}

// Print initial state
console.log('Initial Device State:');
const state = emulator.getState();
console.log(`  Power:  ${state.powerStatus || (state.power ? 'ON' : 'OFF')}`);
console.log(`  Volume: ${state.volumeLevel !== undefined ? state.volumeLevel : state.volume}`);
console.log(`  Mute:   ${state.muteStatus || (state.mute ? 'Muted' : 'Unmuted')}`);
if (state.inputSource) {
  console.log(`  Input:  ${state.inputSource}`);
} else if (state.input) {
  const typeNames = { 1: 'HDMI', 3: 'Composite', 4: 'Component', 5: 'Screen Mirroring' };
  console.log(`  Input:  ${typeNames[state.input.type]} ${state.input.number}`);
}
console.log(`  Scene:  ${state.sceneMode || state.scene}`);
console.log('');

// Graceful shutdown
function cleanup() {
  console.log('');
  console.log('Shutting down...');
  ssipServer.close();
  if (webServer) {
    webServer.close().then(() => {
      console.log('Goodbye!');
      process.exit(0);
    });
  } else {
    console.log('Goodbye!');
    process.exit(0);
  }
}

process.on('SIGINT', cleanup);
process.on('SIGTERM', cleanup);
