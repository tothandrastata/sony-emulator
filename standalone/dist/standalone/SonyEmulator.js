/**
 * Sony Bravia SSIP Emulator - Device State and Command Handlers
 * Modified for LARA Integration
 */

const {
  SSIP,
  parsePacket,
  buildAnswerPacket,
  buildErrorPacket,
  buildNotifyPacket,
  createDecimalParams,
  createHexParams
} = require('./ssip-protocol.js');

/**
 * Bravia Emulator - Maintains device state and handles SSIP commands
 */
class BraviaEmulator {
  constructor() {
    // Single source of truth - no redundant properties
    this.state = {
      powerStatus: "Off",        // "On" or "Off"
      volumeLevel: 15,           // 0-100
      muteStatus: "Unmuted",     // "Muted" or "Unmuted"
      inputSource: "HDMI 1",     // e.g., "HDMI 1", "Composite 2"
      sceneMode: "general"       // "general", "auto", "auto24pSync"
    };

    // Reverse lookup for input source parsing
    this.inputTypes = { 1: 'HDMI', 3: 'Composite', 4: 'Component', 5: 'Screen Mirroring' };
    this.inputTypesReverse = { 'HDMI': 1, 'Composite': 3, 'Component': 4, 'Screen Mirroring': 5 };

    this.clients = new Set();
    this.debug = true;
  }

  // ============================================================================
  // Helper Methods for SSIP Protocol Conversion (single source of truth)
  // ============================================================================

  /**
   * Get power as numeric value for SSIP protocol
   */
  getPowerNumeric() {
    return this.state.powerStatus === "On" ? 1 : 0;
  }

  /**
   * Get mute as numeric value for SSIP protocol
   */
  getMuteNumeric() {
    return this.state.muteStatus === "Muted" ? 1 : 0;
  }

  /**
   * Get input as object for SSIP protocol
   */
  getInputObject() {
    const parts = this.state.inputSource.split(' ');
    const typeName = parts[0];
    const number = parseInt(parts[1]) || 1;
    const type = this.inputTypesReverse[typeName] || 1;
    return { type, number };
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
      this.log(`→ NOTIFY: *S${notifyPacket.messageType}${notifyPacket.command}${notifyPacket.parametersHex.toUpperCase()}`);
    }

    this.clients.forEach(client => {
      if (client.writable) {
        client.write(packet);
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
    this.log(`← RX: *S${packet.messageType}${packet.command}${packet.parametersHex.toUpperCase()}`);

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
        this.log(`→ TX: *S${respPacket.messageType}${respPacket.command}${respPacket.parametersHex.toUpperCase()}`);
      }
    }

    return response;
  }

  /**
   * Handle Control commands (set values)
   */
  handleControl(packet) {
    const { command, parameters, parametersDecimal } = packet;

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
    const powerString = value ? 'On' : 'Off';
    const changed = this.state.powerStatus !== powerString;

    this.state.powerStatus = powerString;
    this.log(`Power ${powerString}`);

    if (changed) {
      // Notify all TCP clients
      this.notifyAllClients(SSIP.COMMANDS.POWR, createDecimalParams(this.getPowerNumeric()));

      // Emit LARA event
      if (this.laraEmitter) {
        this.laraEmitter('powerStatusChanged', powerString);
      }
    }

    return buildAnswerPacket(SSIP.COMMANDS.POWR, createDecimalParams(this.getPowerNumeric()));
  }

  getPowerStatus() {
    return buildAnswerPacket(SSIP.COMMANDS.POWR, createDecimalParams(this.getPowerNumeric()));
  }

  // ============================================================================
  // Audio Volume Control
  // ============================================================================

  setAudioVolume(value) {
    // Clamp volume to 0-100 range
    const newVolume = Math.max(0, Math.min(100, value));
    const changed = this.state.volumeLevel !== newVolume;

    this.state.volumeLevel = newVolume;
    this.log(`Volume set to ${newVolume}`);

    if (changed) {
      // Notify all TCP clients
      this.notifyAllClients(SSIP.COMMANDS.VOLU, createDecimalParams(newVolume));

      // Emit LARA event
      if (this.laraEmitter) {
        this.laraEmitter('volumeChanged', `${newVolume}`);
      }
    }

    return buildAnswerPacket(SSIP.COMMANDS.VOLU, createDecimalParams(newVolume));
  }

  getAudioVolume() {
    return buildAnswerPacket(SSIP.COMMANDS.VOLU, createDecimalParams(this.state.volumeLevel));
  }

  // ============================================================================
  // Audio Mute Control
  // ============================================================================

  setAudioMute(value) {
    const muteString = value ? 'Muted' : 'Unmuted';
    const changed = this.state.muteStatus !== muteString;

    this.state.muteStatus = muteString;
    this.log(`Mute ${muteString}`);

    if (changed) {
      // Notify all TCP clients
      this.notifyAllClients(SSIP.COMMANDS.AMUT, createDecimalParams(this.getMuteNumeric()));

      // Emit LARA event
      if (this.laraEmitter) {
        this.laraEmitter('muteStatusChanged', muteString);
      }
    }

    return buildAnswerPacket(SSIP.COMMANDS.AMUT, createDecimalParams(this.getMuteNumeric()));
  }

  getAudioMute() {
    return buildAnswerPacket(SSIP.COMMANDS.AMUT, createDecimalParams(this.getMuteNumeric()));
  }

  // ============================================================================
  // Input Selection
  // ============================================================================

  setInput(params) {
    // Parse input type and number from parameters
    // Format: [type][0x00][0x00][0x00][number][0x00]...
    const type = params[0];
    const number = params[4];

    const typeNames = { 1: 'HDMI', 3: 'Composite', 4: 'Component', 5: 'Screen Mirroring' };
    const inputString = `${typeNames[type] || 'Unknown'} ${number}`;
    const changed = this.state.inputSource !== inputString;

    this.state.inputSource = inputString;
    this.log(`Input set to ${inputString}`);

    if (changed) {
      // Notify all TCP clients
      this.notifyAllClients(SSIP.COMMANDS.INPT, params);

      // Emit LARA event
      if (this.laraEmitter) {
        this.laraEmitter('inputChanged', inputString);
      }
    }

    return buildAnswerPacket(SSIP.COMMANDS.INPT, params.slice(0, 16));
  }

  getInput() {
    const input = this.getInputObject();
    const params = Buffer.alloc(16, 0);
    params[0] = input.type;
    params[4] = input.number;

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
      const changed = this.state.sceneMode !== scene;

      this.state.sceneMode = scene;
      this.log(`Scene set to ${scene}`);

      if (changed) {
        // Notify all TCP clients
        this.notifyAllClients(SSIP.COMMANDS.SCEN, params.slice(0, 16));

        // Emit LARA event
        if (this.laraEmitter) {
          this.laraEmitter('sceneChanged', `${scene}`);
        }
      }

      return buildAnswerPacket(SSIP.COMMANDS.SCEN, params.slice(0, 16));
    } else {
      this.log(`Invalid scene: ${scene}`);
      return buildErrorPacket(SSIP.COMMANDS.SCEN);
    }
  }

  getSceneSetting() {
    const params = Buffer.from(this.state.sceneMode.padEnd(16, '#'));
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
      '0000000000000098': () => this.setPowerStatus(this.getPowerNumeric() ? 0 : 1), // Power toggle
      '0000000000000016': () => this.setAudioVolume(Math.min(100, this.state.volumeLevel + 1)), // Vol+
      '0000000000000017': () => this.setAudioVolume(Math.max(0, this.state.volumeLevel - 1)),   // Vol-
      '0000000000000019': () => this.setAudioMute(this.getMuteNumeric() ? 0 : 1),               // Mute toggle
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

module.exports = { BraviaEmulator };
