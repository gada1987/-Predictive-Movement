// Importing necessary RxJS functions and operators
const {
  from,
  shareReplay,
  Subject,
  ReplaySubject,
  mergeMap,
  merge,
  range,
} = require('rxjs')
const {
  catchError,
  map,
  toArray,
  filter,
  tap,
  retryWhen,
  delay,
} = require('rxjs/operators')

// Importing Fleet class and other dependencies
const Fleet = require('../fleet')
const { error } = require('../../log')
const { searchOne } = require('../../deps/pelias')

// Function to expand fleets based on their market share
const expandFleets = () => (fleets) =>
  fleets.pipe(
    mergeMap((fleet) => range(0, fleet.marketshare * 10).pipe(map(() => fleet)))
  )

// Function to pick a random item from an array-like stream
const pickRandom = () => (stream) =>
  stream.pipe(
    toArray(),
    map((arr) => arr[Math.floor(arr.length * Math.random())])
  )

// Definition of the Kommun class
class Kommun {
  constructor({
    geometry,
    name,
    id,
    packageVolumes,
    email,
    zip,
    center,
    telephone,
    postombud,
    population,
    measureStations,
    citizens,
    squares,
    fleets,
  }) {
    this.squares = squares
    this.geometry = geometry
    this.name = name
    this.id = id
    this.email = email
    this.zip = zip
    this.center = center
    this.telephone = telephone
    this.postombud = postombud
    this.measureStations = measureStations
    this.packageVolumes = packageVolumes
    this.busesPerCapita = 100 / 80_000 // Constant value, should be based on population
    this.population = population
    this.privateCars = new ReplaySubject() // ReplaySubject to hold private cars
    this.unhandledBookings = new Subject() // Subject to hold unhandled bookings

    this.co2 = 0 // Initial CO2 value
    this.citizens = citizens

    // Creating fleet streams and handling asynchronous hub address lookup
    this.fleets = from(fleets).pipe(
      mergeMap(async (fleet) => {
        const hub = fleet.hubAddress
          ? await searchOne(fleet.hubAddress)
              .then((r) => r.position)
              .catch((err) => error(err) || center)
          : center

        return new Fleet({ hub, ...fleet, kommun: this })
      }),
      shareReplay() // Sharing the replay of the stream
    )

    // Merging private cars and fleet cars into one observable
    this.cars = merge(
      this.privateCars,
      this.fleets.pipe(
        filter((fleet) => fleet.type !== 'bus'),
        mergeMap((fleet) => fleet.cars)
      )
    ).pipe(shareReplay())

    // Creating an observable for buses
    this.buses = this.fleets.pipe(
      filter((fleet) => fleet.type === 'bus'),
      tap((bus) => (bus.kommun = this)),
      mergeMap((fleet) => fleet.cars),
      shareReplay()
    )

    // Function to pick the next eligible fleet for a booking
    this.pickNextEligbleFleet = (booking) =>
      this.fleets.pipe(
        mergeMap((fleet) =>
          fleet.canHandleBooking(booking).then((ok) => [ok, fleet])
        ),
        filter(([ok]) => ok),
        map(([, fleet]) => fleet),
        expandFleets(),
        pickRandom(),
        map((fleet) =>
          !fleet
            ? error('No eligible fleet found for booking, retrying...', booking)
            : fleet
        ),
        retryWhen((errors) => errors.pipe(delay(10000))),
        map((fleet) => ({ booking, fleet })),
        catchError((err) => error('pickNextEligibleFleet', err))
      )

    // Merging dispatched bookings from unhandled bookings and fleets
    this.dispatchedBookings = merge(
      this.unhandledBookings.pipe(
        mergeMap((booking) => this.pickNextEligbleFleet(booking)),
        mergeMap(({ booking, fleet }) => fleet.handleBooking(booking), 1),
        catchError((err) => error('dispatchedBookings', err)),
        shareReplay()
      ),
      this.fleets.pipe(mergeMap((fleet) => fleet.dispatchedBookings))
    )

    // Function to handle a booking
    this.handleBooking = (booking) => {
      booking.kommun = this
      this.unhandledBookings.next(booking)
    }
  }
}

// Exporting the Kommun class
module.exports = Kommun
