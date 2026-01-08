# Sony SSIP Emulator - Deployment Guide

## Overview

This standalone Sony Bravia SSIP emulator provides both a native SSIP TCP server and a modern web control interface. The build system generates two deployment formats:

1. **Standalone** - Self-contained emulator with web UI for any platform
2. **LARA-ISC Module** - Driver package for LARA framework integration

## Build Status

✅ **Current Version**: 1.0.0
✅ **Build Output**: Both formats generated successfully
✅ **Runtime Status**: Tested and operational

---

## Package Information

### Standalone Package
**File**: `sony-ssip-emulator-standalone-v1.0.0.zip` (2.8 MB)

**Contents**:
- Complete Node.js application
- Pre-installed dependencies (78 packages)
- SSIP TCP server (port 20060)
- Web UI server (port 8082)
- Configuration files (.env)
- Startup scripts (Linux/Windows)
- Full documentation

**Use Case**: Run as an independent service on any Linux or Windows system for testing, development, or standalone control.

### LARA-ISC Module Package
**File**: `sony-ssip-emulator-lara-isc-v1.0.0.zip` (10 KB)

**Contents**:
- LARA driver files (app.js, bravia-emulator.js)
- Module descriptors (moduledescriptor.json, parameters.json)
- Event templates
- SSIP protocol implementation

**Use Case**: Deploy as a LARA device driver for integration into control systems.

---

## Deployment Instructions

### Option 1: Standalone Deployment

#### Prerequisites
- Node.js >= 16.0.0
- Network access to ports 20060 and 8082

#### Steps

1. **Extract the package**:
   ```bash
   unzip sony-ssip-emulator-standalone-v1.0.0.zip
   cd sony-ssip-emulator-standalone-v1.0.0
   ```

2. **Configure (optional)**:
   ```bash
   nano .env
   ```
   Edit settings:
   - `WEB_UI_PORT` - Web interface port (default: 8082)
   - `SSIP_PORT` - TCP server port (default: 20060)
   - `MODEL_NAME` - Device model name
   - `SERIAL_NUMBER` - Device serial number

3. **Start the emulator**:

   **Linux/macOS**:
   ```bash
   chmod +x start.sh
   ./start.sh
   ```

   **Windows**:
   ```bash
   node main.js
   ```

4. **Verify startup**:
   ```
   ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
     Sony Bravia SSIP Emulator
   ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
     Model: BRAVIA-X100
     Version: 1.0.0
   ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

   Initial Device State:
     Power:  Off
     Volume: 15
     Mute:   Unmuted
     Input:  HDMI 1
     Scene:  general

   SSIP TCP Server:
     Port: 20060
     Protocol: SSIP (Simple Single-wire IP)
     Network Addresses:
       localhost:20060
       127.0.0.1:20060
       [network-ip]:20060

   Web UI Server:
     Port: 8082
     URL: http://localhost:8082
   ```

5. **Access the emulator**:
   - **Web UI**: Open browser to `http://localhost:8082`
   - **SSIP TCP**: Connect via `nc localhost 20060` or `telnet localhost 20060`

#### Running as a Service (Linux)

Create a systemd service file:

```bash
sudo nano /etc/systemd/system/sony-emulator.service
```

```ini
[Unit]
Description=Sony Bravia SSIP Emulator
After=network.target

[Service]
Type=simple
User=your-username
WorkingDirectory=/path/to/sony-ssip-emulator-standalone-v1.0.0
ExecStart=/usr/bin/node main.js
Restart=on-failure
RestartSec=5s

[Install]
WantedBy=multi-user.target
```

Enable and start:
```bash
sudo systemctl enable sony-emulator
sudo systemctl start sony-emulator
sudo systemctl status sony-emulator
```

### Option 2: LARA-ISC Module Deployment

#### Prerequisites
- LARA framework installed and running
- LARA version 1.x compatible

#### Steps

1. **Import to LARA**:
   - Open LARA interface
   - Navigate to: Modules → Import Module
   - Select: `sony-ssip-emulator-lara-isc-v1.0.0.zip`
   - Click: Import

2. **Configure parameters**:
   - Port: 20060 (default SSIP port)
   - Host: 0.0.0.0 (listen on all interfaces)

3. **Deploy the driver**:
   - LARA will automatically start the embedded TCP server
   - No external processes required

4. **Verify in LARA**:
   - Check module status: Running
   - View state variables:
     - serverRunning: true
     - connectedClients: 0 (initially)
     - powerStatus: "Off"
     - volumeLevel: 15
     - muteStatus: "Unmuted"
     - inputSource: "HDMI 1"
     - sceneMode: "general"

5. **Use methods**:
   - `setPowerStatus("On")` / `setPowerStatus("Off")`
   - `setMuteStatus("Muted")` / `setMuteStatus("Unmuted")`

6. **Monitor events**:
   - powerChanged
   - volumeChanged
   - muteChanged
   - inputChanged
   - sceneChanged

---

## Network Configuration

### Firewall Rules

Allow incoming connections on:
- **Port 20060** (SSIP TCP) - for protocol clients
- **Port 8082** (HTTP) - for web interface

**Linux (ufw)**:
```bash
sudo ufw allow 20060/tcp
sudo ufw allow 8082/tcp
```

**Linux (iptables)**:
```bash
sudo iptables -A INPUT -p tcp --dport 20060 -j ACCEPT
sudo iptables -A INPUT -p tcp --dport 8082 -j ACCEPT
```

**Windows Firewall**:
```powershell
New-NetFirewallRule -DisplayName "Sony SSIP" -Direction Inbound -LocalPort 20060 -Protocol TCP -Action Allow
New-NetFirewallRule -DisplayName "Sony Web UI" -Direction Inbound -LocalPort 8082 -Protocol TCP -Action Allow
```

### Remote Access

If accessing from other machines on the network:

1. Find the server's IP address:
   ```bash
   # Linux/macOS
   ip addr show
   # or
   ifconfig

   # Windows
   ipconfig
   ```

2. Access from remote machine:
   - **Web UI**: `http://[server-ip]:8082`
   - **SSIP TCP**: `nc [server-ip] 20060`

---

## Testing

### Web Interface Test

1. Open browser to `http://localhost:8082`
2. Verify all controls are visible:
   - Power On/Off buttons
   - Volume slider (0-100)
   - Volume +/- buttons
   - Mute/Unmute buttons
   - Input selection dropdown
   - Scene mode buttons
3. Test power control:
   - Click "Power On" → Status should show "● On" (green)
   - Click "Power Off" → Status should show "● Off" (red)
4. Test volume:
   - Drag slider to 50 → Display shows "Volume: 50"
   - Click "+" → Volume increases by 5
   - Click "−" → Volume decreases by 5
5. Test mute:
   - Click "Mute" → Status shows "● Muted" (orange)
   - Click "Unmute" → Status shows "● Unmuted" (green)
6. Test input selection:
   - Select "Composite" from dropdown
   - Enter "2" in number field
   - Click "Set Input" → Display shows "Current: Composite 2"
7. Test scene mode:
   - Click "auto" → Display shows "Current: auto"

### SSIP TCP Test

```bash
# Connect to server
nc localhost 20060

# Send power query (press Enter after typing)
*SEPOWR################

# Expected response (power off):
*SAPOWR0000000000000000

# Send power on command
*SCPOWR0000000000000001

# Expected response:
*SAPOWR0000000000000001

# Send volume query
*SEVOLU################

# Expected response (volume 15):
*SAVOLU0000000000000015
```

### Integration Test

Test simultaneous control from both interfaces:

1. Open web UI in browser
2. Connect SSIP client: `nc localhost 20060`
3. Change power via web UI → Observe SSIP notification packet
4. Send volume command via SSIP → Web UI updates within 2 seconds

---

## Troubleshooting

### Port Already in Use

**Symptom**: `EADDRINUSE` error on startup

**Solution**:
```bash
# Find process using the port
# Linux/macOS
lsof -i :20060
lsof -i :8082

# Windows
netstat -ano | findstr :20060
netstat -ano | findstr :8082

# Kill the process or change ports in .env
```

### Web UI Not Loading

**Symptoms**: Browser shows "Unable to connect"

**Checks**:
1. Verify server is running: `ps aux | grep node`
2. Check logs for startup errors
3. Verify port in .env matches URL
4. Check firewall rules
5. Try localhost vs IP address

### SSIP Connection Refused

**Symptoms**: `nc` or `telnet` cannot connect

**Checks**:
1. Verify SSIP server started (check console output)
2. Confirm port 20060 in use: `netstat -an | grep 20060`
3. Test localhost vs network IP
4. Check firewall rules

### State Not Updating

**Symptom**: Web UI shows stale data

**Checks**:
1. Open browser console (F12) → Check for JavaScript errors
2. Verify `/api/state` endpoint: `curl http://localhost:8082/api/state`
3. Check network tab for failed requests
4. Ensure auto-refresh is working (2-second polling)

---

## Monitoring

### Log Files

The emulator outputs to stdout. Redirect to a log file:

```bash
# Linux/macOS
./start.sh > emulator.log 2>&1 &

# Follow logs
tail -f emulator.log
```

### Health Check Endpoints

**Status Check**:
```bash
curl http://localhost:8082/api/status
```

**State Check**:
```bash
curl http://localhost:8082/api/state
```

**Expected Response**:
```json
{
  "success": true,
  "state": {
    "powerStatus": "Off",
    "volumeLevel": 15,
    "muteStatus": "Unmuted",
    "inputSource": "HDMI 1",
    "sceneMode": "general"
  }
}
```

---

## Maintenance

### Updating Configuration

1. Stop the emulator (Ctrl+C or `systemctl stop sony-emulator`)
2. Edit `.env` file
3. Restart the emulator

### Backup

Important files to backup:
- `.env` - Configuration
- `emulator.log` - Logs (if redirected)

### Updating

1. Stop the current emulator
2. Extract new version to a different directory
3. Copy `.env` from old to new directory
4. Start new version
5. Test thoroughly before removing old version

---

## Security Considerations

### Network Exposure

- **Internal Network Only**: Recommended for testing/development
- **Public Access**: Not recommended without additional security layer
- **No Authentication**: Web UI and SSIP have no built-in authentication

### Recommendations

1. **Firewall**: Restrict access to trusted IPs
2. **Reverse Proxy**: Use nginx/Apache with authentication for web UI
3. **VPN**: Access via VPN for remote control
4. **Monitoring**: Log all connections and commands

---

## Performance

### Resource Usage

- **CPU**: ~1-2% idle, ~5-10% under load
- **Memory**: ~50-80 MB
- **Network**: Minimal (<1 Mbps typical)

### Capacity

- **SSIP Clients**: Supports multiple concurrent TCP connections
- **Web UI Users**: Supports many simultaneous browser connections
- **Polling Rate**: Web UI polls every 2 seconds (configurable)

### Optimization

To reduce web UI polling frequency, edit `web/static/index.html`:
```javascript
// Change from 2000ms to 5000ms (5 seconds)
setInterval(fetchState, 5000);
```

---

## Support

### Documentation
- README.md - Feature overview and API reference
- DEPLOYMENT.md - This file
- Inline code comments

### Logs
Include these in support requests:
- Startup output (first 50 lines)
- Error messages
- Browser console errors (F12 → Console)
- `curl http://localhost:8082/api/status` output

### Common Issues
See Troubleshooting section above.

---

## Version History

### v1.0.0 (2026-01-08)
- Initial release
- Dual server architecture (SSIP TCP + Web UI)
- Both standalone and LARA-ISC formats
- Complete SSIP protocol support
- Modern web interface with real-time updates
- Production build system
- Full documentation

---

## License

MIT

## Contact

Created for standalone Sony Bravia SSIP protocol emulation with web interface.
