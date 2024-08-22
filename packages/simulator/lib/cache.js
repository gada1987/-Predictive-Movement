const fs = require('fs'); // File system module for file operations
const path = require('path'); // Module for handling file and directory paths
const crypto = require('crypto'); // Module for cryptographic operations

const cacheDir = path.join(__dirname, '../.cache'); // Directory for cache files

// Create cache directory if it doesn't exist
if (!fs.existsSync(cacheDir)) {
  fs.mkdirSync(cacheDir); // Create the directory synchronously
}

/**
 * Creates a hash string from an object using SHA-1 algorithm.
 * This hash will be used as the filename for caching.
 * 
 * @param {Object} object - The object to hash.
 * @returns {string} - The resulting hash as a hexadecimal string.
 */
function createHash(object) {
  const hash = crypto.createHash('sha1'); // Create a SHA-1 hash object
  hash.update(JSON.stringify(object)); // Update hash with the JSON string of the object
  return hash.digest('hex'); // Return the hash digest in hexadecimal format
}

/**
 * Reads from the cache.
 * 
 * @param {Object} object - The object to use for generating the cache key.
 * @returns {Promise<Object|null>} - Resolves with the cached result or null if not found.
 */
async function getFromCache(object) {
  const hash = createHash(object); // Generate a hash key for the object
  const filePath = path.join(cacheDir, hash); // Full path to the cache file

  return new Promise((resolve, reject) => {
    fs.readFile(filePath, 'utf8', (err, data) => {
      if (err) {
        if (err.code === 'ENOENT') {
          // File not found, resolve with null
          resolve(null);
        } else {
          // Other errors, reject the promise
          reject(err);
        }
      } else {
        // File read successfully, parse JSON and resolve with the result
        resolve(JSON.parse(data));
      }
    });
  });
}

/**
 * Updates the cache with a new result.
 * 
 * @param {Object} object - The object to use for generating the cache key.
 * @param {Object} result - The result to cache.
 * @returns {Promise<Object>} - Resolves with the cached result.
 */
async function updateCache(object, result) {
  const hash = createHash(object); // Generate a hash key for the object
  const filePath = path.join(cacheDir, hash); // Full path to the cache file

  return new Promise((resolve, reject) => {
    fs.writeFile(filePath, JSON.stringify(result), 'utf8', (err) => {
      if (err) {
        // Error writing file, reject the promise
        reject(err);
      } else {
        // File written successfully, resolve with the result
        resolve(result);
      }
    });
  });
}

module.exports = {
  getFromCache,
  updateCache,
};
