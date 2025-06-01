// roomDiscovery.js - Room discovery functionality for ErgoChat
import {
  DEMO_CHAT_CONTRACT,
  API_BASE,
  DEFAULT_CHATROOMS
} from './chatConstants.js';
import { parseBoxToMessage } from './chatUtils.js';

/**
 * Discover all available chatrooms from the blockchain
 * @returns {Promise<Array>} - Array of discovered room objects
 */
export async function discoverChatrooms() {
  try {
    console.log('🔍 Discovering chatrooms from blockchain...');
    
    // Fetch all boxes from the chat contract
    const response = await fetch(`${API_BASE}/boxes/unspent/byAddress/${DEMO_CHAT_CONTRACT}?limit=500`);
    
    if (!response.ok) {
      console.warn('Failed to fetch boxes for room discovery:', response.status);
      return DEFAULT_CHATROOMS;
    }

    const data = await response.json();
    const boxes = data.items || [];
    
    console.log(`Found ${boxes.length} boxes to analyze for rooms`);

    // Extract unique room IDs from R7 register
    const discoveredRoomIds = new Set();
    const roomSamples = new Map(); // Store sample messages for room descriptions
    
    for (const box of boxes) {
      try {
        const message = parseBoxToMessage(box);
        if (message && message.chatroomId) {
          discoveredRoomIds.add(message.chatroomId);
          
          // Store a sample message for each room (for potential description generation)
          if (!roomSamples.has(message.chatroomId)) {
            roomSamples.set(message.chatroomId, message);
          }
        }
      } catch (error) {
        console.warn('Error parsing box for room discovery:', error);
        // Continue with other boxes
      }
    }

    console.log('Discovered room IDs:', Array.from(discoveredRoomIds));

    // Convert discovered room IDs to room objects
    const discoveredRooms = [];
    
    for (const roomId of discoveredRoomIds) {
      // Skip if it's already a default room
      if (DEFAULT_CHATROOMS.some(room => room.id === roomId)) {
        continue;
      }

      // Create room object
      const room = createRoomFromId(roomId, roomSamples.get(roomId));
      if (room) {
        discoveredRooms.push(room);
      }
    }

    console.log(`✅ Discovered ${discoveredRooms.length} new rooms:`, discoveredRooms.map(r => r.name));
    
    return discoveredRooms;
    
  } catch (error) {
    console.error('Error discovering chatrooms:', error);
    return [];
  }
}

/**
 * Create a room object from a room ID
 * @param {string} roomId - The room identifier
 * @param {Object} sampleMessage - Sample message from the room (optional)
 * @returns {Object|null} - Room object or null if invalid
 */
function createRoomFromId(roomId, sampleMessage = null) {
  if (!roomId || typeof roomId !== 'string') {
    return null;
  }

  // Handle private rooms (format: private-1234567890)
  if (roomId.startsWith('private-')) {
    const code = roomId.replace('private-', '');
    if (code.length === 10 && /^\d+$/.test(code)) {
      return {
        id: roomId,
        name: `Private Room ${code}`,
        description: 'Private chat room',
        isPrivate: true,
        isDiscovered: true,
        code: code
      };
    }
  }

  // Handle custom public rooms
  const roomName = formatRoomName(roomId);
  const description = generateRoomDescription(roomId, sampleMessage);

  return {
    id: roomId,
    name: roomName,
    description: description,
    isPrivate: false,
    isDiscovered: true
  };
}

/**
 * Format room ID into a human-readable name
 * @param {string} roomId - The room identifier
 * @returns {string} - Formatted room name
 */
function formatRoomName(roomId) {
  if (!roomId) return 'Unknown Room';

  // Handle special formatting patterns
  if (roomId.includes('-')) {
    // Convert kebab-case to title case: "custom-testing-room" -> "Custom Testing Room"
    return roomId
      .split('-')
      .map(word => word.charAt(0).toUpperCase() + word.slice(1))
      .join(' ');
  }

  // Handle camelCase: "testingRoom" -> "Testing Room"
  if (/[a-z][A-Z]/.test(roomId)) {
    return roomId
      .replace(/([a-z])([A-Z])/g, '$1 $2')
      .replace(/^./, str => str.toUpperCase());
  }

  // Handle single words: "testing" -> "Testing"
  return roomId.charAt(0).toUpperCase() + roomId.slice(1);
}

/**
 * Generate a description for a discovered room
 * @param {string} roomId - The room identifier
 * @param {Object} sampleMessage - Sample message from the room (optional)
 * @returns {string} - Room description
 */
function generateRoomDescription(roomId, sampleMessage = null) {
  // Try to infer purpose from room name
  const lowerRoomId = roomId.toLowerCase();
  
  if (lowerRoomId.includes('test')) {
    return 'Testing and development discussions';
  }
  if (lowerRoomId.includes('trade') || lowerRoomId.includes('market')) {
    return 'Trading and market discussions';
  }
  if (lowerRoomId.includes('dev') || lowerRoomId.includes('development')) {
    return 'Development and technical discussions';
  }
  if (lowerRoomId.includes('game') || lowerRoomId.includes('gaming')) {
    return 'Gaming related discussions';
  }
  if (lowerRoomId.includes('nft') || lowerRoomId.includes('art')) {
    return 'NFT and art discussions';
  }
  if (lowerRoomId.includes('defi') || lowerRoomId.includes('finance')) {
    return 'DeFi and finance discussions';
  }
  
  // Generic description
  return 'Community discussion room';
}

/**
 * Get room statistics from discovered rooms
 * @param {Array} allRooms - All available rooms
 * @returns {Object} - Statistics object
 */
export function getRoomStatistics(allRooms) {
  const stats = {
    total: allRooms.length,
    default: 0,
    custom: 0,
    private: 0,
    discovered: 0
  };

  for (const room of allRooms) {
    if (DEFAULT_CHATROOMS.some(dr => dr.id === room.id)) {
      stats.default++;
    } else if (room.isPrivate) {
      stats.private++;
    } else if (room.isDiscovered) {
      stats.discovered++;
    } else {
      stats.custom++;
    }
  }

  return stats;
}

/**
 * Check if a room ID is valid for creation
 * @param {string} roomId - Room ID to validate
 * @returns {boolean} - True if valid
 */
export function isValidRoomId(roomId) {
  if (!roomId || typeof roomId !== 'string') {
    return false;
  }

  // Check length (reasonable limits)
  if (roomId.length < 3 || roomId.length > 50) {
    return false;
  }

  // Check for valid characters (alphanumeric, hyphens, underscores)
  if (!/^[a-zA-Z0-9\-_]+$/.test(roomId)) {
    return false;
  }

  // Check that it doesn't start or end with special characters
  if (/^[-_]|[-_]$/.test(roomId)) {
    return false;
  }

  return true;
}

/**
 * Search for rooms by name or description
 * @param {Array} rooms - Array of room objects
 * @param {string} query - Search query
 * @returns {Array} - Filtered rooms
 */
export function searchRooms(rooms, query) {
  if (!query || !query.trim()) {
    return rooms;
  }

  const searchTerm = query.toLowerCase().trim();
  
  return rooms.filter(room => {
    const nameMatch = room.name.toLowerCase().includes(searchTerm);
    const descMatch = room.description?.toLowerCase().includes(searchTerm);
    const idMatch = room.id.toLowerCase().includes(searchTerm);
    
    return nameMatch || descMatch || idMatch;
  });
}

/**
 * Sort rooms by activity level (based on recent message count)
 * This would need to be enhanced with actual message counting
 * @param {Array} rooms - Array of room objects
 * @returns {Array} - Sorted rooms
 */
export function sortRoomsByActivity(rooms) {
  // For now, sort by type and name
  // In a full implementation, you'd count recent messages per room
  
  return [...rooms].sort((a, b) => {
    // Default rooms first
    const aIsDefault = DEFAULT_CHATROOMS.some(dr => dr.id === a.id);
    const bIsDefault = DEFAULT_CHATROOMS.some(dr => dr.id === b.id);
    
    if (aIsDefault && !bIsDefault) return -1;
    if (!aIsDefault && bIsDefault) return 1;
    
    // Then by room name
    return a.name.localeCompare(b.name);
  });
}

/**
 * Cache for discovered rooms (in-memory)
 */
const roomCache = {
  rooms: [],
  lastUpdate: 0,
  cacheTimeout: 5 * 60 * 1000 // 5 minutes
};

/**
 * Get rooms with caching
 * @param {boolean} forceRefresh - Force refresh of cache
 * @returns {Promise<Array>} - Cached or fresh room data
 */
export async function getCachedDiscoveredRooms(forceRefresh = false) {
  const now = Date.now();
  
  // Check if cache is valid
  if (!forceRefresh && 
      roomCache.rooms.length > 0 && 
      (now - roomCache.lastUpdate) < roomCache.cacheTimeout) {
    console.log('📦 Using cached room data');
    return roomCache.rooms;
  }

  // Refresh cache
  console.log('🔄 Refreshing room cache...');
  try {
    const discoveredRooms = await discoverChatrooms();
    roomCache.rooms = discoveredRooms;
    roomCache.lastUpdate = now;
    
    return discoveredRooms;
  } catch (error) {
    console.error('Error refreshing room cache:', error);
    // Return cached data even if refresh failed
    return roomCache.rooms;
  }
}

/**
 * Clear room cache
 */
export function clearRoomCache() {
  roomCache.rooms = [];
  roomCache.lastUpdate = 0;
}

export default {
  discoverChatrooms,
  createRoomFromId,
  formatRoomName,
  generateRoomDescription,
  getRoomStatistics,
  isValidRoomId,
  searchRooms,
  sortRoomsByActivity,
  getCachedDiscoveredRooms,
  clearRoomCache
};