import { useContext, useEffect, useRef } from 'react';
import { SocketIOContext } from '../context/socketIOContext';

// Custom React hook to manage socket events with the Socket.IO context.
export const useSocket = (eventKey, callback) => {
  // Access the socket instance from the context.
  const socket = useContext(SocketIOContext);

  // Create a ref to hold the latest callback function. This ensures the latest version of the
  // callback is always used when handling socket events.
  const callbackRef = useRef(callback);

  // Update the current callback reference whenever the `callback` changes.
  callbackRef.current = callback;

  // Create a ref to store the socket event handler. This function will call the latest
  // callback stored in `callbackRef`.
  const socketHandlerRef = useRef(function () {
    if (callbackRef.current) {
      callbackRef.current.apply(this, arguments);
    }
  });

  // Set up and clean up socket event listeners using `useEffect`.
  useEffect(() => {
    // Function to subscribe to the socket event.
    const subscribe = () => {
      if (eventKey) {
        socket.on(eventKey, socketHandlerRef.current);
      }
    };

    // Function to unsubscribe from the socket event.
    const unsubscribe = () => {
      if (eventKey) {
        socket.removeListener(eventKey, socketHandlerRef.current);
      }
    };

    // Subscribe to the event when the hook is first run or when `eventKey` or `socket` changes.
    subscribe();

    // Clean up: unsubscribe from the event when the component unmounts or dependencies change.
    return unsubscribe;
  }, [eventKey, socket]);

  // Return the socket instance to allow components to use it directly if needed.
  return { socket };
};
