/**
 * Smart Aquaponics Dashboard - Main Application Module
 *
 * Status online/offline diambil langsung dari Blynk Cloud:
 *   GET /external/api/isHardwareConnected?token=...
 * Ini mencerminkan apakah ESP32 benar-benar sedang terhubung,
 * bukan hanya apakah API bisa diakses.
 */

class AquaponicsApp {
    constructor() {
        this.isInitialized    = false;
        this.pollingInterval  = null;   // sensor data poll
        this.statusInterval   = null;   // hardware status poll
        this.isPolling        = false;
        this.consecutiveErrors = 0;
    }

    /* ─────────────────────────────────────────
       INIT
    ───────────────────────────────────────── */
    async init() {
        uiManager.init();

        const token = getAuthToken();
        if (token) {
            AppState.authToken = token;
            await this.start();
        } else {
            uiManager.openModal();
        }

        this.isInitialized = true;
    }

    /* ─────────────────────────────────────────
       START / STOP / RESTART
    ───────────────────────────────────────── */
    async start() {
        if (!AppState.authToken) {
            uiManager.showToast('Set your auth token in Settings first', 'warning');
            return;
        }

        this.consecutiveErrors = 0;

        // Check hardware status immediately from Blynk
        await this.checkHardwareStatus();

        // Start sensor data polling
        this.startPolling();

        // Poll hardware status every 5s (independent of sensor poll)
        if (this.statusInterval) clearInterval(this.statusInterval);
        this.statusInterval = setInterval(() => this.checkHardwareStatus(), 5000);
    }

    stop() {
        this.stopPolling();
        if (this.statusInterval) {
            clearInterval(this.statusInterval);
            this.statusInterval = null;
        }
        AppState.isConnected = false;
        uiManager.updateConnectionStatus(false);
    }

    async restart() {
        this.stop();
        await new Promise(r => setTimeout(r, 400));
        await this.start();
    }

    /* ─────────────────────────────────────────
       HARDWARE STATUS — dari Blynk API langsung
    ───────────────────────────────────────── */
    async checkHardwareStatus() {
        if (!AppState.authToken) return;

        try {
            const connected = await blynkAPI.isHardwareConnected(AppState.authToken);

            if (connected !== AppState.isConnected) {
                AppState.isConnected = connected;
                uiManager.updateConnectionStatus(connected);

                if (!connected) {
                    uiManager.showToast('ESP32 offline — tidak terhubung ke Blynk', 'warning');
                } else {
                    uiManager.showToast('ESP32 online', 'success');
                }
            }
        } catch (err) {
            // API sendiri tidak bisa dicapai
            if (AppState.isConnected) {
                AppState.isConnected = false;
                uiManager.updateConnectionStatus(false);
            }
        }
    }

    /* ─────────────────────────────────────────
       SENSOR POLLING
    ───────────────────────────────────────── */
    startPolling() {
        if (this.isPolling) return;
        this.fetchData();
        this.pollingInterval = setInterval(() => this.fetchData(), CONFIG.TIMING.POLL_INTERVAL);
        this.isPolling = true;
    }

    stopPolling() {
        if (this.pollingInterval) {
            clearInterval(this.pollingInterval);
            this.pollingInterval = null;
        }
        this.isPolling = false;
    }

    /* ─────────────────────────────────────────
       FETCH SENSOR DATA
    ───────────────────────────────────────── */
    async fetchData() {
        if (!AppState.authToken) return;

        try {
            uiManager.updateAPIStatus('loading', true);

            const data = await blynkAPI.fetchAllSensors(AppState.authToken);

            AppState.sensorData = data;
            AppState.lastUpdate = new Date();
            this.consecutiveErrors = 0;

            uiManager.updateSensorData(data);
            uiManager.updateAPIStatus('success');

        } catch (err) {
            console.error('Fetch error:', err.message);
            uiManager.updateAPIStatus('error');
            this.consecutiveErrors++;

            if (this.consecutiveErrors === 1) {
                uiManager.showToast(`Data error: ${err.message}`, 'error');
            }
            if (this.consecutiveErrors >= 5) {
                this.stopPolling();
                uiManager.showToast('Gagal ambil data berulang kali — polling dihentikan', 'error');
            }
        }
    }

    /* ─────────────────────────────────────────
       FEED CONTROL
    ───────────────────────────────────────── */
    async triggerFeed() {
        if (!AppState.authToken) {
            uiManager.showToast('Set your auth token first', 'warning');
            return;
        }
        if (!AppState.isConnected) {
            uiManager.showToast('ESP32 tidak terhubung ke Blynk', 'error');
            return;
        }

        try {
            uiManager.setFeedButtonLoading(true);
            await blynkAPI.triggerFeed(AppState.authToken);
            saveLastFeedTime();
            uiManager.updateLastFeedTime();
            uiManager.showToast('Feed sent successfully', 'success');
        } catch (err) {
            uiManager.showToast(`Feed failed: ${err.message}`, 'error');
        } finally {
            uiManager.setFeedButtonLoading(false);
        }
    }
}

/* ─────────────────────────────────────────
   SINGLETON
───────────────────────────────────────── */
const app = new AquaponicsApp();

document.addEventListener('visibilitychange', () => {
    if (document.hidden) {
        app.stopPolling();
    } else if (app.isInitialized && AppState.authToken) {
        // Resume: re-check status and restart polling
        app.checkHardwareStatus();
        app.startPolling();
    }
});

window.addEventListener('beforeunload', () => app.stop());
window.AquaponicsApp = app;

if (typeof module !== 'undefined' && module.exports) {
    module.exports = { AquaponicsApp, app };
}
