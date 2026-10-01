/**
 * APEX PDF Shared Theme & Component Library (Node & Browser)
 */

export const getPdfLib = async () => {
  if (typeof window !== 'undefined' && window.PDFLib) {
    return window.PDFLib;
  }
  try {
    return await import('pdf-lib');
  } catch (e) {
    console.error('[PdfTheme] pdf-lib not available:', e);
    return null;
  }
};

export const PDF_DIMENSIONS = {
  width: 595.28,
  height: 841.89,
  margin: 36
};

export const createPdfColors = (rgb) => ({
  bg: rgb(1.0, 1.0, 1.0),
  card: rgb(1.0, 1.0, 1.0),
  cardAlt: rgb(0.972, 0.980, 0.988),
  panelHeader: rgb(0.945, 0.961, 0.976),
  border: rgb(0.886, 0.910, 0.941),
  borderBright: rgb(0.796, 0.835, 0.882),
  
  textDark: rgb(0.059, 0.090, 0.165),
  textSecondary: rgb(0.200, 0.255, 0.333),
  textMuted: rgb(0.392, 0.455, 0.545),
  
  accent: rgb(0.882, 0.024, 0.0),
  accentDark: rgb(0.700, 0.0, 0.0),
  blue: rgb(0.012, 0.518, 0.780),
  success: rgb(0.020, 0.588, 0.314),
  warning: rgb(0.851, 0.463, 0.024),
  orange: rgb(0.917, 0.345, 0.047),
  calloutBg: rgb(0.957, 0.973, 1.0),
  calloutBorder: rgb(0.750, 0.860, 0.980)
});

export function wrapText(text, maxWidth, font, fontSize) {
  if (!text) return [];
  const safeText = String(text)
    .replace(/[^\x00-\x7F]/g, ' ')
    .replace(/\s+/g, ' ')
    .trim();

  const words = safeText.split(' ');
  const lines = [];
  let currentLine = '';

  for (const word of words) {
    const testLine = currentLine ? `${currentLine} ${word}` : word;
    const testWidth = font.widthOfTextAtSize(testLine, fontSize);
    if (testWidth > maxWidth && currentLine) {
      lines.push(currentLine);
      currentLine = word;
    } else {
      currentLine = testLine;
    }
  }
  if (currentLine) {
    lines.push(currentLine);
  }
  return lines;
}

export function drawPageChrome(page, options = {}) {
  const {
    pageNum = 1,
    totalPages = 5,
    pageTitle = '',
    category = 'PIT-WALL TELEMETRY',
    subtitle = 'GOING FASTER! STINT REVIEW',
    trackName = 'Circuit',
    carName = 'GT3 Racecar',
    colors,
    fonts
  } = options;

  const { width: W, height: H } = PDF_DIMENSIONS;
  const { fontBold, fontRegular, fontMono } = fonts;

  page.drawRectangle({ x: 0, y: 0, width: W, height: H, fill: colors.bg });
  page.drawRectangle({ x: 0, y: H - 4, width: W, height: 4, fill: colors.accent });

  page.drawText(`APEX // ${category.toUpperCase()}`, { x: 36, y: H - 28, size: 9.5, font: fontBold, color: colors.accent });
  page.drawText(subtitle.toUpperCase(), { x: 210, y: H - 28, size: 9.5, font: fontBold, color: colors.textDark });
  page.drawText(`${trackName} | ${carName}`, { x: 36, y: H - 42, size: 8, font: fontRegular, color: colors.textMuted });
  page.drawText(`DATE: ${new Date().toLocaleDateString()}`, { x: W - 160, y: H - 42, size: 8, font: fontMono, color: colors.textMuted });

  page.drawLine({ start: { x: 36, y: H - 50 }, end: { x: W - 36, y: H - 50 }, thickness: 1, color: colors.border });

  page.drawRectangle({ x: 36, y: H - 76, width: W - 72, height: 22, fill: colors.panelHeader, borderColor: colors.border, borderWidth: 1 });
  page.drawText(`PAGE ${pageNum} OF ${totalPages} // ${pageTitle.toUpperCase()}`, { x: 46, y: H - 71, size: 8.5, font: fontBold, color: colors.textDark });

  page.drawLine({ start: { x: 36, y: 36 }, end: { x: W - 36, y: 36 }, thickness: 0.8, color: colors.border });
  page.drawText('CONFIDENTIAL MOTORSPORT TELEMETRY // SKIP BARBER RACING METHODOLOGY', { x: 36, y: 22, size: 7, font: fontRegular, color: colors.textMuted });
  page.drawText(`PAGE ${pageNum} OF ${totalPages}`, { x: W - 96, y: 22, size: 8, font: fontBold, color: colors.accent });
}

export function drawMetricDualCard(page, options = {}) {
  const {
    x = 36,
    y = 700,
    width = 250,
    height = 95,
    title = 'METRIC',
    techValue = '0.00',
    unit = '',
    target = '',
    laymanExplanation = 'Plain English explanation of this metric.',
    statusColor = null,
    colors,
    fonts
  } = options;

  const { fontBold, fontRegular, fontMono } = fonts;
  const accentColor = statusColor || colors.blue;

  page.drawRectangle({
    x,
    y: y - height,
    width,
    height,
    fill: colors.card,
    borderColor: colors.border,
    borderWidth: 1
  });

  page.drawRectangle({
    x,
    y: y - 20,
    width,
    height: 20,
    fill: colors.panelHeader
  });
  page.drawText(title.toUpperCase(), {
    x: x + 8,
    y: y - 14,
    size: 7.5,
    font: fontBold,
    color: colors.textSecondary
  });

  if (target) {
    page.drawText(`Target: ${target}`, {
      x: x + width - 90,
      y: y - 14,
      size: 7,
      font: fontMono,
      color: colors.textMuted
    });
  }

  page.drawText(String(techValue), {
    x: x + 8,
    y: y - 42,
    size: 15,
    font: fontBold,
    color: accentColor
  });

  if (unit) {
    const valWidth = fontBold.widthOfTextAtSize(String(techValue), 15);
    page.drawText(` ${unit}`, {
      x: x + 8 + valWidth,
      y: y - 42,
      size: 9,
      font: fontRegular,
      color: colors.textMuted
    });
  }

  const calloutH = height - 50;
  page.drawRectangle({
    x: x + 6,
    y: y - height + 6,
    width: width - 12,
    height: calloutH,
    fill: colors.calloutBg,
    borderColor: colors.calloutBorder,
    borderWidth: 0.8
  });

  page.drawText('WHAT THIS MEANS:', {
    x: x + 10,
    y: y - height + calloutH - 2,
    size: 6.5,
    font: fontBold,
    color: colors.blue
  });

  const lines = wrapText(laymanExplanation, width - 24, fontRegular, 7.2);
  lines.slice(0, 3).forEach((line, idx) => {
    page.drawText(line, {
      x: x + 10,
      y: y - height + calloutH - 13 - (idx * 9.5),
      size: 7,
      font: fontRegular,
      color: colors.textDark
    });
  });
}

export function drawCoachingDrill(page, options = {}) {
  const {
    x = 36,
    y = 700,
    width = 523.28,
    height = 92,
    drillNumber = 1,
    title = 'DRILL TITLE',
    problem = '',
    whyItMatters = '',
    plainEnglishFix = '',
    badge = 'HIGH PRIORITY',
    colors,
    fonts
  } = options;

  const { fontBold, fontRegular, fontMono } = fonts;

  page.drawRectangle({
    x,
    y: y - height,
    width,
    height,
    fill: colors.card,
    borderColor: colors.border,
    borderWidth: 1
  });

  page.drawRectangle({
    x,
    y: y - 20,
    width,
    height: 20,
    fill: colors.panelHeader
  });

  page.drawText(`DRILL #${drillNumber}: ${title.toUpperCase()}`, {
    x: x + 8,
    y: y - 14,
    size: 8.5,
    font: fontBold,
    color: colors.accent
  });

  page.drawText(badge, {
    x: x + width - 85,
    y: y - 14,
    size: 7,
    font: fontMono,
    color: colors.warning
  });

  let curY = y - 32;

  page.drawText('THE PROBLEM:', { x: x + 8, y: curY, size: 7.2, font: fontBold, color: colors.accent });
  const probLines = wrapText(problem, width - 110, fontRegular, 7.2);
  page.drawText(probLines[0] || '', { x: x + 95, y: curY, size: 7.2, font: fontRegular, color: colors.textDark });
  curY -= 17;

  page.drawText('WHY IT MATTERS:', { x: x + 8, y: curY, size: 7.2, font: fontBold, color: colors.warning });
  const whyLines = wrapText(whyItMatters, width - 110, fontRegular, 7.2);
  page.drawText(whyLines[0] || '', { x: x + 95, y: curY, size: 7.2, font: fontRegular, color: colors.textDark });
  curY -= 19;

  page.drawRectangle({
    x: x + 6,
    y: y - height + 6,
    width: width - 12,
    height: 22,
    fill: colors.cardAlt,
    borderColor: colors.border,
    borderWidth: 0.8
  });

  page.drawText('PLAIN-ENGLISH FIX:', {
    x: x + 10,
    y: y - height + 15,
    size: 7,
    font: fontBold,
    color: colors.success
  });

  const fixLines = wrapText(plainEnglishFix, width - 130, fontBold, 7.2);
  page.drawText(fixLines[0] || '', {
    x: x + 105,
    y: y - height + 15,
    size: 7.2,
    font: fontRegular,
    color: colors.textDark
  });
}

/**
 * Triggers direct browser download or native desktop save without print modals.
 * @param {Uint8Array|Blob} pdfBytes
 * @param {string} filename
 * @param {Object} options
 */
export async function downloadPdfDirect(pdfBytes, filename = 'APEX_Report.pdf', options = {}) {
  if (typeof window === 'undefined') return;

  const driverName = options.driverName || 'APEX Driver';

  if (window.apexDesktop?.saveFile) {
    let binary = '';
    const len = pdfBytes.byteLength || 0;
    const chunkSize = 8192;
    for (let i = 0; i < len; i += chunkSize) {
      const chunk = pdfBytes.subarray(i, Math.min(i + chunkSize, len));
      binary += String.fromCharCode.apply(null, chunk);
    }
    const base64 = btoa(binary);

    // Auto-archive automatically to Documents/APEX/user/
    window.apexDesktop.autoArchive?.({ fileName: filename, data: base64, encoding: 'base64', extension: 'pdf', driverName });

    // Native save dialog
    await window.apexDesktop.saveFile({
      title: 'Save APEX Telemetry PDF',
      suggestedName: filename,
      filters: [{ name: 'PDF Document (*.pdf)', extensions: ['pdf'] }],
      data: base64,
      encoding: 'base64'
    });
    return;
  }

  const blob = (pdfBytes instanceof Blob)
    ? pdfBytes
    : new Blob([pdfBytes], { type: 'application/pdf' });

  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = filename;
  document.body.appendChild(a);
  a.click();
  document.body.removeChild(a);
  setTimeout(() => URL.revokeObjectURL(url), 2000);

  if (window.PitToast && typeof window.PitToast.success === 'function') {
    window.PitToast.success(`Downloaded ${filename}`, 'PDF DOWNLOAD COMPLETE');
  }
}
