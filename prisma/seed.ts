import "dotenv/config";
import { PrismaClient } from "../lib/generated/prisma/client";
import { PrismaPg } from "@prisma/adapter-pg";
import bcrypt from "bcryptjs";

const adapter = new PrismaPg({ connectionString: process.env.DATABASE_URL });
const prisma = new PrismaClient({ adapter });

async function main() {
  const passwordHash = await bcrypt.hash("Admin@123", 10);

  const admin = await prisma.employee.upsert({
    where: { email: "admin@company.com" },
    update: {},
    create: {
      fullName: "System Admin",
      email: "admin@company.com",
      passwordHash,
      role: "ADMIN",
    },
  });

  console.log("Seeded admin:", admin.email);
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
