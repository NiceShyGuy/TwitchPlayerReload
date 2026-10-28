# Twitch Player Reset

Twitch Player Reset is a Manifest V3 extension for Chrome and Brave. It watches Twitch pages for the player loading spinner and resets only the player when the spinner remains visible longer than the configured delay. It does not reload the Twitch page.

## Why this extension

When a streamer starts an ad, some Twitch ad-blocking extensions can leave the video player stuck showing its loading spinner. This extension was built to recover playback in that situation: it automatically resets Twitch's player after the spinner stays visible for the configured delay, prompting the video to start again without requiring user interaction.

The extension does not detect ads, change ad-blocking settings, or guarantee that playback will resume. It responds to a persistent player spinner wherever it appears, and it resets the player rather than reloading the entire Twitch page.

- Default delay: 1 second
- Configurable delay: 0.1–120 seconds
- Successful reset count: stored locally for the current channel. Loading or reloading Twitch does not increase it. Opening a different channel sets it back to zero.
- Supported browser baseline: Chrome 111 or a compatible Chromium-based browser

## Load unpacked from source

1. Open `chrome://extensions` in Chrome or `brave://extensions` in Brave.
2. Enable **Developer mode**.
3. Select **Load unpacked** and choose the project folder containing `manifest.json`.
4. Open or refresh a Twitch page.

This is the unpacked/development install path and remains available independently of the packaged production ZIP.

## Production release

Run the automated checks and create a clean Web Store upload archive from the repository root:

```powershell
node --test
.\tools\package-release.ps1
```

The package is written to `dist/TwitchPlayerReset-1.3.1.zip` and contains only the runtime extension files. To replace an existing archive for the same version, pass `-Force`. Update `manifest.json`'s version before preparing a subsequent release.

Before publishing, upload the archive through the Chrome Web Store developer dashboard, review the generated permission disclosures, and complete the store listing with publisher information, screenshots, and any requested privacy-policy URL. The same unpacked extension can be loaded in Brave.

## Permissions and data

The extension uses the `storage` permission for the delay and reset count, and needs access to `https://www.twitch.tv/*` to detect and reset the player. The delay uses browser sync storage. The successful-reset count, and the channel login and display name that count belongs to, use local extension storage. The extension does not include analytics, advertising, or its own external network requests. See [PRIVACY.md](./PRIVACY.md).

## Reset behavior and compatibility

The extension calls an internal Twitch player-source method to reset playback without reloading the page. This is not a public Twitch API and can change without notice. If the player interface cannot be found or its reset fails, the extension reports the error in the Twitch page's developer console and does not intentionally reload the page. VOD position is restored when Twitch exposes it.

## Validation

The Node.js built-in test suite covers the spinner timeout, player-only reset, playback-position restoration, success counter, and release manifest. No third-party runtime dependencies are used.
