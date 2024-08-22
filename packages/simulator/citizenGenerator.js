// Import required modules
const fs = require('fs'); // File system module for reading and writing files
const {
  finalize,
  take,
  filter,
  mergeMap,
  concatMap,
  toArray,
  zipWith,
} = require('rxjs/operators'); // RxJS operators for stream processing
const perlin = require('perlin-noise'); // Library for generating Perlin noise
const { debug, info, write } = require('./lib/log'); // Custom logging functions
const pelias = require('./lib/deps/pelias'); // Geocoding service
const { addMeters } = require('./lib/utils/geo/distance'); // Utility for adding meters to coordinates
const { randomNames } = require('./lib/utils/personNames'); // Stream of random names
const { randomize } = require('./simulator/address'); // Function for randomizing addresses

// Read configuration and streams
const fleets = require('./config/index').read(); // Configuration for fleets
const kommuner = require('./streams/index').read(fleets); // Stream of kommuner (municipalities)

// Import utility function for generating safe IDs
const { safeId } = require('./lib/utils/id');

// Define the number of citizens to generate
const NUMBER_OF_CITIZENS = 3000;

// Utility function to convert index to grid coordinates
const xy = (i, size = 100) => ({ x: i % size, y: Math.floor(i / size) });

// Main function to execute the generation and saving of citizens
const execute = () => {
  info(`Generating and saving ${NUMBER_OF_CITIZENS} citizens`); // Log info message
  generatePassengerDetails(kommuner, NUMBER_OF_CITIZENS).subscribe(
    citizenSerializer, // On success, serialize and save the citizens
    console.error // On error, log the error
  );
};

// Generate a pattern of random positions using Perlin noise
const randomPositions = perlin
  .generatePerlinNoise(100, 100) // Generate Perlin noise with dimensions 100x100
  .map((probability, i) => ({
    x: xy(i).x * 10, // Scale x coordinate
    y: xy(i).y * 10, // Scale y coordinate
    probability, // Probability value from Perlin noise
  }))
  .sort((a, b) => b.probability - a.probability); // Sort positions by probability, descending

// Function to generate passenger details
const generatePassengerDetails = (kommuner, numberOfPassengers) =>
  kommuner.pipe(
    mergeMap((kommun) => { // Process each municipality (kommun)
      const { squares, postombud } = kommun; // Extract squares and postombud streams
      write('🌆'); // Log city symbol
      return squares.pipe(
        mergeMap(({ population, position }) => { // Process each square in the municipality
          write(' 🗺 '); // Log map symbol
          return randomPositions
            .slice(0, population) // Select random positions based on population
            .map(({ x, y }) => addMeters(position, { x, y })); // Calculate home positions
        }),
        mergeMap((homePosition) => { // Process each home position
          write('📍'); // Log location symbol
          return postombud.pipe(
            toArray(), // Convert postombud stream to array
            mergeMap(async (allPostombudInKommun) => { // Process all postombud asynchronously
              const randomPostombud =
                allPostombudInKommun[
                  Math.floor(Math.random() * allPostombudInKommun.length) // Pick a random postombud
                ];
              try {
                const workPosition = await randomize(randomPostombud.position); // Randomize work position
                return { homePosition, workPosition }; // Return home and work positions
              } catch (err) {
                debug('timeout randomizing work position', err); // Log error if randomizing fails
                return null;
              }
            }, 20)
          );
        }, 20),
        filter((p) => p), // Filter out null results
        concatMap(async ({ homePosition, workPosition }) => { // Process each home and work position
          write('🏠'); // Log home symbol
          try {
            const home = await pelias.nearest(homePosition); // Find nearest home address
            return { home, workPosition }; // Return home and work positions
          } catch (err) {
            debug('timeout/finding nearest address to home position', err); // Log error if address lookup fails
            return null;
          }
        }, 10),
        filter((p) => p), // Filter out null results
        concatMap(async ({ home, workPosition }) => { // Process each home and work position
          write('🏢'); // Log work symbol
          try {
            const work = await pelias.nearest(workPosition); // Find nearest work address
            return { home, work }; // Return home and work addresses
          } catch (err) {
            debug('timeout/finding nearest address to work position', err); // Log error if address lookup fails
            return null;
          }
        }),
        filter((p) => p), // Filter out null results
        zipWith(
          randomNames.pipe(
            take(Math.min(100, Math.ceil(kommun.population * 0.01))) // Limit number of names based on population
          )
        ),
        concatMap(async (zipf) => { // Process each pair of addresses and names
          const [{ home, work }, { firstName, lastName }] = zipf; // Extract data from zipf
          write('📦'); // Log package symbol
          if (!home || !work || !firstName || !lastName) { // Check if all required data is present
            return Promise.resolve(null); // Skip incomplete data
          }
          return Promise.resolve({
            position: home.position,
            home: {
              name: `${home.name}, ${home.localadmin}`, // Home address details
              position: home.position,
            },
            workplace: {
              name: `${work.name}, ${work.localadmin}`, // Work address details
              position: work.position,
            },
            kommun: kommun.name, // Municipality name
            name: `${firstName} ${lastName}`, // Full name
          });
        }),
        filter((p) => p) // Filter out null results
      );
    }),
    take(numberOfPassengers), // Limit the number of passengers
    toArray(), // Collect all results into an array
    finalize() // Signal completion
  );

// Function to save the generated citizens to a file
const saveFile = (citizens) => {
  try {
    const currentDirectory = __dirname; // Get current directory
    const filePath = `${currentDirectory}/data/citizens.json`; // Define file path
    const jsonOutput = JSON.stringify(citizens, null, 2); // Convert citizens data to JSON
    fs.writeFileSync(filePath, jsonOutput); // Write JSON data to file
    info(`\n\nSaved ${citizens.length} citizens to ${filePath}`); // Log success message
  } catch (error) {
    // Ignore errors during file writing
  }
};

// Function to serialize the citizen data and save to file
const citizenSerializer = (citizens) => {
  serializedPassengers = citizens.map((citizen) => { // Map each citizen to a serialized format
    const { name, home, workplace, kommun } = citizen; // Extract data
    write('💾'); // Log save symbol
    return {
      id: safeId(), // Generate a unique ID
      name,
      home,
      workplace,
      kommun,
    };
  });
  saveFile(serializedPassengers, 'citizens.json'); // Save serialized data to file
};

// Execute the process
execute();
