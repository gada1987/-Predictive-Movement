// config/loadCentralConfig.js

const path = require('path');
const fs = require('fs');

// Load central configuration from centralconfig.json
const centralConfigPath = path.join(__dirname, 'centralconfig.json');
const centralConfig = JSON.parse(fs.readFileSync(centralConfigPath, 'utf-8'));

module.exports = centralConfig;
