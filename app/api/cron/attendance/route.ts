import {
    NextRequest,
    NextResponse,
} from "next/server";

import {
    finalizeAttendanceForDate,
    getPreviousIndiaDateString,
} from "@/lib/attendanceAutomation";

export async function GET(
    request: NextRequest
) {
    try {
        const secret =
            process.env.CRON_SECRET;

        if (!secret) {
            console.error(
                "CRON_SECRET is not configured"
            );

            return NextResponse.json(
                {
                    error:
                        "CRON_SECRET is not configured",
                },
                { status: 500 }
            );
        }

        const authorization =
            request.headers.get(
                "authorization"
            );

        const headerSecret =
            request.headers.get(
                "x-cron-secret"
            );

        const providedSecret =
            authorization?.startsWith(
                "Bearer "
            )
                ? authorization
                    .substring(7)
                    .trim()
                : headerSecret;

        if (
            !providedSecret ||
            providedSecret !==
            secret
        ) {
            return NextResponse.json(
                {
                    error:
                        "Unauthorized",
                },
                { status: 401 }
            );
        }

        /*
         * Allows manually specifying a date:
         *
         * /api/cron/attendance?date=2026-09-01
         *
         * Otherwise it finalizes yesterday in India.
         */
        const date =
            request.nextUrl.searchParams.get(
                "date"
            ) ||
            getPreviousIndiaDateString();

        const result =
            await finalizeAttendanceForDate(
                date
            );

        return NextResponse.json({
            success: true,
            ...result,
        });
    } catch (error) {
        console.error(
            "Attendance cron error:",
            error
        );

        return NextResponse.json(
            {
                error:
                    "Failed to finalize attendance",
                details:
                    error instanceof Error
                        ? error.message
                        : "Unknown server error",
            },
            { status: 500 }
        );
    }
}