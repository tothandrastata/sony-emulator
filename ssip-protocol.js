/**
 * Sony Bravia SSIP (Simple Single-wire IP) Protocol Implementation
 * Based on: https://pro-bravia.sony.net/develop/integrate/ssip/data-format/
 */

// SSIP Protocol Constants
export const SSIP = {
  PACKET_SIZE: 24,
  HEADER: Buffer.from([0x2A, 0x53]), // "*S"
  FOOTER: 0x0A, // Line feed

  MESSAGE_TYPES: {
    CONTROL: 0x43,   // 'C' - Client to Display (modify settings)
    ENQUIRY: 0x45,   // 'E' - Client to Display (request info)
    ANSWER: 0x41,    // 'A' - Display to Client (response)
    NOTIFY: 0x4E     // 'N' - Display to Client (unsolicited event)
  },

  COMMANDS: {
    POWR: 'POWR', // Power status
    VOLU: 'VOLU', // Audio volume
    AMUT: 'AMUT', // Audio mute
    INPT: 'INPT', // Input selection
    SCEN: 'SCEN', // Scene setting
    IRCC: 'IRCC'  // IR command
  },

  ANSWERS: {
    SUCCESS: Buffer.alloc(16, 0x00),
    ERROR: Buffer.from('FFFFFFFFFFFFFFFF')
  }
};

/**
 * Parse an SSIP packet from a buffer
 * @param {Buffer} buffer - Raw packet data (24 bytes)
 * @returns {Object|null} Parsed packet or null if invalid
 */
export function parsePacket(buffer) {
  if (!buffer || buffer.length !== SSIP.PACKET_SIZE) {
    return null;
  }

  // Validate header
  if (buffer[0] !== SSIP.HEADER[0] || buffer[1] !== SSIP.HEADER[1]) {
    return null;
  }

  // Validate footer
  if (buffer[23] !== SSIP.FOOTER) {
    return null;
  }

  const messageType = buffer[2];
  const command = buffer.slice(3, 7).toString('ascii');
  const parameters = buffer.slice(7, 23);

  return {
    messageType: String.fromCharCode(messageType),
    messageTypeByte: messageType,
    command,
    parameters,
    parametersHex: parameters.toString('hex'),
    parametersDecimal: parseParametersAsDecimal(parameters),
    raw: buffer
  };
}

/**
 * Build an SSIP packet
 * @param {string} messageType - 'C', 'E', 'A', or 'N'
 * @param {string} command - 4-character command code
 * @param {Buffer|string|number} parameters - 16 bytes of parameters
 * @returns {Buffer} Complete 24-byte SSIP packet
 */
export function buildPacket(messageType, command, parameters) {
  const packet = Buffer.alloc(SSIP.PACKET_SIZE);

  // Header
  SSIP.HEADER.copy(packet, 0);

  // Message type
  packet[2] = messageType.charCodeAt(0);

  // Command (4 bytes)
  Buffer.from(command.padEnd(4, ' ')).copy(packet, 3, 0, 4);

  // Parameters (16 bytes)
  let paramBuffer;
  if (Buffer.isBuffer(parameters)) {
    paramBuffer = parameters;
  } else if (typeof parameters === 'number') {
    paramBuffer = Buffer.from(parameters.toString().padStart(16, '0'));
  } else if (typeof parameters === 'string') {
    paramBuffer = Buffer.from(parameters.padEnd(16, '#'));
  } else {
    paramBuffer = Buffer.alloc(16, 0);
  }
  paramBuffer.copy(packet, 7, 0, 16);

  // Footer
  packet[23] = SSIP.FOOTER;

  return packet;
}

/**
 * Build an Answer packet with success status
 * @param {string} command - 4-character command code
 * @param {Buffer|string|number} value - Response value
 * @returns {Buffer} Answer packet
 */
export function buildAnswerPacket(command, value) {
  return buildPacket('A', command, value);
}

/**
 * Build an Answer packet with error status
 * @param {string} command - 4-character command code
 * @returns {Buffer} Error answer packet
 */
export function buildErrorPacket(command) {
  return buildPacket('A', command, SSIP.ANSWERS.ERROR);
}

/**
 * Build a Notify packet for unsolicited events
 * @param {string} command - 4-character command code
 * @param {Buffer|string|number} value - Event value
 * @returns {Buffer} Notify packet
 */
export function buildNotifyPacket(command, value) {
  return buildPacket('N', command, value);
}

/**
 * Parse parameters as decimal number (right-aligned, zero-padded)
 * @param {Buffer} params - 16-byte parameter buffer
 * @returns {number} Parsed decimal value
 */
function parseParametersAsDecimal(params) {
  const str = params.toString('ascii').trim();
  const num = parseInt(str, 10);
  return isNaN(num) ? 0 : num;
}

/**
 * Format a packet for debugging/logging
 * @param {Buffer} packet - SSIP packet
 * @returns {string} Formatted string
 */
export function formatPacket(packet) {
  const parsed = parsePacket(packet);
  if (!parsed) return 'Invalid packet';

  return `${parsed.messageType} ${parsed.command} ${parsed.parametersHex}`;
}

/**
 * Create a parameter buffer from decimal value
 * @param {number} value - Decimal value
 * @returns {Buffer} 16-byte parameter buffer
 */
export function createDecimalParams(value) {
  return Buffer.from(value.toString().padStart(16, '0'));
}

/**
 * Create a parameter buffer from hex string
 * @param {string} hex - Hex string (32 characters)
 * @returns {Buffer} 16-byte parameter buffer
 */
export function createHexParams(hex) {
  return Buffer.from(hex.padStart(32, '0'), 'hex');
}
