# DOM Time Machine Pro

**DOM Time Machine Pro** is a powerful developer tool designed to capture a high-fidelity, chronological record of a webpage's DOM state. Unlike standard screen recording, this extension captures the actual HTML structure and associated assets, allowing you to "rewind" and inspect the code of a page at any point in time.

### Why It’s Useful

* **Debug Transient UI:** Capture elusive states like toast notifications, hover effects, or race conditions that disappear before you can inspect them.
* **State Analysis:** Compare how the DOM evolves after specific user actions or API responses.
* **Portable Recordings:** Export your session as a JSON file to share with other developers or import later for further analysis.
* **Asset Persistence:** Automatically inlines CSS and converts images to Base64 to ensure the recording remains intact even if the original website goes offline.

### How It Works

The extension utilizes three distinct capture modes to suit different needs:

1. **Debounced (Mutation):** Uses a `MutationObserver` to trigger a snapshot whenever the DOM changes, with a 100ms debounce to maintain performance.
2. **RequestAnimationFrame:** Captures the DOM at the browser's refresh rate—useful for high-speed animations.
3. **MozAfterPaint (Firefox Recommended):** Specifically designed for Firefox, this mode triggers a capture only after the browser actually paints a change to the screen.

**Workflow:**

* **Record:** Select a mode from the popup to begin. The extension icon will turn red to indicate active recording.
* **Capture:** The background script manages the storage of snapshots and assets while you navigate.
* **View:** Once stopped, a dedicated "Viewer" tab opens. Use the slider or navigation buttons to travel through your recording timeline.

### Browser Recommendation

While compatible with Chromium-based browsers, **Firefox is highly recommended**. Firefox supports the `MozAfterPaint` event (when enabled in `about:config`), which provides the most efficient and accurate "paint-based" recording triggers available.

### Installation & Configuration

For Firefox users wanting to use the Paint mode:

1. Navigate to `about:config`.
2. Set `dom.send_after_paint_to_content` to `true`.

### License

This project is licensed under the **GNU Affero General Public License (AGPL-3.0)**. We believe in open-source collaboration and ensuring that any improvements to this tool remain available to the community.
