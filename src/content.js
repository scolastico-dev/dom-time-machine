(function() {
    if (window.hasDOMRecorder) return;
    window.hasDOMRecorder = true;

    let config = { mode: 'debounced' };
    let processedAssets = new Set(); // Keep track of sent assets to save bandwidth/storage
    let paintTimeout = null;

    // --- Asset Helpers ---
    async function toBase64(url) {
        try {
            const response = await fetch(url);
            const blob = await response.blob();
            return new Promise((resolve) => {
                const reader = new FileReader();
                reader.onloadend = () => resolve(reader.result);
                reader.readAsDataURL(blob);
            });
        } catch (e) { return null; }
    }

    async function processAssets(root) {
        // 1. Handle Images
        const images = root.querySelectorAll('img');
        for (let img of images) {
            const src = img.src;
            if (src && !src.startsWith('data:')) {
                // Use URL as ID
                const assetId = src;
                img.removeAttribute('src');
                img.dataset.assetId = assetId;

                if (!processedAssets.has(assetId)) {
                    processedAssets.add(assetId);
                    const data = await toBase64(src);
                    if (data) {
                        chrome.runtime.sendMessage({ action: "saveAsset", id: assetId, data: data });
                    }
                }
            }
        }

        // 2. Handle External Stylesheets (Inline them)
        // We replace <link rel="stylesheet"> with <style>...</style> and process URLs inside
        const links = root.querySelectorAll('link[rel="stylesheet"]');
        for (let link of links) {
            try {
                const response = await fetch(link.href);
                let cssText = await response.text();
                
                // Extract fonts/backgrounds from CSS
                // Regex looks for url('...') or url("...") or url(...)
                const urlRegex = /url\(\s*(?:(["'])(.*?)\1|([^)\s]+))\s*\)/g;
                let match;
                const matches = [];
                
                // Collect matches first
                while ((match = urlRegex.exec(cssText)) !== null) {
                    matches.push({ full: match[0], url: match[2] || match[3] });
                }

                for (let m of matches) {
                    // Resolve relative URLs based on the stylesheet's URL
                    const absoluteUrl = new URL(m.url, link.href).href;
                    
                    if (!absoluteUrl.startsWith('data:')) {
                        if (!processedAssets.has(absoluteUrl)) {
                            processedAssets.add(absoluteUrl);
                            const data = await toBase64(absoluteUrl);
                            if (data) {
                                chrome.runtime.sendMessage({ action: "saveAsset", id: absoluteUrl, data: data });
                            }
                        }
                        // Replace in CSS with asset ID placeholder
                        cssText = cssText.replace(m.url, `[[ASSET:${absoluteUrl}]]`);
                    }
                }

                const style = document.createElement('style');
                style.textContent = cssText;
                link.replaceWith(style);

            } catch (e) {
                console.warn("Failed to inline CSS:", link.href);
            }
        }
    }

    // --- Capture Logic ---
    async function captureDOM() {
        // Warning check for MozAfterPaint
        if (config.mode === 'mozAfterPaint') {
            clearTimeout(paintTimeout);
            paintTimeout = setTimeout(() => {
                showWarning("No paint events detected for 5s. <br>Please set <b>dom.send_after_paint_to_content</b> to <b>true</b> in about:config.");
            }, 5000);
        }

        // Clone deeply
        const clone = document.documentElement.cloneNode(true);
        
        // Remove scripts to ensure safety in viewer
        const scripts = clone.querySelectorAll('script');
        scripts.forEach(s => s.remove());

        // Process Assets (async)
        await processAssets(clone);

        const snapshot = {
            time: Date.now(),
            html: clone.outerHTML,
            baseUrl: document.baseURI
        };

        chrome.runtime.sendMessage({ action: "saveSnapshot", data: snapshot });
    }

    function showWarning(html) {
        if (document.getElementById('dom-tm-warn')) return;
        const div = document.createElement('div');
        div.id = 'dom-tm-warn';
        div.style.cssText = "position:fixed; top:10px; right:10px; background:#333; color:white; border:1px solid #f00; padding:15px; z-index:999999;";
        div.innerHTML = html + " <button onclick='this.parentElement.remove()'>x</button>";
        document.body.appendChild(div);
    }

    // --- Mode Handlers ---
    let observer;
    let animFrameActive = false;

    function startLoop() {
        console.log(`[Recorder] Starting mode: ${config.mode}`);
        
        if (config.mode === 'mozAfterPaint') {
            window.addEventListener("MozAfterPaint", captureDOM, false);
            captureDOM(); // Capture initial
        } 
        else if (config.mode === 'debounced') {
            let timeout;
            observer = new MutationObserver(() => {
                clearTimeout(timeout);
                timeout = setTimeout(captureDOM, 100); // 100ms debounce
            });
            observer.observe(document, { attributes: true, childList: true, subtree: true, characterData: true });
            captureDOM();
        }
        else if (config.mode === 'animationFrame') {
            animFrameActive = true;
            async function loop() {
                if (!animFrameActive) return;
                await captureDOM();
                requestAnimationFrame(loop);
            }
            loop();
        }
    }

    // --- Listeners ---
    chrome.runtime.onMessage.addListener((msg) => {
        if (msg.action === "init") {
            config.mode = msg.mode;
            startLoop();
        }
        else if (msg.action === "stop") {
            window.removeEventListener("MozAfterPaint", captureDOM, false);
            if (observer) observer.disconnect();
            animFrameActive = false;
            clearTimeout(paintTimeout);
            window.hasDOMRecorder = false;
            console.log("[Recorder] Stopped.");
        }
    });

    // If injected after start (reload case), wait for init.
})();
