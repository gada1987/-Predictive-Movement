const { stops } = require('../transport/publicTransport')('otraf');
const { filter } = require('rxjs/operators');
const Region = require('../../lib/class/geo/region');

// List of municipalities included in the Östergötland region
const includedMunicipalities = [
  'Linköpings kommun',
  'Norrköpings kommun',
  'Motala kommun',
];

/**
 * Creates a Region object for Östergötland.
 *
 * @param {Observable} municipalitiesStream - An observable stream of municipalities.
 * @returns {Region} - A Region object for Östergötland.
 */
const skane = (municipalitiesStream) => {
  // Filter municipalities to include only those in the includedMunicipalities list
  const municipalities = municipalitiesStream.pipe(
    filter(municipality => includedMunicipalities.includes(municipality.name))
  );

  // Create and return a new Region object
  return new Region({
    id: 'otraf',
    name: 'Östergötland',
    kommuner: municipalities,
    stops, // Public transport stops for the region
  });
};

module.exports = skane;
