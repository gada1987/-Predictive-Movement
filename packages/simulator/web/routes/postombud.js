const { toArray } = require('rxjs')

/**
 * Registers a subscription to handle post office updates and emit the current state to the socket.
 *
 * This function sets up a subscription to the `postombud` stream, collects all the items into an array,
 * and emits the array to the connected socket once the data stream completes.
 *
 * @param {Object} experiment - The experiment object containing the `postombud` stream.
 * @param {Object} socket - The socket object used to emit data to connected clients.
 * @returns {Array<Subscription>} An array containing the subscription to the `postombud` stream.
 */
const register = (experiment, socket) => {
  return [
    // Collect all items from the postombud stream into an array and emit the array to the socket
    experiment.postombud.pipe(toArray()).subscribe((postombud) => {
      // Emit the entire array of post office data to the connected socket
      socket.emit('postombud', postombud)
    }),
  ]
}

module.exports = {
  register,
}
