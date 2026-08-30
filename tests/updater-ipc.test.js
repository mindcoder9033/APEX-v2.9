import { test, describe } from 'node:test';
import assert from 'node:assert/strict';
import { registerUpdaterIpc, scheduleStartupUpdateCheck } from '../src/electron/updater/index.js';

describe('Electron Updater: IPC Bridge & Lifecycle Orchestrator', () => {

  test('registerUpdaterIpc: registers all updater channels with ipcMain', async () => {
    const registeredHandlers = new Map();

    const mockIpc = {
      handle: (channel, handler) => {
        registeredHandlers.set(channel, handler);
      }
    };

    const mockWindow = {
      isDestroyed: () => false,
      webContents: {
        send: () => {}
      }
    };

    registerUpdaterIpc({ mainWindow: mockWindow, ipc: mockIpc, options: { currentVersion: '1.0.0' } });

    // Verify all 6 expected channels are registered
    const expectedChannels = [
      'updater:check',
      'updater:download',
      'updater:cancel',
      'updater:install-restart',
      'updater:open-download-folder',
      'updater:get-status'
    ];

    for (const ch of expectedChannels) {
      assert.ok(registeredHandlers.has(ch), `Channel ${ch} must be registered`);
      assert.strictEqual(typeof registeredHandlers.get(ch), 'function');
    }

    // Test get-status handler invocation
    const getStatusHandler = registeredHandlers.get('updater:get-status');
    const status = getStatusHandler();
    assert.ok(status);
    assert.strictEqual(typeof status.state, 'string');
    assert.strictEqual(typeof status.currentVersion, 'string');
  });

  test('scheduleStartupUpdateCheck: handles missing or destroyed window gracefully', () => {
    assert.doesNotThrow(() => {
      scheduleStartupUpdateCheck(null, 10);
    });

    const destroyedWindow = {
      isDestroyed: () => true,
      webContents: { send: () => {} }
    };

    assert.doesNotThrow(() => {
      scheduleStartupUpdateCheck(destroyedWindow, 10);
    });
  });

});
