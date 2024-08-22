const { mergeAll, from } = require('rxjs'); // Importing mergeAll and from operators from rxjs
const {
  tap,
  filter,
  delay,
  mergeMap,
  catchError,
  bufferTime,
  retryWhen,
  toArray,
} = require('rxjs/operators'); // Importing various operators from rxjs
const { info, error, warn, debug } = require('../../log'); // Importing logging functions
const { clusterPositions } = require('../kmeans'); // Importing the clusterPositions function for clustering bookings

// Dispatch function to assign bookings to cars
const dispatch = (cars, bookings) => {
  return cars.pipe(
    toArray(), // Collect cars into an array
    tap((cars) => {
      if (!cars.length) {
        warn('Fleet has no cars, dispatch is not possible.'); // Log a warning if there are no cars
      }
    }),
    filter((cars) => cars.length > 0), // Filter out if there are no cars
    tap((cars) => {
      const fleet = cars[0].fleet.name; // Get the fleet name from the first car
      info(`🚚 Dispatch ${cars.length} vehicles in ${fleet}`); // Log the number of cars being dispatched
    }),
    filter((cars) => cars.length > 0), // Ensure there are cars before proceeding
    mergeMap((cars) =>
      bookings.pipe(
        filter((booking) => !booking.car), // Filter bookings that are not yet assigned to a car
        bufferTime(5000, null, 100), // Buffer bookings for a 5-second window or up to 100 bookings
        filter((b) => b.length > 0), // Only process if there are buffered bookings
        mergeMap(async (bookings) => {
          if (bookings.length < cars.length) {
            return [
              {
                car: cars[0],
                bookings,
              },
            ]; // If there are fewer bookings than cars, assign all to the first car
          }

          const clusters = await clusterPositions(bookings, cars.length); // Cluster bookings based on car count
          return clusters.map(({ items: bookings }, i) => ({
            car: cars[i],
            bookings,
          })); // Assign each cluster to a car
        }),
        catchError((err) => error('cluster err', err)), // Catch and log clustering errors
        mergeAll(), // Flatten the observable of arrays into a single observable
        filter(({ bookings }) => bookings.length > 0), // Filter out empty booking assignments
        tap(({ car, bookings }) =>
          debug(
            `Plan ${car.id} (${car.fleet.name}) received ${bookings.length} bookings`
          )
        ), // Log the assignments
        mergeMap(({ car, bookings }) =>
          from(bookings).pipe(
            mergeMap((booking) => car.handleBooking(booking), 1)
          )
        ), // Process each booking sequentially
        retryWhen((errors) =>
          errors.pipe(
            tap((err) => error('dispatch error, retrying in 1s...', err)), // Log and retry on errors
            delay(1000) // Delay retry by 1 second
          )
        )
      )
    ),
    catchError((err) => error('dispatchCentral -> dispatch', err)) // Catch and log errors in the dispatch process
  );
};

module.exports = {
  dispatch, // Export the dispatch function for use in other modules
};
