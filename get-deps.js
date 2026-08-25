const { PrismaClient } = require("./lib/generated/prisma/client");
const { PrismaPg } = require("@prisma/adapter-pg");

async function run() {
  const adapter = new PrismaPg({ connectionString: process.env.DATABASE_URL });
  const prisma = new PrismaClient({ adapter });
  
  const departments = await prisma.department.findMany();
  console.log("DEPARTMENTS:");
  console.log(departments);

  const designations = await prisma.designation.findMany();
  console.log("DESIGNATIONS:");
  console.log(designations);
  
  await prisma.$disconnect();
}

run().catch(console.error);
