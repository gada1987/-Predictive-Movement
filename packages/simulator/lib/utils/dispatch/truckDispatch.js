const { plan, truckToVehicle, bookingToShipment } = require('../../deps/vroom'); // Import necessary functions from Vroom dependencies
const { error } = require('../../log'); // Import logging functions

// Function to find the best route for a truck to pick up bookings
const findBestRouteToPickupBookings = async (truck, bookings) => {
  const vehicles = [truckToVehicle(truck, 0)]; // Convert the truck to a vehicle format
  const shipments = bookings.map(bookingToShipment); // Convert bookings to shipment format

  const result = await plan({ shipments, vehicles }); // Call the plan function with shipments and vehicles

  // Log an error if there are unassigned bookings
  if (result.unassigned?.length > 0) {
    error(`Unassigned bookings: ${result.unassigned}`);
  }

  // Filter steps to include only pickup, delivery, or start actions and return the instructions
  return result.routes[0]?.steps
    .filter(({ type }) => ['pickup', 'delivery', 'start'].includes(type))
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
  findBestRouteToPickupBookings, // Export the findBestRouteToPickupBookings function for use in other modules
};
