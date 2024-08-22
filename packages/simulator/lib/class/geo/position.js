const { haversine } = require('../../utils/geo/distance')

// Function to convert various position representations to lon/lat format
function convertPosition(pos) {
  return {
    lon: pos.longitude || pos.lon || pos.lng || pos[0],
    lat: pos.latitude || pos.lat || pos[1],
  }
}

// Class representing a geographical position with longitude and latitude
class Position {
  constructor(pos) {
    const { lon, lat } = convertPosition(pos)
    this.lon = lon
    this.lat = lat
  }

  // Method to check if the position is valid
  isValid() {
    if (!this.lon || !this.lat) return false
    if (this.lon < -180 || this.lon > 180) return false
    if (this.lat < -90 || this.lat > 90) return false
    if (isNaN(this.lon) || isNaN(this.lat)) return false

    return true
  }

  // Method to calculate the distance to another Position using Haversine formula
  distanceTo(position) {
    return haversine(this, position)
  }

  // Method to convert the Position object to a plain object with lon/lat properties
  toObject() {
    return { lon: this.lon, lat: this.lat }
  }

  // Method to convert the Position object to a JSON string representation
  toString() {
    return JSON.stringify(this.toObject(), null, 2)
  }
}

module.exports = Position
