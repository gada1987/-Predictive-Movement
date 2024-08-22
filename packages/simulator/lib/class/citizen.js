const {
  map, // Transform values emitted by observable
  filter, // Filter values emitted by observable
  shareReplay, // Share the source observable and replay specified number of emissions to new subscribers
  distinctUntilChanged, // Ensure only distinct consecutive values are emitted
  mergeMap, // Map to observable, flatten and merge
  of, // Emit a sequence of values as an observable
  from, // Convert an array, promise, or iterable to an observable
  catchError, // Handle errors in observable sequence
  throttleTime, // Emit value from source, then ignore for specified duration
  mapTo, // Map every emitted value to a constant value
  tap, // Perform side effects with emitted values without modifying them
  mergeAll, // Flatten high-order observables into a first-order observable
  share, // Share source observable among multiple subscribers
  retryWhen, // Retry observable sequence based on error condition
  delay, // Delay emitted values by specified time
  take, // Take specified number of values from the observable
} = require('rxjs'); // Import necessary RxJS operators

const { virtualTime } = require('../utils/virtualTime'); // Import virtualTime for time-related operations
const { safeId } = require('../utils/id'); // Import safeId for generating safe IDs
const moment = require('moment'); // Import moment.js for date/time manipulation
const Booking = require('./booking'); // Import Booking class for creating bookings
const pelias = require('../deps/pelias'); // Import pelias for location-based searches
const { error } = require('../log'); // Import error logger
const { getHours, getISODay } = require('date-fns'); // Import date-fns for date utilities
const Position = require('./geo/position'); // Import Position class for handling geographic positions

class Citizen {
  constructor({ name, position, workplace, home, startPosition, kommun }) {
    this.id = 'p-' + safeId(); // Generate unique ID for the citizen
    // Initialize workplace with name and Position object
    this.workplace = {
      name: workplace.name || 'arbetsplats',
      position: new Position(workplace.position),
    };
    // Initialize home with name and Position object
    this.home = {
      name: home.name || 'hemma',
      position: new Position(home.position),
    };
    this.name = name; // Set citizen's name
    this.position = new Position(position); // Initialize current position with Position object
    this.startPosition = new Position(startPosition || this.position); // Set start position or default to current position
    this.kommun = kommun; // Set municipality of the citizen
    this.distance = 0; // Initialize distance traveled
    this.cost = 0; // Initialize cost incurred
    this.co2 = 0; // Initialize CO2 emissions
    this.inVehicle = false; // Flag indicating if citizen is in a vehicle

    // Aggregated values
    this.co2 = 0; // Total CO2 emissions
    this.cost = 0; // Total cost incurred
    this.distance = 0; // Total distance traveled
    this.moveTime = 0; // Total time spent on a vehicle
    this.waitTime = 0; // Total time spent waiting for a vehicle

    // Define intents observable stream based on virtual time
    this.intents = virtualTime.getTimeStream().pipe(
      throttleTime(1000), // Throttle updates to every 1000ms
      map((date) => ({
        hour: getHours(date), // Extract hour from current date
        weekDay: getISODay(date), // Extract ISO day from current date
      })),
      filter(() => Math.random() > 0.9), // Filter based on random condition
      map(({ hour }) => {
        // Map hour to intent
        if (hour < 4 || hour > 22) return 'sleep';
        if (hour >= 11 && hour <= 13) return 'lunch';
        if (hour >= 6 && hour < 10) return 'goToWork';
        if (hour >= 16 && hour <= 18) return 'goHome';
        return 'idle'; // Default to idle
      })
    );

    const ignoredIntents = ['sleep', 'idle']; // Define intents to ignore
    // Generate bookings based on intents
    this.bookings = this.intents.pipe(
      distinctUntilChanged(), // Ensure only distinct intents are processed
      filter((intent) => !ignoredIntents.includes(intent)), // Filter out ignored intents
      catchError((err) => error('passenger bookings err', err)), // Catch errors during booking process
      mergeMap(async (intent) => {
        switch (intent) {
          case 'goToWork':
            return of(
              // Create new Booking object for going to work
              new Booking({
                type: this.getType(), // Determine type of booking
                passenger: this, // Assign current citizen as passenger
                pickup: this.home, // Set pickup location as home
                destination: {
                  ...this.workplace,
                  departureTime: moment(
                    await virtualTime.getTimeInMillisecondsAsPromise()
                  )
                    .add(1, 'hour')
                    .format('hh:mm:ss'), // Calculate departure time for workplace
                },
              })
            );
          case 'goHome':
            return of(
              // Create new Booking object for going home
              new Booking({
                type: this.getType(), // Determine type of booking
                passenger: this, // Assign current citizen as passenger
                pickup: {
                  ...this.workplace,
                  departureTime: moment(
                    await virtualTime.getTimeInMillisecondsAsPromise()
                  )
                    .add(1, 'hour')
                    .format('hh:mm:ss'), // Calculate departure time from workplace
                },
                destination: this.home, // Set destination as home
              })
            );
          case 'lunch':
            return of(this.workplace.position).pipe(
              filter(() => Math.random() < 0.1), // Filter based on random condition
              mergeMap((position) =>
                pelias.searchOne('restaurang', position, 'venue') // Perform restaurant search
              ),
              retryWhen((errors) =>
                errors.pipe(delay(Math.random() * 10000), take(3))
              ), // Retry lunch search up to 3 times
              filter((position) => position != null), // Filter out null positions
              mergeMap(async (lunchPlace) =>
                from([
                  new Booking({
                    type: this.getType(), // Determine type of booking
                    passenger: this, // Assign current citizen as passenger
                    // Pickup to go to lunch
                    pickup: {
                      ...this.workplace,
                      departureTime: moment(
                        await virtualTime.getTimeInMillisecondsAsPromise()
                      )
                        .add(1, 'hour')
                        .format('hh:mm:ss'), // Calculate departure time for lunch pickup
                    },
                    destination: lunchPlace, // Set lunch place as destination
                  }),
                  new Booking({
                    // Return from lunch to work
                    type: this.getType(), // Determine type of booking
                    passenger: this, // Assign current citizen as passenger
                    pickup: {
                      ...lunchPlace,
                      departureTime: moment(
                        await virtualTime.getTimeInMillisecondsAsPromise()
                      )
                        .add(2, 'hour')
                        .format('hh:mm:ss'), // Calculate departure time after lunch
                    },
                    destination: this.workplace, // Set workplace as destination
                  }),
                ])
              )
            );
        }
        return of(null); // Return null if no booking created
      }),
      mergeAll(), // Flatten nested observable into single observable
      catchError((err) => error('passenger bookings err', err)), // Catch errors during booking process
      filter((f) => f instanceof Booking), // Filter out non-Booking instances
      shareReplay() // Share and replay bookings for multiple subscribers
    );

    // Define picked up events based on bookings
    this.pickedUpEvents = this.bookings.pipe(
      mergeMap((booking) => booking.pickedUpEvents), // Merge picked up events from bookings
      tap((booking) => {
        this.inVehicle = true; // Update inVehicle status to true
        this.position = booking.pickup.position; // Update current position to pickup position
      }),
      mapTo(this), // Map to current Citizen object
      share() // Share picked up events among subscribers
    );

    // Define delivered events based on bookings
    this.deliveredEvents = this.bookings.pipe(
      mergeMap((booking) => booking.deliveredEvents), // Merge delivered events from bookings
      tap((booking) => {
        this.inVehicle = false; // Update inVehicle status to false
        this.position = booking.destination.position; // Update current position to destination position
      }),
      mapTo(this), // Map to current Citizen object
      share() // Share delivered events among subscribers
    );
  }

  // Determine type of booking based on random probability
  getType() {
    return Math.random() < 0.8 ? 'passenger' : 'passengerBus'; // Return 'passenger' or 'passengerBus'
  }

  // Reset citizen's position and inVehicle status to start position and false, respectively
  reset() {
    this.position = this.startPosition; // Reset current position to start position
    this.inVehicle = false; // Reset inVehicle status to false
  }

  // Convert Citizen object to plain JavaScript object (POJO)
  toObject() {
    const obj = {
      co2: this.co2,
      cost: this.cost,
      distance: this.distance,
      id: this.id,
      inVehicle: this.inVehicle,
      moveTime: this.moveTime,
      name: this.name,
      position: this.position,
      waitTime: this.waitTime,
      kommun: this.kommun.name,
      home: this.home,
      workplace: this.workplace,
    };
    return obj; // Return plain JavaScript object
  }

  // Update citizen's position, CO2 emissions, cost, distance, and moveTime
  moved(position, metersMoved, co2, cost, moveTime) {
    this.position = position; // Update current position
    this.co2 += co2; // Update CO2 emissions
    this.cost += cost; // Update cost
    this.distance += metersMoved; // Update distance traveled
    this.moveTime += moveTime; // Update move time
  }
}

module.exports = Citizen; // Export Citizen class for use in other modules
