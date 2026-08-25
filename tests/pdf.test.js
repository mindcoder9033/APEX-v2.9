import test from 'node:test';
import assert from 'node:assert/strict';
import { generatePdfReport, ApexPdfBuilder } from '../src/pdf/index.js';

test('ApexPdfBuilder: Compiles standard A4 PDF from telemetry analysis', async () => {
  const startTime = Date.now();

  const mockReport = {
    validLapsCount: 2,
    totalLapsCount: 2,
    bestLap: {
      lapNumber: 1,
      lapTime: 72.45,
      maxSpeedMph: 145.2,
      minSpeedMph: 48.6,
      avgSpeedMph: 98.4
    },
    laps: [
      {
        lapNumber: 1,
        lapTime: 72.45,
        isValid: true,
        corners: [
          {
            cornerNumber: 1,
            type: 'Right',
            speed: { entryMph: 110, apexMph: 55, exitMph: 85 },
            dynamics: { tapDeltaFeet: 18.5, trailBrakingOverlapPercent: 35 },
            inputs: { gear: 3 }
          },
          {
            cornerNumber: 2,
            type: 'Left',
            speed: { entryMph: 95, apexMph: 42, exitMph: 78 },
            dynamics: { tapDeltaFeet: -16.2, trailBrakingOverlapPercent: 40 },
            inputs: { gear: 2 }
          }
        ]
      }
    ],
    findings: [
      {
        id: 'R-001',
        name: 'Late Throttle Application',
        severity: 'High',
        cornerNumber: 1,
        quote: 'The biggest gain in lap time comes from corner exit speed.',
        actionPlan: 'Squeeze throttle on earlier as you unwind steering towards track-out.',
        metric: 'TAP Delta: +18.5ft after apex'
      },
      {
        id: 'R-002',
        name: 'Premature Power Application',
        severity: 'Medium',
        cornerNumber: 2,
        quote: 'Getting to throttle too early induces understeer and pushes the car wide.',
        actionPlan: 'Modulate rolling speed with trail-braking before committing to throttle.',
        metric: 'TAP Delta: 16.2ft before apex'
      }
    ]
  };

  const metadata = {
    sessionName: 'Qualifying Stint 1',
    driverName: 'Carl Lopez',
    trackName: 'Sebring International Raceway',
    carClass: 'S Class',
    bestLapTimeStr: '1:12.450',
    totalLaps: 2,
    date: '2026-08-23'
  };

  const pdfBytes = await generatePdfReport(mockReport, metadata);
  const elapsedMs = Date.now() - startTime;

  assert.ok(pdfBytes instanceof Uint8Array, 'Output should be Uint8Array');
  assert.ok(pdfBytes.length > 2000, `PDF size (${pdfBytes.length} bytes) should be valid`);
  assert.ok(elapsedMs < 2000, `PDF generated in ${elapsedMs}ms (< 2000ms target)`);

  // Verify PDF header magic bytes "%PDF-"
  const headerStr = Buffer.from(pdfBytes.slice(0, 5)).toString('utf-8');
  assert.equal(headerStr, '%PDF-');
});

test('ApexPdfBuilder: Compiles 4-page report with vector track map and tire dynamics', async () => {
  const samples = [];
  for (let i = 0; i < 60; i++) {
    const angle = (i / 60) * 2 * Math.PI;
    samples.push({
      motion: { position: { x: 200 + 100 * Math.cos(angle), y: 0, z: 200 + 100 * Math.sin(angle) } },
      inputs: { throttle: i < 30 ? 1.0 : 0.0, brake: i >= 30 ? 0.8 : 0.0 },
      tires: {
        tempF: { frontLeft: 215, frontRight: 218, rearLeft: 225, rearRight: 230 },
        slipRatio: { frontLeft: 0.1, frontRight: 0.1, rearLeft: 0.2, rearRight: 0.2 },
        combinedSlip: { frontLeft: 0.7, frontRight: 0.7, rearLeft: 0.8, rearRight: 0.8 }
      }
    });
  }

  const mockReport = {
    validLapsCount: 1,
    totalLapsCount: 1,
    bestLap: { lapNumber: 1, lapTime: 65.2, maxSpeedMph: 130, minSpeedMph: 45, avgSpeedMph: 90 },
    laps: [{ lapNumber: 1, lapTime: 65.2, isValid: true, samples, corners: [{ cornerNumber: 1, type: 'Right', speed: { apexMph: 45 }, dynamics: { tapDeltaFeet: 12 } }] }],
    findings: [{ id: 'R-001', ruleId: 'R-001', name: 'Late Throttle', severity: 'High', cornerNumber: 1, quote: 'Quote', actionPlan: 'Action' }]
  };

  const builder = new ApexPdfBuilder();
  const pdfBytes = await builder.build(mockReport, { sessionName: 'Vector Map Test' });

  assert.ok(pdfBytes instanceof Uint8Array);
  assert.ok(pdfBytes.length > 5000, 'PDF with vector track map should contain rich vector data');
  const headerStr = Buffer.from(pdfBytes.slice(0, 5)).toString('utf-8');
  assert.equal(headerStr, '%PDF-');
});

test('ApexPdfBuilder: Compiles 6-page report including Section 6 (Shifting & Powerband)', async () => {
  const mockReport = {
    validLapsCount: 2,
    totalLapsCount: 2,
    bestLap: { lapNumber: 1, lapTime: 68.4, maxSpeedMph: 140, minSpeedMph: 45, avgSpeedMph: 95 },
    laps: [{ lapNumber: 1, lapTime: 68.4, isValid: true, corners: [{ cornerNumber: 1, type: 'Right', speed: { apexMph: 45 }, dynamics: {} }] }],
    findings: [],
    shiftingAnalysis: {
      usablePowerband: { idleRpm: 1000, maxRpm: 8000, usableRangeRpm: 7000, optimalPowerbandMin: 5550, optimalPowerbandMax: 7440 },
      summary: { compositeScore: 90, grade: 'A', gradeLabel: 'OPTIMAL POWERTRAIN UTILIZATION', gradeColor: '#00CC66', powerbandEfficiency: 90, totalDownshifts: 6, blippedDownshiftsCount: 6, blipComplianceRate: 100, avgBrakeStabilityScore: 88, boggingCornersCount: 0, overrevCornersCount: 0 },
      cornerShifting: [
        { cornerNumber: 1, cornerType: 'Mid-Speed', gear: 3, suggestedGear: 3, minRpm: 4800, exitRpm: 6600, exitPowerbandPercent: 80, isBogging: false, isOverrev: false, status: 'OPTIMAL' }
      ],
      downshiftEvents: [
        { fromGear: 4, toGear: 3, peakBlipThrottlePercent: 55, brakeStabilityScore: 92 }
      ],
      recommendations: [
        { title: 'Exemplary Powertrain Execution', severity: 'Low', advice: 'Gear selection and powerband are fully optimized.' }
      ]
    },
    brakingAnalysis: {
      stintMaxDecelG: 1.35,
      avgEfficiencyPercent: 88,
      theProcedure: { overallConsistencyScore: 90, rating: 'Consistent', cornerSteppingMetrics: [] },
      totalBrakingDistanceFeet: 1250,
      brakingZones: []
    }
  };

  const builder = new ApexPdfBuilder();
  const pdfBytes = await builder.build(mockReport, { sessionName: 'Sprint 10 Full PDF Test' });

  assert.ok(pdfBytes instanceof Uint8Array);
  assert.ok(pdfBytes.length > 5000, '7-page PDF should contain all sections');
  const headerStr = Buffer.from(pdfBytes.slice(0, 5)).toString('utf-8');
  assert.equal(headerStr, '%PDF-');
});

test('ApexPdfBuilder: Compiles full APEX v3.0 report with CPR, 4-Block, Chassis, Surface & 14-Point Scorecard', async () => {
  const { PDFDocument } = await import('pdf-lib');
  const mockReport = {
    validLapsCount: 2,
    totalLapsCount: 2,
    bestLap: { lapNumber: 1, lapTime: 68.4, maxSpeedMph: 140, minSpeedMph: 45, avgSpeedMph: 95 },
    laps: [{ lapNumber: 1, lapTime: 68.4, isValid: true, corners: [{ cornerNumber: 1, type: 'Right', speed: { entryMph: 120, apexMph: 45, exitMph: 90 }, dynamics: { tapDeltaFeet: 12 } }] }],
    findings: [
      { id: 'R-001', ruleId: 'R-001', name: 'Late Throttle Unwind', severity: 'High', cornerNumber: 1, quote: 'Exit speed is king.', actionPlan: 'Unwind progressively while feeding in throttle smoothly on corner exit.', metric: 'TAP Delta: +12.0ft' }
    ],
    carControl: {
      carControlScore: 92,
      balancePercentages: { neutralPct: 84, understeerPct: 10, oversteerPct: 6 },
      maxYawAngleDeg: 5.2,
      ttoEventsCount: 0,
      tankslapperEventsCount: 0,
      skidEvents: []
    },
    brakingEntry: {
      brakingEntryScore: 88,
      totalOverslowTimeLossSec: 0.12,
      totalDownshiftDips: 0,
      totalSlamEvents: 0,
      cornerEntries: []
    },
    chassisAdvisory: {
      chassisHealthScore: 95,
      bottomingStrikes: { total: 0, frontLeft: 0, frontRight: 0, rearLeft: 0, rearRight: 0 },
      maxBodyAngles: { maxRollDeg: 1.8, maxPitchDeg: 1.2 },
      dynamicRakeIndex: 0.015,
      setupAdjustments: []
    },
    surfaceIntelligence: {
      isWetSession: false,
      maxPuddleDepthMm: 0.0,
      asymmetricDragEvents: 0,
      hydroplaningRiskEvents: 0,
      cornerSurfaces: []
    },
    racecraft: {
      overallRacecraftScore: 94,
      overallGrade: 'A',
      scorecard: [],
      powertrain: { revMatchQuality: 96, avgUpshiftDurationMs: 150, revLimiterStrikes: 0, draftTowAdvantageKmh: 5.2 }
    }
  };

  const builder = new ApexPdfBuilder();
  const pdfBytes = await builder.build(mockReport, { sessionName: 'APEX v3.0 Debrief Stint' });
  const loadedDoc = await PDFDocument.load(pdfBytes);

  // 11 base pages + 1 lap analysis page + 1 flagged corner page = 13 pages
  assert.equal(loadedDoc.getPageCount(), 13, 'PDF should have exactly 13 pages containing all APEX v3.0 sections');
});

test('ApexPdfBuilder: Enforces strict Metric conversion helpers', () => {
  const builder = new ApexPdfBuilder();
  
  // Speed conversion (mph to km/h)
  assert.ok(Math.abs(builder.toKmh(100) - 160.934) < 0.01);
  
  // Distance conversion (feet to meters)
  assert.ok(Math.abs(builder.toMeters(100) - 30.48) < 0.01);
  
  // Temperature conversion (°F to °C)
  assert.ok(Math.abs(builder.toCelsius(212) - 100) < 0.01);
  assert.ok(Math.abs(builder.toCelsius(32) - 0) < 0.01);
});

test('ApexPdfBuilder: Includes all recorded laps including Lap 1 in validLaps analysis', () => {
  const builder = new ApexPdfBuilder();
  const mockReport = {
    laps: [
      { lapNumber: 1, lapTime: 85.2, isValid: false, corners: [] },
      { lapNumber: 2, lapTime: 72.1, isValid: true, corners: [] },
      { lapNumber: 3, lapTime: 71.9, isValid: true, corners: [] }
    ]
  };

  const validLaps = builder.getValidLaps(mockReport);
  assert.equal(validLaps.length, 3, 'All 3 laps should be included in validLaps');
  assert.equal(validLaps[0].lapNumber, 1, 'Lap 1 must be present');
  assert.equal(validLaps[1].lapNumber, 2, 'Lap 2 must be present');
  assert.equal(validLaps[2].lapNumber, 3, 'Lap 3 must be present');
});

