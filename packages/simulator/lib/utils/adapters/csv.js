const fs = require('fs'); // Import the 'fs' module to interact with the file system
const parse = require('csv-parse'); // Import the 'csv-parse' module to parse CSV files

// Function to read and parse a CSV file
const readCsv = (path) => {
  const input = fs.readFileSync(path); // Read the file synchronously from the given path
  return parse(input, {
    columns: true, // Parse the CSV file with columns as keys
    skip_empty_lines: true, // Skip empty lines in the CSV file
  });
};

module.exports = { readCsv }; // Export the 'readCsv' function for use in other modules
