const fetch = require('node-fetch'); // Importing the node-fetch library for making HTTP requests
// eslint-disable-next-line no-undef
//const vroomUrl = process.env.VROOM_URL || 'http://194.28.122.68:3000'; // URL for the Vroom service, can be set via environment variable
const moment = require('moment'); // Importing the moment library for date/time manipulation
const { debug, error, info } = require('../log'); // Importing logging functions
const { getFromCache, updateCache } = require('../cache'); // Importing cache functions
const queue = require('../utils/queueSubject'); // Importing a queue utility
const { centralConfig } = require('../../config'); // Import the config
const vroomUrl = centralConfig.servers.vroom; // Use the URL from the config
// Helper function to introduce a delay
const delay = (ms) => new Promise((resolve) => setTimeout(resolve, ms));

const vroom = (module.exports = {
  // Function to convert booking data to a shipment format
  bookingToShipment({ id, pickup, destination }, i) {
    return {
      id: i,
      // description: id,
      amount: [1],
      pickup: {
        time_windows: pickup.departureTime?.length
          ? [
              [
                moment(pickup.departureTime, 'hh:mm:ss').unix(),
                moment(pickup.departureTime, 'hh:mm:ss')
                  .add(5, 'minutes')
                  .unix(),
              ],
            ]
          : undefined,
        id: i,
        location: [pickup.position.lon, pickup.position.lat],
      },
      delivery: {
        id: i,
        location: [destination.position.lon, destination.position.lat],
        time_windows: destination.arrivalTime?.length
          ? [
              [
                moment(destination.arrivalTime, 'hh:mm:ss').unix(),
                moment(destination.arrivalTime, 'hh:mm:ss')
                  .add(5, 'minutes')
                  .unix(),
              ],
            ]
          : undefined,
      },
    };
  },
  // Function to convert taxi data to a vehicle format
  taxiToVehicle({ position, passengerCapacity, heading, passengers }, i) {
    return {
      id: i,
      // description: id,
      capacity: [Math.max(1, passengerCapacity - (passengers?.length || 0))], // HACK: sometimes we will arrive here with -1 or 0 in capacity - we should fix that
      start: [position.lon, position.lat],
      end: heading ? [heading.lon, heading.lat] : undefined,
    };
  },
  // Function to convert truck data to a vehicle format
  truckToVehicle({ position, parcelCapacity, heading, cargo }, i) {
    return {
      id: i,
      // description: id,
      time_window: [
        moment('05:00:00', 'hh:mm:ss').unix(),
        moment('18:00:00', 'hh:mm:ss').unix(),
      ],
      capacity: [parcelCapacity - cargo.length],
      start: [position.lon, position.lat],
      end: heading ? [heading.lon, heading.lat] : undefined,
    };
  },
  // Function to plan routes and update cache if necessary
  async plan({ jobs, shipments, vehicles }) {
    const result = await getFromCache({ jobs, shipments, vehicles }); // Try to get a cached result
    if (result) {
      debug('Vroom cache hit'); // Log cache hit
      return result;
    }
    debug('Vroom cache miss'); // Log cache miss

    const before = Date.now(); // Record the current time before making the request

    return await queue(() =>
      fetch(vroomUrl, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          jobs,
          shipments,
          vehicles,
          options: {
            plan: true,
          },
        }),
      })
        .then(async (res) =>
          !res.ok ? Promise.reject('Vroom error:' + (await res.text())) : res
        ) // Handle HTTP errors
        .then((res) => res.json()) // Parse JSON response
        .then((json) =>
          Date.now() - before > 10_000
            ? updateCache({ jobs, shipments, vehicles }, json) // Cache the result if it took more than 10 seconds
            : json
        )
        .catch((vroomError) => {
          error(`Vroom error: ${vroomError} (enable debug logging for details)`); // Log error
          info('Jobs', jobs?.length); // Log number of jobs
          info('Shipments', shipments?.length); // Log number of shipments
          info('Vehicles', vehicles?.length); // Log number of vehicles
          return delay(2000).then(() =>
            vroom.plan({ jobs, shipments, vehicles })
          ); // Retry after delay in case of error
        })
    );
  },
});
