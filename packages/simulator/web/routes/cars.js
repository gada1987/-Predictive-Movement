const {
  map,
  bufferTime,
  filter,
  last,
  mergeMap,
  groupBy,
  windowTime,
} = require('rxjs');

/**
 * Cleans and formats the vehicle data for emission.
 * 
 * This function takes a vehicle object and maps it to a simplified format, 
 * including only relevant fields and converting them to suitable formats.
 * 
 * @param {Object} vehicle - The vehicle object to be cleaned and formatted.
 * @returns {Object} The cleaned and formatted vehicle object.
 */
const cleanCars = ({
  position: { lon, lat },
  id,
  altitude,
  heading,
  speed,
  bearing,
  status,
  fleet,
  cargo,
  passengers,
  passengersLength,
  passengerCapacity,
  parcelCapacity,
  queue,
  co2,
  distance,
  ema,
  lineNumber,
  vehicleType,
}) => ({
  id,
  heading: (heading && [heading.lon, heading.lat]) || null, // Route to plot or interpolate on the client side.
  speed,
  bearing,
  position: [lon, lat, altitude || 0], // Coordinates with optional altitude.
  status,
  fleet: fleet?.name || 'Privat', // Default to 'Privat' if fleet name is not available.
  co2,
  distance,
  ema,
  cargo: cargo.length, // Number of cargo items.
  passengers: passengersLength, // Number of passengers.
  queue: queue.length, // Number of items in queue.
  passengerCapacity,
  parcelCapacity,
  lineNumber,
  vehicleType,
});

/**
 * Registers data streams and emits cleaned vehicle data to the socket.
 * 
 * This function sets up subscriptions for `cars`, `carUpdates`, and `buses` streams from the 
 * `experiment` object. Each stream is processed to clean and format the data, then emitted
 * to the socket. The `carUpdates` stream is processed in windows and groups by vehicle ID.
 * 
 * @param {Object} experiment - The experiment object containing the data streams.
 * @param {Object} socket - The socket object used to emit the collected data.
 * @returns {Array<Subscription>} An array of subscriptions for managing the data streams.
 */
const register = (experiment, socket) => {
  return [
    // Subscribe to the cars stream, clean and format the data, then emit to the socket.
    experiment.cars
      .pipe(map(cleanCars)) // Clean and format car data.
      .subscribe((car) => {
        socket.emit('cars', [car]); // Emit single car data.
      }),

    // Process the carUpdates stream to emit only the most recent update for each car.
    experiment.carUpdates
      .pipe(
        windowTime(100), // Start a new window every 100ms.
        mergeMap((win) =>
          win.pipe(
            groupBy((car) => car.id), // Group by car ID within the window.
            mergeMap((cars) => cars.pipe(last())) // Take the last update for each car.
          )
        ),
        filter((car) => {
          // Filter cars based on vehicle type and socket settings.
          if (!car) return false;
          if (car.vehicleType === 'bus' && !socket.data.emitBusUpdates) return false;
          if (car.vehicleType === 'taxi' && !socket.data.emitTaxiUpdates) return false;
          if (car.vehicleType === 'car' && !socket.data.emitCars) return false;
          return true;
        }),
        map(cleanCars), // Clean and format car data.
        map((vehicle) => ({
          experimentId: experiment.parameters.id,
          ...vehicle,
        })),
        bufferTime(100, null, 100) // Buffer data to emit in chunks.
      )
      .subscribe((cars) => {
        if (!cars.length) return; // Skip if no cars to emit.
        socket.volatile.emit('cars', cars); // Emit buffered car data.
      }),

    // Subscribe to the buses stream, clean and format the data, then emit to the socket.
    experiment.buses
      .pipe(
        map(cleanCars), // Clean and format bus data.
        map((vehicle) => ({
          experimentId: experiment.parameters.id,
          ...vehicle,
        }))
      )
      .subscribe((car) => {
        socket.volatile.emit('cars', [car]); // Emit single bus data.
      }),
  ];
};

module.exports = {
  register,
};
