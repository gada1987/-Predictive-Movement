// Importing necessary modules and classes
const Fleet = require('../../lib/fleet') // Importing the Fleet class from the specified path
const { from } = require('rxjs') // Importing the 'from' function from the rxjs library
const { first } = require('rxjs/operators') // Importing the 'first' operator from the rxjs library
const Booking = require('../../lib/booking') // Importing the Booking class from the specified path
const { virtualTime } = require('../../lib/virtualTime') // Importing the virtualTime module from the specified path

const dispatch = require('../../lib/dispatchCentral') // Importing the dispatch module from the specified path

jest.mock('../../lib/dispatchCentral') // Mocking the dispatchCentral module for testing purposes

// Describe block for grouping related tests about the Fleet functionality
describe('A fleet', () => {
  // Defining coordinates for two locations: arjeplog and ljusdal
  const arjeplog = { lon: 17.886855, lat: 66.041054 }
  const ljusdal = { lon: 14.44681991219, lat: 61.59465992477 }

  // Variable to hold the fleet instance
  let fleet

  // Creating a test booking object
  let testBooking = new Booking({
    pickup: arjeplog,
    destination: ljusdal,
  })

  // beforeEach block to set up the environment before each test
  beforeEach(() => {
    virtualTime.setTimeMultiplier(Infinity) // Setting the time multiplier to Infinity for virtual time
    jest.clearAllMocks() // Clearing all mocks to ensure a clean state for each test
  })

  // afterEach block to clean up the environment after each test
  afterEach(() => {
    // fleet.dispose() // Commented out disposal of the fleet instance
  })

  // Test case to check if the fleet initializes correctly
  it('should initialize correctly', function (done) {
    fleet = new Fleet({
      name: 'postnord',
      marketshare: 1,
      numberOfCars: 1,
      hub: arjeplog,
    })
    expect(fleet.name).toHaveLength(8) // Checking if the fleet name has the expected length
    done()
  })

  // Test case to check if the fleet dispatches handled bookings
  it('dispatches handled bookings', function () {
    fleet = new Fleet({
      name: 'postnord',
      marketshare: 1,
      numberOfCars: 1,
      hub: arjeplog,
    })
    fleet.handleBooking(testBooking) // Handling a test booking

    expect(dispatch.dispatch.mock.calls.length).toBe(1) // Expecting the dispatch function to be called once
  })

  // Test case to check if handled bookings are dispatched correctly
  it('handled bookings are dispatched', function () {
    // Mocking the dispatch function to return a specific observable
    dispatch.dispatch.mockImplementation(() =>
      from([
        {
          booking: testBooking,
          car: { id: 1 },
        },
      ])
    )

    fleet = new Fleet({
      name: 'postnord',
      marketshare: 1,
      numberOfCars: 1,
      hub: arjeplog,
    })
    fleet.handleBooking(testBooking) // Handling a test booking

    // Subscribing to the dispatchedBookings observable to check if the booking is dispatched correctly
    fleet.dispatchedBookings.pipe(first()).subscribe(({ booking }) => {
      expect(booking.id).toBe(testBooking.id) // Expecting the dispatched booking ID to match the test booking ID
    })
  })
})
