// Importing the Bus class from the specified path
const Bus = require('../../lib/vehicles/bus')

// Importing the Subject class from the rxjs library
const { Subject } = require('rxjs')

// A helper function to create an array of a given length, filled with sequential numbers
const range = (length) => Array.from({ length }).map((_, i) => i)

// Importing the moment library for date and time manipulation
const moment = require('moment')

// Describe block for grouping related tests about the bus functionality
describe('A bus', () => {
  // Defining coordinates for two locations: arjeplog and ljusdal
  const arjeplog = { lon: 17.886855, lat: 66.041054 }
  const ljusdal = { lon: 14.44681991219, lat: 61.59465992477 }

  // Variable to hold the bus instance
  let bus

  // Test case to check if the bus can pick up multiple bookings and queue them properly
  it.only('should be able to pickup multiple bookings and queue the all except the first', () => {
    // Creating a new Subject instance for the stops
    const stops = new Subject()

    // Initializing a new Bus instance with the given id, position, and stops
    bus = new Bus({ id: 1, position: arjeplog, stops })

    // Creating and emitting 10 bookings to the stops Subject
    range(10).map((i) =>
      stops.next({
        pickup: ljusdal,
        destination: arjeplog,
        departureTime: moment('2021-04-20:00:00:00')
          .add(i, 'minutes')
          .format('HH:mm:ss'),
      })
    )

    // Accessing the bus queue
    const queue = bus.queue

    // Logging the departure times of the bookings in the queue
    console.log(bus.queue.map((e) => e.pickup.departureTime))

    // Expecting the queue to have 8 bookings (since the first two are not queued)
    expect(queue.length).toBe(8)

    // Validating the properties of the first booking in the queue
    expect(queue[0].pickup).toEqual(ljusdal)
    expect(queue[0].departureTime).toBe('00:00:00')
    expect(queue[0].arrivalTime).toBe('00:00:00')
    expect(queue[0].status).toBe('queued')
  })
})
