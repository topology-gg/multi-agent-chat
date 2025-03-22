import React, { useRef, useEffect, useState } from 'react';
import { Box, Paper, TextField, IconButton } from '@mui/material';
import SendIcon from '@mui/icons-material/Send';
import ChatMessage from './ChatMessage';
import { ChatDRP } from '../ai-chat/chat.drp';
import { DRPManager, queryAnswerDRPChatTool, queryConversationDRPChatTool, answerDRPChatTool, askDRPChatTool } from '../ai-chat/tools';
import { Runnable, RunnableConfig } from '@langchain/core/runnables'; 
import { BaseLanguageModelInput } from '@langchain/core/language_models/base';
import { AIMessage, AIMessageChunk } from '@langchain/core/messages';
import {
  END,
  MemorySaver,
  MessagesAnnotation,
  START,
  StateGraph,
} from '@langchain/langgraph/web';
import { ToolNode } from '@langchain/langgraph/prebuilt';
import { v4 as uuidv4 } from 'uuid';
import { answerQuestionPrompt, startConversationPrompt } from '../ai-chat/prompts';
import { ChatOpenAICallOptions } from '@langchain/openai';
import { IDRPObject } from '@ts-drp/types';

interface ChatMessage {
  type: 'human' | 'agent';
  message: string;
  agentConversation?: {
    localMessage: string;
    remoteResponse?: string;
    timestamp: number;
  };
}

interface ChatWindowProps {
  drpManager: DRPManager;
  llm: Runnable<BaseLanguageModelInput, AIMessageChunk, ChatOpenAICallOptions>;
}

const ChatWindow: React.FC<ChatWindowProps> = ({ drpManager, llm }) => {
  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [inputValue, setInputValue] = useState('');
  const [isProcessing, setIsProcessing] = useState(false);
  const messagesEndRef = useRef<HTMLDivElement>(null);

  const clearMessages = () => {
    setMessages([]);
  };

  const scrollToBottom = () => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  };

  // clear messages each time drpManader.DRPObject is changed
  useEffect(() => {
    clearMessages();
  }, [drpManager.object]);


  useEffect(() => {
    scrollToBottom();
  }, [messages]);

  // Thêm useEffect cho chức năng tự động
  useEffect(() => {
    const processAutonomousMessage = async () => {
      await handleMessage(""); 
    }

    drpManager.node.objectStore.subscribe(drpManager.object.id, (objectId: string, object: IDRPObject) => {
      console.log(object);
    });

    // Chạy hàm xử lý mỗi 1 giây
    const interval = setInterval(processAutonomousMessage, 1000);

    // Cleanup function
    return () => clearInterval(interval);
  }, [drpManager]);

  const handleMessage = async (message: string) => {
    if (!drpManager || !llm) {
      return;
    }

    let count = 0;
    const shouldContinue = ({
      messages,
    }: typeof MessagesAnnotation.State): 'tools' | typeof END => {
      if (++count > 10) {
        return END;
      }
      const lastMessage = messages[messages.length - 1] as AIMessage;

      if (
        lastMessage.tool_calls !== undefined &&
        lastMessage.tool_calls.length > 0
      ) {
        return 'tools';
      }
      return END;
    };
    const callModel = async (
      state: typeof MessagesAnnotation.State,
      // eslint-disable-next-line @typescript-eslint/no-explicit-any -- This is a workaround to avoid type errors
    ): Promise<any> => {
      const response = await llm?.invoke(state.messages);
      return { messages: [response] };
    };
    const tools = [askDRPChatTool(drpManager), answerDRPChatTool(drpManager), queryAnswerDRPChatTool(drpManager), queryConversationDRPChatTool(drpManager)];
    const toolNode = new ToolNode(tools);
    const originalInvoke = toolNode.invoke.bind(toolNode);
    toolNode.invoke = async (input: any, config: RunnableConfig) => {
      try {
        const result = await originalInvoke(input, config);
        const func = result.messages[0].name;
        if (func === 'askDRPChatTool') {
          const parsedResult = JSON.parse(result.messages[0].content);
          const content = parsedResult.content;
          // Cập nhật agentConversation của tin nhắn cuối cùng từ người dùng
          setMessages(prev => {
            const newMessages = [...prev];
            // Tìm tin nhắn cuối cùng từ người dùng
            for (let i = newMessages.length - 1; i >= 0; i--) {
              if (newMessages[i].type === 'human') {
                newMessages[i] = {
                  ...newMessages[i],
                  agentConversation: {
                    localMessage: content,
                    timestamp: Date.now()
                  }
                };
                break;
              }
            }
            return newMessages;
          });
        } else if (func === 'queryAnswerDRPChatTool') {
          console.log(result.messages[0].content);
          const parsedResult = JSON.parse(result.messages[0].content);
          const content = parsedResult.content;
          setMessages(prev => {
            const newMessages = [...prev];
            for (let i = newMessages.length - 1; i >= 0; i--) {
              if (newMessages[i].type === 'human') {
                const currentAgentConversation = newMessages[i].agentConversation;
                newMessages[i] = {
                  ...newMessages[i],
                  agentConversation: {
                    localMessage: currentAgentConversation?.localMessage || '',
                    remoteResponse: content,
                    timestamp: Date.now()
                  }
                };
                break;
              }
            } 
            return newMessages;
          });
        }
        return result;
      } catch (error) {
        console.error(error);
      }
    }
    const workflow = new StateGraph(MessagesAnnotation)
      .addNode('agent', callModel)
      .addNode('tools', toolNode)
      .addEdge(START, 'agent')
      .addEdge('tools', 'agent')
      .addConditionalEdges('agent', shouldContinue);
    const memory = new MemorySaver();
    const app = workflow.compile({ checkpointer: memory });
    const config = {
      configurable: { thread_id: uuidv4() },
    };
    let input = [];
    if (message === '') {
      input = [
        {
          role: 'system',
          content: answerQuestionPrompt,
        },
        {
          role: 'user',
          content:
            "You should use readDRPChatTool to get the conversation. There is no messageId. Don't pass it. If you know the answer, you can use write drp chat tool to send the answer.",
        },
      ];
    } else {
      input = [
        {
          role: 'system',
          content: startConversationPrompt,
        },
        {
          role: 'user',
          content: message,
        },
      ];
    }
    const output = await app.invoke({ messages: input }, config);
    return output.messages[output.messages.length - 1].content as string;
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

    // // Giả lập remote agent trả lời local agent
    // setTimeout(() => {
    //   setMessages(prev => prev.map(msg => {
    //     if (msg === newMessage) {
    //       return {
    //         ...msg,
    //         agentConversation: {
    //           ...msg.agentConversation!,
    //           remoteResponse: `Đã phân tích xong yêu cầu: "${userMessage}". Đang xử lý...`
    //         }
    //       };
    //     }
    //     return msg;
    //   }));

    //   // Sau đó local agent mới trả lời user
    //   setTimeout(() => {
    //     setMessages(prev => [...prev, {
    //       type: 'agent',
    //       message: `Đây là kết quả cho "${userMessage}"`
    //     }]);
    //     setIsProcessing(false);
    //   }, 1000);
    // }, 1000);
  };

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
      
      <Box component="form" onSubmit={(e) => {
        e.preventDefault();
        handleUserInput(inputValue);
      }} sx={{ p: 2, borderTop: 1, borderColor: 'divider' }}>
        <Box sx={{ display: 'flex', gap: 1 }}>
          <TextField
            fullWidth
            variant="outlined"
            placeholder={isProcessing ? "Đang xử lý..." : "Nhập tin nhắn..."}
            value={inputValue}
            onChange={(e) => setInputValue(e.target.value)}
            onKeyPress={(e) => {
              if (e.key === 'Enter') {
                handleUserInput(inputValue);
              }
            }}
            disabled={isProcessing}
          />
          <IconButton type="submit" color="primary" disabled={isProcessing}>
            <SendIcon />
          </IconButton>
        </Box>
      </Box>
    </Paper>
  );
};

export default ChatWindow; 