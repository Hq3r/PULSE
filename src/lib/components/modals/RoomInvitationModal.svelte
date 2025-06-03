<!-- RoomManagementModal.svelte -->
<script>
  import { createEventDispatcher } from 'svelte';
  import { fade, slide } from 'svelte/transition';
  import { getRoomStats } from '$lib/utils/roomUtils.js';

  export let roomState;
  export let allRooms;
  export let hiddenRooms;

  const dispatch = createEventDispatcher();

  function handleCreateRoom() {
    dispatch('createRoom');
  }

  function handleCreatePrivateRoom() {
    dispatch('createPrivateRoom');
  }

  function handleJoinPrivateRoom() {
    dispatch('joinPrivateRoom');
  }

  function handleClose() {
    dispatch('close');
  }

  function handleRefreshRooms() {
    dispatch('refreshRooms');
  }

  function setModalMode(mode) {
    roomState.modalMode = mode;
  }

  function goBack() {
    roomState.modalMode = 'list';
  }
</script>

{#if roomState.showRoomModal}
  <div class="modal-backdrop" on:click|self={handleClose} transition:fade={{ duration: 150 }}>
    <div class="room-modal" transition:slide={{ duration: 200, y: -20 }}>
      <!-- Modal Header -->
      <div class="modal-header">
        <h3>
          {#if roomState.modalMode === 'list'}
            Room Management
          {:else if roomState.modalMode === 'create'}
            Create Public Room
          {:else if roomState.modalMode === 'join'}
            Join Private Room
          {:else if roomState.modalMode === 'private' || roomState.modalMode === 'createPrivate'}
            Create Private Room
          {:else if roomState.modalMode === 'manage'}
            Manage Rooms
          {:else if roomState.modalMode === 'info'}
            Room Information
          {/if}
        </h3>
        <button class="close-btn" on:click={handleClose}>
          <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
            <line x1="18" y1="6" x2="6" y2="18"></line>
            <line x1="6" y1="6" x2="18" y2="18"></line>
          </svg>
        </button>
      </div>

      <!-- Modal Body -->
      <div class="modal-body">
        {#if roomState.modalMode === 'list'}
          <div class="modal-actions">
            <button class="modal-action-btn" on:click={() => setModalMode('create')}>
              <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                <line x1="12" y1="5" x2="12" y2="19"></line>
                <line x1="5" y1="12" x2="19" y2="12"></line>
              </svg>
              Create Public Room
            </button>
            <button class="modal-action-btn" on:click={() => setModalMode('private')}>
              <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                <rect x="3" y="11" width="18" height="11" rx="2" ry="2"></rect>
                <circle cx="12" cy="16" r="1"></circle>
                <path d="M7 11V7a5 5 0 0 1 10 0v4"></path>
              </svg>
              Create Private Room
            </button>
            <button class="modal-action-btn" on:click={() => setModalMode('join')}>
              <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                <path d="M15 3h4a2 2 0 0 1 2 2v14a2 2 0 0 1-2 2h-4"></path>
                <polyline points="10,17 15,12 10,7"></polyline>
                <line x1="15" y1="12" x2="3" y2="12"></line>
              </svg>
              Join Private Room
            </button>
            <button class="modal-action-btn" on:click={() => setModalMode('manage')}>
              <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                <circle cx="12" cy="12" r="3"></circle>
                <path d="M19.4 15a1.65 1.65 0 0 0 .33 1.82l.06.06a2 2 0 0 1 0 2.83 2 2 0 0 1-2.83 0l-.06-.06a1.65 1.65 0 0 0-1.82-.33 1.65 1.65 0 0 0-1 1.51V21a2 2 0 0 1-2 2 2 2 0 0 1-2-2v-.09A1.65 1.65 0 0 0 9 19.4a1.65 1.65 0 0 0-1.82.33l-.06.06a2 2 0 0 1-2.83 0 2 2 0 0 1 0-2.83l.06-.06a1.65 1.65 0 0 0 .33-1.82 1.65 1.65 0 0 0-1.51-1H3a2 2 0 0 1-2-2 2 2 0 0 1 2-2h.09A1.65 1.65 0 0 0 4.6 9a1.65 1.65 0 0 0-.33-1.82l-.06-.06a2 2 0 0 1 0-2.83 2 2 0 0 1 2.83 0l.06.06a1.65 1.65 0 0 0 1.82.33H9a1.65 1.65 0 0 0 1-1.51V3a2 2 0 0 1 2-2 2 2 0 0 1 2 2v.09a1.65 1.65 0 0 0 1 1.51 1.65 1.65 0 0 0 1.82-.33l.06-.06a2 2 0 0 1 2.83 0 2 2 0 0 1 0 2.83l-.06.06a1.65 1.65 0 0 0-.33 1.82V9a1.65 1.65 0 0 0 1.51 1H21a2 2 0 0 1 2 2 2 2 0 0 1-2 2h-.09a1.65 1.65 0 0 0-1.51 1z"></path>
              </svg>
              Manage Rooms
            </button>
          </div>

        {:else if roomState.modalMode === 'create'}
          <div class="modal-form">
            <div class="form-group">
              <label for="room-name">Room Name</label>
              <input 
                type="text" 
                id="room-name"
                bind:value={roomState.newRoomName} 
                placeholder="Enter room name" 
                class="room-input"
              />
            </div>
            <div class="form-group">
              <label for="room-desc">Description (Optional)</label>
              <input 
                type="text" 
                id="room-desc"
                bind:value={roomState.newRoomDescription} 
                placeholder="Enter room description" 
                class="room-input"
              />
            </div>
            <div class="form-actions">
              <button class="cancel-btn" on:click={goBack}>Back</button>
              <button 
                class="confirm-btn" 
                on:click={handleCreateRoom} 
                disabled={!roomState.newRoomName.trim()}
              >
                Create Room
              </button>
            </div>
          </div>

        {:else if roomState.modalMode === 'private'}
          <div class="modal-form">
            <div class="form-group">
              <label for="private-name">Room Name</label>
              <input 
                type="text" 
                id="private-name"
                bind:value={roomState.newRoomName} 
                placeholder="Enter room name" 
                class="room-input"
              />
            </div>
            <div class="form-group">
              <label for="private-code">10-digit Code (Optional)</label>
              <input 
                type="text" 
                id="private-code"
                bind:value={roomState.privateRoomCode} 
                placeholder="Auto-generated if empty" 
                class="room-input"
                maxlength="10"
                pattern="\d{10}"
              />
              <small class="form-hint">
                <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                  <circle cx="12" cy="12" r="10"></circle>
                  <path d="M9,9h6v6H9V9z M12,17h.01"></path>
                </svg>
                Share this code with others to let them join your private room
              </small>
            </div>
            <div class="form-actions">
              <button class="cancel-btn" on:click={goBack}>Back</button>
              <button 
                class="confirm-btn" 
                on:click={handleCreatePrivateRoom} 
                disabled={!roomState.newRoomName.trim()}
              >
                Create Private Room
              </button>
            </div>
          </div>

        {:else if roomState.modalMode === 'join'}
          <div class="modal-form">
            <div class="form-group">
              <label for="join-code">Private Room Code</label>
              <input 
                type="text" 
                id="join-code"
                bind:value={roomState.joinPrivateRoomCode} 
                placeholder="Enter 10-digit room code" 
                class="room-input"
                maxlength="10"
                pattern="\d{10}"
              />
              <small class="form-hint">
                <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                  <circle cx="12" cy="12" r="10"></circle>
                  <path d="M9,9h6v6H9V9z M12,17h.01"></path>
                </svg>
                Enter the 10-digit code shared by the room creator
              </small>
            </div>
            <div class="form-actions">
              <button class="cancel-btn" on:click={goBack}>Back</button>
              <button 
                class="confirm-btn" 
                on:click={handleJoinPrivateRoom} 
                disabled={!roomState.joinPrivateRoomCode.trim() || roomState.joinPrivateRoomCode.length !== 10 || !/^\d+$/.test(roomState.joinPrivateRoomCode)}
              >
                Join Room
              </button>
            </div>
          </div>

        {:else if roomState.modalMode === 'manage'}
          <div class="manage-rooms">
            <div class="manage-actions">
              <button 
                class="manage-btn refresh-btn {roomState.isDiscovering ? 'loading' : ''}" 
                on:click={handleRefreshRooms}
                disabled={roomState.isDiscovering}
                title="Refresh rooms from blockchain"
              >
                <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" class={roomState.isDiscovering ? 'spinning' : ''}>
                  <polyline points="23 4 23 10 17 10"></polyline>
                  <polyline points="1 20 1 14 7 14"></polyline>
                  <path d="M20.49 9A9 9 0 0 0 5.64 5.64L1 10m22 4l-4.64 4.36A9 9 0 0 1 3.51 15"></path>
                </svg>
                {roomState.isDiscovering ? 'Discovering...' : 'Refresh Rooms'}
              </button>
              
              <button 
                class="manage-btn toggle-btn {roomState.showHiddenRooms ? 'active' : ''}" 
                on:click={() => roomState.showHiddenRooms = !roomState.showHiddenRooms}
              >
                <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                  <path d="M1 12s4-8 11-8 11 8 11 8-4 8-11 8-11-8-11-8z"></path>
                  <circle cx="12" cy="12" r="3"></circle>
                </svg>
                {roomState.showHiddenRooms ? 'Hide Hidden Rooms' : 'Show Hidden Rooms'}
              </button>
            </div>
            
            {#if roomState.isDiscovering}
              <div class="discovery-status">
                <div class="spinner small"></div>
                <span>Discovering rooms from blockchain...</span>
              </div>
            {/if}
            
            <div class="room-stats">
              {#each Object.entries(getRoomStats(allRooms, hiddenRooms)) as [key, value]}
                <div class="stat-row">
                  <span class="stat-label">{key.charAt(0).toUpperCase() + key.slice(1)} Rooms:</span>
                  <span class="stat-value">{value}</span>
                </div>
              {/each}
              
              {#if roomState.lastDiscoveryUpdate > 0}
                <div class="stat-row">
                  <span class="stat-label">Last Discovery:</span>
                  <span class="stat-value">{new Date(roomState.lastDiscoveryUpdate).toLocaleTimeString()}</span>
                </div>
              {/if}
            </div>
            
            <div class="form-actions">
              <button class="cancel-btn" on:click={goBack}>Back</button>
            </div>
          </div>

        {:else if roomState.modalMode === 'info' && roomState.currentModalRoom}
          <div class="room-info-display">
            <h4>{roomState.currentModalRoom.name}</h4>
            <p>{roomState.currentModalRoom.description}</p>
            
            <div class="room-metadata">
              <div class="metadata-row">
                <span class="metadata-label">Type:</span>
                <span class="metadata-value">
                  {#if roomState.currentModalRoom.isPrivate}
                    🔒 Private Room
                    {#if roomState.currentModalRoom.isEncrypted}
                      <span class="encryption-badge">🔐 Encrypted</span>
                    {/if}
                  {:else if roomState.currentModalRoom.isDiscovered}
                    🌎 Discovered Room
                  {:else}
                    📁 Custom Room
                  {/if}
                </span>
              </div>
              
              {#if roomState.currentModalRoom.code}
                <div class="metadata-row">
                  <span class="metadata-label">Code:</span>
                  <span class="metadata-value">{roomState.currentModalRoom.code}</span>
                </div>
              {/if}
              
              {#if roomState.currentModalRoom.messageCount}
                <div class="metadata-row">
                  <span class="metadata-label">Messages:</span>
                  <span class="metadata-value">{roomState.currentModalRoom.messageCount}</span>
                </div>
              {/if}
            </div>
            
            <div class="form-actions">
              <button class="cancel-btn" on:click={goBack}>Back</button>
            </div>
          </div>
        {/if}
      </div>
    </div>
  </div>
{/if}

<style>
  .modal-backdrop {
    position: fixed;
    top: 0;
    left: 0;
    right: 0;
    bottom: 0;
    background: rgba(0, 0, 0, 0.8);
    backdrop-filter: blur(8px);
    display: flex;
    align-items: center;
    justify-content: center;
    z-index: 1000;
    padding: 20px;
  }

  .room-modal {
    background: var(--surface-color, #262626);
    border: 1px solid var(--border-color, rgba(255, 85, 0, 0.2));
    border-radius: 16px;
    max-width: 600px;
    width: 100%;
    max-height: 90vh;
    overflow-y: auto;
    box-shadow: 0 20px 40px rgba(0, 0, 0, 0.4);
  }

  .modal-header {
    padding: 24px 24px 16px;
    border-bottom: 1px solid var(--border-color, rgba(255, 85, 0, 0.1));
    position: relative;
    display: flex;
    align-items: center;
    justify-content: space-between;
  }

  .modal-header h3 {
    margin: 0;
    color: var(--primary-color, #FF5500);
    font-size: 20px;
    font-weight: 700;
  }

  .close-btn {
    background: none;
    border: none;
    color: var(--text-secondary, rgba(255, 255, 255, 0.7));
    cursor: pointer;
    padding: 8px;
    border-radius: 6px;
    transition: all 0.2s ease;
  }

  .close-btn:hover {
    color: var(--text-color, #ffffff);
    background: var(--hover-color, rgba(255, 255, 255, 0.1));
  }

  .modal-body {
    padding: 24px;
  }

  .modal-actions {
    display: grid;
    grid-template-columns: repeat(auto-fit, minmax(200px, 1fr));
    gap: 16px;
  }

  .modal-action-btn {
    display: flex;
    flex-direction: column;
    align-items: center;
    gap: 12px;
    padding: 24px 16px;
    border: 1px solid var(--border-color, rgba(255, 85, 0, 0.2));
    border-radius: 12px;
    background: var(--background-color, #1a1a1a);
    color: var(--text-color, #ffffff);
    cursor: pointer;
    transition: all 0.2s ease;
    text-align: center;
  }

  .modal-action-btn:hover {
    background: var(--hover-color, rgba(255, 255, 255, 0.1));
    border-color: var(--primary-color, #FF5500);
    transform: translateY(-2px);
  }

  .modal-form {
    max-width: 400px;
    margin: 0 auto;
  }

  .form-group {
    margin-bottom: 20px;
  }

  .form-group label {
    display: block;
    margin-bottom: 8px;
    font-weight: 600;
    color: var(--text-color, #ffffff);
    font-size: 14px;
  }

  .room-input {
    width: 100%;
    padding: 12px 16px;
    border: 1px solid var(--border-color, rgba(255, 85, 0, 0.2));
    border-radius: 8px;
    background: var(--background-color, #1a1a1a);
    color: var(--text-color, #ffffff);
    font-size: 14px;
    transition: all 0.2s ease;
  }

  .room-input:focus {
    outline: none;
    border-color: var(--primary-color, #FF5500);
    box-shadow: 0 0 0 3px rgba(255, 85, 0, 0.1);
  }

  .form-hint {
    display: flex;
    align-items: flex-start;
    gap: 6px;
    margin-top: 6px;
    font-size: 12px;
    color: var(--text-secondary, rgba(255, 255, 255, 0.7));
    line-height: 1.4;
  }

  .form-hint svg {
    flex-shrink: 0;
    margin-top: 2px;
  }

  .form-actions {
    display: flex;
    gap: 12px;
    justify-content: center;
    margin-top: 24px;
  }

  .cancel-btn, .confirm-btn {
    padding: 10px 20px;
    border: none;
    border-radius: 8px;
    font-weight: 600;
    cursor: pointer;
    transition: all 0.2s ease;
    font-size: 14px;
  }

  .cancel-btn {
    background: transparent;
    color: var(--text-secondary, rgba(255, 255, 255, 0.7));
    border: 1px solid var(--border-color, rgba(255, 85, 0, 0.2));
  }

  .cancel-btn:hover {
    background: var(--hover-color, rgba(255, 255, 255, 0.1));
    color: var(--text-color, #ffffff);
  }

  .confirm-btn {
    background: linear-gradient(135deg, var(--primary-color, #FF5500), #ff7733);
    color: white;
  }

  .confirm-btn:hover:not(:disabled) {
    background: linear-gradient(135deg, #ff7733, var(--primary-color, #FF5500));
    transform: translateY(-1px);
  }

  .confirm-btn:disabled {
    opacity: 0.6;
    cursor: not-allowed;
  }

  .manage-rooms {
    text-align: center;
  }

  .manage-actions {
    display: flex;
    gap: 12px;
    justify-content: center;
    margin-bottom: 24px;
    flex-wrap: wrap;
  }

  .manage-btn {
    display: flex;
    align-items: center;
    gap: 8px;
    padding: 10px 16px;
    border: 1px solid var(--border-color, rgba(255, 85, 0, 0.2));
    border-radius: 8px;
    background: var(--background-color, #1a1a1a);
    color: var(--text-color, #ffffff);
    cursor: pointer;
    transition: all 0.2s ease;
    font-size: 14px;
    font-weight: 500;
  }

  .manage-btn:hover:not(:disabled) {
    background: var(--hover-color, rgba(255, 255, 255, 0.1));
    border-color: var(--primary-color, #FF5500);
  }

  .manage-btn:disabled {
    opacity: 0.6;
    cursor: not-allowed;
  }

  .manage-btn.active {
    background: var(--primary-color, #FF5500);
    color: white;
    border-color: var(--primary-color, #FF5500);
  }

  .spinner {
    width: 16px;
    height: 16px;
    border: 2px solid rgba(255, 255, 255, 0.3);
    border-top-color: var(--primary-color, #FF5500);
    border-radius: 50%;
    animation: spin 1s linear infinite;
  }

  .spinner.small {
    width: 14px;
    height: 14px;
  }

  .spinning {
    animation: spin 1s linear infinite;
  }

  @keyframes spin {
    to { transform: rotate(360deg); }
  }

  .discovery-status {
    display: flex;
    align-items: center;
    justify-content: center;
    gap: 12px;
    padding: 16px;
    background: var(--background-color, #1a1a1a);
    border-radius: 8px;
    margin-bottom: 20px;
    color: var(--text-secondary, rgba(255, 255, 255, 0.7));
  }

  .room-stats {
    background: var(--background-color, #1a1a1a);
    border-radius: 8px;
    padding: 20px;
    margin-bottom: 20px;
  }

  .stat-row {
    display: flex;
    justify-content: space-between;
    align-items: center;
    margin-bottom: 8px;
    font-size: 14px;
  }

  .stat-row:last-child {
    margin-bottom: 0;
  }

  .stat-label {
    color: var(--text-secondary, rgba(255, 255, 255, 0.7));
  }

  .stat-value {
    color: var(--primary-color, #FF5500);
    font-weight: 600;
  }

  .room-info-display h4 {
    margin: 0 0 12px 0;
    color: var(--primary-color, #FF5500);
    font-size: 18px;
  }

  .room-info-display p {
    margin: 0 0 20px 0;
    color: var(--text-secondary, rgba(255, 255, 255, 0.7));
    line-height: 1.5;
  }

  .room-metadata {
    background: var(--background-color, #1a1a1a);
    border-radius: 8px;
    padding: 16px;
    margin-bottom: 20px;
  }

  .metadata-row {
    display: flex;
    justify-content: space-between;
    align-items: center;
    margin-bottom: 12px;
    font-size: 14px;
  }

  .metadata-row:last-child {
    margin-bottom: 0;
  }

  .metadata-label {
    color: var(--text-secondary, rgba(255, 255, 255, 0.7));
    font-weight: 500;
  }

  .metadata-value {
    color: var(--text-color, #ffffff);
    font-weight: 600;
    display: flex;
    align-items: center;
    gap: 8px;
  }

  .encryption-badge {
    background: linear-gradient(135deg, #F59E0B 0%, #D97706 100%);
    color: white;
    padding: 2px 6px;
    border-radius: 4px;
    font-size: 10px;
    font-weight: 700;
    text-transform: uppercase;
    letter-spacing: 0.5px;
  }

  /* Responsive design */
  @media (max-width: 600px) {
    .modal-backdrop {
      padding: 16px;
    }

    .room-modal {
      max-width: none;
      width: 100%;
    }

    .modal-header {
      padding: 20px 20px 16px;
    }

    .modal-body {
      padding: 20px;
    }

    .modal-actions {
      grid-template-columns: 1fr;
    }

    .manage-actions {
      flex-direction: column;
    }

    .form-actions {
      flex-direction: column;
    }
  }
</style>