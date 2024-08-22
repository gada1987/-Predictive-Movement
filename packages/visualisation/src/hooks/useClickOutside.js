import { useEffect } from 'react';

// Custom React hook to detect clicks outside a specified element.
const useOutsideClick = (ref, callback) => {
  // Event handler for click events.
  const handleClick = (e) => {
    // Check if the click happened outside the referenced element.
    if (ref.current && !ref.current.contains(e.target)) {
      // Invoke the callback if the click was outside.
      callback();
    }
  };

  // Effect to set up and clean up the event listener.
  useEffect(() => {
    // Add the click event listener to the document when the component mounts.
    document.addEventListener('click', handleClick);

    // Clean up the event listener when the component unmounts or when dependencies change.
    return () => {
      document.removeEventListener('click', handleClick);
    };
  }, [ref, callback]); // Dependency array ensures the effect is re-run if ref or callback changes.

};

export default useOutsideClick;
