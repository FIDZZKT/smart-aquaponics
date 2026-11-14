/**
 * Smart Aquaponics - Configuration
 * Synced dengan kode ESP32:
 *   - Sensor dibaca setiap 3 detik (timer.setInterval 3000L)
 *   - Servo buka 1 detik lalu tutup (timer.setTimeout 1000L)
 *   - Soil < 40% = KERING, >= 40% = BASAH
 *   - Notifikasi Blynk saat soil < 20%
 */

const CONFIG = {
    BLYNK: {
        BASE_URL: 'https://blynk.cloud/external/api',
        ENDPOINTS: { GET: '/get', UPDATE: '/update' }
    },

    // Default token dari kode ESP32 (opsional — user bisa override via Settings)
    DEFAULT_AUTH_TOKEN: 'jOOh3UzFdft8lEz-7y7G-SeM1NcK8sNF',

    PINS: {
        TEMPERATURE: 'V0',     // DHT11 suhu (°C) - Float
        SOIL_MOISTURE: 'V1',   // Soil moisture (%) - Integer 0-100
        SOIL_STATUS: 'V2',     // "KERING" / "BASAH" - String
        FEED_TRIGGER: 'V3',    // Servo trigger (0/1) - Integer
        AIR_HUMIDITY: 'V5'     // DHT11 kelembapan udara (%) - Float
    },

    TIMING: {
        POLL_INTERVAL: 3000,        // Match ESP32 sensor interval (3s)
        FEED_PULSE_DURATION: 1000,   // Servo buka 1s sesuai kode
        CONNECTION_TIMEOUT: 5000,
        RECONNECT_DELAY: 3000
    },

    THRESHOLDS: {
        TEMPERATURE: {
            MIN: 15, MAX: 35, CRITICAL_MAX: 40
        },
        AIR_HUMIDITY: {
            MIN: 30, MAX: 80, CRITICAL_MIN: 20
        },
        SOIL_MOISTURE: {
            MIN: 40,          // < 40% = KERING (sesuai kode ESP32)
            MAX: 80,
            CRITICAL_MIN: 20  // < 20% = notifikasi kritis (sesuai kode)
        }
    },

    STORAGE: {
        AUTH_TOKEN: 'blynk_auth_token',
        LAST_FEED_TIME: 'last_feed_time'
    },

    STATUS: {
        ONLINE: 'Online',
        OFFLINE: 'Offline'
    }
};

const AppState = {
    authToken: null,
    isConnected: false,
    isPolling: false,
    lastUpdate: null,
    pollingInterval: null,
    sensorData: {
        temperature: null,
        airHumidity: null,
        soilMoisture: null,
        soilStatus: null
    }
};

function getAuthToken() {
    return localStorage.getItem(CONFIG.STORAGE.AUTH_TOKEN) || CONFIG.DEFAULT_AUTH_TOKEN || null;
}

function saveAuthToken(token) {
    if (token && token.trim()) {
        localStorage.setItem(CONFIG.STORAGE.AUTH_TOKEN, token.trim());
        AppState.authToken = token.trim();
        return true;
    }
    return false;
}

function clearAuthToken() {
    localStorage.removeItem(CONFIG.STORAGE.AUTH_TOKEN);
    AppState.authToken = null;
}

function getLastFeedTime() {
    const ts = localStorage.getItem(CONFIG.STORAGE.LAST_FEED_TIME);
    return ts ? new Date(parseInt(ts)) : null;
}

function saveLastFeedTime() {
    const now = Date.now();
    localStorage.setItem(CONFIG.STORAGE.LAST_FEED_TIME, now.toString());
    return new Date(now);
}

function isValidAuthToken(token) {
    return token && typeof token === 'string' && token.length >= 20;
}
