import fs from 'fs';

function main() {
  const builderPath = 'src/pdf/pdf-builder.js';
  const generatorPath = 'public/js/pdf-generator.js';

  console.log('Reading:', builderPath);
  let content = fs.readFileSync(builderPath, 'utf8');

  // Replace import from pdf-lib
  content = content.replace(
    "import { PDFDocument, rgb, StandardFonts } from 'pdf-lib';",
    "const rgb = (r, g, b) => {\n  if (!window.PDFLib) throw new Error('PDFLib is not loaded.');\n  return window.PDFLib.rgb(r, g, b);\n};"
  );

  // Replace TrackMapGenerator import
  content = content.replace(
    "import { TrackMapGenerator, STATE_COLORS } from '../analysis/track-map.js';",
    "import { TrackMapGenerator, STATE_COLORS } from './analysis/track-map.js';"
  );

  // Rename class
  content = content.replace(
    "export class ApexPdfBuilder {",
    "export class ClientPdfGenerator {"
  );

  // Remove colors initialization from constructor
  const constructorTarget = `  constructor() {
    this.width = 595.28;  // A4 Width in points
    this.height = 841.89; // A4 Height in points
    this.margin = 36;     // 0.5 inch margins
    this.trackMapGenerator = new TrackMapGenerator();

    // Clean Motorsport Light Theme Palette
    this.colors = {
      bg: rgb(1, 1, 1),                      // Pure White #FFFFFF
      panel: rgb(0.972, 0.980, 0.988),       // Slate-50 #F8FAFC
      panelAlt: rgb(0.945, 0.961, 0.976),    // Slate-100 #F1F5F9
      border: rgb(0.886, 0.910, 0.941),      // Slate-200 #E2E8F0
      borderBright: rgb(0.796, 0.835, 0.882), // Slate-300 #CBD5E1
      f1Red: rgb(0.882, 0.024, 0),           // Signature APEX Red #E10600
      textPrimary: rgb(0.059, 0.090, 0.165), // Deep Slate-900 #0F172A
      textSecondary: rgb(0.200, 0.255, 0.333),// Slate-700 #334155
      textMuted: rgb(0.392, 0.455, 0.545),   // Slate-500 #64748B
      white: rgb(1, 1, 1),
      success: rgb(0.020, 0.588, 0.314),     // Emerald-600 #059669
      warning: rgb(0.851, 0.463, 0.024),     // Amber-600 #D97706
      blue: rgb(0.012, 0.518, 0.780),        // Sky-600 #0284C7
      gold: rgb(0.706, 0.447, 0.020),        // Amber-700 #B45309
      amber: rgb(0.851, 0.463, 0.024),
      cyan: rgb(0.031, 0.569, 0.698)
    };
  }`;

  const constructorReplacement = `  constructor() {
    this.width = 595.28;  // A4 Width in points
    this.height = 841.89; // A4 Height in points
    this.margin = 36;     // 0.5 inch margins
    this.trackMapGenerator = new TrackMapGenerator();
  }`;

  if (content.includes(constructorTarget)) {
    content = content.replace(constructorTarget, constructorReplacement);
  } else {
    // Try fuzzy match on constructor if formatting differs
    console.warn('Constructor exact match not found. Attempting fuzzy replace...');
    const startIdx = content.indexOf('constructor() {');
    const endIdx = content.indexOf('  toKmh(mph)');
    if (startIdx !== -1 && endIdx !== -1 && endIdx > startIdx) {
      const oldConstructor = content.substring(startIdx, endIdx);
      content = content.replace(oldConstructor, constructorReplacement + '\n\n');
    }
  }

  // Update build() method: rename to generate(), check PDFLib in window, setup this.colors
  const buildTarget = `  async build(report, metadata = {}) {
    const doc = await PDFDocument.create();`;

  const buildReplacement = `  async generate(report, metadata = {}) {
    const PDFLib = window.PDFLib;
    if (!PDFLib) {
      throw new Error('PDFLib is not loaded in the browser window.');
    }
    const { PDFDocument, rgb: pdfLibRgb, StandardFonts } = PDFLib;

    this.colors = {
      bg: pdfLibRgb(1, 1, 1),                      // Pure White #FFFFFF
      panel: pdfLibRgb(0.972, 0.980, 0.988),       // Slate-50 #F8FAFC
      panelAlt: pdfLibRgb(0.945, 0.961, 0.976),    // Slate-100 #F1F5F9
      border: pdfLibRgb(0.886, 0.910, 0.941),      // Slate-200 #E2E8F0
      borderBright: pdfLibRgb(0.796, 0.835, 0.882), // Slate-300 #CBD5E1
      f1Red: pdfLibRgb(0.882, 0.024, 0),           // Signature APEX Red #E10600
      textPrimary: pdfLibRgb(0.059, 0.090, 0.165), // Deep Slate-900 #0F172A
      textSecondary: pdfLibRgb(0.200, 0.255, 0.333),// Slate-700 #334155
      textMuted: pdfLibRgb(0.392, 0.455, 0.545),   // Slate-500 #64748B
      white: pdfLibRgb(1, 1, 1),
      success: pdfLibRgb(0.020, 0.588, 0.314),     // Emerald-600 #059669
      warning: pdfLibRgb(0.851, 0.463, 0.024),     // Amber-600 #D97706
      blue: pdfLibRgb(0.012, 0.518, 0.780),        // Sky-600 #0284C7
      gold: pdfLibRgb(0.706, 0.447, 0.020),        // Amber-700 #B45309
      amber: pdfLibRgb(0.851, 0.463, 0.024),
      cyan: pdfLibRgb(0.031, 0.569, 0.698)
    };

    const doc = await PDFDocument.create();`;

  if (content.includes(buildTarget)) {
    content = content.replace(buildTarget, buildReplacement);
  } else {
    console.warn('build() exact match not found. Attempting fuzzy replace...');
    const buildIdx = content.indexOf('async build(');
    if (buildIdx !== -1) {
      const docCreateIdx = content.indexOf('PDFDocument.create()', buildIdx);
      if (docCreateIdx !== -1) {
        const nextLineIdx = content.indexOf('\n', docCreateIdx);
        const oldBuildPart = content.substring(buildIdx, nextLineIdx);
        content = content.replace(oldBuildPart, buildReplacement);
      }
    }
  }

  // Add download method at the end of ClientPdfGenerator class (before the last closing brace)
  const lastClosingBraceIdx = content.lastIndexOf('}');
  if (lastClosingBraceIdx !== -1) {
    const downloadMethod = `\n  download(pdfBytes, filename = 'APEX_Telemetry_Report.pdf') {
    const blob = new Blob([pdfBytes], { type: 'application/pdf' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = filename;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
  }\n`;
    content = content.substring(0, lastClosingBraceIdx) + downloadMethod + content.substring(lastClosingBraceIdx);
  }

  console.log('Writing modified file to:', generatorPath);
  fs.writeFileSync(generatorPath, content, 'utf8');
  console.log('Generator aligned successfully!');
}

main();
