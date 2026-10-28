let resetCounterQueue = Promise.resolve();

chrome.runtime.onMessage.addListener((message, sender) => {
  if (
    message?.type !== 'player-reset-succeeded' ||
    sender.id !== chrome.runtime.id ||
    !sender.tab?.url?.startsWith('https://www.twitch.tv/')
  ) {
    return;
  }

  resetCounterQueue = resetCounterQueue.then(() => new Promise((resolve, reject) => {
    chrome.storage.local.get({ playerResetCount: 0 }, (settings) => {
      if (chrome.runtime.lastError) {
        reject(chrome.runtime.lastError);
        return;
      }

      const currentCount = Number.isSafeInteger(settings.playerResetCount) && settings.playerResetCount >= 0
        ? settings.playerResetCount
        : 0;
      chrome.storage.local.set({ playerResetCount: currentCount + 1 }, () => {
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
});
