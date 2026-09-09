import { prisma } from "@/lib/prisma";

/**
 * Represents the weekly off configuration
 * Key: day of week (0-6, where 0 = Sunday)
 * Value: array of week numbers (1-5) that are off
 */
type WeeklyOffConfig = Record<string, number[]>;

/**
 * Represents the new employee-type-based weekly off settings.
 *
 * Example:
 *
 * {
 *   default: {
 *     "0": [1, 2, 3, 4, 5],
 *     "5": [2, 4]
 *   },
 *   employeeTypes: {
 *     "office-type-id": {
 *       "5": [2, 4]
 *     },
 *     "peon-type-id": {
 *       "5": []
 *     }
 *   }
 * }
 */
type WeeklyOffSettings = {
    default: WeeklyOffConfig;
    employeeTypes: Record<string, WeeklyOffConfig>;
};

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
        const dateObj =
            typeof date === "string"
                ? new Date(date)
                : date;

        // Get day of week (0 = Sunday, 6 = Saturday)
        const dayOfWeek = dateObj.getDay();

        // Get week number of month
        const weekOfMonth =
            getWeekNumberOfMonth(dateObj);

        // Check if this day-week combo is marked off
        const dayKey = dayOfWeek.toString();
        const offWeeks =
            weeklyOffConfig[dayKey] || [];

        return offWeeks.includes(weekOfMonth);
    } catch (error) {
        console.error(
            "Error checking weekly off:",
            error
        );

        return false;
    }
}

/**
 * Get the default weekly off configuration.
 *
 * This keeps the existing behavior as the fallback
 * when no employee-type-specific configuration exists.
 */
function getDefaultWeeklyOffConfig(): WeeklyOffConfig {
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

/**
 * Get the current attendance settings.
 *
 * Handles:
 *
 * 1. Old format:
 * {
 *   "0": [1, 2, 3, 4, 5],
 *   ...
 * }
 *
 * 2. New format:
 * {
 *   default: {
 *     "0": [1, 2, 3, 4, 5],
 *     ...
 *   },
 *   employeeTypes: {
 *     "employee-type-id": {
 *       "5": [2, 4]
 *     }
 *   }
 * }
 *
 * @returns Complete weekly off settings
 */
export async function getWeeklyOffSettings(): Promise<WeeklyOffSettings> {
    try {
        const settings =
            await prisma.attendanceSettings.findFirst();

        const defaultConfig =
            getDefaultWeeklyOffConfig();

        if (!settings) {
            return {
                default: defaultConfig,
                employeeTypes: {},
            };
        }

        // Handle new format
        if (
            typeof settings.weeklyOffDays === "object" &&
            !Array.isArray(settings.weeklyOffDays) &&
            settings.weeklyOffDays !== null
        ) {
            const storedSettings =
                settings.weeklyOffDays as Record<
                    string,
                    unknown
                >;

            /*
             * New format:
             *
             * {
             *   default: {...},
             *   employeeTypes: {...}
             * }
             */
            if (
                Object.prototype.hasOwnProperty.call(
                    storedSettings,
                    "default"
                ) ||
                Object.prototype.hasOwnProperty.call(
                    storedSettings,
                    "employeeTypes"
                )
            ) {
                const storedDefault =
                    storedSettings.default;

                const employeeTypes =
                    storedSettings.employeeTypes;

                const parsedDefault =
                    storedDefault &&
                        typeof storedDefault === "object" &&
                        !Array.isArray(storedDefault)
                        ? (storedDefault as WeeklyOffConfig)
                        : defaultConfig;

                const parsedEmployeeTypes: Record<
                    string,
                    WeeklyOffConfig
                > = {};

                if (
                    employeeTypes &&
                    typeof employeeTypes === "object" &&
                    !Array.isArray(employeeTypes)
                ) {
                    for (const [
                        employeeTypeId,
                        config,
                    ] of Object.entries(
                        employeeTypes as Record<
                            string,
                            unknown
                        >
                    )) {
                        if (
                            config &&
                            typeof config === "object" &&
                            !Array.isArray(config)
                        ) {
                            parsedEmployeeTypes[
                                employeeTypeId
                            ] =
                                config as WeeklyOffConfig;
                        }
                    }
                }

                return {
                    default: parsedDefault,
                    employeeTypes:
                        parsedEmployeeTypes,
                };
            }

            /*
             * Old object format:
             *
             * {
             *   "0": [1, 2, 3, 4, 5],
             *   ...
             * }
             *
             * Treat it as the default configuration.
             */
            return {
                default:
                    settings.weeklyOffDays as WeeklyOffConfig,
                employeeTypes: {},
            };
        }

        // Handle old format (Int array)
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

            // Convert old day-based format to all weeks
            for (const day of settings.weeklyOffDays) {
                if (
                    typeof day === "number" &&
                    day >= 0 &&
                    day <= 6
                ) {
                    newFormat[
                        day.toString()
                    ] = [1, 2, 3, 4, 5];
                }
            }

            return {
                default: newFormat,
                employeeTypes: {},
            };
        }

        // Fallback
        return {
            default: defaultConfig,
            employeeTypes: {},
        };
    } catch (error) {
        console.error(
            "Error loading weekly off settings:",
            error
        );

        return {
            default: getDefaultWeeklyOffConfig(),
            employeeTypes: {},
        };
    }
}

/**
 * Get the weekly off configuration applicable to
 * a particular employee type.
 *
 * Employee-type-specific configuration overrides
 * the default configuration.
 *
 * @param employeeTypeId - Optional employee type ID
 */
export async function getWeeklyOffConfigForEmployeeType(
    employeeTypeId?: string | null
): Promise<WeeklyOffConfig> {
    try {
        const settings =
            await getWeeklyOffSettings();

        if (
            employeeTypeId &&
            settings.employeeTypes[
            employeeTypeId
            ]
        ) {
            return settings.employeeTypes[
                employeeTypeId
            ];
        }

        return settings.default;
    } catch (error) {
        console.error(
            "Error getting weekly off configuration for employee type:",
            error
        );

        return getDefaultWeeklyOffConfig();
    }
}

/**
 * Check if a date is off (weekly off or holiday)
 *
 * @param date - Date to check
 * @param employeeTypeId - Optional employee type ID.
 *                         When supplied, both weekly offs
 *                         and holidays are evaluated for
 *                         that employee type.
 *
 * @returns Object with breakdown of why it's off
 */
export async function checkIfDateIsOff(
    date: Date | string,
    employeeTypeId?: string | null
): Promise<{
    isOff: boolean;
    reason?: "WEEKLY_OFF" | "HOLIDAY";
    details?: string;
}> {
    try {
        const dateObj =
            typeof date === "string"
                ? new Date(`${date}T00:00:00`)
                : date;

        if (
            Number.isNaN(
                dateObj.getTime()
            )
        ) {
            return {
                isOff: false,
            };
        }

        /*
         * Get the weekly off configuration
         * applicable to this employee type.
         */
        const weeklyOffConfig =
            await getWeeklyOffConfigForEmployeeType(
                employeeTypeId
            );

        /*
         * Check weekly off first.
         */
        if (
            isWeeklyOff(
                dateObj,
                weeklyOffConfig
            )
        ) {
            const dayName = [
                "Sunday",
                "Monday",
                "Tuesday",
                "Wednesday",
                "Thursday",
                "Friday",
                "Saturday",
            ][dateObj.getDay()];

            const weekNum =
                getWeekNumberOfMonth(
                    dateObj
                );

            const weekLabels = [
                "1st",
                "2nd",
                "3rd",
                "4th",
                "5th",
            ];

            return {
                isOff: true,
                reason: "WEEKLY_OFF",
                details:
                    `${weekLabels[weekNum - 1]} ${dayName}`,
            };
        }

        /*
         * Check holiday using a date range instead
         * of requiring an exact timestamp match.
         *
         * When employeeTypeId is supplied:
         *
         * - A holiday assigned to that employee type applies.
         * - A holiday with no employee-type assignments is a
         *   common/global holiday and also applies.
         *
         * When employeeTypeId is not supplied, the old
         * behavior is preserved and any holiday for the
         * date is considered.
         */
        const startOfDay = new Date(
            dateObj.getFullYear(),
            dateObj.getMonth(),
            dateObj.getDate()
        );

        const endOfDay = new Date(
            dateObj.getFullYear(),
            dateObj.getMonth(),
            dateObj.getDate() + 1
        );

        const holidayRecord =
            await prisma.holiday.findFirst({
                where: {
                    date: {
                        gte: startOfDay,
                        lt: endOfDay,
                    },

                    ...(employeeTypeId
                        ? {
                            OR: [
                                {
                                    employeeTypeAssignments: {
                                        some: {
                                            employeeTypeId,
                                        },
                                    },
                                },
                                {
                                    employeeTypeAssignments: {
                                        none: {},
                                    },
                                },
                            ],
                        }
                        : {}),
                },
            });

        if (holidayRecord) {
            return {
                isOff: true,
                reason: "HOLIDAY",
                details:
                    holidayRecord.name,
            };
        }

        return {
            isOff: false,
        };
    } catch (error) {
        console.error(
            "Error checking if date is off:",
            error
        );

        return {
            isOff: false,
        };
    }
}

/**
 * Get all off dates for a given month.
 * Useful for calendar views.
 *
 * @param year - Year (e.g., 2024)
 * @param month - Month (1-12)
 * @param employeeTypeId - Optional employee type ID.
 *
 * When employeeTypeId is supplied, weekly offs and
 * holidays are calculated specifically for that employee type.
 */
export async function getOffDatesForMonth(
    year: number,
    month: number,
    employeeTypeId?: string | null
): Promise<
    {
        date: Date;
        reason: string;
        details?: string;
    }[]
> {
    const offDates: {
        date: Date;
        reason: string;
        details?: string;
    }[] = [];

    try {
        /*
         * Get weekly off configuration applicable
         * to this employee type.
         */
        const weeklyOffConfig =
            await getWeeklyOffConfigForEmployeeType(
                employeeTypeId
            );

        // Get all holidays in this month
        const monthStart = new Date(
            year,
            month - 1,
            1
        );

        const monthEnd = new Date(
            year,
            month,
            0
        );

        const holidays =
            await prisma.holiday.findMany({
                where: {
                    date: {
                        gte: monthStart,
                        lte: monthEnd,
                    },

                    ...(employeeTypeId
                        ? {
                            OR: [
                                {
                                    employeeTypeAssignments: {
                                        some: {
                                            employeeTypeId,
                                        },
                                    },
                                },
                                {
                                    employeeTypeAssignments: {
                                        none: {},
                                    },
                                },
                            ],
                        }
                        : {}),
                },
            });

        // Check each day of the month
        const daysInMonth =
            new Date(
                year,
                month,
                0
            ).getDate();

        for (
            let day = 1;
            day <= daysInMonth;
            day++
        ) {
            const date = new Date(
                year,
                month - 1,
                day
            );

            // Check weekly off
            if (
                isWeeklyOff(
                    date,
                    weeklyOffConfig
                )
            ) {
                const dayName = [
                    "Sunday",
                    "Monday",
                    "Tuesday",
                    "Wednesday",
                    "Thursday",
                    "Friday",
                    "Saturday",
                ][date.getDay()];

                const weekNum =
                    getWeekNumberOfMonth(
                        date
                    );

                const weekLabels = [
                    "1st",
                    "2nd",
                    "3rd",
                    "4th",
                    "5th",
                ];

                offDates.push({
                    date,
                    reason: "WEEKLY_OFF",
                    details:
                        `${weekLabels[weekNum - 1]} ${dayName}`,
                });
            }

            // Check holidays
            const holiday =
                holidays.find(
                    (h) =>
                        h.date
                            .toISOString()
                            .split("T")[0] ===
                        date
                            .toISOString()
                            .split("T")[0]
                );

            if (holiday) {
                offDates.push({
                    date,
                    reason: "HOLIDAY",
                    details:
                        holiday.name,
                });
            }
        }

        return offDates;
    } catch (error) {
        console.error(
            "Error getting off dates for month:",
            error
        );

        return [];
    }
}