// Import the custom Elasticsearch module
// This module is expected to provide Elasticsearch utilities and functions.
const elastic = require('./lib/deps/elastic');

// Call the `createIndices` function from the `elastic` module
// This function is responsible for setting up or initializing Elasticsearch indices.
elastic.createIndices();
