import { prisma } from "./prisma";

export async function getOrCreateLeaveBalance(
  employeeId: string,
  leaveTypeId: string,
  year: number
) {
  const existing = await prisma.leaveBalance.findUnique({
    where: {
      employeeId_leaveTypeId_year: { employeeId, leaveTypeId, year },
    },
  });
  if (existing) return existing;

  const leaveType = await prisma.leaveType.findUnique({
    where: { id: leaveTypeId },
  });
  if (!leaveType) {
    throw new Error("Leave type not found");
  }

  return prisma.leaveBalance.create({
    data: {
      employeeId,
      leaveTypeId,
      year,
      allocated: leaveType.defaultAnnualQuota,
      used: 0,
    },
  });
}