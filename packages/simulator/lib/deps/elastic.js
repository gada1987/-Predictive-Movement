const elastic = require('@elastic/elasticsearch'); // Import Elasticsearch client library

const mappings = require('../../data/elasticsearch_mappings.json'); // Import Elasticsearch mappings configuration
const { error, info } = require('../log'); // Import error and info logging utilities

const host = process.env.ELASTICSEARCH_URL; // Retrieve Elasticsearch URL from environment variables

// Check if Elasticsearch URL is provided
if (!host) {
  info('No elasticsearch url provided, skipping statistics collection'); // Log info message if no Elasticsearch URL is provided

  // Define no-operation functions for save and createIndices
  const noOp = () => () => {
    // info(`noOp: ${name}`)
  };

  // Export no-operation functions for save and createIndices
  module.exports = {
    save: noOp('save'),
    createIndices: noOp('createIndices'),
  };

  return; // Exit module execution
} else {
  info(`Elasticsearch url provided, collecting statistics to ${host}`); // Log info message if Elasticsearch URL is provided
}

const client = new elastic.Client({ node: host, log: 'error' }); // Create Elasticsearch client instance

// Function to create indices based on mappings configuration
const createIndices = () =>
  Promise.all(
    Object.keys(mappings).map((index) => {
      return client.indices
        .create({
          index,
          body: mappings[index], // Use mappings configuration for index creation
        })
        .catch((err) => {
          let errorType;
          try {
            errorType = JSON.parse(err.response)?.error?.type; // Parse Elasticsearch error response to get error type
          } catch (e) {
            error(
              '>>>= Cannot create indices, Malformed Elasticsearch Error',
              e,
              err
            ); // Log error for malformed Elasticsearch error response
          }
          if (errorType === 'resource_already_exists_exception') {
            error(`
            Index ${index} already mapped.
            If you want to re-map it:
            - Delete it in Elasticsearch
            - Re-run this script
            - Recreate "index pattern" in kibana.
          `); // Log error message if index already exists in Elasticsearch
          } else {
            error('>>>= Cannot create indices, Unkown Elasticsearch Error', err); // Log error for unknown Elasticsearch error
          }
        });
    })
  );

// Function to save booking data to Elasticsearch
const save = (booking, indexName) => {
  return client
    .index({
      index: indexName,
      id: booking.id,
      body: booking, // Save booking data to specified index
    })
    .then(() => {})
    .catch((e) => {
      error('Could not save booking', e); // Log error if saving booking fails
    });
};

// Function to perform search query in Elasticsearch
const search = (searchQuery) => {
  return client.search(searchQuery); // Perform search query using Elasticsearch client
};

// Export functions for creating indices, saving bookings, and searching
module.exports = {
  createIndices,
  save,
  search,
};
