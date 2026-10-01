/**
 * APEX PDF Direct Download & Export Controller
 * Enforces direct file downloads globally with zero print modals.
 */

import { downloadPdfDirect } from './pdf-theme.js';

export class PdfPreviewModal {
  static currentPdfBytes = null;
  static currentFilename = 'APEX_Report.pdf';

  /**
   * Directly downloads the generated PDF bytes without opening print modals.
   * @param {Uint8Array|Blob} pdfData
   * @param {string} [filename='APEX_Report.pdf']
   * @param {string} [title='APEX Telemetry Debrief']
   */
  static async show(pdfData, filename = 'APEX_Report.pdf', title = 'APEX Telemetry Debrief') {
    this.currentFilename = filename;
    this.currentPdfBytes = pdfData;

    await downloadPdfDirect(pdfData, filename);
  }

  /**
   * Closes any legacy modal if present
   */
  static close() {
    const backdrop = document.getElementById('apex-pdf-preview-modal');
    if (backdrop) {
      backdrop.classList.remove('is-open');
    }
  }

  /**
   * User-triggered direct file download
   */
  static async saveFile() {
    if (!this.currentPdfBytes) {
      console.warn('[PdfPreviewModal] No PDF data to save');
      return;
    }
    await downloadPdfDirect(this.currentPdfBytes, this.currentFilename);
  }

  /**
   * Print disabled in favor of direct PDF download
   */
  static async printDocument() {
    if (this.currentPdfBytes) {
      await downloadPdfDirect(this.currentPdfBytes, this.currentFilename);
    }
  }
}

if (typeof window !== 'undefined') {
  window.PdfPreviewModal = PdfPreviewModal;
}

