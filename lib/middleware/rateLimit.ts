import { NextRequest, NextResponse } from "next/server";

const rateLimitMap = new Map<string, { count: number; resetTime: number }>();

export const rateLimit = (
    maxRequests: number = 30,
    windowMs: number = 60000 // 1 minute
) => {
    return async (req: NextRequest) => {
        const ip = req.headers.get("x-forwarded-for") || "unknown";
        const now = Date.now();

        const record = rateLimitMap.get(ip);

        if (record && now < record.resetTime) {
            if (record.count >= maxRequests) {
                return NextResponse.json(
                    { error: "Too many requests. Try again later." },
                    { status: 429 }
                );
            }
            record.count++;
        } else {
            rateLimitMap.set(ip, { count: 1, resetTime: now + windowMs });
        }

        return NextResponse.next();
    };
};