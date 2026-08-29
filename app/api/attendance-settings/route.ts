
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
      weeklyOffDays: [0],
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

    if (
      !Array.isArray(weeklyOffDays) ||
      weeklyOffDays.some(
        (d: unknown) =>
          typeof d !== "number" ||
          !Number.isInteger(d) ||
          d < 0 ||
          d > 6
      )
    ) {
      return NextResponse.json(
        {
          error:
            "weeklyOffDays must be an array of numbers 0-6",
        },
        { status: 400 }
      );
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

