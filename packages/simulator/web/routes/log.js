/**
 * Registers a subscription to the log stream of the experiment and emits log items to the socket.
 * 
 * This function listens to the `logStream` from the `experiment` object. Each item emitted by the
 * `logStream` is sent to the connected socket with the event name 'log'.
 * 
 * @param {Object} experiment - The experiment object containing the logStream.
 * @param {Object} socket - The socket object used to emit log data.
 * @returns {Array<Subscription>} An array containing the subscription to the logStream.
 */
const register = (experiment, socket) => {
  return [
    // Subscribe to the logStream and emit each log item to the socket
    experiment.logStream.subscribe((item) => socket.emit('log', item))
  ];
};

module.exports = {
  register,
};
