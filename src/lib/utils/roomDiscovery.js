// roomDiscovery.js - Room discovery utilities for ErgoChat

import { API_BASE, DEMO_CHAT_CONTRACT, DEFAULT_CHATROOMS } from './chatConstants.js';
import { parseBoxToMessage } from './chatUtils.js';

// Cache for discovered rooms to avoid repeated API calls
let roomDiscoveryCache = {
  rooms: new Map(),
  lastUpdate: 0,
  cacheTimeout: 5 * 60 * 1000 // 5 minutes
};

/**
 * Extract room information from a parsed message
 * @param {Object} message - Parsed message object
 * @param {string} currentUserAddress - Current user's wallet address
 * @returns {Object|null} - Room info object or null
 */
function extractRoomInfo(message, currentUserAddress) {
  if (!message || !message.chatroomId) return null;

  const roomId = message.chatroomId;
  
  // Skip default rooms - they're hardcoded
  if (DEFAULT_CHATROOMS.some(room => room.id === roomId)) {
    return null;
  }

  // Determine room type
  const isPrivate = roomId.startsWith('pm') || roomId.startsWith('private-');
  
  // For private rooms, check if user has access
  if (isPrivate) {
    // User has access if:
    // 1. They are the creator (first message sender)
    // 2. They have sent a message in this room
    const userHasAccess = message.sender === currentUserAddress || 
                         checkUserAccessToPrivateRoom(roomId, currentUserAddress);
    
    if (!userHasAccess) {
      return null;
    }
  }

  return {
    id: roomId,
    name: formatRoomName(roomId),
    description: `${isPrivate ? 'Private' : 'Public'} room discovered from blockchain`,
    isPrivate,
    isDiscovered: true,
    createdAt: message.timestamp,
    creator: message.sender
  };
}

/**
 * Format room ID into a display name
 * @param {string} roomId - The room ID
 * @returns {string} - Formatted room name
 */
function formatRoomName(roomId) {
  if (roomId.startsWith('private-')) {
    return roomId.replace('private-', 'Private ');
  }
  if (roomId.startsWith('pm')) {
    return roomId.replace('pm', 'PM ');
  }
  
  // For public rooms, capitalize and format
  return roomId
    .split(/[-_]/)
    .map(word => word.charAt(0).toUpperCase() + word.slice(1))
    .join(' ');
}

/**
 * Check if user has access to a private room by looking at message history
 * @param {string} roomId - Private room ID
 * @param {string} userAddress - User's wallet address
 * @returns {boolean} - True if user has sent messages in this room
 */
function checkUserAccessToPrivateRoom(roomId, userAddress) {
  // This would need to be implemented to check if user has sent messages
  // in this private room by scanning their transaction history
  // For now, we'll return false and let the room be discovered only
  // when the user sends their first message
  return false;
}

/**
 * Discover rooms from blockchain by scanning contract boxes
 * @param {string} currentUserAddress - Current user's wallet address (truncated)
 * @param {number} limit - Maximum number of boxes to scan
 * @returns {Promise<Array>} - Array of discovered room objects
 */
export async function discoverRoomsFromBlockchain(currentUserAddress, limit = 200) {
  try {
    console.log('🔍 Discovering rooms from blockchain...');
    
    // Check cache first
    const now = Date.now();
    if (now - roomDiscoveryCache.lastUpdate < roomDiscoveryCache.cacheTimeout) {
      console.log('Using cached room discovery data');
      return Array.from(roomDiscoveryCache.rooms.values());
    }

    // Fetch boxes from the chat contract
    const response = await fetch(`${API_BASE}/boxes/byAddress/${DEMO_CHAT_CONTRACT}?limit=${limit}`);
    
    if (!response.ok) {
      throw new Error(`API error: ${response.status}`);
    }

    const data = await response.json();
    if (!data.items) {
      throw new Error('Invalid API response');
    }

    console.log(`Found ${data.items.length} boxes to analyze for rooms`);

    const discoveredRooms = new Map();
    const userMessageCounts = new Map();

    // Process each box to extract room information
    for (const box of data.items) {
      const message = parseBoxToMessage(box);
      if (!message) continue;

      // Track user messages for private room access
      const roomId = message.chatroomId;
      if (!userMessageCounts.has(roomId)) {
        userMessageCounts.set(roomId, new Set());
      }
      userMessageCounts.get(roomId).add(message.sender);

      // Extract room info
      const roomInfo = extractRoomInfo(message, currentUserAddress);
      if (!roomInfo) continue;

      // Update room info if we found an earlier message (creator info)
      const existing = discoveredRooms.get(roomInfo.id);
      if (!existing || message.timestamp < existing.createdAt) {
        roomInfo.createdAt = message.timestamp;
        roomInfo.creator = message.sender;
      }

      discoveredRooms.set(roomInfo.id, roomInfo);
    }

    // Filter private rooms based on user access
    const accessibleRooms = [];
    for (const [roomId, roomInfo] of discoveredRooms) {
      if (roomInfo.isPrivate) {
        // Check if current user has sent messages in this room
        const roomUsers = userMessageCounts.get(roomId);
        const userHasAccess = roomUsers && roomUsers.has(currentUserAddress);
        
        if (userHasAccess) {
          accessibleRooms.push(roomInfo);
        }
      } else {
        // Public rooms are always accessible
        accessibleRooms.push(roomInfo);
      }
    }

    // Update cache
    roomDiscoveryCache.rooms.clear();
    accessibleRooms.forEach(room => {
      roomDiscoveryCache.rooms.set(room.id, room);
    });
    roomDiscoveryCache.lastUpdate = now;

    console.log(`Discovered ${accessibleRooms.length} accessible rooms`);
    return accessibleRooms;

  } catch (error) {
    console.error('Error discovering rooms from blockchain:', error);
    return [];
  }
}

/**
 * Get all rooms including default and discovered ones
 * @param {string} currentUserAddress - Current user's wallet address
 * @returns {Promise<Array>} - Combined array of all rooms
 */
export async function getAllRooms(currentUserAddress) {
  const discoveredRooms = await discoverRoomsFromBlockchain(currentUserAddress);
  
  // Combine default rooms with discovered rooms
  const allRooms = [
    ...DEFAULT_CHATROOMS,
    ...discoveredRooms
  ];

  // Remove duplicates (in case a discovered room has the same ID as a default one)
  const uniqueRooms = allRooms.filter((room, index, self) => 
    index === self.findIndex(r => r.id === room.id)
  );

  return uniqueRooms;
}

/**
 * Create a new public room by generating a unique room ID
 * @param {string} roomName - The desired room name
 * @param {string} description - Room description
 * @returns {Object} - New room object
 */
export function createPublicRoom(roomName, description = '') {
  // Generate room ID from name
  const roomId = roomName
    .toLowerCase()
    .replace(/[^a-z0-9]/g, '-')
    .replace(/-+/g, '-')
    .replace(/^-|-$/g, '');

  return {
    id: roomId,
    name: roomName,
    description: description || `Public room: ${roomName}`,
    isPrivate: false,
    isDiscovered: false, // This will become discovered once first message is sent
    createdAt: Math.floor(Date.now() / 1000)
  };
}

/**
 * Create a new private room with a unique code
 * @param {string} roomName - The desired room name
 * @param {string} customCode - Optional custom 10-digit code
 * @returns {Object} - New private room object
 */
export function createPrivateRoom(roomName, customCode = null) {
  // Generate or use custom code
  const code = customCode || generatePrivateRoomCode();
  
  if (customCode && (customCode.length !== 10 || !/^\d+$/.test(customCode))) {
    throw new Error('Custom code must be exactly 10 digits');
  }

  const roomId = `private-${code}`;

  return {
    id: roomId,
    name: roomName,
    description: `Private room: ${roomName}`,
    isPrivate: true,
    isDiscovered: false,
    createdAt: Math.floor(Date.now() / 1000),
    code: code
  };
}

/**
 * Generate a random 10-digit code for private rooms
 * @returns {string} - 10-digit code
 */
function generatePrivateRoomCode() {
  return Math.floor(1000000000 + Math.random() * 9000000000).toString();
}

/**
 * Join a private room using a 10-digit code
 * @param {string} code - The 10-digit private room code
 * @param {Array} existingRooms - Array of existing rooms to check against
 * @returns {Object} - Room object for the private room
 */
export function joinPrivateRoomByCode(code, existingRooms = []) {
  if (!code || code.length !== 10 || !/^\d+$/.test(code)) {
    throw new Error('Invalid room code. Must be exactly 10 digits.');
  }

  const roomId = `private-${code}`;
  
  // Check if room already exists in our list
  const existingRoom = existingRooms.find(room => room.id === roomId);
  if (existingRoom) {
    return existingRoom;
  }

  // Create new room object for joining
  return {
    id: roomId,
    name: `Private Room ${code}`,
    description: `Private room accessed with code: ${code}`,
    isPrivate: true,
    isDiscovered: false,
    createdAt: Math.floor(Date.now() / 1000),
    code: code
  };
}

/**
 * Clear the room discovery cache (useful for force refresh)
 */
export function clearRoomDiscoveryCache() {
  roomDiscoveryCache.rooms.clear();
  roomDiscoveryCache.lastUpdate = 0;
}

/**
 * Check if a room ID represents a private room
 * @param {string} roomId - Room ID to check
 * @returns {boolean} - True if it's a private room
 */
export function isPrivateRoom(roomId) {
  return roomId.startsWith('pm') || roomId.startsWith('private-');
}

/**
 * Extract private room code from room ID
 * @param {string} roomId - Private room ID
 * @returns {string|null} - Room code or null if not a private room
 */
export function extractPrivateRoomCode(roomId) {
  if (roomId.startsWith('private-')) {
    return roomId.replace('private-', '');
  }
  return null;
}

export default {
  discoverRoomsFromBlockchain,
  getAllRooms,
  createPublicRoom,
  createPrivateRoom,
  joinPrivateRoomByCode,
  clearRoomDiscoveryCache,
  isPrivateRoom,
  extractPrivateRoomCode
};