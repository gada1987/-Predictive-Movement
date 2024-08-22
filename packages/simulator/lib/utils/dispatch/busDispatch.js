const moment = require('moment'); // Import the 'moment' library for date/time manipulation
const { info, warn, error } = require('../../log'); // Import logging functions
const { plan } = require('../../deps/vroom'); // Import the 'plan' function from Vroom dependencies

const MAX_SHIPMENTS = 200; // Maximum number of shipments allowed

// Function to convert trip data to a shipment format
const tripToShipment = ({ tripId, firstStop, lastStop }, i) => ({
  id: i,
  // description: tripId,
  amount: [1],
  pickup: {
    time_windows: [
      [
        moment(firstStop.arrivalTime).unix(),
        moment(firstStop.departureTime).unix() + 1,
      ],
    ],
    id: i,
    location: [firstStop.position.lon, firstStop.position.lat],
  },
  delivery: {
    id: i,
    location: [lastStop.position.lon, lastStop.position.lat],
    time_windows: [
      [
        moment(lastStop.arrivalTime).unix(),
        moment(lastStop.departureTime).unix() + 1,
      ],
    ],
  },
});

// Function to convert bus data to a vehicle format
const busToVehicle = ({ id, position, passengerCapacity, heading }, i) => ({
  id: i,
  // description: id,
  capacity: [passengerCapacity],
  start: [position.lon, position.lat],
  speed_factor: 1.2,
  end: heading ? [heading.lon, heading.lat] : undefined,
});

/**
 * Take two streams- buses and trips
 * Pass them to VROOM and get back assignments:
 *   Array of:
 *     bus: Object(Bus)
 *     trips: Array of trips including each stop
 * @param {*} buses - Array of bus objects
 * @param {*} trips - Array of trip objects
 * @returns { assigned, unassigned} - Result of the dispatch
 */
const busDispatch = async (buses, trips) => {
  // if we have more than 200 trips, split the problem in two - recursively
  if (trips.length > MAX_SHIPMENTS)
    return Promise.all([
      busDispatch(
        buses.slice(0, buses.length / 2),
        trips.slice(0, trips.length / 2)
      ),
      busDispatch(buses.slice(buses.length / 2), trips.slice(trips.length / 2)),
    ])
      .then(([a, b]) => a.concat(b))
      .catch((e) => {
        error('Bus concat dispatch', e); // Log error if dispatch fails
        return [];
      });

  const shipments = trips.map(tripToShipment); // Convert trips to shipments
  const vehicles = buses.map(busToVehicle); // Convert buses to vehicles

  const kommunName = trips[0].kommun; // Get the name of the community from the first trip
  info(
    `Finding optimal route in ${kommunName} for ${vehicles.length} buses and ${shipments.length} trips`
  ); // Log the routing information

  const result = await plan({
    shipments: shipments,
    vehicles: vehicles,
  }); // Call the plan function with shipments and vehicles

  const unassigned = result.unassigned
    .filter((s) => s.type === 'pickup')
    .map((step) => trips[step.id].tripId); // Get unassigned pickups
  if (unassigned.length)
    warn(`Unassigned in ${kommunName}: ${unassigned.length}`); // Log unassigned trips if any

  return result.routes.map((route) => {
    const toFirstStop = stepToBookingEntity(route.steps[0]);
    const toHub = stepToBookingEntity(route.steps[route.steps.length - 1]);

    return {
      bus: buses[route.vehicle],
      stops: [toFirstStop].concat(
        route.steps
          .filter((s) => s.type === 'pickup')
          .flatMap((step) => trips[step.id].stops),
        [toHub]
      ),
    };
  });
};

// Function to convert step data to a booking entity format
const stepToBookingEntity = ({
  waiting_time,
  arrival: departureTime,
  location: [lon, lat],
}) => ({
  // TODO: decide if we want to use departureTime or timeWindows
  departureTime: moment((departureTime + waiting_time) * 1000).format(
    'HH:mm:ss'
  ),
  arrivalTime: moment((departureTime + waiting_time) * 1000).format('HH:mm:ss'),
  position: { lat, lon },
});

module.exports = {
  busDispatch,
}; // Export the 'busDispatch' function for use in other modules
