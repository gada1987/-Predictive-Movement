const { plan, taxiToVehicle, bookingToShipment } = require('../../deps/vroom'); // Import necessary functions from Vroom dependencies
const moment = require('moment'); // Import the 'moment' library for date/time manipulation
const { error, debug, write, info } = require('../../log'); // Import logging functions
const { virtualTime } = require('../virtualTime'); // Import virtualTime module for time manipulation

// Function to dispatch taxis to bookings
const taxiDispatch = async (taxis, bookings) => {
  const vehicles = taxis.map(taxiToVehicle); // Convert taxis to vehicle format
  const shipments = bookings.map(bookingToShipment); // Convert bookings to shipment format
  info(
    `Finding optimal route for ${vehicles.length} taxis and ${shipments.length} pickups`
  ); // Log the dispatch information
  write('🚕'); // Write a log with a taxi emoji
  const result = await plan({ shipments, vehicles }); // Call the plan function with shipments and vehicles
  const virtualNow = await virtualTime.getTimeInMillisecondsAsPromise(); // Get the current virtual time
  const now = moment(new Date(virtualNow)); // Convert virtual time to a moment object

  return result?.routes.map((route) => {
    write('✅'); // Write a log with a checkmark emoji
    return {
      taxi: taxis[route.vehicle], // Get the assigned taxi
      bookings: route.steps
        .filter((s) => s.type === 'pickup') // Filter steps to include only pickups
        .flatMap((step) => {
          const booking = bookings[step.id]; // Get the corresponding booking

          booking.pickup.departureTime = now
            .add(step.arrival - step.duration, 'seconds')
            .format('hh:mm:ss'); // Set the departure time for the booking

          return booking; // Return the modified booking
        }),
    };
  });
};

// Function to find the best route for a taxi to pick up bookings
const findBestRouteToPickupBookings = async (taxi, bookings) => {
  const vehicles = [taxiToVehicle(taxi, 0)]; // Convert the taxi to a vehicle format
  const shipments = bookings.map(bookingToShipment); // Convert bookings to shipment format

  const result = await plan({ shipments, vehicles }); // Call the plan function with shipments and vehicles

  if (!result || !result.routes || result.routes.length === 0) {
    error(`Unassigned bookings: ${result.unassigned}`); // Log an error if there are unassigned bookings
    return null; // Return null if no routes are found
  }

  return result.routes[0].steps
    .filter(({ type }) => ['pickup', 'delivery', 'start'].includes(type)) // Filter steps to include only pickup, delivery, or start actions
    .map(({ id, type, arrival, departure }) => {
      const booking = bookings[id]; // Get the corresponding booking
      const instruction = {
        action: type,
        arrival,
        departure,
        booking,
      };
      return instruction; // Return the instruction object
    });
};

module.exports = {
  taxiDispatch, // Export the taxiDispatch function for use in other modules
  findBestRouteToPickupBookings, // Export the findBestRouteToPickupBookings function for use in other modules
};
