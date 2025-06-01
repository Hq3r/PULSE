// Enhanced canvasStore.ts with double-buffering for smooth refresh

import { writable, get, derived } from 'svelte/store';
import { fetchContractBoxes } from '$lib/api-explorer/explorer.ts';
import axios from 'axios';
import JSONbig from 'json-bigint';

// Canvas configuration
export const CANVAS_WIDTH = 32;
export const CANVAS_HEIGHT = 32;
export const CANVAS_CONTRACT = "2CzxgNhsUcuRpemdgPQBVGqMRRcn7TCBnb2nXeUuV78PNY7kuaqCgzHYNGj2B4rBeR2FkqDUMWXdGnpncnxkHH3kEv";
export const REFRESH_INTERVAL = 8000; // Increased to 8 seconds to reduce flickering
export const SILENT_REFRESH_INTERVAL = 2000; // Background refresh every 2 seconds

// Stores for canvas state
export const canvasData = writable(Array(CANVAS_WIDTH * CANVAS_HEIGHT).fill("#FFFFFF"));
export const backBufferCanvas = writable(Array(CANVAS_WIDTH * CANVAS_HEIGHT).fill("#FFFFFF")); // Double buffering
export const canvasPixels = writable([]);
export const mempoolPixels = writable([]);
export const loadingCanvas = writable(false); // Start without loading indicator
export const lastUpdate = writable(0);
export const totalPixels = writable(0);
export const mempoolPixelCount = writable(0);
export const pixelInProcess = writable({});
export const paintingHistory = writable([]);

// Add stores for smooth updates
export const isSilentRefreshing = writable(false);
export const updateAvailable = writable(false);
export const lastFullRefresh = writable(0);
export const pendingCanvasChanges = writable([]);
export const transitionActive = writable(false); // Track if a transition is in progress

// Create a derived store that represents the currently visible canvas
export const currentCanvasData = derived(
  [canvasData, pendingCanvasChanges, transitionActive, backBufferCanvas],
  ([$canvasData, $pendingCanvasChanges, $transitionActive, $backBufferCanvas]) => {
    // If there's a transition active, use the back buffer
    if ($transitionActive) {
      return $backBufferCanvas;
    }
    
    // If there are pending changes, apply them to the canvas
    if ($pendingCanvasChanges.length === 0) return $canvasData;
    
    // Apply pending changes to a copy of the canvas
    const updatedCanvas = [...$canvasData];
    
    $pendingCanvasChanges.forEach(change => {
      const index = change.y * CANVAS_WIDTH + change.x;
      updatedCanvas[index] = change.color;
    });
    
    return updatedCanvas;
  }
);

// Derived store for pixels that should be disabled
export const disabledPixels = derived(
  [mempoolPixels, pixelInProcess],
  ([$mempoolPixels, $pixelInProcess]) => {
    // Create a set of coordinates that are disabled
    const disabledSet = new Set();
    
    // Add mempool pixels to the disabled set
    $mempoolPixels.forEach(pixel => {
      disabledSet.add(`${pixel.x},${pixel.y}`);
    });
    
    // Add pixels currently being processed
    Object.keys($pixelInProcess).forEach(key => {
      disabledSet.add(key);
    });
    
    return disabledSet;
  }
);

// Color palette options
export const colorPalette = [
  "#000000", "#FFFFFF", "#FF0000", "#00FF00", "#0000FF",
  "#FFFF00", "#FF00FF", "#00FFFF", "#9F04FF", "#FF9900"
];

let refreshTimer;
let silentRefreshTimer;
let lastPixelFetchTime = 0;
let localMempoolCache = []; // Local cache for tracking pending transactions

// Parse box registers to extract pixel data
function parsePixelData(box) {
  try {
    // Extract coordinates and color from registers
    const x = parseInt(box.additionalRegisters.R4.renderedValue);
    const y = parseInt(box.additionalRegisters.R5.renderedValue);
    
    // Extract color bytes from R6
    let colorHex = "#FFFFFF"; // Default white
    if (box.additionalRegisters.R6 && box.additionalRegisters.R6.serializedValue) {
      // Parse color from serialized value
      const colorBytes = [];
      const serialized = box.additionalRegisters.R6.serializedValue;
      
      // Skip the prefix (usually first 4 chars for Coll[Byte])
      for (let i = 4; i < serialized.length; i += 2) {
        colorBytes.push(parseInt(serialized.substr(i, 2), 16));
      }
      
      if (colorBytes.length >= 3) {
        // If we have RGB values
        colorHex = `#${colorBytes.slice(0, 3).map(b => b.toString(16).padStart(2, '0')).join('')}`;
      }
    }
    
    // Get the painter address if available
    let painter = 'unknown';
    if (box.additionalRegisters.R7 && box.additionalRegisters.R7.renderedValue) {
      painter = box.additionalRegisters.R7.renderedValue;
    }
    
    return { 
      x, 
      y, 
      color: colorHex,
      boxId: box.boxId,
      painter: painter,
      txId: box.transactionId || null,
      timestamp: Date.now()
    };
  } catch (error) {
    console.error("Error parsing pixel data:", error, box);
    return null;
  }
}

// Initialize the canvas with a default pattern or load from localStorage
export function initCanvas() {
  // Load canvas data
  loadCanvasFromStorage();
  
  // Load mempool data
  loadMempoolFromStorage();
  
  // Load painting history
  loadPaintingHistory();
  
  // Initialize the back buffer with the same data
  backBufferCanvas.set(get(canvasData));
}

// Load canvas data from localStorage
function loadCanvasFromStorage() {
  // Try to load from localStorage
  const savedCanvas = localStorage.getItem('ergoPixelCanvas');
  if (savedCanvas) {
    try {
      canvasData.set(JSON.parse(savedCanvas));
    } catch (e) {
      console.error("Failed to load canvas from localStorage", e);
      initializeWithPattern();
    }
  } else {
    initializeWithPattern();
  }
}

// Load mempool data from localStorage
function loadMempoolFromStorage() {
  const savedMempool = localStorage.getItem('ergoPixelMempool');
  if (savedMempool) {
    try {
      const mempoolData = JSON.parse(savedMempool);
      
      // Filter out old entries (older than 10 minutes)
      const now = Date.now();
      const recentMempool = mempoolData.filter(pixel => {
        return (now - pixel.timestamp) < 10 * 60 * 1000; // 10 minutes
      });
      
      localMempoolCache = recentMempool;
      mempoolPixels.set(recentMempool);
      mempoolPixelCount.set(recentMempool.length);
    } catch (e) {
      console.error("Failed to load mempool from localStorage", e);
    }
  }
}

// Load painting history from localStorage
function loadPaintingHistory() {
  const savedHistory = localStorage.getItem('ergoPixelHistory');
  if (savedHistory) {
    try {
      const history = JSON.parse(savedHistory);
      paintingHistory.set(history);
    } catch (e) {
      console.error("Failed to load painting history from localStorage", e);
      paintingHistory.set([]);
    }
  }
}

// Create a simple pattern for initial canvas
function initializeWithPattern() {
  const initialCanvas = Array(CANVAS_WIDTH * CANVAS_HEIGHT).fill(0).map((_, i) => {
    // Create a checkerboard pattern
    const x = i % CANVAS_WIDTH;
    const y = Math.floor(i / CANVAS_WIDTH);
    if ((x + y) % 2 === 0) {
      return "#FFFFFF";
    } else {
      return "#F0F0F0";
    }
  });
  
  canvasData.set(initialCanvas);
  backBufferCanvas.set(initialCanvas); // Initialize back buffer too
  localStorage.setItem('ergoPixelCanvas', JSON.stringify(initialCanvas));
}

// Start the refresh timer
export function startCanvasRefresh() {
  if (refreshTimer) {
    clearInterval(refreshTimer);
  }
  
  if (silentRefreshTimer) {
    clearInterval(silentRefreshTimer);
  }
  
  // First fetch without loading indicator
  fetchCanvasState(false);
  
  // Set up regular refresh with loading indicator
  refreshTimer = setInterval(() => fetchCanvasState(true), REFRESH_INTERVAL);
  
  // Set up silent background refresh
  silentRefreshTimer = setInterval(() => fetchCanvasState(false), SILENT_REFRESH_INTERVAL);
  
  return () => {
    if (refreshTimer) {
      clearInterval(refreshTimer);
    }
    if (silentRefreshTimer) {
      clearInterval(silentRefreshTimer);
    }
  };
}

// Stop the refresh timer
export function stopCanvasRefresh() {
  if (refreshTimer) {
    clearInterval(refreshTimer);
    refreshTimer = null;
  }
  
  if (silentRefreshTimer) {
    clearInterval(silentRefreshTimer);
    silentRefreshTimer = null;
  }
}

// Fetch canvas state from both confirmed boxes and mempool
export async function fetchCanvasState(showLoadingIndicator = true) {
  // Avoid fetching too frequently
  const now = Date.now();
  if (now - lastPixelFetchTime < 1000) { // Limit to once per second
    return;
  }
  
  lastPixelFetchTime = now;
  
  // If a transition is active, wait for it to complete
  if (get(transitionActive)) {
    return;
  }
  
  // Only show loading indicator for manual refreshes
  if (showLoadingIndicator) {
    // Instead of setting loadingCanvas to true, we'll prepare the back buffer
    // Copy current canvas to back buffer
    backBufferCanvas.set(get(canvasData));
    lastFullRefresh.set(now);
  } else {
    isSilentRefreshing.set(true);
  }
  
  try {
    // First fetch confirmed pixels
    await fetchConfirmedPixels(showLoadingIndicator);
    
    // Then fetch mempool pixels
    await fetchMempoolPixels(showLoadingIndicator);
    
    // Update the last update timestamp
    lastUpdate.set(now);
    
    // Clear the update available flag if this was a full refresh
    if (showLoadingIndicator) {
      updateAvailable.set(false);
      
      // Start a smooth transition between buffers
      // Set transition active flag
      transitionActive.set(true);
      
      // Allow a short delay for the UI to update
      setTimeout(() => {
        // Apply changes to main canvas
        canvasData.set(get(backBufferCanvas));
        pendingCanvasChanges.set([]);
        
        // End transition
        setTimeout(() => {
          transitionActive.set(false);
          // Finally, set loadingCanvas to false
          loadingCanvas.set(false);
        }, 150); // Short transition
      }, 50);
    }
  } catch (error) {
    console.error("Error fetching canvas state:", error);
  } finally {
    // Only update loading state for manual refreshes
    if (!showLoadingIndicator) {
      isSilentRefreshing.set(false);
    }
  }
}

// Fetch confirmed pixels from blockchain with pagination support
async function fetchConfirmedPixels(isFullRefresh = true) {
  try {
    // Track all pixel data across pages
    const allPixelData = [];
    let offset = 0;
    const limit = 50; // Fetch 50 boxes per request
    let hasMoreBoxes = true;
    
    // Fetch contract boxes with pagination
    while (hasMoreBoxes) {
      // Fetch a page of contract boxes
      const boxes = await fetchContractBoxes(CANVAS_CONTRACT, offset, limit);
      
      if (!boxes || boxes.length === 0) {
        hasMoreBoxes = false;
        break;
      }
      
      // Parse pixel data from this page of boxes
      for (const box of boxes) {
        const pixel = parsePixelData(box);
        if (pixel && 
            pixel.x >= 0 && pixel.x < CANVAS_WIDTH && 
            pixel.y >= 0 && pixel.y < CANVAS_HEIGHT) {
          allPixelData.push(pixel);
        }
      }
      
      // If we got less than the limit, we've reached the end
      if (boxes.length < limit) {
        hasMoreBoxes = false;
      } else {
        // Move to next page
        offset += limit;
      }
    }
    
    // Now process all the accumulated pixel data
    if (allPixelData.length > 0) {
      // Decide which canvas to update based on the refresh type
      const targetCanvas = isFullRefresh ? backBufferCanvas : canvasData;
      let newCanvasData = [...get(targetCanvas)];
      let changes = [];
      
      for (const pixel of allPixelData) {
        // Update the canvas data
        const index = pixel.y * CANVAS_WIDTH + pixel.x;
        if (newCanvasData[index] !== pixel.color) {
          newCanvasData[index] = pixel.color;
          changes.push({ x: pixel.x, y: pixel.y, color: pixel.color });
        }
      }
      
      // If it's a silent refresh and we have changes, set the updateAvailable flag
      if (!isFullRefresh && changes.length > 0) {
        updateAvailable.set(true);
        pendingCanvasChanges.set(changes);
      } else if (isFullRefresh) {
        // For full refresh, update the backbuffer
        backBufferCanvas.set(newCanvasData);
        pendingCanvasChanges.set([]);
        
        // Update the stores
        canvasPixels.set(allPixelData);
        totalPixels.set(allPixelData.length);
        
        // Save to localStorage for quick loading next time
        localStorage.setItem('ergoPixelCanvas', JSON.stringify(newCanvasData));
      }
      
      // Always apply any pending mempool pixels on top
      applyMempoolToCanvas(isFullRefresh);
    }
  } catch (error) {
    console.error("Error fetching confirmed pixels:", error);
  }
}

// Fetch mempool transactions for the canvas
export async function fetchMempoolPixels(isFullRefresh = true) {
  try {
    // Fetch mempool transactions for the canvas contract
    const response = await axios.get(
      `https://api.ergoplatform.com/api/v1/mempool/transactions/byAddress/${CANVAS_CONTRACT}`,
      {
        headers: {
          'Cache-Control': 'no-cache'
        },
        responseType: 'arraybuffer'
      }
    );
    
    // Decode response
    const buffer = new TextDecoder('utf-8').decode(response.data);
    const stringFromBuffer = buffer.toString('utf8');
    let parsedMempoolTxs = [];
    
    try {
      // Try to parse the response
      parsedMempoolTxs = JSONbig.parse(stringFromBuffer).items || [];
    } catch (e) {
      console.error("Failed to parse mempool transactions:", e);
      parsedMempoolTxs = [];
    }
    
    // Process mempool transactions
    let mempoolData = [];
    
    // Process mempool transactions from API
    for (const tx of parsedMempoolTxs) {
      const pixels = parseMempoolTx(tx);
      if (pixels.length > 0) {
        mempoolData = [...mempoolData, ...pixels];
      }
    }
    
    // Merge with local cache
    mempoolData = [...mempoolData, ...localMempoolCache];
    
    // Remove duplicates based on x,y coordinates
    const uniquePixels = [];
    const seen = new Set();
    
    for (const pixel of mempoolData) {
      const key = `${pixel.x},${pixel.y}`;
      if (!seen.has(key)) {
        seen.add(key);
        uniquePixels.push(pixel);
      }
    }
    
    // If it's a silent refresh and the mempool pixels have changed, set the updateAvailable flag
    const currentMempoolPixels = get(mempoolPixels);
    if (!isFullRefresh && uniquePixels.length !== currentMempoolPixels.length) {
      updateAvailable.set(true);
    }
    
    // Always update mempool store
    mempoolPixels.set(uniquePixels);
    mempoolPixelCount.set(uniquePixels.length);
    
    // Save mempool to localStorage
    localStorage.setItem('ergoPixelMempool', JSON.stringify(uniquePixels));
    
    // Apply mempool data to canvas
    applyMempoolToCanvas(isFullRefresh);
    
    // Clear any processing pixels that are now in mempool
    const $pixelInProcess = get(pixelInProcess);
    const updatedPixelInProcess = { ...$pixelInProcess };
    
    uniquePixels.forEach(pixel => {
      const key = `${pixel.x},${pixel.y}`;
      if (updatedPixelInProcess[key]) {
        delete updatedPixelInProcess[key];
      }
    });
    
    pixelInProcess.set(updatedPixelInProcess);
    
  } catch (error) {
    console.error("Error fetching mempool pixels:", error);
    
    // If API fails, still show local mempool cache
    if (localMempoolCache.length > 0) {
      mempoolPixels.set(localMempoolCache);
      mempoolPixelCount.set(localMempoolCache.length);
      applyMempoolToCanvas(isFullRefresh);
    }
  }
}

// Parse mempool transaction to extract pixel data
function parseMempoolTx(tx) {
  try {
    // Only process transactions with the canvas contract address
    const boxesForCanvas = tx.outputs.filter(output => output.address === CANVAS_CONTRACT);
    
    if (boxesForCanvas.length === 0) {
      return [];
    }
    
    const pixelData = [];
    
    for (const box of boxesForCanvas) {
      const pixel = parsePixelData(box);
      if (pixel && 
          pixel.x >= 0 && pixel.x < CANVAS_WIDTH && 
          pixel.y >= 0 && pixel.y < CANVAS_HEIGHT) {
        
        // Add transaction ID and pending flag
        pixel.txId = tx.id;
        pixel.pending = true;
        pixelData.push(pixel);
      }
    }
    
    return pixelData;
  } catch (error) {
    console.error("Error parsing mempool tx:", error);
    return [];
  }
}

// Apply mempool pixels to the canvas
function applyMempoolToCanvas(isFullRefresh = true) {
  const targetCanvas = isFullRefresh ? backBufferCanvas : canvasData;
  const currentCanvas = get(targetCanvas);
  const pendingPixels = get(mempoolPixels);
  
  if (pendingPixels.length === 0) {
    return; // No mempool pixels to apply
  }
  
  let newCanvasData = [...currentCanvas];
  
  // Apply each pending pixel to the canvas
  for (const pixel of pendingPixels) {
    if (pixel.x >= 0 && pixel.x < CANVAS_WIDTH && 
        pixel.y >= 0 && pixel.y < CANVAS_HEIGHT) {
      
      const index = pixel.y * CANVAS_WIDTH + pixel.x;
      newCanvasData[index] = pixel.color;
    }
  }
  
  // Update the appropriate canvas
  if (isFullRefresh) {
    backBufferCanvas.set(newCanvasData);
  } else {
    // For silent refresh, just add to pending changes
    const changes = pendingPixels.map(pixel => ({
      x: pixel.x,
      y: pixel.y,
      color: pixel.color
    }));
    pendingCanvasChanges.update(existing => {
      // Merge with existing changes, removing duplicates
      const allChanges = [...existing, ...changes];
      const seen = new Set();
      return allChanges.filter(change => {
        const key = `${change.x},${change.y}`;
        if (seen.has(key)) return false;
        seen.add(key);
        return true;
      });
    });
  }
}

// Check if a pixel is available to paint
export function isPixelAvailable(x, y) {
  const $disabledPixels = get(disabledPixels);
  return !$disabledPixels.has(`${x},${y}`);
}

// Paint a pixel locally and update the canvasData with smooth transitions
export function paintPixelLocally(x, y, color, userAddress) {
  // First check if pixel is available
  if (!isPixelAvailable(x, y)) {
    console.warn(`Pixel at ${x},${y} is already being painted`);
    return null;
  }

  // Mark pixel as in process
  pixelInProcess.update($pixelInProcess => {
    const key = `${x},${y}`;
    return { ...$pixelInProcess, [key]: { color, timestamp: Date.now() } };
  });
  
  // Update the canvas data with immediate effect (no glitching)
  canvasData.update(data => {
    const newData = [...data];
    const index = y * CANVAS_WIDTH + x;
    newData[index] = color;
    
    // Update back buffer too to keep them in sync
    backBufferCanvas.update(buffer => {
      const newBuffer = [...buffer];
      newBuffer[index] = color;
      return newBuffer;
    });
    
    return newData;
  });
  
  // Create pending pixel
  const pendingPixel = {
    x,
    y,
    color,
    pending: true,
    painter: userAddress || 'unknown',
    paintedAt: Date.now(),
    timestamp: Date.now()
  };
  
  // Add to local mempool cache
  localMempoolCache.push(pendingPixel);
  
  // Save to localStorage
  localStorage.setItem('ergoPixelMempool', JSON.stringify(localMempoolCache));
  
  // After 10 minutes, remove from local cache
  setTimeout(() => {
    localMempoolCache = localMempoolCache.filter(
      p => !(p.x === x && p.y === y && p.color === color)
    );
    localStorage.setItem('ergoPixelMempool', JSON.stringify(localMempoolCache));
  }, 10 * 60 * 1000);
  
  // Add to mempool pixels
  mempoolPixels.update(pixels => {
    // Remove any existing pixel at the same position
    const filtered = pixels.filter(p => !(p.x === x && p.y === y));
    return [...filtered, pendingPixel];
  });
  
  mempoolPixelCount.update(count => count + 1);
  
  // Add to user's painting history
  paintingHistory.update(history => {
    const newHistory = [
      ...history, 
      { 
        x, 
        y, 
        color, 
        timestamp: Date.now()
      }
    ].slice(-50); // Keep only the 50 most recent paintings
    
    // Save to localStorage
    localStorage.setItem('ergoPixelHistory', JSON.stringify(newHistory));
    
    return newHistory;
  });
  
  // No need to force refresh - the canvas already shows the new pixel
  
  return pendingPixel;
}

// Mark a pixel as confirmed 
export function markPixelConfirmed(x, y, txId) {
  // Remove from in-process list
  pixelInProcess.update($pixelInProcess => {
    const key = `${x},${y}`;
    const updated = { ...$pixelInProcess };
    if (updated[key]) {
      delete updated[key];
    }
    return updated;
  });
  
  // Update mempool pixels
  mempoolPixels.update(pixels => {
    return pixels.filter(p => !(p.x === x && p.y === y));
  });
  
  // Update local cache
  localMempoolCache = localMempoolCache.filter(
    p => !(p.x === x && p.y === y)
  );
  
  // Save updated mempool to localStorage
  localStorage.setItem('ergoPixelMempool', JSON.stringify(localMempoolCache));
  
  // Update mempool count
  mempoolPixelCount.update(count => Math.max(0, count - 1));
}

// Apply pending changes to the main canvas (when user clicks "Refresh" or silent updates are applied)
export function applyPendingChanges() {
  const $pendingChanges = get(pendingCanvasChanges);
  if ($pendingChanges.length === 0) return;
  
  // Copy current canvas to back buffer
  backBufferCanvas.set(get(canvasData));
  
  // Set transition active
  transitionActive.set(true);
  
  setTimeout(() => {
    // Apply changes to main canvas
    canvasData.update(current => {
      const updated = [...current];
      $pendingChanges.forEach(change => {
        const index = change.y * CANVAS_WIDTH + change.x;
        updated[index] = change.color;
      });
      return updated;
    });
    
    // Clear pending changes
    pendingCanvasChanges.set([]);
    updateAvailable.set(false);
    
    // End transition after a short delay
    setTimeout(() => {
      transitionActive.set(false);
    }, 150);
  }, 50);
}

// Clear all localStorage data (for debugging/reset purposes)
export function clearCanvasStorage() {
  localStorage.removeItem('ergoPixelCanvas');
  localStorage.removeItem('ergoPixelMempool');
  localStorage.removeItem('ergoPixelHistory');
  
  localMempoolCache = [];
  mempoolPixels.set([]);
  mempoolPixelCount.set(0);
  pixelInProcess.set({});
  paintingHistory.set([]);
  
  initializeWithPattern();
}