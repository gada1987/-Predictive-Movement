const {Subject,range,from,merge, of,firstValueFrom, } = require('rxjs')
   // Subject: Special type of Observable that allows multicasting to multiple observers
   // range: Create an observable that emits a range of sequential integers
   // from: Convert an array, promise, or iterable to an observable
   // merge: Create an observable that emits all provided observables' values in parallel
   // of: Emit a sequence of values as an observable
   // firstValueFrom: Convert the first value of an observable to a promise
   // Import necessary RxJS operators

const {
  shareReplay, // shareReplay: Share the source observable and replay specified number of emissions to new subscribers
  mergeMap, // mergeMap: Map to observable, flatten and merge
  share, // share: Share source observable among multiple subscribers
  catchError, // catchError: Handle errors in observable sequence
  first, // first: Emit the first value that passes a provided condition
} = require('rxjs/operators') // RxJS operators for handling observables

const { dispatch } = require('../utils/dispatch/dispatchCentral'); // Import dispatch function for handling vehicle dispatch
const Car = require('./vehicles/car'); // Import Car class for vehicle type
const Truck = require('./vehicles/truck'); // Import Truck class for vehicle type
const Drone = require('./vehicles/drone'); // Import Drone class for vehicle type
const Taxi = require('./vehicles/taxi'); // Import Taxi class for vehicle type
const Bus = require('./vehicles/bus'); // Import Bus class for vehicle type
const Position = require('./geo/position'); // Import Position class for handling geographic positions
const { error, debug } = require('../log'); // Import error and debug loggers

const config = require('../../config/index.js')

// fleet.js
const centralConfig = require('../../config/loadCentralConfig');

// You can now access centralConfig.servers, centralConfig.paths, etc.
const vehicleTypes = centralConfig.vehicleTypes;
//Load vehicletypes from the configuration
//const vehicleTypes = config.vehicleTypes()
const vehicleClasses = {
  Car,
  Truck,
  Drone,
  Taxi,
  Bus,
}

for(const type in vehicleTypes){
  if(vehicleTypes[type].className in vehicleClasses){
    vehicleTypes[type].class = vehicleClasses[vehicleTypes[type].className];
  }else{
    throw new Error('Unknown vehicle class: ${vehicleTypes[type].className}');
  }
}


class Fleet {
  constructor({
    name, // Name of the fleet
    marketshare, // Market share percentage of the fleet
    percentageHomeDelivery, // Percentage of home deliveries
    vehicles, // Object containing vehicle types and counts
    hub, // Geographic hub position
    type, // Type of fleet
    kommun, // Municipality associated with the fleet
  }) {
    this.name = name; // Assign fleet name
    this.type = type; // Assign fleet type
    this.marketshare = marketshare; // Assign fleet market share
    this.hub = { position: new Position(hub) }; // Assign hub position as Position object

    this.percentageHomeDelivery = (percentageHomeDelivery || 0) / 100 || 0.15; // Set percentage of home delivery
    this.percentageReturnDelivery = 0.1; // Set percentage of return delivery
    this.kommun = kommun; // Assign municipality associated with the fleet

    // Create fleet's cars observable from vehicles object
    this.cars = from(Object.entries(vehicles)).pipe(
      mergeMap(([type, count]) =>
        range(0, count).pipe(
          mergeMap(() => {
            const Vehicle = vehicleTypes[type].class; // Retrieve class reference for vehicle type

            return of(
              new Vehicle({
                ...vehicleTypes[type], // Spread vehicle type properties
                fleet: this, // Assign fleet reference to vehicle
                position: this.hub.position, // Assign hub position to vehicle
              })
            );
          }),
          catchError((err) => {
            error(
              `Error creating vehicle for fleet ${name}: ${err}\n\n${
                new Error().stack
              }\n\n`
            ); // Log error if vehicle creation fails
          })
        )
      ),
      shareReplay() // Share and replay fleet cars observable
    );

    this.unhandledBookings = new Subject(); // Subject for unhandled bookings
    this.manualDispatchedBookings = new Subject(); // Subject for manually dispatched bookings

    // Observable for dispatched bookings using dispatch function
    this.dispatchedBookings = merge(
      this.manualDispatchedBookings, // Include manually dispatched bookings
      dispatch(this.cars, this.unhandledBookings) // Use dispatch function to handle unhandled bookings
    ).pipe(share()); // Share dispatched bookings among subscribers
  }

  // Check if fleet can handle a specific booking
  async canHandleBooking(booking) {
    return firstValueFrom(
      this.cars.pipe(
        first((car) => car.canHandleBooking(booking), false /* defaultValue */)
      )
    );
  }

  // Handle booking by assigning fleet reference and dispatching to vehicle
  async handleBooking(booking, car) {
    booking.fleet = this; // Assign fleet reference to booking

    if (car) {
      this.manualDispatchedBookings.next(booking); // Emit booking to manually dispatched bookings
      return await car.handleBooking(booking); // Handle booking with specified car
    } else {
      debug(`📦 Dispatching ${booking.id} to ${this.name}`); // Debug log for dispatching booking
      this.unhandledBookings.next(booking); // Emit booking to unhandled bookings
    }

    return booking; // Return handled booking
  }
}

module.exports = Fleet; // Export Fleet class for use in other modules
