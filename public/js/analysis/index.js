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
import { CarControlEngine } from './car-control.js';
import { BrakingEntryEngine } from './braking-entry.js';
import { ChassisAdvisoryEngine } from './chassis-advisory.js';
import { SurfaceIntelligenceEngine } from './surface-intelligence.js';
import { RacecraftEngine } from './racecraft-engine.js';

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
    this.carControlEngine = new CarControlEngine(options.carControl);
    this.brakingEntryEngine = new BrakingEntryEngine(options.brakingEntry);
    this.chassisEngine = new ChassisAdvisoryEngine(options.chassis);
    this.surfaceEngine = new SurfaceIntelligenceEngine(options.surface);
    this.racecraftEngine = new RacecraftEngine(options.racecraft);
  }

  analyzeStint(samples, options = {}) {
    if (!samples || samples.length === 0) {
      return {
        laps: [],
        validLapsCount: 0,
        totalLapsCount: 0,
        bestLap: null,
        findings: [],
        trackMap: null,
        tireDynamics: null,
        deltaComparison: null,
        brakingAnalysis: null,
        shiftingAnalysis: null,
        frictionCircle: null,
        performanceSummary: null,
        recommendations: [],
        carControl: null,
        brakingEntry: null,
        chassisAdvisory: null,
        surfaceIntelligence: null,
        racecraft: null
      };
    }

    const laps = this.segmenter.segmentStint(samples);
    const validLaps = laps.filter(l => l.isValid);

    let bestLap = null;
    let minLapTime = Infinity;
    for (const lap of validLaps) {
      if (lap.lapTime < minLapTime) {
        minLapTime = lap.lapTime;
        bestLap = lap;
      }
    }

    const analyzedLaps = laps.map((lap) => {
      const apexes = this.detector.detectApexes(lap.samples);
      const corners = this.extractor.extractAll(lap.samples, apexes);
      const findings = this.rules.evaluateLap(corners);

      return { ...lap, corners, findings, apexCount: apexes.length };
    });

    const allFindings = [];
    for (const lap of analyzedLaps) {
      allFindings.push(...lap.findings);
    }

    // Generate Vector Track Map for best lap or fallback samples
    const mapSamples = (bestLap && bestLap.samples && bestLap.samples.length > 10)
      ? bestLap.samples
      : (validLaps.length > 0 && validLaps[0].samples ? validLaps[0].samples : samples);

    const bestLapAnalyzed = bestLap ? analyzedLaps.find(l => l.lapNumber === bestLap.lapNumber) : null;
    const mapCorners = (bestLapAnalyzed?.corners) || (analyzedLaps[0]?.corners || []);
    const mapFindings = (bestLapAnalyzed?.findings) || allFindings;

    const trackMapSvg = this.trackMapGenerator.generateSvg(mapSamples, mapCorners, mapFindings);
    const trackMapPdf = this.trackMapGenerator.generatePdfVectorData(mapSamples, mapCorners, mapFindings);
    const tireDynamics = this.tireEngine.analyzeTires(samples);

    // Delta Lap Comparison & Skip Barber Priority Ranking
    let deltaComparison = null;
    if (bestLapAnalyzed && bestLapAnalyzed.samples && bestLapAnalyzed.samples.length > 0) {
      const otherValidLaps = analyzedLaps.filter(l => l.isValid && l.lapNumber !== bestLap.lapNumber);
      let targetLap = null;

      if (otherValidLaps.length > 0) {
        const avgOtherLapTime = otherValidLaps.reduce((acc, l) => acc + l.lapTime, 0) / otherValidLaps.length;
        targetLap = otherValidLaps.reduce((closest, curr) => {
          return Math.abs(curr.lapTime - avgOtherLapTime) < Math.abs(closest.lapTime - avgOtherLapTime) ? curr : closest;
        }, otherValidLaps[0]);
      } else {
        targetLap = bestLapAnalyzed;
      }

      deltaComparison = this.deltaEngine.compareLaps(bestLapAnalyzed, targetLap, mapCorners);
    }

    // Braking Zone G-Force & Threshold Efficiency Analysis
    const vehicleMeta = options.vehicle || samples[0]?.vehicle || {};
    const brakingAnalysis = this.brakingEngine.analyzeBrakingZones(
      mapSamples,
      analyzedLaps,
      mapCorners,
      vehicleMeta
    );

    // Shifting, Powerband & Downshift Quality Analysis
    const shiftingAnalysis = this.shiftingEngine.analyzeShifting(
      mapSamples,
      analyzedLaps,
      mapCorners,
      vehicleMeta
    );

    // Friction Circle / G-G Diagram (ANALYSIS.md §9)
    const frictionAnalyzer = new FrictionCircleAnalyzer(mapSamples);
    const frictionCircle = frictionAnalyzer.generateFrictionCircle();

    // Performance Summary Score (ANALYSIS.md §10.1)
    const allAnalysisResults = { brakingAnalysis, shiftingAnalysis, tireDynamics, deltaComparison };
    const summaryEngine = new PerformanceSummaryEngine(analyzedLaps, mapCorners, allAnalysisResults);
    const performanceSummary = summaryEngine.generateSummary();

    // Recommendation Engine (ANALYSIS.md §10.2)
    const recEngine = new RecommendationEngine(mapCorners, allAnalysisResults);
    const recommendations = recEngine.generateRecommendations();

    // Vehicle Dynamics & CPR Skid Control Engine (Sprint 14)
    const carControl = this.carControlEngine.analyze(mapSamples, mapCorners);

    // 4-Block Corner Entry & Overslowing Engine (Sprint 15)
    const brakingEntry = this.brakingEntryEngine.analyze(mapSamples, mapCorners, bestLapAnalyzed);

    // Suspension Load Transfer & Chassis Setup Coach (Sprint 16)
    const chassisAdvisory = this.chassisEngine.analyze(mapSamples, carControl);

    // Dynamic Surface & Wet-Weather Intelligence (Sprint 17)
    const surfaceIntelligence = this.surfaceEngine.analyze(mapSamples, mapCorners);

    // Racecraft Engine & 14-Point Skip Barber Scorecard (Sprint 18)
    const racecraft = this.racecraftEngine.analyze({
      laps: analyzedLaps,
      samples: mapSamples,
      carControl,
      brakingEntry,
      shifting: shiftingAnalysis,
      surface: surfaceIntelligence,
      tireDynamics,
      perfSummary: performanceSummary
    });

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
      frictionCircle,
      performanceSummary,
      recommendations,
      carControl,
      brakingEntry,
      chassisAdvisory,
      surfaceIntelligence,
      racecraft
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
  CarControlEngine,
  BrakingEntryEngine,
  ChassisAdvisoryEngine,
  SurfaceIntelligenceEngine,
  RacecraftEngine,
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
