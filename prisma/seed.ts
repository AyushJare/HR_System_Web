import "dotenv/config";
import { PrismaClient } from "../lib/generated/prisma/client";
import { PrismaPg } from "@prisma/adapter-pg";
import bcrypt from "bcryptjs";

const adapter = new PrismaPg({ connectionString: process.env.DATABASE_URL });
const prisma = new PrismaClient({ adapter });

async function main() {
  console.log("🌱 Starting database seed...");

  // ==================== CREATE DEFAULT USER TYPES ====================

  const adminPermissions = {
    Dashboard: { view: true, edit: true },
    Admission: { view: true, add: true, edit: true, delete: true, import: true, export: true },
    Fees: { view: true, add: true, edit: true, delete: true, import: true, export: true },
    HR: {
      view: true,
      Employee: { view: true, add: true, edit: true, delete: true, import: true, export: true },
      Attendance: { view: true, add: true, edit: true, delete: true, import: true, export: true },
      Masters: { view: true, add: true, edit: true, delete: true, import: true, export: true },
      "Leaves Configuration": {
        view: true,
        add: true,
        edit: true,
        delete: true,
        other: {
          "Leave Types": true,
          "Leave Policy": true,
          "Leave Allocation": true,
          "Upload Opening Balances": true,
          "Manage Employee CompOff Dates": true,
        },
      },
      "Shift Configuration": { view: true, add: true, edit: true, delete: true, import: true, export: true },
      Reports: { view: true, export: true },
      "My Documents": { view: true, add: true, edit: true, delete: true },
    },
    Approvals: { view: true, edit: true },
    "Audit Log": { view: true, export: true },
    "Access Control": { view: true, add: true, edit: true, delete: true },
    "Institute Setup": { view: true, add: true, edit: true, delete: true },
  };

  const trustPermissions = {
    Dashboard: { view: true },
    HR: {
      view: true,
      Employee: { view: true, add: true, edit: true, delete: false, import: true, export: true },
      Attendance: { view: true, add: true, edit: true, delete: false, import: true, export: true },
      Masters: { view: true, add: false, edit: false, delete: false },
      "Leaves Configuration": {
        view: true,
        other: {
          "Leave Types": false,
          "Leave Policy": false,
          "Leave Allocation": true,
          "Upload Opening Balances": false,
          "Manage Employee CompOff Dates": false,
        },
      },
      "Shift Configuration": { view: true },
      Reports: { view: true, export: true },
      "My Documents": { view: true, add: true },
    },
    Approvals: { view: true, edit: true },
    "Audit Log": { view: true },
  };

  const principalApprovingPermissions = {
    Dashboard: { view: true },
    HR: {
      view: true,
      Employee: { view: true },
      Attendance: { view: true },
      "Leaves Configuration": { view: true },
      Reports: { view: true, export: true },
    },
    Approvals: { view: true, edit: true },
  };

  const teacherPermissions = {
    Dashboard: { view: true },
    HR: {
      view: true,
      Attendance: { view: true },
      "My Documents": { view: true, add: true },
    },
    Approvals: { view: true },
  };

  const officePermissions = {
    Dashboard: { view: true },
    Admission: { view: true, add: true, edit: true, import: true, export: true },
    Fees: { view: true, add: true, edit: true, import: true, export: true },
    HR: {
      view: true,
      Employee: { view: true, add: true, edit: true, import: true, export: true },
      Attendance: { view: true, add: true, edit: true, import: true, export: true },
      Masters: { view: true, add: true, edit: true },
      Reports: { view: true, export: true },
    },
  };

  try {
    // Create UserTypes
    const adminUserType = await prisma.userType.upsert({
      where: { name: "Admin" },
      update: {},
      create: {
        name: "Admin",
        description: "Super Admin with full system access",
        permissions: adminPermissions,
        isSystem: true,
      },
    });
    console.log("✅ Created Admin UserType");

    const trustUserType = await prisma.userType.upsert({
      where: { name: "Trust" },
      update: {},
      create: {
        name: "Trust",
        description: "Trust admin - can manage HR, employees, and approvals",
        permissions: trustPermissions,
        isSystem: true,
      },
    });
    console.log("✅ Created Trust UserType");

    const principalUserType = await prisma.userType.upsert({
      where: { name: "Principal-Approving" },
      update: {},
      create: {
        name: "Principal-Approving",
        description: "Principal - can view reports and approve requests",
        permissions: principalApprovingPermissions,
        isSystem: true,
      },
    });
    console.log("✅ Created Principal-Approving UserType");

    const teacherUserType = await prisma.userType.upsert({
      where: { name: "TEACHER" },
      update: {},
      create: {
        name: "TEACHER",
        description: "Teacher - limited access to personal and attendance data",
        permissions: teacherPermissions,
        isSystem: true,
      },
    });
    console.log("✅ Created Teacher UserType");

    const officeUserType = await prisma.userType.upsert({
      where: { name: "Office Peon" },
      update: {},
      create: {
        name: "Office Peon",
        description: "Office staff - can manage admissions, fees, and HR data",
        permissions: officePermissions,
        isSystem: true,
      },
    });
    console.log("✅ Created Office Peon UserType");

    // ==================== CREATE ADMIN EMPLOYEE ====================

    const passwordHash = await bcrypt.hash("Admin@123", 10);

    const admin = await prisma.employee.upsert({
      where: { email: "admin@company.com" },
      update: {
        userTypeId: adminUserType.id, // Assign Admin UserType
      },
      create: {
        fullName: "System Admin",
        email: "admin@company.com",
        passwordHash,
        role: "ADMIN",
        userTypeId: adminUserType.id, // Assign Admin UserType
        isActive: true,
      },
    });

    console.log("✅ Seeded admin:", admin.email);

    // ==================== OPTIONAL: CREATE DEMO EMPLOYEES ====================

    // You can uncomment these to create demo employees for testing different permissions

    // const trustAdmin = await prisma.employee.upsert({
    //   where: { email: "trust@company.com" },
    //   update: {},
    //   create: {
    //     fullName: "Trust Administrator",
    //     email: "trust@company.com",
    //     passwordHash: await bcrypt.hash("Trust@123", 10),
    //     role: "EMPLOYEE",
    //     userTypeId: trustUserType.id,
    //     isActive: true,
    //   },
    // });
    // console.log("✅ Created Trust admin user");

    // const hrOfficer = await prisma.employee.upsert({
    //   where: { email: "hr@company.com" },
    //   update: {},
    //   create: {
    //     fullName: "HR Officer",
    //     email: "hr@company.com",
    //     passwordHash: await bcrypt.hash("HR@123", 10),
    //     role: "EMPLOYEE",
    //     userTypeId: officeUserType.id,
    //     isActive: true,
    //   },
    // });
    // console.log("✅ Created HR Officer user");

    console.log("🎉 Database seed completed successfully!");
  } catch (error) {
    console.error("❌ Error seeding database:", error);
    throw error;
  }
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });