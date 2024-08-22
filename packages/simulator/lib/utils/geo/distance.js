// Function to convert various position formats to a standard format with latitude and longitude
function convertPosition(pos) {
  return {
    lon: pos.longitude || pos.lon || pos.lng || pos[0],
    lat: pos.latitude || pos.lat || pos[1],
  };
}

// Function to calculate the distance between two points using the Pythagorean theorem
function pythagoras(from, to) {
  from = convertPosition(from); // Convert 'from' position to standard format
  to = convertPosition(to); // Convert 'to' position to standard format
  // Quick approximation with Pythagoras' theorem
  return Math.sqrt(
    Math.pow(Math.abs(from.lat - to.lat), 2) +
      Math.pow(Math.abs(from.lon - to.lon), 2)
  );
}

// Function to convert degrees to radians
function rad(x) {
  return (x * Math.PI) / 180;
}

/* Function to calculate the distance in meters between two points using the Haversine formula.
 */
function haversine(p1, p2) {
  p1 = convertPosition(p1); // Convert 'p1' position to standard format
  p2 = convertPosition(p2); // Convert 'p2' position to standard format

  const R = 6371000; // Earth's radius in meters
  const dLat = rad(p2.lat - p1.lat); // Difference in latitude in radians
  const dLong = rad(p2.lon - p1.lon); // Difference in longitude in radians

  const a =
    Math.sin(dLat / 2) * Math.sin(dLat / 2) +
    Math.cos(rad(p1.lat)) *
      Math.cos(rad(p2.lat)) *
      Math.sin(dLong / 2) *
      Math.sin(dLong / 2); // Haversine formula
  const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a)); // Angular distance in radians
  const d = R * c; // Distance in meters

  return Math.round(d) || 0; // Return the rounded distance
}

// Function to calculate the bearing (direction) from one point to another
function bearing(p1, p2) {
  return Math.round(
    (Math.atan2(
      Math.cos(p1.lat) * Math.sin(p2.lat) -
        Math.sin(p1.lat) * Math.cos(p2.lat) * Math.cos(p2.lon - p1.lon),
      Math.sin(p2.lon - p1.lon) * Math.cos(p2.lat)
    ) *
      180) /
      Math.PI
  );
}

/* Function to add meters to a position.
 * x: meters to add to longitude
 * y: meters to add to latitude
 */
function addMeters(p1, { x, y }) {
  p1 = convertPosition(p1); // Convert 'p1' position to standard format
  const R = 6371000; // Earth's radius in meters

  lat = p1.lat + (y / R) * (180 / Math.PI); // Calculate new latitude
  lon =
    p1.lon + ((x / R) * (180 / Math.PI)) / Math.cos((p1.lat * Math.PI) / 180); // Calculate new longitude

  return { lon, lat }; // Return the new position
}

// Function to get a number of points between two positions
function getNrOfPointsBetween(p1, p2, quantity) {
  var points = new Array(); // Array to store the points
  var latDiff = p2.lat - p1.lat, // Difference in latitude
    lonDiff = p2.lon - p1.lon; // Difference in longitude
  var slope = (p2.lat - p1.lat) / (p2.lon - p1.lon); // Slope of the line between the points
  var lon, lat;

  for (var i = 0; i <= quantity; i++) {
    if (slope == 0) {
      lat = 0;
      lon = lonDiff * (i / quantity); // Calculate longitude for horizontal line
    }
    if (slope != 0) {
      lat = latDiff * (i / quantity); // Calculate latitude
      lon = lat / slope; // Calculate longitude based on slope
    }

    points.push({ lon: lon + p1.lon, lat: lat + p1.lat }); // Add point to array
  }

  return points; // Return the array of points
}

module.exports = {
  pythagoras, // Export the pythagoras function
  haversine, // Export the haversine function
  bearing, // Export the bearing function
  convertPosition, // Export the convertPosition function
  addMeters, // Export the addMeters function
  getNrOfPointsBetween, // Export the getNrOfPointsBetween function
};
