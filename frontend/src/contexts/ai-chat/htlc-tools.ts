import { DynamicStructuredTool, type StructuredToolInterface } from "@langchain/core/tools";

import HashedTimelockERC20 from '../../../../eth-contracts/src/artifacts/src/htlc.sol/HashedTimelockERC20.json'
import Token from '../../../../eth-contracts/src/artifacts/src/erc20.sol/MyToken.json'
import { WriteContractMutateAsync } from 'wagmi/query';
import { HTLC } from '../../../../bitcoin-contracts/src/contracts/htlc';
import {
	Covenant,
	deploy,
	ExtPsbt,
	toBitcoinNetwork,
	toXOnly,
	type UnisatAPI,
	UnisatSigner,
	PubKey,
  type Int32,
  call
} from "@scrypt-inc/scrypt-ts-btc";
import artifact from "../../../../bitcoin-contracts/artifacts/htlc.json";
import { ByteString, type P2PKH, Sha256, bsv, sha256, toByteString } from "scrypt-ts";
import { getDefaultProvider } from '../../../../bitcoin-contracts/src/utils';
import { z } from "zod";
import { type DRPObject } from "@ts-drp/object";
import { ChatDRP } from "./chat.drp";
import { ethers } from 'ethers';

const packedSecretKey = (secretKey: string): string => {
  const secretKeyBytes = ethers.toUtf8Bytes(secretKey);
  const bytes32Value = ethers.zeroPadValue(secretKeyBytes, 32);
  return ethers.solidityPacked(['bytes32'], [bytes32Value]);
};

const bobPrivKey = bsv.PrivateKey.fromWIF(
	"cUhLQnBVuhpErA6vPyej9adhFAXiS3RPBxRdAc5pcAqPK9k4yx7s",
);
const bobPubKey = bobPrivKey.publicKey;

const newBTC_HTLCSchema = z.object({
  receiver: z.string().describe('Address of the receiver'),
  secretKey: z.string().describe('Secret key'),
  amount: z.number().describe('Amount of token'),
});

export const newBTC_HTLCAction = (
  signer: UnisatSigner,
  chatObject: DRPObject,
): StructuredToolInterface =>
  new DynamicStructuredTool({
    name: 'newBTC_HTLCAction',
    description: 'A tool for deploying a contract',
    schema: newBTC_HTLCSchema,
    func: async ({ receiver, secretKey, amount }: { receiver: string; secretKey: string; amount: number }) => {
        localStorage.setItem('secretKey', secretKey);
        const timeLock = Math.floor(Date.now() / 1000) + 60 * 60 * 24;
        try {
            HTLC.loadArtifact(artifact);
            const hashlock = Sha256(ethers.sha256(packedSecretKey(secretKey)).slice(2));
            const covenant = Covenant.createCovenant(
            new HTLC(
                PubKey(toXOnly(`${await signer.getPublicKey()}`, true)),
                PubKey(toXOnly(`${bobPubKey.toHex()}`, true)),
                hashlock,
                BigInt(timeLock) as Int32,
            ),
            {
                network: "btc-signet",
            },
        );
        const provider = getDefaultProvider();

        const deployTx = await deploy(
            signer,
            provider,
            covenant,
            "btc-signet",
            amount
          );
        (chatObject.drp as ChatDRP).newMessage({
          peerId: chatObject.hashGraph.peerId,
          messageId: "",
          content: `I have deployed a BTC HTLC contract with transaction id ${deployTx.extractTransaction().getId()}. As the ETH Responder, you should:
          Create ONE ETH HTLC contract with:
          - Receiver: ${receiver}
          - Hashlock: ${hashlock}
          - Timelock: ${timeLock}
          - Amount: ${amount}`,
          end: false,
          targetPeerId: 'Everyone',
        });
        return {
          next_instruction: `As the BTC Initiator, you should:
1. Store your secret key: ${secretKey}
2. Wait for the ETH HTLC contract to be deployed
3. Once deployed, you will receive a notification with the contract address
4. STOP your workflow`,
        };
      } catch (error) {
        console.error('Error deploying contract:', error);
        throw error;
      }
    },
  });

// deploy new BTC HTLC with secret key aaa, amount 4000

const newHTLCSchema = z.object({
  receiver: z.string().describe('Address of the receiver'),
  hashlock: z.string().describe('Hash lock'),
  timelock: z.number().describe('Time lock'),
  amount: z.number().describe('Amount of token'),
  parentMessageId: z.string().describe('Parent message id'),
});

export const newETH_HTLCAction = (
  writeContractAsync: WriteContractMutateAsync<any, any>,
  chatObject: DRPObject,  
): StructuredToolInterface =>
  new DynamicStructuredTool({
  name: 'newETH_HTLCAction',
  description: 'A tool for deploying a contract',
  schema: newHTLCSchema,
  func: async (
    {
      receiver,
      hashlock,
      timelock,
      amount,
      parentMessageId,
    }: {
      receiver: string;
      hashlock: string;
      timelock: number;
      amount: number;
      parentMessageId: string;
    }
  ) => {
    try {
        const txHash = await writeContractAsync({
          abi: HashedTimelockERC20.abi,
          functionName: 'newContract',
          address: '0x7C819F14e1B52c4984F24cfB9E95dC98969a4e61',
          args: [
            receiver,
            `0x${hashlock}`, // hashlock is already in bytes32 format
            timelock,
            "0x3F64d909A1f96FBb770B43AF858C2f64E78084AF",
            amount,
          ],
        });

        // Wait for transaction to be mined
        const provider = new ethers.JsonRpcProvider(import.meta.env.VITE_PUBLIC_ETH_RPC_URL);
        const receipt = await provider.waitForTransaction(txHash);
        
        if (!receipt) {
          throw new Error('Transaction receipt not found');
        }
        
        // Get contract address from event logs
        const contractInterface = new ethers.Interface(HashedTimelockERC20.abi);
        const event = receipt.logs.find(log => {
          try {
            return contractInterface.parseLog(log)?.name === 'HTLCERC20New';
          } catch {
            return false;
          }
        });
        
        if (!event) {
          throw new Error('Contract creation event not found');
        }
        
        const contractAddress = contractInterface.parseLog(event)?.args[0];
        console.log(contractAddress);
        (chatObject.drp as ChatDRP).newMessage({
          peerId: chatObject.hashGraph.peerId,
          messageId: "",
          content: `I have deployed an ETH HTLC contract with address ${contractAddress}. As the BTC Initiator, you should:
1. Withdraw the ETH HTLC using your secret key
2. After withdrawal, I will withdraw the BTC HTLC`,
          end: false,
          targetPeerId: 'Everyone',
          parentMessageId,
        });
        return {
          contractAddress: contractAddress,
          next_instruction: `As the ETH Responder, you should:
1. Store the contract address: ${contractAddress}
2. Wait for the BTC Initiator to withdraw the ETH HTLC
3. Once withdrawn, you will receive a notification with the secret key
4. STOP your workflow`,
        };
    } catch (error) {
      console.error('Error deploying contract:', error);
      throw error;
    }
  },
});

const withdrawETH_HTLCSchema = z.object({
  contractAddress: z.string().describe('Address of the contract'),
  secretKey: z.string().describe('Secret key'),
  parentMessageId: z.string().describe('Parent message id'),
});

export const withdrawETH_HTLCAction = (
  writeContractAsync: WriteContractMutateAsync<any, any>,
  chatObject: DRPObject,
): StructuredToolInterface =>
  new DynamicStructuredTool({
    name: 'withdrawETH_HTLCAction',
    description: 'A tool for withdrawing a contract',
    schema: withdrawETH_HTLCSchema,
    func: async ({ contractAddress, secretKey, parentMessageId }: { contractAddress: string; secretKey: string; parentMessageId: string }) => {
      console.log('withdrawETH_HTLCAction', contractAddress, secretKey, parentMessageId);
      try {        
        await writeContractAsync({
          abi: HashedTimelockERC20.abi,
          functionName: 'withdraw',
          address: "0x7C819F14e1B52c4984F24cfB9E95dC98969a4e61",
          args: [
            contractAddress,
            packedSecretKey(secretKey),
          ],
        });
        (chatObject.drp as ChatDRP).newMessage({
          peerId: chatObject.hashGraph.peerId,
          messageId: "",
          content: `I have withdrawn the ETH HTLC contract with address ${contractAddress} using secret key ${secretKey}. As the ETH Responder, you should:
1. Use this secret key to withdraw the BTC HTLC
2. This is the final step in the process`,
          end: false,
          targetPeerId: 'Everyone',
          parentMessageId,
        });
        return {
          next_instruction: `As the BTC Initiator, you should:
1. End your workflow
2. Do NOT create any new ETH HTLC contracts
3. The ETH Responder will now withdraw the BTC HTLC
4. The atomic swap will be complete after BTC withdrawal
5. STOP your workflow`,
        };
      } catch (error) {
        console.error('Error withdrawing contract:', error);
        throw error;
      }
    },
  });

const withdrawBTC_HTLCSchema = z.object({
  contractAddress: z.string().describe('Address of the contract'),
  secretKey: z.string().describe('Secret key'),
  timeLock: z.number().describe('Time lock'),
  txId: z.string().describe('Transaction id'),
  parentMessageId: z.string().describe('Parent message id'),
});

export const withdrawBTC_HTLCAction = (
  signer: UnisatSigner,
  chatObject: DRPObject,
): StructuredToolInterface =>
  new DynamicStructuredTool({
    name: 'withdrawBTC_HTLCAction',
    description: 'A tool for withdrawing BTC from HTLC using secret key',
    schema: withdrawBTC_HTLCSchema,
    func: async ({ secretKey, timeLock, txId, parentMessageId }: { secretKey: string; timeLock: number; txId: string; parentMessageId: string }) => {
      try {
        HTLC.loadArtifact(artifact);
        const hashlock = Sha256(ethers.sha256(packedSecretKey(secretKey)).slice(2));
        const restoredCovenant = Covenant.createCovenant(
          new HTLC(
            PubKey("c8f705e1a4774a9abb80144ed468f4c98caa19e7af16be8e3e6598f48165b0f3"),
            PubKey(toXOnly(bobPubKey.toHex(), true)),
            hashlock,
            BigInt(timeLock) as Int32,
          ),
          {
            network: "btc-signet",
          },
        );
        const provider = getDefaultProvider();
        const utxos = await provider.getUtxos(restoredCovenant.address);
        const tx = utxos.find((utxo) => utxo.txId === txId);
        if (!tx) {
          throw new Error('Transaction not found');
        }
        restoredCovenant.bindToUtxo(tx);
        const address = await signer.getAddress();
        const callTx = await call(signer, provider, restoredCovenant, {
          invokeMethod: (contract: HTLC, psbt: ExtPsbt) => {
            contract.unlock(toByteString(packedSecretKey(secretKey).slice(2), false), psbt.getSig(0, { address: address }));
          },
        });
        (chatObject.drp as ChatDRP).newMessage({
          peerId: chatObject.hashGraph.peerId,
          messageId: "",
          content: `I have withdrawn the BTC HTLC contract with transaction ${txId}. The atomic swap is now complete.`,
          end: true,
          targetPeerId: 'Everyone',
          parentMessageId,
        });
        return {
          next_instruction: `As the ETH Responder, you should:
1. End your workflow
2. The atomic swap is now complete
3. All funds have been successfully transferred
4. STOP your workflow`,
        };
      } catch (error) {
        console.error('Error withdrawing contract:', error);
        throw error;
      }
    },
  });

const refundHTLCContractSchema = z.object({
  contractAddress: z.string().describe('Address of the contract'),
});

export const refundHTLCContractAction = (
  writeContractAsync: WriteContractMutateAsync<any, any>,
): StructuredToolInterface =>
  new DynamicStructuredTool({
    name: 'refundHTLCContractAction',
    description: 'A tool for cancelling a contract',
    schema: refundHTLCContractSchema,
    func: async ({ contractAddress }: { contractAddress: string }) => {
      try {
        await writeContractAsync({
          abi: HashedTimelockERC20.abi,
          functionName: 'refund',
          address: "0x7C819F14e1B52c4984F24cfB9E95dC98969a4e61",
          args: [
            contractAddress,
          ],
        });
      } catch (error) {
        console.error('Error cancelling contract:', error);
        throw error;
      }
    },
  });

// call newHTLCContractAction with receiver 0x1678B92f0fd866DD494dc90B234318Ef43Cf14e4, secret key aaa, timelock 1843152912, amount 123, tokenContract 0x3F64d909A1f96FBb770B43AF858C2f64E78084AF   