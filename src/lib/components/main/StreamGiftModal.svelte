<!-- StreamGiftModal.svelte - Animated gift modal for stream rooms -->
<script lang="ts">
  import { createEventDispatcher, onMount, onDestroy } from 'svelte';
  import { fade, scale, fly } from 'svelte/transition';
  import { elasticOut, backOut, quintOut } from 'svelte/easing';
  import { showCustomToast, truncateAddress } from '$lib/utils/utils';
  const dispatch = createEventDispatcher();

  // Props
  export let visible = false;
  export let streamerAddress = '';
  export let streamerName = '';
  export let streamTitle = '';
  export let roomId = '';
  export let walletConnected = false;
  export let currentUserAddress = '';
  export let allMessages = [];
  export let localMempoolMessages = [];

  // Gift definitions with animations
  const GIFTS = [
    {
      id: 'heart',
      name: 'Heart',
      emoji: '💖',
      price: 0.1,
      rarity: 'common',
      animation: 'pulse',
      color: '#ff6b9d',
      description: 'Show some love!'
    },
    {
      id: 'clap',
      name: 'Applause',
      emoji: '👏',
      price: 0.25,
      rarity: 'common',
      animation: 'shake',
      color: '#ffd93d',
      description: 'Amazing performance!'
    },
    {
      id: 'fire',
      name: 'Fire',
      emoji: '🔥',
      price: 0.5,
      rarity: 'uncommon',
      animation: 'flame',
      color: '#ff6b35',
      description: 'You\'re on fire!'
    },
    {
      id: 'diamond',
      name: 'Diamond',
      emoji: '💎',
      price: 1.0,
      rarity: 'rare',
      animation: 'sparkle',
      color: '#00d4ff',
      description: 'Precious and rare!'
    },
    {
      id: 'dolphin',
      name: 'Dolphin',
      emoji: '🐬',
      price: 5.0,
      rarity: 'epic',
      animation: 'swim',
      color: '#4dabf7',
      description: 'Graceful and intelligent!'
    },
    {
      id: 'tiger',
      name: 'Tiger',
      emoji: '🐅',
      price: 10.0,
      rarity: 'legendary',
      animation: 'roar',
      color: '#ff8c00',
      description: 'Fierce and powerful!'
    },
    {
      id: 'crown',
      name: 'Crown',
      emoji: '👑',
      price: 25.0,
      rarity: 'mythic',
      animation: 'royal',
      color: '#ffd700',
      description: 'You rule this stream!'
    },
    {
      id: 'rocket',
      name: 'Rocket',
      emoji: '🚀',
      price: 50.0,
      rarity: 'legendary',
      animation: 'launch',
      color: '#ff4757',
      description: 'To the moon!'
    }
  ];

  // State
  let selectedGift = null;
  let sending = false;
  let showConfirmation = false;
  let animatingGifts = [];
  let giftCount = 1;

  // Animation state
  let floatingGifts = [];
  let nextFloatingId = 0;

  // Donation stats
  let donationStats = {
    totalERG: 0,
    totalDonations: 0,
    uniqueDonors: 0,
    recentGifts: [],
    topDonors: [],
    recentDonations: []
  };

  // UI state
  let showDonorDetails = false;

  // Calculate donation stats
  $: if (visible && roomId && (allMessages.length > 0 || localMempoolMessages.length > 0)) {
    calculateDonationStats();
  }

  function calculateDonationStats() {
    try {
      const combinedMessages = [...allMessages, ...localMempoolMessages];
      
      // Filter messages for this stream room
      const streamMessages = combinedMessages.filter(msg => 
        msg.chatroomId === roomId || 
        (roomId.startsWith('stream-') && msg.chatroomId === roomId)
      );

      console.log(`Gift Modal: Calculating donations for room ${roomId}:`, streamMessages.length, 'messages');

      // Reset stats (using same structure as StreamDonationTracker)
      const stats = {
        totalDonations: 0,
        totalERG: 0,
        giftCount: 0,
        tipCount: 0,
        uniqueDonors: new Set(),
        giftsByType: {},
        donorAmounts: {},
        recentDonations: []
      };

      // Process each message (same logic as StreamDonationTracker)
      for (const msg of streamMessages) {
        let donationAmount = 0;
        let donationType = null;
        let donorAddress = msg.sender;

        // Check for gift messages
        if (msg.isGiftMessage && msg.giftData) {
          donationAmount = msg.giftData.amount || 0;
          donationType = 'gift';
          stats.giftCount++;
          
          // Track gift types
          const giftType = msg.giftData.giftName || 'Unknown';
          if (!stats.giftsByType[giftType]) {
            stats.giftsByType[giftType] = { count: 0, amount: 0, emoji: msg.giftData.giftEmoji || '🎁' };
          }
          stats.giftsByType[giftType].count += msg.giftData.count || 1;
          stats.giftsByType[giftType].amount += donationAmount;
        }
        // Check for tip messages (containing "tipped" and ERG amount)
        else if (msg.content && typeof msg.content === 'string') {
          // Match tip patterns: "X tipped Y ERG to Z" or "💸 X tipped Y ERG to Z"
          const tipMatch = msg.content.match(/tipped\s+([\d.]+)\s+ERG/i);
          if (tipMatch) {
            donationAmount = parseFloat(tipMatch[1]) || 0;
            donationType = 'tip';
            stats.tipCount++;
          }
        }

        // If we found a donation
        if (donationAmount > 0 && donationType) {
          stats.totalDonations++;
          stats.totalERG += donationAmount;
          stats.uniqueDonors.add(donorAddress);

          // Track donor amounts
          if (!stats.donorAmounts[donorAddress]) {
            stats.donorAmounts[donorAddress] = { 
              amount: 0, 
              count: 0, 
              name: truncateAddress(donorAddress),
              address: donorAddress
            };
          }
          stats.donorAmounts[donorAddress].amount += donationAmount;
          stats.donorAmounts[donorAddress].count++;

          // Add to recent donations
          stats.recentDonations.unshift({
            amount: donationAmount,
            type: donationType,
            emoji: donationType === 'gift' ? (msg.giftData?.giftEmoji || '🎁') : '💰',
            name: donationType === 'gift' ? (msg.giftData?.giftName || 'Gift') : 'Tip',
            donor: donorAddress,
            donorName: truncateAddress(donorAddress),
            timestamp: msg.timestamp,
            giftData: msg.giftData || null
          });
        }
      }

      // Create top donors list (same as StreamDonationTracker)
      const topDonors = Object.entries(stats.donorAmounts)
        .map(([address, data]) => ({
          address,
          name: data.name,
          totalAmount: data.amount,
          donationCount: data.count
        }))
        .sort((a, b) => b.totalAmount - a.totalAmount)
        .slice(0, 10);

      // Create recent gifts for floating animation
      const recentGifts = stats.recentDonations
        .filter(donation => donation.type === 'gift')
        .slice(0, 5)
        .map(donation => ({
          type: donation.type,
          emoji: donation.emoji,
          name: donation.name,
          amount: donation.amount,
          timestamp: donation.timestamp
        }));

      // Finalize stats
      donationStats = {
        totalERG: stats.totalERG,
        totalDonations: stats.totalDonations,
        uniqueDonors: stats.uniqueDonors.size,
        recentGifts: recentGifts,
        topDonors: topDonors,
        recentDonations: stats.recentDonations.slice(0, 10)
      };

      console.log('Gift Modal: Donation stats calculated:', {
        totalERG: donationStats.totalERG,
        totalDonations: donationStats.totalDonations,
        uniqueDonors: donationStats.uniqueDonors,
        topDonors: donationStats.topDonors.length,
        recentDonations: donationStats.recentDonations.length
      });

    } catch (error) {
      console.error('Gift Modal: Error calculating donation stats:', error);
    }
  }

// Format time ago
function timeAgo(timestamp) {
  const now = Date.now() / 1000;
  const diff = now - timestamp;
  
  if (diff < 60) return 'just now';
  if (diff < 3600) return `${Math.floor(diff / 60)}m ago`;
  if (diff < 86400) return `${Math.floor(diff / 3600)}h ago`;
  return `${Math.floor(diff / 86400)}d ago`;
}



// Toggle donor details
function toggleDonorDetails() {
  showDonorDetails = !showDonorDetails;
}
  // Close modal
  function closeModal() {
    visible = false;
    selectedGift = null;
    showConfirmation = false;
    giftCount = 1;
  }

  // Select gift
  function selectGift(gift) {
    selectedGift = gift;
    showConfirmation = true;
  }

  // Send gift
  async function sendGift() {
    if (!selectedGift || !walletConnected || sending) return;

    try {
      sending = true;

      const totalAmount = selectedGift.price * giftCount;
      
      // Create gift transaction data
      const giftData = {
        type: 'stream_gift',
        giftId: selectedGift.id,
        giftName: selectedGift.name,
        giftEmoji: selectedGift.emoji,
        amount: totalAmount,
        count: giftCount,
        senderAddress: currentUserAddress,
        streamerAddress: streamerAddress,
        streamerName: streamerName,
        roomId: roomId,
        timestamp: Math.floor(Date.now() / 1000),
        rarity: selectedGift.rarity
      };

      // Dispatch event to parent to handle blockchain transaction
      dispatch('sendGift', giftData);

      // Add floating animation
      triggerFloatingAnimation(selectedGift, giftCount);

      // Show success state
      showSuccessAnimation();

      // Auto close after animation
      setTimeout(() => {
        closeModal();
      }, 2000);

    } catch (error) {
      console.error('Error sending gift:', error);
      dispatch('showToast', {
        message: `Failed to send ${selectedGift.name}: ${error.message}`,
        type: 'error'
      });
    } finally {
      sending = false;
    }
  }

  // Trigger floating animation
  function triggerFloatingAnimation(gift, count) {
    for (let i = 0; i < count; i++) {
      setTimeout(() => {
        const floatingGift = {
          id: nextFloatingId++,
          emoji: gift.emoji,
          color: gift.color,
          x: Math.random() * 200 - 100,
          y: Math.random() * 100 - 50,
          rotation: Math.random() * 360,
          scale: 0.8 + Math.random() * 0.4
        };
        
        floatingGifts = [...floatingGifts, floatingGift];
        
        // Remove after animation
        setTimeout(() => {
          floatingGifts = floatingGifts.filter(g => g.id !== floatingGift.id);
        }, 3000);
      }, i * 100);
    }
  }

  // Show success animation
  function showSuccessAnimation() {
    // Could add confetti or other success effects here
    dispatch('showToast', {
      message: `${selectedGift.emoji} ${selectedGift.name} sent to ${streamerName}!`,
      type: 'success'
    });
  }

  // Format ERG amount
  function formatERG(amount) {
    return amount.toFixed(amount < 1 ? 3 : 1);
  }

  // Get rarity color
  function getRarityColor(rarity) {
    const colors = {
      common: '#95a5a6',
      uncommon: '#27ae60',
      rare: '#3498db',
      epic: '#9b59b6',
      legendary: '#f39c12',
      mythic: '#e74c3c'
    };
    return colors[rarity] || '#95a5a6';
  }

  // Handle escape key
  function handleKeydown(event) {
    if (event.key === 'Escape') {
      closeModal();
    }
  }

  // Lifecycle
  onMount(() => {
    document.addEventListener('keydown', handleKeydown);
  });

  onDestroy(() => {
    document.removeEventListener('keydown', handleKeydown);
  });
</script>

{#if visible}
  <!-- Modal Overlay -->
  <div 
    class="gift-modal-overlay" 
    transition:fade={{ duration: 200 }}
    on:click|self={closeModal}
  >
    <!-- Floating Gifts Animation -->
    {#each floatingGifts as gift (gift.id)}
      <div 
        class="floating-gift"
        style="
          left: calc(50% + {gift.x}px);
          top: calc(50% + {gift.y}px);
          transform: rotate({gift.rotation}deg) scale({gift.scale});
          color: {gift.color};
        "
        transition:fly={{ 
          y: -200, 
          x: gift.x * 2, 
          duration: 3000, 
          easing: elasticOut 
        }}
      >
        {gift.emoji}
      </div>
    {/each}

    <!-- Main Modal -->
    <div 
      class="gift-modal" 
      transition:scale={{ duration: 300, easing: backOut }}
    >
      <!-- Header -->
      <div class="gift-header">
        <div class="gift-title">
          <div class="gift-icon">🎁</div>
          <div class="gift-text">
            <h2>Send Gift</h2>
            <p>To: <span class="streamer-name">{streamerName}</span></p>
          </div>
        </div>
        <button class="close-btn" on:click={closeModal}>
          <i class="fa-solid fa-times"></i>
        </button>
      </div>

      <!-- Donation Stats Bar -->
      <div class="donation-stats-bar">
        <div class="stats-main">
          <div class="total-donations">
            <span class="donations-amount">{formatERG(donationStats.totalERG)} ERG</span>
            <span class="donations-label">
              {donationStats.totalDonations} donation{donationStats.totalDonations === 1 ? '' : 's'} • {donationStats.uniqueDonors} donor{donationStats.uniqueDonors === 1 ? '' : 's'}
            </span>
          </div>
        </div>
        <div class="stats-actions">
          {#if donationStats.recentGifts.length > 0}
            <div class="recent-gifts-preview">
              {#each donationStats.recentGifts.slice(0, 3) as gift}
                <span class="recent-gift-emoji" title="{gift.name} - {formatERG(gift.amount)} ERG">
                  {gift.emoji}
                </span>
              {/each}
            </div>
          {/if}
          {#if donationStats.totalDonations > 0}
            <button class="donors-toggle-btn" on:click={toggleDonorDetails}>
              <i class="fa-solid fa-users"></i>
              <span>Donors</span>
              <i class="fa-solid fa-chevron-down {showDonorDetails ? 'rotated' : ''}"></i>
            </button>
          {/if}
        </div>
      </div>

      <!-- Donor Details (Collapsible) -->
      {#if showDonorDetails && donationStats.totalDonations > 0}
        <div class="donor-details" transition:scale={{ duration: 300, easing: quintOut }}>
          
          <!-- Top Donors -->
          {#if donationStats.topDonors.length > 0}
            <div class="donor-section">
              <h4>
                <i class="fa-solid fa-trophy"></i>
                Top Donors
              </h4>
              <div class="donors-list">
                {#each donationStats.topDonors.slice(0, 5) as donor, index}
                  <div class="donor-item">
                    <div class="donor-rank">#{index + 1}</div>
                    <div class="donor-avatar">
                      <i class="fa-solid fa-user"></i>
                    </div>
                    <div class="donor-info">
                      <span class="donor-name">{donor.name}</span>
                      <span class="donor-stats">
                        {formatERG(donor.totalAmount)} ERG • {donor.donationCount} donation{donor.donationCount === 1 ? '' : 's'}
                      </span>
                    </div>
                  </div>
                {/each}
              </div>
            </div>
          {/if}

          <!-- Recent Donations -->
          {#if donationStats.recentDonations.length > 0}
            <div class="donor-section">
              <h4>
                <i class="fa-solid fa-clock"></i>
                Recent Donations
              </h4>
              <div class="recent-donations-list">
                {#each donationStats.recentDonations.slice(0, 8) as donation}
                  <div class="recent-donation-item">
                    <div class="donation-icon">
                      <span class="donation-emoji">{donation.emoji}</span>
                    </div>
                    <div class="donation-info">
                      <div class="donation-main">
                        <span class="donation-amount">{formatERG(donation.amount)} ERG</span>
                        <span class="donation-type">{donation.name}</span>
                      </div>
                      <div class="donation-meta">
                        <span class="donation-donor">from {donation.donorName}</span>
                        <span class="donation-time">{timeAgo(donation.timestamp)}</span>
                      </div>
                    </div>
                  </div>
                {/each}
              </div>
            </div>
          {/if}
        </div>
      {/if}

      {#if !showConfirmation}
        <!-- Gift Selection -->
        <div class="gift-selection" transition:fade={{ duration: 200 }}>
          <div class="gifts-grid">
            {#each GIFTS as gift}
              <button 
                class="gift-item {gift.rarity}"
                on:click={() => selectGift(gift)}
                disabled={!walletConnected}
              >
                <div class="gift-emoji {gift.animation}">{gift.emoji}</div>
                <div class="gift-name">{gift.name}</div>
                <div class="gift-price">{formatERG(gift.price)} ERG</div>
                <div class="gift-rarity" style="color: {getRarityColor(gift.rarity)}">
                  {gift.rarity.toUpperCase()}
                </div>
              </button>
            {/each}
          </div>

          {#if !walletConnected}
            <div class="wallet-warning">
              <i class="fa-solid fa-wallet"></i>
              <p>Connect your wallet to send gifts</p>
            </div>
          {/if}
        </div>
      {:else}
        <!-- Gift Confirmation -->
        <div class="gift-confirmation" transition:fade={{ duration: 200 }}>
          <div class="selected-gift">
            <div class="gift-preview">
              <div class="gift-emoji-large {selectedGift.animation}">
                {selectedGift.emoji}
              </div>
              <div class="gift-details">
                <h3>{selectedGift.name}</h3>
                <p class="gift-description">{selectedGift.description}</p>
                <div class="gift-rarity-badge" style="background: {getRarityColor(selectedGift.rarity)}">
                  {selectedGift.rarity.toUpperCase()}
                </div>
              </div>
            </div>

            <!-- Quantity Selector -->
            <div class="quantity-selector">
              <label>Quantity:</label>
              <div class="quantity-controls">
                <button 
                  class="qty-btn" 
                  on:click={() => giftCount = Math.max(1, giftCount - 1)}
                  disabled={giftCount <= 1}
                >
                  <i class="fa-solid fa-minus"></i>
                </button>
                <span class="quantity">{giftCount}</span>
                <button 
                  class="qty-btn" 
                  on:click={() => giftCount = Math.min(10, giftCount + 1)}
                  disabled={giftCount >= 10}
                >
                  <i class="fa-solid fa-plus"></i>
                </button>
              </div>
            </div>

            <!-- Total Cost -->
            <div class="total-cost">
              <div class="cost-breakdown">
                <span>{formatERG(selectedGift.price)} ERG × {giftCount}</span>
                <span class="total-amount">{formatERG(selectedGift.price * giftCount)} ERG</span>
              </div>
            </div>

            <!-- Action Buttons -->
            <div class="confirmation-actions">
              <button 
                class="back-btn" 
                on:click={() => showConfirmation = false}
                disabled={sending}
              >
                <i class="fa-solid fa-arrow-left"></i>
                Back
              </button>
              <button 
                class="send-btn" 
                on:click={sendGift}
                disabled={sending}
              >
                {#if sending}
                  <div class="loading-spinner"></div>
                  Sending...
                {:else}
                  <i class="fa-solid fa-paper-plane"></i>
                  Send Gift
                {/if}
              </button>
            </div>
          </div>
        </div>
      {/if}
    </div>
  </div>
{/if}

<style>
  .gift-modal-overlay {
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
    padding: 1rem;
  }

  .floating-gift {
    position: fixed;
    font-size: 2rem;
    pointer-events: none;
    z-index: 1001;
    text-shadow: 0 0 10px currentColor;
  }

  .gift-modal {
    background: linear-gradient(145deg, #1a1a1a, #2d2d2d);
    border-radius: 20px;
    border: 2px solid rgba(255, 85, 0, 0.3);
    box-shadow: 
      0 20px 60px rgba(0, 0, 0, 0.5),
      0 0 0 1px rgba(255, 255, 255, 0.1) inset;
    max-width: 600px;
    width: 100%;
    max-height: 80vh;
    overflow-y: auto;
    position: relative;
  }

  .gift-header {
    display: flex;
    align-items: center;
    justify-content: space-between;
    padding: 1.5rem;
    border-bottom: 1px solid rgba(255, 255, 255, 0.1);
    background: rgba(255, 85, 0, 0.05);
  }

  .donation-stats-bar {
    display: flex;
    align-items: center;
    justify-content: space-between;
    padding: 1rem 1.5rem;
    background: linear-gradient(135deg, rgba(255, 85, 0, 0.15), rgba(255, 85, 0, 0.08));
    border-bottom: 1px solid rgba(255, 255, 255, 0.1);
  }

  .stats-main {
    flex: 1;
  }

  .stats-actions {
    display: flex;
    align-items: center;
    gap: 1rem;
  }

  .total-donations {
    display: flex;
    flex-direction: column;
  }

  .donations-amount {
    font-size: 1.2rem;
    font-weight: 700;
    color: #FFD700;
    font-family: monospace;
  }

  .donations-label {
    font-size: 0.8rem;
    color: rgba(255, 255, 255, 0.7);
    margin-top: 0.25rem;
  }

  .recent-gifts-preview {
    display: flex;
    gap: 0.5rem;
    align-items: center;
  }

  .recent-gift-emoji {
    font-size: 1.5rem;
    opacity: 0.8;
    animation: float 3s ease-in-out infinite;
    cursor: help;
  }

  .recent-gift-emoji:nth-child(2) {
    animation-delay: 0.5s;
  }

  .recent-gift-emoji:nth-child(3) {
    animation-delay: 1s;
  }

  .donors-toggle-btn {
    display: flex;
    align-items: center;
    gap: 0.5rem;
    background: rgba(255, 85, 0, 0.2);
    color: #FF5500;
    border: 1px solid rgba(255, 85, 0, 0.4);
    border-radius: 8px;
    padding: 0.5rem 0.75rem;
    cursor: pointer;
    transition: all 0.2s ease;
    font-size: 0.8rem;
    font-weight: 600;
  }

  .donors-toggle-btn:hover {
    background: rgba(255, 85, 0, 0.3);
    transform: translateY(-1px);
  }

  .donors-toggle-btn i.fa-chevron-down {
    transition: transform 0.2s ease;
  }

  .donors-toggle-btn i.fa-chevron-down.rotated {
    transform: rotate(180deg);
  }

  .donor-details {
    background: rgba(0, 0, 0, 0.3);
    border-bottom: 1px solid rgba(255, 255, 255, 0.1);
    max-height: 300px;
    overflow-y: auto;
  }

  .donor-section {
    padding: 1rem 1.5rem;
    border-bottom: 1px solid rgba(255, 255, 255, 0.05);
  }

  .donor-section:last-child {
    border-bottom: none;
  }

  .donor-section h4 {
    display: flex;
    align-items: center;
    gap: 0.5rem;
    margin: 0 0 1rem;
    color: white;
    font-size: 0.9rem;
    font-weight: 600;
  }

  .donor-section h4 i {
    color: #FF5500;
    font-size: 0.8rem;
  }

  .donors-list {
    display: flex;
    flex-direction: column;
    gap: 0.75rem;
  }

  .donor-item {
    display: flex;
    align-items: center;
    gap: 0.75rem;
    padding: 0.75rem;
    background: rgba(255, 255, 255, 0.05);
    border-radius: 8px;
    transition: background 0.2s ease;
  }

  .donor-item:hover {
    background: rgba(255, 255, 255, 0.1);
  }

  .donor-rank {
    width: 24px;
    height: 24px;
    background: linear-gradient(135deg, #FFD700, #FFA500);
    border-radius: 50%;
    display: flex;
    align-items: center;
    justify-content: center;
    color: #1a1a1a;
    font-weight: 700;
    font-size: 0.7rem;
  }

  .donor-avatar {
    width: 32px;
    height: 32px;
    background: rgba(255, 85, 0, 0.2);
    border-radius: 50%;
    display: flex;
    align-items: center;
    justify-content: center;
    color: #FF5500;
    font-size: 0.9rem;
  }

  .donor-info {
    flex: 1;
    display: flex;
    flex-direction: column;
  }

  .donor-name {
    color: white;
    font-weight: 600;
    font-size: 0.8rem;
    font-family: monospace;
  }

  .donor-stats {
    color: rgba(255, 255, 255, 0.7);
    font-size: 0.7rem;
    margin-top: 0.25rem;
  }

  .recent-donations-list {
    display: flex;
    flex-direction: column;
    gap: 0.5rem;
  }

  .recent-donation-item {
    display: flex;
    align-items: center;
    gap: 0.75rem;
    padding: 0.5rem;
    background: rgba(255, 255, 255, 0.03);
    border-radius: 6px;
    transition: background 0.2s ease;
  }

  .recent-donation-item:hover {
    background: rgba(255, 255, 255, 0.08);
  }

  .donation-icon {
    width: 28px;
    height: 28px;
    display: flex;
    align-items: center;
    justify-content: center;
  }

  .donation-emoji {
    font-size: 1.2rem;
  }

  .donation-info {
    flex: 1;
    display: flex;
    flex-direction: column;
  }

  .donation-main {
    display: flex;
    align-items: center;
    gap: 0.5rem;
  }

  .donation-amount {
    color: #FFD700;
    font-weight: 700;
    font-size: 0.8rem;
    font-family: monospace;
  }

  .donation-type {
    color: rgba(255, 255, 255, 0.8);
    font-size: 0.7rem;
    font-weight: 500;
  }

  .donation-meta {
    display: flex;
    align-items: center;
    gap: 0.5rem;
    margin-top: 0.25rem;
  }

  .donation-donor {
    color: rgba(255, 255, 255, 0.6);
    font-size: 0.7rem;
  }

  .donation-time {
    color: rgba(255, 255, 255, 0.4);
    font-size: 0.6rem;
  }

  @keyframes float {
    0%, 100% { transform: translateY(0px); }
    50% { transform: translateY(-3px); }
  }

  .gift-title {
    display: flex;
    align-items: center;
    gap: 1rem;
  }

  .gift-icon {
    font-size: 2rem;
    animation: bounce 2s infinite;
  }

  .gift-text h2 {
    margin: 0;
    color: white;
    font-size: 1.5rem;
    font-weight: 700;
  }

  .gift-destination {
    margin-top: 0.25rem;
  }

  .stream-info {
    margin: 0 0 0.25rem;
    color: rgba(255, 255, 255, 0.9);
    font-size: 0.85rem;
  }

  .stream-title {
    color: #FF5500;
    font-weight: 600;
  }

  .streamer-info {
    margin: 0;
    color: rgba(255, 255, 255, 0.7);
    font-size: 0.8rem;
  }

  .gift-text p {
    margin: 0.25rem 0 0;
    color: rgba(255, 255, 255, 0.7);
    font-size: 0.9rem;
  }

  .streamer-name {
    color: #FF5500;
    font-weight: 600;
  }

  .close-btn {
    background: none;
    border: none;
    color: rgba(255, 255, 255, 0.6);
    cursor: pointer;
    padding: 0.5rem;
    border-radius: 50%;
    transition: all 0.2s ease;
    width: 40px;
    height: 40px;
    display: flex;
    align-items: center;
    justify-content: center;
  }

  .close-btn:hover {
    background: rgba(255, 255, 255, 0.1);
    color: white;
    transform: scale(1.1);
  }

  .gift-selection {
    padding: 1.5rem;
  }

  .gifts-grid {
    display: grid;
    grid-template-columns: repeat(auto-fit, minmax(120px, 1fr));
    gap: 1rem;
    margin-bottom: 1rem;
  }

  .gift-item {
    background: linear-gradient(145deg, #2d2d2d, #1a1a1a);
    border: 2px solid rgba(255, 255, 255, 0.1);
    border-radius: 16px;
    padding: 1rem;
    cursor: pointer;
    transition: all 0.3s ease;
    text-align: center;
    position: relative;
    overflow: hidden;
  }

  .gift-item:hover:not(:disabled) {
    transform: translateY(-4px) scale(1.02);
    border-color: rgba(255, 85, 0, 0.5);
    box-shadow: 
      0 8px 25px rgba(0, 0, 0, 0.4),
      0 0 20px rgba(255, 85, 0, 0.2);
  }

  .gift-item:disabled {
    opacity: 0.5;
    cursor: not-allowed;
  }

  .gift-item.common { border-color: rgba(149, 165, 166, 0.3); }
  .gift-item.uncommon { border-color: rgba(39, 174, 96, 0.3); }
  .gift-item.rare { border-color: rgba(52, 152, 219, 0.3); }
  .gift-item.epic { border-color: rgba(155, 89, 182, 0.3); }
  .gift-item.legendary { border-color: rgba(243, 156, 18, 0.3); }
  .gift-item.mythic { border-color: rgba(231, 76, 60, 0.3); }

  .gift-emoji {
    font-size: 2.5rem;
    margin-bottom: 0.5rem;
    display: block;
  }

  .gift-name {
    color: white;
    font-weight: 600;
    margin-bottom: 0.25rem;
    font-size: 0.9rem;
  }

  .gift-price {
    color: #FFD700;
    font-weight: 700;
    font-size: 0.8rem;
  }

  .gift-rarity {
    font-size: 0.7rem;
    font-weight: 600;
    margin-top: 0.25rem;
    text-transform: uppercase;
    letter-spacing: 0.5px;
  }

  /* Gift Animations */
  .pulse { animation: pulse 2s infinite; }
  .shake { animation: shake 1s infinite; }
  .flame { animation: flame 1.5s infinite; }
  .sparkle { animation: sparkle 2s infinite; }
  .swim { animation: swim 3s infinite; }
  .roar { animation: roar 2s infinite; }
  .royal { animation: royal 3s infinite; }
  .launch { animation: launch 2s infinite; }

  @keyframes pulse {
    0%, 100% { transform: scale(1); }
    50% { transform: scale(1.1); }
  }

  @keyframes shake {
    0%, 100% { transform: translateX(0); }
    25% { transform: translateX(-2px); }
    75% { transform: translateX(2px); }
  }

  @keyframes flame {
    0%, 100% { transform: scale(1) rotate(0deg); }
    50% { transform: scale(1.1) rotate(5deg); }
  }

  @keyframes sparkle {
    0%, 100% { transform: scale(1) rotate(0deg); filter: brightness(1); }
    50% { transform: scale(1.2) rotate(180deg); filter: brightness(1.5); }
  }

  @keyframes swim {
    0%, 100% { transform: translateY(0px) rotate(0deg); }
    50% { transform: translateY(-10px) rotate(10deg); }
  }

  @keyframes roar {
    0%, 100% { transform: scale(1); }
    50% { transform: scale(1.2); }
  }

  @keyframes royal {
    0%, 100% { transform: translateY(0px) rotate(0deg); filter: brightness(1); }
    50% { transform: translateY(-5px) rotate(5deg); filter: brightness(1.3); }
  }

  @keyframes launch {
    0%, 100% { transform: translateY(0px) rotate(0deg); }
    50% { transform: translateY(-15px) rotate(-10deg); }
  }

  @keyframes bounce {
    0%, 100% { transform: translateY(0px); }
    50% { transform: translateY(-5px); }
  }

  .wallet-warning {
    text-align: center;
    color: rgba(255, 255, 255, 0.7);
    padding: 1rem;
    background: rgba(255, 85, 0, 0.1);
    border-radius: 8px;
    border: 1px solid rgba(255, 85, 0, 0.3);
  }

  .wallet-warning i {
    font-size: 1.5rem;
    margin-bottom: 0.5rem;
    color: #FF5500;
  }

  .gift-confirmation {
    padding: 1.5rem;
  }

  .selected-gift {
    text-align: center;
  }

  .gift-preview {
    display: flex;
    align-items: center;
    gap: 1.5rem;
    margin-bottom: 2rem;
    padding: 1rem;
    background: rgba(255, 255, 255, 0.05);
    border-radius: 12px;
  }

  .gift-emoji-large {
    font-size: 4rem;
    min-width: 80px;
  }

  .gift-details {
    text-align: left;
    flex: 1;
  }

  .gift-details h3 {
    margin: 0 0 0.5rem;
    color: white;
    font-size: 1.5rem;
  }

  .gift-description {
    color: rgba(255, 255, 255, 0.7);
    margin: 0 0 0.5rem;
    font-style: italic;
  }

  .gift-rarity-badge {
    display: inline-block;
    padding: 0.25rem 0.75rem;
    border-radius: 20px;
    color: white;
    font-size: 0.7rem;
    font-weight: 700;
    text-transform: uppercase;
    letter-spacing: 0.5px;
  }

  .quantity-selector {
    margin-bottom: 1.5rem;
  }

  .quantity-selector label {
    display: block;
    color: white;
    margin-bottom: 0.5rem;
    font-weight: 600;
  }

  .quantity-controls {
    display: flex;
    align-items: center;
    justify-content: center;
    gap: 1rem;
  }

  .qty-btn {
    background: rgba(255, 85, 0, 0.2);
    border: 1px solid rgba(255, 85, 0, 0.4);
    border-radius: 50%;
    width: 40px;
    height: 40px;
    display: flex;
    align-items: center;
    justify-content: center;
    color: #FF5500;
    cursor: pointer;
    transition: all 0.2s ease;
  }

  .qty-btn:hover:not(:disabled) {
    background: rgba(255, 85, 0, 0.3);
    transform: scale(1.1);
  }

  .qty-btn:disabled {
    opacity: 0.5;
    cursor: not-allowed;
  }

  .quantity {
    font-size: 1.5rem;
    font-weight: 700;
    color: white;
    min-width: 40px;
  }

  .total-cost {
    margin-bottom: 2rem;
    padding: 1rem;
    background: rgba(255, 85, 0, 0.1);
    border-radius: 8px;
    border: 1px solid rgba(255, 85, 0, 0.3);
  }

  .cost-breakdown {
    display: flex;
    justify-content: space-between;
    align-items: center;
    color: white;
    font-weight: 600;
  }

  .total-amount {
    font-size: 1.2rem;
    color: #FFD700;
    font-weight: 700;
  }

  .confirmation-actions {
    display: flex;
    gap: 1rem;
    justify-content: center;
  }

  .back-btn,
  .send-btn {
    display: flex;
    align-items: center;
    gap: 0.5rem;
    padding: 0.75rem 1.5rem;
    border-radius: 8px;
    font-weight: 600;
    cursor: pointer;
    transition: all 0.2s ease;
    border: none;
    font-size: 0.9rem;
  }

  .back-btn {
    background: rgba(255, 255, 255, 0.1);
    color: white;
    border: 1px solid rgba(255, 255, 255, 0.2);
  }

  .back-btn:hover:not(:disabled) {
    background: rgba(255, 255, 255, 0.15);
    transform: translateY(-1px);
  }

  .send-btn {
    background: linear-gradient(135deg, #FF5500, #ff7f39);
    color: white;
    border: 1px solid rgba(255, 85, 0, 0.5);
  }

  .send-btn:hover:not(:disabled) {
    background: linear-gradient(135deg, #ff7f39, #FF5500);
    transform: translateY(-1px);
    box-shadow: 0 4px 15px rgba(255, 85, 0, 0.3);
  }

  .send-btn:disabled,
  .back-btn:disabled {
    opacity: 0.6;
    cursor: not-allowed;
    transform: none;
  }

  .loading-spinner {
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

  /* Mobile Responsive */
  @media (max-width: 768px) {
    .gift-modal {
      margin: 1rem;
      max-height: 90vh;
    }

    .donation-stats-bar {
      flex-direction: column;
      align-items: flex-start;
      gap: 0.75rem;
      padding: 0.75rem 1rem;
    }

    .stats-actions {
      align-self: stretch;
      justify-content: space-between;
    }

    .donors-toggle-btn {
      flex: 1;
      justify-content: center;
    }

    .donor-details {
      max-height: 250px;
    }

    .donor-section {
      padding: 0.75rem 1rem;
    }

    .donors-list {
      gap: 0.5rem;
    }

    .donor-item {
      padding: 0.5rem;
    }

    .donor-avatar {
      width: 28px;
      height: 28px;
      font-size: 0.8rem;
    }

    .gifts-grid {
      grid-template-columns: repeat(2, 1fr);
      gap: 0.75rem;
    }

    .gift-item {
      padding: 0.75rem;
    }

    .gift-emoji {
      font-size: 2rem;
    }

    .gift-preview {
      flex-direction: column;
      text-align: center;
    }

    .gift-details {
      text-align: center;
    }

    .confirmation-actions {
      flex-direction: column;
    }

    .back-btn,
    .send-btn {
      width: 100%;
      justify-content: center;
    }
  }

  @media (max-width: 480px) {
    .gift-header {
      padding: 1rem;
    }

    .gift-selection,
    .gift-confirmation {
      padding: 1rem;
    }

    .gift-emoji-large {
      font-size: 3rem;
    }
  }
</style>