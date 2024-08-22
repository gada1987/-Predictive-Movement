const Vehicle = require('./vehicle')
const { virtualTime } = require('../../utils/virtualTime')
const interpolate = require('../../utils/geo/interpolate')
const { haversine } = require('../../utils/geo/distance')

class Drone extends Vehicle {
  /**
   * Creates an instance of Drone.
   * @param {Object} params Parameters to initialize Drone object.
   */
  constructor({ maxSpeed = 80, position, ...vehicle }) {
    super(vehicle)
    this.maxSpeed = maxSpeed; // Maximum speed of the drone in km/h
    this.position = this.origin = position; // Current position and starting position of the drone
    this.co2PerKmKg = 0.001; // CO2 emission per kilometer in kilograms
    this.maximumWeight = 10; // Maximum weight the drone can carry in kilograms
    this.range = 100_000; // Maximum range of the drone in meters
    this.altitude = 0; // Current altitude of the drone
    this.maximumAltitude = 800; // Maximum altitude the drone can fly at
    this.dropoffTime = 600; // Time in seconds it takes to drop off a parcel
    this.vehicleType = 'drone'; // Type of vehicle is set to 'drone'
  }

  /**
   * Simulates the movement of the drone along a specified route.
   * @param {Object} route The route object containing information about the path to follow.
   */
  simulate(route) {
    clearInterval(this._interval);
    if (!route) return;
    if (virtualTime.timeMultiplier === Infinity)
      return this.updatePosition(route); // Teleport mode
    this._interval = setInterval(async () => {
      if (virtualTime.timeMultiplier === 0) return; // Don't update position when time is stopped
      const newPosition = interpolate.route(route, await this.time()) ?? this.heading;
      this.updatePosition(newPosition);
      const metersFromStart = haversine(this.position, this.startingFrom);
      this.altitude = Math.min(this.maximumAltitude, this.ema, metersFromStart);
    }, 100);
  }

  /**
   * Checks if the drone can pick up a booking based on distance, weight, and capacity constraints.
   * @param {Object} booking The booking object containing pickup and destination information.
   * @returns {boolean} Returns true if the drone can pick up the booking; false otherwise.
   */
  canPickupBooking(booking) {
    const pickupDistance = haversine(this.position, booking.pickup.position);
    const deliveryDistance = haversine(
      booking.pickup.position,
      booking.destination.position
    );
    if (this.weight + booking.weight > this.maximumWeight) return false; // Check weight capacity
    if (pickupDistance + deliveryDistance > this.range) return false; // Check range capacity
    return this.parcelCapacity > this.queue.length + this.cargo.length; // Check parcel capacity
  }

  /**
   * Navigates the drone to a specified destination position.
   * @param {Object} position The destination position to navigate to.
   * @returns {Object} The heading position the drone navigates towards.
   */
  async navigateTo(position) {
    this.startingFrom = this.position; // Set starting position
    this.heading = position; // Set destination position
    const distance = haversine(this.position, position); // Calculate distance in meters
    const km = distance / 1000;
    const h = km / this.maxSpeed;
    const duration = h * 60 * 60; // Calculate duration in seconds
    this.route = {
      started: await this.time(),
      distance,
      duration,
      geometry: {
        coordinates: [this.position, position, position], // Add one more so the interpolation routine works
      },
      legs: [
        {
          annotation: {
            distance: [distance, 0],
            duration: [duration, this.dropoffTime],
          },
        },
      ],
    };
    this.simulate(this.route); // Start simulating the route
    return this.heading;
  }
}

module.exports = Drone;
