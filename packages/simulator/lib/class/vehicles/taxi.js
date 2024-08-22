const { findBestRouteToPickupBookings } = require('../../utils/dispatch/taxiDispatch')
const { safeId } = require('../../utils/id')
const { debug } = require('../../log')
const Vehicle = require('./vehicle')
const { virtualTime } = require('../../utils/virtualTime')

const fleet = {
  name: 'taxi',
}

class Taxi extends Vehicle {
  constructor({ id = 't-' + safeId(), position, startPosition, ...vehicle }) {
    super({ position, id, fleet, ...vehicle })
    
    this.id = id; // Unique identifier for the taxi
    this.position = position; // Current position of the taxi
    this.heading = null; // Direction or heading of the taxi
    this.cargo = []; // List of cargo (parcels or goods) currently in the taxi
    this.passengers = []; // List of passengers currently in the taxi
    this.queue = []; // Queue of bookings (passenger or parcel requests) for the taxi
    this.passengerCapacity = 4; // Maximum number of passengers the taxi can carry
    this.parcelCapacity = 0; // Maximum number of parcels or cargo the taxi can carry
    this.booking = true; // Indicates if the taxi is available for bookings
    this.vehicleType = 'taxi'; // Type of vehicle is set to 'taxi'
    this.startPosition = startPosition || position; // Starting position of the taxi or default to current position
    this.co2PerKmKg = 0.1201; // CO2 emission per kilometer in kilograms
    this.plan = []; // Plan of actions (routes and instructions) for the taxi
    this.instruction = null; // Current instruction or action being executed by the taxi
  }

  /**
   * Executes when the taxi is stopped. Checks if it has returned to origin and then picks the next instruction from the plan.
   */
  stopped() {
    if (this.status === 'returning' && !this.plan?.length) {
      debug(this.id, 'returned'); // Log that the taxi has returned to origin
    }
    super.stopped(); // Call the stopped method of the Vehicle class
    this.pickNextInstructionFromPlan(); // Pick the next instruction from the plan
  }

  /**
   * Checks if the taxi can pick up more passengers based on its current capacity.
   * @returns {boolean} Returns true if the taxi can pick up more passengers; false otherwise.
   */
  canPickupMorePassengers() {
    return this.passengerCapacity > this.passengers.length;
  }

  /**
   * Picks the next instruction or action from the taxi's plan and executes it.
   */
  async pickNextInstructionFromPlan() {
    this.instruction = this.plan?.shift(); // Shift the next instruction from the plan
    this.booking = this.instruction?.booking; // Set the current booking for the instruction
    this.status = this.instruction?.action || 'ready'; // Set the status of the taxi based on the instruction action
    this.statusEvents.next(this); // Emit status events

    switch (this.status) {
      case 'pickup':
        await virtualTime.waitUntil(this.instruction.arrival); // Wait until arrival time for pickup
        this.status = 'toPickup'; // Set status to 'toPickup' indicating moving to pickup location
        return this.navigateTo(this.booking.pickup.position); // Navigate to pickup location
      case 'delivery':
        this.status = 'toDelivery'; // Set status to 'toDelivery' indicating moving to delivery location
        await virtualTime.waitUntil(this.instruction.arrival); // Wait until arrival time for delivery
        return this.navigateTo(this.booking.destination.position); // Navigate to delivery location
      case 'start':
        return this.pickNextInstructionFromPlan(); // Pick the next instruction from the plan
      case 'returning':
        this.status = 'ready'; // Set status to 'ready' when returning to origin
        if (this.plan.length) return this.pickNextInstructionFromPlan(); // If there are more bookings, pick the next instruction
        return; // Otherwise, return
      default:
        this.status = 'returning'; // Set status to 'returning' if no specific action is defined
        return this.navigateTo(this.startPosition); // Navigate to the starting position (return to origin)
    }
  }

  /**
   * Executes the pickup action for passengers.
   */
  async pickup() {
    debug('Pickup passenger', this.id, this.booking?.passenger?.name); // Log pickup action
    this.passengers.push(this.booking.passenger); // Add passenger to the list
    this.cargoEvents.next(this); // Emit cargo events
    this.booking.pickedUp(this.position); // Notify booking that passenger has been picked up
  }

  /**
   * Executes the drop-off action for passengers.
   */
  async dropOff() {
    debug('Dropoff passenger', this.id, this.booking?.passenger?.name); // Log drop-off action
    this.passengers = this.passengers.filter((p) => p !== this.booking.passenger); // Remove passenger from the list
    this.cargoEvents.next(this); // Emit cargo events
    this.booking.delivered(this.position); // Notify booking that passenger has been dropped off
  }

  /**
   * Checks if the taxi can handle a specific booking (passenger or parcel).
   * @param {Object} booking The booking object to check.
   * @returns {boolean} Returns true if the taxi can handle the booking; false otherwise.
   */
  canHandleBooking(booking) {
    if (booking.type === 'parcel') {
      return this.cargo.length < this.parcelCapacity; // Check if there is capacity for parcels
    }
    if (booking.type === 'passenger') {
      return this.passengers.length < this.passengerCapacity; // Check if there is capacity for passengers
    }
    return false; // Default to false if booking type is not recognized
  }

  /**
   * Handles a booking by adding it to the queue, assigning it, and planning the best route to pick it up.
   * @param {Object} booking The booking object to handle.
   * @returns {Object} Returns the handled booking object.
   */
  async handleBooking(booking) {
    this.queue.push(booking); // Add booking to the queue
    booking.assign(this); // Assign the booking to this taxi
    booking.queued(this); // Notify booking that it has been queued

    debug('🙋‍♂️ Dispatching', booking.id, 'to', this.id); // Log dispatching action

    clearTimeout(this._timeout); // Clear any existing timeout
    this._timeout = setTimeout(async () => {
      this.plan = await findBestRouteToPickupBookings(this, this.queue); // Find the best route to pick up bookings
      if (!this.instruction) await this.pickNextInstructionFromPlan(); // If no current instruction, pick the next one
    }, 2000); // Delay before planning route

    return booking; // Return the handled booking object
  }
}

module.exports = Taxi; // Export the Taxi class
