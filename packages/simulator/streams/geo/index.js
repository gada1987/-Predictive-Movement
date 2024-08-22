const { from, share } = require('rxjs');

// Import region modules
const regions = {
  norrbotten: require('./norrbotten'),
  gotland: require('./gotland'),
  // Uncomment and add more regions as needed
  // skane: require('./skane'),
  // ostergotland: require('./ostergotland'),
};

// Import kommuner module
const kommuner = require('../index');

/**
 * Creates a stream of region-specific data based on environment variables.
 * 
 * @param {Object} savedParams - Parameters to pass to kommuner.read.
 * @returns {Observable} - An observable that emits region-specific data streams.
 */
module.exports = (savedParams) => {
  // Get the stream of municipalities
  const kommunerStream = kommuner.read(savedParams);
  
  // Filter and map the included regions based on environment variables
  const includedRegions = Object.entries(regions)
    .filter(
      ([regionName]) =>
        process.env.REGIONS?.includes(regionName) ||
        process.env.REGIONS === '*' ||
        !process.env.REGIONS
    )
    .map(([, regionModule]) => regionModule);
  
  // Create an observable for the included regions
  return from(includedRegions.map((regionFn) => regionFn(kommunerStream))).pipe(
    share() // Share the observable to allow multiple subscribers
  );
};
