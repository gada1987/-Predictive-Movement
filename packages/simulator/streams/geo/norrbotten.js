const { stops } = require('../transport/publicTransport')('norrbotten');
const { filter } = require('rxjs/operators');
const Region = require('../../lib/class/geo/region');
const { info } = require('../../lib/log'); // Not used in this snippet but might be useful for logging

// List of municipalities included in the Norrbotten region
const includedMunicipalities = [
  'Arjeplogs kommun',
  'Arvidsjaurs kommun',
  'Bodens kommun',
  'Gällivare kommun',
  'Haparanda stad',
  'Jokkmokks kommun',
  'Kalix kommun',
  'Kiruna kommun',
  'Luleå kommun',
  'Pajala kommun',
  'Piteå kommun',
  'Storumans kommun',
  'Älvsbyns kommun',
  'Överkalix kommun',
  'Övertorneå kommun',
];

/**
 * Creates a Region object for Norrbotten.
 *
 * @param {Observable} municipalitiesStream - An observable stream of municipalities.
 * @returns {Region} - A Region object for Norrbotten.
 */
const norrbotten = (municipalitiesStream) => {
  // Filter municipalities to include only those in the includedMunicipalities list
  const municipalities = municipalitiesStream.pipe(
    filter(municipality => includedMunicipalities.includes(municipality.name))
  );

  // Create and return a new Region object
  return new Region({
    id: 'norrbotten',
    name: 'Norrbotten',
    kommuner: municipalities,
    stops, // Public transport stops for the region
  });
};

module.exports = norrbotten;
