// Import the 'node-fetch' library to make HTTP requests.
const fetch = require('node-fetch');

// Function to fetch addresses from a Pelias server.
const fetchAddresses = async (query) => {
  // Get the Pelias server hostname from environment variables or use a default value.
  const peliasHostname = process.env.PELIAS_HOSTNAME || '194.28.122.68:9200'; // Default to a specific IP if not defined
  // Construct the URL for the Pelias search endpoint.
  const url = `http://${peliasHostname}/pelias/_search`;

  // Make an HTTP POST request to the Pelias search endpoint with the provided query.
  const json = await fetch(url, {
    method: 'POST', // Use POST method as required by Pelias API for search queries
    body: JSON.stringify(query, null, 2), // Convert query object to JSON string
    headers: { 'Content-Type': 'application/json' }, // Set the content type to JSON
  })
  // Parse the response body as JSON.
  .then((res) => res.json());

  // Check if there's an error in the response and throw an exception if present.
  if (json.error) {
    console.error('elastic error', json.error); // Log the error message
    throw new Error('Error in database query'); // Throw an error to indicate a failure in fetching data
  }

  // Extract the 'hits' array from the JSON response.
  const hits = json.hits.hits;

  // Map through the hits to transform the data into a more usable format.
  const addresses = hits
    .map((hit) => hit) // Identity operation, can be omitted if not needed
    .map(
      ({
        _id: id, // Extract document ID
        _source: {
          center_point: position, // Extract the position (coordinates)
          address_parts: address, // Extract the address components
          name: { default: name } = {}, // Extract the default name, handle cases where 'name' may be undefined
        },
      }) => ({
        address, // Address components
        name, // Default name
        position, // Coordinates
        id, // Document ID
      })
    );

  // Return the formatted addresses array.
  return addresses;
};

// Export the fetchAddresses function for use in other modules.
module.exports = {
  fetchAddresses,
};
