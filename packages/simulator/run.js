const path = require('path');
const fs = require('fs');
// Import the config module
const config = require('./config/index.js');
// Adjust the path to centralconfig.json
//const centralConfigPath = path.join(__dirname, 'config', 'centralconfig.json');
//const centralConfig = JSON.parse(fs.readFileSync(centralConfigPath, 'utf-8'));

// Load Fleet module
const Fleet = require(path.join(__dirname, 'lib', 'class', 'fleet.js'));

global.parameters = require(path.join(__dirname, 'config', 'VehicleTypes.json'));

const main = async () => {
  const emitters = config.emitters();
  const vehicleTypes = config.vehicleTypes();
  const centralConfig = config.centralConfig;
  const fleets = centralConfig.paths.fleets;
  const paths = centralConfig.paths;

  console.log('Emitters:', emitters);
  console.log('VehicleTypes:', vehicleTypes);
  console.log('Fleets:', fleets);
  console.log('CentralConfig:', centralConfig);
  
};

main();
