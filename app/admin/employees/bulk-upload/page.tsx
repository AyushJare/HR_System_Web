"use client";
import { useState } from "react";

export default function BulkUploadPage() {
    const [file, setFile] = useState<File | null>(null);
    const [loading, setLoading] = useState(false);
    const [result, setResult] = useState<any>(null);
    const [errors, setErrors] = useState<any[]>([]);

    const handleUpload = async (e: React.FormEvent) => {
        e.preventDefault();
        if (!file) return;

        setLoading(true);
        const formData = new FormData();
        formData.append("file", file);

        try {
            const res = await fetch("/api/employees/bulk-upload", {
                method: "POST",
                body: formData
            });

            const data = await res.json();
            setResult(data);
            setErrors(data.errors || []);
        } catch (err) {
            setErrors([{ message: "Upload failed" }]);
        } finally {
            setLoading(false);
        }
    };

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
                                Download the template and fill in the employee details.
                            </p>
                        </div>

                        <button
                            type="button"
                            onClick={async () => {
                                const res = await fetch("/api/templates/employees");
                                const blob = await res.blob();
                                const url = window.URL.createObjectURL(blob);
                                const a = document.createElement("a");
                                a.href = url;
                                a.download = "employee_template.xlsx";
                                a.click();
                            }}
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
                                onChange={(e) =>
                                    setFile(e.target.files?.[0] || null)
                                }
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
                                    disabled={!file || loading}
                                    style={{
                                        minWidth: "140px",
                                        padding: "11px 20px",
                                        border: "none",
                                        borderRadius: "8px",
                                        background:
                                            !file || loading
                                                ? "#cbd5e1"
                                                : "#2563eb",
                                        color: "#ffffff",
                                        cursor:
                                            !file || loading
                                                ? "not-allowed"
                                                : "pointer",
                                        fontSize: "14px",
                                        fontWeight: 600,
                                        boxShadow:
                                            !file || loading
                                                ? "none"
                                                : "0 2px 6px rgba(37, 99, 235, 0.25)"
                                    }}
                                >
                                    {loading ? "Uploading..." : "Upload Employees"}
                                </button>
                            </div>
                        </div>
                    </form>
                </div>

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
                                gridTemplateColumns: "repeat(2, minmax(0, 1fr))",
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
                                            <tr
                                                style={{
                                                    background: "#f8fafc"
                                                }}
                                            >
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
                                            {errors.map((err, i) => (
                                                <tr key={i}>
                                                    <td
                                                        style={{
                                                            padding: "12px 14px",
                                                            color: "#334155",
                                                            borderBottom:
                                                                "1px solid #f1f5f9"
                                                        }}
                                                    >
                                                        {err.row}
                                                    </td>

                                                    <td
                                                        style={{
                                                            padding: "12px 14px",
                                                            color: "#334155",
                                                            borderBottom:
                                                                "1px solid #f1f5f9"
                                                        }}
                                                    >
                                                        {err.field}
                                                    </td>

                                                    <td
                                                        style={{
                                                            padding: "12px 14px",
                                                            color: "#dc2626",
                                                            borderBottom:
                                                                "1px solid #f1f5f9"
                                                        }}
                                                    >
                                                        {err.message}
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