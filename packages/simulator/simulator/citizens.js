const { take, map, filter, mergeAll } = require('rxjs/operators'); // RxJS operators for managing observables
const { randomNames } = require('../lib/utils/personNames'); // Utility for generating random names
const Citizen = require('../lib/class/citizen'); // Class for creating Citizen instances
const { from, zip } = require('rxjs'); // RxJS functions for creating and combining observables
const { getAddressesInArea } = require('./address'); // Function for fetching addresses in a specified area

/**
 * Generates a stream of citizens for a given square in a kommun.
 * 
 * @param {Object} square - The square object containing position, area, and population details.
 * @param {Observable} workplaces - An observable stream of workplaces.
 * @param {string} kommunName - The name of the kommun.
 * @returns {Observable<Citizen>} - An observable stream of Citizen instances.
 */
const getCitizensInSquare = (
  { position, area, population }, // Destructure square properties
  workplaces, // Observable stream of workplaces
  kommunName // Name of the kommun
) => {
  // Calculate the number of citizens to sample based on the population
  const nrOfCitizens = Math.floor(population * 0.01); // Sample 1% of the population
  if (nrOfCitizens === 0) return from([]); // Return an empty observable if no citizens are to be sampled

  // Get a stream of addresses in the area, flatten the array of addresses
  const addresses = from(getAddressesInArea(position, area, nrOfCitizens)).pipe(
    mergeAll()
  );

  // Combine the streams of addresses, random names, and workplaces
  return zip([
    addresses.pipe(take(nrOfCitizens)), // Take the first `nrOfCitizens` addresses
    randomNames.pipe(take(nrOfCitizens)), // Take the first `nrOfCitizens` names
    workplaces.pipe(take(nrOfCitizens)), // Take the first `nrOfCitizens` workplaces
  ]).pipe(
    map(([home, name, workplace]) => {
      // Create a Citizen instance if the home address is available
      return (
        home &&
        new Citizen({
          ...name, // Spread name properties (e.g., firstName, lastName)
          home, // Assign home address
          workplace, // Assign workplace
          kommun: kommunName, // Assign kommun name
          position: home.position, // Assign position from home address
        })
      );
    }),
    filter((citizen) => citizen), // Filter out any null or undefined citizens
    take(nrOfCitizens) // Limit the number of citizens emitted
  );
};

module.exports = {
  getCitizensInSquare, // Export the function for use in other modules
};
