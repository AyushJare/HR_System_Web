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

  // ==================== DEFAULT EMPLOYEE PERMISSIONS ====================

  const employeeDefaultPermissions = {
    Dashboard: { view: true },
    Attendance: {
      view: true,
      "Check In": { view: true, add: true },
      "Attendance Corrections": { view: true, add: true },
    },
  };

  // ==================== CREATE DEFAULT OFFICES ====================

  const offices = [
    {
      name: "Amber Elliance Office",
      latitude: 19.1681,
      longitude: 73.0456,
      radiusMeters: 200,
    },
    {
      name: "New York Office",
      latitude: 40.7128,
      longitude: -74.0060,
      radiusMeters: 200,
    },
    {
      name: "Mumbai Office",
      latitude: 19.1178731,
      longitude: 72.9270838,
      radiusMeters: 200,
    },
    {
      name: "Bangalore Office",
      latitude: 12.9716,
      longitude: 77.5946,
      radiusMeters: 200,
    },
  ];

  for (const office of offices) {
    const createdOffice = await prisma.office.upsert({
      where: { name: office.name },
      update: {
        latitude: office.latitude,
        longitude: office.longitude,
        radiusMeters: office.radiusMeters,
      },
      create: office,
    });

    console.log(`✅ Office ready: ${createdOffice.name}`);
  }

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

    // Create default Employee UserType
    const employeeDefaultUserType = await prisma.userType.upsert({
      where: { name: "Employee (Default)" },
      update: {
        description: "Default employee access with attendance and attendance correction query permissions",
        permissions: employeeDefaultPermissions,
        isSystem: true,
        locationMode: "RESTRICTED_100M",
      },
      create: {
        name: "Employee (Default)",
        description: "Default employee access with attendance and attendance correction query permissions",
        permissions: employeeDefaultPermissions,
        isSystem: true,
        locationMode: "RESTRICTED_100M",
      },
    });

    console.log("✅ Created Employee (Default) UserType");

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