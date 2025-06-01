<!-- ChatInput.svelte - Simple chat input component -->
<script>
  import { createEventDispatcher } from 'svelte';
  import EmojiPicker from '$lib/components/main/EmojiPicker.svelte';
  
  const dispatch = createEventDispatcher();
  
  // Props
  export let inputMessage = "";
  export let loading = false;
  export let error = "";
  export let walletConnected = false;
  export let usingMnemonicWallet = false;
  export let transactionQueueLength = 0;
  
  // ============= EVENT HANDLERS =============
  
  function handleKeyPress(event) {
    if (event.key === 'Enter' && !event.shiftKey) {
      event.preventDefault();
      sendMessage();
    }
  }
  
  function sendMessage() {
    if (!walletConnected || !inputMessage.trim() || loading) return;
    
    dispatch('sendMessage', { 
      message: inputMessage.trim()
    });
    
    inputMessage = "";
  }
  
  function handleEmojiSelect(event) {
    const emoji = event.detail.emoji;
    inputMessage += emoji;
    
    // Focus the textarea after selecting an emoji
    setTimeout(() => {
      document.querySelector('.message-input')?.focus();
    }, 10);
  }
  
  function clearError() {
    dispatch('clearError');
  }

  // Debug wallet connection
  $: console.log('ChatInput - walletConnected:', walletConnected);
</script>

<!-- HTML Template -->
<div class="chat-input">
  <!-- Debug info -->
  <div class="debug-info">
    <small>Debug: walletConnected = {walletConnected}</small>
  </div>

  <!-- Error Display -->
  {#if error}
    <div class="error-message">
      <span>{error}</span>
      <button class="error-close" on:click={clearError}>
        <i class="fas fa-times"></i>
      </button>
    </div>
  {/if}

  <!-- Input Help -->
  <div class="input-help">
    <small>
      💡 Use <code>/encrypt</code> to send encrypted messages
      {#if usingMnemonicWallet && transactionQueueLength > 0}
        • Queue: {transactionQueueLength}
      {/if}
    </small>
  </div>
  
  <!-- Always show input form -->
  <div class="input-container">
    <textarea
      bind:value={inputMessage}
      placeholder={walletConnected ? "Type your message... (use /encrypt for encryption)" : "Connect your wallet from the header to start messaging"}
      on:keydown={handleKeyPress}
      disabled={!walletConnected || loading}
      rows="3"
      class="message-input"
    ></textarea>
    
    <div class="input-actions">
      {#if walletConnected}
        <EmojiPicker on:select={handleEmojiSelect} />
      {/if}
      
      <button 
        class="send-button" 
        on:click={sendMessage} 
        disabled={!walletConnected || !inputMessage.trim() || loading}
      >
        {#if loading}
          <div class="button-spinner"></div>
        {:else}
          <i class="fas fa-paper-plane"></i>
        {/if}
      </button>
    </div>
  </div>

  <!-- Connection status -->
  {#if !walletConnected}
    <div class="connection-notice">
      <p>Connect your wallet from the header to start messaging</p>
    </div>
  {/if}
</div>

<style>
  .chat-input {
    padding: 1rem 1.5rem;
    border-top: 2px solid #FF5500;
    background: linear-gradient(135deg, #111111, #000000);
  }

  .debug-info {
    color: #FF5500;
    font-size: 0.7rem;
    margin-bottom: 0.5rem;
    font-family: monospace;
  }

  .error-message {
    background: rgba(244, 67, 54, 0.1);
    border: 1px solid rgba(244, 67, 54, 0.3);
    color: #f44336;
    padding: 0.75rem 1rem;
    border-radius: 8px;
    margin-bottom: 1rem;
    display: flex;
    justify-content: space-between;
    align-items: center;
  }

  .error-close {
    background: none;
    border: none;
    color: #f44336;
    cursor: pointer;
    padding: 0.25rem;
    border-radius: 4px;
    transition: background 0.2s ease;
  }

  .error-close:hover {
    background: rgba(244, 67, 54, 0.2);
  }

  .input-help {
    margin-bottom: 0.5rem;
    color: rgba(255, 85, 0, 0.8);
    font-size: 0.85rem;
  }

  .input-help code {
    background: rgba(255, 85, 0, 0.2);
    color: #FF5500;
    padding: 0.2rem 0.4rem;
    border-radius: 4px;
    font-size: 0.8em;
    font-weight: 600;
  }

  .input-container {
    display: flex;
    flex-direction: column;
    gap: 1rem;
  }

  .message-input {
    width: 100%;
    background: #000000;
    color: white;
    border: 2px solid #FF5500;
    border-radius: 12px;
    padding: 1rem;
    resize: none;
    font-family: inherit;
    font-size: 0.95rem;
    transition: all 0.2s ease;
  }

  .message-input:focus {
    outline: none;
    border-color: #FF5500;
    box-shadow: 0 0 0 4px rgba(255, 85, 0, 0.2);
    background: #111111;
  }

  .message-input:disabled {
    opacity: 0.5;
    cursor: not-allowed;
    background: #222;
  }

  .input-actions {
    display: flex;
    justify-content: space-between;
    align-items: center;
  }

  .send-button {
    background: linear-gradient(135deg, #FF5500, #ff7733);
    color: #000000;
    border: none;
    border-radius: 50%;
    width: 3rem;
    height: 3rem;
    cursor: pointer;
    display: flex;
    align-items: center;
    justify-content: center;
    transition: all 0.2s ease;
    font-size: 1.1rem;
  }

  .send-button:hover:not(:disabled) {
    background: linear-gradient(135deg, #ff7733, #FF5500);
    transform: translateY(-1px) scale(1.05);
    box-shadow: 0 4px 20px rgba(255, 85, 0, 0.4);
  }

  .send-button:disabled {
    background: #333;
    color: #666;
    cursor: not-allowed;
    transform: none;
  }

  .button-spinner {
    width: 1.2rem;
    height: 1.2rem;
    border: 2px solid rgba(0, 0, 0, 0.3);
    border-top-color: #000000;
    border-radius: 50%;
    animation: spin 1s linear infinite;
  }

  .connection-notice {
    text-align: center;
    padding: 1rem;
    color: rgba(255, 255, 255, 0.7);
    background: rgba(255, 85, 0, 0.05);
    border-radius: 8px;
    margin-top: 0.5rem;
  }

  .connection-notice p {
    margin: 0;
    font-size: 0.9rem;
  }

  @keyframes spin {
    to { transform: rotate(360deg); }
  }

  /* Responsive Design */
  @media (max-width: 768px) {
    .chat-input {
      padding: 0.75rem;
    }

    .input-container {
      gap: 0.75rem;
    }

    .input-actions {
      flex-direction: column;
      gap: 0.75rem;
      align-items: stretch;
    }

    .send-button {
      align-self: flex-end;
      width: 2.5rem;
      height: 2.5rem;
    }
  }

  @media (max-width: 480px) {
    .chat-input {
      padding: 0.5rem;
    }

    .input-help {
      font-size: 0.8rem;
    }

    .message-input {
      padding: 0.75rem;
      font-size: 0.9rem;
    }
  }
</style>