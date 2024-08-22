// Use environment variable for API key or fallback to the default key for development
const key = process.env.TRAFIKLAB_KEY || 'b12a47516a7f4a4c904109a2530aa6fd'; 

// Required modules
const fs = require('fs');
const path = require('path');
const { info, error, debug } = require('../../lib/log'); // Custom logging functions
const AdmZip = require('adm-zip');
const fetch = require('node-fetch');
const { shareReplay, Observable } = require('rxjs');
const { map, toArray, groupBy, mergeMap, filter } = require('rxjs/operators');
const csv = require('csv-stream');
const Position = require('../../lib/class/geo/position');

//const config = require('../../../../centralconfig.json');

// gtfs.js
const centralConfig = require('../../../../config/loadCentralConfig');

// Your existing code using centralConfig

// Define a constant for one month in milliseconds
const MONTH = 1000 * 60 * 60 * 24 * 30;

// Load bus stop kommun data
const kommuner = require('../../data/geo/kommuner.json');
let kommunerGeo = [];

// Process each kommun to calculate bounding boxes
kommuner.forEach(kommun => {
  let kommunObj = {
    name: "",
    box: {
      minLonPoint: [], 
      maxLonPoint: [], 
      minLatPoint: [], 
      maxLatPoint: []
    }
  };

  kommunObj.name = kommun.namn;

  let minLon = Infinity, maxLon = -Infinity;
  let minLat = Infinity, maxLat = -Infinity;
  let minLonPoint = [], maxLonPoint = [], minLatPoint = [], maxLatPoint = [];

  kommun.geometry.coordinates[0].forEach(coord => {
    const [lon, lat] = coord;
    // Update min/max longitude and latitude
    if (lon < minLon) { minLon = lon; minLonPoint = [lon, lat]; }
    if (lon > maxLon) { maxLon = lon; maxLonPoint = [lon, lat]; }
    if (lat < minLat) { minLat = lat; minLatPoint = [lon, lat]; }
    if (lat > maxLat) { maxLat = lat; maxLatPoint = [lon, lat]; }
  });

  // Assign bounding box to kommun object
  kommunObj.box = { minLonPoint: minLonPoint, maxLonPoint: maxLonPoint, minLatPoint: minLatPoint, maxLatPoint: maxLatPoint };
  kommunerGeo.push(kommunObj);
});

// Function to download GTFS zip file if it doesn't exist or is outdated
const downloadIfNotExists = (operator) => {
  const zipFile = path.join(config.paths.gtfs,'${operator}.zip');
  
  return new Promise((resolve, reject) => {
    const url = `https://opendata.samtrafiken.se/gtfs/${operator}/${operator}.zip?key=${key}`;
    const zipFileAge = fs.existsSync(zipFile) && Date.now() - fs.statSync(zipFile).mtimeMs;
    const zipFileSize = fs.existsSync(zipFile) && fs.statSync(zipFile).size;

    // Check if file needs to be downloaded
    if (!fs.existsSync(zipFile) || zipFileSize < 5000 || zipFileAge > 1 * MONTH) {
      const stream = fs.createWriteStream(zipFile);
      info('Downloading GTFS', url);
      fetch(url)
        .then(res => res.body.pipe(stream)
          .on('finish', () => {
            info('Downloaded GTFS');
            resolve(zipFile);
          })
          .on('error', (err) => {
            error('Error downloading GTFS', err);
            reject(err);
          })
        )
        .catch(err => error('Error fetching GTFS', err) || reject(err));
    } else {
      resolve(zipFile);
    }
  });
};

// Function to download and extract GTFS zip file if it doesn't exist or is outdated
const downloadAndExtractIfNotExists = (operator) => {
  return downloadIfNotExists(operator)
    .then(zipFile => {
      try {
        const outPath = path.join(__dirname, `../../.cache/${operator}`);
        const zip = new AdmZip(zipFile);

        // Create output directory if it doesn't exist
        if (!fs.existsSync(outPath)) fs.mkdirSync(outPath, { recursive: true });
        zip.extractAllTo(outPath, true);
        return zipFile;
      } catch (err) {
        error('Error unpacking', err);
        fs.rmSync(zipFile); // Remove corrupted file and try again next time
      }
    })
    .catch(err => {
      error('Error when unpacking GTFS file', err);
    });
};

// Function to create a GTFS observable stream
function gtfs(operator) {
  const download = downloadAndExtractIfNotExists(operator);
  
  // Function to create a readable stream for GTFS files
  const gtfsStream = (file) => {
    return new Observable((observer) => {
      download.then(() => {
        const stream = fs.createReadStream(
          path.join(__dirname, `../../.cache/${operator}/${file}.txt`)
        ).pipe(csv.createStream({ enclosedChar: '"' }));
        
        stream.on('data', (data) => observer.next(data));
        stream.on('end', () => observer.complete());
        stream.on('finish', () => {
          info(`FINISH ${file}`);
          observer.complete(); // Ensure completion
        });
      });
    });
  };

  // Create observable for bus stops
  const stops = gtfsStream('stops').pipe(
    map(({ stop_id: id, stop_name: name, stop_lat: lat, stop_lon: lon, parent_station, platform_code }) => ({
      id,
      name,
      position: new Position({ lat: +lat, lon: +lon }),
      station: parent_station,
      platform: platform_code,
      kommun: "", // To be populated later
    })),
    shareReplay()
  );

  // Map bus stops to their corresponding kommun based on coordinates
  stops.forEach(stop => {
    const { lon, lat } = stop.position;
    kommunerGeo.forEach(kommun => {
      if (lon < kommun.box.maxLonPoint[0] && lon > kommun.box.minLonPoint[0] &&
          lat > kommun.box.minLatPoint[1] && lat < kommun.box.maxLatPoint[1]) {
        stop.kommun = kommun.name;
      }
    });
  });

  // Create observable for trips
  const trips = gtfsStream('trips').pipe(
    map(({ trip_id: id, service_id: serviceId, trip_headsign: headsign, route_id: routeId }) => ({
      id,
      serviceId,
      headsign,
      routeId,
    })),
    shareReplay()
  );

  // Create observable for route names
  const routeNames = gtfsStream('routes').pipe(
    map(({ route_id: id, route_short_name: lineNumber }) => ({
      id,
      lineNumber,
    })),
    shareReplay()
  );

  /**
   * Filter out unwanted routes based on their description
   * Example: Exclude boats, trains, and other non-bus lines
   */
  const excludedLineNumbers = gtfsStream('routes').pipe(
    map(({ route_id: id, route_short_name: lineNumber, route_desc: description }) => ({
      id,
      lineNumber,
      description,
    })),
    filter(route => {
      switch (route.description) {
        case 'ForSea':
        case 'Krösatåg':
        case 'Närtrafik':
        case 'Plusresor':
        case 'Pågatåg':
        case 'PågatågExpress':
        case 'Spårvagn':
        case 'TEB planerad':
        case 'VEN trafiken':
        case 'Öresundståg':
          debug(`Excluding route ${route.lineNumber} (${route.id}). Reason: ${route.description}`);
          return true;
        default:
          return false;
      }
    }),
    map(route => route.lineNumber),
    shareReplay()
  );

  // Create observable for service dates with exceptions
  const serviceDates = gtfsStream('calendar_dates').pipe(
    map(({ service_id: serviceId, date, exception_type: exceptionType }) => ({
      serviceId,
      date,
      exceptionType,
    })),
    groupBy(x => x.date),
    map(group => ({ date: group.key, services: group })),
    mergeMap(group =>
      group.services.pipe(
        toArray(),
        map(services => ({
          date: group.date,
          services: services.map(x => x.serviceId),
        }))
      )
    ),
    shareReplay()
  );

  // Correct time to handle 27-hour clock format
  const correctTime = (time) => {
    const now = new Date();
    const year = now.getFullYear();
    const month = now.getMonth();
    const day = now.getDate();
    const regex = /^(\d{2}):(\d{2}):(\d{2})$/;
    const [, hour, minute, second] = time.match(regex);

    // Create a Date object to handle hours above 24 correctly
    return new Date(year, month, day, +hour, +minute, +second);
  };

  // Create observable for bus stop times
  const busStops = gtfsStream('stop_times').pipe(
    map(({ stop_id: stopId, stop_headsign: finalStop, trip_id: tripId, arrival_time: arrivalTime, departure_time: departureTime }) => ({
      stopId,
      tripId,
      arrivalTime: correctTime(arrivalTime),
      departureTime: correctTime(departureTime),
      finalStop,
    })),
    shareReplay()
  );

  // Return all observables
  return {
    busStops,
    stops,
    trips,
    serviceDates,
    routeNames,
    excludedLineNumbers,
  };
}

// Export the gtfs function
module.exports = gtfs;
