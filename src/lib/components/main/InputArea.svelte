<!-- InputArea.svelte -->
<script>
  import { createEventDispatcher } from 'svelte';
  import WalletButton from '$lib/components/nav/WalletButton.svelte';
  
  export let walletConnected = false;
  export let inputMessage = "";
  export let loading = false;
  export let isTyping = false;
  export let walletState = {};
  
  const dispatch = createEventDispatcher();
  
  function handleKeyPress(event) {
    dispatch('keyPress', { event });
  }
  
  function handleInputChange() {
    dispatch('inputChange');
  }
  
  function handleSendMessage() {
    dispatch('sendMessage');
  }
  
  function openMnemonicModal() {
    dispatch('openMnemonicModal');
  }
</script>

<div class="input-area">
  {#if walletConnected}
    <div class="input-help">
      <div class="help-content">
        <span class="help-text">
          💡 Use <code>/encrypt</code> for encrypted messages
        </span>
        {#if walletState.usingMnemonicWallet && walletState.transactionQueue?.length > 0}
          <span class="queue-status">
            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
              <circle cx="12" cy="12" r="3"></circle>
              <path d="M12 1v6m0 6v6"></path>
            </svg>
            Queue: {walletState.transactionQueue.length}
          </span>
        {/if}
      </div>
    </div>
    
    <div class="input-wrapper">
      <textarea
        bind:value={inputMessage}
        placeholder="Type your message... (use /encrypt for encryption)"
        on:keydown={handleKeyPress}
        on:input={handleInputChange}
        disabled={loading}
        rows="1"
        class="message-input"
        style="resize: none; overflow: hidden;"
      ></textarea>
      
      <button 
        class="send-btn {isTyping ? 'typing' : ''}" 
        on:click={handleSendMessage}
        disabled={!inputMessage.trim() || loading}
      >
        {#if loading}
          <div class="spinner small"></div>
          Sending...
        {:else if isTyping}
          <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
            <line x1="22" y1="2" x2="11" y2="13"></line>
            <polygon points="22,2 15,22 11,13 2,9 22,2"></polygon>
          </svg>
          Send
        {:else}
          💬 Type
        {/if}
      </button>
    </div>
  {:else}
    <div class="input-disabled">
      <div class="disabled-content">
        <h3>Connect to Start Chatting</h3>
        <p>Connect your wallet or import a seed phrase to join the conversation</p>
        <div class="disabled-actions">
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
      </div>
    </div>
  {/if}
</div>