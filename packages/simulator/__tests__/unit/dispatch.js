// Importing necessary classes and operators from the rxjs library
const { from, Subject, ReplaySubject } = require('rxjs')
const { toArray, shareReplay } = require('rxjs/operators')

// Importing the dispatch function from the specified path
const { dispatch } = require('../../lib/dispatch/dispatchCentral')

// Importing the Car class from the specified path
const Car = require('../../lib/car')

// Importing the Booking class from the specified path
const Booking = require('../../lib/booking')

// Importing the virtualTime module from the specified path
const { virtualTime } = require('../../lib/virtualTime')

// Describe block for grouping related tests about dispatch functionality
describe('dispatch', () => {
  // Defining coordinates for three locations: arjeplog, ljusdal, and stockholm
  const arjeplog = { lon: 17.886855, lat: 66.041054 }
  const ljusdal = { lon: 14.44681991219, lat: 61.59465992477 }
  const stockholm = { lon: 18.06324, lat: 59.334591 }
  // Variables to hold cars and bookings
  let cars
  let bookings
 // beforeEach block to set up cars and bookings before each test
  beforeEach(() => {
    virtualTime.setTimeMultiplier(Infinity)
    cars = from([
      new Car({ id: 1, position: ljusdal }),
      new Car({ id: 2, position: arjeplog }),
    ]).pipe(shareReplay())
    bookings = from([
      new Booking({
        id: 0,
        pickup: { position: ljusdal },
        destination: { position: arjeplog },
      }),
    ])
  })
 // Test case to check if a booking is dispatched to the nearest car
  it('should dispatch a booking to nearest car', function (done) {
    dispatch(cars, bookings).subscribe(({ car }) => {
      expect(car.position).toEqual(ljusdal)
      done()
    })
  })
// Test case to check if two bookings are dispatched to each nearest car
  it('should dispatch two booking to each nearest car', function (done) {
    bookings = from([
      new Booking({
        id: 1337,
        pickup: { position: arjeplog },
        destination: { position: ljusdal },
      }),
      new Booking({
        id: 1338,
        pickup: { position: ljusdal },
        destination: { position: arjeplog },
      }),
    ])
    dispatch(cars, bookings)
      .pipe(toArray())
      .subscribe(([assignment1, assignment2]) => {
        expect(assignment1.car.position).toEqual(arjeplog)
        expect(assignment1.car.id).toEqual(2)
        expect(assignment2.car.position).toEqual(ljusdal)
        expect(assignment2.car.id).toEqual(1)
        done()
      })
  })
// Test case to check if two bookings are dispatched correctly even when they arrive asynchronously
  it('should dispatch two bookings even when they arrive async', function (done) {
    const asyncBookings = new Subject()
    dispatch(cars, asyncBookings).subscribe(({ booking: { id }, car }) => {
      if (id === 1) {
        expect(car.position).toEqual(ljusdal)
        asyncBookings.next(
          new Booking({
            id: 2,
            pickup: { position: arjeplog },
            destination: { position: ljusdal },
          })
        )
      } else {
        expect(id).toEqual(2)
        done()
      }
    })

    asyncBookings.next(
      new Booking({
        id: 1,
        pickup: { position: ljusdal },
        destination: { position: arjeplog },
      })
    )
  })
// Test case to check if cars are available even the second time they are dispatched
  it('should have cars available even the second time', function (done) {
    const asyncBookings = new Subject()
    const cars = new ReplaySubject()
    cars.next(new Car({ position: ljusdal }))
    cars.next(new Car({ position: arjeplog }))

    dispatch(cars, asyncBookings).subscribe(
      ({ booking: { id }, car: { position } }) => {
        if (id === 1) {
          expect(position).toEqual(ljusdal)
          asyncBookings.next(
            new Booking({
              id: 2,
              pickup: { position: arjeplog },
              destination: { position: ljusdal },
            })
          )
        } else {
          expect(position).toEqual(arjeplog)
          expect(id).toEqual(2)
          done()
        }
      }
    )

    asyncBookings.next(
      new Booking({
        id: 1,
        pickup: { position: ljusdal },
        destination: { position: arjeplog },
      })
    )
  })
// Test case to check if two bookings can be dispatched to one car
  it.only('should dispatch two bookings to one car', function (done) {
    cars = from([new Car({ id: 1, position: ljusdal })])
    bookings = from([
      new Booking({
        id: 1337,
        pickup: { position: ljusdal, name: 'pickup 1' },
        destination: { position: arjeplog, name: 'dropoff 1' },
      }),
      new Booking({
        id: 1338,
        pickup: { position: arjeplog, name: 'pickup 2' },
        destination: { position: ljusdal, name: 'dropoff 2' },
      }),
    ])
    dispatch(cars, bookings)
      .pipe(toArray())
      .subscribe(([assignment1, assignment2]) => {
        jest.setTimeout(10000)

        expect(assignment1.car.id).toEqual(1)
        expect(assignment1.booking.id).toEqual(1337)
        expect(assignment2.car.id).toEqual(1)
        expect(assignment2.booking.id).toEqual(1338)
        assignment1.booking.once('delivered', (booking) => {
          expect(booking.id).toEqual(1337)
        })
        assignment2.booking.once('delivered', (booking) => {
          expect(booking.id).toEqual(1338)
          done()
        })
      })
  })
// Test case to check if three bookings can be dispatched to one car with only capacity for one and still deliver them all
  it('should dispatch three bookings to one car with only capacity for one and still deliver them all', function (done) {
    cars = from([new Car({ id: 1, position: ljusdal, capacity: 1 })])
    bookings = from([
      new Booking({
        id: 1337,
        pickup: { position: ljusdal, name: 'pickup 1' },
        destination: { position: arjeplog, name: 'dropoff 1' },
      }),
      new Booking({
        id: 1338,
        pickup: { position: arjeplog, name: 'pickup 2' },
        destination: { position: stockholm, name: 'dropoff 2' },
      }),
      new Booking({
        id: 1339,
        pickup: { position: stockholm, name: 'pickup 3' },
        destination: { position: arjeplog, name: 'dropoff 3' },
      }),
    ])
    dispatch(cars, bookings)
      .pipe(toArray())
      .subscribe(([assignment1, assignment2, assignment3]) => {
        expect(assignment1.car.id).toEqual(1)
        expect(assignment1.booking.id).toEqual(1337)
        expect(assignment2.car.id).toEqual(1)
        expect(assignment2.booking.id).toEqual(1338)
        expect(assignment3.car.id).toEqual(1)
        expect(assignment3.booking.id).toEqual(1339)
        assignment1.booking.once('delivered', (booking) => {
          expect(booking.id).toEqual(1337)
          expect(assignment1.car.queue).toHaveLength(2)
        })
        assignment2.booking.once('delivered', (booking) => {
          expect(booking.id).toEqual(1338)
          expect(assignment2.car.queue).toHaveLength(1)
        })
        assignment3.booking.once('delivered', (booking) => {
          expect(booking.id).toEqual(1339)
          done()
        })
      })
  })
})
