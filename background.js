let resetCounterQueue = Promise.resolve();
const CHANNEL_PATTERN = /^[a-z0-9][a-z0-9_]{2,24}$/;

function currentCountFrom(settings) {
  return Number.isSafeInteger(settings.playerResetCount) && settings.playerResetCount >= 0
    ? settings.playerResetCount
    : 0;
}

function storedChannel(settings) {
  return typeof settings.playerResetChannel === 'string' && CHANNEL_PATTERN.test(settings.playerResetChannel)
    ? settings.playerResetChannel
    : '';
}

function enqueue(update) {
  resetCounterQueue = resetCounterQueue.then(() => new Promise((resolve, reject) => {
    chrome.storage.local.get({ playerResetCount: 0, playerResetChannel: '' }, (settings) => {
      if (chrome.runtime.lastError) {
        reject(chrome.runtime.lastError);
        return;
      }

      const values = update(settings);
      if (!values) {
        resolve();
        return;
      }

      chrome.storage.local.set(values, () => {
        if (chrome.runtime.lastError) {
          reject(chrome.runtime.lastError);
          return;
        }

        resolve();
      });
    });
  })).catch((error) => {
    console.error('Twitch Spinner Reset could not update its reset counter.', error);
  });
}

chrome.runtime.onMessage.addListener((message, sender) => {
  if (
    sender.id !== chrome.runtime.id ||
    !sender.tab?.url?.startsWith('https://www.twitch.tv/')
  ) {
    return;
  }

  if (message?.type === 'player-reset-succeeded') {
    enqueue((settings) => {
      const currentCount = currentCountFrom(settings);
      return { playerResetCount: currentCount + 1 };
    });
    return;
  }

  if (message?.type === 'channel-loaded' && CHANNEL_PATTERN.test(message.channel)) {
    enqueue((settings) => {
      const previous = storedChannel(settings);
      if (previous === message.channel) {
        return null;
      }

      if (!previous) {
        return { playerResetChannel: message.channel };
      }

      return { playerResetCount: 0, playerResetChannel: message.channel };
    });
  }
});
