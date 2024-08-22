const chalk = require('chalk'); // For coloring console output
const { ReplaySubject } = require('rxjs'); // Observable for handling log stream

// Define log level based on environment variable, defaulting to 'info'
const LOG_LEVEL = process.env.LOG_LEVEL || 'info';

// Determine the effective log level based on environment variable
const logLevelIsAtLeastDebug = LOG_LEVEL.toUpperCase() === 'DEBUG';
const logLevelIsAtLeastInfo =
  LOG_LEVEL.toUpperCase() === 'INFO' || logLevelIsAtLeastDebug;
const logLevelIsAtLeastWarn =
  LOG_LEVEL.toUpperCase() === 'WARN' || logLevelIsAtLeastInfo;

// ReplaySubject to store and emit the last 10 log messages
const logStream = new ReplaySubject(10);

/**
 * Prints a log message with specific formatting.
 * 
 * @param {Function} logFn - The logging function (e.g., console.debug, console.error).
 * @param {Function} titleFn - Function to format the log title.
 * @param {Function} messageFn - Function to format the log message.
 * @param {string} title - The title of the log message.
 * @param {string} message - The main message of the log.
 * @param {any} [data] - Optional additional data to include in the log.
 * @param {...any} [rest] - Additional arguments to pass to the logging function.
 */
const print = (logFn, titleFn, messageFn, title, message, data, ...rest) => {
  if (data) {
    logFn(
      titleFn(title), // Formatted title
      messageFn(message), // Formatted message
      data instanceof Error ? data : JSON.stringify(data, null, 2), // Data formatted as JSON or error
      ...rest
    );
  } else {
    logFn(titleFn(title), messageFn(message), ...rest); // Log without additional data
  }
};

module.exports = {
  logStream, // Export the log stream for external use

  /**
   * Logs a debug message if the log level allows.
   * 
   * @param {string} message - The debug message.
   * @param {any} [data] - Optional additional data to include in the log.
   * @param {...any} [rest] - Additional arguments to pass to the logging function.
   */
  debug: (message, data, ...rest) => {
    if (logLevelIsAtLeastDebug) {
      print(
        console.debug, // Use console.debug for debug messages
        chalk.whiteBright.bold, // Format title in bright white bold
        chalk.gray, // Format message in gray
        'DEBUG', // Title for debug level
        message,
        data,
        ...rest
      );
    }
  },

  /**
   * Logs an error message.
   * 
   * @param {string} title - The error title.
   * @param {Error} error - The error object.
   * @param {...any} [rest] - Additional arguments to pass to the logging function.
   */
  error: (title, error, ...rest) => {
    print(
      console.error, // Use console.error for error messages
      chalk.redBright.bold, // Format title in bright red bold
      chalk.red, // Format message in red
      'ERROR', // Title for error level
      title,
      error,
      ...rest
    );
  },

  /**
   * Logs an info message if the log level allows.
   * 
   * @param {string} message - The info message.
   * @param {any} [data] - Optional additional data to include in the log.
   * @param {...any} [rest] - Additional arguments to pass to the logging function.
   */
  info: (message, data, ...rest) => {
    logStream.next(
      message + ' ' + [data, ...rest].map((x) => JSON.stringify(x)).join(' ') // Format message with data
    );

    if (logLevelIsAtLeastInfo) {
      print(
        console.log, // Use console.log for info messages
        chalk.whiteBright.bold, // Format title in bright white bold
        chalk.white, // Format message in white
        'INFO ', // Title for info level
        message,
        data,
        ...rest
      );
    }
  },

  /**
   * Logs a warning message if the log level allows.
   * 
   * @param {string} message - The warning message.
   * @param {any} [data] - Optional additional data to include in the log.
   * @param {...any} [rest] - Additional arguments to pass to the logging function.
   */
  warn: (message, data, ...rest) => {
    if (logLevelIsAtLeastWarn) {
      print(
        console.log, // Use console.log for warning messages
        chalk.red.bold, // Format title in red bold
        chalk.white, // Format message in white
        'WARN ', // Title for warn level
        message,
        data,
        ...rest
      );
    }
  },

  /**
   * Writes raw data to the standard output if the log level allows.
   * 
   * @param {string} data - The data to write.
   */
  write: (data) => {
    if (logLevelIsAtLeastDebug) {
      process.stdout.write(data); // Write data to standard output
    }
  },
};
