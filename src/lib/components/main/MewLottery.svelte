<!-- MewLottery.svelte - Buy MEW Fun Lottery directly from chat -->
<script lang="ts">
    import { createEventDispatcher, onMount } from 'svelte';
    import { 
      OutputBuilder, 
      TransactionBuilder, 
      ErgoAddress, 
      RECOMMENDED_MIN_FEE_VALUE 
    } from '@fleet-sdk/core';
    import { BigNumber } from 'bignumber.js';
    import { SColl, SInt } from '@fleet-sdk/serializer';
    import { 
      connected_wallet_address, 
      selected_wallet_ergo 
    } from '$lib/store/store';
    import { fetchBoxes, getBlockHeight } from '$lib/api-explorer/explorer';
    import { showCustomToast } from '$lib/utils/utils';
    
    const dispatch = createEventDispatcher();
    
    // Constants from your const file
    const TICKET_MINT_FEE = 0.0021;
    const DAPP_FEE = 0.02;
    const API_HOST = 'https://api.mewfinance.com/';
    const RECIPIENT_ADDRESS = '9fXLYNT8hQEvmstem2ezFBFBXRJH9ZaUAic6nzykhjAH857dDpH';
    const DEV_PK = '9fCMmB72WcFLseNx6QANheTCrDjKeb9FzdFNTdBREt2FzHTmusY';
    
    // Props
    export let showLotteryModal = false;
    export let walletConnected = false;
    
    // State
    let isLoading = false;
    let isBuyingTicket = false;
    let config = null;
    let activeData = null;
    let ticketCount = 1;
    let selectedNumbers = new Array(4).fill(undefined); // Initialize with 4 undefined positions
    let autoSelect = true;
    
    // Constants
    const LOTTERY_COST_NANO = BigInt(1002100000); // Use BigInt instead of regular number
    const LOTTERY_COST_ERG = Number(LOTTERY_COST_NANO) / 1000000000;
    
    // Reactive calculations
    $: totalCost = ticketCount * LOTTERY_COST_ERG;
    $: totalCostNano = BigInt(ticketCount) * LOTTERY_COST_NANO;
    
    // Load lottery config on mount
    onMount(async () => {
      await loadLotteryConfig();
    });
    
    async function loadLotteryConfig() {
      try {
        isLoading = true;
        
        // Load main config
        const configResponse = await fetch(`${API_HOST}lottery/getConfig?id=Mew`);
        const configData = await configResponse.json();
        config = configData.items[0];
        
        // Load active lottery data
        const activeResponse = await fetch(`${API_HOST}lottery/getActiveLotteryConfig?id=Mew`);
        const activeResponseData = await activeResponse.json();
        activeData = activeResponseData.items[0];
        
        console.log('Lottery config loaded:', { config, activeData });
      } catch (error) {
        console.error('Error loading lottery config:', error);
        showCustomToast('Failed to load lottery information', 3000, 'error');
      } finally {
        isLoading = false;
      }
    }
    
    // Generate random lottery numbers (4 digits, each 0-9)
    function generateRandomNumbers() {
      const numbers = [];
      const digitCount = config?.c_length || 4; // Should be 4 for MEW Fun
      
      for (let i = 0; i < digitCount; i++) {
        numbers.push(Math.floor(Math.random() * 10)); // Random digit 0-9
      }
      
      return numbers;
    }
    
    // Handle digit selection for manual mode
    function toggleDigit(position, digit) {
      // Ensure selectedNumbers is properly initialized
      if (!Array.isArray(selectedNumbers) || selectedNumbers.length !== (config?.c_length || 4)) {
        selectedNumbers = new Array(config?.c_length || 4).fill(undefined);
      }
      
      selectedNumbers[position] = digit;
      selectedNumbers = [...selectedNumbers]; // Trigger reactivity
      console.log('Updated selectedNumbers:', selectedNumbers);
    }
    
    // Generate auto-selected numbers
    function generateAutoNumbers() {
      selectedNumbers = generateRandomNumbers(); // This generates all 4 digits
      autoSelect = false; // Switch to manual mode to show the selected numbers
      console.log('Auto-generated numbers:', selectedNumbers);
    }
    
    // Clear selected numbers
    function clearNumbers() {
      selectedNumbers = new Array(config?.c_length || 4).fill(undefined);
      autoSelect = true;
    }
    
    // Create lottery purchase transaction
    async function createLotteryTx(
      userAddress: string,
      userUtxos: Array<any>,
      height: number
    ) {
      const userErgoAddress = ErgoAddress.fromBase58(userAddress);
      
      // Use auto-generated numbers if none selected, or use manually selected numbers
      const numbersToUse = autoSelect ? generateRandomNumbers() : selectedNumbers;
      
      // Validate that we have all 4 digits
      if (numbersToUse.length !== (config?.c_length || 4)) {
        throw new Error(`Please select ${config?.c_length || 4} digits`);
      }
      
      // Check for undefined values in manual mode
      if (!autoSelect && numbersToUse.some(d => d === undefined || d === null)) {
        throw new Error('Please select all 4 digits');
      }
      
      // Create lottery ticket box
      const ticketBox = new OutputBuilder(
        LOTTERY_COST_NANO,  // Use the BigInt constant directly
        RECIPIENT_ADDRESS
      ).setAdditionalRegisters({
        R4: SColl(SInt, numbersToUse).toHex(), // Selected lottery numbers
        R5: SInt(Date.now()).toHex() // Timestamp as regular integer (current time fits in 32-bit when using seconds)
      });
      
      // Create fee box for the dApp
      const feeBox = new OutputBuilder(
        new BigNumber(DAPP_FEE).times(10 ** 9),
        DEV_PK
      );
      
      // Build the transaction
      const unsignedTx = new TransactionBuilder(height)
        .configure((s) => s.setMaxTokensPerChangeBox(100))
        .from(userUtxos)
        .to([ticketBox, feeBox])
        .sendChangeTo(userErgoAddress)
        .payFee(RECOMMENDED_MIN_FEE_VALUE)
        .build()
        .toEIP12Object();
      
      console.log('Lottery ticket cost:', LOTTERY_COST_NANO);
      console.log('Selected numbers:', numbersToUse);
      console.log('Transaction:', unsignedTx);
      
      return { transaction: unsignedTx, numbers: numbersToUse };
    }
    
    // Buy lottery ticket
    async function buyLotteryTicket() {
      if (!walletConnected || !$connected_wallet_address) {
        showCustomToast('Please connect your wallet first', 3000, 'warning');
        return;
      }
      
      try {
        isBuyingTicket = true;
        
        // Get user UTXOs and blockchain height
        const utxos = await fetchBoxes($connected_wallet_address);
        const height = await getBlockHeight();
        
        if (!utxos || utxos.length === 0) {
          throw new Error('No UTXOs found in wallet');
        }
        
        // Check if user has enough ERG
        const totalValue = utxos.reduce((sum, utxo) => sum + BigInt(utxo.value), 0n);
        const requiredValue = totalCostNano + BigInt(RECOMMENDED_MIN_FEE_VALUE);
        
        if (totalValue < requiredValue) {
          throw new Error(`Insufficient ERG. Need ${totalCost.toFixed(4)} ERG plus fees`);
        }
        
        // Create transaction
        const { transaction, numbers } = await createLotteryTx(
          $connected_wallet_address,
          utxos,
          height
        );
        
        // Sign and submit transaction
        if ($selected_wallet_ergo !== 'ergopay') {
          let signed, txId;
          
          if (typeof window.ergo.sign_tx === 'function') {
            signed = await window.ergo.sign_tx(transaction);
          } else if (typeof window.ergo.signTx === 'function') {
            signed = await window.ergo.signTx(transaction);
          } else {
            throw new Error('No sign_tx method found in wallet');
          }
          
          if (typeof window.ergo.submit_tx === 'function') {
            txId = await window.ergo.submit_tx(signed);
          } else if (typeof window.ergo.submitTx === 'function') {
            txId = await window.ergo.submitTx(signed);
          } else {
            throw new Error('No submit_tx method found in wallet');
          }
          
          // Success!
          showCustomToast(
            `🎰 Lottery ticket purchased!<br>Numbers: ${numbers.join(', ')}<br>TX: <a target="_blank" href="https://explorer.ergoplatform.com/en/transactions/${txId}">${txId.substring(0, 8)}...</a>`,
            5000,
            'success'
          );
          
          // Add lottery message to chat
          dispatch('lotteryPurchased', {
            txId,
            numbers,
            cost: totalCost
          });
          
          // Close modal
          showLotteryModal = false;
          clearNumbers();
          
        } else {
          // Handle ErgoPay
          dispatch('ergopayTransaction', { transaction, type: 'lottery' });
        }
        
      } catch (error) {
        console.error('Error buying lottery ticket:', error);
        showCustomToast(`Failed to buy lottery ticket: ${error.message}`, 3000, 'error');
      } finally {
        isBuyingTicket = false;
      }
    }
    
    // Close modal
    function closeModal() {
      showLotteryModal = false;
      clearNumbers();
    }
  </script>
  
  <!-- Lottery Modal -->
  {#if showLotteryModal}
    <div class="lottery-modal-overlay" on:click|self={closeModal}>
      <div class="lottery-modal">
        <!-- Header -->
        <div class="lottery-header">
          <div class="lottery-title">
            <i class="fa-solid fa-dice"></i>
            <span>MEW Fun Lottery</span>
          </div>
          <button class="close-btn" on:click={closeModal}>
            <i class="fa-solid fa-times"></i>
          </button>
        </div>
        
        <!-- Loading State -->
        {#if isLoading}
          <div class="lottery-loading">
            <div class="loading-spinner"></div>
            <p>Loading lottery information...</p>
          </div>
        {:else if config && activeData}
          <!-- Lottery Info -->
          <div class="lottery-info">
            <div class="lottery-stats">
              <div class="stat-item">
                <span class="stat-label">Current Prize Pool</span>
                <span class="stat-value">{activeData.prizePool || '0'} ERG</span>
              </div>
              <div class="stat-item">
                <span class="stat-label">Tickets Sold</span>
                <span class="stat-value">{activeData.ticketsSold || '0'}</span>
              </div>
              <div class="stat-item">
                <span class="stat-label">Draw Date</span>
                <span class="stat-value">{activeData.drawDate ? new Date(activeData.drawDate).toLocaleDateString() : 'TBA'}</span>
              </div>
            </div>
          </div>
          
          <!-- Number Selection -->
          <div class="number-selection">
            <div class="selection-header">
              <h3>Select {config.c_length || 4} digits (0-9)</h3>
              <div class="selection-controls">
                <button class="auto-btn" on:click={generateAutoNumbers}>
                  <i class="fa-solid fa-magic"></i>
                  Auto Pick
                </button>
                <button class="clear-btn" on:click={clearNumbers}>
                  <i class="fa-solid fa-eraser"></i>
                  Clear
                </button>
              </div>
            </div>
            
            <!-- Selected Numbers Display -->
            <div class="selected-numbers">
              <span class="selected-label">Your Ticket:</span>
              <div class="selected-balls">
                {#each Array(config.c_length || 4) as _, i}
                  <div class="digit-ball {(selectedNumbers[i] !== undefined && selectedNumbers[i] !== null) ? 'filled' : 'empty'}">
                    {(selectedNumbers[i] !== undefined && selectedNumbers[i] !== null) ? selectedNumbers[i] : '-'}
                  </div>
                {/each}
              </div>
              {#if !autoSelect}
                <div class="ticket-preview">
                  Ticket: {selectedNumbers.map(d => d !== undefined ? d : '-').join('')}
                </div>
              {/if}
            </div>
            
            <!-- Digit Selection Grid (Manual Mode) -->
            {#if !autoSelect}
              <div class="digit-selection">
                {#each Array(config.c_length || 4) as _, position}
                  <div class="digit-position">
                    <h4>Position {position + 1}</h4>
                    <div class="digits-grid">
                      {#each Array(10) as _, digit}
                        <button 
                          class="digit-btn {selectedNumbers[position] === digit ? 'selected' : ''}"
                          on:click={() => toggleDigit(position, digit)}
                        >
                          {digit}
                        </button>
                      {/each}
                    </div>
                  </div>
                {/each}
              </div>
            {:else}
              <div class="auto-selection-notice">
                <i class="fa-solid fa-magic"></i>
                <p>4 random digits (0-9) will be automatically generated when you purchase</p>
                <p class="lottery-format">Format: Each position gets a digit from 0-9</p>
              </div>
            {/if}
          </div>
          
          <!-- Purchase Section -->
          <div class="purchase-section">
            <div class="cost-display">
              <div class="cost-breakdown">
                <span class="cost-label">Ticket Cost:</span>
                <span class="cost-value">{LOTTERY_COST_ERG} ERG</span>
              </div>
              <div class="cost-note">
                <i class="fa-solid fa-info-circle"></i>
                <span>Includes 0.0021 ERG processing fee</span>
              </div>
            </div>
            
            <div class="purchase-actions">
              <button class="cancel-btn" on:click={closeModal} disabled={isBuyingTicket}>
                Cancel
              </button>
              <button 
                class="buy-btn" 
                on:click={buyLotteryTicket}
                disabled={isBuyingTicket || !walletConnected || (!autoSelect && selectedNumbers.some(d => d === undefined || d === null))}
              >
                {#if isBuyingTicket}
                  <div class="btn-spinner"></div>
                  Purchasing...
                {:else}
                  <i class="fa-solid fa-ticket"></i>
                  Buy Ticket ({LOTTERY_COST_ERG} ERG)
                {/if}
              </button>
            </div>
          </div>
        {:else}
          <!-- Error State -->
          <div class="lottery-error">
            <i class="fa-solid fa-exclamation-triangle"></i>
            <p>Failed to load lottery information</p>
            <button class="retry-btn" on:click={loadLotteryConfig}>
              <i class="fa-solid fa-refresh"></i>
              Retry
            </button>
          </div>
        {/if}
      </div>
    </div>
  {/if}
  
  <style>
    .lottery-modal-overlay {
      position: fixed;
      top: 0;
      left: 0;
      right: 0;
      bottom: 0;
      background-color: rgba(0, 0, 0, 0.7);
      display: flex;
      align-items: center;
      justify-content: center;
      z-index: 1000;
      padding: 1rem;
    }
    
    .lottery-modal {
      background-color: #262626;
      border-radius: 12px;
      width: 100%;
      max-width: 600px;
      max-height: 90vh;
      overflow-y: auto;
      box-shadow: 0 20px 60px rgba(0, 0, 0, 0.5);
      animation: modalSlideIn 0.3s ease;
    }
    
    @keyframes modalSlideIn {
      from {
        opacity: 0;
        transform: translateY(-20px);
      }
      to {
        opacity: 1;
        transform: translateY(0);
      }
    }
    
    .lottery-header {
      display: flex;
      justify-content: space-between;
      align-items: center;
      padding: 1.5rem;
      border-bottom: 1px solid rgba(255, 255, 255, 0.1);
      background: linear-gradient(135deg, rgba(255, 85, 0, 0.1), rgba(255, 85, 0, 0.05));
    }
    
    .lottery-title {
      display: flex;
      align-items: center;
      gap: 0.75rem;
      font-size: 1.4rem;
      font-weight: 600;
      color: #FF5500;
    }
    
    .lottery-title i {
      font-size: 1.6rem;
    }
    
    .close-btn {
      background: none;
      border: none;
      color: #999;
      cursor: pointer;
      width: 2rem;
      height: 2rem;
      border-radius: 50%;
      display: flex;
      align-items: center;
      justify-content: center;
      transition: all 0.2s ease;
    }
    
    .close-btn:hover {
      background-color: rgba(255, 255, 255, 0.1);
      color: white;
    }
    
    .lottery-loading,
    .lottery-error {
      display: flex;
      flex-direction: column;
      align-items: center;
      justify-content: center;
      padding: 3rem;
      text-align: center;
      color: #CCC;
    }
    
    .loading-spinner {
      width: 2rem;
      height: 2rem;
      border: 3px solid rgba(255, 85, 0, 0.3);
      border-top-color: #FF5500;
      border-radius: 50%;
      animation: spin 1s linear infinite;
      margin-bottom: 1rem;
    }
    
    @keyframes spin {
      to { transform: rotate(360deg); }
    }
    
    .lottery-info {
      padding: 1.5rem;
      border-bottom: 1px solid rgba(255, 255, 255, 0.1);
    }
    
    .lottery-stats {
      display: grid;
      grid-template-columns: repeat(auto-fit, minmax(160px, 1fr));
      gap: 1rem;
    }
    
    .stat-item {
      background-color: rgba(255, 85, 0, 0.1);
      border: 1px solid rgba(255, 85, 0, 0.2);
      border-radius: 8px;
      padding: 1rem;
      text-align: center;
    }
    
    .stat-label {
      display: block;
      font-size: 0.8rem;
      color: #AAA;
      margin-bottom: 0.5rem;
    }
    
    .stat-value {
      display: block;
      font-size: 1.2rem;
      font-weight: 600;
      color: #FF5500;
    }
    
    .number-selection {
      padding: 1.5rem;
      border-bottom: 1px solid rgba(255, 255, 255, 0.1);
    }
    
    .selection-header {
      display: flex;
      justify-content: space-between;
      align-items: center;
      margin-bottom: 1.5rem;
    }
    
    .selection-header h3 {
      margin: 0;
      color: white;
      font-size: 1.1rem;
    }
    
    .selection-controls {
      display: flex;
      gap: 0.5rem;
    }
    
    .auto-btn,
    .clear-btn {
      background-color: rgba(255, 255, 255, 0.1);
      color: #CCC;
      border: 1px solid rgba(255, 255, 255, 0.2);
      border-radius: 6px;
      padding: 0.4rem 0.8rem;
      font-size: 0.8rem;
      cursor: pointer;
      display: flex;
      align-items: center;
      gap: 0.4rem;
      transition: all 0.2s ease;
    }
    
    .auto-btn:hover {
      background-color: rgba(255, 85, 0, 0.2);
      color: #FF5500;
      border-color: rgba(255, 85, 0, 0.4);
    }
    
    .clear-btn:hover {
      background-color: rgba(255, 68, 68, 0.2);
      color: #ff9999;
      border-color: rgba(255, 68, 68, 0.4);
    }
    
    .selected-numbers {
      display: flex;
      align-items: center;
      gap: 1rem;
      margin-bottom: 1.5rem;
      padding: 1rem;
      background-color: rgba(0, 0, 0, 0.2);
      border-radius: 8px;
    }
    
    .selected-label {
      font-weight: 600;
      color: #CCC;
      min-width: 70px;
    }
    
    .selected-balls {
      display: flex;
      gap: 0.5rem;
      flex-wrap: wrap;
    }
    
    .digit-ball {
      width: 3rem;
      height: 3rem;
      border-radius: 12px;
      display: flex;
      align-items: center;
      justify-content: center;
      font-weight: 700;
      font-size: 1.2rem;
      transition: all 0.2s ease;
      border: 2px solid;
    }
    
    .digit-ball.filled {
      background-color: #FF5500;
      color: white;
      border-color: #FF7733;
    }
    
    .digit-ball.empty {
      background-color: rgba(255, 255, 255, 0.1);
      color: #666;
      border-color: rgba(255, 255, 255, 0.2);
      border-style: dashed;
    }
    
    .digit-selection {
      display: grid;
      grid-template-columns: repeat(2, 1fr);
      gap: 1.5rem;
      margin-top: 1.5rem;
    }
    
    .digit-position {
      background-color: rgba(0, 0, 0, 0.2);
      border-radius: 8px;
      padding: 1rem;
    }
    
    .digit-position h4 {
      margin: 0 0 0.75rem 0;
      color: #FF5500;
      font-size: 0.9rem;
      text-align: center;
    }
    
    .digits-grid {
      display: grid;
      grid-template-columns: repeat(5, 1fr);
      gap: 0.5rem;
    }
    
    .digit-btn {
      width: 100%;
      aspect-ratio: 1;
      background-color: rgba(255, 255, 255, 0.1);
      color: white;
      border: 1px solid rgba(255, 255, 255, 0.2);
      border-radius: 8px;
      font-weight: 600;
      cursor: pointer;
      transition: all 0.2s ease;
      display: flex;
      align-items: center;
      justify-content: center;
      font-size: 1rem;
    }
    
    .digit-btn:hover:not(.selected) {
      background-color: rgba(255, 85, 0, 0.3);
      border-color: rgba(255, 85, 0, 0.5);
    }
    
    .digit-btn.selected {
      background-color: #FF5500;
      border-color: #FF7733;
      color: white;
    }
    
    .ticket-preview {
      text-align: center;
      margin-top: 0.5rem;
      font-family: monospace;
      font-size: 1.1rem;
      color: #FF5500;
      font-weight: 600;
    }
    
    .auto-selection-notice {
      display: flex;
      flex-direction: column;
      align-items: center;
      justify-content: center;
      padding: 2rem;
      text-align: center;
      color: #AAA;
      background-color: rgba(255, 85, 0, 0.05);
      border-radius: 8px;
      border: 1px dashed rgba(255, 85, 0, 0.2);
    }
    
    .auto-selection-notice i {
      font-size: 2rem;
      color: #FF5500;
      margin-bottom: 1rem;
    }
    
    .purchase-section {
      padding: 1.5rem;
    }
    
    .cost-display {
      margin-bottom: 1.5rem;
    }
    
    .cost-breakdown {
      display: flex;
      justify-content: space-between;
      align-items: center;
      margin-bottom: 0.5rem;
    }
    
    .cost-label {
      font-size: 1.1rem;
      color: #CCC;
    }
    
    .cost-value {
      font-size: 1.2rem;
      font-weight: 600;
      color: #FF5500;
    }
    
    .cost-note {
      display: flex;
      align-items: center;
      gap: 0.5rem;
      font-size: 0.8rem;
      color: #999;
    }
    
    .purchase-actions {
      display: flex;
      gap: 1rem;
    }
    
    .cancel-btn,
    .buy-btn {
      flex: 1;
      padding: 0.8rem 1.5rem;
      border-radius: 8px;
      font-weight: 600;
      cursor: pointer;
      transition: all 0.2s ease;
      display: flex;
      align-items: center;
      justify-content: center;
      gap: 0.5rem;
      border: none;
    }
    
    .cancel-btn {
      background-color: rgba(255, 255, 255, 0.1);
      color: #CCC;
    }
    
    .cancel-btn:hover:not(:disabled) {
      background-color: rgba(255, 255, 255, 0.2);
      color: white;
    }
    
    .buy-btn {
      background-color: #FF5500;
      color: white;
    }
    
    .buy-btn:hover:not(:disabled) {
      background-color: #FF7733;
    }
    
    .buy-btn:disabled,
    .cancel-btn:disabled {
      opacity: 0.5;
      cursor: not-allowed;
    }
    
    .btn-spinner {
      width: 1rem;
      height: 1rem;
      border: 2px solid rgba(255, 255, 255, 0.3);
      border-top-color: white;
      border-radius: 50%;
      animation: spin 1s linear infinite;
    }
    
    .retry-btn {
      background-color: #FF5500;
      color: white;
      border: none;
      border-radius: 6px;
      padding: 0.6rem 1.2rem;
      cursor: pointer;
      display: flex;
      align-items: center;
      gap: 0.5rem;
      margin-top: 1rem;
    }
    
    .retry-btn:hover {
      background-color: #FF7733;
    }
    
    /* Responsive */
    @media (max-width: 768px) {
      .lottery-modal {
        margin: 0.5rem;
        max-width: none;
      }
      
      .selection-header {
        flex-direction: column;
        gap: 1rem;
        align-items: stretch;
      }
      
      .digit-selection {
        grid-template-columns: 1fr;
      }
      
      .digits-grid {
        grid-template-columns: repeat(5, 1fr);
      }
      
      .lottery-stats {
        grid-template-columns: 1fr;
      }
      
      .purchase-actions {
        flex-direction: column;
      }
    }
  </style>