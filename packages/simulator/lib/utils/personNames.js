const {
  from,
  repeat,
  map,
  zip,
  filter,
  toArray,
  pipe,
  mergeAll,
} = require('rxjs'); // Import RxJS operators and functions
const fornamn = require('../../data/population/svenska_tilltalsnamn_2021.json').data; // Import first names data
const efternamn = require('../../data/population/svenska_efternamn_2021.json').data; // Import last names data

/**
 * Shuffles an array of names using a random sort.
 * This is used to randomize the order of names.
 * 
 * @returns {Observable} - An observable that emits the shuffled names.
 */
const shuffle = () =>
  pipe(
    toArray(), // Collect all items into an array
    map((names) => names.sort(() => Math.random() - 0.5)), // Shuffle the array
    mergeAll() // Flatten the array back into an observable stream
  );

/**
 * Maps names to a Zipf distribution, which assigns higher frequencies to earlier names.
 * 
 * @returns {Observable} - An observable that emits objects with names and their Zipf distribution frequencies.
 */
const zipfDistribution = () =>
  pipe(
    map((name, i) => ({
      name,
      frequency: 1 / (i + 1), // Calculate Zipf frequency
    }))
  );

/**
 * Takes a distribution of names with frequency of use
 * and returns a stream of names according to the distribution.
 * The first names are more likely to be selected than those further down the list.
 * 
 * @returns {Observable} - An observable that emits names according to the Zipf distribution.
 */
const weightedRandom = () =>
  pipe(
    filter(({ frequency }) => frequency > Math.random()), // Filter names based on their frequency
    map(({ name }) => name) // Extract the name
  );

/**
 * Converts a string to title case (e.g., "john doe" -> "John Doe").
 * 
 * @param {string} str - The string to convert.
 * @returns {string} - The converted title case string.
 */
const toToTitleCase = (str) =>
  str
    .split(' ') // Split the string into words
    .map((word) => word.charAt(0).toUpperCase() + word.substr(1).toLowerCase()) // Capitalize the first letter of each word
    .join(' '); // Join the words back into a single string

/**
 * Creates an observable stream of random first names
 * based on the Zipf distribution and shuffling.
 * 
 * @returns {Observable} - An observable stream of random first names.
 */
const randomFirstName = () =>
  from(fornamn).pipe(
    zipfDistribution(), // Apply Zipf distribution
    shuffle(), // Shuffle names
    weightedRandom() // Select names according to the weighted distribution
  );

/**
 * Creates an observable stream of random last names
 * based on the Zipf distribution and shuffling,
 * and converts them to title case.
 * 
 * @returns {Observable} - An observable stream of random last names in title case.
 */
const randomLastName = () =>
  from(efternamn).pipe(
    zipfDistribution(), // Apply Zipf distribution
    shuffle(), // Shuffle names
    weightedRandom(), // Select names according to the weighted distribution
    map((name) => toToTitleCase(name)) // Convert names to title case
  );

/**
 * Creates an observable stream of random full names,
 * combining random first names and last names.
 * The names are repeated indefinitely.
 * 
 * @returns {Observable} - An observable stream of random full names.
 */
const randomNames = zip(randomFirstName(), randomLastName()).pipe(
  map(([firstName, lastName]) => ({
    firstName,
    lastName,
    name: `${firstName} ${lastName}`, // Combine first and last names
  })),
  repeat() // Repeat the stream indefinitely
);

module.exports = {
  randomNames, // Export the observable stream of random names
};
