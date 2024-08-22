// Importing the VirtualTime class from the specified path
const { VirtualTime } = require('../../lib/virtualTime')

// Extending the expect functionality to include a custom matcher 'toBeNear'
expect.extend({
  toBeNear(x, y) {
    return {
      pass: Math.round(x / 100) === Math.round(y / 100),
      message: () =>
        `Not close enough: expected: ${x}, received: ${y} Diff: ${x - y}`,
    }
  },
})

// Describe block for grouping related tests about the VirtualTime functionality
describe('VirtualTime', () => {
  let virtualTime

  // Before each test, create a new instance of VirtualTime with a speed multiplier of 1
  beforeEach(() => {
    virtualTime = new VirtualTime(1)
  })

  // Test case to check if virtual time can pass as expected
  it('can pass the time', (done) => {
    let start = virtualTime.time()

    // Set a timeout to check if the virtual time advances as expected after 1 second
    setTimeout(() => {
      expect(virtualTime.time()).toBeNear(start + 1000)
      done() // Indicating that the asynchronous test is complete
    }, 1000)
  })

  // Test case to check if virtual time can pause and return the same time
  it('can pause and receive same time', (done) => {
    let start = virtualTime.time()
    virtualTime.pause() // Pausing the virtual time

    // Set a timeout to check if the virtual time remains the same after pausing
    setTimeout(() => {
      expect(virtualTime.time()).toBeNear(start)
      done() // Indicating that the asynchronous test is complete
    }, 1000)
  })

  // Test case to check if virtual time can pause and return the same time after resuming
  it('can pause and receive same time after play', (done) => {
    let start = virtualTime.time()
    virtualTime.pause() // Pausing the virtual time

    // Set a timeout to resume the virtual time and check if the time remains the same
    setTimeout(() => {
      virtualTime.play() // Resuming the virtual time
      expect(virtualTime.time()).toBeNear(start)
      done() // Indicating that the asynchronous test is complete
    }, 1000)
  })

  // Test case to check if virtual time can pause, resume, and advance correctly
  it('can pause and resume and receive same time plus extra time', (done) => {
    let start = virtualTime.time()
    console.log('start', start)
    virtualTime.pause() // Pausing the virtual time

    // Set a timeout to resume the virtual time and check if it advances correctly
    setTimeout(() => {
      expect(virtualTime.time()).toBeNear(start)
      virtualTime.play() // Resuming the virtual time

      // Set another timeout to check if the virtual time advances as expected after resuming
      setTimeout(() => {
        expect(virtualTime.time()).toBeNear(start + 1000)
        done() // Indicating that the asynchronous test is complete
      }, 1000)
    }, 1000)
  })
})
