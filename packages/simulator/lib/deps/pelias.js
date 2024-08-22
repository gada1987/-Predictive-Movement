const fetch = require('node-fetch'); // Import node-fetch for making HTTP requests
const { info, error, write, debug } = require('../log'); // Import logging functions
const Position = require('../class/geo/position'); // Import Position class for geo coordinates
const { centralConfig } = require('../../config'); // Import the config
const peliasUrl = centralConfig.servers.pelias; // Use the URL from the config

//const peliasUrl =
  //process.env.PELIAS_URL || // Get Pelias URL from environment variable
 // 'http://194.28.122.68:3100'; // Default Pelias URL if environment variable is not set

info('Pelias URL', peliasUrl); // Log Pelias URL info

// Function to find the nearest address or venue using Pelias
const nearest = (position, layers = 'address,venue') => {
  const { lon, lat } = position;
  const url = `${peliasUrl}/v1/reverse?point.lat=${lat}&point.lon=${lon}&size=1&layers=${layers}`; // Construct Pelias reverse geocoding URL
  const promise = fetch(url) // Perform fetch request
    .then((response) => {
      if (!response.ok) throw 'pelias error: ' + response.statusText; // Handle non-ok response
      return response.json(); // Parse response as JSON
    })
    .then((p) =>
      p.features[0]?.geometry?.coordinates?.length // Extract coordinates from response
        ? p
        : Promise.reject('No coordinates found' + position.toString()) // Handle case where no coordinates are found
    )
    .then(
      ({
        features: [
          {
            geometry,
            properties: { name, street, houseNumber, localadmin, label }, // Extract relevant properties
          } = {},
        ] = [],
      }) => ({
        name,
        street,
        houseNumber,
        label,
        localadmin,
        position: new Position({
          lon: geometry.coordinates[0],
          lat: geometry.coordinates[1],
        }), // Create Position object from coordinates
      })
    )
    .catch((e) => {
      const errorObj = new Error().stack; // Get stack trace for error
      error(`Error in pelias nearest\n${errorObj}\n${e}\n\n`); // Log error
    });

  return promise; // Return the promise
};

// Function to search for places using Pelias
const search = (name, near = null, layers = 'address,venue', size = 1000) => {
  const encodedName = encodeURIComponent(name); // Encode search name
  const focus = near // Construct focus parameters if near position is provided
    ? `&focus.point.lat=${near.lat}&focus.point.lon=${near.lon}&layers=${layers}`
    : '';
  const url = `${peliasUrl}/v1/search?text=${encodedName}${focus}&size=${size}`; // Construct Pelias search URL
  debug('url', url); // Log debug information with constructed URL

  return fetch(url) // Perform fetch request
    .then((response) => {
      if (!response.ok) throw 'pelias error: ' + response.statusText; // Handle non-ok response
      return response.json(); // Parse response as JSON
    })
    .then((results) =>
      results.features
        .map(({ geometry, properties } = {}) => ({
          ...properties,
          position: new Position({
            lon: geometry.coordinates[0],
            lat: geometry.coordinates[1],
          }), // Create Position object for each result
        }))
        .filter((p) => p.position.isValid()) // Filter out results with invalid positions
    )
    .catch((e) => {
      const peliasError = new Error().stack; // Get stack trace for error
      error(`Error in pelias search\n${url}\n${peliasError}\n${e}\n\n`); // Log error
      return Promise.reject(new Error('Error in pelias', peliasError)); // Reject promise with error
    });
};

const cache = new Map(); // Create a cache using Map

// Function to search for one place using Pelias, with caching support
const searchOne = async (name, near = null, layers = 'address,venue') => {
  const cacheKey = !near && name + layers; // Generate cache key based on parameters
  if (cacheKey && cache.has(cacheKey)) return cache.get(cacheKey); // Return cached result if available
  const results = await search(name, near, layers, 1); // Perform search for single result
  if (cacheKey) cache.set(cacheKey, results[0]); // Cache the result if cacheKey exists
  return results[0]; // Return the first result
};

module.exports = {
  nearest,
  search,
  searchOne,
};
