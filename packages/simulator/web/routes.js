const engine = require('../index')
const { save } = require('../config')
const { info } = require('../lib/log')
const { emitters, ignoreWelcomeMessage } = require('../config')
const cookie = require('cookie')
const moment = require('moment')

// Default emitters based on configuration
const defaultEmitters = emitters()

/**
 * Subscribe to various routes based on the configured emitters.
 *
 * @param {Object} experiment - The experiment instance.
 * @param {Object} socket - The socket instance for communication.
 * @returns {Array} - Array of subscriptions.
 */
function subscribe(experiment, socket) {
  return [
    defaultEmitters.includes('bookings') &&
      require('./routes/bookings').register(experiment, socket),
    defaultEmitters.includes('buses') &&
      require('./routes/buses').register(experiment, socket),
    defaultEmitters.includes('cars') &&
      require('./routes/cars').register(experiment, socket),
    defaultEmitters.includes('kommuner') &&
      require('./routes/kommuner').register(experiment, socket),
    defaultEmitters.includes('measureStations') &&
      require('./routes/measureStations').register(experiment, socket),
    defaultEmitters.includes('passengers') &&
      require('./routes/passengers').register(experiment, socket),
    defaultEmitters.includes('postombud') &&
      require('./routes/postombud').register(experiment, socket),
    require('./routes/time').register(experiment, socket),
    require('./routes/log').register(experiment, socket),
  ]
    .filter((f) => f) // Remove any undefined values
    .flat() // Flatten the array of arrays into a single array
}

/**
 * Start a new experiment and set up the experiment data and subscriptions.
 *
 * @param {Object} socket - The socket instance for communication.
 */
function start(socket) {
  const experiment = engine.createExperiment({ defaultEmitters })
  socket.data.experiment = experiment
  experiment.subscriptions = subscribe(experiment, socket)

  // Wait until the end of the day and then restart the experiment
  experiment.virtualTime.waitUntil(moment().endOf('day').valueOf()).then(() => {
    socket.emit('reset')
    info('Experiment finished. Restarting...')
    process.kill(process.pid, 'SIGUSR2') // Restart the process
  })
}

/**
 * Register socket event handlers for handling different events.
 *
 * @param {Object} io - The Socket.IO instance.
 */
function register(io) {
  if (ignoreWelcomeMessage) {
    io.engine.on('initial_headers', (headers) => {
      headers['set-cookie'] = cookie.serialize('hideWelcomeBox', 'true', {
        path: '/',
      })
    })
  }

  io.on('connection', function (socket) {
    if (!socket.data.experiment) {
      start(socket)
    }

    // Initialize map state based on environment variables or default values
    socket.data.experiment.parameters.initMapState = {
      latitude: parseFloat(process.env.LATITUDE) || 65.0964472642777,
      longitude: parseFloat(process.env.LONGITUDE) || 17.112050188704504,
      zoom: parseInt(process.env.ZOOM) || 5,
    }

    // Emit initial parameters to the client
    socket.emit('parameters', socket.data.experiment.parameters)
    socket.data.emitCars = defaultEmitters.includes('cars')
    socket.data.emitTaxiUpdates = defaultEmitters.includes('taxis')
    socket.data.emitBusUpdates = defaultEmitters.includes('buses')

    socket.emit('init') // Notify the client that the initialization is complete

    // Event handlers for various socket events
    socket.on('reset', () => {
      socket.data.experiment.subscriptions.map((e) => e.unsubscribe())
      start(socket)
    })

    socket.on('carLayer', (val) => (socket.data.emitCars = val))
    socket.on('taxiUpdatesToggle', (val) => (socket.data.emitTaxiUpdates = val))
    socket.on('busUpdatesToggle', (val) => (socket.data.emitBusUpdates = val))
    socket.on('experimentParameters', (value) => {
      info('New experiment settings: ', value)
      save(value)
      socket.emit('init')
    })

    socket.emit('parameters', socket.data.experiment.parameters)

    /* 
    The following code was commented out. It would handle client reconnects and disconnections,
    but it's currently disabled to prevent unwanted behavior or resource consumption.

    socket.on('connect', () => {
      if (socket.data.timeout) {
        info('Client connected again, cancelling shutdown')
        clearTimeout(socket.data.timeout)
      }
    })

    socket.on('disconnect', (reason) => {
      info('Client disconnected', reason, 'Removing subscriptions..')
      socket.data.experiment.subscriptions.map((e) => e.unsubscribe())
    })
    */
  })
}

module.exports = {
  register,
}
