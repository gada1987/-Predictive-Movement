// Importing the Car class from the specified path
const Car = require('../../lib/vehicles/car')

// Importing the Booking class from the specified path
const Booking = require('../../lib/booking')

// Importing the virtualTime module from the specified path
const { virtualTime } = require('../../lib/virtualTime')

// A helper function to create an array of a given length, filled with sequential numbers
const range = (length) => Array.from({ length }).map((_, i) => i)

// Describe block for grouping related tests about the car functionality
describe('A car', () => {
  // Defining coordinates for two locations: arjeplog and ljusdal
  const arjeplog = { lon: 17.886855, lat: 66.041054 }
  const ljusdal = { lon: 14.44681991219, lat: 61.59465992477 }

  // Variable to hold the car instance
  let car

  // beforeEach block to set the virtual time multiplier before each test
  beforeEach(() => {
    virtualTime.setTimeMultiplier(Infinity)
  })

  // afterEach block to dispose of the car instance after each test
  afterEach(() => {
    car.dispose()
  })

  // Test case to check if the car initializes correctly
  it('should initialize correctly', function (done) {
    car = new Car()
    expect(car.id).toHaveLength(9)
    done()
  })

  // Test case to check if the car has the initial position set correctly
  it('should have initial position', function (done) {
    car = new Car({ id: 1, position: arjeplog })
    expect(car.position).toEqual(arjeplog)
    done()
  })

  // Test case to check if the car can teleport to a new location
  it('should be able to teleport', function (done) {
    car = new Car({ id: 1, position: arjeplog })
    car.navigateTo(ljusdal)
    car.on('stopped', () => {
      expect(car.position?.lon).toEqual(ljusdal.lon)
      expect(car.position?.lat).toEqual(ljusdal.lat)
      done()
    })
  })

  // Test case to check if the car can handle a booking and navigate to the pickup location
  it('should be able to handle one booking and navigate to pickup', function (done) {
    car = new Car({ id: 1, position: arjeplog })
    car.handleBooking(
      new Booking({
        id: 1,
        pickup: {
          position: ljusdal,
        },
      })
    )
    car.once('pickup', () => {
      expect(car.position?.lon).toEqual(ljusdal.lon)
      expect(car.position?.lat).toEqual(ljusdal.lat)
      done()
    })
  })

  // Test case to check if the car can handle a booking and emit the correct events
  it('should be able to handle one booking and emit correct events', function (done) {
    car = new Car({ id: 1, position: arjeplog })
    car.handleBooking(
      new Booking({
        id: 1,
        pickup: {
          position: ljusdal,
        },
        destination: {
          position: arjeplog,
        },
      })
    )
    expect(car.status).toEqual('pickup')
    car.on('pickup', () => {
      expect(car.position?.lon).toEqual(ljusdal.lon)
      expect(car.position?.lat).toEqual(ljusdal.lat)
      done()
    })
  })

  // Test case to check if the car can pick up a booking and deliver it to its destination
  it('should be able to pickup a booking and deliver it to its destination', function (done) {
    car = new Car({ id: 1, position: arjeplog })
    car.handleBooking(
      new Booking({
        id: 1,
        pickup: {
          position: ljusdal,
        },
        destination: {
          position: arjeplog,
        },
      })
    )
    car.once('pickup', () => {
      expect(car.position?.lon).toEqual(ljusdal.lon)
      expect(car.position?.lat).toEqual(ljusdal.lat)
    })

    car.once('dropoff', () => {
      expect(car.position?.lon).toEqual(arjeplog.lon)
      expect(car.position?.lat).toEqual(arjeplog.lat)
      done()
    })
  })

  // Test case to check if the car can pick up multiple bookings and queue all except the first
  it('should be able to pickup multiple bookings and queue the all except the first', function () {
    car = new Car({ id: 1, position: arjeplog })
    car.handleBooking(
      new Booking({
        id: 1,
        pickup: {
          position: ljusdal,
        },
        destination: {
          position: arjeplog,
        },
      })
    )

    expect(car.queue).toHaveLength(10)
  })

  // Test case to check if the car can handle bookings from the same place in the queue
  it('should be able to handle the bookings from the same place in the queue', function (done) {
    car = new Car({ id: 1, position: arjeplog })
    expect(car.queue).toHaveLength(0)
    const ljusdalToArjeplog = {
      pickup: {
        position: ljusdal,
      },
      destination: {
        position: arjeplog,
      },
    }

    const arjeplogToLjusdal = {
      pickup: {
        position: arjeplog,
      },
      destination: {
        position: ljusdal,
      },
    }

    car.handleBooking(
      new Booking({
        id: 1,
        ...ljusdalToArjeplog,
      })
    )

    const last = new Booking({
      id: 2,
      ...arjeplogToLjusdal,
    })
    car.handleBooking(last)

    const bookings = range(10).map((id) =>
      car.handleBooking(new Booking({ id, ...ljusdalToArjeplog }))
    )

    const [firstBooking, secondBooking] = bookings

    firstBooking.once('delivered', () => {
      expect(car.queue).toHaveLength(1)
    })

    secondBooking.once('delivered', () => {
      expect(car.queue).toHaveLength(1)
    })

    last.once('delivered', () => {
      expect(car.queue).toHaveLength(0)
      done()
    })

    expect(car.queue).toHaveLength(11)
  })
})
