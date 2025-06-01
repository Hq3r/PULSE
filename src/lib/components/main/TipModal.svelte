<!-- TipModal.svelte - Component for confirming tip transactions -->
<script lang="ts">
    // Props
    export let showModal = false;
    export let amount = '';
    export let tokenId = '';
    export let recipient = '';
    export let onCancel = () => {};
    export let onConfirm = () => {};
    export let isSending = false;
    
    // Format token display
    $: displayToken = !tokenId || tokenId.toUpperCase() === 'ERG' ? 'ERG' : tokenId;
    
    // Format recipient address for display
    $: displayRecipient = recipient && recipient.length > 10 
      ? `${recipient.substring(0, 6)}...${recipient.substring(recipient.length - 4)}`
      : recipient;
    
    function handleModalClick(event) {
      // Only close if clicking the overlay, not the modal itself
      if (event.target === event.currentTarget) {
        onCancel();
      }
    }
  </script>
  
  {#if showModal}
    <div class="modal-overlay" on:click={handleModalClick}>
      <div class="tip-modal">
        <div class="tip-modal-header">
          <h3>Confirm Tip</h3>
          <button class="close-button" on:click={onCancel} aria-label="Close">
            <i class="fa-solid fa-times"></i>
          </button>
        </div>
        <div class="tip-modal-body">
          <p>You are about to send:</p>
          <div class="tip-amount">
            <span class="amount">{amount}</span>
            <span class="token">{displayToken}</span>
          </div>
          <p>To address:</p>
          <div class="tip-address">
            <code>{recipient}</code>
            <div class="tip-address-display">{displayRecipient}</div>
          </div>
          <p class="tip-warning">Please verify the address and amount before confirming.</p>
        </div>
        <div class="tip-modal-footer">
          <button class="cancel-btn" on:click={onCancel}>Cancel</button>
          <button 
            class="confirm-btn" 
            on:click={onConfirm}
            disabled={isSending}
          >
            {#if isSending}
              <div class="button-spinner small"></div>
            {:else}
              Confirm Tip
            {/if}
          </button>
        </div>
      </div>
    </div>
  {/if}
  
  <style>
    .modal-overlay {
      position: fixed;
      inset: 0;
      background-color: rgba(0, 0, 0, 0.7);
      backdrop-filter: blur(4px);
      display: flex;
      align-items: center;
      justify-content: center;
      z-index: 100;
      padding: 1rem;
    }
  
    .tip-modal {
      background-color: #1A1A1A;
      border-radius: 1rem;
      width: 100%;
      max-width: 450px;
      overflow: hidden;
      box-shadow: 0 8px 32px rgba(0, 0, 0, 0.3);
      display: flex;
      flex-direction: column;
    }
  
    .tip-modal-header {
      display: flex;
      justify-content: space-between;
      align-items: center;
      padding: 1rem 1.5rem;
      border-bottom: 1px solid rgba(255, 255, 255, 0.1);
    }
  
    .tip-modal-header h3 {
      margin: 0;
      font-size: 1.25rem;
      color: #FFFFFF;
    }
  
    .close-button {
      background: none;
      border: none;
      color: rgba(255, 255, 255, 0.6);
      font-size: 1.25rem;
      cursor: pointer;
      padding: 0.5rem;
      display: flex;
      align-items: center;
      justify-content: center;
      border-radius: 50%;
      transition: all 0.2s ease;
    }
  
    .close-button:hover {
      background-color: rgba(255, 255, 255, 0.1);
      color: #FFFFFF;
    }
  
    .tip-modal-body {
      padding: 1.5rem;
      color: rgba(255, 255, 255, 0.9);
    }
  
    .tip-amount {
      display: flex;
      align-items: center;
      gap: 0.5rem;
      background-color: rgba(255, 85, 0, 0.1);
      padding: 1rem;
      border-radius: 0.5rem;
      margin: 0.5rem 0 1.5rem;
    }
  
    .tip-amount .amount {
      font-size: 1.5rem;
      font-weight: 700;
      color: #FFFFFF;
    }
  
    .tip-amount .token {
      font-size: 1rem;
      font-weight: 500;
      color: #FF5500;
      background-color: rgba(255, 85, 0, 0.2);
      padding: 0.25rem 0.5rem;
      border-radius: 0.25rem;
    }
  
    .tip-address {
      background-color: #262626;
      padding: 0.75rem;
      border-radius: 0.5rem;
      margin: 0.5rem 0 1.5rem;
      overflow-wrap: break-word;
      word-break: break-all;
    }
  
    .tip-address code {
      font-family: monospace;
      font-size: 0.875rem;
      color: rgba(255, 255, 255, 0.9);
    }
    
    .tip-address-display {
      margin-top: 0.5rem;
      font-size: 0.875rem;
      color: #FF5500;
      font-weight: 600;
    }
  
    .tip-warning {
      color: #FF5500;
      font-size: 0.875rem;
      font-style: italic;
    }
  
    .tip-modal-footer {
      display: flex;
      justify-content: flex-end;
      gap: 1rem;
      padding: 1rem 1.5rem;
      border-top: 1px solid rgba(255, 255, 255, 0.1);
    }
  
    .cancel-btn {
      background-color: transparent;
      border: 1px solid rgba(255, 255, 255, 0.2);
      color: #FFFFFF;
      padding: 0.5rem 1rem;
      border-radius: 0.5rem;
      cursor: pointer;
      transition: all 0.2s ease;
    }
  
    .cancel-btn:hover {
      background-color: rgba(255, 255, 255, 0.1);
    }
  
    .confirm-btn {
      background-color: #FF5500;
      border: none;
      color: #FFFFFF;
      padding: 0.5rem 1rem;
      border-radius: 0.5rem;
      cursor: pointer;
      transition: all 0.2s ease;
      min-width: 120px;
      display: flex;
      align-items: center;
      justify-content: center;
    }
  
    .confirm-btn:hover {
      background-color: #FF6A1F;
    }
  
    .confirm-btn:disabled {
      background-color: #5A5A5A;
      cursor: not-allowed;
    }
  
    .button-spinner.small {
      width: 1rem;
      height: 1rem;
      border: 2px solid rgba(255, 255, 255, 0.1);
      border-top-color: #FFFFFF;
      border-radius: 50%;
      animation: spin 1s linear infinite;
    }
    
    @keyframes spin {
      to { transform: rotate(360deg); }
    }
  </style>