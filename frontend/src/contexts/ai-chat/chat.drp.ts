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
  messages: Message[] = [];

  static resolveConflicts(_: Vertex[]): ResolveConflictsType {
    return { action: ActionType.Nop };
  }

  newMessage(message: Message): string {
    message.messageId = computeHash(message);
    if (this.messages.find(m => m.messageId === message.messageId)) {
      return "Message already exists";
    }
    this.messages.push(message);
    return message.messageId;
  }

  query_conversations(): Message[][] {
    const conversations = [];
    const firstMessages = this.messages.filter(
      (message) => message.parentMessageId === undefined
    );
    console.log('firstMessages', firstMessages);
    for (const message of firstMessages) {
      const conversation = this.query_conversationWithFirstMessage(message);
      if (conversation.length === 0) continue;
      if (conversation.some(message => message.end)) continue;
      conversations.push(conversation);
    }
    return conversations;
  }

  query_conversationWithFirstMessage(
    firstMessage: Message,
  ): Message[] {
    const conversation = [firstMessage];
    let currentMessageId = firstMessage.messageId;
    
    while (true) {
      const nextMessage = this.messages.find(message => message.parentMessageId === currentMessageId);
      if (nextMessage == null) break;
      conversation.push(nextMessage);
      currentMessageId = nextMessage.messageId;
    }

    return conversation;
  }

  query_answer(messageId: string): Message | undefined {
    return this.messages.find(message => message.parentMessageId === messageId);
  }
}
