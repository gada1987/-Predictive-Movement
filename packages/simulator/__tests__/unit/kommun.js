// Importing necessary modules and classes
const Kommun = require('../../lib/Kommun') // Importing the Kommun class from the specified path
const { from } = require('rxjs') // Importing the 'from' function from the rxjs library
const { first, map } = require('rxjs/operators') // Importing 'first' and 'map' operators from the rxjs library
const Booking = require('../../lib/booking') // Importing the Booking class from the specified path
const { virtualTime } = require('../../lib/virtualTime') // Importing the virtualTime module from the specified path

const dispatch = require('../../lib/dispatch/dispatchCentral') // Importing the dispatch module from the specified path

jest.mock('../../lib/dispatch/dispatchCentral') // Mocking the dispatchCentral module for testing purposes

// Describe block for grouping related tests about the Kommun functionality
describe('A kommun', () => {
  // Defining coordinates for two locations: arjeplog and ljusdal
  const arjeplog = { lon: 17.886855, lat: 66.041054 }
  const ljusdal = { lon: 14.44681991219, lat: 61.59465992477 }
  const squares = from([]) // Defining an empty observable for squares
  let fleets // Variable to hold the fleets array
  let kommun // Variable to hold the kommun instance

  // Creating a test booking object
  let testBooking = new Booking({
    pickup: arjeplog,
    destination: ljusdal,
  })

  // beforeEach block to set up the environment before each test
  beforeEach(() => {
    virtualTime.setTimeMultiplier(Infinity) // Setting the time multiplier to Infinity for virtual time
    fleets = [
      { name: 'postnord', marketshare: 1, numberOfCars: 1, hub: arjeplog },
    ] // Initializing the fleets array with one fleet
    jest.clearAllMocks() // Clearing all mocks to ensure a clean state for each test
  })

  // afterEach block to clean up the environment after each test
  afterEach(() => {
    // kommun.dispose() // Commented out disposal of the kommun instance
  })

  // Test case to check if the kommun initializes correctly
  it('should initialize correctly', function (done) {
    kommun = new Kommun({ name: 'stockholm', squares, fleets }) // Initializing the kommun instance
    expect(kommun.name).toBe('stockholm') // Checking if the kommun name is as expected
    done()
  })

  // Test case to check if the kommun dispatches handled bookings
  it('dispatches handled bookings', function () {
    kommun = new Kommun({ name: 'stockholm', squares, fleets }) // Initializing the kommun instance
    kommun.handleBooking(testBooking) // Handling a test booking

    expect(dispatch.dispatch.mock.calls.length).toBe(1) // Expecting the dispatch function to be called once
  })

  // Test case to check if handled bookings are dispatched correctly
  it.only('handled bookings are dispatched', function (done) {
    // Mocking the dispatch function to return a specific observable
    dispatch.dispatch.mockImplementation((cars, bookings) =>
      bookings.pipe(
        map((booking) => ({
          booking,
          car: { id: 1 },
        }))
      )
    )

    kommun = new Kommun({ name: 'stockholm', squares, fleets }) // Initializing the kommun instance
    kommun.handleBooking(testBooking) // Handling a test booking

    // Subscribing to the dispatchedBookings observable to check if the booking is dispatched correctly
    kommun.dispatchedBookings.pipe(first()).subscribe(({ booking }) => {
      expect(booking.fleet.name).toBe('bring') // Checking if the dispatched booking's fleet name is as expected
      expect(booking.id).toBe(testBooking.id) // Checking if the dispatched booking ID matches the test booking ID
      done()
    })
  })
})
