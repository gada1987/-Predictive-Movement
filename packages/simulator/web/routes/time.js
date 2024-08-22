const { throttleTime } = require('rxjs')

/**
 * Registers event listeners for controlling and emitting virtual time updates.
 *
 * This function sets up socket event handlers to control the virtual time in the experiment,
 * such as resetting, playing, pausing, and adjusting the speed. It also sets up a subscription
 * to emit the current virtual time to the socket at a throttled rate.
 *
 * @param {Object} experiment - The experiment object containing the `virtualTime` control.
 * @param {Object} socket - The socket object used to handle incoming events and emit data.
 * @returns {Array<Subscription>} An array containing the subscription to the virtual time stream.
 */
const register = (experiment, socket) => {
  const virtualTime = experiment.virtualTime

  // Event listener for the 'reset' event, which resets the virtual time
  socket.on('reset', () => {
    experiment.virtualTime.reset()
  })

  // Event listener for the 'play' event, which resumes the virtual time
  socket.on('play', () => {
    experiment.virtualTime.play()
  })

  // Event listener for the 'pause' event, which pauses the virtual time
  socket.on('pause', () => {
    experiment.virtualTime.pause()
  })

  // Event listener for the 'speed' event, which sets the speed multiplier for the virtual time
  socket.on('speed', (speed) => {
    experiment.virtualTime.setTimeMultiplier(speed)
  })

  // Subscribe to the virtual time stream, emitting the time to the socket at a throttled rate
  return [
    virtualTime
      .getTimeStream()
      .pipe(
        throttleTime(1000) // Emit the time updates at most once per second
      )
      .subscribe((time) => socket.emit('time', time)),
  ]
}

module.exports = {
  register,
}
