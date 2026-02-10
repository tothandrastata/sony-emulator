# Sony Bravia SSIP Emulator

A complete TCP server emulator for Sony Bravia Professional Displays using the SSIP (Simple Single-wire IP) protocol.

## Overview

This emulator implements the Sony Bravia SSIP protocol for testing and development purposes. It simulates a Sony Bravia Professional Display and responds to control commands exactly as a real device would.

**Protocol Specification:** [Sony Pro Bravia SSIP Documentation](https://pro-bravia.sony.net/develop/integrate/ssip/data-format/)

## Features

- Full SSIP protocol implementation (24-byte fixed packets)
- TCP server on port 20060 (standard SSIP port)
- Complete command support:
  - Power control (on/off)
  - Audio volume (0-100)
  - Audio mute (on/off)
  - Input selection (HDMI, Composite, Component, Screen Mirroring)
  - Scene settings (auto, auto24pSync, general)
  - IR commands
- Real-time state management
- Client notification system for state changes
- Multiple concurrent client support
- Debug logging

## Installation

```bash
npm install
```

## Usage

### Start the Emulator

```bash
npm start
```

Or with auto-reload during development:

```bash
npm run dev
```

The server will start on `0.0.0.0:20060` and display:

```
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
  Sony Bravia SSIP Emulator
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
  Listening on 0.0.0.0:20060
  Protocol: SSIP (Simple Single-wire IP)
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
```

### Run Test Client

```bash
node test-client.js
```

The test client demonstrates all supported commands.

## SSIP Protocol

### Packet Structure

Every SSIP packet is exactly **24 bytes**:

| Bytes | Description | Value |
|-------|-------------|-------|
| 0-1 | Header | `0x2A 0x53` ("*S") |
| 2 | Message Type | `C`, `E`, `A`, or `N` |
| 3-6 | Command | 4 ASCII characters (e.g., "POWR") |
| 7-22 | Parameters | 16 bytes of data |
| 23 | Footer | `0x0A` (line feed) |

### Message Types

| Type | Byte | Direction | Description |
|------|------|-----------|-------------|
| Control | `0x43` ('C') | Client → Display | Modify settings |
| Enquiry | `0x45` ('E') | Client → Display | Query information |
| Answer | `0x41` ('A') | Display → Client | Response to command |
| Notify | `0x4E` ('N') | Display → Client | Unsolicited event |

## Supported Commands

### Power Control (POWR)

**Query Power Status:**
```
*SE POWR 0000000000000000\n
```

**Set Power ON:**
```
*SC POWR 0000000000000001\n
```

**Set Power OFF:**
```
*SC POWR 0000000000000000\n
```

### Audio Volume (VOLU)

**Query Volume:**
```
*SE VOLU 0000000000000000\n
```

**Set Volume (0-100):**
```
*SC VOLU 0000000000000050\n  (sets volume to 50)
```

### Audio Mute (AMUT)

**Query Mute Status:**
```
*SE AMUT 0000000000000000\n
```

**Mute:**
```
*SC AMUT 0000000000000001\n
```

**Unmute:**
```
*SC AMUT 0000000000000000\n
```

### Input Selection (INPT)

**Set HDMI Input:**
```
*SC INPT 0100000001000000\n  (HDMI 1)
*SC INPT 0100000002000000\n  (HDMI 2)
```

Input type codes:
- `01` = HDMI
- `03` = Composite
- `04` = Component
- `05` = Screen Mirroring

### Scene Setting (SCEN)

**Set Scene:**
```
*SC SCEN auto############\n
*SC SCEN auto24pSync####\n
*SC SCEN general#########\n
```

Valid scenes: `auto`, `auto24pSync`, `general`

### IR Commands (IRCC)

**Send IR Command:**
```
*SC IRCC 0000000000000098\n  (Power toggle)
*SC IRCC 0000000000000016\n  (Volume up)
*SC IRCC 0000000000000017\n  (Volume down)
*SC IRCC 0000000000000019\n  (Mute toggle)
```

## Testing with Command Line Tools

### Using netcat

```bash
nc localhost 20060
```

Then type commands in hex or use printf:

```bash
printf '\x2a\x53\x45\x50\x4f\x57\x52\x30\x30\x30\x30\x30\x30\x30\x30\x30\x30\x30\x30\x30\x30\x30\x30\x0a' | nc localhost 20060
```

### Using telnet

```bash
telnet localhost 20060
```

## Programming Example

```javascript
import { SSIPClient } from './test-client.js';

const client = new SSIPClient('localhost', 20060);
await client.connect();

// Turn on display
client.setPowerOn();

// Set volume to 75
client.setVolume(75);

// Switch to HDMI 2
client.setInput(1, 2); // type=1 (HDMI), number=2

// Mute audio
client.setMute(true);

client.disconnect();
```

## API Reference

### BraviaEmulator Class

The main emulator class maintains device state and handles commands.

**Properties:**
- `state.power` - Power status (0=off, 1=on)
- `state.volume` - Volume level (0-100)
- `state.mute` - Mute status (0=unmuted, 1=muted)
- `state.input.type` - Input type (1=HDMI, 3=Composite, 4=Component, 5=Screen Mirroring)
- `state.input.number` - Input number (1, 2, 3, etc.)
- `state.scene` - Scene setting ('auto', 'auto24pSync', 'general')

**Methods:**
- `handlePacket(buffer)` - Process incoming SSIP packet
- `getState()` - Get current device state
- `reset()` - Reset to default state

### Protocol Functions

**ssip-protocol.js exports:**

- `parsePacket(buffer)` - Parse 24-byte SSIP packet
- `buildPacket(type, command, params)` - Build SSIP packet
- `buildAnswerPacket(command, value)` - Build answer response
- `buildErrorPacket(command)` - Build error response
- `buildNotifyPacket(command, value)` - Build notification
- `createDecimalParams(value)` - Create decimal parameter buffer
- `createHexParams(hex)` - Create hex parameter buffer

## File Structure

```
sony-emulator/
├── package.json          # Package configuration
├── index.js              # TCP server entry point
├── bravia-emulator.js    # Emulator logic and state
├── ssip-protocol.js      # SSIP protocol implementation
├── test-client.js        # Test client and examples
└── README.md             # This file
```

## Implementation Notes

1. **Fixed Packet Size**: All packets are exactly 24 bytes. Partial packets are buffered until complete.

2. **Notifications**: When state changes, the emulator broadcasts Notify packets to all connected clients.

3. **Multiple Clients**: The server supports multiple simultaneous client connections.

4. **Error Handling**: Invalid commands return Answer packets with all parameters set to `0xFF`.

5. **Parameter Encoding**:
   - Decimal values are right-aligned, zero-padded ASCII strings
   - Text values are left-aligned, `#`-padded
   - Binary values depend on the specific command

## Troubleshooting

**Port already in use:**
```
Error: Port 20060 is already in use
```
Solution: Stop any other SSIP servers or change the port in `index.js`

**Connection refused:**
- Ensure the emulator is running: `npm start`
- Check firewall settings
- Verify the correct port (20060)

**Invalid packets:**
- Ensure packets are exactly 24 bytes
- Verify header (`*S`) and footer (`\n`)
- Check command format (4 ASCII characters)

## Resources

- [Sony Pro Bravia SSIP Documentation](https://pro-bravia.sony.net/develop/integrate/ssip/data-format/)
- [SSIP Command Definitions](https://pro-bravia.sony.net/develop/integrate/ssip/command-definitions/)

## License

ISC
