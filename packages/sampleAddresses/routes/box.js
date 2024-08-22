// Import the 'express' library to create the Express application.
const express = require('express');
// Create an instance of the Express application.
const app = express();
// Import 'assert' for assertion checks.
const assert = require('assert');
// Import the 'fetchAdresses' function from the 'elasticsearch' module.
const { fetchAdresses } = require('../lib/elasticsearch');
// Import 'info' from 'console' (though it's not used in this code).
const { info } = require('console');

// Function to construct a search query for Pelias.
const query = (topleft, bottomright, size, seed) => ({
  size, // Number of results to return
  query: {
    function_score: {
      query: {
        bool: {
          must: {
            match_all: {}, // Match all documents
          },
          filter: {
            geo_bounding_box: {
              center_point: {
                top_left: { lon: topleft[0], lat: topleft[1] }, // Top-left corner of the bounding box
                bottom_right: {
                  lon: bottomright[0],
                  lat: bottomright[1], // Bottom-right corner of the bounding box
                },
              },
            },
          },
        },
      },
      random_score: {
        seed, // Seed for random scoring
        field: '_seq_no', // Field to use for random scoring
      },
    },
  },
});

// Define a route handler for the root path ('/').
app.get('/', (req, res) => {
  // Parse query parameters from the request.
  const seed = parseFloat(req.query.seed) || 1337; // Default seed value if not provided
  const topleft = (req.query.topleft || req.query.tl) // Top-left corner
    ?.split(',')
    .map(parseFloat); // Convert to array of numbers

  const bottomright = (req.query.bottomright || req.query.br) // Bottom-right corner
    ?.split(',')
    .map(parseFloat); // Convert to array of numbers

  const size = req.query.size || 10; // Number of results to return (default 10)

  // Assert that the size is less than or equal to 10000.
  assert(size <= 10000, 'Maximum size 10000');
  // Assert that 'topleft' is a valid coordinate pair (latitude, longitude).
  assert(
    topleft?.length === 2,
    'topleft is not a valid coordinate pair (lat,lon)'
  );
  // Assert that 'bottomright' is a valid coordinate pair (latitude, longitude).
  assert(
    bottomright?.length === 2,
    'bottomright is not a valid coordinate pair (lat,lon)'
  );

  // Fetch addresses using the constructed query.
  fetchAdresses(query(topleft, bottomright, size, seed))
    .then((addresses) => {
      // Send the addresses as a JSON response.
      res.json(addresses);
    })
    .catch((err) => {
      // Handle errors by rejecting the promise.
      Promise.reject(err);
    });
});

// Export the Express application.
module.exports = app;
