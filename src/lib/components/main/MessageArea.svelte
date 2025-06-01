<!-- MessageArea.svelte -->
<script>
  import { createEventDispatcher } from 'svelte';
  import WalletButton from '$lib/components/nav/WalletButton.svelte';
  import { formatTime } from '$lib/utils/chatConstants.js';
  
  export let messages = [];
  export let loading = false;
  export let selectedChatroom = "";
  export let walletConnected = false;
  export let compactMode = false;
  export let chatContainer = null;
  
  const dispatch = createEventDispatcher();
  
  function handleScroll() {
    dispatch('scroll');
  }
  
  function openMnemonicModal() {
    dispatch('openMnemonicModal');
  }
</script>

<div class="messages-container" bind:this={chatContainer} on:scroll={handleScroll}>
  {#if loading && messages.length === 0}
    <div class="state-container">
      <div class="loading-state">
        <div class="spinner large"></div>
        <h3>Loading messages...</h3>
        <p>Please wait while we fetch the latest messages...</p>
      </div>
    </div>
  {:else if messages.length === 0}
    <div class="state-container">
      <div class="empty-state">
        <div class="empty-icon">
          <svg width="64" height="64" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5">
            <path d="M21 15a2 2 0 0 1-2 2H7l-4 4V5a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2z"></path>
          </svg>
        </div>
        <h3>Welcome to ErgoChat</h3>
        <p>
          {#if !walletConnected}
            Connect your wallet or import a seed phrase to start chatting with the Ergo community!
          {:else}
            Be the first to send a message in #{selectedChatroom}!
          {/if}
        </p>
        
        {#if !walletConnected}
          <div class="empty-actions">
            <WalletButton />
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
          </div>
        {/if}
      </div>
    </div>
  {:else}
    <div class="messages-list">
      {#each messages as message, index (message.id)}
        <div class="message {message.pending ? 'pending' : ''} {message.isMempool ? 'mempool' : ''} {compactMode ? 'compact' : ''}">
          <div class="message-avatar">
            <div class="avatar">
              {message.sender.charAt(0).toUpperCase()}
            </div>
            {#if message.pending}
              <div class="pending-indicator">
                <div class="pulse"></div>
              </div>
            {/if}
          </div>
          
          <div class="message-content">
            <div class="message-header">
              <span class="sender">{message.sender}</span>
              <span class="timestamp">{formatTime(message.timestamp)}</span>
              {#if message.pending}
                <span class="status pending">
                  <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                    <circle cx="12" cy="12" r="10"></circle>
                    <polyline points="12,6 12,12 16,14"></polyline>
                  </svg>
                  Pending...
                </span>
              {:else}
                <span class="status sent">
                  <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                    <polyline points="20,6 9,17 4,12"></polyline>
                  </svg>
                </span>
              {/if}
            </div>
            
            <div class="message-body">
              {message.content}
            </div>
          </div>
        </div>
      {/each}
    </div>
  {/if}
</div>