// unreadMessageTracker.js - System for tracking unread messages

/**
 * Unread message tracking utility
 */
export class UnreadMessageTracker {
  constructor() {
    this.unreadCounts = new Map(); // roomId -> count
    this.lastReadTimestamps = new Map(); // roomId -> timestamp
    this.currentRoom = null;
    this.loadFromStorage();
  }

  /**
   * Set the currently active room
   * @param {string} roomId - Room ID
   */
  setCurrentRoom(roomId) {
    if (this.currentRoom !== roomId) {
      // Mark previous room as read when switching
      if (this.currentRoom) {
        this.markRoomAsRead(this.currentRoom);
      }
      this.currentRoom = roomId;
      // Mark new room as read immediately
      this.markRoomAsRead(roomId);
    }
  }

  /**
   * Mark a room as read (reset unread count)
   * @param {string} roomId - Room ID
   */
  markRoomAsRead(roomId) {
    this.unreadCounts.set(roomId, 0);
    this.lastReadTimestamps.set(roomId, Math.floor(Date.now() / 1000));
    this.saveToStorage();
  }

  /**
   * Update unread counts based on new messages
   * @param {Array} allMessages - All messages from all rooms
   * @param {string} currentRoomId - Currently selected room
   */
  updateUnreadCounts(allMessages, currentRoomId) {
    // Group messages by room
    const messagesByRoom = new Map();
    
    for (const message of allMessages) {
      const roomId = message.chatroomId || 'general';
      if (!messagesByRoom.has(roomId)) {
        messagesByRoom.set(roomId, []);
      }
      messagesByRoom.get(roomId).push(message);
    }

    // Calculate unread counts for each room
    for (const [roomId, messages] of messagesByRoom) {
      if (roomId === currentRoomId) {
        // Current room is always read
        this.unreadCounts.set(roomId, 0);
        this.lastReadTimestamps.set(roomId, Math.floor(Date.now() / 1000));
      } else {
        // Count messages newer than last read timestamp
        const lastRead = this.lastReadTimestamps.get(roomId) || 0;
        const unreadMessages = messages.filter(msg => 
          msg.timestamp > lastRead && 
          !msg.pending // Don't count pending messages
        );
        this.unreadCounts.set(roomId, unreadMessages.length);
      }
    }

    this.saveToStorage();
  }

  /**
   * Get unread count for a specific room
   * @param {string} roomId - Room ID
   * @returns {number} - Unread message count
   */
  getUnreadCount(roomId) {
    return this.unreadCounts.get(roomId) || 0;
  }

  /**
   * Get total unread count across all rooms
   * @returns {number} - Total unread messages
   */
  getTotalUnreadCount() {
    let total = 0;
    for (const count of this.unreadCounts.values()) {
      total += count;
    }
    return total;
  }

  /**
   * Process new message and update counts
   * @param {Object} message - New message
   * @param {string} currentRoomId - Currently selected room
   */
  processNewMessage(message, currentRoomId) {
    const roomId = message.chatroomId || 'general';
    
    if (roomId !== currentRoomId && !message.pending) {
      // Increment unread count for other rooms
      const current = this.unreadCounts.get(roomId) || 0;
      this.unreadCounts.set(roomId, current + 1);
      this.saveToStorage();
    }
  }

  /**
   * Save to localStorage
   */
  saveToStorage() {
    try {
      const data = {
        unreadCounts: Object.fromEntries(this.unreadCounts),
        lastReadTimestamps: Object.fromEntries(this.lastReadTimestamps)
      };
      localStorage.setItem('pulse_unread_messages', JSON.stringify(data));
    } catch (error) {
      console.warn('Failed to save unread message data:', error);
    }
  }

  /**
   * Load from localStorage
   */
  loadFromStorage() {
    try {
      const stored = localStorage.getItem('pulse_unread_messages');
      if (stored) {
        const data = JSON.parse(stored);
        this.unreadCounts = new Map(Object.entries(data.unreadCounts || {}));
        this.lastReadTimestamps = new Map(Object.entries(data.lastReadTimestamps || {}));
        
        // Convert string counts to numbers
        for (const [roomId, count] of this.unreadCounts) {
          this.unreadCounts.set(roomId, Number(count) || 0);
        }
        
        // Convert string timestamps to numbers
        for (const [roomId, timestamp] of this.lastReadTimestamps) {
          this.lastReadTimestamps.set(roomId, Number(timestamp) || 0);
        }
      }
    } catch (error) {
      console.warn('Failed to load unread message data:', error);
    }
  }

  /**
   * Clear all unread counts
   */
  clearAll() {
    this.unreadCounts.clear();
    this.lastReadTimestamps.clear();
    this.saveToStorage();
  }

  /**
   * Get rooms with unread messages
   * @returns {Array} - Array of room IDs with unread messages
   */
  getRoomsWithUnreadMessages() {
    const roomsWithUnread = [];
    for (const [roomId, count] of this.unreadCounts) {
      if (count > 0) {
        roomsWithUnread.push(roomId);
      }
    }
    return roomsWithUnread;
  }
}

// Create singleton instance
export const unreadTracker = new UnreadMessageTracker();

// ============= INTEGRATION FUNCTIONS FOR LANDING.SVELTE =============

/**
 * Initialize unread tracking in Landing.svelte
 * @param {string} initialRoom - Initially selected room
 * @returns {Object} - Unread tracking state
 */
export function initializeUnreadTracking(initialRoom) {
  unreadTracker.setCurrentRoom(initialRoom);
  
  return {
    unreadCounts: new Map(),
    totalUnread: 0,
    tracker: unreadTracker
  };
}

/**
 * Update unread counts when messages change
 * @param {Array} messages - All messages
 * @param {string} currentRoom - Current room ID
 * @returns {Object} - Updated unread state
 */
export function updateUnreadCounts(messages, currentRoom) {
  unreadTracker.updateUnreadCounts(messages, currentRoom);
  
  return {
    unreadCounts: new Map(unreadTracker.unreadCounts),
    totalUnread: unreadTracker.getTotalUnreadCount()
  };
}

/**
 * Handle room change and mark as read
 * @param {string} newRoomId - New room ID
 * @param {string} oldRoomId - Previous room ID
 */
export function handleRoomChange(newRoomId, oldRoomId) {
  if (oldRoomId) {
    unreadTracker.markRoomAsRead(oldRoomId);
  }
  unreadTracker.setCurrentRoom(newRoomId);
}

/**
 * Process optimistic message
 * @param {Object} optimisticMessage - New optimistic message
 * @param {string} currentRoom - Current room ID
 */
export function processOptimisticMessage(optimisticMessage, currentRoom) {
  unreadTracker.processNewMessage(optimisticMessage, currentRoom);
}

// ============= UTILITY FUNCTIONS =============

/**
 * Format unread count for display
 * @param {number} count - Unread count
 * @returns {string} - Formatted count (e.g., "5", "99+")
 */
export function formatUnreadCount(count) {
  if (count <= 0) return '';
  if (count > 99) return '99+';
  return count.toString();
}

/**
 * Get unread count for a specific room
 * @param {string} roomId - Room ID
 * @returns {number} - Unread count
 */
export function getUnreadCountForRoom(roomId) {
  return unreadTracker.getUnreadCount(roomId);
}

/**
 * Check if room has unread messages
 * @param {string} roomId - Room ID
 * @returns {boolean} - True if has unread messages
 */
export function hasUnreadMessages(roomId) {
  return unreadTracker.getUnreadCount(roomId) > 0;
}

/**
 * Get badge CSS class based on unread count
 * @param {number} count - Unread count
 * @returns {string} - CSS class name
 */
export function getUnreadBadgeClass(count) {
  if (count <= 0) return 'unread-badge hidden';
  if (count < 10) return 'unread-badge';
  if (count < 100) return 'unread-badge medium';
  return 'unread-badge large';
}

export default {
  UnreadMessageTracker,
  unreadTracker,
  initializeUnreadTracking,
  updateUnreadCounts,
  handleRoomChange,
  processOptimisticMessage,
  formatUnreadCount,
  getUnreadCountForRoom,
  hasUnreadMessages,
  getUnreadBadgeClass
};