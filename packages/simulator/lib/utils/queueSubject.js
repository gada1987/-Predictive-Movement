const { Subject, mergeMap, catchError, from } = require('rxjs'); // Import RxJS functions and operators
const { debug, error } = require('../log'); // Import logging functions

const API_CALL_LIMIT = 10; // Maximum number of concurrent API calls

const queueSubject = new Subject(); // Create a new RxJS Subject to handle queued functions

let queueLength = 0; // Track the number of currently queued items

/**
 * Adds a function to the queue and returns a promise.
 * The function will be executed once the queue processes it.
 * 
 * @param {Function} fn - The function to be queued and executed.
 * @returns {Promise} - A promise that resolves or rejects based on the function's outcome.
 */
function queue(fn) {
  queueLength++; // Increment queue length
  return new Promise((resolve, reject) => {
    // Push the function, resolve, and reject handlers to the queue
    queueSubject.next({
      fn,
      resolve,
      reject,
    });
  });
}

// Process queued functions with RxJS
queueSubject
  .pipe(
    // Limit the number of concurrent function executions
    mergeMap(
      ({ fn, resolve, reject }) =>
        from(fn()).pipe(
          // Handle successful function execution
          mergeMap((result) => {
            queueLength--; // Decrement queue length
            debug('queueLength', queueLength); // Log the current queue length
            resolve(result); // Resolve the promise with the result
            return []; // Return an empty array to complete the observable
          }),
          catchError((err) => {
            queueLength--; // Decrement queue length on error
            error('error queue', err, queueLength); // Log the error and current queue length
            reject(err); // Reject the promise with the error
            return []; // Return an empty array to complete the observable
          })
        ),
      API_CALL_LIMIT // Set the maximum number of concurrent executions
    )
  )
  .subscribe(); // Start processing the queue

module.exports = queue; // Export the queue function for use in other modules
