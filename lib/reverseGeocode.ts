export async function reverseGeocode(
    latitude: number,
    longitude: number
): Promise<string | null> {
    try {
        const response = await fetch(
            `https://nominatim.openstreetmap.org/reverse?format=jsonv2&lat=${latitude}&lon=${longitude}&zoom=18&addressdetails=1`,
            {
                headers: {
                    "User-Agent": "VMC-HR-System/1.0",
                },
                cache: "no-store",
            }
        );

        if (!response.ok) {
            return null;
        }

        const data = await response.json();
        const address = data?.address;

        if (!address) {
            return data?.display_name ?? null;
        }

        // Most specific location details first
        const parts = [
            address.house_number,
            address.road,
            address.neighbourhood,
            address.suburb,
            address.city_district,
            address.city ||
            address.town ||
            address.municipality ||
            address.village,
            address.state,
            address.postcode,
        ]
            .filter(Boolean)
            .filter(
                (value, index, array) =>
                    array.indexOf(value) === index
            );

        return parts.length > 0
            ? parts.join(", ")
            : data?.display_name ?? null;
    } catch (error) {
        console.error("Reverse geocoding failed:", error);
        return null;
    }
}