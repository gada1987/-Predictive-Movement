const inside = require('point-in-polygon'); // Import the point-in-polygon library to check if a point is inside a polygon

const zones = []; // Array to hold zone data. Zones could represent areas like kommun, city centers, etc.

// Transform zones into a format suitable for the 'point-in-polygon' library
const transformed = zones.map((zone) => {
  // Convert each coordinate in the zone to [longitude, latitude] format
  const coords = zone.coordinates.map((coord) => [
    coord.longitude,
    coord.latitude,
  ]);
  // Return an array with zone number and its coordinates
  return [zone.number, coords];
});

/**
 * Finds the zone that contains a given position.
 * 
 * @param {Object} position - The position to check, with properties lon (longitude) and lat (latitude).
 * @returns {Array|undefined} - Returns the zone number and coordinates if the position is inside a zone, otherwise undefined.
 */
function findZone(position) {
  // Find the zone where the position is inside the polygon
  return transformed.find((zone) => {
    return inside([position.lon, position.lat], zone[1]);
  });
}

module.exports = findZone; // Export the findZone function for use in other modules

/*

tests:

var tegnergatan = { lat: 59.338947, lon: 18.057236 }; // Example point within a zone
var testEdge = { lat: 59.286549, lon: 17.87521 }; // Example point outside any zone

console.log(findZone(tegnergatan)[0]); // Output the zone number for tegnergatan
console.log(findZone(testEdge)[0]); // Output the zone number for testEdge

*/
