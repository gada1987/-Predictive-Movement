const { stops } = require('../transport/publicTransport')('gotland'); // Import bus stops data for Gotland
const { filter } = require('rxjs/operators'); // Import filter operator from RxJS
const Region = require('../../lib/class/geo/region'); // Import Region class

// List of municipalities to include in the Gotland region
const includedMunicipalities = [
  'Gotlands Region',
];

/**
 * Creates a Region object for Gotland by filtering municipalities.
 * 
 * @param {Observable} municipalitiesStream - Stream of municipality objects.
 * @returns {Region} - A Region object for Gotland with filtered municipalities and bus stops.
 */
const gotland = (municipalitiesStream) => {
  // Filter municipalities to include only those listed in includedMunicipalities
  const municipalities = municipalitiesStream.pipe(
    filter((municipality) => includedMunicipalities.includes(municipality.name))
  );

  // Create and return a Region object for Gotland
  return new Region({
    id: 'gotland',
    name: 'Gotland',
    kommuner: municipalities,
    stops, // Include bus stops data
  });
};

module.exports = gotland; // Export the gotland function
