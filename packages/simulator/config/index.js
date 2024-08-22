const path = require('path');
const fs = require('fs');

// Load central configuration
const centralConfigPath = path.join(__dirname, 'centralconfig.json');
const centralConfig = JSON.parse(fs.readFileSync(centralConfigPath, 'utf-8'));

const paramsFileName = 'VehicleTypes.json'; // The correct file name
const dataDir = path.join(__dirname); // The current directory

const parameters = require('./parameters.json');
global.parameters = require('./VehicleTypes.json');  // Load global parameters

// Saves a json parameter object to a parameter file in the data directory
const save = (value) => {
  const file = path.join(dataDir, paramsFileName);
  fs.writeFileSync(file, JSON.stringify(value, null, 2));
};

// Returns the json parameters as an object from the parameter file in the data directory
const read = () => {
  const file = path.join(dataDir, paramsFileName);
  return JSON.parse(fs.readFileSync(file));
};

module.exports = {
  emitters: () => {
    const { emitters } = read();
    return emitters;
  },

  vehicleTypes: () => {
    const { vehicleTypes } = read();
    return vehicleTypes;
  },

  fleets: () => {
    const { fleets } = read();
    return fleets;
  },

  municipalities: () => {
    const { fleets } = read();
    return Object.keys(fleets);
  },
  read,
  save,
  centralConfig, // Export centralConfig
  
};
