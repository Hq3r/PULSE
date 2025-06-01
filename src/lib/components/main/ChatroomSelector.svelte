<!-- ChatroomSelector.svelte - Enhanced with share links functionality -->

<script lang="ts">
import { createEventDispatcher, onMount } from 'svelte';
import { writable } from 'svelte/store';
import { selectedChatroomId } from '$lib/components/main/chatstore';
import { slide, fade } from 'svelte/transition';
import { showCustomToast } from '$lib/utils/utils';
import { copyRoomLink, shareRoom } from '$lib/utils/urlUtils';

const dispatch = createEventDispatcher();

const defaultChatrooms = [
  { id: 'general', name: 'General', description: 'Main discussion channel' },
  { id: 'trading', name: 'Trading', description: 'Discuss trading and prices' },
  { id: 'development', name: 'Development', description: 'Ergo platform development' },
  { id: 'governance', name: 'Governance', description: 'Governance and proposals' }
];

export let discoveredRooms = [];

let chatrooms = defaultChatrooms;
let hiddenRooms = [];
let showRoomList = false;
let showRoomModal = false;
let modalMode = 'list';
let newRoomName = '';
let newRoomDescription = '';
let privateRoomCode = '';
let joinPrivateRoomCode = '';
let showHiddenRooms = false;
let currentModalRoom = null;

$: {
  let allRooms = [...defaultChatrooms];
  const customRooms = loadCustomRoomsFromStorage();
  for (const room of customRooms) {
    if (!allRooms.some(r => r.id === room.id)) {
      allRooms.push(room);
    }
  }
  for (const room of discoveredRooms) {
    if (room.id && room.id.startsWith('dm-')) {
      continue;
    }
    if (!allRooms.some(r => r.id === room.id)) {
      allRooms.push({
        ...room,
        isDiscovered: true,
        name: room.name || formatDiscoveredRoomName(room.id)
      });
    }
  }
  chatrooms = allRooms;
}

function formatDiscoveredRoomName(id) {
  return id.charAt(0).toUpperCase() + id.slice(1).replace(/-/g, ' ');
}

function loadCustomRoomsFromStorage() {
  try {
    const storedRooms = localStorage.getItem('ergoChat_rooms');
    if (storedRooms) {
      return JSON.parse(storedRooms);
    }
  } catch (e) {
    return [];
  }
  return [];
}

onMount(() => {
  loadRoomsFromStorage();
  if (!$selectedChatroomId) {
    selectedChatroomId.set('general');
  }
  const handleClickOutside = (event) => {
    const modal = document.querySelector('.room-modal');
    const selector = document.querySelector('.chatroom-selector');
    if (modal && !modal.contains(event.target) && selector && !selector.contains(event.target)) {
      showRoomModal = false;
    }
  };
  document.addEventListener('click', handleClickOutside);
  return () => {
    document.removeEventListener('click', handleClickOutside);
  };
});

function loadRoomsFromStorage() {
  const storedHiddenRooms = localStorage.getItem('ergoChat_hiddenRooms');
  if (storedHiddenRooms) {
    try {
      hiddenRooms = JSON.parse(storedHiddenRooms);
    } catch (e) {
      hiddenRooms = [];
    }
  }
}

function selectRoom(roomId) {
  selectedChatroomId.set(roomId);
  dispatch('roomSelected', { roomId });
  showRoomList = false;
  showRoomModal = false;
}

$: currentRoom = chatrooms.find(room => room.id === $selectedChatroomId) || chatrooms[0];

$: visibleRooms = showHiddenRooms ? chatrooms : chatrooms.filter(room => !hiddenRooms.includes(room.id));

$: {
  const defaultRooms = visibleRooms.filter(room => defaultChatrooms.some(dr => dr.id === room.id));
  const discoveredPublicRooms = visibleRooms.filter(room => room.isDiscovered && !room.isPrivate && !room.id.startsWith('dm-'));
  const customPublicRooms = visibleRooms.filter(room => !defaultChatrooms.some(dr => dr.id === room.id) && !room.isDiscovered && !room.isPrivate && room.id.startsWith('custom-') && !room.id.startsWith('dm-'));
  const privateRooms = visibleRooms.filter(room => (room.isPrivate || room.id.startsWith('private-')) && !room.id.startsWith('dm-'));
  roomCategories = [
    { name: 'Default', rooms: defaultRooms },
    { name: 'Discovered', rooms: discoveredPublicRooms },
    { name: 'Custom', rooms: customPublicRooms }
  ].filter(category => category.rooms.length > 0);
}

function generatePrivateCode() {
  return Math.floor(1000000000 + Math.random() * 9000000000).toString();
}

function openModal(mode) {
  modalMode = mode;
  showRoomModal = true;
  newRoomName = '';
  newRoomDescription = '';
  privateRoomCode = '';
  joinPrivateRoomCode = '';
}

function closeModal() {
  showRoomModal = false;
}

function addCustomRoom() {
  if (!newRoomName.trim()) return;
  const roomId = 'custom-' + newRoomName.toLowerCase().replace(/\s+/g, '-');
  if (chatrooms.some(room => room.id === roomId)) {
    showCustomToast("A room with this name already exists", 3000, "warning");
    return;
  }
  const newRoom = {
    id: roomId,
    name: newRoomName,
    description: newRoomDescription || `Custom room: ${newRoomName}`
  };
  chatrooms = [...chatrooms, newRoom];
  saveCustomRooms();
  selectRoom(roomId);
  closeModal();
}

function addPrivateRoom() {
  if (!newRoomName.trim()) return;
  const originalCode = privateRoomCode.trim() || generatePrivateCode();
  if (originalCode.length !== 10 || !/^\d+$/.test(originalCode)) {
    showCustomToast("Private room code must be exactly 10 digits", 3000, "warning");
    return;
  }
  const encryptedCode = encryptRoomCode(originalCode);
  const localRoomId = 'private-' + originalCode;
  const blockchainRoomId = 'private-' + encryptedCode;
  if (chatrooms.some(room => room.id === localRoomId)) {
    showCustomToast("A private room with this code already exists", 3000, "warning");
    return;
  }
  const newRoom = {
    id: localRoomId,
    name: newRoomName,
    description: `Private room: ${newRoomName} (Code: ${originalCode})`,
    isPrivate: true,
    code: originalCode,
    blockchainRoomId: blockchainRoomId
  };
  chatrooms = [...chatrooms, newRoom];
  saveCustomRooms();
  showCustomToast(`Private room created! Share this code with others: <strong>${originalCode}</strong>`, 5000, "success");
  selectRoom(localRoomId);
  closeModal();
}

function encryptRoomCode(code, secretKey = "ergochat") {
  if (!code) return "";
  const codeStr = String(code);
  let encrypted = "";
  for (let i = 0; i < codeStr.length; i++) {
    const codeChar = codeStr.charCodeAt(i);
    const keyChar = secretKey.charCodeAt(i % secretKey.length);
    const encryptedChar = codeChar ^ keyChar;
    const hexChar = encryptedChar.toString(16).padStart(2, '0');
    encrypted += hexChar;
  }
  return "enc-" + encrypted;
}

function decryptRoomCode(encrypted, secretKey = "ergochat") {
  if (!encrypted || !encrypted.startsWith("enc-")) return "";
  const hexStr = encrypted.substring(4);
  let decrypted = "";
  for (let i = 0; i < hexStr.length; i += 2) {
    if (i + 1 >= hexStr.length) break;
    const hexPair = hexStr.substring(i, i + 2);
    const encryptedChar = parseInt(hexPair, 16);
    const keyChar = secretKey.charCodeAt((i/2) % secretKey.length);
    const decryptedChar = encryptedChar ^ keyChar;
    decrypted += String.fromCharCode(decryptedChar);
  }
  return decrypted;
}

function isEncryptedRoomCode(code) {
  return code && typeof code === 'string' && code.startsWith("enc-");
}

function joinPrivateRoom() {
  if (!joinPrivateRoomCode.trim()) return;
  const originalCode = joinPrivateRoomCode.trim();
  if (originalCode.length !== 10 || !/^\d+$/.test(originalCode)) {
    showCustomToast("Private room code must be exactly 10 digits", 3000, "warning");
    return;
  }
  const localRoomId = 'private-' + originalCode;
  const encryptedCode = encryptRoomCode(originalCode);
  const blockchainRoomId = 'private-' + encryptedCode;
  if (chatrooms.some(room => room.id === localRoomId)) {
    selectRoom(localRoomId);
    return;
  }
  const newRoom = {
    id: localRoomId,
    name: `Private Room ${originalCode.substring(0, 4)}...`,
    description: `Private room with code: ${originalCode}`,
    isPrivate: true,
    code: originalCode,
    blockchainRoomId: blockchainRoomId
  };
  chatrooms = [...chatrooms, newRoom];
  saveCustomRooms();
  selectRoom(localRoomId);
  closeModal();
}

function removeRoom(roomId, event) {
  if (event) event.stopPropagation();
  if (defaultChatrooms.some(room => room.id === roomId)) {
    showCustomToast("Default rooms cannot be removed", 3000, "warning");
    return;
  }
  const room = chatrooms.find(r => r.id === roomId);
  if (room && room.isDiscovered) {
    showCustomToast("Discovered rooms cannot be removed, but you can hide them", 3000, "warning");
    return;
  }
  if ($selectedChatroomId === roomId) {
    selectRoom('general');
  }
  chatrooms = chatrooms.filter(room => room.id !== roomId);
  if (hiddenRooms.includes(roomId)) {
    hiddenRooms = hiddenRooms.filter(id => id !== roomId);
    saveHiddenRooms();
  }
  saveCustomRooms();
  showCustomToast("Room removed successfully", 3000, "success");
}

function toggleRoomVisibility(roomId, event) {
  if (event) event.stopPropagation();
  if (defaultChatrooms.some(room => room.id === roomId) && roomId === 'general') {
    showCustomToast("The General room cannot be hidden", 3000, "warning");
    return;
  }
  if (hiddenRooms.includes(roomId)) {
    hiddenRooms = hiddenRooms.filter(id => id !== roomId);
    showCustomToast("Room is now visible", 3000, "success");
  } else {
    hiddenRooms = [...hiddenRooms, roomId];
    if ($selectedChatroomId === roomId) {
      selectRoom('general');
    }
    showCustomToast("Room is now hidden", 3000, "success");
  }
  saveHiddenRooms();
}

function saveCustomRooms() {
  const customRooms = chatrooms.filter(room => !defaultChatrooms.some(dr => dr.id === room.id) && !room.isDiscovered);
  localStorage.setItem('ergoChat_rooms', JSON.stringify(customRooms));
}

function saveHiddenRooms() {
  localStorage.setItem('ergoChat_hiddenRooms', JSON.stringify(hiddenRooms));
}

function copyRoomCode(roomId, event) {
  if (event) event.stopPropagation();
  const code = roomId.replace('private-', '');
  navigator.clipboard.writeText(code)
    .then(() => {
      showCustomToast("Room code copied to clipboard!", 2000, "success");
    })
    .catch(err => {
      showCustomToast("Failed to copy room code", 2000, "error");
    });
}

function shareRoomLink(roomId, event) {
  if (event) event.stopPropagation();
  const room = chatrooms.find(r => r.id === roomId);
  if (room) {
    shareRoom(roomId, room.name, room.description);
  }
}

function copyRoomLinkToClipboard(roomId, event) {
  if (event) event.stopPropagation();
  const room = chatrooms.find(r => r.id === roomId);
  if (room) {
    copyRoomLink(roomId, room.name);
  }
}

function renameRoom(roomId, event) {
  if (event) event.stopPropagation();
  const room = chatrooms.find(r => r.id === roomId);
  if (!room) return;
  if (room.isDiscovered) {
    showCustomToast("Discovered rooms cannot be renamed", 3000, "warning");
    return;
  }
  const newName = prompt("Enter new room name:", room.name);
  if (!newName || !newName.trim()) return;
  room.name = newName.trim();
  chatrooms = [...chatrooms];
  saveCustomRooms();
  showCustomToast("Room renamed successfully", 2000, "success");
}

function showRoomInfo(roomId, event) {
  if (event) event.stopPropagation();
  const room = chatrooms.find(r => r.id === roomId);
  if (!room) return;
  currentModalRoom = room;
  modalMode = 'info';
  showRoomModal = true;
}

function toggleShowHidden() {
  showHiddenRooms = !showHiddenRooms;
}

let roomCategories = [];
</script>


<div class="chatroom-selector">

    <!-- Compact Current Room Display -->

    <div class="current-room" on:click|stopPropagation={() => showRoomList = !showRoomList}>

      <span class="room-indicator">{currentRoom?.isPrivate ? '🔒' : '#'}</span>

      <span class="room-name">{currentRoom?.name || 'General'}</span>

      <div class="room-actions">

        <button class="room-btn" on:click|stopPropagation={() => openModal('create')} title="Create Public Room">

          <i class="fa-solid fa-plus"></i>

        </button>

        <button class="room-btn" on:click|stopPropagation={() => openModal('private')} title="Create Private Room">

          <i class="fa-solid fa-lock"></i>

        </button>

        <button class="room-btn" on:click|stopPropagation={() => openModal('join')} title="Join Private Room">

          <i class="fa-solid fa-right-to-bracket"></i>

        </button>

        <button class="room-btn" on:click|stopPropagation={() => openModal('manage')} title="Manage Rooms">

          <i class="fa-solid fa-gear"></i>

        </button>

        <button class="toggle-btn">

          <i class="fa-solid {showRoomList ? 'fa-chevron-up' : 'fa-chevron-down'}"></i>

        </button>

      </div>

    </div>

    

    <!-- Compact Room List Dropdown -->

    {#if showRoomList}

      <div class="room-dropdown" transition:slide={{ duration: 150 }}>

        <div class="compact-room-list">

          <!-- Grouped by categories -->

          {#each roomCategories as category}

            <div class="room-category">

              <div class="category-header">{category.name}</div>

              {#each category.rooms as room}

                <div 

                  class="room-item {room.id === $selectedChatroomId ? 'active' : ''}" 

                  on:click={() => selectRoom(room.id)}

                >

                  <div class="room-item-content">

                    <span class="room-indicator">

                      {#if room.isPrivate}

                        🔒

                      {:else if room.isDiscovered}

                        🌎

                      {:else}

                        #

                      {/if}

                    </span>

                    <span class="room-item-name">{room.name}</span>

                  </div>

                  

                  <div class="room-item-actions">

                    <button 

                      class="action-btn" 

                      on:click|stopPropagation={(e) => showRoomInfo(room.id, e)}

                      title="Room info"

                    >

                      <i class="fa-solid fa-info-circle"></i>

                    </button>

                    

                    <button 

                      class="action-btn" 

                      on:click|stopPropagation={(e) => copyRoomLinkToClipboard(room.id, e)}

                      title="Copy room link"

                    >

                      <i class="fa-solid fa-link"></i>

                    </button>

                    

                    <button 

                      class="action-btn" 

                      on:click|stopPropagation={(e) => shareRoomLink(room.id, e)}

                      title="Share room"

                    >

                      <i class="fa-solid fa-share"></i>

                    </button>

                    

                    {#if room.isPrivate}

                      <button 

                        class="action-btn" 

                        on:click|stopPropagation={(e) => copyRoomCode(room.id, e)}

                        title="Copy room code"

                      >

                        <i class="fa-solid fa-copy"></i>

                      </button>

                    {/if}

                    

                    {#if !defaultChatrooms.some(dr => dr.id === room.id) && !room.isDiscovered}

                      <button 

                        class="action-btn" 

                        on:click|stopPropagation={(e) => renameRoom(room.id, e)}

                        title="Rename room"

                      >

                        <i class="fa-solid fa-pencil"></i>

                      </button>

                    {/if}

                    

                    {#if room.id !== 'general'}

                      <button 

                        class="action-btn" 

                        on:click|stopPropagation={(e) => toggleRoomVisibility(room.id, e)}

                        title={hiddenRooms.includes(room.id) ? "Unhide room" : "Hide room"}

                      >

                        <i class="fa-solid {hiddenRooms.includes(room.id) ? 'fa-eye' : 'fa-eye-slash'}"></i>

                      </button>

                    {/if}

                    

                    {#if !defaultChatrooms.some(dr => dr.id === room.id) && !room.isDiscovered}

                      <button 

                        class="action-btn" 

                        on:click|stopPropagation={(e) => removeRoom(room.id, e)}

                        title="Remove room"

                      >

                        <i class="fa-solid fa-times"></i>

                      </button>

                    {/if}

                  </div>

                </div>

              {/each}

            </div>

          {/each}

        </div>

      </div>

    {/if}

  </div>

  

  <!-- Modal Dialog for Room Management -->

  {#if showRoomModal}

    <div class="modal-backdrop" on:click|self={closeModal} transition:fade={{ duration: 150 }}>

      <div class="room-modal" transition:slide={{ duration: 200, y: -20 }}>

        <!-- Modal Header -->

        <div class="modal-header">

          <h3>

            {#if modalMode === 'list'}

              Room Management

            {:else if modalMode === 'create'}

              Create Public Room

            {:else if modalMode === 'join'}

              Join Private Room

            {:else if modalMode === 'private'}

              Create Private Room

            {:else if modalMode === 'manage'}

              Manage Rooms

            {:else if modalMode === 'info'}

              Room Information

            {/if}

          </h3>

          <button class="close-btn" on:click={closeModal}>

            <i class="fa-solid fa-times"></i>

          </button>

        </div>

        

        <!-- Modal Body -->

        <div class="modal-body">

          {#if modalMode === 'list'}

            <div class="modal-actions">

              <button class="modal-action-btn" on:click={() => modalMode = 'create'}>

                <i class="fa-solid fa-plus"></i>

                Create Public Room

              </button>

              <button class="modal-action-btn" on:click={() => modalMode = 'private'}>

                <i class="fa-solid fa-lock"></i>

                Create Private Room

              </button>

              <button class="modal-action-btn" on:click={() => modalMode = 'join'}>

                <i class="fa-solid fa-right-to-bracket"></i>

                Join Private Room

              </button>

              <button class="modal-action-btn" on:click={() => modalMode = 'manage'}>

                <i class="fa-solid fa-gear"></i>

                Manage Rooms

              </button>

            </div>

          {:else if modalMode === 'create'}

            <div class="modal-form">

              <div class="form-group">

                <label for="room-name">Room Name</label>

                <input 

                  type="text" 

                  id="room-name"

                  bind:value={newRoomName} 

                  placeholder="Enter room name" 

                  class="room-input"

                />

              </div>

              <div class="form-group">

                <label for="room-desc">Description (Optional)</label>

                <input 

                  type="text" 

                  id="room-desc"

                  bind:value={newRoomDescription} 

                  placeholder="Enter room description" 

                  class="room-input"

                />

              </div>

              <div class="form-actions">

                <button class="cancel-btn" on:click={() => modalMode = 'list'}>Back</button>

                <button 

                  class="confirm-btn" 

                  on:click={addCustomRoom} 

                  disabled={!newRoomName.trim()}

                >

                  Create Room

                </button>

              </div>

            </div>

          {:else if modalMode === 'private'}

            <div class="modal-form">

              <div class="form-group">

                <label for="private-name">Room Name</label>

                <input 

                  type="text" 

                  id="private-name"

                  bind:value={newRoomName} 

                  placeholder="Enter room name" 

                  class="room-input"

                />

              </div>

              <div class="form-group">

                <label for="private-code">10-digit Code (Optional)</label>

                <input 

                  type="text" 

                  id="private-code"

                  bind:value={privateRoomCode} 

                  placeholder="Auto-generated if empty" 

                  class="room-input"

                  maxlength="10"

                  pattern="\d{10}"

                />

                <small class="form-hint">

                  <i class="fa-solid fa-info-circle"></i>

                  Share this code with others to let them join your private room

                </small>

              </div>

              <div class="form-actions">

                <button class="cancel-btn" on:click={() => modalMode = 'list'}>Back</button>

                <button 

                  class="confirm-btn" 

                  on:click={addPrivateRoom} 

                  disabled={!newRoomName.trim()}

                >

                  Create Private Room

                </button>

              </div>

            </div>

          {:else if modalMode === 'join'}

            <div class="modal-form">

              <div class="form-group">

                <label for="join-code">Private Room Code</label>

                <input 

                  type="text" 

                  id="join-code"

                  bind:value={joinPrivateRoomCode} 

                  placeholder="Enter 10-digit room code" 

                  class="room-input"

                  maxlength="10"

                  pattern="\d{10}"

                />

                <small class="form-hint">

                  <i class="fa-solid fa-info-circle"></i>

                  Enter the 10-digit code shared by the room creator

                </small>

              </div>

              <div class="form-actions">

                <button class="cancel-btn" on:click={() => modalMode = 'list'}>Back</button>

                <button 

                  class="confirm-btn" 

                  on:click={joinPrivateRoom} 

                  disabled={!joinPrivateRoomCode.trim() || joinPrivateRoomCode.length !== 10 || !/^\d+$/.test(joinPrivateRoomCode)}

                >

                  Join Room

                </button>

              </div>

            </div>

          {:else if modalMode === 'manage'}

            <div class="manage-rooms">

              <div class="manage-actions">

                <button 

                  class="manage-btn toggle-btn {showHiddenRooms ? 'active' : ''}" 

                  on:click={toggleShowHidden}

                >

                  <i class="fa-solid {showHiddenRooms ? 'fa-eye-slash' : 'fa-eye'}"></i>

                  {showHiddenRooms ? 'Hide Hidden Rooms' : 'Show Hidden Rooms'}

                </button>

                

                <button 

                  class="manage-btn danger-btn" 

                  on:click={() => {

                    const customRoomCount = chatrooms.filter(r => !r.isDiscovered).length - defaultChatrooms.length;

                    if (customRoomCount > 0 && confirm(`Remove all ${customRoomCount} custom rooms?`)) {

                      // Only remove non-discovered custom rooms

                      chatrooms = chatrooms.filter(r => 

                        defaultChatrooms.some(dr => dr.id === r.id) || r.isDiscovered

                      );

                      

                      if (!defaultChatrooms.some(r => r.id === $selectedChatroomId) && 

                          !chatrooms.some(r => r.id === $selectedChatroomId)) {

                        selectRoom('general');

                      }

                      saveCustomRooms();

                      showCustomToast("All custom rooms removed", 3000, "success");

                    }

                  }}

                  disabled={chatrooms.filter(r => !r.isDiscovered).length <= defaultChatrooms.length}

                >

                  <i class="fa-solid fa-trash-alt"></i>

                  Remove All Custom Rooms

                </button>

                

                <button 

                  class="manage-btn" 

                  on:click={() => {

                    if (hiddenRooms.length > 0 && confirm(`Unhide all ${hiddenRooms.length} hidden rooms?`)) {

                      hiddenRooms = [];

                      saveHiddenRooms();

                      showCustomToast("All rooms are now visible", 3000, "success");

                    }

                  }}

                  disabled={hiddenRooms.length === 0}

                >

                  <i class="fa-solid fa-eye"></i>

                  Unhide All Rooms

                </button>

              </div>

              

              <div class="room-stats">

                <div class="stat-row">

                  <span class="stat-label">Total Rooms:</span>

                  <span class="stat-value">{chatrooms.length}</span>

                </div>

                <div class="stat-row">

                  <span class="stat-label">Default Rooms:</span>

                  <span class="stat-value">{defaultChatrooms.length}</span>

                </div>

                <div class="stat-row">

                  <span class="stat-label">Discovered Rooms:</span>

                  <span class="stat-value">{chatrooms.filter(r => r.isDiscovered).length}</span>

                </div>

                <div class="stat-row">

                  <span class="stat-label">Custom Rooms:</span>

                  <span class="stat-value">{chatrooms.filter(r => !defaultChatrooms.some(dr => dr.id === r.id) && !r.isDiscovered).length}</span>

                </div>

                <div class="stat-row">

                  <span class="stat-label">Hidden Rooms:</span>

                  <span class="stat-value">{hiddenRooms.length}</span>

                </div>

              </div>

              

              <div class="form-actions">

                <button class="cancel-btn" on:click={() => modalMode = 'list'}>Back</button>

              </div>

            </div>

          {:else if modalMode === 'info'}

            <div class="room-info-content">

              {#if currentModalRoom}

                <div class="room-detail">

                  <span class="detail-label">Room Name:</span>

                  <span class="detail-value">{currentModalRoom.name}</span>

                  {#if !currentModalRoom.isDiscovered && !defaultChatrooms.some(r => r.id === currentModalRoom.id)}

                    <button class="action-icon-btn" on:click={() => renameRoom(currentModalRoom.id)}>

                      <i class="fa-solid fa-pencil"></i>

                    </button>

                  {/if}

                </div>

                

                <div class="room-detail">

                  <span class="detail-label">Room Type:</span>

                  <span class="detail-value">

                    {#if currentModalRoom.isPrivate}

                      Private Room 🔒

                    {:else if currentModalRoom.isDiscovered}

                      Discovered Room 🌎

                    {:else if defaultChatrooms.some(r => r.id === currentModalRoom.id)}

                      Default Room #

                    {:else}

                      Custom Room #

                    {/if}

                  </span>

                </div>

                

                {#if currentModalRoom.description}

                  <div class="room-detail">

                    <span class="detail-label">Description:</span>

                    <span class="detail-value">{currentModalRoom.description}</span>

                  </div>

                {/if}

                

                {#if currentModalRoom.isPrivate}

                  <div class="room-detail code-detail">

                    <span class="detail-label">Room Code:</span>

                    <div class="code-container">

                      <span class="code-value">{currentModalRoom.id.replace('private-', '')}</span>

                      <button class="action-icon-btn" on:click={() => copyRoomCode(currentModalRoom.id)}>

                        <i class="fa-solid fa-copy"></i>

                      </button>

                    </div>

                  </div>

                  

                  <div class="sharing-options">

                    <p class="sharing-text">Share this code with others to invite them to this room</p>

                    <button class="share-btn" on:click={() => {

                      // Create share text

                      const shareText = `Join my private chat room on Ergo Blockchain Chat!\n\nRoom: ${currentModalRoom.name}\nCode: ${currentModalRoom.id.replace('private-', '')}\n\nJust paste this code in the "Join Private Room" section.`;

                      

                      // Try to use the share API if available

                      if (navigator.share) {

                        navigator.share({

                          title: 'Join my private Ergo Chat room',

                          text: shareText

                        }).catch(err => {

                          // Fallback to clipboard

                          navigator.clipboard.writeText(shareText);

                          showCustomToast("Invite message copied to clipboard", 3000, "success");

                        });

                      } else {

                        // Fallback to clipboard

                        navigator.clipboard.writeText(shareText);

                        showCustomToast("Invite message copied to clipboard", 3000, "success");

                      }

                    }}>

                      <i class="fa-solid fa-share-alt"></i>

                      Share Invite

                    </button>

                  </div>

                {/if}

                

                {#if currentModalRoom.isDiscovered}

                  <div class="room-note">

                    <p>This is a discovered public room from the blockchain.</p>

                    <p>These rooms are created by other users and visible to everyone.</p>

                  </div>

                {/if}

                

                <div class="modal-actions-row">

                  <button class="share-room-btn" on:click={() => {

                    copyRoomLinkToClipboard(currentModalRoom.id);

                  }}>

                    <i class="fa-solid fa-link"></i>

                    Copy Link

                  </button>

                  

                  <button class="share-room-btn" on:click={() => {

                    shareRoomLink(currentModalRoom.id);

                  }}>

                    <i class="fa-solid fa-share"></i>

                    Share Room

                  </button>

                  

                  {#if !defaultChatrooms.some(dr => dr.id === currentModalRoom.id) && !currentModalRoom.isDiscovered}

                    <button class="danger-action-btn" on:click={() => {

                      if (confirm(`Are you sure you want to remove the room "${currentModalRoom.name}"?`)) {

                        removeRoom(currentModalRoom.id);

                        closeModal();

                      }

                    }}>

                      <i class="fa-solid fa-trash-alt"></i>

                      Remove Room

                    </button>

                  {/if}

                  

                  {#if currentModalRoom.id !== 'general'}

                    <button 

                      class="visibility-btn" 

                      on:click={() => {

                        toggleRoomVisibility(currentModalRoom.id);

                        // Close modal after toggle

                        setTimeout(closeModal, 500);

                      }}

                    >

                      <i class="fa-solid {hiddenRooms.includes(currentModalRoom.id) ? 'fa-eye' : 'fa-eye-slash'}"></i>

                      {hiddenRooms.includes(currentModalRoom.id) ? 'Show Room' : 'Hide Room'}

                    </button>

                  {/if}

                </div>

              {/if}

              

              <div class="form-actions">

                <button class="cancel-btn" on:click={() => modalMode = 'list'}>Back</button>

              </div>

            </div>

          {/if}

        </div>

      </div>

    </div>

  {/if}

<style>

  /* Compact Chatroom Selector Styles */

  .chatroom-selector {

    position: relative;

    width: 100%;

    margin-bottom: 1rem;

    font-size: 0.9rem;

  }

  

  .current-room {

    display: flex;

    align-items: center;

    background-color: rgba(255, 85, 0, 0.1);

    border: 1px solid rgba(255, 85, 0, 0.3);

    border-radius: 8px;

    padding: 0.5rem 0.75rem;

    cursor: pointer;

    transition: background-color 0.2s ease;

  }

  

  .current-room:hover {

    background-color: rgba(255, 85, 0, 0.2);

  }

  

  .room-indicator {

    color: #FF5500;

    font-weight: bold;

    margin-right: 0.5rem;

    font-size: 1rem;

  }

  

  .room-name {

    flex: 1;

    font-weight: 600;

    color: white;

    white-space: nowrap;

    overflow: hidden;

    text-overflow: ellipsis;

  }

  

  .room-actions {

    display: flex;

    align-items: center;

    margin-left: 0.5rem;

  }

  

  .room-btn {

    background: none;

    border: none;

    color: rgba(255, 255, 255, 0.6);

    cursor: pointer;

    width: 1.75rem;

    height: 1.75rem;

    border-radius: 4px;

    display: flex;

    align-items: center;

    justify-content: center;

    transition: all 0.2s ease;

    margin-left: 0.25rem;

  }

  

  .room-btn:hover {

    background-color: rgba(255, 255, 255, 0.1);

    color: white;

  }

  

  .toggle-btn {

    background: none;

    border: none;

    color: rgba(255, 255, 255, 0.6);

    cursor: pointer;

    width: 1.75rem;

    height: 1.75rem;

    display: flex;

    align-items: center;

    justify-content: center;

    margin-left: 0.25rem;

  }

  

  /* Room Dropdown */

  .room-dropdown {

    position: absolute;

    top: 100%;

    left: 0;

    right: 0;

    margin-top: 0.25rem;

    background-color: #262626;

    border-radius: 8px;

    box-shadow: 0 4px 15px rgba(0, 0, 0, 0.3);

    z-index: 10;

    max-height: 400px;

    overflow-y: auto;

  }

  

  .compact-room-list {

    padding: 0.25rem;

  }

  

  /* Category styles */

  .room-category {

    margin-bottom: 0.5rem;

  }

  

  .category-header {

    color: #999;

    font-size: 0.75rem;

    font-weight: 600;

    text-transform: uppercase;

    padding: 0.5rem 0.75rem 0.25rem;

    letter-spacing: 0.5px;

  }

  

  .room-item {

    display: flex;

    align-items: center;

    justify-content: space-between;

    padding: 0.5rem 0.75rem;

    border-radius: 4px;

    cursor: pointer;

    transition: background-color 0.2s ease;

    margin-bottom: 0.125rem;

  }

  

  .room-item:last-child {

    margin-bottom: 0;

  }

  

  .room-item:hover, .room-item.active {

    background-color: rgba(255, 85, 0, 0.1);

  }

  

  .room-item.active {

    border-left: 2px solid #FF5500;

  }

  

  .room-item-content {

    display: flex;

    align-items: center;

    min-width: 0;

    overflow: hidden;

  }

  

  .room-item-name {

    font-weight: 500;

    color: white;

    white-space: nowrap;

    overflow: hidden;

    text-overflow: ellipsis;

  }

  

  .room-item-actions {

    display: flex;

    align-items: center;

    gap: 0.25rem;

    opacity: 0;

    transition: opacity 0.2s ease;

  }

  

  .room-item:hover .room-item-actions {

    opacity: 1;

  }

  

  .action-btn {

    background: none;

    border: none;

    color: #999;

    cursor: pointer;

    width: 1.5rem;

    height: 1.5rem;

    border-radius: 4px;

    display: flex;

    align-items: center;

    justify-content: center;

    transition: all 0.2s ease;

    font-size: 0.75rem;

  }

  

  .action-btn:hover {

    background-color: rgba(255, 255, 255, 0.1);

    color: white;

  }

  

  /* Modal Dialog Styles */

  .modal-backdrop {

    position: fixed;

    top: 0;

    left: 0;

    right: 0;

    bottom: 0;

    background-color: rgba(0, 0, 0, 0.5);

    display: flex;

    align-items: center;

    justify-content: center;

    z-index: 1000;

  }

  

  .room-modal {

    background-color: #262626;

    border-radius: 8px;

    width: 90%;

    max-width: 400px;

    max-height: 90vh;

    overflow-y: auto;

    box-shadow: 0 4px 20px rgba(0, 0, 0, 0.3);

  }

  

  .modal-header {

    display: flex;

    align-items: center;

    justify-content: space-between;

    padding: 1rem;

    border-bottom: 1px solid rgba(255, 255, 255, 0.1);

  }

  

  .modal-header h3 {

    margin: 0;

    color: white;

    font-size: 1.1rem;

    font-weight: 500;

  }

  

  .close-btn {

    background: none;

    border: none;

    color: #AAA;

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

  

  .modal-body {

    padding: 1rem;

  }

  

  /* Modal Action Buttons */

  .modal-actions {

    display: grid;

    grid-template-columns: 1fr 1fr;

    gap: 0.75rem;

  }

  

  .modal-action-btn {

    background-color: rgba(255, 85, 0, 0.1);

    color: white;

    border: 1px solid rgba(255, 85, 0, 0.2);

    border-radius: 6px;

    padding: 1rem;

    cursor: pointer;

    font-weight: 500;

    transition: all 0.2s ease;

    display: flex;

    flex-direction: column;

    align-items: center;

    justify-content: center;

    gap: 0.5rem;

  }

  

  .modal-action-btn i {

    font-size: 1.5rem;

    margin-bottom: 0.5rem;

  }

  

  .modal-action-btn:hover {

    background-color: rgba(255, 85, 0, 0.2);

  }

  

  /* Form Styles */

  .modal-form {

    display: flex;

    flex-direction: column;

    gap: 1rem;

  }

  

  .form-group {

    display: flex;

    flex-direction: column;

    gap: 0.5rem;

  }

  

  .form-group label {

    color: #CCC;

    font-size: 0.9rem;

  }

  

  .room-input {

    padding: 0.6rem 0.75rem;

    background-color: #333;

    border: 1px solid #444;

    border-radius: 4px;

    color: white;

    font-size: 0.9rem;

  }

  

  .room-input:focus {

    border-color: #FF5500;

    outline: none;

  }

  

  .form-hint {

    font-size: 0.8rem;

    color: #AAA;

    display: flex;

    align-items: center;

    gap: 0.5rem;

    margin-top: 0.25rem;

  }

  

  .form-actions {

    display: flex;

    justify-content: flex-end;

    gap: 0.75rem;

    margin-top: 1rem;

  }

  

  .cancel-btn {

    background-color: rgba(255, 255, 255, 0.1);

    color: #CCC;

    border: none;

    border-radius: 4px;

    padding: 0.6rem 1rem;

    cursor: pointer;

    font-weight: 500;

    transition: all 0.2s ease;

  }

  

  .cancel-btn:hover {

    background-color: rgba(255, 255, 255, 0.2);

    color: white;

  }

  

  .confirm-btn {

    background-color: rgba(255, 85, 0, 0.8);

    color: white;

    border: none;

    border-radius: 4px;

    padding: 0.6rem 1rem;

    cursor: pointer;

    font-weight: 500;

    transition: all 0.2s ease;

  }

  

  .confirm-btn:hover {

    background-color: #FF5500;

  }

  

  .confirm-btn:disabled {

    background-color: #555;

    cursor: not-allowed;

    opacity: 0.7;

  }

  

  /* Manage Rooms Section */

  .manage-rooms {

    display: flex;

    flex-direction: column;

    gap: 1rem;

  }

  

  .manage-actions {

    display: flex;

    flex-direction: column;

    gap: 0.75rem;

  }

  

  .manage-btn {

    background-color: rgba(255, 255, 255, 0.1);

    color: #EEE;

    border: 1px solid rgba(255, 255, 255, 0.2);

    border-radius: 4px;

    padding: 0.6rem 1rem;

    cursor: pointer;

    font-weight: 500;

    transition: all 0.2s ease;

    display: flex;

    align-items: center;

    justify-content: center;

    gap: 0.5rem;

  }

  

  .manage-btn:hover {

    background-color: rgba(255, 255, 255, 0.2);

  }

  

  .manage-btn:disabled {

    opacity: 0.5;

    cursor: not-allowed;

  }

  

  .manage-btn.toggle-btn.active {

    background-color: rgba(255, 85, 0, 0.2);

    border-color: rgba(255, 85, 0, 0.3);

  }

  

  .manage-btn.danger-btn {

    background-color: rgba(255, 68, 68, 0.1);

    color: #ff9999;

    border: 1px solid rgba(255, 68, 68, 0.2);

  }

  

  .manage-btn.danger-btn:hover {

    background-color: rgba(255, 68, 68, 0.2);

    color: white;

  }

  

  .room-stats {

    background-color: rgba(0, 0, 0, 0.2);

    border-radius: 4px;

    padding: 0.75rem;

  }

  

  .stat-row {

    display: flex;

    justify-content: space-between;

    margin-bottom: 0.5rem;

  }

  

  .stat-row:last-child {

    margin-bottom: 0;

  }

  

  .stat-label {

    color: #AAA;

  }

  

  .stat-value {

    color: white;

    font-weight: 500;

  }

  

  /* Room Info Styles */

  .room-info-content {

    display: flex;

    flex-direction: column;

    gap: 1rem;

  }

  

  .room-detail {

    display: flex;

    align-items: center;

    gap: 0.5rem;

  }

  

  .detail-label {

    color: #AAA;

    font-size: 0.9rem;

    min-width: 100px;

  }

  

  .detail-value {

    color: white;

    font-weight: 500;

    flex: 1;

  }

  

  .code-detail {

    background-color: rgba(255, 85, 0, 0.1);

    border: 1px solid rgba(255, 85, 0, 0.3);

    border-radius: 4px;

    padding: 0.75rem;

  }

  

  .code-container {

    display: flex;

    align-items: center;

    gap: 0.5rem;

  }

  

  .code-value {

    color: #FF5500;

    font-weight: bold;

    letter-spacing: 1px;

  }

  

  .action-icon-btn {

    background: none;

    border: none;

    color: #AAA;

    cursor: pointer;

    width: 1.75rem;

    height: 1.75rem;

    border-radius: 4px;

    display: flex;

    align-items: center;

    justify-content: center;

    transition: all 0.2s ease;

  }

  

  .action-icon-btn:hover {

    background-color: rgba(255, 255, 255, 0.1);

    color: white;

  }

  

  .sharing-options {

    margin-top: 0.5rem;

    text-align: center;

  }

  

  .sharing-text {

    font-size: 0.85rem;

    color: #AAA;

    margin-bottom: 0.75rem;

  }

  

  .share-btn {

    background-color: rgba(255, 85, 0, 0.7);

    color: white;

    border: none;

    border-radius: 4px;

    padding: 0.6rem 1.5rem;

    cursor: pointer;

    font-weight: 500;

    transition: all 0.2s ease;

    display: flex;

    align-items: center;

    justify-content: center;

    gap: 0.5rem;

    margin: 0 auto;

  }

  

  .share-btn:hover {

    background-color: #FF5500;

  }

  

  .modal-actions-row {

    margin-top: 1rem;

    display: flex;

    justify-content: space-between;

    gap: 0.5rem;

    flex-wrap: wrap;

  }

  

  .share-room-btn {

    background-color: rgba(74, 158, 255, 0.7);

    color: white;

    border: none;

    border-radius: 4px;

    padding: 0.6rem 1rem;

    cursor: pointer;

    font-weight: 500;

    transition: all 0.2s ease;

    display: flex;

    align-items: center;

    gap: 0.5rem;

  }

  

  .share-room-btn:hover {

    background-color: #4A9EFF;

  }

  

  .danger-action-btn {

    background-color: rgba(255, 68, 68, 0.7);

    color: white;

    border: none;

    border-radius: 4px;

    padding: 0.6rem 1rem;

    cursor: pointer;

    font-weight: 500;

    transition: all 0.2s ease;

    display: flex;

    align-items: center;

    gap: 0.5rem;

  }

  

  .danger-action-btn:hover {

    background-color: #ff4c4c;

  }

  

  .visibility-btn {

    background-color: rgba(255, 255, 255, 0.1);

    color: white;

    border: none;

    border-radius: 4px;

    padding: 0.6rem 1rem;

    cursor: pointer;

    font-weight: 500;

    transition: all 0.2s ease;

    display: flex;

    align-items: center;

    gap: 0.5rem;

  }

  

  .visibility-btn:hover {

    background-color: rgba(255, 255, 255, 0.2);

  }

  

  .room-note {

    background-color: rgba(0, 0, 0, 0.2);

    border-left: 3px solid #FF5500;

    padding: 0.75rem;

    border-radius: 0 4px 4px 0;

    font-size: 0.85rem;

    color: #CCC;

  }

  

  .room-note p {

    margin: 0 0 0.5rem 0;

  }

  

  .room-note p:last-child {

    margin-bottom: 0;

  }

  

  /* Responsive Adjustments */

  @media (max-width: 480px) {

    .room-modal {

      width: 95%;

    }

    

    .modal-actions {

      grid-template-columns: 1fr;

    }

    

    .modal-actions-row {

      flex-direction: column;

    }

  }

</style>