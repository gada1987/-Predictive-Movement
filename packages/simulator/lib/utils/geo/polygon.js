const inside = require('point-in-polygon'); // Import the point-in-polygon library

/**
 * Checks if a given point is inside any of the provided polygon coordinates.
 * 
 * @param {Object} point - The point to check, with properties lon (longitude) and lat (latitude).
 * @param {Array} coordinates - An array of polygon coordinates, where each polygon is represented by an array of points.
 * @returns {boolean} - Returns true if the point is inside any of the provided polygons, otherwise false.
 */
function isInsideCoordinates({ lon, lat }, coordinates) {
  return coordinates.some((coordinates) => inside([lon, lat], coordinates));
}

module.exports = { isInsideCoordinates }; // Export the isInsideCoordinates function
