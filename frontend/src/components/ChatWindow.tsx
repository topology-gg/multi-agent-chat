import React, { useRef, useEffect, useState } from 'react';
import { Box, Paper, TextField, IconButton } from '@mui/material';
import SendIcon from '@mui/icons-material/Send';
import ChatMessage from './ChatMessage';
import { answerQuestionPrompt, initialPrompt, startConversationPrompt } from '../contexts/ai-chat/prompts';
import { useDRP } from '../contexts/DRPAgentContext';
import { useAccount } from 'wagmi';

interface ChatMessage {
  type: 'human' | 'agent' | 'status';
  message: string;
  status?: 'processing' | 'waiting' | 'completed' | 'error';
  agentConversation?: {
    localMessage: string;
    remoteResponse?: string;
    timestamp: number;
    status?: 'processing' | 'waiting' | 'completed' | 'error';
  };
}

const ChatWindow: React.FC = () => {
  const { drpNode, agent, chatObject } = useDRP();
  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [inputValue, setInputValue] = useState('');
  const [isProcessing, setIsProcessing] = useState(false);
  const messagesEndRef = useRef<HTMLDivElement>(null);
  const [onQuestion, setOnQuestion] = useState(false);
  const { address } = useAccount();
  const processingRef = useRef(false);
 
  const clearMessages = () => {
    setMessages([]);
  };

  const scrollToBottom = () => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  };

  // clear messages each time drpManader.DRPObject is changed
  useEffect(() => {
    if (!drpNode || !chatObject) return;
    clearMessages();
  }, [drpNode, chatObject]);

  useEffect(() => {
    scrollToBottom();
  }, [messages]);

  // Add useEffect for autonomous functionality
  useEffect(() => {
    if (!chatObject || !drpNode || !agent) {
      return;
    }

    chatObject?.subscribe((_object, _origin, vertices) => {
      const v = vertices[vertices.length - 1];
      if (!v) {
        return;
      }
      // Only process if not already processing and message is from another peer
      if (!processingRef.current && v.peerId !== drpNode?.networkNode.peerId) {
        if (v.operation?.value[0].end) {
          return;
        }
        processingRef.current = true;
        setMessages(prev => [...prev, {
          type: 'status',
          message: 'Processing message from remote agent...',
          status: 'processing',
          agentConversation: {
            localMessage: '',
            remoteResponse: v.operation?.value[0].content,
            timestamp: Date.now(),
            status: 'processing'
          }
        }]);
        autonomousMessage()
          .catch(error => {
            console.error("Error in autonomous message handler:", error);
            setMessages(prev => [...prev, {
              type: 'status',
              message: 'An error occurred while processing the message from remote agent',
              status: 'error'
            }]);
          })
          .finally(() => {
            processingRef.current = false;
          });
      }
      if (onQuestion) {
        if (v.peerId === drpNode?.networkNode.peerId) {
          const localAgentMessages = v.operation?.value[0].content;
          setMessages(prevMessages => {
              const newMessages = [...prevMessages];
              const lastMessage = newMessages[newMessages.length - 1];
              if (lastMessage) {
                if (lastMessage.type === 'human') {
                  lastMessage.agentConversation = {
                    localMessage: localAgentMessages,
                    timestamp: Date.now(),
                    status: 'processing'
                  }; 
                }
                else {
                  newMessages.push({
                    type: 'status',
                    message: "Sent message to remote agent...",
                    status: 'processing',
                    agentConversation: {
                      localMessage: localAgentMessages,
                      timestamp: Date.now(),
                      status: 'processing'
                    }
                  });
                }
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
                  status: 'completed'
                };
              }
              return newMessages;
            });
          }
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
          role: 'system',
          content: initialPrompt,
        },
        {
          role: 'system',
          content: `If you withdraw ETH HTLC, current secret key is ${localStorage.getItem('secretKey')}. Use it as secret key when withdraw the ETH HTLC. If you withdraw BTC HTLC, follow the instructions in the message.`,
        },
        {
          role: 'system',
          content: `don't call multiple actions at once. follow the correct workflow.`,
        },
        {
          role: 'user',
          content: 'Process all unresponded messages from one queryConversationDRPChatTool call. Dont recursively call tools',
        }
      ];      
      const output = await agent.invoke({ messages: input });
      console.log('output', output);
      if (!output) {
        const errorMessage: ChatMessage = {
          type: 'agent',
          message: 'Error processing message. Please try again.',
          status: 'error'
        };
        setMessages(prev => [...prev, errorMessage]);
      } else {
        const answer = output.messages[output.messages.length - 1].content;
        if (!answer) {
          throw new Error('Invalid output format from agent');
        }
        const agentMessage: ChatMessage = {
          type: 'agent',
          message: answer.toString(),
          status: 'completed'
        };
        setMessages(prev => [...prev, agentMessage]);
        return answer as string;
      }
    } catch (error) {
      console.error("Error in autonomousMessage:", error);
      throw error;
    }
  }

  const handleMessage = async (message: string) => {
    setOnQuestion(true);
    let input = [
        {
          role: 'system',
          content: startConversationPrompt,
        },
        {
          role: 'system',
          content: initialPrompt,
        },
        {
          role: 'system',
          content: `User ETH address is ${address}. Use it as receiver if needed.`,
        },
        {
          role: 'user',
          content: message,
        },
      ];
    try {
      const output = await agent?.invoke({ messages: input });
      console.log(output);
      if (!output) {
        throw new Error('No output from agent');
      }
      setOnQuestion(false);
      return output.messages[output.messages.length - 1].content as string;
    } catch (error) {
      setOnQuestion(false);
      return `An error occurred while processing the message. Please try again. ${error}`;
    }
  }

  const handleUserInput = async (userMessage: string) => {
    if (!userMessage.trim() || isProcessing) return;

    setIsProcessing(true);
    setInputValue('');

    // Create new message with agentConversation
    const newMessage: ChatMessage = {
      type: 'human',
      message: userMessage,
    };
    
    setMessages(prev => [...prev, newMessage]);

    const output = await handleMessage(userMessage);
    console.log('output', output);
    if (!output) {
      const errorMessage: ChatMessage = {
        type: 'agent',
        message: 'Error processing message. Please try again.',
        status: 'error'
      };
      setMessages(prev => [...prev, errorMessage]);
      setIsProcessing(false);
      return;
    } else {
      const agentMessage: ChatMessage = {
        type: 'agent',
        message: output.toString(),
        status: 'completed'
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