const osrm = require('../lib/deps/osrm'); // OSRM (Open Source Routing Machine) for routing services
const assert = require('assert'); // For assertion checks
const Position = require('../lib/class/geo/position'); // Position class for handling geographic coordinates
const { addMeters } = require('../lib/utils/geo/distance'); // Utility function to add meters to a position
const fetch = require('node-fetch'); // For making HTTP requests
const { error } = require('../lib/log'); // Logging utility for errors

// URL for fetching address data, default is a specific IP
const streamsUrl = process.env.STREAMS_URL || 'https://194.28.122.68:4100/addresses';

/**
 * Fetches addresses within a bounding box defined by top-left and bottom-right corners.
 * 
 * @param {Object} topLeft - Top-left corner of the bounding box.
 * @param {Object} bottomRight - Bottom-right corner of the bounding box.
 * @param {number} [size=10] - Number of addresses to fetch.
 * @param {string} [layers='venue'] - Layers to include in the request.
 * @returns {Promise<Object[]>} - Promise resolving to the list of addresses.
 */
const getAddressesInBoundingBox = (
  topLeft,
  bottomRight,
  size = 10,
  layers = 'venue' // TODO: activate this feature in box.js
) =>
  fetch(
    `${streamsUrl}/box?tl=${topLeft.lon},${topLeft.lat}&br=${bottomRight.lon},${bottomRight.lat}&size=${size}&layers=${layers}}`
  ).then((res) => (res.ok ? res.json() : Promise.reject(res.text())));

/**
 * Retrieves addresses within a defined area around a central position.
 * 
 * @param {Object} position - Central position.
 * @param {number} area - Size of the area around the central position.
 * @param {number} population - Number of addresses to retrieve.
 * @returns {Promise<Object[]>} - Promise resolving to the list of addresses.
 */
const getAddressesInArea = (position, area, population) => {
  // Calculate the top-left and bottom-right corners of the bounding box
  const topLeft = addMeters(position, { x: -area / 2, y: area / 2 });
  const bottomRight = addMeters(position, { x: area / 2, y: -area / 2 });

  // Fetch addresses within the bounding box and handle potential errors
  return getAddressesInBoundingBox(topLeft, bottomRight, population).catch(
    async (err) => {
      await err;
      error('Error fetching addresses', err, position, area, population);
      return []; // Return empty array on error
    }
  );
};

/**
 * Randomly generates a nearby position within a specified radius from the center.
 * 
 * @param {Object} center - The center position to randomize around.
 * @param {number} [retry=20] - Number of retries if a valid position is not found.
 * @param {number} [radius=500] - Radius to randomize within.
 * @returns {Promise<Position>} - Promise resolving to a valid nearby position.
 */
function randomize(center, retry = 20, radius = 500) {
  assert(center, 'Center is required');
  if (retry < 0)
    throw new Error('Randomize in loop try nr' + retry + JSON.stringify(center));

  // Generate a random point within the specified radius
  const randomPoint = {
    lon: center.lon + ((Math.random() - 0.5) * radius) / 20000,
    lat: center.lat + ((Math.random() - 0.5) * radius) / 50000,
  };

  // Find the nearest valid position or retry if needed
  return nearest(randomPoint).then((pos) =>
    pos === null ? randomize(center, retry--) : pos
  );
}

/**
 * Finds the nearest valid street address to a given position.
 * 
 * @param {Object} position - The position to find the nearest street address for.
 * @returns {Promise<Position|null>} - Promise resolving to the nearest position or null if no address found.
 */
function nearest(position) {
  // Validate input position
  assert(position.lon, 'Longitude required');
  assert(position.lat, 'Latitude required');

  // Use OSRM to find the nearest address
  return osrm.nearest(position).then((data) => {
    // If no valid address is found, return null
    if (!data?.waypoints?.length) return null;

    // Extract the nearest waypoint and return as a Position instance
    const nearest = data.waypoints[0];
    const [lon, lat] = nearest.location;
    return new Position({ lon, lat });
  });
}

module.exports = {
  randomize, // Function to get a random nearby position
  nearest,   // Function to find the nearest valid street address
  getAddressesInArea, // Function to get addresses within an area around a position
};
