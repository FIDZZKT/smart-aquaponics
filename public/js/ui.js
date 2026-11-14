/**
 * Smart Aquaponics Dashboard - UI Module
 * Minimalist dark theme — no emojis, clean data-forward design
 */

class UIManager {
    constructor() {
        this._initialized = false;
        this._activeAlert = null;
    }

    init() {
        if (this._initialized) return;
        this._initialized = true;
        this.updateLastFeedTime();
    }

    /* ── CONNECTION STATUS ── */
    updateConnectionStatus(isOnline) {
        const dot  = document.getElementById('statusDot');
        const text = document.getElementById('statusText');
        const conn = document.getElementById('sysConnection');
        if (!dot) return;
        if (isOnline) {
            dot.className    = 'dot dot-on';
            text.textContent = 'Online';
            text.style.color = '#34d399';
            if (conn) conn.textContent = 'Connected';
        } else {
            dot.className    = 'dot dot-off';
            text.textContent = 'Offline';
            text.style.color = '';
            if (conn) conn.textContent = 'Disconnected';
        }
    }

    /* ── SENSOR DATA ── */
    updateSensorData(data) {
        // Helper: update SVG gauge arc (half-circle, dasharray=172)
        const setGauge = (id, pct) => {
            const el = document.getElementById(id);
            if (!el) return;
            const offset = 172 - (172 * Math.min(100, Math.max(0, pct)) / 100);
            el.style.strokeDashoffset = offset;
        };

        // Temperature
        const tEl = document.getElementById('temperature');
        if (data.temperature != null && tEl) {
            const v = parseFloat(data.temperature);
            tEl.textContent = v.toFixed(1);
            // map -20..60 → 0..100 for gauge
            setGauge('gaugeTemp', ((v + 20) / 80) * 100);
            this.checkThreshold('temperature', v);
        } else if (tEl) { tEl.textContent = '—'; }

        // Air Humidity
        const hEl = document.getElementById('airHumidity');
        if (data.airHumidity != null && hEl) {
            const v = parseFloat(data.airHumidity);
            hEl.textContent = v.toFixed(1);
            setGauge('gaugeHumid', v);
            this.checkThreshold('airHumidity', v);
        } else if (hEl) { hEl.textContent = '—'; }

        // Soil Moisture
        const sEl = document.getElementById('soilMoisture');
        if (data.soilMoisture != null && sEl) {
            const v = parseInt(data.soilMoisture);
            sEl.textContent = v;
            setGauge('gaugeSoil', v);
            this.checkThreshold('soilMoisture', v);
        } else if (sEl) { sEl.textContent = '—'; }

        // Soil Status
        const stEl = document.getElementById('soilStatus');
        const stBadge = document.getElementById('soilStatusBadge');
        if (data.soilStatus != null && stEl) {
            const s = data.soilStatus.toString().toUpperCase();
            stEl.textContent = s;
            if (stBadge) {
                if (s === 'BASAH' || s === 'WET') {
                    stBadge.className = 'tag tag-grn';
                    stBadge.style.cssText = '';
                    stBadge.innerHTML = '<span class="dot dot-on" style="width:6px;height:6px"></span>Basah';
                } else if (s === 'KERING' || s === 'DRY') {
                    stBadge.className = 'tag tag-amber';
                    stBadge.style.cssText = '';
                    stBadge.innerHTML = '<span class="dot" style="width:6px;height:6px;background:var(--amber,#fbbf24)"></span>Kering';
                } else {
                    stBadge.className = 'tag tag-muted';
                    stBadge.style.cssText = '';
                    stBadge.innerHTML = '<span class="dot dot-off" style="width:6px;height:6px"></span>' + s;
                }
            }
        } else if (stEl) { stEl.textContent = '—'; }

        this.updateLastUpdateTime();
    }

    /* ── THRESHOLDS ── */
    checkThreshold(type, value) {
        if (!CONFIG || !CONFIG.THRESHOLDS) return;
        const T = CONFIG.THRESHOLDS;
        let msg = null;

        if (type === 'temperature') {
            if (value >= T.TEMPERATURE.CRITICAL_MAX)
                msg = `Critical: temperature at ${value}°C — above safe limit`;
            else if (value > T.TEMPERATURE.MAX)
                msg = `Warning: temperature above normal range (${value}°C)`;
            else if (value < T.TEMPERATURE.MIN)
                msg = `Warning: temperature below normal range (${value}°C)`;
        } else if (type === 'airHumidity') {
            if (value < T.AIR_HUMIDITY.CRITICAL_MIN)
                msg = `Critical: air humidity at ${value}% — too low`;
            else if (value < T.AIR_HUMIDITY.MIN)
                msg = `Warning: air humidity below optimal range (${value}%)`;
            else if (value > T.AIR_HUMIDITY.MAX)
                msg = `Warning: air humidity above optimal range (${value}%)`;
        } else if (type === 'soilMoisture') {
            if (value < T.SOIL_MOISTURE.CRITICAL_MIN)
                msg = `Critical: soil moisture at ${value}% — plants need water`;
            else if (value < T.SOIL_MOISTURE.MIN)
                msg = `Warning: soil moisture low (${value}%)`;
        }

        if (msg) this.showAlert(msg);
    }

    /* ── API STATUS ── */
    updateAPIStatus(status, isLoading = false) {
        const el = document.getElementById('apiStatus');
        if (!el) return;
        const key = isLoading ? 'loading' : status;
        const map = {
            loading: { label:'Fetching…', style:'background:rgba(34,211,238,.08);color:#22d3ee;border-color:rgba(34,211,238,.18)' },
            success: { label:'OK',        style:'background:rgba(52,211,153,.08);color:#34d399;border-color:rgba(52,211,153,.18)' },
            error:   { label:'Error',     style:'background:rgba(248,113,113,.08);color:#f87171;border-color:rgba(248,113,113,.18)' },
            idle:    { label:'Idle',      style:'background:rgba(232,244,236,.04);color:rgba(232,244,236,.2);border-color:rgba(232,244,236,.08)' },
        };
        const s = map[key] || map.idle;
        el.innerHTML = `<span class="tag" style="${s.style}">${s.label}</span>`;
    }

    /* ── TIMESTAMPS ── */
    updateLastUpdateTime() {
        const t = new Date().toLocaleTimeString('id-ID', {
            hour: '2-digit', minute: '2-digit', second: '2-digit'
        });
        ['lastUpdate', 'sysLastUpdate'].forEach(id => {
            const el = document.getElementById(id);
            if (el) el.textContent = t;
        });
    }

    updateLastFeedTime() {
        const el = document.getElementById('lastFeedTime');
        const last = getLastFeedTime();
        if (!el) return;
        el.textContent = last
            ? last.toLocaleString('id-ID', { hour: '2-digit', minute: '2-digit', day: '2-digit', month: 'short' })
            : 'Never';
    }

    /* ── ALERT ── */
    showAlert(message) {
        const banner = document.getElementById('alertBanner');
        const msgEl = document.getElementById('alertMessage');
        if (banner && msgEl) {
            msgEl.textContent = message;
            banner.classList.remove('hidden');
            this._activeAlert = message;
            // auto-dismiss after 8s if values return to normal
            clearTimeout(this._alertTimer);
            this._alertTimer = setTimeout(() => { this.hideAlert(); }, 8000);
        }
    }

    hideAlert() {
        const banner = document.getElementById('alertBanner');
        if (banner) banner.classList.add('hidden');
        this._activeAlert = null;
    }

    /* ── FEED BUTTON ── */
    setFeedButtonLoading(isLoading) {
        const btn = document.getElementById('feedBtn');
        const text = document.getElementById('feedBtnText');
        if (!btn) return;
        btn.disabled = isLoading;
        if (text) text.textContent = isLoading ? 'Feeding…' : 'Trigger Feed';
    }

    /* ── MODAL ── */
    openModal() {
        const modal = document.getElementById('settingsModal');
        const input = document.getElementById('authTokenInput');
        if (!modal) return;
        const token = typeof getAuthToken === 'function' ? getAuthToken() : null;
        if (token && input) input.value = token;
        modal.classList.remove('hidden');
        if (typeof lucide !== 'undefined') lucide.createIcons();
    }

    closeModal() {
        const modal = document.getElementById('settingsModal');
        const input = document.getElementById('authTokenInput');
        if (modal) modal.classList.add('hidden');
        if (input) input.value = '';
    }

    /* ── TOAST ── */
    showToast(message, type) {
        if (typeof window.showToast === 'function') {
            window.showToast(message, type);
        }
    }
}

const uiManager = new UIManager();

if (typeof module !== 'undefined' && module.exports) {
    module.exports = { UIManager, uiManager };
}
