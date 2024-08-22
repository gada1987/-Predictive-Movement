const { from, of } = require('rxjs'); // RxJS operators for creating observables
const { map, filter, first, mergeMap, toArray } = require('rxjs/operators'); // RxJS operators for transforming streams
const pelias = require('../lib/deps/pelias'); // Pelias API for geocoding and address lookup
const { haversine, addMeters } = require('../lib/utils/geo/distance'); // Utility functions for distance calculations
const perlin = require('perlin-noise'); // Library for generating Perlin noise
const Booking = require('../lib/class/booking'); // Booking class for creating booking instances

// Converts an index to an x, y coordinate based on a grid size
const xy = (i, size = 100) => ({ x: i % size, y: Math.floor(i / size) });

// Generate a pattern of random positions using Perlin noise
const randomPositions = perlin
  .generatePerlinNoise(100, 100)
  .map((probability, i) => ({ x: xy(i).x * 10, y: xy(i).y * 10, probability })) // Map Perlin noise values to positions
  .sort((a, b) => b.probability - a.probability); // Sort positions by probability

/**
 * Generates bookings for each square in a kommun.
 * 
 * @param {Object} kommun - The kommun object containing squares and postombud (delivery points).
 * @returns {Observable<Booking>} - An observable stream of bookings.
 */
function generateBookingsInKommun(kommun) {
  // For each square in the kommun, find the nearest postombud (delivery point)
  const squaresWithNearestPostombud = kommun.squares.pipe(
    mergeMap((square) =>
      kommun.postombud.pipe(
        map((ombud) => ({
          ...ombud,
          distance: haversine(ombud.position, square.position), // Calculate distance from postombud to square
        })),
        toArray(), // Collect all postombud in an array
        map((ombud) => ombud.sort((a, b) => a.distance - b.distance).shift()), // Sort by distance and select the nearest
        map((nearestOmbud) => ({ ...square, nearestOmbud })) // Add nearest postombud to the square
      )
    )
  );

  // Generate random points within each square and associate them with the nearest postombud
  const randomPointsInSquares = squaresWithNearestPostombud.pipe(
    mergeMap(({ population, nearestOmbud, position }) =>
      randomPositions
        .slice(0, population) // Generate as many points as the population of the square
        .map(({ x, y }) => addMeters(position, { x, y })) // Offset position by x, y coordinates
        .map((position) => ({ nearestOmbud, position })) // Pair each point with the nearest postombud
    )
  );

  // Create bookings from the random points and associate them with fleets and addresses
  const bookings = randomPointsInSquares.pipe(
    toArray(), // Collect all points in an array to sort them
    mergeMap((a) => from(a.sort(() => Math.random() - 0.5))), // Shuffle the array
    mergeMap(({ nearestOmbud, position }) =>
      kommun.fleets.pipe(
        first((fleet) => nearestOmbud.operator.startsWith(fleet.name), null), // Find fleet matching the postombud's operator
        mergeMap((fleet) => (fleet ? of(fleet) : kommun.fleets.pipe(first()))), // Default to the first fleet if no match
        map((fleet) => ({ nearestOmbud, position, fleet })) // Pair the fleet with the nearest postombud and position
      )
    ),
    mergeMap(({ nearestOmbud, position, fleet }) => {
      // Generate bookings based on address, fleet, and delivery options
      return pelias
        .nearest(position) // Get the nearest address to the position
        .then((address) => {
          const isCommercial = address.layer === 'venue'; // Check if address is commercial
          const homeDelivery = Math.random() < fleet.percentageHomeDelivery; // Determine if home delivery is applicable
          const returnDelivery = Math.random() < fleet.percentageReturnDelivery; // Determine if return delivery is applicable

          // Create a booking based on the delivery type
          if (isCommercial || homeDelivery)
            return new Booking({
              pickup: fleet.hub,
              destination: address,
              origin: fleet.name,
            });
          if (returnDelivery)
            return new Booking({
              pickup: nearestOmbud,
              destination: hub,
              origin: fleet.name,
            });

          return new Booking({
            pickup: fleet.hub,
            destination: nearestOmbud,
            finalDestination: address,
            origin: fleet.name,
          });
        })
        .catch(() => Promise.resolve(null)); // Return null if there's an error
    }, 1), // Concurrency limit
    filter((p) => p !== null) // Filter out null values
  );

  return bookings;
}

module.exports = { generateBookingsInKommun }; // Export the function to be used elsewhere
