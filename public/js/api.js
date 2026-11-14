/**
 * Smart Aquaponics Dashboard - Blynk API Module
 * Handles all API communication with Blynk Cloud REST API
 */

class BlynkAPI {
    constructor() {
        this.baseURL = CONFIG.BLYNK.BASE_URL;
        this.timeout = CONFIG.TIMING.CONNECTION_TIMEOUT;
    }

    /**
     * Build API URL for virtual pin
     */
    buildURL(pin, authToken) {
        return `${this.baseURL}${CONFIG.BLYNK.ENDPOINTS.GET}?token=${authToken}&${pin}`;
    }

    /**
     * Fetch data from a virtual pin with timeout
     */
    async fetchPin(pin, authToken) {
        if (!authToken) {
            throw new Error('Auth token is required');
        }

        const url = this.buildURL(pin, authToken);
        
        const controller = new AbortController();
        const timeoutId = setTimeout(() => controller.abort(), this.timeout);

        try {
            const response = await fetch(url, {
                method: 'GET',
                signal: controller.signal,
                headers: {
                    'Accept': 'application/json'
                }
            });

            clearTimeout(timeoutId);

            if (!response.ok) {
                throw new Error(`HTTP ${response.status}: ${response.statusText}`);
            }

            const data = await response.text();
            return this.parseResponse(data);

        } catch (error) {
            clearTimeout(timeoutId);
            
            if (error.name === 'AbortError') {
                throw new Error('Request timeout');
            }
            throw error;
        }
    }

    /**
     * Parse Blynk API response
     */
    parseResponse(data) {
        try {
            // Blynk returns raw values or JSON arrays
            // Try parsing as JSON first
            const parsed = JSON.parse(data);
            return Array.isArray(parsed) ? parsed[0] : parsed;
        } catch {
            // Return as-is if not JSON (string values)
            return data.trim();
        }
    }

    /**
     * Update a virtual pin value
     */
    async updatePin(pin, value, authToken) {
        if (!authToken) {
            throw new Error('Auth token is required');
        }

        const url = `${this.baseURL}${CONFIG.BLYNK.ENDPOINTS.UPDATE}?token=${authToken}&${pin}=${value}`;
        
        const controller = new AbortController();
        const timeoutId = setTimeout(() => controller.abort(), this.timeout);

        try {
            const response = await fetch(url, {
                method: 'GET',
                signal: controller.signal
            });

            clearTimeout(timeoutId);

            if (!response.ok) {
                throw new Error(`HTTP ${response.status}: ${response.statusText}`);
            }

            return await response.text();

        } catch (error) {
            clearTimeout(timeoutId);
            
            if (error.name === 'AbortError') {
                throw new Error('Request timeout');
            }
            throw error;
        }
    }

    /**
     * Fetch all sensor data in parallel
     */
    async fetchAllSensors(authToken) {
        if (!authToken) {
            throw new Error('Auth token is required');
        }

        const pins = [
            { key: 'temperature', pin: CONFIG.PINS.TEMPERATURE },
            { key: 'airHumidity', pin: CONFIG.PINS.AIR_HUMIDITY },
            { key: 'soilMoisture', pin: CONFIG.PINS.SOIL_MOISTURE },
            { key: 'soilStatus', pin: CONFIG.PINS.SOIL_STATUS }
        ];

        try {
            // Fetch all pins in parallel for better performance
            const results = await Promise.allSettled(
                pins.map(({ pin }) => this.fetchPin(pin, authToken))
            );

            const data = {};
            results.forEach((result, index) => {
                const { key } = pins[index];
                if (result.status === 'fulfilled') {
                    data[key] = result.value;
                } else {
                    console.warn(`Failed to fetch ${key}:`, result.reason);
                    data[key] = null;
                }
            });

            return data;

        } catch (error) {
            throw new Error(`Failed to fetch sensor data: ${error.message}`);
        }
    }

    /**
     * Trigger feed servo with pulse
     */
    async triggerFeed(authToken) {
        if (!authToken) {
            throw new Error('Auth token is required');
        }

        try {
            // Send HIGH pulse
            await this.updatePin(CONFIG.PINS.FEED_TRIGGER, 1, authToken);
            
            // Wait for pulse duration
            await new Promise(resolve => 
                setTimeout(resolve, CONFIG.TIMING.FEED_PULSE_DURATION)
            );
            
            // Send LOW to reset
            await this.updatePin(CONFIG.PINS.FEED_TRIGGER, 0, authToken);
            
            return true;

        } catch (error) {
            throw new Error(`Failed to trigger feed: ${error.message}`);
        }
    }

    /**
     * Check if ESP32 hardware is connected to Blynk Cloud.
     * Endpoint: GET /external/api/isHardwareConnected?token=...
     * Returns: literal "true" or "false"
     */
    async isHardwareConnected(authToken) {
        if (!authToken) return false;

        const url = `${this.baseURL}/isHardwareConnected?token=${authToken}`;
        const controller = new AbortController();
        const timeoutId = setTimeout(() => controller.abort(), this.timeout);

        try {
            const response = await fetch(url, { method: 'GET', signal: controller.signal });
            clearTimeout(timeoutId);
            if (!response.ok) return false;
            const text = await response.text();
            // Blynk returns literal string "true" or "false"
            return text.trim() === 'true';
        } catch (err) {
            clearTimeout(timeoutId);
            return false;
        }
    }

    /**
     * Test connection to Blynk API (checks if API is reachable)
     */
    async testConnection(authToken) {
        if (!authToken) return false;
        try {
            await this.fetchPin(CONFIG.PINS.TEMPERATURE, authToken);
            return true;
        } catch (error) {
            console.error('Connection test failed:', error);
            return false;
        }
    }
}

// Create singleton instance
const blynkAPI = new BlynkAPI();

/**
 * Export API instance
 */
if (typeof module !== 'undefined' && module.exports) {
    module.exports = { BlynkAPI, blynkAPI };
}
