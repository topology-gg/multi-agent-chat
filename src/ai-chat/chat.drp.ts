import { createHash } from 'node:crypto';
import {
  ActionType,
  type IDRP,
  type ResolveConflictsType,
  SemanticsType,
  type Vertex,
} from '@ts-drp/types';

export interface Message {
  peerId: string;
  messageId: string;
  content: string;
  parentMessageId?: string;
  end: boolean;
  targetPeerId?: string;
}

function computeHash(message: Message): string {
  const stringHash =
    message.content + message.parentMessageId + message.targetPeerId;
  const hash = createHash('sha256').update(stringHash).digest('hex');
  return hash;
}

export class ChatDRP implements IDRP {
  semanticsType = SemanticsType.pair;
  messagesByPeerId: Record<string, Message[]> = {};
  messageById: Record<string, Message> = {};
  messageByParentId: Record<string, Message> = {};

  static resolveConflicts(_: Vertex[]): ResolveConflictsType {
    return { action: ActionType.Nop };
  }

  newMessage(message: Message): string {
    message.messageId = computeHash(message);
    if (message.messageId in this.messageById) {
      console.log(message);
      throw new Error('Message already exists');
    }

    if (message.parentMessageId != null) {
      this.messageByParentId[message.parentMessageId] = message;
    }
    this.messageById[message.messageId] = message;
    this.messagesByPeerId[message.peerId] ??= [];
    this.messagesByPeerId[message.peerId].push(message);
    return message.messageId;
  }

  /*
        Get all messages from a specific peer
        First message is the message from the user
        Subsequent messages are the messages from the agent. They are linked with the parentMessageId
    */
  query_conversations(peerId: string): Message[][] {
    const firstMessages = this.messagesByPeerId[peerId].filter(
      (message) =>
        message.parentMessageId === undefined || message.parentMessageId === '',
    );

    const conversations = [];
    for (const message of firstMessages) {
      const conversation = this.query_specific_conversation(peerId, message);
      if (conversation.length === 0) continue;
      conversations.push(conversation);
    }
    return conversations;
  }

  query_specific_conversation(
    peerId: string,
    firstMessage: Message,
  ): Message[] {
    const conversation = [firstMessage];
    let currentMessageId = firstMessage.messageId;

    while (currentMessageId in this.messageByParentId) {
      const nextMessage = this.messageByParentId[currentMessageId];
      conversation.push(nextMessage);
      currentMessageId = nextMessage.messageId;
    }

    return conversation;
  }

  query_newest_conversation(peerId: string): Message[] {
    const firstMessage = this.messagesByPeerId[peerId].find(
      (message) =>
        message.peerId === peerId && message.parentMessageId === undefined,
    );
    if (firstMessage == null) return [];
    return this.query_specific_conversation(peerId, firstMessage);
  }

  query_answer(messageId: string): Message | undefined {
    return this.messageByParentId[messageId];
  }

  /*
        Get all conversations that have not been responded to
        Unresponded conversations are conversations where the last message is not end and is not from current peer
        End state is set by the agent
    */
  query_unresponded_conversations(_peerId: string): readonly Message[][] {
    const allPeerId = Object.keys(this.messagesByPeerId);
    // unique peerId
    const uniquePeerId = Array.from(new Set(allPeerId));
    const unresponedConversations = [];
    for (const peerId of uniquePeerId) {
      const conversations = this.query_conversations(peerId);
      if (conversations.length === 0) continue;
      for (const conversation of conversations) {
        const lastMessage = conversation[conversation.length - 1];
        if (lastMessage.end) continue;
        if (lastMessage.peerId === _peerId) continue;
        if (
          lastMessage.targetPeerId != null &&
          lastMessage.targetPeerId !== 'Everyone' &&
          lastMessage.targetPeerId !== _peerId
        ) {
          continue;
        }
        unresponedConversations.push(conversation);
      }
    }
    return unresponedConversations;
  }
}
