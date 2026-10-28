(() => {
  const SPINNER_SELECTOR = '.tw-loading-spinner';
  const DEFAULT_TIMEOUT_MS = 1000;
  const MIN_TIMEOUT_MS = 100;
  const MAX_TIMEOUT_MS = 120000;
  const MESSAGE_SOURCE = 'twitch-spinner-reset-extension';
  const REQUEST_TIMEOUT_MS = 5000;
  const RESERVED_ROUTES = new Set([
    'activate',
    'annual-recap',
    'bits',
    'broadcast',
    'browse',
    'categories',
    'checkout',
    'clips',
    'collection',
    'community',
    'content',
    'creatorcamp',
    'dashboard',
    'directory',
    'downloads',
    'drops',
    'embed',
    'event',
    'friends',
    'gift',
    'home',
    'inventory',
    'jobs',
    'live',
    'login',
    'messages',
    'moderation',
    'moderator',
    'p',
    'payments',
    'popout',
    'prime',
    'privacy',
    'products',
    'recap',
    'safety',
    'search',
    'security',
    'settings',
    'signup',
    'squad',
    'store',
    'subs',
    'subscriptions',
    'team',
    'turbo',
    'user',
    'videos',
    'wallet'
  ]);

  let timeoutMs = DEFAULT_TIMEOUT_MS;
  let spinnerSince = null;
  let timerId = null;
  let resetAttempted = false;
  let nextRequestId = 0;
  let activeChannel;
  let activeChannelName = '';
  let seenPlayback = false;
  let waitForLoadBreak = false;
  let countThisSpinner = false;
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

  function getVideo() {
    return document.querySelector('[data-a-target="video-player"] video')
      || document.querySelector('video');
  }

  function channelFromHref(href) {
    let url;
    try {
      url = new URL(href);
    } catch {
      return null;
    }

    const parts = url.pathname.split('/').filter(Boolean);
    if (!parts.length) {
      return null;
    }

    let slug = parts[0].toLowerCase();
    if (slug === 'popout' || slug === 'moderator') {
      slug = (parts[1] || '').toLowerCase();
    }

    if (!/^[a-z0-9][a-z0-9_]{2,24}$/.test(slug) || RESERVED_ROUTES.has(slug)) {
      return null;
    }

    return slug;
  }

  function slugFromHref(href) {
    if (!href) {
      return '';
    }

    try {
      const url = new URL(href, location.origin);
      return (url.pathname.split('/').filter(Boolean)[0] || '').toLowerCase();
    } catch {
      return '';
    }
  }

  function channelDisplayName(login) {
    if (!login || typeof document.querySelectorAll !== 'function') {
      return '';
    }

    const headings = document.querySelectorAll('h1.tw-title');
    for (const heading of headings) {
      const link = typeof heading.closest === 'function'
        ? heading.closest('a[href]')
        : heading.parentElement;
      const slug = slugFromHref(link?.getAttribute?.('href'));
      if (slug !== login) {
        continue;
      }

      const name = (heading.textContent || '').trim();
      if (name) {
        return name;
      }
    }

    return '';
  }

  function videoLooksLive() {
    const video = getVideo();
    return Boolean(
      video &&
      !getSpinner() &&
      video.readyState >= 2 &&
      !video.paused &&
      !video.seeking
    );
  }

  function notePlayback() {
    if (!videoLooksLive()) {
      // The player that was already going belongs to the previous page.
      // Wait until it stops before arming the counter for this channel.
      waitForLoadBreak = false;
      return;
    }

    if (waitForLoadBreak) {
      return;
    }

    seenPlayback = true;
  }

  function isVideoEvent(event) {
    const target = event.target;
    return Boolean(target && (target.nodeName === 'VIDEO' || target.tagName === 'VIDEO'));
  }

  function stopTimer() {
    if (timerId !== null) {
      window.clearTimeout(timerId);
      timerId = null;
    }
  }

  function clearPendingRequests() {
    for (const pending of pendingRequests.values()) {
      window.clearTimeout(pending.timer);
    }
    pendingRequests.clear();
  }

  function resetSpinnerEpisode() {
    stopTimer();
    clearPendingRequests();
    spinnerSince = null;
    resetAttempted = false;
    countThisSpinner = false;
  }

  function notifyChannel(channel, channelName) {
    const message = { type: 'channel-loaded', channel };
    if (channelName) {
      message.channelName = channelName;
    }

    chrome.runtime.sendMessage(message, () => {
      if (chrome.runtime.lastError) {
        console.error('Twitch Spinner Reset could not update its reset counter.', chrome.runtime.lastError);
      }
    });
  }

  function syncChannel() {
    const channel = channelFromHref(location.href);
    const channelName = channelDisplayName(channel);
    if (channel === activeChannel) {
      if (channel && channelName && channelName !== activeChannelName) {
        activeChannelName = channelName;
        notifyChannel(channel, channelName);
      }
      return;
    }

    const previous = activeChannel;
    activeChannel = channel;
    activeChannelName = channelName;
    seenPlayback = false;
    waitForLoadBreak = previous !== undefined && videoLooksLive();
    resetSpinnerEpisode();

    if (channel) {
      notifyChannel(channel, channelName);
    }
  }

  function requestPlayerReset() {
    if (resetAttempted) {
      return;
    }

    resetAttempted = true;
    const requestId = `${Date.now()}-${++nextRequestId}`;
    const shouldCount = countThisSpinner;
    const requestTimer = window.setTimeout(() => {
      pendingRequests.delete(requestId);
      console.error('Twitch Spinner Reset did not receive a response from its Twitch player agent.');
    }, REQUEST_TIMEOUT_MS);
    pendingRequests.set(requestId, { timer: requestTimer, shouldCount });
    window.postMessage({
      source: MESSAGE_SOURCE,
      type: 'reset-player',
      requestId
    }, location.origin);
  }

  function checkSpinner() {
    timerId = null;
    update();
  }

  function update() {
    syncChannel();
    if (!getSpinner()) {
      notePlayback();
      stopTimer();
      spinnerSince = null;
      resetAttempted = false;
      countThisSpinner = false;
      return;
    }

    notePlayback();
    if (spinnerSince === null) {
      spinnerSince = Date.now();
      countThisSpinner = seenPlayback && !waitForLoadBreak;
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

    const pending = pendingRequests.get(message.requestId);
    window.clearTimeout(pending.timer);
    pendingRequests.delete(message.requestId);
    if (message.success) {
      if (!pending.shouldCount) {
        return;
      }

      chrome.runtime.sendMessage({ type: 'player-reset-succeeded' }, () => {
        if (chrome.runtime.lastError) {
          console.error('Twitch Spinner Reset could not update its reset counter.', chrome.runtime.lastError);
        }
      });
    } else {
      console.error(`Twitch Spinner Reset could not reset the player: ${message.error}`);
    }
  });

  document.addEventListener('playing', (event) => {
    if (isVideoEvent(event)) {
      notePlayback();
    }
  }, true);

  document.addEventListener('timeupdate', (event) => {
    if (isVideoEvent(event)) {
      notePlayback();
    }
  }, true);

  const observer = new MutationObserver(update);
  observer.observe(document.documentElement, {
    attributes: true,
    attributeFilter: ['class'],
    childList: true,
    subtree: true
  });

  window.addEventListener('popstate', update);
  if (window.navigation?.addEventListener) {
    window.navigation.addEventListener('navigatesuccess', update);
  }

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
