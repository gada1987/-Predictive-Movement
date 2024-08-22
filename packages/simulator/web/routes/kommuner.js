const {
  pipe,
  map,
  filter,
  tap,
  mergeMap,
  scan,
  startWith,
  combineLatest,
  throttleTime,
} = require('rxjs');


// Load the central configuration file
//const config = require('../../../../centralconfig.json');
// kommuner.js
const centralConfig = require('../../../../config/loadCentralConfig');

// Your existing code using centralConfig

/**
 * Returns an RxJS operator function that counts the number of emitted values.
 * 
 * @returns {OperatorFunction} An operator function that counts emitted values.
 */
const count = () => pipe(scan((acc) => acc + 1, 0));

/**
 * Registers the necessary data streams and emits statistics related to kommuner.
 * 
 * This function sets up subscriptions to various streams from the `experiment` object,
 * processes and aggregates data, and emits it to the provided `socket`. It includes
 * statistics on passenger and parcel deliveries, car utilization, and capacities.
 * 
 * @param {Object} experiment - The experiment object containing data streams.
 * @param {Object} socket - The socket object used to emit processed data.
 * @returns {Array<Subscription>} An array of subscriptions for managing the data streams.
 */
const register = (experiment, socket) => {
  return [
    // Subscribe to the kommuner stream and emit initial data
    experiment.kommuner
      .pipe(
        tap(({ id, name, geometry, co2 }) =>
          socket.emit('kommun', { id, name, geometry, co2 })
        ),
        mergeMap(({ id, dispatchedBookings, name, cars }) => {
          // Statistics for passenger deliveries
          const passengerDeliveryStatistics = dispatchedBookings.pipe(
            mergeMap((booking) => booking.deliveredEvents),
            filter((booking) => booking.type === 'passenger'), // Only passenger deliveries
            filter((b) => b.cost), // Ensure cost is present
            scan(
              (
                { total, deliveryTimeTotal, totalCost },
                { deliveryTime, cost }
              ) => ({
                total: total + 1,
                totalCost: totalCost + cost,
                deliveryTimeTotal: deliveryTimeTotal + deliveryTime,
              }),
              { total: 0, totalCost: 0, deliveryTimeTotal: 0 }
            ),
            startWith({ total: 0, totalCost: 0, deliveryTimeTotal: 0 }), // Initial values
            map(({ total, totalCost, deliveryTimeTotal }) => ({
              totalDelivered: total,
              totalCost,
              averagePassengerCost: totalCost / total,
              averagePassengerDeliveryTime: deliveryTimeTotal / total / 60 / 60, // Convert to hours
            }))
          );

          // Statistics for parcel deliveries
          const parcelDeliveryStatistics = dispatchedBookings.pipe(
            mergeMap((booking) => booking.deliveredEvents),
            scan(
              (
                { total, deliveryTimeTotal, totalCost },
                { deliveryTime, cost }
              ) => ({
                total: total + 1,
                totalCost: totalCost + cost,
                deliveryTimeTotal: deliveryTimeTotal + deliveryTime,
              }),
              { total: 0, totalCost: 0, deliveryTimeTotal: 0 }
            ),
            startWith({ total: 0, totalCost: 0, deliveryTimeTotal: 0 }), // Initial values
            map(({ total, totalCost, deliveryTimeTotal }) => ({
              totalDelivered: total,
              totalCost,
              averageParcelCost: totalCost / total,
              averageParcelDeliveryTime: deliveryTimeTotal / total / 60 / 60, // Convert to hours
            }))
          );

          // Average utilization of cars
          const averageUtilization = cars.pipe(
            mergeMap((car) => car.cargoEvents),
            scan((acc, car) => ({ ...acc, [car.id]: car }), {}),
            map((cars) =>
              Object.values(cars).reduce(
                (acc, car) => ({
                  totalCargo: acc.totalCargo + car.cargo.length,
                  totalParcelCapacity:
                    acc.totalParcelCapacity + (car.parcelCapacity || 0),
                  totalPassengerCapacity:
                    acc.totalPassengerCapacity + (car.passengerCapacity || 0),
                  totalCo2: (acc.totalCo2 += car.co2),
                }),
                {
                  totalCargo: 0,
                  totalParcelCapacity: 0,
                  totalPassengerCapacity: 0,
                  totalCo2: 0,
                }
              )
            ),
            map(
              ({
                totalCargo,
                totalParcelCapacity,
                totalPassengerCapacity,
                totalCo2,
              }) => ({
                totalCargo,
                totalParcelCapacity,
                totalPassengerCapacity,
                averagePassengerLoad: totalCargo / totalPassengerCapacity,
                averageParcelLoad: totalCargo / totalParcelCapacity,
                totalCo2: totalCo2,
              })
            ),
            startWith({
              totalCargo: 0,
              totalParcelCapacity: 0,
              totalPassengerCapacity: 0,
              averageParcelLoad: 0,
              averagePassengerLoad: 0,
              totalCo2: 0,
            }) // Initial values
          );

          // Count the total number of cars
          const totalCars = cars.pipe(count(), startWith(0));

          // Total passenger capacity across all cars
          const totalPassengerCapacity = cars.pipe(
            filter((car) => car.passengerCapacity),
            scan((a, car) => a + car.passengerCapacity, 0),
            startWith(0)
          );

          // Total parcel capacity across all cars
          const totalParcelCapacity = cars.pipe(
            filter((car) => car.parcelCapacity),
            scan((a, car) => a + car.parcelCapacity, 0),
            startWith(0)
          );

          // Combine all the statistics into one object
          return combineLatest([
            totalCars,
            averageUtilization,
            passengerDeliveryStatistics,
            parcelDeliveryStatistics,
            totalPassengerCapacity,
            totalParcelCapacity,
          ]).pipe(
            map(
              ([
                totalCars,
                {
                  totalCargo,
                  totalCo2,
                  averagePassengerLoad,
                  averageParcelLoad,
                },
                { averagePassengerDeliveryTime, averagePassengerCost },
                {
                  averageParcelDeliveryTime,
                  averageParcelCost,
                  totalDelivered,
                },
                totalPassengerCapacity,
                totalParcelCapacity,
              ]) => ({
                id,
                name,
                totalCars,
                totalCargo,
                totalCo2,
                totalPassengerCapacity,
                totalParcelCapacity,
                totalDelivered,
                averagePassengerDeliveryTime,
                averagePassengerCost,
                averagePassengerLoad,
                averageParcelLoad,
                averageParcelDeliveryTime,
                averageParcelCost,
              })
            ),
            throttleTime(1000) // Limit the emission rate to 1 event per second
          );
        }),
        filter(({ totalCars }) => totalCars > 0) // Emit only if there are cars
      )
      .subscribe((kommun) => {
        socket.emit('kommun', kommun); // Emit the aggregated kommun data to the socket
      }),
  ];
};

module.exports = {
  register,
};
