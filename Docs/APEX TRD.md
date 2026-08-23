# APEX TRD.md

# APEX: Racing Telemetry Analysis Tool
## Technical Requirements Document

---

## 1. Document Overview

### 1.1 Purpose
This Technical Requirements Document (TRD) defines the technical architecture, implementation details, and development specifications for APEX, a self-hosted racing telemetry analysis web application.

### 1.2 Scope
The document covers:
- System architecture and component design
- Data flow and processing pipelines
- UDP telemetry parsing and validation
- Analysis engine algorithms
- PDF generation specifications
- Performance requirements
- Security considerations
- Testing requirements

### 1.3 Technologies
- **Frontend**: HTML5, CSS3, Vanilla JavaScript (ES6+)
- **PDF Generation**: pdf-lib / jsPDF (client-side)
- **UDP Listener**: Node.js proxy server (local) OR WebSocket bridge
- **Data Storage**: Browser Memory / IndexedDB (optional)
- **Build Tool**: None (plain HTML/JS) OR Vite/Webpack for bundling
- **Distribution**: Single executable (Electron) OR downloadable archive

---

## 2. System Architecture

### 2.1 High-Level Architecture

```
┌─────────────────────────────────────────────────────────────────────────────┐
│                           Client Machine (User's PC)                        │
│                                                                              │
│  ┌──────────────────────────────────────────────────────────────────────┐   │
│  │                         Web Browser                                  │   │
│  │                                                                       │   │
│  │  ┌─────────────────┐    ┌─────────────────────────────────────────┐ │   │
│  │  │   UI Layer      │    │         Application Logic               │ │   │
│  │  │   (HTML/CSS)    │    │  ┌───────────────────────────────────┐  │ │   │
│  │  │                  │    │  │  Session Manager                 │  │ │   │
│  │  │  - Status Panel  │    │  │  - Recording state               │  │ │   │
│  │  │  - Controls      │    │  │  - Lap detection                 │  │ │   │
│  │  │  - Settings      │    │  │  - Timer management              │  │ │   │
│  │  │  - Status Bar    │    │  └───────────────────────────────────┘  │ │   │
│  │  └─────────────────┘    │  ┌───────────────────────────────────┐  │ │   │
│  │                         │  │  Data Buffer                     │  │ │   │
│  │  ┌─────────────────┐    │  │  - Circular buffer (memory)     │  │ │   │
│  │  │  WebSocket      │    │  │  - Lap segmentation             │  │ │   │
│  │  │  Client         │◄───│  │  - Sample storage               │  │ │   │
│  │  └─────────────────┘    │  └───────────────────────────────────┘  │ │   │
│  │                         │  ┌───────────────────────────────────┐  │ │   │
│  │  ┌─────────────────┐    │  │  Analysis Engine                 │  │ │   │
│  │  │  PDF Generator  │    │  │  - Corner detection              │  │ │   │
│  │  │  (pdf-lib)      │    │  │  - Metric calculation            │  │ │   │
│  │  └─────────────────┘    │  │  - Going Faster! rules engine    │  │ │   │
│  │                         │  └───────────────────────────────────┘  │ │   │
│  │                         │  ┌───────────────────────────────────┐  │ │   │
│  │                         │  │  Report Builder                   │  │ │   │
│  │                         │  │  - Data aggregation               │  │ │   │
│  │                         │  │  - Layout composition             │  │ │   │
│  │                         │  │  - PDF generation trigger         │  │ │   │
│  │                         │  └───────────────────────────────────┘  │ │   │
│  └──────────────────────────────────────────────────────────────────────┘   │
│                                    ▲                                        │
│                                    │                                        │
│  ┌────────────────────────────────┴──────────────────────────────────────┐   │
│  │                    UDP Proxy (Node.js / Electron)                    │   │
│  │  ┌────────────────────────────────────────────────────────────────┐ │   │
│  │  │  UDP Socket Listener (port 9999)                              │ │   │
│  │  │  - Bind to local network interface                            │ │   │
│  │  │  - Receive raw UDP packets                                    │ │   │
│  │  │  - Parse binary telemetry data                                │ │   │
│  │  │  - Forward to WebSocket server                               │ │   │
│  │  └────────────────────────────────────────────────────────────────┘ │   │
│  └──────────────────────────────────────────────────────────────────────┘   │
│                                    ▲                                        │
└────────────────────────────────────┼────────────────────────────────────────┘
                                     │
                                     │ UDP (Port 9999)
                                     │
┌────────────────────────────────────┴────────────────────────────────────────┐
│                          Local Network (LAN)                               │
│                                                                              │
│  ┌──────────────────────────────────────────────────────────────────────┐   │
│  │                    XBOX (Forza Motorsport 2023)                      │   │
│  │                                                                       │   │
│  │  ┌────────────────────────────────────────────────────────────────┐ │   │
│  │  │  Forza Telemetry Service                                       │ │   │
│  │  │  - Broadcasts UDP packets on port 9999                        │ │   │
│  │  │  - Contains FM23_UDP (1).md telemetry data                    │ │   │
│  │  └────────────────────────────────────────────────────────────────┘ │   │
│  └──────────────────────────────────────────────────────────────────────┘   │
│                                                                              │
└─────────────────────────────────────────────────────────────────────────────┘
```

### 2.2 Component Descriptions

| Component | Responsibility | Technology |
|-----------|---------------|------------|
| **UDP Proxy** | Bind to UDP port, receive telemetry packets, forward to WebSocket | Node.js / Electron |
| **WebSocket Client** | Receive data from proxy, forward to buffer | Browser WebSocket API |
| **Data Buffer** | Store telemetry samples in memory, segment by lap | JavaScript Array with indexes |
| **Session Manager** | Manage recording state, lap counting, timing | JavaScript State Machine |
| **Analysis Engine** | Process telemetry data for line, exit speed, braking | JavaScript Algorithms |
| **Report Builder** | Aggregate metrics, build PDF structure | JavaScript + pdf-lib |
| **PDF Generator** | Create PDF document for download | pdf-lib / jsPDF |

---

## 3. Data Specifications

### 3.1 UDP Telemetry Packet Structure

Based on the `FM23_UDP (1).md` specification, packets are received in binary format.

#### Packet Header (First 8 bytes)
```
Offset 0-3:    U32 TimestampMS
Offset 4-7:    S32 IsRaceOn
```

#### Sled Data (64 bytes)
```
Offset 8-11:   F32 EngineMaxRpm
Offset 12-15:  F32 EngineIdleRpm
Offset 16-19:  F32 CurrentEngineRpm
Offset 20-23:  F32 AccelerationX
Offset 24-27:  F32 AccelerationY
Offset 28-31:  F32 AccelerationZ
Offset 32-35:  F32 VelocityX
Offset 36-39:  F32 VelocityY
Offset 40-43:  F32 VelocityZ
Offset 44-47:  F32 AngularVelocityX
Offset 48-51:  F32 AngularVelocityY
Offset 52-55:  F32 AngularVelocityZ
Offset 56-59:  F32 Yaw
Offset 60-63:  F32 Pitch
Offset 64-67:  F32 Roll
Offset 68-71:  F32 NormalizedSuspensionTravelFrontLeft
Offset 72-75:  F32 NormalizedSuspensionTravelFrontRight
Offset 76-79:  F32 NormalizedSuspensionTravelRearLeft
Offset 80-83:  F32 NormalizedSuspensionTravelRearRight
Offset 84-87:  F32 TireSlipRatioFrontLeft
Offset 88-91:  F32 TireSlipRatioFrontRight
Offset 92-95:  F32 TireSlipRatioRearLeft
Offset 96-99:  F32 TireSlipRatioRearRight
Offset 100-103: F32 WheelRotationSpeedFrontLeft
Offset 104-107: F32 WheelRotationSpeedFrontRight
Offset 108-111: F32 WheelRotationSpeedRearLeft
Offset 112-115: F32 WheelRotationSpeedRearRight
Offset 116-119: S32 WheelOnRumbleStripFrontLeft
Offset 120-123: S32 WheelOnRumbleStripFrontRight
Offset 124-127: S32 WheelOnRumbleStripRearLeft
Offset 128-131: S32 WheelOnRumbleStripRearRight
Offset 132-135: F32 WheelInPuddleDepthFrontLeft
Offset 136-139: F32 WheelInPuddleDepthFrontRight
Offset 140-143: F32 WheelInPuddleDepthRearLeft
Offset 144-147: F32 WheelInPuddleDepthRearRight
Offset 148-151: F32 SurfaceRumbleFrontLeft
Offset 152-155: F32 SurfaceRumbleFrontRight
Offset 156-159: F32 SurfaceRumbleRearLeft
Offset 160-163: F32 SurfaceRumbleRearRight
Offset 164-167: F32 TireSlipAngleFrontLeft
Offset 168-171: F32 TireSlipAngleFrontRight
Offset 172-175: F32 TireSlipAngleRearLeft
Offset 176-179: F32 TireSlipAngleRearRight
Offset 180-183: F32 TireCombinedSlipFrontLeft
Offset 184-187: F32 TireCombinedSlipFrontRight
Offset 188-191: F32 TireCombinedSlipRearLeft
Offset 192-195: F32 TireCombinedSlipRearRight
Offset 196-199: F32 SuspensionTravelMetersFrontLeft
Offset 200-203: F32 SuspensionTravelMetersFrontRight
Offset 204-207: F32 SuspensionTravelMetersRearLeft
Offset 208-211: F32 SuspensionTravelMetersRearRight
Offset 212-215: S32 CarOrdinal
Offset 216-219: S32 CarClass
Offset 220-223: S32 CarPerformanceIndex
Offset 224-227: S32 DrivetrainType
Offset 228-231: S32 NumCylinders
```

#### Dash Data (Continued after Sled)
```
Offset 232-235: F32 PositionX
Offset 236-239: F32 PositionY
Offset 240-243: F32 PositionZ
Offset 244-247: F32 Speed
Offset 248-251: F32 Power
Offset 252-255: F32 Torque
Offset 256-259: F32 TireTempFrontLeft
Offset 260-263: F32 TireTempFrontRight
Offset 264-267: F32 TireTempRearLeft
Offset 268-271: F32 TireTempRearRight
Offset 272-275: F32 Boost
Offset 276-279: F32 Fuel
Offset 280-283: F32 DistanceTraveled
Offset 284-287: F32 BestLap
Offset 288-291: F32 LastLap
Offset 292-295: F32 CurrentLap
Offset 296-299: F32 CurrentRaceTime
Offset 300-301: U16 LapNumber
Offset 302:     U8 RacePosition
Offset 303:     U8 Accel
Offset 304:     U8 Brake
Offset 305:     U8 Clutch
Offset 306:     U8 HandBrake
Offset 307:     U8 Gear
Offset 308:     S8 Steer
Offset 309:     S8 NormalizedDrivingLine
Offset 310:     S8 NormalizedAIBrakeDifference
Offset 311-314: F32 TireWearFrontLeft
Offset 315-318: F32 TireWearFrontRight
Offset 319-322: F32 TireWearRearLeft
Offset 323-326: F32 TireWearRearRight
Offset 327-330: S32 TrackOrdinal
```

**Total Packet Size**: 331 bytes

### 3.2 Data Validation

```javascript
function validateTelemetryPacket(data) {
    // Check minimum packet size
    if (data.byteLength < 331) {
        return { valid: false, error: 'Packet too small' };
    }
    
    // Validate header fields
    const view = new DataView(data);
    const isRaceOn = view.getInt32(4, true);
    const timestamp = view.getUint32(0, true);
    
    // Check IsRaceOn is 0 or 1
    if (isRaceOn !== 0 && isRaceOn !== 1) {
        return { valid: false, error: 'Invalid IsRaceOn value' };
    }
    
    // Check timestamp is reasonable
    if (timestamp > 3600000) { // > 1 hour
        return { valid: false, error: 'Timestamp out of range' };
    }
    
    return { valid: true };
}
```

### 3.3 Data Model

```javascript
// Single sample
class TelemetrySample {
    constructor() {
        this.timestamp = 0;
        this.isRaceOn = 0;
        this.engineRpm = 0;
        this.speed = 0;
        this.position = { x: 0, y: 0, z: 0 };
        this.acceleration = { x: 0, y: 0, z: 0 };
        this.velocity = { x: 0, y: 0, z: 0 };
        this.angularVelocity = { x: 0, y: 0, z: 0 };
        this.orientation = { yaw: 0, pitch: 0, roll: 0 };
        this.throttle = 0;
        this.brake = 0;
        this.steering = 0;
        this.gear = 0;
        this.lapNumber = 0;
        this.racePosition = 0;
    }
}

// Complete session
class SessionData {
    constructor() {
        this.sessionName = '';
        this.startTime = null;
        this.endTime = null;
        this.carId = 0;
        this.trackId = 0;
        this.samples = [];
        this.laps = [];
        this.bestLapIndex = -1;
        this.corners = [];
    }
}

// Lap data
class LapData {
    constructor(index) {
        this.index = index;
        this.startSampleIndex = 0;
        this.endSampleIndex = 0;
        this.lapTime = 0;
        this.speedProfile = [];
        this.corners = [];
        this.maxSpeed = 0;
        this.minSpeed = 0;
        this.avgSpeed = 0;
    }
}

// Corner data
class CornerData {
    constructor() {
        this.number = 0;
        this.type = 'unknown'; // left, right, hairpin
        this.entrySpeed = 0;
        this.apexSpeed = 0;
        this.exitSpeed = 0;
        this.entryBrakePressure = 0;
        this.apexBrakePressure = 0;
        this.steeringAngle = 0;
        this.throttleApplicationPoint = 0;
        this.minRPM = 0;
        this.exitRPM = 0;
        this.gearUsed = 0;
        this.trailBrakingOverlap = 0;
        this.earlyApexDetected = false;
        this.lateApexDetected = false;
        this.wheelspinDetected = false;
    }
}
```

---

## 4. UDP Listener Implementation

### 4.1 Option 1: Node.js Proxy Server

**File**: `udp-proxy.js`

```javascript
const dgram = require('dgram');
const WebSocket = require('ws');
const server = dgram.createSocket('udp4');

// Configuration
const UDP_PORT = 9999;
const WS_PORT = 8080;

// Create WebSocket server
const wss = new WebSocket.Server({ port: WS_PORT });
let clients = [];

wss.on('connection', (ws) => {
    console.log('WebSocket client connected');
    clients.push(ws);
    
    ws.on('close', () => {
        clients = clients.filter(c => c !== ws);
    });
});

// UDP listener
server.on('message', (msg, rinfo) => {
    // Validate packet
    if (msg.length < 331) return;
    
    // Convert to base64 or binary for WebSocket transmission
    const buffer = msg.toString('base64');
    
    // Broadcast to all connected WebSocket clients
    clients.forEach(client => {
        if (client.readyState === WebSocket.OPEN) {
            client.send(buffer);
        }
    });
});

server.on('listening', () => {
    const address = server.address();
    console.log(`UDP proxy listening on ${address.address}:${address.port}`);
});

server.bind(UDP_PORT);
```

### 4.2 Option 2: Electron Integrated Application

**File**: `main.js`

```javascript
const { app, BrowserWindow } = require('electron');
const { WebSocketServer } = require('ws');
const dgram = require('dgram');

let mainWindow;
let udpServer;
let wsServer;

function createWindow() {
    mainWindow = new BrowserWindow({
        width: 1280,
        height: 720,
        webPreferences: {
            nodeIntegration: true,
            contextIsolation: false
        }
    });
    
    mainWindow.loadFile('index.html');
    
    // Start services
    startUDPServer();
    startWebSocketServer();
}

function startUDPServer() {
    udpServer = dgram.createSocket('udp4');
    const UDP_PORT = 9999;
    
    udpServer.on('message', (msg, rinfo) => {
        // Broadcast to WebSocket clients
        if (wsServer) {
            const buffer = msg.toString('base64');
            wsServer.clients.forEach(client => {
                if (client.readyState === 1) {
                    client.send(buffer);
                }
            });
        }
    });
    
    udpServer.bind(UDP_PORT);
}

function startWebSocketServer() {
    wsServer = new WebSocketServer({ port: 8080 });
}

app.whenReady().then(createWindow);
```

### 4.3 Option 3: Browser-Only with WebUSB/WebSerial (Future)

```javascript
// Note: This requires the user to have a physical USB-to-UDP adapter
// Not recommended for initial implementation
async function connectUSB() {
    try {
        const device = await navigator.usb.requestDevice({ 
            filters: [{ vendorId: 0x1234 }] 
        });
        await device.open();
        // ... read data from USB device
    } catch (error) {
        console.error('USB connection failed:', error);
    }
}
```

**Decision**: Option 1 (Node.js proxy) is recommended for MVP due to simplicity and cross-platform compatibility.

---

## 5. Analysis Engine Implementation

### 5.1 Lap Detection

```javascript
class LapDetector {
    constructor() {
        this.samples = [];
        this.laps = [];
        this.currentLap = [];
        this.isRaceOn = false;
        this.lastPosition = null;
        this.startFinishDetected = false;
        this.startFinishPosition = null;
        this.lapStartIndex = 0;
    }
    
    processSample(sample) {
        // Track position for start/finish line detection
        if (this.lastPosition) {
            const dx = sample.position.x - this.lastPosition.x;
            const dz = sample.position.z - this.lastPosition.z;
            const distance = Math.sqrt(dx*dx + dz*dz);
            
            // Detect start/finish line crossing using position data
            if (this.startFinishPosition) {
                const sfDistance = this.calculateDistanceToStartFinish(sample.position);
                if (sfDistance < 20 && this.startFinishDetected === false) {
                    this.startFinishDetected = true;
                    // Mark lap boundary
                    this.lapComplete(sample);
                }
                if (sfDistance > 50) {
                    this.startFinishDetected = false;
                }
            } else {
                // Identify start/finish position from repeated position patterns
                this.identifyStartFinish(sample);
            }
        }
        
        this.lastPosition = {...sample.position};
        
        // Add to current lap
        this.currentLap.push(sample);
    }
    
    identifyStartFinish(sample) {
        // Accumulate position data and identify most common positions
        // This is a simplified algorithm - production version should be more robust
        // Store reference position when lapNumber changes from 0 to 1
        if (sample.lapNumber === 1 && this.laps.length === 0) {
            this.startFinishPosition = {...sample.position};
        }
    }
    
    lapComplete(sample) {
        if (this.currentLap.length > 10) { // Minimum samples for valid lap
            this.laps.push({
                index: this.laps.length,
                samples: [...this.currentLap],
                startTime: this.currentLap[0].timestamp,
                endTime: this.currentLap[this.currentLap.length - 1].timestamp,
                maxSpeed: Math.max(...this.currentLap.map(s => s.speed))
            });
        }
        this.currentLap = [];
        this.lapStartIndex = this.samples.length;
    }
}
```

### 5.2 Corner Detection

```javascript
class CornerDetector {
    constructor() {
        this.minSpeedThreshold = 0.8; // Minimum speed to consider corner
        this.minSteeringAngle = 5; // degrees
        this.minLateralG = 0.3;
    }
    
    detectCorners(lapData) {
        const corners = [];
        const samples = lapData.samples;
        const speedTrace = samples.map(s => s.speed);
        const steeringTrace = samples.map(s => s.steering);
        const lateralGTrace = samples.map(s => s.acceleration.x);
        
        // Find minima in speed trace (potential corners)
        for (let i = 5; i < samples.length - 5; i++) {
            const isLocalMinimum = 
                speedTrace[i] < speedTrace[i-1] &&
                speedTrace[i] < speedTrace[i+1] &&
                speedTrace[i] < speedTrace[i-2] &&
                speedTrace[i] < speedTrace[i+2];
            
            if (isLocalMinimum) {
                // Verify it's a real corner (not just a slow section)
                const steeringAtMin = Math.abs(steeringTrace[i]);
                const lateralGAtMin = Math.abs(lateralGTrace[i]);
                
                if (steeringAtMin > this.minSteeringAngle || 
                    lateralGAtMin > this.minLateralG) {
                    corners.push(this.extractCornerData(samples, i));
                }
            }
        }
        
        // Filter out duplicate corner detections (merge close corners)
        return this.mergeCorners(corners);
    }
    
    extractCornerData(samples, apexIndex) {
        const corner = new CornerData();
        const apexSample = samples[apexIndex];
        
        // Identify corner type based on steering and lateral G
        if (Math.abs(apexSample.orientation.yaw) > 20) {
            corner.type = 'hairpin';
        } else if (apexSample.steering > 0) {
            corner.type = 'right';
        } else {
            corner.type = 'left';
        }
        
        // Find entry (brake point)
        let entryIndex = apexIndex;
        for (let i = apexIndex; i >= 0; i--) {
            if (samples[i].brake > 20) {
                entryIndex = i;
                break;
            }
        }
        
        // Find exit (steering back to straight)
        let exitIndex = apexIndex;
        for (let i = apexIndex; i < samples.length; i++) {
            if (Math.abs(samples[i].steering) < 10) {
                exitIndex = i;
                break;
            }
        }
        
        // Find throttle application point (TAP)
        let tapIndex = apexIndex;
        for (let i = apexIndex; i < samples.length; i++) {
            if (samples[i].throttle > 50) {
                tapIndex = i;
                break;
            }
        }
        
        // Calculate metrics
        corner.entrySpeed = samples[entryIndex].speed;
        corner.apexSpeed = samples[apexIndex].speed;
        corner.exitSpeed = samples[exitIndex].speed;
        corner.entryBrakePressure = samples[entryIndex].brake;
        corner.apexBrakePressure = samples[apexIndex].brake;
        corner.steeringAngle = samples[apexIndex].steering;
        corner.gearUsed = samples[apexIndex].gear;
        corner.minRPM = Math.min(...samples.slice(entryIndex, exitIndex).map(s => s.engineRpm));
        corner.exitRPM = samples[exitIndex].engineRpm;
        
        // Throttle application delta (distance from apex to TAP)
        const positionData = samples.slice(apexIndex, tapIndex);
        let distance = 0;
        for (let i = 1; i < positionData.length; i++) {
            const dx = positionData[i].position.x - positionData[i-1].position.x;
            const dz = positionData[i].position.z - positionData[i-1].position.z;
            distance += Math.sqrt(dx*dx + dz*dz);
        }
        corner.throttleApplicationPoint = distance;
        
        // Trail-braking overlap
        let trailBrakeCount = 0;
        for (let i = entryIndex; i <= apexIndex; i++) {
            if (samples[i].brake > 10 && Math.abs(samples[i].steering) > 5) {
                trailBrakeCount++;
            }
        }
        corner.trailBrakingOverlap = trailBrakeCount / (apexIndex - entryIndex + 1);
        
        // Early apex detection (steering correction post-apex)
        let postApexSteeringIncrease = 0;
        for (let i = apexIndex; i < Math.min(apexIndex + 10, samples.length); i++) {
            if (Math.abs(samples[i].steering) > Math.abs(samples[apexIndex].steering) + 5) {
                postApexSteeringIncrease++;
            }
        }
        corner.earlyApexDetected = postApexSteeringIncrease > 3;
        
        // Late apex detection (unused track at exit)
        // Check if car is close to track edge at exit
        // Simplified: check if steering is unwound early
        let steeringUnwoundEarly = true;
        for (let i = exitIndex - 5; i < exitIndex; i++) {
            if (Math.abs(samples[i].steering) > 20) {
                steeringUnwoundEarly = false;
                break;
            }
        }
        corner.lateApexDetected = steeringUnwoundEarly && corner.exitSpeed > corner.apexSpeed * 1.3;
        
        // Wheelspin detection
        corner.wheelspinDetected = this.detectWheelspin(samples, apexIndex, exitIndex);
        
        corner.number = this.corners ? this.corners.length + 1 : 1;
        return corner;
    }
    
    detectWheelspin(samples, start, end) {
        let wheelspinCount = 0;
        for (let i = start; i < end; i++) {
            const slipRatio = samples[i].tireSlipRatio || 0;
            if (slipRatio > 1.0) {
                wheelspinCount++;
            }
        }
        return wheelspinCount > 3;
    }
    
    mergeCorners(corners) {
        const merged = [];
        let current = null;
        
        for (const corner of corners) {
            if (!current) {
                current = corner;
                continue;
            }
            
            // If corners are close (within 100 samples), merge them
            if (corner.apexIndex - current.apexIndex < 100) {
                // Keep the one with lower speed (more significant)
                if (corner.apexSpeed < current.apexSpeed) {
                    current = corner;
                }
            } else {
                merged.push(current);
                current = corner;
            }
        }
        
        if (current) {
            merged.push(current);
        }
        
        return merged;
    }
}
```

### 5.3 Going Faster! Rules Engine

```javascript
class GoingFasterRules {
    constructor() {
        this.rules = [
            {
                id: 'R-001',
                name: 'Throttle Application Late',
                condition: (corner) => corner.throttleApplicationPoint > 15,
                severity: 'high',
                message: 'Apply throttle earlier and more smoothly at the apex.',
                detail: 'Throttle is applied %.1f ft after the apex. Aim for 0-5 ft.'
            },
            {
                id: 'R-002',
                name: 'Throttle Application Early',
                condition: (corner) => corner.throttleApplicationPoint < -15,
                severity: 'medium',
                message: 'You\'re getting to the throttle too early - you may be inducing understeer.',
                detail: 'Throttle is applied %.1f ft before the apex. This can cause understeer.'
            },
            {
                id: 'R-003',
                name: 'Early Apex Detected',
                condition: (corner) => corner.earlyApexDetected,
                severity: 'high',
                message: 'Suspect early apex. Try turning in later to avoid mid-corner corrections.',
                detail: 'Steering correction detected after apex. This indicates an early turn-in.'
            },
            {
                id: 'R-004',
                name: 'Late Apex Detected',
                condition: (corner) => corner.lateApexDetected,
                severity: 'medium',
                message: 'Late apex. Move turn-in and apex earlier to maximize exit speed.',
                detail: 'Unused track detected at exit. You can carry more speed through the corner.'
            },
            {
                id: 'R-005',
                name: 'No Trail-Braking',
                condition: (corner) => corner.trailBrakingOverlap < 0.2,
                severity: 'medium',
                message: 'Little to no trail-braking. Carry brakes past turn-in to improve rotation.',
                detail: 'Trail-braking overlap is %.0f%%. Aim for 30-50%%.'
            },
            {
                id: 'R-006',
                name: 'Excessive Wheelspin',
                condition: (corner) => corner.wheelspinDetected,
                severity: 'medium',
                message: 'Excessive wheelspin detected. Be more progressive with the throttle.',
                detail: 'Wheelspin on exit indicates too aggressive throttle application.'
            },
            {
                id: 'R-007',
                name: 'Low Exit RPM',
                condition: (corner) => corner.exitRPM < corner.maxRPM * 0.6,
                severity: 'medium',
                message: 'Gear too high. Downshift one gear for better corner exit.',
                detail: 'Exit RPM is %.0f RPM. Powerband is around %.0f RPM.'
            },
            {
                id: 'R-008',
                name: 'High Exit RPM',
                condition: (corner) => corner.exitRPM > corner.maxRPM * 0.95,
                severity: 'medium',
                message: 'Gear too low. Upshift or use higher gear to avoid hitting limiter.',
                detail: 'Exit RPM is near redline (%.0f RPM). Consider shifting up.'
            },
            {
                id: 'R-009',
                name: 'Low Entry Speed',
                condition: (corner) => corner.entrySpeed < corner.avgEntrySpeed * 0.85,
                severity: 'medium',
                message: 'Braking too early. Move brake point closer to the corner.',
                detail: 'Entry speed is %.1f mph. Aim for %.1f mph.'
            },
            {
                id: 'R-010',
                name: 'High Entry Speed',
                condition: (corner) => corner.entrySpeed > corner.avgEntrySpeed * 1.15,
                severity: 'high',
                message: 'Entry speed too high. Brake earlier to ensure proper turn-in.',
                detail: 'Entry speed is %.1f mph. Aim for %.1f mph for consistent cornering.'
            }
        ];
    }
    
    analyzeCorner(corner, context) {
        const triggered = [];
        
        for (const rule of this.rules) {
            let conditionMet = false;
            
            try {
                conditionMet = rule.condition(corner);
            } catch (e) {
                continue;
            }
            
            if (conditionMet) {
                // Format message with corner data
                const message = this.formatMessage(rule.message, corner);
                const detail = this.formatMessage(rule.detail, corner);
                triggered.push({
                    id: rule.id,
                    name: rule.name,
                    severity: rule.severity,
                    message: message,
                    detail: detail
                });
            }
        }
        
        return triggered;
    }
    
    formatMessage(template, corner) {
        return template
            .replace('%.1f', (corner.throttleApplicationPoint || 0).toFixed(1))
            .replace('%.0f', (corner.exitRPM || 0).toFixed(0))
            .replace('%.1f', (corner.entrySpeed || 0).toFixed(1))
            .replace('%.1f', (corner.avgEntrySpeed || 0).toFixed(1))
            .replace('%.0f', (corner.trailBrakingOverlap * 100 || 0).toFixed(0))
            .replace(/\$(\w+)/g, (match, key) => {
                return corner[key] !== undefined ? String(corner[key]) : match;
            });
    }
}
```

---

## 6. PDF Generation Implementation

### 6.1 Using pdf-lib

```javascript
import { PDFDocument, rgb, StandardFonts } from 'pdf-lib';

class PDFReportGenerator {
    constructor() {
        this.doc = null;
        this.page = null;
        this.font = null;
        this.pageWidth = 595; // A4 width in points
        this.pageHeight = 842; // A4 height in points
        this.currentY = 800;
        this.margin = 50;
    }
    
    async generate(sessionData, analysisResults) {
        this.doc = await PDFDocument.create();
        this.font = await this.doc.embedFont(StandardFonts.Helvetica);
        this.page = this.doc.addPage([this.pageWidth, this.pageHeight]);
        this.currentY = this.pageHeight - this.margin;
        
        // Add header
        this.addHeader(sessionData);
        
        // Add summary section
        this.addSummary(sessionData, analysisResults);
        
        // Add track map section (placeholder)
        this.addTrackMapPlaceholder();
        
        // Add corner-by-corner analysis
        this.addCornerAnalysis(analysisResults);
        
        // Add braking analysis
        this.addBrakingAnalysis(analysisResults);
        
        // Add tire management analysis
        this.addTireAnalysis(analysisResults);
        
        // Add footer
        this.addFooter();
        
        // Generate PDF bytes
        const pdfBytes = await this.doc.save();
        return pdfBytes;
    }
    
    addHeader(sessionData) {
        const title = 'APEX Telemetry Report';
        this.page.drawText(title, {
            x: this.margin,
            y: this.currentY,
            size: 24,
            font: this.font,
            color: rgb(0.2, 0.2, 0.2),
        });
        this.currentY -= 30;
        
        const subtitle = `Session: ${sessionData.sessionName || 'Unnamed Session'}`;
        this.page.drawText(subtitle, {
            x: this.margin,
            y: this.currentY,
            size: 12,
            font: this.font,
            color: rgb(0.3, 0.3, 0.3),
        });
        this.currentY -= 20;
        
        // Session details
        const details = [
            `Date: ${new Date().toISOString().split('T')[0]}`,
            `Laps: ${sessionData.laps.length}`,
            `Best Lap: ${sessionData.bestLapTime || 'N/A'}`,
            `Car ID: ${sessionData.carId || 'Unknown'}`
        ];
        
        const detailLine = details.join('  |  ');
        this.page.drawText(detailLine, {
            x: this.margin,
            y: this.currentY,
            size: 10,
            font: this.font,
            color: rgb(0.4, 0.4, 0.4),
        });
        this.currentY -= 30;
        
        // Separator line
        this.page.drawLine({
            start: { x: this.margin, y: this.currentY + 5 },
            end: { x: this.pageWidth - this.margin, y: this.currentY + 5 },
            thickness: 1,
            color: rgb(0.8, 0.8, 0.8),
        });
        this.currentY -= 20;
    }
    
    addSummary(sessionData, analysisResults) {
        this.page.drawText('SECTION 1: OVERALL SUMMARY', {
            x: this.margin,
            y: this.currentY,
            size: 14,
            font: this.font,
            color: rgb(0.2, 0.2, 0.2),
        });
        this.currentY -= 20;
        
        const summaryData = [
            `Total Laps: ${sessionData.laps.length}`,
            `Best Lap: ${this.formatTime(sessionData.bestLapTime || 0)}`,
            `Average Lap: ${this.formatTime(sessionData.avgLapTime || 0)}`,
            `Top Speed: ${(sessionData.maxSpeed * 2.237).toFixed(1)} mph`,
            `Max Lateral G: ${analysisResults.maxLateralG ? analysisResults.maxLateralG.toFixed(2) : 'N/A'}`
        ];
        
        summaryData.forEach((line, index) => {
            this.page.drawText(line, {
                x: this.margin + 10,
                y: this.currentY - (index * 18),
                size: 10,
                font: this.font,
                color: rgb(0.2, 0.2, 0.2),
            });
        });
        this.currentY -= summaryData.length * 18 + 10;
        
        // Check for new page
        if (this.currentY < 100) {
            this.addNewPage();
        }
    }
    
    addCornerAnalysis(analysisResults) {
        // Check for new page
        if (this.currentY < 200) {
            this.addNewPage();
        }
        
        this.page.drawText('SECTION 2: CORNER-BY-CORNER ANALYSIS', {
            x: this.margin,
            y: this.currentY,
            size: 14,
            font: this.font,
            color: rgb(0.2, 0.2, 0.2),
        });
        this.currentY -= 20;
        
        const corners = analysisResults.corners || [];
        
        for (const corner of corners) {
            // Check for new page
            if (this.currentY < 150) {
                this.addNewPage();
            }
            
            // Corner header
            this.page.drawText(`Turn ${corner.number} (${corner.type})`, {
                x: this.margin,
                y: this.currentY,
                size: 12,
                font: this.font,
                color: rgb(0.2, 0.2, 0.2),
            });
            this.currentY -= 16;
            
            // Metrics table
            const metrics = [
                ['Entry Speed', `${corner.entrySpeed.toFixed(1)} mph`],
                ['Apex Speed', `${corner.apexSpeed.toFixed(1)} mph`],
                ['Exit Speed', `${corner.exitSpeed.toFixed(1)} mph`],
                ['Gear Used', corner.gearUsed || 'N/A'],
                ['Trail-Braking', `${(corner.trailBrakingOverlap * 100 || 0).toFixed(0)}%`]
            ];
            
            metrics.forEach(([label, value], index) => {
                const x = this.margin + (index % 2 === 0 ? 0 : 120);
                const yOffset = Math.floor(index / 2) * 16;
                
                this.page.drawText(`${label}: ${value}`, {
                    x: x + 10,
                    y: this.currentY - yOffset,
                    size: 9,
                    font: this.font,
                    color: rgb(0.2, 0.2, 0.2),
                });
            });
            this.currentY -= Math.ceil(metrics.length / 2) * 16 + 5;
            
            // Feedback
            const feedback = analysisResults.feedback[corner.number] || [];
            if (feedback.length > 0) {
                const severityColors = {
                    high: rgb(0.9, 0.1, 0.1),
                    medium: rgb(0.9, 0.6, 0.1),
                    low: rgb(0.1, 0.6, 0.1)
                };
                
                feedback.forEach((fb, index) => {
                    const color = severityColors[fb.severity] || rgb(0.3, 0.3, 0.3);
                    this.page.drawText(`⚠ ${fb.message}`, {
                        x: this.margin + 10,
                        y: this.currentY - (index * 14),
                        size: 9,
                        font: this.font,
                        color: color,
                    });
                });
                this.currentY -= feedback.length * 14 + 5;
            }
            
            // Recommendation
            if (feedback.length > 0) {
                const topIssue = feedback[0];
                this.page.drawText(`RECOMMENDATION: ${topIssue.message}`, {
                    x: this.margin + 10,
                    y: this.currentY,
                    size: 9,
                    font: this.font,
                    color: rgb(0.1, 0.1, 0.9),
                });
                this.currentY -= 18;
            }
            
            // Separator
            this.currentY -= 5;
            this.page.drawLine({
                start: { x: this.margin, y: this.currentY },
                end: { x: this.pageWidth - this.margin, y: this.currentY },
                thickness: 0.5,
                color: rgb(0.9, 0.9, 0.9),
            });
            this.currentY -= 10;
        }
    }
    
    addNewPage() {
        this.page = this.doc.addPage([this.pageWidth, this.pageHeight]);
        this.currentY = this.pageHeight - this.margin;
    }
    
    addFooter() {
        // Check for new page
        if (this.currentY < 100) {
            this.addNewPage();
        }
        
        const footer = 'Report generated by APEX v1.0.0 | Data source: Forza Motorsport 2023 UDP Telemetry | Analysis: "Going Faster!" - Skip Barber Racing School';
        this.page.drawText(footer, {
            x: this.margin,
            y: this.margin,
            size: 8,
            font: this.font,
            color: rgb(0.5, 0.5, 0.5),
        });
    }
    
    formatTime(seconds) {
        if (!seconds) return 'N/A';
        const minutes = Math.floor(seconds / 60);
        const secs = seconds % 60;
        return `${minutes}:${secs.toFixed(3).padStart(6, '0')}`;
    }
    
    async downloadPDF(pdfBytes, filename = null) {
        const name = filename || `apex-report-${new Date().toISOString().replace(/[:.]/g, '-')}.pdf`;
        const blob = new Blob([pdfBytes], { type: 'application/pdf' });
        const url = URL.createObjectURL(blob);
        const link = document.createElement('a');
        link.href = url;
        link.download = name;
        document.body.appendChild(link);
        link.click();
        document.body.removeChild(link);
        URL.revokeObjectURL(url);
    }
}
```

---

## 7. UI Implementation

### 7.1 HTML Structure

```html
<!DOCTYPE html>
<html lang="en">
<head>
    <meta charset="UTF-8">
    <meta name="viewport" content="width=device-width, initial-scale=1.0">
    <title>APEX - Racing Telemetry Analysis</title>
    <style>
        /* CSS styles */
    </style>
</head>
<body>
    <div id="app">
        <header>
            <h1>APEX</h1>
            <span class="subtitle">Racing Telemetry Analysis Tool</span>
        </header>
        
        <main>
            <!-- Connection Status Panel -->
            <section class="panel connection-panel">
                <div class="status-indicator">
                    <div id="connectionDot" class="dot disconnected"></div>
                    <span id="connectionStatus">Disconnected</span>
                </div>
                <div id="connectionDetails" class="connection-details">
                    <span>Source: <span id="sourceIP">-</span></span>
                    <span>Port: <span id="sourcePort">9999</span></span>
                </div>
            </section>
            
            <!-- Session Settings Panel -->
            <section class="panel settings-panel">
                <div class="settings-group">
                    <label for="sessionName">Session Name</label>
                    <input type="text" id="sessionName" placeholder="My Qualifying Stint" />
                </div>
                <div class="settings-group">
                    <label for="udpPort">UDP Port</label>
                    <input type="number" id="udpPort" value="9999" min="1024" max="65535" />
                    <button id="saveSettings">Save</button>
                </div>
            </section>
            
            <!-- Controls Panel -->
            <section class="panel controls-panel">
                <button id="startRecording" class="btn btn-primary" disabled>
                    ⏺ START RECORDING
                </button>
                <button id="stopRecording" class="btn btn-danger" disabled>
                    ■ STOP RECORDING
                </button>
                <div class="stats-display">
                    <div class="stat-item">
                        <label>Laps</label>
                        <span id="lapCount">0</span>
                    </div>
                    <div class="stat-item">
                        <label>Time</label>
                        <span id="timerDisplay">00:00:00</span>
                    </div>
                    <div class="stat-item">
                        <label>Best Lap</label>
                        <span id="bestLapDisplay">--:--:---</span>
                    </div>
                </div>
            </section>
            
            <!-- Status Bar -->
            <div id="statusBar" class="status-bar">
                <span>● Waiting for telemetry connection...</span>
            </div>
        </main>
        
        <footer>
            <span>APEX v1.0.0</span>
            <span>Self-hosted · No external dependencies</span>
        </footer>
    </div>
    
    <script src="apex.js"></script>
</body>
</html>
```

### 7.2 CSS Styling

```css
* {
    margin: 0;
    padding: 0;
    box-sizing: border-box;
}

body {
    background: #1A1A1A;
    color: #FFFFFF;
    font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif;
    min-height: 100vh;
    display: flex;
    justify-content: center;
    align-items: center;
}

#app {
    width: 100%;
    max-width: 960px;
    padding: 20px;
}

header {
    display: flex;
    align-items: baseline;
    gap: 16px;
    padding: 20px 0;
    border-bottom: 2px solid #FF4D00;
    margin-bottom: 24px;
}

header h1 {
    font-size: 28px;
    font-weight: 700;
    color: #FF4D00;
    letter-spacing: 2px;
}

header .subtitle {
    font-size: 14px;
    color: #888;
    font-weight: 300;
}

.panel {
    background: #2D2D2D;
    border-radius: 8px;
    padding: 16px 20px;
    margin-bottom: 12px;
    display: flex;
    align-items: center;
    flex-wrap: wrap;
    gap: 16px;
}

.connection-panel {
    justify-content: space-between;
}

.status-indicator {
    display: flex;
    align-items: center;
    gap: 10px;
}

.dot {
    width: 12px;
    height: 12px;
    border-radius: 50%;
}

.dot.connected {
    background: #00CC66;
    box-shadow: 0 0 8px rgba(0, 204, 102, 0.4);
}

.dot.disconnected {
    background: #FF4444;
    box-shadow: 0 0 8px rgba(255, 68, 68, 0.4);
}

.dot.connecting {
    background: #FFCC00;
    box-shadow: 0 0 8px rgba(255, 204, 0, 0.4);
}

.connection-details {
    color: #888;
    font-size: 12px;
}

.settings-group {
    display: flex;
    align-items: center;
    gap: 8px;
}

.settings-group label {
    font-size: 12px;
    color: #888;
}

.settings-group input {
    background: #3D3D3D;
    border: 1px solid #555;
    color: #FFF;
    padding: 6px 10px;
    border-radius: 4px;
    font-size: 12px;
    width: 120px;
}

.settings-group input:focus {
    outline: none;
    border-color: #FF4D00;
}

.btn {
    padding: 10px 24px;
    border: none;
    border-radius: 4px;
    font-weight: 600;
    font-size: 14px;
    cursor: pointer;
    transition: all 0.2s;
}

.btn-primary {
    background: #FF4D00;
    color: #FFF;
}

.btn-primary:hover:not(:disabled) {
    background: #E04400;
}

.btn-primary:disabled {
    opacity: 0.3;
    cursor: not-allowed;
}

.btn-danger {
    background: #CC0000;
    color: #FFF;
}

.btn-danger:hover:not(:disabled) {
    background: #AA0000;
}

.btn-danger:disabled {
    opacity: 0.3;
    cursor: not-allowed;
}

.stats-display {
    display: flex;
    gap: 24px;
    margin-left: auto;
}

.stat-item {
    display: flex;
    flex-direction: column;
    align-items: center;
}

.stat-item label {
    font-size: 10px;
    color: #888;
    text-transform: uppercase;
    letter-spacing: 0.5px;
}

.stat-item span {
    font-size: 18px;
    font-weight: 600;
    font-variant-numeric: tabular-nums;
}

.stat-item span.lap-number {
    color: #FF4D00;
}

.status-bar {
    background: #1D1D1D;
    padding: 10px 20px;
    border-radius: 4px;
    font-size: 12px;
    color: #888;
    margin-top: 8px;
    border: 1px solid #333;
    min-height: 42px;
    display: flex;
    align-items: center;
}

footer {
    margin-top: 24px;
    padding: 12px 0;
    border-top: 1px solid #333;
    display: flex;
    justify-content: space-between;
    font-size: 11px;
    color: #555;
}

/* Responsive */
@media (max-width: 768px) {
    .panel {
        flex-direction: column;
        align-items: stretch;
    }
    
    .stats-display {
        margin-left: 0;
        justify-content: space-around;
    }
    
    .settings-group {
        flex-wrap: wrap;
    }
    
    .controls-panel .btn {
        width: 100%;
    }
}

@media (max-width: 480px) {
    #app {
        padding: 10px;
    }
    
    header h1 {
        font-size: 22px;
    }
    
    .stat-item span {
        font-size: 14px;
    }
}
```

### 7.3 JavaScript (Application Logic)

```javascript
class APEXApplication {
    constructor() {
        this.ws = null;
        this.isRecording = false;
        this.isConnected = false;
        this.samples = [];
        this.lapData = [];
        this.currentLap = [];
        this.lapCount = 0;
        this.timerStart = null;
        this.timerInterval = null;
        this.elapsedSeconds = 0;
        this.bestLapTime = Infinity;
        this.sessionName = localStorage.getItem('apex_session_name') || '';
        this.udpPort = localStorage.getItem('apex_udp_port') || '9999';
        
        this.initUI();
        this.loadSettings();
        this.connectWebSocket();
    }
    
    initUI() {
        this.elements = {
            connectionDot: document.getElementById('connectionDot'),
            connectionStatus: document.getElementById('connectionStatus'),
            sourceIP: document.getElementById('sourceIP'),
            sourcePort: document.getElementById('sourcePort'),
            sessionName: document.getElementById('sessionName'),
            udpPort: document.getElementById('udpPort'),
            saveSettings: document.getElementById('saveSettings'),
            startRecording: document.getElementById('startRecording'),
            stopRecording: document.getElementById('stopRecording'),
            lapCount: document.getElementById('lapCount'),
            timerDisplay: document.getElementById('timerDisplay'),
            bestLapDisplay: document.getElementById('bestLapDisplay'),
            statusBar: document.getElementById('statusBar')
        };
        
        // Event listeners
        this.elements.startRecording.addEventListener('click', () => this.startRecording());
        this.elements.stopRecording.addEventListener('click', () => this.stopRecording());
        this.elements.saveSettings.addEventListener('click', () => this.saveSettings());
        this.elements.sessionName.addEventListener('change', () => this.saveSettings());
        this.elements.udpPort.addEventListener('change', () => this.saveSettings());
        
        // Set initial values
        this.elements.sessionName.value = this.sessionName;
        this.elements.udpPort.value = this.udpPort;
    }
    
    loadSettings() {
        this.sessionName = localStorage.getItem('apex_session_name') || '';
        this.udpPort = localStorage.getItem('apex_udp_port') || '9999';
        if (this.elements) {
            this.elements.sessionName.value = this.sessionName;
            this.elements.udpPort.value = this.udpPort;
        }
    }
    
    saveSettings() {
        this.sessionName = this.elements.sessionName.value;
        this.udpPort = this.elements.udpPort.value;
        localStorage.setItem('apex_session_name', this.sessionName);
        localStorage.setItem('apex_udp_port', this.udpPort);
        this.setStatus('Settings saved');
        // Reconnect if port changed
        if (this.ws) {
            this.ws.close();
            this.connectWebSocket();
        }
    }
    
    connectWebSocket() {
        const wsPort = 8080;
        this.ws = new WebSocket(`ws://localhost:${wsPort}`);
        
        this.ws.onopen = () => {
            this.isConnected = true;
            this.updateConnectionStatus('connected');
            this.setStatus('Connected to telemetry stream');
            this.elements.startRecording.disabled = false;
        };
        
        this.ws.onmessage = (event) => {
            if (this.isRecording) {
                this.processTelemetryPacket(event.data);
            }
        };
        
        this.ws.onclose = () => {
            this.isConnected = false;
            this.updateConnectionStatus('disconnected');
            this.setStatus('Disconnected from telemetry stream');
            this.elements.startRecording.disabled = true;
            // Attempt to reconnect
            setTimeout(() => this.connectWebSocket(), 3000);
        };
        
        this.ws.onerror = (error) => {
            console.error('WebSocket error:', error);
            this.setStatus('WebSocket error. Check UDP proxy is running.');
        };
    }
    
    updateConnectionStatus(state) {
        const dot = this.elements.connectionDot;
        const status = this.elements.connectionStatus;
        
        dot.className = `dot ${state}`;
        status.textContent = state === 'connected' ? 'Connected' : 
                             state === 'connecting' ? 'Connecting...' : 'Disconnected';
    }
    
    setStatus(message) {
        this.elements.statusBar.textContent = message;
    }
    
    startRecording() {
        if (!this.isConnected) {
            this.setStatus('Error: Not connected to telemetry stream');
            return;
        }
        
        this.isRecording = true;
        this.samples = [];
        this.lapData = [];
        this.currentLap = [];
        this.lapCount = 0;
        this.bestLapTime = Infinity;
        this.timerStart = Date.now();
        this.elapsedSeconds = 0;
        
        this.elements.startRecording.disabled = true;
        this.elements.stopRecording.disabled = false;
        this.elements.lapCount.textContent = '0';
        this.elements.bestLapDisplay.textContent = '--:--:---';
        
        this.timerInterval = setInterval(() => {
            this.elapsedSeconds = (Date.now() - this.timerStart) / 1000;
            this.elements.timerDisplay.textContent = this.formatTime(this.elapsedSeconds);
        }, 100);
        
        this.setStatus('● Recording... Press STOP to generate report.');
    }
    
    stopRecording() {
        this.isRecording = false;
        clearInterval(this.timerInterval);
        
        this.elements.startRecording.disabled = false;
        this.elements.stopRecording.disabled = true;
        
        if (this.samples.length > 0) {
            this.setStatus('📊 Analyzing data...');
            this.processStint();
        } else {
            this.setStatus('No telemetry data recorded. Please try again.');
            this.resetUI();
        }
    }
    
    processTelemetryPacket(packetData) {
        try {
            const sample = this.parseTelemetryPacket(packetData);
            this.samples.push(sample);
            
            // Track lap boundaries
            if (sample.lapNumber > this.lapCount) {
                this.lapCount = sample.lapNumber;
                this.elements.lapCount.textContent = this.lapCount;
                
                // Complete current lap
                if (this.currentLap.length > 0) {
                    const lapTime = this.calculateLapTime(this.currentLap);
                    if (lapTime > 0 && lapTime < this.bestLapTime) {
                        this.bestLapTime = lapTime;
                        this.elements.bestLapDisplay.textContent = this.formatTime(lapTime);
                    }
                    this.lapData.push({
                        number: this.lapCount,
                        samples: [...this.currentLap],
                        time: lapTime
                    });
                }
                this.currentLap = [];
            }
            
            // Add to current lap
            this.currentLap.push(sample);
        } catch (error) {
            console.error('Error processing packet:', error);
        }
    }
    
    parseTelemetryPacket(data) {
        // Convert from base64 to ArrayBuffer
        const binaryString = atob(data);
        const bytes = new Uint8Array(binaryString.length);
        for (let i = 0; i < binaryString.length; i++) {
            bytes[i] = binaryString.charCodeAt(i);
        }
        const view = new DataView(bytes.buffer);
        
        return {
            timestamp: view.getUint32(0, true),
            isRaceOn: view.getInt32(4, true),
            engineRpm: view.getFloat32(16, true),
            accelerationX: view.getFloat32(20, true),
            accelerationY: view.getFloat32(24, true),
            accelerationZ: view.getFloat32(28, true),
            velocityX: view.getFloat32(32, true),
            velocityY: view.getFloat32(36, true),
            velocityZ: view.getFloat32(40, true),
            yaw: view.getFloat32(56, true),
            pitch: view.getFloat32(60, true),
            roll: view.getFloat32(64, true),
            slipRatioFL: view.getFloat32(84, true),
            slipRatioFR: view.getFloat32(88, true),
            slipRatioRL: view.getFloat32(92, true),
            slipRatioRR: view.getFloat32(96, true),
            positionX: view.getFloat32(232, true),
            positionY: view.getFloat32(236, true),
            positionZ: view.getFloat32(240, true),
            speed: view.getFloat32(244, true) * 2.237, // Convert to mph
            power: view.getFloat32(248, true),
            torque: view.getFloat32(252, true),
            tempFL: view.getFloat32(256, true),
            tempFR: view.getFloat32(260, true),
            tempRL: view.getFloat32(264, true),
            tempRR: view.getFloat32(268, true),
            fuel: view.getFloat32(276, true),
            lapNumber: view.getUint16(300, true),
            accel: view.getUint8(303),
            brake: view.getUint8(304),
            gear: view.getUint8(307),
            steer: view.getInt8(308)
        };
    }
    
    calculateLapTime(lapSamples) {
        if (lapSamples.length < 2) return 0;
        const startTime = lapSamples[0].timestamp;
        const endTime = lapSamples[lapSamples.length - 1].timestamp;
        return (endTime - startTime) / 1000;
    }
    
    formatTime(seconds) {
        if (!seconds || seconds === Infinity) return '--:--:---';
        const minutes = Math.floor(seconds / 60);
        const secs = seconds % 60;
        return `${minutes}:${secs.toFixed(3).padStart(6, '0')}`;
    }
    
    processStint() {
        try {
            // Run analysis
            const analysis = this.runAnalysis();
            
            // Generate PDF
            this.generatePDF(analysis);
            
            // Reset UI
            this.resetUI();
        } catch (error) {
            console.error('Error processing stint:', error);
            this.setStatus('❌ Error processing data. Please try again.');
            this.resetUI();
        }
    }
    
    runAnalysis() {
        const cornerDetector = new CornerDetector();
        const rulesEngine = new GoingFasterRules();
        
        // Detect corners in each lap
        const allCorners = [];
        const feedback = {};
        
        for (const lap of this.lapData) {
            const corners = cornerDetector.detectCorners(lap);
            
            // Analyze each corner
            for (const corner of corners) {
                // Add context
                corner.maxRPM = this.samples.reduce((max, s) => Math.max(max, s.engineRpm), 0);
                corner.avgEntrySpeed = this.calculateAverageEntrySpeed(corners);
                
                // Run rules
                const cornerFeedback = rulesEngine.analyzeCorner(corner);
                feedback[corner.number] = cornerFeedback;
                allCorners.push(corner);
            }
        }
        
        // Calculate overall metrics
        const maxSpeed = this.samples.reduce((max, s) => Math.max(max, s.speed), 0);
        const maxLateralG = this.samples.reduce((max, s) => Math.max(max, Math.abs(s.accelerationX)), 0);
        
        return {
            corners: allCorners,
            feedback: feedback,
            maxSpeed: maxSpeed,
            maxLateralG: maxLateralG,
            lapCount: this.lapData.length,
            bestLapTime: this.bestLapTime
        };
    }
    
    calculateAverageEntrySpeed(corners) {
        if (corners.length === 0) return 0;
        const sum = corners.reduce((total, c) => total + c.entrySpeed, 0);
        return sum / corners.length;
    }
    
    resetUI() {
        this.elements.startRecording.disabled = false;
        this.elements.stopRecording.disabled = true;
        if (this.timerInterval) {
            clearInterval(this.timerInterval);
        }
    }
    
    async generatePDF(analysis) {
        try {
            this.setStatus('📄 Generating PDF report...');
            
            const generator = new PDFReportGenerator();
            const sessionData = {
                sessionName: this.sessionName,
                laps: this.lapData,
                bestLapTime: this.bestLapTime,
                avgLapTime: this.calculateAverageLapTime(),
                maxSpeed: analysis.maxSpeed,
                carId: this.detectCarId(),
                lapCount: analysis.lapCount
            };
            
            const pdfBytes = await generator.generate(sessionData, analysis);
            
            // Download
            const filename = `apex-report-${new Date().toISOString().replace(/[:.]/g, '-')}.pdf`;
            await generator.downloadPDF(pdfBytes, filename);
            
            this.setStatus('✅ PDF generated and downloaded successfully!');
        } catch (error) {
            console.error('PDF generation error:', error);
            this.setStatus('❌ Error generating PDF. Please try again.');
        }
    }
    
    calculateAverageLapTime() {
        if (this.lapData.length === 0) return 0;
        const sum = this.lapData.reduce((total, lap) => total + lap.time, 0);
        return sum / this.lapData.length;
    }
    
    detectCarId() {
        // Check if we have car data
        for (const sample of this.samples) {
            if (sample.carId) return sample.carId;
        }
        return null;
    }
}

// Initialize application
document.addEventListener('DOMContentLoaded', () => {
    window.apex = new APEXApplication();
});
```

---

## 8. Performance Requirements

### 8.1 Memory Management

```javascript
class CircularBuffer {
    constructor(maxSize = 100000) {
        this.buffer = [];
        this.maxSize = maxSize;
        this.head = 0;
        this.tail = 0;
        this.size = 0;
    }
    
    push(item) {
        if (this.size >= this.maxSize) {
            // Overwrite oldest item
            this.buffer[this.head] = item;
            this.head = (this.head + 1) % this.maxSize;
            this.tail = (this.tail + 1) % this.maxSize;
        } else {
            if (this.buffer.length < this.maxSize) {
                this.buffer.push(item);
            } else {
                this.buffer[this.tail] = item;
            }
            this.tail = (this.tail + 1) % this.maxSize;
            this.size++;
        }
    }
    
    getItems() {
        const result = [];
        for (let i = 0; i < this.size; i++) {
            const index = (this.head + i) % this.maxSize;
            result.push(this.buffer[index]);
        }
        return result;
    }
    
    clear() {
        this.buffer = [];
        this.head = 0;
        this.tail = 0;
        this.size = 0;
    }
}
```

### 8.2 Performance Targets

| Metric | Target | Measurement Method |
|--------|--------|-------------------|
| Data processing latency | < 10ms per packet | Console timing |
| Memory usage | < 500MB | Browser Task Manager |
| PDF generation time | < 10s for 20 laps | Console timing |
| UI responsiveness | < 100ms | User perception |
| UDP packet loss | < 1% | Packet sequence monitoring |

---

## 9. Error Handling

### 9.1 Error Codes

```javascript
const ErrorCodes = {
    UDP_PORT_BUSY: 'UDP_PORT_BUSY',
    WS_CONNECTION_FAILED: 'WS_CONNECTION_FAILED',
    PACKET_MALFORMED: 'PACKET_MALFORMED',
    DATA_BUFFER_OVERFLOW: 'DATA_BUFFER_OVERFLOW',
    PDF_GENERATION_FAILED: 'PDF_GENERATION_FAILED',
    INVALID_SESSION: 'INVALID_SESSION'
};

class APEXError extends Error {
    constructor(code, message, details = null) {
        super(message);
        this.code = code;
        this.details = details;
        this.timestamp = new Date().toISOString();
    }
}

function handleError(error) {
    console.error(`[${error.code}] ${error.message}`, error.details);
    
    // User-friendly messages
    const userMessages = {
        'UDP_PORT_BUSY': 'UDP port 9999 is busy. Check if another application is using it.',
        'WS_CONNECTION_FAILED': 'Failed to connect to UDP proxy. Ensure it is running.',
        'PACKET_MALFORMED': 'Received malformed telemetry packet. Some data may be lost.',
        'DATA_BUFFER_OVERFLOW': 'Data buffer is full. Stopping recording to prevent memory issues.',
        'PDF_GENERATION_FAILED': 'Failed to generate PDF. Please try again.',
        'INVALID_SESSION': 'No valid telemetry data recorded. Please try again.'
    };
    
    const userMessage = userMessages[error.code] || 'An unexpected error occurred.';
    return userMessage;
}
```

---

## 10. Testing Requirements

### 10.1 Unit Tests

```javascript
// Example test suite structure
describe('LapDetector', () => {
    test('detects lap boundaries correctly', () => {
        // Test implementation
    });
    
    test('handles partial laps', () => {
        // Test implementation
    });
});

describe('CornerDetector', () => {
    test('detects corners from speed trace', () => {
        // Test implementation
    });
    
    test('identifies corner type correctly', () => {
        // Test implementation
    });
});

describe('GoingFasterRules', () => {
    test('triggers correct rule for early apex', () => {
        // Test implementation
    });
    
    test('handles corner with no issues', () => {
        // Test implementation
    });
});

describe('PDFReportGenerator', () => {
    test('generates valid PDF', () => {
        // Test implementation
    });
    
    test('includes all required sections', () => {
        // Test implementation
    });
});
```

### 10.2 Integration Tests

```javascript
// Test with simulated UDP data
describe('Full Pipeline', () => {
    test('processes telemetry data end-to-end', async () => {
        // Mock UDP proxy
        // Send simulated telemetry data
        // Verify recording starts
        // Verify lap detection works
        // Verify analysis produces results
        // Verify PDF is generated
    });
    
    test('handles concurrent recording sessions', () => {
        // Test implementation
    });
});
```

---

## 11. Development Environment Setup

### 11.1 Required Tools

```
- Node.js 14+ (for UDP proxy)
- Modern Web Browser (Chrome 90+, Firefox 88+)
- Git (for version control)
- npm or yarn (for dependency management)
```

### 11.2 Project Structure

```
apex/
├── index.html                 # Main application page
├── apex.js                    # Main application logic
├── udp-proxy.js              # UDP listener proxy
├── package.json              # Node.js dependencies
├── README.md                 # Project documentation
├── PRD.md                    # Product Requirements Document
├── TRD.md                    # Technical Requirements Document
├── docs/
│   ├── architecture.md       # Architecture overview
│   ├── api.md                # Internal API documentation
│   └── troubleshooting.md    # Troubleshooting guide
├── tests/
│   ├── unit/                 # Unit tests
│   ├── integration/          # Integration tests
│   └── fixtures/             # Test data
└── build/
    └── electron/             # Electron build files
```

### 11.3 package.json

```json
{
  "name": "apex-telemetry",
  "version": "1.0.0",
  "description": "Racing Telemetry Analysis Tool",
  "main": "udp-proxy.js",
  "scripts": {
    "start": "node udp-proxy.js",
    "dev": "nodemon udp-proxy.js",
    "test": "jest",
    "build": "electron-builder",
    "dist": "npm run build && electron-builder --dir"
  },
  "dependencies": {
    "ws": "^8.13.0"
  },
  "devDependencies": {
    "electron": "^25.0.0",
    "electron-builder": "^24.0.0",
    "jest": "^29.0.0",
    "nodemon": "^3.0.0"
  }
}
```

---

## 12. Distribution

### 12.1 Standalone Executable (Electron)

```javascript
// electron-main.js
const { app, BrowserWindow, ipcMain } = require('electron');
const { WebSocketServer } = require('ws');
const dgram = require('dgram');

let mainWindow;
let udpServer;
let wsServer;

function createWindow() {
    mainWindow = new BrowserWindow({
        width: 1200,
        height: 800,
        webPreferences: {
            nodeIntegration: true,
            contextIsolation: false
        },
        icon: 'assets/icon.ico'
    });
    
    mainWindow.loadFile('index.html');
    mainWindow.setMenuBarVisibility(false);
    
    // Start services
    startUDPServer();
    startWebSocketServer();
}

function startUDPServer() {
    const UDP_PORT = 9999;
    udpServer = dgram.createSocket('udp4');
    
    udpServer.on('error', (err) => {
        console.error('UDP server error:', err);
        mainWindow.webContents.send('udp-error', err.message);
    });
    
    udpServer.on('message', (msg, rinfo) => {
        if (wsServer) {
            const buffer = msg.toString('base64');
            wsServer.clients.forEach(client => {
                if (client.readyState === 1) {
                    client.send(buffer);
                }
            });
        }
    });
    
    udpServer.bind(UDP_PORT, '0.0.0.0', () => {
        console.log(`UDP server listening on port ${UDP_PORT}`);
        mainWindow.webContents.send('udp-ready');
    });
}

function startWebSocketServer() {
    const WS_PORT = 8080;
    wsServer = new WebSocketServer({ port: WS_PORT });
    
    wsServer.on('connection', (ws) => {
        console.log('WebSocket client connected');
    });
}

app.whenReady().then(createWindow);

app.on('window-all-closed', () => {
    if (process.platform !== 'darwin') {
        app.quit();
    }
});
```

### 12.2 Distribution Formats

| Format | Platform | Notes |
|--------|----------|-------|
| ZIP Archive | All | Self-extracting; includes all files |
| NSIS Installer | Windows | System integration |
| DMG | macOS | Drag-and-drop install |
| DEB/RPM | Linux | Package manager install |
| Portable | All | No installation required |

---

**Document Version**: 1.0.0
**Status**: Draft
**Last Updated**: 2026-08-23
**Author**: APEX Engineering Team