/**
 * APEX Telemetry Command Center - Auto-Updater UI Controller
 * Manages titlebar update badges, release notes viewer, download progress streaming,
 * and 1-click in-place update execution.
 */

export class UiUpdater {
  constructor() {
    this.container = null;
    this.badgeEl = null;
    this.modalEl = null;
    this.isOpen = false;
    this.currentUpdate = null;
    this.status = 'idle'; // 'idle' | 'available' | 'downloading' | 'downloaded' | 'error'

    this.init();
  }

  init() {
    this.createBadgeInTitlebar();
    this.createModalMarkup();
    this.bindEvents();
    this.listenToElectronUpdater();
  }

  createBadgeInTitlebar() {
    // Check if titlebar exists
    const titlebarRight = document.querySelector('.titlebar-right');
    if (!titlebarRight) return;

    this.badgeEl = document.createElement('button');
    this.badgeEl.id = 'titlebar-update-badge';
    this.badgeEl.className = 'titlebar-update-badge no-drag';
    this.badgeEl.style.display = 'none';
    this.badgeEl.title = 'New APEX Telemetry Update Available';
    this.badgeEl.innerHTML = `
      <span class="update-badge-dot"></span>
      <span id="titlebar-update-version-label">UPDATE AVAILABLE</span>
    `;

    // Insert before the minimize button
    titlebarRight.insertBefore(this.badgeEl, titlebarRight.firstChild);

    this.badgeEl.addEventListener('click', () => {
      this.openModal();
    });
  }

  createModalMarkup() {
    let modalContainer = document.getElementById('modal-updater-container');
    if (!modalContainer) {
      modalContainer = document.createElement('div');
      modalContainer.id = 'modal-updater-container';
      document.body.appendChild(modalContainer);
    }

    modalContainer.innerHTML = `
      <div id="updater-modal-backdrop" class="updater-modal-backdrop">
        <div class="updater-modal-window chamfer-all-corners">
          <!-- Header -->
          <div class="updater-header">
            <div class="updater-title-group">
              <svg width="16" height="16" viewBox="0 0 24 24" fill="none" class="updater-brand-icon">
                <path d="M12 2L2 22h20L12 2z" fill="#E10600"/>
                <path d="M12 6L5 20h14L12 6z" fill="#0B0C10"/>
                <path d="M12 10L8 18h8L12 10z" fill="#E10600"/>
              </svg>
              <div>
                <div class="updater-title">APEX PIT-WALL // SOFTWARE UPGRADE</div>
                <div class="updater-subtitle">PRECISION MOTORSPORT TELEMETRY SYSTEM UPDATE</div>
              </div>
            </div>
            <button id="btn-close-updater-modal" class="updater-close-btn" title="Close / Postpone">&times;</button>
          </div>

          <!-- Body -->
          <div class="updater-body">
            <!-- Version Comparison Card -->
            <div class="updater-version-card">
              <div class="version-step">
                <span class="version-label">INSTALLED VERSION</span>
                <span id="updater-current-ver" class="version-value">v1.0.0</span>
              </div>
              <div class="version-arrow">&rarr;</div>
              <div class="version-step">
                <span class="version-label">AVAILABLE UPGRADE</span>
                <span id="updater-target-ver" class="version-value target">v2.9.1</span>
              </div>
              <div class="version-meta">
                <span id="updater-release-date" class="version-meta-item">RELEASE DATE: --</span>
                <span id="updater-package-size" class="version-meta-item">PACKAGE: --</span>
              </div>
            </div>

            <!-- Changelog Viewer -->
            <div class="updater-changelog-container">
              <div class="updater-section-header">&blacktriangleright; RELEASE NOTES &amp; TELEMETRY ENGINE UPDATES</div>
              <div id="updater-changelog-content" class="updater-changelog-box">Loading release notes...</div>
            </div>

            <!-- Download Progress Zone (Hidden initially) -->
            <div id="updater-progress-card" class="updater-progress-card" style="display: none;">
              <div class="progress-header">
                <span id="updater-progress-status" class="progress-status-text">DOWNLOADING PORTABLE EXECUTABLE...</span>
                <span id="updater-progress-percent" class="progress-percent-text">0%</span>
              </div>
              <div class="progress-track">
                <div id="updater-progress-fill" class="progress-fill"></div>
              </div>
              <div class="progress-details">
                <span id="updater-bytes-text">0 MB / 0 MB</span>
                <span id="updater-speed-text">PORTABLE BINARY STAGING</span>
              </div>
            </div>

            <!-- Notices / Status (Hidden initially) -->
            <div id="updater-notice-box" class="updater-notice" style="display: none;"></div>
          </div>

          <!-- Footer Actions -->
          <div class="updater-footer">
            <div class="updater-footer-left">
              <button id="btn-updater-github" class="btn-updater-secondary" title="View Release on GitHub">
                <span>↗</span> GITHUB RELEASE
              </button>
              <button id="btn-updater-folder" class="btn-updater-secondary" style="display: none;" title="Open Download Staging Directory">
                <span>📂</span> OPEN FOLDER
              </button>
            </div>
            <div class="updater-footer-right">
              <button id="btn-updater-postpone" class="btn-updater-ghost">LATER</button>
              <button id="btn-updater-cancel-dl" class="btn-updater-secondary" style="display: none;">CANCEL DOWNLOAD</button>
              <button id="btn-updater-action" class="btn-updater-primary">
                <span>⚡</span> DOWNLOAD &amp; UPDATE
              </button>
            </div>
          </div>
        </div>
      </div>
    `;

    this.modalEl = document.getElementById('updater-modal-backdrop');
  }

  bindEvents() {
    const btnClose = document.getElementById('btn-close-updater-modal');
    const btnPostpone = document.getElementById('btn-updater-postpone');
    const btnAction = document.getElementById('btn-updater-action');
    const btnCancelDl = document.getElementById('btn-updater-cancel-dl');
    const btnGitHub = document.getElementById('btn-updater-github');
    const btnFolder = document.getElementById('btn-updater-folder');

    if (btnClose) btnClose.addEventListener('click', () => this.closeModal());
    if (btnPostpone) btnPostpone.addEventListener('click', () => this.closeModal());

    if (btnAction) {
      btnAction.addEventListener('click', () => {
        if (this.status === 'downloaded') {
          this.installAndRestart();
        } else if (this.status === 'available' || this.status === 'error' || this.status === 'idle') {
          this.startDownload();
        }
      });
    }

    if (btnCancelDl) {
      btnCancelDl.addEventListener('click', () => this.cancelDownload());
    }

    if (btnGitHub) {
      btnGitHub.addEventListener('click', () => {
        if (this.currentUpdate?.releaseUrl) {
          window.open(this.currentUpdate.releaseUrl, '_blank');
        }
      });
    }

    if (btnFolder) {
      btnFolder.addEventListener('click', () => {
        if (window.apexDesktop?.updater?.openDownloadFolder) {
          window.apexDesktop.updater.openDownloadFolder();
        }
      });
    }

    // Close on backdrop click outside window
    if (this.modalEl) {
      this.modalEl.addEventListener('click', (e) => {
        if (e.target === this.modalEl) {
          this.closeModal();
        }
      });
    }
  }

  listenToElectronUpdater() {
    if (!window.apexDesktop?.updater) return;

    // Listen for background auto-discovered updates
    window.apexDesktop.updater.onUpdateAvailable?.((updateInfo) => {
      this.handleUpdateDiscovered(updateInfo);
    });

    // Listen for download progress
    window.apexDesktop.updater.onProgress?.((progress) => {
      this.handleProgress(progress);
    });

    // Listen for general status changes
    window.apexDesktop.updater.onStatusChange?.((statusObj) => {
      if (statusObj.state === 'downloaded') {
        this.handleDownloadComplete(statusObj);
      } else if (statusObj.state === 'error') {
        this.handleError(statusObj.error);
      }
    });

    // Query current status on startup
    window.apexDesktop.updater.getStatus?.().then((statusObj) => {
      if (statusObj?.updateInfo?.updateAvailable) {
        this.handleUpdateDiscovered(statusObj.updateInfo);
      }
    }).catch(() => {});
  }

  handleUpdateDiscovered(updateInfo) {
    if (!updateInfo || !updateInfo.updateAvailable) return;

    this.currentUpdate = updateInfo;
    this.status = 'available';

    // Show badge in titlebar
    if (this.badgeEl) {
      this.badgeEl.style.display = 'inline-flex';
      const label = document.getElementById('titlebar-update-version-label');
      if (label) {
        label.textContent = `UPDATE ${updateInfo.tagName || 'AVAILABLE'}`;
      }
    }

    this.populateModal(updateInfo);
  }

  populateModal(updateInfo) {
    const currVerEl = document.getElementById('updater-current-ver');
    const targetVerEl = document.getElementById('updater-target-ver');
    const releaseDateEl = document.getElementById('updater-release-date');
    const pkgSizeEl = document.getElementById('updater-package-size');
    const changelogEl = document.getElementById('updater-changelog-content');

    if (currVerEl) currVerEl.textContent = `v${updateInfo.currentVersion || '1.0.0'}`;
    if (targetVerEl) targetVerEl.textContent = updateInfo.tagName || `v${updateInfo.latestVersion || '2.9'}`;

    if (releaseDateEl) {
      const dateStr = updateInfo.publishedAt ? new Date(updateInfo.publishedAt).toLocaleDateString() : 'RECENT';
      releaseDateEl.textContent = `RELEASE DATE: ${dateStr}`;
    }

    if (pkgSizeEl) {
      const sizeMB = updateInfo.assetSize ? (updateInfo.assetSize / (1024 * 1024)).toFixed(1) : '95.0';
      pkgSizeEl.textContent = `PACKAGE: ~${sizeMB} MB (.EXE)`;
    }

    if (changelogEl) {
      changelogEl.innerHTML = this.renderMarkdown(updateInfo.releaseNotes || 'No release notes available.');
    }
  }

  openModal() {
    if (!this.modalEl) return;
    this.modalEl.classList.add('active');
    this.isOpen = true;

    if (this.currentUpdate) {
      this.populateModal(this.currentUpdate);
    }
  }

  closeModal() {
    if (!this.modalEl) return;
    this.modalEl.classList.remove('active');
    this.isOpen = false;
  }

  async startDownload() {
    if (!window.apexDesktop?.updater?.download) {
      // Browser fallback: open release URL
      if (this.currentUpdate?.releaseUrl) {
        window.open(this.currentUpdate.releaseUrl, '_blank');
      }
      return;
    }

    this.status = 'downloading';

    const progressCard = document.getElementById('updater-progress-card');
    const btnAction = document.getElementById('btn-updater-action');
    const btnCancelDl = document.getElementById('btn-updater-cancel-dl');
    const noticeBox = document.getElementById('updater-notice-box');

    if (progressCard) progressCard.style.display = 'flex';
    if (btnCancelDl) btnCancelDl.style.display = 'inline-flex';
    if (noticeBox) noticeBox.style.display = 'none';

    if (btnAction) {
      btnAction.disabled = true;
      btnAction.innerHTML = `<span>⏳</span> DOWNLOADING...`;
    }

    try {
      const res = await window.apexDesktop.updater.download({
        downloadUrl: this.currentUpdate?.downloadUrl
      });

      if (!res.success && !res.aborted) {
        this.handleError(res.error || 'Failed to download update.');
      }
    } catch (err) {
      this.handleError(err.message);
    }
  }

  handleProgress(progress) {
    const fillEl = document.getElementById('updater-progress-fill');
    const percentEl = document.getElementById('updater-progress-percent');
    const bytesEl = document.getElementById('updater-bytes-text');

    const percent = progress.percent ?? 0;
    if (fillEl) fillEl.style.width = `${percent}%`;
    if (percentEl) percentEl.textContent = `${percent}%`;

    if (bytesEl) {
      const dlMB = (progress.bytesDownloaded / (1024 * 1024)).toFixed(1);
      const totalMB = progress.totalBytes > 0 ? (progress.totalBytes / (1024 * 1024)).toFixed(1) : '?';
      bytesEl.textContent = `${dlMB} MB / ${totalMB} MB`;
    }
  }

  handleDownloadComplete(statusObj) {
    this.status = 'downloaded';

    const progressCard = document.getElementById('updater-progress-card');
    const btnAction = document.getElementById('btn-updater-action');
    const btnCancelDl = document.getElementById('btn-updater-cancel-dl');
    const btnFolder = document.getElementById('btn-updater-folder');
    const noticeBox = document.getElementById('updater-notice-box');

    if (progressCard) progressCard.style.display = 'none';
    if (btnCancelDl) btnCancelDl.style.display = 'none';
    if (btnFolder) btnFolder.style.display = 'inline-flex';

    if (noticeBox) {
      noticeBox.className = 'updater-notice success';
      noticeBox.style.display = 'flex';
      noticeBox.innerHTML = `
        <span>✓</span> <strong>UPDATE VERIFIED:</strong> Portable executable ready for in-place replacement.
      `;
    }

    if (btnAction) {
      btnAction.disabled = false;
      btnAction.className = 'btn-updater-restart';
      btnAction.innerHTML = `<span>🚀</span> INSTALL &amp; RESTART APEX`;
    }
  }

  async installAndRestart() {
    if (!window.apexDesktop?.updater?.installAndRestart) return;

    const btnAction = document.getElementById('btn-updater-action');
    if (btnAction) {
      btnAction.disabled = true;
      btnAction.innerHTML = `<span>⏳</span> RESTARTING APEX...`;
    }

    try {
      const res = await window.apexDesktop.updater.installAndRestart();
      if (!res.success) {
        this.handleError(res.error || 'Failed to trigger in-place restart.');
      }
    } catch (err) {
      this.handleError(err.message);
    }
  }

  async cancelDownload() {
    if (window.apexDesktop?.updater?.cancel) {
      await window.apexDesktop.updater.cancel();
    }
    this.status = 'available';

    const progressCard = document.getElementById('updater-progress-card');
    const btnAction = document.getElementById('btn-updater-action');
    const btnCancelDl = document.getElementById('btn-updater-cancel-dl');

    if (progressCard) progressCard.style.display = 'none';
    if (btnCancelDl) btnCancelDl.style.display = 'none';

    if (btnAction) {
      btnAction.disabled = false;
      btnAction.className = 'btn-updater-primary';
      btnAction.innerHTML = `<span>⚡</span> DOWNLOAD &amp; UPDATE`;
    }
  }

  handleError(errorMessage) {
    this.status = 'error';

    const progressCard = document.getElementById('updater-progress-card');
    const btnAction = document.getElementById('btn-updater-action');
    const btnCancelDl = document.getElementById('btn-updater-cancel-dl');
    const noticeBox = document.getElementById('updater-notice-box');

    if (progressCard) progressCard.style.display = 'none';
    if (btnCancelDl) btnCancelDl.style.display = 'none';

    if (noticeBox) {
      noticeBox.className = 'updater-notice error';
      noticeBox.style.display = 'flex';
      noticeBox.innerHTML = `
        <span>⚠</span> <strong>UPDATE ERROR:</strong> ${this.escapeHtml(errorMessage)}
      `;
    }

    if (btnAction) {
      btnAction.disabled = false;
      btnAction.className = 'btn-updater-primary';
      btnAction.innerHTML = `<span>⟲</span> RETRY DOWNLOAD`;
    }
  }

  renderMarkdown(text = '') {
    // Safe lightweight Markdown formatter for changelogs
    const escaped = this.escapeHtml(text);
    return escaped
      .replace(/^### (.*$)/gim, '<h3>$1</h3>')
      .replace(/^## (.*$)/gim, '<h2>$1</h2>')
      .replace(/^# (.*$)/gim, '<h2>$1</h2>')
      .replace(/^\- (.*$)/gim, '<li>$1</li>')
      .replace(/\*\*(.*?)\*\*/gim, '<strong>$1</strong>')
      .replace(/\*(.*?)\*/gim, '<em>$1</em>')
      .replace(/`([^`]+)`/gim, '<code>$1</code>')
      .replace(/(<li>.*<\/li>)/gis, '<ul>$1</ul>')
      .replace(/\n\n/gim, '<br>');
  }

  escapeHtml(str) {
    if (!str) return '';
    return String(str)
      .replace(/&/g, '&amp;')
      .replace(/</g, '&lt;')
      .replace(/>/g, '&gt;')
      .replace(/"/g, '&quot;')
      .replace(/'/g, '&#039;');
  }
}
