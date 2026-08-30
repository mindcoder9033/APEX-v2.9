import { test, describe, before } from 'node:test';
import assert from 'node:assert/strict';

// Mock minimal DOM environment for UI tests in Node.js
class MockClassList {
  constructor() {
    this.classes = new Set();
  }
  add(cls) { this.classes.add(cls); }
  remove(cls) { this.classes.delete(cls); }
  contains(cls) { return this.classes.has(cls); }
}

class MockElement {
  constructor(tag = 'div') {
    this.tagName = tag.toUpperCase();
    this.id = '';
    this.className = '';
    this.style = {};
    this.innerHTML = '';
    this.textContent = '';
    this.title = '';
    this.disabled = false;
    this.children = [];
    this.classList = new MockClassList();
    this.eventListeners = new Map();
  }

  addEventListener(event, callback) {
    if (!this.eventListeners.has(event)) {
      this.eventListeners.set(event, []);
    }
    this.eventListeners.get(event).push(callback);
  }

  dispatchEvent(event) {
    const list = this.eventListeners.get(event.type) || [];
    for (const fn of list) fn(event);
  }

  appendChild(child) {
    this.children.push(child);
    return child;
  }

  insertBefore(newChild, refChild) {
    this.children.unshift(newChild);
    return newChild;
  }
}

describe('Frontend UI: Telemetry Update Modal & Badge Controller', () => {

  let UiUpdater;

  before(async () => {
    // Setup minimal global document/window mocks
    const elementMap = new Map();

    global.document = {
      createElement: (tag) => {
        const el = new MockElement(tag);
        return el;
      },
      querySelector: (selector) => {
        if (selector === '.titlebar-right') {
          let el = elementMap.get('.titlebar-right');
          if (!el) {
            el = new MockElement('div');
            elementMap.set('.titlebar-right', el);
          }
          return el;
        }
        return null;
      },
      getElementById: (id) => {
        if (!elementMap.has(id)) {
          const el = new MockElement('div');
          el.id = id;
          elementMap.set(id, el);
        }
        return elementMap.get(id);
      },
      body: new MockElement('body')
    };

    global.window = {
      apexDesktop: {
        updater: {
          onUpdateAvailable: () => () => {},
          onProgress: () => () => {},
          onStatusChange: () => () => {},
          getStatus: async () => ({})
        }
      },
      open: () => {}
    };

    const mod = await import('../public/js/components/ui-updater.js');
    UiUpdater = mod.UiUpdater;
  });

  test('UiUpdater: initializes badge, modal markup, and markdown parser', () => {
    const updater = new UiUpdater();
    assert.ok(updater);

    // Test Markdown Rendering
    const md = `## Features\n- New Skip Barber telemetry\n- **In-Place** updates with \`powershell\``;
    const html = updater.renderMarkdown(md);
    assert.ok(html.includes('<h2>Features</h2>'));
    assert.ok(html.includes('<li>New Skip Barber telemetry</li>'));
    assert.ok(html.includes('<strong>In-Place</strong>'));
    assert.ok(html.includes('<code>powershell</code>'));
  });

  test('UiUpdater: handles update discovery and modal state transitions', () => {
    const updater = new UiUpdater();

    const mockUpdate = {
      updateAvailable: true,
      currentVersion: '1.0.0',
      latestVersion: '2.9.1',
      tagName: 'v2.9.1',
      name: 'APEX v2.9.1',
      releaseNotes: '### Telemetry Upgrade\n- Faster loopback',
      publishedAt: '2026-08-30T12:00:00Z',
      assetSize: 99887766,
      downloadUrl: 'https://github.com/test.exe'
    };

    updater.handleUpdateDiscovered(mockUpdate);
    assert.strictEqual(updater.status, 'available');
    assert.strictEqual(updater.badgeEl.style.display, 'inline-flex');

    // Test Open / Close Modal
    updater.openModal();
    assert.strictEqual(updater.isOpen, true);
    assert.strictEqual(updater.modalEl.classList.contains('active'), true);

    updater.closeModal();
    assert.strictEqual(updater.isOpen, false);
    assert.strictEqual(updater.modalEl.classList.contains('active'), false);
  });

  test('UiUpdater: handles download progress and completion states', () => {
    const updater = new UiUpdater();

    updater.handleProgress({
      bytesDownloaded: 52428800,
      totalBytes: 104857600,
      percent: 50
    });

    const percentEl = global.document.getElementById('updater-progress-percent');
    assert.strictEqual(percentEl.textContent, '50%');

    // Completion
    updater.handleDownloadComplete({ state: 'downloaded' });
    assert.strictEqual(updater.status, 'downloaded');

    const btnAction = global.document.getElementById('btn-updater-action');
    assert.strictEqual(btnAction.className, 'btn-updater-restart');
    assert.ok(btnAction.innerHTML.includes('INSTALL &amp; RESTART APEX'));
  });

});
