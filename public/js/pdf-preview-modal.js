/**
 * APEX In-App PDF Preview Modal Component
 * Replaces automatic file downloads with an interactive in-app previewer.
 * Provides explicit user actions: "Save / Download PDF" and "Print Document".
 */

export class PdfPreviewModal {
  static instance = null;
  static currentBlobUrl = null;
  static currentPdfBytes = null;
  static currentFilename = 'APEX_Report.pdf';

  /**
   * Initializes or returns the modal DOM structure
   */
  static ensureModal() {
    if (document.getElementById('apex-pdf-preview-modal')) {
      return;
    }

    const backdrop = document.createElement('div');
    backdrop.id = 'apex-pdf-preview-modal';
    backdrop.className = 'apex-pdf-modal-backdrop';
    backdrop.innerHTML = `
      <div class="apex-pdf-modal-window" role="dialog" aria-modal="true" aria-labelledby="apex-pdf-modal-title">
        <div class="apex-pdf-modal-header">
          <div class="apex-pdf-modal-title-group">
            <span class="apex-pdf-modal-badge">5-PAGE DOSSIER</span>
            <div id="apex-pdf-modal-title" class="apex-pdf-modal-title">APEX Telemetry Debrief</div>
            <span id="apex-pdf-modal-subtitle" class="apex-pdf-modal-subtitle">report.pdf</span>
          </div>
          <div class="apex-pdf-modal-actions">
            <button id="apex-pdf-btn-save" class="apex-pdf-btn apex-pdf-btn-save" title="Save file to local disk">
              <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5"><path d="M19 21H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h11l5 5v11a2 2 0 0 1-2 2z"></path><polyline points="17 21 17 13 7 13 7 21"></polyline><polyline points="7 3 7 8 15 8"></polyline></svg>
              <span>Save / Download PDF</span>
            </button>
            <button id="apex-pdf-btn-print" class="apex-pdf-btn apex-pdf-btn-print" title="Print document">
              <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.2"><polyline points="6 9 6 2 18 2 18 9"></polyline><path d="M6 18H4a2 2 0 0 1-2-2v-5a2 2 0 0 1 2-2h16a2 2 0 0 1 2 2v5a2 2 0 0 1-2 2h-2"></path><rect x="6" y="14" width="12" height="8"></rect></svg>
              <span>Print</span>
            </button>
            <button id="apex-pdf-btn-close" class="apex-pdf-btn apex-pdf-btn-close" title="Close Preview (Esc)">✕</button>
          </div>
        </div>
        <div class="apex-pdf-modal-body">
          <iframe id="apex-pdf-iframe" class="apex-pdf-iframe" title="PDF Document Preview"></iframe>
        </div>
        <div class="apex-pdf-modal-footer-notice">
          <span>APEX MOTORSPORT TELEMETRY SYSTEM // SKIP BARBER METHODOLOGY</span>
          <span>5-PAGE LIGHT MODE REPORT // READY FOR EXPORT</span>
        </div>
      </div>
    `;

    document.body.appendChild(backdrop);

    // Event Listeners
    const saveBtn = backdrop.querySelector('#apex-pdf-btn-save');
    const printBtn = backdrop.querySelector('#apex-pdf-btn-print');
    const closeBtn = backdrop.querySelector('#apex-pdf-btn-close');

    saveBtn.addEventListener('click', () => PdfPreviewModal.saveFile());
    printBtn.addEventListener('click', () => PdfPreviewModal.printDocument());
    closeBtn.addEventListener('click', () => PdfPreviewModal.close());

    backdrop.addEventListener('click', (e) => {
      if (e.target === backdrop) {
        PdfPreviewModal.close();
      }
    });

    document.addEventListener('keydown', (e) => {
      if (e.key === 'Escape' && backdrop.classList.contains('is-open')) {
        PdfPreviewModal.close();
      }
    });
  }

  /**
   * Opens the in-app modal preview with the generated PDF bytes.
   * @param {Uint8Array|Blob} pdfData
   * @param {string} [filename='APEX_Report.pdf']
   * @param {string} [title='APEX Telemetry Debrief']
   */
  static show(pdfData, filename = 'APEX_Report.pdf', title = 'APEX Telemetry Debrief') {
    if (typeof document === 'undefined') return;

    this.ensureModal();
    this.close(false); // Cleanup any previous blob URL

    this.currentFilename = filename;
    this.currentPdfBytes = pdfData;

    let blob;
    if (pdfData instanceof Blob) {
      blob = pdfData;
    } else {
      blob = new Blob([pdfData], { type: 'application/pdf' });
    }

    this.currentBlobUrl = URL.createObjectURL(blob);

    const backdrop = document.getElementById('apex-pdf-preview-modal');
    const titleEl = document.getElementById('apex-pdf-modal-title');
    const subTitleEl = document.getElementById('apex-pdf-modal-subtitle');
    const iframe = document.getElementById('apex-pdf-iframe');

    if (titleEl) titleEl.textContent = title;
    if (subTitleEl) subTitleEl.textContent = filename;
    if (iframe) iframe.src = this.currentBlobUrl;

    backdrop.classList.add('is-open');

    if (window.PitToast && typeof window.PitToast.info === 'function') {
      window.PitToast.info(`Generated 5-Page Dossier: ${title}`, 'PDF PREVIEW READY');
    }
  }

  /**
   * Closes the preview modal and cleans up Object URLs
   */
  static close(removeBackdropClass = true) {
    if (this.currentBlobUrl) {
      URL.revokeObjectURL(this.currentBlobUrl);
      this.currentBlobUrl = null;
    }

    const backdrop = document.getElementById('apex-pdf-preview-modal');
    if (backdrop && removeBackdropClass) {
      backdrop.classList.remove('is-open');
      const iframe = document.getElementById('apex-pdf-iframe');
      if (iframe) iframe.src = 'about:blank';
    }
  }

  /**
   * User-triggered file download
   */
  static saveFile() {
    if (!this.currentPdfBytes) {
      console.warn('[PdfPreviewModal] No PDF data to save');
      return;
    }

    const blob = (this.currentPdfBytes instanceof Blob)
      ? this.currentPdfBytes
      : new Blob([this.currentPdfBytes], { type: 'application/pdf' });

    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = this.currentFilename;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);

    if (window.PitToast && typeof window.PitToast.success === 'function') {
      window.PitToast.success(`Saved ${this.currentFilename}`, 'PDF DOWNLOAD COMPLETE');
    }
  }

  /**
   * User-triggered print dialog
   */
  static printDocument() {
    const iframe = document.getElementById('apex-pdf-iframe');
    if (iframe && iframe.contentWindow) {
      try {
        iframe.contentWindow.focus();
        iframe.contentWindow.print();
      } catch (err) {
        console.warn('[PdfPreviewModal] Could not trigger iframe print directly, falling back to window print:', err);
        window.print();
      }
    }
  }
}

if (typeof window !== 'undefined') {
  window.PdfPreviewModal = PdfPreviewModal;
}
