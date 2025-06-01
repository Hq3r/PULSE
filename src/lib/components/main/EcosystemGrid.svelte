<!-- EcosystemGrid.svelte - Component for displaying Ergo ecosystem dApps -->
<script lang="ts">
    import { onMount } from 'svelte';
    
    // Props
    export let itemsPerRow = 3; // Default for desktop, will be responsive
    export let compact = false; // Whether to use compact card style
    
    // State
    let apps = [];
    let categories = [];
    let isLoading = true;
    let error = null;
    let selectedCategory = 'All';
    
    // Set category filter
    function setCategory(category) {
      selectedCategory = category;
    }
    
    // Initialize data
    onMount(async () => {
      await fetchEcosystemData();
    });
    
    // Fetch data from the API
    async function fetchEcosystemData() {
      isLoading = true;
      error = null;
      
      try {
        const response = await fetch('https://sigma-admin.ergoplatform.com/api/project-cards?populate=%2A&pagination[pageSize]=25&pagination[page]=1');
        
        if (!response.ok) {
          throw new Error(`API error: ${response.status}`);
        }
        
        const data = await response.json();
        
        // Extract categories from data
        const categorySet = new Set(['All']);
        
        // Map the data to our format
        apps = data.data.map(item => {
          // Infer category from description or name
          const description = item.attributes.description || '';
          const name = item.attributes.name || '';
          
          let category = 'Other';
          
          if (description.toLowerCase().includes('dex') || name.toLowerCase().includes('dex')) {
            category = 'DEX';
          } else if (description.toLowerCase().includes('nft') || name.toLowerCase().includes('nft')) {
            category = 'NFT';
          } else if (description.toLowerCase().includes('defi') || 
                   description.toLowerCase().includes('finance') || 
                   description.toLowerCase().includes('staking')) {
            category = 'DeFi';
          } else if (description.toLowerCase().includes('wallet') || name.toLowerCase().includes('wallet')) {
            category = 'Wallet';
          } else if (description.toLowerCase().includes('game') || 
                   description.toLowerCase().includes('play') || 
                   name.toLowerCase().includes('game')) {
            category = 'Gaming';
          } else if (description.toLowerCase().includes('tool') || 
                   name.toLowerCase().includes('explorer') || 
                   name.toLowerCase().includes('scan')) {
            category = 'Tools';
          }
          
          categorySet.add(category);
          
          return {
            id: item.id,
            name: item.attributes.name,
            description: item.attributes.description,
            websiteLink: item.attributes.websiteLink,
            category: category,
            imageUrl: item.attributes.logotype?.data?.attributes?.url 
              ? `https://sigma-admin.ergoplatform.com${item.attributes.logotype.data.attributes.url}`
              : '/placeholder.png'
          };
        });
        
        // Sort categories and create array
        categories = Array.from(categorySet).sort();
        
      } catch (err) {
        console.error("Error fetching ecosystem data:", err);
        error = err.message;
      } finally {
        isLoading = false;
      }
    }
    
    // Filter apps by selected category
    $: filteredApps = selectedCategory === 'All' 
      ? apps 
      : apps.filter(app => app.category === selectedCategory);
  </script>
  
  <div class="ecosystem-grid-container">
    <!-- Category Filters -->
    <div class="categories-container">
      <div class="categories">
        {#each categories as category}
          <button 
            class="category-button {selectedCategory === category ? 'active' : ''}"
            on:click={() => setCategory(category)}
          >
            {category}
          </button>
        {/each}
      </div>
    </div>
    
    <!-- Loading State -->
    {#if isLoading}
      <div class="loading-state">
        <div class="spinner"></div>
        <p>Loading ecosystem data...</p>
      </div>
    
    <!-- Error State -->
    {:else if error}
      <div class="error-state">
        <i class="fa-solid fa-exclamation-triangle"></i>
        <p>Error loading ecosystem data: {error}</p>
        <button class="retry-button" on:click={fetchEcosystemData}>
          Retry
        </button>
      </div>
    
    <!-- Empty State -->
    {:else if apps.length === 0}
      <div class="empty-state">
        <i class="fa-solid fa-cube"></i>
        <p>No ecosystem data available</p>
        <button class="retry-button" on:click={fetchEcosystemData}>
          Reload Data
        </button>
      </div>
    
    <!-- App Grid -->
    {:else}
      <div class="grid {compact ? 'compact' : ''}" style="--items-per-row: {itemsPerRow};">
        {#each filteredApps as app (app.id)}
          <a href={app.websiteLink} target="_blank" rel="noopener noreferrer" class="app-card">
            <div class="app-image">
              <img src={app.imageUrl} alt={app.name} loading="lazy" />
            </div>
            <div class="app-content">
              <h4 class="app-name">{app.name}</h4>
              
              {#if !compact}
                <div class="app-category">{app.category}</div>
                <p class="app-description">
                  {app.description.length > 100 ? app.description.substring(0, 100) + '...' : app.description}
                </p>
              {/if}
            </div>
          </a>
        {/each}
      </div>
    {/if}
  </div>
  
  <style>
    .ecosystem-grid-container {
      width: 100%;
    }
    
    .categories-container {
      overflow-x: auto;
      margin-bottom: 1rem;
    }
    
    .categories {
      display: flex;
      gap: 0.5rem;
      padding-bottom: 0.25rem;
      white-space: nowrap;
    }
    
    .category-button {
      background-color: rgba(255, 255, 255, 0.05);
      border: none;
      color: #CCC;
      padding: 0.5rem 1rem;
      border-radius: 4px;
      cursor: pointer;
      font-size: 0.9rem;
      transition: all 0.2s ease;
    }
    
    .category-button:hover {
      background-color: rgba(255, 255, 255, 0.1);
      color: white;
    }
    
    .category-button.active {
      background-color: #FF5500;
      color: white;
    }
    
    .grid {
      display: grid;
      grid-template-columns: repeat(var(--items-per-row), 1fr);
      gap: 1rem;
    }
    
    .grid.compact {
      gap: 0.5rem;
    }
    
    .app-card {
      display: flex;
      flex-direction: column;
      background-color: rgba(255, 255, 255, 0.05);
      border-radius: 8px;
      overflow: hidden;
      transition: all 0.2s ease;
      text-decoration: none;
      color: inherit;
      height: 100%;
      border: 1px solid transparent;
    }
    
    .app-card:hover {
      background-color: rgba(255, 255, 255, 0.08);
      transform: translateY(-2px);
      border-color: rgba(255, 85, 0, 0.3);
    }
    
    .app-image {
      height: 80px;
      display: flex;
      align-items: center;
      justify-content: center;
      background-color: #222;
      padding: 0.5rem;
    }
    
    .compact .app-image {
      height: 60px;
    }
    
    .app-image img {
      max-width: 100%;
      max-height: 100%;
      object-fit: contain;
    }
    
    .app-content {
      padding: 0.75rem;
      display: flex;
      flex-direction: column;
      flex: 1;
    }
    
    .compact .app-content {
      padding: 0.5rem;
    }
    
    .app-name {
      margin: 0 0 0.25rem 0;
      font-size: 1rem;
      color: #FF5500;
      overflow: hidden;
      text-overflow: ellipsis;
      white-space: nowrap;
    }
    
    .compact .app-name {
      font-size: 0.85rem;
    }
    
    .app-category {
      font-size: 0.7rem;
      background-color: rgba(255, 85, 0, 0.1);
      color: #FF5500;
      padding: 0.15rem 0.5rem;
      border-radius: 4px;
      display: inline-block;
      margin-bottom: 0.5rem;
    }
    
    .app-description {
      margin: 0;
      font-size: 0.8rem;
      color: #CCC;
      line-height: 1.4;
      flex: 1;
      overflow: hidden;
      display: -webkit-box;
      -webkit-line-clamp: 3;
      -webkit-box-orient: vertical;
    }
    
    /* Loading/Error States */
    .loading-state, .error-state, .empty-state {
      display: flex;
      flex-direction: column;
      align-items: center;
      justify-content: center;
      padding: 2rem;
      text-align: center;
    }
    
    .spinner {
      width: 2.5rem;
      height: 2.5rem;
      border: 3px solid rgba(255, 85, 0, 0.3);
      border-top-color: #FF5500;
      border-radius: 50%;
      animation: spin 1s linear infinite;
      margin-bottom: 1rem;
    }
    
    .error-state i, .empty-state i {
      font-size: 2.5rem;
      color: #FF5500;
      margin-bottom: 1rem;
    }
    
    .retry-button {
      margin-top: 1rem;
      background-color: #FF5500;
      color: white;
      border: none;
      border-radius: 4px;
      padding: 0.5rem 1rem;
      cursor: pointer;
      font-size: 0.9rem;
      transition: all 0.2s ease;
    }
    
    .retry-button:hover {
      background-color: #ff6a1f;
    }
    
    @keyframes spin {
      to {
        transform: rotate(360deg);
      }
    }
    
    /* Responsive styles */
    @media (max-width: 1024px) {
      .grid {
        --items-per-row: 3;
      }
    }
    
    @media (max-width: 768px) {
      .grid {
        --items-per-row: 2;
      }
    }
    
    @media (max-width: 480px) {
      .grid {
        --items-per-row: 2;
      }
      
      .grid.compact {
        --items-per-row: 3;
      }
      
      .compact .app-name {
        font-size: 0.75rem;
      }
    }
  </style>