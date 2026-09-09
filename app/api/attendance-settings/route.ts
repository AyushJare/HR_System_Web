import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { getSession } from "@/lib/auth";
import { checkPermission } from "@/lib/permissions";

async function getOrCreateSettings() {
  const existing =
    await prisma.attendanceSettings.findFirst();

  if (existing) {
    return existing;
  }

  return prisma.attendanceSettings.create({
    data: {
      weeklyOffDays: {
        default: {
          "0": [1, 2, 3, 4, 5],
          "1": [],
          "2": [],
          "3": [],
          "4": [],
          "5": [],
          "6": [],
        },
        employeeTypes: {},
      },
    },
  });
}

async function requireMastersPermission(
  action: "view" | "edit"
) {
  const session = await getSession();

  if (!session) {
    return {
      ok: false as const,
      response: NextResponse.json(
        { error: "Not authenticated" },
        { status: 401 }
      ),
    };
  }

  // ADMIN always has full access.
  if (session.role === "ADMIN") {
    return {
      ok: true as const,
      session,
    };
  }

  const allowed = await checkPermission(
    session.sub,
    "Weekly Off",
    action
  );

  if (!allowed) {
    return {
      ok: false as const,
      response: NextResponse.json(
        {
          error: `You don't have permission to ${action} attendance settings`,
        },
        { status: 403 }
      ),
    };
  }

  return {
    ok: true as const,
    session,
  };
}

export async function GET() {
  try {
    const auth = await requireMastersPermission("view");

    if (!auth.ok) {
      return auth.response;
    }

    const settings = await getOrCreateSettings();

    return NextResponse.json(settings);
  } catch (error) {
    console.error(
      "GET /api/attendance-settings error:",
      error
    );

    return NextResponse.json(
      { error: "Failed to load attendance settings" },
      { status: 500 }
    );
  }
}

export async function PUT(request: Request) {
  try {
    const auth = await requireMastersPermission("edit");

    if (!auth.ok) {
      return auth.response;
    }

    const body = await request.json();

    const { weeklyOffDays } = body;

    // weeklyOffDays must be an object.
    if (
      typeof weeklyOffDays !== "object" ||
      weeklyOffDays === null ||
      Array.isArray(weeklyOffDays)
    ) {
      return NextResponse.json(
        {
          error: "weeklyOffDays must be an object",
        },
        { status: 400 }
      );
    }

    const validDays = new Set([
      "0",
      "1",
      "2",
      "3",
      "4",
      "5",
      "6",
    ]);

    // Validate a single weekly-off configuration.
    // A configuration contains day keys (0-6), each mapping
    // to week numbers 1-5.
    const validateWeeklyOffConfig = (
      config: unknown,
      configName: string
    ) => {
      if (
        typeof config !== "object" ||
        config === null ||
        Array.isArray(config)
      ) {
        return `Configuration "${configName}" must be an object with day keys (0-6) mapping to week arrays`;
      }

      for (const [day, weeks] of Object.entries(config)) {
        if (!validDays.has(day)) {
          return `Invalid day key "${day}" in configuration "${configName}". Must be 0-6`;
        }

        if (!Array.isArray(weeks)) {
          return `Day ${day} in configuration "${configName}" must be an array`;
        }

        // Validate each week number.
        for (const week of weeks) {
          if (
            typeof week !== "number" ||
            !Number.isInteger(week) ||
            week < 1 ||
            week > 5
          ) {
            return `Invalid week number: ${week} in configuration "${configName}". Must be 1-5`;
          }
        }
      }

      return null;
    };

    /*
     * Backwards compatibility:
     *
     * Old format:
     * {
     *   "0": [1, 2, 3, 4, 5],
     *   "1": [],
     *   ...
     * }
     *
     * Keep accepting this format.
     */
    const hasNewFormat =
      Object.prototype.hasOwnProperty.call(
        weeklyOffDays,
        "default"
      ) ||
      Object.prototype.hasOwnProperty.call(
        weeklyOffDays,
        "employeeTypes"
      );

    if (!hasNewFormat) {
      const oldFormatError = validateWeeklyOffConfig(
        weeklyOffDays,
        "default"
      );

      if (oldFormatError) {
        return NextResponse.json(
          { error: oldFormatError },
          { status: 400 }
        );
      }
    } else {
      // New format:
      //
      // {
      //   default: {
      //     "0": [...],
      //     ...
      //   },
      //   employeeTypes: {
      //     "employee-type-id": {
      //       "5": [2, 4]
      //     }
      //   }
      // }

      if (
        weeklyOffDays.default === undefined ||
        weeklyOffDays.default === null
      ) {
        return NextResponse.json(
          {
            error:
              'New weeklyOffDays format requires a "default" configuration',
          },
          { status: 400 }
        );
      }

      const defaultError = validateWeeklyOffConfig(
        weeklyOffDays.default,
        "default"
      );

      if (defaultError) {
        return NextResponse.json(
          { error: defaultError },
          { status: 400 }
        );
      }

      // Employee-type-specific configurations are optional.
      if (weeklyOffDays.employeeTypes !== undefined) {
        if (
          typeof weeklyOffDays.employeeTypes !== "object" ||
          weeklyOffDays.employeeTypes === null ||
          Array.isArray(weeklyOffDays.employeeTypes)
        ) {
          return NextResponse.json(
            {
              error:
                '"employeeTypes" must be an object containing employee type IDs',
            },
            { status: 400 }
          );
        }

        for (const [
          employeeTypeId,
          employeeTypeConfig,
        ] of Object.entries(
          weeklyOffDays.employeeTypes
        )) {
          if (!employeeTypeId.trim()) {
            return NextResponse.json(
              {
                error:
                  "Employee type configuration contains an invalid employee type ID",
              },
              { status: 400 }
            );
          }

          const employeeTypeError =
            validateWeeklyOffConfig(
              employeeTypeConfig,
              `employeeTypes.${employeeTypeId}`
            );

          if (employeeTypeError) {
            return NextResponse.json(
              { error: employeeTypeError },
              { status: 400 }
            );
          }
        }
      }
    }

    const existing = await getOrCreateSettings();

    /*
     * If the old format was sent, keep it exactly as the old
     * format so existing data remains compatible.
     *
     * If the new format was sent, save default + employeeTypes.
     */
    const dataToSave = hasNewFormat
      ? {
        default: weeklyOffDays.default,
        employeeTypes:
          weeklyOffDays.employeeTypes || {},
      }
      : weeklyOffDays;

    const updated =
      await prisma.attendanceSettings.update({
        where: {
          id: existing.id,
        },
        data: {
          weeklyOffDays: dataToSave,
        },
      });

    await prisma.auditLog.create({
      data: {
        employeeId: auth.session.sub,
        action: "ATTENDANCE_SETTINGS_UPDATED",
        entity: "AttendanceSettings",
        entityId: updated.id,
        metadata: {
          weeklyOffDays: dataToSave,
        },
      },
    });

    return NextResponse.json(updated);
  } catch (error) {
    console.error(
      "PUT /api/attendance-settings error:",
      error
    );

    return NextResponse.json(
      { error: "Failed to update attendance settings" },
      { status: 500 }
    );
  }
}