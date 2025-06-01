<!-- LiveStreamingRoom.svelte - Stream discovery and navigation (no embedded player) -->
<script lang="ts">
    import { createEventDispatcher, onMount, onDestroy } from 'svelte';
    import { slide, fade } from 'svelte/transition';
    import { selectedChatroomId } from '$lib/components/main/chatstore';
    import { showCustomToast, truncateAddress } from '$lib/utils/utils';
    
    const dispatch = createEventDispatcher();
    
    // Props
    export let visible = false;
    export let walletConnected = false;
    export let currentUserAddress = '';
    export let chatContract = '';
    
    // Component state
    let activeView = 'browse'; // 'browse', 'create'
    let liveStreams = [];
    let loadingStreams = true;
    let inputMessage = '';
    let sendingMessage = false;
    let errorMessage = '';
    let searchQuery = '';
    let refreshInterval;
    let thumbnailCache = new Map();
    // Create stream form
    let newStreamUrl = '';
    let newStreamTitle = '';
    let newStreamPlatform = 'youtube';
    
    // Supported platforms
    const platforms = {
      youtube: { 
        name: 'YouTube', 
        icon: 'fa-brands fa-youtube', 
        color: '#FF0000',
        examples: ['youtube.com/watch?v=...', 'youtube.com/live/...', 'youtu.be/...']
      },
      twitch: { 
        name: 'Twitch', 
        icon: 'fa-brands fa-twitch', 
        color: '#9146FF',
        examples: ['twitch.tv/username']
      },
      twitter: { 
        name: 'X (Twitter)', 
        icon: 'fa-brands fa-x-twitter', 
        color: '#1DA1F2',
        examples: ['twitter.com/i/spaces/...', 'x.com/i/spaces/...']
      },
      kick: { 
        name: 'Kick', 
        icon: 'fa-solid fa-video', 
        color: '#53FC18',
        examples: ['kick.com/username']
      }
    };
    // Extract video/stream ID from URL
function extractStreamId(url, platform) {
  try {
    switch (platform) {
      case 'youtube':
        // Handle various YouTube URL formats
        const youtubeRegex = /(?:youtube\.com\/(?:[^\/]+\/.+\/|(?:v|e(?:mbed)?)\/|.*[?&]v=)|youtu\.be\/)([^"&?\/\s]{11})/;
        const youtubeMatch = url.match(youtubeRegex);
        return youtubeMatch ? youtubeMatch[1] : null;
        
      case 'twitch':
        // Extract username from Twitch URL
        const twitchRegex = /twitch\.tv\/([a-zA-Z0-9_]+)/;
        const twitchMatch = url.match(twitchRegex);
        return twitchMatch ? twitchMatch[1] : null;
        
      case 'kick':
        // Extract username from Kick URL
        const kickRegex = /kick\.com\/([a-zA-Z0-9_]+)/;
        const kickMatch = url.match(kickRegex);
        return kickMatch ? kickMatch[1] : null;
        
      default:
        return null;
    }
  } catch (e) {
    console.error('Error extracting stream ID:', e);
    return null;
  }
}

// Fetch thumbnail for a stream
async function fetchThumbnail(stream) {
  const cacheKey = `${stream.platform}-${stream.url}`;
  
  // Return cached thumbnail if available
  if (thumbnailCache.has(cacheKey)) {
    return thumbnailCache.get(cacheKey);
  }

  try {
    const streamId = extractStreamId(stream.url, stream.platform);
    if (!streamId) {
      throw new Error('Could not extract stream ID');
    }

    let thumbnailUrl = 'https://i.ibb.co/DPdWpCCV/pulse.jpg'; // Fallback

    switch (stream.platform) {
      case 'youtube':
        // YouTube thumbnail API - try different qualities
        const ytThumbnails = [
          `https://img.youtube.com/vi/${streamId}/maxresdefault.jpg`,
          `https://img.youtube.com/vi/${streamId}/hqdefault.jpg`,
          `https://img.youtube.com/vi/${streamId}/mqdefault.jpg`
        ];
        
        // Try to find a working thumbnail
        for (const thumbUrl of ytThumbnails) {
          try {
            const response = await fetch(thumbUrl, { method: 'HEAD' });
            if (response.ok) {
              thumbnailUrl = thumbUrl;
              break;
            }
          } catch (e) {
            continue;
          }
        }
        break;
        
      case 'twitch':
        // For Twitch, we can use their preview URL format
        thumbnailUrl = `https://static-cdn.jtvnw.net/previews-ttv/live_user_${streamId}-320x180.jpg`;
        break;
        
      case 'kick':
        // Kick doesn't have a public thumbnail API, use placeholder
        thumbnailUrl = 'https://i.ibb.co/DPdWpCCV/pulse.jpg';
        break;
        
      default:
        thumbnailUrl = 'https://i.ibb.co/DPdWpCCV/pulse.jpg';
    }

    // Cache the result
    thumbnailCache.set(cacheKey, thumbnailUrl);
    return thumbnailUrl;
    
  } catch (error) {
    console.error('Error fetching thumbnail:', error);
    const fallback = 'https://i.ibb.co/DPdWpCCV/pulse.jpg';
    thumbnailCache.set(cacheKey, fallback);
    return fallback;
  }
}

// Get thumbnail with loading state - THIS IS THE MISSING FUNCTION
function getThumbnailUrl(stream) {
  const cacheKey = `${stream.platform}-${stream.url}`;
  return thumbnailCache.get(cacheKey) || 'https://i.ibb.co/DPdWpCCV/pulse.jpg';
}

// Preload thumbnails for visible streams
async function preloadThumbnails(streams) {
  const promises = streams.map(stream => fetchThumbnail(stream));
  await Promise.allSettled(promises);
  // Trigger reactive update
  liveStreams = [...liveStreams];
}
    // Helper function to decode hex data
    function decodeHex(hex) {
      try {
        if (!hex || typeof hex !== 'string') return null;
        
        // Remove 0e prefix if present
        if (hex.startsWith('0e')) {
          hex = hex.substring(4);
        }
        
        const bytes = [];
        for (let i = 0; i < hex.length; i += 2) {
          bytes.push(parseInt(hex.substring(i, i + 2), 16));
        }
        
        const result = new TextDecoder('utf-8').decode(new Uint8Array(bytes));
        return result;
      } catch (e) {
        console.error("Error decoding hex:", e);
        return null;
      }
    }
    
    // Extract register value helper
    function extractRegisterValue(register) {
      if (!register) return '';
      
      if (typeof register === 'string') {
        return register;
      }
      
      if (register.renderedValue) {
        return register.renderedValue;
      }
      
      if (register.serializedValue) {
        return register.serializedValue;
      }
      
      return String(register);
    }
    
    // Fetch live streams from blockchain
    async function fetchLiveStreams() {
      console.log("LiveStreamingRoom: Fetching live streams from blockchain...");
      loadingStreams = true;
      
      try {
        // Fetch recent boxes from the chat contract
        const response = await fetch(`https://api.ergoplatform.com/api/v1/boxes/byAddress/${chatContract}?limit=500`);
        
        if (!response.ok) {
          throw new Error(`API error: ${response.status} ${response.statusText}`);
        }
        
        const data = await response.json();
        const activeStreams = new Map();
        const endedStreams = new Set();
        
        console.log(`Processing ${data.items.length} boxes for stream detection...`);
        
        // Process all boxes to find stream announcements
        for (const box of data.items) {
          if (box.additionalRegisters && 
              box.additionalRegisters.R4 && 
              box.additionalRegisters.R5 && 
              box.additionalRegisters.R6 && 
              box.additionalRegisters.R7 && 
              box.additionalRegisters.R8) {
            
            try {
              // Extract stream metadata from R8
              const streamMetadataRaw = extractRegisterValue(box.additionalRegisters.R8);
              const streamMetadata = decodeHex(streamMetadataRaw);
              
              // Try to parse as JSON
              let streamData;
              try {
                streamData = JSON.parse(streamMetadata);
              } catch (e) {
                // Not a stream room box, skip
                continue;
              }
              
              // Check if this is a stream room
              if (streamData.type === 'STREAM_ROOM') {
                const senderRaw = extractRegisterValue(box.additionalRegisters.R4);
                const messageRaw = extractRegisterValue(box.additionalRegisters.R5);
                const timestampRaw = extractRegisterValue(box.additionalRegisters.R6);
                const roomIdRaw = extractRegisterValue(box.additionalRegisters.R7);
                
                const sender = decodeHex(senderRaw);
                const message = decodeHex(messageRaw);
                const timestamp = parseInt(timestampRaw);
                const roomId = decodeHex(roomIdRaw);
                
                // Check if this is a stream start or end based on isActive field
                if (streamData.isActive === true) {
                  // This is an active stream
                  const now = Date.now() / 1000;
                  const ageInHours = (now - (streamData.startTime || timestamp)) / 3600;
                  
                  if (ageInHours < 120 && streamData.title && streamData.url) {
                    console.log(`✅ Found live stream: ${streamData.title}`);
                    
                    activeStreams.set(roomId, {
                      roomId: roomId,
                      title: streamData.title,
                      url: streamData.url,
                      platform: streamData.platform,
                      streamerAddress: sender.replace(/^3/, ''), // Clean address
                      startTime: (streamData.startTime || timestamp) * 1000, // Convert to milliseconds
                      isActive: true,
                      txId: box.boxId || box.transactionId,
                      announcementMessage: message,
                      boxId: box.boxId
                    });
                  }
                } else if (streamData.isActive === false) {
                  // This is a stream end - mark the room as ended
                  console.log(`❌ Found stream end for: ${roomId}`);
                  endedStreams.add(roomId);
                  
                  // Also remove from active streams if it exists
                  if (activeStreams.has(roomId)) {
                    console.log(`🛑 Removing ended stream from active list: ${roomId}`);
                    activeStreams.delete(roomId);
                  }
                }
              }
            } catch (error) {
              // Not a valid stream box, skip
              continue;
            }
          }
        }
        
        // Remove ended streams from active streams
        for (const endedRoomId of endedStreams) {
          if (activeStreams.has(endedRoomId)) {
            console.log(`🛑 Removing ended stream: ${endedRoomId}`);
            activeStreams.delete(endedRoomId);
          }
        }
        
        const streamArray = Array.from(activeStreams.values());
        console.log(`LiveStreamingRoom: Found ${streamArray.length} active live streams`);
        
        liveStreams = streamArray;
        
      } catch (error) {
        console.error("Error fetching live streams:", error);
        errorMessage = "Failed to load live streams. Please try again.";
        liveStreams = [];
      } finally {
        loadingStreams = false;
      }
    }
    
    // Reactive statements
    $: filteredStreams = liveStreams.filter(stream => {
      if (!searchQuery.trim()) return true;
      
      return (
        stream.title.toLowerCase().includes(searchQuery.toLowerCase()) ||
        stream.streamerAddress.toLowerCase().includes(searchQuery.toLowerCase()) ||
        stream.platform.toLowerCase().includes(searchQuery.toLowerCase())
      );
    });
    
    onMount(() => {
      // Load live streams immediately
      fetchLiveStreams();
      
      // Start auto-refresh for live streams every 30 seconds
      refreshInterval = setInterval(() => {
        fetchLiveStreams();
      }, 30000);
    });
    
    onDestroy(() => {
      if (refreshInterval) {
        clearInterval(refreshInterval);
      }
    });
    
    // Join stream chat room
    function joinStreamRoom(stream) {
      console.log('Joining stream room:', stream.roomId);
      
      // Set the chatroom to this stream
      selectedChatroomId.set(stream.roomId);
      
      // Close the modal
      closeModal();
      
      // Emit event to parent to handle room selection
      dispatch('joinStreamRoom', { 
        roomId: stream.roomId,
        streamData: stream 
      });
      
      showCustomToast(`Joined chat for: ${stream.title}`, 3000, 'success');
    }
    
    // Open stream in new tab
    function openStreamInNewTab(stream) {
      console.log('Opening stream in new tab:', stream.url);
      
      if (stream.url) {
        window.open(stream.url, '_blank', 'noopener,noreferrer');
        showCustomToast(`Opening ${stream.platform} stream: ${stream.title}`, 2000, 'info');
      } else {
        showCustomToast('Stream URL not available', 3000, 'error');
      }
    }
    
    function detectPlatform(url) {
      if (url.includes('youtube.com') || url.includes('youtu.be')) return 'youtube';
      if (url.includes('twitch.tv')) return 'twitch';
      if (url.includes('twitter.com') || url.includes('x.com')) return 'twitter';
      if (url.includes('kick.com')) return 'kick';
      return 'unknown';
    }
    
    function formatDuration(startTime) {
      if (!startTime) return '0:00';
      const duration = Math.floor((Date.now() - startTime) / 1000);
      const hours = Math.floor(duration / 3600);
      const minutes = Math.floor((duration % 3600) / 60);
      const seconds = duration % 60;
      
      if (hours > 0) {
        return `${hours}:${minutes.toString().padStart(2, '0')}:${seconds.toString().padStart(2, '0')}`;
      }
      return `${minutes}:${seconds.toString().padStart(2, '0')}`;
    }
    
    // Check if current user owns the stream
    function isStreamOwner(stream) {
      if (!walletConnected || !currentUserAddress || !stream.streamerAddress) return false;
      
      const cleanCurrentUser = currentUserAddress.replace(/^3/, '');
      const cleanStreamer = stream.streamerAddress.replace(/^3/, '');
      
      return cleanCurrentUser === cleanStreamer;
    }
    
    async function createNewStream() {
      if (!newStreamUrl.trim() || !newStreamTitle.trim()) {
        errorMessage = 'Please provide both stream URL and title';
        return;
      }
      
      if (!walletConnected) {
        errorMessage = 'Please connect your wallet to create a stream room';
        return;
      }
      
      try {
        const detectedPlatform = detectPlatform(newStreamUrl);
        
        if (detectedPlatform === 'unknown') {
          errorMessage = 'Unsupported stream URL format. Please check the examples.';
          return;
        }
        
        // Create unique room ID
        const timestamp = Date.now();
        const userPrefix = currentUserAddress.substring(0, 8);
        const roomId = `stream-${timestamp}-${userPrefix}`;
        
        const newStreamData = {
          url: newStreamUrl,
          title: newStreamTitle,
          streamerAddress: currentUserAddress.replace(/^3/, ''), // Clean address
          roomId: roomId,
          platform: detectedPlatform,
          startTime: timestamp,
          isActive: true
        };
        
        console.log('Creating new stream:', newStreamData);
        
        // Emit event to create the stream room on blockchain
        dispatch('createStream', newStreamData);
        
        // Reset form
        newStreamUrl = '';
        newStreamTitle = '';
        newStreamPlatform = 'youtube';
        errorMessage = '';
        
        // Switch to browse view and refresh streams
        activeView = 'browse';
        
        // Refresh streams after a short delay to pick up the new stream
        setTimeout(() => {
          fetchLiveStreams();
        }, 2000);
        
      } catch (error) {
        console.error('Error creating stream:', error);
        errorMessage = 'Failed to create stream room: ' + error.message;
      }
    }
    
    function closeModal() {
      visible = false;
      activeView = 'browse';
      errorMessage = '';
      dispatch('close');
    }
    
    function goBack() {
      if (activeView === 'create') {
        activeView = 'browse';
        errorMessage = '';
      }
    }
    
    // Manual refresh function
    function refreshStreams() {
      fetchLiveStreams();
      showCustomToast('Refreshing live streams...', 2000, 'info');
    }
  </script>
  {#if visible}
  <div class="stream-overlay" transition:fade={{ duration: 200 }}>
    <div class="stream-modal" transition:slide={{ duration: 300 }}>
      
      <!-- Modal Header -->
      <div class="modal-header">
        <div class="header-left">
          {#if activeView !== 'browse'}
            <button class="back-btn" on:click={goBack}>
              <i class="fa-solid fa-arrow-left"></i>
            </button>
          {/if}
          
          <div class="header-title">
            {#if activeView === 'browse'}
              <h2>🔴 Live Streams</h2>
            {:else if activeView === 'create'}
              <h2>Create New Stream</h2>
            {/if}
          </div>
        </div>
        
        <div class="header-right">
          {#if activeView === 'browse'}
            <button class="refresh-btn" on:click={refreshStreams} disabled={loadingStreams}>
              <i class="fa-solid fa-refresh {loadingStreams ? 'spinning' : ''}"></i>
              Refresh
            </button>
            <button class="create-btn" on:click={() => activeView = 'create'} disabled={!walletConnected}>
              <i class="fa-solid fa-plus"></i>
              Create Stream
            </button>
          {/if}
          
          <button class="close-btn" on:click={closeModal}>
            <i class="fa-solid fa-times"></i>
          </button>
        </div>
      </div>
      
      <!-- Modal Content -->
      <div class="modal-content">
        
        {#if activeView === 'browse'}
          <!-- Browse Streams View -->
          <div class="browse-view">
            
            <!-- Search Bar -->
            <div class="search-section">
              <div class="search-container">
                <i class="fa-solid fa-search search-icon"></i>
                <input
                  type="text"
                  bind:value={searchQuery}
                  placeholder="Search streams by title, streamer, or platform..."
                  class="search-input"
                />
                {#if searchQuery}
                  <button class="clear-search" on:click={() => searchQuery = ''}>
                    <i class="fa-solid fa-times"></i>
                  </button>
                {/if}
              </div>
              
              <div class="stream-stats">
                <span class="live-count">
                  {#if loadingStreams}
                    <i class="fa-solid fa-spinner spinning"></i>
                    Loading...
                  {:else}
                    {filteredStreams.length} live stream{filteredStreams.length !== 1 ? 's' : ''}
                  {/if}
                </span>
              </div>
            </div>
            
            <!-- Error Message -->
            {#if errorMessage}
              <div class="error-banner">
                <i class="fa-solid fa-exclamation-triangle"></i>
                {errorMessage}
                <button class="dismiss-error" on:click={() => errorMessage = ''}>
                  <i class="fa-solid fa-times"></i>
                </button>
              </div>
            {/if}
            
            <!-- Streams Grid -->
            <div class="streams-container">
              {#if loadingStreams}
                <div class="loading-state">
                  <i class="fa-solid fa-spinner spinning"></i>
                  <h3>Loading Live Streams...</h3>
                  <p>Scanning blockchain for active streams...</p>
                </div>
              {:else if filteredStreams.length === 0}
                <div class="no-streams">
                  {#if liveStreams.length === 0}
                    <div class="empty-state">
                      <i class="fa-solid fa-video"></i>
                      <h3>No Live Streams</h3>
                      <p>Be the first to start streaming!</p>
                      <button class="start-streaming-btn" on:click={() => activeView = 'create'} disabled={!walletConnected}>
                        <i class="fa-solid fa-broadcast-tower"></i>
                        Start Streaming
                      </button>
                    </div>
                  {:else}
                    <div class="no-results">
                      <i class="fa-solid fa-search"></i>
                      <h3>No streams found</h3>
                      <p>Try adjusting your search terms</p>
                    </div>
                  {/if}
                </div>
              {:else}
                <div class="streams-grid">
                  {#each filteredStreams as stream (stream.roomId)}
                    <div class="stream-card">
                      
                      <!-- Stream Thumbnail/Preview -->
                      <div class="stream-thumbnail">
                        <img 
                          src={getThumbnailUrl(stream)} 
                          alt="Stream thumbnail" 
                          class="thumbnail-bg"
                          on:error={(e) => {
                            e.target.src = 'https://i.ibb.co/DPdWpCCV/pulse.jpg';
                          }}
                        />
                        
                        <span class="streamer-overlay">
                          <i class="fa-solid fa-user"></i>
                          {truncateAddress(stream.streamerAddress)}
                          {#if isStreamOwner(stream)}
                            <span class="owner-badge">You</span>
                          {/if}
                        </span>
                        
                        <div class="stream-badges">
                          <div class="platform-indicator">
                            <i class="{platforms[stream.platform]?.icon || 'fa-solid fa-video'}" style="color: {platforms[stream.platform]?.color || '#FF5500'}"></i>
                            {platforms[stream.platform]?.name || 'Unknown'}
                          </div>
                          
                          <div class="live-badge">
                            <i class="fa-solid fa-circle"></i>
                            LIVE
                          </div>
                        </div>
                      </div>
                      
                      <!-- Stream Info -->
                      <div class="stream-info">
                        <h4 class="stream-title">{stream.title}</h4>
                        
                        <button class="join-room-btn" on:click={() => joinStreamRoom(stream)}>
                          <i class="fa-solid fa-comments"></i>
                          Join Chat
                        </button>
                      </div>
                    </div>
                  {/each}
                </div>
              {/if}
            </div>
          </div>
          
        {:else if activeView === 'create'}
          <!-- Create Stream View -->
          <div class="create-view">
            
            {#if errorMessage}
              <div class="error-banner">
                <i class="fa-solid fa-exclamation-triangle"></i>
                {errorMessage}
                <button class="dismiss-error" on:click={() => errorMessage = ''}>
                  <i class="fa-solid fa-times"></i>
                </button>
              </div>
            {/if}
            
            <div class="create-form">
              <div class="form-section">
                <h3>Stream Information</h3>
                
                <div class="form-group">
                  <label for="stream-title">Stream Title</label>
                  <input 
                    type="text" 
                    id="stream-title"
                    bind:value={newStreamTitle}
                    placeholder="Enter your stream title..."
                    maxlength="100"
                    class="form-input"
                  />
                </div>
                
                <div class="form-group">
                  <label for="platform-select">Platform</label>
                  <select bind:value={newStreamPlatform} id="platform-select" class="form-select">
                    {#each Object.entries(platforms) as [key, platform]}
                      <option value={key}>{platform.name}</option>
                    {/each}
                  </select>
                </div>
                
                <div class="form-group">
                  <label for="stream-url">Stream URL</label>
                  <input 
                    type="url" 
                    id="stream-url"
                    bind:value={newStreamUrl}
                    placeholder="Enter your stream URL..."
                    class="form-input"
                  />
                  <div class="url-examples">
                    <strong>Examples for {platforms[newStreamPlatform]?.name}:</strong>
                    <ul>
                      {#each platforms[newStreamPlatform]?.examples || [] as example}
                        <li>{example}</li>
                      {/each}
                    </ul>
                  </div>
                </div>
              </div>
              
              <div class="form-actions">
                <button class="cancel-btn" on:click={goBack}>
                  Cancel
                </button>
                <button 
                  class="submit-btn" 
                  on:click={createNewStream}
                  disabled={!newStreamUrl.trim() || !newStreamTitle.trim() || !walletConnected}
                >
                  <i class="fa-solid fa-broadcast-tower"></i>
                  Create Stream Room
                </button>
              </div>
            </div>
          </div>
        {/if}
        
      </div>
    </div>
  </div>
{/if}

<style>
  /* Base Styles */
  .stream-overlay {
    position: fixed;
    top: 0;
    left: 0;
    right: 0;
    bottom: 0;
    background-color: rgba(0, 0, 0, 0.9);
    display: flex;
    align-items: center;
    justify-content: center;
    z-index: 1000;
    padding: 20px;
  }

  .stream-modal {
    background-color: #1a1a1a;
    border-radius: 12px;
    width: 100%;
    height: 90vh;
    max-width: 1200px;
    display: flex;
    flex-direction: column;
    box-shadow: 0 20px 60px rgba(0, 0, 0, 0.7);
    border: 1px solid rgba(255, 85, 0, 0.3);
    overflow: hidden;
  }

  /* Header */
  .modal-header {
    display: flex;
    justify-content: space-between;
    align-items: center;
    padding: 1.5rem;
    border-bottom: 1px solid rgba(255, 255, 255, 0.1);
    background: linear-gradient(135deg, rgba(255, 85, 0, 0.1), rgba(255, 85, 0, 0.05));
  }

  .header-left {
    display: flex;
    align-items: center;
    gap: 1rem;
  }

  .header-title h2 {
    margin: 0;
    color: #FF5500;
    font-size: 1.5rem;
  }

  .header-right {
    display: flex;
    gap: 0.75rem;
    align-items: center;
  }

  /* Buttons */
  .back-btn, .close-btn {
    background: rgba(255, 255, 255, 0.1);
    border: none;
    border-radius: 6px;
    width: 36px;
    height: 36px;
    display: flex;
    align-items: center;
    justify-content: center;
    color: #AAA;
    cursor: pointer;
    transition: all 0.2s ease;
  }

  .back-btn:hover, .close-btn:hover {
    background: rgba(255, 255, 255, 0.2);
    color: white;
  }

  .refresh-btn {
    background: rgba(255, 255, 255, 0.1);
    color: #AAA;
    border: none;
    border-radius: 6px;
    padding: 0.5rem 0.75rem;
    cursor: pointer;
    transition: all 0.2s ease;
    display: flex;
    align-items: center;
    gap: 0.5rem;
    font-size: 0.9rem;
  }

  .refresh-btn:hover:not(:disabled) {
    background: rgba(255, 255, 255, 0.2);
    color: white;
  }

  .refresh-btn:disabled {
    opacity: 0.5;
    cursor: not-allowed;
  }

  .create-btn, .start-streaming-btn, .submit-btn {
    background: rgba(255, 85, 0, 0.8);
    color: white;
    border: none;
    border-radius: 6px;
    padding: 0.75rem 1rem;
    cursor: pointer;
    transition: all 0.2s ease;
    display: flex;
    align-items: center;
    gap: 0.5rem;
    font-weight: 500;
  }

  .create-btn:hover:not(:disabled), 
  .start-streaming-btn:hover:not(:disabled), 
  .submit-btn:hover:not(:disabled) {
    background: #FF5500;
  }

  .create-btn:disabled, 
  .start-streaming-btn:disabled, 
  .submit-btn:disabled {
    background: #555;
    cursor: not-allowed;
    opacity: 0.7;
  }

  /* Content Area */
  .modal-content {
    flex: 1;
    overflow: hidden;
    display: flex;
    flex-direction: column;
  }

  .browse-view {
    height: 100%;
    display: flex;
    flex-direction: column;
  }

  /* Search Section */
  .search-section {
    padding: 1.5rem;
    border-bottom: 1px solid rgba(255, 255, 255, 0.1);
  }

  .search-container {
    position: relative;
    margin-bottom: 1rem;
  }

  .search-icon {
    position: absolute;
    left: 1rem;
    top: 50%;
    transform: translateY(-50%);
    color: #AAA;
  }

  .search-input {
    width: 100%;
    padding: 0.75rem 1rem 0.75rem 2.5rem;
    background-color: #333;
    border: 1px solid #444;
    border-radius: 8px;
    color: white;
    font-size: 1rem;
  }

  .search-input:focus {
    border-color: #FF5500;
    outline: none;
  }

  .clear-search {
    position: absolute;
    right: 0.75rem;
    top: 50%;
    transform: translateY(-50%);
    background: none;
    border: none;
    color: #AAA;
    cursor: pointer;
    width: 24px;
    height: 24px;
    border-radius: 50%;
    display: flex;
    align-items: center;
    justify-content: center;
    transition: all 0.2s ease;
  }

  .clear-search:hover {
    background: rgba(255, 255, 255, 0.1);
    color: white;
  }

  .live-count {
    color: #FF5500;
    font-weight: 600;
    display: flex;
    align-items: center;
    gap: 0.5rem;
  }

  /* Error Banner */
  .error-banner {
    background: rgba(255, 68, 68, 0.1);
    border: 1px solid rgba(255, 68, 68, 0.3);
    border-radius: 8px;
    padding: 1rem 1.5rem;
    color: #ff9999;
    margin: 0 1.5rem 1rem;
    display: flex;
    align-items: center;
    gap: 0.75rem;
    position: relative;
  }

  .dismiss-error {
    position: absolute;
    right: 0.75rem;
    top: 50%;
    transform: translateY(-50%);
    background: none;
    border: none;
    color: #ff9999;
    cursor: pointer;
    width: 24px;
    height: 24px;
    border-radius: 50%;
    display: flex;
    align-items: center;
    justify-content: center;
    transition: all 0.2s ease;
  }

  .dismiss-error:hover {
    background: rgba(255, 68, 68, 0.2);
  }

  /* Streams Container */
  .streams-container {
    flex: 1;
    overflow-y: auto;
    padding: 1.5rem;
  }

  .streams-grid {
    display: grid;
    grid-template-columns: repeat(auto-fill, minmax(280px, 1fr));
    gap: 1rem;
  }

  /* Stream Cards */
  .stream-card {
    background: #2a2a2a;
    border: 1px solid rgba(255, 255, 255, 0.1);
    border-radius: 12px;
    overflow: hidden;
    transition: all 0.2s ease;
  }

  .stream-card:hover {
    transform: translateY(-4px);
    border-color: rgba(255, 85, 0, 0.5);
    box-shadow: 0 8px 32px rgba(255, 85, 0, 0.2);
  }

  .stream-thumbnail {
    height: 140px;
    position: relative;
    overflow: hidden;
  }

  .thumbnail-bg {
    width: 100%;
    height: 100%;
    object-fit: cover;
    transition: opacity 0.3s ease;
  }

  .thumbnail-loading {
    opacity: 0.7;
    filter: blur(1px);
  }

  .thumbnail-error {
    background: linear-gradient(45deg, #333, #444);
    display: flex;
    align-items: center;
    justify-content: center;
    color: #666;
    font-size: 2rem;
  }

  .streamer-overlay {
    position: absolute;
    top: 0.75rem;
    left: 0.75rem;
    background: rgba(0, 0, 0, 0.8);
    color: white;
    padding: 0.4rem 0.6rem;
    border-radius: 6px;
    font-size: 0.8rem;
    display: flex;
    align-items: center;
    gap: 0.4rem;
    font-weight: 500;
  }

  .owner-badge {
    background: rgba(255, 85, 0, 0.9);
    color: white;
    padding: 0.1rem 0.3rem;
    border-radius: 8px;
    font-size: 0.7rem;
    font-weight: bold;
    margin-left: 0.3rem;
  }

  .stream-badges {
    position: absolute;
    bottom: 0.75rem;
    left: 0.75rem;
    right: 0.75rem;
    display: flex;
    justify-content: space-between;
    align-items: center;
  }

  .platform-indicator {
    background: rgba(0, 0, 0, 0.8);
    color: white;
    padding: 0.3rem 0.5rem;
    border-radius: 6px;
    font-size: 0.75rem;
    display: flex;
    align-items: center;
    gap: 0.3rem;
    font-weight: 500;
  }

  .live-badge {
    background: #ff4444;
    color: white;
    padding: 0.3rem 0.5rem;
    border-radius: 6px;
    font-size: 0.7rem;
    font-weight: bold;
    display: flex;
    align-items: center;
    gap: 0.25rem;
    animation: pulse 2s infinite;
  }

  .stream-info {
    padding: 1rem;
  }

  .stream-title {
    margin: 0 0 0.75rem 0;
    color: white;
    font-size: 1rem;
    font-weight: 600;
    display: -webkit-box;
    -webkit-line-clamp: 2;
    -webkit-box-orient: vertical;
    overflow: hidden;
    line-height: 1.3;
  }

  .join-room-btn {
    width: 100%;
    background: rgba(255, 85, 0, 0.8);
    color: white;
    border: none;
    border-radius: 6px;
    padding: 0.6rem 1rem;
    cursor: pointer;
    transition: all 0.2s ease;
    display: flex;
    align-items: center;
    justify-content: center;
    gap: 0.5rem;
    font-weight: 500;
    font-size: 0.9rem;
  }

  .join-room-btn:hover {
    background: #FF5500;
  }

  /* Loading & Empty States */
  .loading-state, .empty-state, .no-results {
    height: 100%;
    display: flex;
    flex-direction: column;
    align-items: center;
    justify-content: center;
    color: #AAA;
    text-align: center;
  }

  .loading-state i, .empty-state i, .no-results i {
    font-size: 3rem;
    margin-bottom: 1rem;
    color: #555;
  }

  .loading-state i {
    color: #FF5500;
  }

  .loading-state h3, .empty-state h3, .no-results h3 {
    margin: 0 0 0.5rem 0;
    color: white;
    font-size: 1.2rem;
  }

  .loading-state p, .empty-state p, .no-results p {
    margin: 0;
    font-size: 1rem;
  }

  .empty-state p {
    margin-bottom: 2rem;
  }

  /* Create Form */
  .create-view {
    height: 100%;
    overflow-y: auto;
    padding: 2rem;
    display: flex;
    flex-direction: column;
    align-items: center;
  }

  .create-form {
    width: 100%;
    max-width: 600px;
  }

  .form-section h3 {
    margin: 0 0 1.5rem 0;
    color: #FF5500;
    font-size: 1.3rem;
  }

  .form-group {
    margin-bottom: 1.5rem;
  }

  .form-group label {
    display: block;
    color: #CCC;
    font-weight: 500;
    margin-bottom: 0.5rem;
  }

  .form-input, .form-select {
    width: 100%;
    padding: 0.75rem;
    background-color: #333;
    border: 1px solid #444;
    border-radius: 6px;
    color: white;
    font-size: 1rem;
  }

  .form-input:focus, .form-select:focus {
    border-color: #FF5500;
    outline: none;
  }

  .url-examples {
    margin-top: 0.75rem;
    padding: 1rem;
    background: rgba(255, 255, 255, 0.05);
    border-radius: 6px;
    border-left: 3px solid #FF5500;
  }

  .url-examples strong {
    color: #FF5500;
    display: block;
    margin-bottom: 0.5rem;
  }

  .url-examples ul {
    margin: 0;
    padding-left: 1.25rem;
    color: #AAA;
  }

  .url-examples li {
    margin-bottom: 0.25rem;
    font-family: monospace;
    font-size: 0.9rem;
  }

  .form-actions {
    display: flex;
    gap: 1rem;
    justify-content: flex-end;
    margin-top: 2rem;
    padding-top: 1.5rem;
    border-top: 1px solid rgba(255, 255, 255, 0.1);
  }

  .cancel-btn {
    background: rgba(255, 255, 255, 0.1);
    color: #CCC;
    border: none;
    border-radius: 6px;
    padding: 0.75rem 1.5rem;
    cursor: pointer;
    transition: all 0.2s ease;
    font-weight: 500;
  }

  .cancel-btn:hover {
    background: rgba(255, 255, 255, 0.2);
    color: white;
  }

  /* Animations */
  @keyframes pulse {
    0%, 100% { opacity: 1; }
    50% { opacity: 0.7; }
  }

  @keyframes spinning {
    to { transform: rotate(360deg); }
  }

  .spinning {
    animation: spinning 1s linear infinite;
  }

  /* Responsive Design */
  @media (max-width: 768px) {
    .stream-modal {
      height: 95vh;
      margin: 10px;
    }

    .modal-header {
      padding: 1rem;
      flex-wrap: wrap;
      gap: 0.5rem;
    }

    .header-title h2 {
      font-size: 1.2rem;
    }

    .search-section, .streams-container, .create-view {
      padding: 1rem;
    }

    .streams-grid {
      grid-template-columns: 1fr;
    }

    .form-actions {
      flex-direction: column;
    }
  }

  @media (max-width: 480px) {
    .modal-header {
      padding: 0.75rem;
      flex-direction: column;
      align-items: stretch;
      gap: 0.75rem;
    }

    .header-left {
      justify-content: space-between;
    }

    .header-right {
      justify-content: space-between;
    }

    .stream-thumbnail {
      height: 120px;
    }

    .streams-grid {
      grid-template-columns: 1fr;
      gap: 0.75rem;
    }

    .stream-info {
      padding: 0.75rem;
    }

    .stream-title {
      font-size: 0.9rem;
    }
  }
</style>