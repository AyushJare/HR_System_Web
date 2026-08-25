const { PrismaClient } = require("./node_modules/@prisma/client");
const { PrismaPg } = require("./node_modules/@prisma/adapter-pg");
const ExcelJS = require("exceljs");
const path = require("path");

async function generateTestFiles() {
  const prisma = new PrismaClient();
  
  // Fetch actual departments and designations from DB
  const departments = await prisma.department.findMany();
  const designations = await prisma.designation.findMany();
  
  if (departments.length === 0 || designations.length === 0) {
    console.log("Error: You need to have at least one department and designation in the database!");
    await prisma.$disconnect();
    return;
  }
  
  const deptName = departments[0].name;
  const desigName = designations[0].name;

  // 1. Valid File
  const validWorkbook = new ExcelJS.Workbook();
  const validSheet = validWorkbook.addWorksheet("Employees");
  validSheet.addRow(["Email*", "First Name*", "Last Name*", "Phone Number", "Department", "Designation", "Employee Type", "Date of Joining"]);
  validSheet.addRow(["test1@company.com", "John", "Doe", "9876543210", deptName, desigName, "PERMANENT", "2023-01-01"]);
  validSheet.addRow(["test2@company.com", "Jane", "Smith", "9876543211", deptName, desigName, "CONTRACT", "2023-02-01"]);
  await validWorkbook.xlsx.writeFile(path.join(__dirname, "valid_upload.xlsx"));
  console.log(`Created valid_upload.xlsx using Department: "${deptName}" and Designation: "${desigName}"`);

  await prisma.$disconnect();
}

generateTestFiles().catch(console.error);
