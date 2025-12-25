'use client';

import { useState, useEffect, useCallback, useRef } from 'react';

/**
 * Custom hook that persists state to localStorage.
 * Works safely with SSR by only accessing localStorage on the client.
 *
 * @param key - The localStorage key to use
 * @param defaultValue - The default value if nothing is stored
 * @returns [state, setState] - Same API as useState
 */
export function usePersistedState<T>(
  key: string,
  defaultValue: T
): [T, React.Dispatch<React.SetStateAction<T>>] {
  // Track if we've initialized from localStorage
  const isInitialized = useRef(false);

  // Initialize with default value (will be updated from localStorage on mount)
  const [state, setState] = useState<T>(defaultValue);

  // Load from localStorage on mount (client-side only)
  useEffect(() => {
    if (isInitialized.current) return;

    try {
      const storedValue = localStorage.getItem(key);
      if (storedValue !== null) {
        const parsed = JSON.parse(storedValue);
        setState(parsed);
      }
    } catch (error) {
      console.warn(`Error reading localStorage key "${key}":`, error);
    }

    isInitialized.current = true;
  }, [key]);

  // Save to localStorage whenever state changes (after initialization)
  useEffect(() => {
    if (!isInitialized.current) return;

    try {
      localStorage.setItem(key, JSON.stringify(state));
    } catch (error) {
      console.warn(`Error writing to localStorage key "${key}":`, error);
    }
  }, [key, state]);

  return [state, setState];
}

/**
 * Hook to persist multiple related state values under a single key.
 * Useful for persisting all filters of a page together.
 *
 * @param key - The localStorage key to use
 * @param defaultState - Object with default values for all state
 * @returns [state, updateState, resetState]
 */
export function usePersistedFilters<T extends Record<string, any>>(
  key: string,
  defaultState: T
): [T, (updates: Partial<T>) => void, () => void] {
  const isInitialized = useRef(false);
  const [state, setState] = useState<T>(defaultState);

  // Load from localStorage on mount
  useEffect(() => {
    if (isInitialized.current) return;

    try {
      const storedValue = localStorage.getItem(key);
      if (storedValue !== null) {
        const parsed = JSON.parse(storedValue);
        // Merge with defaults to handle new fields
        setState(prev => ({ ...prev, ...parsed }));
      }
    } catch (error) {
      console.warn(`Error reading localStorage key "${key}":`, error);
    }

    isInitialized.current = true;
  }, [key]);

  // Save to localStorage whenever state changes
  useEffect(() => {
    if (!isInitialized.current) return;

    try {
      localStorage.setItem(key, JSON.stringify(state));
    } catch (error) {
      console.warn(`Error writing to localStorage key "${key}":`, error);
    }
  }, [key, state]);

  // Update specific fields
  const updateState = useCallback((updates: Partial<T>) => {
    setState(prev => ({ ...prev, ...updates }));
  }, []);

  // Reset to defaults
  const resetState = useCallback(() => {
    setState(defaultState);
    try {
      localStorage.removeItem(key);
    } catch (error) {
      console.warn(`Error removing localStorage key "${key}":`, error);
    }
  }, [key, defaultState]);

  return [state, updateState, resetState];
}

export default usePersistedState;
