const { from, shareReplay, filter } = require('rxjs'); // RxJS functions for creating observables and sharing results
const {
  map,
  toArray,
  mergeMap,
  groupBy,
  mergeAll,
  catchError,
  retryWhen,
  tap,
  delay,
} = require('rxjs/operators'); // RxJS operators for transforming observables
const moment = require('moment'); // Moment.js for date manipulation
const { readCsv } = require('../../../lib/utils/adapters/csv'); // Utility function to read CSV files
const { default: fetch } = require('node-fetch'); // Fetch API for HTTP requests
const { searchOne } = require('../../../lib/deps/pelias'); // Function to search for addresses
const Position = require('../../../lib/class/geo/position'); // Class for handling geographic positions
const Booking = require('../../../lib/class/booking'); // Class for booking instances
const { error } = require('../../../lib/log'); // Logging utility for error handling
// Import the central configuration
const centralConfig = require('../../../config/loadCentralConfig');


const streamsUrl =
  process.env.STREAMS_URL || 'https://sample-address:4100/addresses'; // URL for address lookup
  const bookingsPath = centralConfig.paths.ikeaBooking;

/**
 * Reads and processes booking data from a CSV file.
 * 
 * @returns {Observable<Booking[]>} - Observable stream of Booking instances.
 */
function read() {
  return from(readCsv(process.cwd() + '/data/bookings/helsingborg/ikea.csv')).pipe(
    // Map each row to a booking object with relevant fields
    map(
      ({
        order_id: id,
        quantity,
        delivery_zip: deliveryZip,
        delivery_date: deliveryDate,
        origin,
        created,
        volume,
        weight,
        length,
      }) => ({
        id,
        quantity,
        deliveryZip,
        deliveryDate: moment(deliveryDate, 'YYYY-MM-DD').valueOf(), // Convert delivery date to timestamp
        origin,
        sender: 'IKEA', // Fixed sender name
        created: moment(created, 'YYYY-MM-DD').valueOf(), // Convert creation date to timestamp
        volume,
        weight,
        length,
      })
    ),
    filter((row) => moment(row.created).isSame('2022-09-07', 'week')), // Filter rows from a specific week
    filter((row) => row.deliveryZip), // Filter rows with valid delivery zip code
    groupBy((row) => row.id), // Group rows by order ID
    mergeMap((group) =>
      group.pipe(
        toArray(), // Convert grouped rows to an array
        map((rows) => ({ key: group.key, rows })) // Create an object with the group key and rows
      )
    ),
    mergeMap(
      ({ key, rows }) =>
        fetch(`${streamsUrl}/zip/${rows[0].deliveryZip}?size=1&seed=${key}`) // Fetch address for the delivery zip
          .then((res) => res.json())
          .then((addresses) =>
            addresses.map(({ address, position }, i) => ({
              destination: { address, position: new Position(position) }, // Create destination with position
              ...rows[i], // Merge row data with destination
            }))
          ),
      1 // Limit the number of concurrent fetch requests
    ),
    retryWhen((errors) =>
      errors.pipe(
        tap((err) => error('Zip streams error, retrying in 1s...', err)), // Log errors and retry after a delay
        delay(1000)
      )
    ),
    mergeAll(), // Flatten the observable of observables
    groupBy((row) => row.origin), // Group rows by origin
    mergeMap((group) =>
      group.pipe(
        toArray(), // Convert grouped rows to an array
        map((rows) => ({ key: group.key, rows })) // Create an object with the group key and rows
      )
    ),
    mergeMap(({ rows }, i) => {
      // TODO: Determine a method to distribute orders to distribution centers
      const distributionCenters = [
        'Mineralgatan 5, Helsingborg', // PostNord
        'Brunkalundsvägen 4, Helsingborg', // Schenker
        'Trintegatan 10, Helsingborg', // DHL
        'Strandbadsvägen 7, Helsingborg', // TNT
      ];

      return searchOne(distributionCenters[i % 4]).then(({ name, position }) =>
        rows.map((row) => ({ pickup: { name, position }, ...row })) // Add pickup location to each row
      );
    }, 1), // Limit the number of concurrent search requests
    mergeAll(), // Flatten the observable of observables
    map((row) => new Booking({ type: 'parcel', ...row })), // Create Booking instances
    toArray(), // Convert the stream of Booking instances to an array
    map((bookings) => {
      console.log('IKEA -> bookings', bookings.length); // Log the number of bookings created
      return bookings; // Return the bookings array
    }),
    mergeAll(), // Flatten the observable of observables
    catchError((err) => {
      error('IKEA -> from CSV', err); // Log any errors encountered
      return of([]); // Return an empty array in case of errors
    }),
    shareReplay() // Share and replay the observable values
  );
}

module.exports = read(); // Export the read function's observable stream
