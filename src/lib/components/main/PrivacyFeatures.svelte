<!-- PrivacyFeatures.svelte - UI component for ErgoMixer privacy integration -->
<script lang="ts">
    import { createEventDispatcher, onMount } from 'svelte';
    import { slide, fade } from 'svelte/transition';
    import { showCustomToast } from '$lib/utils/utils';
    import { privacyManager } from './ErgoPrivacyManager.js';
    
    const dispatch = createEventDispatcher();
    
    // Props
    export let walletConnected = false;
    export let currentAddress = '';
    export let showPrivacyPanel = false;
    
    // Privacy state
    let privacySettings = {
      anonymousMode: false,
      encryptionLevel: 'medium', // none, basic, medium, high
      mixLevel: 1, // 1-3
      stealthMode: false,
      autoMix: false
    };
    
    let mixingStatus = {
      isActive: false,
      progress: 0,
      message: '',
      txId: null
    };
    
    let stealthAddress = null;
    let privacyBalance = {
      mixed: 0,
      unmixed: 0,
      pending: 0
    };
    
    let privacyFeesEstimate = {};
    let showMixingModal = false;
    let showStealthModal = false;
    let showPrivacySettings = false;
    
    // Mixing form data
    let mixingForm = {
      amount: '',
      tokenId: 'ERG',
      mixLevel: 1,
      targetAddress: ''
    };
    
    // Anonymous messaging
    let anonymousIdentity = null;
    let isAnonymousSession = false;
    
    onMount(async () => {
      await loadPrivacySettings();
      await updatePrivacyBalance();
      await loadPrivacyFees();
      
      if (privacySettings.anonymousMode) {
        await initializeAnonymousMode();
      }
    });
    
    async function loadPrivacySettings() {
      try {
        const stored = localStorage.getItem('ergoChat_privacySettings');
        if (stored) {
          privacySettings = { ...privacySettings, ...JSON.parse(stored) };
        }
      } catch (error) {
        console.error('Error loading privacy settings:', error);
      }
    }
    
    async function savePrivacySettings() {
      try {
        localStorage.setItem('ergoChat_privacySettings', JSON.stringify(privacySettings));
        showCustomToast('Privacy settings saved', 2000, 'success');
      } catch (error) {
        console.error('Error saving privacy settings:', error);
      }
    }
    
    async function updatePrivacyBalance() {
      if (!walletConnected) return;
      
      try {
        // This would call actual blockchain APIs to get mixed/unmixed balance
        // For now, showing placeholder values
        privacyBalance = {
          mixed: 0.5,     // Amount in mixed state
          unmixed: 2.3,   // Amount in unmixed state  
          pending: 0.1    // Amount being mixed
        };
      } catch (error) {
        console.error('Error updating privacy balance:', error);
      }
    }
    
    async function loadPrivacyFees() {
      try {
        privacyFeesEstimate = privacyManager.getPrivacyFees();
      } catch (error) {
        console.error('Error loading privacy fees:', error);
      }
    }
    
    async function initializeAnonymousMode() {
      try {
        if (!anonymousIdentity) {
          anonymousIdentity = privacyManager.generateEphemeralIdentity();
          stealthAddress = await privacyManager.generateStealthAddress(
            anonymousIdentity.publicKey,
            'chat_session'
          );
          isAnonymousSession = true;
          
          showCustomToast('Anonymous mode activated', 3000, 'success');
          dispatch('anonymousModeChanged', { active: true, identity: anonymousIdentity });
        }
      } catch (error) {
        console.error('Error initializing anonymous mode:', error);
        showCustomToast('Failed to activate anonymous mode', 3000, 'error');
      }
    }
    
    async function deactivateAnonymousMode() {
      try {
        anonymousIdentity = null;
        stealthAddress = null;
        isAnonymousSession = false;
        privacySettings.anonymousMode = false;
        
        await savePrivacySettings();
        showCustomToast('Anonymous mode deactivated', 3000, 'info');
        dispatch('anonymousModeChanged', { active: false });
      } catch (error) {
        console.error('Error deactivating anonymous mode:', error);
      }
    }
    
    async function startMixing() {
      if (!walletConnected) {
        showCustomToast('Please connect your wallet first', 3000, 'warning');
        return;
      }
      
      try {
        // Validate inputs
        const amount = parseFloat(mixingForm.amount);
        if (isNaN(amount) || amount <= 0) {
          showCustomToast('Please enter a valid amount', 3000, 'error');
          return;
        }
        
        privacyManager.validatePrivacySettings({
          mixLevel: mixingForm.mixLevel,
          amount: amount,
          tokenId: mixingForm.tokenId
        });
        
        mixingStatus.isActive = true;
        mixingStatus.progress = 0;
        mixingStatus.message = 'Preparing mixing transaction...';
        
        // Simulate mixing progress
        const progressInterval = setInterval(() => {
          mixingStatus.progress += Math.random() * 20;
          if (mixingStatus.progress >= 100) {
            mixingStatus.progress = 100;
            mixingStatus.message = 'Mixing completed successfully!';
            mixingStatus.isActive = false;
            clearInterval(progressInterval);
            
            // Emit event for parent component to handle transaction
            dispatch('mixingRequested', {
              amount: amount,
              tokenId: mixingForm.tokenId,
              mixLevel: mixingForm.mixLevel,
              targetAddress: mixingForm.targetAddress || currentAddress
            });
            
            showMixingModal = false;
            updatePrivacyBalance();
          } else {
            mixingStatus.message = `Mixing in progress... ${Math.floor(mixingStatus.progress)}%`;
          }
        }, 1000);
        
      } catch (error) {
        console.error('Error starting mixing:', error);
        mixingStatus.isActive = false;
        showCustomToast(`Mixing failed: ${error.message}`, 5000, 'error');
      }
    }
    
    async function generateNewStealthAddress() {
      try {
        if (!anonymousIdentity) {
          await initializeAnonymousMode();
        }
        
        stealthAddress = await privacyManager.generateStealthAddress(
          anonymousIdentity.publicKey,
          Date.now().toString()
        );
        
        showCustomToast('New stealth address generated', 3000, 'success');
      } catch (error) {
        console.error('Error generating stealth address:', error);
        showCustomToast('Failed to generate stealth address', 3000, 'error');
      }
    }
    
    function togglePrivacyPanel() {
      showPrivacyPanel = !showPrivacyPanel;
    }
    
    function handlePrivacySettingChange() {
      savePrivacySettings();
      
      if (privacySettings.anonymousMode && !isAnonymousSession) {
        initializeAnonymousMode();
      } else if (!privacySettings.anonymousMode && isAnonymousSession) {
        deactivateAnonymousMode();
      }
    }
    
    async function createPrivateTip(recipientAddress, amount, tokenId) {
      try {
        if (!walletConnected) {
          throw new Error('Wallet not connected');
        }
        
        dispatch('privateTipRequested', {
          recipientAddress,
          amount,
          tokenId,
          mixLevel: privacySettings.mixLevel,
          useStealthAddress: privacySettings.stealthMode
        });
        
      } catch (error) {
        console.error('Error creating private tip:', error);
        showCustomToast(`Private tip failed: ${error.message}`, 5000, 'error');
      }
    }
    
    function getPrivacyLevelColor(level) {
      switch (level) {
        case 'high': return '#4CAF50';
        case 'medium': return '#FF9800';
        case 'basic': return '#FFC107';
        default: return '#9E9E9E';
      }
    }
    
    function getPrivacyLevelIcon(level) {
      switch (level) {
        case 'high': return 'fa-shield-alt';
        case 'medium': return 'fa-shield-halved';
        case 'basic': return 'fa-shield';
        default: return 'fa-shield-slash';
      }
    }
    
    function copyStealthAddress() {
      if (stealthAddress) {
        navigator.clipboard.writeText(stealthAddress.address)
          .then(() => showCustomToast('Stealth address copied!', 2000, 'success'))
          .catch(() => showCustomToast('Failed to copy address', 2000, 'error'));
      }
    }
  </script>
  
  <!-- Privacy Panel Toggle Button -->
  <div class="privacy-toggle-container">
    <button 
      class="privacy-toggle-btn {showPrivacyPanel ? 'active' : ''}" 
      on:click={togglePrivacyPanel}
      title="Privacy Features"
    >
      <i class="fa-solid fa-user-secret"></i>
      <span class="toggle-label">Privacy</span>
      {#if isAnonymousSession}
        <span class="anon-indicator">🎭</span>
      {/if}
    </button>
  </div>
  
  <!-- Privacy Features Panel -->
  {#if showPrivacyPanel}
    <div class="privacy-panel" transition:slide={{ duration: 300 }}>
      <div class="privacy-header">
        <h3>
          <i class="fa-solid fa-user-secret"></i>
          Privacy Features
        </h3>
        <button class="close-btn" on:click={() => showPrivacyPanel = false}>
          <i class="fa-solid fa-times"></i>
        </button>
      </div>
      
      <!-- Privacy Status Overview -->
      <div class="privacy-status">
        <div class="status-card">
          <div class="status-icon">
            <i class="fa-solid {getPrivacyLevelIcon(privacySettings.encryptionLevel)}" 
               style="color: {getPrivacyLevelColor(privacySettings.encryptionLevel)}"></i>
          </div>
          <div class="status-info">
            <span class="status-label">Encryption Level</span>
            <span class="status-value">{privacySettings.encryptionLevel}</span>
          </div>
        </div>
        
        {#if isAnonymousSession}
          <div class="status-card anonymous">
            <div class="status-icon">
              <i class="fa-solid fa-mask" style="color: #9C27B0"></i>
            </div>
            <div class="status-info">
              <span class="status-label">Anonymous Session</span>
              <span class="status-value">Active</span>
            </div>
          </div>
        {/if}
        
        {#if privacyBalance.mixed > 0}
          <div class="status-card">
            <div class="status-icon">
              <i class="fa-solid fa-coins" style="color: #4CAF50"></i>
            </div>
            <div class="status-info">
              <span class="status-label">Mixed Balance</span>
              <span class="status-value">{privacyBalance.mixed} ERG</span>
            </div>
          </div>
        {/if}
      </div>
      
      <!-- Quick Actions -->
      <div class="privacy-actions">
        <button 
          class="privacy-action-btn {privacySettings.anonymousMode ? 'active' : ''}"
          on:click={() => {
            privacySettings.anonymousMode = !privacySettings.anonymousMode;
            handlePrivacySettingChange();
          }}
          disabled={!walletConnected}
        >
          <i class="fa-solid fa-mask"></i>
          <span>Anonymous Mode</span>
        </button>
        
        <button 
          class="privacy-action-btn"
          on:click={() => showMixingModal = true}
          disabled={!walletConnected}
        >
          <i class="fa-solid fa-shuffle"></i>
          <span>Mix Tokens</span>
        </button>
        
        <button 
          class="privacy-action-btn"
          on:click={() => showStealthModal = true}
          disabled={!walletConnected}
        >
          <i class="fa-solid fa-eye-slash"></i>
          <span>Stealth Address</span>
        </button>
        
        <button 
          class="privacy-action-btn"
          on:click={() => showPrivacySettings = true}
        >
          <i class="fa-solid fa-cog"></i>
          <span>Settings</span>
        </button>
      </div>
      
      <!-- Privacy Balance -->
      {#if walletConnected}
        <div class="privacy-balance">
          <h4>Privacy Balance</h4>
          <div class="balance-grid">
            <div class="balance-item">
              <span class="balance-label">Mixed</span>
              <span class="balance-value mixed">{privacyBalance.mixed} ERG</span>
            </div>
            <div class="balance-item">
              <span class="balance-label">Unmixed</span>
              <span class="balance-value unmixed">{privacyBalance.unmixed} ERG</span>
            </div>
            {#if privacyBalance.pending > 0}
              <div class="balance-item">
                <span class="balance-label">Pending</span>
                <span class="balance-value pending">{privacyBalance.pending} ERG</span>
              </div>
            {/if}
          </div>
        </div>
      {/if}
      
      <!-- Active Mixing Status -->
      {#if mixingStatus.isActive}
        <div class="mixing-status" transition:slide={{ duration: 200 }}>
          <div class="mixing-header">
            <i class="fa-solid fa-spinner fa-spin"></i>
            <span>Mixing in Progress</span>
          </div>
          <div class="mixing-progress">
            <div class="progress-bar">
              <div class="progress-fill" style="width: {mixingStatus.progress}%"></div>
            </div>
            <span class="progress-text">{mixingStatus.message}</span>
          </div>
        </div>
      {/if}
    </div>
  {/if}
  
  <!-- Mixing Modal -->
  {#if showMixingModal}
    <div class="modal-overlay" on:click|self={() => showMixingModal = false} transition:fade={{ duration: 200 }}>
      <div class="privacy-modal">
        <div class="modal-header">
          <h3>
            <i class="fa-solid fa-shuffle"></i>
            Mix Tokens for Privacy
          </h3>
          <button class="close-btn" on:click={() => showMixingModal = false}>
            <i class="fa-solid fa-times"></i>
          </button>
        </div>
        
        <div class="modal-body">
          <div class="form-group">
            <label>Amount to Mix</label>
            <input 
              type="number" 
              bind:value={mixingForm.amount}
              placeholder="0.1"
              min="0.1"
              max="100"
              step="0.01"
              class="form-input"
            />
            <small class="form-hint">Minimum: 0.1 ERG, Maximum: 100 ERG</small>
          </div>
          
          <div class="form-group">
            <label>Token Type</label>
            <select bind:value={mixingForm.tokenId} class="form-select">
              <option value="ERG">ERG</option>
              <option value="sigusd">SigUSD</option>
              <option value="custom">Other Token...</option>
            </select>
          </div>
          
          <div class="form-group">
            <label>Privacy Level</label>
            <div class="mix-level-selector">
              {#each [1, 2, 3] as level}
                <button 
                  class="mix-level-btn {mixingForm.mixLevel === level ? 'active' : ''}"
                  on:click={() => mixingForm.mixLevel = level}
                >
                  <span class="level-number">{level}</span>
                  <span class="level-name">
                    {level === 1 ? 'Basic' : level === 2 ? 'Medium' : 'High'}
                  </span>
                  <span class="level-fee">
                    {privacyFeesEstimate.mixing?.[`level${level}`] || 0} ERG
                  </span>
                </button>
              {/each}
            </div>
          </div>
          
          <div class="form-group">
            <label>Output Address (Optional)</label>
            <input 
              type="text" 
              bind:value={mixingForm.targetAddress}
              placeholder="Leave blank to use your address"
              class="form-input"
            />
          </div>
          
          <div class="privacy-info">
            <div class="info-item">
              <i class="fa-solid fa-info-circle"></i>
              <span>Higher privacy levels use more ring signatures and take longer to process</span>
            </div>
            <div class="info-item">
              <i class="fa-solid fa-clock"></i>
              <span>Mixing typically takes 5-15 minutes depending on network activity</span>
            </div>
          </div>
        </div>
        
        <div class="modal-footer">
          <button class="cancel-btn" on:click={() => showMixingModal = false}>
            Cancel
          </button>
          <button 
            class="confirm-btn"
            on:click={startMixing}
            disabled={!mixingForm.amount || mixingStatus.isActive}
          >
            {#if mixingStatus.isActive}
              <i class="fa-solid fa-spinner fa-spin"></i>
              Mixing...
            {:else}
              Start Mixing
            {/if}
          </button>
        </div>
      </div>
    </div>
  {/if}
  
  <!-- Stealth Address Modal -->
  {#if showStealthModal}
    <div class="modal-overlay" on:click|self={() => showStealthModal = false} transition:fade={{ duration: 200 }}>
      <div class="privacy-modal">
        <div class="modal-header">
          <h3>
            <i class="fa-solid fa-eye-slash"></i>
            Stealth Address
          </h3>
          <button class="close-btn" on:click={() => showStealthModal = false}>
            <i class="fa-solid fa-times"></i>
          </button>
        </div>
        
        <div class="modal-body">
          {#if stealthAddress}
            <div class="stealth-address-display">
              <label>Your Stealth Address</label>
              <div class="address-container">
                <code class="stealth-address">{stealthAddress.address}</code>
                <button class="copy-btn" on:click={copyStealthAddress}>
                  <i class="fa-solid fa-copy"></i>
                </button>
              </div>
              <small class="address-hint">
                Share this address to receive anonymous payments
              </small>
            </div>
            
            <div class="stealth-actions">
              <button class="stealth-btn" on:click={generateNewStealthAddress}>
                <i class="fa-solid fa-refresh"></i>
                Generate New Address
              </button>
            </div>
          {:else}
            <div class="stealth-setup">
              <div class="setup-info">
                <i class="fa-solid fa-info-circle"></i>
                <p>Generate a stealth address for receiving anonymous payments. The address is derived from your wallet but provides additional privacy.</p>
              </div>
              <button class="generate-btn" on:click={generateNewStealthAddress}>
                <i class="fa-solid fa-plus"></i>
                Generate Stealth Address
              </button>
            </div>
          {/if}
        </div>
      </div>
    </div>
  {/if}
  
  <!-- Privacy Settings Modal -->
  {#if showPrivacySettings}
    <div class="modal-overlay" on:click|self={() => showPrivacySettings = false} transition:fade={{ duration: 200 }}>
      <div class="privacy-modal">
        <div class="modal-header">
          <h3>
            <i class="fa-solid fa-cog"></i>
            Privacy Settings
          </h3>
          <button class="close-btn" on:click={() => showPrivacySettings = false}>
            <i class="fa-solid fa-times"></i>
          </button>
        </div>
        
        <div class="modal-body">
          <div class="settings-section">
            <h4>Encryption Settings</h4>
            
            <div class="setting-item">
              <label class="setting-label">
                <input 
                  type="checkbox" 
                  bind:checked={privacySettings.anonymousMode}
                  on:change={handlePrivacySettingChange}
                />
                Enable Anonymous Mode
              </label>
              <small>Use ephemeral identities for messaging</small>
            </div>
            
            <div class="setting-item">
              <label class="setting-label">Encryption Level</label>
              <select 
                bind:value={privacySettings.encryptionLevel}
                on:change={handlePrivacySettingChange}
                class="setting-select"
              >
                <option value="none">None</option>
                <option value="basic">Basic</option>
                <option value="medium">Medium</option>
                <option value="high">High</option>
              </select>
              <small>Higher levels provide better privacy but may affect performance</small>
            </div>
            
            <div class="setting-item">
              <label class="setting-label">
                <input 
                  type="checkbox" 
                  bind:checked={privacySettings.stealthMode}
                  on:change={handlePrivacySettingChange}
                />
                Use Stealth Addresses
              </label>
              <small>Generate stealth addresses for receiving payments</small>
            </div>
          </div>
          
          <div class="settings-section">
            <h4>Mixing Settings</h4>
            
            <div class="setting-item">
              <label class="setting-label">Default Mix Level</label>
              <select 
                bind:value={privacySettings.mixLevel}
                on:change={handlePrivacySettingChange}
                class="setting-select"
              >
                <option value={1}>Level 1 - Basic</option>
                <option value={2}>Level 2 - Medium</option>
                <option value={3}>Level 3 - High</option>
              </select>
            </div>
            
            <div class="setting-item">
              <label class="setting-label">
                <input 
                  type="checkbox" 
                  bind:checked={privacySettings.autoMix}
                  on:change={handlePrivacySettingChange}
                />
                Auto-mix large transactions
              </label>
              <small>Automatically mix transactions above 1 ERG</small>
            </div>
          </div>
          
          <div class="settings-section">
            <h4>Fee Estimates</h4>
            <div class="fee-display">
              <div class="fee-item">
                <span>Anonymous Message:</span>
                <span>{privacyFeesEstimate.anonymousMessage || 0} ERG</span>
              </div>
              <div class="fee-item">
                <span>Private Tip:</span>
                <span>{privacyFeesEstimate.privateTip || 0} ERG</span>
              </div>
              <div class="fee-item">
                <span>Mixing (Level {privacySettings.mixLevel}):</span>
                <span>{privacyFeesEstimate.mixing?.[`level${privacySettings.mixLevel}`] || 0} ERG</span>
              </div>
            </div>
          </div>
        </div>
        
        <div class="modal-footer">
          <button class="confirm-btn" on:click={() => showPrivacySettings = false}>
            Done
          </button>
        </div>
      </div>
    </div>
  {/if}
  
  <style>
    .privacy-toggle-container {
      display: inline-block;
    }
    
    .privacy-toggle-btn {
      display: flex;
      align-items: center;
      gap: 0.5rem;
      background-color: rgba(156, 39, 176, 0.1);
      color: #9C27B0;
      border: 1px solid rgba(156, 39, 176, 0.3);
      border-radius: 6px;
      padding: 0.5rem 0.75rem;
      cursor: pointer;
      transition: all 0.2s ease;
      font-size: 0.9rem;
      position: relative;
    }
    
    .privacy-toggle-btn:hover,
    .privacy-toggle-btn.active {
      background-color: rgba(156, 39, 176, 0.2);
    }
    
    .anon-indicator {
      position: absolute;
      top: -0.25rem;
      right: -0.25rem;
      font-size: 0.8rem;
    }
    
    .privacy-panel {
      background-color: #262626;
      border-radius: 8px;
      padding: 1rem;
      border: 1px solid rgba(156, 39, 176, 0.3);
      margin-bottom: 1rem;
      box-shadow: 0 4px 15px rgba(0, 0, 0, 0.2);
    }
    
    .privacy-header {
      display: flex;
      justify-content: space-between;
      align-items: center;
      margin-bottom: 1rem;
      padding-bottom: 0.5rem;
      border-bottom: 1px solid rgba(255, 255, 255, 0.1);
    }
    
    .privacy-header h3 {
      margin: 0;
      color: #9C27B0;
      display: flex;
      align-items: center;
      gap: 0.5rem;
    }
    
    .close-btn {
      background: none;
      border: none;
      color: #999;
      cursor: pointer;
      font-size: 1.2rem;
      padding: 0.25rem;
    }
    
    .close-btn:hover {
      color: white;
    }
    
    .privacy-status {
      display: grid;
      grid-template-columns: repeat(auto-fit, minmax(150px, 1fr));
      gap: 0.75rem;
      margin-bottom: 1rem;
    }
    
    .status-card {
      background-color: rgba(0, 0, 0, 0.3);
      border-radius: 6px;
      padding: 0.75rem;
      display: flex;
      align-items: center;
      gap: 0.5rem;
      border: 1px solid rgba(255, 255, 255, 0.1);
    }
    
    .status-card.anonymous {
      border-color: rgba(156, 39, 176, 0.3);
      background-color: rgba(156, 39, 176, 0.1);
    }
    
    .status-icon {
      font-size: 1.2rem;
    }
    
    .status-info {
      display: flex;
      flex-direction: column;
    }
    
    .status-label {
      font-size: 0.8rem;
      color: #999;
    }
    
    .status-value {
      font-weight: 500;
      color: white;
      text-transform: capitalize;
    }
    
    .privacy-actions {
      display: grid;
      grid-template-columns: repeat(auto-fit, minmax(120px, 1fr));
      gap: 0.5rem;
      margin-bottom: 1rem;
    }
    
    .privacy-action-btn {
      display: flex;
      flex-direction: column;
      align-items: center;
      gap: 0.25rem;
      background-color: rgba(255, 255, 255, 0.05);
      color: white;
      border: 1px solid rgba(255, 255, 255, 0.1);
      border-radius: 6px;
      padding: 0.75rem 0.5rem;
      cursor: pointer;
      transition: all 0.2s ease;
      font-size: 0.8rem;
    }
    
    .privacy-action-btn:hover {
      background-color: rgba(255, 255, 255, 0.1);
    }
    
    .privacy-action-btn.active {
      background-color: rgba(156, 39, 176, 0.2);
      border-color: rgba(156, 39, 176, 0.5);
      color: #9C27B0;
    }
    
    .privacy-action-btn:disabled {
      opacity: 0.5;
      cursor: not-allowed;
    }
    
    .privacy-balance {
      background-color: rgba(0, 0, 0, 0.2);
      border-radius: 6px;
      padding: 1rem;
      margin-bottom: 1rem;
    }
    
    .privacy-balance h4 {
      margin: 0 0 0.75rem 0;
      color: #CCC;
      font-size: 0.9rem;
    }
    
    .balance-grid {
      display: grid;
      grid-template-columns: repeat(auto-fit, minmax(100px, 1fr));
      gap: 0.75rem;
    }
    
    .balance-item {
      display: flex;
      flex-direction: column;
      align-items: center;
      text-align: center;
    }
    
    .balance-label {
      font-size: 0.7rem;
      color: #999;
      margin-bottom: 0.25rem;
    }
    
    .balance-value {
      font-weight: bold;
      font-size: 0.9rem;
    }
    
    .balance-value.mixed {
      color: #4CAF50;
    }
    
    .balance-value.unmixed {
      color: #FF9800;
    }
    
    .balance-value.pending {
      color: #2196F3;
    }
    
    .mixing-status {
      background-color: rgba(33, 150, 243, 0.1);
      border: 1px solid rgba(33, 150, 243, 0.3);
      border-radius: 6px;
      padding: 1rem;
    }
    
    .mixing-header {
      display: flex;
      align-items: center;
      gap: 0.5rem;
      color: #2196F3;
      margin-bottom: 0.75rem;
      font-weight: 500;
    }
    
    .mixing-progress {
      display: flex;
      flex-direction: column;
      gap: 0.5rem;
    }
    
    .progress-bar {
      width: 100%;
      height: 8px;
      background-color: rgba(255, 255, 255, 0.1);
      border-radius: 4px;
      overflow: hidden;
    }
    
    .progress-fill {
      height: 100%;
      background-color: #2196F3;
      transition: width 0.3s ease;
    }
    
    .progress-text {
      font-size: 0.8rem;
      color: #CCC;
      text-align: center;
    }
    
    .modal-overlay {
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
    
    .privacy-modal {
      background-color: #2D2D2D;
      border-radius: 8px;
      width: 100%;
      max-width: 500px;
      max-height: 90vh;
      overflow-y: auto;
      box-shadow: 0 4px 20px rgba(0, 0, 0, 0.5);
    }
    
    .modal-header {
      display: flex;
      justify-content: space-between;
      align-items: center;
      padding: 1rem;
      border-bottom: 1px solid rgba(255, 255, 255, 0.1);
    }
    
    .modal-header h3 {
      margin: 0;
      color: #9C27B0;
      display: flex;
      align-items: center;
      gap: 0.5rem;
    }
    
    .modal-body {
      padding: 1rem;
    }
    
    .modal-footer {
      display: flex;
      justify-content: flex-end;
      gap: 0.75rem;
      padding: 1rem;
      border-top: 1px solid rgba(255, 255, 255, 0.1);
    }
    
    .form-group {
      margin-bottom: 1rem;
    }
    
    .form-group label {
      display: block;
      color: #CCC;
      margin-bottom: 0.5rem;
      font-size: 0.9rem;
    }
    
    .form-input,
    .form-select {
      width: 100%;
      padding: 0.6rem 0.75rem;
      background-color: #333;
      border: 1px solid #555;
      border-radius: 4px;
      color: white;
      font-size: 0.9rem;
    }
    
    .form-input:focus,
    .form-select:focus {
      border-color: #9C27B0;
      outline: none;
    }
    
    .form-hint {
      font-size: 0.75rem;
      color: #999;
      margin-top: 0.25rem;
    }
    
    .mix-level-selector {
      display: grid;
      grid-template-columns: repeat(3, 1fr);
      gap: 0.5rem;
    }
    
    .mix-level-btn {
      display: flex;
      flex-direction: column;
      align-items: center;
      gap: 0.25rem;
      background-color: rgba(255, 255, 255, 0.05);
      border: 1px solid rgba(255, 255, 255, 0.1);
      border-radius: 6px;
      padding: 0.75rem 0.5rem;
      cursor: pointer;
      transition: all 0.2s ease;
      color: white;
    }
    
    .mix-level-btn:hover {
      background-color: rgba(255, 255, 255, 0.1);
    }
    
    .mix-level-btn.active {
      background-color: rgba(156, 39, 176, 0.2);
      border-color: rgba(156, 39, 176, 0.5);
      color: #9C27B0;
    }
    
    .level-number {
      font-size: 1.2rem;
      font-weight: bold;
    }
    
    .level-name {
      font-size: 0.8rem;
      color: #CCC;
    }
    
    .level-fee {
      font-size: 0.7rem;
      color: #999;
    }
    
    .privacy-info {
      background-color: rgba(33, 150, 243, 0.1);
      border: 1px solid rgba(33, 150, 243, 0.3);
      border-radius: 6px;
      padding: 0.75rem;
      margin-top: 1rem;
    }
    
    .info-item {
      display: flex;
      align-items: flex-start;
      gap: 0.5rem;
      margin-bottom: 0.5rem;
      font-size: 0.8rem;
      color: #CCC;
    }
    
    .info-item:last-child {
      margin-bottom: 0;
    }
    
    .info-item i {
      color: #2196F3;
      margin-top: 0.1rem;
    }
    
    .stealth-address-display {
      margin-bottom: 1.5rem;
    }
    
    .stealth-address-display label {
      display: block;
      color: #CCC;
      margin-bottom: 0.5rem;
      font-size: 0.9rem;
    }
    
    .address-container {
      display: flex;
      align-items: center;
      gap: 0.5rem;
      background-color: #333;
      border: 1px solid #555;
      border-radius: 4px;
      padding: 0.75rem;
    }
    
    .stealth-address {
      flex: 1;
      font-family: 'Courier New', monospace;
      font-size: 0.8rem;
      color: #4CAF50;
      word-break: break-all;
      background: none;
      border: none;
    }
    
    .copy-btn {
      background: none;
      border: none;
      color: #999;
      cursor: pointer;
      padding: 0.25rem;
      border-radius: 4px;
      transition: all 0.2s ease;
    }
    
    .copy-btn:hover {
      background-color: rgba(255, 255, 255, 0.1);
      color: white;
    }
    
    .address-hint {
      font-size: 0.75rem;
      color: #999;
      margin-top: 0.5rem;
      display: block;
    }
    
    .stealth-actions {
      display: flex;
      justify-content: center;
    }
    
    .stealth-btn {
      display: flex;
      align-items: center;
      gap: 0.5rem;
      background-color: rgba(156, 39, 176, 0.2);
      color: #9C27B0;
      border: 1px solid rgba(156, 39, 176, 0.5);
      border-radius: 6px;
      padding: 0.75rem 1rem;
      cursor: pointer;
      transition: all 0.2s ease;
    }
    
    .stealth-btn:hover {
      background-color: rgba(156, 39, 176, 0.3);
    }
    
    .stealth-setup {
      text-align: center;
    }
    
    .setup-info {
      background-color: rgba(33, 150, 243, 0.1);
      border: 1px solid rgba(33, 150, 243, 0.3);
      border-radius: 6px;
      padding: 1rem;
      margin-bottom: 1.5rem;
      display: flex;
      flex-direction: column;
      align-items: center;
      gap: 0.75rem;
    }
    
    .setup-info i {
      color: #2196F3;
      font-size: 1.5rem;
    }
    
    .setup-info p {
      margin: 0;
      color: #CCC;
      line-height: 1.4;
      font-size: 0.9rem;
    }
    
    .generate-btn {
      display: flex;
      align-items: center;
      gap: 0.5rem;
      background-color: rgba(76, 175, 80, 0.2);
      color: #4CAF50;
      border: 1px solid rgba(76, 175, 80, 0.5);
      border-radius: 6px;
      padding: 0.75rem 1.5rem;
      cursor: pointer;
      transition: all 0.2s ease;
      margin: 0 auto;
    }
    
    .generate-btn:hover {
      background-color: rgba(76, 175, 80, 0.3);
    }
    
    .settings-section {
      margin-bottom: 1.5rem;
      padding-bottom: 1rem;
      border-bottom: 1px solid rgba(255, 255, 255, 0.1);
    }
    
    .settings-section:last-child {
      border-bottom: none;
      margin-bottom: 0;
    }
    
    .settings-section h4 {
      margin: 0 0 1rem 0;
      color: #9C27B0;
      font-size: 1rem;
    }
    
    .setting-item {
      margin-bottom: 1rem;
    }
    
    .setting-item:last-child {
      margin-bottom: 0;
    }
    
    .setting-label {
      display: flex;
      align-items: center;
      gap: 0.5rem;
      color: white;
      cursor: pointer;
      margin-bottom: 0.25rem;
    }
    
    .setting-label input[type="checkbox"] {
      margin: 0;
    }
    
    .setting-select {
      margin-top: 0.25rem;
    }
    
    .setting-item small {
      font-size: 0.75rem;
      color: #999;
      display: block;
      margin-top: 0.25rem;
    }
    
    .fee-display {
      background-color: rgba(0, 0, 0, 0.2);
      border-radius: 6px;
      padding: 0.75rem;
    }
    
    .fee-item {
      display: flex;
      justify-content: space-between;
      align-items: center;
      margin-bottom: 0.5rem;
      font-size: 0.9rem;
    }
    
    .fee-item:last-child {
      margin-bottom: 0;
    }
    
    .fee-item span:first-child {
      color: #CCC;
    }
    
    .fee-item span:last-child {
      color: #4CAF50;
      font-weight: 500;
    }
    
    .cancel-btn {
      background-color: rgba(255, 255, 255, 0.1);
      color: #CCC;
      border: 1px solid rgba(255, 255, 255, 0.2);
      border-radius: 6px;
      padding: 0.75rem 1rem;
      cursor: pointer;
      transition: all 0.2s ease;
    }
    
    .cancel-btn:hover {
      background-color: rgba(255, 255, 255, 0.2);
      color: white;
    }
    
    .confirm-btn {
      background-color: rgba(156, 39, 176, 0.8);
      color: white;
      border: 1px solid rgba(156, 39, 176, 1);
      border-radius: 6px;
      padding: 0.75rem 1rem;
      cursor: pointer;
      transition: all 0.2s ease;
      display: flex;
      align-items: center;
      gap: 0.5rem;
    }
    
    .confirm-btn:hover {
      background-color: #9C27B0;
    }
    
    .confirm-btn:disabled {
      opacity: 0.6;
      cursor: not-allowed;
    }
    
    /* Responsive adjustments */
    @media (max-width: 768px) {
      .privacy-status {
        grid-template-columns: 1fr;
      }
      
      .privacy-actions {
        grid-template-columns: repeat(2, 1fr);
      }
      
      .balance-grid {
        grid-template-columns: repeat(2, 1fr);
      }
      
      .mix-level-selector {
        grid-template-columns: 1fr;
      }
      
      .privacy-modal {
        margin: 0.5rem;
        max-width: none;
      }
    }
    
    @media (max-width: 480px) {
      .privacy-actions {
        grid-template-columns: 1fr;
      }
      
      .balance-grid {
        grid-template-columns: 1fr;
      }
      
      .modal-footer {
        flex-direction: column;
      }
      
      .cancel-btn,
      .confirm-btn {
        width: 100%;
        justify-content: center;
      }
    }
  </style>