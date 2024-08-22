const { from, shareReplay, filter, of } = require('rxjs'); // RxJS functions for creating observables
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
const moment = require('moment'); // Moment.js for handling dates
const { readCsv } = require('../../../lib/utils/adapters/csv'); // Utility to read CSV files
const { default: fetch } = require('node-fetch'); // Fetch API for making HTTP requests
const { searchOne } = require('../../../lib/deps/pelias'); // Function to search addresses
const Position = require('../../../lib/class/geo/position'); // Class for geographic positions
const Booking = require('../../../lib/class/booking'); // Class for booking instances
const { error } = require('../../../lib/log'); // Logging utility
// Import the central configuration
const centralConfig = require('../../../config/loadCentralConfig');
const importOrigins = ['poznan, pl', 'tilburg, nl']; // List of origins for import
const streamsUrl =
  process.env.STREAMS_URL || 'https://sample-address:4100//addresses'; // URL for fetching addresses
  const bookingsPath = centralConfig.paths.hmBooking;

/**
 * Reads and processes booking data from a CSV file.
 * 
 * @returns {Observable<Booking>} - Observable stream of Booking instances.
 */
function read() {
  // Read the CSV file and process each row
  return from(readCsv(process.cwd() + '/data/bookings/helsingborg/hm.csv')).pipe(
    map(
      ({
        CustomerOrderNumber: id,
        Pieces: quantity,
        ZipCode: deliveryZip,
        ShippedDate: deliveryDate,
        WarehouseCode: origin,
        ShippedDate: created,
        Weight: weight,
      }) => ({
        id,
        quantity: +quantity, // Convert quantity to number
        deliveryZip,
        deliveryDate: moment(deliveryDate, 'YYYY/MM/DD HH:mm').valueOf(), // Convert to timestamp
        origin,
        sender: 'H&M', // Fixed sender name
        created: moment(created, 'YYYY/MM/DD HH:mm').valueOf(), // Convert to timestamp
        weight: weight / 1000, // Convert weight from grams to kilograms
      })
    ),
    filter((row) => moment(row.created).isSame('2022-09-07', 'day')), // Filter rows created on a specific date
    filter((hm) => hm.deliveryZip), // Filter rows with a valid delivery zip code
    groupBy((row) => row.id), // Group rows by order ID
    mergeMap((group) =>
      group.pipe(
        toArray(), // Convert grouped rows to an array
        map((rows) => ({ key: group.key, rows })) // Create an object with the group key and rows
      )
    ),
    mergeMap(
      ({ key, rows }) =>
        fetch(`${streamsUrl}/zip/${rows[0].deliveryZip}?size=1&seed=${key}`) // Fetch addresses for the delivery zip
          .then((res) => res.json())
          .then((addresses) =>
            addresses.map(({ address, position }, i) => ({
              destination: { address, position: new Position(position) }, // Create destination with position
              ...rows[i], // Merge row data with destination
            }))
          ),
      5 // Limit the number of concurrent requests
    ),
    retryWhen((errors) =>
      errors.pipe(
        tap((err) => error('Zip streams error, retrying in 1s...', err)), // Log errors and retry after a delay
        delay(1000)
      )
    ),
    catchError((err) => {
      error('HM -> from CSV', err); // Log any errors encountered
      return of({}); // Return an empty observable on error
    }),
    mergeAll(), // Flatten the observable of observables
    groupBy((row) => row.origin), // Group rows by origin
    mergeMap((group) =>
      group.pipe(
        toArray(), // Convert grouped rows to an array
        map((rows) => ({ key: group.key, rows })) // Create an object with the group key and rows
      )
    ),
    mergeMap(({ key, rows }, i) => {
      // TODO: Distribute orders to distribution centers
      const distributionCenters = [
        'Mineralgatan 5, Helsingborg', // PostNord
        'Brunkalundsvägen 4, Helsingborg', // Schenker
        'Trintegatan 10, Helsingborg', // DHL
        'Strandbadsvägen 7, Helsingborg', // TNT
      ];

      return searchOne(distributionCenters[i % 4]).then(({ name, position }) =>
        rows.map((row) => ({ pickup: { name, position }, ...row })) // Create bookings with pickup details
      );
    }, 1),
    retryWhen((errors) =>
      errors.pipe(
        tap((err) => error('Pelias error, retrying in 1s...', err)), // Log errors and retry after a delay
        delay(1000)
      )
    ),
    mergeAll(1), // Flatten the observable of observables
    map((row) => new Booking({ type: 'parcel', ...row })), // Create Booking instances
    catchError((err) => {
      error('HM -> from CSV', err); // Log any errors encountered
    }),
    shareReplay() // Share and replay the observable values
  );
}

module.exports = read(); // Export the read function's observable stream
