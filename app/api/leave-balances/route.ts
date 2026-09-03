import {
  NextRequest,
  NextResponse,
} from "next/server";

import { prisma } from "@/lib/prisma";

import { getSession } from "@/lib/auth";

import { checkPermission } from "@/lib/permissions";

import { getOrCreateLeaveBalance } from "@/lib/leaveBalance";

export async function GET(
  request: NextRequest
) {
  try {
    const session =
      await getSession(request);

    if (!session) {
      return NextResponse.json(
        {
          error:
            "Unauthorized",
        },
        { status: 401 }
      );
    }

    if (
      session.role !==
      "ADMIN"
    ) {
      const allowed =
        (await checkPermission(
          session.sub,
          "Approvals",
          "view"
        )) ||
        (await checkPermission(
          session.sub,
          "Approvals",
          "add"
        )) ||
        (await checkPermission(
          session.sub,
          "Approvals",
          "edit"
        ));

      if (!allowed) {
        return NextResponse.json(
          {
            error:
              "You don't have permission to view leave balances",
          },
          { status: 403 }
        );
      }
    }

    const { searchParams } =
      new URL(request.url);

    /*
     * ADMIN may request another employee's balance.
     *
     * Non-admin users are ALWAYS restricted
     * to their own balance.
     */
    const employeeId =
      session.role ===
        "ADMIN"
        ? searchParams.get(
          "employeeId"
        ) ||
        session.sub
        : session.sub;

    const yearParam =
      searchParams.get(
        "year"
      );

    const year =
      yearParam
        ? Number(yearParam)
        : new Date().getFullYear();

    if (
      !Number.isInteger(
        year
      ) ||
      year < 2000 ||
      year > 2100
    ) {
      return NextResponse.json(
        {
          error:
            "Invalid year",
        },
        { status: 400 }
      );
    }

    const employee =
      await prisma.employee.findUnique(
        {
          where: {
            id: employeeId,
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

    const leaveTypes =
      await prisma.leaveType.findMany({
        orderBy: {
          createdAt: "asc",
        },
      });

    const balances =
      await Promise.all(
        leaveTypes.map(
          (leaveType) =>
            getOrCreateLeaveBalance(
              employeeId,
              leaveType.id,
              year
            )
        )
      );

    const result =
      leaveTypes.map(
        (leaveType, index) => {
          const balance =
            balances[index];

          return {
            leaveTypeId:
              leaveType.id,

            name:
              leaveType.name,

            code:
              leaveType.code,

            allocated:
              balance.allocated,

            used:
              balance.used,

            remaining:
              Math.max(
                balance.allocated -
                balance.used,
                0
              ),
          };
        }
      );

    return NextResponse.json(
      result
    );
  } catch (error) {
    console.error(
      "GET /api/leave-balances error:",
      error
    );

    return NextResponse.json(
      {
        error:
          "Failed to load leave balances",
        details:
          error instanceof Error
            ? error.message
            : "Unknown server error",
      },
      { status: 500 }
    );
  }
}