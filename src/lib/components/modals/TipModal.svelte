<!-- TipModal.svelte - ERG Tipping Modal -->
<script>
  import { createEventDispatcher } from 'svelte';
  import { fade, slide } from 'svelte/transition';

  export let visible = false;
  export let recipientAddress = "";
  export let recipientName = "";
  export let walletConnected = false;
  export let currentWalletAddress = "";
  export let walletState = {};
  export let loading = false;

  const dispatch = createEventDispatcher();

  // Tip state
  let tipAmount = "";
  let tipMessage = "";
  let selectedToken = "ERG";
  let customAmount = "";
  let showCustomAmount = false;

  // Predefined tip amounts (in ERG)
  const quickTipAmounts = [
    { label: "0.1 ERG", value: "0.1" },
    { label: "0.5 ERG", value: "0.5" },
    { label: "1.0 ERG", value: "1.0" },
    { label: "2.0 ERG", value: "2.0" },
    { label: "5.0 ERG", value: "5.0" },
    { label: "Custom", value: "custom" }
  ];

  // Available tokens (can be extended)
  const availableTokens = [
    { id: "ERG", name: "ERG", symbol: "ERG", decimals: 9 },
    // Add more tokens here as needed
    // { id: "SigUSD", name: "SigmaUSD", symbol: "SigUSD", decimals: 2 },
    // { id: "SigRSV", name: "SigmaRSV", symbol: "SigRSV", decimals: 0 },
  ];

  function handleClose() {
    resetForm();
    dispatch('close');
  }

  function resetForm() {
    tipAmount = "";
    tipMessage = "";
    selectedToken = "ERG";
    customAmount = "";
    showCustomAmount = false;
  }

  function selectQuickAmount(amount) {
    if (amount === "custom") {
      showCustomAmount = true;
      tipAmount = "";
    } else {
      showCustomAmount = false;
      tipAmount = amount;
      customAmount = "";
    }
  }

  function handleCustomAmountChange() {
    if (showCustomAmount && customAmount) {
      tipAmount = customAmount;
    }
  }

  function validateTipAmount() {
    const amount = parseFloat(tipAmount);
    if (isNaN(amount) || amount <= 0) {
      return "Please enter a valid amount";
    }
    if (amount < 0.001) {
      return "Minimum tip amount is 0.001 ERG";
    }
    if (amount > 1000) {
      return "Maximum tip amount is 1000 ERG";
    }
    return null;
  }

  function handleSendTip() {
    const validationError = validateTipAmount();
    if (validationError) {
      dispatch('error', { message: validationError });
      return;
    }

    if (!recipientAddress) {
      dispatch('error', { message: "No recipient address provided" });
      return;
    }

    const tipData = {
      recipientAddress,
      recipientName,
      amount: parseFloat(tipAmount),
      token: selectedToken,
      message: tipMessage.trim(),
      senderAddress: currentWalletAddress
    };

    dispatch('sendTip', tipData);
  }

  // Reactive statements
  $: if (showCustomAmount) {
    handleCustomAmountChange();
  }

  $: canSendTip = tipAmount && parseFloat(tipAmount) > 0 && recipientAddress && walletConnected;
</script>

{#if visible}
  <div class="modal-overlay" on:click|self={handleClose} transition:fade={{ duration: 200 }}>
    <div class="tip-modal" transition:slide={{ duration: 300, y: -20 }}>
      <div class="modal-header">
        <h3>💰 Send Tip</h3>
        <button class="close-btn" on:click={handleClose}>
          <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
            <line x1="18" y1="6" x2="6" y2="18"></line>
            <line x1="6" y1="6" x2="18" y2="18"></line>
          </svg>
        </button>
      </div>

      <div class="modal-content">
        <!-- Recipient Info -->
        <div class="recipient-section">
          <div class="recipient-info">
            <div class="recipient-avatar">
              {recipientName ? recipientName.charAt(0).toUpperCase() : '?'}
            </div>
            <div class="recipient-details">
              <span class="recipient-name">{recipientName || 'Anonymous User'}</span>
              <span class="recipient-address">{recipientAddress}</span>
            </div>
          </div>
        </div>

        <!-- Token Selection -->
        <div class="form-section">
          <label class="section-label">Select Token</label>
          <div class="token-selector">
            {#each availableTokens as token}
              <button 
                class="token-btn {selectedToken === token.id ? 'active' : ''}"
                on:click={() => selectedToken = token.id}
              >
                <span class="token-symbol">{token.symbol}</span>
                <span class="token-name">{token.name}</span>
              </button>
            {/each}
          </div>
        </div>

        <!-- Amount Selection -->
        <div class="form-section">
          <label class="section-label">Tip Amount</label>
          <div class="amount-selector">
            {#each quickTipAmounts as amount}
              <button 
                class="amount-btn {(amount.value === 'custom' && showCustomAmount) || tipAmount === amount.value ? 'active' : ''}"
                on:click={() => selectQuickAmount(amount.value)}
              >
                {amount.label}
              </button>
            {/each}
          </div>

          {#if showCustomAmount}
            <div class="custom-amount-input" transition:slide={{ duration: 200 }}>
              <input
                type="number"
                bind:value={customAmount}
                placeholder="Enter custom amount"
                step="0.001"
                min="0.001"
                max="1000"
                class="amount-input"
              />
              <span class="amount-suffix">{selectedToken}</span>
            </div>
          {/if}
        </div>

        <!-- Tip Message -->
        <div class="form-section">
          <label class="section-label">Message (Optional)</label>
          <textarea
            bind:value={tipMessage}
            placeholder="Add a personal message with your tip..."
            class="tip-message-input"
            rows="3"
            maxlength="200"
          ></textarea>
          <div class="character-count">
            {tipMessage.length}/200
          </div>
        </div>

        <!-- Tip Summary -->
        {#if tipAmount}
          <div class="tip-summary">
            <div class="summary-row">
              <span>Amount:</span>
              <span class="summary-amount">{tipAmount} {selectedToken}</span>
            </div>
            <div class="summary-row">
              <span>To:</span>
              <span class="summary-recipient">{recipientName || 'Anonymous'}</span>
            </div>
            {#if tipMessage}
              <div class="summary-row">
                <span>Message:</span>
                <span class="summary-message">"{tipMessage}"</span>
              </div>
            {/if}
          </div>
        {/if}

        <!-- Action Buttons -->
        <div class="modal-actions">
          <button class="btn btn-secondary" on:click={handleClose}>
            Cancel
          </button>
          <button 
            class="btn btn-primary tip-send-btn" 
            on:click={handleSendTip}
            disabled={!canSendTip || loading}
          >
            {#if loading}
              <div class="spinner small"></div>
              Sending...
            {:else}
              <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                <path d="M12 2l3.09 6.26L22 9.27l-5 4.87 1.18 6.88L12 17.77l-6.18 3.25L7 14.14 2 9.27l6.91-1.01L12 2z"></path>
              </svg>
              Send Tip
            {/if}
          </button>
        </div>

        <!-- Wallet Warning -->
        {#if !walletConnected}
          <div class="wallet-warning">
            <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
              <path d="M10.29 3.86L1.82 18a2 2 0 0 0 1.71 3h16.94a2 2 0 0 0 1.71-3L13.71 3.86a2 2 0 0 0-3.42 0z"></path>
              <line x1="12" y1="9" x2="12" y2="13"></line>
              <line x1="12" y1="17" x2="12.01" y2="17"></line>
            </svg>
            Please connect your wallet to send tips
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
    background: rgba(0, 0, 0, 0.8);
    backdrop-filter: blur(8px);
    display: flex;
    align-items: center;
    justify-content: center;
    z-index: 1000;
    padding: 20px;
  }

  .tip-modal {
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
    display: flex;
    align-items: center;
    justify-content: space-between;
  }

  .modal-header h3 {
    margin: 0;
    color: var(--primary-color, #FF5500);
    font-size: 20px;
    font-weight: 700;
  }

  .close-btn {
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

  .recipient-section {
    margin-bottom: 24px;
  }

  .recipient-info {
    display: flex;
    align-items: center;
    gap: 12px;
    padding: 16px;
    background: var(--background-color, #1a1a1a);
    border-radius: 12px;
    border: 1px solid var(--border-color, rgba(255, 85, 0, 0.1));
  }

  .recipient-avatar {
    width: 48px;
    height: 48px;
    border-radius: 50%;
    background: var(--primary-color, #FF5500);
    color: white;
    display: flex;
    align-items: center;
    justify-content: center;
    font-size: 20px;
    font-weight: 700;
  }

  .recipient-details {
    display: flex;
    flex-direction: column;
    min-width: 0;
    flex: 1;
  }

  .recipient-name {
    font-weight: 600;
    color: var(--text-color, #ffffff);
    font-size: 16px;
  }

  .recipient-address {
    font-family: 'SF Mono', 'Monaco', 'Inconsolata', 'Roboto Mono', monospace;
    font-size: 12px;
    color: var(--text-secondary, rgba(255, 255, 255, 0.7));
    word-break: break-all;
  }

  .form-section {
    margin-bottom: 24px;
  }

  .section-label {
    display: block;
    margin-bottom: 12px;
    font-weight: 600;
    color: var(--text-color, #ffffff);
    font-size: 14px;
  }

  .token-selector {
    display: grid;
    grid-template-columns: repeat(auto-fit, minmax(120px, 1fr));
    gap: 8px;
  }

  .token-btn {
    display: flex;
    flex-direction: column;
    align-items: center;
    gap: 4px;
    padding: 12px 8px;
    border: 1px solid var(--border-color, rgba(255, 85, 0, 0.2));
    border-radius: 8px;
    background: var(--background-color, #1a1a1a);
    color: var(--text-color, #ffffff);
    cursor: pointer;
    transition: all 0.2s ease;
  }

  .token-btn:hover {
    background: var(--hover-color, rgba(255, 255, 255, 0.1));
    border-color: var(--primary-color, #FF5500);
  }

  .token-btn.active {
    background: var(--primary-color, #FF5500);
    color: white;
    border-color: var(--primary-color, #FF5500);
  }

  .token-symbol {
    font-weight: 700;
    font-size: 14px;
  }

  .token-name {
    font-size: 12px;
    opacity: 0.8;
  }

  .amount-selector {
    display: grid;
    grid-template-columns: repeat(3, 1fr);
    gap: 8px;
    margin-bottom: 12px;
  }

  .amount-btn {
    padding: 12px 8px;
    border: 1px solid var(--border-color, rgba(255, 85, 0, 0.2));
    border-radius: 8px;
    background: var(--background-color, #1a1a1a);
    color: var(--text-color, #ffffff);
    cursor: pointer;
    transition: all 0.2s ease;
    font-size: 13px;
    font-weight: 500;
  }

  .amount-btn:hover {
    background: var(--hover-color, rgba(255, 255, 255, 0.1));
    border-color: var(--primary-color, #FF5500);
  }

  .amount-btn.active {
    background: var(--primary-color, #FF5500);
    color: white;
    border-color: var(--primary-color, #FF5500);
  }

  .custom-amount-input {
    position: relative;
    display: flex;
    align-items: center;
  }

  .amount-input {
    width: 100%;
    padding: 12px 60px 12px 16px;
    border: 1px solid var(--border-color, rgba(255, 85, 0, 0.2));
    border-radius: 8px;
    background: var(--background-color, #1a1a1a);
    color: var(--text-color, #ffffff);
    font-size: 14px;
    transition: all 0.2s ease;
  }

  .amount-input:focus {
    outline: none;
    border-color: var(--primary-color, #FF5500);
    box-shadow: 0 0 0 3px rgba(255, 85, 0, 0.1);
  }

  .amount-suffix {
    position: absolute;
    right: 16px;
    color: var(--text-secondary, rgba(255, 255, 255, 0.7));
    font-size: 14px;
    font-weight: 500;
  }

  .tip-message-input {
    width: 100%;
    padding: 12px 16px;
    border: 1px solid var(--border-color, rgba(255, 85, 0, 0.2));
    border-radius: 8px;
    background: var(--background-color, #1a1a1a);
    color: var(--text-color, #ffffff);
    font-size: 14px;
    line-height: 1.5;
    resize: vertical;
    min-height: 80px;
    transition: all 0.2s ease;
  }

  .tip-message-input:focus {
    outline: none;
    border-color: var(--primary-color, #FF5500);
    box-shadow: 0 0 0 3px rgba(255, 85, 0, 0.1);
  }

  .character-count {
    text-align: right;
    font-size: 12px;
    color: var(--text-secondary, rgba(255, 255, 255, 0.6));
    margin-top: 4px;
  }

  .tip-summary {
    background: var(--background-color, #1a1a1a);
    border: 1px solid var(--border-color, rgba(255, 85, 0, 0.1));
    border-radius: 12px;
    padding: 16px;
    margin-bottom: 24px;
  }

  .summary-row {
    display: flex;
    justify-content: space-between;
    align-items: flex-start;
    margin-bottom: 8px;
    font-size: 14px;
  }

  .summary-row:last-child {
    margin-bottom: 0;
  }

  .summary-row > span:first-child {
    color: var(--text-secondary, rgba(255, 255, 255, 0.7));
    font-weight: 500;
    min-width: 80px;
  }

  .summary-amount {
    color: var(--primary-color, #FF5500);
    font-weight: 700;
    font-family: 'SF Mono', 'Monaco', 'Inconsolata', 'Roboto Mono', monospace;
  }

  .summary-recipient {
    color: var(--text-color, #ffffff);
    font-weight: 600;
  }

  .summary-message {
    color: var(--text-color, #ffffff);
    font-style: italic;
    word-break: break-word;
    text-align: right;
    max-width: 250px;
  }

  .modal-actions {
    display: flex;
    gap: 12px;
    justify-content: center;
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
    min-width: 120px;
    justify-content: center;
  }

  .btn-secondary {
    background: transparent;
    color: var(--text-secondary, rgba(255, 255, 255, 0.7));
    border: 1px solid var(--border-color, rgba(255, 85, 0, 0.2));
  }

  .btn-secondary:hover {
    background: var(--hover-color, rgba(255, 255, 255, 0.1));
    color: var(--text-color, #ffffff);
  }

  .btn-primary {
    background: linear-gradient(135deg, var(--primary-color, #FF5500), #ff7733);
    color: white;
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

  .spinner.small {
    width: 14px;
    height: 14px;
  }

  @keyframes spin {
    to { transform: rotate(360deg); }
  }

  .wallet-warning {
    display: flex;
    align-items: center;
    gap: 8px;
    padding: 12px 16px;
    background: rgba(255, 193, 7, 0.1);
    border: 1px solid #ffc107;
    border-radius: 8px;
    color: #ffc107;
    font-size: 14px;
    margin-top: 16px;
  }

  /* Responsive design */
  @media (max-width: 600px) {
    .modal-overlay {
      padding: 16px;
    }

    .tip-modal {
      max-width: none;
      width: 100%;
    }

    .modal-header {
      padding: 20px 20px 16px;
    }

    .modal-content {
      padding: 20px;
    }

    .amount-selector {
      grid-template-columns: repeat(2, 1fr);
    }

    .token-selector {
      grid-template-columns: 1fr;
    }

    .modal-actions {
      flex-direction: column;
    }

    .summary-message {
      max-width: 180px;
    }
  }
</style>