const { customAlphabet } = require('nanoid'); // Import the customAlphabet function from the nanoid library

// Create a custom nanoid generator that avoids ambiguous characters (like l1, O0, il) for better readability
const nanoid = customAlphabet(
  'ABCDEFGHJKLMNPQRSTUVWXYZabcdefghjkmnpqrstuvwxyz23456789', // Define the character set excluding similar-looking characters
  4 // Length of each generated ID segment
);

// Function to generate a more human-readable ID by concatenating two nanoid segments with a hyphen
const safeId = () => `${nanoid()}-${nanoid()}`; // Returns an ID in the format of 'xxxx-yyyy', where 'x' and 'y' are segments of 4 characters each

module.exports = { safeId }; // Export the safeId function for use in other modules
