# APEX ANALYSIS.md

# APEX: Racing Telemetry Analysis Tool
## Analysis Engine Specification

### Based on "Going Faster!" by the Skip Barber Racing School

---

## 1. Analysis Philosophy

### 1.1 Core Principles from "Going Faster!"

> *"There are three basic problems to solve in racing: 1) driving on the best path, 2) carrying speed away from corners onto straights, and 3) efficiently slowing the car at the entry to corners."*
> — Going Faster!, Chapter 1

The APEX Analysis Engine is built on the fundamental physics of vehicle dynamics as taught by the Skip Barber Racing School. Every analysis metric is derived from first principles and grounded in the three pillars of race driving:

1. **The Line** - Geometric path optimization
2. **Corner Exit Speed** - Kinetic energy management
3. **Braking & Entering** - Deceleration dynamics

### 1.2 Mathematical Foundation

The analysis engine relies on the following core physics equations:

**Cornering Speed:**
$$v = \sqrt{15 \cdot G \cdot R}$$

Where:
- $v$ = cornering speed (mph)
- $G$ = cornering force (G's)
- $R$ = radius of the corner (feet)

**Kinetic Energy:**
$$E_k = \frac{1}{2} \cdot m \cdot v^2$$

**Deceleration Rate:**
$$a = \frac{v_f^2 - v_i^2}{2 \cdot d}$$

**Lateral Load Transfer:**
$$\Delta W = \frac{W \cdot a_y \cdot h}{t}$$

---

## 2. Data Preprocessing

### 2.1 Sample Interpolation

Raw telemetry may have gaps or variable sample rates. APEX interpolates to a fixed 50Hz sample rate.

```javascript
function interpolateSamples(samples, targetRate = 50) {
    const interpolated = [];
    const timeStep = 1000 / targetRate; // ms between samples
    
    for (let i = 0; i < samples.length - 1; i++) {
        const current = samples[i];
        const next = samples[i + 1];
        const timeDelta = next.timestamp - current.timestamp;
        
        if (timeDelta > timeStep) {
            // Interpolate missing samples
            const steps = Math.floor(timeDelta / timeStep);
            for (let j = 1; j <= steps; j++) {
                const fraction = j / (steps + 1);
                interpolated.push({
                    timestamp: current.timestamp + j * timeStep,
                    speed: lerp(current.speed, next.speed, fraction),
                    positionX: lerp(current.positionX, next.positionX, fraction),
                    positionZ: lerp(current.positionZ, next.positionZ, fraction),
                    engineRpm: lerp(current.engineRpm, next.engineRpm, fraction),
                    throttle: lerp(current.throttle, next.throttle, fraction),
                    brake: lerp(current.brake, next.brake, fraction),
                    steering: lerp(current.steering, next.steering, fraction),
                    accelerationX: lerp(current.accelerationX, next.accelerationX, fraction),
                    accelerationZ: lerp(current.accelerationZ, next.accelerationZ, fraction)
                });
            }
        }
        interpolated.push(current);
    }
    return interpolated;
}

function lerp(a, b, t) {
    return a + (b - a) * t;
}
```

### 2.2 Noise Filtering

```javascript
function applySmoothing(samples, windowSize = 5) {
    const smoothed = [];
    const halfWindow = Math.floor(windowSize / 2);
    
    for (let i = 0; i < samples.length; i++) {
        let sum = 0;
        let count = 0;
        for (let j = Math.max(0, i - halfWindow); j < Math.min(samples.length, i + halfWindow + 1); j++) {
            sum += samples[j];
            count++;
        }
        smoothed.push(sum / count);
    }
    return smoothed;
}
```

---

## 3. Lap Detection & Segmentation

### 3.1 Start/Finish Line Detection

```javascript
class LapDetector {
    constructor(samples) {
        this.samples = samples;
        this.lapStartIndices = [];
        this.lapTimes = [];
        this.bestLapIndex = -1;
    }
    
    detectLaps() {
        // Method 1: Use LapNumber from telemetry
        this.detectLapsByNumber();
        
        // Method 2: Use position-based detection if LapNumber is unreliable
        if (this.lapStartIndices.length < 2) {
            this.detectLapsByPosition();
        }
        
        // Calculate lap times
        this.calculateLapTimes();
        
        return this;
    }
    
    detectLapsByNumber() {
        let currentLap = -1;
        for (let i = 0; i < this.samples.length; i++) {
            const sample = this.samples[i];
            if (sample.lapNumber > currentLap) {
                currentLap = sample.lapNumber;
                this.lapStartIndices.push(i);
            }
        }
    }
    
    detectLapsByPosition() {
        // Find the start/finish line from position data
        const startFinish = this.findStartFinishPosition();
        if (!startFinish) return;
        
        for (let i = 1; i < this.samples.length; i++) {
            const prev = this.samples[i - 1];
            const curr = this.samples[i];
            
            // Check if crossed the start/finish line
            const prevDist = this.distanceToPoint(prev.positionX, prev.positionZ, startFinish);
            const currDist = this.distanceToPoint(curr.positionX, curr.positionZ, startFinish);
            
            // If moving towards start/finish and crossing threshold
            if (prevDist > 20 && currDist < 20) {
                this.lapStartIndices.push(i);
            }
        }
    }
    
    findStartFinishPosition() {
        // Use most common position on the track
        // Simplified: use average of positions where lap number changes
        if (this.samples.length < 100) return null;
        
        const positions = [];
        for (let i = 0; i < this.samples.length; i++) {
            positions.push({
                x: this.samples[i].positionX,
                z: this.samples[i].positionZ
            });
        }
        
        // Use k-means clustering or simple averaging
        // For simplicity, use the position where speed is highest
        let maxSpeed = 0;
        let maxSpeedIndex = 0;
        for (let i = 0; i < this.samples.length; i++) {
            if (this.samples[i].speed > maxSpeed) {
                maxSpeed = this.samples[i].speed;
                maxSpeedIndex = i;
            }
        }
        
        return {
            x: this.samples[maxSpeedIndex].positionX,
            z: this.samples[maxSpeedIndex].positionZ
        };
    }
    
    distanceToPoint(x1, z1, point) {
        const dx = x1 - point.x;
        const dz = z1 - point.z;
        return Math.sqrt(dx * dx + dz * dz);
    }
    
    calculateLapTimes() {
        for (let i = 0; i < this.lapStartIndices.length - 1; i++) {
            const start = this.lapStartIndices[i];
            const end = this.lapStartIndices[i + 1];
            
            if (end > start) {
                const timeMs = this.samples[end].timestamp - this.samples[start].timestamp;
                this.lapTimes.push(timeMs / 1000); // Convert to seconds
            }
        }
        
        // Find best lap
        let bestTime = Infinity;
        for (let i = 0; i < this.lapTimes.length; i++) {
            if (this.lapTimes[i] < bestTime) {
                bestTime = this.lapTimes[i];
                this.bestLapIndex = i;
            }
        }
    }
}
```

---

## 4. Corner Detection & Analysis

### 4.1 Corner Identification

```javascript
class CornerDetector {
    constructor(samples) {
        this.samples = samples;
        this.corners = [];
        this.minCornerSpeed = 10; // mph
        this.minSteeringAngle = 3; // degrees
        this.minLateralG = 0.2;
        this.cornerMergeDistance = 50; // samples
    }
    
    detectCorners() {
        const speedTrace = this.samples.map(s => s.speed);
        const steeringTrace = this.samples.map(s => Math.abs(s.steering));
        const lateralG = this.samples.map(s => Math.abs(s.accelerationX));
        
        // Find local minima in speed trace
        const minima = this.findLocalMinima(speedTrace);
        
        // Filter to real corners
        const candidateCorners = minima.filter(index => {
            const steering = steeringTrace[index];
            const lateral = lateralG[index];
            
            // Must have significant steering or lateral G
            const isValid = (steering > this.minSteeringAngle) || 
                           (lateral > this.minLateralG);
            
            // Must be above minimum speed (not stopped)
            const isMoving = speedTrace[index] > this.minCornerSpeed;
            
            return isValid && isMoving;
        });
        
        // Merge nearby corners
        this.corners = this.mergeCorners(candidateCorners);
        
        // Extract corner data for each
        this.corners = this.corners.map((apexIndex, idx) => {
            return this.extractCornerData(apexIndex, idx + 1);
        });
        
        return this.corners;
    }
    
    findLocalMinima(speedTrace) {
        const minima = [];
        for (let i = 5; i < speedTrace.length - 5; i++) {
            const isLocalMin = 
                speedTrace[i] < speedTrace[i-1] &&
                speedTrace[i] < speedTrace[i+1] &&
                speedTrace[i] < speedTrace[i-2] &&
                speedTrace[i] < speedTrace[i+2] &&
                speedTrace[i] < speedTrace[i-3] &&
                speedTrace[i] < speedTrace[i+3];
            
            if (isLocalMin) {
                minima.push(i);
            }
        }
        return minima;
    }
    
    mergeCorners(candidateIndices) {
        if (candidateIndices.length === 0) return [];
        
        const merged = [];
        let currentGroup = [candidateIndices[0]];
        
        for (let i = 1; i < candidateIndices.length; i++) {
            const diff = candidateIndices[i] - candidateIndices[i-1];
            if (diff < this.cornerMergeDistance) {
                currentGroup.push(candidateIndices[i]);
            } else {
                // Use the minimum speed point in the group
                const groupMin = this.findMinInGroup(currentGroup);
                merged.push(groupMin);
                currentGroup = [candidateIndices[i]];
            }
        }
        
        // Handle last group
        if (currentGroup.length > 0) {
            const groupMin = this.findMinInGroup(currentGroup);
            merged.push(groupMin);
        }
        
        return merged;
    }
    
    findMinInGroup(indices) {
        let minSpeed = Infinity;
        let minIndex = indices[0];
        
        for (const idx of indices) {
            if (this.samples[idx].speed < minSpeed) {
                minSpeed = this.samples[idx].speed;
                minIndex = idx;
            }
        }
        return minIndex;
    }
}
```

### 4.2 Corner Data Extraction

```javascript
extractCornerData(apexIndex, cornerNumber) {
    const apexSample = this.samples[apexIndex];
    const corner = {
        number: cornerNumber,
        apexIndex: apexIndex,
        type: this.determineCornerType(apexIndex),
        entryIndex: 0,
        exitIndex: 0,
        tapIndex: 0,
        turnInIndex: 0,
        brakePointIndex: 0
    };
    
    // Find brake point (where brake pressure first exceeds threshold)
    corner.brakePointIndex = this.findBrakePoint(apexIndex);
    
    // Find turn-in point (where steering first exceeds threshold)
    corner.turnInIndex = this.findTurnInPoint(apexIndex);
    
    // Find entry point (after braking, before turn-in)
    corner.entryIndex = this.findEntryPoint(corner.turnInIndex);
    
    // Find exit point (where steering returns to near zero)
    corner.exitIndex = this.findExitPoint(apexIndex);
    
    // Find throttle application point (where throttle exceeds 50%)
    corner.tapIndex = this.findThrottleApplicationPoint(apexIndex);
    
    // Calculate metrics
    corner = this.calculateCornerMetrics(corner);
    
    // Detect line issues
    corner = this.detectLineIssues(corner);
    
    return corner;
}

findBrakePoint(apexIndex) {
    const threshold = 10; // % brake pressure
    for (let i = apexIndex; i >= 0; i--) {
        if (this.samples[i].brake > threshold) {
            return i;
        }
    }
    return 0;
}

findTurnInPoint(apexIndex) {
    const threshold = 3; // degrees steering
    for (let i = apexIndex; i >= 0; i--) {
        if (Math.abs(this.samples[i].steering) > threshold) {
            return i;
        }
    }
    return 0;
}

findEntryPoint(turnInIndex) {
    // Look for the point where brake pressure is stable before turn-in
    let entryIndex = turnInIndex;
    for (let i = turnInIndex; i >= 0; i--) {
        if (Math.abs(this.samples[i].brake - this.samples[i-1]?.brake || 0) < 5) {
            entryIndex = i;
            break;
        }
    }
    return entryIndex;
}

findExitPoint(apexIndex) {
    const threshold = 3; // degrees steering
    for (let i = apexIndex; i < this.samples.length; i++) {
        if (Math.abs(this.samples[i].steering) < threshold) {
            return i;
        }
    }
    return this.samples.length - 1;
}

findThrottleApplicationPoint(apexIndex) {
    for (let i = apexIndex; i < this.samples.length; i++) {
        if (this.samples[i].throttle > 50) {
            return i;
        }
    }
    return apexIndex;
}
```

### 4.3 Corner Metrics Calculation

```javascript
calculateCornerMetrics(corner) {
    const samples = this.samples;
    const entry = samples[corner.entryIndex];
    const apex = samples[corner.apexIndex];
    const exit = samples[corner.exitIndex];
    const tap = samples[corner.tapIndex];
    
    // Speeds (mph)
    corner.entrySpeed = entry.speed;
    corner.apexSpeed = apex.speed;
    corner.exitSpeed = exit.speed;
    
    // Brake pressure
    corner.maxBrakePressure = this.findMaxBrake(corner.brakePointIndex, corner.turnInIndex);
    corner.apexBrakePressure = apex.brake;
    
    // Steering
    corner.maxSteeringAngle = this.findMaxSteering(corner.turnInIndex, corner.exitIndex);
    corner.apexSteeringAngle = apex.steering;
    
    // RPM
    corner.minRPM = this.findMinRPM(corner.entryIndex, corner.exitIndex);
    corner.exitRPM = exit.engineRpm;
    corner.apexRPM = apex.engineRpm;
    
    // Gear
    corner.gearUsed = apex.gear || 0;
    
    // Throttle application point distance (from apex)
    corner.tapDistance = this.calculatePathDistance(
        corner.apexIndex, 
        corner.tapIndex
    );
    
    // Trail-braking overlap
    corner.trailBrakeOverlap = this.calculateTrailBrakeOverlap(
        corner.turnInIndex,
        corner.apexIndex
    );
    
    // G-forces
    corner.maxLateralG = this.findMaxLateralG(corner.entryIndex, corner.exitIndex);
    corner.apexLateralG = Math.abs(apex.accelerationX);
    corner.maxBrakingG = this.findMaxBrakingG(corner.brakePointIndex, corner.turnInIndex);
    
    // Corner duration
    corner.duration = (exit.timestamp - entry.timestamp) / 1000;
    
    // Corner radius (estimated)
    corner.radius = this.estimateCornerRadius(apex.speed, Math.abs(apex.accelerationX));
    
    return corner;
}

findMaxBrake(start, end) {
    let max = 0;
    for (let i = start; i <= end && i < this.samples.length; i++) {
        if (this.samples[i].brake > max) {
            max = this.samples[i].brake;
        }
    }
    return max;
}

findMaxSteering(start, end) {
    let max = 0;
    for (let i = start; i <= end && i < this.samples.length; i++) {
        const angle = Math.abs(this.samples[i].steering);
        if (angle > max) {
            max = angle;
        }
    }
    return max;
}

findMinRPM(start, end) {
    let min = Infinity;
    for (let i = start; i <= end && i < this.samples.length; i++) {
        if (this.samples[i].engineRpm < min) {
            min = this.samples[i].engineRpm;
        }
    }
    return min === Infinity ? 0 : min;
}

calculatePathDistance(index1, index2) {
    let distance = 0;
    const start = Math.min(index1, index2);
    const end = Math.max(index1, index2);
    
    for (let i = start + 1; i <= end && i < this.samples.length; i++) {
        const dx = this.samples[i].positionX - this.samples[i-1].positionX;
        const dz = this.samples[i].positionZ - this.samples[i-1].positionZ;
        distance += Math.sqrt(dx * dx + dz * dz);
    }
    return distance * 3.28084; // Convert meters to feet
}

calculateTrailBrakeOverlap(turnInIndex, apexIndex) {
    let overlapCount = 0;
    let totalCount = 0;
    
    for (let i = turnInIndex; i <= apexIndex && i < this.samples.length; i++) {
        totalCount++;
        if (this.samples[i].brake > 5 && Math.abs(this.samples[i].steering) > 3) {
            overlapCount++;
        }
    }
    
    return totalCount > 0 ? overlapCount / totalCount : 0;
}

findMaxLateralG(start, end) {
    let max = 0;
    for (let i = start; i <= end && i < this.samples.length; i++) {
        const g = Math.abs(this.samples[i].accelerationX);
        if (g > max) {
            max = g;
        }
    }
    return max;
}

findMaxBrakingG(start, end) {
    let max = 0;
    for (let i = start; i <= end && i < this.samples.length; i++) {
        const g = Math.abs(this.samples[i].accelerationZ);
        if (g > max && this.samples[i].brake > 10) {
            max = g;
        }
    }
    return max;
}

estimateCornerRadius(speed, lateralG) {
    // v = sqrt(15 * G * R) => R = v^2 / (15 * G)
    if (lateralG === 0) return 0;
    return (speed * speed) / (15 * lateralG);
}
```

### 4.4 Line Issue Detection

```javascript
detectLineIssues(corner) {
    const samples = this.samples;
    const apex = samples[corner.apexIndex];
    
    // Early Apex Detection
    // Check if steering angle increases after apex
    let postApexSteeringIncrease = 0;
    const checkRange = Math.min(10, samples.length - corner.apexIndex - 1);
    
    for (let i = 1; i <= checkRange; i++) {
        const idx = corner.apexIndex + i;
        if (idx < samples.length) {
            const currentSteering = Math.abs(samples[idx].steering);
            const baseSteering = Math.abs(apex.steering);
            if (currentSteering > baseSteering + 5) {
                postApexSteeringIncrease++;
            }
        }
    }
    
    corner.earlyApex = postApexSteeringIncrease > 3;
    
    // Late Apex Detection
    // Check if steering is unwound early at exit
    if (corner.exitIndex > corner.apexIndex + 5) {
        let earlyUnwind = true;
        const exitCheckRange = Math.min(5, corner.exitIndex - corner.apexIndex - 1);
        
        for (let i = 1; i <= exitCheckRange; i++) {
            const idx = corner.exitIndex - i;
            if (idx > 0 && idx < samples.length) {
                if (Math.abs(samples[idx].steering) > 20) {
                    earlyUnwind = false;
                    break;
                }
            }
        }
        
        // Also check if speed is significantly higher than apex
        const exitSpeedRatio = corner.exitSpeed / corner.apexSpeed;
        corner.lateApex = earlyUnwind && exitSpeedRatio > 1.3;
    } else {
        corner.lateApex = false;
    }
    
    // Wheelspin detection
    corner.wheelspin = this.detectWheelspin(corner);
    
    return corner;
}

detectWheelspin(corner) {
    // Check tire slip ratios at and after apex
    let maxSlip = 0;
    const startIdx = Math.max(0, corner.apexIndex - 5);
    const endIdx = Math.min(this.samples.length - 1, corner.apexIndex + 20);
    
    for (let i = startIdx; i <= endIdx; i++) {
        const sample = this.samples[i];
        const slip = Math.max(
            sample.slipRatioFL || 0,
            sample.slipRatioFR || 0,
            sample.slipRatioRL || 0,
            sample.slipRatioRR || 0
        );
        if (slip > maxSlip) {
            maxSlip = slip;
        }
    }
    
    // Slip ratio > 1.0 indicates loss of grip
    return maxSlip > 1.0;
}
```

---

## 5. Exit Speed Analysis

### 5.1 Throttle Application Analysis

```javascript
class ExitSpeedAnalyzer {
    constructor(corners, samples) {
        this.corners = corners;
        this.samples = samples;
    }
    
    analyzeExitSpeed() {
        const results = [];
        
        for (const corner of this.corners) {
            // Calculate throttle application characteristics
            const tapData = this.analyzeThrottleApplication(corner);
            
            // Calculate exit speed efficiency
            const exitEfficiency = this.calculateExitEfficiency(corner);
            
            // Calculate acceleration rate to exit
            const accelerationRate = this.calculateAccelerationRate(corner);
            
            // Determine if corner is Type I (leads to straight)
            const isTypeI = this.isTypeICorner(corner);
            
            results.push({
                corner: corner.number,
                exitSpeed: corner.exitSpeed,
                tapDistance: corner.tapDistance,
                tapSmoothness: tapData.smoothness,
                exitEfficiency: exitEfficiency,
                accelerationRate: accelerationRate,
                priority: isTypeI ? 'HIGH' : 'MEDIUM',
                potentialGain: this.calculatePotentialGain(corner, exitEfficiency)
            });
        }
        
        return results;
    }
    
    analyzeThrottleApplication(corner) {
        const startIdx = corner.apexIndex;
        const endIdx = Math.min(startIdx + 30, this.samples.length - 1);
        
        // Find throttle application point and rate
        let tapFound = false;
        let tapIndex = startIdx;
        let smoothnessScore = 0;
        let maxThrottleRate = 0;
        let prevThrottle = 0;
        
        for (let i = startIdx; i <= endIdx; i++) {
            const throttle = this.samples[i].throttle;
            const rate = Math.abs(throttle - prevThrottle);
            
            if (rate > maxThrottleRate) {
                maxThrottleRate = rate;
            }
            
            if (throttle > 50 && !tapFound) {
                tapFound = true;
                tapIndex = i;
            }
            
            // Calculate smoothness (lower rate variance = smoother)
            if (i > startIdx + 1) {
                smoothnessScore += Math.abs(rate - this.samples[i-1].throttle + this.samples[i-2].throttle);
            }
            
            prevThrottle = throttle;
        }
        
        // Normalize smoothness (lower is better)
        smoothnessScore = smoothnessScore / (endIdx - startIdx);
        
        return {
            tapIndex: tapIndex,
            smoothness: Math.max(0, 1 - smoothnessScore / 20),
            maxThrottleRate: maxThrottleRate
        };
    }
    
    calculateExitEfficiency(corner) {
        // Compare exit speed to theoretical maximum based on corner radius
        const theoreticalSpeed = Math.sqrt(15 * 1.2 * corner.radius);
        return corner.exitSpeed / theoreticalSpeed;
    }
    
    calculateAccelerationRate(corner) {
        // Calculate average acceleration from apex to exit
        const startIdx = corner.apexIndex;
        const endIdx = corner.exitIndex;
        const duration = (this.samples[endIdx].timestamp - this.samples[startIdx].timestamp) / 1000;
        
        if (duration === 0) return 0;
        
        const speedDelta = corner.exitSpeed - corner.apexSpeed;
        return speedDelta / duration; // mph/s
    }
    
    isTypeICorner(corner) {
        // Check if this corner leads to a significant straight
        const exitIdx = corner.exitIndex;
        const lookAhead = 200; // samples
        
        if (exitIdx + lookAhead >= this.samples.length) return false;
        
        // Check if speed continues to increase significantly
        const exitSpeed = corner.exitSpeed;
        const futureSpeed = this.samples[Math.min(exitIdx + lookAhead, this.samples.length - 1)].speed;
        
        return (futureSpeed - exitSpeed) > 30; // mph gain indicates a straight
    }
    
    calculatePotentialGain(corner, efficiency) {
        // Calculate potential speed gain based on efficiency
        // Based on Going Faster! Chapter 8 findings
        const idealEfficiency = 0.95;
        const currentGain = efficiency * 100;
        const potentialImprovement = (idealEfficiency - efficiency) * 100;
        
        // Convert to mph gain (rough estimate)
        const mphGain = potentialImprovement * 0.3;
        
        // Calculate time gain on following straight
        // Assuming 1 mph = 1.5 ft/s advantage
        const straightLength = this.estimateStraightLength(corner);
        const timeGain = (mphGain * 1.5 * straightLength) / (corner.exitSpeed * 1.5);
        
        return {
            mphGain: mphGain,
            timeGain: timeGain,
            priority: mphGain > 2 ? 'HIGH' : 'MEDIUM'
        };
    }
    
    estimateStraightLength(corner) {
        // Measure distance from exit to next corner
        const exitIdx = corner.exitIndex;
        let distance = 0;
        const maxSamples = 300;
        
        for (let i = exitIdx + 1; i < Math.min(exitIdx + maxSamples, this.samples.length - 1); i++) {
            const dx = this.samples[i].positionX - this.samples[i-1].positionX;
            const dz = this.samples[i].positionZ - this.samples[i-1].positionZ;
            distance += Math.sqrt(dx * dx + dz * dz);
        }
        
        return distance * 3.28084; // Convert to feet
    }
}
```

### 5.2 Physics-Based Exit Speed Formula

From "Going Faster!", Chapter 2:

> *"The equation that ties these two interrelated facts together is:*
> $$15GR = mph^2$$
> *G represents the car's maximum cornering force, where G is the force of gravity. R represents the radius of the corner in feet."*

APEX uses this equation to determine optimal exit speed:

```javascript
function calculateOptimalExitSpeed(radius, maxG = 1.2) {
    // v = sqrt(15 * G * R)
    return Math.sqrt(15 * maxG * radius);
}

function calculateSpeedLossOnStraight(entrySpeed, exitSpeed, distance) {
    // Average speed determines time
    const avgSpeed = (entrySpeed + exitSpeed) / 2;
    const timeSeconds = (distance / 5280) / (avgSpeed / 3600);
    return timeSeconds;
}
```

---

## 6. Braking & Entering Analysis

### 6.1 Braking Zone Analysis

```javascript
class BrakingAnalyzer {
    constructor(samples, corners) {
        this.samples = samples;
        this.corners = corners;
        this.maxBrakingG = this.findMaxBrakingG();
    }
    
    analyzeBraking() {
        const results = [];
        
        for (const corner of this.corners) {
            const brakeData = this.analyzeBrakingZone(corner);
            const thresholdPercent = this.calculateThresholdPercent(brakeData);
            
            results.push({
                corner: corner.number,
                brakePointIndex: corner.brakePointIndex,
                brakeDistance: brakeData.distance,
                peakBrakeG: brakeData.peakG,
                thresholdPercent: thresholdPercent,
                trailBrakeOverlap: corner.trailBrakeOverlap,
                snapOffDetected: this.detectSnapOff(corner),
                brakeStability: this.calculateBrakeStability(corner),
                optimalBrakePoint: this.findOptimalBrakePoint(corner)
            });
        }
        
        return results;
    }
    
    analyzeBrakingZone(corner) {
        const startIdx = corner.brakePointIndex;
        const endIdx = corner.turnInIndex;
        
        let totalDistance = 0;
        let maxG = 0;
        
        for (let i = startIdx + 1; i <= endIdx && i < this.samples.length; i++) {
            const dx = this.samples[i].positionX - this.samples[i-1].positionX;
            const dz = this.samples[i].positionZ - this.samples[i-1].positionZ;
            totalDistance += Math.sqrt(dx * dx + dz * dz);
            
            const brakingG = Math.abs(this.samples[i].accelerationZ);
            if (brakingG > maxG && this.samples[i].brake > 10) {
                maxG = brakingG;
            }
        }
        
        return {
            distance: totalDistance * 3.28084, // feet
            peakG: maxG
        };
    }
    
    calculateThresholdPercent(brakeData) {
        // Calculate % of maximum braking capability
        // From Going Faster! Chapter 5
        if (this.maxBrakingG === 0) return 0;
        return (brakeData.peakG / this.maxBrakingG) * 100;
    }
    
    findMaxBrakingG() {
        let maxG = 0;
        for (const sample of this.samples) {
            if (sample.brake > 10) {
                const g = Math.abs(sample.accelerationZ);
                if (g > maxG) maxG = g;
            }
        }
        return maxG;
    }
    
    detectSnapOff(corner) {
        // Check if brake pressure drops suddenly at turn-in
        const turnInIdx = corner.turnInIndex;
        if (turnInIdx < 5 || turnInIdx >= this.samples.length) return false;
        
        const brakeBefore = this.samples[turnInIdx - 1].brake;
        const brakeAtTurnIn = this.samples[turnInIdx].brake;
        const brakeAfter = this.samples[Math.min(turnInIdx + 2, this.samples.length - 1)].brake;
        
        // Snap-off: rapid decrease in brake pressure
        const dropRate = (brakeBefore - brakeAtTurnIn) / brakeBefore;
        return dropRate > 0.8 && brakeAfter < 5;
    }
    
    calculateBrakeStability(corner) {
        // Measure how stable brake pressure is during braking
        const startIdx = corner.brakePointIndex;
        const endIdx = corner.turnInIndex;
        
        let mean = 0;
        let count = 0;
        for (let i = startIdx; i <= endIdx && i < this.samples.length; i++) {
            mean += this.samples[i].brake;
            count++;
        }
        mean /= count;
        
        let variance = 0;
        for (let i = startIdx; i <= endIdx && i < this.samples.length; i++) {
            variance += Math.pow(this.samples[i].brake - mean, 2);
        }
        variance /= count;
        
        // Higher variance = less stable
        return Math.max(0, 1 - Math.sqrt(variance) / 20);
    }
    
    findOptimalBrakePoint(corner) {
        // From "The Procedure" in Going Faster! Chapter 5
        // Find the latest possible brake point that still allows proper cornering
        
        // Use the current brake point as starting point
        const currentIdx = corner.brakePointIndex;
        let optimalIdx = currentIdx;
        let bestExitSpeed = 0;
        
        // Search for later brake points (moving toward the corner)
        const searchRange = 50;
        for (let i = currentIdx + 1; i < Math.min(currentIdx + searchRange, this.samples.length - 1); i++) {
            // Simulate braking from this point
            // If exit speed improves, this is better
            const exitSpeed = this.simulateBrakePoint(i, corner);
            if (exitSpeed > bestExitSpeed) {
                bestExitSpeed = exitSpeed;
                optimalIdx = i;
            }
        }
        
        return optimalIdx;
    }
    
    simulateBrakePoint(proposedIdx, corner) {
        // Simplified simulation of braking performance
        // Based on Going Faster! Chapter 5 calculations
        const samples = this.samples;
        const startIdx = proposedIdx;
        const endIdx = corner.turnInIndex;
        
        if (startIdx >= endIdx) return corner.exitSpeed;
        
        // Get initial speed
        const initialSpeed = samples[startIdx].speed;
        
        // Calculate braking distance available
        let distance = 0;
        for (let i = startIdx + 1; i <= endIdx && i < samples.length; i++) {
            const dx = samples[i].positionX - samples[i-1].positionX;
            const dz = samples[i].positionZ - samples[i-1].positionZ;
            distance += Math.sqrt(dx * dx + dz * dz);
        }
        distance *= 3.28084; // feet
        
        // Use kinematics: vf^2 = vi^2 - 2*a*d
        const decelG = this.maxBrakingG * 0.85; // 85% of max braking
        const decelFps = decelG * 32.2; // ft/s^2
        const viFps = initialSpeed * 1.46667; // mph to ft/s
        const vfFps = Math.sqrt(Math.max(0, viFps*viFps - 2*decelFps*distance));
        
        // Convert back to mph
        return vfFps / 1.46667;
    }
}
```

### 6.2 Trail-Braking Analysis

From "Going Faster!", Chapter 5:

> *"The question is not if you're going to do it, but how."*

```javascript
class TrailBrakingAnalyzer {
    constructor(samples, corners) {
        this.samples = samples;
        this.corners = corners;
    }
    
    analyzeTrailBraking() {
        const results = [];
        
        for (const corner of this.corners) {
            const trailData = this.analyzeTrailBrakingZone(corner);
            
            results.push({
                corner: corner.number,
                overlap: corner.trailBrakeOverlap,
                brakeAtApex: corner.apexBrakePressure,
                steeringAtApex: corner.apexSteeringAngle,
                quality: this.assessTrailBrakeQuality(trailData),
                potentialImprovement: this.calculateTrailBrakeImprovement(trailData)
            });
        }
        
        return results;
    }
    
    analyzeTrailBrakingZone(corner) {
        const turnInIdx = corner.turnInIndex;
        const apexIdx = corner.apexIndex;
        const samples = this.samples;
        
        // Track brake and steering together
        const data = [];
        for (let i = turnInIdx; i <= apexIdx && i < samples.length; i++) {
            data.push({
                brake: samples[i].brake,
                steering: Math.abs(samples[i].steering),
                speed: samples[i].speed
            });
        }
        
        // Find the point where brake and steering overlap most
        let maxOverlapIndex = 0;
        let maxOverlap = 0;
        for (let i = 1; i < data.length; i++) {
            const overlap = data[i].brake * data[i].steering;
            if (overlap > maxOverlap) {
                maxOverlap = overlap;
                maxOverlapIndex = i;
            }
        }
        
        // Calculate brake release rate relative to steering rate
        const brakeReleaseRate = (data[0].brake - data[data.length-1].brake) / data.length;
        const steeringIncreaseRate = (data[data.length-1].steering - data[0].steering) / data.length;
        
        return {
            maxOverlapIndex: maxOverlapIndex,
            maxOverlapValue: maxOverlap,
            brakeReleaseRate: brakeReleaseRate,
            steeringIncreaseRate: steeringIncreaseRate,
            balance: brakeReleaseRate / (steeringIncreaseRate || 0.01)
        };
    }
    
    assessTrailBrakeQuality(trailData) {
        // Assess quality based on Going Faster! Chapter 5 principles
        const { balance, maxOverlapValue } = trailData;
        
        // Ideal: brake release and steering increase are balanced
        // Too much brake: understeer
        // Too little brake: oversteer
        const idealBalance = 1.0;
        const balanceScore = Math.max(0, 1 - Math.abs(balance - idealBalance) / idealBalance);
        
        // Should have significant overlap
        const overlapScore = Math.min(1, maxOverlapValue / 1000);
        
        const quality = (balanceScore * 0.6 + overlapScore * 0.4) * 100;
        
        if (quality > 80) return 'EXCELLENT';
        if (quality > 60) return 'GOOD';
        if (quality > 40) return 'FAIR';
        return 'POOR';
    }
    
    calculateTrailBrakeImprovement(trailData) {
        // Calculate potential lap time improvement
        // Based on Going Faster! Chapter 5 calculations
        
        const { balance, maxOverlapValue } = trailData;
        const idealBalance = 1.0;
        
        // How far from ideal balance
        const balanceDeviation = Math.abs(balance - idealBalance) / idealBalance;
        
        // Time loss per corner based on balance deviation
        // Rough estimate: 0.1s per 0.5 balance deviation
        const timeLoss = balanceDeviation * 0.2;
        
        return {
            timeLoss: timeLoss,
            priority: timeLoss > 0.1 ? 'HIGH' : 'MEDIUM'
        };
    }
}
```

---

## 7. Tire Management Analysis

### 7.1 Tire Slip Analysis

From "Going Faster!", Chapter 13:

> *"The coefficient of friction (CF) is simply a number you can use to quickly compare one tire's ability against another."*

```javascript
class TireAnalyzer {
    constructor(samples) {
        this.samples = samples;
        this.tirePositions = ['FL', 'FR', 'RL', 'RR'];
        this.optimalTempRange = { min: 200, max: 240 }; // Fahrenheit
    }
    
    analyzeTires() {
        const results = {
            slipRatios: {},
            slipAngles: {},
            temperatures: {},
            wear: {},
            issues: []
        };
        
        for (const pos of this.tirePositions) {
            const slipRatioKey = `slipRatio${pos}`;
            const slipAngleKey = `slipAngle${pos}`;
            const tempKey = `temp${pos}`;
            const wearKey = `wear${pos}`;
            
            results.slipRatios[pos] = this.analyzeSlipRatio(slipRatioKey);
            results.slipAngles[pos] = this.analyzeSlipAngle(slipAngleKey);
            results.temperatures[pos] = this.analyzeTemperature(tempKey);
            results.wear[pos] = this.analyzeWear(wearKey);
        }
        
        // Detect issues
        results.issues = this.detectTireIssues(results);
        
        return results;
    }
    
    analyzeSlipRatio(key) {
        const values = [];
        for (const sample of this.samples) {
            if (sample[key] !== undefined) {
                values.push(Math.abs(sample[key]));
            }
        }
        
        if (values.length === 0) return { max: 0, avg: 0, percent: 0 };
        
        const max = Math.max(...values);
        const avg = values.reduce((a, b) => a + b, 0) / values.length;
        const percent = values.filter(v => v > 1.0).length / values.length;
        
        return { max, avg, percent };
    }
    
    analyzeSlipAngle(key) {
        const values = [];
        for (const sample of this.samples) {
            if (sample[key] !== undefined) {
                values.push(Math.abs(sample[key]));
            }
        }
        
        if (values.length === 0) return { max: 0, avg: 0 };
        
        const max = Math.max(...values);
        const avg = values.reduce((a, b) => a + b, 0) / values.length;
        
        return { max, avg };
    }
    
    analyzeTemperature(key) {
        const values = [];
        for (const sample of this.samples) {
            if (sample[key] !== undefined && sample[key] > 0) {
                values.push(sample[key]);
            }
        }
        
        if (values.length === 0) return { avg: 0, max: 0, min: 0, inRange: false };
        
        const avg = values.reduce((a, b) => a + b, 0) / values.length;
        const max = Math.max(...values);
        const min = Math.min(...values);
        const inRange = avg >= this.optimalTempRange.min && 
                        avg <= this.optimalTempRange.max;
        
        return { avg, max, min, inRange };
    }
    
    analyzeWear(key) {
        const values = [];
        for (const sample of this.samples) {
            if (sample[key] !== undefined) {
                values.push(sample[key]);
            }
        }
        
        if (values.length === 0) return { max: 0, avg: 0, wearPercent: 0 };
        
        const max = Math.max(...values);
        const avg = values.reduce((a, b) => a + b, 0) / values.length;
        const wearPercent = (max / 100) * 100; // Assuming 100 is new, 0 is worn
        
        return { max, avg, wearPercent };
    }
    
    detectTireIssues(results) {
        const issues = [];
        
        // Check slip ratios
        for (const pos of this.tirePositions) {
            const slip = results.slipRatios[pos];
            if (slip.percent > 0.2) {
                issues.push({
                    tire: pos,
                    issue: 'Excessive wheelspin',
                    severity: 'HIGH',
                    detail: `${(slip.percent * 100).toFixed(1)}% of corners have slip ratio > 1.0`
                });
            }
        }
        
        // Check temperatures
        for (const pos of this.tirePositions) {
            const temp = results.temperatures[pos];
            if (temp.avg > 0) {
                if (temp.avg < this.optimalTempRange.min) {
                    issues.push({
                        tire: pos,
                        issue: 'Tire too cold',
                        severity: 'MEDIUM',
                        detail: `${temp.avg.toFixed(0)}°F (optimal: ${this.optimalTempRange.min}-${this.optimalTempRange.max}°F)`
                    });
                } else if (temp.avg > this.optimalTempRange.max) {
                    issues.push({
                        tire: pos,
                        issue: 'Tire overheating',
                        severity: 'HIGH',
                        detail: `${temp.avg.toFixed(0)}°F (optimal: ${this.optimalTempRange.min}-${this.optimalTempRange.max}°F)`
                    });
                }
            }
        }
        
        // Check wear
        for (const pos of this.tirePositions) {
            const wear = results.wear[pos];
            if (wear.wearPercent > 80) {
                issues.push({
                    tire: pos,
                    issue: 'Excessive tire wear',
                    severity: 'MEDIUM',
                    detail: `${wear.wearPercent.toFixed(1)}% worn`
                });
            }
        }
        
        return issues;
    }
}
```

### 7.2 Coefficient of Friction Analysis

From "Going Faster!", Chapter 13:

> *"CF, or coefficient of friction, is simply a number you can use to quickly compare one tire's ability against another."*

```javascript
function calculateCoefficientOfFriction(verticalLoad, tractiveForce) {
    // CF = Tractive Force / Vertical Load
    if (verticalLoad === 0) return 0;
    return tractiveForce / verticalLoad;
}

function analyzeTireGripOverTime(samples) {
    const gripData = [];
    let baseLoad = 400; // approximate tire load in lbs
    
    for (const sample of samples) {
        // Lateral grip
        const lateralForce = sample.accelerationX * (baseLoad / 1);
        const lateralCF = calculateCoefficientOfFriction(baseLoad, lateralForce);
        
        // Braking grip
        const brakingForce = Math.abs(sample.accelerationZ) * (baseLoad / 1);
        const brakingCF = calculateCoefficientOfFriction(baseLoad, brakingForce);
        
        gripData.push({
            timestamp: sample.timestamp,
            lateralCF: lateralCF,
            brakingCF: brakingCF,
            combined: Math.sqrt(lateralCF * lateralCF + brakingCF * brakingCF)
        });
    }
    
    return gripData;
}
```

---

## 8. Shifting Analysis

### 8.1 Gear Selection Analysis

From "Going Faster!", Chapter 6:

> *"You decide which gear is the proper gear for a corner simply by picking one and trying it."*

```javascript
class ShiftingAnalyzer {
    constructor(samples, corners) {
        this.samples = samples;
        this.corners = corners;
        this.maxRPM = this.findMaxRPM();
        this.optimalRPMRange = { min: 0.65, max: 0.95 }; // % of max RPM
    }
    
    analyzeShifting() {
        const results = [];
        
        for (const corner of this.corners) {
            const gearData = this.analyzeGearUsage(corner);
            const shiftQuality = this.analyzeShiftQuality(corner);
            
            results.push({
                corner: corner.number,
                gearUsed: corner.gearUsed,
                minRPM: corner.minRPM,
                exitRPM: corner.exitRPM,
                optimalGear: gearData.recommendedGear,
                inPowerband: corner.minRPM >= this.maxRPM * this.optimalRPMRange.min &&
                             corner.exitRPM <= this.maxRPM * this.optimalRPMRange.max,
                shiftQuality: shiftQuality,
                issue: this.identifyShiftIssue(corner)
            });
        }
        
        return results;
    }
    
    findMaxRPM() {
        let max = 0;
        for (const sample of this.samples) {
            if (sample.engineRpm > max) {
                max = sample.engineRpm;
            }
        }
        return max || 7000; // Default if not found
    }
    
    analyzeGearUsage(corner) {
        // Calculate RPM in different gears
        const currentRPM = corner.apexRPM;
        const gear = corner.gearUsed || 1;
        
        // Estimate RPM in adjacent gears (rough approximation)
        const gearRatio = 1.25; // Average ratio difference between gears
        const lowerGearRPM = currentRPM * gearRatio;
        const higherGearRPM = currentRPM / gearRatio;
        
        // Recommend gear that keeps RPM in powerband
        let recommendedGear = gear;
        if (lowerGearRPM <= this.maxRPM * this.optimalRPMRange.max) {
            // Lower gear might be better (more RPM)
            recommendedGear = Math.max(1, gear - 1);
        } else if (higherGearRPM >= this.maxRPM * this.optimalRPMRange.min) {
            // Higher gear might be better
            recommendedGear = Math.min(6, gear + 1);
        }
        
        return {
            recommendedGear: recommendedGear,
            lowerGearRPM: lowerGearRPM,
            higherGearRPM: higherGearRPM
        };
    }
    
    analyzeShiftQuality(corner) {
        // Analyze downshift quality
        const brakeIdx = corner.brakePointIndex;
        const turnInIdx = corner.turnInIndex;
        
        let blipQuality = 1.0;
        let brakeModulation = 1.0;
        let timing = 1.0;
        
        // Check for smooth downshifts
        // Look for sudden RPM changes
        for (let i = brakeIdx; i < turnInIdx && i < this.samples.length - 1; i++) {
            const rpmChange = Math.abs(this.samples[i+1].engineRpm - this.samples[i].engineRpm);
            if (rpmChange > 500) {
                // Sudden RPM change indicates clutch engagement
                const brakeDrop = Math.abs(this.samples[i+1].brake - this.samples[i].brake);
                if (brakeDrop > 20) {
                    // Brake pressure dropped during shift - poor blip
                    blipQuality -= 0.1;
                }
            }
        }
        
        return {
            blipQuality: Math.max(0, Math.min(1, blipQuality)),
            brakeModulation: Math.max(0, Math.min(1, brakeModulation)),
            timing: Math.max(0, Math.min(1, timing)),
            overall: (blipQuality + brakeModulation + timing) / 3
        };
    }
    
    identifyShiftIssue(corner) {
        const minRPM = corner.minRPM;
        const exitRPM = corner.exitRPM;
        const maxRPM = this.maxRPM;
        
        if (minRPM < maxRPM * 0.5) {
            return {
                issue: 'Gear too high',
                severity: 'HIGH',
                message: `Min RPM ${minRPM.toFixed(0)} is below powerband. Downshift.`
            };
        }
        
        if (exitRPM > maxRPM * 0.95) {
            return {
                issue: 'Gear too low - hitting rev limiter',
                severity: 'HIGH',
                message: `Exit RPM ${exitRPM.toFixed(0)} near redline. Upshift.`
            };
        }
        
        if (exitRPM < maxRPM * 0.6) {
            return {
                issue: 'Gear slightly high',
                severity: 'MEDIUM',
                message: `Exit RPM ${exitRPM.toFixed(0)} below powerband.`
            };
        }
        
        return {
            issue: 'Optimal gear selection',
            severity: 'LOW',
            message: 'Gear selection is appropriate.'
        };
    }
}
```

### 8.2 RPM and Powerband Analysis

```javascript
function analyzePowerbandUsage(samples, maxRPM) {
    const powerbandMin = maxRPM * 0.65;
    const powerbandMax = maxRPM * 0.95;
    
    let timeInPowerband = 0;
    let totalTime = 0;
    let previousTimestamp = 0;
    
    for (const sample of samples) {
        if (previousTimestamp > 0) {
            const dt = (sample.timestamp - previousTimestamp) / 1000;
            totalTime += dt;
            
            if (sample.engineRpm >= powerbandMin && sample.engineRpm <= powerbandMax) {
                timeInPowerband += dt;
            }
        }
        previousTimestamp = sample.timestamp;
    }
    
    const percentInPowerband = totalTime > 0 ? (timeInPowerband / totalTime) * 100 : 0;
    
    return {
        percentInPowerband: percentInPowerband,
        powerbandMin: powerbandMin,
        powerbandMax: powerbandMax,
        maxRPM: maxRPM,
        efficiency: percentInPowerband / 100
    };
}
```

---

## 9. Friction Circle Analysis

### 9.1 Friction Circle Generation

From "Going Faster!", Chapter 5:

> *"The friction circle allows you to think about what happens to one ability of the tire as you increase or decrease the demands for another ability."*

```javascript
class FrictionCircleAnalyzer {
    constructor(samples) {
        this.samples = samples;
        this.maxG = this.findMaxG();
    }
    
    findMaxG() {
        let maxG = 0.1;
        for (const sample of this.samples) {
            const lateral = Math.abs(sample.accelerationX);
            const longitudinal = Math.abs(sample.accelerationZ);
            const combined = Math.sqrt(lateral * lateral + longitudinal * longitudinal);
            if (combined > maxG) {
                maxG = combined;
            }
        }
        return maxG;
    }
    
    generateFrictionCircle() {
        const points = [];
        const cornerPoints = [];
        
        for (const sample of this.samples) {
            // Normalize G-forces
            const latG = sample.accelerationX / this.maxG;
            const longG = sample.accelerationZ / this.maxG;
            
            // Determine phase (braking, cornering, accelerating)
            let phase = 'straight';
            if (sample.brake > 10 && Math.abs(latG) > 0.1) {
                phase = 'brake-turn';
            } else if (sample.brake > 10) {
                phase = 'braking';
            } else if (sample.throttle > 50 && Math.abs(latG) > 0.1) {
                phase = 'accelerate-turn';
            } else if (sample.throttle > 50) {
                phase = 'accelerating';
            } else if (Math.abs(latG) > 0.1) {
                phase = 'cornering';
            }
            
            // Add to friction circle
            const point = {
                latG: latG,
                longG: longG,
                phase: phase,
                speed: sample.speed,
                timestamp: sample.timestamp
            };
            points.push(point);
            
            // Add corner points separately
            if (phase === 'brake-turn' || phase === 'accelerate-turn') {
                cornerPoints.push(point);
            }
        }
        
        return {
            points: points,
            cornerPoints: cornerPoints,
            maxG: this.maxG,
            utilization: this.calculateUtilization(points)
        };
    }
    
    calculateUtilization(points) {
        // Calculate how much of the friction circle is being used
        // Going Faster! Chapter 5: drivers should use all available grip
        
        let totalPoints = points.length;
        let usedPoints = 0;
        
        for (const point of points) {
            const radius = Math.sqrt(point.latG * point.latG + point.longG * point.longG);
            if (radius > 0.7) {
                usedPoints++;
            }
        }
        
        return {
            highUtilization: totalPoints > 0 ? (usedPoints / totalPoints) * 100 : 0,
            averageRadius: points.reduce((sum, p) => 
                sum + Math.sqrt(p.latG*p.latG + p.longG*p.longG), 0) / totalPoints
        };
    }
}
```

---

## 10. Performance Summary & Recommendations

### 10.1 Overall Performance Score

```javascript
class PerformanceSummary {
    constructor(samples, corners, analysisResults) {
        this.samples = samples;
        this.corners = corners;
        this.results = analysisResults;
        this.maxG = this.results.frictionCircle?.maxG || 1.2;
    }
    
    generateSummary() {
        // Calculate overall performance metrics
        const bestLap = this.findBestLap();
        const consistency = this.calculateConsistency();
        const lineQuality = this.calculateLineQuality();
        const brakingScore = this.calculateBrakingScore();
        const exitSpeedScore = this.calculateExitSpeedScore();
        
        // Overall score (0-100)
        const overallScore = (
            consistency * 25 +
            lineQuality * 25 +
            brakingScore * 25 +
            exitSpeedScore * 25
        ) / 100;
        
        return {
            bestLap: bestLap,
            consistency: consistency,
            lineQuality: lineQuality,
            brakingScore: brakingScore,
            exitSpeedScore: exitSpeedScore,
            overallScore: overallScore,
            grade: this.calculateGrade(overallScore),
            maxG: this.maxG,
            totalLaps: this.results.lapTimes?.length || 0
        };
    }
    
    findBestLap() {
        const lapTimes = this.results.lapTimes || [];
        if (lapTimes.length === 0) return 0;
        return Math.min(...lapTimes);
    }
    
    calculateConsistency() {
        const lapTimes = this.results.lapTimes || [];
        if (lapTimes.length < 2) return 0;
        
        const avg = lapTimes.reduce((a, b) => a + b, 0) / lapTimes.length;
        const variance = lapTimes.reduce((sum, t) => sum + Math.pow(t - avg, 2), 0) / lapTimes.length;
        const stdDev = Math.sqrt(variance);
        
        // Score: 100 - (stdDev / avg * 100)
        return Math.max(0, 100 - (stdDev / avg) * 100);
    }
    
    calculateLineQuality() {
        // Based on early/late apex detection
        let earlyApexCount = 0;
        let lateApexCount = 0;
        let totalCorners = 0;
        
        for (const corner of this.corners) {
            totalCorners++;
            if (corner.earlyApex) earlyApexCount++;
            if (corner.lateApex) lateApexCount++;
        }
        
        if (totalCorners === 0) return 0;
        
        const perfectCorners = totalCorners - earlyApexCount - lateApexCount;
        return (perfectCorners / totalCorners) * 100;
    }
    
    calculateBrakingScore() {
        let totalScore = 0;
        let count = 0;
        
        for (const corner of this.corners) {
            const threshold = this.results.braking.find(b => b.corner === corner.number)?.thresholdPercent || 0;
            const trail = corner.trailBrakeOverlap || 0;
            
            // Score: threshold (50%) + trail-braking (50%)
            const cornerScore = (threshold / 80) * 50 + (trail / 0.5) * 50;
            totalScore += Math.min(100, cornerScore);
            count++;
        }
        
        return count > 0 ? totalScore / count : 0;
    }
    
    calculateExitSpeedScore() {
        let totalScore = 0;
        let count = 0;
        
        for (const corner of this.corners) {
            // Calculate theoretical exit speed based on corner radius
            const optimalSpeed = Math.sqrt(15 * this.maxG * corner.radius);
            const efficiency = optimalSpeed > 0 ? (corner.exitSpeed / optimalSpeed) * 100 : 0;
            
            // TAP distance score
            const tapScore = Math.max(0, 100 - Math.abs(corner.tapDistance) * 2);
            
            const cornerScore = efficiency * 0.6 + tapScore * 0.4;
            totalScore += Math.min(100, cornerScore);
            count++;
        }
        
        return count > 0 ? totalScore / count : 0;
    }
    
    calculateGrade(score) {
        if (score >= 95) return 'A+';
        if (score >= 90) return 'A';
        if (score >= 85) return 'A-';
        if (score >= 80) return 'B+';
        if (score >= 75) return 'B';
        if (score >= 70) return 'B-';
        if (score >= 65) return 'C+';
        if (score >= 60) return 'C';
        if (score >= 55) return 'C-';
        if (score >= 50) return 'D+';
        if (score >= 45) return 'D';
        return 'F';
    }
}
```

### 10.2 Priority Recommendations

```javascript
class RecommendationEngine {
    constructor(corners, analysisResults) {
        this.corners = corners;
        this.results = analysisResults;
    }
    
    generateRecommendations() {
        const recommendations = [];
        
        // 1. Exit Speed Recommendations
        const exitRecommendations = this.generateExitSpeedRecommendations();
        recommendations.push(...exitRecommendations);
        
        // 2. Braking Recommendations
        const brakingRecommendations = this.generateBrakingRecommendations();
        recommendations.push(...brakingRecommendations);
        
        // 3. Line Recommendations
        const lineRecommendations = this.generateLineRecommendations();
        recommendations.push(...lineRecommendations);
        
        // 4. Shift Recommendations
        const shiftRecommendations = this.generateShiftRecommendations();
        recommendations.push(...shiftRecommendations);
        
        // 5. Tire Recommendations
        const tireRecommendations = this.generateTireRecommendations();
        recommendations.push(...tireRecommendations);
        
        // Sort by priority and impact
        return this.sortAndPrioritize(recommendations);
    }
    
    generateExitSpeedRecommendations() {
        const recommendations = [];
        const exitData = this.results.exitSpeed || [];
        
        for (const data of exitData) {
            if (data.potentialGain?.mphGain > 2) {
                recommendations.push({
                    category: 'Exit Speed',
                    corner: data.corner,
                    title: `Increase exit speed at Turn ${data.corner}`,
                    description: `Exit speed ${data.exitSpeed.toFixed(1)} mph. Potential gain ${data.potentialGain.mphGain.toFixed(1)} mph.`,
                    action: 'Apply throttle earlier and more smoothly. Squeeze the power on as you unwind the steering wheel.',
                    priority: data.priority === 'HIGH' ? 1 : 2,
                    impact: data.potentialGain.timeGain || 0.3,
                    quote: '"The biggest gain in lap time comes from corner exit speed." — Going Faster!, Chapter 1'
                });
            }
        }
        
        return recommendations;
    }
    
    generateBrakingRecommendations() {
        const recommendations = [];
        const brakingData = this.results.braking || [];
        
        for (const data of brakingData) {
            if (data.thresholdPercent < 75) {
                recommendations.push({
                    category: 'Braking',
                    corner: data.corner,
                    title: `Improve threshold braking at Turn ${data.corner}`,
                    description: `Using ${data.thresholdPercent.toFixed(0)}% of available braking.`,
                    action: 'Push harder on the brake pedal. Squeeze the brakes on harder and more progressively.',
                    priority: data.thresholdPercent < 60 ? 1 : 2,
                    impact: 0.2,
                    quote: '"If you're braking at the 300 mark with no problem, do you move the next spot to the 200? No way. You\'ve got to take small steps to find out where that limit is." — Danny Sullivan, Going Faster!, Chapter 1'
                });
            }
            
            if (data.trailBrakeOverlap < 0.3) {
                recommendations.push({
                    category: 'Trail-Braking',
                    corner: data.corner,
                    title: `Improve trail-braking at Turn ${data.corner}`,
                    description: `${(data.trailBrakeOverlap * 100).toFixed(0)}% brake-steering overlap.`,
                    action: 'Carry the brakes past the turn-in point. Gradually release brake pressure as you add steering lock.',
                    priority: data.trailBrakeOverlap < 0.15 ? 1 : 2,
                    impact: 0.15,
                    quote: '"The question is not if you\'re going to trail-brake, but how." — Going Faster!, Chapter 5'
                });
            }
        }
        
        return recommendations;
    }
    
    generateLineRecommendations() {
        const recommendations = [];
        
        for (const corner of this.corners) {
            if (corner.earlyApex) {
                recommendations.push({
                    category: 'Line',
                    corner: corner.number,
                    title: `Correct early apex at Turn ${corner.number}`,
                    description: 'Steering correction detected after apex.',
                    action: 'Turn in later. Aim for a later apex point. Hold the steering wheel steady through the corner.',
                    priority: 1,
                    impact: 0.25,
                    quote: '"The primary symptom of early apexing is the need to increase the amount of steering effort past the apex." — Going Faster!, Chapter 2'
                });
            }
            
            if (corner.lateApex) {
                recommendations.push({
                    category: 'Line',
                    corner: corner.number,
                    title: `Correct late apex at Turn ${corner.number}`,
                    description: 'Unused track at exit indicates late apex.',
                    action: 'Turn in earlier. Move the apex point forward. Use all the track at exit.',
                    priority: 2,
                    impact: 0.15,
                    quote: '"If there is road left at the exit of the corner, you have chosen a turn-in and apex that were too late." — Going Faster!, Chapter 2'
                });
            }
        }
        
        return recommendations;
    }
    
    generateShiftRecommendations() {
        const recommendations = [];
        const shiftData = this.results.shifting || [];
        
        for (const data of shiftData) {
            if (data.issue?.severity === 'HIGH') {
                recommendations.push({
                    category: 'Shifting',
                    corner: data.corner,
                    title: data.issue.issue,
                    description: data.issue.message,
                    action: data.issue.issue.includes('downshift') ? 
                        'Downshift one gear before turn-in.' :
                        'Upshift one gear. Use a higher gear through the corner.',
                    priority: 1,
                    impact: 0.2,
                    quote: '"You downshift to get the car in the proper gear to exit the corner." — Going Faster!, Chapter 6'
                });
            }
        }
        
        return recommendations;
    }
    
    generateTireRecommendations() {
        const recommendations = [];
        const tireIssues = this.results.tires?.issues || [];
        
        for (const issue of tireIssues) {
            if (issue.severity === 'HIGH' || issue.severity === 'MEDIUM') {
                recommendations.push({
                    category: 'Tire Management',
                    corner: 'All',
                    title: issue.issue,
                    description: `Tire ${issue.tire}: ${issue.detail}`,
                    action: this.getTireAction(issue),
                    priority: issue.severity === 'HIGH' ? 1 : 2,
                    impact: 0.1,
                    quote: '"The driver that has the most grip runs tires at their optimum range." — Going Faster!, Chapter 13'
                });
            }
        }
        
        return recommendations;
    }
    
    getTireAction(issue) {
        if (issue.issue.includes('wheelspin')) {
            return 'Be more progressive with throttle application. Squeeze the power on rather than stabbing it.';
        }
        if (issue.issue.includes('cold')) {
            return 'Push harder earlier in the stint to get heat into the tires. More aggressive cornering will help.';
        }
        if (issue.issue.includes('overheat')) {
            return 'Drive more smoothly. Reduce wheelspin and sliding. Consider adjusting tire pressures.';
        }
        if (issue.issue.includes('wear')) {
            return 'Reduce tire scrub. Focus on smoother inputs and less sliding.';
        }
        return 'Monitor tire performance and adjust driving style accordingly.';
    }
    
    sortAndPrioritize(recommendations) {
        // Sort by priority (1 = highest) then by impact (largest first)
        return recommendations.sort((a, b) => {
            if (a.priority !== b.priority) {
                return a.priority - b.priority;
            }
            return b.impact - a.impact;
        });
    }
}
```

---

## 11. Analysis Engine Integration

### 11.1 Main Analysis Pipeline

```javascript
class APEXAnalysisEngine {
    constructor(rawSamples) {
        this.rawSamples = rawSamples;
        this.processedSamples = [];
        this.corners = [];
        this.laps = [];
        this.results = {};
    }
    
    runAnalysis() {
        // Step 1: Preprocess data
        this.processedSamples = this.preprocessSamples(this.rawSamples);
        
        // Step 2: Detect laps
        const lapDetector = new LapDetector(this.processedSamples);
        const lapData = lapDetector.detectLaps();
        this.laps = lapData.laps;
        
        // Step 3: Detect corners
        const cornerDetector = new CornerDetector(this.processedSamples);
        this.corners = cornerDetector.detectCorners();
        
        // Step 4: Analyze exit speed
        const exitAnalyzer = new ExitSpeedAnalyzer(this.corners, this.processedSamples);
        this.results.exitSpeed = exitAnalyzer.analyzeExitSpeed();
        
        // Step 5: Analyze braking
        const brakingAnalyzer = new BrakingAnalyzer(this.processedSamples, this.corners);
        this.results.braking = brakingAnalyzer.analyzeBraking();
        
        // Step 6: Analyze trail-braking
        const trailAnalyzer = new TrailBrakingAnalyzer(this.processedSamples, this.corners);
        this.results.trailBraking = trailAnalyzer.analyzeTrailBraking();
        
        // Step 7: Analyze tires
        const tireAnalyzer = new TireAnalyzer(this.processedSamples);
        this.results.tires = tireAnalyzer.analyzeTires();
        
        // Step 8: Analyze shifting
        const shiftAnalyzer = new ShiftingAnalyzer(this.processedSamples, this.corners);
        this.results.shifting = shiftAnalyzer.analyzeShifting();
        
        // Step 9: Generate friction circle
        const frictionAnalyzer = new FrictionCircleAnalyzer(this.processedSamples);
        this.results.frictionCircle = frictionAnalyzer.generateFrictionCircle();
        
        // Step 10: Calculate lap times
        this.results.lapTimes = lapData.lapTimes;
        
        // Step 11: Generate performance summary
        const summary = new PerformanceSummary(this.processedSamples, this.corners, this.results);
        this.results.summary = summary.generateSummary();
        
        // Step 12: Generate recommendations
        const recommendations = new RecommendationEngine(this.corners, this.results);
        this.results.recommendations = recommendations.generateRecommendations();
        
        return this.results;
    }
    
    preprocessSamples(samples) {
        // Interpolate to 50Hz
        const interpolated = interpolateSamples(samples, 50);
        
        // Apply smoothing
        const smoothed = {
            speed: applySmoothing(interpolated.map(s => s.speed), 5),
            accelerationX: applySmoothing(interpolated.map(s => s.accelerationX), 3),
            accelerationZ: applySmoothing(interpolated.map(s => s.accelerationZ), 3),
            steering: applySmoothing(interpolated.map(s => s.steering), 3),
            brake: applySmoothing(interpolated.map(s => s.brake), 3),
            throttle: applySmoothing(interpolated.map(s => s.throttle), 3)
        };
        
        // Reconstruct samples
        return interpolated.map((s, i) => ({
            ...s,
            speed: smoothed.speed[i] || s.speed,
            accelerationX: smoothed.accelerationX[i] || s.accelerationX,
            accelerationZ: smoothed.accelerationZ[i] || s.accelerationZ,
            steering: smoothed.steering[i] || s.steering,
            brake: smoothed.brake[i] || s.brake,
            throttle: smoothed.throttle[i] || s.throttle
        }));
    }
}
```

### 11.2 Usage Example

```javascript
// Receive telemetry data from Forza Motorsport
const rawTelemetry = receiveTelemetryData();

// Initialize analysis engine
const engine = new APEXAnalysisEngine(rawTelemetry);

// Run full analysis
const results = engine.runAnalysis();

// Access results
console.log(`Best Lap: ${results.summary.bestLap.toFixed(3)}s`);
console.log(`Overall Score: ${results.summary.overallScore.toFixed(1)}%`);
console.log(`Grade: ${results.summary.grade}`);

// Print recommendations
for (const rec of results.recommendations) {
    console.log(`[${rec.category}] Turn ${rec.corner}: ${rec.title}`);
    console.log(`  → ${rec.action}`);
}

// Access specific metrics
for (const corner of results.corners) {
    console.log(`Turn ${corner.number}:`);
    console.log(`  Entry: ${corner.entrySpeed.toFixed(1)} mph`);
    console.log(`  Apex: ${corner.apexSpeed.toFixed(1)} mph`);
    console.log(`  Exit: ${corner.exitSpeed.toFixed(1)} mph`);
    console.log(`  Trail-brake: ${(corner.trailBrakeOverlap * 100).toFixed(0)}%`);
}
```

---

## 12. Analysis Metrics Reference

### 12.1 Complete Metric List

| Metric | Symbol | Units | Formula | "Going Faster!" Reference |
|--------|--------|-------|---------|---------------------------|
| **Speed** | $v$ | mph | From telemetry | Chapter 2, 3 |
| **Acceleration G** | $a_x$ | G | From telemetry | Chapter 2 |
| **Braking G** | $a_z$ | G | From telemetry | Chapter 2 |
| **Cornering G** | $a_y$ | G | From telemetry | Chapter 4 |
| **Radius** | $R$ | ft | $R = v^2/(15G)$ | Chapter 2 |
| **Lap Time** | $t$ | s | Telemetry timestamps | Chapter 8 |
| **Slip Angle** | $\alpha$ | deg | Tire direction vs. travel | Chapter 13 |
| **Slip Ratio** | $s$ | % | Wheel speed vs. vehicle speed | Chapter 13 |
| **Brake Threshold** | $B_t$ | % | $B_t = (G_{brake}/G_{max}) \cdot 100$ | Chapter 5 |
| **Trail-Brake Overlap** | $T_b$ | % | Brake+Steering time / Corner time | Chapter 5 |
| **TAP Distance** | $d_{tap}$ | ft | Distance from apex to throttle application | Chapter 2 |
| **Exit Efficiency** | $E_e$ | % | $E_e = v_{exit}/v_{optimal} \cdot 100$ | Chapter 2 |
| **RPM Powerband** | $P$ | % | $P = (RPM_{exit} - RPM_{min})/(RPM_{max} - RPM_{min})$ | Chapter 6 |
| **CF** | $\mu$ | - | $\mu = F_{tractive}/F_{load}$ | Chapter 13 |
| **Consistency** | $C$ | % | $C = 100 - \sigma_t/\bar{t} \cdot 100$ | Chapter 8 |

---

**Document Version**: 1.0.0
**Status**: Draft
**Last Updated**: 2026-08-23
**Author**: APEX Engineering Team