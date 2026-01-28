document.addEventListener('DOMContentLoaded', async () => {
    const [tab] = await chrome.tabs.query({ active: true, currentWindow: true });
    if (!tab) return;

    const { recordingState } = await chrome.storage.local.get("recordingState");
    const isRecording = !!recordingState?.[tab.id]?.active;

    const stopBtn = document.getElementById('btn-stop');
    const modeBtns = [
        document.getElementById('btn-debounce'),
        document.getElementById('btn-anim'),
        document.getElementById('btn-paint')
    ];

    if (isRecording) {
        modeBtns.forEach(b => b.style.display = 'none');
        stopBtn.style.display = 'block';
    }

    document.getElementById('btn-debounce').onclick = () => start(tab.id, 'debounced');
    document.getElementById('btn-anim').onclick = () => start(tab.id, 'animationFrame');
    document.getElementById('btn-paint').onclick = () => start(tab.id, 'mozAfterPaint');

    stopBtn.onclick = async () => {
        chrome.runtime.sendMessage({ action: "stopRecording", tabId: tab.id });
        window.close();
    };

    document.getElementById('btn-import').onclick = () => {
        // Open viewer in a state ready to receive an import
        chrome.tabs.create({ url: chrome.runtime.getURL(`viewer.html?tabId=new`) });
        window.close();
    };

    function start(tabId, mode) {
        chrome.runtime.sendMessage({ action: "startRecording", tabId, mode });
        window.close();
    }
});
