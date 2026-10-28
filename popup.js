const DEFAULT_TIMEOUT_MS = 1000;
const MIN_TIMEOUT_MS = 100;
const MAX_TIMEOUT_MS = 120000;

const timeoutInput = document.querySelector('#timeout');
const saveButton = document.querySelector('#save');
const status = document.querySelector('#status');
const resetCount = document.querySelector('#reset-count');
const channelName = document.querySelector('#channel-name');

function showChannelName(name) {
  const text = typeof name === 'string' ? name.trim() : '';
  channelName.textContent = text;
  if (text) {
    channelName.title = text;
  } else {
    channelName.removeAttribute('title');
  }
}

chrome.storage.local.get({ playerResetCount: 0, playerResetChannelName: '' }, (settings) => {
  if (chrome.runtime.lastError) {
    resetCount.textContent = '—';
    showChannelName('');
    console.error('Twitch Spinner Reset could not load its reset counter.', chrome.runtime.lastError);
    return;
  }

  resetCount.textContent = settings.playerResetCount.toLocaleString();
  showChannelName(settings.playerResetChannelName);
});

chrome.storage.onChanged.addListener((changes, areaName) => {
  if (areaName !== 'local') {
    return;
  }

  if (changes.playerResetCount) {
    resetCount.textContent = changes.playerResetCount.newValue.toLocaleString();
  }

  if (changes.playerResetChannelName) {
    showChannelName(changes.playerResetChannelName.newValue);
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
