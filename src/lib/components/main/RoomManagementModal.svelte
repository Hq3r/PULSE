<!-- RoomManagementModal.svelte -->
<script>
  import { createEventDispatcher } from 'svelte';
  import { slide } from 'svelte/transition';
  
  export let roomState = {};
  export let loading = false;
  export let error = "";
  
  const dispatch = createEventDispatcher();
  
  function handleClose() {
    dispatch('close');
  }
  
  function handleCreateRoom() {
    dispatch('createRoom');
  }
  
  function handleCreatePrivateRoom() {
    dispatch('createPrivateRoom');
  }
  
  function handleJoinPrivateRoom() {
    dispatch('joinPrivateRoom');
  }
  
  function handleKeyPress(event) {
    if (event.key === 'Enter' && !event.shiftKey) {
      event.preventDefault();
      if (roomState.modalMode === 'create') {
        handleCreateRoom();
      } else if (roomState.modalMode === 'createPrivate') {
        handleCreatePrivateRoom();
      } else if (roomState.modalMode === 'join') {
        handleJoinPrivateRoom();
      }
    }
  }
  
  function generateRandomRoomCode() {
    const chars = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789';
    let result = '';
    for (let i = 0; i < 8; i++) {
      result += chars.charAt(Math.floor(Math.random() * chars.length));
    }
    roomState.newRoomName = result;
  }
</script>

{#if roomState.showModal}
  <div class="modal-overlay" on:click={handleClose}>
    <div class="modal-container" on:click|stopPropagation>
      <div class="modal-header">
        {#if roomState.modalMode === 'create'}
          <h2>📝 Create Room</h2>
          <p>Create a new public chatroom</p>
        {:else if roomState.modalMode === 'createPrivate'}
          <h2>🔒 Create Private Room</h2>
          <p>Create a private room with a custom code</p>
        {:else if roomState.modalMode === 'join'}
          <h2>🚪 Join Private Room</h2>
          <p>Enter the room code to join</p>
        {:else if roomState.modalMode === 'info' && roomState.modalRoom}
          <h2>ℹ️ Room Information</h2>
          <p>{roomState.modalRoom.name}</p>
        {/if}
        
        <button class="close-btn" on:click={handleClose}>
          <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
            <line x1="18" y1="6" x2="6" y2="18"></line>
            <line x1="6" y1="6" x2="18" y2="18"></line>
          </svg>
        </button>
      </div>
      
      <div class="modal-content">
        {#if roomState.modalMode === 'create'}
          <div class="input-group">
            <label for="roomName">Room Name</label>
            <input
              id="roomName"
              type="text"
              bind:value={roomState.newRoomName}
              placeholder="Enter room name..."
              on:keydown={handleKeyPress}
              disabled={loading}
              class="room-input"
            />
          </div>
          
          <div class="modal-actions">
            <button 
              class="btn btn-primary" 
              on:click={handleCreateRoom} 
              disabled={!roomState.newRoomName?.trim() || loading}
            >
              {#if loading}
                <div class="spinner"></div>
                Creating...
              {:else}
                <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                  <path d="M12 5v14m7-7H5"></path>
                </svg>
                Create Room
              {/if}
            </button>
          </div>
          
        {:else if roomState.modalMode === 'createPrivate'}
          <div class="input-group">
            <label for="privateRoomName">Room Code</label>
            <div class="input-with-button">
              <input
                id="privateRoomName"
                type="text"
                bind:value={roomState.newRoomName}
                placeholder="Enter room code (8 characters)..."
                on:keydown={handleKeyPress}
                disabled={loading}
                class="room-input"
                maxlength="8"
              />
              <button 
                type="button" 
                class="btn btn-outline btn-small" 
                on:click={generateRandomRoomCode}
                disabled={loading}
              >
                🎲 Random
              </button>
            </div>
            <small class="input-help">Room codes should be 8 characters (letters and numbers)</small>
          </div>
          
          <div class="modal-actions">
            <button 
              class="btn btn-primary" 
              on:click={handleCreatePrivateRoom} 
              disabled={!roomState.newRoomName?.trim() || loading}
            >
              {#if loading}
                <div class="spinner"></div>
                Creating...
              {:else}
                <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                  <rect x="3" y="11" width="18" height="11" rx="2" ry="2"></rect>
                  <circle cx="12" cy="16" r="1"></circle>
                  <path d="M7 11V7a5 5 0 0 1 10 0v4"></path>
                </svg>
                Create Private Room
              {/if}
            </button>
          </div>
          
        {:else if roomState.modalMode === 'join'}
          <div class="input-group">
            <label for="joinCode">Room Code</label>
            <input
              id="joinCode"
              type="text"
              bind:value={roomState.joinPrivateRoomCode}
              placeholder="Enter 8-character room code..."
              on:keydown={handleKeyPress}
              disabled={loading}
              class="room-input"
              maxlength="8"
              style="text-transform: uppercase;"
            />
            <small class="input-help">Enter the 8-character code shared by the room creator</small>
          </div>
          
          <div class="modal-actions">
            <button 
              class="btn btn-primary" 
              on:click={handleJoinPrivateRoom} 
              disabled={!roomState.joinPrivateRoomCode?.trim() || loading}
            >
              {#if loading}
                <div class="spinner"></div>
                Joining...
              {:else}
                <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                  <path d="M15 3h4a2 2 0 0 1 2 2v14a2 2 0 0 1-2 2h-4"></path>
                  <polyline points="10,17 15,12 10,7"></polyline>
                  <line x1="15" y1="12" x2="3" y2="12"></line>
                </svg>
                Join Room
              {/if}
            </button>
          </div>
          
        {:else if roomState.modalMode === 'info' && roomState.modalRoom}
          <div class="room-info" transition:slide>
            <div class="info-item">
              <strong>Room ID:</strong> 
              <code>{roomState.modalRoom.id}</code>
            </div>
            
            {#if roomState.modalRoom.description}
              <div class="info-item">
                <strong>Description:</strong> 
                <span>{roomState.modalRoom.description}</span>
              </div>
            {/if}
            
            <div class="info-item">
              <strong>Type:</strong> 
              <span class="room-type {roomState.modalRoom.type}">
                {#if roomState.modalRoom.type === 'private'}
                  🔒 Private
                {:else if roomState.modalRoom.type === 'custom'}
                  📝 Custom
                {:else if roomState.modalRoom.isDiscovered}
                  🔍 Discovered
                {:else}
                  🌐 Public
                {/if}
              </span>
            </div>
            
            {#if roomState.modalRoom.type === 'private'}
              <div class="info-item">
                <strong>Room Code:</strong> 
                <code class="room-code">{roomState.modalRoom.id}</code>
                <button 
                  class="btn btn-outline btn-small" 
                  on:click={() => navigator.clipboard.writeText(roomState.modalRoom.id)}
                >
                  📋 Copy
                </button>
              </div>
            {/if}
            
            <div class="info-item">
              <strong>Created:</strong> 
              <span>{new Date(roomState.modalRoom.created || Date.now()).toLocaleDateString()}</span>
            </div>
          </div>
        {/if}
        
        {#if error}
          <div class="error-message">
            <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
              <circle cx="12" cy="12" r="10"></circle>
              <line x1="15" y1="9" x2="9" y2="15"></line>
              <line x1="9" y1="9" x2="15" y2="15"></line>
            </svg>
            {error}
          </div>
        {/if}
      </div>
    </div>
  </div>
{/if}

<style>
  /* CSS Custom Properties */
  :root {
    /* Ergo Brand Colors */
    --ergo-orange: #FF5500;
    --ergo-orange-light: #FF7733;
    --ergo-orange-dark: #CC4400;
    --ergo-orange-alpha: rgba(255, 85, 0, 0.1);
    
    /* Light Theme Colors */
    --light-bg-primary: #FFFFFF;
    --light-bg-secondary: #F8F9FA;
    --light-bg-tertiary: #F1F3F4;
    --light-surface: #FFFFFF;
    --light-surface-elevated: #FFFFFF;
    --light-border: #E1E5E9;
    --light-border-strong: #C4CDD5;
    --light-text-primary: #1F2328;
    --light-text-secondary: #656D76;
    --light-text-muted: #8B949E;
    
    /* Dark Theme Colors */
    --dark-bg-primary: #0D1117;
    --dark-bg-secondary: #161B22;
    --dark-bg-tertiary: #21262D;
    --dark-surface: #161B22;
    --dark-surface-elevated: #21262D;
    --dark-border: #30363D;
    --dark-border-strong: #484F58;
    --dark-text-primary: #F0F6FC;
    --dark-text-secondary: #C9D1D9;
    --dark-text-muted: #8B949E;
    
    /* Semantic Colors */
    --success: #28A745;
    --error: #DC3545;
    --warning: #FFC107;
    --info: #17A2B8;
    
    /* Spacing */
    --space-xs: 0.25rem;
    --space-sm: 0.5rem;
    --space-md: 1rem;
    --space-lg: 1.5rem;
    --space-xl: 2rem;
    --space-2xl: 3rem;
    
    /* Border Radius */
    --radius-sm: 0.375rem;
    --radius-md: 0.5rem;
    --radius-lg: 0.75rem;
    --radius-xl: 1rem;
    
    /* Shadows */
    --shadow-sm: 0 1px 2px 0 rgba(0, 0, 0, 0.05);
    --shadow-md: 0 4px 6px -1px rgba(0, 0, 0, 0.1), 0 2px 4px -1px rgba(0, 0, 0, 0.06);
    --shadow-lg: 0 10px 15px -3px rgba(0, 0, 0, 0.1), 0 4px 6px -2px rgba(0, 0, 0, 0.05);
    --shadow-xl: 0 20px 25px -5px rgba(0, 0, 0, 0.1), 0 10px 10px -5px rgba(0, 0, 0, 0.04);
    
    /* Typography */
    --font-family-sans: 'Inter', -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif;
    --font-family-mono: 'SF Mono', Monaco, 'Cascadia Code', 'Roboto Mono', monospace;
    
    /* Transitions */
    --transition-fast: 150ms ease;
    --transition-base: 250ms ease;
    --transition-slow: 350ms ease;
    
    /* Default to dark theme */
    --bg-primary: var(--dark-bg-primary);
    --bg-secondary: var(--dark-bg-secondary);
    --bg-tertiary: var(--dark-bg-tertiary);
    --surface: var(--dark-surface);
    --surface-elevated: var(--dark-surface-elevated);
    --border: var(--dark-border);
    --border-strong: var(--dark-border-strong);
    --text-primary: var(--dark-text-primary);
    --text-secondary: var(--dark-text-secondary);
    --text-muted: var(--dark-text-muted);
  }

  /* Modal Styles */
  .modal-overlay {
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
    padding: var(--space-lg);
  }

  .modal-container {
    background: var(--surface-elevated);
    border-radius: var(--radius-xl);
    padding: var(--space-2xl);
    max-width: 500px;
    width: 100%;
    border: 2px solid var(--ergo-orange);
    box-shadow: var(--shadow-xl);
    position: relative;
    max-height: 90vh;
    overflow-y: auto;
  }

  .modal-header {
    text-align: center;
    margin-bottom: var(--space-xl);
    position: relative;
  }

  .modal-header h2 {
    margin: 0 0 var(--space-sm) 0;
    font-size: 1.75rem;
    color: var(--ergo-orange);
    font-weight: 700;
  }

  .modal-header p {
    margin: 0;
    color: var(--text-secondary);
    font-size: 1rem;
  }

  .close-btn {
    position: absolute;
    top: -8px;
    right: -8px;
    background: var(--surface);
    border: 1px solid var(--border);
    color: var(--text-secondary);
    cursor: pointer;
    border-radius: 50%;
    transition: all var(--transition-fast);
    width: 36px;
    height: 36px;
    display: flex;
    align-items: center;
    justify-content: center;
  }

  .close-btn:hover {
    background: var(--ergo-orange-alpha);
    color: var(--ergo-orange);
    border-color: var(--ergo-orange);
  }

  .modal-content {
    display: flex;
    flex-direction: column;
    gap: var(--space-lg);
  }

  .input-group {
    display: flex;
    flex-direction: column;
    gap: var(--space-sm);
  }

  .input-group label {
    font-weight: 500;
    color: var(--text-primary);
    font-size: 0.875rem;
  }

  .room-input {
    width: 100%;
    background: var(--surface);
    color: var(--text-primary);
    border: 2px solid var(--border);
    border-radius: var(--radius-lg);
    padding: var(--space-md);
    font-size: 0.875rem;
    transition: all var(--transition-fast);
    box-sizing: border-box;
  }

  .room-input:focus {
    outline: none;
    border-color: var(--ergo-orange);
    box-shadow: 0 0 0 4px var(--ergo-orange-alpha);
  }

  .room-input::placeholder {
    color: var(--text-muted);
  }

  .input-with-button {
    display: flex;
    gap: var(--space-sm);
    align-items: stretch;
  }

  .input-with-button .room-input {
    flex: 1;
  }

  .input-help {
    color: var(--text-muted);
    font-size: 0.75rem;
    font-style: italic;
  }

  .modal-actions {
    display: flex;
    justify-content: center;
  }

  .modal-actions .btn {
    min-width: 140px;
    padding: var(--space-md) var(--space-xl);
  }

  /* Room Info Styles */
  .room-info {
    display: flex;
    flex-direction: column;
    gap: var(--space-md);
  }

  .info-item {
    display: flex;
    align-items: center;
    gap: var(--space-sm);
    padding: var(--space-sm) var(--space-md);
    background: var(--surface);
    border-radius: var(--radius-md);
    border: 1px solid var(--border);
    flex-wrap: wrap;
  }

  .info-item strong {
    color: var(--text-primary);
    min-width: 80px;
    font-size: 0.875rem;
  }

  .info-item code {
    background: var(--ergo-orange-alpha);
    color: var(--ergo-orange);
    padding: 2px 6px;
    border-radius: var(--radius-sm);
    font-size: 0.8em;
    font-weight: 600;
    font-family: var(--font-family-mono);
  }

  .room-code {
    font-size: 1rem !important;
    padding: var(--space-xs) var(--space-sm) !important;
    letter-spacing: 2px;
  }

  .room-type {
    padding: 2px 8px;
    border-radius: var(--radius-sm);
    font-size: 0.75rem;
    font-weight: 600;
  }

  .room-type.private {
    background: rgba(220, 53, 69, 0.1);
    color: #dc3545;
  }

  .room-type.custom {
    background: var(--ergo-orange-alpha);
    color: var(--ergo-orange);
  }

  /* Button Styles */
  .btn {
    display: inline-flex;
    align-items: center;
    justify-content: center;
    gap: var(--space-xs);
    padding: var(--space-sm) var(--space-md);
    border-radius: var(--radius-md);
    font-size: 0.875rem;
    font-weight: 500;
    cursor: pointer;
    transition: all var(--transition-fast);
    border: 1px solid transparent;
    text-decoration: none;
    white-space: nowrap;
    font-family: inherit;
  }

  .btn:disabled {
    opacity: 0.5;
    cursor: not-allowed;
    transform: none !important;
  }

  .btn-primary {
    background: linear-gradient(135deg, var(--ergo-orange), var(--ergo-orange-light));
    color: white;
    border-color: var(--ergo-orange);
  }

  .btn-primary:hover:not(:disabled) {
    background: linear-gradient(135deg, var(--ergo-orange-light), var(--ergo-orange));
    transform: translateY(-1px);
    box-shadow: var(--shadow-md);
  }

  .btn-outline {
    background: transparent;
    color: var(--text-secondary);
    border-color: var(--border);
  }

  .btn-outline:hover:not(:disabled) {
    background: var(--ergo-orange-alpha);
    color: var(--ergo-orange);
    border-color: var(--ergo-orange);
  }

  .btn-small {
    padding: var(--space-xs) var(--space-sm);
    font-size: 0.75rem;
  }

  .error-message {
    background: rgba(220, 53, 69, 0.1);
    border: 1px solid rgba(220, 53, 69, 0.3);
    color: var(--error);
    border-radius: var(--radius-md);
    padding: var(--space-md);
    font-size: 0.875rem;
    display: flex;
    align-items: center;
    gap: var(--space-sm);
  }

  .spinner {
    border: 2px solid var(--border);
    border-top-color: white;
    border-radius: 50%;
    width: 16px;
    height: 16px;
    animation: spin 1s linear infinite;
  }

  @keyframes spin {
    to { transform: rotate(360deg); }
  }

  /* Responsive Design */
  @media (max-width: 768px) {
    .modal-container {
      margin: var(--space-md);
      padding: var(--space-lg);
      max-width: calc(100vw - 2rem);
    }

    .modal-header h2 {
      font-size: 1.5rem;
    }

    .input-with-button {
      flex-direction: column;
    }

    .input-with-button .room-input {
      margin-bottom: var(--space-sm);
    }

    .btn-small {
      align-self: flex-start;
    }

    .info-item {
      flex-direction: column;
      align-items: flex-start;
    }

    .info-item strong {
      min-width: auto;
    }
  }

  @media (max-width: 480px) {
    .modal-container {
      padding: var(--space-md);
    }

    .modal-header h2 {
      font-size: 1.25rem;
    }

    .btn {
      padding: var(--space-sm) var(--space-md);
      font-size: 0.8rem;
    }

    .modal-actions .btn {
      min-width: 120px;
      padding: var(--space-sm) var(--space-lg);
    }
  }

  /* High Contrast Mode */
  @media (prefers-contrast: high) {
    .btn-outline:hover {
      background: var(--ergo-orange);
      color: white;
    }

    .room-input {
      border-width: 3px;
    }

    .room-input:focus {
      border-width: 3px;
    }
  }

  /* Reduced Motion */
  @media (prefers-reduced-motion: reduce) {
    * {
      animation-duration: 0.01ms !important;
      animation-iteration-count: 1 !important;
      transition-duration: 0.01ms !important;
    }

    .btn:hover:not(:disabled) {
      transform: none;
    }

    .spinner {
      animation: none;
    }
  }
</style>