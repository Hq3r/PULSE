<!-- ServiceCardsGrid.svelte - Component for displaying services in a responsive grid with minimal cards -->
<script lang="ts">
    // Define card interfaces
    interface ServiceCard {
      id: string;
      title: string;
      description: string;
      icon: string;
      iconColor: string;
      link: string;
    }
    
    // Card data with icons instead of images
    const serviceCards: ServiceCard[] = [
      {
        id: 'dex',
        title: 'DEX',
        description: 'Trade all Ergo native and wrapped assets with low fees',
        icon: 'fa-chart-line',
        iconColor: 'text-cyan-400',
        link: 'https://dex.mewfinance.com'
      },
      {
        id: 'nft',
        title: 'NFT Mart',
        description: 'Marketplace for digital assets and NFTs',
        icon: 'fa-image',
        iconColor: 'text-yellow-400',
        link: 'https://mart.mewfinance.com'
      },
      {
        id: 'store',
        title: 'Store',
        description: 'Marketplace for phygital assets and services',
        icon: 'fa-store',
        iconColor: 'text-pink-400',
        link: 'https://store.mewfinance.com'
      },
      {
        id: 'bank',
        title: 'Bank',
        description: 'DeFi interface for stablecoins',
        icon: 'fa-landmark',
        iconColor: 'text-purple-400',
        link: 'https://bank.mewfinance.com'
      },
      {
        id: 'fund',
        title: 'Fund',
        description: 'Platform for fundraising projects',
        icon: 'fa-dollar-sign',
        iconColor: 'text-green-400',
        link: 'https://fund.mewfinance.com'
      },
      {
        id: 'bridge',
        title: 'Bridge',
        description: 'Transfer NFTs between blockchains',
        icon: 'fa-link',
        iconColor: 'text-teal-400',
        link: 'https://bridge.mewfinance.com'
      },
      {
        id: 'trading',
        title: 'Trading',
        description: 'Dashboard for tracking assets',
        icon: 'fa-chart-bar',
        iconColor: 'text-amber-400',
        link: 'https://trading.mewfinance.com'
      },
      {
        id: 'fun',
        title: 'Fun',
        description: 'Blockchain-powered lottery services',
        icon: 'fa-dice',
        iconColor: 'text-indigo-400',
        link: 'https://fun.mewfinance.com'
      },
      {
        id: 'ergosanta',
        title: 'Ergosanta',
        description: 'Digital gifts via proof of work',
        icon: 'fa-gifts',
        iconColor: 'text-red-400',
        link: 'https://santa.mewfinance.com'
      },
      {
        id: 'ergotools',
        title: 'Ergo Tools',
        description: 'Mint, burn, airdrop Ergo tokens',
        icon: 'fa-tools',
        iconColor: 'text-blue-400',
        link: 'https://tools.mewfinance.com'
      },
      {
        id: 'cardanotools',
        title: 'Cardano Tools',
        description: 'Mint and airdrop Cardano tokens',
        icon: 'fa-wrench',
        iconColor: 'text-orange-400',
        link: 'https://ctools.mewfinance.com'
      }
    ];
    
    // Props
    export let showInInfoModal = false; // Whether this is shown in info modal
  </script>
  
  <section class="service-cards-grid {showInInfoModal ? 'in-modal' : ''}">
    {#if !showInInfoModal}
      <h2 class="section-title">Ergo Ecosystem Services</h2>
    {/if}
    
    <div class="service-cards">
      {#each serviceCards as card (card.id)}
        <a href={card.link} target="_blank" rel="noopener noreferrer" class="service-card">
          <div class="card-icon {card.iconColor}">
            <i class="fa-solid {card.icon}"></i>
          </div>
          <div class="card-content">
            <h3 class="card-title">{card.title}</h3>
            <p class="card-description">{card.description}</p>
          </div>
        </a>
      {/each}
    </div>
  </section>
  
  <style>
    .service-cards-grid {
      width: 100%;
      margin: 1rem 0;
    }
    
    .service-cards-grid.in-modal {
      margin: 0;
    }
    
    .section-title {
      font-size: 1.5rem;
      color: #FF5500;
      margin-bottom: 1rem;
      text-align: center;
    }
    
    .service-cards {
      display: grid;
      grid-template-columns: repeat(auto-fill, minmax(150px, 1fr));
      gap: 0.75rem;
    }
    
    .in-modal .service-cards {
      grid-template-columns: repeat(auto-fill, minmax(120px, 1fr));
      gap: 0.5rem;
    }
    
    .service-card {
      display: flex;
      flex-direction: column;
      background: rgba(255, 255, 255, 0.05);
      border-radius: 0.5rem;
      overflow: hidden;
      border: 1px solid rgba(255, 255, 255, 0.1);
      transition: all 0.2s ease;
      text-decoration: none;
      color: inherit;
      min-height: 120px;
      height: 100%;
    }
    
    .service-card:hover {
      background: rgba(255, 255, 255, 0.08);
      transform: translateY(-2px);
      border-color: rgba(255, 85, 0, 0.3);
      box-shadow: 0 4px 12px rgba(0, 0, 0, 0.1);
    }
    
    .card-icon {
      padding: 0.75rem;
      display: flex;
      align-items: center;
      justify-content: center;
      font-size: 1.5rem;
    }
    
    .in-modal .card-icon {
      padding: 0.5rem;
      font-size: 1.25rem;
    }
    
    .card-content {
      padding: 0.5rem 0.75rem 0.75rem;
      display: flex;
      flex-direction: column;
      flex: 1;
    }
    
    .in-modal .card-content {
      padding: 0.25rem 0.5rem 0.5rem;
    }
    
    .card-title {
      font-size: 1rem;
      font-weight: 600;
      margin: 0 0 0.25rem 0;
      color: #ff5500;
    }
    
    .in-modal .card-title {
      font-size: 0.9rem;
      margin: 0 0 0.15rem 0;
    }
    
    .card-description {
      font-size: 0.8rem;
      color: #BBB;
      margin: 0;
      line-height: 1.3;
    }
    
    .in-modal .card-description {
      font-size: 0.7rem;
      line-height: 1.2;
    }
    
    /* Responsive styles */
    @media (max-width: 768px) {
      .service-cards {
        grid-template-columns: repeat(auto-fill, minmax(120px, 1fr));
      }
      
      .in-modal .service-cards {
        grid-template-columns: repeat(auto-fill, minmax(100px, 1fr));
      }
    }
    
    @media (max-width: 480px) {
      .service-cards {
        grid-template-columns: repeat(auto-fill, minmax(100px, 1fr));
      }
      
      .in-modal .service-cards {
        grid-template-columns: repeat(auto-fill, minmax(80px, 1fr));
      }
      
      .card-title {
        font-size: 0.9rem;
      }
      
      .card-description {
        font-size: 0.7rem;
      }
      
      .in-modal .card-title {
        font-size: 0.8rem;
      }
      
      .in-modal .card-description {
        font-size: 0.65rem;
      }
    }
    
  </style>