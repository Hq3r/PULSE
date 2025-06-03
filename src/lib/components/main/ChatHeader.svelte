<!-- ChatHeader.svelte - Fully Responsive with StealthAddressUI -->
<script>
  import { createEventDispatcher, onMount } from 'svelte';
  import { slide, fade } from 'svelte/transition';
  import WalletButton from '$lib/components/nav/WalletButton.svelte';
  import StealthAddressUI from '$lib/components/main/StealthAddressUI.svelte';
  import { truncateAddress } from '$lib/utils/chatConstants.js';
  
  export let currentRoom = null;
  export let messages = [];
  export let showRoomList = false;
  export let roomCategories = [];
  export let selectedChatroom = "";
  export let walletConnected = false;
  export let walletState = {};
  export let currentWalletAddress = "";
  export let isDarkMode = true;
  export let loading = false;
  export let stealthMode = { active: false, displayName: '' };
  export let kyaAccepted = false;
  export let getUnreadCount = () => 0;
  export let roomHasUnread = () => false;
  
  const dispatch = createEventDispatcher();
  
  // Mobile menu state
  let showMobileMenu = false;
  let showWalletMenu = false;
  let isMobile = false;
  let isTablet = false;
  
  // Responsive breakpoints
  function checkScreenSize() {
    if (typeof window !== 'undefined') {
      isMobile = window.innerWidth < 768;
      isTablet = window.innerWidth >= 768 && window.innerWidth < 1024;
    }
  }
  
  onMount(() => {
    checkScreenSize();
    window.addEventListener('resize', checkScreenSize);
    return () => window.removeEventListener('resize', checkScreenSize);
  });
  
  // Event handlers
  function selectChatroom(roomId) {
    showRoomList = false;
    showMobileMenu = false;
    dispatch('selectChatroom', { roomId });
  }
  
  function handleShowRoomInfo(room, event) {
    event?.stopPropagation();
    dispatch('showRoomInfo', { room, event });
  }
  
  function handleToggleRoomVisibility(roomId, event) {
    event?.stopPropagation();
    dispatch('toggleRoomVisibility', { roomId, event });
  }
  
  function handleRenameRoom(roomId, event) {
    event?.stopPropagation();
    dispatch('renameRoom', { roomId, event });
  }
  
  function handleRemoveRoom(roomId, event) {
    event?.stopPropagation();
    dispatch('removeRoom', { roomId, event });
  }
  
  function handleCopyRoomCode(roomId, event) {
    event?.stopPropagation();
    dispatch('copyRoomCode', { roomId, event });
  }
  
  function openRoomManagementModal(mode) {
    showMobileMenu = false;
    showRoomList = false;
    dispatch('openRoomModal', { mode });
  }
  
  function handleForceRefreshRooms() {
    dispatch('forceRefreshRooms');
  }
  
  function handleToggleTheme() {
    dispatch('toggleTheme');
  }
  
  function handleToggleCompactMode() {
    dispatch('toggleCompactMode');
  }
  
  function openMnemonicModal() {
    if (!kyaAccepted) {
      dispatch('showKYA');
      return;
    }
    showWalletMenu = false;
    showMobileMenu = false;
    dispatch('openMnemonicModal');
  }
  
  function handleDisconnectWallet() {
    showWalletMenu = false;
    showMobileMenu = false;
    dispatch('disconnectWallet');
  }
  
  function handleStealthModeChanged(event) {
    dispatch('stealthModeChanged', event);
  }
  
  function toggleRoomList() {
    if (isMobile) {
      showMobileMenu = !showMobileMenu;
      showRoomList = false;
    } else {
      showRoomList = !showRoomList;
      showMobileMenu = false;
    }
    dispatch('toggleRoomList', { showRoomList: showRoomList || showMobileMenu });
  }
  
  function toggleMobileMenu() {
    showMobileMenu = !showMobileMenu;
    showRoomList = false;
    showWalletMenu = false;
  }
  
  function toggleWalletMenu() {
    showWalletMenu = !showWalletMenu;
  }
  
  // Close menus when clicking outside
  function handleClickOutside(event) {
    const header = event.target.closest('.chat-header');
    if (!header) {
      showRoomList = false;
      showMobileMenu = false;
      showWalletMenu = false;
    }
  }
</script>

<svelte:window on:click={handleClickOutside} />

<header class="chat-header" class:mobile={isMobile} class:tablet={isTablet}>
  <!-- Mobile Header -->
  {#if isMobile}
    <div class="mobile-header">
      <!-- Left: Menu Button + Room Info -->
      <div class="mobile-left">
        <button class="mobile-menu-btn" on:click={toggleMobileMenu} class:active={showMobileMenu}>
          <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
            {#if showMobileMenu}
              <line x1="18" y1="6" x2="6" y2="18"></line>
              <line x1="6" y1="6" x2="18" y2="18"></line>
            {:else}
              <line x1="3" y1="6" x2="21" y2="6"></line>
              <line x1="3" y1="12" x2="21" y2="12"></line>
              <line x1="3" y1="18" x2="21" y2="18"></line>
            {/if}
          </svg>
        </button>
        
        <div class="mobile-room-info" on:click={toggleRoomList}>
          <span class="room-icon">{currentRoom?.isPrivate ? '🔒' : '#'}</span>
          <div class="room-details">
            <span class="room-name">{currentRoom?.name || 'General'}</span>
            {#if messages.length > 0}
              <span class="message-count">{messages.length} messages</span>
            {/if}
          </div>
          {#if roomHasUnread(selectedChatroom)}
            <div class="unread-badge mobile">
              {getUnreadCount(selectedChatroom)}
            </div>
          {/if}
        </div>
      </div>
      
      <!-- Right: Logo + Stealth + Wallet -->
      <div class="mobile-right">
        <div class="mobile-logo">
          <svg width="24" height="24" viewBox="0 0 24 24" fill="currentColor">
            <path d="M12 2L2 7l10 5 10-5-10-5zM2 17l10 5 10-5M2 12l10 5 10-5"/>
          </svg>
          <span>Pulse</span>
        </div>
        
        <!-- Mobile Stealth UI -->
        {#if walletConnected}
          <div class="mobile-stealth">
            <StealthAddressUI 
              {walletConnected} 
              currentAddress={currentWalletAddress}
              compact={true}
              on:stealthModeChanged={handleStealthModeChanged}
            />
          </div>
        {/if}
        
        {#if walletConnected}
          <button class="mobile-wallet-btn connected" on:click={toggleWalletMenu}>
            <div class="wallet-avatar">
              {#if walletState.usingMnemonicWallet}
                <svg width="16" height="16" viewBox="0 0 24 24" fill="currentColor">
                  <path d="M6 2h12a2 2 0 0 1 2 2v16a2 2 0 0 1-2 2H6a2 2 0 0 1-2-2V4a2 2 0 0 1 2-2z"/>
                </svg>
              {:else}
                <svg width="16" height="16" viewBox="0 0 24 24" fill="currentColor">
                  <path d="M13.78 4.22a.75.75 0 0 1 0 1.06l-7.25 7.25a.75.75 0 0 1-1.06 0L2.22 9.28a.75.75 0 0 1 1.06-1.06L6 11.94l6.72-6.72a.75.75 0 0 1 1.06 0z"/>
                </svg>
              {/if}
            </div>
            <span class="wallet-address">{truncateAddress(currentWalletAddress, 4, 2)}</span>
            <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
              <polyline points="6,9 12,15 18,9"></polyline>
            </svg>
          </button>
        {:else}
          <button class="mobile-wallet-btn" on:click={openMnemonicModal}>
            <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
              <circle cx="12" cy="12" r="3"></circle>
              <path d="M12 1v6m0 6v6"></path>
            </svg>
            <span>Connect</span>
          </button>
        {/if}
      </div>
    </div>

    <!-- Mobile Menu Overlay -->
    {#if showMobileMenu}
      <div class="mobile-menu-overlay" transition:fade={{ duration: 200 }}>
        <div class="mobile-menu" transition:slide={{ duration: 300, y: -20 }}>
          <!-- Quick Actions -->
          <div class="mobile-section">
            <h3>Quick Actions</h3>
            <div class="mobile-actions">
              <button class="mobile-action-btn" on:click={() => openRoomManagementModal('create')}>
                <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                  <path d="M12 5v14m7-7H5"></path>
                </svg>
                <span>Create Room</span>
              </button>
              
              <button class="mobile-action-btn" on:click={() => openRoomManagementModal('createPrivate')}>
                <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                  <rect x="3" y="11" width="18" height="11" rx="2" ry="2"></rect>
                  <circle cx="12" cy="16" r="1"></circle>
                  <path d="M7 11V7a5 5 0 0 1 10 0v4"></path>
                </svg>
                <span>Private Room</span>
              </button>
              
              <button class="mobile-action-btn" on:click={() => openRoomManagementModal('join')}>
                <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                  <path d="M15 3h4a2 2 0 0 1 2 2v14a2 2 0 0 1-2 2h-4"></path>
                  <polyline points="10,17 15,12 10,7"></polyline>
                  <line x1="15" y1="12" x2="3" y2="12"></line>
                </svg>
                <span>Join Room</span>
              </button>
              
              <button class="mobile-action-btn" on:click={handleToggleTheme}>
                <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                  {#if isDarkMode}
                    <circle cx="12" cy="12" r="5"></circle>
                    <line x1="12" y1="1" x2="12" y2="3"></line>
                    <line x1="12" y1="21" x2="12" y2="23"></line>
                    <line x1="4.22" y1="4.22" x2="5.64" y2="5.64"></line>
                    <line x1="18.36" y1="18.36" x2="19.78" y2="19.78"></line>
                    <line x1="1" y1="12" x2="3" y2="12"></line>
                    <line x1="21" y1="12" x2="23" y2="12"></line>
                    <line x1="4.22" y1="19.78" x2="5.64" y2="18.36"></line>
                    <line x1="18.36" y1="5.64" x2="19.78" y2="4.22"></line>
                  {:else}
                    <path d="M21 12.79A9 9 0 1 1 11.21 3 7 7 0 0 0 21 12.79z"></path>
                  {/if}
                </svg>
                <span>{isDarkMode ? 'Light' : 'Dark'} Mode</span>
              </button>
            </div>
          </div>

          <!-- Rooms List -->
          <div class="mobile-section">
            <div class="section-header">
              <h3>Rooms</h3>
              <button class="refresh-btn" on:click={handleForceRefreshRooms} disabled={loading || !walletConnected}>
                <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" class:spin={loading}>
                  <polyline points="23,4 23,10 17,10"></polyline>
                  <polyline points="1,20 1,14 7,14"></polyline>
                  <path d="M20.49,9A9,9,0,0,0,5.64,5.64L1,10m22,4a9,9,0,0,1-14.85,4.36L23,14"></path>
                </svg>
              </button>
            </div>
            
            <div class="mobile-rooms">
              {#each roomCategories as category}
                {#if category.rooms.length > 0}
                  <div class="mobile-room-category">
                    <div class="category-label">{category.name} ({category.rooms.length})</div>
                    {#each category.rooms as room}
                      <button 
                        class="mobile-room-item {selectedChatroom === room.id ? 'active' : ''} {roomHasUnread(room.id) ? 'has-unread' : ''}"
                        on:click={() => selectChatroom(room.id)}
                      >
                        <div class="room-main">
                          <span class="room-icon">
                            {#if room.type === 'private' || room.isPrivate}🔒
                            {:else if room.type === 'custom'}📝
                            {:else if room.isDiscovered}🔍
                            {:else}#
                            {/if}
                          </span>
                          <div class="room-info">
                            <span class="room-name">{room.name}</span>
                            {#if room.description}
                              <span class="room-description">{room.description}</span>
                            {/if}
                          </div>
                          {#if getUnreadCount(room.id) > 0 && room.id !== selectedChatroom}
                            <div class="unread-badge">
                              {getUnreadCount(room.id)}
                            </div>
                          {/if}
                        </div>
                        <div class="room-actions">
                          <button class="action-btn" on:click={(e) => handleShowRoomInfo(room, e)}>
                            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                              <circle cx="12" cy="12" r="10"></circle>
                              <path d="M9,9h6v6H9V9z M12,17h.01"></path>
                            </svg>
                          </button>
                        </div>
                      </button>
                    {/each}
                  </div>
                {/if}
              {/each}
            </div>
          </div>
        </div>
      </div>
    {/if}

    <!-- Mobile Wallet Menu -->
    {#if showWalletMenu && walletConnected}
      <div class="mobile-wallet-menu" transition:slide={{ duration: 200 }}>
        <div class="wallet-info-full">
          <div class="wallet-details">
            <span class="wallet-address-full">{currentWalletAddress}</span>
            <span class="wallet-type">{walletState.usingMnemonicWallet ? 'Imported Wallet' : 'Extension Wallet'}</span>
            {#if stealthMode.active}
              <span class="stealth-mode">🎭 Anonymous as {stealthMode.displayName}</span>
            {/if}
          </div>
          <div class="wallet-actions">
            <button class="wallet-action-btn" on:click={handleDisconnectWallet}>
              <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                <path d="M9 21H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h4"></path>
                <polyline points="16,17 21,12 16,7"></polyline>
                <line x1="21" y1="12" x2="9" y2="12"></line>
              </svg>
              Disconnect
            </button>
          </div>
        </div>
      </div>
    {/if}

    <!-- Room List for Mobile -->
    {#if showRoomList && !showMobileMenu}
      <div class="mobile-room-dropdown" transition:slide={{ duration: 200 }}>
        {#each roomCategories as category}
          {#if category.rooms.length > 0}
            <div class="mobile-room-category">
              <div class="category-label">{category.name}</div>
              {#each category.rooms as room}
                <button 
                  class="mobile-room-item {selectedChatroom === room.id ? 'active' : ''} {roomHasUnread(room.id) ? 'has-unread' : ''}"
                  on:click={() => selectChatroom(room.id)}
                >
                  <span class="room-icon">
                    {#if room.type === 'private' || room.isPrivate}🔒
                    {:else if room.type === 'custom'}📝
                    {:else if room.isDiscovered}🔍
                    {:else}#
                    {/if}
                  </span>
                  <span class="room-name">{room.name}</span>
                  {#if getUnreadCount(room.id) > 0 && room.id !== selectedChatroom}
                    <div class="unread-badge">
                      {getUnreadCount(room.id)}
                    </div>
                  {/if}
                </button>
              {/each}
            </div>
          {/if}
        {/each}
      </div>
    {/if}

  <!-- Desktop/Tablet Header -->
  {:else}
    <div class="desktop-header">
      <div class="header-left">
        <div class="logo">
          <svg width="32" height="32" viewBox="0 0 24 24" fill="currentColor">
            <path d="M12 2L2 7l10 5 10-5-10-5zM2 17l10 5 10-5M2 12l10 5 10-5"/>
          </svg>
          <div class="logo-text">
            <h1>Pulse</h1>
            <span class="subtitle">Decentralized Messaging</span>
          </div>
        </div>
        
        <!-- Room Selector with Dropdown -->
        <div class="chatroom-selector">
          <button 
            class="room-selector-btn" 
            on:click={toggleRoomList}
            class:active={showRoomList}
          >
            <span class="room-icon">{currentRoom?.isPrivate ? '🔒' : '#'}</span>
            <span class="room-name">{currentRoom?.name || 'General'}</span>
            <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" class="dropdown-arrow {showRoomList ? 'rotated' : ''}">
              <polyline points="6,9 12,15 18,9"></polyline>
            </svg>
            {#if messages.length > 0}
              <span class="message-count">{messages.length}</span>
            {/if}
            {#if roomHasUnread(selectedChatroom)}
              <div class="unread-badge desktop">
                {getUnreadCount(selectedChatroom)}
              </div>
            {/if}
          </button>

          {#if showRoomList}
            <div class="room-dropdown" transition:slide={{ duration: 200 }}>
              <!-- Room Categories -->
              {#each roomCategories as category}
                {#if category.rooms.length > 0}
                  <div class="room-category">
                    <div class="category-header">
                      <span class="category-name">{category.name}</span>
                      <span class="category-count">({category.rooms.length})</span>
                    </div>
                    
                    {#each category.rooms as room}
                      <button 
                        class="room-item {selectedChatroom === room.id ? 'active' : ''} {roomHasUnread(room.id) ? 'has-unread' : ''}"
                        on:click={() => selectChatroom(room.id)}
                      >
                        <div class="room-main">
                          <span class="room-icon">
                            {#if room.type === 'private' || room.isPrivate}🔒
                            {:else if room.type === 'custom'}📝
                            {:else if room.isDiscovered}🔍
                            {:else}#
                            {/if}
                          </span>
                          <div class="room-info">
                            <span class="room-name">{room.name}</span>
                            {#if room.description}
                              <span class="room-description">{room.description}</span>
                            {/if}
                          </div>
                          {#if getUnreadCount(room.id) > 0 && room.id !== selectedChatroom}
                            <div class="unread-badge">
                              {getUnreadCount(room.id)}
                            </div>
                          {/if}
                        </div>
                        
                        <div class="room-actions">
                          <button class="action-btn info" on:click={(e) => handleShowRoomInfo(room, e)} title="Room info">
                            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                              <circle cx="12" cy="12" r="10"></circle>
                              <path d="M9,9h6v6H9V9z M12,17h.01"></path>
                            </svg>
                          </button>
                          {#if room.type === 'private' || room.isPrivate}
                            <button class="action-btn share" on:click={(e) => handleCopyRoomCode(room.id, e)} title="Copy room code">
                              <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                                <rect x="9" y="9" width="13" height="13" rx="2" ry="2"></rect>
                                <path d="M5 15H4a2 2 0 0 1-2-2V4a2 2 0 0 1 2-2h9a2 2 0 0 1 2 2v1"></path>
                              </svg>
                            </button>
                          {/if}
                        </div>
                      </button>
                    {/each}
                  </div>
                {/if}
              {/each}

              <!-- Room Management Actions -->
              <div class="room-management">
                <div class="management-header">
                  <span>Room Management</span>
                  <button class="refresh-btn" on:click={handleForceRefreshRooms} disabled={loading || !walletConnected} title="Discover rooms">
                    <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" class:spin={loading}>
                      <polyline points="23,4 23,10 17,10"></polyline>
                      <polyline points="1,20 1,14 7,14"></polyline>
                      <path d="M20.49,9A9,9,0,0,0,5.64,5.64L1,10m22,4a9,9,0,0,1-14.85,4.36L23,14"></path>
                    </svg>
                  </button>
                </div>
                
                <div class="management-grid">
                  <button class="management-btn create" on:click={() => openRoomManagementModal('create')}>
                    <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                      <path d="M12 5v14m7-7H5"></path>
                    </svg>
                    Create Room
                  </button>
                  
                  <button class="management-btn private" on:click={() => openRoomManagementModal('createPrivate')}>
                    <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                      <rect x="3" y="11" width="18" height="11" rx="2" ry="2"></rect>
                      <circle cx="12" cy="16" r="1"></circle>
                      <path d="M7 11V7a5 5 0 0 1 10 0v4"></path>
                    </svg>
                    Private
                  </button>
                  
                  <button class="management-btn join" on:click={() => openRoomManagementModal('join')}>
                    <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                      <path d="M15 3h4a2 2 0 0 1 2 2v14a2 2 0 0 1-2 2h-4"></path>
                      <polyline points="10,17 15,12 10,7"></polyline>
                      <line x1="15" y1="12" x2="3" y2="12"></line>
                    </svg>
                    Join
                  </button>
                </div>
              </div>
            </div>
          {/if}
        </div>
      </div>
      
      <div class="header-right">
        <div class="header-controls">
          <!-- Stealth Address UI -->
          {#if walletConnected}
            <StealthAddressUI 
              {walletConnected} 
              currentAddress={currentWalletAddress}
              on:stealthModeChanged={handleStealthModeChanged}
            />
          {/if}

          <!-- Theme Toggle -->
          <button class="control-btn" on:click={handleToggleTheme} title="Toggle theme">
            {#if isDarkMode}
              <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                <circle cx="12" cy="12" r="5"></circle>
                <line x1="12" y1="1" x2="12" y2="3"></line>
                <line x1="12" y1="21" x2="12" y2="23"></line>
                <line x1="4.22" y1="4.22" x2="5.64" y2="5.64"></line>
                <line x1="18.36" y1="18.36" x2="19.78" y2="19.78"></line>
                <line x1="1" y1="12" x2="3" y2="12"></line>
                <line x1="21" y1="12" x2="23" y2="12"></line>
                <line x1="4.22" y1="19.78" x2="5.64" y2="18.36"></line>
                <line x1="18.36" y1="5.64" x2="19.78" y2="4.22"></line>
              </svg>
            {:else}
              <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                <path d="M21 12.79A9 9 0 1 1 11.21 3 7 7 0 0 0 21 12.79z"></path>
              </svg>
            {/if}
          </button>

          <!-- Compact Mode Toggle -->
          <button class="control-btn" on:click={handleToggleCompactMode} title="Toggle compact mode">
            <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
              <line x1="3" y1="6" x2="21" y2="6"></line>
              <line x1="3" y1="12" x2="21" y2="12"></line>
              <line x1="3" y1="18" x2="21" y2="18"></line>
            </svg>
          </button>
        </div>
        
        {#if walletConnected}
          <div class="wallet-status connected">
            <div class="wallet-info">
              <div class="wallet-avatar">
                {#if walletState.usingMnemonicWallet}
                  <svg width="16" height="16" viewBox="0 0 24 24" fill="currentColor">
                    <path d="M6 2h12a2 2 0 0 1 2 2v16a2 2 0 0 1-2 2H6a2 2 0 0 1-2-2V4a2 2 0 0 1 2-2z"/>
                    <line x1="10" y1="11" x2="10" y2="17"/>
                    <line x1="14" y1="11" x2="14" y2="17"/>
                    <line x1="8" y1="7" x2="16" y2="7"/>
                  </svg>
                {:else}
                  <svg width="16" height="16" viewBox="0 0 24 24" fill="currentColor">
                    <path d="M13.78 4.22a.75.75 0 0 1 0 1.06l-7.25 7.25a.75.75 0 0 1-1.06 0L2.22 9.28a.75.75 0 0 1 1.06-1.06L6 11.94l6.72-6.72a.75.75 0 0 1 1.06 0z"/>
                  </svg>
                {/if}
              </div>
              <div class="wallet-details">
                <span class="wallet-address">{truncateAddress(currentWalletAddress)}</span>
                <span class="wallet-type">
                  {#if stealthMode.active}
                    🎭 {stealthMode.displayName}
                  {:else}
                    {walletState.usingMnemonicWallet ? 'Imported' : 'Extension'}
                  {/if}
                </span>
              </div>
            </div>
            <button class="btn btn-outline" on:click={handleDisconnectWallet}>
              Disconnect
            </button>
          </div>
        {:else}
          <div class="wallet-connection">
            <WalletButton />
            {#if !isTablet}
              <span class="divider">or</span>
              <button class="btn btn-primary" on:click={openMnemonicModal}>
                <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                  <path d="M6 2h12a2 2 0 0 1 2 2v16a2 2 0 0 1-2 2H6a2 2 0 0 1-2-2V4a2 2 0 0 1 2-2z"/>
                  <line x1="10" y1="11" x2="10" y2="17"/>
                  <line x1="14" y1="11" x2="14" y2="17"/>
                  <line x1="8" y1="7" x2="16" y2="7"/>
                </svg>
                Import Wallet
              </button>
            {:else}
              <button class="btn btn-primary mobile-import" on:click={openMnemonicModal}>
                <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                  <path d="M6 2h12a2 2 0 0 1 2 2v16a2 2 0 0 1-2 2H6a2 2 0 0 1-2-2V4a2 2 0 0 1 2-2z"/>
                </svg>
                Import
              </button>
            {/if}
          </div>
        {/if}
      </div>
    </div>
  {/if}
</header>

<style>
  /* ============= BASE STYLES ============= */
  .chat-header {

    border-bottom: 1px solid var(--border-color, rgba(255, 85, 0, 0.2));
    color: var(--text-primary, #ffffff);
    position: sticky;
    top: 0;
    z-index: 100;
    width: 100%;
  }

  /* ============= MOBILE STYLES ============= */
  .mobile-header {
    display: flex;
    align-items: center;
    justify-content: space-between;
    padding: 12px 16px;
    min-height: 60px;
  }

  .mobile-left {
    display: flex;
    align-items: center;
    gap: 12px;
    flex: 1;
    min-width: 0;
  }

  .mobile-menu-btn {
    background: none;
    border: none;
    color: var(--text-primary);
    padding: 8px;
    border-radius: 6px;
    cursor: pointer;
    transition: all 0.2s ease;
    flex-shrink: 0;
  }

  .mobile-menu-btn:hover,
  .mobile-menu-btn.active {
    background: var(--hover-color, rgba(255, 255, 255, 0.1));
  }

  .mobile-room-info {
    display: flex;
    align-items: center;
    gap: 8px;
    flex: 1;
    min-width: 0;
    cursor: pointer;
    padding: 8px;
    border-radius: 6px;
    transition: background 0.2s ease;
    position: relative;
  }

  .mobile-room-info:hover {
    background: var(--hover-color, rgba(255, 255, 255, 0.05));
  }

  .mobile-room-info .room-icon {
    font-size: 16px;
    flex-shrink: 0;
  }

  .room-details {
    display: flex;
    flex-direction: column;
    min-width: 0;
    flex: 1;
  }

  .room-name {
    font-weight: 600;
    font-size: 14px;
    white-space: nowrap;
    overflow: hidden;
    text-overflow: ellipsis;
  }

  .message-count {
    font-size: 11px;
    color: var(--text-secondary, rgba(255, 255, 255, 0.7));
    white-space: nowrap;
  }

  .mobile-right {
    display: flex;
    align-items: center;
    gap: 8px;
    flex-shrink: 0;
  }

  .mobile-logo {
    display: flex;
    align-items: center;
    gap: 6px;
    color: var(--primary-color, #FF5500);
    font-weight: 700;
    font-size: 14px;
  }

  .mobile-stealth {
    display: flex;
    align-items: center;
  }

  .mobile-wallet-btn {
    display: flex;
    align-items: center;
    gap: 6px;
    padding: 8px 12px;
    border-radius: 8px;
    border: none;
    background: var(--primary-color, #FF5500);
    color: white;
    font-size: 12px;
    font-weight: 500;
    cursor: pointer;
    transition: all 0.2s ease;
    white-space: nowrap;
  }

  .mobile-wallet-btn.connected {
    background: var(--surface-color);
    border: 1px solid var(--border-color);
    color: var(--text-primary);
  }

  .mobile-wallet-btn:hover {
    transform: translateY(-1px);
    box-shadow: 0 4px 12px rgba(255, 85, 0, 0.3);
  }

  .wallet-avatar {
    width: 16px;
    height: 16px;
    border-radius: 50%;
    background: var(--primary-color);
    color: white;
    display: flex;
    align-items: center;
    justify-content: center;
    font-size: 10px;
    font-weight: 600;
  }

  .wallet-address {
    font-family: monospace;
    font-size: 11px;
  }

  /* Unread badges */
  .unread-badge {
    display: flex;
    align-items: center;
    justify-content: center;
    min-width: 18px;
    height: 18px;
    background: #dc3545;
    color: white;
    border-radius: 9px;
    font-size: 11px;
    font-weight: 600;
    padding: 0 6px;
    margin-left: 8px;
  }

  .unread-badge.mobile {
    position: absolute;
    top: 4px;
    right: 4px;
    min-width: 16px;
    height: 16px;
    font-size: 10px;
    border-radius: 8px;
  }

  .unread-badge.desktop {
    margin-left: 12px;
  }

  /* Mobile Menu Overlay */
  .mobile-menu-overlay {
    position: fixed;
    top: 60px;
    left: 0;
    right: 0;
    bottom: 0;
    background: rgba(0, 0, 0, 0.5);
    backdrop-filter: blur(4px);
    z-index: 200;
  }

  .mobile-menu {
    background: var(--surface-color);
    border-bottom: 1px solid var(--border-color);
    max-height: calc(100vh - 60px);
    overflow-y: auto;
  }

  .mobile-section {
    padding: 20px 16px;
    border-bottom: 1px solid var(--border-color);
  }

  .mobile-section:last-child {
    border-bottom: none;
  }

  .mobile-section h3 {
    margin: 0 0 16px 0;
    font-size: 16px;
    font-weight: 600;
    color: var(--primary-color);
  }

  .section-header {
    display: flex;
    align-items: center;
    justify-content: space-between;
    margin-bottom: 16px;
  }

  .section-header h3 {
    margin: 0;
  }

  .refresh-btn {
    background: none;
    border: none;
    color: var(--text-secondary);
    padding: 4px;
    border-radius: 4px;
    cursor: pointer;
    transition: all 0.2s ease;
  }

  .refresh-btn:hover:not(:disabled) {
    color: var(--primary-color);
    background: var(--hover-color);
  }

  .refresh-btn:disabled {
    opacity: 0.5;
    cursor: not-allowed;
  }

  .spin {
    animation: spin 1s linear infinite;
  }

  @keyframes spin {
    to { transform: rotate(360deg); }
  }

  .mobile-actions {
    display: grid;
    grid-template-columns: repeat(2, 1fr);
    gap: 12px;
  }

  .mobile-action-btn {
    display: flex;
    flex-direction: column;
    align-items: center;
    gap: 8px;
    padding: 16px 12px;
    border: 1px solid var(--border-color);
    border-radius: 8px;
    background: var(--bg-secondary, #1a1a1a);
    color: var(--text-primary);
    cursor: pointer;
    transition: all 0.2s ease;
    font-size: 12px;
    font-weight: 500;
  }

  .mobile-action-btn:hover {
    background: var(--hover-color);
    border-color: var(--primary-color);
  }

  .mobile-rooms {
    max-height: 300px;
    overflow-y: auto;
  }

  .mobile-room-category {
    margin-bottom: 16px;
  }

  .mobile-room-category:last-child {
    margin-bottom: 0;
  }

  .category-label {
    font-size: 12px;
    font-weight: 600;
    color: var(--text-secondary);
    margin-bottom: 8px;
    text-transform: uppercase;
    letter-spacing: 0.5px;
  }

  .mobile-room-item {
    display: flex;
    align-items: center;
    justify-content: space-between;
    width: 100%;
    padding: 12px;
    border: none;
    background: transparent;
    color: var(--text-primary);
    cursor: pointer;
    border-radius: 6px;
    transition: all 0.2s ease;
    margin-bottom: 4px;
    position: relative;
  }

  .mobile-room-item:hover {
    background: var(--hover-color);
  }

  .mobile-room-item.active {
    background: var(--primary-color);
    color: white;
  }

  .mobile-room-item.has-unread {
    background: rgba(220, 53, 69, 0.1);
    border-left: 4px solid #dc3545;
  }

  .room-main {
    display: flex;
    align-items: center;
    gap: 10px;
    flex: 1;
    min-width: 0;
  }

  .room-icon {
    font-size: 14px;
    flex-shrink: 0;
  }

  .room-info {
    display: flex;
    flex-direction: column;
    min-width: 0;
    flex: 1;
  }

  .room-description {
    font-size: 12px;
    color: var(--text-secondary);
    white-space: nowrap;
    overflow: hidden;
    text-overflow: ellipsis;
  }

  .room-actions {
    display: flex;
    gap: 4px;
    flex-shrink: 0;
  }

  .action-btn {
    background: none;
    border: none;
    color: var(--text-secondary);
    padding: 4px;
    border-radius: 4px;
    cursor: pointer;
    transition: all 0.2s ease;
  }

  .action-btn:hover {
    color: var(--primary-color);
    background: var(--hover-color);
  }

  /* Mobile Wallet Menu */
  .mobile-wallet-menu {
    position: absolute;
    top: 100%;
    right: 16px;
    width: 280px;
    background: var(--surface-color);
    border: 1px solid var(--border-color);
    border-radius: 8px;
    box-shadow: 0 8px 25px rgba(0, 0, 0, 0.3);
    z-index: 300;
  }

  .wallet-info-full {
    padding: 16px;
  }

  .wallet-details {
    margin-bottom: 16px;
  }

  .wallet-address-full {
    font-family: monospace;
    font-size: 12px;
    color: var(--text-primary);
    word-break: break-all;
    display: block;
    margin-bottom: 4px;
  }

  .wallet-type {
    font-size: 12px;
    color: var(--text-secondary);
  }

  .stealth-mode {
    font-size: 12px;
    color: var(--primary-color);
    display: block;
    margin-top: 4px;
  }

  .wallet-actions {
    display: flex;
    gap: 8px;
  }

  .wallet-action-btn {
    display: flex;
    align-items: center;
    gap: 6px;
    padding: 8px 16px;
    border: 1px solid var(--border-color);
    border-radius: 6px;
    background: transparent;
    color: var(--text-primary);
    cursor: pointer;
    transition: all 0.2s ease;
    font-size: 12px;
    flex: 1;
    justify-content: center;
  }

  .wallet-action-btn:hover {
    background: var(--hover-color);
    border-color: var(--primary-color);
  }

  /* Mobile Room Dropdown */
  .mobile-room-dropdown {
    background: var(--surface-color);
    border-bottom: 1px solid var(--border-color);
    max-height: 200px;
    overflow-y: auto;
  }

  /* ============= DESKTOP/TABLET STYLES ============= */
  .desktop-header {
    display: flex;
    align-items: center;
    justify-content: space-between;
    padding: 16px 24px;
    min-height: 70px;
  }

  .header-left {
    display: flex;
    align-items: center;
    gap: 32px;
  }

  .logo {
    display: flex;
    align-items: center;
    gap: 12px;
    color: var(--primary-color);
  }

  .logo-text h1 {
    margin: 0;
    font-size: 24px;
    font-weight: 700;
  }

  .subtitle {
    font-size: 12px;
    color: var(--text-secondary);
    font-weight: 400;
  }

  .chatroom-selector {
    position: relative;
  }

  .room-selector-btn {
    display: flex;
    align-items: center;
    gap: 8px;
    padding: 10px 16px;
    border: 1px solid var(--border-color);
    border-radius: 8px;
    background: var(--bg-secondary, #1a1a1a);
    color: var(--text-primary);
    cursor: pointer;
    transition: all 0.2s ease;
    font-size: 14px;
    font-weight: 500;
    min-width: 200px;
    position: relative;
  }

  .room-selector-btn:hover,
  .room-selector-btn.active {
    border-color: var(--primary-color);
    background: var(--hover-color);
  }

  .room-selector-btn .room-icon {
    font-size: 16px;
  }

  .room-selector-btn .room-name {
    flex: 1;
    text-align: left;
    white-space: nowrap;
    overflow: hidden;
    text-overflow: ellipsis;
  }

  .dropdown-arrow {
    transition: transform 0.2s ease;
  }

  .dropdown-arrow.rotated {
    transform: rotate(180deg);
  }

  .room-selector-btn .message-count {
    background: var(--primary-color);
    color: white;
    padding: 2px 6px;
    border-radius: 10px;
    font-size: 11px;
    font-weight: 600;
  }

  .room-dropdown {
    position: absolute;
    top: 100%;
    left: 0;
    right: 0;
    background: var(--surface-color);
    border: 1px solid var(--border-color);
    border-radius: 8px;
    box-shadow: 0 8px 25px rgba(0, 0, 0, 0.3);
    z-index: 200;
    max-height: 400px;
    overflow-y: auto;
    margin-top: 4px;
    min-width: 400px;
  }

  .room-category {
    padding: 16px;
    border-bottom: 1px solid var(--border-color);
  }

  .room-category:last-child {
    border-bottom: none;
  }

  .category-header {
    display: flex;
    align-items: center;
    justify-content: space-between;
    margin-bottom: 8px;
  }

  .category-name {
    font-size: 12px;
    font-weight: 600;
    color: var(--text-secondary);
    text-transform: uppercase;
    letter-spacing: 0.5px;
  }

  .category-count {
    font-size: 11px;
    color: var(--text-secondary);
  }

  .room-item {
    display: flex;
    align-items: center;
    justify-content: space-between;
    width: 100%;
    padding: 10px 12px;
    border: none;
    background: transparent;
    color: var(--text-primary);
    cursor: pointer;
    border-radius: 6px;
    transition: all 0.2s ease;
    margin-bottom: 4px;
    position: relative;
  }

  .room-item:hover {
    background: var(--hover-color);
  }

  .room-item.active {
    background: var(--primary-color);
    color: white;
  }

  .room-item.has-unread {
    background: rgba(220, 53, 69, 0.08);
    border-left: 4px solid #dc3545;
  }

  .room-management {
    padding: 16px;
    background: var(--bg-secondary);
    border-top: 1px solid var(--border-color);
  }

  .management-header {
    display: flex;
    align-items: center;
    justify-content: space-between;
    margin-bottom: 12px;
  }

  .management-header span {
    font-size: 12px;
    font-weight: 600;
    color: var(--text-secondary);
    text-transform: uppercase;
    letter-spacing: 0.5px;
  }

  .management-grid {
    display: grid;
    grid-template-columns: repeat(3, 1fr);
    gap: 8px;
  }

  .management-btn {
    display: flex;
    align-items: center;
    gap: 6px;
    padding: 8px 12px;
    border: 1px solid var(--border-color);
    border-radius: 6px;
    background: transparent;
    color: var(--text-primary);
    cursor: pointer;
    transition: all 0.2s ease;
    font-size: 12px;
    font-weight: 500;
    justify-content: center;
  }

  .management-btn:hover {
    background: var(--hover-color);
    border-color: var(--primary-color);
  }

  .header-right {
    display: flex;
    align-items: center;
    gap: 20px;
  }

  .header-controls {
    display: flex;
    gap: 8px;
  }

  .control-btn {
    background: none;
    border: none;
    color: var(--text-secondary);
    padding: 8px;
    border-radius: 6px;
    cursor: pointer;
    transition: all 0.2s ease;
  }

  .control-btn:hover {
    color: var(--primary-color);
    background: var(--hover-color);
  }

  .wallet-status {
    display: flex;
    align-items: center;
    gap: 16px;
  }

  .wallet-info {
    display: flex;
    align-items: center;
    gap: 8px;
  }

  .wallet-info .wallet-avatar {
    width: 24px;
    height: 24px;
    border-radius: 50%;
    background: var(--primary-color);
    color: white;
    display: flex;
    align-items: center;
    justify-content: center;
    font-size: 12px;
    font-weight: 600;
  }

  .wallet-details {
    display: flex;
    flex-direction: column;
  }

  .wallet-details .wallet-address {
    font-family: monospace;
    font-size: 12px;
    color: var(--text-primary);
  }

  .wallet-details .wallet-type {
    font-size: 11px;
    color: var(--text-secondary);
  }

  .wallet-connection {
    display: flex;
    align-items: center;
    gap: 12px;
  }

  .divider {
    color: var(--text-secondary);
    font-size: 12px;
  }

  .btn {
    display: flex;
    align-items: center;
    gap: 6px;
    padding: 8px 16px;
    border-radius: 6px;
    font-weight: 500;
    cursor: pointer;
    transition: all 0.2s ease;
    text-decoration: none;
    border: none;
    font-size: 14px;
  }

  .btn-primary {
    background: var(--primary-color);
    color: white;
  }

  .btn-primary:hover {
    background: var(--primary-hover, #ff6b1a);
    transform: translateY(-1px);
  }

  .btn-primary.mobile-import {
    padding: 8px 12px;
    font-size: 12px;
  }

  .btn-outline {
    background: transparent;
    color: var(--text-primary);
    border: 1px solid var(--border-color);
  }

  .btn-outline:hover {
    background: var(--hover-color);
    border-color: var(--primary-color);
  }

  /* ============= RESPONSIVE BREAKPOINTS ============= */
  @media (max-width: 767px) {
    .desktop-header {
      display: none;
    }
  }

  @media (min-width: 768px) {
    .mobile-header,
    .mobile-menu-overlay,
    .mobile-wallet-menu,
    .mobile-room-dropdown {
      display: none;
    }
  }

  @media (max-width: 1023px) and (min-width: 768px) {
    .desktop-header {
      padding: 12px 20px;
    }
    
    .logo-text h1 {
      font-size: 20px;
    }
    
    .subtitle {
      display: none;
    }
    
    .header-left {
      gap: 20px;
    }
    
    .room-selector-btn {
      min-width: 150px;
      font-size: 13px;
    }
    
    .management-grid {
      grid-template-columns: repeat(1, 1fr);
    }

    .room-dropdown {
      min-width: 350px;
    }
  }

  @media (max-width: 480px) {
    .mobile-header {
      padding: 10px 12px;
      min-height: 56px;
    }

    .mobile-right {
      gap: 6px;
    }

    .mobile-logo span {
      display: none;
    }

    .mobile-stealth {
      display: none;
    }

    .mobile-wallet-btn {
      font-size: 11px;
      padding: 6px 10px;
    }
  }

  /* ============= DARK/LIGHT THEME VARIABLES ============= */
  :global(.dark) {
    --primary-color: #FF5500;
    --primary-hover: #ff6b1a;
    --success-color: #4CAF50;
    --warning-color: #ffc107;
    --surface-color: #262626;
    --bg-secondary: #1a1a1a;
    --text-primary: #ffffff;
    --text-secondary: rgba(255, 255, 255, 0.7);
    --border-color: rgba(255, 85, 0, 0.2);
    --hover-color: rgba(255, 255, 255, 0.1);
  }

  :global(.light) {
    --primary-color: #FF5500;
    --primary-hover: #ff6b1a;
    --success-color: #4CAF50;
    --warning-color: #ffc107;
    --surface-color: #ffffff;
    --bg-secondary: #f5f5f5;
    --text-primary: #000000;
    --text-secondary: rgba(0, 0, 0, 0.7);
    --border-color: rgba(255, 85, 0, 0.2);
    --hover-color: rgba(0, 0, 0, 0.05);
  }

  /* ============= ACCESSIBILITY ============= */
  @media (prefers-reduced-motion: reduce) {
    * {
      animation-duration: 0.01ms !important;
      animation-iteration-count: 1 !important;
      transition-duration: 0.01ms !important;
    }
  }

  /* Focus styles for keyboard navigation */
  .mobile-menu-btn:focus,
  .mobile-wallet-btn:focus,
  .room-selector-btn:focus,
  .control-btn:focus,
  .btn:focus {
    outline: 2px solid var(--primary-color);
    outline-offset: 2px;
  }

  /* High contrast mode support */
  @media (prefers-contrast: high) {
    .chat-header {
      border-bottom-width: 2px;
    }
    
    .btn,
    .room-selector-btn,
    .mobile-wallet-btn {
      border-width: 2px;
    }
  }
</style>