import { Auth } from './auth.js';
import { Storage } from './storage.js';

let html5QrcodeScanner = null;

export function setupQRSyncInteractions() {
    const btnShowQr = document.getElementById('btn-show-qr');
    const btnScanQr = document.getElementById('btn-scan-qr');
    const qrDisplayModal = document.getElementById('qr-display-modal');
    const qrScanModal = document.getElementById('qr-scan-modal');
    const btnCloseQrDisplay = document.getElementById('btn-close-qr-display');
    const btnCloseQrScan = document.getElementById('btn-close-qr-scan');
    
    const syncCodeDisplay = document.getElementById('sync-code-display');
    const btnCopySyncCode = document.getElementById('btn-copy-sync-code');
    const syncCodeInput = document.getElementById('sync-code-input');
    const btnSubmitSyncCode = document.getElementById('btn-submit-sync-code');

    // Show QR Code Modal
    if (btnShowQr) {
        btnShowQr.addEventListener('click', () => {
            const deviceId = Auth.getUserId();
            syncCodeDisplay.value = deviceId;
            
            // Clear previous QR code
            document.getElementById('qrcode-container').innerHTML = '';
            
            try {
                // Generate QR Code AFTER showing the modal
                qrDisplayModal.style.display = 'flex';
                
                // qrcodejs requires the container to be visible to calculate dimensions properly
                new QRCode(document.getElementById('qrcode-container'), {
                    text: deviceId,
                    width: 200,
                    height: 200,
                    colorDark : "#000000",
                    colorLight : "#ffffff",
                    correctLevel : QRCode.CorrectLevel.H
                });
            } catch (e) {
                qrDisplayModal.style.display = 'none';
                alert('QRコードの生成に失敗しました: ' + e.message);
                console.error(e);
            }
        });
    }

    // Close Display Modal
    if (btnCloseQrDisplay) {
        btnCloseQrDisplay.addEventListener('click', () => {
            qrDisplayModal.style.display = 'none';
        });
    }

    // Copy Sync Code
    if (btnCopySyncCode) {
        btnCopySyncCode.addEventListener('click', () => {
            syncCodeDisplay.select();
            document.execCommand('copy');
            const originalText = btnCopySyncCode.textContent;
            btnCopySyncCode.textContent = 'コピーしました！';
            setTimeout(() => btnCopySyncCode.textContent = originalText, 2000);
        });
    }

    // Show Scan Modal
    if (btnScanQr) {
        btnScanQr.addEventListener('click', () => {
            qrScanModal.style.display = 'flex';
            startScanner();
        });
    }

    // Close Scan Modal
    if (btnCloseQrScan) {
        btnCloseQrScan.addEventListener('click', () => {
            stopScanner();
            qrScanModal.style.display = 'none';
        });
    }

    // Manual Sync Code Submit
    if (btnSubmitSyncCode) {
        btnSubmitSyncCode.addEventListener('click', () => {
            const code = syncCodeInput.value.trim();
            if (!code) {
                alert('同期コードを入力してください。');
                return;
            }
            processScannedCode(code);
        });
    }

    // Outside click to close
    window.addEventListener('click', (e) => {
        if (e.target === qrDisplayModal) {
            qrDisplayModal.style.display = 'none';
        }
        if (e.target === qrScanModal) {
            stopScanner();
            qrScanModal.style.display = 'none';
        }
    });
}

function startScanner() {
    if (html5QrcodeScanner) {
        // Already running
        return;
    }
    
    // Check if HTML5Qrcode is loaded
    if (typeof Html5QrcodeScanner === 'undefined') {
        alert('QRコードリーダーの読み込みに失敗しました。');
        return;
    }

    html5QrcodeScanner = new Html5QrcodeScanner(
        "qr-reader", 
        { fps: 10, qrbox: {width: 250, height: 250} }, 
        /* verbose= */ false
    );
    
    html5QrcodeScanner.render(onScanSuccess, onScanFailure);
}

function stopScanner() {
    if (html5QrcodeScanner) {
        html5QrcodeScanner.clear().catch(error => {
            console.error("Failed to clear html5QrcodeScanner. ", error);
        });
        html5QrcodeScanner = null;
    }
}

function onScanSuccess(decodedText, decodedResult) {
    // Stop scanning
    stopScanner();
    document.getElementById('qr-scan-modal').style.display = 'none';
    
    processScannedCode(decodedText);
}

function onScanFailure(error) {
    // handle scan failure, usually better to ignore and keep scanning.
    // console.warn(`Code scan error = ${error}`);
}

async function processScannedCode(scannedId) {
    if (!scannedId) return;
    
    const currentId = Auth.getUserId();
    if (scannedId === currentId) {
        alert('すでにこの端末自身のコードです。');
        return;
    }

    const confirmMsg = 'この端末と同期を開始しますか？\n（現在この端末にある予定データは、新しい同期先のデータと統合されます）';
    if (!confirm(confirmMsg)) {
        return;
    }

    // Show loading overlay
    const overlay = document.getElementById('sync-overlay');
    if (overlay) overlay.style.display = 'flex';

    try {
        // 1. Merge local data to the NEW cloud destination
        await Storage.mergeLocalToCloud(scannedId);
        
        // 2. Set the new Device ID locally
        Auth.setDeviceId(scannedId);
        
        // 3. Reload the page to cleanly re-initialize everything with the new ID
        // This is the safest way to ensure Firestore listeners are fully reset.
        window.location.reload();
        
    } catch (error) {
        console.error('Sync process failed:', error);
        alert('同期に失敗しました。再度お試しください。');
        if (overlay) overlay.style.display = 'none';
    }
}
