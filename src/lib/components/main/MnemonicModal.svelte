<!-- MnemonicModal.svelte -->
<script>
  import { createEventDispatcher } from 'svelte';
  
  export let show = false;
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
    if (event.key === 'Enter' && !event.shiftKey) {
      event.preventDefault();
      handleConnect();
    }
  }
</script>

{#if show}
  <div class="modal-overlay" on:click={handleClose}>
    <div class="modal-container" on:click|stopPropagation>
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
  /* Modal Styles */
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
    padding: var(--space-lg);
  }

  .modal-container {
    background: var(--surface-elevated);
    border-radius: var(--radius-xl);
    padding: var(--space-2xl);
    max-width: 500px;
    width: 100%;
    border: 2px solid var(--ergo-orange);
    box-shadow: var(--shadow-xl);
    position: relative;
    max-height: 90vh;
    overflow-y: auto;
  }

  .modal-header {
    text-align: center;
    margin-bottom: var(--space-xl);
    position: relative;
  }

  .modal-header h2 {
    margin: 0 0 var(--space-sm) 0;
    font-size: 1.75rem;
    color: var(--ergo-orange);
    font-weight: 700;
  }

  .modal-header p {
    margin: 0;
    color: var(--text-secondary);
    font-size: 1rem;
  }

  .close-btn {
    position: absolute;
    top: -8px;
    right: -8px;
    background: var(--surface);
    border: 1px solid var(--border);
    color: var(--text-secondary);
    cursor: pointer;
    border-radius: 50%;
    transition: all var(--transition-fast);
    width: 36px;
    height: 36px;
    display: flex;
    align-items: center;
    justify-content: center;
  }

  .close-btn:hover {
    background: var(--ergo-orange-alpha);
    color: var(--ergo-orange);
    border-color: var(--ergo-orange);
  }

  .modal-content {
    display: flex;
    flex-direction: column;
    gap: var(--space-lg);
  }

  .input-group {
    display: flex;
    flex-direction: column;
    gap: var(--space-sm);
  }

  .input-group label {
    font-weight: 500;
    color: var(--text-primary);
    font-size: 0.875rem;
  }

  .mnemonic-input {
    width: 100%;
    background: var(--surface);
    color: var(--text-primary);
    border: 2px solid var(--border);
    border-radius: var(--radius-lg);
    padding: var(--space-md);
    resize: none;
    font-family: var(--font-family-mono);
    font-size: 0.875rem;
    line-height: 1.5;
    transition: all var(--transition-fast);
  }

  .mnemonic-input:focus {
    outline: none;
    border-color: var(--ergo-orange);
    box-shadow: 0 0 0 4px var(--ergo-orange-alpha);
  }

  .mnemonic-input::placeholder {
    color: var(--text-muted);
  }

  .modal-actions {
    display: flex;
    justify-content: center;
  }

  .modal-actions .btn {
    min-width: 140px;
    padding: var(--space-md) var(--space-xl);
  }

  .btn {
    display: inline-flex;
    align-items: center;
    justify-content: center;
    gap: var(--space-xs);
    padding: var(--space-sm) var(--space-md);
    border-radius: var(--radius-md);
    font-size: 0.875rem;
    font-weight: 500;
    cursor: pointer;
    transition: all var(--transition-fast);
    border: 1px solid transparent;
    text-decoration: none;
    white-space: nowrap;
  }

  .btn:disabled {
    opacity: 0.5;
    cursor: not-allowed;
    transform: none !important;
  }

  .btn-primary {
    background: linear-gradient(135deg, var(--ergo-orange), var(--ergo-orange-light));
    color: white;
    border-color: var(--ergo-orange);
  }

  .btn-primary:hover:not(:disabled) {
    background: linear-gradient(135deg, var(--ergo-orange-light), var(--ergo-orange));
    transform: translateY(-1px);
    box-shadow: var(--shadow-md);
  }

  .error-message {
    background: rgba(220, 53, 69, 0.1);
    border: 1px solid rgba(220, 53, 69, 0.3);
    color: var(--error);
    border-radius: var(--radius-md);
    padding: var(--space-md);
    font-size: 0.875rem;
    display: flex;
    align-items: center;
    gap: var(--space-sm);
  }

  .security-warning {
    background: var(--ergo-orange-alpha);
    border: 1px solid rgba(255, 85, 0, 0.3);
    color: var(--ergo-orange);
    border-radius: var(--radius-md);
    padding: var(--space-md);
    font-size: 0.875rem;
    display: flex;
    align-items: flex-start;
    gap: var(--space-sm);
    line-height: 1.4;
  }

  .spinner {
    border: 2px solid var(--border);
    border-top-color: white;
    border-radius: 50%;
    width: 16px;
    height: 16px;
    animation: spin 1s linear infinite;
  }

  @keyframes spin {
    to { transform: rotate(360deg); }
  }

  /* CSS Custom Properties (assuming these are defined in parent) */
  :root {
    --ergo-orange: #FF5500;
    --ergo-orange-light: #FF7733;
    --ergo-orange-alpha: rgba(255, 85, 0, 0.1);
    --surface-elevated: #21262D;
    --surface: #161B22;
    --border: #30363D;
    --text-primary: #F0F6FC;
    --text-secondary: #C9D1D9;
    --text-muted: #8B949E;
    --error: #DC3545;
    --space-xs: 0.25rem;
    --space-sm: 0.5rem;
    --space-md: 1rem;
    --space-lg: 1.5rem;
    --space-xl: 2rem;
    --space-2xl: 3rem;
    --radius-sm: 0.375rem;
    --radius-md: 0.5rem;
    --radius-lg: 0.75rem;
    --radius-xl: 1rem;
    --shadow-md: 0 4px 6px -1px rgba(0, 0, 0, 0.1), 0 2px 4px -1px rgba(0, 0, 0, 0.06);
    --shadow-xl: 0 20px 25px -5px rgba(0, 0, 0, 0.1), 0 10px 10px -5px rgba(0, 0, 0, 0.04);
    --font-family-mono: 'SF Mono', Monaco, 'Cascadia Code', 'Roboto Mono', monospace;
    --transition-fast: 150ms ease;
  }
</style>