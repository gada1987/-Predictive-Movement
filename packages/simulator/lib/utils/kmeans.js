const kmeans = require('node-kmeans'); // Import the k-means clustering library
const assert = require('assert'); // Import the assert module for validation
const { write } = require('../log'); // Import the write function from the logging module

/**
 * Clusters a list of positions into a specified number of clusters using k-means algorithm.
 * 
 * @param {Array} input - Array of objects with position information (or pickup info with position).
 * @param {number} nrOfClusters - Number of clusters to create (default is 5).
 * @returns {Promise} - Resolves with an array of clusters, each containing a center and its items.
 */
const clusterPositions = (input, nrOfClusters = 5) => {
  // Convert input positions to vectors for clustering
  const vectors = input.map(({ pickup, position = pickup.position }) => [
    position.lon, // Longitude
    position.lat, // Latitude
  ]);
  
  // Ensure there are not too many positions to cluster (for performance reasons)
  assert(
    vectors.length < 300,
    'Too many positions to cluster:' + vectors.length
  );

  // Log progress
  write('k..');

  // Return a Promise that resolves with clustering results
  return new Promise((resolve, reject) =>
    kmeans.clusterize(vectors, { k: nrOfClusters }, (err, res) => {
      // Log progress
      write('.m');

      if (err) return reject(err); // Reject the Promise if an error occurs
      
      // Map the clustering result to the desired format
      const clusters = res.map((cluster) => ({
        center: { lon: cluster.centroid[0], lat: cluster.centroid[1] }, // Cluster center coordinates
        items: cluster.clusterInd.map((i) => input[i]), // Items belonging to this cluster
      }));

      resolve(clusters); // Resolve the Promise with the clusters
    })
  );
}

module.exports = { clusterPositions }; // Export the clusterPositions function for use in other modules

/*
test:

const positions = [
  { position: { lon: -0.1388888888888889, lat: 51.5 } },
  { position: { lon: -0.5388888888888889, lat: 52.5 } },
  { position: { lon: -0.4388888888888889, lat: 53.5 } },
  { position: { lon: -0.3388888888888889, lat: 54.5 } },
  { position: { lon: -0.2388888888888889, lat: 55.5 } },
  { position: { lon: -0.2388888888888889, lat: 56.5 } },
]

const clusters = clusterPositions(positions, 3).then((res) => {
  console.log(res)
})
*/
