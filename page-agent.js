(() => {
  const MESSAGE_SOURCE = 'twitch-spinner-reset-extension';
  const SPINNER_SELECTOR = '.tw-loading-spinner';
  const PLAYER_SOURCE_PREDICATE = (instance) =>
    typeof instance?.setSrc === 'function' &&
    typeof instance?.setInitialPlaybackSettings === 'function' &&
    instance.props?.mediaPlayerInstance;

  function getReactFiber(element) {
    if (!element) {
      return null;
    }

    const key = Object.keys(element).find((name) =>
      name.startsWith('__reactFiber$') || name.startsWith('__reactInternalInstance$')
    );
    return key ? element[key] : null;
  }

  function findPlayerSources(spinner) {
    const searched = new Set();

    for (let element = spinner; element; element = element.parentElement) {
      const fiber = getReactFiber(element);
      for (let ancestor = fiber; ancestor; ancestor = ancestor.return) {
        if (searched.has(ancestor)) {
          continue;
        }
        searched.add(ancestor);

        const instances = [];
        const stack = [ancestor];
        while (stack.length) {
          const current = stack.pop();
          const instance = current.stateNode;
          if (PLAYER_SOURCE_PREDICATE(instance)) {
            instances.push(instance);
          }

          if (current.sibling && current !== ancestor) {
            stack.push(current.sibling);
          }
          if (current.child) {
            stack.push(current.child);
          }
        }

        if (instances.length) {
          return instances;
        }
      }
    }

    return [];
  }

  function getPlayer(instance) {
    const player = instance.props.mediaPlayerInstance;
    return player?.playerInstance || player;
  }

  async function resetPlayer() {
    const spinner = document.querySelector(SPINNER_SELECTOR);
    if (!spinner) {
      throw new Error('The Twitch player spinner is no longer present.');
    }

    const sources = findPlayerSources(spinner);
    if (!sources.length) {
      throw new Error('Could not find Twitch’s internal player reset method.');
    }

    const player = getPlayer(sources[0]);
    const duration = player?.getDuration?.() ?? Infinity;
    const position = Number.isFinite(duration) && duration > 0
      ? player?.getPosition?.() ?? -1
      : -1;

    const matchingSources = sources.filter((instance) => getPlayer(instance) === player);
    for (const instance of matchingSources) {
      await instance.setSrc({ isNewMediaPlayerInstance: false });
    }

    if (position > 0 && typeof player?.seekTo === 'function') {
      window.setTimeout(() => player.seekTo(position), 250);
    }
  }

  window.addEventListener('message', (event) => {
    const message = event.data;
    if (
      event.source !== window ||
      event.origin !== location.origin ||
      message?.source !== MESSAGE_SOURCE ||
      message.type !== 'reset-player' ||
      typeof message.requestId !== 'string'
    ) {
      return;
    }

    resetPlayer().then(
      () => {
        window.postMessage({
          source: MESSAGE_SOURCE,
          type: 'reset-result',
          requestId: message.requestId,
          success: true
        }, location.origin);
      },
      (error) => {
        window.postMessage({
          source: MESSAGE_SOURCE,
          type: 'reset-result',
          requestId: message.requestId,
          success: false,
          error: error instanceof Error ? error.message : String(error)
        }, location.origin);
      }
    );
  });
})();
