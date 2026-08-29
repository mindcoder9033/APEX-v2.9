/**
 * APEX Loopback & Network Diagnostics Modal Controller
 * Provides interactive UI for checking local LAN IP, configuring Forza Data Out,
 * testing UWP loopback restrictions, and applying 1-click exemptions.
 */

export class LoopbackModal {
  constructor() {
    this.modalEl = document.getElementById('modal-loopback-tool');
    this.primaryIpEl = document.getElementById('primary-lan-ip');
    this.packagesListEl = document.getElementById('uwp-packages-list');
    this.overallStatusEl = document.getElementById('uwp-overall-status');
    this.btnOpen = document.getElementById('btn-open-loopback-tool');
    this.btnClose = document.getElementById('btn-close-loopback-modal');
    this.btnCloseFooter = document.getElementById('btn-close-loopback-footer');
    this.btnCopyIp = document.getElementById('btn-copy-lan-ip');
    this.btnEnableLoopback = document.getElementById('btn-enable-loopback');
    this.btnRefreshLoopback = document.getElementById('btn-refresh-loopback');
    this.btnOpenArchive = document.getElementById('btn-open-archive-folder');
    this.desktopReportsCard = document.getElementById('desktop-reports-card');

    this.currentIps = [];
    this.bindEvents();
  }

  bindEvents() {
    if (this.btnOpen) {
      this.btnOpen.addEventListener('click', () => this.open());
    }

    if (this.btnClose) {
      this.btnClose.addEventListener('click', () => this.close());
    }

    if (this.btnCloseFooter) {
      this.btnCloseFooter.addEventListener('click', () => this.close());
    }

    if (this.btnCopyIp) {
      this.btnCopyIp.addEventListener('click', () => this.copyIp());
    }

    if (this.btnEnableLoopback) {
      this.btnEnableLoopback.addEventListener('click', () => this.applyExemption());
    }

    if (this.btnRefreshLoopback) {
      this.btnRefreshLoopback.addEventListener('click', () => this.checkStatus());
    }

    if (this.btnOpenArchive) {
      this.btnOpenArchive.addEventListener('click', () => {
        if (window.apexDesktop?.openReportsFolder) {
          window.apexDesktop.openReportsFolder();
        }
      });
    }

    // Close on backdrop click
    if (this.modalEl) {
      this.modalEl.addEventListener('click', (e) => {
        if (e.target === this.modalEl) this.close();
      });
    }
  }

  async open() {
    if (!this.modalEl) return;
    this.modalEl.classList.add('active');
    await this.refreshNetworkInfo();
    await this.checkStatus();

    // Show desktop reports card only in electron
    if (this.desktopReportsCard) {
      this.desktopReportsCard.style.display = window.apexDesktop?.isDesktop ? 'block' : 'none';
    }
  }

  close() {
    if (this.modalEl) {
      this.modalEl.classList.remove('active');
    }
  }

  async refreshNetworkInfo() {
    if (!this.primaryIpEl) return;

    if (window.apexDesktop?.getLanIp) {
      try {
        const ips = await window.apexDesktop.getLanIp();
        this.currentIps = ips;
        const primary = ips.find(i => !i.isWifi) || ips[0] || { ip: '127.0.0.1' };
        this.primaryIpEl.textContent = primary.ip;
      } catch {
        this.primaryIpEl.textContent = '127.0.0.1';
      }
    } else {
      // Browser fallback
      const host = window.location.hostname || '127.0.0.1';
      this.primaryIpEl.textContent = host === 'localhost' ? '127.0.0.1' : host;
    }
  }

  async copyIp() {
    const ip = this.primaryIpEl?.textContent || '127.0.0.1';
    try {
      await navigator.clipboard.writeText(ip);
      if (this.btnCopyIp) {
        const orig = this.btnCopyIp.innerHTML;
        this.btnCopyIp.innerHTML = '<span>✓</span> COPIED!';
        this.btnCopyIp.style.borderColor = 'var(--color-success)';
        setTimeout(() => {
          this.btnCopyIp.innerHTML = orig;
          this.btnCopyIp.style.borderColor = '';
        }, 1800);
      }
    } catch (err) {
      console.warn('Clipboard copy failed:', err);
    }
  }

  async checkStatus() {
    if (!this.packagesListEl || !this.overallStatusEl) return;

    if (!window.apexDesktop?.checkLoopback) {
      this.overallStatusEl.textContent = 'BROWSER MODE';
      this.overallStatusEl.style.background = 'rgba(0, 153, 255, 0.15)';
      this.overallStatusEl.style.color = 'var(--color-accent, #0099FF)';
      this.packagesListEl.innerHTML = `
        <div style="font-size: 11px; color: var(--color-text-secondary); padding: 6px 0;">
          Running in Web Browser. For PC loopback exemption, run APEX in Desktop mode or run CheckNetIsolation in PowerShell:
          <code style="display: block; margin-top: 4px; padding: 4px 8px; background: #000; color: #FFD700; border-radius: 2px;">
            CheckNetIsolation.exe LoopbackExempt -a -n="Microsoft.ForzaMotorsport_8wekyb3d8bbwe"
          </code>
        </div>
      `;
      return;
    }

    this.overallStatusEl.textContent = 'SCANNING...';
    this.overallStatusEl.style.background = 'rgba(255, 255, 255, 0.1)';
    this.overallStatusEl.style.color = '#AAA';

    try {
      const results = await window.apexDesktop.checkLoopback();
      const allExempt = results.every(r => r.isExempt);

      if (allExempt) {
        this.overallStatusEl.textContent = '✓ ALL EXEMPT';
        this.overallStatusEl.style.background = 'rgba(0, 204, 102, 0.15)';
        this.overallStatusEl.style.color = 'var(--color-success, #00CC66)';
      } else {
        this.overallStatusEl.textContent = '⚠️ EXEMPTION NEEDED';
        this.overallStatusEl.style.background = 'rgba(225, 6, 0, 0.2)';
        this.overallStatusEl.style.color = 'var(--color-f1-red, #E10600)';
      }

      this.packagesListEl.innerHTML = results.map(pkg => `
        <div class="uwp-pkg-row">
          <div>
            <div class="uwp-pkg-name">${pkg.name}</div>
            <div class="uwp-pkg-id">${pkg.id}</div>
          </div>
          <div class="${pkg.isExempt ? 'uwp-status-exempt' : 'uwp-status-restricted'}">
            <span>${pkg.isExempt ? '✓ EXEMPT' : '⚠️ RESTRICTED'}</span>
          </div>
        </div>
      `).join('');
    } catch (err) {
      this.overallStatusEl.textContent = 'ERROR';
      this.packagesListEl.innerHTML = `<div style="color: var(--color-error); font-size: 11px;">Failed to inspect loopback: ${err.message}</div>`;
    }
  }

  async applyExemption() {
    if (!window.apexDesktop?.enableLoopback) {
      alert('One-click loopback is available in the APEX Desktop App.');
      return;
    }

    if (this.btnEnableLoopback) {
      this.btnEnableLoopback.disabled = true;
      this.btnEnableLoopback.innerHTML = '<span>⏳</span> APPLYING...';
    }

    try {
      const res = await window.apexDesktop.enableLoopback();
      await this.checkStatus();
      if (res.success) {
        if (this.btnEnableLoopback) {
          this.btnEnableLoopback.innerHTML = '<span>✓</span> EXEMPTION APPLIED!';
          this.btnEnableLoopback.style.background = 'var(--color-success)';
          setTimeout(() => {
            this.btnEnableLoopback.disabled = false;
            this.btnEnableLoopback.innerHTML = '<span>⚡</span> ONE-CLICK ENABLE EXEMPTION';
            this.btnEnableLoopback.style.background = '';
          }, 2500);
        }
      } else {
        alert(res.message || 'Exemption could not be automatically applied. Try running APEX as Administrator.');
        if (this.btnEnableLoopback) {
          this.btnEnableLoopback.disabled = false;
          this.btnEnableLoopback.innerHTML = '<span>⚡</span> ONE-CLICK ENABLE EXEMPTION';
        }
      }
    } catch (err) {
      alert('Error applying exemption: ' + err.message);
      if (this.btnEnableLoopback) {
        this.btnEnableLoopback.disabled = false;
        this.btnEnableLoopback.innerHTML = '<span>⚡</span> ONE-CLICK ENABLE EXEMPTION';
      }
    }
  }
}
