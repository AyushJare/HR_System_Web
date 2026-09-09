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
// Kept as the fallback location so existing location checks
// continue to work until the login flow uses the employee's
// assigned office from the database.
export const OFFICE_LOCATION = {
    latitude: 40.7128,
    longitude: -74.0060,
    name: "New York Office",
    radiusMeters: 100,
};

export const LOCATION_RADIUS_METERS = 100;

export type OfficeLocation = {
    latitude: number;
    longitude: number;
    name?: string;
    radiusMeters?: number;
};

export function isWithinOfficeRadius(
    userLat: number,
    userLon: number,
    office: OfficeLocation = OFFICE_LOCATION
): {
    isWithin: boolean;
    distance: number;
} {
    const distance = haversineDistance(
        office.latitude,
        office.longitude,
        userLat,
        userLon
    );

    const radius = office.radiusMeters ?? LOCATION_RADIUS_METERS;

    return {
        isWithin: distance <= radius,
        distance: Math.round(distance * 100) / 100,
    };
}