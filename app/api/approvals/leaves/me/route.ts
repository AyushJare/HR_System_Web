import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { getSession } from "@/lib/auth";

export async function GET(request: NextRequest) {
    try {
        const session = await getSession(request);

        if (!session) {
            return NextResponse.json(
                { error: "Unauthorized" },
                { status: 401 }
            );
        }

        const approvals = await prisma.approval.findMany({
            where: {
                type: "LEAVE",
                actorId: session.sub,
            },
            orderBy: {
                createdAt: "desc",
            },
        });

        const requests = approvals.map((approval) => {
            const details = approval.details as
                {
                    date?: string;
                    fromDate?: string;
                    toDate?: string;
                    reason?: string | null;
                    leaveTypeId?: string | null;
                } | null;

            return {
                id: approval.id,
                type: "LEAVE",
                status: approval.status,
                fromDate: details?.fromDate ?? details?.date ?? null,
                toDate: details?.toDate ?? details?.date ?? null,
                reason: details?.reason ?? null,
                leaveTypeId: details?.leaveTypeId ?? null,
                createdAt: approval.createdAt,
                updatedAt: approval.updatedAt,
            };
        });

        return NextResponse.json(requests);
    } catch (error) {
        console.error(
            "GET /api/approvals/leaves/me error:",
            error
        );

        return NextResponse.json(
            {
                error: "Failed to load leave requests",
                details:
                    error instanceof Error
                        ? error.message
                        : "Unknown server error",
            },
            { status: 500 }
        );
    }
}