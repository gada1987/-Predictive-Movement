const { toArray } = require('rxjs');

/**
 * Registers the bus stop and line shape data streams to emit the collected data to a socket.
 * 
 * This function sets up subscriptions for `busStops` and `lineShapes` streams from the 
 * `experiment` object. Each stream is converted to an array using `toArray()` and then emitted 
 * to the specified socket. This is useful for sending complete datasets to the client in a 
 * single emission.
 * 
 * @param {Object} experiment - The experiment object containing the data streams.
 * @param {Object} socket - The socket object used to emit the collected data.
 * @returns {Array<Subscription>} An array of subscriptions for managing the data streams.
 */
const register = (experiment, socket) => {
  return [
    // Subscribe to the busStops stream, collect all items into an array, and emit to the socket
    experiment.busStops
      .pipe(toArray()) // Collect all busStops into an array
      .subscribe((busStops) => {
        socket.emit('busStops', busStops); // Emit the complete array of busStops to the socket
      }),

    // Subscribe to the lineShapes stream, collect all items into an array, and emit to the socket
    experiment.lineShapes
      .pipe(toArray()) // Collect all lineShapes into an array
      .subscribe((lineShapes) => {
        socket.emit('lineShapes', lineShapes); // Emit the complete array of lineShapes to the socket
      }),
  ];
};

module.exports = {
  register,
};
