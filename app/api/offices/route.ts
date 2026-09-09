import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";

export async function GET() {
    try {
        const offices = await prisma.office.findMany({
            orderBy: {
                name: "asc",
            },
        });

        return NextResponse.json(offices);
    } catch (error) {
        console.error("Failed to fetch offices:", error);

        return NextResponse.json(
            { error: "Failed to fetch offices" },
            { status: 500 }
        );
    }
}