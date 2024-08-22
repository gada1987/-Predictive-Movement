const { stops } = require('../transport/publicTransport')('skane');
const { filter } = require('rxjs/operators');
const Region = require('../../lib/class/geo/region');

// List of municipalities included in the Skåne region
const includedMunicipalities = [
  'Helsingborgs stad',
  'Malmö stad',
  'Lunds kommun',
];

/**
 * Creates a Region object for Skåne.
 *
 * @param {Observable} municipalitiesStream - An observable stream of municipalities.
 * @returns {Region} - A Region object for Skåne.
 */
const skane = (municipalitiesStream) => {
  // Filter municipalities to include only those in the includedMunicipalities list
  const municipalities = municipalitiesStream.pipe(
    filter(municipality => includedMunicipalities.includes(municipality.name))
  );

  // Create and return a new Region object
  return new Region({
    id: 'skane',
    name: 'Skåne',
    kommuner: municipalities,
    stops, // Public transport stops for the region
  });
};

module.exports = skane;
