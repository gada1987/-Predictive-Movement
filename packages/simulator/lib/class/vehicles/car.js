const Vehicle = require('./vehicle')

/**
 * Represents a Car, extending from Vehicle.
 */
class Car extends Vehicle {
  /**
   * Creates an instance of Car.
   * @param {Object} args Parameters to initialize Car object.
   */
  constructor(args) {
    super(args)
    this.vehicleType = 'car'
    this.isPrivateCar = args.isPrivateCar
    this.co2PerKmKg = 0.1201 // NOTE: From a quick google. Needs to be verified.
  }
}

module.exports = Car
