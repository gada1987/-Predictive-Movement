const Vehicle = require('./vehicle') // Importing the Vehicle class

const { error, info } = require('../../log') // Importing logging utilities
const { from } = require('rxjs') // Importing RxJS from function

// TODO: Create this somewhere else as a real fleet
const lanstrafiken = {
  name: 'Länstrafiken i Norrbotten',
}

/**
 * Represents a Bus, extending from Vehicle.
 */
class Bus extends Vehicle {
  /**
   * Creates an instance of Bus.
   * @param {Object} params Parameters to initialize Bus object.
   */
  constructor({
    startPosition,
    position,
    heading,
    lineNumber,
    id,
    stops,
    finalStop,
    parcelCapacity,
    passengerCapacity,
    passengerBookings,
    kommun,
    ...vehicle
  }) {
    super({
      position,
      id,
      stops,
      fleet: lanstrafiken,
      ...vehicle,
    })

    // Initialize Bus properties
    this.lineNumber = lineNumber
    this.finalStop = finalStop
    this.vehicleType = 'bus'
    this.heading = heading
    this.kommun = kommun
    this.passengerBookings = passengerBookings
    this.passengersLength = 0
    this.startPosition = startPosition
    this.passengerCapacity = passengerCapacity // TODO: Fill this from the workshop poll
    this.parcelCapacity = parcelCapacity // TODO: Fill this from the workshop poll
    this.co2PerKmKg = 1.3 // NOTE: From a quick google. Needs to be verified.
  }

  /**
   * Checks if the bus can handle the given booking type.
   * @param {Booking} booking Booking to check.
   * @returns {boolean} True if the bus can handle the booking; false otherwise.
   */
  canHandleBooking(booking) {
    return booking.type === 'busstop' || booking.type === 'parcel'
  }

  /**
   * Handles a booking by adding it to the queue and setting it as queued.
   * @param {Booking} booking Booking to handle.
   * @returns {Promise<Booking>} Promise that resolves to the handled booking.
   */
  async handleBooking(booking) {
    this.queue.push(booking)
    booking.queued(this)
    if (!this.booking) {
      this.pickNextFromQueue()
    }
    return booking
  }

  /**
   * Resets the bus by clearing the queue and setting the position to the starting position.
   */
  reset() {
    this.queue = []
    this.position = this.startPosition
  }

  /**
   * Handles the pickup process at each stop.
   * Waits until the departure time is reached before proceeding.
   * @returns {Promise<void>} Promise that resolves once the pickup process is complete.
   */
  async pickup() {
    this.booking = this.queue.shift()
    if (!this.booking) {
      this.simulate(false)
      return
    }

    await this.waitAtPickup()

    // TODO: Optimize observable handling
    // Example: Fetch citizens from bus stops and update passenger bookings
    /*
    this.passengerBookings.pipe(
      filter(passengerBus => passengerBus.pickup.stopId === this.booking.pickup.stopId),
      // filter(passengerBus => passengerBus.status === "New"),
    ).subscribe(
      passengerBus => {
        if (this.passengerCapacity - this.passengersLength >= 1){
          passengerBus.status = "Picked Up"
          this.passengersLength += 1
        }
      }
    )
    */

    this.lineNumber = this.booking.lineNumber
      ? this.booking.lineNumber
      : this.lineNumber

    this.booking.pickedUp(this.position)
    if (this.booking.type !== 'busstop') {
      this.cargo.push(this.booking)
    }

    if (!this.booking) {
      this.simulate(false)
      return
    }
    this.status = 'toDelivery'
    return this.navigateTo(this.booking.destination.position) // Resume simulation
  }

  /**
   * Handles the drop-off process at each stop.
   * If a booking is present, marks it as delivered and updates the internal state.
   */
  dropOff() {
    if (this.booking) {
      // TODO: Optimize observable handling
      // Example: Leave citizens at bus stops and update passenger bookings
      /*
      this.passengerBookings.pipe(
        filter(passengerBus => passengerBus.destination.stopId === this.booking.pickup.stopId),
        // filter(passengerBus => passengerBus.status === "Picked up"),
      ).subscribe(
        passengerBus => {
          passengerBus.status = "Delivered"
          this.booking.pickup.passagerare += 1
          this.passengerLength = Math.max(0, this.passengerLength - 1)
        }
      )
      */

      this.booking.delivered(this.position)
      this.delivered.push(this.booking)
      this.booking = null
    }
    this.statusEvents.next(this)

    this.pickNextFromQueue()
  }

  /**
   * Picks the next booking from the queue and initiates the 'toPickup' status.
   * @returns {Promise<void>} Promise that resolves once the next booking is picked.
   */
  async pickNextFromQueue() {
    const booking = this.queue.shift()
    if (!booking) return

    this.booking = booking
    booking.assign(this)
    this.status = 'toPickup'
    await this.navigateTo(booking.destination.position)
    this.movedEvents.next(this)
  }
}

module.exports = Bus // Exporting the Bus class
