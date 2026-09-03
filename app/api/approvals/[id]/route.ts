import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { requirePermissionOrAdmin } from "@/lib/auth";
import { checkIfDateIsOff } from "@/lib/attendanceUtils";
import { toDateOnlyUTC } from "@/lib/dateOnly";

type Params = {
  id: string;
};

type LeaveDetails = {
  date?: string;
  reason?: string;
  leaveTypeId?: string;
};

export async function PUT(
  request: NextRequest,
  {
    params,
  }: {
    params: Promise<Params>;
  }
) {
  try {
    const { id } = await params;

    const auth =
      await requirePermissionOrAdmin(
        "Approvals",
        "edit"
      );

    if (!auth.ok) {
      return NextResponse.json(
        { error: auth.error },
        { status: auth.status }
      );
    }

    const body =
      await request.json();

    const decision =
      body?.decision;

    if (
      decision !== "APPROVED" &&
      decision !== "REJECTED"
    ) {
      return NextResponse.json(
        {
          error:
            "decision must be APPROVED or REJECTED",
        },
        { status: 400 }
      );
    }

    const existing =
      await prisma.approval.findUnique({
        where: { id },
      });

    if (!existing) {
      return NextResponse.json(
        {
          error:
            "Approval not found",
        },
        { status: 404 }
      );
    }

    if (
      existing.status !==
      "PENDING"
    ) {
      return NextResponse.json(
        {
          error:
            "This request has already been actioned",
        },
        { status: 409 }
      );
    }

    /*
     * ============================================================
     * LEAVE APPROVAL
     * ============================================================
     */

    if (
      existing.type === "LEAVE" &&
      decision === "APPROVED"
    ) {
      const details =
        existing.details as
        | LeaveDetails
        | null;

      if (!details?.date) {
        return NextResponse.json(
          {
            error:
              "Leave approval is missing the leave date",
          },
          { status: 400 }
        );
      }

      if (!details.leaveTypeId) {
        return NextResponse.json(
          {
            error:
              "Leave approval is missing the leave type",
          },
          { status: 400 }
        );
      }

      if (!existing.actorId) {
        return NextResponse.json(
          {
            error:
              "Leave approval is missing the employee",
          },
          { status: 400 }
        );
      }

      const leaveDate =
        toDateOnlyUTC(
          details.date
        );

      /*
       * Employee validation.
       */
      const employee =
        await prisma.employee.findUnique(
          {
            where: {
              id: existing.actorId,
            },

            select: {
              id: true,
              fullName: true,
              isActive: true,
            },
          }
        );

      if (!employee) {
        return NextResponse.json(
          {
            error:
              "Employee not found",
          },
          { status: 404 }
        );
      }

      if (!employee.isActive) {
        return NextResponse.json(
          {
            error:
              "Employee is inactive",
          },
          { status: 400 }
        );
      }

      /*
       * Leave type validation.
       */
      const leaveType =
        await prisma.leaveType.findUnique(
          {
            where: {
              id: details.leaveTypeId,
            },

            select: {
              id: true,
              name: true,
              defaultAnnualQuota: true,
            },
          }
        );

      if (!leaveType) {
        return NextResponse.json(
          {
            error:
              "Leave type not found",
          },
          { status: 404 }
        );
      }

      /*
       * Leave cannot be approved on a weekly off
       * or holiday.
       */
      const dateOffInfo =
        await checkIfDateIsOff(
          leaveDate
        );

      console.log("LEAVE OFF-DATE DEBUG:", {
        leaveDate,
        dateOffInfo,
      });

      if (dateOffInfo.isOff) {
        return NextResponse.json(
          {
            error:
              "Leave cannot be approved for a weekly off or holiday",
            dateOffInfo,
          },
          { status: 400 }
        );
      }


      const leaveYear =
        Number(
          details.date.substring(
            0,
            4
          )
        );

      /*
       * ==========================================================
       * TRANSACTION
       * ==========================================================
       */

      const result =
        await prisma.$transaction(
          async (tx) => {
            /*
             * Update approval.
             */
            const updatedApproval =
              await tx.approval.update({
                where: {
                  id,
                },

                data: {
                  status:
                    decision,
                  remarks:
                    body?.remarks ??
                    null,
                },

                include: {
                  actor: {
                    select: {
                      fullName: true,
                      employeeCode: true,
                    },
                  },
                },
              });

            /*
             * Check existing attendance.
             */
            const attendance =
              await tx.attendance.findUnique(
                {
                  where: {
                    employeeId_date: {
                      employeeId:
                        existing.actorId!,
                      date:
                        leaveDate,
                    },
                  },

                  select: {
                    id: true,
                    status: true,
                    deletedAt: true,
                  },
                }
              );
            /*
* An employee cannot be placed on leave after attendance
* has already been recorded for that date.
*
* ABSENT is the only exception because it can legitimately
* be converted to ON_LEAVE.
*/
            if (
              attendance &&
              attendance.deletedAt === null &&
              attendance.status !== "ABSENT"
            ) {
              throw new Error(
                "Leave cannot be approved because attendance has already been recorded for this date."
              );
            }

            /*
             * If the employee was automatically marked
             * ABSENT, convert that record to ON_LEAVE.
             */
            if (
              attendance?.status ===
              "ABSENT"
            ) {
              await tx.attendance.update(
                {
                  where: {
                    id:
                      attendance.id,
                  },

                  data: {
                    status:
                      "ON_LEAVE",

                    reason:
                      details.reason ||
                      `Approved leave: ${leaveType.name}`,

                    modifiedBy:
                      auth.session.sub,

                    deletedAt:
                      null,
                  },
                }
              );
            }

            /*
             * If there is no attendance record,
             * create ON_LEAVE.
             */
            if (!attendance) {
              await tx.attendance.create(
                {
                  data: {
                    employeeId:
                      existing.actorId!,

                    date:
                      leaveDate,

                    /*
                     * Attendance.checkInTime is required.
                     * Midnight is the neutral value for leave.
                     */
                    checkInTime:
                      new Date(
                        `${details.date}T00:00:00+05:30`
                      ),

                    checkOutTime:
                      null,

                    status:
                      "ON_LEAVE",

                    reason:
                      details.reason ||
                      `Approved leave: ${leaveType.name}`,

                    modifiedBy:
                      auth.session.sub,
                  },
                }
              );
            }
            /*
             * ======================================================
             * LEAVE BALANCE
             * ======================================================
             */

            const existingBalance =
              await tx.leaveBalance.findUnique(
                {
                  where: {
                    employeeId_leaveTypeId_year:
                    {
                      employeeId:
                        existing.actorId!,
                      leaveTypeId:
                        details.leaveTypeId!,
                      year:
                        leaveYear,
                    },
                  },
                }
              );
            if (
              existingBalance &&
              existingBalance.used >= existingBalance.allocated
            ) {
              throw new Error(
                "Insufficient leave balance. The employee has no remaining leave days for this leave type."
              );
            }

            if (
              existingBalance
            ) {
              await tx.leaveBalance.update(
                {
                  where: {
                    id:
                      existingBalance.id,
                  },

                  data: {
                    used: {
                      increment: 1,
                    },
                  },
                }
              );
            } else {
              await tx.leaveBalance.create(
                {
                  data: {
                    employeeId:
                      existing.actorId!,

                    leaveTypeId:
                      details.leaveTypeId!,

                    year:
                      leaveYear,

                    allocated:
                      leaveType.defaultAnnualQuota,

                    used: 1,
                  },
                }
              );
            }

            /*
             * Dedicated leave approval audit.
             */
            await tx.auditLog.create({
              data: {
                employeeId:
                  auth.session.sub,

                action:
                  "LEAVE_APPROVED",

                entity:
                  "Approval",

                entityId:
                  updatedApproval.id,

                metadata: {
                  employeeId:
                    existing.actorId,

                  employeeName:
                    employee.fullName,

                  leaveTypeId:
                    leaveType.id,

                  leaveTypeName:
                    leaveType.name,

                  date:
                    details.date,

                  reason:
                    details.reason ??
                    null,

                  approvedBy:
                    auth.session.sub,

                  message:
                    `${employee.fullName}'s ${leaveType.name} leave for ${details.date} was approved`,
                },
              },
            });

            return updatedApproval;
          }
        );

      /*
       * Standard approval audit.
       */
      await prisma.auditLog.create({
        data: {
          employeeId:
            auth.session.sub,

          action:
            "APPROVAL_APPROVED",

          entity:
            "Approval",

          entityId:
            id,

          metadata: {
            type:
              result.type,

            refId:
              result.refId,

            remarks:
              body?.remarks ??
              null,
          },
        },
      });

      return NextResponse.json(
        result
      );
    }

    /*
     * ============================================================
     * NORMAL APPROVAL / REJECTION
     * ============================================================
     */

    const updated =
      await prisma.approval.update({
        where: {
          id,
        },

        data: {
          status:
            decision,

          remarks:
            body?.remarks ??
            null,
        },

        include: {
          actor: {
            select: {
              fullName: true,
              employeeCode: true,
            },
          },
        },
      });

    /*
     * Location-based login approval.
     */
    if (
      updated.type ===
      "LOCATION_BASED_LOGIN" &&
      decision ===
      "APPROVED"
    ) {
      await prisma.auditLog.create({
        data: {
          employeeId:
            updated.refId,

          action:
            "LOCATION_LOGIN_APPROVED",

          entity:
            "Approval",

          entityId:
            updated.id,

          metadata: {
            details:
              updated.details,

            approvedBy:
              auth.session.sub,
          },
        },
      });
    }

    /*
     * Standard approval audit.
     */
    await prisma.auditLog.create({
      data: {
        employeeId:
          auth.session.sub,

        action:
          decision ===
            "APPROVED"
            ? "APPROVAL_APPROVED"
            : "APPROVAL_REJECTED",

        entity:
          "Approval",

        entityId:
          id,

        metadata: {
          type:
            updated.type,

          refId:
            updated.refId,

          remarks:
            body?.remarks ??
            null,
        },
      },
    });

    return NextResponse.json(
      updated
    );
  } catch (error) {
    console.error(
      "PUT /api/approvals/[id] error:",
      error
    );

    const errorMessage =
      error instanceof Error
        ? error.message
        : "Unknown error";

    if (
      errorMessage ===
      "Leave cannot be approved because attendance has already been recorded for this date."
    ) {
      return NextResponse.json(
        {
          error: errorMessage,
        },
        { status: 409 }
      );
    }

    return NextResponse.json(
      {
        error: "Failed to update approval",
        details: errorMessage,
      },
      { status: 500 }
    );
  }
}
/*
* ============================================================
* GET APPROVAL
* ============================================================
*/

export async function GET(
  request: NextRequest,
  {
    params,
  }: {
    params: Promise<Params>;
  }
) {
  try {
    const { id } = await params;

    const auth =
      await requirePermissionOrAdmin(
        "Approvals",
        "view"
      );

    if (!auth.ok) {
      return NextResponse.json(
        { error: auth.error },
        { status: auth.status }
      );
    }

    const approval =
      await prisma.approval.findUnique({
        where: {
          id,
        },

        include: {
          actor: {
            select: {
              fullName: true,
              employeeCode: true,
            },
          },
        },
      });

    if (!approval) {
      return NextResponse.json(
        {
          error: "Approval not found",
        },
        { status: 404 }
      );
    }

    return NextResponse.json(approval);
  } catch (error) {
    console.error(
      "GET /api/approvals/[id] error:",
      error
    );

    return NextResponse.json(
      {
        error: "Failed to load approval",
      },
      { status: 500 }
    );
  }
}