// Note: In MV3, global variables can be wiped when the script goes inactive.
// We use these caches for performance, but critical data is mirrored to storage.
let snapshotCache = {}; 
let assetCache = {}; 

chrome.runtime.onInstalled.addListener(() => {
    chrome.storage.local.set({ recordingState: {} });
});

/**
 * Handle extension icon click.
 * This listener fires ONLY when the popup is disabled (popup: "").
 * This happens while a recording is active on a specific tab.
 */
chrome.action.onClicked.addListener(async (tab) => {
    const data = await chrome.storage.local.get("recordingState");
    const state = data.recordingState || {};

    if (state[tab.id]?.active) {
        // If recording is active, stop it immediately without showing the popup.
        stopRecording(tab.id);
    }
});

chrome.runtime.onMessage.addListener((message, sender, sendResponse) => {
    if (message.action === "startRecording") {
        const { tabId, mode } = message;
        startRecording(tabId, mode);
    }
    else if (message.action === "stopRecording") {
        const tabId = message.tabId || sender.tab?.id;
        if (tabId) stopRecording(tabId);
    }
    else if (message.action === "saveSnapshot" && sender.tab) {
        const tabId = sender.tab.id;
        if (!snapshotCache[tabId]) snapshotCache[tabId] = [];
        
        snapshotCache[tabId].push(message.data);
        
        // Optional: Periodically flush to storage to prevent loss if the worker restarts
        if (snapshotCache[tabId].length % 10 === 0) {
            chrome.storage.local.set({ [`snapshots_${tabId}`]: snapshotCache[tabId] });
        }
        
        sendResponse({ count: snapshotCache[tabId].length });
    }
    else if (message.action === "saveAsset" && sender.tab) {
        const tabId = sender.tab.id;
        if (!assetCache[tabId]) assetCache[tabId] = {};
        if (!assetCache[tabId][message.id]) {
            assetCache[tabId][message.id] = message.data;
        }
    }
    return true; 
});

async function startRecording(tabId, mode) {
    const data = await chrome.storage.local.get("recordingState");
    const state = data.recordingState || {};

    state[tabId] = { active: true, mode: mode };
    await chrome.storage.local.set({ recordingState: state });
    
    snapshotCache[tabId] = [];
    assetCache[tabId] = {};
    
    // Clear old data
    await chrome.storage.local.remove([`snapshots_${tabId}`, `assets_${tabId}`]);

    updateIcon(tabId, true);
    
    // DISABLE the popup for this specific tab.
    // This allows the icon click to trigger the onClicked listener directly.
    chrome.action.setPopup({ tabId: tabId, popup: "" });
    
    chrome.scripting.executeScript({
        target: { tabId: tabId },
        files: ["content.js"]
    }).then(() => {
        chrome.tabs.sendMessage(tabId, { action: "init", mode: mode });
    }).catch(err => console.error("Injection failed:", err));
}

async function stopRecording(tabId) {
    const data = await chrome.storage.local.get("recordingState");
    const state = data.recordingState || {};

    if (state[tabId]) {
        state[tabId].active = false;
        await chrome.storage.local.set({ recordingState: state });
    }
    
    updateIcon(tabId, false);
    
    // RE-ENABLE the popup for this tab.
    chrome.action.setPopup({ tabId: tabId, popup: "popup.html" });

    // Save final caches to storage
    const updates = {};
    updates[`snapshots_${tabId}`] = snapshotCache[tabId] || [];
    updates[`assets_${tabId}`] = assetCache[tabId] || {};
    
    await chrome.storage.local.set(updates);

    delete snapshotCache[tabId];
    delete assetCache[tabId];

    chrome.tabs.sendMessage(tabId, { action: "stop" }).catch(() => {});
    chrome.tabs.create({ url: chrome.runtime.getURL(`viewer.html?tabId=${tabId}`) });
}

function updateIcon(tabId, isRecording) {
    const path = isRecording ? "icons/red.png" : "icons/gray.png";
    chrome.action.setIcon({ tabId, path });
}
