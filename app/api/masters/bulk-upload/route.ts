import { NextRequest, NextResponse } from "next/server";
import { requireAdmin } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import ExcelJS from "exceljs";

type UploadError = {
    sheet: string;
    row: number;
    field: string;
    message: string;
};

type SheetResult = {
    created: number;
    updated: number;
    skipped: number;
};

function getCellString(
    row: ExcelJS.Row,
    column: number
): string {
    const value = row.getCell(column).value;

    if (value === null || value === undefined) {
        return "";
    }

    if (typeof value === "object" && "text" in value) {
        return String(
            (value as { text: string }).text
        ).trim();
    }

    return String(value).trim();
}

function getExcelDate(
    value: ExcelJS.CellValue
): Date | null {
    if (value instanceof Date) {
        return value;
    }

    if (typeof value === "number") {
        // Excel serial date
        const excelEpoch = new Date(
            Date.UTC(1899, 11, 30)
        );

        const date = new Date(
            excelEpoch.getTime() +
            value * 24 * 60 * 60 * 1000
        );

        return date;
    }

    if (typeof value === "string") {
        const trimmed = value.trim();

        if (!trimmed) {
            return null;
        }

        // Expected format: YYYY-MM-DD
        const match = trimmed.match(
            /^(\d{4})-(\d{2})-(\d{2})$/
        );

        if (!match) {
            return null;
        }

        const year = Number(match[1]);
        const month = Number(match[2]);
        const day = Number(match[3]);

        const date = new Date(
            year,
            month - 1,
            day
        );

        if (
            date.getFullYear() !== year ||
            date.getMonth() !== month - 1 ||
            date.getDate() !== day
        ) {
            return null;
        }

        return date;
    }

    return null;
}

function isEmptyRow(row: ExcelJS.Row): boolean {
    for (let i = 1; i <= row.cellCount; i++) {
        const value = row.getCell(i).value;

        if (
            value !== null &&
            value !== undefined &&
            String(value).trim() !== ""
        ) {
            return false;
        }
    }

    return true;
}

function emptyResult(): SheetResult {
    return {
        created: 0,
        updated: 0,
        skipped: 0,
    };
}

export async function POST(
    request: NextRequest
) {
    try {
        // =========================================================
        // AUTHENTICATION
        // =========================================================

        const auth = await requireAdmin();

        if (!auth.ok) {
            return NextResponse.json(
                {
                    error: auth.error,
                },
                {
                    status: auth.status,
                }
            );
        }

        // =========================================================
        // GET FILE
        // =========================================================

        const formData = await request.formData();

        const file = formData.get("file");

        if (!(file instanceof File)) {
            return NextResponse.json(
                {
                    error:
                        "Excel file is required.",
                },
                {
                    status: 400,
                }
            );
        }

        if (
            !file.name
                .toLowerCase()
                .endsWith(".xlsx")
        ) {
            return NextResponse.json(
                {
                    error:
                        "Only .xlsx files are allowed.",
                },
                {
                    status: 400,
                }
            );
        }

        // =========================================================
        // READ WORKBOOK
        // =========================================================

        const buffer =
            await file.arrayBuffer();

        const workbook =
            new ExcelJS.Workbook();

        await workbook.xlsx.load(buffer);

        // =========================================================
        // REQUIRED SHEETS
        // =========================================================

        const requiredSheets = [
            "Instructions",
            "Departments",
            "Designations",
            "Employee Types",
            "Holidays",
            "Leave Types",
            "Weekly Off",
        ];

        for (const sheetName of requiredSheets) {
            if (
                !workbook.getWorksheet(
                    sheetName
                )
            ) {
                return NextResponse.json(
                    {
                        error:
                            `Invalid template. Missing sheet: "${sheetName}". Please download the latest Masters template.`,
                    },
                    {
                        status: 400,
                    }
                );
            }
        }

        // =========================================================
        // RESULTS
        // =========================================================

        const errors: UploadError[] = [];

        const results = {
            departments: emptyResult(),
            designations: emptyResult(),
            employeeTypes: emptyResult(),
            holidays: emptyResult(),
            leaveTypes: emptyResult(),
            weeklyOff: emptyResult(),
        };

        // =========================================================
        // VALIDATED DATA
        // =========================================================

        const departmentData: {
            row: number;
            name: string;
        }[] = [];

        const designationData: {
            row: number;
            name: string;
        }[] = [];

        const employeeTypeData: {
            row: number;
            name: string;
            noticePeriod: number;
        }[] = [];

        const holidayData: {
            row: number;
            name: string;
            startDate: Date;
            endDate: Date;
        }[] = [];

        const leaveTypeData: {
            row: number;
            name: string;
            code: string;
            defaultAnnualQuota: number;
        }[] = [];

        const weeklyOffData: {
            row: number;
            day: string;
            weeklyOff: boolean;
        }[] = [];

        // =========================================================
        // 1. DEPARTMENTS
        // =========================================================

        const departmentsSheet =
            workbook.getWorksheet(
                "Departments"
            )!;

        if (
            getCellString(
                departmentsSheet.getRow(1),
                1
            ) !== "Department Name"
        ) {
            errors.push({
                sheet: "Departments",
                row: 1,
                field: "Header",
                message:
                    'Expected header "Department Name".',
            });
        } else {
            const batchNames =
                new Set<string>();

            for (
                let rowNumber = 2;
                rowNumber <=
                departmentsSheet.rowCount;
                rowNumber++
            ) {
                const row =
                    departmentsSheet.getRow(
                        rowNumber
                    );

                if (isEmptyRow(row)) {
                    continue;
                }

                const name =
                    getCellString(row, 1);

                if (!name) {
                    errors.push({
                        sheet: "Departments",
                        row: rowNumber,
                        field:
                            "Department Name",
                        message:
                            "Department name is required.",
                    });

                    continue;
                }

                const normalized =
                    name.toLowerCase();

                if (
                    batchNames.has(
                        normalized
                    )
                ) {
                    errors.push({
                        sheet: "Departments",
                        row: rowNumber,
                        field:
                            "Department Name",
                        message:
                            "Duplicate department name in this upload.",
                    });

                    continue;
                }

                batchNames.add(
                    normalized
                );

                departmentData.push({
                    row: rowNumber,
                    name,
                });
            }
        }

        // =========================================================
        // 2. DESIGNATIONS
        // =========================================================

        const designationsSheet =
            workbook.getWorksheet(
                "Designations"
            )!;

        if (
            getCellString(
                designationsSheet.getRow(1),
                1
            ) !== "Designation Name"
        ) {
            errors.push({
                sheet: "Designations",
                row: 1,
                field: "Header",
                message:
                    'Expected header "Designation Name".',
            });
        } else {
            const batchNames =
                new Set<string>();

            for (
                let rowNumber = 2;
                rowNumber <=
                designationsSheet.rowCount;
                rowNumber++
            ) {
                const row =
                    designationsSheet.getRow(
                        rowNumber
                    );

                if (isEmptyRow(row)) {
                    continue;
                }

                const name =
                    getCellString(row, 1);

                if (!name) {
                    errors.push({
                        sheet: "Designations",
                        row: rowNumber,
                        field:
                            "Designation Name",
                        message:
                            "Designation name is required.",
                    });

                    continue;
                }

                const normalized =
                    name.toLowerCase();

                if (
                    batchNames.has(
                        normalized
                    )
                ) {
                    errors.push({
                        sheet: "Designations",
                        row: rowNumber,
                        field:
                            "Designation Name",
                        message:
                            "Duplicate designation name in this upload.",
                    });

                    continue;
                }

                batchNames.add(
                    normalized
                );

                designationData.push({
                    row: rowNumber,
                    name,
                });
            }
        }

        // =========================================================
        // 3. EMPLOYEE TYPES
        // =========================================================

        const employeeTypesSheet =
            workbook.getWorksheet(
                "Employee Types"
            )!;

        const employeeTypeHeaders = [
            getCellString(
                employeeTypesSheet.getRow(1),
                1
            ),
            getCellString(
                employeeTypesSheet.getRow(1),
                2
            ),
        ];

        if (
            employeeTypeHeaders[0] !==
            "Employee Type" ||
            employeeTypeHeaders[1] !==
            "Notice Period (Days)"
        ) {
            errors.push({
                sheet: "Employee Types",
                row: 1,
                field: "Header",
                message:
                    "Invalid Employee Types headers.",
            });
        } else {
            const batchNames =
                new Set<string>();

            for (
                let rowNumber = 2;
                rowNumber <=
                employeeTypesSheet.rowCount;
                rowNumber++
            ) {
                const row =
                    employeeTypesSheet.getRow(
                        rowNumber
                    );

                if (isEmptyRow(row)) {
                    continue;
                }

                const name =
                    getCellString(row, 1);

                const noticeValue =
                    row.getCell(2).value;

                if (!name) {
                    errors.push({
                        sheet: "Employee Types",
                        row: rowNumber,
                        field:
                            "Employee Type",
                        message:
                            "Employee type is required.",
                    });

                    continue;
                }

                const noticePeriod =
                    Number(noticeValue);

                if (
                    !Number.isInteger(
                        noticePeriod
                    ) ||
                    noticePeriod < 0
                ) {
                    errors.push({
                        sheet: "Employee Types",
                        row: rowNumber,
                        field:
                            "Notice Period (Days)",
                        message:
                            "Notice period must be a whole number greater than or equal to 0.",
                    });

                    continue;
                }

                const normalized =
                    name.toLowerCase();

                if (
                    batchNames.has(
                        normalized
                    )
                ) {
                    errors.push({
                        sheet: "Employee Types",
                        row: rowNumber,
                        field:
                            "Employee Type",
                        message:
                            "Duplicate employee type in this upload.",
                    });

                    continue;
                }

                batchNames.add(
                    normalized
                );

                employeeTypeData.push({
                    row: rowNumber,
                    name,
                    noticePeriod,
                });
            }
        }

        // =========================================================
        // 4. HOLIDAYS
        // =========================================================

        const holidaysSheet =
            workbook.getWorksheet(
                "Holidays"
            )!;

        const holidayHeaders = [
            getCellString(
                holidaysSheet.getRow(1),
                1
            ),
            getCellString(
                holidaysSheet.getRow(1),
                2
            ),
            getCellString(
                holidaysSheet.getRow(1),
                3
            ),
        ];

        if (
            holidayHeaders[0] !==
            "Festival Name" ||
            holidayHeaders[1] !==
            "Start Date" ||
            holidayHeaders[2] !==
            "End Date"
        ) {
            errors.push({
                sheet: "Holidays",
                row: 1,
                field: "Header",
                message:
                    "Invalid Holidays headers.",
            });
        } else {
            for (
                let rowNumber = 2;
                rowNumber <=
                holidaysSheet.rowCount;
                rowNumber++
            ) {
                const row =
                    holidaysSheet.getRow(
                        rowNumber
                    );

                if (isEmptyRow(row)) {
                    continue;
                }

                const name =
                    getCellString(row, 1);

                const startDate =
                    getExcelDate(
                        row.getCell(2).value
                    );

                const endDate =
                    getExcelDate(
                        row.getCell(3).value
                    );

                if (!name) {
                    errors.push({
                        sheet: "Holidays",
                        row: rowNumber,
                        field:
                            "Festival Name",
                        message:
                            "Festival name is required.",
                    });

                    continue;
                }

                if (!startDate) {
                    errors.push({
                        sheet: "Holidays",
                        row: rowNumber,
                        field:
                            "Start Date",
                        message:
                            "Invalid start date. Use YYYY-MM-DD.",
                    });

                    continue;
                }

                if (!endDate) {
                    errors.push({
                        sheet: "Holidays",
                        row: rowNumber,
                        field:
                            "End Date",
                        message:
                            "Invalid end date. Use YYYY-MM-DD.",
                    });

                    continue;
                }

                if (
                    endDate < startDate
                ) {
                    errors.push({
                        sheet: "Holidays",
                        row: rowNumber,
                        field:
                            "End Date",
                        message:
                            "End Date cannot be earlier than Start Date.",
                    });

                    continue;
                }

                holidayData.push({
                    row: rowNumber,
                    name,
                    startDate,
                    endDate,
                });
            }
        }

        // =========================================================
        // 5. LEAVE TYPES
        // =========================================================

        const leaveTypesSheet =
            workbook.getWorksheet(
                "Leave Types"
            )!;

        const leaveTypeHeaders = [
            getCellString(
                leaveTypesSheet.getRow(1),
                1
            ),
            getCellString(
                leaveTypesSheet.getRow(1),
                2
            ),
            getCellString(
                leaveTypesSheet.getRow(1),
                3
            ),
        ];

        if (
            leaveTypeHeaders[0] !==
            "Leave Name" ||
            leaveTypeHeaders[1] !== "Code" ||
            leaveTypeHeaders[2] !==
            "Default Annual Quota"
        ) {
            errors.push({
                sheet: "Leave Types",
                row: 1,
                field: "Header",
                message:
                    "Invalid Leave Types headers.",
            });
        } else {
            const batchNames =
                new Set<string>();

            const batchCodes =
                new Set<string>();

            for (
                let rowNumber = 2;
                rowNumber <=
                leaveTypesSheet.rowCount;
                rowNumber++
            ) {
                const row =
                    leaveTypesSheet.getRow(
                        rowNumber
                    );

                if (isEmptyRow(row)) {
                    continue;
                }

                const name =
                    getCellString(row, 1);

                const code =
                    getCellString(row, 2);

                const quota =
                    Number(
                        row.getCell(3).value
                    );

                if (!name) {
                    errors.push({
                        sheet: "Leave Types",
                        row: rowNumber,
                        field:
                            "Leave Name",
                        message:
                            "Leave name is required.",
                    });

                    continue;
                }

                if (!code) {
                    errors.push({
                        sheet: "Leave Types",
                        row: rowNumber,
                        field: "Code",
                        message:
                            "Leave code is required.",
                    });

                    continue;
                }

                if (
                    !Number.isInteger(
                        quota
                    ) ||
                    quota < 0
                ) {
                    errors.push({
                        sheet: "Leave Types",
                        row: rowNumber,
                        field:
                            "Default Annual Quota",
                        message:
                            "Annual quota must be a whole number greater than or equal to 0.",
                    });

                    continue;
                }

                const normalizedName =
                    name.toLowerCase();

                const normalizedCode =
                    code.toLowerCase();

                if (
                    batchNames.has(
                        normalizedName
                    )
                ) {
                    errors.push({
                        sheet: "Leave Types",
                        row: rowNumber,
                        field:
                            "Leave Name",
                        message:
                            "Duplicate leave name in this upload.",
                    });

                    continue;
                }

                if (
                    batchCodes.has(
                        normalizedCode
                    )
                ) {
                    errors.push({
                        sheet: "Leave Types",
                        row: rowNumber,
                        field: "Code",
                        message:
                            "Duplicate leave code in this upload.",
                    });

                    continue;
                }

                batchNames.add(
                    normalizedName
                );

                batchCodes.add(
                    normalizedCode
                );

                leaveTypeData.push({
                    row: rowNumber,
                    name,
                    code,
                    defaultAnnualQuota:
                        quota,
                });
            }
        }

        // =========================================================
        // 6. WEEKLY OFF
        // =========================================================

        const weeklyOffSheet =
            workbook.getWorksheet(
                "Weekly Off"
            )!;

        const weeklyOffHeaders = [
            getCellString(
                weeklyOffSheet.getRow(1),
                1
            ),
            getCellString(
                weeklyOffSheet.getRow(1),
                2
            ),
        ];

        if (
            weeklyOffHeaders[0] !== "Day" ||
            weeklyOffHeaders[1] !==
            "Weekly Off"
        ) {
            errors.push({
                sheet: "Weekly Off",
                row: 1,
                field: "Header",
                message:
                    "Invalid Weekly Off headers.",
            });
        } else {
            const validDays = [
                "Sunday",
                "Monday",
                "Tuesday",
                "Wednesday",
                "Thursday",
                "Friday",
                "Saturday",
            ];

            for (
                let rowNumber = 2;
                rowNumber <= 8;
                rowNumber++
            ) {
                const row =
                    weeklyOffSheet.getRow(
                        rowNumber
                    );

                const day =
                    getCellString(row, 1);

                const value =
                    getCellString(row, 2)
                        .toUpperCase();

                if (
                    !validDays.includes(day)
                ) {
                    errors.push({
                        sheet: "Weekly Off",
                        row: rowNumber,
                        field: "Day",
                        message:
                            `Invalid day "${day}".`,
                    });

                    continue;
                }

                if (
                    value !== "YES" &&
                    value !== "NO"
                ) {
                    errors.push({
                        sheet: "Weekly Off",
                        row: rowNumber,
                        field:
                            "Weekly Off",
                        message:
                            "Value must be YES or NO.",
                    });

                    continue;
                }

                weeklyOffData.push({
                    row: rowNumber,
                    day,
                    weeklyOff:
                        value === "YES",
                });
            }
        }

        // =========================================================
        // STOP IF VALIDATION ERRORS
        // =========================================================

        if (errors.length > 0) {
            return NextResponse.json(
                {
                    success: false,
                    message:
                        "Validation failed. No data was imported.",
                    created: 0,
                    updated: 0,
                    skipped: 0,
                    failed:
                        errors.length,
                    errors,
                },
                {
                    status: 400,
                }
            );
        }

        // =========================================================
        // IMPORT
        // =========================================================

        await prisma.$transaction(
            async (tx) => {
                // -------------------------------------------------
                // DEPARTMENTS
                // -------------------------------------------------

                for (
                    const item of departmentData
                ) {
                    const existing =
                        await tx.department.findFirst(
                            {
                                where: {
                                    name: {
                                        equals:
                                            item.name,
                                        mode: "insensitive",
                                    },
                                },
                            }
                        );

                    if (existing) {
                        results.departments.skipped++;
                        continue;
                    }

                    const created =
                        await tx.department.create(
                            {
                                data: {
                                    name:
                                        item.name,
                                },
                            }
                        );

                    await tx.auditLog.create({
                        data: {
                            employeeId:
                                auth.session
                                    .sub,

                            action:
                                "DEPARTMENT_CREATED",

                            entity:
                                "Department",

                            entityId:
                                created.id,

                            metadata: {
                                source:
                                    "MASTER_BULK_UPLOAD",
                                name:
                                    item.name,
                            },
                        },
                    });

                    results.departments.created++;
                }

                // -------------------------------------------------
                // DESIGNATIONS
                // -------------------------------------------------

                for (
                    const item of designationData
                ) {
                    const existing =
                        await tx.designation.findFirst(
                            {
                                where: {
                                    name: {
                                        equals:
                                            item.name,
                                        mode: "insensitive",
                                    },
                                },
                            }
                        );

                    if (existing) {
                        results.designations.skipped++;
                        continue;
                    }

                    const created =
                        await tx.designation.create(
                            {
                                data: {
                                    name:
                                        item.name,
                                },
                            }
                        );

                    await tx.auditLog.create({
                        data: {
                            employeeId:
                                auth.session
                                    .sub,

                            action:
                                "DESIGNATION_CREATED",

                            entity:
                                "Designation",

                            entityId:
                                created.id,

                            metadata: {
                                source:
                                    "MASTER_BULK_UPLOAD",
                                name:
                                    item.name,
                            },
                        },
                    });

                    results.designations.created++;
                }

                // -------------------------------------------------
                // EMPLOYEE TYPES
                // -------------------------------------------------

                for (
                    const item of employeeTypeData
                ) {
                    const existing =
                        await tx.employeeType.findFirst(
                            {
                                where: {
                                    name: {
                                        equals:
                                            item.name,
                                        mode: "insensitive",
                                    },
                                },
                            }
                        );

                    if (existing) {
                        if (
                            existing.noticePeriod !==
                            item.noticePeriod
                        ) {
                            await tx.employeeType.update(
                                {
                                    where: {
                                        id:
                                            existing.id,
                                    },
                                    data: {
                                        noticePeriod:
                                            item.noticePeriod,
                                    },
                                }
                            );

                            results.employeeTypes.updated++;
                        } else {
                            results.employeeTypes.skipped++;
                        }

                        continue;
                    }

                    const created =
                        await tx.employeeType.create(
                            {
                                data: {
                                    name:
                                        item.name,
                                    noticePeriod:
                                        item.noticePeriod,
                                },
                            }
                        );

                    await tx.auditLog.create({
                        data: {
                            employeeId:
                                auth.session
                                    .sub,

                            action:
                                "EMPLOYEE_TYPE_CREATED",

                            entity:
                                "EmployeeType",

                            entityId:
                                created.id,

                            metadata: {
                                source:
                                    "MASTER_BULK_UPLOAD",
                                name:
                                    item.name,
                                noticePeriod:
                                    item.noticePeriod,
                            },
                        },
                    });

                    results.employeeTypes.created++;
                }

                // -------------------------------------------------
                // HOLIDAYS
                // -------------------------------------------------

                for (
                    const item of holidayData
                ) {
                    const currentDate =
                        new Date(
                            item.startDate
                        );

                    while (
                        currentDate <=
                        item.endDate
                    ) {
                        const date =
                            new Date(
                                currentDate
                            );

                        date.setHours(
                            0,
                            0,
                            0,
                            0
                        );

                        const existing =
                            await tx.holiday.findFirst(
                                {
                                    where: {
                                        name:
                                            item.name,

                                        date,
                                    },
                                }
                            );

                        if (existing) {
                            results.holidays.skipped++;
                        } else {
                            const created =
                                await tx.holiday.create(
                                    {
                                        data: {
                                            name:
                                                item.name,
                                            date,
                                        },
                                    }
                                );

                            await tx.auditLog.create(
                                {
                                    data: {
                                        employeeId:
                                            auth
                                                .session
                                                .sub,

                                        action:
                                            "HOLIDAY_CREATED",

                                        entity:
                                            "Holiday",

                                        entityId:
                                            created.id,

                                        metadata: {
                                            source:
                                                "MASTER_BULK_UPLOAD",
                                            name:
                                                item.name,
                                            date:
                                                date.toISOString(),
                                        },
                                    },
                                }
                            );

                            results.holidays.created++;
                        }

                        currentDate.setDate(
                            currentDate.getDate() +
                            1
                        );
                    }
                }

                // -------------------------------------------------
                // LEAVE TYPES
                // -------------------------------------------------

                for (
                    const item of leaveTypeData
                ) {
                    const existingByName =
                        await tx.leaveType.findFirst(
                            {
                                where: {
                                    name: {
                                        equals:
                                            item.name,
                                        mode: "insensitive",
                                    },
                                },
                            }
                        );

                    const existingByCode =
                        await tx.leaveType.findFirst(
                            {
                                where: {
                                    code: {
                                        equals:
                                            item.code,
                                        mode: "insensitive",
                                    },
                                },
                            }
                        );

                    if (
                        existingByName &&
                        existingByCode
                    ) {
                        if (
                            existingByName.id ===
                            existingByCode.id &&
                            (existingByName.defaultAnnualQuota !==
                                item.defaultAnnualQuota ||
                                existingByName.code !==
                                item.code)
                        ) {
                            await tx.leaveType.update(
                                {
                                    where: {
                                        id:
                                            existingByName.id,
                                    },
                                    data: {
                                        code:
                                            item.code,
                                        defaultAnnualQuota:
                                            item.defaultAnnualQuota,
                                    },
                                }
                            );

                            results.leaveTypes.updated++;
                        } else {
                            results.leaveTypes.skipped++;
                        }

                        continue;
                    }

                    if (
                        existingByName &&
                        !existingByCode
                    ) {
                        await tx.leaveType.update(
                            {
                                where: {
                                    id:
                                        existingByName.id,
                                },
                                data: {
                                    code:
                                        item.code,
                                    defaultAnnualQuota:
                                        item.defaultAnnualQuota,
                                },
                            }
                        );

                        results.leaveTypes.updated++;
                        continue;
                    }

                    if (
                        existingByCode &&
                        !existingByName
                    ) {
                        errors.push({
                            sheet:
                                "Leave Types",
                            row: item.row,
                            field: "Code",
                            message:
                                `Leave code "${item.code}" already belongs to another leave type.`,
                        });

                        continue;
                    }

                    const created =
                        await tx.leaveType.create(
                            {
                                data: {
                                    name:
                                        item.name,
                                    code:
                                        item.code,
                                    defaultAnnualQuota:
                                        item.defaultAnnualQuota,
                                },
                            }
                        );

                    await tx.auditLog.create({
                        data: {
                            employeeId:
                                auth.session
                                    .sub,

                            action:
                                "LEAVE_TYPE_CREATED",

                            entity:
                                "LeaveType",

                            entityId:
                                created.id,

                            metadata: {
                                source:
                                    "MASTER_BULK_UPLOAD",
                                name:
                                    item.name,
                                code:
                                    item.code,
                                defaultAnnualQuota:
                                    item.defaultAnnualQuota,
                            },
                        },
                    });

                    results.leaveTypes.created++;
                }

                // -------------------------------------------------
                // WEEKLY OFF
                // -------------------------------------------------

                const dayMap: Record<
                    string,
                    number
                > = {
                    Sunday: 0,
                    Monday: 1,
                    Tuesday: 2,
                    Wednesday: 3,
                    Thursday: 4,
                    Friday: 5,
                    Saturday: 6,
                };

                const weeklyOffDays =
                    weeklyOffData
                        .filter(
                            (item) =>
                                item.weeklyOff
                        )
                        .map(
                            (item) =>
                                dayMap[item.day]
                        )
                        .sort(
                            (a, b) => a - b
                        );

                const settings =
                    await tx.attendanceSettings.findFirst();

                if (settings) {
                    const oldDays =
                        [...settings.weeklyOffDays]
                            .sort(
                                (a, b) => a - b
                            );

                    const changed =
                        JSON.stringify(
                            oldDays
                        ) !==
                        JSON.stringify(
                            weeklyOffDays
                        );

                    if (changed) {
                        await tx.attendanceSettings.update(
                            {
                                where: {
                                    id:
                                        settings.id,
                                },
                                data: {
                                    weeklyOffDays,
                                },
                            }
                        );

                        results.weeklyOff.updated++;
                    } else {
                        results.weeklyOff.skipped++;
                    }
                } else {
                    await tx.attendanceSettings.create(
                        {
                            data: {
                                weeklyOffDays,
                            },
                        }
                    );

                    results.weeklyOff.created++;
                }
            }
        );

        // =========================================================
        // TOTALS
        // =========================================================

        const totalCreated =
            results.departments.created +
            results.designations.created +
            results.employeeTypes.created +
            results.holidays.created +
            results.leaveTypes.created +
            results.weeklyOff.created;

        const totalUpdated =
            results.departments.updated +
            results.designations.updated +
            results.employeeTypes.updated +
            results.holidays.updated +
            results.leaveTypes.updated +
            results.weeklyOff.updated;

        const totalSkipped =
            results.departments.skipped +
            results.designations.skipped +
            results.employeeTypes.skipped +
            results.holidays.skipped +
            results.leaveTypes.skipped +
            results.weeklyOff.skipped;

        return NextResponse.json({
            success: true,

            message:
                "Master data imported successfully.",

            summary: {
                created:
                    totalCreated,

                updated:
                    totalUpdated,

                skipped:
                    totalSkipped,

                failed: 0,
            },

            details: results,

            errors: [],
        });
    } catch (error) {
        console.error(
            "Master bulk upload error:",
            error
        );

        return NextResponse.json(
            {
                success: false,

                error:
                    "Master bulk upload failed.",

                details:
                    error instanceof Error
                        ? error.message
                        : "Unknown error",
            },
            {
                status: 500,
            }
        );
    }
}