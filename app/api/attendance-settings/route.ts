import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { requireAdmin } from "@/lib/auth";

async function getOrCreateSettings() {
  const existing = await prisma.attendanceSettings.findFirst();
  if (existing) return existing;
  return prisma.attendanceSettings.create({ data: { weeklyOffDays: [0] } });
}

export async function GET() {
  const auth = await requireAdmin();
  if (!auth.ok) {
    return NextResponse.json({ error: auth.error }, { status: auth.status });
  }

  const settings = await getOrCreateSettings();
  return NextResponse.json(settings);
}

export async function PUT(request: Request) {
  const auth = await requireAdmin();
  if (!auth.ok) {
    return NextResponse.json({ error: auth.error }, { status: auth.status });
  }

  const body = await request.json();
  const { weeklyOffDays } = body;

  if (!Array.isArray(weeklyOffDays) || weeklyOffDays.some((d: unknown) => typeof d !== "number" || d < 0 || d > 6)) {
    return NextResponse.json(
      { error: "weeklyOffDays must be an array of numbers 0-6" },
      { status: 400 }
    );
  }

  const existing = await getOrCreateSettings();
  const updated = await prisma.attendanceSettings.update({
    where: { id: existing.id },
    data: { weeklyOffDays },
  });

  await prisma.auditLog.create({
    data: {
      employeeId: auth.session.sub,
      action: "ATTENDANCE_SETTINGS_UPDATED",
      entity: "AttendanceSettings",
      entityId: updated.id,
      metadata: { weeklyOffDays },
    },
  });

  return NextResponse.json(updated);
}