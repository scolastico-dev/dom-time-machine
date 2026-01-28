const slider = document.getElementById('slider');
const info = document.getElementById('info');
const iframe = document.getElementById('viewer');
const btnExport = document.getElementById('btn-export');
const btnDelete = document.getElementById('btn-delete');
const btnExportFrame = document.getElementById('btn-export-frame');
const btnImportViewer = document.getElementById('btn-import-viewer');
const fileInputViewer = document.getElementById('fileInputViewer');

// New Elements
const btnPrev = document.getElementById('btn-prev');
const btnNext = document.getElementById('btn-next');
const snapshotInput = document.getElementById('snapshot-input');
const btnAutoImport = document.getElementById('btn-auto-import');

let snapshots = [];
let assets = {};
let currentTabId = null;

async function loadSnapshots() {
    const urlParams = new URLSearchParams(window.location.search);
    currentTabId = urlParams.get('tabId');
    
    if (!currentTabId || currentTabId === 'new') {
        info.textContent = "Import required.";
        btnAutoImport.style.display = 'block';
        return;
    }

    const snapKey = `snapshots_${currentTabId}`;
    const assetKey = `assets_${currentTabId}`;

    const data = await chrome.storage.local.get([snapKey, assetKey]);
    snapshots = data[snapKey] || [];
    assets = data[assetKey] || {};

    if (snapshots.length === 0) {
        info.textContent = "No snapshots recorded.";
        return;
    }

    slider.max = snapshots.length - 1;
    snapshotInput.max = snapshots.length;
    render(0);
}

function render(index) {
    index = Math.max(0, Math.min(parseInt(index), snapshots.length - 1));
    const shot = snapshots[index];
    
    // Sync UI elements
    slider.value = index;
    snapshotInput.value = index + 1;

    if (!shot) {
        iframe.srcdoc = "";
        info.textContent = "No Data";
        return;
    }

    const time = new Date(shot.time).toLocaleTimeString();
    info.textContent = `Snapshot: ${index + 1}/${snapshots.length} - ${time}`;

    let html = shot.html;
    const parser = new DOMParser();
    const doc = parser.parseFromString(html, "text/html");
    
    const base = doc.createElement('base');
    base.href = shot.baseUrl;
    doc.head.prepend(base);

    doc.querySelectorAll('img[data-asset-id]').forEach(img => {
        const id = img.dataset.assetId;
        img.src = assets[id] ? assets[id] : id;
    });

    doc.querySelectorAll('style').forEach(style => {
        let css = style.textContent;
        css = css.replace(/\[\[ASSET:(.*?)\]\]/g, (match, id) => {
            return assets[id] ? assets[id] : id;
        });
        style.textContent = css;
    });

    iframe.srcdoc = doc.documentElement.outerHTML;
}

// --- Event Listeners ---

slider.addEventListener('input', (e) => render(e.target.value));

// Navigation Handlers
btnPrev.addEventListener('click', () => render(parseInt(slider.value) - 1));
btnNext.addEventListener('click', () => render(parseInt(slider.value) + 1));
snapshotInput.addEventListener('change', (e) => render(parseInt(e.target.value) - 1));

// Gesture Handler for Import
btnAutoImport.addEventListener('click', () => fileInputViewer.click());

btnExport.addEventListener('click', () => {
    const exportData = { snapshots, assets };
    const blob = new Blob([JSON.stringify(exportData)], {type: "application/json"});
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `recording-${currentTabId}.json`;
    a.click();
    URL.revokeObjectURL(url);
});

btnImportViewer.addEventListener('click', () => fileInputViewer.click());

fileInputViewer.onchange = (e) => {
    const file = e.target.files[0];
    if (!file) return;

    const reader = new FileReader();
    reader.onload = async (ev) => {
        try {
            const data = JSON.parse(ev.target.result);
            const importId = `imported_${Date.now()}`;
            
            await chrome.storage.local.set({
                [`snapshots_${importId}`]: data.snapshots || [],
                [`assets_${importId}`]: data.assets || {}
            });

            window.location.href = chrome.runtime.getURL(`viewer.html?tabId=${importId}`);
        } catch (err) {
            alert("Error importing file: " + err.message);
        }
    };
    reader.readAsText(file);
};

btnDelete.addEventListener('click', async (e) => {
    if (snapshots.length === 0) return;
    const index = parseInt(slider.value);
    if (!e.shiftKey && !confirm("Delete this snapshot?")) return;

    snapshots.splice(index, 1);
    await chrome.storage.local.set({ [`snapshots_${currentTabId}`]: snapshots });
    
    slider.max = Math.max(0, snapshots.length - 1);
    snapshotInput.max = snapshots.length;
    render(slider.value);
});

btnExportFrame.addEventListener('click', () => {
    if (snapshots.length === 0) return;
    const index = parseInt(slider.value);
    const time = new Date(snapshots[index].time).toISOString().replace(/[:.]/g, '-');
    const frameHtml = iframe.srcdoc;
    if (!frameHtml) return;

    const blob = new Blob([frameHtml], { type: "text/html" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `snapshot-${currentTabId}-${index + 1}-${time}.html`;
    a.click();
    URL.revokeObjectURL(url);
});

setTimeout(loadSnapshots, 200);
