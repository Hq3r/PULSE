<!-- StealthAddressUI.svelte - Enhanced anonymous mode with original creator verification -->
<script>
  import { createEventDispatcher, onMount } from 'svelte';
  import { slide, fade } from 'svelte/transition';
  import { createToastMessage } from '$lib/utils/chatConstants.js';
  import { stealthAddressManager } from '$lib/utils/SimpleStealthAddress.js';
  
  const dispatch = createEventDispatcher();
  
  // Props
  export let walletConnected = false;
  export let currentAddress = '';
  
  // Smart contract address for checking duplicates
  const CHAT_CONTRACT = 'BhRz5Qd2jtgTdaKPewYd4EjSquVegcmgxkqumH4GioKABQAGxofYfLiMCzy3EbFYFTBvHgnw94LkPa8NtPsv';
  
  // State
  let showStealthPanel = false;
  let stealthAddress = null;
  let isAnonymous = false;
  let showCreateModal = false;
  let isCheckingDuplicate = false;
  
  // Form data
  let customName = '';
  let useCustomName = false;
  let addressAge = 0;
  let nameCheckStatus = null; // 'checking', 'available', 'taken', 'owned_by_user', null
  let originalCreatorCheck = null; // Store original creator info
  
  onMount(async () => {
    await loadExistingStealthAddress();
    updateAddressStatus();
    
    // Check address age every minute
    const interval = setInterval(updateAddressStatus, 60000);
    return () => clearInterval(interval);
  });
  
  async function loadExistingStealthAddress() {
    try {
      const existing = stealthAddressManager.loadStealthAddress();
      if (existing) {
        stealthAddress = existing;
        isAnonymous = true;
        dispatch('stealthModeChanged', {
          active: true,
          address: stealthAddress.address,
          displayName: stealthAddress.displayName
        });
      }
    } catch (error) {
      console.error('Error loading stealth address:', error);
    }
  }
  
  function updateAddressStatus() {
    if (stealthAddress) {
      addressAge = stealthAddressManager.getAddressAge();
    }
  }

  // Function to decode hex message from blockchain
  function decodeHexMessage(hex) {
    try {
      if (!hex || typeof hex !== 'string') {
        return String(hex);
      }
      
      if (/^[0-9A-Fa-f]+$/.test(hex)) {
        if (hex.startsWith('0e')) {
          hex = hex.substring(4);
          const bytes = [];
          for (let i = 0; i < hex.length; i += 2) {
            bytes.push(parseInt(hex.substring(i, i + 2), 16));
          }
          return new TextDecoder('utf-8').decode(new Uint8Array(bytes));
        }
      }
      
      return hex;
    } catch (e) {
      return String(hex);
    }
  }

  // Clean address helper function
  function cleanAddress(address) {
    if (!address) return '';
    if (address.startsWith('3') && address.length > 50) {
      return address.substring(1);
    }
    return address;
  }

  // Enhanced function to check name availability with original creator verification
  async function checkNameAvailability(name) {
    if (!name || !name.trim()) {
      nameCheckStatus = null;
      originalCreatorCheck = null;
      return false;
    }

    const trimmedName = name.trim();
    
    // Basic validation first
    if (trimmedName.startsWith('9')) {
      nameCheckStatus = 'invalid';
      originalCreatorCheck = null;
      return false;
    }

    nameCheckStatus = 'checking';
    isCheckingDuplicate = true;
    originalCreatorCheck = null;

    try {
      // Get current user's clean address
      const currentUserAddress = cleanAddress(currentAddress);
      
      // Fetch transactions from the chat contract to find stealth name usage
      const response = await fetch(`https://api.ergoplatform.com/api/v1/boxes/byAddress/${CHAT_CONTRACT}?limit=200`);
      
      if (!response.ok) {
        throw new Error(`API error: ${response.status}`);
      }

      const data = await response.json();
      const nameUsages = [];

      // Process each box to find stealth name usage
      for (const box of data.items) {
        if (box.additionalRegisters && box.additionalRegisters.R4) {
          try {
            let senderRaw = '';
            if (typeof box.additionalRegisters.R4 === 'string') {
              senderRaw = box.additionalRegisters.R4;
            } else if (box.additionalRegisters.R4.serializedValue) {
              senderRaw = box.additionalRegisters.R4.serializedValue;
            } else if (box.additionalRegisters.R4.renderedValue) {
              senderRaw = box.additionalRegisters.R4.renderedValue;
            }

            const decodedSender = decodeHexMessage(senderRaw);
            
            // Check if this matches our target stealth name
            if (decodedSender && decodedSender.toLowerCase() === trimmedName.toLowerCase()) {
              // Found a usage of this name - now get the transaction to find the original creator
              const txInfo = await getTransactionDetails(box.transactionId);
              if (txInfo && txInfo.firstInputAddress) {
                nameUsages.push({
                  txId: box.transactionId,
                  boxId: box.boxId,
                  stealthName: decodedSender,
                  originalCreator: cleanAddress(txInfo.firstInputAddress),
                  timestamp: box.additionalRegisters.R6 ? 
                    (typeof box.additionalRegisters.R6 === 'number' ? 
                      box.additionalRegisters.R6 : 
                      parseInt(box.additionalRegisters.R6.renderedValue || box.additionalRegisters.R6.serializedValue || box.additionalRegisters.R6)
                    ) : Date.now() / 1000
                });
              }
            }
          } catch (e) {
            // Skip if can't decode
            continue;
          }
        }
      }

      if (nameUsages.length === 0) {
        // Name is available - no one has used it
        nameCheckStatus = 'available';
        originalCreatorCheck = null;
        return true;
      } else {
        // Name has been used - find the original creator (earliest usage)
        const sortedUsages = nameUsages.sort((a, b) => a.timestamp - b.timestamp);
        const originalUsage = sortedUsages[0];
        
        originalCreatorCheck = {
          originalCreator: originalUsage.originalCreator,
          firstUsedTxId: originalUsage.txId,
          firstUsedTimestamp: originalUsage.timestamp,
          totalUsages: nameUsages.length
        };

        // Check if current user is the original creator
        if (originalUsage.originalCreator === currentUserAddress) {
          nameCheckStatus = 'owned_by_user';
          return true; // User can reuse their own stealth name
        } else {
          nameCheckStatus = 'taken';
          return false; // Name is taken by someone else
        }
      }

    } catch (error) {
      console.error('Error checking name availability:', error);
      nameCheckStatus = 'error';
      originalCreatorCheck = null;
      createToastMessage('Error checking name availability. Please try again.', 'error');
      return false;
    } finally {
      isCheckingDuplicate = false;
    }
  }

  // Get transaction details to find the first input address (original creator)
  async function getTransactionDetails(txId) {
    try {
      const response = await fetch(`https://api.ergoplatform.com/api/v1/transactions/${txId}`);
      
      if (!response.ok) {
        console.warn(`Could not fetch transaction ${txId}: ${response.status}`);
        return null;
      }

      const txData = await response.json();
      
      if (txData.inputs && txData.inputs.length > 0) {
        // Get the first input's address - this is the original sender
        const firstInput = txData.inputs[0];
        
        if (firstInput.address) {
          return {
            firstInputAddress: firstInput.address,
            inputsCount: txData.inputs.length,
            outputsCount: txData.outputs.length
          };
        }
      }

      return null;
    } catch (error) {
      console.error(`Error fetching transaction details for ${txId}:`, error);
      return null;
    }
  }

  // Debounce function for name checking
  let nameCheckTimeout;
  function debouncedNameCheck(name) {
    clearTimeout(nameCheckTimeout);
    nameCheckTimeout = setTimeout(() => {
      checkNameAvailability(name);
    }, 500); // Wait 500ms after user stops typing
  }

  // Handle name input changes
  function handleNameInput() {
    if (useCustomName && customName.trim()) {
      debouncedNameCheck(customName);
    } else {
      nameCheckStatus = null;
      originalCreatorCheck = null;
    }
  }
  
  async function generateStealthAddress() {
    try {
      if (!walletConnected) {
        createToastMessage('Please connect your wallet first', 'error');
        return;
      }
      
      // Validate custom name if provided
      if (useCustomName && customName.trim()) {
        const trimmedName = customName.trim();
        
        if (trimmedName.startsWith('9')) {
          createToastMessage('Custom names cannot start with "9"', 'error');
          return;
        }

        // Check if name is available or owned by user (do a final check)
        const isUsable = await checkNameAvailability(trimmedName);
        if (!isUsable) {
          if (nameCheckStatus === 'taken') {
            createToastMessage(
              `This name is already taken by another user. First used by: ${originalCreatorCheck?.originalCreator?.substring(0, 10)}...`, 
              'error'
            );
          } else {
            createToastMessage('Unable to verify name availability. Please try again.', 'error');
          }
          return;
        }
      }
      
      // Generate with custom name if provided
      const displayName = useCustomName && customName.trim() ?
        customName.trim() :
        stealthAddressManager.generateDisplayName();
      
      stealthAddress = stealthAddressManager.generateStealthAddress(currentAddress);
      stealthAddress.displayName = displayName; // Override with custom name
      isAnonymous = true;
      
      // Save updated address
      stealthAddressManager.saveStealthAddress();

      // Show appropriate success message
      let successMessage = `🎭 Anonymous mode activated: ${displayName}`;
      if (nameCheckStatus === 'owned_by_user') {
        successMessage += ` (reusing your stealth name)`;
      }
      
      createToastMessage(successMessage, 'success');
      
      dispatch('stealthModeChanged', {
        active: true,
        address: stealthAddress.address,
        displayName: displayName
      });
      
      showCreateModal = false;
      customName = '';
      useCustomName = false;
      nameCheckStatus = null;
      originalCreatorCheck = null;
      
    } catch (error) {
      console.error('Error generating stealth address:', error);
      createToastMessage('Failed to generate stealth identity', 'error');
    }
  }
  
  function deactivateStealthMode() {
    stealthAddressManager.deactivateStealthAddress();
    stealthAddress = null;
    isAnonymous = false;
    
    dispatch('stealthModeChanged', { active: false });
    createToastMessage('👋 Anonymous mode deactivated', 'info');
  }
  
  function renewStealthAddress() {
    // Keep same custom name if user had one
    const currentName = stealthAddress?.displayName;
    const isCustom = currentName && !currentName.match(/^(Silent|Hidden|Shadow|Ghost|Phantom|Invisible|Secret|Anonymous|Stealth|Masked)(Walker|Sender|User|Agent|Messenger|Trader|Builder|Node|Voyager|Explorer)\d+$/);
    
    if (isCustom) {
      customName = currentName;
      useCustomName = true;
    }
    
    generateStealthAddress();
    createToastMessage('🔄 Anonymous identity renewed', 'success');
  }
  
  function toggleStealthPanel() {
    showStealthPanel = !showStealthPanel;
  }

  // Close panel when clicking outside
  function handlePanelBackdropClick() {
    showStealthPanel = false;
  }

  // Get status message for name check
  function getNameCheckMessage() {
    switch(nameCheckStatus) {
      case 'available':
        return 'Name is available!';
      case 'taken':
        return `Name taken by ${originalCreatorCheck?.originalCreator?.substring(0, 10)}...`;
      case 'owned_by_user':
        return 'You can reuse this name (you created it)';
      case 'error':
        return 'Unable to check availability';
      case 'invalid':
        return 'Names cannot start with "9"';
      default:
        return '';
    }
  }
</script>

<!-- Stealth Toggle Button -->
<div class="stealth-toggle-container">
  <button
    class="stealth-toggle-btn {isAnonymous ? 'active' : ''}"
    on:click={toggleStealthPanel}
    title="Anonymous Mode"
  >
    <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
      <path d="M20 9V7a2 2 0 0 0-2-2H6a2 2 0 0 0-2 2v2"/>
      <path d="M12 1v6"/>
      <path d="M12 19v4"/>
      <path d="M5 9v10a2 2 0 0 0 2 2h10a2 2 0 0 0 2-2V9"/>
      <circle cx="12" cy="12" r="3"/>
    </svg>
    <span class="toggle-label">Anonymous</span>
    {#if isAnonymous}
      <span class="active-dot">●</span>
    {/if}
  </button>
</div>

<!-- Stealth Panel Overlay -->
{#if showStealthPanel}
  <div 
    class="stealth-panel-overlay" 
    on:click|self={handlePanelBackdropClick}
    transition:fade={{ duration: 200 }}
  >
    <div class="stealth-panel" transition:slide={{ duration: 250 }}>
      <div class="stealth-header">
        <h3>
          <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
            <path d="M20 9V7a2 2 0 0 0-2-2H6a2 2 0 0 0-2 2v2"/>
            <path d="M12 1v6"/>
            <path d="M12 19v4"/>
            <path d="M5 9v10a2 2 0 0 0 2 2h10a2 2 0 0 0 2-2V9"/>
            <circle cx="12" cy="12" r="3"/>
          </svg>
          Anonymous Mode
        </h3>
        <button class="close-btn" on:click={() => showStealthPanel = false}>
          <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
            <line x1="18" y1="6" x2="6" y2="18"/>
            <line x1="6" y1="6" x2="18" y2="18"/>
          </svg>
        </button>
      </div>
      
      {#if !isAnonymous}
        <!-- Not in anonymous mode -->
        <div class="stealth-intro">
          <div class="intro-text">
            <p>Chat anonymously with a temporary identity. Your messages will show a custom name instead of your wallet address.</p>
          </div>
          
          <button
            class="generate-btn"
            on:click={() => showCreateModal = true}
            disabled={!walletConnected}
          >
            <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
              <path d="M20 9V7a2 2 0 0 0-2-2H6a2 2 0 0 0-2 2v2"/>
              <path d="M12 1v6"/>
              <path d="M12 19v4"/>
              <path d="M5 9v10a2 2 0 0 0 2 2h10a2 2 0 0 0 2-2V9"/>
              <circle cx="12" cy="12" r="3"/>
            </svg>
            Go Anonymous
          </button>
        </div>
      {:else}
        <!-- Active anonymous mode -->
        <div class="stealth-active">
          <div class="active-status">
            <div class="status-badge">
              <svg width="16" height="16" viewBox="0 0 24 24" fill="currentColor">
                <path d="M20 9V7a2 2 0 0 0-2-2H6a2 2 0 0 0-2 2v2"/>
                <path d="M12 1v6"/>
                <path d="M12 19v4"/>
                <path d="M5 9v10a2 2 0 0 0 2 2h10a2 2 0 0 0 2-2V9"/>
                <circle cx="12" cy="12" r="3"/>
              </svg>
              <span>Anonymous as <strong>{stealthAddress.displayName}</strong></span>
            </div>
            
            <div class="age-info">
              Active for {addressAge} hours
            </div>
          </div>
          
          <div class="stealth-actions">
            <button class="action-btn renew-btn" on:click={renewStealthAddress}>
              <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                <path d="M3 12a9 9 0 0 1 9-9 9.75 9.75 0 0 1 6.74 2.74L21 8"/>
                <path d="M21 3v5h-5"/>
                <path d="M21 12a9 9 0 0 1-9 9 9.75 9.75 0 0 1-6.74-2.74L3 16"/>
                <path d="M8 16l-5 5v-5h5"/>
              </svg>
              New Identity
            </button>
            
            <button class="action-btn deactivate-btn" on:click={deactivateStealthMode}>
              <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                <line x1="18" y1="6" x2="6" y2="18"/>
                <line x1="6" y1="6" x2="18" y2="18"/>
              </svg>
              Deactivate
            </button>
          </div>
        </div>
      {/if}
    </div>
  </div>
{/if}

<!-- Create Modal -->
{#if showCreateModal}
  <div class="modal-overlay" on:click|self={() => showCreateModal = false} transition:fade={{ duration: 200 }}>
    <div class="stealth-modal">
      <div class="modal-header">
        <h3>
          <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
            <path d="M20 9V7a2 2 0 0 0-2-2H6a2 2 0 0 0-2 2v2"/>
            <path d="M12 1v6"/>
            <path d="M12 19v4"/>
            <path d="M5 9v10a2 2 0 0 0 2 2h10a2 2 0 0 0 2-2V9"/>
            <circle cx="12" cy="12" r="3"/>
          </svg>
          Create Anonymous Identity
        </h3>
        <button class="close-btn" on:click={() => showCreateModal = false}>
          <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
            <line x1="18" y1="6" x2="6" y2="18"/>
            <line x1="6" y1="6" x2="18" y2="18"/>
          </svg>
        </button>
      </div>
      
      <div class="modal-body">
        <div class="option-group">
          <label class="radio-label">
            <input
              type="radio"
              bind:group={useCustomName}
              value={false}
              name="nameType"
            />
            <span>Auto-generate name</span>
          </label>
          <small>Random anonymous name like "ShadowTrader42" (cannot start with "9")</small>
        </div>
        
        <div class="option-group">
          <label class="radio-label">
            <input
              type="radio"
              bind:group={useCustomName}
              value={true}
              name="nameType"
            />
            <span>Custom name</span>
          </label>
          
          {#if useCustomName}
            <div class="custom-input" transition:slide={{ duration: 200 }}>
              <div class="name-input-container">
                <input
                  type="text"
                  bind:value={customName}
                  on:input={handleNameInput}
                  placeholder="Enter your anonymous name..."
                  maxlength="20"
                  class="name-input {nameCheckStatus === 'taken' || customName.trim().startsWith('9') ? 'invalid' : (nameCheckStatus === 'available' || nameCheckStatus === 'owned_by_user') ? 'valid' : ''}"
                />
                {#if isCheckingDuplicate}
                  <div class="checking-spinner">
                    <div class="spinner small"></div>
                  </div>
                {:else if nameCheckStatus === 'available'}
                  <div class="check-icon available">
                    <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                      <polyline points="20,6 9,17 4,12"/>
                    </svg>
                  </div>
                {:else if nameCheckStatus === 'owned_by_user'}
                  <div class="check-icon owned">
                    <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                      <path d="M2.5 3A1.5 1.5 0 0 0 1 4.5v.793c.026.009.051.02.076.032L7.674 8.51c.206.1.446.1.652 0l6.598-3.185A.755.755 0 0 1 15 5.293V4.5A1.5 1.5 0 0 0 13.5 3h-11Z"/>
                      <path d="M15 6.954 8.978 9.86a2.25 2.25 0 0 1-1.956 0L1 6.954V11.5A1.5 1.5 0 0 0 2.5 13h11a1.5 1.5 0 0 0 1.5-1.5V6.954Z"/>
                    </svg>
                  </div>
                {:else if nameCheckStatus === 'taken'}
                  <div class="check-icon taken">
                    <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                      <line x1="18" y1="6" x2="6" y2="18"/>
                      <line x1="6" y1="6" x2="18" y2="18"/>
                    </svg>
                  </div>
                {/if}
              </div>
              
              {#if customName.trim().startsWith('9')}
                <div class="validation-error">
                  <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                    <path d="m21.73 18-8-14a2 2 0 0 0-3.48 0l-8 14A2 2 0 0 0 4 21h16a2 2 0 0 0 1.73-3Z"/>
                    <line x1="12" y1="9" x2="12" y2="13"/>
                    <line x1="12" y1="17" x2="12.01" y2="17"/>
                  </svg>
                  Names cannot start with "9"
                </div>
              {:else if nameCheckStatus === 'taken'}
                <div class="validation-error">
                  <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                    <circle cx="12" cy="12" r="10"/>
                    <line x1="15" y1="9" x2="9" y2="15"/>
                    <line x1="9" y1="9" x2="15" y2="15"/>
                  </svg>
                  {getNameCheckMessage()}
                  {#if originalCreatorCheck}
                    <div class="creator-info">
                      First used {new Date(originalCreatorCheck.firstUsedTimestamp * 1000).toLocaleDateString()}
                    </div>
                  {/if}
                </div>
              {:else if nameCheckStatus === 'available'}
                <div class="validation-success">
                  <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                    <path d="M22 11.08V12a10 10 0 1 1-5.93-9.14"/>
                    <polyline points="22,4 12,14.01 9,11.01"/>
                  </svg>
                  {getNameCheckMessage()}
                </div>
              {:else if nameCheckStatus === 'owned_by_user'}
                <div class="validation-owned">
                  <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                    <path d="M2.5 3A1.5 1.5 0 0 0 1 4.5v.793c.026.009.051.02.076.032L7.674 8.51c.206.1.446.1.652 0l6.598-3.185A.755.755 0 0 1 15 5.293V4.5A1.5 1.5 0 0 0 13.5 3h-11Z"/>
                    <path d="M15 6.954 8.978 9.86a2.25 2.25 0 0 1-1.956 0L1 6.954V11.5A1.5 1.5 0 0 0 2.5 13h11a1.5 1.5 0 0 0 1.5-1.5V6.954Z"/>
                  </svg>
                  {getNameCheckMessage()}
                  {#if originalCreatorCheck}
                    <div class="ownership-info">
                      You first used this name on {new Date(originalCreatorCheck.firstUsedTimestamp * 1000).toLocaleDateString()}
                    </div>
                  {/if}
                </div>
              {:else if nameCheckStatus === 'error'}
                <div class="validation-warning">
                  <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                    <path d="m21.73 18-8-14a2 2 0 0 0-3.48 0l-8 14A2 2 0 0 0 4 21h16a2 2 0 0 0 1.73-3Z"/>
                    <line x1="12" y1="9" x2="12" y2="13"/>
                    <line x1="12" y1="17" x2="12.01" y2="17"/>
                  </svg>
                  {getNameCheckMessage()}
                </div>
              {/if}
            </div>
          {/if}
        </div>
      </div>
      
      <div class="modal-footer">
        <button class="cancel-btn" on:click={() => showCreateModal = false}>
          Cancel
        </button>
        <button
          class="create-btn"
          on:click={generateStealthAddress}
          disabled={useCustomName && !customName.trim() || (useCustomName && nameCheckStatus === 'taken')}
        >
          <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
            <path d="M12 2L2 7l10 5 10-5-10-5z"/>
            <path d="M2 17l10 5 10-5"/>
            <path d="M2 12l10 5 10-5"/>
          </svg>
          {nameCheckStatus === 'owned_by_user' ? 'Reuse Identity' : 'Create Identity'}
        </button>
      </div>
    </div>
  </div>
{/if}

<style>
  .stealth-toggle-container {
    display: inline-block;
    position: relative;
  }
  
  .stealth-toggle-btn {
    display: flex;
    align-items: center;
    gap: var(--space-xs);
    background: var(--ergo-orange-alpha);
    color: var(--ergo-orange);
    border: 1px solid rgba(255, 85, 0, 0.3);
    border-radius: var(--radius-md);
    padding: var(--space-sm) var(--space-md);
    cursor: pointer;
    transition: all var(--transition-fast);
    font-size: 0.875rem;
    font-weight: 500;
    position: relative;
  }
  
  .stealth-toggle-btn:hover,
  .stealth-toggle-btn.active {
    background: rgba(255, 85, 0, 0.2);
    transform: translateY(-1px);
  }
  
  .active-dot {
    position: absolute;
    top: -0.25rem;
    right: -0.25rem;
    color: var(--success);
    font-size: 0.8rem;
    animation: pulse 2s infinite;
  }
  
  @keyframes pulse {
    0%, 100% { opacity: 1; }
    50% { opacity: 0.5; }
  }

  .stealth-panel-overlay {
    position: fixed;
    top: 0;
    left: 0;
    right: 0;
    bottom: 0;
    
    backdrop-filter: blur(8px);
    display: flex;
    align-items: center;
    justify-content: center;
    z-index: 1000;
    padding: var(--space-lg);
  }
  
  .stealth-panel {
    background: var(--surface-elevated) !important;
    border-radius: var(--radius-xl) !important;
    padding: var(--space-xl) !important;
    border: 2px solid var(--ergo-orange) !important;
    box-shadow: var(--shadow-xl) !important;
    width: 100% !important;
    max-width: 450px !important;
    max-height: 90vh !important;
    overflow-y: auto !important;
    margin: auto !important;
    position: relative !important;
    transform: translateY(0) !important;
  }
  
  .stealth-header {
    display: flex;
    justify-content: space-between;
    align-items: center;
    margin-bottom: var(--space-lg);
    padding-bottom: var(--space-md);
    border-bottom: 1px solid var(--ergo-orange);
  }
  
  .stealth-header h3 {
    margin: 0;
    color: var(--ergo-orange);
    display: flex;
    align-items: center;
    gap: var(--space-sm);
    font-size: 1.125rem;
    font-weight: 600;
  }
  
  .close-btn {
    background: var(--surface);
    border: 1px solid var(--border);
    color: var(--text-secondary);
    cursor: pointer;
    border-radius: 50%;
    transition: all var(--transition-fast);
    width: 32px;
    height: 32px;
    display: flex;
    align-items: center;
    justify-content: center;
  }
  
  .close-btn:hover {
    background: var(--ergo-orange-alpha);
    color: var(--ergo-orange);
    border-color: var(--ergo-orange);
  }
  
  .stealth-intro {
    text-align: center;
  }
  
  .intro-text p {
    margin: 0 0 var(--space-xl) 0;
    color: var(--text-secondary);
    line-height: 1.5;
  }
  
  .generate-btn {
    background: linear-gradient(135deg, var(--ergo-orange), var(--ergo-orange-light));
    color: white;
    border: none;
    border-radius: var(--radius-lg);
    padding: var(--space-md) var(--space-xl);
    cursor: pointer;
    font-weight: 600;
    display: flex;
    align-items: center;
    gap: var(--space-sm);
    margin: 0 auto;
    transition: all var(--transition-fast);
    box-shadow: var(--shadow-md);
  }
  
  .generate-btn:hover:not(:disabled) {
    transform: translateY(-2px);
    box-shadow: var(--shadow-lg);
  }
  
  .generate-btn:disabled {
    opacity: 0.5;
    cursor: not-allowed;
    transform: none;
  }
  
  .stealth-active {
    display: flex;
    flex-direction: column;
    gap: var(--space-lg);
  }
  
  .active-status {
    text-align: center;
  }
  
  .status-badge {
    background: var(--ergo-orange-alpha);
    border: 1px solid rgba(255, 85, 0, 0.4);
    border-radius: var(--radius-lg);
    padding: var(--space-md);
    display: flex;
    align-items: center;
    justify-content: center;
    gap: var(--space-sm);
    color: var(--ergo-orange);
    margin-bottom: var(--space-sm);
    font-weight: 500;
  }
  
  .status-badge strong {
    color: var(--text-primary);
  }
  
  .age-info {
    font-size: 0.875rem;
    color: var(--text-muted);
  }
  
  .stealth-actions {
    display: flex;
    gap: var(--space-md);
    justify-content: center;
  }
  
  .action-btn {
    display: flex;
    align-items: center;
    gap: var(--space-xs);
    padding: var(--space-sm) var(--space-md);
    border-radius: var(--radius-md);
    cursor: pointer;
    transition: all var(--transition-fast);
    font-size: 0.875rem;
    border: 1px solid;
    font-weight: 500;
  }
  
  .renew-btn {
    background: var(--ergo-orange-alpha);
    color: var(--ergo-orange);
    border-color: rgba(255, 85, 0, 0.4);
  }
  
  .renew-btn:hover {
    background: rgba(255, 85, 0, 0.3);
    transform: translateY(-1px);
  }
  
  .deactivate-btn {
    background: rgba(244, 67, 54, 0.1);
    color: var(--error);
    border-color: rgba(244, 67, 54, 0.4);
  }
  
  .deactivate-btn:hover {
    background: rgba(244, 67, 54, 0.2);
    transform: translateY(-1px);
  }
  
  /* Modal Styles */
  .modal-overlay {
    position: fixed !important;
    top: 0 !important;
    left: 0 !important;
    right: 0 !important;
    bottom: 0 !important;
    width: 100vw !important;
    height: 100vh !important;
    background: rgba(0, 0, 0, 0.8) !important;
    backdrop-filter: blur(8px) !important;
    display: flex !important;
    align-items: center !important;
    justify-content: center !important;
    z-index: 9999 !important;
    padding: var(--space-lg) !important;
    margin: 0 !important;
  }
  
  .stealth-modal {
    background: var(--surface-elevated) !important;
    border-radius: var(--radius-xl) !important;
    width: 100% !important;
    max-width: 400px !important;
    max-height: 90vh !important;
    box-shadow: var(--shadow-xl) !important;
    border: 2px solid var(--ergo-orange) !important;
    margin: auto !important;
    overflow-y: auto !important;
    position: relative !important;
    transform: translateY(0) !important;
  }
  
  .modal-header {
    display: flex;
    justify-content: space-between;
    align-items: center;
    padding: var(--space-lg);
    border-bottom: 1px solid var(--ergo-orange);
  }
  
  .modal-header h3 {
    margin: 0;
    color: var(--ergo-orange);
    display: flex;
    align-items: center;
    gap: var(--space-sm);
    font-size: 1.125rem;
    font-weight: 600;
  }
  
  .modal-body {
    padding: var(--space-lg);
  }
  
  .modal-footer {
    display: flex;
    justify-content: flex-end;
    gap: var(--space-md);
    padding: var(--space-lg);
    border-top: 1px solid var(--border);
  }
  
  .option-group {
    margin-bottom: var(--space-lg);
    padding: var(--space-md);
    border: 1px solid var(--border);
    border-radius: var(--radius-md);
    transition: all var(--transition-fast);
  }
  
  .option-group:hover {
    border-color: var(--ergo-orange);
  }
  
  .radio-label {
    display: flex;
    align-items: center;
    gap: var(--space-sm);
    color: var(--text-primary);
    cursor: pointer;
    font-weight: 500;
    margin-bottom: var(--space-xs);
  }
  
  .radio-label input[type="radio"] {
    margin: 0;
    accent-color: var(--ergo-orange);
  }
  
  .option-group small {
    display: block;
    color: var(--text-muted);
    font-size: 0.8rem;
    margin-top: var(--space-xs);
    margin-left: 1.5rem;
  }
  
  .custom-input {
    margin-top: var(--space-md);
    margin-left: 1.5rem;
  }

  .name-input-container {
    position: relative;
    display: flex;
    align-items: center;
  }
  
  .name-input {
    width: 100%;
    padding: var(--space-sm);
    padding-right: 2.5rem;
    background: var(--surface);
    border: 2px solid var(--border);
    border-radius: var(--radius-md);
    color: var(--text-primary);
    font-size: 0.875rem;
    transition: all var(--transition-fast);
  }
  
  .name-input:focus {
    border-color: var(--ergo-orange);
    outline: none;
    box-shadow: 0 0 0 4px var(--ergo-orange-alpha);
  }

  .name-input.invalid {
    border-color: var(--error);
  }

  .name-input.invalid:focus {
    border-color: var(--error);
    box-shadow: 0 0 0 4px rgba(244, 67, 54, 0.2);
  }

  .name-input.valid {
    border-color: var(--success);
  }

  .name-input.valid:focus {
    border-color: var(--success);
    box-shadow: 0 0 0 4px rgba(76, 175, 80, 0.2);
  }

  .checking-spinner,
  .check-icon {
    position: absolute;
    right: var(--space-sm);
    display: flex;
    align-items: center;
    justify-content: center;
    width: 20px;
    height: 20px;
    pointer-events: none;
  }

  .check-icon.available {
    color: var(--success);
  }

  .check-icon.owned {
    color: #FFD700;
    animation: glow 2s ease-in-out infinite alternate;
  }

  .check-icon.taken {
    color: var(--error);
  }

  @keyframes glow {
    from { filter: drop-shadow(0 0 5px #FFD700); }
    to { filter: drop-shadow(0 0 15px #FFD700); }
  }

  .validation-error {
    display: flex;
    flex-direction: column;
    gap: var(--space-xs);
    color: var(--error);
    font-size: 0.8rem;
    margin-top: var(--space-sm);
  }

  .validation-success {
    display: flex;
    align-items: center;
    gap: var(--space-xs);
    color: var(--success);
    font-size: 0.8rem;
    margin-top: var(--space-sm);
  }

  .validation-owned {
    display: flex;
    flex-direction: column;
    gap: var(--space-xs);
    color: #FFD700;
    font-size: 0.8rem;
    margin-top: var(--space-sm);
  }

  .validation-warning {
    display: flex;
    align-items: center;
    gap: var(--space-xs);
    color: var(--warning);
    font-size: 0.8rem;
    margin-top: var(--space-sm);
  }

  .creator-info,
  .ownership-info {
    font-size: 0.75rem;
    margin-top: var(--space-xs);
    font-style: italic;
  }

  .creator-info {
    color: rgba(244, 67, 54, 0.8);
  }

  .ownership-info {
    color: rgba(255, 215, 0, 0.8);
  }
  
  .cancel-btn {
    background: var(--surface);
    color: var(--text-secondary);
    border: 1px solid var(--border);
    border-radius: var(--radius-md);
    padding: var(--space-sm) var(--space-md);
    cursor: pointer;
    transition: all var(--transition-fast);
  }
  
  .cancel-btn:hover {
    background: var(--surface-elevated);
    color: var(--text-primary);
  }
  
  .create-btn {
    background: linear-gradient(135deg, var(--ergo-orange), var(--ergo-orange-light));
    color: white;
    border: none;
    border-radius: var(--radius-md);
    padding: var(--space-sm) var(--space-md);
    cursor: pointer;
    transition: all var(--transition-fast);
    display: flex;
    align-items: center;
    gap: var(--space-xs);
    font-weight: 600;
  }
  
  .create-btn:hover:not(:disabled) {
    transform: translateY(-1px);
    box-shadow: var(--shadow-md);
  }
  
  .create-btn:disabled {
    opacity: 0.5;
    cursor: not-allowed;
    transform: none;
  }
  
  /* Responsive adjustments */
  @media (max-width: 480px) {
    .stealth-panel {
      max-width: calc(100vw - 2rem) !important;
      margin: 1rem !important;
      max-height: calc(100vh - 2rem) !important;
    }

    .stealth-modal {
      margin: 1rem !important;
      max-width: calc(100vw - 2rem) !important;
      max-height: calc(100vh - 2rem) !important;
    }
    
    .modal-overlay,
    .stealth-panel-overlay {
      padding: 1rem !important;
    }
    
    .modal-footer {
      flex-direction: column;
    }
    
    .cancel-btn,
    .create-btn {
      width: 100%;
      justify-content: center;
    }
    
    .stealth-actions {
      flex-direction: column;
    }
  }
</style>