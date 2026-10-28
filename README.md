# Twitch Player Reset

A small Chrome/Brave Manifest V3 extension that watches Twitch channel pages for the player loading spinner (`.tw-loading-spinner`). If it stays visible continuously for the configured time, the extension resets the Twitch player without reloading the page. The default is 1 second; use the extension popup to choose 0.1–120 seconds.

## Install

1. Open `chrome://extensions` in Chrome or `brave://extensions` in Brave.
2. Enable **Developer mode**.
3. Choose **Load unpacked** and select this folder.
4. Open or refresh a Twitch channel page.

## Reset behavior

The extension invokes Twitch's internal player-source reset method. It does not reload the page. Twitch's internal implementation is not a public API and may change; if the extension cannot find it, the failure is reported in the browser console and the page is left untouched. For VODs, the current playback position is restored after the reset when Twitch provides it.

The popup displays the number of successful player resets recorded on this device.

## Icon

The extension icon is provided in `icons/` at the standard 16, 32, 48, and 128 pixel sizes.
