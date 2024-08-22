const fs = require('fs'); // Import the 'fs' module to interact with the file system
const XLSX = require('xlsx'); // Import the 'xlsx' module to read and write Excel files

// Function to read and parse an Excel file
const readXlsx = (path, sheet) => {
  const buf = fs.readFileSync(path); // Read the file synchronously from the given path
  const wb = XLSX.read(buf, { type: 'buffer' }); // Parse the file as an Excel workbook

  return XLSX.utils.sheet_to_json(wb.Sheets[sheet]); // Convert the specified sheet to JSON format
};

module.exports = { readXlsx }; // Export the 'readXlsx' function for use in other modules
