<!-- AdminDashboard.svelte -->
<script lang="ts">
    import { onMount, createEventDispatcher } from 'svelte';
    import { connected_wallet_address } from '$lib/store/store';
    import { showCustomToast } from '$lib/utils/utils';
    import { fade, slide } from 'svelte/transition';
    
    const dispatch = createEventDispatcher();
    
    // Props
    export let chatContract: string;
    export let chatrooms: any[] = [];
    export let isVisible: boolean = false;
    
    // State variables
    let discoveredRooms: any[] = [];
    let allRooms: any[] = [];
    let isLoading: boolean = false;
    let loadingMessage: string = '';
    let activeTab: string = 'all'; // 'all', 'public', 'private'
    
    // Check if the current wallet is the admin wallet
    $: isAdminWallet = $connected_wallet_address === '9gvDVNy1XvDeFoi4ZHn5v6u3tFRECMXGKbwuHbijJu6Z2hLQTQz';
    
    // Filter rooms based on active tab
    $: filteredRooms = allRooms.filter(room => {
      if (activeTab === 'all') return true;
      if (activeTab === 'public') return !room.isPrivate;
      if (activeTab === 'private') return room.isPrivate;
      return true;
    });
    
    // Sort the filtered rooms by message count (most active first)
    $: sortedRooms = filteredRooms.sort((a, b) => (b.messageCount || 0) - (a.messageCount || 0));
    
    onMount(() => {
      // Initialize if visible
      if (isVisible && isAdminWallet) {
        refreshRooms();
      }
    });
    
    // Close the dashboard
    function closeDashboard() {
      dispatch('close');
    }
    
    // Set the active tab
    function setActiveTab(tab: string) {
      activeTab = tab;
    }
    
    // Select a room and notify the parent component
    function selectRoom(roomId: string) {
      dispatch('selectRoom', { roomId });
    }
    
    // Decode ErgoHex string - imported from your utils
    function decodeErgoHex(hex: string): string {
      try {
        if (!hex || typeof hex !== 'string') {
          return String(hex);
        }
        
        if (/^[0-9A-Fa-f]+$/.test(hex)) {
          if (hex.startsWith('0e')) {
            hex = hex.substring(4);
            
            const bytes = [];
            for (let i = 0; i < hex.length; i += 2) {
              bytes.push(parseInt(hex.substring(i, i + 2), 16));
            }
            
            const result = new TextDecoder('utf-8').decode(new Uint8Array(bytes));
            return result;
          }
        }
        
        return hex;
      } catch (e) {
        return String(hex);
      }
    }
    
    // Format discovered room name
    function formatDiscoveredRoomName(id: string): string {
      return id.charAt(0).toUpperCase() + id.slice(1).replace(/-/g, ' ');
    }
    
    // Check if a string is an encrypted room code
    function isEncryptedRoomCode(code: string): boolean {
      return code && typeof code === 'string' && code.startsWith("enc-");
    }
    
    // Refresh the room list
    async function refreshRooms() {
      if (!isAdminWallet) {
        showCustomToast("Only admin can use this dashboard", 3000, 'error');
        closeDashboard();
        return;
      }
      
      isLoading = true;
      loadingMessage = 'Discovering chatrooms...';
      
      try {
        // Get a larger number of boxes to ensure we find most chatrooms
        const response = await fetch(`https://api.ergoplatform.com/api/v1/boxes/byAddress/${chatContract}?limit=500`);
        
        if (!response.ok) {
          throw new Error(`API error: ${response.status} ${response.statusText}`);
        }
        
        const data = await response.json();
        const discoveredRoomsMap = new Map();
        
        // Track different types of rooms
        let publicRoomsCount = 0;
        let privateRoomsCount = 0;
        
        // Process all boxes to find unique chatroom IDs
        for (const box of data.items) {
          if (box.additionalRegisters && box.additionalRegisters.R7) {
            try {
              // Extract chatroom ID from register
              let chatroomRaw = '';
              if (typeof box.additionalRegisters.R7 === 'string') {
                chatroomRaw = box.additionalRegisters.R7;
              } else if (box.additionalRegisters.R7.serializedValue) {
                chatroomRaw = box.additionalRegisters.R7.serializedValue;
              } else if (box.additionalRegisters.R7.renderedValue) {
                chatroomRaw = box.additionalRegisters.R7.renderedValue;
              }
              
              const chatroomId = decodeErgoHex(chatroomRaw);
              
              // Skip if the room ID is invalid
              if (!chatroomId) continue;
              
              // Handle private rooms specially
              if (chatroomId.startsWith('private-')) {
                privateRoomsCount++;
                
                // Only admin can see private rooms directly
                if (isAdminWallet) {
                  const privatePart = chatroomId.substring(8); // Remove 'private-'
                  const adminRoomId = 'private-' + privatePart;
                  
                  if (!discoveredRoomsMap.has(adminRoomId)) {
                    const roomName = `Private Room ${privatePart.substring(0, 8)}`;
                    
                    discoveredRoomsMap.set(adminRoomId, {
                      id: adminRoomId,
                      name: roomName,
                      description: 'Admin access to private room',
                      isPrivate: true,
                      blockchainRoomId: chatroomId,
                      isAdminRoom: true,
                      messageCount: 1
                    });
                  } else {
                    // Update message count
                    const room = discoveredRoomsMap.get(adminRoomId);
                    room.messageCount = (room.messageCount || 0) + 1;
                  }
                }
              } 
              // Handle public rooms
              else if (!['general', 'trading', 'development', 'governance'].includes(chatroomId) &&
                      !discoveredRoomsMap.has(chatroomId)) {
                publicRoomsCount++;
                
                // Add to discovered rooms with default info
                discoveredRoomsMap.set(chatroomId, {
                  id: chatroomId,
                  name: formatDiscoveredRoomName(chatroomId),
                  description: `Discovered room: ${chatroomId}`,
                  isDiscovered: true,
                  messageCount: 1
                });
              } else if (discoveredRoomsMap.has(chatroomId)) {
                // Update message count for existing room
                const room = discoveredRoomsMap.get(chatroomId);
                room.messageCount = (room.messageCount || 0) + 1;
              }
              
            } catch (e) {
              console.error("Error processing chatroom ID:", e);
            }
          }
        }
        
        // Default rooms
        const defaultRooms = [
          { id: 'general', name: 'General', description: 'Main discussion channel', messageCount: 0 },
          { id: 'trading', name: 'Trading', description: 'Discuss trading and prices', messageCount: 0 },
          { id: 'development', name: 'Development', description: 'Ergo platform development', messageCount: 0 },
          { id: 'governance', name: 'Governance', description: 'Governance and proposals', messageCount: 0 }
        ];
        
        // Add existing rooms and update with message counts
        for (const room of chatrooms) {
          // Skip if already in discovered rooms
          if (discoveredRoomsMap.has(room.id)) continue;
          
          // Get message count from localStorage
          let messageCount = 0;
          try {
            const storedMessages = localStorage.getItem(`ergoChat_messages_${room.id}`);
            if (storedMessages) {
              messageCount = JSON.parse(storedMessages).length;
            }
          } catch (e) {
            console.error("Error getting message count:", e);
          }
          
          discoveredRoomsMap.set(room.id, {
            ...room,
            messageCount
          });
        }
        
        // Update default rooms with message counts
        for (const defaultRoom of defaultRooms) {
          if (!discoveredRoomsMap.has(defaultRoom.id)) {
            let messageCount = 0;
            try {
              const storedMessages = localStorage.getItem(`ergoChat_messages_${defaultRoom.id}`);
              if (storedMessages) {
                messageCount = JSON.parse(storedMessages).length;
              }
            } catch (e) {
              console.error("Error getting message count:", e);
            }
            
            discoveredRoomsMap.set(defaultRoom.id, {
              ...defaultRoom,
              messageCount
            });
          }
        }
        
        // Convert to array
        discoveredRooms = Array.from(discoveredRoomsMap.values());
        
        // Update allRooms
        allRooms = discoveredRooms;
        
        showCustomToast(`Discovered ${discoveredRoomsMap.size} total rooms (${publicRoomsCount} public, ${privateRoomsCount} private)`, 3000, 'info');
      } catch (error) {
        console.error("Error discovering chatrooms:", error);
        showCustomToast("Error discovering rooms: " + error.message, 3000, 'error');
      } finally {
        isLoading = false;
      }
    }
    
    // Load all messages from all rooms
    async function loadAllMessages() {
      if (!isAdminWallet) {
        showCustomToast("Only admin can use this dashboard", 3000, 'error');
        return;
      }
      
      isLoading = true;
      loadingMessage = 'Loading all messages...';
      
      try {
        // First ensure we have all rooms
        if (allRooms.length === 0) {
          await refreshRooms();
        }
        
        showCustomToast("Loading all messages from all rooms...", 3000, 'info');
        
        // Get a large number of boxes from the contract
        const response = await fetch(`https://api.ergoplatform.com/api/v1/boxes/byAddress/${chatContract}?limit=1000`);
        
        if (!response.ok) {
          throw new Error(`API error: ${response.status} ${response.statusText}`);
        }
        
        const data = await response.json();
        
        // Initialize result object to store messages by room
        const messagesByRoom = {};
        let totalMessagesProcessed = 0;
        
        // Process all boxes to extract messages
        for (const box of data.items) {
          if (!box.additionalRegisters || 
              !box.additionalRegisters.R4 || 
              !box.additionalRegisters.R5 || 
              !box.additionalRegisters.R6 ||
              !box.additionalRegisters.R7) {
            continue;
          }
          
          try {
            // Extract message data
            let sender = "", content = "", timestamp = 0, chatroomId = "general";
            
            // Extract sender (R4)
            if (typeof box.additionalRegisters.R4 === 'string') {
              sender = decodeErgoHex(box.additionalRegisters.R4);
            } else if (box.additionalRegisters.R4.serializedValue) {
              sender = decodeErgoHex(box.additionalRegisters.R4.serializedValue);
            } else if (box.additionalRegisters.R4.renderedValue) {
              sender = decodeErgoHex(box.additionalRegisters.R4.renderedValue);
            }
            
            // Extract content (R5)
            let contentRaw = "";
            if (typeof box.additionalRegisters.R5 === 'string') {
              contentRaw = box.additionalRegisters.R5;
            } else if (box.additionalRegisters.R5.serializedValue) {
              contentRaw = box.additionalRegisters.R5.serializedValue;
            } else if (box.additionalRegisters.R5.renderedValue) {
              contentRaw = box.additionalRegisters.R5.renderedValue;
            }
            content = decodeErgoHex(contentRaw);
            
            // Extract timestamp (R6)
            if (typeof box.additionalRegisters.R6 === 'number') {
              timestamp = box.additionalRegisters.R6;
            } else if (typeof box.additionalRegisters.R6 === 'string') {
              timestamp = parseInt(box.additionalRegisters.R6);
            } else if (box.additionalRegisters.R6.renderedValue) {
              timestamp = parseInt(box.additionalRegisters.R6.renderedValue);
            } else if (box.additionalRegisters.R6.serializedValue) {
              timestamp = parseInt(box.additionalRegisters.R6.serializedValue);
            }
            
            // Extract chatroom ID (R7)
            let chatroomRaw = '';
            if (typeof box.additionalRegisters.R7 === 'string') {
              chatroomRaw = box.additionalRegisters.R7;
            } else if (box.additionalRegisters.R7.serializedValue) {
              chatroomRaw = box.additionalRegisters.R7.serializedValue;
            } else if (box.additionalRegisters.R7.renderedValue) {
              chatroomRaw = box.additionalRegisters.R7.renderedValue;
            }
            chatroomId = decodeErgoHex(chatroomRaw) || "general";
            
            // For private rooms, use the admin roomId
            if (chatroomId.startsWith('private-')) {
              const privatePart = chatroomId.substring(8);
              chatroomId = 'private-' + privatePart;
            }
            
            // Extract parent ID (R8) if available
            let parentId = null;
            if (box.additionalRegisters.R8) {
              if (typeof box.additionalRegisters.R8 === 'string') {
                parentId = decodeErgoHex(box.additionalRegisters.R8);
              } else if (box.additionalRegisters.R8.serializedValue) {
                parentId = decodeErgoHex(box.additionalRegisters.R8.serializedValue);
              } else if (box.additionalRegisters.R8.renderedValue) {
                parentId = decodeErgoHex(box.additionalRegisters.R8.renderedValue);
              }
              
              // If the parent ID is empty, set to null
              if (!parentId || parentId.length === 0) {
                parentId = null;
              }
            }
            
            // Create message object
            const message = {
              id: box.boxId || box.transactionId,
              sender,
              content,
              timestamp,
              chatroomId,
              parentId,
              pending: false
            };
            
            // Add to the appropriate room's message list
            if (!messagesByRoom[chatroomId]) {
              messagesByRoom[chatroomId] = [];
            }
            messagesByRoom[chatroomId].push(message);
            totalMessagesProcessed++;
            
          } catch (e) {
            console.error("Error processing message:", e);
          }
        }
        
        // Sort messages in each room by timestamp
        for (const roomId in messagesByRoom) {
          messagesByRoom[roomId].sort((a, b) => a.timestamp - b.timestamp);
          
          // Save to localStorage
          localStorage.setItem(`ergoChat_messages_${roomId}`, JSON.stringify(messagesByRoom[roomId].slice(-1000)));
        }
        
        // Update room message counts
        allRooms = allRooms.map(room => {
          const messages = messagesByRoom[room.id] || [];
          return {
            ...room,
            messageCount: messages.length
          };
        });
        
        // Show success message
        showCustomToast(`Loaded ${totalMessagesProcessed} messages from ${Object.keys(messagesByRoom).length} rooms`, 3000, 'success');
        
        // Notify parent that rooms and messages have been loaded
        dispatch('roomsUpdated', { rooms: allRooms, messagesByRoom });
        
      } catch (error) {
        console.error("Error loading all chatroom messages:", error);
        showCustomToast("Error loading messages: " + error.message, 3000, 'error');
      } finally {
        isLoading = false;
      }
    }
    
    // Function to add new rooms to the chatrooms list
    function addRoomsToChatrooms() {
      const newRooms = allRooms.filter(room => 
        !chatrooms.some(existingRoom => existingRoom.id === room.id)
      );
      
      if (newRooms.length > 0) {
        dispatch('addRooms', { rooms: newRooms });
        showCustomToast(`Added ${newRooms.length} new rooms to chatrooms list`, 3000, 'success');
      } else {
        showCustomToast("No new rooms to add", 3000, 'info');
      }
    }
  </script>
  
  <!-- Dashboard Modal -->
  {#if isVisible}
  <div class="dashboard-container" transition:fade={{ duration: 200 }}>
    <div class="dashboard-modal" transition:slide={{ duration: 300, y: -20 }}>
      <!-- Header -->
      <div class="dashboard-header">
        <h2>Admin Dashboard</h2>
        <button class="close-btn" on:click={closeDashboard}>
          <i class="fa-solid fa-times"></i>
        </button>
      </div>
      
      <!-- Dashboard Content -->
      <div class="dashboard-content">
        {#if !isAdminWallet}
          <div class="auth-error">
            <i class="fa-solid fa-lock"></i>
            <p>Admin access required</p>
            <p class="auth-error-details">Only the admin wallet can access this dashboard</p>
          </div>
        {:else}
          <!-- Action Buttons -->
          <div class="action-buttons">
            <button class="action-btn refresh-btn" on:click={refreshRooms} disabled={isLoading}>
              <i class="fa-solid fa-sync"></i>
              Refresh Rooms
            </button>
            <button class="action-btn load-btn" on:click={loadAllMessages} disabled={isLoading}>
              <i class="fa-solid fa-download"></i>
              Load All Messages
            </button>
            <button class="action-btn add-btn" on:click={addRoomsToChatrooms} disabled={isLoading}>
              <i class="fa-solid fa-plus"></i>
              Add All to Chatrooms
            </button>
          </div>
          
          <!-- Loading Indicator -->
          {#if isLoading}
            <div class="loading-indicator">
              <div class="spinner"></div>
              <p>{loadingMessage}</p>
            </div>
          {:else}
            <!-- Room Tabs -->
            <div class="room-tabs">
              <button 
                class="tab-btn {activeTab === 'all' ? 'active' : ''}" 
                on:click={() => setActiveTab('all')}
              >
                All Rooms ({allRooms.length})
              </button>
              <button 
                class="tab-btn {activeTab === 'public' ? 'active' : ''}" 
                on:click={() => setActiveTab('public')}
              >
                Public Rooms ({allRooms.filter(r => !r.isPrivate).length})
              </button>
              <button 
                class="tab-btn {activeTab === 'private' ? 'active' : ''}" 
                on:click={() => setActiveTab('private')}
              >
                Private Rooms ({allRooms.filter(r => r.isPrivate).length})
              </button>
            </div>
            
            <!-- Room List -->
            <div class="room-list">
              <table>
                <thead>
                  <tr>
                    <th>Room Name</th>
                    <th>Type</th>
                    <th>Messages</th>
                    <th>Actions</th>
                  </tr>
                </thead>
                <tbody>
                  {#if sortedRooms.length === 0}
                    <tr>
                      <td colspan="4" class="empty-message">No rooms found. Click "Refresh Rooms" to discover rooms.</td>
                    </tr>
                  {:else}
                    {#each sortedRooms as room}
                      <tr class={room.isPrivate ? 'private-room' : ''}>
                        <td class="room-name">
                          <span class="room-icon">{room.isPrivate ? '🔒' : '#'}</span>
                          {room.name}
                          {#if room.isAdminRoom}
                            <span class="admin-badge">Admin</span>
                          {/if}
                        </td>
                        <td>
                          {#if room.isPrivate}
                            <span class="room-type private">Private</span>
                          {:else if room.isDiscovered}
                            <span class="room-type discovered">Discovered</span>
                          {:else}
                            <span class="room-type default">Default</span>
                          {/if}
                        </td>
                        <td class="message-count">{room.messageCount || 0}</td>
                        <td class="actions">
                          <button class="view-btn" on:click={() => selectRoom(room.id)}>
                            <i class="fa-solid fa-eye"></i>
                            View
                          </button>
                        </td>
                      </tr>
                    {/each}
                  {/if}
                </tbody>
              </table>
            </div>
            
            <!-- Stats Summary -->
            <div class="stats-summary">
              <div class="stat-item">
                <span class="stat-label">Total Rooms:</span>
                <span class="stat-value">{allRooms.length}</span>
              </div>
              <div class="stat-item">
                <span class="stat-label">Public Rooms:</span>
                <span class="stat-value">{allRooms.filter(r => !r.isPrivate).length}</span>
              </div>
              <div class="stat-item">
                <span class="stat-label">Private Rooms:</span>
                <span class="stat-value">{allRooms.filter(r => r.isPrivate).length}</span>
              </div>
              <div class="stat-item">
                <span class="stat-label">Total Messages:</span>
                <span class="stat-value">{allRooms.reduce((sum, room) => sum + (room.messageCount || 0), 0)}</span>
              </div>
            </div>
          {/if}
        {/if}
      </div>
    </div>
  </div>
  {/if}
  
  <style>
    .dashboard-container {
      position: fixed;
      top: 0;
      left: 0;
      right: 0;
      bottom: 0;
      background-color: rgba(0, 0, 0, 0.7);
      display: flex;
      align-items: center;
      justify-content: center;
      z-index: 1000;
    }
    
    .dashboard-modal {
      background-color: #1E1E1E;
      border-radius: 8px;
      width: 90%;
      max-width: 1000px;
      max-height: 90vh;
      overflow: hidden;
      display: flex;
      flex-direction: column;
      box-shadow: 0 5px 25px rgba(0, 0, 0, 0.5);
    }
    
    .dashboard-header {
      padding: 1rem;
      display: flex;
      justify-content: space-between;
      align-items: center;
      background-color: #262626;
      border-bottom: 1px solid rgba(255, 255, 255, 0.1);
    }
    
    .dashboard-header h2 {
      margin: 0;
      color: #FF5500;
      font-size: 1.5rem;
    }
    
    .close-btn {
      background: none;
      border: none;
      color: #999;
      cursor: pointer;
      width: 2rem;
      height: 2rem;
      border-radius: 50%;
      display: flex;
      align-items: center;
      justify-content: center;
      transition: all 0.2s ease;
    }
    
    .close-btn:hover {
      background-color: rgba(255, 255, 255, 0.1);
      color: white;
    }
    
    .dashboard-content {
      flex: 1;
      padding: 1rem;
      overflow-y: auto;
    }
    
    .action-buttons {
      display: flex;
      gap: 1rem;
      margin-bottom: 1.5rem;
      flex-wrap: wrap;
    }
    
    .action-btn {
      background-color: rgba(255, 85, 0, 0.2);
      color: #FF5500;
      border: 1px solid rgba(255, 85, 0, 0.3);
      border-radius: 4px;
      padding: 0.5rem 1rem;
      cursor: pointer;
      display: flex;
      align-items: center;
      gap: 0.5rem;
      transition: all 0.2s ease;
    }
    
    .action-btn:hover:not(:disabled) {
      background-color: rgba(255, 85, 0, 0.3);
    }
    
    .action-btn:disabled {
      opacity: 0.5;
      cursor: not-allowed;
    }
    
    .room-tabs {
      display: flex;
      gap: 0.5rem;
      margin-bottom: 1rem;
      border-bottom: 1px solid rgba(255, 255, 255, 0.1);
      padding-bottom: 0.5rem;
    }
    
    .tab-btn {
      background: none;
      border: none;
      color: #CCC;
      cursor: pointer;
      padding: 0.5rem 1rem;
      border-radius: 4px;
      transition: all 0.2s ease;
    }
    
    .tab-btn.active {
      background-color: rgba(255, 85, 0, 0.2);
      color: #FF5500;
    }
    
    .tab-btn:hover:not(.active) {
      background-color: rgba(255, 255, 255, 0.05);
    }
    
    .room-list {
      margin-bottom: 1.5rem;
      max-height: 400px;
      overflow-y: auto;
      border: 1px solid rgba(255, 255, 255, 0.1);
      border-radius: 4px;
    }
    
    table {
      width: 100%;
      border-collapse: collapse;
    }
    
    thead {
      background-color: #262626;
      position: sticky;
      top: 0;
      z-index: 10;
    }
    
    th {
      text-align: left;
      padding: 0.75rem;
      color: #AAA;
      font-weight: 500;
      border-bottom: 1px solid rgba(255, 255, 255, 0.1);
    }
    
    td {
      padding: 0.75rem;
      border-bottom: 1px solid rgba(255, 255, 255, 0.05);
      color: #EEE;
    }
    
    tr:hover {
      background-color: rgba(255, 255, 255, 0.03);
    }
    
    .room-name {
      display: flex;
      align-items: center;
      gap: 0.5rem;
    }
    
    .room-icon {
      color: #FF5500;
      font-weight: bold;
    }
    
    .admin-badge {
      background-color: rgba(255, 85, 0, 0.2);
      color: #FF5500;
      font-size: 0.7rem;
      padding: 0.2rem 0.4rem;
      border-radius: 4px;
      margin-left: 0.5rem;
    }
    
    .room-type {
      font-size: 0.85rem;
      padding: 0.25rem 0.5rem;
      border-radius: 4px;
      display: inline-block;
    }
    
    .room-type.private {
      background-color: rgba(255, 85, 0, 0.1);
      color: #FF5500;
    }
    
    .room-type.discovered {
      background-color: rgba(46, 204, 113, 0.1);
      color: #2ecc71;
    }
    
    .room-type.default {
      background-color: rgba(52, 152, 219, 0.1);
      color: #3498db;
    }
    
    .message-count {
      font-weight: 500;
    }
    
    .actions {
      text-align: right;
    }
    
    .view-btn {
      background-color: rgba(255, 255, 255, 0.1);
      color: #EEE;
      border: none;
      border-radius: 4px;
      padding: 0.4rem 0.75rem;
      cursor: pointer;
      display: inline-flex;
      align-items: center;
      gap: 0.35rem;
      transition: all 0.2s ease;
    }
    
    .view-btn:hover {
      background-color: rgba(255, 255, 255, 0.2);
    }
    
    .stats-summary {
  display: grid;
  grid-template-columns: repeat(auto-fill, minmax(200px, 1fr));
  gap: 1rem;
  margin-top: 1rem;
  background-color: rgba(255, 255, 255, 0.03);
  padding: 1rem;
  border-radius: 4px;
}

.stat-item {
  display: flex;
  flex-direction: column;
  gap: 0.25rem;
}

.stat-label {
  color: #AAA;
  font-size: 0.85rem;
}

.stat-value {
  color: #FFF;
  font-size: 1.25rem;
  font-weight: 600;
}

.loading-indicator {
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: center;
  padding: 2rem;
  gap: 1rem;
}

.spinner {
  width: 3rem;
  height: 3rem;
  border: 4px solid rgba(255, 85, 0, 0.1);
  border-top: 4px solid #FF5500;
  border-radius: 50%;
  animation: spin 1s linear infinite;
}

@keyframes spin {
  0% { transform: rotate(0deg); }
  100% { transform: rotate(360deg); }
}

.loading-indicator p {
  color: #CCC;
  font-size: 1rem;
  margin: 0;
}

.empty-message {
  text-align: center;
  color: #999;
  padding: 2rem;
}

.auth-error {
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: center;
  padding: 3rem;
  gap: 1rem;
  text-align: center;
}

.auth-error i {
  font-size: 3rem;
  color: #FF5500;
  margin-bottom: 1rem;
}

.auth-error p {
  margin: 0;
  color: #EEE;
  font-size: 1.25rem;
}

.auth-error-details {
  color: #999;
  font-size: 1rem;
}

/* Responsive Styles */
@media (max-width: 768px) {
  .action-buttons {
    flex-direction: column;
    gap: 0.5rem;
  }
  
  .room-tabs {
    flex-direction: column;
    gap: 0.5rem;
  }
  
  .dashboard-modal {
    width: 95%;
    max-height: 95vh;
  }
}
</style>