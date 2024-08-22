const { findBestRouteToPickupBookings } = require('../../utils/dispatch/truckDispatch')
const { info, warn, debug } = require('../../log')
const Vehicle = require('./vehicle')

class Truck extends Vehicle {
  constructor(args) {
    super(args);

    // Truck-specific properties initialized
    this.vehicleType = 'car'; // Type of vehicle (should be 'truck', not 'car')
    this.isPrivateCar = false; // Indicates if the truck is a private car (always false for trucks)
    this.co2PerKmKg = 0.1201; // CO2 emission per kilometer in kilograms (needs verification)
    this.parcelCapacity = args.parcelCapacity; // Maximum capacity of parcels or cargo the truck can carry
    this.plan = []; // Plan of actions (routes and instructions) for the truck

    this.position = args.position; // Current position of the truck
    this.startPosition = args.startPosition || args.position; // Starting position of the truck (defaults to current position)
  }

  /**
   * Picks the next instruction from the truck's plan and executes it.
   * Handles various statuses ('start', 'pickup', 'delivery', 'ready', 'returning').
   */
  async pickNextInstructionFromPlan() {
    this.instruction = this.plan.shift(); // Shifts the next instruction/action from the plan
    this.booking = this.instruction?.booking; // Sets the current booking for the instruction
    this.status = this.instruction?.action || 'returning'; // Sets the status of the truck based on the instruction action
    this.statusEvents.next(this); // Emits status events

    switch (this.status) {
      case 'start':
        return this.navigateTo(this.startPosition); // Navigate to the starting position
      case 'pickup':
        this.status = 'toPickup'; // Sets status to 'toPickup' indicating moving to pickup location
        return this.navigateTo(this.booking.pickup.position); // Navigate to pickup location
      case 'delivery':
        this.status = 'toDelivery'; // Sets status to 'toDelivery' indicating moving to delivery location
        return this.navigateTo(this.booking.destination.position); // Navigate to delivery location
      case 'ready':
      case 'returning':
        this.status = 'ready'; // Sets status to 'ready' when returning or no specific action
        return; // Returns without navigating if no specific action is required
      default:
        warn('Unknown status', this.status, this.instruction); // Logs a warning for unknown status
        if (!this.plan.length) this.status = 'returning'; // Sets status to 'returning' if no plan
        return this.navigateTo(this.startPosition); // Navigate to the starting position
    }
  }

  /**
   * Overrides the stopped method of the Vehicle class.
   * Executes when the truck is stopped. Picks the next instruction from the plan.
   */
  stopped() {
    super.stopped(); // Calls the stopped method of the Vehicle class
    this.pickNextInstructionFromPlan(); // Picks the next instruction from the plan
  }

  /**
   * Simulates picking up cargo (parcels) for the truck.
   */
  async pickup() {
    if (!this.booking) return warn('No booking to pickup', this.id); // Logs a warning if no booking to pickup
    if (this.cargo.indexOf(this.booking) > -1) return warn('Already picked up', this.id, this.booking.id); // Logs a warning if already picked up

    debug('Pickup cargo', this.id, this.booking.id); // Logs pickup action
    this.cargo.push(this.booking); // Adds the booking (cargo) to the truck's cargo list
    this.cargoEvents.next(this); // Emits cargo events
    this.booking.pickedUp(this.position); // Notifies booking that cargo has been picked up
  }

  /**
   * Simulates dropping off cargo (parcels) for the truck.
   */
  async dropOff() {
    this.cargo = this.cargo.filter((p) => p !== this.booking); // Removes the booking (cargo) from the truck's cargo list
    this.cargoEvents.next(this); // Emits cargo events
    this.booking.delivered(this.position); // Notifies booking that cargo has been delivered
  }

  /**
   * Checks if the truck can handle a specific booking (parcel).
   * @param {Object} booking The booking object to check.
   * @returns {boolean} Returns true if the truck can handle the booking; false otherwise.
   */
  canHandleBooking(booking) {
    return booking.type === 'parcel' && this.cargo.length < this.parcelCapacity; // Checks if truck can handle the parcel booking based on capacity
  }

  /**
   * Handles a booking by adding it to the queue, assigning it, and planning the best route to pick it up.
   * @param {Object} booking The booking object to handle.
   * @returns {Object} Returns the handled booking object.
   */
  async handleBooking(booking) {
    if (this.queue.indexOf(booking) > -1) throw new Error('Already queued'); // Throws error if booking is already in the queue
    this.queue.push(booking); // Adds booking to the queue
    booking.assign(this); // Assigns the booking to this truck
    booking.queued(this); // Notifies booking that it has been queued

    clearTimeout(this._timeout); // Clears any existing timeout
    this._timeout = setTimeout(async () => {
      this.plan = await findBestRouteToPickupBookings(this, this.queue); // Plans the best route to pick up bookings
      if (!this.instruction) await this.pickNextInstructionFromPlan(); // Picks the next instruction from the plan if no current instruction
    }, 2000); // Sets timeout for planning route

    return booking; // Returns the handled booking object
  }

  /**
   * Simulates waiting at pickup for the truck (trucks don't wait at pickup, so this is a no-op).
   */
  async waitAtPickup() {
    return; // Trucks don't wait at pickup, so this method does nothing
  }
}

module.exports = Truck; // Exports the Truck class
