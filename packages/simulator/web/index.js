require('dotenv').config()

const { env } = require('process')
const routes = require('./routes') // Import the routing logic
const port = env.PORT || 4000 // Use environment variable PORT or default to 4000

/**
 * Simple handler function to respond to health check requests.
 *
 * @param {Object} req - The HTTP request object.
 * @param {Object} res - The HTTP response object.
 */
const ok = function (req, res) {
  res.writeHead(200) // Set HTTP status code to 200 OK
  res.end('PM Digital Twin Engine. Status: OK') // Send response body
}

// Create an HTTP server with the 'ok' function as the request handler
const server = require('http').createServer(ok)

// Initialize Socket.IO with the server and configure CORS settings
const io = require('socket.io')(server, {
  cors: {
    origin: 'http://localhost:3000', // Allow connections from this origin
    credentials: true, // Allow credentials (cookies, HTTP authentication) to be sent
    methods: ['GET', 'POST'], // Allow these HTTP methods
  },
})

// Start the server and listen on the specified port
server.listen(port, () => {
  console.log(`Server listening on port ${port}`)
})

// Register routes with the Socket.IO instance
routes.register(io)
