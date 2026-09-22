/**
 * APEX Optimal Driving Line Engine
 * Generates and analyzes the "Real World Line" vs Geometric Line per Skip Barber "Going Faster!" (Ch. 3 & 7)
 * Models Late Apex (Exit-Priority), Geometric, Diamond V, Compromised (S-Curves), and Rain lines.
 */

export const LINE_ARCHETYPE = {
  LATE_APEX: 'LATE_APEX',               // Asymmetrical arc: tight entry, wide exit for early TAP (Going Faster standard)
  GEOMETRIC: 'GEOMETRIC',               // Symmetrical constant radius (benchmark)
  DIAMOND_V: 'DIAMOND_V',               // Hard braking, sharp rotation, straight line launch
  COMPROMISED_S_CURVE: 'COMPROMISE',   // Linked corner compromise (sacrifice T1 for T2 exit)
  RAIN_LINE: 'RAIN_LINE',               // Avoids polished rubber groove; sweeps outside for wet traction
  CUSTOM: 'CUSTOM'                      // User customized lateral offsets
};

export class OptimalLineEngine {
  constructor(options = {}) {
    this.defaultTrackWidthMeters = options.defaultTrackWidthMeters || 12.0; // 12m standard FIA track width
    this.nominalMaxG = options.nominalMaxG || 1.20;
    this.frictionCoeff = options.frictionCoeff || 1.0;
  }

  /**
   * Generates control point lateral offsets (0.0 = full inside curb, 1.0 = full outside edge)
   * based on the chosen Going Faster archetype.
   * @param {string} archetype LINE_ARCHETYPE enum
   * @param {Object} customOffsets Optional custom overrides { entry, turnIn, apex, tap, trackOut }
   * @returns {Object} Normalized lateral offsets [0.0 - 1.0]
   */
  getArchetypeOffsets(archetype = LINE_ARCHETYPE.LATE_APEX, customOffsets = {}) {
    let defaults = {};

    switch (archetype) {
      case LINE_ARCHETYPE.LATE_APEX:
        // Going Faster Ch. 3: Entry at 100% outside, Turn-in at 100% outside, Late Apex at 0% inside curb (~70% through turn), Exit at 100% outside
        defaults = {
          entry: 1.0,        // 100% outside track edge
          turnIn: 0.98,      // 98% outside track edge
          apexDepth: 0.70,   // 70% corner distance (Late Apex)
          apexLateral: 0.02, // Right on the inside clipping curb
          tapDepth: 0.72,    // TAP right at/immediately after late apex
          tapLateral: 0.15,  // Beginning unwinding
          trackOut: 0.98     // 98% full outside curb
        };
        break;

      case LINE_ARCHETYPE.GEOMETRIC:
        // Symmetrical constant radius: Mid-corner apex at 50% depth
        defaults = {
          entry: 1.0,
          turnIn: 0.95,
          apexDepth: 0.50,   // 50% corner distance (Geometric Midpoint)
          apexLateral: 0.02,
          tapDepth: 0.65,
          tapLateral: 0.35,
          trackOut: 0.98
        };
        break;

      case LINE_ARCHETYPE.DIAMOND_V:
        // Diamond V: Late turn-in, deep braking, very sharp rotation at 75% depth
        defaults = {
          entry: 1.0,
          turnIn: 0.85,
          apexDepth: 0.78,   // Very deep V-apex
          apexLateral: 0.05,
          tapDepth: 0.80,
          tapLateral: 0.20,
          trackOut: 0.95
        };
        break;

      case LINE_ARCHETYPE.COMPROMISED_S_CURVE:
        // S-Curve Turn 1: Sacrificed exit to hold car on opposite side for Turn 2 entry
        defaults = {
          entry: 1.0,
          turnIn: 0.95,
          apexDepth: 0.60,
          apexLateral: 0.05,
          tapDepth: 0.75,
          tapLateral: 0.40,  // Stays mid-track on exit (doesn't track out to 100%)
          trackOut: 0.55     // Leaves room to enter Turn 2 from outside
        };
        break;

      case LINE_ARCHETYPE.RAIN_LINE:
        // Rain Line: Rims outside where rubber buildup is low, avoids painted inside curb
        defaults = {
          entry: 0.95,
          turnIn: 0.90,
          apexDepth: 0.65,
          apexLateral: 0.35, // Stays 35% off the slippery inside rubber line
          tapDepth: 0.70,
          tapLateral: 0.60,
          trackOut: 0.92
        };
        break;

      case LINE_ARCHETYPE.CUSTOM:
      default:
        defaults = {
          entry: 1.0,
          turnIn: 0.98,
          apexDepth: 0.70,
          apexLateral: 0.02,
          tapDepth: 0.72,
          tapLateral: 0.15,
          trackOut: 0.98
        };
        break;
    }

    return { ...defaults, ...customOffsets };
  }

  /**
   * Computes continuous 2D/3D optimal line coordinates across the corner
   * @param {Array<{x: number, y: number, z: number, dist: number, speedMps: number}>} samples Corner samples
   * @param {string} archetype Chosen archetype
   * @param {Object} customOffsets Custom lateral offsets
   * @param {number} trackWidth Track width in meters
   * @returns {Array<Object>} Optimal Line Nodes with position, curvature, radius, and target speed
   */
  generateOptimalLine(samples, archetype = LINE_ARCHETYPE.LATE_APEX, customOffsets = {}, trackWidth = this.defaultTrackWidthMeters) {
    if (!samples || samples.length < 5) return [];

    const offsets = this.getArchetypeOffsets(archetype, customOffsets);
    const n = samples.length;
    const totalDist = samples[n - 1].dist - samples[0].dist;
    const startDist = samples[0].dist;

    // Build spline knots along normalized corner distance s in [0.0, 1.0]
    const knots = [
      { s: 0.0, lat: offsets.entry },
      { s: 0.20, lat: offsets.turnIn },
      { s: offsets.apexDepth, lat: offsets.apexLateral },
      { s: offsets.tapDepth, lat: offsets.tapLateral },
      { s: 1.0, lat: offsets.trackOut }
    ];

    // Sort knots by distance parameter s
    knots.sort((a, b) => a.s - b.s);

    const optimalLine = [];

    for (let i = 0; i < n; i++) {
      const s_i = (samples[i].dist - startDist) / Math.max(1, totalDist);
      const clamped_s = Math.max(0, Math.min(1.0, s_i));

      // Interpolate lateral offset using cubic Hermite interpolation
      const latOffset = this.interpolateLateralOffset(knots, clamped_s);

      // Compute track normal vector (perpendicular to track centerline direction)
      let dx = 0, dz = 0;
      if (i === 0) {
        dx = samples[1].x - samples[0].x;
        dz = samples[1].z - samples[0].z;
      } else if (i === n - 1) {
        dx = samples[n - 1].x - samples[n - 2].x;
        dz = samples[n - 1].z - samples[n - 2].z;
      } else {
        dx = samples[i + 1].x - samples[i - 1].x;
        dz = samples[i + 1].z - samples[i - 1].z;
      }

      const len = Math.hypot(dx, dz) || 1.0;
      // Normal vector pointing to outside of track
      const nx = -dz / len;
      const nz = dx / len;

      // Centerline is at 0.5 * trackWidth; offset in [-trackWidth/2, +trackWidth/2]
      const lateralShiftMeters = (latOffset - 0.5) * trackWidth;

      const optX = samples[i].x + nx * lateralShiftMeters;
      const optY = samples[i].y;
      const optZ = samples[i].z + nz * lateralShiftMeters;

      optimalLine.push({
        index: i,
        s: clamped_s,
        dist: samples[i].dist,
        x: optX,
        y: optY,
        z: optZ,
        lateralOffset: latOffset,
        drivenX: samples[i].x,
        drivenZ: samples[i].z
      });
    }

    // Second pass: Calculate instantaneous curvature and allowable speed along the optimal line
    return this.computeLineDynamics(optimalLine);
  }

  /**
   * Interpolates lateral position along knots using cubic spline interpolation
   */
  interpolateLateralOffset(knots, s) {
    if (s <= knots[0].s) return knots[0].lat;
    if (s >= knots[knots.length - 1].s) return knots[knots.length - 1].lat;

    // Find bounding interval
    let k = 0;
    while (k < knots.length - 1 && knots[k + 1].s < s) {
      k++;
    }

    const p0 = knots[Math.max(0, k - 1)].lat;
    const p1 = knots[k].lat;
    const p2 = knots[k + 1].lat;
    const p3 = knots[Math.min(knots.length - 1, k + 2)].lat;

    const t = (s - knots[k].s) / Math.max(0.001, (knots[k + 1].s - knots[k].s));
    
    // Catmull-Rom spline interpolation
    const t2 = t * t;
    const t3 = t2 * t;

    const v = 0.5 * (
      (2 * p1) +
      (-p0 + p2) * t +
      (2 * p0 - 5 * p1 + 4 * p2 - p3) * t2 +
      (-p0 + 3 * p1 - 3 * p2 + p3) * t3
    );

    return Math.max(0.0, Math.min(1.0, v));
  }

  /**
   * Computes radius R(s), curvature k(s), and maximum cornering speed along the line
   * Going Faster! Formula: v = sqrt(127 * G * R) [km/h] or sqrt(15 * G * R) [mph]
   */
  computeLineDynamics(lineNodes) {
    const n = lineNodes.length;
    if (n < 3) return lineNodes;

    for (let i = 0; i < n; i++) {
      let radius = 999.0;

      if (i > 0 && i < n - 1) {
        const p1 = lineNodes[i - 1];
        const p2 = lineNodes[i];
        const p3 = lineNodes[i + 1];

        // Triangle Menger curvature: R = (|p1-p2| * |p2-p3| * |p3-p1|) / (2 * |cross_product|)
        const a = Math.hypot(p2.x - p1.x, p2.z - p1.z);
        const b = Math.hypot(p3.x - p2.x, p3.z - p2.z);
        const c = Math.hypot(p1.x - p3.x, p1.z - p3.z);

        const cross = (p2.x - p1.x) * (p3.z - p1.z) - (p2.z - p1.z) * (p3.x - p1.x);
        const area2 = Math.abs(cross);

        if (area2 > 0.0001 && a > 0.01 && b > 0.01) {
          radius = (a * b * c) / (2 * area2);
          radius = Math.max(8.0, Math.min(1200.0, radius));
        }
      }

      const curvature = 1.0 / radius;
      // Theoretical speed per Going Faster Ch. 2: v = sqrt(127 * mu * G * R) km/h
      const speedKmh = Math.sqrt(127.0 * this.frictionCoeff * this.nominalMaxG * radius);
      const speedMph = speedKmh * 0.621371;

      lineNodes[i].radiusMeters = Number(radius.toFixed(1));
      lineNodes[i].curvature = Number(curvature.toFixed(5));
      lineNodes[i].targetSpeedKmh = Number(speedKmh.toFixed(1));
      lineNodes[i].targetSpeedMph = Number(speedMph.toFixed(1));
    }

    // Set endpoints to adjacent values
    lineNodes[0].radiusMeters = lineNodes[1].radiusMeters;
    lineNodes[0].targetSpeedKmh = lineNodes[1].targetSpeedKmh;
    lineNodes[0].targetSpeedMph = lineNodes[1].targetSpeedMph;
    lineNodes[n - 1].radiusMeters = lineNodes[n - 2].radiusMeters;
    lineNodes[n - 1].targetSpeedKmh = lineNodes[n - 2].targetSpeedKmh;
    lineNodes[n - 1].targetSpeedMph = lineNodes[n - 2].targetSpeedMph;

    return lineNodes;
  }

  /**
   * Compares the actual driven line against the optimal racing line
   * Computes track-width utilization, apex proximity delta, and racecraft coaching feedback
   */
  evaluateLineQuality(drivenSamples, optimalLine, trackWidth = this.defaultTrackWidthMeters) {
    if (!drivenSamples || !optimalLine || drivenSamples.length === 0) {
      return {
        trackUtilizationPercent: 0,
        apexMissMeters: 0,
        entryTrackUsagePercent: 0,
        exitTrackUsagePercent: 0,
        lineQualityScore: 0,
        feedback: []
      };
    }

    const n = Math.min(drivenSamples.length, optimalLine.length);
    let totalDeviation = 0;
    let minApexDist = Infinity;
    let apexIdx = Math.floor(n * 0.65);

    for (let i = 0; i < n; i++) {
      const dev = Math.hypot(drivenSamples[i].x - optimalLine[i].x, drivenSamples[i].z - optimalLine[i].z);
      totalDeviation += dev;
      if (dev < minApexDist && i > n * 0.4 && i < n * 0.85) {
        minApexDist = dev;
        apexIdx = i;
      }
    }

    const avgDeviation = totalDeviation / n;
    const apexMissMeters = Number(minApexDist.toFixed(2));

    // Entry track usage (are they starting at 100% outside?)
    const entryDev = Math.hypot(drivenSamples[0].x - optimalLine[0].x, drivenSamples[0].z - optimalLine[0].z);
    const entryTrackUsage = Math.max(0, Math.min(100, Math.round((1 - entryDev / trackWidth) * 100)));

    // Exit track usage (are they unwinding to the full outside curb?)
    const exitDev = Math.hypot(drivenSamples[n - 1].x - optimalLine[n - 1].x, drivenSamples[n - 1].z - optimalLine[n - 1].z);
    const exitTrackUsage = Math.max(0, Math.min(100, Math.round((1 - exitDev / trackWidth) * 100)));

    const trackUtilizationPercent = Math.round((entryTrackUsage + exitTrackUsage + (100 - Math.min(100, apexMissMeters * 20))) / 3);
    const lineQualityScore = Math.max(10, Math.min(100, 100 - Math.round(avgDeviation * 15)));

    const feedback = [];
    if (entryTrackUsage < 85) {
      feedback.push(`Narrow Turn Entry: Turned in from only ${entryTrackUsage}% track width. Rim the outside edge on approach to maximize corner radius.`);
    }
    if (apexMissMeters > 1.5) {
      feedback.push(`Missed Apex Curb by ${apexMissMeters}m: Failing to clip the inner curb forces a tighter exit arc.`);
    }
    if (exitTrackUsage < 85) {
      feedback.push(`Pinched Exit: Left ${(trackWidth * (1 - exitTrackUsage / 100)).toFixed(1)}m of track unused at track-out. Unwind steering fully onto exit curbing.`);
    }

    return {
      trackUtilizationPercent,
      apexMissMeters,
      entryTrackUsagePercent: entryTrackUsage,
      exitTrackUsagePercent: exitTrackUsage,
      lineQualityScore,
      feedback
    };
  }
}
