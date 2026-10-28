(() => {
  const SPINNER_SELECTOR = '.tw-loading-spinner';
  const DEFAULT_TIMEOUT_MS = 1000;
  const MIN_TIMEOUT_MS = 100;
  const MAX_TIMEOUT_MS = 120000;
  const MESSAGE_SOURCE = 'twitch-spinner-reset-extension';
  const REQUEST_TIMEOUT_MS = 5000;

  let timeoutMs = DEFAULT_TIMEOUT_MS;
  let spinnerSince = null;
  let timerId = null;
  let resetAttempted = false;
  let nextRequestId = 0;
  const pendingRequests = new Map();

  function normalizedTimeout(value) {
    const parsed = Number(value);
    if (!Number.isFinite(parsed)) {
      return DEFAULT_TIMEOUT_MS;
    }

    return Math.min(MAX_TIMEOUT_MS, Math.max(MIN_TIMEOUT_MS, Math.round(parsed)));
  }

  function getSpinner() {
    return document.querySelector(SPINNER_SELECTOR);
  }

  function stopTimer() {
    if (timerId !== null) {
      window.clearTimeout(timerId);
      timerId = null;
    }
  }

  function requestPlayerReset() {
    if (resetAttempted) {
      return;
    }

    resetAttempted = true;
    const requestId = `${Date.now()}-${++nextRequestId}`;
    const requestTimer = window.setTimeout(() => {
      pendingRequests.delete(requestId);
      console.error('Twitch Spinner Reset did not receive a response from its Twitch player agent.');
    }, REQUEST_TIMEOUT_MS);
    pendingRequests.set(requestId, requestTimer);
    window.postMessage({
      source: MESSAGE_SOURCE,
      type: 'reset-player',
      requestId
    }, location.origin);
  }

  function checkSpinner() {
    timerId = null;
    if (!getSpinner()) {
      spinnerSince = null;
      resetAttempted = false;
      return;
    }

    const elapsed = Date.now() - spinnerSince;
    if (elapsed >= timeoutMs) {
      requestPlayerReset();
      return;
    }

    timerId = window.setTimeout(checkSpinner, timeoutMs - elapsed);
  }

  function update() {
    if (!getSpinner()) {
      stopTimer();
      spinnerSince = null;
      resetAttempted = false;
      return;
    }

    if (spinnerSince === null) {
      spinnerSince = Date.now();
    }

    stopTimer();
    const remaining = timeoutMs - (Date.now() - spinnerSince);
    if (remaining <= 0) {
      requestPlayerReset();
    } else {
      timerId = window.setTimeout(checkSpinner, remaining);
    }
  }

  window.addEventListener('message', (event) => {
    const message = event.data;
    if (
      event.source !== window ||
      message?.source !== MESSAGE_SOURCE ||
      message.type !== 'reset-result' ||
      !pendingRequests.has(message.requestId)
    ) {
      return;
    }

    window.clearTimeout(pendingRequests.get(message.requestId));
    pendingRequests.delete(message.requestId);
    if (message.success) {
      chrome.runtime.sendMessage({ type: 'player-reset-succeeded' }, () => {
        if (chrome.runtime.lastError) {
          console.error('Twitch Spinner Reset could not update its reset counter.', chrome.runtime.lastError);
        }
      });
    } else {
      console.error(`Twitch Spinner Reset could not reset the player: ${message.error}`);
    }
  });

  const observer = new MutationObserver(update);
  observer.observe(document.documentElement, {
    attributes: true,
    attributeFilter: ['class'],
    childList: true,
    subtree: true
  });

  chrome.storage.sync.get({ spinnerTimeoutMs: DEFAULT_TIMEOUT_MS }, (settings) => {
    if (chrome.runtime.lastError) {
      console.error('Twitch Spinner Reset could not load its settings.', chrome.runtime.lastError);
      update();
      return;
    }

    timeoutMs = normalizedTimeout(settings.spinnerTimeoutMs);
    update();
  });

  chrome.storage.onChanged.addListener((changes, areaName) => {
    if (areaName !== 'sync' || !changes.spinnerTimeoutMs) {
      return;
    }

    timeoutMs = normalizedTimeout(changes.spinnerTimeoutMs.newValue);
    update();
  });

  update();
})();
