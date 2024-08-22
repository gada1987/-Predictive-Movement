// Import the 'express' library to create the Express application.
const express = require('express');
// Create an instance of the Express application.
const app = express();
// Import route handlers for '/zip' and '/box' endpoints.
const zip = require('./routes/zip');
const box = require('./routes/box');

// Mount the '/zip' router to handle routes starting with '/zip'.
app.use('/zip', zip);
// Mount the '/box' router to handle routes starting with '/box'.
app.use('/box', box);

// Define a route handler for the root path ('/') to provide a welcome message and API documentation.
app.get('/', (req, res) => {
  res.json({
    message: 'Welcome to the PM sample addresses API', // Welcome message for the API
    routes: {
      'GET /zip/:zipnr': 'Get addresses from a zip code', // Description of the '/zip/:zipnr' route
      'GET /box/?topleft=lat,lon&bottomright=lat,lon': 'Get addresses from a bounding box', // Description of the '/box' route
    },
    examples: [
      'GET /zip/11646?size=10&seed=1337', // Example request for the '/zip' route
      'GET /box/?topleft=13.085098058715708,57.96539874381225&bottomright=13.025098058715708,57.91539874381225', // Example request for the '/box' route with 'topleft' and 'bottomright'
      'GET /box/?tl=13.085098058715708,57.96539874381225&br=13.025098058715708,57.91539874381225', // Example request for the '/box' route with 'tl' and 'br'
    ],
    options: {
      seed: 'Random seed', // Description of the 'seed' query parameter
      size: 'Number of addresses to return', // Description of the 'size' query parameter
    },
  });
});

// Define a generic error handler to catch and format errors in JSON format.
app.use((err, req, res, next) => {
  console.error(err); // Log the error to the console
  res.status(500).json({ error: err.message }); // Send a JSON response with the error message and a 500 status code
});

// Determine the port to listen on (either from the environment variable or default to 4001).
const port = process.env.PORT || 4001;
// Start the Express server and listen on the specified port.
app.listen(port, () =>
  console.log(`Sample Addresses service listening on port ${port}!`) // Log a message indicating that the server is running
);
