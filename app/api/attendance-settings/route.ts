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
        "0": [1, 2, 3, 4, 5],
        "1": [],
        "2": [],
        "3": [],
        "4": [],
        "5": [],
        "6": []
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

    // Validate new format
    if (typeof weeklyOffDays !== "object" || Array.isArray(weeklyOffDays)) {
      return NextResponse.json(
        {
          error: "weeklyOffDays must be an object with day keys (0-6) mapping to week arrays",
        },
        { status: 400 }
      );
    }

    // Validate structure: each day key should map to array of week numbers
    const validDays = new Set(["0", "1", "2", "3", "4", "5", "6"]);

    for (const [day, weeks] of Object.entries(weeklyOffDays)) {
      if (!validDays.has(day)) {
        return NextResponse.json(
          { error: `Invalid day key: ${day}. Must be 0-6` },
          { status: 400 }
        );
      }

      if (!Array.isArray(weeks)) {
        return NextResponse.json(
          { error: `Day ${day} weeks must be an array` },
          { status: 400 }
        );
      }

      // Validate each week number
      for (const week of weeks) {
        if (typeof week !== "number" || !Number.isInteger(week) || week < 1 || week > 5) {
          return NextResponse.json(
            { error: `Invalid week number: ${week}. Must be 1-5` },
            { status: 400 }
          );
        }
      }
    }

    const existing = await getOrCreateSettings();

    const updated =
      await prisma.attendanceSettings.update({
        where: {
          id: existing.id,
        },
        data: {
          weeklyOffDays,
        },
      });

    await prisma.auditLog.create({
      data: {
        employeeId: auth.session.sub,
        action: "ATTENDANCE_SETTINGS_UPDATED",
        entity: "AttendanceSettings",
        entityId: updated.id,
        metadata: {
          weeklyOffDays,
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