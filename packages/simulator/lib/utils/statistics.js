const { save } = require('../deps/elastic'); // Import the save function from the Elastic dependency module

/**
 * Save experiment metadata to the 'experiments' index.
 * 
 * @param {Object} experiment - The experiment metadata to be saved.
 * @returns {Promise} - A promise that resolves when the data is saved.
 */
const collectExperimentMetadata = (experiment) => {
  return save(experiment, 'experiments'); // Call the save function with the experiment data and the 'experiments' index
}

/**
 * Save booking details to the 'bookings' index.
 * 
 * @param {Object} booking - The booking object to be saved.
 * @param {Object} experimentSettings - Settings related to the experiment associated with the booking.
 * @returns {Promise} - A promise that resolves when the data is saved.
 */
const collectBooking = (booking, experimentSettings) => {
  return save(
    {
      ...booking.toObject(), // Convert booking object to plain object
      timestamp: new Date(), // Add current timestamp
      experimentSettings, // Add experiment settings
      passenger: booking.passenger?.toObject(), // Convert passenger details to plain object if present
    },
    'bookings' // Specify the 'bookings' index
  );
}

module.exports = {
  collectExperimentMetadata,
  collectBooking,
};
