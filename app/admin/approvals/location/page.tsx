"use client";

import { useEffect, useState } from "react";
import toast from "react-hot-toast";

interface LocationApproval {
    id: string;
    type: string;
    refId: string;
    status: string;
    details: {
        latitude: number;
        longitude: number;
        distanceFromOffice: number;   // ← renamed
        allowedRadius: number;
        employeeName: string;
        gpsAccuracy: number | null;
        deviceId: string | null;
        ipAddress: string;
        isMockLocation: boolean;
        officeLatitude: number;
        officeLongitude: number;
        timestamp: string;
    };
    createdAt: string;
    actor: {
        fullName: string;
    };
}

export default function LocationApprovalsPage() {
    const [approvals, setApprovals] = useState<LocationApproval[]>([]);
    const [loading, setLoading] = useState(true);
    const [processingId, setProcessingId] = useState<string | null>(null);

    useEffect(() => {
        loadApprovals();
    }, []);

    const loadApprovals = async () => {
        try {
            const res = await fetch("/api/approvals?type=LOCATION_BASED_LOGIN");
            const data = await res.json();
            setApprovals(Array.isArray(data) ? data : []);
        } catch (error) {
            toast.error("Failed to load approvals");
        } finally {
            setLoading(false);
        }
    };

    const handleApprove = async (approvalId: string) => {
        setProcessingId(approvalId);
        try {
            const res = await fetch(`/api/approvals/${approvalId}`, {
                method: "PUT",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({ decision: "APPROVED" }),
            });

            if (!res.ok) throw new Error("Failed to approve");

            toast.success("Approval granted");
            loadApprovals();
        } catch (error) {
            toast.error("Failed to approve");
        } finally {
            setProcessingId(null);
        }
    };

    const handleReject = async (approvalId: string) => {
        setProcessingId(approvalId);
        try {
            const res = await fetch(`/api/approvals/${approvalId}`, {
                method: "PUT",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({ decision: "REJECTED" }),
            });

            if (!res.ok) throw new Error("Failed to reject");

            toast.success("Approval rejected");
            loadApprovals();
        } catch (error) {
            toast.error("Failed to reject");
        } finally {
            setProcessingId(null);
        }
    };

    if (loading) return <div>Loading...</div>;

    const pending = approvals.filter((a) => a.status === "PENDING");
    const processed = approvals.filter((a) => a.status !== "PENDING");

    return (
        <div className="space-y-6">
            <h1 className="text-2xl font-bold">📍 Location-Based Login Approvals</h1>

            {/* Pending Approvals */}
            <div>
                <h2 className="text-lg font-semibold mb-4">
                    Pending ({pending.length})
                </h2>

                {pending.length === 0 ? (
                    <p className="text-slate-600">No pending approvals</p>
                ) : (
                    <div className="space-y-3">
                        {pending.map((approval) => (
                            <div
                                key={approval.id}
                                className="bg-white border border-yellow-200 rounded-lg p-4"
                            >
                                <div className="flex justify-between items-start mb-3">
                                    <div>
                                        <p className="font-semibold text-lg">
                                            {approval.details.employeeName}
                                        </p>
                                        <p className="text-sm text-slate-600">
                                            {new Date(approval.details.timestamp).toLocaleString()}
                                        </p>
                                    </div>
                                    <span className="bg-yellow-100 text-yellow-800 px-3 py-1 rounded text-sm">
                                        ⏳ Pending
                                    </span>
                                </div>

                                <div className="bg-slate-50 p-3 rounded mb-3 text-sm space-y-1">
                                    <p>
                                        📍 <strong>Location:</strong> {approval.details.latitude.toFixed(4)}, {approval.details.longitude.toFixed(4)}
                                    </p>
                                    <p className="text-red-600">
                                        <strong>Distance:</strong> {approval.details.distanceFromOffice.toFixed(1)}m from office (limit: {approval.details.allowedRadius ?? 100}m)
                                    </p>
                                    <p className="text-slate-600 text-xs">
                                        IP: {approval.details.ipAddress} · Accuracy: {approval.details.gpsAccuracy?.toFixed(1) ?? "—"}m
                                    </p>
                                </div>

                                <div className="flex gap-3">
                                    <button
                                        onClick={() => handleApprove(approval.id)}
                                        disabled={processingId === approval.id}
                                        className="flex-1 bg-green-600 hover:bg-green-700 text-white px-4 py-2 rounded disabled:opacity-50"
                                    >
                                        ✅ Approve
                                    </button>
                                    <button
                                        onClick={() => handleReject(approval.id)}
                                        disabled={processingId === approval.id}
                                        className="flex-1 bg-red-600 hover:bg-red-700 text-white px-4 py-2 rounded disabled:opacity-50"
                                    >
                                        ❌ Reject
                                    </button>
                                </div>
                            </div>
                        ))}
                    </div>
                )}
            </div>

            {/* Processed Approvals */}
            <div>
                <h2 className="text-lg font-semibold mb-4">History ({processed.length})</h2>

                {processed.length === 0 ? (
                    <p className="text-slate-600">No processed approvals</p>
                ) : (
                    <div className="space-y-2">
                        {processed.map((approval) => (
                            <div
                                key={approval.id}
                                className={`p-3 rounded border ${approval.status === "APPROVED"
                                    ? "bg-green-50 border-green-200"
                                    : "bg-red-50 border-red-200"
                                    }`}
                            >
                                <div className="flex justify-between items-center text-sm">
                                    <div>
                                        <p className="font-medium">{approval.details.employeeName}</p>
                                        <p className="text-slate-600">
                                            {approval.details.distanceFromOffice.toFixed(1)}m from office
                                        </p>
                                    </div>
                                    <span
                                        className={`px-3 py-1 rounded text-xs font-semibold ${approval.status === "APPROVED"
                                            ? "bg-green-200 text-green-800"
                                            : "bg-red-200 text-red-800"
                                            }`}
                                    >
                                        {approval.status === "APPROVED" ? "✅ Approved" : "❌ Rejected"}
                                    </span>
                                </div>
                            </div>
                        ))}
                    </div>
                )}
            </div>
        </div>
    );
}