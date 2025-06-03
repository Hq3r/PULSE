<!-- MnemonicModal.svelte -->
<script>
  import { createEventDispatcher } from 'svelte';
  import { fade, slide } from 'svelte/transition';

  export let visible = false;
  export let mnemonicInput = "";
  export let loading = false;
  export let error = "";

  const dispatch = createEventDispatcher();

  function handleConnect() {
    dispatch('connect');
  }

  function handleClose() {
    dispatch('close');
  }

  function handleKeyPress(event) {
    dispatch('keyPress', { event });
  }
</script>

{#if visible}
  <div class="modal-overlay" on:click={handleClose} transition:fade={{ duration: 200 }}>
    <div class="modal-container" on:click|stopPropagation transition:slide={{ duration: 300 }}>
      <div class="modal-header">
        <h2>🔑 Import Wallet</h2>
        <p>Enter your seed phrase to connect</p>
        <button class="close-btn" on:click={handleClose}>
          <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
            <line x1="18" y1="6" x2="6" y2="18"></line>
            <line x1="6" y1="6" x2="18" y2="18"></line>
          </svg>
        </button>
      </div>
      
      <div class="modal-content">
        <div class="input-group">
          <label for="mnemonic">Mnemonic Phrase</label>
          <textarea
            id="mnemonic"
            bind:value={mnemonicInput}
            placeholder="Enter your 12, 15, or 24 word seed phrase..."
            on:keydown={handleKeyPress}
            disabled={loading}
            rows="4"
            class="mnemonic-input"
          ></textarea>
        </div>
        
        <div class="modal-actions">
          <button 
            class="btn btn-primary" 
            on:click={handleConnect} 
            disabled={!mnemonicInput.trim() || loading}
          >
            {#if loading}
              <div class="spinner"></div>
              Connecting...
            {:else}
              <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                <path d="M9 12l2 2 4-4"></path>
                <circle cx="12" cy="12" r="10"></circle>
              </svg>
              Import Wallet
            {/if}
          </button>
        </div>
        
        {#if error}
          <div class="error-message">
            <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
              <circle cx="12" cy="12" r="10"></circle>
              <line x1="15" y1="9" x2="9" y2="15"></line>
              <line x1="9" y1="9" x2="15" y2="15"></line>
            </svg>
            {error}
          </div>
        {/if}
        
        <div class="security-warning">
          <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
            <path d="M10.29 3.86L1.82 18a2 2 0 0 0 1.71 3h16.94a2 2 0 0 0 1.71-3L13.71 3.86a2 2 0 0 0-3.42 0z"></path>
            <line x1="12" y1="9" x2="12" y2="13"></line>
            <line x1="12" y1="17" x2="12.01" y2="17"></line>
          </svg>
          <strong>Demo Only:</strong> Use test wallets only. Never enter your main wallet's seed phrase on websites.
        </div>
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
    background: rgba(0, 0, 0, 0.8);
    backdrop-filter: blur(8px);
    display: flex;
    align-items: center;
    justify-content: center;
    z-index: 1000;
    padding: 20px;
  }

  .modal-container {
    background: var(--surface-color, #262626);
    border: 1px solid var(--border-color, rgba(255, 85, 0, 0.2));
    border-radius: 16px;
    max-width: 500px;
    width: 100%;
    max-height: 90vh;
    overflow-y: auto;
    box-shadow: 0 20px 40px rgba(0, 0, 0, 0.4);
  }

  .modal-header {
    padding: 24px 24px 16px;
    border-bottom: 1px solid var(--border-color, rgba(255, 85, 0, 0.1));
    position: relative;
  }

  .modal-header h2 {
    margin: 0 0 8px 0;
    color: var(--primary-color, #FF5500);
    font-size: 24px;
    font-weight: 700;
  }

  .modal-header p {
    margin: 0;
    color: var(--text-secondary, rgba(255, 255, 255, 0.7));
    font-size: 14px;
  }

  .close-btn {
    position: absolute;
    top: 20px;
    right: 20px;
    background: none;
    border: none;
    color: var(--text-secondary, rgba(255, 255, 255, 0.7));
    cursor: pointer;
    padding: 4px;
    border-radius: 4px;
    transition: all 0.2s ease;
  }

  .close-btn:hover {
    color: var(--text-color, #ffffff);
    background: var(--hover-color, rgba(255, 255, 255, 0.1));
  }

  .modal-content {
    padding: 24px;
  }

  .input-group {
    margin-bottom: 24px;
  }

  .input-group label {
    display: block;
    margin-bottom: 8px;
    font-weight: 600;
    color: var(--text-color, #ffffff);
    font-size: 14px;
  }

  .mnemonic-input {
    width: 100%;
    padding: 12px 16px;
    border: 1px solid var(--border-color, rgba(255, 85, 0, 0.2));
    border-radius: 8px;
    background: var(--background-color, #1a1a1a);
    color: var(--text-color, #ffffff);
    font-family: 'SF Mono', 'Monaco', 'Inconsolata', 'Roboto Mono', monospace;
    font-size: 14px;
    line-height: 1.5;
    resize: vertical;
    min-height: 100px;
    transition: all 0.2s ease;
  }

  .mnemonic-input:focus {
    outline: none;
    border-color: var(--primary-color, #FF5500);
    box-shadow: 0 0 0 3px rgba(255, 85, 0, 0.1);
  }

  .mnemonic-input:disabled {
    opacity: 0.6;
    cursor: not-allowed;
  }

  .modal-actions {
    display: flex;
    justify-content: center;
    margin-bottom: 20px;
  }

  .btn {
    display: flex;
    align-items: center;
    gap: 8px;
    padding: 12px 24px;
    border: none;
    border-radius: 8px;
    font-weight: 600;
    cursor: pointer;
    transition: all 0.2s ease;
    font-size: 14px;
    text-decoration: none;
  }

  .btn-primary {
    background: linear-gradient(135deg, var(--primary-color, #FF5500), #ff7733);
    color: white;
    min-width: 140px;
    justify-content: center;
  }

  .btn-primary:hover:not(:disabled) {
    background: linear-gradient(135deg, #ff7733, var(--primary-color, #FF5500));
    transform: translateY(-1px);
    box-shadow: 0 4px 12px rgba(255, 85, 0, 0.3);
  }

  .btn:disabled {
    opacity: 0.6;
    cursor: not-allowed;
    transform: none !important;
  }

  .spinner {
    width: 16px;
    height: 16px;
    border: 2px solid rgba(255, 255, 255, 0.3);
    border-top-color: white;
    border-radius: 50%;
    animation: spin 1s linear infinite;
  }

  @keyframes spin {
    to { transform: rotate(360deg); }
  }

  .error-message {
    display: flex;
    align-items: center;
    gap: 8px;
    padding: 12px 16px;
    background: rgba(220, 53, 69, 0.1);
    border: 1px solid #dc3545;
    border-radius: 8px;
    color: #dc3545;
    font-size: 14px;
    margin-bottom: 20px;
  }

  .security-warning {
    display: flex;
    align-items: flex-start;
    gap: 12px;
    padding: 16px;
    background: rgba(255, 193, 7, 0.1);
    border: 1px solid #ffc107;
    border-radius: 8px;
    color: #ffc107;
    font-size: 13px;
    line-height: 1.4;
  }

  .security-warning svg {
    flex-shrink: 0;
    margin-top: 2px;
  }

  .security-warning strong {
    color: #ffc107;
  }

  /* Responsive design */
  @media (max-width: 600px) {
    .modal-overlay {
      padding: 16px;
    }

    .modal-header {
      padding: 20px 20px 16px;
    }

    .modal-content {
      padding: 20px;
    }

    .modal-header h2 {
      font-size: 20px;
    }

    .btn {
      padding: 10px 20px;
      font-size: 13px;
    }
  }

  /* Dark/Light theme compatibility */
  :global(.light) .modal-container {
    background: #ffffff;
    color: #000000;
  }

  :global(.light) .mnemonic-input {
    background: #f8f9fa;
    color: #000000;
  }

  :global(.light) .modal-header h2 {
    color: var(--primary-color, #FF5500);
  }

  :global(.light) .close-btn {
    color: rgba(0, 0, 0, 0.7);
  }

  :global(.light) .close-btn:hover {
    color: #000000;
    background: rgba(0, 0, 0, 0.05);
  }
</style>