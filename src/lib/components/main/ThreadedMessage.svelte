<!-- ThreadedMessage.svelte - With stream detection and watch button -->
<script lang="ts">
  import { onMount, createEventDispatcher } from 'svelte';
  import { truncateAddress } from '$lib/utils/utils';
  import { profanityFilter } from '$lib/components/main/ProfanityFilter';
  import { filterEnabled } from '$lib/components/main/profanityFilterStore';
  import OnChainUserBadge from '$lib/components/main/OnChainUserBadge.svelte';
  import { OnChainAchievementSystem } from '$lib/utils/OnChainAchievementSystem.js';
  
  const dispatch = createEventDispatcher();
  
  // Props
  export let message; 
  export let isOwn = false;
  export let showReplies = false;
  export let expanded = false;
  export let chatContract = ''; // Pass from parent
  export let allMessages = []; // Pass from parent for performance
  export let compact = false; // For stream chat mode

  // Component state
  let achievementSystem;
  let userRank = null;
  let loadingRank = false;
  // State variables
  let isCopied = false;
  let tooltipVisible = false;
  let tooltipTimeout: number;
  let isTranslating = false;
  let translatedContent = '';
  let showTranslation = false;
  let translationError = '';
  
  // Stream detection
  let detectedStream = null;
  
  // Initialize achievement system and load user rank
  $: if (chatContract && !achievementSystem) {
    achievementSystem = new OnChainAchievementSystem(chatContract);
  }
  
  // Load user rank when message changes (debounced)
  $: if (achievementSystem && message.sender && allMessages.length > 0 && !isStealthMessage) {
    debouncedLoadUserRank();
  }
  
  // Detect stream URLs in message content
  $: if (message.content) {
    detectedStream = detectStreamInMessage(message.content);
  }
  
  let rankTimeout;
  function debouncedLoadUserRank() {
    clearTimeout(rankTimeout);
    rankTimeout = setTimeout(async () => {
      await loadUserRank();
    }, 500);
  }
  
  // Helper function to clean address
  function cleanAddress(address) {
    if (!address) return '';
    if (address.startsWith('3') && address.length > 50) {
      return address.substring(1);
    }
    return address;
  }
  
  // Check if the message has replies
  $: hasReplies = message.replies && message.replies.length > 0;
  
  // Number of visible replies (limited for UI)
  $: visibleReplies = expanded || !hasReplies 
    ? message.replies 
    : message.replies.slice(0, 2);
  
  // More replies count
  $: moreRepliesCount = hasReplies 
    ? message.replies.length - visibleReplies.length 
    : 0;
  
  // Check if message might need translation
  $: mightNeedTranslation = message.content && (
    /[^\x00-\x7F]/.test(message.content) || 
    message.content.length > 10
  );
  
  // UPDATED: Simple stealth detection - if sender doesn't start with "9", it's stealth
  $: isStealthMessage = message.sender && !message.sender.startsWith('9');
  
  // Stream detection function
  function detectStreamInMessage(content) {
    if (!content) return null;
    
    // Regex patterns for different platforms
    const patterns = {
      youtube: [
        /(?:https?:\/\/)?(?:www\.)?youtube\.com\/watch\?v=([a-zA-Z0-9_-]+)/i,
        /(?:https?:\/\/)?(?:www\.)?youtube\.com\/live\/([a-zA-Z0-9_-]+)/i,
        /(?:https?:\/\/)?youtu\.be\/([a-zA-Z0-9_-]+)/i
      ],
      twitch: [
        /(?:https?:\/\/)?(?:www\.)?twitch\.tv\/([a-zA-Z0-9_-]+)/i
      ],
      twitter: [
        /(?:https?:\/\/)?(?:www\.)?(?:twitter\.com|x\.com)\/i\/spaces\/([a-zA-Z0-9_-]+)/i
      ],
      kick: [
        /(?:https?:\/\/)?(?:www\.)?kick\.com\/([a-zA-Z0-9_-]+)/i
      ]
    };
    
    // Check each platform
    for (const [platform, regexArray] of Object.entries(patterns)) {
      for (const regex of regexArray) {
        const match = content.match(regex);
        if (match) {
          let url = match[0];
          // Ensure URL has protocol
          if (!url.startsWith('http')) {
            url = 'https://' + url;
          }
          
          return {
            platform,
            url,
            title: extractStreamTitle(content, match[0]) || `Live Stream`,
            isLive: true // Assume live for now
          };
        }
      }
    }
    
    return null;
  }
  
  // Extract potential stream title from message
  function extractStreamTitle(content, streamUrl) {
    // Remove the URL from content to get potential title
    const withoutUrl = content.replace(streamUrl, '').trim();
    
    // Look for common patterns
    const titlePatterns = [
      /🎥\s*(.+)/i,          // "🎥 Stream Title"
      /live[:\s]+(.+)/i,     // "Live: Stream Title" or "Live Stream Title"
      /streaming[:\s]+(.+)/i, // "Streaming: Game Name"
      /watch[:\s]+(.+)/i     // "Watch: Content"
    ];
    
    for (const pattern of titlePatterns) {
      const match = withoutUrl.match(pattern);
      if (match && match[1]) {
        return match[1].trim();
      }
    }
    
    // If no pattern matches, use the first part of the message (up to 50 chars)
    if (withoutUrl.length > 0 && withoutUrl.length <= 100) {
      return withoutUrl.substring(0, 50).trim();
    }
    
    return null;
  }
  
  // Handle watch stream button click
  function handleWatchStream() {
    if (detectedStream) {
      dispatch('watchStream', {
        streamUrl: detectedStream.url,
        streamTitle: detectedStream.title,
        platform: detectedStream.platform,
        isLive: detectedStream.isLive,
        streamerAddress: message.sender,
        messageId: message.id
      });
    }
  }
  
  // Handle end stream button click (for stream owners)
  function handleEndStream() {
    if (detectedStream && isStreamOwner) {
      dispatch('endStream', {
        streamUrl: detectedStream.url,
        streamTitle: detectedStream.title,
        platform: detectedStream.platform,
        streamerAddress: message.sender,
        messageId: message.id
      });
    }
  }
  
  // Check if current user is the stream owner
  $: isStreamOwner = detectedStream && message.sender && 
    (cleanAddress(message.sender) === cleanAddress(currentUserAddress) ||
     message.sender === currentUserAddress);
  
  // Add current user address prop
  export let currentUserAddress = '';
  
  // Format time for display
  function formatTime(timestamp: number): string {
    const date = new Date(timestamp * 1000);
    return date.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
  }
  
  // Get message display name with rank (stealth-aware)
  function getMessageDisplayName(message) {
    // If sender doesn't start with "9", it's a stealth user - show as anonymous
    if (message.sender && !message.sender.startsWith('9')) {
      return `👤 ${message.sender}`; // Show stealth name with mask emoji
    }
    
    // For regular users, add rank if available
    const baseDisplay = formatSender(message.sender);
    
    if (userRank && userRank.emoji) {
      return `${userRank.emoji} ${baseDisplay}`;
    }
    
    return baseDisplay;
  }
  
  // Format sender address for display
  function formatSender(sender) {
    if (!sender) return 'Unknown';
    
    // Clean up any "3" prefix if present
    if (sender.startsWith('3') && sender.length > 50) {
      sender = sender.substring(1);
    }
    
    // Truncate long addresses
    if (sender.length > 12) {
      return `${sender.substring(0, 6)}...${sender.substring(sender.length - 4)}`;
    }
    
    return sender;
  }
  
  // Get clean sender address (without any "3" prefix)
  function getCleanAddress(): string {
    if (!message.sender) return '';
    
    // For stealth messages (non-"9" addresses), don't expose the address
    if (!message.sender.startsWith('9')) {
      return ''; 
    }
    
    // Clean up any "3" prefix if present for regular addresses
    if (message.sender.startsWith('3') && message.sender.length > 50) {
      return message.sender.substring(1);
    }
    
    return message.sender;
  }
  
  // Handle reply button click
  function handleReply() {
    dispatch('reply', {
      parentId: message.id,
      parentSender: message.sender,
      parentContent: message.content
    });
  }
  
  // Toggle expanded state
  function toggleExpanded() {
    expanded = !expanded;
  }
  
  // Copy address to clipboard - UPDATED for stealth awareness
  async function copyAddressToClipboard() {
    if (isStealthMessage) {
      // For stealth messages, show info instead of copying
      dispatch('showToast', {
        message: 'This is an anonymous stealth address - no address to copy',
        type: 'info'
      });
      return;
    }
    
    const addressToCopy = getCleanAddress();
    
    if (!addressToCopy) {
      dispatch('showToast', {
        message: 'No address available to copy',
        type: 'warning'
      });
      return;
    }
    
    try {
      await navigator.clipboard.writeText(addressToCopy);
      isCopied = true;
      
      // Show tooltip
      clearTimeout(tooltipTimeout);
      tooltipVisible = true;
      
      // Hide tooltip after 2 seconds
      tooltipTimeout = setTimeout(() => {
        tooltipVisible = false;
        setTimeout(() => { isCopied = false; }, 300);
      }, 2000);
      
      dispatch('showToast', {
        message: 'Address copied to clipboard!',
        type: 'success'
      });
    } catch (err) {
      console.error('Failed to copy address: ', err);
    }
  }
  
  // Handle stealth info button click
  function handleStealthInfo() {
    dispatch('showToast', {
      message: 'This is an anonymous stealth message. The sender\'s identity is protected. Tipping is not available for anonymous users.',
      type: 'info'
    });
  }
  
  // Handle tip button click - UPDATED for stealth awareness  
  function handleTipClick() {
    if (isStealthMessage) {
      handleStealthInfo();
      return;
    }
    
    const cleanAddress = getCleanAddress();
    if (cleanAddress) {
      dispatch('openTip', {
        recipientAddress: cleanAddress,
        recipientName: getMessageDisplayName(message)
      });
    } else {
      dispatch('showToast', {
        message: 'No valid address available for tipping',
        type: 'warning'
      });
    }
  }
  
  // FIXED: Handle user achievements click event from OnChainUserBadge
  function handleUserAchievementsClick(event) {
    console.log('ThreadedMessage: Received openUserAchievements event:', event.detail);
    
    // Re-dispatch the event up to the parent (Landing.svelte)
    dispatch('openUserAchievements', event.detail);
  }
  
  // Translate message to English
  async function translateMessage() {
    if (isTranslating || showTranslation) {
      if (showTranslation) {
        showTranslation = false;
        return;
      }
      return;
    }
    
    isTranslating = true;
    translationError = '';
    
    try {
      const response = await fetch(`https://translate.googleapis.com/translate_a/single?client=gtx&sl=auto&tl=en&dt=t&q=${encodeURIComponent(message.content)}`);
      
      if (!response.ok) {
        throw new Error('Translation service unavailable');
      }
      
      const data = await response.json();
      
      if (data && data[0] && data[0][0] && data[0][0][0]) {
        translatedContent = data[0][0][0];
        
        if (translatedContent.toLowerCase().trim() === message.content.toLowerCase().trim()) {
          translationError = 'Message appears to be already in English';
        } else {
          showTranslation = true;
          
          dispatch('showToast', {
            message: 'Message translated to English',
            type: 'success'
          });
        }
      } else {
        throw new Error('Invalid translation response');
      }
    } catch (error) {
      console.error('Translation error:', error);
      translationError = 'Translation failed. Please try again.';
      
      dispatch('showToast', {
        message: 'Translation failed',
        type: 'error'
      });
    } finally {
      isTranslating = false;
    }
  }
  
  // Convert URLs to clickable links
  function processMessageContent(content: string): string {
    if (!content) return '';
    
    const filteredContent = $filterEnabled ? profanityFilter.filter(content) : content;
    
    const urlRegex = /(https?:\/\/[^\s]+(?:\?[^\s]*)?(?:#[^\s]*)?|www\.[^\s]+(?:\?[^\s]*)?(?:#[^\s]*)?|[a-zA-Z0-9][a-zA-Z0-9-]*[a-zA-Z0-9]*\.(?:com|org|net|edu|gov|mil|int|co|uk|ca|de|jp|fr|au|us|ru|ch|it|nl|se|no|es|mil|info|biz|name|tech|io|app|dev|xyz|me|tv|cc|ai|crypto|nft|defi|dao)(?:\/[^\s]*)?(?:\?[^\s]*)?(?:#[^\s]*)?)/gi;
    
    return filteredContent.replace(urlRegex, (url) => {
      let href = url;
      if (!url.startsWith('http://') && !url.startsWith('https://')) {
        href = 'https://' + url;
      }
      
      let displayText = url;
      if (url.length > 60) {
        displayText = url.substring(0, 57) + '...';
      }
      
      return `<a href="${href}" target="_blank" rel="noopener noreferrer" class="message-link">${displayText}</a>`;
    });
  }
  
  // Get processed message content with hyperlinks
  $: processedContent = processMessageContent(showTranslation ? translatedContent : message.content);
  
  // Clean up on unmount
  onMount(() => {
    return () => {
      if (tooltipTimeout) clearTimeout(tooltipTimeout);
    };
  });
  
  // Add this function to get rank tooltip text
  function getRankTooltip(rank) {
    const achievements = rank.count;
    
    switch (rank.emoji) {
      case '👑':
        return `Elite User - ${achievements} achievements! Top tier contributor with ${userRank?.stats?.ergTipped?.toFixed(1) || '0'} ERG tipped`;
      case '🏆':
        return `Legendary User - ${achievements} achievements! Exceptional community member`;
      case '⭐':
        return `Star User - ${achievements} achievements! High-value community member`;
      case '🔥':
        return `Active User - ${achievements} achievements! Regular contributor with ${userRank?.stats?.messages || 0} messages`;
      case '✨':
        return `Contributing User - ${achievements} achievements! Growing community member`;
      case '🌱':
        return `New User - Welcome to the community! Keep chatting to earn achievements`;
      default:
        return `User with ${achievements} achievements`;
    }
  }

  // Enhanced rank calculation - REPLACE the existing loadUserRank function
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

<div class="threaded-message {isOwn ? 'own' : 'other'} {compact ? 'compact' : ''}">
  <div class="message {message.pending ? 'pending' : 'confirmed'} {isOwn ? 'my-message' : 'their-message'}">
    <div class="message-header">
      <div class="sender-container">
        <!-- Use stealth-aware display name with rank -->
        <span 
          class="message-sender" 
          style="color: {userRank?.color || '#AAA'}"
          title={userRank ? getRankTooltip(userRank) : ''}
        >
          {getMessageDisplayName(message)}
          {#if loadingRank && !isStealthMessage}
            <span class="rank-loading">⏳</span>
          {/if}
        </span>
        
        <!-- FIXED: Add event handler for openUserAchievements -->
        {#if !compact}
          <OnChainUserBadge 
            userAddress={message.sender}
            {chatContract}
            {allMessages}
            maxDisplay={2}
            size="small"
            clickable={true}
            on:openUserAchievements={handleUserAchievementsClick}
          />
        {/if}
        
        <!-- Stealth indicator -->
        {#if isStealthMessage}
          <span class="stealth-indicator" title="Anonymous stealth message">
            <i class="fa-solid fa-mask"></i>
          </span>
        {/if}
        
        {#if message.sender && !isOwn && !compact}
          <!-- Copy button - disabled for stealth messages -->
          <button 
            class="copy-button {isStealthMessage ? 'disabled' : ''}" 
            on:click|stopPropagation={copyAddressToClipboard}
            aria-label={isStealthMessage ? 'Anonymous user' : 'Copy address'}
            disabled={isStealthMessage}
          >
            {#if isCopied}
              <i class="fa-solid fa-check"></i>
            {:else}
              <i class="fa-regular fa-copy"></i>
            {/if}
            
            {#if tooltipVisible}
              <span class="tooltip">Copied!</span>
            {/if}
          </button>
          
          <!-- FIXED: Conditional tip/info button -->
          {#if isStealthMessage}
            <button 
              class="info-button" 
              on:click|stopPropagation={handleStealthInfo}
              aria-label="Anonymous user info"
              title="Anonymous user - tipping not available"
            >
              <i class="fa-solid fa-info-circle"></i>
            </button>
          {:else}
            <button 
              class="tip-button" 
              on:click|stopPropagation={handleTipClick}
              aria-label="Tip this user"
              title="Send tip to this user"
            >
              <i class="fa-solid fa-donate"></i>
            </button>
          {/if}
        {/if}
      </div>
      <span class="message-time">{formatTime(message.timestamp)}</span>
    </div>
    
    <!-- Stream Detection Section -->
    {#if detectedStream}
      <div class="stream-detected">
        <div class="stream-info">
          <div class="stream-icon">
            {#if detectedStream.platform === 'youtube'}
              <i class="fa-brands fa-youtube" style="color: #FF0000;"></i>
            {:else if detectedStream.platform === 'twitch'}
              <i class="fa-brands fa-twitch" style="color: #9146FF;"></i>
            {:else if detectedStream.platform === 'twitter'}
              <i class="fa-brands fa-x-twitter" style="color: #1DA1F2;"></i>
            {:else if detectedStream.platform === 'kick'}
              <i class="fa-solid fa-video" style="color: #53FC18;"></i>
            {:else}
              <i class="fa-solid fa-video" style="color: #FF5500;"></i>
            {/if}
          </div>
          
          <div class="stream-details">
            <div class="stream-title">{detectedStream.title}</div>
            <div class="stream-platform">
              {detectedStream.platform.charAt(0).toUpperCase() + detectedStream.platform.slice(1)}
              {#if detectedStream.isLive}
                <span class="live-badge">🔴 LIVE</span>
              {/if}
            </div>
          </div>
        </div>
        
        <div class="stream-actions">
          <button class="watch-stream-btn" on:click={handleWatchStream}>
            <i class="fa-solid fa-play"></i>
            <span>Watch Live</span>
          </button>
          
          <!-- End Stream button for stream owners -->
          {#if isStreamOwner}
            <button class="end-stream-btn" on:click={handleEndStream} title="End your live stream">
              <i class="fa-solid fa-stop"></i>
              <span>End Stream</span>
            </button>
          {/if}
        </div>
      </div>
    {/if}
    
    <!-- Translation indicator -->
    {#if showTranslation}
      <div class="translation-indicator">
        <i class="fa-solid fa-language"></i>
        <span>Translated from original</span>
        <button class="show-original-btn" on:click={() => showTranslation = false}>
          Show original
        </button>
      </div>
    {/if}
    
    <div class="message-content">
      {@html processedContent}
    </div>
    
    <!-- Translation error -->
    {#if translationError}
      <div class="translation-error">
        <i class="fa-solid fa-exclamation-triangle"></i>
        <span>{translationError}</span>
      </div>
    {/if}
    
    <div class="message-actions">
      <div class="primary-actions">
        <button class="action-button reply-button" on:click={handleReply}>
          <i class="fa-solid fa-reply"></i>
          <span>Reply</span>
        </button>
        
        <!-- Translate button -->
        {#if mightNeedTranslation && !isOwn && !compact}
          <button 
            class="action-button translate-button" 
            on:click={translateMessage}
            disabled={isTranslating}
            aria-label="Translate to English"
          >
            {#if isTranslating}
              <div class="mini-spinner"></div>
            {:else if showTranslation}
              <i class="fa-solid fa-language"></i>
            {:else}
              <i class="fa-solid fa-language"></i>
            {/if}
            <span>
              {#if isTranslating}
                Translating...
              {:else if showTranslation}
                Original
              {:else}
                Translate
              {/if}
            </span>
          </button>
        {/if}
      </div>
      
      {#if hasReplies && !compact}
        <div class="replies-counter" on:click={toggleExpanded}>
          <i class="fa-solid fa-comments"></i>
          <span>{message.replies.length} {message.replies.length === 1 ? 'reply' : 'replies'}</span>
          <i class="fa-solid {expanded ? 'fa-chevron-up' : 'fa-chevron-down'}"></i>
        </div>
      {/if}
    </div>
    
    {#if message.pending}
      <div class="message-status">Pending...</div>
    {/if}
  </div>
  
  {#if showReplies && hasReplies && !compact}
    <div class="message-replies {expanded ? 'expanded' : ''}">
      {#each visibleReplies as reply (reply.id)}
        <svelte:self 
          message={reply} 
          isOwn={isOwn} 
          showReplies={expanded}
          {chatContract}
          {allMessages}
          {compact}
          on:reply
          on:showToast
          on:openTip
          on:openUserAchievements={handleUserAchievementsClick}
          on:watchStream
        />
      {/each}
      
      {#if moreRepliesCount > 0}
        <div class="more-replies" on:click={toggleExpanded}>
          <i class="fa-solid fa-ellipsis"></i>
          <span>Show {moreRepliesCount} more {moreRepliesCount === 1 ? 'reply' : 'replies'}</span>
        </div>
      {/if}
    </div>
  {/if}
</div>

<style>
  /* All existing styles remain the same */
  .threaded-message {
    width: 100%;
    margin-bottom: 0.8rem;
    display: flex;
    flex-direction: column;
  }
  
  .threaded-message.own {
    align-items: flex-end;
  }
  
  .threaded-message.other {
    align-items: flex-start;
  }
  
  /* Compact mode for stream chats */
  .threaded-message.compact {
    margin-bottom: 0.5rem;
  }
  
  .threaded-message.compact .message {
    padding: 0.5rem 0.75rem;
    max-width: 95%;
  }
  
  .threaded-message.compact .message-header {
    margin-bottom: 0.25rem;
  }
  
  .threaded-message.compact .message-actions {
    margin-top: 0.5rem;
  }
  
  .message {
    padding: 0.8rem 1rem;
    border-radius: 8px;
    max-width: 80%;
    animation: fadeIn 0.3s ease;
    box-sizing: border-box;
  }
  
  .message.my-message {
    background-color: #ff55001a;
    border: 1px solid rgba(255,85,0,.3);
  }
  
  .message.their-message {
    background-color: #1E1E1E;
    border-radius: 12px 12px 12px 0;
  }
  
  .message.pending {
    border-left: 3px solid #FF5500;
    opacity: 0.9;
  }
  
  .message-header {
    display: flex;
    justify-content: space-between;
    margin-bottom: 0.5rem;
    font-size: 0.8rem;
    color: #AAA;
  }
  
  .my-message .message-header {
    color: rgba(255, 255, 255, 0.9);
  }
  
  .sender-container {
    display: flex;
    align-items: center;
    gap: 0.5rem;
    position: relative;
  }
  
  .message-sender {
    position: relative;
    cursor: help; /* Show help cursor on hover for ranked users */
  }
  
  /* Rank loading indicator */
  .rank-loading {
    font-size: 0.6rem;
    margin-left: 0.25rem;
    opacity: 0.7;
    animation: pulse 1.5s ease-in-out infinite;
  }
  
  @keyframes pulse {
    0%, 100% { opacity: 0.4; }
    50% { opacity: 1; }
  }
  
  /* Enhanced rank styling */
  .message-sender {
    position: relative;
    cursor: help; /* Show help cursor on hover for ranked users */
  }

  .message-sender[title]:hover {
    text-shadow: 0 0 8px currentColor;
    transform: translateY(-1px);
    transition: all 0.2s ease;
  }

  /* Rank-specific styling */
  .message-sender[style*="#FFD700"] {
    /* Elite users get a subtle golden glow */
    text-shadow: 0 0 10px rgba(255, 215, 0, 0.3);
  }

  .message-sender[style*="#FF6B00"] {
    /* Legendary users get orange glow */
    text-shadow: 0 0 8px rgba(255, 107, 0, 0.3);
  }

  .message-sender[style*="#FF5500"] {
    /* Star users get the signature orange glow */
    text-shadow: 0 0 6px rgba(255, 85, 0, 0.3);
  }
  
  .stealth-indicator {
    opacity: 0.7;
    color: #4A9EFF;
    font-size: 0.8rem;
    margin-left: 0.25rem;
    transition: all 0.2s ease;
  }
  
  .stealth-indicator:hover {
    opacity: 1;
    color: #FF5500;
  }
  
  /* Stream Detection Styles */
  .stream-detected {
    background: linear-gradient(135deg, rgba(255, 85, 0, 0.1), rgba(255, 85, 0, 0.05));
    border: 1px solid rgba(255, 85, 0, 0.3);
    border-radius: 8px;
    padding: 0.75rem;
    margin: 0.5rem 0;
    display: flex;
    justify-content: space-between;
    align-items: center;
    gap: 1rem;
  }
  
  .stream-info {
    display: flex;
    align-items: center;
    gap: 0.75rem;
    flex: 1;
    min-width: 0;
  }
  
  .stream-icon {
    font-size: 1.5rem;
    display: flex;
    align-items: center;
    justify-content: center;
    width: 40px;
    height: 40px;
    background: rgba(255, 255, 255, 0.1);
    border-radius: 8px;
    flex-shrink: 0;
  }
  
  .stream-details {
    min-width: 0;
    flex: 1;
  }
  
  .stream-title {
    color: white;
    font-weight: 600;
    font-size: 0.9rem;
    margin-bottom: 0.25rem;
    overflow: hidden;
    text-overflow: ellipsis;
    white-space: nowrap;
  }
  
  .stream-platform {
    color: #AAA;
    font-size: 0.8rem;
    display: flex;
    align-items: center;
    gap: 0.5rem;
  }
  
  .live-badge {
    background: #ff4444;
    color: white;
    padding: 0.1rem 0.4rem;
    border-radius: 4px;
    font-size: 0.7rem;
    font-weight: bold;
    animation: pulse 2s infinite;
  }
  
  .stream-actions {
    display: flex;
    gap: 0.5rem;
    align-items: center;
  }
  
  .watch-stream-btn {
    background: rgba(255, 85, 0, 0.8);
    color: white;
    border: none;
    border-radius: 6px;
    padding: 0.5rem 1rem;
    cursor: pointer;
    transition: all 0.2s ease;
    display: flex;
    align-items: center;
    gap: 0.5rem;
    font-weight: 600;
    font-size: 0.9rem;
    flex: 1;
  }
  
  .watch-stream-btn:hover {
    background: #FF5500;
    transform: translateY(-1px);
  }
  
  .watch-stream-btn:active {
    transform: translateY(0);
  }
  
  .end-stream-btn {
    background: rgba(255, 68, 68, 0.8);
    color: white;
    border: none;
    border-radius: 6px;
    padding: 0.5rem 0.75rem;
    cursor: pointer;
    transition: all 0.2s ease;
    display: flex;
    align-items: center;
    gap: 0.5rem;
    font-weight: 600;
    font-size: 0.9rem;
    flex-shrink: 0;
  }
  
  .end-stream-btn:hover {
    background: #ff4444;
    transform: translateY(-1px);
  }
  
  .end-stream-btn:active {
    transform: translateY(0);
  }
  
  /* Button styles */
  .copy-button,
  .tip-button,
  .info-button {
    background: none;
    border: none;
    color: #777;
    cursor: pointer;
    font-size: 0.75rem;
    padding: 0;
    display: flex;
    align-items: center;
    justify-content: center;
    width: 1.2rem;
    height: 1.2rem;
    opacity: 0.6;
    transition: all 0.2s ease;
    border-radius: 50%;
  }
  
  .my-message .copy-button,
  .my-message .tip-button,
  .my-message .info-button {
    color: rgba(255, 255, 255, 0.8);
  }
  
  .copy-button:hover,
  .tip-button:hover,
  .info-button:hover {
    opacity: 1;
    color: #FFF;
    background-color: rgba(255, 255, 255, 0.1);
  }
  
  .tip-button:hover {
    color: #FF5500;
    background-color: rgba(255, 85, 0, 0.1);
  }
  
  .info-button:hover {
    color: #2196F3;
    background-color: rgba(33, 150, 243, 0.1);
  }
  
  /* Disabled button styles */
  .copy-button.disabled,
  .tip-button.disabled {
    opacity: 0.3;
    cursor: not-allowed;
  }
  
  .copy-button.disabled:hover,
  .tip-button.disabled:hover {
    background-color: transparent;
    color: #777;
    opacity: 0.3;
  }
  
  .tooltip {
    position: absolute;
    bottom: 100%;
    left: 50%;
    transform: translateX(-50%);
    background-color: #FF5500;
    color: white;
    font-size: 0.7rem;
    padding: 0.2rem 0.5rem;
    border-radius: 4px;
    white-space: nowrap;
    pointer-events: none;
    opacity: 1;
    animation: fadeInOut 2s ease;
    margin-bottom: 0.25rem;
    z-index: 10;
  }
  
  .tooltip::after {
    content: '';
    position: absolute;
    top: 100%;
    left: 50%;
    margin-left: -4px;
    border-width: 4px;
    border-style: solid;
    border-color: #FF5500 transparent transparent transparent;
  }
  
  .translation-indicator {
    display: flex;
    align-items: center;
    gap: 0.5rem;
    background-color: rgba(74, 158, 255, 0.1);
    border: 1px solid rgba(74, 158, 255, 0.3);
    border-radius: 4px;
    padding: 0.4rem 0.6rem;
    margin-bottom: 0.5rem;
    font-size: 0.75rem;
    color: #4A9EFF;
  }
  
  .show-original-btn {
    background: none;
    border: none;
    color: #4A9EFF;
    cursor: pointer;
    text-decoration: underline;
    font-size: 0.75rem;
    margin-left: auto;
  }
  
  .show-original-btn:hover {
    color: #66B3FF;
  }
  
  .translation-error {
    display: flex;
    align-items: center;
    gap: 0.5rem;
    background-color: rgba(255, 68, 68, 0.1);
    border: 1px solid rgba(255, 68, 68, 0.3);
    border-radius: 4px;
    padding: 0.4rem 0.6rem;
    margin-top: 0.5rem;
    font-size: 0.75rem;
    color: #ff9999;
  }
  
  .message-content {
    word-break: break-word;
    line-height: 1.4;
    color: #FFF;
  }
  
  :global(.message-content .message-link) {
    color: #4A9EFF;
    text-decoration: underline;
    transition: all 0.2s ease;
    word-break: break-all;
  }
  
  :global(.message-content .message-link:hover) {
    color: #66B3FF;
    text-decoration: none;
  }
  
  :global(.my-message .message-content .message-link) {
    color: #87CEEB;
  }
  
  :global(.my-message .message-content .message-link:hover) {
    color: #ADD8E6;
  }
  
  .message-status {
    font-size: 0.7rem;
    color: rgba(255, 255, 255, 0.7);
    margin-top: 0.5rem;
    text-align: right;
  }
  
  .message-actions {
    display: flex;
    justify-content: space-between;
    align-items: center;
    margin-top: 0.75rem;
    font-size: 0.8rem;
  }
  
  .primary-actions {
    display: flex;
    gap: 0.5rem;
  }
  
  .action-button {
    background: none;
    border: none;
    color: #999;
    cursor: pointer;
    display: flex;
    align-items: center;
    gap: 0.35rem;
    padding: 0.25rem 0.5rem;
    border-radius: 4px;
    transition: all 0.2s ease;
    font-size: 0.75rem;
  }
  
  .action-button:hover {
    background-color: rgba(255, 255, 255, 0.05);
    color: #FFF;
  }
  
  .action-button:disabled {
    opacity: 0.5;
    cursor: not-allowed;
  }
  
  .translate-button:hover {
    color: #4A9EFF;
    background-color: rgba(74, 158, 255, 0.1);
  }
  
  .mini-spinner {
    width: 0.75rem;
    height: 0.75rem;
    border: 1px solid rgba(255, 255, 255, 0.3);
    border-top-color: #4A9EFF;
    border-radius: 50%;
    animation: spin 1s linear infinite;
  }
  
  .replies-counter {
    cursor: pointer;
    display: flex;
    align-items: center;
    gap: 0.35rem;
    color: #999;
    transition: all 0.2s ease;
    font-size: 0.8rem;
    padding: 0.25rem 0.5rem;
    border-radius: 4px;
  }
  
  .replies-counter:hover {
    background-color: rgba(255, 255, 255, 0.05);
    color: #FFF;
  }
  
  .message-replies {
    width: 90%;
    margin-left: 2rem;
    margin-top: 0.5rem;
    max-height: 0;
    overflow: hidden;
    transition: max-height 0.3s ease;
  }
  
  .message-replies.expanded {
    max-height: 10000px;
  }
  
  .more-replies {
    display: flex;
    align-items: center;
    gap: 0.5rem;
    color: #FF5500;
    cursor: pointer;
    padding: 0.5rem;
    font-size: 0.85rem;
    margin-top: 0.5rem;
    transition: all 0.2s ease;
  }
  
  .more-replies:hover {
    background-color: rgba(255, 85, 0, 0.1);
    border-radius: 4px;
  }
  
  @keyframes fadeIn {
    from {
      opacity: 0;
      transform: translateY(10px);
    }
    to {
      opacity: 1;
      transform: translateY(0);
    }
  }
  
  @keyframes fadeInOut {
    0% { opacity: 0; }
    20% { opacity: 1; }
    80% { opacity: 1; }
    100% { opacity: 0; }
  }
  
  @keyframes spin {
    to {
      transform: rotate(360deg);
    }
  }
  
  /* Responsive adjustments */
  @media (max-width: 768px) {
    .stream-detected {
      flex-direction: column;
      align-items: stretch;
      gap: 0.75rem;
    }
    
    .stream-info {
      gap: 0.5rem;
    }
    
    .stream-icon {
      width: 36px;
      height: 36px;
      font-size: 1.3rem;
    }
    
    .stream-actions {
      width: 100%;
      flex-direction: column;
    }
    
    .watch-stream-btn,
    .end-stream-btn {
      width: 100%;
      justify-content: center;
    }
  }
  
  @media (max-width: 480px) {
    .primary-actions {
      flex-direction: column;
      gap: 0.25rem;
    }
    
    .action-button {
      font-size: 0.7rem;
      padding: 0.2rem 0.4rem;
    }
    
    .translation-indicator {
      font-size: 0.7rem;
      padding: 0.3rem 0.5rem;
    }
    
    .stealth-indicator {
      font-size: 0.7rem;
    }
    
    .stream-detected {
      padding: 0.5rem;
    }
    
    .stream-title {
      font-size: 0.8rem;
    }
    
    .stream-platform {
      font-size: 0.75rem;
    }
    
    .stream-actions {
      padding: 0.5rem;
      flex-direction: column;
      gap: 0.5rem;
    }
    
    .watch-stream-btn,
    .end-stream-btn {
      padding: 0.4rem 0.75rem;
      font-size: 0.8rem;
      width: 100%;
      justify-content: center;
    }
  }
</style>