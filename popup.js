const DEFAULT_TIMEOUT_MS = 1000;
const MIN_TIMEOUT_MS = 100;
const MAX_TIMEOUT_MS = 120000;

const timeoutInput = document.querySelector('#timeout');
const saveButton = document.querySelector('#save');
const status = document.querySelector('#status');
const resetCount = document.querySelector('#reset-count');

chrome.storage.local.get({ playerResetCount: 0 }, (settings) => {
  if (chrome.runtime.lastError) {
    resetCount.textContent = '—';
    console.error('Twitch Spinner Reset could not load its reset counter.', chrome.runtime.lastError);
    return;
  }

  resetCount.textContent = settings.playerResetCount.toLocaleString();
});

chrome.storage.onChanged.addListener((changes, areaName) => {
  if (areaName === 'local' && changes.playerResetCount) {
    resetCount.textContent = changes.playerResetCount.newValue.toLocaleString();
  }
});

chrome.storage.sync.get({ spinnerTimeoutMs: DEFAULT_TIMEOUT_MS }, (settings) => {
  if (chrome.runtime.lastError) {
    status.textContent = 'Could not load settings.';
    console.error('Twitch Spinner Reset could not load its settings.', chrome.runtime.lastError);
    return;
  }

  timeoutInput.value = (settings.spinnerTimeoutMs / 1000).toString();
});

saveButton.addEventListener('click', () => {
  const seconds = Number(timeoutInput.value);
  const timeoutMs = Math.round(seconds * 1000);

  if (
    !Number.isFinite(seconds) ||
    timeoutMs < MIN_TIMEOUT_MS ||
    timeoutMs > MAX_TIMEOUT_MS
  ) {
    status.textContent = 'Enter a value from 0.1 to 120 seconds.';
    return;
  }

  chrome.storage.sync.set({ spinnerTimeoutMs: timeoutMs }, () => {
    if (chrome.runtime.lastError) {
      status.textContent = 'Could not save settings.';
      console.error('Twitch Spinner Reset could not save its settings.', chrome.runtime.lastError);
      return;
    }

    status.textContent = 'Saved.';
  });
});
