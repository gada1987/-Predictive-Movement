const { virtualTime } = require('../utils/virtualTime'); // Import virtualTime for time-related operations
const { safeId } = require('../utils/id'); // Import safeId for generating safe IDs

const { ReplaySubject, merge } = require('rxjs'); // Import ReplaySubject and merge from RxJS for event handling

class Booking {
  constructor(booking) {
    Object.assign(this, booking); // Initialize Booking object with properties from booking parameter
    // Generate unique ID for the booking based on sender's name or default to 'b' + safeId()
    this.id = `${booking.sender ? booking.sender.replace(/&/g, '').toLowerCase() : 'b'}-` + safeId();
    this.status = 'New'; // Initial status of the booking
    this.co2 = 0; // Initial CO2 emissions set to zero
    this.passenger = booking.passenger; // Assign passenger information from booking
    this.type = booking.type; // Assign type of booking (e.g., package, passenger)
    this.cost = 0; // Initial cost of the booking
    this.distance = 0; // Initial distance traveled set to zero
    this.weight = Math.random() * 10; // Randomly assign weight (kg) for the booking
    this.position = this.pickup?.position; // Set initial position based on pickup position, if available
    this.queuedEvents = new ReplaySubject(); // ReplaySubject for queued events
    this.pickedUpEvents = new ReplaySubject(); // ReplaySubject for picked up events
    this.assignedEvents = new ReplaySubject(); // ReplaySubject for assigned events
    this.deliveredEvents = new ReplaySubject(); // ReplaySubject for delivered events
    // Combine all status-related events into a single stream using merge()
    this.statusEvents = merge(
      this.queuedEvents,
      this.assignedEvents,
      this.pickedUpEvents,
      this.deliveredEvents
    );
  }

  // Method to mark the booking as queued
  async queued(car) {
    this.queuedDateTime = await virtualTime.getTimeInMillisecondsAsPromise(); // Record queued timestamp
    this.status = 'Queued'; // Update booking status to 'Queued'
    this.car = car; // Associate booking with a car
    this.queuedEvents.next(this); // Emit queued event
  }

  // Method to assign a car to the booking
  async assign(car) {
    // Set assigned timestamp if not already set
    this.assigned = this.assigned || (await virtualTime.getTimeInMillisecondsAsPromise());
    this.car = car; // Associate booking with a car
    this.status = 'Assigned'; // Update booking status to 'Assigned'
    this.assignedEvents.next(this); // Emit assigned event
  }

  // Method to update booking's position and related metrics when moved
  async moved(position, metersMoved, co2, cost) {
    this.position = position; // Update current position
    // Notify associated passenger (if any) about the movement
    this.passenger?.moved(
      position,
      metersMoved,
      co2,
      cost,
      (await virtualTime.getTimeInMillisecondsAsPromise()) - this.pickedUpDateTime
    );
    this.distance += metersMoved; // Update total distance traveled
    this.cost += cost; // Update total cost
    this.co2 += co2; // Update total CO2 emissions
  }

  // Method to mark the booking as picked up
  async pickedUp(position, date = virtualTime.getTimeInMillisecondsAsPromise()) {
    date = await date; // Ensure date is resolved to milliseconds
    this.pickupDateTime = date; // Record pickup timestamp
    this.pickupPosition = position; // Record pickup position
    this.status = 'Picked up'; // Update booking status to 'Picked up'
    this.pickedUpEvents.next(this); // Emit picked up event
  }

  // Method to mark the booking as delivered
  async delivered(position, date = virtualTime.getTimeInMillisecondsAsPromise()) {
    date = await date; // Ensure date is resolved to milliseconds
    this.deliveredDateTime = date; // Record delivery timestamp
    this.deliveredPosition = position; // Record delivery position
    // Calculate delivery time based on assigned or queued time
    this.deliveryTime = (date - (this.assigned || this.queued)) / 1000;
    this.status = 'Delivered'; // Update booking status to 'Delivered'
    this.deliveredEvents.next(this); // Emit delivered event
  }

  // Method to convert Booking object to a plain JavaScript object (POJO)
  toObject() {
    return {
      id: this.id,
      status: this.status,
      type: this.type,
      co2: this.co2,
      cost: this.cost,
      distance: this.distance,
      weight: this.weight,
      sender: this.sender,
      position: this.position?.toObject(), // Convert position to plain object if available
      pickup: this.pickup,
      carId: this.car?.id,
      destination: this.destination,
      pickupPosition: this.pickupPosition?.toObject(), // Convert pickup position to plain object if available
      deliveredPosition: this.deliveredPosition?.toObject(), // Convert delivered position to plain object if available
      pickupDateTime: this.pickupDateTime,
      deliveredDateTime: this.deliveredDateTime,
      deliveryTime: this.deliveryTime,
      queued: this.queued,
      assigned: this.assigned,
    };
  }
}

module.exports = Booking; // Export Booking class for use in other modules
