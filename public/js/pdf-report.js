export class PdfReportGenerator {
  static async generateStintReport(stintData, telemetryStats) {
    try {
      const { PDFDocument, rgb } = window.PDFLib;
      const pdfDoc = await PDFDocument.create();
      const page = pdfDoc.addPage([595.28, 841.89]); // A4 size
      
      const { width, height } = page.getSize();
      
      // Title
      page.drawText(`${stintData.tierName} - ${stintData.name} Report`, {
        x: 50,
        y: height - 50,
        size: 24,
        color: rgb(0, 0, 0)
      });
      
      // Metadata
      page.drawText(`Date: ${new Date().toLocaleDateString()}`, { x: 50, y: height - 80, size: 12 });
      page.drawText(`Focus Area: ${stintData.focus}`, { x: 50, y: height - 100, size: 12 });
      
      // Telemetry Stats
      let y = height - 140;
      page.drawText(`Telemetry Summary:`, { x: 50, y, size: 16 });
      y -= 30;
      
      for (const [key, value] of Object.entries(telemetryStats)) {
        page.drawText(`${key}: ${value}`, { x: 50, y, size: 12 });
        y -= 20;
      }
      
      // Action Items
      y -= 20;
      page.drawText(`Next Steps & Action Items:`, { x: 50, y, size: 16 });
      y -= 30;
      page.drawText(`Review the guide: ${stintData.guide.substring(0, 80)}...`, { x: 50, y, size: 12 });

      const pdfBytes = await pdfDoc.save();
      const blob = new Blob([pdfBytes], { type: 'application/pdf' });
      const url = URL.createObjectURL(blob);
      
      const link = document.createElement('a');
      link.href = url;
      link.download = `APEX_Stint_Report_${stintData.id}.pdf`;
      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);
      URL.revokeObjectURL(url);
    } catch (e) {
      console.error("Failed to generate PDF", e);
      alert("Failed to generate PDF Report");
    }
  }
}
