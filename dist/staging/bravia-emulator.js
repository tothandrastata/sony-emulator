/**
 * Sony Bravia SSIP Emulator - Device State and Command Handlers
 */

import {
  SSIP,
  parsePacket,
  buildAnswerPacket,
  buildErrorPacket,
  buildNotifyPacket,
  createDecimalParams,
  createHexParams
} from './ssip-protocol.js';

/**
 * Bravia Emulator - Maintains device state and handles SSIP commands
 */
export class BraviaEmulator {
  constructor() {
    this.state = {
      power: 0,           // 0 = off, 1 = on
      volume: 15,         // 0-100
      mute: 0,            // 0 = unmuted, 1 = muted
      input: {
        type: 1,          // 1=HDMI, 3=Composite, 4=Component, 5=Screen Mirroring
        number: 1         // Input number
      },
      scene: 'general'    // Scene setting
    };

    this.clients = new Set();
    this.debug = true;
  }

  /**
   * Log debug messages
   */
  log(...args) {
    if (this.debug) {
      console.log('[Emulator]', ...args);
    }
  }

  /**
   * Add a client connection
   */
  addClient(client) {
    this.clients.add(client);
    this.log(`Client connected. Total clients: ${this.clients.size}`);
  }

  /**
   * Remove a client connection
   */
  removeClient(client) {
    this.clients.delete(client);
    this.log(`Client disconnected. Total clients: ${this.clients.size}`);
  }

  /**
   * Broadcast a notification to all connected clients
   */
  notifyAllClients(command, value) {
    const packet = buildNotifyPacket(command, value);

    // Log notification
    const notifyPacket = parsePacket(packet);
    if (notifyPacket) {
      console.log(`→ NOTIFY: *S${notifyPacket.messageType}${notifyPacket.command}${notifyPacket.parametersHex.toUpperCase()}`);
    }

    this.clients.forEach(client => {
      try {
        if (client.writable) {
          client.write(packet);
        }
      } catch (err) {
        console.error('[Emulator] Error sending notification to client:', err.message);
        this.clients.delete(client); // Cleanup dead client if write fails
      }
    });
  }

  /**
   * Handle incoming SSIP packet
   * @param {Buffer} buffer - Raw packet data
   * @returns {Buffer|null} Response packet or null
   */
  handlePacket(buffer) {
    const packet = parsePacket(buffer);

    if (!packet) {
      this.log('Invalid packet received');
      return null;
    }

    // Log incoming command
    console.log(`← RX: *S${packet.messageType}${packet.command}${packet.parametersHex.toUpperCase()}`);

    // Route to appropriate handler based on message type
    let response;
    switch (packet.messageTypeByte) {
      case SSIP.MESSAGE_TYPES.CONTROL:
        response = this.handleControl(packet);
        break;
      case SSIP.MESSAGE_TYPES.ENQUIRY:
        response = this.handleEnquiry(packet);
        break;
      default:
        this.log(`Unhandled message type: ${packet.messageType}`);
        return null;
    }

    // Log outgoing response
    if (response) {
      const respPacket = parsePacket(response);
      if (respPacket) {
        console.log(`→ TX: *S${respPacket.messageType}${respPacket.command}${respPacket.parametersHex.toUpperCase()}`);
      }
    }

    return response;
  }

  /**
   * Handle Control commands (set values)
   */
  handleControl(packet) {
    const { command, parameters, parametersDecimal } = packet;

    // Reject specific commands if power is off
    if (this.state.power === 0 && ['VOLU', 'AMUT', 'INPT'].includes(command)) {
      this.log(`Rejecting ${command} (Power is OFF)`);
      return buildErrorPacket(command);
    }

    switch (command) {
      case SSIP.COMMANDS.POWR:
        return this.setPowerStatus(parametersDecimal);

      case SSIP.COMMANDS.VOLU:
        return this.setAudioVolume(parametersDecimal);

      case SSIP.COMMANDS.AMUT:
        return this.setAudioMute(parametersDecimal);

      case SSIP.COMMANDS.INPT:
        return this.setInput(parameters);

      case SSIP.COMMANDS.SCEN:
        return this.setSceneSetting(parameters);

      case SSIP.COMMANDS.IRCC:
        return this.handleIRCommand(parameters);

      default:
        this.log(`Unknown control command: ${command}`);
        return buildErrorPacket(command);
    }
  }

  /**
   * Handle Enquiry commands (get values)
   */
  handleEnquiry(packet) {
    const { command } = packet;

    // Reject specific commands if power is off
    if (this.state.power === 0 && ['VOLU', 'AMUT', 'INPT'].includes(command)) {
      this.log(`Rejecting ${command} (Power is OFF)`);
      return buildErrorPacket(command);
    }

    switch (command) {
      case SSIP.COMMANDS.POWR:
        return this.getPowerStatus();

      case SSIP.COMMANDS.VOLU:
        return this.getAudioVolume();

      case SSIP.COMMANDS.AMUT:
        return this.getAudioMute();

      case SSIP.COMMANDS.INPT:
        return this.getInput();

      case SSIP.COMMANDS.SCEN:
        return this.getSceneSetting();

      default:
        this.log(`Unknown enquiry command: ${command}`);
        return buildErrorPacket(command);
    }
  }

  // ============================================================================
  // Power Control
  // ============================================================================

  setPowerStatus(value) {
    const newPower = value ? 1 : 0;
    const changed = this.state.power !== newPower;

    this.state.power = newPower;
    this.log(`Power ${newPower ? 'ON' : 'OFF'}`);

    if (changed) {
      // Notify all clients of power state change
      this.notifyAllClients(SSIP.COMMANDS.POWR, createDecimalParams(newPower));
    }

    return buildAnswerPacket(SSIP.COMMANDS.POWR, createDecimalParams(newPower));
  }

  getPowerStatus() {
    return buildAnswerPacket(SSIP.COMMANDS.POWR, createDecimalParams(this.state.power));
  }

  // ============================================================================
  // Audio Volume Control
  // ============================================================================

  setAudioVolume(value) {
    // Clamp volume to 0-100 range
    const newVolume = Math.max(0, Math.min(100, value));
    const changed = this.state.volume !== newVolume;

    this.state.volume = newVolume;
    this.log(`Volume set to ${newVolume}`);

    if (changed) {
      this.notifyAllClients(SSIP.COMMANDS.VOLU, createDecimalParams(newVolume));
    }

    return buildAnswerPacket(SSIP.COMMANDS.VOLU, createDecimalParams(newVolume));
  }

  getAudioVolume() {
    return buildAnswerPacket(SSIP.COMMANDS.VOLU, createDecimalParams(this.state.volume));
  }

  // ============================================================================
  // Audio Mute Control
  // ============================================================================

  setAudioMute(value) {
    const newMute = value ? 1 : 0;
    const changed = this.state.mute !== newMute;

    this.state.mute = newMute;
    this.log(`Mute ${newMute ? 'ON' : 'OFF'}`);

    if (changed) {
      this.notifyAllClients(SSIP.COMMANDS.AMUT, createDecimalParams(newMute));
    }

    return buildAnswerPacket(SSIP.COMMANDS.AMUT, createDecimalParams(newMute));
  }

  getAudioMute() {
    return buildAnswerPacket(SSIP.COMMANDS.AMUT, createDecimalParams(this.state.mute));
  }

  // ============================================================================
  // Input Selection
  // ============================================================================

  setInput(params) {
    this.log(`setInput raw params: ${params.toString('hex')} (ASCII: ${params.toString('ascii').replace(/[^\x20-\x7E]/g, '.')})`);
    let type, number;
    const paramStr = params.toString('ascii');

    // Check if parameters are ASCII digits (Sony typically uses 16-byte numeric strings for some commands)
    // Client seems to send "0000000100000001" for HDMI 1 (Type 1, Number 1)
    if (/^\d{16}$/.test(paramStr)) {
      type = parseInt(paramStr.slice(0, 8), 10);
      number = parseInt(paramStr.slice(8, 16), 10);
    } else {
      // Fallback to binary/mixed parsing
      type = params[0];
      number = params[4];

      // Handle single-digit ASCII (old heuristic)
      if (type >= 48 && type <= 57) type -= 48;
      if (number >= 48 && number <= 57) number -= 48;
    }

    // Protection against invalid types
    const typeNames = { 1: 'HDMI', 3: 'Composite', 4: 'Component', 5: 'Screen Mirroring' };

    // If type is 0 (ASCII '0' converted), map it to valid if possible, or just log
    // If input is 0, maybe it means something specific? 
    // Assuming 0 might be a mistake from driver or a specific mode. 
    // Let's accept it but log as formatted.

    this.state.input.type = type;
    this.state.input.number = number;

    const typeName = typeNames[type] || `Unknown (${type})`;
    this.log(`Input set to ${typeName} ${number}`);

    this.notifyAllClients(SSIP.COMMANDS.INPT, params);

    return buildAnswerPacket(SSIP.COMMANDS.INPT, params.slice(0, 16));
  }

  getInput() {
    // Return ASCII format "000000TT000000NN"
    const typeStr = this.state.input.type.toString().padStart(8, '0');
    const numStr = this.state.input.number.toString().padStart(8, '0');
    const params = Buffer.from(typeStr + numStr);

    return buildAnswerPacket(SSIP.COMMANDS.INPT, params);
  }

  // ============================================================================
  // Scene Setting
  // ============================================================================

  setSceneSetting(params) {
    // Parse scene name from parameters (right-padded with #)
    const scene = params.toString('ascii').replace(/#/g, '').trim();

    const validScenes = ['auto', 'auto24pSync', 'general'];
    if (validScenes.includes(scene)) {
      this.state.scene = scene;
      this.log(`Scene set to ${scene}`);

      this.notifyAllClients(SSIP.COMMANDS.SCEN, params.slice(0, 16));

      return buildAnswerPacket(SSIP.COMMANDS.SCEN, params.slice(0, 16));
    } else {
      this.log(`Invalid scene: ${scene}`);
      return buildErrorPacket(SSIP.COMMANDS.SCEN);
    }
  }

  getSceneSetting() {
    const params = Buffer.from(this.state.scene.padEnd(16, '#'));
    return buildAnswerPacket(SSIP.COMMANDS.SCEN, params);
  }

  // ============================================================================
  // IR Commands
  // ============================================================================

  handleIRCommand(params) {
    const code = params.toString('ascii').trim();
    this.log(`IR Command: ${code}`);

    // Map common IR codes to actions
    const irCodeMap = {
      '0000000000000098': () => this.setPowerStatus(this.state.power ? 0 : 1), // Power toggle
      '0000000000000016': () => this.setAudioVolume(Math.min(100, this.state.volume + 1)), // Vol+
      '0000000000000017': () => this.setAudioVolume(Math.max(0, this.state.volume - 1)),   // Vol-
      '0000000000000019': () => this.setAudioMute(this.state.mute ? 0 : 1),               // Mute toggle
    };

    const handler = irCodeMap[code];
    if (handler) {
      handler();
    }

    // IR commands return success with echo of the code
    return buildAnswerPacket(SSIP.COMMANDS.IRCC, params.slice(0, 16));
  }

  // ============================================================================
  // State Management
  // ============================================================================

  /**
   * Get current device state
   */
  getState() {
    return { ...this.state };
  }

  /**
   * Reset device to default state
   */
  reset() {
    this.state = {
      power: 0,
      volume: 15,
      mute: 0,
      input: { type: 1, number: 1 },
      scene: 'general'
    };
    this.log('Device state reset to defaults');
  }
}
