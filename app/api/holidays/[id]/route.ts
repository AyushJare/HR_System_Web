import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { requireAdmin } from "@/lib/auth";

type Params = { id: string };

export async function DELETE(
  request: NextRequest,
  { params }: { params: Promise<Params> }
) {
  const { id } = await params;

  const auth = await requireAdmin();
  if (!auth.ok) {
    return NextResponse.json({ error: auth.error }, { status: auth.status });
  }

  const holiday = await prisma.holiday.findUnique({ where: { id } });
  if (!holiday) {
    return NextResponse.json({ error: "Holiday not found" }, { status: 404 });
  }

  await prisma.auditLog.create({
    data: {
      employeeId: auth.session.sub,
      action: "HOLIDAY_DELETED",
      entity: "Holiday",
      entityId: id,
      metadata: { deletedName: holiday.name },
    },
  });

  await prisma.holiday.delete({ where: { id } });

  return NextResponse.json({ success: true });
}