const { interval, firstValueFrom } = require('rxjs');
const {
  scan,
  shareReplay,
  map,
  filter,
  distinctUntilChanged,
} = require('rxjs/operators');
const {
  addMilliseconds,
  startOfDay,
  addHours,
  getUnixTime,
} = require('date-fns');

/**
 * Class to manage and simulate virtual time.
 * 
 * @class VirtualTime
 */
class VirtualTime {
  /**
   * Creates an instance of VirtualTime.
   * 
   * @param {number} timeMultiplier - Factor to speed up or slow down time. Default is 1 (real-time).
   * @param {number} startHour - Hour of the day to start the virtual time. Default is 4.8 hours.
   */
  constructor(timeMultiplier = 1, startHour = 4.8) {
    this.startHour = startHour;
    this.timeMultiplier = timeMultiplier;
    this.internalTimeScale = 1;
    this.reset();
  }

  /**
   * Resets the virtual time to start from the specified startHour.
   */
  reset() {
    const startDate = addHours(startOfDay(new Date()), this.startHour);
    const msUpdateFrequency = 100; // Frequency of time updates in milliseconds

    // Create an observable that emits the current time, updated at regular intervals
    this.currentTime = interval(msUpdateFrequency).pipe(
      scan(
        (acc) =>
          addMilliseconds(
            acc,
            msUpdateFrequency * this.timeMultiplier * this.internalTimeScale
          ),
        startDate
      ),
      shareReplay(1) // Share the most recent value with new subscribers
    );
  }

  /**
   * Returns an observable stream of the current virtual time.
   * 
   * @returns {Observable<Date>} - Observable stream of the current virtual time.
   */
  getTimeStream() {
    return this.currentTime;
  }

  /**
   * Returns an observable stream of the current virtual time in milliseconds.
   * 
   * @returns {Observable<number>} - Observable stream of the current time in milliseconds.
   */
  getTimeInMilliseconds() {
    return this.currentTime.pipe(
      map(getUnixTime), // Convert date to Unix time (seconds since epoch)
      map((e) => e * 1000), // Convert seconds to milliseconds
      distinctUntilChanged() // Emit values only if they change
    );
  }

  /**
   * Returns a promise that resolves with the current time in milliseconds.
   * 
   * @returns {Promise<number>} - Promise that resolves with the current time in milliseconds.
   */
  getTimeInMillisecondsAsPromise() {
    return firstValueFrom(this.getTimeInMilliseconds());
  }

  /**
   * Starts the virtual time simulation (play).
   */
  play() {
    this.internalTimeScale = 1;
  }

  /**
   * Pauses the virtual time simulation.
   */
  pause() {
    this.internalTimeScale = 0;
  }

  /**
   * Waits until the specified time is reached.
   * 
   * @param {Date} time - Time to wait until.
   * @returns {Promise<void>} - Promise that resolves when the specified time is reached.
   */
  async waitUntil(time) {
    if (this.timeMultiplier === 0) return; // Don't wait if time is stopped
    if (this.timeMultiplier === Infinity) return; // Return immediately if time is set to infinity
    return firstValueFrom(this.currentTime.pipe(filter((e) => e >= time)));
  }

  /**
   * Waits for a specified number of milliseconds from the current time.
   * 
   * @param {number} ms - Number of milliseconds to wait.
   * @returns {Promise<void>} - Promise that resolves after the specified time has elapsed.
   */
  async wait(ms) {
    const now = await this.getTimeInMillisecondsAsPromise();
    return this.waitUntil(now + ms);
  }

  /**
   * Sets the speed factor for time advancement.
   * 
   * @param {number} timeMultiplier - Factor to speed up or slow down time.
   */
  setTimeMultiplier(timeMultiplier) {
    this.timeMultiplier = timeMultiplier;
  }
}

// Exporting the singleton instance and class for external use
module.exports = {
  virtualTime: new VirtualTime(), // Static global instance of VirtualTime
  VirtualTime,
};
