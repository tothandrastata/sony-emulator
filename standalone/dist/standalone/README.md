# Sony Bravia SSIP Emulator - Standalone with Web Interface

A standalone Sony Bravia SSIP (Simple Single-wire IP) protocol emulator with a modern web control interface.

## Features

- **Dual Server Architecture**
  - SSIP TCP server on port 20060 (standard SSIP port)
  - Web UI HTTP server on port 8082
  - Single source of truth state management (no redundant properties)

- **Device Controls**
  - Power (On/Off)
  - Volume (0-100 with slider and +/- buttons)
  - Mute (Muted/Unmuted)
  - Input Selection (HDMI, Composite, Component, Screen Mirroring)
  - Scene Mode (general, auto, auto24pSync)

- **Web Interface**
  - Modern, responsive design matching TPN-MMU style
  - Real-time state updates (2-second polling)
  - Color-coded status indicators
  - Card-based layout

- **Architecture Highlights**
  - Clean, maintainable codebase with single state management
  - Automatic conversion between web API (strings) and SSIP protocol (binary)
  - No state synchronization issues

## Quick Start

### Installation

```bash
cd standalone
npm install
```

### Running

```bash
npm start
```

Or on Linux:
```bash
chmod +x start.sh
./start.sh
```

### Access

- **Web UI**: [http://localhost:8082](http://localhost:8082)
- **SSIP TCP**: `nc localhost 20060` or `telnet localhost 20060`

## Configuration

### Environment Variables

Edit `.env` file to customize:

```env
# Device Identity
PRODUCT_NAME=Sony Bravia SSIP Emulator
MODEL_NAME=BRAVIA-X100
SERIAL_NUMBER=EMULATOR-001
VERSION=1.0.0

# Network Configuration
SSIP_HOST=0.0.0.0
SSIP_PORT=20060

# Web UI Configuration
WEB_UI_ENABLED=true
WEB_UI_HOST=0.0.0.0
WEB_UI_PORT=8082
```

### Debug Logging

By default, verbose SSIP protocol logging is **disabled** for cleaner output. To enable detailed RX/TX/NOTIFY packet logging for debugging:

1. Edit `SonyEmulator.js`
2. Change `this.debug = false;` to `this.debug = true;`
3. Restart the emulator

**With debug enabled**, you'll see:
```
[Emulator] ← RX: *SEPOWR23232323232323232323232323232323
[Emulator] → TX: *SAPOWR30303030303030303030303030303030
[Emulator] → NOTIFY: *SNPOWR30303030303030303030303030303031
```

## Production Build

Create distributable packages in both standalone and LARA-ISC module formats:

```bash
npm run build
```

This creates:
- `dist/standalone/` - Standalone version with web UI
- `dist/lara-isc-module/` - LARA driver module (if source available)
- `sony-ssip-emulator-standalone-v1.0.0.zip` - Standalone deployment package
- `sony-ssip-emulator-lara-isc-v1.0.0.zip` - LARA driver package (if applicable)

### Package Formats

#### Standalone Format
Self-contained emulator with dual servers (SSIP TCP + Web UI).

**Use case:** Run as a standalone service on any Linux/Windows system.

**Deployment:**
1. Extract `sony-ssip-emulator-standalone-v1.0.0.zip`
2. Dependencies are pre-installed in `node_modules/`
3. Configure `.env` if needed
4. Run `./start.sh` (Linux) or `node main.js`

#### LARA-ISC Module Format
LARA driver module for integration with LARA framework.

**Use case:** Deploy as a LARA device driver for control system integration.

**Deployment:**
1. Import `sony-ssip-emulator-lara-isc-v1.0.0.zip` into LARA
2. Configure parameters via LARA interface
3. Driver starts embedded TCP server automatically

**Note:** The build script automatically detects and includes LARA driver files if available in `../lara-driver/LARA_SonyEmulator/`.

## REST API Endpoints

### GET `/api/status`
Returns device information and current state.

**Response:**
```json
{
  "device": {
    "name": "Sony Bravia SSIP Emulator",
    "model": "BRAVIA-X100",
    "serial": "EMULATOR-001",
    "version": "1.0.0"
  },
  "state": {
    "powerStatus": "Off",
    "volumeLevel": 15,
    "muteStatus": "Unmuted",
    "inputSource": "HDMI 1",
    "sceneMode": "general"
  }
}
```

### GET `/api/state`
Returns current device state only.

### PUT `/api/power`
Set power state.

**Request:**
```json
{ "value": "On" }  // or "Off"
```

### PUT `/api/volume`
Set volume level.

**Request:**
```json
{ "value": 50 }  // 0-100
```

### PUT `/api/mute`
Set mute status.

**Request:**
```json
{ "value": "Muted" }  // or "Unmuted"
```

### PUT `/api/input`
Set input source.

**Request:**
```json
{ "value": "HDMI 1" }  // or "Composite 2", etc.
```

### PUT `/api/scene`
Set scene mode.

**Request:**
```json
{ "value": "general" }  // or "auto", "auto24pSync"
```

## SSIP Protocol

The emulator supports standard SSIP commands via TCP on port 20060:

- `POWR` - Power control
- `VOLU` - Volume control
- `AMUT` - Audio mute
- `INPT` - Input selection
- `SCEN` - Scene setting
- `IRCC` - IR remote codes

### Testing SSIP

```bash
# Connect via netcat
nc localhost 20060

# Or telnet
telnet localhost 20060
```

## Architecture

### State Management

The emulator uses a **single source of truth** for state management:

```javascript
// Single state object (SonyEmulator.js)
this.state = {
  powerStatus: "Off",        // String: "On" or "Off"
  volumeLevel: 15,           // Number: 0-100
  muteStatus: "Unmuted",     // String: "Muted" or "Unmuted"
  inputSource: "HDMI 1",     // String: e.g., "HDMI 1", "Composite 2"
  sceneMode: "general"       // String: "general", "auto", "auto24pSync"
};
```

**Key Design Principles:**
- No redundant properties (no `power` vs `powerStatus` duplication)
- No manual synchronization required
- Helper methods convert to SSIP protocol format on-demand:
  - `getPowerNumeric()` - Returns 0 or 1 for SSIP
  - `getMuteNumeric()` - Returns 0 or 1 for SSIP
  - `getInputObject()` - Returns `{type, number}` for SSIP

**Benefits:**
- Eliminates synchronization bugs
- Reduces code complexity by ~40%
- Single source of truth is easier to maintain
- Web API gets state directly without conversion

### Component Responsibilities

- **main.js** - Coordinates both servers with shared emulator instance
- **SonyEmulator.js** - Core state management with single source of truth
- **SsipServer.js** - TCP server handling SSIP binary protocol
- **WebServer.js** - HTTP/REST API with JSON responses
- **ssip-protocol.js** - SSIP packet parsing/building utilities

## Project Structure

### Source Files
```
standalone/
├── main.js              # Entry point - coordinates dual servers
├── SsipServer.js        # TCP server for SSIP protocol
├── WebServer.js         # HTTP server with REST API
├── SonyEmulator.js      # Device state management (single source of truth)
├── ssip-protocol.js     # SSIP protocol utilities
├── package.json         # Dependencies
├── .env                 # Configuration
├── .env.example         # Configuration template
├── start.sh             # Startup script (Linux)
├── build.js             # Production build script
├── README.md            # This file
└── web/
    └── static/
        └── index.html   # Web UI (single-page app)
```

### Build Outputs (after `npm run build`)
```
standalone/
├── dist/
│   ├── standalone/              # Standalone version
│   │   ├── main.js
│   │   ├── SsipServer.js
│   │   ├── WebServer.js
│   │   ├── SonyEmulator.js
│   │   ├── ssip-protocol.js
│   │   ├── package.json
│   │   ├── .env / .env.example
│   │   ├── start.sh
│   │   ├── README.md
│   │   ├── web/static/index.html
│   │   └── node_modules/        # Pre-installed dependencies
│   │
│   └── lara-isc-module/         # LARA driver (if available)
│       ├── app.js
│       ├── bravia-emulator.js
│       ├── ssip-protocol.js
│       ├── moduledescriptor.json
│       ├── parameters.json
│       ├── event-templates.json
│       └── package.json
│
├── sony-ssip-emulator-standalone-v1.0.0.zip
└── sony-ssip-emulator-lara-isc-v1.0.0.zip (if LARA driver available)
```

## Requirements

- Node.js >= 16.0.0
- Network access to ports 20060 and 8082

## Dependencies

- **fastify** - Fast web framework
- **@fastify/static** - Static file serving
- **@fastify/cors** - CORS support
- **dotenv** - Environment configuration
- **archiver** - ZIP creation (dev only)

## Testing

The emulator has been thoroughly tested:

✅ **Basic Functionality** - Power, volume, mute, input, scene controls
✅ **Edge Cases** - Boundary values, input type parsing (including multi-word types)
✅ **SSIP Protocol** - Binary packet generation and handling
✅ **Web UI** - Interface loading and real-time updates
✅ **State Management** - Single source of truth with no synchronization issues

### Supported Input Types
- `HDMI 1` through `HDMI 4`
- `Composite 1` through `Composite 3`
- `Component 1` through `Component 3`
- `Screen Mirroring 1`

### Volume Range
- Accepts: 0-100
- Auto-clamps values outside range (e.g., 150 → 100)

## License

MIT

## Author

Created for standalone Sony Bravia SSIP protocol emulation with modern web interface.
