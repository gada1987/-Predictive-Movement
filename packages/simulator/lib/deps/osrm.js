const fetch = require('node-fetch'); // Import node-fetch for making HTTP requests
const polyline = require('polyline'); // Import polyline for encoding/decoding polylines
const { centralConfig } = require('../../config'); // Import the config
const osrmUrl = centralConfig.servers.osrm; // Use the URL from the config
//const osrmUrl =
  // eslint-disable-next-line no-undef
  //process.env.OSRM_URL || // Get OSRM URL from environment variable
  //'http://194.28.122.68:5000' || // Default OSRM URL if environment variable is not set
  //'http://localhost:5000'; // Default OSRM URL if others are not defined
const { warn, write } = require('../log'); // Import warn and write functions from logging module

// Function to decode a polyline geometry into an array of { lat, lon } points
const decodePolyline = function (geometry) {
  return polyline.decode(geometry).map((point) => ({
    lat: point[0],
    lon: point[1],
  }));
};

// Function to encode an array of { lat, lon } points into a polyline geometry
const encodePolyline = function (geometry) {
  return polyline.encode(geometry.map(({ lat, lon }) => [lat, lon]));
};

// Exported module containing functions related to OSRM routing and operations
module.exports = {
  // Function to retrieve the fastest route from OSRM between two points
  route(from, to) {
    const coordinates = [
      [from.lon, from.lat],
      [to.lon, to.lat],
    ].join(';');
    return (
      fetch(
        `${osrmUrl}/route/v1/driving/${coordinates}?steps=true&alternatives=false&overview=full&annotations=true`
      )
        .then(
          (res) =>
            (res.ok && res.json()) ||
            res.text().then((text) => Promise.reject(text)) // Handle cases where response is not JSON
        )
        .then((result) => {
          // Extract the fastest route based on duration
          const fastestRoute =
            result.routes && result.routes.sort((a, b) => a.duration < b.duration)[0];
          if (!fastestRoute) return {}; // Return empty object if no route found

          fastestRoute.geometry = { coordinates: decodePolyline(fastestRoute.geometry) }; // Decode polyline geometry into coordinates array
          return fastestRoute; // Return the fastest route object
        })
    );
  },
  // Function to find the nearest point to a given position using OSRM
  nearest(position) {
    const coordinates = [position.lon, position.lat].join(',');
    const url = `${osrmUrl}/nearest/v1/driving/${coordinates}`;
    write('n'); // Log 'n' for nearest operation
    return fetch(url).then(
      (response) => response.json(), // Parse response as JSON
      (err) => {
        warn('OSRM fetch err', err.message, url); // Log warning if fetch operation fails
      }
    );
  },
  // Function to match a sequence of positions to the nearest road network using OSRM
  match(positions) {
    const coordinates = positions
      .map((pos) => [pos.position.lon, pos.position.lat].join(','))
      .join(';');
    const timestamps = positions
      .map((pos) => Math.round(+pos.date / 1000))
      .join(';');
    write('m'); // Log 'm' for match operation

    return fetch(
      `${osrmUrl}/match/v1/driving/${coordinates}?timestamps=${timestamps}&geometries=geojson&annotations=true&overview=full`
    ) // Fetch matched route with additional annotations
      .then((response) => response.json()) // Parse response as JSON
      .then((route) => route); // Return the matched route object
  },
  decodePolyline, // Expose decodePolyline function
  encodePolyline, // Expose encodePolyline function
};
