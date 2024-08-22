// Import required modules and libraries
const moment = require('moment'); // For handling and formatting dates
const gtfs = require('./gtfs.js'); // Local module for fetching GTFS data

const { shareReplay, from, firstValueFrom, groupBy, pipe } = require('rxjs');
const {
  map,
  mergeMap,
  filter,
  catchError,
  reduce,
  toArray,
  mergeAll,
} = require('rxjs/operators');
const { error } = require('../../lib/log.js'); // Custom logging function

// Utility function to reduce an observable stream into a Map
const reduceMap = (idProp = 'id') =>
  pipe(reduce((map, item) => map.set(item[idProp], item), new Map()));

// Utility function to add a new property to each item in an observable stream
const addProp = (prop, fn) =>
  pipe(
    map((item) =>
      Object.assign(item, {
        [prop]: fn(item),
      })
    )
  );

// Asynchronous function to get bus stops for a given date and operator
async function getStopsForDate(date, operator) {
  // Destructure GTFS observables from the imported module
  const {
    stops,
    busStops,
    trips,
    serviceDates,
    routeNames,
    excludedLineNumbers,
  } = gtfs(operator);

  // Convert observable streams to Maps for easier lookup
  const allTrips = await firstValueFrom(trips.pipe(reduceMap()));
  const allRouteNames = await firstValueFrom(routeNames.pipe(reduceMap()));
  const allStops = await firstValueFrom(stops.pipe(reduceMap()));
  const allServices = await firstValueFrom(serviceDates.pipe(reduceMap('date')));
  const todaysServices = allServices.get(date).services; // Services for today

  // Collect excluded line numbers into an array
  const excludedLineNumberArray = [];
  excludedLineNumbers
    .pipe(map((line) => excludedLineNumberArray.push(line)))
    .subscribe();

  // Create observable for bus stops with additional properties
  return busStops.pipe(
    // Add 'trip' property with trip details
    addProp('trip', (stop) => allTrips.get(stop.tripId)),
    // Add 'route' property with route details
    addProp('route', ({ trip: { routeId } }) => allRouteNames.get(routeId)),
    // Add 'lineNumber' property with the line number of the route
    addProp('lineNumber', ({ route }) => route.lineNumber),
    // Filter stops to include only those with today's services
    filter(({ trip: { serviceId } }) => todaysServices.includes(serviceId)),
    // Add 'stop' property with stop details
    addProp('stop', (stop) => allStops.get(stop.stopId)),
    // Add 'position' property with the position of the stop
    addProp('position', ({ stop }) => stop.position),
    // Add 'name' property with the name of the stop
    addProp('name', ({ stop }) => stop.name),
    // Add 'kommun' property with the kommun of the stop
    addProp('kommun', ({ stop }) => stop.kommun),
    // Add 'passagerare' property with a default value of 0
    addProp('passagerare', ({ stop }) => 0),
    // Filter out excluded routes based on line numbers
    filter((stop) => {
      // NOTE: This is a manual way of filtering out non-bus routes and stops
      return excludedLineNumberArray.indexOf(stop.lineNumber) === -1;
    }),
    // Handle errors during the stream processing
    catchError((err) => {
      error('PublicTransport error', err);
      throw err;
    })
  );
}

// Main function to get public transport data for today
function publicTransport(operator) {
  // Get today's date in YYYYMMDD format
  const todaysDate = moment().format('YYYYMMDD');

  // Create observable for today's stops and share the results
  const todaysStops = from(getStopsForDate(todaysDate, operator)).pipe(
    mergeAll(),
    shareReplay()
  );

  // Return observable for stops
  return {
    stops: todaysStops,
  };
}

// Export the publicTransport function
module.exports = publicTransport;
