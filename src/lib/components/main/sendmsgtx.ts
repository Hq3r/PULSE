// sendmsgtx.ts - Transaction builder for Ergo chat system

// Define wallet API interface
interface ErgoWalletAPI {
    get_change_address: () => Promise<string>;
    get_public_key: (address: string) => Promise<string>;
    get_utxos: (amount: bigint) => Promise<any[]>;
    sign_tx: (tx: any) => Promise<any>;
    submit_tx: (signedTx: any) => Promise<string>;
  }
  
  // Define transaction input interface
  interface ErgoTransactionInput {
    boxId: string;
    // Additional properties may be included depending on Ergo API
  }
  
  // Define transaction output interface
  interface ErgoTransactionOutput {
    value: bigint;
    ergoTree: string;
    assets: any[];
    additionalRegisters: {
      R4?: string;
      R5?: string;
      R6?: string;
      [key: string]: string | undefined;
    };
  }
  
  // Define transaction interface
  interface ErgoTransaction {
    inputs: ErgoTransactionInput[];
    outputs: ErgoTransactionOutput[];
    fee: bigint;
    changeAddress: string;
  }
  
  /**
   * Sends a chat message as a transaction on the Ergo blockchain
   * @param walletApi The connected Ergo wallet API instance
   * @param contractAddress The P2S address of the chat contract
   * @param message The message to send
   * @returns The transaction ID of the sent message
   */
  async function sendChatMessage(
    walletApi: ErgoWalletAPI, 
    contractAddress: string, 
    message: string
  ): Promise<string> {
    try {
      // Convert message to hex string for storage
      const messageHex = Buffer.from(message, 'utf8').toString('hex');
      
      // Get sender's address and public key
      const senderAddress = await walletApi.get_change_address();
      const senderPublicKey = await walletApi.get_public_key(senderAddress);
      
      // Current timestamp
      const timestamp = Math.floor(Date.now() / 1000);
      
      // Minimum transaction value (in nanoERGs)
      const minValue = 1000000n; // 0.001 ERG
      
      // Prepare transaction inputs
      const inputs = await walletApi.get_utxos(minValue);
      if (!inputs || inputs.length === 0) {
        throw new Error("Insufficient funds for transaction");
      }
      
      // Transaction fee
      const fee = 1000000n; // 0.001 ERG
      
      // Create the output box with our message
      const outputBox: ErgoTransactionOutput = {
        value: minValue,
        ergoTree: contractAddress,
        assets: [],
        additionalRegisters: {
          R4: senderPublicKey,
          R5: messageHex,
          R6: timestamp.toString()
        }
      };
      
      // Construct and send the transaction
      const tx: ErgoTransaction = {
        inputs: inputs,
        outputs: [outputBox],
        fee: fee,
        changeAddress: senderAddress
      };
      
      // Sign and submit transaction
      const signedTx = await walletApi.sign_tx(tx);
      const txId = await walletApi.submit_tx(signedTx);
      
      console.log(`Message sent! Transaction ID: ${txId}`);
      return txId;
    } catch (error) {
      console.error("Error sending message:", error);
      throw error;
    }
  }
  
  export { sendChatMessage };