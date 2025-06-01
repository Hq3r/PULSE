<!-- InfoModal.svelte - Comprehensive Modal with Admin Dashboard Quality Stats -->
<script lang="ts">
    import { onMount, onDestroy } from 'svelte';
    import { slide, fade } from 'svelte/transition';
    import SoundToggle from '$lib/components/common/SoundToggle.svelte';
    import ProfanityFilterToggle from '$lib/components/main/ProfanityFilterToggle.svelte';
    import EcosystemGrid from '$lib/components/main/EcosystemGrid.svelte';
    import ServiceCardsGrid from '$lib/components/main/ServiceCardsGrid.svelte';
    
    // Props
    export let showInfo = false;
    export let toggleInfo: () => void;
    export let messageCount = 0;
    export let pendingCount = 0;
    export let chatroomsCount = 0;
    export let chatContract = 'BhRz5Qd2jtgTdaKPewYd4EjSquVegcmgxkqumH4GioKABQAGxofYfLiMCzy3EbFYFTBvHgnw94LkPa8NtPsv';
    
    // State
    let activeTab = 'about';
    let comprehensiveStats = {
      totalRooms: 0,
      publicRooms: 0,
      privateRooms: 0,
      totalMessages: 0,
      publicMessages: 0,
      privateMessages: 0,
      pendingMessages: 0,
      defaultRooms: 4,
      customRooms: 0,
      discoveredRooms: 0
    };
    let isLoadingStats = false;
    
    // Set active tab
    function setTab(tab) {
      activeTab = tab;
    }
    
    // Decode ErgoHex string (same as admin dashboard)
    function decodeErgoHex(hex) {
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
    
    // Calculate comprehensive statistics (like admin dashboard)
    async function calculateComprehensiveStats() {
      isLoadingStats = true;
      
      try {
        // Initialize stats
        let totalRooms = 0;
        let publicRooms = 0;
        let privateRooms = 0;
        let totalMessages = 0;
        let publicMessages = 0;
        let privateMessages = 0;
        let customRooms = 0;
        let discoveredRooms = 0;
        
        // Get localStorage room data
        const keys = Object.keys(localStorage);
        const messageKeys = keys.filter(key => key.startsWith('ergoChat_messages_'));
        
        // Default rooms
        const defaultRoomIds = ['general', 'trading', 'development', 'governance'];
        
        // Process each room's messages
        for (const key of messageKeys) {
          const roomId = key.replace('ergoChat_messages_', '');
          
          try {
            const storedMessages = localStorage.getItem(key);
            if (storedMessages) {
              const messages = JSON.parse(storedMessages);
              const messageCount = messages.length;
              
              totalRooms++;
              totalMessages += messageCount;
              
              // Categorize room type
              if (roomId.startsWith('private-')) {
                privateRooms++;
                privateMessages += messageCount;
              } else {
                publicRooms++;
                publicMessages += messageCount;
                
                // Count custom vs discovered rooms
                if (!defaultRoomIds.includes(roomId)) {
                  if (roomId.startsWith('custom-')) {
                    customRooms++;
                  } else {
                    discoveredRooms++;
                  }
                }
              }
            }
          } catch (e) {
            console.error(`Error parsing messages for room ${roomId}:`, e);
          }
        }
        
        // Add pending messages
        try {
          const pendingData = localStorage.getItem('ergoChat_mempool');
          if (pendingData) {
            const pendingMessages = JSON.parse(pendingData);
            
            for (const msg of pendingMessages) {
              totalMessages++;
              
              if (msg.chatroomId && msg.chatroomId.startsWith('private-')) {
                privateMessages++;
              } else {
                publicMessages++;
              }
            }
          }
        } catch (e) {
          console.error('Error parsing pending messages:', e);
        }
        
        // Try to get additional room data from blockchain (like admin dashboard)
        try {
          const response = await fetch(`https://api.ergoplatform.com/api/v1/boxes/byAddress/${chatContract}?limit=200`);
          if (response.ok) {
            const data = await response.json();
            const discoveredRoomsMap = new Map();
            
            for (const box of data.items) {
              if (box.additionalRegisters && box.additionalRegisters.R7) {
                try {
                  let chatroomRaw = '';
                  if (typeof box.additionalRegisters.R7 === 'string') {
                    chatroomRaw = box.additionalRegisters.R7;
                  } else if (box.additionalRegisters.R7.serializedValue) {
                    chatroomRaw = box.additionalRegisters.R7.serializedValue;
                  } else if (box.additionalRegisters.R7.renderedValue) {
                    chatroomRaw = box.additionalRegisters.R7.renderedValue;
                  }
                  
                  const chatroomId = decodeErgoHex(chatroomRaw);
                  if (chatroomId && !discoveredRoomsMap.has(chatroomId)) {
                    discoveredRoomsMap.set(chatroomId, true);
                  }
                } catch (e) {
                  // Skip invalid entries
                }
              }
            }
            
            // Update discovered rooms count based on blockchain data
            const blockchainRooms = Array.from(discoveredRoomsMap.keys());
            const blockchainDiscovered = blockchainRooms.filter(roomId => 
              !defaultRoomIds.includes(roomId) && 
              !roomId.startsWith('private-') &&
              !roomId.startsWith('custom-')
            ).length;
            
            const blockchainPrivate = blockchainRooms.filter(roomId => 
              roomId.startsWith('private-')
            ).length;
            
            // Use blockchain data if it shows more rooms than localStorage
            if (blockchainDiscovered > discoveredRooms) {
              discoveredRooms = blockchainDiscovered;
            }
            
            if (blockchainPrivate > privateRooms) {
              const additionalPrivateRooms = blockchainPrivate - privateRooms;
              privateRooms = blockchainPrivate;
              totalRooms += additionalPrivateRooms;
            }
          }
        } catch (e) {
          console.log('Could not fetch blockchain data for additional stats');
        }
        
        // Update comprehensive stats
        comprehensiveStats = {
          totalRooms,
          publicRooms,
          privateRooms,
          totalMessages,
          publicMessages,
          privateMessages,
          pendingMessages: pendingCount,
          defaultRooms: 4,
          customRooms,
          discoveredRooms
        };
        
      } catch (error) {
        console.error('Error calculating comprehensive stats:', error);
      } finally {
        isLoadingStats = false;
      }
    }
    
    // Calculate stats when modal opens
    $: if (showInfo && activeTab === 'about') {
      calculateComprehensiveStats();
    }
    
    onMount(() => {
      if (showInfo) {
        calculateComprehensiveStats();
      }
    });
  </script>
  
  {#if showInfo}
    <div class="info-modal" on:click|self={toggleInfo} transition:fade={{ duration: 200 }}>
      <div class="info-content" transition:slide={{ duration: 300, y: 20 }}>
        <div class="info-header">
          <h2>Ergo Blockchain Chat</h2>
          <button class="close-button" on:click={toggleInfo}>
            <i class="fa-solid fa-times"></i>
          </button>
        </div>
        
        <!-- Tabs -->
        <div class="tabs-container">
          <div class="tabs">
            <button 
              class="tab-button {activeTab === 'about' ? 'active' : ''}" 
              on:click={() => setTab('about')}
            >
              <i class="fa-solid fa-chart-bar"></i>
              <span>Statistics</span>
            </button>
            
            <button 
              class="tab-button {activeTab === 'features' ? 'active' : ''}" 
              on:click={() => setTab('features')}
            >
              <i class="fa-solid fa-star"></i>
              <span>Features</span>
            </button>
            
            <button 
              class="tab-button {activeTab === 'settings' ? 'active' : ''}" 
              on:click={() => setTab('settings')}
            >
              <i class="fa-solid fa-sliders-h"></i>
              <span>Settings</span>
            </button>
            
            <button 
              class="tab-button {activeTab === 'ecosystem' ? 'active' : ''}" 
              on:click={() => setTab('ecosystem')}
            >
              <i class="fa-solid fa-globe"></i>
              <span>Ecosystem</span>
            </button>
            
            <button 
              class="tab-button {activeTab === 'services' ? 'active' : ''}" 
              on:click={() => setTab('services')}
            >
              <i class="fa-solid fa-rocket"></i>
              <span>Services</span>
            </button>
          </div>
        </div>
        
        <!-- Tab Content -->
        <div class="tab-content">
          <!-- Statistics Tab -->
          {#if activeTab === 'about'}
            <div class="stats-tab">
              <h3>Chat Statistics</h3>
              
              {#if isLoadingStats}
                <div class="loading-state">
                  <div class="spinner"></div>
                  <p>Calculating comprehensive statistics...</p>
                </div>
              {:else}
                <!-- Main Stats Grid -->
                <div class="main-stats-grid">
                  <div class="stat-card highlight">
                    <div class="stat-icon total">
                      <i class="fa-solid fa-comments"></i>
                    </div>
                    <div class="stat-content">
                      <span class="stat-value total">{comprehensiveStats.totalMessages}</span>
                      <span class="stat-label">Total Messages</span>
                    </div>
                  </div>
                  
                  <div class="stat-card highlight">
                    <div class="stat-icon total">
                      <i class="fa-solid fa-door-open"></i>
                    </div>
                    <div class="stat-content">
                      <span class="stat-value total">{comprehensiveStats.totalRooms}</span>
                      <span class="stat-label">Total Rooms</span>
                    </div>
                  </div>
                  
                  <div class="stat-card">
                    <div class="stat-icon pending">
                      <i class="fa-solid fa-clock"></i>
                    </div>
                    <div class="stat-content">
                      <span class="stat-value pending">{comprehensiveStats.pendingMessages}</span>
                      <span class="stat-label">Pending</span>
                    </div>
                  </div>
                </div>
                
                <!-- Detailed Breakdown -->
                <div class="breakdown-section">
                  <h4>Room Breakdown</h4>
                  <div class="breakdown-grid">
                    <div class="breakdown-item">
                      <span class="breakdown-icon public"><i class="fa-solid fa-globe"></i></span>
                      <div class="breakdown-content">
                        <span class="breakdown-value">{comprehensiveStats.publicRooms}</span>
                        <span class="breakdown-label">Public Rooms</span>
                      </div>
                    </div>
                    
                    <div class="breakdown-item">
                      <span class="breakdown-icon private"><i class="fa-solid fa-lock"></i></span>
                      <div class="breakdown-content">
                        <span class="breakdown-value">{comprehensiveStats.privateRooms}</span>
                        <span class="breakdown-label">Private Rooms</span>
                      </div>
                    </div>
                    
                    <div class="breakdown-item">
                      <span class="breakdown-icon default"><i class="fa-solid fa-home"></i></span>
                      <div class="breakdown-content">
                        <span class="breakdown-value">{comprehensiveStats.defaultRooms}</span>
                        <span class="breakdown-label">Default Rooms</span>
                      </div>
                    </div>
                    
                    <div class="breakdown-item">
                      <span class="breakdown-icon discovered"><i class="fa-solid fa-search"></i></span>
                      <div class="breakdown-content">
                        <span class="breakdown-value">{comprehensiveStats.discoveredRooms}</span>
                        <span class="breakdown-label">Discovered</span>
                      </div>
                    </div>
                  </div>
                </div>
                
                <!-- Message Breakdown -->
                <div class="breakdown-section">
                  <h4>Message Breakdown</h4>
                  <div class="breakdown-grid">
                    <div class="breakdown-item">
                      <span class="breakdown-icon public"><i class="fa-solid fa-eye"></i></span>
                      <div class="breakdown-content">
                        <span class="breakdown-value">{comprehensiveStats.publicMessages}</span>
                        <span class="breakdown-label">Public Messages</span>
                      </div>
                    </div>
                    
                    <div class="breakdown-item">
                      <span class="breakdown-icon private"><i class="fa-solid fa-user-secret"></i></span>
                      <div class="breakdown-content">
                        <span class="breakdown-value">{comprehensiveStats.privateMessages}</span>
                        <span class="breakdown-label">Private Messages</span>
                      </div>
                    </div>
                  </div>
                </div>
              {/if}
              
              <!-- About Section -->
              <div class="about-section">
                <h4>About This Application</h4>
                <p>This is a decentralized chat system built on the Ergo blockchain. Every message is stored as a transaction, making this chat:</p>
                
                <ul class="features-list">
                  <li><i class="fa-solid fa-lock"></i> <strong>Permanent</strong> - Messages can't be deleted or censored</li>
                  <li><i class="fa-solid fa-globe"></i> <strong>Decentralized</strong> - No central server or database</li>
                  <li><i class="fa-solid fa-shield-alt"></i> <strong>Transparent</strong> - All messages are publicly visible on the blockchain</li>
                  <li><i class="fa-solid fa-sync"></i> <strong>Real-time</strong> - Messages appear immediately through mempool monitoring</li>
                </ul>
                
                <div class="contract-info">
                  <h5>Smart Contract Address</h5>
                  <div class="contract-address">
                    <code>{chatContract}</code>
                  </div>
                </div>
              </div>
            </div>
          
          <!-- Features Tab -->
          {:else if activeTab === 'features'}
            <div class="features-tab">
              <h3>Chat Features</h3>
              
              <div class="features-grid">
                <div class="feature-card">
                  <div class="feature-icon">
                    <i class="fa-solid fa-comments"></i>
                  </div>
                  <div class="feature-content">
                    <h4>Chatrooms</h4>
                    <p>Create and join public or private chatrooms for different topics</p>
                  </div>
                </div>
                
                <div class="feature-card">
                  <div class="feature-icon">
                    <i class="fa-solid fa-reply"></i>
                  </div>
                  <div class="feature-content">
                    <h4>Threading</h4>
                    <p>Reply to messages and follow conversation threads</p>
                  </div>
                </div>
                
                <div class="feature-card">
                  <div class="feature-icon">
                    <i class="fa-solid fa-donate"></i>
                  </div>
                  <div class="feature-content">
                    <h4>Tipping</h4>
                    <p>Send ERG and other tokens to users directly in chat</p>
                  </div>
                </div>
                
                <div class="feature-card">
                  <div class="feature-icon">
                    <i class="fa-regular fa-face-smile"></i>
                  </div>
                  <div class="feature-content">
                    <h4>Emoji Support</h4>
                    <p>Express yourself with a wide range of emojis</p>
                  </div>
                </div>
              </div>
              
              <div class="commands-section">
                <h4>Available Commands</h4>
                <div class="commands-list">
                  <div class="command">
                    <code>/tip [amount] [token] [address]</code>
                    <p>Send a tip to someone</p>
                  </div>
                  <div class="command">
                    <code>/price [token]</code>
                    <p>Check token price and stats</p>
                  </div>
                  <div class="command">
                    <code>/help</code>
                    <p>Show available commands</p>
                  </div>
                </div>
              </div>
            </div>
          
          <!-- Settings Tab -->
          {:else if activeTab === 'settings'}
            <div class="settings-tab">
              <h3>Settings & Controls</h3>
              
              <div class="settings-list">
                <div class="setting-item">
                  <div class="setting-description">
                    <h4>Sound Notifications</h4>
                    <p>Play sounds for new messages</p>
                  </div>
                  <div class="setting-control">
                    <SoundToggle />
                  </div>
                </div>
                
                <div class="setting-item">
                  <div class="setting-description">
                    <h4>Profanity Filter</h4>
                    <p>Filter offensive language in messages</p>
                  </div>
                  <div class="setting-control">
                    <ProfanityFilterToggle showLabel={false} />
                  </div>
                </div>
                
                <div class="setting-item">
                  <div class="setting-description">
                    <h4>Auto-scroll Chat</h4>
                    <p>Automatically scroll to new messages</p>
                  </div>
                  <div class="setting-control">
                    <label class="toggle">
                      <input type="checkbox" checked>
                      <span class="slider"></span>
                    </label>
                  </div>
                </div>
              </div>
            </div>
          
          <!-- Ecosystem Tab -->
          {:else if activeTab === 'ecosystem'}
            <div class="ecosystem-tab">
              <h3>Ergo Ecosystem</h3>
              <p class="ecosystem-description">Explore the growing ecosystem of applications built on Ergo blockchain.</p>
              
              <EcosystemGrid itemsPerRow={2} />
            </div>
            
          <!-- Services Tab -->
          {:else if activeTab === 'services'}
            <div class="services-tab">
              <h3>Ergo Services</h3>
              <p class="services-description">Discover various services built on the Ergo blockchain.</p>
              
              <ServiceCardsGrid showInInfoModal={true} />
            </div>
          {/if}
        </div>
      </div>
    </div>
  {/if}
  

  <style>
   .info-modal {
    position: fixed;
    top: 0;
    left: 0;
    right: 0;
    bottom: 0;
    background-color: rgba(0, 0, 0, 0.8);
    z-index: 100;
    display: flex;
    align-items: center;
    justify-content: center;
    overflow-y: auto;
    padding: 2rem 1rem;
  }
  
  .info-content {
    background-color: #1E1E1E;
    border-radius: 12px;
    max-width: 800px;
    width: 90%;
    max-height: 85vh;
    overflow-y: auto;
    box-shadow: 0 10px 25px rgba(0, 0, 0, 0.3);
    display: flex;
    flex-direction: column;
  }
  
  .info-header {
    display: flex;
    justify-content: space-between;
    align-items: center;
    padding: 1.25rem 1.5rem;
    border-bottom: 1px solid rgba(255, 255, 255, 0.1);
    position: sticky;
    top: 0;
    background-color: #1E1E1E;
    z-index: 10;
    border-top-left-radius: 12px;
    border-top-right-radius: 12px;
  }
  
  .info-header h2 {
    margin: 0;
    font-size: 1.5rem;
    color: #FF5500;
    font-weight: 600;
  }
  
  .close-button {
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
  
  .close-button:hover {
    background-color: rgba(255, 255, 255, 0.1);
    color: white;
  }
  
  /* Tabs */
  .tabs-container {
    border-bottom: 1px solid rgba(255, 255, 255, 0.1);
    background-color: #262626;
    position: sticky;
    top: 66px;
    z-index: 5;
  }
  
  .tabs {
    display: flex;
    overflow-x: auto;
    scrollbar-width: none;
    -ms-overflow-style: none;
  }
  
  .tabs::-webkit-scrollbar {
    display: none;
  }
  
  .tab-button {
    padding: 0.75rem 1.25rem;
    background: none;
    border: none;
    color: #AAA;
    cursor: pointer;
    font-size: 0.9rem;
    font-weight: 500;
    white-space: nowrap;
    transition: all 0.2s ease;
    display: flex;
    align-items: center;
    gap: 0.5rem;
    border-bottom: 2px solid transparent;
  }
  
  .tab-button:hover {
    color: white;
    background-color: rgba(255, 255, 255, 0.05);
  }
  
  .tab-button.active {
    color: #FF5500;
    border-bottom-color: #FF5500;
  }
  
  /* Tab Content */
  .tab-content {
    padding: 1.5rem;
    color: #DDD;
  }
  
  /* Statistics Tab Styles */
  .stats-tab h3 {
    margin-top: 0;
    margin-bottom: 1.5rem;
    color: #FF5500;
    font-size: 1.5rem;
  }
  
  .main-stats-grid {
    display: grid;
    grid-template-columns: repeat(3, 1fr);
    gap: 1rem;
    margin-bottom: 2rem;
  }
  
  .stat-card {
    background: rgba(255, 255, 255, 0.05);
    border-radius: 8px;
    padding: 1.25rem;
    display: flex;
    align-items: center;
    gap: 1rem;
    transition: all 0.2s ease;
    border: 1px solid rgba(255, 255, 255, 0.1);
  }
  
  .stat-card.highlight {
    background: rgba(255, 85, 0, 0.1);
    border-color: rgba(255, 85, 0, 0.3);
  }
  
  .stat-card:hover {
    background: rgba(255, 255, 255, 0.08);
    transform: translateY(-2px);
  }
  
  .stat-icon {
    width: 3rem;
    height: 3rem;
    border-radius: 50%;
    display: flex;
    align-items: center;
    justify-content: center;
    font-size: 1.25rem;
  }
  
  .stat-icon.total {
    background: rgba(255, 85, 0, 0.2);
    color: #FF5500;
  }
  
  .stat-icon.pending {
    background: rgba(255, 193, 7, 0.2);
    color: #FFC107;
  }
  
  .stat-content {
    display: flex;
    flex-direction: column;
  }
  
  .stat-value {
    font-size: 2rem;
    font-weight: 700;
    line-height: 1;
    margin-bottom: 0.25rem;
  }
  
  .stat-value.total {
    color: #FF5500;
  }
  
  .stat-value.pending {
    color: #FFC107;
  }
  
  .stat-label {
    font-size: 0.9rem;
    color: #AAA;
    font-weight: 500;
  }
  
  /* Breakdown Sections */
  .breakdown-section {
    margin-bottom: 2rem;
  }
  
  .breakdown-section h4 {
    margin: 0 0 1rem 0;
    color: #CCC;
    font-size: 1.1rem;
  }
  
  .breakdown-grid {
    display: grid;
    grid-template-columns: repeat(auto-fit, minmax(150px, 1fr));
    gap: 1rem;
  }
  
  .breakdown-item {
    display: flex;
    align-items: center;
    gap: 0.75rem;
    background: rgba(255, 255, 255, 0.03);
    padding: 1rem;
    border-radius: 6px;
    border: 1px solid rgba(255, 255, 255, 0.05);
  }
  
  .breakdown-icon {
    width: 2.5rem;
    height: 2.5rem;
    border-radius: 50%;
    display: flex;
    align-items: center;
    justify-content: center;
    font-size: 1rem;
  }
  
  .breakdown-icon.public {
    background: rgba(46, 204, 113, 0.2);
    color: #2ecc71;
  }
  
  .breakdown-icon.private {
    background: rgba(155, 89, 182, 0.2);
    color: #9b59b6;
  }
  
  .breakdown-icon.default {
    background: rgba(52, 152, 219, 0.2);
    color: #3498db;
  }
  
  .breakdown-icon.discovered {
    background: rgba(241, 196, 15, 0.2);
    color: #f1c40f;
  }
  
  .breakdown-content {
    display: flex;
    flex-direction: column;
  }
  
  .breakdown-value {
    font-size: 1.5rem;
    font-weight: 600;
    color: white;
    line-height: 1;
  }
  
  .breakdown-label {
    font-size: 0.8rem;
    color: #AAA;
  }
  
  /* About Section */
  .about-section {
    background: rgba(255, 255, 255, 0.03);
    border-radius: 8px;
    padding: 1.5rem;
    border: 1px solid rgba(255, 255, 255, 0.1);
  }
  
  .about-section h4 {
    margin-top: 0;
    color: #FF5500;
    font-size: 1.2rem;
  }
  
  .about-section p {
    margin-bottom: 1rem;
    line-height: 1.5;
  }
  
  .features-list {
    margin: 1rem 0;
    list-style-type: none;
    padding: 0;
  }
  
  .features-list li {
    margin-bottom: 0.75rem;
    display: flex;
    align-items: center;
    gap: 0.75rem;
  }
  
  .features-list li i {
    color: #FF5500;
    font-size: 1rem;
    width: 1.25rem;
    text-align: center;
  }
  
  .contract-info {
    margin-top: 1.5rem;
  }
  
  .contract-info h5 {
    margin: 0 0 0.5rem 0;
    color: #CCC;
    font-size: 1rem;
  }
  
  .contract-address code {
    font-family: monospace;
    font-size: 0.8rem;
    white-space: nowrap;
    color: #FF5500;
  }
  
  /* Loading State */
  .loading-state {
    display: flex;
    flex-direction: column;
    align-items: center;
    justify-content: center;
    padding: 3rem;
    gap: 1rem;
  }
  
  .spinner {
    width: 2.5rem;
    height: 2.5rem;
    border: 3px solid rgba(255, 85, 0, 0.3);
    border-top-color: #FF5500;
    border-radius: 50%;
    animation: spin 1s linear infinite;
  }
  
  @keyframes spin {
    to {
      transform: rotate(360deg);
    }
  }
  
  /* Features Tab */
  .features-tab h3 {
    font-size: 1.3rem;
    margin-top: 0;
    margin-bottom: 1rem;
    color: #FF5500;
  }
  
  .features-grid {
    display: grid;
    grid-template-columns: repeat(2, 1fr);
    gap: 1rem;
    margin-bottom: 2rem;
  }
  
  .feature-card {
    display: flex;
    align-items: flex-start;
    background-color: rgba(255, 255, 255, 0.05);
    border-radius: 8px;
    padding: 1rem;
    transition: all 0.2s ease;
    border: 1px solid rgba(255, 255, 255, 0.1);
  }
  
  .feature-card:hover {
    background-color: rgba(255, 255, 255, 0.08);
  }
  
  .feature-icon {
    display: flex;
    align-items: center;
    justify-content: center;
    width: 2.5rem;
    height: 2.5rem;
    border-radius: 8px;
    background-color: rgba(255, 85, 0, 0.1);
    margin-right: 1rem;
    color: #FF5500;
    font-size: 1.1rem;
  }
  
  .feature-content h4 {
    margin: 0 0 0.5rem 0;
    font-size: 1.1rem;
    color: #FF5500;
  }
  
  .feature-content p {
    margin: 0;
    font-size: 0.9rem;
    color: #CCC;
    line-height: 1.4;
  }
  
  .commands-section {
    background-color: rgba(0, 0, 0, 0.2);
    border-radius: 8px;
    padding: 1rem;
    border: 1px solid rgba(255, 255, 255, 0.1);
  }
  
  .commands-section h4 {
    margin-top: 0;
    margin-bottom: 1rem;
    font-size: 1.1rem;
    color: #FF5500;
  }
  
  .commands-list {
    display: flex;
    flex-direction: column;
    gap: 1rem;
  }
  
  .command {
    padding: 0.75rem;
    background-color: rgba(255, 255, 255, 0.05);
    border-radius: 6px;
    border: 1px solid rgba(255, 255, 255, 0.1);
  }
  
  .command code {
    display: block;
    font-family: monospace;
    background-color: rgba(0, 0, 0, 0.3);
    padding: 0.5rem;
    border-radius: 4px;
    color: #FF5500;
    margin-bottom: 0.5rem;
    font-size: 0.9rem;
  }
  
  .command p {
    margin: 0;
    font-size: 0.9rem;
    color: #CCC;
  }
  
  /* Settings Tab */
  .settings-tab h3 {
    font-size: 1.3rem;
    margin-top: 0;
    margin-bottom: 1rem;
    color: #FF5500;
  }
  
  .settings-list {
    display: flex;
    flex-direction: column;
    gap: 1rem;
  }
  
  .setting-item {
    display: flex;
    justify-content: space-between;
    align-items: center;
    background-color: rgba(255, 255, 255, 0.05);
    border-radius: 8px;
    padding: 1rem;
    border: 1px solid rgba(255, 255, 255, 0.1);
  }
  
  .setting-description h4 {
    margin: 0 0 0.5rem 0;
    font-size: 1.1rem;
    color: #FFF;
  }
  
  .setting-description p {
    margin: 0;
    font-size: 0.9rem;
    color: #AAA;
  }
  
  .toggle {
    position: relative;
    display: inline-block;
    width: 3rem;
    height: 1.5rem;
  }
  
  .toggle input {
    opacity: 0;
    width: 0;
    height: 0;
  }
  
  .slider {
    position: absolute;
    cursor: pointer;
    top: 0;
    left: 0;
    right: 0;
    bottom: 0;
    background-color: #444;
    transition: .4s;
    border-radius: 1.5rem;
  }
  
  .slider:before {
    position: absolute;
    content: "";
    height: 1.1rem;
    width: 1.1rem;
    left: 0.2rem;
    bottom: 0.2rem;
    background-color: white;
    transition: .4s;
    border-radius: 50%;
  }
  
  input:checked + .slider {
    background-color: #FF5500;
  }
  
  input:checked + .slider:before {
    transform: translateX(1.5rem);
  }
  
  /* Ecosystem and Services Tabs */
  .ecosystem-tab h3,
  .services-tab h3 {
    font-size: 1.3rem;
    margin-top: 0;
    margin-bottom: 0.5rem;
    color: #FF5500;
  }
  
  .ecosystem-description,
  .services-description {
    margin-bottom: 1.5rem;
    color: #CCC;
  }
  
  /* Responsive Styles */
  @media (max-width: 768px) {
    .main-stats-grid {
      grid-template-columns: 1fr;
    }
    
    .breakdown-grid {
      grid-template-columns: repeat(2, 1fr);
    }
    
    .features-grid {
      grid-template-columns: 1fr;
    }
    
    .info-content {
      width: 95%;
      max-height: 90vh;
    }
  }
  
  @media (max-width: 480px) {
    .tab-button {
      padding: 0.75rem 0.75rem;
    }
    
    .tab-button span {
      display: none;
    }
    
    .tab-button i {
      font-size: 1.25rem;
    }
    
    .info-header h2 {
      font-size: 1.25rem;
    }
    
    .tab-content {
      padding: 1rem;
    }
    
    .breakdown-grid {
      grid-template-columns: 1fr;
    }
    
    .stat-card {
      padding: 1rem;
    }
    
    .stat-value {
      font-size: 1.5rem;
    }
    
    .main-stats-grid {
      gap: 0.75rem;
    }
  }
  </style>