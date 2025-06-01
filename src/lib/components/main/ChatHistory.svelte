<!-- ChatHistory.svelte - Simple chat messages display component -->
<script>
  import { onMount, onDestroy } from 'svelte';
  import { formatTime, truncateAddress } from '$lib/utils/chatConstants.js';
  import { parseBoxToMessage } from '$lib/utils/chatUtils.js';
  
  // Props
  export let messages = [];
  export let loading = false;
  export let error = "";
  export let autoScroll = true;
  export let hasMoreMessages = true;
  export let loadingMoreMessages = false;
  export let walletConnected = false;
  export let selectedChatroom = "general";
  export let currentWalletAddress = "";
  export let usingMnemonicWallet = false;
  export let transactionQueueLength = 0;
  
  // Events
  import { createEventDispatcher } from 'svelte';
  const dispatch = createEventDispatcher();
  
  // Local state
  let chatContainer;
  let intervalId;
  
  // Constants from props or imports
  export let DEMO_CHAT_CONTRACT;
  export let API_BASE;
  export let UI_CONFIG;
  
  // ============= MESSAGE FETCHING =============
  
  async function fetchMessages() {
    if (!walletConnected) return;
    
    try {
      const response = await fetch(`${API_BASE}/boxes/byAddress/${DEMO_CHAT_CONTRACT}?limit=100`);
      if (!response.ok) {
        throw new Error(`API error: ${response.status}`);
      }

      const data = await response.json();
      if (!data.items) {
        throw new Error('Invalid API response');
      }

      const parsedMessages = [];
      for (const box of data.items) {
        const message = parseBoxToMessage(box);
        if (message && (!selectedChatroom || message.chatroomId === selectedChatroom)) {
          parsedMessages.push(message);
        }
      }

      const newMessages = parsedMessages
        .sort((a, b) => a.timestamp - b.timestamp)
        .slice(-UI_CONFIG.LIMITS.MAX_MESSAGES);

      // Only update if messages actually changed
      if (JSON.stringify(newMessages) !== JSON.stringify(messages)) {
        dispatch('messagesUpdated', { messages: newMessages });
        scrollToBottom();
      }
      
    } catch (err) {
      console.error('Error fetching messages:', err);
      dispatch('error', { error: `Failed to load messages: ${err.message}` });
    }
  }
  
  function loadMoreMessages() {
    dispatch('loadMoreMessages');
  }
  
  function scrollToBottom() {
    if (chatContainer && autoScroll) {
      setTimeout(() => {
        chatContainer.scrollTop = chatContainer.scrollHeight;
      }, 100);
    }
  }
  
  function handleScroll() {
    if (!chatContainer) return;
    const { scrollTop, scrollHeight, clientHeight } = chatContainer;
    
    // Update auto-scroll status
    const newAutoScroll = scrollHeight - scrollTop - clientHeight < 100;
    if (newAutoScroll !== autoScroll) {
      dispatch('autoScrollChanged', { autoScroll: newAutoScroll });
    }
  }
  
  // ============= LIFECYCLE =============
  
  onMount(() => {
    // Set up periodic message fetching (only for chat content)
    if (walletConnected) {
      fetchMessages();
      intervalId = setInterval(fetchMessages, UI_CONFIG?.TIMING?.MESSAGE_POLL_INTERVAL || 10000);
    }
    
    return () => {
      if (intervalId) clearInterval(intervalId);
    };
  });
  
  onDestroy(() => {
    if (intervalId) clearInterval(intervalId);
  });
  
  // Reactive updates
  $: if (walletConnected && !intervalId) {
    fetchMessages();
    intervalId = setInterval(fetchMessages, UI_CONFIG?.TIMING?.MESSAGE_POLL_INTERVAL || 10000);
  } else if (!walletConnected && intervalId) {
    clearInterval(intervalId);
    intervalId = null;
  }
  
  $: if (selectedChatroom && walletConnected) {
    // Fetch messages when chatroom changes
    fetchMessages();
  }
  
  // Auto-scroll when new messages arrive
  $: if (messages && autoScroll) {
    scrollToBottom();
  }

  function isOwnMessage(message) {
    if (!walletConnected || !currentWalletAddress) return false;
    
    const cleanCurrentAddress = currentWalletAddress.startsWith('3') 
      ? currentWalletAddress.substring(1) 
      : currentWalletAddress;
    
    const cleanMessageSender = message.sender.startsWith('3') 
      ? message.sender.substring(1) 
      : message.sender;
    
    return truncateAddress(cleanCurrentAddress) === message.sender ||
           cleanMessageSender === truncateAddress(cleanCurrentAddress);
  }
</script>

<!-- HTML Template -->
<div class="chat-history">
  <div class="messages-container" bind:this={chatContainer} on:scroll={handleScroll}>
    {#if loading && messages.length === 0}
      <div class="loading-state">
        <div class="spinner"></div>
        <p>Loading messages...</p>
      </div>
    {:else if error}
      <div class="error-state">
        <div class="error-icon">⚠️</div>
        <h3>Error Loading Messages</h3>
        <p>{error}</p>
        <button class="retry-btn" on:click={fetchMessages}>
          Retry
        </button>
      </div>
    {:else if messages.length === 0}
      <div class="empty-state">
        <div class="empty-icon">🔶</div>
        <h3>Welcome to ErgoChat</h3>
        <p>
          {#if !walletConnected}
            Connect your wallet from the header to start chatting!
          {:else}
            Send your first message in #{selectedChatroom}!
          {/if}
        </p>
      </div>
    {:else}
      <div class="messages-list">
        <!-- Load More button -->
        {#if hasMoreMessages}
          <div class="load-more-container">
            <button 
              class="load-more-button" 
              on:click={loadMoreMessages} 
              disabled={loadingMoreMessages}
            >
              {#if loadingMoreMessages}
                <div class="button-spinner small"></div>
                Loading...
              {:else}
                Load More Messages
              {/if}
            </button>
          </div>
        {/if}

        <!-- Messages -->
        {#each messages as message (message.id)}
          <div class="message {message.pending ? 'pending' : ''} {isOwnMessage(message) ? 'own-message' : ''}">
            <div class="message-header">
              <span class="sender">{message.sender}</span>
              <span class="timestamp">{formatTime(message.timestamp)}</span>
              {#if message.pending}
                <span class="pending-indicator">Pending...</span>
              {/if}
            </div>
            <div class="message-content">
              {message.content}
            </div>
          </div>
        {/each}
      </div>
    {/if}
  </div>
  
  <!-- Status bar -->
 
</div>

<style>
  .chat-history {
    display: flex;
    flex-direction: column;
    height: 100%;
    background: linear-gradient(180deg, #000000, #111111);
  }

  .messages-container {
    flex: 1;
    overflow-y: auto;
    padding: 1rem;
    scroll-behavior: smooth;
  }

  .loading-state, .empty-state, .error-state {
    display: flex;
    flex-direction: column;
    align-items: center;
    justify-content: center;
    height: 100%;
    color: rgba(255, 85, 0, 0.7);
    text-align: center;
    padding: 2rem;
  }

  .spinner {
    width: 32px;
    height: 32px;
    border: 3px solid rgba(255, 85, 0, 0.3);
    border-top-color: #FF5500;
    border-radius: 50%;
    animation: spin 1s linear infinite;
    margin-bottom: 1rem;
  }

  .empty-icon, .error-icon {
    font-size: 4rem;
    margin-bottom: 1rem;
    color: #FF5500;
  }

  .empty-state h3, .error-state h3 {
    margin: 0 0 0.5rem 0;
    color: #FF5500;
  }

  .empty-state p, .error-state p {
    margin: 0 0 1rem 0;
    color: rgba(255, 255, 255, 0.7);
  }

  .retry-btn {
    background: linear-gradient(135deg, #FF5500, #ff7733);
    color: #000000;
    border: none;
    border-radius: 8px;
    padding: 0.75rem 1.5rem;
    cursor: pointer;
    font-weight: 600;
    transition: all 0.2s ease;
  }

  .retry-btn:hover {
    background: linear-gradient(135deg, #ff7733, #FF5500);
    transform: translateY(-1px);
  }

  .load-more-container {
    display: flex;
    justify-content: center;
    margin-bottom: 1rem;
  }

  .load-more-button {
    background: rgba(255, 85, 0, 0.1);
    color: #FF5500;
    border: 1px solid rgba(255, 85, 0, 0.3);
    border-radius: 8px;
    padding: 0.5rem 1rem;
    cursor: pointer;
    transition: all 0.2s ease;
    display: flex;
    align-items: center;
    gap: 0.5rem;
  }

  .load-more-button:hover:not(:disabled) {
    background: rgba(255, 85, 0, 0.2);
    border-color: #FF5500;
  }

  .load-more-button:disabled {
    opacity: 0.5;
    cursor: not-allowed;
  }

  .button-spinner {
    width: 16px;
    height: 16px;
    border: 2px solid rgba(255, 85, 0, 0.3);
    border-top-color: #FF5500;
    border-radius: 50%;
    animation: spin 1s linear infinite;
  }

  .messages-list {
    display: flex;
    flex-direction: column;
    gap: 1rem;
  }

  .message {
    background: linear-gradient(135deg, #1a1a1a, #262626);
    border-radius: 12px;
    padding: 1rem;
    border-left: 4px solid transparent;
    transition: all 0.2s ease;
    border: 1px solid rgba(255, 85, 0, 0.1);
  }

  .message:hover {
    background: linear-gradient(135deg, #262626, #333333);
    border-left-color: #FF5500;
  }

  .message.pending {
    opacity: 0.8;
    border-left-color: #FF5500;
    animation: pulse 2s infinite;
  }

  .message.own-message {
    background: linear-gradient(135deg, rgba(255, 85, 0, 0.1), rgba(255, 85, 0, 0.05));
    border-left-color: rgba(255, 85, 0, 0.5);
  }

  .message-header {
    display: flex;
    align-items: center;
    gap: 0.75rem;
    margin-bottom: 0.5rem;
    font-size: 0.85rem;
  }

  .sender {
    font-weight: 700;
    color: #FF5500;
  }

  .timestamp {
    color: rgba(255, 255, 255, 0.5);
    font-family: 'Monaco', monospace;
  }

  .pending-indicator {
    color: #FF5500;
    font-style: italic;
    font-weight: 500;
  }

  .message-content {
    word-break: break-word;
    line-height: 1.5;
    color: white;
  }

  .status-bar {
    display: flex;
    justify-content: space-between;
    align-items: center;
    padding: 0.75rem 1rem;
    background: rgba(0, 0, 0, 0.3);
    border-top: 1px solid rgba(255, 85, 0, 0.2);
    font-size: 0.8rem;
  }

  .status-info {
    display: flex;
    align-items: center;
    gap: 1rem;
  }

  .connection-status {
    color: #FF5500;
    font-weight: 600;
  }

  .queue-status, .message-count {
    color: rgba(255, 255, 255, 0.6);
  }

  .scroll-to-bottom-btn {
    background: rgba(255, 85, 0, 0.1);
    border: 1px solid rgba(255, 85, 0, 0.3);
    color: #FF5500;
    border-radius: 20px;
    padding: 0.5rem 1rem;
    cursor: pointer;
    transition: all 0.2s ease;
    display: flex;
    align-items: center;
    gap: 0.5rem;
    font-size: 0.8rem;
  }

  .scroll-to-bottom-btn:hover {
    background: rgba(255, 85, 0, 0.2);
    border-color: #FF5500;
  }

  @keyframes spin {
    to { transform: rotate(360deg); }
  }

  @keyframes pulse {
    0%, 100% { opacity: 0.8; }
    50% { opacity: 1; }
  }

  /* Responsive Design */
  @media (max-width: 768px) {
    .messages-container {
      padding: 0.75rem;
    }

    .message {
      padding: 0.75rem;
    }

    .status-bar {
      flex-direction: column;
      gap: 0.5rem;
      align-items: stretch;
    }

    .status-info {
      justify-content: center;
    }
  }
</style>