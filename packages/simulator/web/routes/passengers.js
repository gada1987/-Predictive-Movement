const { bufferTime, filter, merge } = require('rxjs')

/**
 * Registers a subscription to handle passenger data updates and emit the current state to the socket.
 *
 * This function sets up a subscription that merges passenger streams and updates,
 * buffers the data for 500 milliseconds, filters out empty buffers, and then emits
 * the collected passenger data as an array of objects to the socket.
 *
 * @param {Object} experiment - The experiment object containing passenger and passengerUpdates streams.
 * @param {Object} socket - The socket object used to emit data to connected clients.
 * @returns {Array<Subscription>} An array containing the subscription to the merged passenger streams.
 */
const register = (experiment, socket) => {
  return [
    // Merge passenger and passengerUpdates streams, buffer data for 500 ms, and filter out empty buffers
    merge(experiment.passengers, experiment.passengerUpdates)
      .pipe(
        bufferTime(500), // Collect data into arrays every 500 milliseconds
        filter((p) => p.length > 0) // Only process non-empty arrays
      )
      .subscribe((passengers) => {
        // Convert each passenger to an object and emit the array to the socket
        const passengerObjects = passengers.map((p) => p.toObject())
        socket.emit('passengers', passengerObjects)
      }),
  ]
}

module.exports = {
  register,
}
