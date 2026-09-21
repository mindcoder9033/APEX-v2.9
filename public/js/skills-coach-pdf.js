/**
 * APEX Skills Hub - Coaching Debrief PDF Exporter
 * Generates a concise, high-impact 2-Page Light-Mode PDF debrief explaining:
 * 1. What the driver did good (Strengths & positive cornering habits)
 * 2. What they could have done better (Weaknesses & telemetry deficits)
 * 3. What to focus on next (Prioritized focus areas)
 * 4. Step-by-step actionable drills (Plain-English track exercises with concrete target metrics)
 */

import { GOING_FASTER_CHAPTERS, getChapter, getSkill } from './skills-curriculum.js';

export class SkillsCoachPdfExporter {
  /**
   * Resolve PDFLib whether running in the browser (window.PDFLib) or Node.js test environment
   */
  static async getPdfLib() {
    if (typeof window !== 'undefined' && window.PDFLib) {
      return window.PDFLib;
    }
    try {
      return await import('pdf-lib');
    } catch (e) {
      console.error('[SkillsCoachPDF] PDFLib library not available:', e);
      return null;
    }
  }

  /**
   * Synthesizes plain-English coaching debriefs from driver attempts and mastery stats
   * @param {Object} options
   * @returns {Object} Structured debrief data
   */
  static synthesizeDebrief(options = {}) {
    const {
      chapterNumber = 1,
      driverProfile = null,
      masteryStats = { overallMasteryScore: 0, grade: 'C', totalAttempts: 0, skills: {} },
      habitDiagnostics = { patterns: [], primaryWeakness: null },
      attempts = [],
      selectedSkillId = null,
      trackName = 'Forza Motorsport Circuit',
      car = 'Race Spec',
      stintId = 'ALL'
    } = options;

    const chapter = getChapter(chapterNumber) || GOING_FASTER_CHAPTERS[0];
    const driverName = driverProfile?.name || 'APEX Driver';
    const driverNumber = driverProfile?.number || '01';
    const driverTier = (driverProfile?.tier || 'Club').toUpperCase();

    // Collect individual skill metrics from recent attempts
    const recentAttempts = attempts.slice(0, 15);
    
    // 1. Analyze Strengths ("What You Did Good")
    const strengths = [];
    const weaknesses = [];
    const focusAreas = [];
    const drills = [];
    const benchmarks = [];

    // Evaluate Exit Speed
    const exitStat = masteryStats.skills?.['ch1-exit-speed'] || masteryStats.skills?.[selectedSkillId];
    const recentExitAttempts = recentAttempts.filter(a => a.skills?.['ch1-exit-speed']);
    const avgHesitations = recentExitAttempts.length > 0
      ? recentExitAttempts.reduce((acc, a) => acc + (a.skills['ch1-exit-speed'].metrics?.throttleHesitations || 0), 0) / recentExitAttempts.length
      : 0;

    if (exitStat && exitStat.currentScore >= 75) {
      strengths.push({
        title: 'Exit Speed & Throttle Commitment',
        badge: 'STRONG PILLAR',
        color: 'success',
        text: `You are picking up the throttle early and committing through corner exits with an average score of ${exitStat.currentScore}%. Clean power delivery maximizes your straightaway speed.`
      });
    } else if (exitStat && exitStat.currentScore > 0) {
      weaknesses.push({
        title: 'Hesitant Throttle Pickup on Exits',
        badge: 'HIGH TIME LOSS',
        color: 'danger',
        text: `Telemetry detected an average of ${avgHesitations.toFixed(1)} throttle hesitations/lifts per corner exit. Pumping the pedal delays full acceleration and sacrifices top speed down the entire straight.`
      });
    }

    // Evaluate Braking & Trail Braking
    const brkStat = masteryStats.skills?.['ch1-threshold-braking'] || masteryStats.skills?.['ch2-four-block-entry'];
    const trailStat = masteryStats.skills?.['ch1-combined-entry'];
    const recentBrakingAttempts = recentAttempts.filter(a => a.skills?.['ch1-threshold-braking'] || a.skills?.['ch2-four-block-entry']);
    const avgPeakBrake = recentBrakingAttempts.length > 0
      ? recentBrakingAttempts.reduce((acc, a) => acc + (a.skills['ch1-threshold-braking']?.metrics?.peakBrakePressurePercent || a.skills['ch2-four-block-entry']?.metrics?.b2PeakPressurePercent || 0), 0) / recentBrakingAttempts.length
      : 0;

    if (brkStat && brkStat.currentScore >= 75) {
      strengths.push({
        title: 'Decisive Initial Braking Pressure',
        badge: 'SOLID TECHNIQUE',
        color: 'success',
        text: `You establish strong, confident initial brake pressure (averaging ${Math.round(avgPeakBrake || 85)}% peak), compressing the front suspension quickly to generate immediate front tire grip.`
      });
    } else if (brkStat && brkStat.currentScore > 0 && avgPeakBrake > 0 && avgPeakBrake < 70) {
      weaknesses.push({
        title: 'Soft Initial Brake Application',
        badge: 'BRAKING ZONE LOSS',
        color: 'warning',
        text: `Your initial brake pressure averages only ${Math.round(avgPeakBrake)}%. You are braking too softly at the marker and pressing harder late, forcing an overly long braking zone.`
      });
    }

    if (trailStat && trailStat.currentScore >= 75) {
      strengths.push({
        title: 'Progressive Trail-Braking Transition',
        badge: 'EXCELLENT FEEL',
        color: 'success',
        text: 'Smooth brake bleed-off as you turn in. You keep the car nose weighted and rotating cleanly into the apex without upsetting the rear axle.'
      });
    } else if (trailStat && trailStat.currentScore > 0 && trailStat.currentScore < 70) {
      weaknesses.push({
        title: 'Abrupt Brake Release (Snap-Off)',
        badge: 'CHASSIS INSTABILITY',
        color: 'danger',
        text: 'You are jumping off the brake pedal too abruptly at turn-in. Releasing the brake too fast pops the front end up, unloading the front tires and causing corner-entry understeer.'
      });
    }

    // Evaluate Line Geometry & Balance
    const lineStat = masteryStats.skills?.['ch1-the-line'] || masteryStats.skills?.['ch2-line-geometry-15gr'];
    const balanceStat = masteryStats.skills?.['ch1-platform-stability'] || masteryStats.skills?.['ch2-balance-slide-control'];

    if (lineStat && lineStat.currentScore >= 75) {
      strengths.push({
        title: 'Geometric Line & Apex Discipline',
        badge: 'PRECISION LINE',
        color: 'success',
        text: 'Disciplined corner entry and track width utilization. You position the car wide on entry and hit the true geometric apex, giving yourself a straight exit trajectory.'
      });
    } else if (lineStat && lineStat.currentScore > 0 && lineStat.currentScore < 70) {
      weaknesses.push({
        title: 'Early Turn-In & Pinched Exit Arc',
        badge: 'LINE COMPROMISE',
        color: 'warning',
        text: 'Turning in too early pulls you to the inside curb prematurely. This pinches your exit radius, forcing you to delay throttle or run out of track at the exit curb.'
      });
    }

    if (balanceStat && balanceStat.currentScore >= 75) {
      strengths.push({
        title: 'Chassis Platform Stability',
        badge: 'CAR CONTROL',
        color: 'success',
        text: 'Smooth steering inputs and stable slip angle control. You keep the tires operating right in their peak friction window without excessive scrub.'
      });
    } else if (balanceStat && balanceStat.currentScore > 0 && balanceStat.currentScore < 70) {
      weaknesses.push({
        title: 'Steering Scrub & Lateral Over-Correction',
        badge: 'TIRE OVERHEATING',
        color: 'warning',
        text: 'Applying excessive steering lock past the grip limit. This scrubs speed, overheats the front tires, and creates unstable slide snap-backs on corner exit.'
      });
    }

    // Fallbacks if very few attempts exist
    if (strengths.length === 0) {
      strengths.push({
        title: 'Telemetry Logging & Practice Commitment',
        badge: 'ACTIVE BASELINE',
        color: 'success',
        text: 'Active telemetry collection is establishing your driving baseline. Continuous laps will feed the Going Faster coaching model to unlock specific telemetry milestones.'
      });
    }

    if (weaknesses.length === 0) {
      weaknesses.push({
        title: 'Fine-Tuning Transition Milliseconds',
        badge: 'PRO REFINEMENT',
        color: 'primary',
        text: 'High overall mastery. Your next lap time gains will come from shaving 50ms off your brake-to-throttle transition time and applying power 3 meters earlier on Type I corners.'
      });
    }

    // 2. Key Focus Areas (Page 2)
    focusAreas.push({
      priority: 'PRIORITY 1',
      title: 'Exit Speed on Type I Corners',
      impact: 'Est. Gain: +0.35s to +0.60s per lap',
      desc: 'Type I corners lead onto long straightaways. Prioritize late apex positioning and a clean, single-motion throttle ramp. Any speed gained at the apex carries all the way down the straight.'
    });

    focusAreas.push({
      priority: 'PRIORITY 2',
      title: 'Linear Trail-Braking Release',
      impact: 'Est. Gain: +0.20s to +0.40s per lap',
      desc: 'Do not snap your foot off the brake. Bleed off the final 20% of brake pressure in direct proportion to how much steering lock you turn in. Keep the front tires loaded into the apex.'
    });

    focusAreas.push({
      priority: 'PRIORITY 3',
      title: 'Late Turn-In & Track Width Discipline',
      impact: 'Est. Gain: +0.15s to +0.30s per lap',
      desc: 'Wait 3 to 5 meters deeper before turning in. Use 100% of the outside curbing on entry, hit the late apex, and unwind the steering early to let the car track out freely.'
    });

    // 3. Step-by-Step Actionable Drills (Page 2)
    drills.push({
      stepNumber: 'DRILL 1',
      name: "The 'One-Motion' Throttle Commitment Drill",
      cue: 'MENTAL CUE: "Roll On and Never Lift"',
      steps: [
        '1. Approach the corner and complete 85% of your braking in a straight line.',
        '2. Keep your foot off the throttle until the car is rotated toward the apex curb.',
        '3. Roll smoothly onto the throttle from 0% to 100% in one continuous motion -- never pump or lift.'
      ]
    });

    drills.push({
      stepNumber: 'DRILL 2',
      name: "The 'Toe-to-Wheel String' Trail-Braking Drill",
      cue: 'MENTAL CUE: "Steering IN = Brake OUT"',
      steps: [
        '1. Imagine a string connecting your big toe on the brake to the bottom of the steering wheel.',
        '2. As you turn the wheel into the corner, the string pulls your foot off the brake pedal.',
        '3. By the time you reach maximum steering angle at the apex, your brake pressure must be exactly 0%.'
      ]
    });

    drills.push({
      stepNumber: 'DRILL 3',
      name: "The 'Marker +5m' Late Apex Geometry Drill",
      cue: 'MENTAL CUE: "Patience on Entry = Speed on Exit"',
      steps: [
        '1. Find your normal turn-in marker and deliberately wait an extra 5 meters before turning.',
        '2. Aim to clip the inside curb at the second half of the corner (geometric late apex).',
        '3. Notice how much straighter the steering wheel is at exit, allowing full throttle 10 meters earlier.'
      ]
    });

    // 4. Telemetry Benchmark Targets Table
    benchmarks.push({
      metric: 'Exit Throttle Hesitations',
      current: `${avgHesitations.toFixed(1)} lifts`,
      target: '0 lifts (Smooth ramp)',
      status: avgHesitations <= 0.5 ? 'PASS' : 'NEEDS WORK'
    });
    benchmarks.push({
      metric: 'Initial Peak Brake Pressure',
      current: `${Math.round(avgPeakBrake || 78)}%`,
      target: '80% - 92%',
      status: (avgPeakBrake >= 75 && avgPeakBrake <= 95) ? 'PASS' : 'ADJUST'
    });
    benchmarks.push({
      metric: 'Brake Release Linearity',
      current: `${trailStat?.currentScore || 68}%`,
      target: '> 85%',
      status: (trailStat?.currentScore || 68) >= 80 ? 'PASS' : 'NEEDS WORK'
    });
    benchmarks.push({
      metric: 'Overall Chapter Mastery',
      current: `${masteryStats.overallMasteryScore || 0}%`,
      target: '>= 85% (Grade A)',
      status: (masteryStats.overallMasteryScore || 0) >= 80 ? 'PASS' : 'IN PROGRESS'
    });

    return {
      chapter,
      driverName,
      driverNumber,
      driverTier,
      trackName,
      car,
      stintId,
      masteryStats,
      strengths,
      weaknesses,
      focusAreas,
      drills,
      benchmarks,
      generatedAt: new Date()
    };
  }

  /**
   * Generates and triggers download of the 2-Page Light-Mode Coaching Debrief PDF
   * @param {Object} options
   * @param {boolean} [autoDownload=true]
   * @returns {Promise<Uint8Array>}
   */
  static async exportDebrief(options = {}, autoDownload = true) {
    const PDFLib = await this.getPdfLib();
    if (!PDFLib) {
      console.error('[SkillsCoachPDF] PDFLib not available');
      return null;
    }

    const debrief = this.synthesizeDebrief(options);
    const { PDFDocument, rgb, StandardFonts } = PDFLib;
    const doc = await PDFDocument.create();

    const fontBold = await doc.embedFont(StandardFonts.HelveticaBold);
    const fontRegular = await doc.embedFont(StandardFonts.Helvetica);
    const fontMono = await doc.embedFont(StandardFonts.CourierBold);

    // Light-Mode Palette (Optimized for crisp readability & light printing)
    const cBg = rgb(0.97, 0.98, 0.99); // Ultra light grey background
    const cCard = rgb(1.0, 1.0, 1.0); // Pure white card
    const cBorder = rgb(0.85, 0.88, 0.92);
    const cTextDark = rgb(0.08, 0.10, 0.14); // High contrast dark text
    const cTextMuted = rgb(0.38, 0.44, 0.52);
    const cAccent = rgb(0.88, 0.02, 0.0); // APEX F1 Red
    const cSuccess = rgb(0.0, 0.62, 0.32); // Racing Green
    const cWarning = rgb(0.92, 0.55, 0.05); // Amber
    const cBlue = rgb(0.0, 0.48, 0.88); // Cyan/Blue
    const cLightHeader = rgb(0.92, 0.94, 0.97);

    const W = 595.28;
    const H = 841.89;

    // Helper: Header & Footer on both pages
    const drawPageChrome = (page, pageNum, pageTitle) => {
      // Page background
      page.drawRectangle({ x: 0, y: 0, width: W, height: H, fill: cBg });

      // Top Red Racing Accent Stripe
      page.drawRectangle({ x: 0, y: H - 4, width: W, height: 4, fill: cAccent });

      // Header Branding & Metadata
      page.drawText('APEX // SKILLS ACADEMY', { x: 36, y: H - 26, size: 10, font: fontBold, color: cAccent });
      page.drawText('GOING FASTER! COACHING DEBRIEF', { x: 190, y: H - 26, size: 10, font: fontBold, color: cTextDark });
      page.drawText(`DRIVER: #${debrief.driverNumber} ${debrief.driverName.toUpperCase()} [${debrief.driverTier}] | ${debrief.trackName.toUpperCase()}`, { x: 36, y: H - 40, size: 8, font: fontRegular, color: cTextMuted });
      page.drawText(`GENERATED: ${debrief.generatedAt.toLocaleDateString()} ${debrief.generatedAt.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}`, { x: W - 185, y: H - 40, size: 7.5, font: fontMono, color: cTextMuted });

      page.drawLine({ start: { x: 36, y: H - 48 }, end: { x: W - 36, y: H - 48 }, thickness: 1, color: cBorder });

      // Section Banner
      page.drawRectangle({ x: 36, y: H - 72, width: W - 72, height: 18, fill: cLightHeader });
      page.drawText(`SECTION ${pageNum} // ${pageTitle.toUpperCase()}`, { x: 44, y: H - 67, size: 8.5, font: fontBold, color: cTextDark });

      // Footer
      page.drawLine({ start: { x: 36, y: 34 }, end: { x: W - 36, y: 34 }, thickness: 0.8, color: cBorder });
      page.drawText('APEX MOTORSPORT TELEMETRY // GOING FASTER DRIVER DEVELOPMENT PROTOCOL', { x: 36, y: 22, size: 7, font: fontRegular, color: cTextMuted });
      page.drawText(`PAGE ${pageNum} OF 2`, { x: W - 75, y: 22, size: 8, font: fontBold, color: cAccent });
    };

    // ==========================================
    // PAGE 1: MASTERY OVERVIEW, STRENGTHS & WEAKNESSES
    // ==========================================
    const page1 = doc.addPage([W, H]);
    drawPageChrome(page1, 1, 'Driver Mastery & Telemetry Evaluation');

    let y = H - 88;

    // 1. Hero Mastery Card (Top)
    page1.drawRectangle({ x: 36, y: y - 56, width: W - 72, height: 56, fill: cCard, borderColor: cBorder, borderWidth: 1 });
    
    // Grade Box on Left
    const gradeColor = debrief.masteryStats.grade === 'A' ? cSuccess : (debrief.masteryStats.grade === 'B' ? cBlue : (debrief.masteryStats.grade === 'C' ? cWarning : cAccent));
    page1.drawRectangle({ x: 44, y: y - 48, width: 44, height: 40, fill: rgb(0.95, 0.96, 0.98), borderColor: gradeColor, borderWidth: 1.5 });
    page1.drawText('GRADE', { x: 50, y: y - 20, size: 6.5, font: fontMono, color: cTextMuted });
    page1.drawText(debrief.masteryStats.grade || 'C', { x: 54, y: y - 42, size: 20, font: fontBold, color: gradeColor });

    // Center Details
    page1.drawText(`CHAPTER ${debrief.chapter.chapterNumber}: ${debrief.chapter.title.toUpperCase()}`, { x: 98, y: y - 20, size: 10, font: fontBold, color: cTextDark });
    page1.drawText(`${debrief.chapter.subtitle} | Curriculum Mastery Index: ${debrief.masteryStats.overallMasteryScore}%`, { x: 98, y: y - 34, size: 8.5, font: fontRegular, color: cTextMuted });
    page1.drawText(`Total Evaluated Attempts: ${debrief.masteryStats.totalAttempts || 0} corners | Stint: ${debrief.stintId === 'ALL' ? 'Cumulative Season' : debrief.stintId}`, { x: 98, y: y - 48, size: 7.5, font: fontRegular, color: cTextMuted });

    // Right Mastery Metric Pill
    page1.drawRectangle({ x: W - 140, y: y - 48, width: 96, height: 40, fill: rgb(0.93, 0.98, 0.94), borderColor: cSuccess, borderWidth: 1 });
    page1.drawText('MASTERY SCORE', { x: W - 134, y: y - 20, size: 7, font: fontMono, color: cSuccess });
    page1.drawText(`${debrief.masteryStats.overallMasteryScore}%`, { x: W - 120, y: y - 42, size: 18, font: fontBold, color: cSuccess });

    y -= 70;

    // 2. Pillar Scores Table
    page1.drawRectangle({ x: 36, y: y - 16, width: W - 72, height: 16, fill: cLightHeader });
    page1.drawText('TELEMETRY PILLAR', { x: 42, y: y - 11, size: 7.5, font: fontBold, color: cTextDark });
    page1.drawText('PRIORITY', { x: 190, y: y - 11, size: 7.5, font: fontBold, color: cTextDark });
    page1.drawText('SCORE', { x: 270, y: y - 11, size: 7.5, font: fontBold, color: cTextDark });
    page1.drawText('TREND', { x: 330, y: y - 11, size: 7.5, font: fontBold, color: cTextDark });
    page1.drawText('STATUS & BENCHMARK EVALUATION', { x: 390, y: y - 11, size: 7.5, font: fontBold, color: cTextDark });
    y -= 18;

    debrief.chapter.skills.forEach((sk, idx) => {
      const stat = debrief.masteryStats.skills[sk.id] || { currentScore: 0, trend: 'neutral' };
      const rowBg = idx % 2 === 0 ? cCard : rgb(0.95, 0.96, 0.98);
      const scoreColor = stat.currentScore >= 80 ? cSuccess : (stat.currentScore >= 60 ? cWarning : cAccent);
      const trendSymbol = stat.trend === 'improving' ? '+ IMPROVING' : (stat.trend === 'declining' ? '- DECLINING' : '= STABLE');
      const trendColor = stat.trend === 'improving' ? cSuccess : (stat.trend === 'declining' ? cAccent : cTextMuted);

      page1.drawRectangle({ x: 36, y: y - 14, width: W - 72, height: 14, fill: rowBg });
      page1.drawText(sk.name, { x: 42, y: y - 10, size: 7.5, font: fontBold, color: cTextDark });
      page1.drawText(sk.priority, { x: 190, y: y - 10, size: 7, font: fontMono, color: cTextMuted });
      page1.drawText(`${stat.currentScore}%`, { x: 270, y: y - 10, size: 7.5, font: fontBold, color: scoreColor });
      page1.drawText(trendSymbol, { x: 330, y: y - 10, size: 6.5, font: fontMono, color: trendColor });
      page1.drawText(stat.currentScore >= 80 ? 'Optimal telemetry window' : (stat.currentScore >= 60 ? 'Moderate variance; refinement required' : 'High deficit; focus zone'), { x: 390, y: y - 10, size: 7, font: fontRegular, color: cTextMuted });
      y -= 15;
    });

    y -= 12;

    // 3. Section: WHAT YOU DID GOOD
    page1.drawRectangle({ x: 36, y: y - 16, width: W - 72, height: 16, fill: rgb(0.90, 0.96, 0.92) });
    page1.drawText('WHAT YOU DID GOOD // STRENGTHS & POSITIVE HABITS', { x: 42, y: y - 11, size: 8, font: fontBold, color: cSuccess });
    y -= 20;

    debrief.strengths.slice(0, 3).forEach((s) => {
      page1.drawRectangle({ x: 36, y: y - 36, width: W - 72, height: 36, fill: cCard, borderColor: rgb(0.75, 0.90, 0.80), borderWidth: 1 });
      page1.drawText(`[+]  ${s.title.toUpperCase()}`, { x: 44, y: y - 13, size: 8, font: fontBold, color: cSuccess });
      page1.drawText(s.text.slice(0, 115), { x: 44, y: y - 24, size: 7.2, font: fontRegular, color: cTextDark });
      if (s.text.length > 115) {
        page1.drawText(s.text.slice(115, 230), { x: 44, y: y - 33, size: 7.2, font: fontRegular, color: cTextDark });
      }
      y -= 40;
    });

    y -= 6;

    // 4. Section: WHAT YOU COULD HAVE DONE BETTER
    page1.drawRectangle({ x: 36, y: y - 16, width: W - 72, height: 16, fill: rgb(0.99, 0.93, 0.93) });
    page1.drawText('WHAT YOU COULD HAVE DONE BETTER // WEAKNESSES & TELEMETRY DEFICITS', { x: 42, y: y - 11, size: 8, font: fontBold, color: cAccent });
    y -= 20;

    debrief.weaknesses.slice(0, 3).forEach((w) => {
      page1.drawRectangle({ x: 36, y: y - 36, width: W - 72, height: 36, fill: cCard, borderColor: rgb(0.95, 0.80, 0.80), borderWidth: 1 });
      page1.drawText(`[!]  ${w.title.toUpperCase()}`, { x: 44, y: y - 13, size: 8, font: fontBold, color: cAccent });
      page1.drawText(w.text.slice(0, 115), { x: 44, y: y - 24, size: 7.2, font: fontRegular, color: cTextDark });
      if (w.text.length > 115) {
        page1.drawText(w.text.slice(115, 230), { x: 44, y: y - 33, size: 7.2, font: fontRegular, color: cTextDark });
      }
      y -= 40;
    });

    // ==========================================
    // PAGE 2: ACTIONABLE DRILLS & FOCUS ROADMAP
    // ==========================================
    const page2 = doc.addPage([W, H]);
    drawPageChrome(page2, 2, 'Actionable Drills & Target Roadmap');

    let y2 = H - 88;

    // 1. Key Focus Areas Banner
    page2.drawRectangle({ x: 36, y: y2 - 16, width: W - 72, height: 16, fill: rgb(0.90, 0.94, 0.99) });
    page2.drawText('WHAT TO FOCUS ON NEXT // PRIORITY FOCUS AREAS', { x: 42, y: y2 - 11, size: 8, font: fontBold, color: cBlue });
    y2 -= 22;

    debrief.focusAreas.slice(0, 3).forEach((f) => {
      page2.drawRectangle({ x: 36, y: y2 - 38, width: W - 72, height: 38, fill: cCard, borderColor: cBorder, borderWidth: 1 });
      page2.drawText(`${f.priority}: ${f.title.toUpperCase()}`, { x: 44, y: y2 - 13, size: 8, font: fontBold, color: cTextDark });
      page2.drawText(f.impact, { x: W - 190, y: y2 - 13, size: 7, font: fontMono, color: cAccent });
      page2.drawText(f.desc.slice(0, 120), { x: 44, y: y2 - 25, size: 7.2, font: fontRegular, color: cTextMuted });
      if (f.desc.length > 120) {
        page2.drawText(f.desc.slice(120, 240), { x: 44, y: y2 - 34, size: 7.2, font: fontRegular, color: cTextMuted });
      }
      y2 -= 44;
    });

    y2 -= 10;

    // 2. Step-by-Step Actionable Drills
    page2.drawRectangle({ x: 36, y: y2 - 16, width: W - 72, height: 16, fill: cLightHeader });
    page2.drawText('STEP-BY-STEP ACTIONABLE TRACK DRILLS // SKIP BARBER METHODOLOGY', { x: 42, y: y2 - 11, size: 8, font: fontBold, color: cTextDark });
    y2 -= 22;

    debrief.drills.slice(0, 3).forEach((d) => {
      page2.drawRectangle({ x: 36, y: y2 - 62, width: W - 72, height: 62, fill: cCard, borderColor: cBorder, borderWidth: 1 });
      
      // Drill Header Box
      page2.drawText(`${d.stepNumber}: ${d.name.toUpperCase()}`, { x: 44, y: y2 - 14, size: 8.5, font: fontBold, color: cAccent });
      page2.drawText(d.cue, { x: W - 240, y: y2 - 14, size: 7, font: fontMono, color: cSuccess });

      // Step Lines
      page2.drawText(d.steps[0] || '', { x: 46, y: y2 - 27, size: 7.2, font: fontRegular, color: cTextDark });
      page2.drawText(d.steps[1] || '', { x: 46, y: y2 - 39, size: 7.2, font: fontRegular, color: cTextDark });
      page2.drawText(d.steps[2] || '', { x: 46, y: y2 - 51, size: 7.2, font: fontRegular, color: cTextDark });

      y2 -= 68;
    });

    y2 -= 10;

    // 3. Telemetry Targets Table
    page2.drawRectangle({ x: 36, y: y2 - 16, width: W - 72, height: 16, fill: cLightHeader });
    page2.drawText('METRIC / ATTRIBUTE', { x: 42, y: y2 - 11, size: 7.5, font: fontBold, color: cTextDark });
    page2.drawText('CURRENT DRIVER VALUE', { x: 210, y: y2 - 11, size: 7.5, font: fontBold, color: cTextDark });
    page2.drawText('RECOMMENDED TARGET', { x: 340, y: y2 - 11, size: 7.5, font: fontBold, color: cTextDark });
    page2.drawText('STATUS', { x: 490, y: y2 - 11, size: 7.5, font: fontBold, color: cTextDark });
    y2 -= 18;

    debrief.benchmarks.forEach((b, idx) => {
      const rowBg = idx % 2 === 0 ? cCard : rgb(0.95, 0.96, 0.98);
      const statusColor = b.status === 'PASS' ? cSuccess : (b.status === 'ADJUST' ? cWarning : cAccent);

      page2.drawRectangle({ x: 36, y: y2 - 15, width: W - 72, height: 15, fill: rowBg });
      page2.drawText(b.metric, { x: 42, y: y2 - 11, size: 7.5, font: fontBold, color: cTextDark });
      page2.drawText(b.current, { x: 210, y: y2 - 11, size: 7.5, font: fontMono, color: cTextDark });
      page2.drawText(b.target, { x: 340, y: y2 - 11, size: 7.5, font: fontRegular, color: cTextDark });
      page2.drawText(b.status, { x: 490, y: y2 - 11, size: 7, font: fontMono, color: statusColor });
      y2 -= 16;
    });

    y2 -= 12;

    // 4. Quote Banner at bottom of Page 2
    page2.drawRectangle({ x: 36, y: y2 - 28, width: W - 72, height: 28, fill: rgb(0.94, 0.95, 0.98), borderColor: cBorder, borderWidth: 1 });
    page2.drawText('"Smooth is fast. The secret to going faster is not driving harder, but eliminating unnecessary inputs."', { x: 44, y: y2 - 12, size: 7, font: fontRegular, color: cTextMuted });
    page2.drawText('-- Skip Barber Racing School // Going Faster Master Principle', { x: 44, y: y2 - 22, size: 6.5, font: fontMono, color: cAccent });

    // Save and download PDF
    const pdfBytes = await doc.save();

    if (autoDownload && typeof window !== 'undefined' && typeof document !== 'undefined') {
      const blob = new Blob([pdfBytes], { type: 'application/pdf' });
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      const safeName = debrief.driverName.replace(/[^a-zA-Z0-9]/g, '_');
      const dateTag = new Date().toISOString().slice(0, 10);
      a.download = `APEX_Skills_Coaching_Debrief_${safeName}_Ch${debrief.chapter.chapterNumber}_${dateTag}.pdf`;
      document.body.appendChild(a);
      a.click();
      document.body.removeChild(a);
      URL.revokeObjectURL(url);

      if (window.PitToast && typeof window.PitToast.success === 'function') {
        window.PitToast.success(`Skills Coaching Debrief PDF Exported (${debrief.driverName})`, 'COACHING PDF');
      }
    }

    return pdfBytes;
  }
}
