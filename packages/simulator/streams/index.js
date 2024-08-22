/**
 * This module processes geographic and booking data to produce a stream of 'Kommun' objects, enriched with various types of data.
 * 
 * The exported function `read` provides an observable stream of `Kommun` instances, which include:
 * - Geographic information about each municipality
 * - Population data
 * - Commercial area information
 * - Postombud (postal agents)
 * - Measure stations
 * - Nearby workplaces and citizens
 * - Booking data (for specific municipalities)
 */

const { from, shareReplay, merge } = require('rxjs');
const {
  map,
  tap,
  filter,
  reduce,
  mergeMap,
  mergeAll,
  take,
  repeat,
} = require('rxjs/operators');
const Kommun = require('../lib/class/geo/kommun'); // Class for handling municipality data
const Position = require('../lib/class/geo/position'); // Class for handling geographical positions
const data = require('../data/geo/kommuner.json'); // JSON data for municipalities
const population = require('./population.js'); // Observable stream of population data
const packageVolumes = require('./bookings/packageVolumes'); // Booking package volumes data
const postombud = require('./bookings/postombud'); // Postal agents data
const measureStations = require('./bookings/helsinborg/measureStations'); // Measure stations data
const inside = require('point-in-polygon'); // Library for checking if a point is inside a polygon
const Pelias = require('../lib/deps/pelias'); // Library for geocoding
const { getCitizensInSquare } = require('../simulator/citizens.js'); // Function to get citizens in a specific area
const { getAddressesInArea } = require('../simulator/address.js'); // Function to get addresses in a specific area
const { municipalities } = require('../config/index.js'); // List of active municipalities
const { info } = require('../lib/log.js'); // Logging utility
const commercialAreas = from(require('../data/geo/scb_companyAreas.json').features); // Commercial area data

// Get the list of active municipalities from configuration
const activeMunicipalities = municipalities();

// Import booking streams for specific municipalities
const bookings = {
  hm: require('../streams/bookings/helsinborg/hm.js'),
  ikea: require('../streams/bookings/helsinborg/ikea.js'),
};

// Function to filter and map population data within a given geographic area
function getPopulationSquares({ geometry: { coordinates } }) {
  return population.pipe(
    filter(({ position: { lon, lat } }) =>
      coordinates.some((coordinates) => inside([lon, lat], coordinates))
    ),
    map(({ position, population, area }) => ({
      position,
      population,
      area: +area, // Convert area to number
    })),
    shareReplay()
  );
}

// Function to filter commercial areas based on municipality code (kommunkod)
function getCommercialAreas(kommunkod) {
  return commercialAreas.pipe(
    filter((area) => area.properties.KOMMUNKOD === kommunkod),
    shareReplay()
  );
}

// Function to filter postombud (postal agents) based on municipality name
function getPostombud(kommunName) {
  return postombud.pipe(
    filter((ombud) => kommunName.startsWith(ombud.kommun)),
    shareReplay()
  );
}

// Function to filter measure stations based on municipality name
function getMeasureStations(kommunName) {
  return measureStations.pipe(
    filter((measureStation) => kommunName.startsWith(measureStation.kommun)),
    shareReplay()
  );
}

// Asynchronous function to get nearby workplaces based on a geographical position
async function getWorkplaces(position, nrOfWorkplaces = 100) {
  const area = 10000; // Define the area size to search for workplaces
  const addresses = await getAddressesInArea(position, area, nrOfWorkplaces);
  return addresses.map((a) => ({ ...a, position: new Position(a.position) }));
}

// Function to read and process municipality data, enriching it with various additional data sources
function read({ fleets }) {
  return from(data).pipe(
    // Filter municipalities to include only those that are active
    filter(({ namn }) =>
      activeMunicipalities.some((name) => namn.startsWith(name))
    ),
    // Map each municipality with additional data from fleets
    map((kommun) => ({
      ...kommun,
      fleets: fleets[kommun.namn]?.fleets?.length ? fleets[kommun.namn].fleets : [],
    })),
    // Enrich each municipality with additional data and create a Kommun instance
    mergeMap(
      async ({
        geometry,
        namn: name,
        epost,
        postnummer,
        telefon,
        address,
        kod,
        pickupPositions,
        fleets,
      }) => {
        const squares = getPopulationSquares({ geometry });
        const commercialAreas = getCommercialAreas(kod);
        const { position: center } = await Pelias.searchOne(address || name.split(' ')[0]);
        const nearbyWorkplaces = from(getWorkplaces(center)).pipe(
          mergeAll(),
          take(100),
          repeat()
        );

        const citizens = squares.pipe(
          mergeMap(
            (square) => getCitizensInSquare(square, nearbyWorkplaces, name),
            5
          ),
          shareReplay()
        );

        const kommun = new Kommun({
          geometry,
          name,
          id: kod,
          email: epost,
          zip: postnummer,
          telephone: telefon,
          fleets: fleets || [],
          center,
          pickupPositions: pickupPositions || [],
          squares,
          postombud: getPostombud(name),
          measureStations: getMeasureStations(name),
          population: await squares
            .pipe(reduce((a, b) => a + b.population, 0))
            .toPromise(),
          packageVolumes: packageVolumes.find((e) => name.startsWith(e.name)),
          commercialAreas,
          citizens,
        });

        return kommun;
      }
    ),
    // Handle bookings for specific municipalities and log relevant information
    tap((kommun) => {
      if (kommun.name.startsWith('Helsingborg')) {
        merge(bookings.hm, bookings.ikea).forEach((booking) =>
          kommun.handleBooking(booking)
        );
      }
    }),
    shareReplay()
  );
}

// Export the read function for use in other modules
module.exports = { read };
