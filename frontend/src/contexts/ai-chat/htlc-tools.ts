import { DynamicStructuredTool, type StructuredToolInterface } from "@langchain/core/tools";

import HashedTimelockERC20 from '../../../../eth-contracts/src/artifacts/src/htlc.sol/HashedTimelockERC20.json'
import Token from '../../../../eth-contracts/src/artifacts/src/erc20.sol/MyToken.json'
import { WriteContractMutateAsync } from 'wagmi/query';
import { HTLC } from '../../../../bitcoin-contracts/src/contracts/htlc';
import {
	call,
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



const bobPrivKey = bsv.PrivateKey.fromWIF(
	"cUhLQnBVuhpErA6vPyej9adhFAXiS3RPBxRdAc5pcAqPK9k4yx7s",
);
const bobPubKey = bobPrivKey.publicKey;

const newBTC_HTLCSchema = z.object({
  receiver: z.string().describe('Address of the receiver'),
  secretKey: z.string().describe('Secret key'),
  timelock: z.number().describe('Time lock'),
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
            const hashlock = sha256(toByteString(secretKey, true));
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
          content: `Bitcoin HTLC contract deployed with transaction id ${deployTx.extractTransaction().getId()}, hashlock: ${hashlock.toString()}, timelock: ${timeLock}, amount: ${amount}. Please include receiver as ${receiver}`,
          end: false,
          targetPeerId: 'Everyone',
        });
        return {
          message: `Bitcoin HTLC contract deployed with transaction id ${deployTx.extractTransaction().getId()}, hashlock: ${hashlock.toString()}, timelock: ${timeLock}, amount: ${amount}. Please wait for the ETH HTLC be deployed by other agents. Then you can withdraw the ETH HTLC`,
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
    }: {
      receiver: string;
      hashlock: string;
      timelock: number;
      amount: number;
    }
  ) => {
    try {
        await writeContractAsync({
          abi: Token.abi,
          functionName: 'approve',
          address: '0x3F64d909A1f96FBb770B43AF858C2f64E78084AF',
          args: [
            '0x7C819F14e1B52c4984F24cfB9E95dC98969a4e61',
            amount,
          ], 
        });
        const contractAddress = await writeContractAsync({
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
        (chatObject.drp as ChatDRP).newMessage({
          peerId: chatObject.hashGraph.peerId,
          messageId: "",
          content: `ETH HTLC contract deployed with contract address ${contractAddress}. Please withdraw the fund from ETH with your secret key!`,
          end: false,
          targetPeerId: 'Everyone',
        });
        return {
          contractAddress: contractAddress,
          message: `Contract deployed with contract address ${contractAddress}`,
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
});

export const withdrawETH_HTLCAction = (
  writeContractAsync: WriteContractMutateAsync<any, any>,
  chatObject: DRPObject,
): StructuredToolInterface =>
  new DynamicStructuredTool({
    name: 'withdrawETH_HTLCAction',
    description: 'A tool for withdrawing a contract',
    schema: withdrawETH_HTLCSchema,
    func: async ({ contractAddress, secretKey }: { contractAddress: string; secretKey: string }) => {
      try {
        // Convert secretKey to bytes32 using ethers v6
        const hashLock = sha256(toByteString(secretKey, true));
        await writeContractAsync({
          abi: HashedTimelockERC20.abi,
          functionName: 'withdraw',
          address: "0x7C819F14e1B52c4984F24cfB9E95dC98969a4e61",
          args: [
            contractAddress,
            `0x${hashLock.toString()}`,
          ],
        });
        (chatObject.drp as ChatDRP).newMessage({
          peerId: chatObject.hashGraph.peerId,
          messageId: "",
          content: `ETH HTLC contract withdrawn with contract address ${contractAddress} and secret key ${secretKey}. Please use secret key to withdraw BTC from HTLC.`,
          end: false,
          targetPeerId: 'Everyone',
        });
        return {
          message: `ETH HTLC contract withdrawn with contract address ${contractAddress} and secret key ${secretKey}. You shoud end your progress.`,
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
});

export const withdrawBTC_HTLCAction = (
  signer: UnisatSigner,
  chatObject: DRPObject,
): StructuredToolInterface =>
  new DynamicStructuredTool({
    name: 'withdrawBTC_HTLCAction',
    description: 'A tool for withdrawing BTC from HTLC using secret key',
    schema: withdrawBTC_HTLCSchema,
    func: async ({ secretKey, timeLock, txId }: { secretKey: string; timeLock: number; txId: string }) => {
      try {
        HTLC.loadArtifact(artifact);
        const hashLock = sha256(toByteString(secretKey, true));
        console.log(bobPubKey.toAddress().toString());
        const restoredCovenant = Covenant.createCovenant(
          new HTLC(
            PubKey(toXOnly(await signer.getPublicKey(), true)),
            PubKey(toXOnly(bobPubKey.toHex(), true)),
            hashLock,
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
            contract.unlock(toByteString(secretKey, true), psbt.getSig(0, { address: address }));
          },
        });
        console.log(callTx);
        (chatObject.drp as ChatDRP).newMessage({
          peerId: chatObject.hashGraph.peerId,
          messageId: "",
          content: `BTC HTLC contract withdrawn withtransaction ${txId}. End of conversation.`,
          end: true,
          targetPeerId: 'Everyone',
        });
        return {
          message: `BTC HTLC contract withdrawn with transaction ${txId}. End of conversation.`,
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