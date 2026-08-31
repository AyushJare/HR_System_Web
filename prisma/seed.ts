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