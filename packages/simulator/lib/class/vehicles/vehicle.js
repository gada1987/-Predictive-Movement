const { ReplaySubject } = require('rxjs'); // Reactive programming library for event handling
const { scan } = require('rxjs/operators'); // Operators for RxJS to manipulate observables
const moment = require('moment'); // Library for date and time manipulation
const { assert } = require('console'); // Assertion library for runtime checks

const osrm = require('../../deps/osrm'); // Open Source Routing Machine for route calculation
const { haversine, bearing } = require('../../utils/geo/distance'); // Geographic distance calculations
const interpolate = require('../../utils/geo/interpolate'); // Interpolation for route handling
const Booking = require('../booking'); // Class representing a booking
const { safeId } = require('../../utils/id'); // Utility for generating safe IDs
const { error } = require('../../log'); // Logging utility
const { virtualTime } = require('../../utils/virtualTime'); // Virtual time utility
const Position = require('../geo/position'); // Class representing a geographic position

const wait = (ms) => new Promise((resolve) => setTimeout(resolve, ms)); // Utility function to wait for a specified duration

class Vehicle {
  constructor({
    id = 'v-' + safeId(),
    position,
    status = 'ready',
    parcelCapacity,
    passengerCapacity,
    weight = 10000,
    fleet,

    /*
     * CO2
     *
     * Constants for CO2 emissions per kilometer traveled.
     * Default values based on environmental standards and vehicle types.
     * TODO: Move the CO2-related constants and calculations to a dedicated configuration file.
     */
    co2PerKmKg = 0.013 / 1000,
  } = {}) {
    this.id = id; // Unique identifier for the vehicle
    this.position = position; // Current geographical position of the vehicle
    this.origin = position; // Initial starting position of the vehicle
    this.queue = []; // Queue of bookings awaiting service
    this.cargo = []; // List of bookings currently being transported
    this.delivered = []; // List of bookings successfully delivered
    this.parcelCapacity = parcelCapacity; // Maximum parcel capacity of the vehicle
    this.passengerCapacity = passengerCapacity; // Maximum passenger capacity of the vehicle
    this.weight = weight; // Weight of the vehicle
    this.costPerHour = 3000 / 12; // Estimated cost per hour of operation
    this.co2 = 0; // Total CO2 emissions by the vehicle
    this.distance = 0; // Total distance traveled by the vehicle
    this.status = status; // Current operational status of the vehicle
    this.fleet = fleet; // Fleet to which the vehicle belongs
    this.created = this.time(); // Timestamp of when the vehicle instance was created
    this.co2PerKmKg = co2PerKmKg; // CO2 emission rate per kilometer traveled
    this.vehicleType = 'default'; // Type of vehicle (default for unspecified types)

    // ReplaySubjects to emit events for movements, cargo changes, and status updates
    this.movedEvents = new ReplaySubject();
    this.cargoEvents = new ReplaySubject();
    this.statusEvents = new ReplaySubject();
  }

  // Dispose of the vehicle instance, unsubscribe from ongoing operations
  dispose() {
    this.simulate(false); // Stop any ongoing simulation
    this._disposed = true; // Mark the vehicle as disposed
  }

  // Get current time using virtual time (asynchronous)
  time() {
    return virtualTime.getTimeInMillisecondsAsPromise();
  }

  // Start or stop simulating vehicle movement based on provided route
  simulate(route) {
    if (this.movementSubscription) {
      this.movementSubscription.unsubscribe(); // Unsubscribe from any previous movement subscription
    }
    if (!route) return; // If no route provided, return without starting simulation

    // Start simulating movement based on virtual time
    if (virtualTime.timeMultiplier === Infinity) {
      return this.updatePosition(route); // Teleport mode: update position directly
    }

    // Use RxJS to simulate movement over time
    this.movementSubscription = virtualTime
      .getTimeInMilliseconds()
      .pipe(
        scan((prevRemainingPointsInRoute, currentTimeInMs) => {
          if (!prevRemainingPointsInRoute.length) {
            this.stopped(); // If no remaining points, stop simulation
            return [];
          }

          // Interpolate the route to get current position and remaining points
          const { skippedPoints, remainingPoints, ...position } =
            interpolate.route(
              route.started,
              currentTimeInMs,
              prevRemainingPointsInRoute
            ) ?? this.heading;
          const newPosition = new Position(position);

          // If simulation start time is in the future, return empty array
          if (route.started > currentTimeInMs) {
            return [];
          }

          // Update vehicle position and remaining route points
          this.updatePosition(newPosition, skippedPoints, currentTimeInMs);
          return remainingPoints;
        }, interpolate.points(route))
      )
      .subscribe(() => null); // Subscribe to movement events
  }

  // Navigate vehicle to a specified position
  navigateTo(position) {
    this.heading = position; // Set navigation target position

    // If already close enough to target position, stop navigation
    if (this.position.distanceTo(position) < 100) {
      this.stopped(); // Stop vehicle
      return position; // Return current position
    }

    // Calculate route using OSRM and initiate navigation
    return osrm
      .route(this.position, this.heading)
      .then(async (route) => {
        route.started = await this.time(); // Set start time for route
        this.route = route; // Store calculated route
        if (!route.legs) // If no route legs found, throw error
          throw new Error(
            `Route not found from: ${JSON.stringify(
              this.position
            )} to: ${JSON.stringify(this.heading)} from: ${JSON.stringify(
              this.position
            )}`
          );
        this.simulate(this.route); // Start simulating the route
        return this.heading; // Return navigation target position
      })
      .catch(
        (err) =>
          error('Route error, retrying in 1s...', err) || // Log and retry route calculation
          wait(1000).then(() => this.navigateTo(position)) // Retry navigation after waiting
      );
  }

  // Handle a new booking request
  async handleBooking(booking) {
    assert(booking instanceof Booking, 'Booking needs to be of type Booking'); // Assert booking type

    if (!this.booking) {
      this.booking = booking; // Assign new booking to vehicle
      booking.assign(this); // Assign vehicle to the booking
      this.status = 'toPickup'; // Update vehicle status
      this.statusEvents.next(this); // Emit status update event

      this.navigateTo(booking.pickup.position); // Navigate vehicle to pickup position
    } else {
      this.queue.push(booking); // Queue new booking if vehicle already has a booking
      booking.assign(this); // Assign vehicle to the booking

      booking.queued(this); // Notify booking is queued
    }
    return booking; // Return handled booking
  }

  // Wait at pickup location until departure time
  async waitAtPickup() {
    const departure = moment(
      this.booking.pickup.departureTime,
      'hh:mm:ss'
    ).valueOf(); // Get departure time in milliseconds
    const waitingtime = moment(departure).diff(
      moment(await virtualTime.getTimeInMillisecondsAsPromise())
    ); // Calculate waiting time until departure

    // If waiting time is positive, pause interpolation and wait until departure time
    if (waitingtime > 0) {
      this.simulate(false); // Pause interpolation
      await virtualTime.waitUntil(departure); // Wait until departure time
    }
  }

  // Perform pickup action
  async pickup() {
    if (this._disposed) return; // If vehicle is disposed, exit pickup process

    await this.waitAtPickup(); // Wait at pickup location until departure time

    // Perform pickup actions after waiting
    setImmediate(() => {
      if (this.booking) this.booking.pickedUp(this.position); // Mark booking as picked up
      this.cargo.push(this.booking); // Add booking to cargo list

      // Check and pick up additional bookings at pickup location
      this.queue
        .filter((b) => this.position.distanceTo(b.pickup.position) < 200)
        .forEach((booking) => {
          this.cargo.push(booking); // Add booking to cargo list
          booking.pickedUp(this.position); // Mark additional booking as picked up
          this.cargoEvents.next(this); // Emit cargo change event
        });

      // Proceed to delivery if destination is specified in current booking
      if (this.booking && this.booking.destination) {
        this.booking.pickedUp(this.position); // Mark booking as picked up
        this.status = 'toDelivery'; // Update vehicle status
        this.statusEvents.next(this); // Emit status update event

        // Decide whether to pick up more bookings or head directly to destination
        if (
          this.queue.length > 0 &&
          haversine(this.queue[0].pickup.position, this.position) <
            haversine(this.booking.destination.position, this.position)
        ) {
          this.navigateTo(this.queue[0].pickup.position); // Navigate to next pickup location
        } else {
          this.navigateTo(this.booking.destination.position); // Navigate to delivery destination
        }
      }
    });
  }

  // Perform drop-off action
  dropOff() {
    if (this.booking) {
      this.booking.delivered(this.position); // Mark booking as delivered
      this.delivered.push(this.booking); // Add booking to delivered list
      this.booking = null; // Clear current booking
    }
    this.statusEvents.next(this); // Emit status update event

    this.pickNextFromCargo(); // Pick next booking from cargo for delivery
  }

  // Pick next booking from cargo for delivery
  pickNextFromCargo() {
    // Sort cargo by distance to destination
    this.cargo.sort(
      (a, b) =>
        haversine(this.position, a.destination.position) -
        haversine(this.position, b.destination.position)
    );
    const booking = this.cargo.shift(); // Get the first booking from sorted cargo list
    this.cargoEvents.next(this); // Emit cargo change event

    if (booking) {
      this.navigateTo(this.booking.destination.position); // Navigate to delivery destination
    } else {
      // If no more bookings in cargo, determine next action
      this.queue.sort(
        (a, b) =>
          haversine(this.position, a.destination.position) -
          haversine(this.position, b.destination.position)
      );

      const nextBooking = this.queue.shift(); // Get the first booking from sorted queue
      if (nextBooking) {
        this.handleBooking(nextBooking); // Handle next booking in the queue
      } else {
        this.status = 'ready'; // Update vehicle status to ready
        this.navigateTo(this.origin); // Return to origin position
      }
    }
    return booking; // Return the picked booking
  }

  // Calculate total weight of cargo (including passengers or packages)
  cargoWeight() {
    return this.cargo.reduce((total, booking) => total + booking.weight, 0);
  }

  // Update vehicle position based on new position, points passed, and time
  async updatePosition(position, pointsPassedSinceLastUpdate, time) {
    const lastPosition = this.position || position; // Store last known position
    const timeDiff = time - this.lastPositionUpdate; // Calculate time difference since last update

    // Calculate distance moved since last update
    const metersMoved =
      pointsPassedSinceLastUpdate.reduce(
        (acc, { meters }) => acc + meters,
        0
      ) || haversine(lastPosition, position);

    // Calculate seconds spent since last update
    const seconds = pointsPassedSinceLastUpdate.reduce(
      (acc, { duration }) => acc + duration,
      0
    );

    // Calculate kilometers moved and hours spent moving
    const [km, h] = [metersMoved / 1000, seconds / 60 / 60];

    // Update CO2 emissions based on distance traveled
    const co2 = this.updateCarbonDioxide(km);

    // Update distance traveled, points passed, speed, position, and last update time
    this.distance += km;
    this.pointsPassedSinceLastUpdate = pointsPassedSinceLastUpdate;
    this.speed = Math.round(km / h || 0);
    this.position = position;
    this.lastPositionUpdate = time;
    this.ema = haversine(this.heading, this.position); // Update EMA (Exponential Moving Average) distance

    // If movement occurred, update bearing and notify cargo/passengers
    if (metersMoved > 0) {
      this.bearing = bearing(lastPosition, position) || 0; // Calculate bearing angle
      this.movedEvents.next(this); // Emit movement event

      // Notify cargo and passengers about movement details
      const cargoAndPassengers = [...this.cargo, ...(this.passengers || [])];
      cargoAndPassengers.map((booking) => {
        booking.moved(
          this.position,
          metersMoved,
          co2 / (this.cargo.length + 1), // Adjust CO2 for number of active bookings and cargo
          (h * this.costPerHour) / (this.cargo.length + 1), // Adjust cost for number of active bookings and cargo
          timeDiff
        );
      });
    }
  }

  // Stop vehicle and perform appropriate action based on current status
  stopped() {
    this.speed = 0; // Set vehicle speed to zero
    this.statusEvents.next(this); // Emit status update event

    // If a booking is present, handle appropriate action based on status
    if (this.booking) {
      this.simulate(false); // Stop ongoing simulation
      if (this.status === 'toPickup') return this.pickup(); // Perform pickup action
      if (this.status === 'toDelivery') return this.dropOff(); // Perform drop-off action
    }
  }

  /**
   * Add carbon dioxide emissions to this vehicle according to the distance traveled.
   * @param {number} Distance The distance traveled in km
   * @returns {number} The amount of carbon dioxide emitted
   */
  updateCarbonDioxide(distance) {
    let co2;

    // Calculate CO2 emissions based on vehicle type and cargo weight
    switch (this.vehicleType) {
      case 'bus':
      case 'car':
      case 'taxi':
        co2 = distance * this.co2PerKmKg;
        break;
      default:
        co2 = (this.weight + this.cargoWeight()) * distance * this.co2PerKmKg;
    }

    this.co2 += co2; // Update total CO2 emissions
    return co2; // Return CO2 emissions for this trip
  }
}

module.exports = Vehicle; // Export Vehicle class for external usage
