// profanityFilterStore.js - A store for the profanity filter state
import { writable } from 'svelte/store';

// Create a store for the filter enabled state
// Initialize the store with the value from localStorage if available
let initialValue = true;
try {
  const savedValue = localStorage.getItem('ergoChat_profanityFilter');
  if (savedValue !== null) {
    initialValue = savedValue === 'true';
  }
} catch (e) {
  console.error('Error reading profanity filter setting from localStorage', e);
}

// Create the store with the correct initial value
export const filterEnabled = writable(initialValue);

// Export default for convenience
export default filterEnabled;