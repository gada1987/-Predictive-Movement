/**
 * Function to interpolate the position from a given route based on the start time, 
 * current time, and remaining points in the route.
 * 
 * @param {number} routeStarted - The start time of the route in milliseconds.
 * @param {number} time - The current time in milliseconds.
 * @param {Array} remainingPointsInRoute - Array of remaining points in the route.
 * @returns {Object} - An object containing the interpolated position, speed, current instruction, next point, and skipped/remaining points.
 */
function interpolatePositionFromRoute(routeStarted, time, remainingPointsInRoute) {
  const timeSinceRouteStarted = (time - routeStarted) / 1000; // Time since the route started in seconds

  if (routeStarted > time) {
    // When routeStarted is greater than the current time, a "reset" is triggered
    return {
      lat: remainingPointsInRoute[0].position.lat,
      lon: remainingPointsInRoute[0].position.lon,
      speed: 0,
      instruction: remainingPointsInRoute[0],
      next: remainingPointsInRoute[0],
      remainingPoints: [],
      skippedPoints: [],
    };
  }

  // Filter future points based on the time since the route started
  const futurePoints = remainingPointsInRoute.filter(
    (point) => point.passed + point.duration > timeSinceRouteStarted
  );
  const nrOfPointsSkipped = remainingPointsInRoute.indexOf(futurePoints[0]) + 1;
  const skippedPoints = remainingPointsInRoute.slice(0, nrOfPointsSkipped);
  const current = futurePoints[0];
  const next = futurePoints[1];
  const lastPoint = remainingPointsInRoute[remainingPointsInRoute.length - 1];
  const remainingPoints = futurePoints;

  // When reaching the end of the route
  if (!current || !next)
    return {
      lat: lastPoint.position.lat,
      lon: lastPoint.position.lon,
      speed: 0,
      instruction: lastPoint,
      next: null,
      remainingPoints,
      skippedPoints: [],
    };

  const progress = (timeSinceRouteStarted - current.passed) / current.duration; // Calculate progress between current and next point
  const speed = Math.round(current.meters / 1000 / (current.duration / 60 / 60)); // Calculate speed in km/h

  // Interpolated position based on progress between current and next point
  const interpolatedPosition = {
    lat:
      current.position.lat +
      (next.position.lat - current.position.lat) * progress,
    lon:
      current.position.lon +
      (next.position.lon - current.position.lon) * progress,
    speed: speed,
    instruction: current,
    next: {
      lat: next.position.lat,
      lon: next.position.lon,
      instruction: next,
    },
    skippedPoints,
    remainingPoints,
  };
  return interpolatedPosition;
}

const speedFactor = 1.4; // Speed factor to be applied to all speeds

/**
 * Function to extract points from a given route.
 * 
 * @param {Object} route - The route object containing legs and geometry.
 * @returns {Array} - Array of points with position, meters, duration, passed time, and distance.
 */
function extractPoints(route) {
  const annotation = route.legs
    .map((leg) => leg.annotation)
    .reduce((a, b) => ({
      duration: a.duration.concat(b.duration) / speedFactor,
      distance: b.distance.concat(b.distance),
    }));

  // Destination is the last step, will not have an annotation
  annotation.distance.push(0);
  annotation.duration.push(0);

  const points = route.geometry.coordinates.map((pos, i) => ({
    position: pos,
    meters: annotation.distance[i],
    duration: annotation.duration[i],
  }));

  // Calculate passed time for each point
  points.reduce((passed, point) => {
    point.passed = passed;
    return point.passed + (point.duration || 0);
  }, 0);

  // Calculate distance for each point
  points.reduce((distance, point) => {
    point.distance = distance;
    return point.distance + (point.meters || 0);
  }, 0);

  return points;
}

module.exports = {
  route: interpolatePositionFromRoute, // Export interpolatePositionFromRoute function
  points: extractPoints, // Export extractPoints function
};
