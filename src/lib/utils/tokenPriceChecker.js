// tokenPriceChecker.js - Integration for ERGO Chat
// This module handles the /price command to fetch token prices

/**
 * Formats crypto prices with proper decimal precision
 * @param {number} num - The number to format
 * @param {number} minDecimals - Minimum number of decimal places
 * @param {boolean} isToken - Whether this is a token price (true) or a larger value (false)
 * @returns {string} Formatted number
 */
function formatCryptoPrice(num, minDecimals = 6, isToken = true) {
    if (num === 0) return "0";
    
    // For very small values (common in crypto), show at least minDecimals
    if (isToken && Math.abs(num) < 0.1) {
      // Find the first non-zero decimal place
      const firstNonZero = Math.floor(-Math.log10(Math.abs(num))) + 1;
      const decimals = Math.max(minDecimals, firstNonZero + 2); // At least 2 significant digits
      return num.toFixed(decimals);
    }
    
    // For larger values, use reasonable formatting
    return num.toFixed(minDecimals).replace(/\.?0+$/, "");
  }
  
  /**
   * Formats large numbers to be more readable
   * @param {number} num - The number to format
   * @param {number} digits - Number of significant digits
   * @returns {string} Formatted number
   */
  function nFormatter(num, digits = 2) {
    // For small values important in crypto, always show full precision
    if (Math.abs(num) < 0.1) {
      return formatCryptoPrice(num);
    }
    
    const lookup = [
      { value: 1, symbol: "" },
      { value: 1e3, symbol: "k" },
      { value: 1e6, symbol: "M" },
      { value: 1e9, symbol: "B" },
      { value: 1e12, symbol: "T" }
    ];
    const regex = /\.0+$|(\.[0-9]*[1-9])0+$/;
    const item = lookup
      .slice()
      .reverse()
      .find(function(item) {
        return num >= item.value;
      });
      
    return item ? (num / item.value).toFixed(digits).replace(regex, "$1") + item.symbol : "0";
  }
  
  /**
   * Formats volume/market cap for better readability
   * @param {number} volume - The volume to format
   * @returns {string} Formatted volume
   */
  function formatVolume(volume) {
    if (volume >= 1000000000) {
      return (volume / 1000000000).toFixed(2) + 'B';
    } else if (volume >= 1000000) {
      return (volume / 1000000).toFixed(2) + 'M';
    } else if (volume >= 1000) {
      return (volume / 1000).toFixed(2) + 'K';
    } else {
      return volume.toFixed(2);
    }
  }
  
  /**
   * Fetches ERGO price data from CoinGecko
   * @returns {Promise<Object>} The ERGO price data
   */
  async function fetchErgoPriceData() {
    try {
      const coingeckoApiUrl = `https://api.coingecko.com/api/v3/coins/ergo`;
      const response = await fetch(coingeckoApiUrl);
      const data = await response.json();
      return data;
    } catch (error) {
      console.error('Error fetching ERG price:', error);
      throw new Error('Could not fetch ERG price data');
    }
  }
  
  /**
   * Creates a formatted message with ERGO price data
   * @param {Object} data - The price data from CoinGecko
   * @returns {Object} The formatted message object
   */
  function formatErgoPriceMessage(data) {
    const name = data.name;
    const symbol = data.symbol.toUpperCase();
    const coinGeckoUrl = data.links.homepage[0];
    
    // Use full precision for crypto prices
    const priceUsd = formatCryptoPrice(data.market_data.current_price.usd);
    const priceBtc = formatCryptoPrice(data.market_data.current_price.btc);
    const highUsd = formatCryptoPrice(data.market_data.high_24h.usd);
    const lowUsd = formatCryptoPrice(data.market_data.low_24h.usd);
    const priceEth = formatCryptoPrice(data.market_data.current_price.eth);
    
    const change1h = data.market_data.price_change_percentage_1h_in_currency.usd;
    const change24h = data.market_data.price_change_percentage_24h_in_currency.usd;
    const change7d = data.market_data.price_change_percentage_7d_in_currency.usd;
    const volumeUsd = data.market_data.total_volume.usd;
    const marketCapUsd = data.market_data.market_cap.usd;
  
    // Define emojis based on price change
    const emoji1h = change1h >= 0 ? '🟢' : '🔴';
    const emoji24h = change24h >= 0 ? '🟢' : '🔴';
    const emoji7d = change7d >= 0 ? '🟢' : '🔴';
  
    return {
      type: 'ergo',
      title: `Ergo (${name}) - ${symbol}`,
      url: coinGeckoUrl,
      details: [
        { label: '💰 Price', value: `$${priceUsd} | ${priceBtc} ₿` },
        { label: '⚖️ High/Low', value: `$${highUsd} | $${lowUsd}` },
        { label: '✨ Price [ETH]', value: `${priceEth} Ξ` },
        { label: `${emoji1h} 1h`, value: `${change1h.toFixed(2)}%` },
        { label: `${emoji24h} 24h`, value: `${change24h.toFixed(2)}%` },
        { label: `${emoji7d} 7d`, value: `${change7d.toFixed(2)}%` },
        { label: '📊 Volume', value: `$${formatVolume(volumeUsd)}` },
        { label: '💎 MarketCap', value: `$${formatVolume(marketCapUsd)}` }
      ]
    };
  }
  
  /**
   * Fetches price data for a specific token
   * @param {string} tokenSymbol - The token symbol to fetch
   * @returns {Promise<Object>} The token price data
   */
  async function fetchTokenPriceData(tokenSymbol) {
    try {
      // Fetch the latest prices from the Spectrum API
      const spectrumApiUrl = 'https://api.spectrum.fi/v1/price-tracking/markets';
      const spectrumResponse = await fetch(spectrumApiUrl);
      const spectrumData = await spectrumResponse.json();
      
      const entry = spectrumData.find(
        (entry) =>
          entry.baseSymbol === 'ERG' &&
          entry.quoteSymbol.toUpperCase() === tokenSymbol.toUpperCase()
      );
  
      if (!entry) {
        throw new Error(`Token ${tokenSymbol} not found`);
      }
  
      // Calculate token price in ERG
      const lastPrice = Number(entry.lastPrice);
      const ergPrice = 1 / lastPrice; 
  
      // Fetch the latest Erg price from ErgExplorer API
      const ergExplorerApiUrl = 'https://api.ergexplorer.com/tokens/getErgPrice';
      const ergExplorerResponse = await fetch(ergExplorerApiUrl);
      const ergExplorerData = await ergExplorerResponse.json();
      const ergUsdPrice = Number(ergExplorerData.items[0].value);
  
      // Calculate USD price
      const usdPrice = ergPrice * ergUsdPrice;
  
      // Fetch the number of holders from Ergo Watch API
      const ergoWatchApiUrl = `https://api.ergo.watch/lists/addresses/by/balance?token_id=${entry.quoteId}&limit=10000`;
      const ergoWatchResponse = await fetch(ergoWatchApiUrl);
      const ergoWatchData = await ergoWatchResponse.json();
      const numberOfHolders = ergoWatchData.length;
  
      return {
        symbol: entry.quoteSymbol,
        tokenId: entry.quoteId,
        ergPrice,
        usdPrice,
        numberOfHolders
      };
    } catch (error) {
      console.error('Error fetching token price:', error);
      throw error;
    }
  }
  
  /**
   * Creates a formatted message with token price data
   * @param {Object} data - The token price data
   * @returns {Object} The formatted message object
   */
  function formatTokenPriceMessage(data) {
    // Format prices with at least 6 decimals
    const formattedErgPrice = formatCryptoPrice(data.ergPrice);
    const formattedUsdPrice = formatCryptoPrice(data.usdPrice);
    
    const crooksFiTradeUrl = `https://dex.Mewfinance.com/ergo/swap?base=0000000000000000000000000000000000000000000000000000000000000000&quote=${data.tokenId}`;
    const explorerUrl = `https://ergexplorer.com/token/${data.tokenId}`;
  
    return {
      type: 'token',
      title: `${data.symbol} Price Information`,
      tokenId: data.tokenId,
      explorerUrl,
      details: [
        { label: 'ERG Price', value: `${formattedErgPrice}Σ` },
        { label: 'USD Price', value: `$${formattedUsdPrice}` },
        { label: 'Holders', value: data.numberOfHolders.toString() }
      ],
      actions: [
        { label: 'Trade on MewFI', url: crooksFiTradeUrl },
        { label: 'View on Explorer', url: explorerUrl }
      ]
    };
  }
  
  /**
   * Processes a price command and returns formatted data
   * @param {string} command - The command string (e.g., "/price ERG")
   * @returns {Promise<Object>} The formatted price data
   */
  export async function processPriceCommand(command) {
    try {
      // Extract the token symbol from the command
      const match = command.match(/^\/price\s+(.+)$/i);
      if (!match) {
        throw new Error('Invalid price command format. Use /price [TOKEN]');
      }
      
      const tokenSymbol = match[1].trim().toUpperCase();
      
      // Handle special case for ERG
      if (tokenSymbol === 'ERG') {
        const ergData = await fetchErgoPriceData();
        return formatErgoPriceMessage(ergData);
      } else {
        // Handle other tokens
        const tokenData = await fetchTokenPriceData(tokenSymbol);
        return formatTokenPriceMessage(tokenData);
      }
    } catch (error) {
      console.error('Error processing price command:', error);
      return {
        type: 'error',
        message: error.message
      };
    }
  }