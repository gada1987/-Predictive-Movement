const fs = require('fs'); // File system module for reading and writing files
const { from } = require('rxjs'); // RxJS to create observables from arrays
const { map, tap, toArray } = require('rxjs/operators'); // RxJS operators for transforming and handling observables
const Booking = require('../../lib/class/booking'); // Booking class
const { dirname: getDirName } = require('path'); // Path utility to get directory name

/**
 * Cleans and structures a booking object for consistency and easier handling.
 * 
 * @param {Object} booking - The booking object to clean.
 * @returns {Object} - The cleaned booking object.
 */
const cleanBooking = ({
  id,
  origin,
  pickup: { position: pickup } = {}, // Extract pickup position
  finalDestination: { position: finalDestination } = {}, // Extract final destination position
  destination: { position: destination, name }, // Extract destination position and name
  type,
}) => ({
  id,
  origin,
  pickup: { position: pickup }, // Cleaned pickup position
  finalDestination:
    (finalDestination && { position: finalDestination }) || undefined, // Cleaned final destination, only include if it exists
  destination: { position: destination, name }, // Cleaned destination
  type
});

/**
 * Writes a stream of bookings to a JSON file.
 * 
 * @param {string} filename - The path to the file to write.
 * @returns {Function} - A function that takes a stream and writes it to the specified file.
 */
const write = (filename) => (stream) =>
  stream.pipe(
    map(cleanBooking), // Clean each booking object
    toArray(), // Collect all values into an array
    tap((arr) => {
      // Ensure the directory exists and write the cleaned bookings to the file
      fs.mkdir(getDirName(filename), { recursive: true }, (err) => {
        if (err) {
          console.error(err); // Log any directory creation errors
          return;
        }
        fs.writeFileSync(filename, JSON.stringify(arr)); // Write array as JSON to the file
      });
    })
  );

/**
 * Reads bookings from a JSON file and converts them into Booking instances.
 * 
 * @param {string} filename - The path to the file to read.
 * @returns {Observable<Booking[]>} - An observable stream of Booking instances.
 */
const read = (filename) =>
  fs.existsSync(filename) // Check if the file exists
    ? from(JSON.parse(fs.readFileSync(filename))).pipe(
        map((b) => new Booking(b)) // Convert each parsed object into a Booking instance
      )
    : from([]); // Return an empty observable if the file does not exist

module.exports = { read, write }; // Export the functions for external use
