// Mapping sizes to corresponding circle radii
// This object defines different sizes for circles and their associated radii.
// The sizes are used as keys to provide the radius values in the application.
export const SIZE_TO_CIRCLE_RADII = {
  xs: 2,   // Extra small circles have a radius of 2 units
  s: 5,    // Small circles have a radius of 5 units
  m: 7,    // Medium circles have a radius of 7 units
  l: 10,   // Large circles have a radius of 10 units
};

// Mapping sizes to corresponding image sizes
// This object defines the sizes of images relative to a base size.
// The sizes are used as keys to scale images according to the specified factor.
export const SIZE_TO_IMAGE_SIZE = {
  xs: 0.2, // Extra small images are scaled to 20% of the base size
  s: 0.4,  // Small images are scaled to 40% of the base size
  m: 0.6,  // Medium images are scaled to 60% of the base size
  l: 0.8,  // Large images are scaled to 80% of the base size
};

// Mapping different types of items to their circle colors
// This object defines colors for different types of items using hexadecimal color codes.
// The colors are used to visually distinguish different categories in the application.
export const CIRCLE_COLORS = {
  booking: '#fab', // Color for booking-related circles: a light pink
  car: '#13C57B',  // Color for car-related circles: a greenish shade
  hub: '#0000ff',  // Color for hub-related circles: blue
};
