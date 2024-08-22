// Importing individual RxJS operators and functions from 'rxjs'
const { from, forkJoin, mergeMap, merge, Subject, of } = require('rxjs')
const {
  map,
  groupBy,
  tap,
  filter,
  pairwise,
  mergeAll,
  share,
  toArray,
  catchError,
  switchMap,
  bufferTime,
  retryWhen,
  delay,
  take,
  scan,
  debounceTime,
  concatMap,
  shareReplay,
  first,
} = require('rxjs/operators')

const { busDispatch } = require('../../utils/dispatch/busDispatch') // Importing bus dispatch utility
const { isInsideCoordinates } = require('../../utils/geo/polygon') // Importing geo utility to check if a point is inside a polygon
const { clusterPositions } = require('../../utils/kmeans') // Importing k-means clustering utility
const { haversine } = require('../../utils/geo/distance') // Importing Haversine distance calculation utility
const { taxiDispatch } = require('../../utils/dispatch/taxiDispatch') // Importing taxi dispatch utility
const { error, info } = require('../../log') // Importing logging utilities
const Booking = require('../booking') // Importing Booking class
const Bus = require('../vehicles/bus') // Importing Bus class

/**
 * Utility function to flatten properties in an observable stream.
 * @param {string} property The property to flatten.
 * @returns {function} A function that flattens the specified property in an observable stream.
 */

const flattenProperty = (property) => (stream) =>
  stream.pipe(
    mergeMap((object) =>
      object[property].pipe(
        toArray(),
        map((arr) => ({
          ...object,
          [property]: arr,
        }))
      )
    )
  )

  /**
 * Function that filters and maps stops by municipality (kommun) and groups them by trip ID.
 * @param {Observable} kommuner Observable of municipalities.
 * @returns {function} Function that operates on stops observable to group stops by trip ID within municipalities.
 */
const tripsInKommun = (kommuner) => (stops) =>
  stops.pipe(
    groupBy(({ tripId }) => tripId),
    mergeMap((s) => s.pipe(toArray())),
    filter((stops) => stops.length > 1),
    mergeMap((stops) => {
      const firstStop = stops[0]
      const lastStop = stops[stops.length - 1]
      return kommuner.pipe(
        filter(({ geometry }) =>
          isInsideCoordinates(firstStop.position, geometry.coordinates)
        ),
        map(({ name }) => ({
          tripId: firstStop.tripId,
          lineNumber: stops[0].lineNumber,
          stops,
          firstStop,
          lastStop,
          kommun: name,
        }))
      )
    })
  )
/**
 * Represents a region with its properties and methods related to transportation management.
 */
class Region {
    /**
   * Creates an instance of Region.
   * @param {Object} params Region parameters including id, name, geometry, stops, and kommuner.
   */
  constructor({ id, name, geometry, stops, kommuner }) {
    this.id = id

    this.geometry = geometry
    this.name = name
    // Observable for trips grouped by municipality
    this.trips = tripsInKommun(kommuner)(stops).pipe(shareReplay()) // trips = bussavgångar
    // Observable for stops within each municipality
    this.stops = this.trips.pipe(
      mergeMap(({ kommun, stops }) =>
        kommuner.pipe(
          first(({ name }) => name === kommun, null), // is this an included kommun?
          mergeMap((kommun) => (kommun ? stops : of(null)))
        )
      )
    )
   // Observable for line shapes within each municipality 
    this.lineShapes = this.trips.pipe(
      map(({ tripId, stops, lineNumber, firstStop, lastStop, kommun }) => ({
        tripId,
        lineNumber,
        from: firstStop.name,
        to: lastStop.name,
        kommun,
        stops: stops.map(({ stop }) => stop.position),
      }))
    )
    this.kommuner = kommuner // TODO: Rename to municipalities.

    /**
     * Static map objects.
     */

    this.measureStations = kommuner.pipe(
      mergeMap((kommun) => kommun.measureStations)
    )

    this.postombud = kommuner.pipe(mergeMap((kommun) => kommun.postombud))

    /**
     * Vehicle streams.
     */

    this.cars = kommuner.pipe(mergeMap((kommun) => kommun.cars))

    this.taxis = kommuner.pipe(
      mergeMap((kommun) => kommun.cars),
      filter((car) => car.vehicleType === 'taxi')
    )

    /**
     * Transportable objects streams.
     */

    this.citizens = kommuner.pipe(mergeMap((kommun) => kommun.citizens))

    // Bus bookings handling
    this.busBookings = this.citizens.pipe(
      mergeMap(citizen => citizen.bookings),
      filter(booking => booking.type === 'passengerBus'),
      mergeMap(booking =>
        from(nearestBusStop(this.stops, null, booking.pickup.position)).pipe(
          mergeMap(nearestPickup => {
            booking.pickup = nearestPickup;
            return forkJoin({ // Combine multiple observables and wait
              booking: of({ status: booking.status, destination: booking.destination, pickup: nearestPickup }),
              nearestDestination: from(nearestBusStop(this.stops, booking.pickup.lineNumber, booking.destination.position))
            })
          }),
          map(({ booking, nearestDestination }) => ({
            ...booking,
            destination: nearestDestination
          })),
        ),
      )
    )

    // Buses handling bus bookings of passengers
    this.buses = kommuner.pipe(
      map((kommun) => kommun.buses),
      mergeAll(),
      map((bus) => {
        return new Bus({ ...bus, passengerBookings: this.busBookings.pipe(
          filter(booking => booking.lineNumber === bus.lineNumber)
        ) });
      }),
      shareReplay(),
    )

    this.stopAssignments = this.trips.pipe(
      groupBy((trip) => trip.kommun),
      map((trips) => ({
        buses: this.buses.pipe(
          filter((bus) => bus.fleet.kommun.name === trips.key)
        ),
        trips,
      })),
      flattenProperty('buses'),
      flattenProperty('trips'),
      filter(({ buses, trips }) => buses.length && trips.length),
      mergeMap(({ buses, trips }) => busDispatch(buses, trips), 1), // try to find optimal plan x kommun at a time
      catchError((err) => error('stopAssignments', err)),
      retryWhen((errors) => errors.pipe(delay(1000), take(10))),
      mergeAll(),
      mergeMap(({ bus, stops }) =>
        from(stops).pipe(
          pairwise(),
          map(stopsToBooking),
          map((booking) => ({ bus, booking }))
        )
      ),
      catchError((err) => error('stopAssignments', err)),
      share()
    )
    // Manual bookings subject
    this.manualBookings = new Subject()
    // Unhandled bookings stream
    this.unhandledBookings = this.citizens.pipe(
      mergeMap((passenger) => passenger.bookings),
      filter((booking) => !booking.assigned),
      filter((booking) => booking.type != 'passengerBus'),
      catchError((err) => error('unhandledBookings', err)),
      share()
    )

    /*
     * TODO: Move this to dispatch central:
     * TODO: add kmeans clustering to group bookings and cars by pickup
     * send those to vroom and get back a list of assignments
     * for each assignment, take the booking and dispatch it to the car / fleet
     */
    // Dispatched bookings stream
    this.dispatchedBookings = merge(
      // Handling bus stop assignments
      this.stopAssignments.pipe(
        mergeMap(({ bus, booking }) => bus.handleBooking(booking), 5),
        filter((booking) => !booking.assigned),
        filter((booking) => booking.type != 'passengerBus'),
        catchError((err) => error('region stopAssignments', err)),
        share()
      ),
      this.taxis.pipe(
        scan((acc, taxi) => acc.push(taxi) && acc, []),
        debounceTime(1000),
        filter((taxis) => taxis.length > 0),
        mergeMap((taxis) =>
          merge(this.manualBookings, this.unhandledBookings).pipe(
            bufferTime(5000, null, 100),
            filter((bookings) => bookings.length > 0),
            tap((bookings) =>
              info('Clustering taxi bookings', bookings.length, taxis.length)
            ),
            switchMap((bookings) => {
              const clusters = Math.max(5, Math.ceil(bookings.length / 10))
              if (bookings.length < taxis.length || bookings.length < clusters)
                return of([{ center: bookings[0].position, items: bookings }])

              return clusterPositions(bookings, Math.max(5, clusters))
            }),
            mergeAll(),
            map(({ center, items: bookings }) => ({ center, bookings })),
            catchError((err) => error('taxi cluster err', err)),
            concatMap(({ center, bookings }) => {
              const nearestTaxis = takeNearest(taxis, center, 10).filter(
                (taxi) => taxi.canPickupMorePassengers()
              )
              return taxiDispatch(nearestTaxis, bookings).catch((err) => {
                if (!bookings || !bookings.length) {
                  warn('Region -> Dispatched Bookings -> No bookings!', err)
                  return of([])
                }
                error('Region -> Dispatched Bookings -> Taxi', err)
                bookings.forEach((booking) => this.manualBookings.next(booking))
                return of([])
              })
            }),
            filter((bookings) => bookings.length),
            mergeAll(),
            mergeMap(({ taxi, bookings }) =>
              from(bookings).pipe(
                // TODO: We have a bug here, the system tries to dispatch taxis that are already full.
                mergeMap((booking) => taxi.fleet.handleBooking(booking, taxi)),
                catchError((err) =>
                  error('Region -> Dispatched Bookings -> Taxis', err)
                )
              )
            ),
            retryWhen((errors) =>
              errors.pipe(
                tap((err) =>
                  error('region taxi error, retrying in 1s...', err)
                ),
                delay(1000)
              )
            )
          )
        ),
        catchError((err) => error('region taxiDispatch', err)),
        share()
      )
    )

    // TODO Optimize observable handling
    // this.dispatchedBookings.pipe(
    //   filter(dispatch => dispatch.type === 'busstop'),
    //   mergeMap(busStop =>
    //     this.busBookings.pipe(
    //       filter(booking => busStop.stop === booking.pickup.stopId ),
    //       map(busStop => {return busStop 
    //         ? ({...busStop, passagerare: busStop.passagerare + 1})
    //         : busStop
    //       })
    //     ),
    //   )
    // ).subscribe(data => console.log(data))

  }
}

/**
 * Utility function to get nearest taxis to a given center based on Haversine distance.
 * @param {Array} taxis Array of taxis to filter and sort.
 * @param {Object} center Center position to calculate distances.
 * @param {number} count Number of nearest taxis to return.
 * @returns {Array} Array of nearest taxis.
 */
const takeNearest = (taxis, center, count) =>
  taxis
    .sort((a, b) => {
      const aDistance = haversine(a.position, center)
      const bDistance = haversine(b.position, center)
      return aDistance - bDistance
    })
    .slice(0, count)

/**
 * Utility function to convert a pair of stops into a Booking object.
 * @param {Array} [pickup, destination] Array containing pickup and destination stops.
 * @returns {Booking} Booking object created from the given stops.
 */
const stopsToBooking = ([pickup, destination]) =>
  new Booking({
    pickup,
    destination,
    lineNumber: pickup.lineNumber ?? destination.lineNumber,
    type: 'busstop',
  })

/**
 * Utility function to find the nearest bus stop.
 * @param {Observable} stops Observable stream of stops to search within.
 * @param {number} lineNumber Line number to filter bus stops (optional).
 * @param {Object} location Location to find the nearest bus stop from.
 * @returns {Promise} Promise that resolves to the nearest bus stop.
 */

const nearestBusStop = (stops, lineNumber, location) => {
  return new Promise((resolve, reject) => {
    let filterFunction = lineNumber === null ? stop => stop : filter(stop => stop.lineNumber === lineNumber)
    from(stops).pipe(
      filterFunction, 
      map(obj => {return {stopId: obj.stopId, position: obj.position, lineNumber: obj.lineNumber}}),
      toArray(),
      map(stops => stops.sort((a, b) => {
        const aDistance = haversine(a.position, location)
        const bDistance = haversine(b.position, location)
        return aDistance - bDistance
      })[0])
    ).subscribe({
      next: nearestStop => resolve(nearestStop),
      error: err => reject(err)
    });
  })
}

module.exports = Region // Exporting the Region class
