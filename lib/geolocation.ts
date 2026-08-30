export interface GeolocationData {
    latitude: number;
    longitude: number;
    accuracy: number; // GPS accuracy in meters
    timestamp: number;
}

export interface GeolocationError {
    code: number;
    message: string;
}

/**
 * Request user's current location using browser Geolocation API
 */
export function requestGeolocation(): Promise<GeolocationData> {
    return new Promise((resolve, reject) => {
        if (!navigator.geolocation) {
            reject({
                code: 0,
                message: "Geolocation not supported on this device",
            });
            return;
        }

        navigator.geolocation.getCurrentPosition(
            (position) => {
                resolve({
                    latitude: position.coords.latitude,
                    longitude: position.coords.longitude,
                    accuracy: position.coords.accuracy,
                    timestamp: position.timestamp,
                });
            },
            (error) => {
                reject({
                    code: error.code,
                    message: getGeolocationErrorMessage(error.code),
                });
            },
            {
                enableHighAccuracy: true,
                timeout: 10000,
                maximumAge: 0,
            }
        );
    });
}

/**
 * Get device ID (simple implementation)
 */
export function getDeviceId(): string {
    // In real app, use library like fingerprinting
    return `device-${navigator.userAgent.substring(0, 50)}`;
}

/**
 * Get user's IP address from API
 */
export async function getIpAddress(): Promise<string> {
    try {
        const response = await fetch("https://api.ipify.org?format=json");
        const data = await response.json();
        return data.ip;
    } catch {
        return "unknown";
    }
}

/**
 * Detect if location is spoofed (mock location)
 * Simple check: accuracy > 100m is suspicious
 */
/**
 * Detect if location is spoofed (mock location)
 * Only flag if accuracy is suspiciously perfect (< 5m) or completely absent (> 5000m)
 */
export function isMockLocation(accuracy: number): boolean {
    return accuracy < 5; // Only flag unrealistically perfect GPS (< 5m)
}

function getGeolocationErrorMessage(code: number): string {
    switch (code) {
        case 1:
            return "Location permission denied";
        case 2:
            return "Location unavailable";
        case 3:
            return "Location request timeout";
        default:
            return "Unknown location error";
    }
}