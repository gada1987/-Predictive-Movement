// Importing necessary modules and functions from the 'rxjs' library
const { from } = require('rxjs')

// Importing the taxiDispatch function from the specified path
const { taxiDispatch } = require('../../lib/dispatch/taxiDispatch')

// Importing the Taxi class from the specified path
const Taxi = require('../../lib/vehicles/taxi')

// Describe block for grouping related tests about the taxiDispatch functionality
describe('taxiDispatch', () => {
  // Defining coordinates for two locations: arjeplog and ljusdal
  const arjeplog = { lon: 17.886855, lat: 66.041054 }
  const ljusdal = { lon: 14.44681991219, lat: 61.59465992477 }

  // Test case to check if a booking is dispatched to the nearest taxi
  it('should dispatch a booking to nearest taxi', (done) => {
    // Creating an observable stream of Taxi objects
    const taxis = from([
      new Taxi({ id: 1, position: ljusdal }),
      new Taxi({ id: 2, position: arjeplog }),
    ])
    
    // Creating an observable stream of stops
    const stops = from([
      {
        id: 'stop-1',
        position: ljusdal,
        arrivalTime: '09:00',
        departureTime: '09:01',
      },
    ])
    
    // Calling the taxiDispatch function with taxis and stops
    const assignments = taxiDispatch(taxis, stops)
    
    // Subscribing to the assignments observable to check the dispatch result
    assignments.subscribe((assignment) => {
      // Expecting the dispatched taxi to have the position of ljusdal
      expect(assignment.taxi.position).toEqual(ljusdal)
      // Expecting the dispatched taxi to have the id of 1
      expect(assignment.taxi.id).toEqual(1)
      done() // Indicating that the asynchronous test is complete
    })
  })
})
