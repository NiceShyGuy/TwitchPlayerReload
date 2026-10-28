const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const test = require('node:test');
const vm = require('node:vm');

const root = path.resolve(__dirname, '..');
const readSource = (filename) => fs.readFileSync(path.join(root, filename), 'utf8');

function createScheduler() {
  let now = 0;
  let nextId = 0;
  const timers = new Map();

  return {
    now: () => now,
    setTimeout(callback, delay) {
      const id = ++nextId;
      timers.set(id, { callback, due: now + delay });
      return id;
    },
    clearTimeout(id) {
      timers.delete(id);
    },
    advance(milliseconds) {
      const end = now + milliseconds;
      while (true) {
        const next = [...timers.entries()].sort((a, b) => a[1].due - b[1].due)[0];
        if (!next || next[1].due > end) {
          break;
        }

        now = next[1].due;
        timers.delete(next[0]);
        next[1].callback();
      }

      now = end;
    }
  };
}

function createWindow(scheduler, origin = 'https://www.twitch.tv') {
  const listeners = new Map();
  const windowObject = {
    addEventListener(type, callback) {
      if (!listeners.has(type)) {
        listeners.set(type, []);
      }
      listeners.get(type).push(callback);
    },
    postMessage(data, targetOrigin) {
      if (targetOrigin !== origin) {
        return;
      }
      for (const callback of listeners.get('message') || []) {
        callback({ source: windowObject, origin, data });
      }
    },
    setTimeout: scheduler.setTimeout,
    clearTimeout: scheduler.clearTimeout
  };
  return windowObject;
}

function loadPageAgent({ document, location, window }) {
  vm.runInNewContext(readSource('page-agent.js'), { document, location, window });
}

test('manifest is production-ready and release files exist', () => {
  const manifest = JSON.parse(readSource('manifest.json'));

  assert.equal(manifest.manifest_version, 3);
  assert.equal(manifest.minimum_chrome_version, '111');
  assert.deepEqual(manifest.permissions, ['storage']);
  assert.equal(manifest.host_permissions, undefined);

  const runtimeFiles = [
    'background.js',
    'content.js',
    'page-agent.js',
    'popup.html',
    'popup.css',
    'popup.js',
    'icons/icon16.png',
    'icons/icon32.png',
    'icons/icon48.png',
    'icons/icon128.png'
  ];
  for (const filename of runtimeFiles) {
    assert.ok(fs.existsSync(path.join(root, filename)), `Missing ${filename}`);
  }
});

test('spinner timeout invokes a player-only reset and counts its success', async () => {
  const scheduler = createScheduler();
  const window = createWindow(scheduler);
  let pageReloads = 0;
  window.location = { reload: () => { pageReloads++; } };
  const location = { origin: 'https://www.twitch.tv' };
  const player = {
    getDuration: () => 600,
    getPosition: () => 90,
    seekTo(position) {
      assert.equal(position, 90);
      seeks++;
    }
  };
  let resets = 0;
  let seeks = 0;
  const playerSource = {
    props: { mediaPlayerInstance: player },
    setInitialPlaybackSettings() {},
    async setSrc(options) {
      assert.deepEqual(JSON.parse(JSON.stringify(options)), { isNewMediaPlayerInstance: false });
      resets++;
    }
  };
  const sourceFiber = { stateNode: playerSource, return: null, child: null, sibling: null };
  const spinnerFiber = { stateNode: null, return: sourceFiber, child: null, sibling: null };
  sourceFiber.child = spinnerFiber;
  const wrapper = { parentElement: null, '__reactFiber$test': sourceFiber };
  const spinner = { parentElement: wrapper, '__reactFiber$spinner': spinnerFiber };
  const document = {
    documentElement: {},
    querySelector: (selector) => selector === '.tw-loading-spinner' ? spinner : null
  };
  const sentMessages = [];
  const chrome = {
    runtime: {
      sendMessage(message, callback) {
        sentMessages.push(message);
        callback();
      }
    },
    storage: {
      sync: { get: (defaults, callback) => callback(defaults) },
      onChanged: { addListener() {} }
    }
  };
  let mutationCallback;
  class FakeDate extends Date {
    static now() {
      return scheduler.now();
    }
  }

  loadPageAgent({ document, location, window });
  vm.runInNewContext(readSource('content.js'), {
    chrome,
    Date: FakeDate,
    document,
    location,
    MutationObserver: class {
      constructor(callback) {
        mutationCallback = callback;
      }
      observe() {}
    },
    window
  });

  scheduler.advance(999);
  assert.equal(resets, 0);
  scheduler.advance(1);
  await new Promise(setImmediate);
  assert.equal(resets, 1);
  assert.deepEqual(
    JSON.parse(JSON.stringify(sentMessages)),
    [{ type: 'player-reset-succeeded' }]
  );
  assert.equal(pageReloads, 0);

  scheduler.advance(250);
  assert.equal(seeks, 1);
  assert.equal(typeof mutationCallback, 'function');
});

test('failed player reset is not reported as successful', async () => {
  const scheduler = createScheduler();
  const window = createWindow(scheduler);
  const location = { origin: 'https://www.twitch.tv' };
  const document = {
    documentElement: {},
    querySelector: () => ({ parentElement: null })
  };
  const sentMessages = [];
  const chrome = {
    runtime: {
      sendMessage(message, callback) {
        sentMessages.push(message);
        callback();
      }
    },
    storage: {
      sync: { get: (defaults, callback) => callback(defaults) },
      onChanged: { addListener() {} }
    }
  };
  let mutationCallback;
  class FakeDate extends Date {
    static now() {
      return scheduler.now();
    }
  }

  loadPageAgent({ document, location, window });
  vm.runInNewContext(readSource('content.js'), {
    chrome,
    Date: FakeDate,
    document,
    location,
    MutationObserver: class {
      constructor(callback) {
        mutationCallback = callback;
      }
      observe() {}
    },
    window,
    console: { error() {} }
  });

  scheduler.advance(1000);
  await new Promise(setImmediate);
  assert.deepEqual(sentMessages, []);
  assert.equal(typeof mutationCallback, 'function');
});

test('background counter accepts only extension messages from Twitch tabs', async () => {
  let count = 0;
  let onMessage;
  const chrome = {
    runtime: {
      id: 'extension-id',
      onMessage: {
        addListener(callback) {
          onMessage = callback;
        }
      }
    },
    storage: {
      local: {
        get(defaults, callback) {
          callback({ playerResetCount: count });
        },
        set(values, callback) {
          count = values.playerResetCount;
          callback();
        }
      }
    }
  };

  vm.runInNewContext(readSource('background.js'), {
    chrome,
    console: { error: (error) => { throw error; } }
  });

  const twitchSender = {
    id: 'extension-id',
    tab: { url: 'https://www.twitch.tv/example' }
  };
  onMessage({ type: 'player-reset-succeeded' }, twitchSender);
  onMessage({ type: 'player-reset-succeeded' }, twitchSender);
  onMessage({ type: 'player-reset-succeeded' }, {
    id: 'other-extension',
    tab: { url: 'https://www.twitch.tv/example' }
  });
  onMessage({ type: 'player-reset-succeeded' }, {
    id: 'extension-id',
    tab: { url: 'https://example.com/' }
  });
  await new Promise(setImmediate);

  assert.equal(count, 2);
});
