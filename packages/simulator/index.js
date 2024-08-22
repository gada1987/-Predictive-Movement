// Importing necessary modules from RxJS and other local utilities
const { filter, share, merge, shareReplay } = require('rxjs');
const {
  mergeMap,
  map,
  catchError,
  toArray,
  pairwise,
} = require('rxjs/operators');

const { virtualTime } = require('./lib/utils/virtualTime'); // Custom virtual time utility
const { safeId } = require('./lib/utils/id'); // Utility to generate safe IDs
const { read } = require('./config'); // Function to read configuration
const statistics = require('./lib/utils/statistics'); // Utility for collecting statistics
const { info, error, logStream } = require('./lib/log'); // Custom logging functions
const { haversine, getNrOfPointsBetween } = require('./lib/utils/geo/distance'); // Geographical utilities

const engine = {
  subscriptions: [],

  // Function to create an experiment
  createExperiment: ({ defaultEmitters, id = safeId() } = {}) => {
    const savedParams = read(); // Read experiment parameters from configuration
    info(`*** Starting experiment ${id} with params:`, {
      id: savedParams.id,
      fixedRoute: savedParams.fixedRoute,
      emitters: savedParams.emitters,
      municipalities: Object.keys(savedParams.fleets).map((municipality) => {
        return `${municipality} (${savedParams.fleets[municipality].fleets.length} fleets)`;
      }),
    });

    // Import regions data based on the saved parameters
    const regions = require('./streams/geo')(savedParams);

    // Define experiment parameters
    const parameters = {
      id,
      startDate: new Date(),
      fixedRoute: savedParams.fixedRoute || 100,
      emitters: defaultEmitters,
      fleets: savedParams.fleets,
    };
    statistics.collectExperimentMetadata(parameters); // Collect experiment metadata

    // Define the experiment object with various streams and operations
    const experiment = {
      logStream,

      // Stream of bus stops, shared for multiple subscribers
      busStops: regions.pipe(
        filter((region) => region.stops),
        mergeMap((region) => region.stops),
        shareReplay()
      ),

      // Stream of line shapes, shared for multiple subscribers
      lineShapes: regions.pipe(
        filter((region) => region.lineShapes),
        mergeMap((region) => region.lineShapes),
        shareReplay()
      ),

      // Stream of postombud (postal agents)
      postombud: regions.pipe(mergeMap((region) => region.postombud)),

      // Stream of kommuner (municipalities), shared for multiple subscribers
      kommuner: regions.pipe(
        mergeMap((region) => region.kommuner),
        shareReplay()
      ),

      subscriptions: [], // Holds subscriptions for later management
      virtualTime,

      // Stream of cars
      cars: regions.pipe(mergeMap((region) => region.cars)),

      // Stream of dispatched bookings, merged from various sources
      dispatchedBookings: merge(
        regions.pipe(mergeMap((region) => region.dispatchedBookings)),
        regions.pipe(
          mergeMap((region) =>
            region.kommuner.pipe(
              mergeMap((kommun) => kommun.dispatchedBookings)
            )
          )
        )
      ),

      // Stream of buses
      buses: regions.pipe(mergeMap((region) => region.buses)),

      // Stream of measure stations (e.g., measurement locations)
      measureStations: regions.pipe(
        mergeMap((region) => region.measureStations)
      ),

      // Stream of passengers, with error handling and sharing
      passengers: regions.pipe(
        filter((region) => region.citizens),
        mergeMap((region) => region.citizens),
        catchError((err) => error('Experiment -> Passengers', err)),
        shareReplay()
      ),

      // Stream of taxis
      taxis: regions.pipe(mergeMap((region) => region.taxis)),
    };

    // Subscription for collecting booking statistics
    experiment.passengers
      .pipe(
        mergeMap((passenger) => passenger.bookings),
        catchError((err) => error('passenger statistics err', err)),
        shareReplay()
      )
      // Subscribe to the booking stream to collect booking data
      .subscribe((booking) => {
        try {
          statistics.collectBooking(booking, parameters);
        } catch (err) {
          error('collectBooking err', err);
        }
      });

    // Stream of booking updates
    experiment.bookingUpdates = experiment.dispatchedBookings.pipe(
      mergeMap((booking) => booking.statusEvents),
      catchError((err) => error('bookingUpdates', err)),
      share()
    );

    // Stream of passenger updates (delivered and picked up events)
    experiment.passengerUpdates = experiment.passengers.pipe(
      mergeMap(({ deliveredEvents, pickedUpEvents }) =>
        merge(deliveredEvents, pickedUpEvents)
      ),
      catchError((err) => error('passengerUpdates', err)),
      share()
    );

    // Stream of car updates (buses, cars, and taxis)
    experiment.carUpdates = merge(
      experiment.buses,
      experiment.cars,
      experiment.taxis
    ).pipe(
      mergeMap((car) => car.movedEvents),
      catchError((err) => error('car updates err', err)),
      share()
    );

    // Stream of measure station updates based on vehicle positions
    experiment.measureStationUpdates = merge(
      experiment.buses,
      experiment.cars
    ).pipe(
      filter((car) => car.vehicleType === 'car' || car.vehicleType === 'bus'),
      filter((car) => !car.isPrivateCar),
      mergeMap(({ id, movedEvents }) =>
        movedEvents.pipe(
          mergeMap(({ position: carPosition, pointsPassedSinceLastUpdate }) =>
            experiment.measureStations.pipe(
              filter(({ position }) => carPosition.distanceTo(position) < 1000),
              map(({ position: mPosition, id: mId }) => ({
                carPosition: carPosition.toObject(),
                pointsPassedSinceLastUpdate,
                mPosition,
                id,
                mId,
              })),
              filter(
                ({
                  carPosition,
                  mPosition,
                  pointsPassedSinceLastUpdate = [],
                }) =>
                  [...pointsPassedSinceLastUpdate, { position: carPosition }]
                    .map(({ position, meters }, index, arr) => {
                      if (arr.length > index + 1) {
                        return {
                          p1: position,
                          p2: arr[index + 1].position,
                          meters,
                        };
                      }
                      return null;
                    })
                    .filter((e) => !!e)
                    .flatMap(({ p1, p2, meters }) =>
                      getNrOfPointsBetween(p1, p2, Math.round(meters / 2))
                    )
                    .filter((e) => e.lat && e.lon)
                    .some((position) => haversine(position, mPosition) < 10)
              ),
              toArray()
            )
          ),
          pairwise(),
          filter(([prev, curr]) => prev.length || curr.length),
          map(([previousStations, currentStations]) =>
            previousStations.filter(
              (p) => !currentStations.some(({ mId }) => p.mId === mId)
            )
          ),
          filter((e) => e.length)
        )
      ),
      map((events) =>
        events.map(({ id: carId, mId: stationId }) => ({ carId, stationId }))
      )
    );

    return experiment; // Return the configured experiment object
  },
};

module.exports = engine;
