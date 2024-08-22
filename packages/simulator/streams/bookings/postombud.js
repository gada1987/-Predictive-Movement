const { from, shareReplay } = require('rxjs'); // RxJS for creating observables and sharing them
const { map, filter } = require('rxjs/operators'); // RxJS operators for transforming and filtering data
const { readXlsx } = require('../../lib/utils/adapters/xlsx'); // Utility to read data from Excel files

/**
 * Reads and processes data from an Excel file, converting it into a stream of "ombud" objects.
 * 
 * @returns {Observable<Object[]>} - An observable stream of processed "ombud" objects.
 */
function execute() {
  return from(
    readXlsx(
      `${process.cwd()}/data/bookings/${process.env.postombud_file || 'ombud.xlsx'}`, // Path to the Excel file
      `${process.env.postombud_sheet || 'Sammanställning korr'}` // Name of the sheet to read
    )
  ).pipe(
    map(
      ({
        X_WGS84, // Longitude
        Y_WGS84, // Latitude
        Omb_TYP, // Type of ombud
        LevFrekv, // Frequency
        OPERATÖR, // Operator name
        DB_ID, // Database ID
        KOMMUNNAMN, // Municipality name
      }) => ({
        position: {
          lon: parseFloat(X_WGS84, 10), // Convert longitude to float
          lat: parseFloat(Y_WGS84, 10), // Convert latitude to float
        },
        operator: OPERATÖR,
        frequency: LevFrekv,
        id: DB_ID,
        type: Omb_TYP,
        kommun: KOMMUNNAMN,
      })
    ),
    filter((ombud) => ombud.type === 'Postombud'), // Filter only "Postombud" type
    shareReplay() // Share the observable so that it can be subscribed to multiple times
  );
}

module.exports = execute(); // Export the function for use in other modules
