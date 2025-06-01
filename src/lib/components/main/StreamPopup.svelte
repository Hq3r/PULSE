<script lang="ts">
    import { createEventDispatcher, onMount, onDestroy } from 'svelte';
    import { fade } from 'svelte/transition';
    
    const dispatch = createEventDispatcher();
    
    export let visible = false;
    export let streamUrl = '';
    export let streamTitle = '';
    export let platform = '';
    export let isLive = true;
    
    let dragElement;
    let resizeElement;
    let isDragging = false;
    let isResizing = false;
    let dragOffset = { x: 0, y: 0 };
    let position = { x: 100, y: 100 };
    let size = { width: 600, height: 400 };
    let embedUrl = '';
    let isMinimized = false;
    let isMaximized = false;
    let previousSize = { width: 600, height: 400 };
    let previousPosition = { x: 100, y: 100 };
    let isMobile = false;
    
    // Platform configurations
    const platforms = {
      youtube: { icon: 'fa-brands fa-youtube', color: '#FF0000' },
      twitch: { icon: 'fa-brands fa-twitch', color: '#9146FF' },
      twitter: { icon: 'fa-brands fa-x-twitter', color: '#1DA1F2' },
      kick: { icon: 'fa-solid fa-video', color: '#53FC18' }
    };
    
    // Check if device is mobile
    function checkMobile() {
      isMobile = window.innerWidth <= 768 || 'ontouchstart' in window;
      
      if (isMobile) {
        // Set mobile-friendly defaults
        const padding = 10;
        size = { 
          width: Math.min(window.innerWidth - padding * 2, 350), 
          height: Math.min(window.innerHeight - padding * 2, 250) 
        };
        position = { 
          x: padding, 
          y: padding 
        };
      }
    }
    
    $: if (streamUrl && visible) {
      embedUrl = convertToEmbedUrl(streamUrl);
    }
    
    function convertToEmbedUrl(url) {
      try {
        const urlObj = new URL(url);
        
        // YouTube
        if (url.includes('youtube.com') || url.includes('youtu.be')) {
          if (url.includes('youtube.com/watch')) {
            const videoId = urlObj.searchParams.get('v');
            return `https://www.youtube.com/embed/${videoId}?autoplay=1`;
          }
          if (url.includes('youtube.com/live/')) {
            const segments = urlObj.pathname.split('/');
            const videoId = segments[segments.indexOf('live') + 1];
            return `https://www.youtube.com/embed/${videoId}?autoplay=1`;
          }
          if (url.includes('youtu.be/')) {
            const videoId = urlObj.pathname.substring(1);
            return `https://www.youtube.com/embed/${videoId}?autoplay=1`;
          }
        }
        
        // Twitch
        if (url.includes('twitch.tv/')) {
          const channel = urlObj.pathname.substring(1);
          return `https://player.twitch.tv/?channel=${channel}&parent=${window.location.hostname}&autoplay=true`;
        }
        
        // Kick
        if (url.includes('kick.com/')) {
          const channel = urlObj.pathname.substring(1);
          return `https://player.kick.com/${channel}?autoplay=true`;
        }
        
        return null;
      } catch (error) {
        console.error('Error converting URL:', error);
        return null;
      }
    }
    
    function startDrag(event) {
      if (event.target.closest('.popup-controls') || event.target.closest('.resize-handle')) return;
      if (isMobile && event.type === 'mousedown') return; // Prefer touch events on mobile
      
      isDragging = true;
      const rect = dragElement.getBoundingClientRect();
      
      const clientX = event.clientX || (event.touches && event.touches[0].clientX);
      const clientY = event.clientY || (event.touches && event.touches[0].clientY);
      
      dragOffset.x = clientX - rect.left;
      dragOffset.y = clientY - rect.top;
      
      document.addEventListener('mousemove', handleDrag);
      document.addEventListener('touchmove', handleDrag, { passive: false });
      document.addEventListener('mouseup', stopDrag);
      document.addEventListener('touchend', stopDrag);
      
      document.body.style.userSelect = 'none';
      event.preventDefault();
    }
    
    function handleDrag(event) {
      if (!isDragging) return;
      
      const clientX = event.clientX || (event.touches && event.touches[0].clientX);
      const clientY = event.clientY || (event.touches && event.touches[0].clientY);
      
      let newX = clientX - dragOffset.x;
      let newY = clientY - dragOffset.y;
      
      const padding = isMobile ? 5 : 20;
      const maxX = window.innerWidth - size.width - padding;
      const maxY = window.innerHeight - size.height - padding;
      
      position.x = Math.max(padding, Math.min(newX, maxX));
      position.y = Math.max(padding, Math.min(newY, maxY));
      
      event.preventDefault();
    }
    
    function stopDrag() {
      isDragging = false;
      document.removeEventListener('mousemove', handleDrag);
      document.removeEventListener('touchmove', handleDrag);
      document.removeEventListener('mouseup', stopDrag);
      document.removeEventListener('touchend', stopDrag);
      document.body.style.userSelect = '';
    }
    
    // Resize functionality (disabled on mobile)
    function startResize(event) {
      if (isMobile) return;
      
      isResizing = true;
      const rect = dragElement.getBoundingClientRect();
      
      dragOffset.x = event.clientX - rect.right;
      dragOffset.y = event.clientY - rect.bottom;
      
      document.addEventListener('mousemove', handleResize);
      document.addEventListener('mouseup', stopResize);
      
      document.body.style.userSelect = 'none';
      event.stopPropagation();
    }
    
    function handleResize(event) {
      if (!isResizing || isMobile) return;
      
      const minWidth = isMobile ? 280 : 300;
      const minHeight = isMobile ? 200 : 200;
      const maxWidth = window.innerWidth - position.x - 20;
      const maxHeight = window.innerHeight - position.y - 20;
      
      let newWidth = event.clientX - dragOffset.x - position.x;
      let newHeight = event.clientY - dragOffset.y - position.y;
      
      size.width = Math.max(minWidth, Math.min(newWidth, maxWidth));
      size.height = Math.max(minHeight, Math.min(newHeight, maxHeight));
    }
    
    function stopResize() {
      isResizing = false;
      document.removeEventListener('mousemove', handleResize);
      document.removeEventListener('mouseup', stopResize);
      document.body.style.userSelect = '';
    }
    
    function toggleMinimize() {
      isMinimized = !isMinimized;
      
      if (isMinimized) {
        previousSize = { ...size };
        size.height = isMobile ? 45 : 40;
      } else {
        size = { ...previousSize };
      }
    }
    
    function toggleMaximize() {
      if (isMobile) {
        // On mobile, maximize to full screen
        if (isMaximized) {
          size = { ...previousSize };
          position = { ...previousPosition };
          isMaximized = false;
        } else {
          previousSize = { ...size };
          previousPosition = { ...position };
          
          position.x = 0;
          position.y = 0;
          size.width = window.innerWidth;
          size.height = window.innerHeight;
          isMaximized = true;
        }
      } else {
        if (isMaximized) {
          size = { ...previousSize };
          position = { ...previousPosition };
          isMaximized = false;
        } else {
          previousSize = { ...size };
          previousPosition = { ...position };
          
          const padding = 20;
          position.x = padding;
          position.y = padding;
          size.width = window.innerWidth - (padding * 2);
          size.height = window.innerHeight - (padding * 2);
          isMaximized = true;
        }
      }
    }
    
    function snapToCorner(corner) {
      if (isMobile) return; // Disable snapping on mobile
      
      const padding = 20;
      const snapWidth = Math.min(500, window.innerWidth - padding * 2);
      const snapHeight = Math.min(350, window.innerHeight - padding * 2);
      
      switch (corner) {
        case 'top-left':
          position = { x: padding, y: padding };
          break;
        case 'top-right':
          position = { x: window.innerWidth - snapWidth - padding, y: padding };
          break;
        case 'bottom-left':
          position = { x: padding, y: window.innerHeight - snapHeight - padding };
          break;
        case 'bottom-right':
          position = { x: window.innerWidth - snapWidth - padding, y: window.innerHeight - snapHeight - padding };
          break;
      }
      
      size = { width: snapWidth, height: snapHeight };
      isMaximized = false;
    }
    
    function closePopup() {
      visible = false;
      dispatch('close');
    }
    
    function openInNewTab() {
      window.open(streamUrl, '_blank');
    }
    
    // Handle keyboard shortcuts
    function handleKeydown(event) {
      if (!visible) return;
      
      switch (event.key) {
        case 'Escape':
          closePopup();
          break;
        case 'F11':
          event.preventDefault();
          toggleMaximize();
          break;
        case 'm':
        case 'M':
          if (event.ctrlKey || event.metaKey) {
            event.preventDefault();
            toggleMinimize();
          }
          break;
      }
    }
    
    // Handle window resize
    function handleWindowResize() {
      checkMobile();
      
      const padding = isMobile ? 5 : 20;
      const maxX = window.innerWidth - size.width - padding;
      const maxY = window.innerHeight - size.height - padding;
      
      if (position.x > maxX) position.x = Math.max(padding, maxX);
      if (position.y > maxY) position.y = Math.max(padding, maxY);
      
      // Adjust size if too large for viewport
      const maxWidth = window.innerWidth - padding * 2;
      const maxHeight = window.innerHeight - padding * 2;
      
      if (size.width > maxWidth) {
        size.width = maxWidth;
      }
      if (size.height > maxHeight) {
        size.height = maxHeight;
      }
      
      // On mobile, ensure minimum touch-friendly size
      if (isMobile) {
        const minWidth = 280;
        const minHeight = 200;
        if (size.width < minWidth) size.width = minWidth;
        if (size.height < minHeight) size.height = minHeight;
      }
    }
    
    onMount(() => {
      checkMobile();
      
      // Center popup initially
      if (!isMobile) {
        position.x = (window.innerWidth - size.width) / 2;
        position.y = (window.innerHeight - size.height) / 2;
      }
      
      // Add event listeners
      window.addEventListener('keydown', handleKeydown);
      window.addEventListener('resize', handleWindowResize);
      window.addEventListener('orientationchange', handleWindowResize);
      
      return () => {
        window.removeEventListener('keydown', handleKeydown);
        window.removeEventListener('resize', handleWindowResize);
        window.removeEventListener('orientationchange', handleWindowResize);
      };
    });
    
    onDestroy(() => {
      // Clean up event listeners
      document.removeEventListener('mousemove', handleDrag);
      document.removeEventListener('touchmove', handleDrag);
      document.removeEventListener('mouseup', stopDrag);
      document.removeEventListener('touchend', stopDrag);
      document.removeEventListener('mousemove', handleResize);
      document.removeEventListener('mouseup', stopResize);
      document.body.style.userSelect = '';
    });
  </script>
  
  {#if visible}
    <div 
      class="stream-popup {isDragging ? 'dragging' : ''} {isResizing ? 'resizing' : ''} {isMinimized ? 'minimized' : ''} {isMaximized ? 'maximized' : ''} {isMobile ? 'mobile' : ''}"
      bind:this={dragElement}
      style="left: {position.x}px; top: {position.y}px; width: {size.width}px; height: {size.height}px;"
      on:mousedown={startDrag}
      on:touchstart={startDrag}
      transition:fade={{ duration: 200 }}
    >
      <!-- Popup Header -->
      <div class="popup-header">
        <div class="stream-info">
          <div class="platform-badge" style="background-color: {platforms[platform]?.color || '#666'}">
            <i class="{platforms[platform]?.icon || 'fa-solid fa-video'}"></i>
          </div>
          <div class="stream-details">
            <h4 title={streamTitle}>{streamTitle}</h4>
            {#if isLive}
              <span class="live-badge">🔴 LIVE</span>
            {/if}
          </div>
        </div>
        
        <div class="popup-controls">
          <!-- Snap to corners dropdown (hidden on mobile) -->
          {#if !isMobile}
            <div class="snap-controls">
              <button class="control-btn" title="Snap to corner">
                <i class="fa-solid fa-th-large"></i>
              </button>
              <div class="snap-menu">
                <button on:click={() => snapToCorner('top-left')}>↖</button>
                <button on:click={() => snapToCorner('top-right')}>↗</button>
                <button on:click={() => snapToCorner('bottom-left')}>↙</button>
                <button on:click={() => snapToCorner('bottom-right')}>↘</button>
              </div>
            </div>
          {/if}
          
          <button class="control-btn" on:click={toggleMinimize} title="Minimize (Ctrl+M)">
            <i class="fa-solid {isMinimized ? 'fa-window-maximize' : 'fa-window-minimize'}"></i>
          </button>
          
          <button class="control-btn" on:click={toggleMaximize} title="Maximize (F11)">
            <i class="fa-solid {isMaximized ? 'fa-window-restore' : 'fa-window-maximize'}"></i>
          </button>
          
          <button class="control-btn" on:click={openInNewTab} title="Open in new tab">
            <i class="fa-solid fa-external-link-alt"></i>
          </button>
          
          <button class="control-btn close-btn" on:click={closePopup} title="Close (Esc)">
            <i class="fa-solid fa-times"></i>
          </button>
        </div>
      </div>
      
      <!-- Video Player -->
      {#if !isMinimized}
        <div class="popup-content">
          {#if embedUrl}
            <iframe
              src={embedUrl}
              class="stream-iframe"
              allowfullscreen
              allow="autoplay; fullscreen"
              title={streamTitle}
            ></iframe>
          {:else if platform === 'twitter'}
            <div class="twitter-placeholder">
              <i class="fa-brands fa-x-twitter"></i>
              <p>X Space</p>
              <button class="open-twitter-btn" on:click={openInNewTab}>
                Open in X
              </button>
            </div>
          {:else}
            <div class="video-placeholder">
              <i class="fa-solid fa-video"></i>
              <p>Video not available for embedding</p>
              <button class="open-external-btn" on:click={openInNewTab}>
                Open Externally
              </button>
            </div>
          {/if}
        </div>
        
        <!-- Resize Handle (desktop only) -->
        {#if !isMobile}
          <div class="resize-handle" on:mousedown={startResize} title="Drag to resize">
            <i class="fa-solid fa-grip-lines"></i>
          </div>
        {/if}
      {/if}
    </div>
  {/if}
  
<style>
  .stream-popup {
    position: fixed;
    min-width: 300px;
    min-height: 200px;
    background: #1a1a1a;
    border: 1px solid rgba(255, 85, 0, 0.3);
    border-radius: 8px;
    box-shadow: 0 8px 32px rgba(0, 0, 0, 0.5);
    z-index: 1000;
    overflow: hidden;
    cursor: move;
    display: flex;
    flex-direction: column;
    transition: box-shadow 0.2s ease;
    user-select: none;
  }
  
  .stream-popup:hover {
    box-shadow: 0 12px 48px rgba(0, 0, 0, 0.7);
  }
  
  .stream-popup.dragging {
    cursor: grabbing;
    box-shadow: 0 16px 64px rgba(0, 0, 0, 0.8);
    z-index: 1001;
  }
  
  .stream-popup.resizing {
    box-shadow: 0 16px 64px rgba(255, 85, 0, 0.3);
  }
  
  .stream-popup.minimized {
    cursor: default;
  }
  
  .stream-popup.maximized {
    border-radius: 0;
    box-shadow: none;
  }
  
  /* Mobile-specific styles */
  .stream-popup.mobile {
    min-width: 280px;
    min-height: 200px;
    touch-action: none;
  }
  
  .stream-popup.mobile.maximized {
    border-radius: 0;
    border: none;
  }
  
  .stream-popup.mobile.minimized {
    height: 45px !important;
  }
  
  .popup-header {
    display: flex;
    justify-content: space-between;
    align-items: center;
    padding: 0.75rem;
    background: rgba(255, 85, 0, 0.1);
    border-bottom: 1px solid rgba(255, 255, 255, 0.1);
    cursor: move;
    flex-shrink: 0;
    touch-action: none;
  }
  
  .stream-info {
    display: flex;
    align-items: center;
    gap: 0.75rem;
    flex: 1;
    min-width: 0;
  }
  
  .platform-badge {
    width: 32px;
    height: 32px;
    border-radius: 6px;
    display: flex;
    align-items: center;
    justify-content: center;
    color: white;
    font-size: 0.9rem;
    flex-shrink: 0;
  }
  
  .stream-details {
    min-width: 0;
    flex: 1;
  }
  
  .stream-details h4 {
    margin: 0 0 0.25rem 0;
    color: white;
    font-size: 0.9rem;
    font-weight: 600;
    overflow: hidden;
    text-overflow: ellipsis;
    white-space: nowrap;
  }
  
  .live-badge {
    font-size: 0.7rem;
    color: #ff4444;
    font-weight: bold;
    animation: pulse 2s infinite;
  }
  
  .popup-controls {
    display: flex;
    gap: 0.25rem;
    cursor: default;
    flex-shrink: 0;
  }
  
  .control-btn {
    width: 28px;
    height: 28px;
    background: rgba(255, 255, 255, 0.1);
    border: none;
    border-radius: 4px;
    color: #AAA;
    cursor: pointer;
    transition: all 0.2s ease;
    display: flex;
    align-items: center;
    justify-content: center;
    font-size: 0.8rem;
    touch-action: manipulation;
  }
  
  .control-btn:hover {
    background: rgba(255, 255, 255, 0.2);
    color: white;
  }
  
  .close-btn:hover {
    background: rgba(255, 68, 68, 0.8);
    color: white;
  }
  
  /* Snap controls */
  .snap-controls {
    position: relative;
  }
  
  .snap-controls:hover .snap-menu {
    display: grid;
  }
  
  .snap-menu {
    display: none;
    position: absolute;
    top: 100%;
    left: 0;
    background: #2a2a2a;
    border: 1px solid rgba(255, 255, 255, 0.2);
    border-radius: 4px;
    grid-template-columns: 1fr 1fr;
    gap: 2px;
    padding: 4px;
    z-index: 10;
  }
  
  .snap-menu button {
    width: 24px;
    height: 24px;
    background: rgba(255, 255, 255, 0.1);
    border: none;
    border-radius: 2px;
    color: #AAA;
    cursor: pointer;
    transition: all 0.2s ease;
    font-size: 0.7rem;
  }
  
  .snap-menu button:hover {
    background: rgba(255, 85, 0, 0.8);
    color: white;
  }
  
  .popup-content {
    flex: 1;
    background: #000;
    position: relative;
    overflow: hidden;
  }
  
  .stream-iframe {
    width: 100%;
    height: 100%;
    border: none;
  }
  
  .twitter-placeholder,
  .video-placeholder {
    height: 100%;
    display: flex;
    flex-direction: column;
    align-items: center;
    justify-content: center;
    color: #AAA;
    text-align: center;
    padding: 1rem;
  }
  
  .twitter-placeholder i,
  .video-placeholder i {
    font-size: 2rem;
    margin-bottom: 0.5rem;
    color: #555;
  }
  
  .twitter-placeholder i {
    color: #1DA1F2;
  }
  
  .open-twitter-btn,
  .open-external-btn {
    background: rgba(255, 85, 0, 0.8);
    color: white;
    border: none;
    border-radius: 4px;
    padding: 0.5rem 1rem;
    cursor: pointer;
    transition: all 0.2s ease;
    margin-top: 0.5rem;
    font-size: 0.8rem;
    touch-action: manipulation;
  }
  
  .open-twitter-btn {
    background: #1DA1F2;
  }
  
  .open-twitter-btn:hover,
  .open-external-btn:hover {
    transform: translateY(-1px);
    opacity: 0.9;
  }
  
  /* Resize handles (desktop only) */
  .resize-handle {
    position: absolute;
    bottom: 0;
    right: 0;
    width: 16px;
    height: 16px;
    background: rgba(255, 85, 0, 0.5);
    cursor: se-resize;
    border-radius: 8px 0 8px 0;
    display: flex;
    align-items: center;
    justify-content: center;
    color: white;
    font-size: 0.6rem;
  }
  
  .resize-handle:hover {
    background: rgba(255, 85, 0, 0.8);
  }
  
  @keyframes pulse {
    0% { opacity: 1; }
    50% { opacity: 0.6; }
    100% { opacity: 1; }
  }
  
  /* Mobile responsiveness */
  @media (max-width: 768px) {
    .stream-popup {
      min-width: 280px;
      min-height: 200px;
      cursor: default;
    }
    
    .popup-header {
      padding: 0.6rem;
      touch-action: none;
    }
    
    .stream-details h4 {
      font-size: 0.85rem;
    }
    
    .platform-badge {
      width: 30px;
      height: 30px;
      font-size: 0.8rem;
    }
    
    .control-btn {
      width: 32px;
      height: 32px;
      font-size: 0.85rem;
      gap: 0.3rem;
    }
    
    .live-badge {
      font-size: 0.65rem;
    }
    
    .twitter-placeholder i,
    .video-placeholder i {
      font-size: 1.5rem;
    }
    
    .open-twitter-btn,
    .open-external-btn {
      padding: 0.6rem 1.2rem;
      font-size: 0.85rem;
      min-height: 44px; /* Touch-friendly size */
    }
  }
  
  @media (max-width: 480px) {
    .stream-popup {
      min-width: 260px;
      border-radius: 6px;
    }
    
    .popup-header {
      padding: 0.5rem;
    }
    
    .stream-details h4 {
      font-size: 0.8rem;
    }
    
    .platform-badge {
      width: 28px;
      height: 28px;
      font-size: 0.75rem;
    }
    
    .control-btn {
      width: 30px;
      height: 30px;
      font-size: 0.8rem;
    }
    
    .popup-controls {
      gap: 0.2rem;
    }
    
    .stream-info {
      gap: 0.5rem;
    }
  }
  
  /* Touch device optimizations */
  @media (hover: none) and (pointer: coarse) {
    .control-btn {
      min-width: 44px;
      min-height: 44px;
    }
    
    .snap-controls {
      display: none;
    }
    
    .popup-header {
      padding: 0.75rem;
    }
  }
  
  /* High DPI displays */
  @media (-webkit-min-device-pixel-ratio: 2), (min-resolution: 192dpi) {
    .stream-popup {
      border-width: 0.5px;
    }
    
    .popup-header {
      border-bottom-width: 0.5px;
    }
  }
</style>