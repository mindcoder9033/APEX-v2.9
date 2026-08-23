import { LapSegmenter } from './lap-segmenter.js';
import { CornerDetector } from './corner-detector.js';
import { CornerExtractor } from './corner-extractor.js';
import { RulesEngine } from './rules-engine.js';
import { TrackMapGenerator, DRIVING_STATE, STATE_COLORS } from './track-map.js';
import { TireDynamicsEngine, TIRE_THERMAL_STATUS, THERMAL_THRESHOLDS } from './tire-dynamics.js';
import { DeltaComparisonEngine, CORNER_TYPE, CORNER_TYPE_INFO } from './delta-comparison.js';
import { BrakingZoneEngine, CLASS_THEORETICAL_MAX_DECEL_G, THRESHOLD_EFFICIENCY_GRADES } from './braking-zones.js';
import { ShiftingPowerbandEngine, SHIFT_QUALITY_GRADES } from './shifting-powerband.js';
import { FrictionCircleAnalyzer, FRICTION_PHASE, FRICTION_PHASE_COLORS } from './friction-circle.js';
import { PerformanceSummaryEngine, RecommendationEngine, PERFORMANCE_GRADES } from './performance-summary.js';

export class AnalysisEngine {
  constructor(options = {}) {
    this.segmenter = new LapSegmenter(options.segmenter);
    this.detector = new CornerDetector(options.detector);
    this.extractor = new CornerExtractor(options.extractor);
    this.rules = new RulesEngine();
    this.trackMapGenerator = new TrackMapGenerator(options.trackMap);
    this.tireEngine = new TireDynamicsEngine(options.tireEngine);
    this.deltaEngine = new DeltaComparisonEngine(options.deltaEngine);
    this.brakingEngine = new BrakingZoneEngine(options.brakingEngine);
    this.shiftingEngine = new ShiftingPowerbandEngine(options.shiftingEngine);
  }

  /**
   * Performs end-to-end analysis on raw stint samples
   * @param {Array<Object>} samples 
   * @param {Object} options Optional metadata and settings
   * @returns {Object} Comprehensive stint analysis report
   */
  analyzeStint(samples, options = {}) {
    if (!samples || samples.length === 0) {
      return {
        laps: [],
        bestLap: null,
        totalLaps: 0,
        findings: [],
        trackMap: null,
        tireDynamics: null,
        deltaComparison: null,
        brakingAnalysis: null,
        shiftingAnalysis: null
      };
    }

    // 1. Segment into discrete laps
    const laps = this.segmenter.segmentStint(samples);
    const validLaps = laps.filter(l => l.isValid);

    // 2. Find best lap
    let bestLap = null;
    let minLapTime = Infinity;
    for (const lap of validLaps) {
      if (lap.lapTime < minLapTime) {
        minLapTime = lap.lapTime;
        bestLap = lap;
      }
    }

    // 3. Process corners and rules for each lap
    const analyzedLaps = laps.map((lap) => {
      const apexes = this.detector.detectApexes(lap.samples);
      const corners = this.extractor.extractAll(lap.samples, apexes);
      const findings = this.rules.evaluateLap(corners);

      return {
        ...lap,
        corners,
        findings,
        apexCount: apexes.length
      };
    });

    // 4. Stint-wide aggregate findings
    const allFindings = [];
    for (const lap of analyzedLaps) {
      allFindings.push(...lap.findings);
    }

    // 5. Generate Vector Track Map for the best lap (or full stint samples if no valid lap)
    const mapSamples = (bestLap && bestLap.samples && bestLap.samples.length > 10)
      ? bestLap.samples
      : (validLaps.length > 0 && validLaps[0].samples ? validLaps[0].samples : samples);

    const bestLapAnalyzed = bestLap ? analyzedLaps.find(l => l.lapNumber === bestLap.lapNumber) : null;
    const mapCorners = (bestLapAnalyzed?.corners) || (analyzedLaps[0]?.corners || []);
    const mapFindings = (bestLapAnalyzed?.findings) || allFindings;

    const trackMapSvg = this.trackMapGenerator.generateSvg(mapSamples, mapCorners, mapFindings);
    const trackMapPdf = this.trackMapGenerator.generatePdfVectorData(mapSamples, mapCorners, mapFindings);

    // 6. Perform 4-corner Tire Dynamics & Thermal State Analysis
    const tireDynamics = this.tireEngine.analyzeTires(samples);

    // 7. Perform Delta Lap Comparison & Skip Barber Priority Ranking
    let deltaComparison = null;
    if (bestLapAnalyzed && bestLapAnalyzed.samples && bestLapAnalyzed.samples.length > 0) {
      // If we have multiple valid laps, compare the stint's average/second lap against the best lap
      const otherValidLaps = analyzedLaps.filter(l => l.isValid && l.lapNumber !== bestLap.lapNumber);
      let targetLap = null;

      if (otherValidLaps.length > 0) {
        // Compute average lap time among other valid laps and pick closest
        const avgOtherLapTime = otherValidLaps.reduce((acc, l) => acc + l.lapTime, 0) / otherValidLaps.length;
        targetLap = otherValidLaps.reduce((closest, curr) => {
          return Math.abs(curr.lapTime - avgOtherLapTime) < Math.abs(closest.lapTime - avgOtherLapTime) ? curr : closest;
        }, otherValidLaps[0]);
      } else {
        // Single lap fallback: compare against itself to provide corner classification & base matrix
        targetLap = bestLapAnalyzed;
      }

      deltaComparison = this.deltaEngine.compareLaps(bestLapAnalyzed, targetLap, mapCorners);
    }

    // 8. Perform Braking Zone G-Force & Threshold Efficiency Analysis (Sprint 9)
    const vehicleMeta = options.vehicle || samples[0]?.vehicle || {};
    const brakingAnalysis = this.brakingEngine.analyzeBrakingZones(
      mapSamples,
      analyzedLaps,
      mapCorners,
      vehicleMeta
    );

    // 9. Perform Shifting, Powerband & Downshift Quality Analysis (Sprint 10)
    const shiftingAnalysis = this.shiftingEngine.analyzeShifting(
      mapSamples,
      analyzedLaps,
      mapCorners,
      vehicleMeta
    );

    // 10. Friction Circle / G-G Diagram (ANALYSIS.md §9)
    const frictionAnalyzer = new FrictionCircleAnalyzer(mapSamples);
    const frictionCircle = frictionAnalyzer.generateFrictionCircle();

    // 11. Performance Summary Score (ANALYSIS.md §10.1)
    const allAnalysisResults = { brakingAnalysis, shiftingAnalysis, tireDynamics, deltaComparison };
    const summaryEngine = new PerformanceSummaryEngine(analyzedLaps, mapCorners, allAnalysisResults);
    const performanceSummary = summaryEngine.generateSummary();

    // 12. Recommendation Engine (ANALYSIS.md §10.2)
    const recEngine = new RecommendationEngine(mapCorners, allAnalysisResults);
    const recommendations = recEngine.generateRecommendations();

    return {
      laps: analyzedLaps,
      validLapsCount: validLaps.length,
      totalLapsCount: laps.length,
      bestLap: bestLap ? {
        lapNumber: bestLap.lapNumber,
        lapTime: bestLap.lapTime,
        maxSpeedMph: bestLap.maxSpeedMph,
        minSpeedMph: bestLap.minSpeedMph,
        avgSpeedMph: bestLap.avgSpeedMph
      } : null,
      findings: allFindings,
      trackMap: {
        samplesCount: mapSamples.length,
        corners: mapCorners,
        findings: mapFindings,
        svg: trackMapSvg,
        pdfVectorData: trackMapPdf
      },
      tireDynamics,
      deltaComparison,
      brakingAnalysis,
      shiftingAnalysis,
      // ANALYSIS.md §9-§10 additions
      frictionCircle,
      performanceSummary,
      recommendations
    };
  }
}

export {
  LapSegmenter,
  CornerDetector,
  CornerExtractor,
  RulesEngine,
  TrackMapGenerator,
  TireDynamicsEngine,
  DeltaComparisonEngine,
  BrakingZoneEngine,
  ShiftingPowerbandEngine,
  FrictionCircleAnalyzer,
  PerformanceSummaryEngine,
  RecommendationEngine,
  DRIVING_STATE,
  STATE_COLORS,
  TIRE_THERMAL_STATUS,
  THERMAL_THRESHOLDS,
  CORNER_TYPE,
  CORNER_TYPE_INFO,
  CLASS_THEORETICAL_MAX_DECEL_G,
  THRESHOLD_EFFICIENCY_GRADES,
  SHIFT_QUALITY_GRADES,
  FRICTION_PHASE,
  FRICTION_PHASE_COLORS,
  PERFORMANCE_GRADES
};


