const ExcelJS = require("exceljs");
const path = require("path");

async function generateTestFiles() {
  const validWorkbook = new ExcelJS.Workbook();
  const validSheet = validWorkbook.addWorksheet("Employees");
  
  // Headers
  validSheet.addRow([
    "Email*", "First Name*", "Last Name*", "Phone Number", 
    "Department", "Designation", "Employee Type", "Date of Joining"
  ]);
  
  // Row 1: Valid employee (IT / software developer)
  validSheet.addRow([
    "dev1@company.com", "Alice", "Developer", "9876543210", 
    "IT", "software developer", "PERMANENT", "2023-01-01"
  ]);
  
  // Row 2: Valid employee (HR / employee)
  validSheet.addRow([
    "hr1@company.com", "Bob", "Manager", "9876543211", 
    "HR", "employee", "CONTRACT", "2023-02-01"
  ]);
  
  await validWorkbook.xlsx.writeFile(path.join(__dirname, "valid_upload.xlsx"));
  console.log("Created valid_upload.xlsx");
}

generateTestFiles().catch(console.error);
