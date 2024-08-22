const { from, shareReplay } = require('rxjs'); // RxJS functions for creating observables and sharing results
const { map } = require('rxjs/operators'); // RxJS operators for transforming observables
const { readXlsx } = require('../../../lib/utils/adapters/xlsx'); // Utility function to read XLSX files
const sweCoords = require('swe-coords'); // Library for converting Swedish coordinates

/**
 * Reads and processes transport data from an XLSX file.
 * 
 * @returns {Observable<Object[]>} - Observable stream of processed transport data.
 */
function execute() {
  // Read data from the specified XLSX file and sheet
  return from(
    readXlsx(
      `${process.cwd()}/data/bookings/helsingborg/${
        process.env.transports_file || 'transports2021.xlsx'
      }`,
      `${process.env.transports_sheet || 'Blad1'}`
    )
  ).pipe(
    // Transform each row of data into a more structured format
    map(
      ({
        x,
        y,
        'HBG nr': hbgNr, // Helsingborg number
        //'Traffic Web': trafficWeb, // Commented out field
        Mätår: year, // Year
        Månad: month, // Month
        UT, // Unknown field
        IN, // Unknown field
        Rikt: directionInSwedish, // Direction in Swedish
        'VaDT Tung': heavyTrafficCount, // Heavy traffic count
      }) => ({
        kommun: 'Helsingborg', // Fixed municipality name
        position: sweCoords.toLatLng(
          Math.floor(x).toString(), // Convert x-coordinate to integer string
          Math.floor(y).toString()  // Convert y-coordinate to integer string
        ),
        year,
        month,
        heavyTrafficCount: Math.round(heavyTrafficCount / (IN - UT)), // Calculate average heavy traffic count
        id: hbgNr,
        direction: directionInSwedish,
      })
    ),
    // Transform position coordinates from {lat, lng} to {lat, lon}
    map(({ position: { lat, lng }, ...rest }) => ({
      position: { lat, lon: lng }, // Use 'lon' instead of 'lng' for longitude
      ...rest,
    })),
    shareReplay() // Share and replay the observable values
  );
}

module.exports = execute(); // Export the function's observable stream
