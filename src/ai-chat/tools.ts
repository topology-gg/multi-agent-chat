import {
  DynamicStructuredTool,
  type StructuredToolInterface,
} from '@langchain/core/tools';
import { promisify } from 'util';
import type { GossipSub, MeshPeer } from '@chainsafe/libp2p-gossipsub';
import { z } from 'zod';
import { DRPNode } from '@ts-drp/node';
import { ChatDRP, type Message } from './chat.drp';
import { type DRPObject, ObjectACL } from '@ts-drp/object';
import type {
  DRPNetworkNodeConfig,
  KeychainOptions,
  LoggerOptions,
} from '@ts-drp/types';
import type { DRPNetworkNode } from '@ts-drp/network';

export class DRPManager {
  private readonly _node: DRPNode;
  private readonly logConfig: LoggerOptions = {
    // level: 'silent',
  };
  private readonly keychainConfig: KeychainOptions = {
    private_key_seed: process.env.KEY_SEED,
  };
  private readonly networkConfig: DRPNetworkNodeConfig = {
    listen_addresses: ['/p2p-circuit', '/webrtc'],
    bootstrap_peers: [
      '/ip4/127.0.0.1/tcp/50000/ws/p2p/16Uiu2HAmTY71bbCHtmYD3nvVKUGbk7NWqLBbPFNng4jhaXJHi3W5',
    ],
    log_config: this.logConfig,
  };

  started = false;
  private _object: DRPObject | undefined;

  constructor(keySeed: string) {
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

    // eslint-disable-next-line @typescript-eslint/no-unsafe-assignment, @typescript-eslint/dot-notation -- this is a private property
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

function composeState(conversation: Message[], drpManager: DRPManager): string {
  let text = '# Conversation\n\n';
  for (const message of conversation) {
    const {
      networkNode: { peerId },
    } = drpManager;
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
  drpManager: DRPManager,
): StructuredToolInterface =>
  new DynamicStructuredTool({
    name: 'askDRPChatTool',
    description: 'A tool for asking a question to a specific agent',
    schema: askDRPChatSchema,
    func: async ({ content, targetPeerId }: { content: string; targetPeerId: string }) => {
      await drpManager.start();
      content = composeContentQuestioner(content);
      const newMessageId = await drpManager.sendMessage(content, false, targetPeerId);
      return {
        messageId: newMessageId,
        content: content,
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
  drpManager: DRPManager,
): StructuredToolInterface =>
  new DynamicStructuredTool({
    name: 'answerDRPChatTool',
    description: 'A tool for answering a question to a specific agent',
    schema: answerDRPChatSchema,
    func: async ({ content, parentMessageId, targetPeerId }: { content: string; parentMessageId: string; targetPeerId: string }) => {
      await drpManager.start();
      content = composeContentAnswerer(content);
      const newMessageId = await drpManager.sendMessage(content, true, targetPeerId, parentMessageId);
      return {
        messageId: newMessageId,
        content: content,
      };
    },
  });

const readDRPChatSchema = z.object({
  messageId: z
    .string()
    .describe(
      'Id of the message that need answered. If not provided, return all unresponded conversations',
    )
    .optional(),
});

export const readDRPChatTool = (
  drpManager: DRPManager,
): StructuredToolInterface =>
  new DynamicStructuredTool({
    name: 'readDRPChatTool',
    description: 'A tool for read messages from network',
    schema: readDRPChatSchema,
    func: async ({ messageId }: { messageId?: string }) => {
      await drpManager.start();
      if (messageId != null) {
        await drpManager.waitMinimalGrafting();
        const message = drpManager.chat.query_answer(messageId);
        if (message == null || message.content === '') {
          return 'No answer found, please retry later';
        }
        const answer =
          'You received an answer from remote agent: ' + message.content;
        return answer;
      } else {
        await drpManager.waitMinimalGrafting();
        const unresponedConversations =
          drpManager.chat.query_unresponded_conversations(drpManager.peerID);
        let result = 'Unresponded conversations:\n\n';
        for (const conversation of unresponedConversations) {
          result += composeState(conversation, drpManager) + '\n\n';
          console.log(
            `Found question "${conversation[0].content}" with id "${conversation[0].messageId}" from peerId "${conversation[0].peerId}"\n`,
          );
        }
        return result;
      }
    },
  });
