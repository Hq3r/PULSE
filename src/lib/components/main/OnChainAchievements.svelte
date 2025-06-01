
<script>
  import { createEventDispatcher, onMount } from 'svelte';
  import { slide, fade } from 'svelte/transition';
  import { OnChainAchievementSystem } from '$lib/utils/OnChainAchievementSystem.js';
  
  const dispatch = createEventDispatcher();
  
  // Props
  export let chatContract;
  export let walletConnected = false;
  export let currentUserAddress = '';
  export let allMessages = []; // Pass in your existing messages for performance
  export let visible = false;
  export let targetUserAddress = ''; // NEW: Allow viewing other users
  export let targetUserName = ''; // NEW: Display name for other users
  // 🔇 DISABLE CONSOLE LOGS  
const QUIET_MODE = true; // Set to false when debugging

if (QUIET_MODE) {
    console.log = console.debug = console.info = () => {};
    // Keeps console.warn and console.error for important issues
}
  // Component state
  let achievementSystem;
  let userAchievements = null;
  let loading = false;
  let error = null;
  let selectedTab = 'unlocked';
  let leaderboard = [];
  let loadingLeaderboard = false;
  
  // Determine which user we're viewing
  $: viewingUserAddress = targetUserAddress || currentUserAddress;
  $: isViewingOtherUser = targetUserAddress && targetUserAddress !== currentUserAddress;
  $: displayUserName = targetUserName || (isViewingOtherUser ? truncateAddress(targetUserAddress) : 'Your');
  
  // Initialize achievement system
  onMount(() => {
    achievementSystem = new OnChainAchievementSystem(chatContract);
  });
  
  // Load user achievements when wallet connects or messages update
  $: if (achievementSystem && walletConnected && viewingUserAddress) {
    loadUserAchievements();
  }
  
  // Watch for message updates and reload achievements
  $: if (achievementSystem && allMessages.length > 0 && viewingUserAddress) {
    debouncedReloadAchievements();
  }
  
  // Watch for target user changes
  $: if (achievementSystem && targetUserAddress) {
    loadUserAchievements();
  }
  
  let reloadTimeout;
  function debouncedReloadAchievements() {
    clearTimeout(reloadTimeout);
    reloadTimeout = setTimeout(() => {
      if (userAchievements) { // Only reload if we've loaded before
        loadUserAchievements();
      }
    }, 2000);
  }
  
  async function loadUserAchievements() {
    if (!achievementSystem || !viewingUserAddress) return;
    
    loading = true;
    error = null;
    
    try {
      // Use existing messages for better performance
      const newAchievements = await achievementSystem.checkUserAchievements(
        viewingUserAddress,
        allMessages
      );
      
      // Only check for newly unlocked achievements if viewing current user
      if (!isViewingOtherUser && userAchievements) {
        const previousIds = new Set(userAchievements.unlockedAchievements.map(a => a.id));
        const newUnlocked = newAchievements.unlockedAchievements.filter(a => !previousIds.has(a.id));
        
        // Emit event for new achievements
        newUnlocked.forEach(achievement => {
          dispatch('achievementUnlocked', { achievement });
        });
      }
      
      userAchievements = newAchievements;
    } catch (err) {
      console.error('Error loading achievements:', err);
      error = 'Failed to load achievements';
    } finally {
      loading = false;
    }
  }
  
  async function loadLeaderboard() {
    if (!achievementSystem || loadingLeaderboard) return;
    
    loadingLeaderboard = true;
    
    try {
      console.log('Loading leaderboard with', allMessages.length, 'messages...');
      
      // Pass the existing allMessages array instead of fetching separately
      leaderboard = await achievementSystem.getLeaderboard(allMessages, 'all', 10);
      
      console.log('Leaderboard loaded:', leaderboard.length, 'users');
    } catch (err) {
      console.error('Error loading leaderboard:', err);
    } finally {
      loadingLeaderboard = false;
    }
  }
  
  function closeModal() {
    visible = false;
    dispatch('close');
  }
  
  function formatProgress(progress) {
    return `${progress.currentValue} / ${progress.targetValue}`;
  }
  
  function getProgressPercentage(progress) {
    return Math.round(progress.progress * 100);
  }
  
  function formatStat(key, value) {
    switch (key) {
      case 'message_count':
        return `${value} messages`;
      case 'tips_sent':
        return `${value} tips sent`;
      case 'erg_tipped':
        return `${value.toFixed(3)} ERG tipped`;
      case 'rooms_visited':
        return `${Array.isArray(value) ? value.length : 0} rooms`;
      case 'join_order':
        return `User #${value}`;
      default:
        return `${value}`;
    }
  }
  
  function truncateAddress(address) {
    if (!address) return 'Unknown';
    if (address.length > 12) {
      return `${address.substring(0, 6)}...${address.substring(address.length - 4)}`;
    }
    return address;
  }
  
  // Tab change handler
  function changeTab(tab) {
    selectedTab = tab;
    if (tab === 'leaderboard' && leaderboard.length === 0) {
      loadLeaderboard();
    }
  }
  
  // Refresh data
  function refreshData() {
    if (achievementSystem) {
      achievementSystem.clearCache();
      loadUserAchievements();
      if (selectedTab === 'leaderboard') {
        loadLeaderboard();
      }
    }
  }
  function getRankTooltip(rank) {
    const achievements = rank.count;
    
    switch (rank.emoji) {
      case '👑':
        return `Elite User - ${achievements} achievements! Top tier contributor with ${userAchievements?.stats?.erg_tipped?.toFixed(1) || '0'} ERG tipped`;
      case '⭐':
        return `Star User - ${achievements} achievements! High-value community member`;
      case '🔥':
        return `Active User - ${achievements} achievements! Regular contributor with ${userAchievements?.stats?.message_count || 0} messages`;
      case '✨':
        return `Contributing User - ${achievements} achievements! Growing community member`;
      case '🌱':
        return `New User - Welcome to the community! Keep chatting to earn achievements`;
      default:
        return `User with ${achievements} achievements`;
    }
  }
  
  // Enhanced rank calculation with more detailed criteria
  async function loadUserRank() {
    if (loadingRank || !achievementSystem || !message.sender || isStealthMessage) return;
    
    const cleanedAddress = cleanAddress(message.sender);
    if (!cleanedAddress) return;
    
    loadingRank = true;
    
    try {
      // Get user achievements
      const userAchievements = await achievementSystem.checkUserAchievements(
        cleanedAddress,
        allMessages
      );
      
      // Store for tooltip
      window.currentUserAchievements = userAchievements;
      
      const achievementCount = userAchievements.unlockedAchievements.length;
      const messageCount = userAchievements.stats.message_count || 0;
      const tipsSent = userAchievements.stats.tips_sent || 0;
      const ergTipped = userAchievements.stats.erg_tipped || 0;
      const joinOrder = userAchievements.stats.join_order || 999999;
      
      // Enhanced ranking system
      let rank = '';
      let rankColor = '#999';
      let tier = 'none';
      
      // Elite tier - Top 10 early adopters or whale tippers
      if ((joinOrder <= 10 && achievementCount >= 5) || ergTipped >= 100) {
        rank = '👑';
        rankColor = '#FFD700';
        tier = 'elite';
      }
      // Legendary tier - Very high achievers
      else if (achievementCount >= 8 || ergTipped >= 50 || (tipsSent >= 50 && messageCount >= 200)) {
        rank = '🏆';
        rankColor = '#FF6B00';
        tier = 'legendary';
      }
      // Star tier - High achievers
      else if (achievementCount >= 5 || ergTipped >= 20 || (messageCount >= 500)) {
        rank = '⭐';
        rankColor = '#FF5500';
        tier = 'star';
      }
      // Fire tier - Active users
      else if (achievementCount >= 3 || messageCount >= 100 || tipsSent >= 10) {
        rank = '🔥';
        rankColor = '#FF6B35';
        tier = 'active';
      }
      // Sparkle tier - Contributing users
      else if (achievementCount >= 1 || messageCount >= 10 || tipsSent >= 1) {
        rank = '✨';
        rankColor = '#4A9EFF';
        tier = 'contributor';
      }
      // Seedling tier - New users
      else if (messageCount > 0) {
        rank = '🌱';
        rankColor = '#4CAF50';
        tier = 'newcomer';
      }
      
      userRank = rank ? { 
        emoji: rank, 
        color: rankColor, 
        count: achievementCount,
        tier: tier,
        stats: {
          messages: messageCount,
          tips: tipsSent,
          ergTipped: ergTipped,
          joinOrder: joinOrder
        }
      } : null;
      
    } catch (error) {
      console.warn('Error loading user rank:', error);
      userRank = null;
    } finally {
      loadingRank = false;
    }
  }
</script>

{#if visible}
  <div class="modal-overlay" on:click|self={closeModal} transition:fade={{ duration: 200 }}>
    <div class="achievement-modal" transition:slide={{ duration: 300 }}>
      <!-- Modal Header -->
      <div class="modal-header">
        <h2>
          🏆 {isViewingOtherUser ? `${displayUserName}'s Achievements` : 'Your Achievements'}
        </h2>
        <div class="header-actions">
          <button class="refresh-btn" on:click={refreshData} disabled={loading}>
            <i class="fa-solid fa-refresh {loading ? 'spinning' : ''}"></i>
          </button>
          <button class="close-btn" on:click={closeModal}>
            <i class="fa-solid fa-times"></i>
          </button>
        </div>
      </div>
      
      <!-- Tab Navigation -->
      <div class="tab-nav">
        <button 
          class="tab-btn {selectedTab === 'unlocked' ? 'active' : ''}"
          on:click={() => changeTab('unlocked')}
        >
          Unlocked {userAchievements ? `(${userAchievements.unlockedAchievements.length})` : ''}
        </button>
        <button 
          class="tab-btn {selectedTab === 'progress' ? 'active' : ''}"
          on:click={() => changeTab('progress')}
        >
          Progress
        </button>
        <button 
          class="tab-btn {selectedTab === 'stats' ? 'active' : ''}"
          on:click={() => changeTab('stats')}
        >
          Stats
        </button>
        <button 
          class="tab-btn {selectedTab === 'leaderboard' ? 'active' : ''}"
          on:click={() => changeTab('leaderboard')}
        >
          Leaderboard
        </button>
      </div>
      
      <!-- Modal Body -->
      <div class="modal-body">
        {#if loading && !userAchievements}
          <div class="loading-state">
            <div class="loading-spinner"></div>
            <p>Loading achievements from blockchain...</p>
          </div>
        {:else if error}
          <div class="error-state">
            <i class="fa-solid fa-exclamation-triangle"></i>
            <p>{error}</p>
            <button class="retry-btn" on:click={loadUserAchievements}>
              <i class="fa-solid fa-refresh"></i>
              Retry
            </button>
          </div>
                  {:else if !walletConnected && !isViewingOtherUser}
          <div class="not-connected-state">
            <i class="fa-solid fa-wallet"></i>
            <p>Connect your wallet to view achievements</p>
          </div>
        {:else if selectedTab === 'unlocked'}
          <div class="achievements-grid">
            {#if userAchievements && userAchievements.unlockedAchievements.length === 0}
              <div class="empty-state">
                <i class="fa-solid fa-trophy"></i>
                <p>No achievements unlocked yet</p>
                <small>Start chatting and sending tips to earn achievements!</small>
              </div>
            {:else if userAchievements}
              {#each userAchievements.unlockedAchievements as achievement}
                <div class="achievement-card unlocked">
                  <div class="achievement-icon">{achievement.icon}</div>
                  <div class="achievement-info">
                    <h4>{achievement.name}</h4>
                    <p>{achievement.description}</p>
                    <span class="achievement-category">{achievement.category}</span>
                  </div>
                  <div class="achievement-status">
                    <i class="fa-solid fa-check"></i>
                    <span class="unlock-date">
                      {new Date(achievement.unlockedAt * 1000).toLocaleDateString()}
                    </span>
                  </div>
                </div>
              {/each}
            {/if}
          </div>
        {:else if selectedTab === 'progress'}
          <div class="progress-list">
            {#if userAchievements}
              {#each userAchievements.progress as achievement}
                <div class="progress-item {achievement.isUnlocked ? 'completed' : ''}">
                  <div class="progress-header">
                    <div class="progress-icon">{achievement.icon}</div>
                    <div class="progress-info">
                      <h4>{achievement.name}</h4>
                      <p>{achievement.description}</p>
                    </div>
                    <div class="progress-status">
                      {#if achievement.isUnlocked}
                        <i class="fa-solid fa-check completed"></i>
                      {:else}
                        <span class="progress-text">{formatProgress(achievement)}</span>
                      {/if}
                    </div>
                  </div>
                  <div class="progress-bar">
                    <div 
                      class="progress-fill {achievement.isUnlocked ? 'completed' : ''}"
                      style="width: {getProgressPercentage(achievement)}%"
                    ></div>
                  </div>
                  <div class="progress-percentage">
                    {getProgressPercentage(achievement)}%
                  </div>
                </div>
              {/each}
            {/if}
          </div>
        {:else if selectedTab === 'stats'}
          <div class="stats-section">
            {#if userAchievements && userAchievements.stats}
              <div class="stats-grid">
                {#each Object.entries(userAchievements.stats) as [key, value]}
                  {#if !['first_message_timestamp'].includes(key)}
                    <div class="stat-card">
                      <div class="stat-value">
                        {#if key === 'erg_tipped' || key === 'erg_received'}
                          {value.toFixed(3)}
                        {:else if Array.isArray(value)}
                          {value.length}
                        {:else}
                          {value}
                        {/if}
                      </div>
                      <div class="stat-label">{formatStat(key, value)}</div>
                    </div>
                  {/if}
                {/each}
              </div>
              
              <div class="blockchain-info">
                <h3>🔗 Blockchain Verified</h3>
                <p>All statistics are calculated from on-chain data and cannot be manipulated.</p>
                {#if userAchievements.stats.first_message_timestamp}
                  <p class="join-info">
                    <strong>{isViewingOtherUser ? 'Their' : 'Your'} first message:</strong> 
                    {new Date(userAchievements.stats.first_message_timestamp * 1000).toLocaleDateString()}
                  </p>
                {/if}
                {#if isViewingOtherUser}
                  <p class="viewing-info">
                    <strong>Viewing:</strong> {displayUserName}
                    <br>
                    <small>{viewingUserAddress}</small>
                  </p>
                {/if}
              </div>
            {/if}
          </div>
        {:else if selectedTab === 'leaderboard'}
          <div class="leaderboard-section">
            {#if loadingLeaderboard}
              <div class="loading-state">
                <div class="loading-spinner small"></div>
                <p>Loading leaderboard from blockchain...</p>
              </div>
            {:else if leaderboard.length === 0}
              <div class="empty-state">
                <i class="fa-solid fa-trophy"></i>
                <p>No leaderboard data available</p>
                <button class="retry-btn" on:click={loadLeaderboard}>
                  Load Leaderboard
                </button>
              </div>
            {:else}
              <div class="leaderboard-list">
                <h3>🏆 Top Achievement Holders</h3>
                {#each leaderboard as user, index}
                  <div class="leaderboard-item {user.address === currentUserAddress ? 'current-user' : ''} {user.address === viewingUserAddress ? 'viewing-user' : ''}">
                    <div class="rank">
                      {#if index === 0}
                        🥇
                      {:else if index === 1}
                        🥈
                      {:else if index === 2}
                        🥉
                      {:else}
                        #{index + 1}
                      {/if}
                    </div>
                    <div class="user-info">
                      <div class="user-address">
                        {user.displayAddress || truncateAddress(user.address)}
                        {#if user.address === currentUserAddress}
                          <span class="you-badge">YOU</span>
                        {:else if user.address === viewingUserAddress}
                          <span class="viewing-badge">VIEWING</span>
                        {/if}
                      </div>
                      <div class="user-stats">
                        <span class="stat-highlight">{user.achievementCount} achievements</span>
                        <span class="stat-item">{user.messageCount || 0} messages</span>
                        <span class="stat-item">{user.tipsSent || 0} tips sent</span>
                        {#if user.ergTipped > 0}
                          <span class="stat-item">{user.ergTipped.toFixed(2)} ERG tipped</span>
                        {/if}
                      </div>
                      {#if user.topAchievements && user.topAchievements.length > 0}
                        <div class="user-achievements">
                          {#each user.topAchievements as achievement}
                            <span class="mini-badge" title="{achievement.name}: {achievement.description}">
                              {achievement.icon}
                            </span>
                          {/each}
                        </div>
                      {/if}
                    </div>
                    <div class="achievement-count">
                      {user.achievementCount}
                    </div>
                  </div>
                {/each}
                
                <div class="leaderboard-footer">
                  <small>Rankings based on blockchain-verified achievements</small>
                </div>
              </div>
            {/if}
          </div>
        {/if}
      </div>
    </div>
  </div>
{/if}

<style>
  .modal-overlay {
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
    padding: 20px;
  }

  .achievement-modal {
    background-color: #262626;
    border-radius: 12px;
    width: 100%;
    max-width: 700px;
    max-height: 85vh;
    display: flex;
    flex-direction: column;
    box-shadow: 0 20px 60px rgba(0, 0, 0, 0.5);
    border: 1px solid rgba(255, 85, 0, 0.2);
  }

  .modal-header {
    display: flex;
    justify-content: space-between;
    align-items: center;
    padding: 1.5rem;
    border-bottom: 1px solid rgba(255, 255, 255, 0.1);
    background: linear-gradient(135deg, rgba(255, 85, 0, 0.1), rgba(255, 85, 0, 0.05));
  }

  .modal-header h2 {
    margin: 0;
    color: #FF5500;
    font-size: 1.5rem;
  }

  .header-actions {
    display: flex;
    gap: 0.5rem;
    align-items: center;
  }

  .refresh-btn {
    background: rgba(255, 85, 0, 0.1);
    border: 1px solid rgba(255, 85, 0, 0.3);
    color: #FF5500;
    border-radius: 6px;
    padding: 0.5rem;
    cursor: pointer;
    transition: all 0.2s ease;
    display: flex;
    align-items: center;
    justify-content: center;
    width: 2rem;
    height: 2rem;
  }

  .refresh-btn:hover {
    background: rgba(255, 85, 0, 0.2);
  }

  .refresh-btn:disabled {
    opacity: 0.5;
    cursor: not-allowed;
  }

  .spinning {
    animation: spin 1s linear infinite;
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
    font-size: 1.1rem;
  }

  .close-btn:hover {
    background-color: rgba(255, 255, 255, 0.1);
    color: white;
  }

  .tab-nav {
    display: flex;
    background-color: #1E1E1E;
    border-bottom: 1px solid rgba(255, 255, 255, 0.1);
  }

  .tab-btn {
    flex: 1;
    background: none;
    border: none;
    color: #AAA;
    padding: 1rem;
    cursor: pointer;
    transition: all 0.2s ease;
    border-bottom: 2px solid transparent;
    font-size: 0.9rem;
  }

  .tab-btn:hover {
    background-color: rgba(255, 85, 0, 0.1);
    color: #FF5500;
  }

  .tab-btn.active {
    color: #FF5500;
    border-bottom-color: #FF5500;
    background-color: rgba(255, 85, 0, 0.1);
  }

  .modal-body {
    flex: 1;
    overflow-y: auto;
    padding: 1.5rem;
  }

  /* Loading states */
  .loading-state, .error-state, .not-connected-state {
    display: flex;
    flex-direction: column;
    align-items: center;
    justify-content: center;
    padding: 3rem 2rem;
    color: #AAA;
    text-align: center;
  }

  .loading-spinner {
    width: 2rem;
    height: 2rem;
    border: 3px solid rgba(255, 85, 0, 0.3);
    border-top-color: #FF5500;
    border-radius: 50%;
    animation: spin 1s linear infinite;
    margin-bottom: 1rem;
  }

  .loading-spinner.small {
    width: 1.5rem;
    height: 1.5rem;
    border-width: 2px;
  }

  .error-state i, .not-connected-state i {
    font-size: 2.5rem;
    margin-bottom: 1rem;
    color: #666;
  }

  .retry-btn {
    background: rgba(255, 85, 0, 0.8);
    color: white;
    border: none;
    border-radius: 6px;
    padding: 0.5rem 1rem;
    cursor: pointer;
    margin-top: 1rem;
    transition: all 0.2s ease;
    display: flex;
    align-items: center;
    gap: 0.5rem;
  }

  .retry-btn:hover {
    background: #FF5500;
  }

  /* Achievement cards */
  .achievements-grid {
    display: grid;
    gap: 1rem;
  }

  .achievement-card {
    display: flex;
    align-items: center;
    gap: 1rem;
    padding: 1rem;
    background-color: rgba(0, 0, 0, 0.3);
    border-radius: 8px;
    border: 1px solid rgba(255, 255, 255, 0.1);
    transition: all 0.2s ease;
  }

  .achievement-card.unlocked {
    border-color: rgba(255, 85, 0, 0.3);
    background-color: rgba(255, 85, 0, 0.1);
  }

  .achievement-icon {
    font-size: 2rem;
    width: 3rem;
    height: 3rem;
    display: flex;
    align-items: center;
    justify-content: center;
    background-color: rgba(255, 85, 0, 0.2);
    border-radius: 50%;
  }

  .achievement-info {
    flex: 1;
  }

  .achievement-info h4 {
    margin: 0 0 0.25rem 0;
    color: white;
    font-size: 1rem;
  }

  .achievement-info p {
    margin: 0 0 0.5rem 0;
    color: #CCC;
    font-size: 0.9rem;
  }

  .achievement-category {
    background-color: rgba(255, 85, 0, 0.2);
    color: #FF5500;
    padding: 0.2rem 0.5rem;
    border-radius: 12px;
    font-size: 0.75rem;
    text-transform: uppercase;
    font-weight: 500;
  }

  .achievement-status {
    text-align: center;
    color: #4CAF50;
    font-size: 1.5rem;
  }

  .unlock-date {
    display: block;
    font-size: 0.7rem;
    color: #AAA;
    margin-top: 0.25rem;
  }

  /* Progress items */
  .progress-list {
    display: flex;
    flex-direction: column;
    gap: 1rem;
  }

  .progress-item {
    background-color: rgba(0, 0, 0, 0.3);
    border-radius: 8px;
    border: 1px solid rgba(255, 255, 255, 0.1);
    padding: 1rem;
  }

  .progress-item.completed {
    border-color: rgba(76, 175, 80, 0.3);
    background-color: rgba(76, 175, 80, 0.1);
  }

  .progress-header {
    display: flex;
    align-items: center;
    gap: 1rem;
    margin-bottom: 0.75rem;
  }

  .progress-icon {
    font-size: 1.5rem;
    width: 2.5rem;
    height: 2.5rem;
    display: flex;
    align-items: center;
    justify-content: center;
    background-color: rgba(255, 85, 0, 0.2);
    border-radius: 50%;
  }

  .progress-info {
    flex: 1;
  }

  .progress-info h4 {
    margin: 0 0 0.25rem 0;
    color: white;
    font-size: 0.95rem;
  }

  .progress-info p {
    margin: 0;
    color: #CCC;
    font-size: 0.85rem;
  }

  .progress-status {
    color: #AAA;
    font-size: 0.9rem;
  }

  .progress-status .completed {
    color: #4CAF50;
  }

  .progress-bar {
    width: 100%;
    height: 8px;
    background-color: rgba(255, 255, 255, 0.1);
    border-radius: 4px;
    overflow: hidden;
    margin-bottom: 0.5rem;
  }

  .progress-fill {
    height: 100%;
    background-color: #FF5500;
    transition: width 0.3s ease;
    border-radius: 4px;
  }

  .progress-fill.completed {
    background-color: #4CAF50;
  }

  .progress-percentage {
    text-align: right;
    color: #AAA;
    font-size: 0.8rem;
  }

  /* Stats section */
  .stats-section {
    display: flex;
    flex-direction: column;
    gap: 2rem;
  }

  .stats-grid {
    display: grid;
    grid-template-columns: repeat(auto-fit, minmax(200px, 1fr));
    gap: 1rem;
  }

  .stat-card {
    background-color: rgba(0, 0, 0, 0.3);
    border-radius: 8px;
    border: 1px solid rgba(255, 255, 255, 0.1);
    padding: 1.5rem;
    text-align: center;
  }

  .stat-value {
    font-size: 2rem;
    font-weight: bold;
    color: #FF5500;
    margin-bottom: 0.5rem;
  }

  .stat-label {
    color: #CCC;
    font-size: 0.9rem;
  }

  .blockchain-info {
    background-color: rgba(0, 0, 0, 0.3);
    border: 1px solid rgba(74, 158, 255, 0.3);
    border-radius: 8px;
    padding: 1.5rem;
    text-align: center;
  }

  .blockchain-info h3 {
    margin: 0 0 1rem 0;
    color: #4A9EFF;
  }

  .blockchain-info p {
    margin: 0 0 0.5rem 0;
    color: #CCC;
    font-size: 0.9rem;
  }

  .join-info {
    margin-top: 1rem;
    color: #AAA;
    font-size: 0.85rem;
  }

  .viewing-info {
    margin-top: 1rem;
    color: #4A9EFF;
    font-size: 0.85rem;
    border-top: 1px solid rgba(74, 158, 255, 0.2);
    padding-top: 1rem;
  }

  .viewing-info small {
    font-family: monospace;
    color: #AAA;
    word-break: break-all;
  }

  /* Leaderboard */
  .leaderboard-section {
    display: flex;
    flex-direction: column;
  }

  .leaderboard-list h3 {
    margin: 0 0 1.5rem 0;
    color: #FF5500;
    text-align: center;
  }

  .leaderboard-item {
    display: flex;
    align-items: center;
    gap: 1rem;
    padding: 1rem;
    background-color: rgba(0, 0, 0, 0.3);
    border-radius: 8px;
    border: 1px solid rgba(255, 255, 255, 0.1);
    margin-bottom: 0.5rem;
    transition: all 0.2s ease;
  }

  .leaderboard-item.current-user {
    border-color: rgba(255, 85, 0, 0.3);
    background-color: rgba(255, 85, 0, 0.1);
  }

  .leaderboard-item.viewing-user {
    border-color: rgba(74, 158, 255, 0.3);
    background-color: rgba(74, 158, 255, 0.1);
  }

  .rank {
    font-size: 1.2rem;
    font-weight: bold;
    min-width: 3rem;
    text-align: center;
    color: #FF5500;
  }

  .user-info {
    flex: 1;
  }

  .user-address {
    font-family: monospace;
    font-weight: 600;
    color: white;
    display: flex;
    align-items: center;
    gap: 0.5rem;
  }

  .you-badge {
    background-color: #FF5500;
    color: white;
    padding: 0.1rem 0.4rem;
    border-radius: 8px;
    font-size: 0.7rem;
    font-weight: bold;
  }

  .viewing-badge {
    background-color: #4A9EFF;
    color: white;
    padding: 0.1rem 0.4rem;
    border-radius: 8px;
    font-size: 0.7rem;
    font-weight: bold;
  }

  .user-stats {
    color: #AAA;
    font-size: 0.85rem;
    margin-top: 0.25rem;
    display: flex;
    flex-wrap: wrap;
    gap: 0.5rem;
  }

  .stat-highlight {
    color: #FF5500;
    font-weight: 600;
  }

  .stat-item {
    color: #BBB;
  }

  .user-achievements {
    display: flex;
    gap: 0.25rem;
    margin-top: 0.5rem;
    align-items: center;
  }

  .mini-badge {
    display: inline-flex;
    align-items: center;
    justify-content: center;
    width: 1.2rem;
    height: 1.2rem;
    font-size: 0.8rem;
    border-radius: 50%;
    background-color: rgba(255, 85, 0, 0.2);
    border: 1px solid rgba(255, 85, 0, 0.3);
  }

  .leaderboard-footer {
    text-align: center;
    padding: 1rem;
    color: #777;
    border-top: 1px solid rgba(255, 255, 255, 0.1);
    margin-top: 0.5rem;
  }

  .achievement-count {
    font-size: 1.5rem;
    font-weight: bold;
    color: #4CAF50;
    min-width: 3rem;
    text-align: center;
  }

  .empty-state {
    text-align: center;
    padding: 3rem 2rem;
    color: #AAA;
  }

  .empty-state i {
    font-size: 3rem;
    margin-bottom: 1rem;
    color: #666;
  }

  .empty-state p {
    font-size: 1.1rem;
    margin-bottom: 0.5rem;
  }

  .empty-state small {
    font-size: 0.9rem;
  }

  @keyframes spin {
    to { transform: rotate(360deg); }
  }

  /* Responsive design */
  @media (max-width: 768px) {
    .achievement-modal {
      margin: 10px;
      max-height: 90vh;
    }

    .modal-header {
      padding: 1rem;
    }

    .modal-body {
      padding: 1rem;
    }

    .tab-btn {
      padding: 0.75rem 0.5rem;
      font-size: 0.8rem;
    }

    .stats-grid {
      grid-template-columns: 1fr;
    }

    .achievement-card, .progress-item, .leaderboard-item {
      padding: 0.75rem;
    }

    .achievement-icon, .progress-icon {
      width: 2.5rem;
      height: 2.5rem;
      font-size: 1.3rem;
    }
  }
</style>