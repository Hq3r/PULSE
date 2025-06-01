<script>
    import { createEventDispatcher } from 'svelte';
    import { slide, fade } from 'svelte/transition';
    
    const dispatch = createEventDispatcher();
    
    export let isVisible = false;
    export let userAchievements = {
      unlockedAchievements: [],
      progress: [],
      stats: {}
    };
    
    let selectedTab = 'unlocked'; // 'unlocked', 'progress', 'stats'
    
    function closeModal() {
      isVisible = false;
      dispatch('close');
    }
    
    function formatProgress(progress) {
      return `${progress.currentValue} / ${progress.targetValue}`;
    }
    
    function getProgressPercentage(progress) {
      return Math.round(progress.progress * 100);
    }
    
    function formatStat(key, value) {
      switch (key) {
        case 'message_count':
          return `${value} messages sent`;
        case 'tips_sent':
          return `${value} tips sent`;
        case 'erg_tipped':
          return `${value.toFixed(3)} ERG tipped`;
        case 'rooms_visited':
          return `${Array.isArray(value) ? value.length : 0} rooms visited`;
        default:
          return `${value}`;
      }
    }
  </script>
  
  {#if isVisible}
    <div class="modal-overlay" on:click|self={closeModal} transition:fade={{ duration: 200 }}>
      <div class="achievement-modal" transition:slide={{ duration: 300 }}>
        <!-- Modal Header -->
        <div class="modal-header">
          <h2>🏆 Achievements</h2>
          <button class="close-btn" on:click={closeModal}>
            <i class="fa-solid fa-times"></i>
          </button>
        </div>
        
        <!-- Tab Navigation -->
        <div class="tab-nav">
          <button 
            class="tab-btn {selectedTab === 'unlocked' ? 'active' : ''}"
            on:click={() => selectedTab = 'unlocked'}
          >
            Unlocked ({userAchievements.unlockedAchievements.length})
          </button>
          <button 
            class="tab-btn {selectedTab === 'progress' ? 'active' : ''}"
            on:click={() => selectedTab = 'progress'}
          >
            Progress
          </button>
          <button 
            class="tab-btn {selectedTab === 'stats' ? 'active' : ''}"
            on:click={() => selectedTab = 'stats'}
          >
            Stats
          </button>
        </div>
        
        <!-- Modal Body -->
        <div class="modal-body">
          {#if selectedTab === 'unlocked'}
            <div class="achievements-grid">
              {#if userAchievements.unlockedAchievements.length === 0}
                <div class="empty-state">
                  <i class="fa-solid fa-trophy"></i>
                  <p>No achievements unlocked yet</p>
                  <small>Keep chatting and tipping to earn your first achievement!</small>
                </div>
              {:else}
                {#each userAchievements.unlockedAchievements as achievement}
                  <div class="achievement-card unlocked">
                    <div class="achievement-icon">{achievement.icon}</div>
                    <div class="achievement-info">
                      <h4>{achievement.name}</h4>
                      <p>{achievement.description}</p>
                      <span class="achievement-category">{achievement.category}</span>
                    </div>
                    <div class="achievement-status">
                      <i class="fa-solid fa-check"></i>
                    </div>
                  </div>
                {/each}
              {/if}
            </div>
          {:else if selectedTab === 'progress'}
            <div class="progress-list">
              {#each userAchievements.progress as achievement}
                <div class="progress-item {achievement.isUnlocked ? 'completed' : ''}">
                  <div class="progress-header">
                    <div class="progress-icon">{achievement.icon}</div>
                    <div class="progress-info">
                      <h4>{achievement.name}</h4>
                      <p>{achievement.description}</p>
                    </div>
                    <div class="progress-status">
                      {#if achievement.isUnlocked}
                        <i class="fa-solid fa-check completed"></i>
                      {:else}
                        <span class="progress-text">{formatProgress(achievement)}</span>
                      {/if}
                    </div>
                  </div>
                  <div class="progress-bar">
                    <div 
                      class="progress-fill {achievement.isUnlocked ? 'completed' : ''}"
                      style="width: {getProgressPercentage(achievement)}%"
                    ></div>
                  </div>
                  <div class="progress-percentage">
                    {getProgressPercentage(achievement)}%
                  </div>
                </div>
              {/each}
            </div>
          {:else if selectedTab === 'stats'}
            <div class="stats-grid">
              {#each Object.entries(userAchievements.stats) as [key, value]}
                {#if !['unlocked_achievements', 'last_active', 'join_date'].includes(key)}
                  <div class="stat-card">
                    <div class="stat-value">
                      {#if key === 'erg_tipped' || key === 'erg_received'}
                        {value.toFixed(3)}
                      {:else if Array.isArray(value)}
                        {value.length}
                      {:else}
                        {value}
                      {/if}
                    </div>
                    <div class="stat-label">{formatStat(key, value)}</div>
                  </div>
                {/if}
              {/each}
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
      background-color: rgba(0, 0, 0, 0.7);
      display: flex;
      align-items: center;
      justify-content: center;
      z-index: 1000;
      padding: 20px;
    }
  
    .achievement-modal {
      background-color: #262626;
      border-radius: 12px;
      width: 100%;
      max-width: 600px;
      max-height: 80vh;
      display: flex;
      flex-direction: column;
      box-shadow: 0 20px 60px rgba(0, 0, 0, 0.5);
      border: 1px solid rgba(255, 85, 0, 0.2);
    }
  
    .modal-header {
      display: flex;
      justify-content: space-between;
      align-items: center;
      padding: 1.5rem;
      border-bottom: 1px solid rgba(255, 255, 255, 0.1);
      background: linear-gradient(135deg, rgba(255, 85, 0, 0.1), rgba(255, 85, 0, 0.05));
    }
  
    .modal-header h2 {
      margin: 0;
      color: #FF5500;
      font-size: 1.5rem;
    }
  
    .close-btn {
      background: none;
      border: none;
      color: #AAA;
      cursor: pointer;
      width: 2rem;
      height: 2rem;
      border-radius: 50%;
      display: flex;
      align-items: center;
      justify-content: center;
      transition: all 0.2s ease;
      font-size: 1.1rem;
    }
  
    .close-btn:hover {
      background-color: rgba(255, 255, 255, 0.1);
      color: white;
    }
  
    .tab-nav {
      display: flex;
      background-color: #1E1E1E;
      border-bottom: 1px solid rgba(255, 255, 255, 0.1);
    }
  
    .tab-btn {
      flex: 1;
      background: none;
      border: none;
      color: #AAA;
      padding: 1rem;
      cursor: pointer;
      transition: all 0.2s ease;
      border-bottom: 2px solid transparent;
    }
  
    .tab-btn:hover {
      background-color: rgba(255, 85, 0, 0.1);
      color: #FF5500;
    }
  
    .tab-btn.active {
      color: #FF5500;
      border-bottom-color: #FF5500;
      background-color: rgba(255, 85, 0, 0.1);
    }
  
    .modal-body {
      flex: 1;
      overflow-y: auto;
      padding: 1.5rem;
    }
  
    .achievements-grid {
      display: grid;
      gap: 1rem;
    }
  
    .achievement-card {
      display: flex;
      align-items: center;
      gap: 1rem;
      padding: 1rem;
      background-color: rgba(0, 0, 0, 0.3);
      border-radius: 8px;
      border: 1px solid rgba(255, 255, 255, 0.1);
      transition: all 0.2s ease;
    }
  
    .achievement-card.unlocked {
      border-color: rgba(255, 85, 0, 0.3);
      background-color: rgba(255, 85, 0, 0.1);
    }
  
    .achievement-icon {
      font-size: 2rem;
      width: 3rem;
      height: 3rem;
      display: flex;
      align-items: center;
      justify-content: center;
      background-color: rgba(255, 85, 0, 0.2);
      border-radius: 50%;
    }
  
    .achievement-info {
      flex: 1;
    }
  
    .achievement-info h4 {
      margin: 0 0 0.25rem 0;
      color: white;
      font-size: 1rem;
    }
  
    .achievement-info p {
      margin: 0 0 0.5rem 0;
      color: #CCC;
      font-size: 0.9rem;
    }
  
    .achievement-category {
      background-color: rgba(255, 85, 0, 0.2);
      color: #FF5500;
      padding: 0.2rem 0.5rem;
      border-radius: 12px;
      font-size: 0.75rem;
      text-transform: uppercase;
      font-weight: 500;
    }
  
    .achievement-status {
      color: #4CAF50;
      font-size: 1.5rem;
    }
  
    .progress-list {
      display: flex;
      flex-direction: column;
      gap: 1rem;
    }
  
    .progress-item {
      background-color: rgba(0, 0, 0, 0.3);
      border-radius: 8px;
      border: 1px solid rgba(255, 255, 255, 0.1);
      padding: 1rem;
    }
  
    .progress-item.completed {
      border-color: rgba(76, 175, 80, 0.3);
      background-color: rgba(76, 175, 80, 0.1);
    }
  
    .progress-header {
      display: flex;
      align-items: center;
      gap: 1rem;
      margin-bottom: 0.75rem;
    }
  
    .progress-icon {
      font-size: 1.5rem;
      width: 2.5rem;
      height: 2.5rem;
      display: flex;
      align-items: center;
      justify-content: center;
      background-color: rgba(255, 85, 0, 0.2);
      border-radius: 50%;
    }
  
    .progress-info {
      flex: 1;
    }
  
    .progress-info h4 {
      margin: 0 0 0.25rem 0;
      color: white;
      font-size: 0.95rem;
    }
  
    .progress-info p {
      margin: 0;
      color: #CCC;
      font-size: 0.85rem;
    }
  
    .progress-status {
      color: #AAA;
      font-size: 0.9rem;
    }
  
    .progress-status .completed {
      color: #4CAF50;
    }
  
    .progress-bar {
      width: 100%;
      height: 8px;
      background-color: rgba(255, 255, 255, 0.1);
      border-radius: 4px;
      overflow: hidden;
      margin-bottom: 0.5rem;
    }
  
    .progress-fill {
      height: 100%;
      background-color: #FF5500;
      transition: width 0.3s ease;
      border-radius: 4px;
    }
  
    .progress-fill.completed {
      background-color: #4CAF50;
    }
  
    .progress-percentage {
      text-align: right;
      color: #AAA;
      font-size: 0.8rem;
    }
  
    .stats-grid {
      display: grid;
      grid-template-columns: repeat(auto-fit, minmax(200px, 1fr));
      gap: 1rem;
    }
  
    .stat-card {
      background-color: rgba(0, 0, 0, 0.3);
      border-radius: 8px;
      border: 1px solid rgba(255, 255, 255, 0.1);
      padding: 1.5rem;
      text-align: center;
    }
  
    .stat-value {
      font-size: 2rem;
      font-weight: bold;
      color: #FF5500;
      margin-bottom: 0.5rem;
    }
  
    .stat-label {
      color: #CCC;
      font-size: 0.9rem;
    }
  
    .empty-state {
      text-align: center;
      padding: 3rem 2rem;
      color: #AAA;
    }
  
    .empty-state i {
      font-size: 3rem;
      margin-bottom: 1rem;
      color: #666;
    }
  
    .empty-state p {
      font-size: 1.1rem;
      margin-bottom: 0.5rem;
    }
  
    .empty-state small {
      font-size: 0.9rem;
    }
  
    @media (max-width: 768px) {
      .achievement-modal {
        margin: 10px;
        max-height: 90vh;
      }
  
      .modal-header {
        padding: 1rem;
      }
  
      .modal-body {
        padding: 1rem;
      }
  
      .tab-btn {
        padding: 0.75rem 0.5rem;
        font-size: 0.9rem;
      }
  
      .stats-grid {
        grid-template-columns: 1fr;
      }
    }
  </style>
  