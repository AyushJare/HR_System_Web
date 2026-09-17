"use client";

import { useCallback, useEffect, useRef, useState } from "react";

interface UploadError {
    row?: number;
    field?: string;
    message: string;
}

interface UploadResult {
    success: number;
    failed: number;
    errors?: UploadError[];
    createdEmployees?: Array<{
        id: string;
        email: string;
        temporaryPassword: string;
    }>;
}

export default function BulkUploadPage() {
    const [file, setFile] = useState<File | null>(null);
    const [loading, setLoading] = useState(false);
    const [result, setResult] = useState<UploadResult | null>(null);
    const [errors, setErrors] = useState<UploadError[]>([]);
    const [fatalError, setFatalError] = useState<string | null>(null);

    // Single-flight guard.
    //
    // `loading` cannot be used for this: state updates are asynchronous, so two
    // clicks dispatched in the same tick would both observe `loading === false`
    // and both POST the file. A ref is updated synchronously, so the second
    // click is rejected before it can reach the network.
    //
    // This matters because a duplicated upload creates the employees on the
    // first request and then reports them as "already exists" on the second.
    const uploadInProgress = useRef(false);

    // Identifies the most recent request. Responses from superseded requests
    // are discarded instead of overwriting fresher state.
    const requestId = useRef(0);

    // Aborts any in-flight request when the component unmounts.
    const abortController = useRef<AbortController | null>(null);

    useEffect(() => {
        return () => {
            abortController.current?.abort();
        };
    }, []);

    const handleUpload = useCallback(
        async (event: React.FormEvent) => {
            event.preventDefault();

            if (!file || uploadInProgress.current) {
                return;
            }

            uploadInProgress.current = true;

            const currentRequest = requestId.current + 1;
            requestId.current = currentRequest;

            const controller = new AbortController();
            abortController.current = controller;

            // Clear the previous outcome so a stale result can never be read as
            // the result of this upload.
            setLoading(true);
            setResult(null);
            setErrors([]);
            setFatalError(null);

            const formData = new FormData();
            formData.append("file", file);

            try {
                const response = await fetch("/api/employees/bulk-upload", {
                    method: "POST",
                    body: formData,
                    signal: controller.signal
                });

                const data = await response.json().catch(() => null);

                // A newer upload started while this one was in flight.
                if (requestId.current !== currentRequest) {
                    return;
                }

                if (!data) {
                    setFatalError(
                        `Server returned an unreadable response (HTTP ${response.status}).`
                    );
                    return;
                }

                // The API returns a top-level `error` for requests that were
                // rejected before any row was processed.
                if (!response.ok || typeof data.error === "string") {
                    setFatalError(
                        data.error ??
                        `Upload failed with HTTP ${response.status}.`
                    );
                    return;
                }

                setResult(data);
                setErrors(Array.isArray(data.errors) ? data.errors : []);
            } catch (error) {
                if ((error as Error).name === "AbortError") {
                    return;
                }

                if (requestId.current !== currentRequest) {
                    return;
                }

                setFatalError(
                    "Upload failed. Check your connection and try again."
                );
            } finally {
                if (requestId.current === currentRequest) {
                    setLoading(false);
                }

                uploadInProgress.current = false;
            }
        },
        [file]
    );

    const handleDownloadTemplate = useCallback(async () => {
        let objectUrl: string | null = null;

        try {
            const response = await fetch("/api/templates/employees");

            if (!response.ok) {
                setFatalError(
                    `Could not download the template (HTTP ${response.status}).`
                );
                return;
            }

            const blob = await response.blob();

            objectUrl = window.URL.createObjectURL(blob);

            const link = document.createElement("a");
            link.href = objectUrl;
            link.download = "employee_template.xlsx";

            document.body.appendChild(link);
            link.click();
            document.body.removeChild(link);
        } catch {
            setFatalError("Could not download the template. Please try again.");
        } finally {
            // Release the blob: object URLs are held until the document is
            // discarded, so every download would otherwise leak memory.
            if (objectUrl) {
                window.URL.revokeObjectURL(objectUrl);
            }
        }
    }, []);

    const isSubmitDisabled = !file || loading;

    return (
        <div
            style={{
                minHeight: "100vh",
                background: "#f8fafc",
                padding: "40px 24px",
                fontFamily:
                    "Inter, ui-sans-serif, system-ui, -apple-system, BlinkMacSystemFont, Segoe UI, sans-serif"
            }}
        >
            <div
                style={{
                    maxWidth: "900px",
                    margin: "0 auto"
                }}
            >
                {/* Header */}
                <div style={{ marginBottom: "30px" }}>
                    <p
                        style={{
                            margin: "0 0 8px",
                            fontSize: "14px",
                            fontWeight: 600,
                            color: "#64748b",
                            letterSpacing: "0.04em",
                            textTransform: "uppercase"
                        }}
                    >
                        Employee Management
                    </p>

                    <h1
                        style={{
                            margin: 0,
                            fontSize: "32px",
                            fontWeight: 700,
                            color: "#0f172a"
                        }}
                    >
                        Bulk Upload Employees
                    </h1>

                    <p
                        style={{
                            marginTop: "8px",
                            color: "#64748b",
                            fontSize: "15px"
                        }}
                    >
                        Upload multiple employees at once using an Excel file.
                    </p>
                </div>

                {/* Main Card */}
                <div
                    style={{
                        background: "#ffffff",
                        border: "1px solid #e2e8f0",
                        borderRadius: "16px",
                        padding: "28px",
                        boxShadow: "0 4px 20px rgba(15, 23, 42, 0.06)"
                    }}
                >
                    {/* Template Section */}
                    <div
                        style={{
                            display: "flex",
                            alignItems: "center",
                            justifyContent: "space-between",
                            gap: "20px",
                            padding: "20px",
                            background: "#f8fafc",
                            border: "1px solid #e2e8f0",
                            borderRadius: "12px",
                            marginBottom: "28px"
                        }}
                    >
                        <div>
                            <h3
                                style={{
                                    margin: "0 0 5px",
                                    fontSize: "16px",
                                    fontWeight: 600,
                                    color: "#0f172a"
                                }}
                            >
                                Start with the Excel template
                            </h3>

                            <p
                                style={{
                                    margin: 0,
                                    fontSize: "14px",
                                    color: "#64748b"
                                }}
                            >
                                Download the template and fill in the employee
                                details.
                            </p>
                        </div>

                        <button
                            type="button"
                            onClick={handleDownloadTemplate}
                            style={{
                                flexShrink: 0,
                                padding: "10px 16px",
                                background: "#ffffff",
                                color: "#0f172a",
                                border: "1px solid #cbd5e1",
                                borderRadius: "8px",
                                cursor: "pointer",
                                fontSize: "14px",
                                fontWeight: 600,
                                transition: "all 0.2s"
                            }}
                        >
                            📥 Download Template
                        </button>
                    </div>

                    {/* Upload Area */}
                    <form onSubmit={handleUpload}>
                        <div
                            style={{
                                border: "2px dashed #cbd5e1",
                                borderRadius: "14px",
                                padding: "38px 24px",
                                textAlign: "center",
                                background: "#fafafa"
                            }}
                        >
                            <div
                                style={{
                                    width: "52px",
                                    height: "52px",
                                    margin: "0 auto 14px",
                                    borderRadius: "12px",
                                    background: "#e2e8f0",
                                    display: "flex",
                                    alignItems: "center",
                                    justifyContent: "center",
                                    fontSize: "24px"
                                }}
                            >
                                📄
                            </div>

                            <h3
                                style={{
                                    margin: "0 0 6px",
                                    color: "#0f172a",
                                    fontSize: "17px",
                                    fontWeight: 600
                                }}
                            >
                                Upload employee file
                            </h3>

                            <p
                                style={{
                                    margin: "0 0 20px",
                                    color: "#64748b",
                                    fontSize: "14px"
                                }}
                            >
                                Select an Excel (.xlsx) file to upload
                            </p>

                            <input
                                type="file"
                                accept=".xlsx"
                                disabled={loading}
                                onChange={(event) => {
                                    setFile(event.target.files?.[0] || null);
                                    setResult(null);
                                    setErrors([]);
                                    setFatalError(null);
                                }}
                                required
                                style={{
                                    display: "block",
                                    width: "100%",
                                    maxWidth: "420px",
                                    margin: "0 auto",
                                    padding: "10px",
                                    border: "1px solid #cbd5e1",
                                    borderRadius: "8px",
                                    background: "#ffffff",
                                    fontSize: "14px",
                                    color: "#334155"
                                }}
                            />

                            {file && (
                                <div
                                    style={{
                                        marginTop: "14px",
                                        display: "inline-flex",
                                        alignItems: "center",
                                        gap: "8px",
                                        padding: "8px 12px",
                                        background: "#eff6ff",
                                        color: "#1d4ed8",
                                        borderRadius: "8px",
                                        fontSize: "13px",
                                        fontWeight: 500
                                    }}
                                >
                                    ✓ {file.name}
                                </div>
                            )}

                            <div style={{ marginTop: "22px" }}>
                                <button
                                    type="submit"
                                    disabled={isSubmitDisabled}
                                    style={{
                                        minWidth: "140px",
                                        padding: "11px 20px",
                                        border: "none",
                                        borderRadius: "8px",
                                        background: isSubmitDisabled
                                            ? "#cbd5e1"
                                            : "#2563eb",
                                        color: "#ffffff",
                                        cursor: isSubmitDisabled
                                            ? "not-allowed"
                                            : "pointer",
                                        fontSize: "14px",
                                        fontWeight: 600,
                                        boxShadow: isSubmitDisabled
                                            ? "none"
                                            : "0 2px 6px rgba(37, 99, 235, 0.25)"
                                    }}
                                >
                                    {loading
                                        ? "Uploading..."
                                        : "Upload Employees"}
                                </button>
                            </div>
                        </div>
                    </form>
                </div>

                {/* Request-level failure */}
                {fatalError && (
                    <div
                        role="alert"
                        style={{
                            marginTop: "24px",
                            padding: "16px 18px",
                            background: "#fef2f2",
                            border: "1px solid #fecaca",
                            borderRadius: "12px",
                            color: "#991b1b",
                            fontSize: "14px",
                            fontWeight: 500
                        }}
                    >
                        {fatalError}
                    </div>
                )}

                {/* Results */}
                {result && (
                    <div
                        style={{
                            marginTop: "24px",
                            background: "#ffffff",
                            border: "1px solid #e2e8f0",
                            borderRadius: "16px",
                            padding: "28px",
                            boxShadow: "0 4px 20px rgba(15, 23, 42, 0.05)"
                        }}
                    >
                        <h2
                            style={{
                                margin: "0 0 20px",
                                fontSize: "20px",
                                fontWeight: 700,
                                color: "#0f172a"
                            }}
                        >
                            Upload Results
                        </h2>

                        <div
                            style={{
                                display: "grid",
                                gridTemplateColumns:
                                    "repeat(2, minmax(0, 1fr))",
                                gap: "16px",
                                marginBottom: "24px"
                            }}
                        >
                            <div
                                style={{
                                    padding: "18px",
                                    borderRadius: "10px",
                                    background: "#f0fdf4",
                                    border: "1px solid #bbf7d0"
                                }}
                            >
                                <p
                                    style={{
                                        margin: "0 0 5px",
                                        fontSize: "13px",
                                        color: "#166534",
                                        fontWeight: 600
                                    }}
                                >
                                    Successfully Imported
                                </p>

                                <strong
                                    style={{
                                        fontSize: "26px",
                                        color: "#15803d"
                                    }}
                                >
                                    {result.success}
                                </strong>
                            </div>

                            <div
                                style={{
                                    padding: "18px",
                                    borderRadius: "10px",
                                    background: "#fef2f2",
                                    border: "1px solid #fecaca"
                                }}
                            >
                                <p
                                    style={{
                                        margin: "0 0 5px",
                                        fontSize: "13px",
                                        color: "#991b1b",
                                        fontWeight: 600
                                    }}
                                >
                                    Failed
                                </p>

                                <strong
                                    style={{
                                        fontSize: "26px",
                                        color: "#dc2626"
                                    }}
                                >
                                    {result.failed}
                                </strong>
                            </div>
                        </div>

                        {errors.length > 0 && (
                            <div>
                                <h3
                                    style={{
                                        margin: "0 0 12px",
                                        fontSize: "16px",
                                        color: "#0f172a"
                                    }}
                                >
                                    Upload Errors
                                </h3>

                                <div
                                    style={{
                                        overflowX: "auto",
                                        border: "1px solid #e2e8f0",
                                        borderRadius: "10px"
                                    }}
                                >
                                    <table
                                        style={{
                                            width: "100%",
                                            borderCollapse: "collapse",
                                            fontSize: "14px"
                                        }}
                                    >
                                        <thead>
                                            <tr style={{ background: "#f8fafc" }}>
                                                <th
                                                    style={{
                                                        padding: "12px 14px",
                                                        textAlign: "left",
                                                        color: "#475569",
                                                        fontWeight: 600,
                                                        borderBottom:
                                                            "1px solid #e2e8f0"
                                                    }}
                                                >
                                                    Row
                                                </th>

                                                <th
                                                    style={{
                                                        padding: "12px 14px",
                                                        textAlign: "left",
                                                        color: "#475569",
                                                        fontWeight: 600,
                                                        borderBottom:
                                                            "1px solid #e2e8f0"
                                                    }}
                                                >
                                                    Field
                                                </th>

                                                <th
                                                    style={{
                                                        padding: "12px 14px",
                                                        textAlign: "left",
                                                        color: "#475569",
                                                        fontWeight: 600,
                                                        borderBottom:
                                                            "1px solid #e2e8f0"
                                                    }}
                                                >
                                                    Error
                                                </th>
                                            </tr>
                                        </thead>

                                        <tbody>
                                            {errors.map((error, index) => (
                                                <tr
                                                    key={`${error.row ?? "na"}-${error.field ?? "na"
                                                        }-${index}`}
                                                >
                                                    <td
                                                        style={{
                                                            padding: "12px 14px",
                                                            color: "#334155",
                                                            borderBottom:
                                                                "1px solid #f1f5f9"
                                                        }}
                                                    >
                                                        {error.row ?? "—"}
                                                    </td>

                                                    <td
                                                        style={{
                                                            padding: "12px 14px",
                                                            color: "#334155",
                                                            borderBottom:
                                                                "1px solid #f1f5f9"
                                                        }}
                                                    >
                                                        {error.field ?? "—"}
                                                    </td>

                                                    <td
                                                        style={{
                                                            padding: "12px 14px",
                                                            color: "#dc2626",
                                                            borderBottom:
                                                                "1px solid #f1f5f9"
                                                        }}
                                                    >
                                                        {error.message}
                                                    </td>
                                                </tr>
                                            ))}
                                        </tbody>
                                    </table>
                                </div>
                            </div>
                        )}
                    </div>
                )}
            </div>
        </div>
    );
}