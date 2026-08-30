/**
 * Calculate distance between two coordinates using Haversine formula.
 * Returns distance in meters.
 */
export function haversineDistance(
    lat1: number,
    lon1: number,
    lat2: number,
    lon2: number
): number {
    const R = 6371000;

    const dLat = toRad(lat2 - lat1);
    const dLon = toRad(lon2 - lon1);

    const a =
        Math.sin(dLat / 2) * Math.sin(dLat / 2) +
        Math.cos(toRad(lat1)) *
        Math.cos(toRad(lat2)) *
        Math.sin(dLon / 2) *
        Math.sin(dLon / 2);

    const c =
        2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));

    return R * c;
}

function toRad(degrees: number): number {
    return (degrees * Math.PI) / 180;
}

// Office location
export const OFFICE_LOCATION = {
    latitude: 40.7128,
    longitude: -74.0060,
    name: "New York Office",
};

export const LOCATION_RADIUS_METERS = 100;

export function isWithinOfficeRadius(
    userLat: number,
    userLon: number
): {
    isWithin: boolean;
    distance: number;
} {
    const distance = haversineDistance(
        OFFICE_LOCATION.latitude,
        OFFICE_LOCATION.longitude,
        userLat,
        userLon
    );

    return {
        isWithin: distance <= LOCATION_RADIUS_METERS,
        distance: Math.round(distance * 100) / 100,
    };
}