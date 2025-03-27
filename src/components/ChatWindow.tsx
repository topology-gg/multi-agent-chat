import React, { useRef, useEffect, useState } from 'react';
import { Box, Paper, TextField, IconButton } from '@mui/material';
import SendIcon from '@mui/icons-material/Send';
import ChatMessage from './ChatMessage';
import { answerQuestionPrompt, startConversationPrompt } from '../contexts/ai-chat/prompts';
import { useDRP } from '../contexts/DRPAgentContext';

interface ChatMessage {
  type: 'human' | 'agent';
  message: string;
  agentConversation?: {
    localMessage: string;
    remoteResponse?: string;
    timestamp: number;
  };
}

const ChatWindow: React.FC = () => {
  const { drpNode, agent, chatObject } = useDRP();
  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [inputValue, setInputValue] = useState('');
  const [isProcessing, setIsProcessing] = useState(false);
  const messagesEndRef = useRef<HTMLDivElement>(null);
  const [onQuestion, setOnQuestion] = useState(false);

  const clearMessages = () => {
    setMessages([]);
  };

  const scrollToBottom = () => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  };

  // clear messages each time drpManader.DRPObject is changed
  useEffect(() => {
    if (!drpNode) return;
    clearMessages();
  }, [drpNode]);

  useEffect(() => {
    scrollToBottom();
  }, [messages]);

  // Thêm useEffect cho chức năng tự động
  useEffect(() => {
    if (!chatObject || !drpNode || !agent) {
      console.log("Missing required dependencies:", { 
        hasChatObject: !!chatObject, 
        hasDrpNode: !!drpNode, 
        hasAgent: !!agent 
      });
      return;
    }

    console.log("Setting up chat subscription");
    chatObject?.subscribe((_object, _origin, vertices) => {
      if (vertices.some(v => v.peerId !== drpNode?.networkNode.peerId)) {
        autonomousMessage().catch(error => {
          console.error("Error in autonomous message handler:", error);
        });
      }
      if (onQuestion) {
        vertices.forEach(v => {
          if (v.peerId === drpNode?.networkNode.peerId) {
            const localAgentMessages = v.operation?.value[0].content;
            setMessages(prevMessages => {
              const newMessages = [...prevMessages];
              const lastMessage = newMessages[newMessages.length - 1];
              if (lastMessage) {
                lastMessage.agentConversation = {
                  localMessage: localAgentMessages,
                  timestamp: Date.now(),
                };
              }
              return newMessages;
            });
          } else {
            const remoteAgentMessages = v.operation?.value[0].content;
            setMessages(prevMessages => {
              const newMessages = [...prevMessages];
              const lastMessage = newMessages[newMessages.length - 1];
              if (lastMessage) {
                lastMessage.agentConversation = {
                  localMessage: lastMessage.agentConversation?.localMessage || '',
                  remoteResponse: remoteAgentMessages,
                  timestamp: Date.now(),
                };
              }
              return newMessages;
            });
          }
        });
      }
    });
  }, [chatObject, drpNode, agent, onQuestion]);

  const autonomousMessage = async () => {
    if (!agent) {
      console.error("Agent is not initialized");
      return;
    }

    try {
      const input = [
        {
          role: 'system',
          content: answerQuestionPrompt,
        },
        {
          role: 'user',
          content: 'Use queryConversationDRPChatTool to get the question from other agents.',
        }
      ];      
      const output = await agent.invoke({ messages: input });
      if (!output) {
        throw new Error('No output from agent');
      }
      const answer = output.messages[output.messages.length - 1].content;
      if (!answer) {
        throw new Error('Invalid output format from agent');
      }
      return answer as string;
    } catch (error) {
      console.error("Error in autonomousMessage:", error);
      throw error;
    }
  }

  const handleMessage = async (message: string) => {
    setOnQuestion(true);
    console.log("handleMessage", onQuestion);
    let input = [
        {
          role: 'system',
          content: startConversationPrompt,
        },
        {
          role: 'user',
          content: message,
        },
      ];
    try {
      const output = await agent?.invoke({ messages: input });
      if (!output) {
        throw new Error('No output from agent');
      }
      setOnQuestion(false);
      return output.messages[output.messages.length - 1].content as string;
    } catch (error) {
      setOnQuestion(false);
      return 'Có lỗi xảy ra khi xử lý tin nhắn. Vui lòng thử lại.';
    }
  }

  const handleUserInput = async (userMessage: string) => {
    if (!userMessage.trim() || isProcessing) return;

    setIsProcessing(true);
    setInputValue('');

    // Tạo tin nhắn mới với agentConversation
    const newMessage: ChatMessage = {
      type: 'human',
      message: userMessage,
    };
    
    setMessages(prev => [...prev, newMessage]);

    const output = await handleMessage(userMessage);
    if (!output) {
      const errorMessage: ChatMessage = {
        type: 'agent',
        message: 'Lỗi khi xử lý tin nhắn. Vui lòng thử lại.'
      };
      setMessages(prev => [...prev, errorMessage]);
      setIsProcessing(false);
      return;
    } else {
      const agentMessage: ChatMessage = {
        type: 'agent',
        message: output.toString()
      };
      setMessages(prev => [...prev, agentMessage]);
      setIsProcessing(false);
    }
  };

  if (!drpNode || !drpNode.networkNode.peerId || !agent) {
    return null;
  }

  return (
    <Paper sx={{ height: '100%', display: 'flex', flexDirection: 'column' }}>
      <Box sx={{ flexGrow: 1, overflow: 'auto', p: 2 }}>
        {messages.map((msg, index) => (
          <ChatMessage 
            key={index} 
            message={msg}
          />
        ))}
        <div ref={messagesEndRef} />
      </Box>
      
      <Box component="form" onSubmit={(e: any) => {
        e.preventDefault();
        handleUserInput(inputValue);
      }} sx={{ p: 2, borderTop: 1, borderColor: 'divider' }}>
        <Box sx={{ display: 'flex', gap: 1 }}>
          <TextField
            fullWidth
            value={inputValue}
            onChange={(e) => setInputValue(e.target.value)}
            placeholder="Input your message..."
            disabled={isProcessing}
          />
          <IconButton 
            type="submit" 
            color="primary" 
            disabled={isProcessing || !inputValue.trim()}
          >
            <SendIcon />
          </IconButton>
        </Box>
      </Box>
    </Paper>
  );
};

export default ChatWindow; 