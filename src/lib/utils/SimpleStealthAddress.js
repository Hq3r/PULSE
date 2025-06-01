// SimpleStealthAddress.js - Stealth address management for anonymous messaging
import { ENCRYPTION_CONFIG } from './chatConstants.js';

/**
 * Simple stealth address manager for anonymous chat identities
 */
class StealthAddressManager {
  constructor() {
    this.currentStealthAddress = null;
    this.storageKey = 'ergochat-stealth-address';
  }

  /**
   * Generate a random display name for anonymous users
   * @returns {string} Random anonymous display name
   */
  generateDisplayName() {
    const prefixes = [
      'Silent', 'Hidden', 'Shadow', 'Ghost', 'Phantom', 
      'Invisible', 'Secret', 'Anonymous', 'Stealth', 'Masked'
    ];
    
    const suffixes = [
      'Walker', 'Sender', 'User', 'Agent', 'Messenger', 
      'Trader', 'Builder', 'Node', 'Voyager', 'Explorer'
    ];
    
    const randomPrefix = prefixes[Math.floor(Math.random() * prefixes.length)];
    const randomSuffix = suffixes[Math.floor(Math.random() * suffixes.length)];
    const randomNumber = Math.floor(Math.random() * 999) + 1;
    
    return `${randomPrefix}${randomSuffix}${randomNumber}`;
  }

  /**
   * Generate a stealth address/identity
   * @param {string} originalAddress - The user's real wallet address
   * @param {string} customDisplayName - Optional custom display name
   * @returns {Object} Stealth address object
   */
  generateStealthAddress(originalAddress, customDisplayName = null) {
    const timestamp = Date.now();
    const displayName = customDisplayName || this.generateDisplayName();
    
    // Create a deterministic but random-looking address based on original address and timestamp
    const stealthSeed = this.hashString(originalAddress + timestamp.toString());
    const stealthAddress = this.generateAddressFromSeed(stealthSeed);
    
    this.currentStealthAddress = {
      address: stealthAddress,
      displayName: displayName,
      originalAddress: originalAddress,
      createdAt: timestamp,
      isActive: true
    };
    
    this.saveStealthAddress();
    return this.currentStealthAddress;
  }

  /**
   * Simple hash function to create deterministic seed
   * @param {string} str - Input string
   * @returns {string} Hash string
   */
  hashString(str) {
    let hash = 0;
    for (let i = 0; i < str.length; i++) {
      const char = str.charCodeAt(i);
      hash = ((hash << 5) - hash) + char;
      hash = hash & hash; // Convert to 32-bit integer
    }
    return Math.abs(hash).toString(36);
  }

  /**
   * Generate a stealth address from seed
   * @param {string} seed - Seed string
   * @returns {string} Generated stealth address
   */
  generateAddressFromSeed(seed) {
    // Create a stealth address that looks like an Ergo address but is clearly fake
    const chars = 'ABCDEFGHJKLMNPQRSTUVWXYZabcdefghijkmnopqrstuvwxyz123456789';
    let result = '9stealth'; // Prefix to indicate stealth address
    
    // Extend seed if needed
    const extendedSeed = (seed + seed + seed).substring(0, 32);
    
    for (let i = 0; i < 32; i++) {
      const charIndex = extendedSeed.charCodeAt(i % extendedSeed.length) % chars.length;
      result += chars[charIndex];
    }
    
    return result;
  }

  /**
   * Load existing stealth address from storage
   * @returns {Object|null} Stealth address object or null
   */
  loadStealthAddress() {
    try {
      const stored = localStorage.getItem(this.storageKey);
      if (stored) {
        this.currentStealthAddress = JSON.parse(stored);
        return this.currentStealthAddress;
      }
    } catch (error) {
      console.error('Error loading stealth address:', error);
    }
    return null;
  }

  /**
   * Save current stealth address to storage
   */
  saveStealthAddress() {
    try {
      if (this.currentStealthAddress) {
        localStorage.setItem(this.storageKey, JSON.stringify(this.currentStealthAddress));
      }
    } catch (error) {
      console.error('Error saving stealth address:', error);
    }
  }

  /**
   * Deactivate current stealth address
   */
  deactivateStealthAddress() {
    this.currentStealthAddress = null;
    try {
      localStorage.removeItem(this.storageKey);
    } catch (error) {
      console.error('Error removing stealth address:', error);
    }
  }

  /**
   * Get current stealth address
   * @returns {Object|null} Current stealth address or null
   */
  getCurrentStealthAddress() {
    return this.currentStealthAddress;
  }

  /**
   * Check if stealth mode is active
   * @returns {boolean} True if stealth mode is active
   */
  isStealthActive() {
    return this.currentStealthAddress !== null && this.currentStealthAddress.isActive;
  }

  /**
   * Get the address age in hours
   * @returns {number} Age in hours
   */
  getAddressAge() {
    if (!this.currentStealthAddress) return 0;
    const ageMs = Date.now() - this.currentStealthAddress.createdAt;
    return Math.floor(ageMs / (1000 * 60 * 60)); // Convert to hours
  }

  /**
   * Get display name for messaging
   * @returns {string} Display name to use in messages
   */
  getDisplayName() {
    return this.currentStealthAddress?.displayName || null;
  }

  /**
   * Validate if a name can be used (basic validation)
   * @param {string} name - Name to validate
   * @returns {boolean} True if name is valid
   */
  validateStealthName(name) {
    if (!name || typeof name !== 'string') return false;
    
    const trimmed = name.trim();
    
    // Cannot start with '9' to avoid confusion with real Ergo addresses
    if (trimmed.startsWith('9')) return false;
    
    // Basic length and character validation
    if (trimmed.length < 3 || trimmed.length > 20) return false;
    
    // Only allow alphanumeric and basic symbols
    if (!/^[a-zA-Z0-9_-]+$/.test(trimmed)) return false;
    
    return true;
  }

  /**
   * Check if current stealth address should be renewed (older than 24 hours)
   * @returns {boolean} True if should be renewed
   */
  shouldRenewAddress() {
    if (!this.currentStealthAddress) return false;
    const ageHours = this.getAddressAge();
    return ageHours >= 24; // Suggest renewal after 24 hours
  }
}

// Create and export singleton instance
export const stealthAddressManager = new StealthAddressManager();

// Export the class for testing or custom instances
export { StealthAddressManager };

export default stealthAddressManager;