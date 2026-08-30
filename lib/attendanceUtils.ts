import { prisma } from "@/lib/prisma";

/**
 * Represents the weekly off configuration
 * Key: day of week (0-6, where 0 = Sunday)
 * Value: array of week numbers (1-5) that are off
 */
type WeeklyOffConfig = Record<string, number[]>;

/**
 * Get the week number of a date within its month
 * Week 1: 1-7, Week 2: 8-14, Week 3: 15-21, Week 4: 22-28, Week 5: 29-31
 *
 * @param date - The date to check
 * @returns Week number (1-5)
 */
export function getWeekNumberOfMonth(date: Date): number {
    const dayOfMonth = date.getDate();

    if (dayOfMonth <= 7) return 1;
    if (dayOfMonth <= 14) return 2;
    if (dayOfMonth <= 21) return 3;
    if (dayOfMonth <= 28) return 4;
    return 5;
}

/**
 * Check if a specific date is marked as weekly off
 *
 * @param date - The date to check (Date object or string YYYY-MM-DD)
 * @param weeklyOffConfig - The weekly off configuration
 * @returns true if the date is a weekly off day
 *
 * @example
 * const config = {
 *   "0": [1, 2, 3, 4, 5],  // Every Sunday is off
 *   "6": [2, 4]             // 2nd and 4th Saturday are off
 * }
 * const isOff = isWeeklyOff(new Date("2024-09-14"), config);
 */
export function isWeeklyOff(
    date: Date | string,
    weeklyOffConfig: WeeklyOffConfig
): boolean {
    try {
        // Convert string to Date if needed
        const dateObj = typeof date === "string" ? new Date(date) : date;

        // Get day of week (0 = Sunday, 6 = Saturday)
        const dayOfWeek = dateObj.getDay();

        // Get week number of month
        const weekOfMonth = getWeekNumberOfMonth(dateObj);

        // Check if this day-week combo is marked off
        const dayKey = dayOfWeek.toString();
        const offWeeks = weeklyOffConfig[dayKey] || [];

        return offWeeks.includes(weekOfMonth);
    } catch (error) {
        console.error("Error checking weekly off:", error);
        return false;
    }
}

/**
 * Get the current attendance settings
 * Handles both old (Int[] array) and new (Json object) formats
 *
 * @returns Weekly off configuration
 */
export async function getWeeklyOffSettings(): Promise<WeeklyOffConfig> {
    try {
        const settings = await prisma.attendanceSettings.findFirst();

        if (!settings) {
            // Default: Sunday off
            return {
                "0": [1, 2, 3, 4, 5],
                "1": [],
                "2": [],
                "3": [],
                "4": [],
                "5": [],
                "6": [],
            };
        }

        // Handle new format (Json object)
        if (
            typeof settings.weeklyOffDays === "object" &&
            !Array.isArray(settings.weeklyOffDays)
        ) {
            return settings.weeklyOffDays as WeeklyOffConfig;
        }

        // Handle old format (Int array) - convert to new format
        if (Array.isArray(settings.weeklyOffDays)) {
            const newFormat: WeeklyOffConfig = {
                "0": [],
                "1": [],
                "2": [],
                "3": [],
                "4": [],
                "5": [],
                "6": [],
            };

            // ✅ FIX: Type day as string properly
            for (const day of settings.weeklyOffDays) {
                if (typeof day === "number" && day >= 0 && day <= 6) {
                    newFormat[day.toString()] = [1, 2, 3, 4, 5];
                }
            }

            return newFormat;
        }

        // Fallback
        return {
            "0": [1, 2, 3, 4, 5],
            "1": [],
            "2": [],
            "3": [],
            "4": [],
            "5": [],
            "6": [],
        };
    } catch (error) {
        console.error("Error loading weekly off settings:", error);

        return {
            "0": [1, 2, 3, 4, 5],
            "1": [],
            "2": [],
            "3": [],
            "4": [],
            "5": [],
            "6": [],
        };
    }
}

/**
 * Check if a date is off (weekly off or holiday)
 *
 * @param date - Date to check
 * @returns Object with breakdown of why it's off
 */
export async function checkIfDateIsOff(date: Date | string): Promise<{
    isOff: boolean;
    reason?: "WEEKLY_OFF" | "HOLIDAY";
    details?: string;
}> {
    try {
        const dateObj = typeof date === "string" ? new Date(date) : date;

        // Get weekly off settings
        const weeklyOffConfig = await getWeeklyOffSettings();

        // Check if it's a weekly off day
        if (isWeeklyOff(dateObj, weeklyOffConfig)) {
            const dayName = [
                "Sunday",
                "Monday",
                "Tuesday",
                "Wednesday",
                "Thursday",
                "Friday",
                "Saturday",
            ][dateObj.getDay()];

            const weekNum = getWeekNumberOfMonth(dateObj);
            const weekLabels = ["1st", "2nd", "3rd", "4th", "5th"];

            return {
                isOff: true,
                reason: "WEEKLY_OFF",
                details: `${weekLabels[weekNum - 1]} ${dayName}`,
            };
        }

        // ✅ FIX: Check holidays properly by date range
        const dateOnly = new Date(dateObj.getFullYear(), dateObj.getMonth(), dateObj.getDate());

        const holidayRecord = await prisma.holiday.findFirst({
            where: {
                date: dateOnly,
            },
        });

        if (holidayRecord) {
            return {
                isOff: true,
                reason: "HOLIDAY",
                details: holidayRecord.name,
            };
        }

        return {
            isOff: false,
        };
    } catch (error) {
        console.error("Error checking if date is off:", error);
        return {
            isOff: false,
        };
    }
}

/**
 * Get all off dates for a given month
 * Useful for calendar views
 *
 * @param year - Year (e.g., 2024)
 * @param month - Month (1-12)
 * @returns Array of dates that are off
 */
export async function getOffDatesForMonth(
    year: number,
    month: number
): Promise<{ date: Date; reason: string; details?: string }[]> {
    const offDates: { date: Date; reason: string; details?: string }[] = [];

    try {
        const weeklyOffConfig = await getWeeklyOffSettings();

        // Get all holidays in this month
        const monthStart = new Date(year, month - 1, 1);
        const monthEnd = new Date(year, month, 0);

        const holidays = await prisma.holiday.findMany({
            where: {
                date: {
                    gte: monthStart,
                    lte: monthEnd,
                },
            },
        });

        // Check each day of the month
        const daysInMonth = new Date(year, month, 0).getDate();

        for (let day = 1; day <= daysInMonth; day++) {
            const date = new Date(year, month - 1, day);

            // Check weekly off
            if (isWeeklyOff(date, weeklyOffConfig)) {
                const dayName = [
                    "Sunday",
                    "Monday",
                    "Tuesday",
                    "Wednesday",
                    "Thursday",
                    "Friday",
                    "Saturday",
                ][date.getDay()];

                const weekNum = getWeekNumberOfMonth(date);
                const weekLabels = ["1st", "2nd", "3rd", "4th", "5th"];

                offDates.push({
                    date,
                    reason: "WEEKLY_OFF",
                    details: `${weekLabels[weekNum - 1]} ${dayName}`,
                });
            }

            // Check holidays
            const holiday = holidays.find(
                (h) =>
                    h.date.toISOString().split("T")[0] ===
                    date.toISOString().split("T")[0]
            );

            if (holiday) {
                offDates.push({
                    date,
                    reason: "HOLIDAY",
                    details: holiday.name,
                });
            }
        }

        return offDates;
    } catch (error) {
        console.error("Error getting off dates for month:", error);
        return [];
    }
}