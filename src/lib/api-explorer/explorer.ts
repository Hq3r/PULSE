// explorer.ts - Modified for chat application
import JSONbig from 'json-bigint';
import { totalBoxes } from '$lib/store/store';
import { ITEMS_PER_PAGE } from '$lib/common/const.ts';
import axios from 'axios';

var lastOutputBoxes = {};
var lastInputBoxes = {};

export function updateTempBoxes(address, usedInputs, newOutputs) {
  if (!lastInputBoxes[address]) {
    lastInputBoxes[address] = [];
  }

  if (!lastOutputBoxes[address]) {
    lastOutputBoxes[address] = [];
  }

  for (let boxId of usedInputs) {
    if (!lastInputBoxes[address].includes(boxId)) {
      console.log(`Saving used box ${boxId}`);
      lastInputBoxes[address].push(boxId);
    }
  }

  for (let output of newOutputs) {
    if (!lastOutputBoxes[address].some((item) => item.boxId === output.boxId)) {
      console.log(`Saving unconfirmed box ${output.boxId}`);
      lastOutputBoxes[address].push(output);
    }
  }
}

async function checkTempOutBoxes(address) {
  if (!lastOutputBoxes[address]) {
    return;
  }

  let newBoxes = undefined;
  for (let i = lastOutputBoxes[address].length - 1; i >= 0; i--) {
    let boxId = lastOutputBoxes[address][i].boxId;

    let boxStatus = null;
    try {
      boxStatus = await axios.get('https://api.ergoplatform.com/api/v1/boxes/' + boxId);
    } catch {
      // its ok
    }

    let boxSpent = false;
    if (boxStatus && boxStatus.data && boxStatus.data.spentTransactionId) {
      boxSpent = true;
    }

    if (!boxSpent) {
      if (newBoxes) {
        newBoxes.push(lastOutputBoxes[address][i]);
      } else {
        newBoxes = [lastOutputBoxes[address][i]];
      }
    }
  }

  lastOutputBoxes[address] = newBoxes;
}

function nautilusFriendlyBox(box) {
  let newBox = JSON.parse(JSON.stringify(box));
  newBox.value = newBox.value.toString();

  if (newBox.assets === undefined) newBox.assets = [];

  for (let i = 0; i < newBox.assets.length; i++) {
    newBox.assets[i].amount = newBox.assets[i].amount.toString();
  }

  return newBox;
}

export async function fetchContractBoxFromTx(txid) {
  const url = `https://api.ergoplatform.com/api/v1/transactions/${txid}`;
  const response = await fetch(url);

  if (response.status == 200) {
    const data = await response.arrayBuffer();
    const buffer = new TextDecoder('utf-8').decode(data);
    const stringFromBuffer = buffer.toString('utf8');
    const parsed = JSONbig.parse(stringFromBuffer);

    return parsed.outputs[0];
  } else {
    return null;
  }
}

/**
 * Fetch boxes for a specific contract address
 * Modified to properly handle chat contract boxes
 * 
 * @param {string} contract - The contract address
 * @param {number} offset - Pagination offset
 * @param {number} limit - Number of records to return
 * @returns {Promise<Array>} - Array of boxes
 */
export async function fetchContractBoxes(contract, offset = 0, limit = ITEMS_PER_PAGE) {
  try {
    console.log(`Fetching contract boxes for ${contract}, offset: ${offset}, limit: ${limit}`);
    
    const url = `https://api.ergoplatform.com/api/v1/boxes/unspent/byAddress/${contract}?offset=${offset}&limit=${limit}`;
    const response = await fetch(url, {
      headers: {
        'Cache-Control': 'no-cache'
      }
    });

    if (response.status == 200) {
      const data = await response.arrayBuffer();
      const buffer = new TextDecoder('utf-8').decode(data);
      const stringFromBuffer = buffer.toString('utf8');
      const parsed = JSONbig.parse(stringFromBuffer);

      // Set total boxes count
      if (parsed.total !== undefined) {
        totalBoxes.set(parsed.total);
      }

      // Process and return boxes
      console.log(`Found ${parsed.items.length} boxes for contract`);
      return parsed.items.map(box => {
        // Make sure registers are in the right format
        const processedBox = nautilusFriendlyBox(box);
        return processedBox;
      });
    } else {
      console.error(`Error fetching contract boxes, status: ${response.status}`);
      return [];
    }
  } catch (error) {
    console.error(`Error fetching contract boxes: ${error.message}`);
    return [];
  }
}

export async function fetchConfirmedBalance(address) {
  const url = `https://api.ergoplatform.com/api/v1/addresses/${address}/balance/confirmed`;
  const response = await fetch(url);

  if (response.status == 200) {
    const data = await response.arrayBuffer();
    const buffer = new TextDecoder('utf-8').decode(data);
    const stringFromBuffer = buffer.toString('utf8');
    const parsed = JSONbig.parse(stringFromBuffer);

    return parsed;
  } else {
    return 0;
  }
}

export async function fetchBoxes(address) {
  try {
    await checkTempOutBoxes(address);

    let response = await axios.get(
      `https://api.ergoplatform.com/api/v1/boxes/unspent/byAddress/${address}?limit=500&offset=0&includeUnconfirmed=true`,
      {
        headers: {
          'Cache-Control': 'no-cache' // or 'no-store'
        },
        responseType: 'arraybuffer'
      }
    );

    let buffer = new TextDecoder('utf-8').decode(response.data);
    let stringFromBuffer = buffer.toString('utf8');
    let boxes = JSONbig.parse(stringFromBuffer).items;

    let mempool = await axios.get(
      `https://api.ergoplatform.com/api/v1/mempool/transactions/byAddress/${address}`,
      {
        headers: {
          'Cache-Control': 'no-cache' // or 'no-store'
        },
        responseType: 'arraybuffer'
      }
    );

    buffer = new TextDecoder('utf-8').decode(mempool.data);
    stringFromBuffer = buffer.toString('utf8');
    let parsedMempoolTxs = JSONbig.parse(stringFromBuffer).items;

    for (const tx of parsedMempoolTxs) {
      for (let output of tx.outputs) {
        if (output.address != address) continue;
        let found = false;
        for (const box of boxes) {
          if (box.boxId == output.boxId) {
            found = true;
          }
        }

        if (!found) {
          console.log('Pushing mempool box', output.boxId);
          boxes.push(output);
        }
      }
    }

    for (const tx of parsedMempoolTxs) {
      for (let input of tx.inputs) {
        if (input.address != address) continue;

        for (let i = 0; i < boxes.length; i++) {
          let box = boxes[i];
          if (box.boxId == input.boxId) {
            console.log('Removing mempool box', input.boxId);
            boxes.splice(i, 1);
            break;
          }
        }
      }
    }

    if (lastOutputBoxes[address]) {
      for (let i = 0; i < lastOutputBoxes[address].length; i++) {
        let box = lastOutputBoxes[address][i];

        let found = false;
        for (let j = 0; j < boxes.length; j++) {
          if (boxes[j].boxId == box.boxId) {
            found = true;
            break;
          }
        }

        if (!found) {
          console.log(`Adding unconfirmed from temp ${box.boxId}`);
          boxes.push(box);
        }
      }
    }

    if (lastInputBoxes[address]) {
      for (let i = boxes.length - 1; i >= 0; i--) {
        for (let j = 0; j < lastInputBoxes[address].length; j++) {
          if (boxes[i].boxId == lastInputBoxes[address][j]) {
            console.log(`Removing from temp ${boxes[i].boxId}`);
            boxes.splice(i, 1);
            break;
          }
        }
      }
    }

    // Process registers to make sure they're in the right format
    for (let box of boxes) {
      for (const [k, v] of Object.entries(box.additionalRegisters)) {
        if (v && typeof v === 'object' && v.serializedValue) {
          box.additionalRegisters[k] = v.serializedValue;
        }
      }
    }

    return boxes;
  } catch (error) {
    console.error('Error fetching boxes for address: ', address, error);
    return [];
  }
}

export async function getBlockHeight() {
  try {
    const response = await axios.get(`https://node-api.ergohost.io/info`);
    return response.data.fullHeight;
  } catch (error) {
    console.error('Error getting block height', error);
    throw error;
  }
}

// Helper function to fetch mempool transactions by contract address
export async function fetchMempoolTransactionsByContract(contractAddress) {
  try {
    const response = await axios.get(
      `https://api.ergoplatform.com/api/v1/mempool/transactions/byAddress/${contractAddress}`,
      {
        headers: {
          'Cache-Control': 'no-cache'
        },
        responseType: 'arraybuffer'
      }
    );
    
    const buffer = new TextDecoder('utf-8').decode(response.data);
    const stringFromBuffer = buffer.toString('utf8');
    const result = JSONbig.parse(stringFromBuffer);
    
    return result.items || [];
  } catch (error) {
    console.error(`Error fetching mempool transactions for contract: ${error.message}`);
    return [];
  }
}

// Helper function to decode hex-encoded message content
export function decodeHexMessage(hex) {
  try {
    // Check if it's already a string
    if (typeof hex !== 'string' || !/^[0-9A-Fa-f]+$/.test(hex)) {
      return hex;
    }
    
    // Decode hex to UTF-8
    const bytes = [];
    for (let i = 0; i < hex.length; i += 2) {
      bytes.push(parseInt(hex.substr(i, 2), 16));
    }
    
    return new TextDecoder('utf-8').decode(new Uint8Array(bytes));
  } catch (error) {
    console.error('Error decoding hex message:', error);
    return '[Unreadable message]';
  }
}