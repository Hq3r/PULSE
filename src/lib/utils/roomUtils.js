// roomUtils.js - Updated with room discovery functionality
import { DEFAULT_CHATROOMS } from './chatConstants.js';
import { 
  discoverChatrooms, 
  getCachedDiscoveredRooms,
  clearRoomCache,
  getRoomStatistics,
  searchRooms,
  sortRoomsByActivity 
} from './roomDiscovery.js';

/**
 * Create initial room state
 */
export function createRoomState() {
  return {
    showRoomModal: false,
    modalMode: 'list', // 'list', 'create', 'join', 'private', 'manage', 'info'
    newRoomName: '',
    newRoomDescription: '',
    privateRoomCode: '',
    joinPrivateRoomCode: '',
    currentModalRoom: null,
    showHiddenRooms: false,
    discoveredRooms: [], // Add discovered rooms to state
    lastDiscoveryUpdate: 0,
    isDiscovering: false // Add loading state for discovery
  };
}

/**
 * Get all rooms including discovered ones
 * @param {Array} discoveredRooms - Discovered rooms from blockchain
 * @returns {Array} - Combined array of all rooms
 */
export function getAllRooms(discoveredRooms = []) {
  const allRooms = [...DEFAULT_CHATROOMS];
  
  // Add discovered rooms that aren't already in defaults
  for (const discoveredRoom of discoveredRooms) {
    if (!allRooms.some(room => room.id === discoveredRoom.id)) {
      allRooms.push(discoveredRoom);
    }
  }
  
  return sortRoomsByActivity(allRooms);
}

/**
 * Discover and update rooms from blockchain
 * @param {Object} roomState - Current room state
 * @returns {Promise<Object>} - Updated room state
 */
export async function updateDiscoveredRooms(roomState, forceRefresh = false) {
  if (roomState.isDiscovering && !forceRefresh) {
    console.log('Room discovery already in progress...');
    return roomState;
  }

  try {
    console.log('🔍 Starting room discovery...');
    const updatedState = { ...roomState, isDiscovering: true };
    
    const discoveredRooms = await getCachedDiscoveredRooms(forceRefresh);
    
    return {
      ...updatedState,
      discoveredRooms,
      lastDiscoveryUpdate: Date.now(),
      isDiscovering: false
    };
  } catch (error) {
    console.error('Error updating discovered rooms:', error);
    return {
      ...roomState,
      isDiscovering: false
    };
  }
}

/**
 * Get visible rooms (excluding hidden ones)
 * @param {Array} allRooms - All available rooms
 * @param {Array} hiddenRooms - Array of hidden room IDs
 * @param {boolean} showHiddenRooms - Whether to show hidden rooms
 * @returns {Array} - Filtered rooms
 */
export function getVisibleRooms(allRooms, hiddenRooms = [], showHiddenRooms = false) {
  if (showHiddenRooms) {
    return allRooms;
  }
  
  return allRooms.filter(room => !hiddenRooms.includes(room.id));
}

/**
 * Get rooms organized by categories
 * @param {Array} visibleRooms - Rooms to categorize
 * @returns {Array} - Categories with rooms
 */
export function getRoomCategories(visibleRooms) {
  const categories = [];
  
  // Default rooms
  const defaultRooms = visibleRooms.filter(room => 
    DEFAULT_CHATROOMS.some(dr => dr.id === room.id)
  );
  if (defaultRooms.length > 0) {
    categories.push({
      name: 'Default Rooms',
      rooms: defaultRooms
    });
  }
  
  // Discovered public rooms
  const discoveredRooms = visibleRooms.filter(room => 
    room.isDiscovered && !room.isPrivate && 
    !DEFAULT_CHATROOMS.some(dr => dr.id === room.id)
  );
  if (discoveredRooms.length > 0) {
    categories.push({
      name: 'Discovered Rooms',
      rooms: discoveredRooms
    });
  }
  
  // Custom rooms (created locally but not discovered)
  const customRooms = visibleRooms.filter(room => 
    !room.isDiscovered && !room.isPrivate && 
    !DEFAULT_CHATROOMS.some(dr => dr.id === room.id)
  );
  if (customRooms.length > 0) {
    categories.push({
      name: 'Custom Rooms',
      rooms: customRooms
    });
  }
  
  // Private rooms
  const privateRooms = visibleRooms.filter(room => room.isPrivate);
  if (privateRooms.length > 0) {
    categories.push({
      name: 'Private Rooms',
      rooms: privateRooms
    });
  }
  
  return categories;
}

/**
 * Add a custom public room
 * @param {Object} roomState - Current room state
 * @param {Array} allRooms - Current rooms array
 * @returns {Object} - Object with newRoom and updatedRooms
 */
export function addCustomRoom(roomState, allRooms) {
  const roomName = roomState.newRoomName.trim();
  const roomDescription = roomState.newRoomDescription.trim();
  
  if (!roomName) {
    throw new Error('Room name is required');
  }
  
  // Create room ID from name (kebab-case)
  const roomId = roomName.toLowerCase()
    .replace(/[^a-z0-9\s-]/g, '')
    .replace(/\s+/g, '-')
    .replace(/-+/g, '-')
    .replace(/^-|-$/g, '');
  
  // Check if room already exists
  if (allRooms.some(room => room.id === roomId)) {
    throw new Error('A room with this name already exists');
  }
  
  const newRoom = {
    id: roomId,
    name: roomName,
    description: roomDescription || 'Custom public room',
    isPrivate: false,
    isDiscovered: false
  };
  
  return {
    newRoom,
    updatedRooms: [...allRooms, newRoom]
  };
}

/**
 * Add a private room
 * @param {Object} roomState - Current room state
 * @param {Array} allRooms - Current rooms array
 * @returns {Object} - Object with newRoom and updatedRooms
 */
export function addPrivateRoom(roomState, allRooms) {
  const roomName = roomState.newRoomName.trim();
  let roomCode = roomState.privateRoomCode.trim();
  
  if (!roomName) {
    throw new Error('Room name is required');
  }
  
  // Generate random 10-digit code if not provided
  if (!roomCode) {
    roomCode = Math.floor(1000000000 + Math.random() * 9000000000).toString();
  } else {
    // Validate provided code
    if (!/^\d{10}$/.test(roomCode)) {
      throw new Error('Room code must be exactly 10 digits');
    }
  }
  
  const roomId = `private-${roomCode}`;
  
  // Check if room already exists
  if (allRooms.some(room => room.id === roomId)) {
    throw new Error('A room with this code already exists');
  }
  
  const newRoom = {
    id: roomId,
    name: roomName,
    description: 'Private room',
    isPrivate: true,
    isDiscovered: false,
    code: roomCode
  };
  
  return {
    newRoom,
    updatedRooms: [...allRooms, newRoom]
  };
}

/**
 * Join a private room
 * @param {string} roomCode - 10-digit room code
 * @param {Array} allRooms - Current rooms array
 * @returns {Object} - Object with newRoom, existingRoom, and updatedRooms
 */
export function joinPrivateRoom(roomCode, allRooms) {
  if (!roomCode || !/^\d{10}$/.test(roomCode)) {
    throw new Error('Please enter a valid 10-digit room code');
  }
  
  const roomId = `private-${roomCode}`;
  
  // Check if already joined
  const existingRoom = allRooms.find(room => room.id === roomId);
  if (existingRoom) {
    return {
      newRoom: null,
      existingRoom,
      updatedRooms: allRooms
    };
  }
  
  // Create new private room entry
  const newRoom = {
    id: roomId,
    name: `Private Room ${roomCode}`,
    description: 'Private room',
    isPrivate: true,
    isDiscovered: false,
    code: roomCode
  };
  
  return {
    newRoom,
    existingRoom: null,
    updatedRooms: [...allRooms, newRoom]
  };
}

/**
 * Remove a room (only custom/private rooms)
 * @param {string} roomId - Room ID to remove
 * @param {Array} allRooms - Current rooms array
 * @param {string} selectedChatroom - Currently selected room
 * @param {Function} selectChatroom - Function to select a room
 * @returns {Array} - Updated rooms array
 */
export function removeRoom(roomId, allRooms, selectedChatroom, selectChatroom) {
  // Don't allow removing default rooms
  if (DEFAULT_CHATROOMS.some(room => room.id === roomId)) {
    throw new Error('Cannot remove default rooms');
  }
  
  // Don't allow removing discovered rooms (they exist on blockchain)
  const roomToRemove = allRooms.find(room => room.id === roomId);
  if (roomToRemove?.isDiscovered) {
    throw new Error('Cannot remove discovered rooms');
  }
  
  // If removing currently selected room, switch to general
  if (selectedChatroom === roomId) {
    selectChatroom('general');
  }
  
  return allRooms.filter(room => room.id !== roomId);
}

/**
 * Toggle room visibility (hide/show)
 * @param {string} roomId - Room ID to toggle
 * @param {Array} hiddenRooms - Current hidden rooms array
 * @param {string} selectedChatroom - Currently selected room
 * @param {Function} selectChatroom - Function to select a room
 * @returns {Array} - Updated hidden rooms array
 */
export function toggleRoomVisibility(roomId, hiddenRooms, selectedChatroom, selectChatroom) {
  // Don't allow hiding general room
  if (roomId === 'general') {
    throw new Error('Cannot hide the general room');
  }
  
  const isCurrentlyHidden = hiddenRooms.includes(roomId);
  
  if (isCurrentlyHidden) {
    // Show room
    return hiddenRooms.filter(id => id !== roomId);
  } else {
    // Hide room - if currently selected, switch to general
    if (selectedChatroom === roomId) {
      selectChatroom('general');
    }
    return [...hiddenRooms, roomId];
  }
}

/**
 * Rename a room (only custom rooms)
 * @param {string} roomId - Room ID to rename
 * @param {Array} allRooms - Current rooms array
 * @returns {Array} - Updated rooms array
 */
export function renameRoom(roomId, allRooms) {
  // Don't allow renaming default or discovered rooms
  const room = allRooms.find(r => r.id === roomId);
  if (!room) {
    throw new Error('Room not found');
  }
  
  if (DEFAULT_CHATROOMS.some(r => r.id === roomId)) {
    throw new Error('Cannot rename default rooms');
  }
  
  if (room.isDiscovered) {
    throw new Error('Cannot rename discovered rooms');
  }
  
  const newName = prompt('Enter new room name:', room.name);
  if (newName && newName.trim() && newName.trim() !== room.name) {
    return allRooms.map(r => 
      r.id === roomId 
        ? { ...r, name: newName.trim() }
        : r
    );
  }
  
  return allRooms;
}

/**
 * Open room modal
 * @param {Object} roomState - Current room state
 * @param {string} mode - Modal mode
 * @returns {Object} - Updated room state
 */
export function openRoomModal(roomState, mode) {
  return {
    ...roomState,
    showRoomModal: true,
    modalMode: mode,
    newRoomName: '',
    newRoomDescription: '',
    privateRoomCode: '',
    joinPrivateRoomCode: '',
    currentModalRoom: null
  };
}

/**
 * Close room modal
 * @param {Object} roomState - Current room state
 * @returns {Object} - Updated room state
 */
export function closeRoomModal(roomState) {
  return {
    ...roomState,
    showRoomModal: false,
    modalMode: 'list',
    newRoomName: '',
    newRoomDescription: '',
    privateRoomCode: '',
    joinPrivateRoomCode: '',
    currentModalRoom: null
  };
}

/**
 * Set modal room for info display
 * @param {Object} roomState - Current room state
 * @param {Object} room - Room object to display
 * @returns {Object} - Updated room state
 */
export function setModalRoom(roomState, room) {
  return {
    ...roomState,
    modalMode: 'info',
    currentModalRoom: room
  };
}

/**
 * Copy room code to clipboard
 * @param {string} roomId - Room ID
 */
export function copyRoomCode(roomId) {
  if (roomId.startsWith('private-')) {
    const code = roomId.replace('private-', '');
    navigator.clipboard.writeText(code).then(() => {
      console.log('Room code copied to clipboard');
      // You could add a toast notification here
    });
  }
}

/**
 * Copy room link to clipboard
 * @param {string} roomId - Room ID
 * @param {string} roomName - Room name
 */
export function copyRoomLink(roomId, roomName) {
  const url = `${window.location.origin}${window.location.pathname}?room=${encodeURIComponent(roomId)}`;
  navigator.clipboard.writeText(url).then(() => {
    console.log('Room link copied to clipboard');
    // You could add a toast notification here
  });
}

/**
 * Share room using Web Share API or fallback to clipboard
 * @param {string} roomId - Room ID
 * @param {string} roomName - Room name
 * @param {string} description - Room description
 */
export function shareRoom(roomId, roomName, description) {
  const url = `${window.location.origin}${window.location.pathname}?room=${encodeURIComponent(roomId)}`;
  const text = `Join the "${roomName}" room on ErgoChat: ${url}`;
  
  if (navigator.share) {
    navigator.share({
      title: `Join ${roomName} on ErgoChat`,
      text: description,
      url: url
    }).catch(console.error);
  } else {
    navigator.clipboard.writeText(text).then(() => {
      console.log('Room share text copied to clipboard');
      // You could add a toast notification here
    });
  }
}

/**
 * Get room statistics
 * @param {Array} allRooms - All rooms
 * @param {Array} hiddenRooms - Hidden rooms
 * @returns {Object} - Statistics object
 */
export function getRoomStats(allRooms, hiddenRooms) {
  const stats = getRoomStatistics(allRooms);
  
  return {
    ...stats,
    visible: allRooms.length - hiddenRooms.length,
    hidden: hiddenRooms.length
  };
}

/**
 * Load hidden rooms from localStorage
 * @returns {Array} - Array of hidden room IDs
 */
export function loadHiddenRoomsFromStorage() {
  try {
    const stored = localStorage.getItem('ergochat_hidden_rooms');
    return stored ? JSON.parse(stored) : [];
  } catch (error) {
    console.error('Error loading hidden rooms:', error);
    return [];
  }
}

/**
 * Save hidden rooms to localStorage
 * @param {Array} hiddenRooms - Array of hidden room IDs
 */
export function saveHiddenRoomsToStorage(hiddenRooms) {
  try {
    localStorage.setItem('ergochat_hidden_rooms', JSON.stringify(hiddenRooms));
  } catch (error) {
    console.error('Error saving hidden rooms:', error);
  }
}

/**
 * Search rooms
 * @param {Array} rooms - Rooms to search
 * @param {string} query - Search query
 * @returns {Array} - Filtered rooms
 */
export function searchRoomsWrapper(rooms, query) {
  return searchRooms(rooms, query);
}

/**
 * Check if room discovery should be refreshed
 * @param {Object} roomState - Current room state
 * @param {number} maxAge - Maximum age in milliseconds (default: 5 minutes)
 * @returns {boolean} - True if refresh is needed
 */
export function shouldRefreshDiscovery(roomState, maxAge = 5 * 60 * 1000) {
  const now = Date.now();
  return (now - roomState.lastDiscoveryUpdate) > maxAge;
}

export default {
  createRoomState,
  getAllRooms,
  updateDiscoveredRooms,
  getVisibleRooms,
  getRoomCategories,
  addCustomRoom,
  addPrivateRoom,
  joinPrivateRoom,
  removeRoom,
  toggleRoomVisibility,
  renameRoom,
  openRoomModal,
  closeRoomModal,
  setModalRoom,
  copyRoomCode,
  copyRoomLink,
  shareRoom,
  getRoomStats,
  loadHiddenRoomsFromStorage,
  saveHiddenRoomsToStorage,
  searchRoomsWrapper,
  shouldRefreshDiscovery
};