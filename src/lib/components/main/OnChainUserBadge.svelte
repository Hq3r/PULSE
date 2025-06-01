<!-- OnChainUserBadge.svelte - Display achievement badges next to usernames -->
<script>
    import { onMount, createEventDispatcher } from 'svelte';
    import { OnChainAchievementSystem } from '$lib/utils/OnChainAchievementSystem.js';
    import { showCustomToast, truncateAddress } from '$lib/utils/utils';
    const dispatch = createEventDispatcher();
    
    // Props
    export let userAddress = '';
    export let chatContract = '';
    export let maxDisplay = 3;
    export let showAll = false;
    export let allMessages = []; // Pass existing messages for performance
    export let size = 'small'; // 'small', 'medium', 'large'
    export let clickable = true;
    
    // Component state
    let achievementSystem;
    let userAchievements = [];
    let loading = false;
    let error = false;
    let showTooltip = false;
    let tooltipTimeout;
    
    // Cache to avoid repeated fetches for the same user
    let lastAddress = '';
    let cacheTimeout = 60000; // 1 minute cache
    let lastFetch = 0;
    
    // Initialize achievement system
    onMount(() => {
      if (chatContract) {
        achievementSystem = new OnChainAchievementSystem(chatContract);
      }
    });
    
    // Load achievements when user address changes
    $: if (achievementSystem && userAddress && userAddress !== lastAddress) {
      loadUserAchievements();
    }
    
    // Also update when messages change (but with debouncing)
    $: if (achievementSystem && userAddress && allMessages.length > 0) {
      debouncedLoadAchievements();
    }
    
    let debounceTimeout;
    function debouncedLoadAchievements() {
      clearTimeout(debounceTimeout);
      debounceTimeout = setTimeout(() => {
        const now = Date.now();
        if ((now - lastFetch) > cacheTimeout) {
          loadUserAchievements();
        }
      }, 1000);
    }
    
    async function loadUserAchievements() {
      if (!achievementSystem || !userAddress || loading) return;
      
      const cleanedAddress = cleanAddress(userAddress);
      if (!cleanedAddress) return;
      
      loading = true;
      error = false;
      lastAddress = userAddress;
      lastFetch = Date.now();
      
      try {
        const achievements = await achievementSystem.checkUserAchievements(
          cleanedAddress,
          allMessages
        );
        
        // Get the most impressive achievements for display
        userAchievements = selectDisplayAchievements(achievements.unlockedAchievements);
      } catch (err) {
        console.warn('Error loading user achievements:', err);
        error = true;
        userAchievements = [];
      } finally {
        loading = false;
      }
    }
    
    // Select which achievements to display (prioritize impressive ones)
    function selectDisplayAchievements(allAchievements) {
      if (!allAchievements || allAchievements.length === 0) return [];
      
      // Priority order for display
      const priorityOrder = [
        'early_adopter',    // Most prestigious
        'whale_tipper',     // High value
        'community_favorite', // Social recognition
        'super_chatty',     // High engagement
        'room_explorer',    // Exploration
        'generous_tipper',  // Community spirit
        'thread_starter',   // Leadership
        'chatty_user',      // Engagement
        'first_tip',        // Milestone
        'first_message'     // Basic
      ];
      
      // Sort achievements by priority
      const sortedAchievements = allAchievements.sort((a, b) => {
        const aIndex = priorityOrder.indexOf(a.id);
        const bIndex = priorityOrder.indexOf(b.id);
        
        // If both are in priority list, sort by priority
        if (aIndex !== -1 && bIndex !== -1) {
          return aIndex - bIndex;
        }
        
        // If only one is in priority list, prioritize it
        if (aIndex !== -1) return -1;
        if (bIndex !== -1) return 1;
        
        // If neither is in priority list, sort alphabetically
        return a.name.localeCompare(b.name);
      });
      
      return showAll ? sortedAchievements : sortedAchievements.slice(0, maxDisplay);
    }
    
    // Handle badge click
    function handleBadgeClick() {
      if (!clickable) return;
      
      // Dispatch event with the specific user's address
      const event = new CustomEvent('openUserAchievements', {
        detail: { 
          userAddress: cleanAddress(userAddress),
          userName: truncateAddress(userAddress)
        },
        bubbles: true
      });
      
      // Also try dispatching to parent component directly
      dispatch('openUserAchievements', {
        userAddress: cleanAddress(userAddress),
        userName: truncateAddress(userAddress)
      });
    }
    
    // Show tooltip on hover
    function showBadgeTooltip() {
      clearTimeout(tooltipTimeout);
      showTooltip = true;
    }
    
    // Hide tooltip
    function hideBadgeTooltip() {
      tooltipTimeout = setTimeout(() => {
        showTooltip = false;
      }, 100);
    }
    
    // Utility function
    function cleanAddress(address) {
      if (!address) return '';
      if (address.startsWith('3') && address.length > 50) {
        return address.substring(1);
      }
      return address;
    }
    
    // Get display achievements
    $: displayAchievements = userAchievements.slice(0, showAll ? userAchievements.length : maxDisplay);
    $: hasMore = userAchievements.length > maxDisplay && !showAll;
    $: moreCount = userAchievements.length - maxDisplay;
  </script>
  
  {#if userAchievements.length > 0}
    <div 
      class="user-badges {size} {clickable ? 'clickable' : ''}"
      class:loading
      on:click={handleBadgeClick}
      on:mouseenter={showBadgeTooltip}
      on:mouseleave={hideBadgeTooltip}
    >
      {#each displayAchievements as achievement}
        <span 
          class="badge" 
          title="{achievement.name}: {achievement.description}"
          data-category={achievement.category}
        >
          {achievement.icon}
        </span>
      {/each}
      
      {#if hasMore}
        <span class="badge-more" title="Click to see all {userAchievements.length} achievements">
          +{moreCount}
        </span>
      {/if}
      
      {#if showTooltip && userAchievements.length > 0}
        <div class="achievement-tooltip">
          <div class="tooltip-header">
            🏆 {userAchievements.length} Achievement{userAchievements.length === 1 ? '' : 's'}
          </div>
          <div class="tooltip-achievements">
            {#each displayAchievements as achievement}
              <div class="tooltip-achievement">
                <span class="tooltip-icon">{achievement.icon}</span>
                <span class="tooltip-name">{achievement.name}</span>
              </div>
            {/each}
            {#if hasMore}
              <div class="tooltip-more">
                ...and {moreCount} more
              </div>
            {/if}
          </div>
          {#if clickable}
            <div class="tooltip-footer">
              Click to view all achievements
            </div>
          {/if}
        </div>
      {/if}
    </div>
  {:else if loading}
    <div class="user-badges {size} loading">
      <span class="badge loading-badge">
        <div class="loading-spinner"></div>
      </span>
    </div>
  {:else if error}
    <!-- Silently fail - don't show error badges -->
  {/if}
  
  <style>
    .user-badges {
      display: inline-flex;
      gap: 0.25rem;
      align-items: center;
      position: relative;
      transition: all 0.2s ease;
    }
  
    .user-badges.clickable {
      cursor: pointer;
    }
  
    .user-badges.clickable:hover {
      transform: translateY(-1px);
    }
  
    .user-badges.loading {
      opacity: 0.7;
    }
  
    /* Size variants */
    .user-badges.small {
      gap: 0.2rem;
    }
  
    .user-badges.medium {
      gap: 0.3rem;
    }
  
    .user-badges.large {
      gap: 0.4rem;
    }
  
    .badge {
      display: inline-flex;
      align-items: center;
      justify-content: center;
      border-radius: 50%;
      background-color: rgba(255, 85, 0, 0.2);
      border: 1px solid rgba(255, 85, 0, 0.3);
      transition: all 0.2s ease;
      position: relative;
    }
  
    /* Badge sizes */
    .small .badge {
      width: 1.1rem;
      height: 1.1rem;
      font-size: 0.7rem;
    }
  
    .medium .badge {
      width: 1.3rem;
      height: 1.3rem;
      font-size: 0.8rem;
    }
  
    .large .badge {
      width: 1.5rem;
      height: 1.5rem;
      font-size: 0.9rem;
    }
  
    /* Category-based colors */
    .badge[data-category="special"] {
      background-color: rgba(255, 215, 0, 0.2);
      border-color: rgba(255, 215, 0, 0.4);
    }
  
    .badge[data-category="tipping"] {
      background-color: rgba(76, 175, 80, 0.2);
      border-color: rgba(76, 175, 80, 0.4);
    }
  
    .badge[data-category="social"] {
      background-color: rgba(156, 39, 176, 0.2);
      border-color: rgba(156, 39, 176, 0.4);
    }
  
    .badge[data-category="messaging"] {
      background-color: rgba(33, 150, 243, 0.2);
      border-color: rgba(33, 150, 243, 0.4);
    }
  
    .badge[data-category="exploration"] {
      background-color: rgba(255, 152, 0, 0.2);
      border-color: rgba(255, 152, 0, 0.4);
    }
  
    .user-badges.clickable .badge:hover {
      transform: scale(1.1);
      box-shadow: 0 2px 8px rgba(0, 0, 0, 0.3);
    }
  
    .badge-more {
      background-color: rgba(255, 255, 255, 0.1);
      color: #AAA;
      border-radius: 8px;
      transition: all 0.2s ease;
      display: inline-flex;
      align-items: center;
      justify-content: center;
      font-weight: 500;
    }
  
    .small .badge-more {
      font-size: 0.6rem;
      padding: 0.1rem 0.25rem;
      min-width: 1.1rem;
      height: 1.1rem;
    }
  
    .medium .badge-more {
      font-size: 0.7rem;
      padding: 0.15rem 0.3rem;
      min-width: 1.3rem;
      height: 1.3rem;
    }
  
    .large .badge-more {
      font-size: 0.8rem;
      padding: 0.2rem 0.35rem;
      min-width: 1.5rem;
      height: 1.5rem;
    }
  
    .user-badges.clickable .badge-more:hover {
      background-color: rgba(255, 255, 255, 0.2);
      color: white;
      transform: scale(1.05);
    }
  
    .loading-badge {
      background-color: rgba(255, 255, 255, 0.1);
      border-color: rgba(255, 255, 255, 0.2);
    }
  
    .loading-spinner {
      border: 1px solid rgba(255, 85, 0, 0.3);
      border-top-color: #FF5500;
      border-radius: 50%;
      animation: spin 1s linear infinite;
    }
  
    .small .loading-spinner {
      width: 0.6rem;
      height: 0.6rem;
    }
  
    .medium .loading-spinner {
      width: 0.7rem;
      height: 0.7rem;
    }
  
    .large .loading-spinner {
      width: 0.8rem;
      height: 0.8rem;
    }
  
    /* Tooltip */
    .achievement-tooltip {
      position: absolute;
      bottom: calc(100% + 0.5rem);
      left: 50%;
      transform: translateX(-50%);
      background-color: #333;
      border: 1px solid rgba(255, 85, 0, 0.3);
      border-radius: 8px;
      box-shadow: 0 4px 16px rgba(0, 0, 0, 0.3);
      z-index: 1000;
      min-width: 200px;
      max-width: 300px;
      opacity: 0;
      animation: tooltipFadeIn 0.2s ease forwards;
      pointer-events: none;
    }
  
    .tooltip-header {
      background: linear-gradient(135deg, rgba(255, 85, 0, 0.2), rgba(255, 85, 0, 0.1));
      color: #FF5500;
      padding: 0.5rem 0.75rem;
      border-radius: 8px 8px 0 0;
      font-weight: 600;
      font-size: 0.85rem;
      border-bottom: 1px solid rgba(255, 255, 255, 0.1);
    }
  
    .tooltip-achievements {
      padding: 0.5rem 0.75rem;
      max-height: 150px;
      overflow-y: auto;
    }
  
    .tooltip-achievement {
      display: flex;
      align-items: center;
      gap: 0.5rem;
      padding: 0.25rem 0;
      color: white;
      font-size: 0.8rem;
    }
  
    .tooltip-icon {
      font-size: 0.9rem;
      width: 1.2rem;
      display: flex;
      align-items: center;
      justify-content: center;
    }
  
    .tooltip-name {
      flex: 1;
    }
  
    .tooltip-more {
      color: #AAA;
      font-size: 0.75rem;
      font-style: italic;
      padding: 0.25rem 0;
      text-align: center;
    }
  
    .tooltip-footer {
      background-color: rgba(0, 0, 0, 0.3);
      color: #AAA;
      padding: 0.4rem 0.75rem;
      border-radius: 0 0 8px 8px;
      font-size: 0.75rem;
      text-align: center;
      border-top: 1px solid rgba(255, 255, 255, 0.1);
    }
  
    /* Scrollbar for tooltip */
    .tooltip-achievements::-webkit-scrollbar {
      width: 4px;
    }
  
    .tooltip-achievements::-webkit-scrollbar-track {
      background: rgba(0, 0, 0, 0.2);
    }
  
    .tooltip-achievements::-webkit-scrollbar-thumb {
      background: rgba(255, 85, 0, 0.5);
      border-radius: 2px;
    }
  
    @keyframes spin {
      to { transform: rotate(360deg); }
    }
  
    @keyframes tooltipFadeIn {
      from {
        opacity: 0;
        transform: translateX(-50%) translateY(5px);
      }
      to {
        opacity: 1;
        transform: translateX(-50%) translateY(0);
      }
    }
  
    /* Responsive adjustments */
    @media (max-width: 768px) {
      .achievement-tooltip {
        left: auto;
        right: 0;
        transform: none;
        min-width: 180px;
        max-width: 250px;
      }
  
      .small .badge, .small .badge-more {
        width: 1rem;
        height: 1rem;
        font-size: 0.65rem;
      }
  
      .tooltip-achievement {
        font-size: 0.75rem;
      }
  
      .tooltip-header {
        font-size: 0.8rem;
      }
    }
  
    /* High contrast mode support */
    @media (prefers-contrast: high) {
      .badge {
        border-width: 2px;
      }
  
      .achievement-tooltip {
        border-width: 2px;
      }
    }
  
    /* Reduced motion support */
    @media (prefers-reduced-motion: reduce) {
      .badge, .badge-more, .user-badges {
        transition: none;
      }
  
      .loading-spinner {
        animation: none;
      }
  
      .achievement-tooltip {
        animation: none;
        opacity: 1;
      }
    }
  </style>