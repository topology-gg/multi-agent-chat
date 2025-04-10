import {
  DynamicStructuredTool,
  type StructuredToolInterface,
} from '@langchain/core/tools';
import { promisify } from 'util';
import type { GossipSub, MeshPeer } from '@chainsafe/libp2p-gossipsub';
import { z } from 'zod';
import { DRPNode } from '@ts-drp/node';
import { ChatDRP, type Message } from './chat.drp';
import { type DRPObject } from '@ts-drp/object';
import type {
  DRPNetworkNodeConfig,
  KeychainOptions,
  LoggerOptions,
} from '@ts-drp/types';
import type { DRPNetworkNode } from '@ts-drp/network';
import HashedTimelockERC20 from '../../../../contracts/src/artifacts/src/htlc.sol/HashedTimelockERC20.json'
import Token from '../../../../contracts/src/artifacts/src/erc20.sol/MyToken.json'
import { WriteContractMutateAsync } from 'wagmi/query';

export class DRPManager {
  private readonly _node: DRPNode;
  private readonly logConfig: LoggerOptions = {
    // level: 'silent',
  };
  private readonly keychainConfig: KeychainOptions = {};
  private readonly networkConfig: DRPNetworkNodeConfig = {
    listen_addresses: ['/p2p-circuit', '/webrtc'],
    log_config: this.logConfig,
  };

  started = false;
  private _object: DRPObject | undefined;

  constructor(keySeed?: string) {
    this.keychainConfig.private_key_seed = keySeed;
    this._node = new DRPNode({
      keychain_config: this.keychainConfig,
      network_config: this.networkConfig,
      log_config: this.logConfig,
    });
  }

  async start(): Promise<void> {
    if (this.started) {
      return;
    }
    await this._node.start();
    await this.createObject();
    this.started = true;
  }

  // async stop(): Promise<void> {
  //   await this._node.stop();
  //   this.started = false;
  // }

  async createObject(id = 'chat'): Promise<DRPObject> {
    this._object = await this._node.createObject({
      drp: new ChatDRP(),
      id,
    });
    return this._object;
  }

  private waitForGraft(
    pubsub: GossipSub,
    callback: (error: Error | null, event: CustomEvent<MeshPeer>) => void,
  ): void {
    const listener = (e: CustomEvent<MeshPeer>): void => {
      if (e.detail.topic === this.object.id) {
        pubsub.removeEventListener('gossipsub:graft', listener);
        callback(null, e);
      }
    };

    pubsub.addEventListener('gossipsub:graft', listener);
  }

  async waitMinimalGrafting(): Promise<void> {
    if (this.networkNode.getGroupPeers(this.object.id).length > 0) {
      return;
    }

     
    const pubsub: GossipSub = this.networkNode['_pubsub'];
    await promisify(this.waitForGraft.bind(this))(pubsub);
  }

  async sendMessage(
    content: string,
    end = false,
    targetPeerId = 'Everyone',
    parentMessageId?: string,
  ): Promise<string> {
    return this.chat.newMessage({
      peerId: this.peerID,
      content,
      end,
      targetPeerId,
      parentMessageId,
      messageId: '',
    });
  }

  get chat(): ChatDRP {
    if (this._object?.drp == null) {
      throw new Error('Object not created');
    }
    return this._object.drp as ChatDRP;
  }

  get object(): DRPObject {
    if (this._object == null) {
      throw new Error('Object not created');
    }
    return this._object;
  }

  get node(): DRPNode {
    return this._node;
  }

  get networkNode(): DRPNetworkNode {
    return this._node.networkNode;
  }

  get peerID(): string {
    return this._node.networkNode.peerId;
  }
}

function composeState(conversation: Message[], chatObject: DRPObject): string {
  let text = '# Conversation\n\n';
  for (const message of conversation) {
    const {
      hashGraph: { peerId },
    } = chatObject;
    const isRemote = message.peerId !== peerId;
    if (isRemote) {
      text += `Remote agent ${message.peerId}:\n\nMessage id: ${message.messageId}, content: ${message.content}\n\n`;
    } else {
      text += `Local agent ${peerId}:\n\nMessage id: ${message.messageId}, content: ${message.content}\n\n`;
    }
  }
  return text;
}

function composeContentQuestioner(content: string): string {
  return `Hi, I am an agent but i can't answer this question. Let's make a chat. I will ask you: ${content}`;
}

function composeContentAnswerer(content: string): string {
  return `Hi, i will answer your question. My answer to your question is ${content}.`;
}

const askDRPChatSchema = z.object({
  content: z.string().describe('Content to send to chat drp tool'),
  targetPeerId: z
    .string()
    .describe('Tag peerId of the agent you want to ask'),
});

export const askDRPChatTool = (
  chatObject: DRPObject,
): StructuredToolInterface =>
  new DynamicStructuredTool({
    name: 'askDRPChatTool',
    description: 'A tool for asking a question to a specific agent',
    schema: askDRPChatSchema,
    func: async ({ content, targetPeerId }: { content: string; targetPeerId: string }) => {
      content = composeContentQuestioner(content);
      const newMessageId = (chatObject.drp as ChatDRP).newMessage({
        content,
        peerId: chatObject.hashGraph.peerId,
        messageId: '',
        end: false,
        targetPeerId,
      });
      return {
        messageId: newMessageId,
        content: content,
        message: "You asked a question to the agent. You can use queryAnswerDRPChatTool to get the answer.",
      };
  }});

const answerDRPChatSchema = z.object({
  content: z.string().describe('Content to send to chat drp tool'),
  parentMessageId: z
    .string()
    .describe(
      'Id of the parent message. Do not provider this when you want to start a new conversation',
    ),
  targetPeerId: z
    .string()
    .describe(
      'Tag peerId of the agent you answer his question or you want him answer you',
    ),
});

export const answerDRPChatTool = (
  chatObject: DRPObject,
): StructuredToolInterface =>
  new DynamicStructuredTool({
    name: 'answerDRPChatTool',
    description: 'A tool for answering a question to a specific agent',
    schema: answerDRPChatSchema,
    func: async ({ content, parentMessageId, targetPeerId }: { content: string; parentMessageId: string; targetPeerId: string }) => {
      content = composeContentAnswerer(content);
      const newMessageId = (chatObject.drp as ChatDRP).newMessage({
        content,
        peerId: chatObject.hashGraph.peerId,
        messageId: '',
        end: true,
        targetPeerId,
        parentMessageId,
      });
      return {
        messageId: newMessageId,
        content: content,
      };
    },
  });

const queryAnswerDRPChatSchema = z.object({
  messageId: z
    .string()
    .describe(
      'Id of the message that need answered. If not provided, return all unresponded conversations',
    )
});

export const queryAnswerDRPChatTool = (
  chatObject: DRPObject,
): StructuredToolInterface =>
  new DynamicStructuredTool({
    name: 'queryAnswerDRPChatTool',
    description: 'A tool for querying an answer from a specific agent',
    schema: queryAnswerDRPChatSchema,
    func: async ({ messageId }: { messageId: string }) => {
      const message = (chatObject.drp as ChatDRP).query_answer(messageId);
      if (messageId == '') {
        return {
          content: '',
          message: 'Wrong messageId input',
        }
      }
      if (message == null || message.content === '') {
        return {
          content: '',
          message: 'No answer found, please retry later',
        }
      }
      return {
        content: message.content,
        message: `You received an answer from remote agent. Stop querying.`,
      };
    },
  });

export const queryConversationDRPChatTool = (
  chatObject: DRPObject,
): StructuredToolInterface =>
  new DynamicStructuredTool({
    name: 'queryConversationDRPChatTool',
    description: 'A tool for querying a conversation from a specific agent',
    schema: {},
    func: async () => {
      const conversations = (chatObject.drp as ChatDRP).query_conversationsNotFromPeer(chatObject.hashGraph.peerId);
      if (conversations.length === 0) {
        return {
          content: '',
          message: 'No unresponded conversations',
        }
      }
      let result = 'Unresponded conversations:\n\n';
      for (const conversation of conversations) {
        result += composeState(conversation, chatObject) + '\n\n';
        console.log(
          `Found question "${conversation[0].content}" with id "${conversation[0].messageId}" from peerId "${conversation[0].peerId}"\n`,
        );
      }
      return result;
    },
  });

const newHTLCContractSchema = z.object({
  receiver: z.string().describe('Address of the receiver'),
  hashlock: z.string().describe('Hash lock'),
  timelock: z.number().describe('Time lock'),
  amount: z.number().describe('Amount of token'),
  tokenContract: z.string().describe('Address of the token contract'),
});

export const newHTLCContractAction = (
  writeContractAsync: WriteContractMutateAsync<any, any>,
): StructuredToolInterface =>
  new DynamicStructuredTool({
  name: 'newHTLCContractAction',
  description: 'A tool for deploying a contract',
  schema: newHTLCContractSchema,
  func: async (
    {
      receiver,
      hashlock,
      timelock,
      amount,
      tokenContract,
    }: {
      receiver: string;
      hashlock: string;
      timelock: number;
      amount: number;
      tokenContract: string
    }
  ) => {
    localStorage.setItem('hashlock', hashlock);
    console.log('Hash lock:', hashlock);
    console.log(`Deploying contract with receiver: ${receiver}, hashLock: ${hashlock}, timelock: ${timelock}, amount: ${amount}, tokenContract: ${tokenContract}`);
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
            hashlock,
            timelock,
            tokenContract,
            amount,
          ],
        });
        return {
          contractAddress: contractAddress,
          message: "Contract deployed",
        };
    } catch (error) {
      console.error('Error deploying contract:', error);
      throw error;
    }
  },
});

const withdrawHTLCContractSchema = z.object({
  contractAddress: z.string().describe('Address of the contract'),
  secretKey: z.string().describe('Secret key'),
});

export const withdrawHTLCContractAction = (
  writeContractAsync: WriteContractMutateAsync<any, any>,
): StructuredToolInterface =>
  new DynamicStructuredTool({
    name: 'withdrawHTLCContractAction',
    description: 'A tool for withdrawing a contract',
    schema: withdrawHTLCContractSchema,
    func: async ({ contractAddress, secretKey }: { contractAddress: string; secretKey: string }) => {
      try {
        await writeContractAsync({
          abi: HashedTimelockERC20.abi,
          functionName: 'withdraw',
          address: "0x7C819F14e1B52c4984F24cfB9E95dC98969a4e61",
          args: [
            contractAddress,
            secretKey,
          ],
        });
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