// Import the 'express' library to create the Express application.
const express = require('express');
// Create an instance of the Express application.
const app = express();
// Import 'assert' for assertion checks.
const assert = require('assert');
// Import the 'fetchAdresses' function from the 'elasticsearch' module.
const { fetchAdresses } = require('../lib/elasticsearch');

// Function to construct a search query for Pelias based on ZIP code.
const query = (zipnr, seed, size) => ({
  query: {
    function_score: {
      query: {
        wildcard: {
          'address_parts.zip': zipnr, // Wildcard query to match addresses with the given ZIP code
        },
      },
      random_score: {
        seed: seed, // Seed for random scoring
        field: '_seq_no', // Field to use for random scoring
      },
    },
  },
  size: size, // Number of results to return
});

// Define a route handler for GET requests with a ZIP code parameter.
app.get('/:zipnr', (req, res) => {
  // Parse query parameters from the request.
  const seed = parseFloat(req.query.seed) || 1337; // Default seed value if not provided
  const zipnr = parseFloat(req.params.zipnr); // ZIP code from route parameters
  const size = parseFloat(req.query.size) || 10; // Number of results to return (default 10)

  // Assertion to check that the size is less than or equal to 10000.
  assert(size <= 10000, 'Maximum size 10000');
  // Assertion to check that the ZIP code is a positive number.
  assert(zipnr > 0, 'Parameter: zipnr is required');

  // Fetch addresses using the constructed query.
  fetchAdresses(query(zipnr, seed, size))
    .then((addresses) => {
      // Send the addresses as a JSON response.
      res.json(addresses);
    })
    .catch((err) => {
      // Handle errors by rejecting the promise.
      Promise.reject(err);
    });
});

// Export the Express application for use in other modules.
module.exports = app;
