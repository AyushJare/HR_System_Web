import "dotenv/config";
import { prisma } from "../lib/prisma";

/**
 * Migration script to convert old weeklyOffDays format to new format
 * Old: Int[] e.g., [0, 6]
 * New: Json e.g., {"0": [1,2,3,4,5], "1": [], ..., "6": [2,4]}
 */
/**
 * Migration script to convert old weeklyOffDays format to new format
 * Old: Int[] e.g., [0, 6]
 * New: Json e.g., {"0": [1,2,3,4,5], "1": [], ..., "6": [2,4]}
 */
async function migrateWeeklyOff() {
    try {
        const settings = await prisma.attendanceSettings.findFirst();

        if (!settings) {
            console.log("No attendance settings found, creating new...");
            await prisma.attendanceSettings.create({
                data: {
                    weeklyOffDays: {
                        "0": [1, 2, 3, 4, 5],  // Sunday all weeks
                        "1": [],
                        "2": [],
                        "3": [],
                        "4": [],
                        "5": [],
                        "6": [2, 4]  // Saturday 2nd and 4th
                    }
                }
            });
            return;
        }

        // If already in new format, skip
        if (typeof settings.weeklyOffDays === "object" && !Array.isArray(settings.weeklyOffDays)) {
            console.log("Already migrated!");
            return;
        }

        // Convert old format to new format
        const oldDays = settings.weeklyOffDays as number[];
        const newFormat: Record<string, number[]> = {
            "0": [],
            "1": [],
            "2": [],
            "3": [],
            "4": [],
            "5": [],
            "6": []
        };

        // If a day was marked off in old system, mark ALL weeks off
        for (const dayNum of oldDays) {
            newFormat[dayNum.toString()] = [1, 2, 3, 4, 5];
        }

        await prisma.attendanceSettings.update({
            where: { id: settings.id },
            data: {
                weeklyOffDays: newFormat
            }
        });

        console.log("✅ Migration complete!");
        console.log("Old format:", oldDays);
        console.log("New format:", newFormat);
    } catch (error) {
        console.error("Migration failed:", error);
    } finally {
        await prisma.$disconnect();
    }
}

migrateWeeklyOff();