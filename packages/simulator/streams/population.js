const { from, shareReplay, filter } = require('rxjs');
const { map } = require('rxjs/operators');
const { readCsv } = require('../lib/utils/adapters/csv'); // Utility function to read CSV files
const coords = require('swe-coords'); // Library for handling Swedish coordinate systems
const { convertPosition } = require('../lib/utils/geo/distance'); // Function to convert coordinates

/**
 * Converts a SWEREF99 coordinate string to a WGS84 lat/lon object.
 * 
 * SWEREF99 coordinates are typically in a format where the first 6 digits represent
 * the x-coordinate and the next 6 digits represent the y-coordinate. This function
 * converts these coordinates to a WGS84 latitude and longitude.
 * 
 * TODO: Determine whether the given coordinate represents the center or the top-left
 * corner of the square kilometer area. If it is the top-left corner, consider adding
 * an offset to get the center of the square.
 * 
 * @param {string} ruta - The SWEREF99 coordinate string (12 characters long).
 * @returns {Object} An object with `lat` and `lon` properties in WGS84 coordinates.
 */
function parseRuta(ruta) {
  return convertPosition(coords.toLatLng(ruta.slice(6), ruta.slice(0, 6)));
}

/**
 * Reads population data from a CSV file, processes it, and returns an observable stream.
 * 
 * The CSV file is expected to contain population data for square kilometer areas.
 * The function processes each record to extract and convert relevant data, filters
 * out areas with zero population, and returns an observable stream of the processed data.
 * 
 * @returns {Observable} An observable stream of processed population data.
 */
function read() {
  return from(readCsv(process.cwd() + '/data/population/5arsklasser_1km.csv')).pipe(
    // Map each record to an object with parsed and converted fields
    map(({ id, rutstorl: area, ruta, beftotalt: population, ...ages }) => ({
      id,
      area,
      ruta,
      position: parseRuta(ruta), // Convert SWEREF99 coordinates to WGS84
      ages: Object.values(ages).map((nr) => parseFloat(nr, 10)), // Convert age data to floats
      population: parseFloat(population, 10), // Convert population to float
    })),
    // Filter out records where population is zero or less
    filter((p) => p.population > 0),
    // Share the observable's output and replay it to new subscribers
    shareReplay()
  );
}

// Export the observable stream from the `read` function
module.exports = read();
