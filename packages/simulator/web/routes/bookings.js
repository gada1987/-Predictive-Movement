const { pipe, map, bufferTime, filter } = require('rxjs');

/**
 * Transforms booking objects to a cleaner format.
 * 
 * This function maps the booking data to a more structured format, extracting and renaming
 * fields for easier use. It also formats the position data and optionally extracts data from
 * nested objects like `car`. 
 * 
 * TODO: Replace `cleanBookings` with a `.toObject()` method on the Booking class to streamline this process.
 * 
 * @returns {OperatorFunction<Object, Object>} An RxJS operator function to clean and transform booking data.
 */
const cleanBookings = () =>
  pipe(
    map(
      ({
        pickup,
        destination,
        assigned,
        id,
        status,
        isCommercial,
        co2,
        cost,
        deliveryTime,
        car,
        type,
      }) => ({
        id,
        pickup: pickup.position, // Position of the pickup location
        assigned,
        destination: destination.position, // Position of the destination
        status,
        isCommercial,
        deliveryTime,
        co2,
        cost,
        carId: car?.id, // Optional car ID
        type,
        passagerare: pickup.passagerare, // Number of passengers at pickup
        name: pickup.name, // Pickup location name
        kommun: pickup.kommun // Pickup location municipality
      })
    )
  );

/**
 * Registers the booking data streams to emit cleaned bookings to a socket.
 * 
 * The function sets up two subscriptions: one for dispatched bookings and one for booking updates.
 * It cleans and buffers the incoming data and then emits it to the given socket.
 * 
 * @param {Object} experiment - The experiment object containing booking data streams.
 * @param {Object} socket - The socket object to emit cleaned bookings.
 * @returns {Array<Subscription>} An array of subscriptions to manage the data streams.
 */
const register = (experiment, socket) => {
  return [
    // Subscribe to dispatched bookings, clean data, buffer, and emit to socket
    experiment.dispatchedBookings
      .pipe(
        cleanBookings(), // Apply the cleaning transformation
        bufferTime(100, null, 1000), // Buffer items for 100ms with a maximum of 100 items
        filter((e) => e.length) // Filter out empty buffers
      )
      .subscribe((bookings) => {
        socket.emit('bookings', bookings); // Emit the cleaned bookings to the socket
      }),

    // Subscribe to booking updates, clean data, buffer, and emit to socket
    experiment.bookingUpdates
      .pipe(
        cleanBookings(), // Apply the cleaning transformation
        bufferTime(100, null, 1000), // Buffer items for 100ms with a maximum of 100 items
        filter((e) => e.length) // Filter out empty buffers
      )
      .subscribe((bookings) => {
        socket.emit('bookings', bookings); // Emit the cleaned bookings to the socket
      }),
  ];
};

module.exports = {
  register,
};
