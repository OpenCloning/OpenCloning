import React from 'react';
import { useNavigate } from 'react-router-dom';

/**
 * This hook is used to create a stable navigate function that is not affected by re-renders.
 * It is used to avoid issues with the navigation function being updated and causing the app to navigate to the wrong page.
 * @returns {function} A stable navigate function.
 */
export default function useStableNavigate() {
  const navigate = useNavigate();
  const navigateRef = React.useRef(navigate);

  React.useLayoutEffect(() => {
    navigateRef.current = navigate;
  }, [navigate]);

  return React.useCallback((...args) => {
    navigateRef.current(...args);
  }, []);
}
