/**
 * APEX Track Library Synthesizer
 * Covertly parses stint telemetry to extract high-fidelity circuit geometry,
 * corner profiles, braking markers, gear targets, and hazard advisories.
 */

import { FM23_TRACKS } from '../data/fm23-tracks.js';
import { CornerDetector } from './corner-detector.js';
import { CornerExtractor } from './corner-extractor.js';
import { TrackMapGenerator, DRIVING_STATE } from './track-map.js';

export class TrackLibrarySynthesizer {
  constructor(options = {}) {
    this.detector = new CornerDetector(options.detector);
    this.extractor = new CornerExtractor(options.extractor);
    this.trackMapGenerator = new TrackMapGenerator(options.trackMap);
  }

  /**
   * Generates a slug ID for a track and layout combination
   * @param {string} trackName 
   * @param {string} layoutName 
   * @returns {string}
   */
  static generateTrackId(trackName, layoutName) {
    const safeTrack = String(trackName || 'unknown-track')
      .toLowerCase()
      .replace(/[^a-z0-9]+/g, '-')
      .replace(/(^-|-$)/g, '');
    const safeLayout = String(layoutName || 'full-circuit')
      .toLowerCase()
      .replace(/[^a-z0-9]+/g, '-')
      .replace(/(^-|-$)/g, '');
    return `${safeTrack}--${safeLayout}`;
  }

  /**
   * Finds matching catalog metadata from FM23 Tracks
   * @param {string} trackName 
   * @param {string} layoutName 
   * @param {number} [lapDistanceMeters] Optional lap distance fallback
   * @returns {Object} Catalog metadata
   */
  static matchCatalogTrack(trackName, layoutName, lapDistanceMeters = 0) {
    // 1. Direct name match
    if (trackName) {
      const trackObj = FM23_TRACKS.find(t => 
        t.name.toLowerCase() === trackName.toLowerCase() ||
        t.name.toLowerCase().includes(trackName.toLowerCase()) ||
        trackName.toLowerCase().includes(t.name.toLowerCase())
      );

      if (trackObj) {
        let layoutObj = null;
        if (layoutName && trackObj.layouts) {
          layoutObj = trackObj.layouts.find(l => 
            l.name.toLowerCase() === layoutName.toLowerCase() ||
            l.name.toLowerCase().includes(layoutName.toLowerCase())
          );
        }
        if (!layoutObj && trackObj.layouts?.length > 0) {
          layoutObj = trackObj.layouts[0];
        }

        return {
          trackName: trackObj.name,
          layoutName: layoutObj ? layoutObj.name : (layoutName || 'Full Circuit'),
          type: trackObj.type || 'Real',
          officialLength: layoutObj?.length || (lapDistanceMeters > 0 ? `${(lapDistanceMeters / 1000).toFixed(3)} km` : '4.500 km')
        };
      }
    }

    // 2. Fallback using lap distance approximation (within 500m)
    if (lapDistanceMeters > 500) {
      const distKm = lapDistanceMeters / 1000;
      for (const t of FM23_TRACKS) {
        for (const l of t.layouts) {
          const numMatch = l.length.match(/([0-9.]+)/);
          if (numMatch) {
            const trackLenKm = parseFloat(numMatch[1]);
            if (Math.abs(trackLenKm - distKm) < 0.4) {
              return {
                trackName: t.name,
                layoutName: l.name,
                type: t.type || 'Real',
                officialLength: l.length
              };
            }
          }
        }
      }
    }

    return {
      trackName: trackName || 'Custom Circuit',
      layoutName: layoutName || 'Grand Prix Course',
      type: 'Real',
      officialLength: lapDistanceMeters > 0 ? `${(lapDistanceMeters / 1000).toFixed(3)} km` : '4.500 km'
    };
  }

  /**
   * Synthesizes a comprehensive track profile from a stint and analysis report
   * @param {Object} params
   * @param {Array<Object>} params.samples Stint telemetry samples
   * @param {Array<Object>} [params.laps] Analyzed laps from AnalysisEngine
   * @param {Object} [params.metadata] Stint session metadata (track, layout, car, driver)
   * @param {Object} [params.analysisReport] Optional pre-computed AnalysisEngine output
   * @returns {Object} Structured Track Profile
   */
  synthesize({ samples = [], laps = [], metadata = {}, analysisReport = null }) {
    if (!samples || samples.length === 0) {
      throw new Error('Cannot synthesize track profile: empty samples');
    }

    // 1. Identify best valid lap samples
    let bestLap = null;
    if (laps && laps.length > 0) {
      const validLaps = laps.filter(l => l.isValid);
      const searchPool = validLaps.length > 0 ? validLaps : laps;
      bestLap = searchPool.reduce((best, curr) => {
        return (!best || (curr.lapTime > 0 && curr.lapTime < best.lapTime)) ? curr : best;
      }, null);
    }

    const lapSamples = (bestLap && bestLap.samples && bestLap.samples.length > 20)
      ? bestLap.samples
      : samples;

    const lapDistanceMeters = bestLap?.lapDistanceMeters || 
      (lapSamples[lapSamples.length - 1]?.timing?.distanceTraveled - lapSamples[0]?.timing?.distanceTraveled) ||
      (lapSamples.length * 15);

    // 2. Correlate with FM23 catalog metadata
    const catalog = TrackLibrarySynthesizer.matchCatalogTrack(
      metadata.trackName || metadata.track,
      metadata.layoutName || metadata.layout,
      lapDistanceMeters
    );

    const trackId = TrackLibrarySynthesizer.generateTrackId(catalog.trackName, catalog.layoutName);

    // 3. Extract apexes & corner telemetry
    const apexes = this.detector.detectApexes(lapSamples);
    const extractedCorners = this.extractor.extractAll(lapSamples, apexes);

    // 4. Build corner profile matrix
    const corners = extractedCorners.map((c, idx) => {
      const turnNum = idx + 1;
      const entrySpdKmh = (c.speed?.entryMph ? c.speed.entryMph * 1.60934 : (c.speed?.entryKmh || 0));
      const apexSpdKmh = (c.speed?.apexMph ? c.speed.apexMph * 1.60934 : (c.speed?.apexKmh || 0));
      const exitSpdKmh = (c.speed?.exitMph ? c.speed.exitMph * 1.60934 : (c.speed?.exitKmh || 0));

      // Calculate braking point distance before apex (meters)
      let brakingDistMeters = 75;
      if (c.entryIndex !== undefined && c.apexIndex !== undefined && c.entryIndex < c.apexIndex) {
        const brakeSub = lapSamples.slice(c.entryIndex, c.apexIndex + 1);
        let distAccum = 0;
        for (let i = 1; i < brakeSub.length; i++) {
          const p1 = brakeSub[i - 1].motion?.position || { x: 0, z: 0 };
          const p2 = brakeSub[i].motion?.position || { x: 0, z: 0 };
          const dx = (p2.x || 0) - (p1.x || 0);
          const dz = (p2.z || 0) - (p1.z || 0);
          distAccum += Math.sqrt(dx * dx + dz * dz);
        }
        if (distAccum > 5) {
          brakingDistMeters = Math.round(distAccum);
        }
      }

      // Determine target gear at apex
      const apexSample = lapSamples[c.apexIndex] || lapSamples[c.entryIndex] || {};
      let targetGear = apexSample.inputs?.gear || 3;
      if (targetGear <= 0 || targetGear > 8) targetGear = (apexSpdKmh < 90 ? 2 : (apexSpdKmh < 140 ? 3 : 4));

      // Corner classification & Skip Barber notes
      let cornerType = 'Type I';
      let coachingNotes = 'Prioritize exit speed. Commit to throttle early as you pass the apex clipping point.';

      if (c.type === 'Type II' || (entrySpdKmh - apexSpdKmh > 70)) {
        cornerType = 'Type II';
        coachingNotes = 'Heavy deceleration entry. Optimize threshold braking and trail off pressure as steering increases.';
      } else if (c.type === 'Type III' || (c.radius && c.radius > 120)) {
        cornerType = 'Type III';
        coachingNotes = 'High-speed flow section. Maintain chassis platform stability with gentle, smooth throttle transitions.';
      }

      // Check elevation / kerb characteristics
      const vertG = apexSample.motion?.acceleration?.verticalG || 1.0;
      const kerbHit = apexSample.chassis?.wheelOnRumbleStrip ? 
        Object.values(apexSample.chassis.wheelOnRumbleStrip).some(v => v > 0) : false;

      return {
        turnNumber: turnNum,
        name: `Turn ${turnNum}`,
        cornerType,
        apexIndex: c.apexIndex,
        entrySpeedKmh: Math.round(entrySpdKmh),
        apexSpeedKmh: Math.round(apexSpdKmh),
        exitSpeedKmh: Math.round(exitSpdKmh),
        targetGear,
        brakingMarkerMeters: brakingDistMeters,
        maxDecelG: parseFloat((c.dynamics?.maxDecelG || (entrySpdKmh > apexSpdKmh ? 1.25 : 0.6)).toFixed(2)),
        verticalG: parseFloat(vertG.toFixed(2)),
        kerbHit,
        coachingNotes
      };
    });

    // 5. Detect Track Hazards & Advisories
    const hazards = [];

    // Check for unweighting crests or heavy compression
    lapSamples.forEach((s, idx) => {
      const vertG = s.motion?.acceleration?.verticalG;
      if (vertG !== undefined && vertG < 0.55 && hazards.length < 3) {
        const matchingTurn = corners.find(c => Math.abs(c.apexIndex - idx) < 100);
        const turnLabel = matchingTurn ? `Turn ${matchingTurn.turnNumber}` : `Sector ${hazards.length + 1}`;
        if (!hazards.some(h => h.turnRef === turnLabel)) {
          hazards.push({
            title: `${turnLabel} Elevation Crest`,
            turnRef: turnLabel,
            type: 'Unweighting & Loss of Grip',
            severity: 'High',
            description: 'Significant reduction in vertical tire load over crest. Ensure steering wheel is straight to avoid snap oversteer.'
          });
        }
      }
    });

    // Check for heavy threshold braking hazard
    const maxBrakeTurn = [...corners].sort((a, b) => (b.entrySpeedKmh - b.apexSpeedKmh) - (a.entrySpeedKmh - a.apexSpeedKmh))[0];
    if (maxBrakeTurn && (maxBrakeTurn.entrySpeedKmh - maxBrakeTurn.apexSpeedKmh > 80)) {
      hazards.push({
        title: `Turn ${maxBrakeTurn.turnNumber} Heavy Braking Zone`,
        turnRef: `Turn ${maxBrakeTurn.turnNumber}`,
        type: 'Maximum Deceleration Threshold',
        severity: 'Medium',
        description: `Decelerating from ${maxBrakeTurn.entrySpeedKmh} km/h to ${maxBrakeTurn.apexSpeedKmh} km/h. Initiate threshold brake pressure smoothly before the ${maxBrakeTurn.brakingMarkerMeters}m marker.`
      });
    }

    if (hazards.length === 0) {
      hazards.push({
        title: 'High-G Lateral Load Sections',
        turnRef: 'Mid-Sector',
        type: 'Tire Thermal Balance',
        severity: 'Low',
        description: 'Sustained lateral cornering loads. Monitor front-tire slip angle to prevent carcass overheating.'
      });
    }

    // 6. Subsample coordinates for crisp vector rendering (target ~250-400 points)
    const rawPoints = this.trackMapGenerator.extractRawPoints(lapSamples);
    const step = Math.max(1, Math.floor(rawPoints.length / 300));
    const subsampledPoints = [];
    for (let i = 0; i < rawPoints.length; i += step) {
      const p = rawPoints[i];
      subsampledPoints.push({
        x: parseFloat(p.x.toFixed(2)),
        z: parseFloat(p.z.toFixed(2)),
        speedKmh: Math.round((p.sample.motion?.speedKmh || (p.sample.motion?.speedMps ? p.sample.motion.speedMps * 3.6 : 100))),
        state: this.trackMapGenerator.classifyDrivingState(p.sample)
      });
    }

    // 7. Compile Completed Track Profile
    const bestLapTimeVal = (bestLap?.lapTime && bestLap.lapTime > 0)
      ? bestLap.lapTime
      : (analysisReport?.bestLap?.lapTime || 95.42);

    return {
      trackId,
      trackName: catalog.trackName,
      layoutName: catalog.layoutName,
      trackType: catalog.type,
      officialLength: catalog.officialLength,
      bestLapTime: parseFloat(bestLapTimeVal.toFixed(3)),
      bestLapNumber: bestLap?.lapNumber || 1,
      carName: metadata.carName || metadata.car || '2023 Porsche 911 GT3 R',
      carClass: metadata.carClass || 'S',
      driverName: metadata.driverName || 'APEX Driver',
      updatedAt: new Date().toISOString(),
      stintsRecordedCount: 1,
      totalLapsDriven: laps?.length || 1,
      cornersCount: corners.length,
      corners,
      hazards,
      vectorMap: {
        pointsCount: subsampledPoints.length,
        originalSamplesCount: lapSamples.length,
        points: subsampledPoints
      },
      setupAdvisories: {
        downforce: corners.length > 12 ? 'High Downforce' : (corners.length < 7 ? 'Low Drag' : 'Medium Downforce'),
        tireWearRisk: 'Front-Left sustained lateral scrub',
        brakingBias: '54% Front / 46% Rear recommended'
      }
    };
  }
}
