// import { NextRequest, NextResponse } from "next/server";
// import { prisma } from "@/lib/prisma";
// import { getSession } from "@/lib/auth";

// export async function GET(request: NextRequest) {
//     try {
//         const session = await getSession(request);

//         if (!session) {
//             return NextResponse.json(
//                 { error: "Unauthorized" },
//                 { status: 401 }
//             );
//         }

//         const approvals = await prisma.approval.findMany({
//             where: {
//                 actorId: session.sub,
//                 type: {
//                     in: ["LEAVE", "ATTENDANCE_CORRECTION"],
//                 },
//             },
//             orderBy: {
//                 createdAt: "desc",
//             },
//         });

//         const requests = approvals.map((approval) => {
//             const details = approval.details as
//                 | {
//                     date?: string;
//                     fromDate?: string;
//                     toDate?: string;
//                     reason?: string | null;
//                     leaveTypeId?: string | null;
//                     timeIn?: string | null;
//                     timeOut?: string | null;
//                     status?: string | null;
//                 }
//                 | null;

//             if (approval.type === "ATTENDANCE_CORRECTION") {
//                 return {
//                     id: approval.id,
//                     type: "ATTENDANCE_CORRECTION",
//                     status: approval.status,
//                     date: details?.date ?? null,
//                     fromDate: details?.date ?? null,
//                     toDate: details?.date ?? null,
//                     timeIn: details?.timeIn ?? null,
//                     timeOut: details?.timeOut ?? null,
//                     requestedStatus: details?.status ?? null,
//                     reason: details?.reason ?? null,
//                     createdAt: approval.createdAt,
//                     updatedAt: approval.updatedAt,
//                 };
//             }

//             return {
//                 id: approval.id,
//                 type: "LEAVE",
//                 status: approval.status,
//                 fromDate: details?.fromDate ?? details?.date ?? null,
//                 toDate: details?.toDate ?? details?.date ?? null,
//                 reason: details?.reason ?? null,
//                 leaveTypeId: details?.leaveTypeId ?? null,
//                 createdAt: approval.createdAt,
//                 updatedAt: approval.updatedAt,
//             };
//         });

//         return NextResponse.json(requests);
//     } catch (error) {
//         console.error("GET /api/approvals/leaves/me error:", error);

//         return NextResponse.json(
//             {
//                 error: "Failed to load requests",
//                 details:
//                     error instanceof Error
//                         ? error.message
//                         : "Unknown server error",
//             },
//             { status: 500 }
//         );
//     }
// }
