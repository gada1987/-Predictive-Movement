const { toArray } = require('rxjs')

/**
 * Registers subscriptions to streams from the experiment object and emits data to the socket.
 * 
 * This function sets up two subscriptions:
 * 1. Subscribes to `measureStationUpdates` stream and emits each update to the socket with the event name 'measureStationUpdates'.
 * 2. Collects all `measureStations` into an array and emits the entire array to the socket with the event name 'measureStations'.
 * 
 * @param {Object} experiment - The experiment object containing the measureStationUpdates and measureStations streams.
 * @param {Object} socket - The socket object used to emit data to connected clients.
 * @returns {Array<Subscription>} An array containing the subscriptions to the measureStationUpdates and measureStations streams.
 */
const register = (experiment, socket) => {
  return [
    // Subscribe to measureStationUpdates and emit each measurement update to the socket
    experiment.measureStationUpdates.subscribe((measurement) =>
      socket.emit('measureStationUpdates', measurement)
    ),

    // Collect all measureStations into an array and emit the entire array to the socket
    experiment.measureStations.pipe(toArray()).subscribe((measureStations) => {
      socket.emit('measureStations', measureStations)
    }),
  ]
}

module.exports = {
  register,
}
