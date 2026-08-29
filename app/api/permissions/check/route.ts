import { NextRequest, NextResponse } from "next/server";
import { getSession } from "@/lib/auth";
import { checkPermission } from "@/lib/permissions";

export async function POST(request: NextRequest) {
    try {
        const session = await getSession();
        if (!session) {
            console.warn("[API] Permission check: No session");
            return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
        }

        const body = await request.json();
        const { moduleName, action = "view" } = body;

        if (!moduleName) {
            return NextResponse.json(
                { error: "Module name is required" },
                { status: 400 }
            );
        }

        const employeeId = (session as any).id ??
            (session as any).employeeId ??
            (session as any).sub;

        if (!employeeId) {
            console.warn("[API] Permission check: No employeeId in session");
            return NextResponse.json({ error: "Invalid session" }, { status: 401 });
        }

        console.log(
            `[API] Checking permission: ${moduleName}.${action} for employee ${employeeId}`
        );

        const hasPermission = await checkPermission(
            employeeId,
            moduleName,
            action
        );

        console.log(
            `[API] Permission result: ${hasPermission}`
        );

        return NextResponse.json({
            hasPermission,
            moduleName,
            action,
            userId: employeeId,
        });
    } catch (error) {
        console.error("[API] Permission check error:", error);
        return NextResponse.json(
            { error: "Internal server error" },
            { status: 500 }
        );
    }
}