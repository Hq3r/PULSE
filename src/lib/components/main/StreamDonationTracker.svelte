<!-- StreamDonationTracker.svelte - Shows donation stats for stream rooms -->
<script lang="ts">
    import { createEventDispatcher, onMount } from 'svelte';
    import { fade, scale } from 'svelte/transition';
    import { quintOut } from 'svelte/easing';
  
    const dispatch = createEventDispatcher();
  
    // Props
    export let roomId = '';
    export let streamerAddress = '';
    export let streamerName = '';
    export let allMessages = [];
    export let localMempoolMessages = [];
    export let isVisible = true;
    export let compact = false; // For smaller display in ThreadedMessage
  
    // State
    let donationStats = {
      totalDonations: 0,
      totalERG: 0,
      giftCount: 0,
      tipCount: 0,
      uniqueDonors: 0,
      topGifts: [],
      recentDonations: [],
      donorLeaderboard: []
    };
  
    let showDetails = false;
    let animateTotal = false;
  
    // Reactive calculations
    $: if (roomId && (allMessages.length > 0 || localMempoolMessages.length > 0)) {
      calculateDonationStats();
    }
  
    // Calculate donation statistics
    function calculateDonationStats() {
      try {
        const combinedMessages = [...allMessages, ...localMempoolMessages];
        
        // Filter messages for this stream room
        const streamMessages = combinedMessages.filter(msg => 
          msg.chatroomId === roomId || 
          (roomId.startsWith('stream-') && msg.chatroomId === roomId)
        );
  
        console.log(`Calculating donations for room ${roomId}:`, streamMessages.length, 'messages');
  
        // Reset stats
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
  
        // Process each message
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
              stats.donorAmounts[donorAddress] = { amount: 0, count: 0, name: truncateAddress(donorAddress) };
            }
            stats.donorAmounts[donorAddress].amount += donationAmount;
            stats.donorAmounts[donorAddress].count++;
  
            // Add to recent donations (keep last 10)
            stats.recentDonations.unshift({
              amount: donationAmount,
              type: donationType,
              donor: donorAddress,
              timestamp: msg.timestamp,
              giftData: msg.giftData || null
            });
          }
        }
  
        // Finalize stats
        donationStats = {
          totalDonations: stats.totalDonations,
          totalERG: stats.totalERG,
          giftCount: stats.giftCount,
          tipCount: stats.tipCount,
          uniqueDonors: stats.uniqueDonors.size,
          topGifts: Object.entries(stats.giftsByType)
            .map(([name, data]) => ({ name, ...data }))
            .sort((a, b) => b.amount - a.amount)
            .slice(0, 5),
          recentDonations: stats.recentDonations.slice(0, 10),
          donorLeaderboard: Object.entries(stats.donorAmounts)
            .map(([address, data]) => ({ address, ...data }))
            .sort((a, b) => b.amount - a.amount)
            .slice(0, 10)
        };
  
        // Trigger animation if total changed
        if (donationStats.totalERG !== stats.totalERG) {
          animateTotal = true;
          setTimeout(() => animateTotal = false, 1000);
        }
  
        console.log('Donation stats calculated:', donationStats);
  
      } catch (error) {
        console.error('Error calculating donation stats:', error);
      }
    }
  
    // Format ERG amount
    function formatERG(amount) {
      if (amount === 0) return '0';
      if (amount < 0.001) return '< 0.001';
      if (amount < 1) return amount.toFixed(3);
      if (amount < 10) return amount.toFixed(2);
      return amount.toFixed(1);
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
  
    // Truncate address
    function truncateAddress(address) {
      if (!address || address.length < 12) return address || 'Unknown';
      return `${address.substring(0, 6)}...${address.substring(address.length - 4)}`;
    }
  
    // Toggle details
    function toggleDetails() {
      showDetails = !showDetails;
    }
  
    // Handle donation click
    function handleDonationClick() {
      dispatch('openGiftModal', {
        streamerAddress,
        streamerName,
        roomId
      });
    }
  
    onMount(() => {
      calculateDonationStats();
    });
  </script>
  
  {#if isVisible && roomId.startsWith('stream-')}
    <div class="donation-tracker {compact ? 'compact' : ''}" transition:fade={{ duration: 200 }}>
      <!-- Main Stats Display -->
      <div class="donation-summary" on:click={toggleDetails}>
        <div class="donation-header">
          <div class="donation-icon">
            <i class="fa-solid fa-heart"></i>
          </div>
          <div class="donation-main">
            <div class="total-amount {animateTotal ? 'animate' : ''}">
              <span class="amount">{formatERG(donationStats.totalERG)}</span>
              <span class="currency">ERG</span>
            </div>
            <div class="donation-subtitle">
              {donationStats.totalDonations} donation{donationStats.totalDonations === 1 ? '' : 's'}
              {#if donationStats.uniqueDonors > 0}
                • {donationStats.uniqueDonors} donor{donationStats.uniqueDonors === 1 ? '' : 's'}
              {/if}
            </div>
          </div>
          {#if !compact}
            <div class="action-buttons">
              <button class="donate-btn" on:click|stopPropagation={handleDonationClick}>
                <i class="fa-solid fa-gift"></i>
                Donate
              </button>
              <button class="expand-btn {showDetails ? 'expanded' : ''}">
                <i class="fa-solid fa-chevron-down"></i>
              </button>
            </div>
          {/if}
        </div>
  
        <!-- Quick Stats -->
        {#if !compact && (donationStats.giftCount > 0 || donationStats.tipCount > 0)}
          <div class="quick-stats">
            {#if donationStats.giftCount > 0}
              <div class="stat-item">
                <i class="fa-solid fa-gift"></i>
                <span>{donationStats.giftCount} gift{donationStats.giftCount === 1 ? '' : 's'}</span>
              </div>
            {/if}
            {#if donationStats.tipCount > 0}
              <div class="stat-item">
                <i class="fa-solid fa-coins"></i>
                <span>{donationStats.tipCount} tip{donationStats.tipCount === 1 ? '' : 's'}</span>
              </div>
            {/if}
          </div>
        {/if}
      </div>
  
      <!-- Detailed Stats (Expandable) -->
      {#if showDetails && !compact}
        <div class="donation-details" transition:scale={{ duration: 300, easing: quintOut }}>
          
          <!-- Top Gifts -->
          {#if donationStats.topGifts.length > 0}
            <div class="detail-section">
              <h4>Top Gifts</h4>
              <div class="gifts-list">
                {#each donationStats.topGifts as gift}
                  <div class="gift-item">
                    <span class="gift-emoji">{gift.emoji}</span>
                    <span class="gift-name">{gift.name}</span>
                    <span class="gift-stats">×{gift.count} ({formatERG(gift.amount)} ERG)</span>
                  </div>
                {/each}
              </div>
            </div>
          {/if}
  
          <!-- Top Donors -->
          {#if donationStats.donorLeaderboard.length > 0}
            <div class="detail-section">
              <h4>Top Donors</h4>
              <div class="donors-list">
                {#each donationStats.donorLeaderboard.slice(0, 5) as donor, index}
                  <div class="donor-item">
                    <div class="donor-rank">#{index + 1}</div>
                    <div class="donor-info">
                      <span class="donor-name">{donor.name}</span>
                      <span class="donor-stats">{formatERG(donor.amount)} ERG • {donor.count} donation{donor.count === 1 ? '' : 's'}</span>
                    </div>
                  </div>
                {/each}
              </div>
            </div>
          {/if}
  
          <!-- Recent Donations -->
          {#if donationStats.recentDonations.length > 0}
            <div class="detail-section">
              <h4>Recent Donations</h4>
              <div class="recent-list">
                {#each donationStats.recentDonations.slice(0, 5) as donation}
                  <div class="recent-item">
                    <div class="recent-icon">
                      {#if donation.type === 'gift' && donation.giftData}
                        <span class="gift-emoji">{donation.giftData.giftEmoji}</span>
                      {:else}
                        <i class="fa-solid fa-coins"></i>
                      {/if}
                    </div>
                    <div class="recent-info">
                      <span class="recent-amount">{formatERG(donation.amount)} ERG</span>
                      <span class="recent-details">
                        from {truncateAddress(donation.donor)} • {timeAgo(donation.timestamp)}
                      </span>
                    </div>
                  </div>
                {/each}
              </div>
            </div>
          {/if}
        </div>
      {/if}
    </div>
  {/if}
  
  <style>
    .donation-tracker {
      background: linear-gradient(135deg, rgba(255, 85, 0, 0.1), rgba(255, 85, 0, 0.05));
      border: 1px solid rgba(255, 85, 0, 0.3);
      border-radius: 12px;
      margin: 1rem 0;
      overflow: hidden;
      transition: all 0.3s ease;
    }
  
    .donation-tracker:hover {
      border-color: rgba(255, 85, 0, 0.5);
      box-shadow: 0 4px 20px rgba(255, 85, 0, 0.1);
    }
  
    .donation-tracker.compact {
      margin: 0.5rem 0;
      background: rgba(255, 85, 0, 0.05);
    }
  
    .donation-summary {
      padding: 1rem;
      cursor: pointer;
      transition: background 0.2s ease;
    }
  
    .donation-summary:hover {
      background: rgba(255, 85, 0, 0.05);
    }
  
    .donation-header {
      display: flex;
      align-items: center;
      gap: 0.75rem;
    }
  
    .donation-icon {
      width: 40px;
      height: 40px;
      background: linear-gradient(135deg, #FF5500, #ff7f39);
      border-radius: 50%;
      display: flex;
      align-items: center;
      justify-content: center;
      color: white;
      font-size: 1.1rem;
      animation: pulse 2s infinite;
    }
  
    .compact .donation-icon {
      width: 32px;
      height: 32px;
      font-size: 0.9rem;
    }
  
    @keyframes pulse {
      0%, 100% { transform: scale(1); }
      50% { transform: scale(1.05); }
    }
  
    .donation-main {
      flex: 1;
    }
  
    .total-amount {
      display: flex;
      align-items: baseline;
      gap: 0.25rem;
      transition: all 0.3s ease;
    }
  
    .total-amount.animate {
      transform: scale(1.1);
      filter: brightness(1.2);
    }
  
    .amount {
      font-size: 1.5rem;
      font-weight: 700;
      color: #FF5500;
      font-family: monospace;
    }
  
    .compact .amount {
      font-size: 1.2rem;
    }
  
    .currency {
      font-size: 0.9rem;
      color: rgba(255, 85, 0, 0.7);
      font-weight: 600;
    }
  
    .donation-subtitle {
      color: rgba(255, 255, 255, 0.7);
      font-size: 0.8rem;
      margin-top: 0.25rem;
    }
  
    .compact .donation-subtitle {
      font-size: 0.7rem;
    }
  
    .action-buttons {
      display: flex;
      align-items: center;
      gap: 0.5rem;
    }
  
    .donate-btn {
      display: flex;
      align-items: center;
      gap: 0.5rem;
      background: linear-gradient(135deg, #FF5500, #ff7f39);
      color: white;
      border: none;
      border-radius: 8px;
      padding: 0.5rem 0.75rem;
      font-size: 0.8rem;
      font-weight: 600;
      cursor: pointer;
      transition: all 0.2s ease;
    }
  
    .donate-btn:hover {
      background: linear-gradient(135deg, #ff7f39, #FF5500);
      transform: translateY(-1px);
      box-shadow: 0 4px 15px rgba(255, 85, 0, 0.3);
    }
  
    .expand-btn {
      background: none;
      border: none;
      color: rgba(255, 255, 255, 0.5);
      cursor: pointer;
      padding: 0.5rem;
      border-radius: 50%;
      transition: all 0.2s ease;
      width: 32px;
      height: 32px;
      display: flex;
      align-items: center;
      justify-content: center;
    }
  
    .expand-btn:hover {
      background: rgba(255, 255, 255, 0.1);
      color: white;
    }
  
    .expand-btn.expanded {
      transform: rotate(180deg);
    }
  
    .quick-stats {
      display: flex;
      gap: 1rem;
      margin-top: 0.75rem;
      padding-top: 0.75rem;
      border-top: 1px solid rgba(255, 255, 255, 0.1);
    }
  
    .stat-item {
      display: flex;
      align-items: center;
      gap: 0.5rem;
      color: rgba(255, 255, 255, 0.7);
      font-size: 0.8rem;
    }
  
    .stat-item i {
      color: #FF5500;
    }
  
    .donation-details {
      border-top: 1px solid rgba(255, 255, 255, 0.1);
      padding: 1rem;
      background: rgba(0, 0, 0, 0.2);
    }
  
    .detail-section {
      margin-bottom: 1.5rem;
    }
  
    .detail-section:last-child {
      margin-bottom: 0;
    }
  
    .detail-section h4 {
      color: white;
      font-size: 0.9rem;
      font-weight: 600;
      margin: 0 0 0.75rem;
      display: flex;
      align-items: center;
      gap: 0.5rem;
    }
  
    .gifts-list,
    .donors-list,
    .recent-list {
      display: flex;
      flex-direction: column;
      gap: 0.5rem;
    }
  
    .gift-item,
    .donor-item,
    .recent-item {
      display: flex;
      align-items: center;
      gap: 0.75rem;
      padding: 0.5rem;
      background: rgba(255, 255, 255, 0.05);
      border-radius: 8px;
      transition: background 0.2s ease;
    }
  
    .gift-item:hover,
    .donor-item:hover,
    .recent-item:hover {
      background: rgba(255, 255, 255, 0.1);
    }
  
    .gift-emoji {
      font-size: 1.2rem;
      min-width: 24px;
      text-align: center;
    }
  
    .gift-name {
      color: white;
      font-weight: 500;
      flex: 1;
    }
  
    .gift-stats {
      color: rgba(255, 255, 255, 0.7);
      font-size: 0.8rem;
      font-family: monospace;
    }
  
    .donor-rank {
      width: 24px;
      height: 24px;
      background: rgba(255, 85, 0, 0.2);
      border-radius: 50%;
      display: flex;
      align-items: center;
      justify-content: center;
      color: #FF5500;
      font-weight: 700;
      font-size: 0.7rem;
    }
  
    .donor-info {
      flex: 1;
      display: flex;
      flex-direction: column;
    }
  
    .donor-name {
      color: white;
      font-weight: 500;
      font-size: 0.8rem;
    }
  
    .donor-stats {
      color: rgba(255, 255, 255, 0.7);
      font-size: 0.7rem;
    }
  
    .recent-icon {
      width: 24px;
      height: 24px;
      display: flex;
      align-items: center;
      justify-content: center;
      color: #FF5500;
    }
  
    .recent-info {
      flex: 1;
      display: flex;
      flex-direction: column;
    }
  
    .recent-amount {
      color: white;
      font-weight: 600;
      font-size: 0.8rem;
      font-family: monospace;
    }
  
    .recent-details {
      color: rgba(255, 255, 255, 0.7);
      font-size: 0.7rem;
    }
  
    /* Mobile Responsive */
    @media (max-width: 768px) {
      .donation-tracker {
        margin: 0.75rem 0;
      }
  
      .donation-header {
        gap: 0.5rem;
      }
  
      .amount {
        font-size: 1.3rem;
      }
  
      .action-buttons {
        flex-direction: column;
        gap: 0.25rem;
      }
  
      .donate-btn {
        padding: 0.4rem 0.6rem;
        font-size: 0.7rem;
      }
  
      .quick-stats {
        flex-direction: column;
        gap: 0.5rem;
      }
  
      .donation-details {
        padding: 0.75rem;
      }
    }
  
    @media (max-width: 480px) {
      .donation-header {
        flex-direction: column;
        align-items: flex-start;
        gap: 0.75rem;
      }
  
      .action-buttons {
        flex-direction: row;
        width: 100%;
        justify-content: space-between;
      }
  
      .donate-btn {
        flex: 1;
        justify-content: center;
      }
    }
  </style>