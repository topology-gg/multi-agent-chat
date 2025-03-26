import React, { createContext, useContext, useState, useEffect } from 'react';
import { DRPManager } from '../ai-chat/tools';
import { DRPObject } from '@ts-drp/object';
import { ChatOpenAI, ChatOpenAICallOptions } from '@langchain/openai';
import { Runnable } from '@langchain/core/runnables';
import { BaseLanguageModelInput } from '@langchain/core/language_models/base';
import { AIMessageChunk } from '@langchain/core/messages';
import { answerDRPChatTool, askDRPChatTool, queryAnswerDRPChatTool, queryConversationDRPChatTool } from '../ai-chat/tools';
import { DRPNode } from '@ts-drp/node';
import { DRPNetworkNodeConfig } from '@ts-drp/types';

const networkConfig: DRPNetworkNodeConfig = {
    listen_addresses: ['/p2p-circuit', '/webrtc'],
};

interface DRPContextType {
  chatObject: DRPObject | null;
  drpNode: DRPNode | null;
  llm: Runnable<BaseLanguageModelInput, AIMessageChunk, ChatOpenAICallOptions> | null;
  setChatObject: (object: DRPObject) => void;
}

const DRPContext = createContext<DRPContextType | null>(null);

export const useDRP = () => {
  const context = useContext(DRPContext);
  if (!context) {
    throw new Error('useDRP must be used within a DRPProvider');
  }
  return context;
};

export const DRPProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const [drpManager, setDrpManager] = useState<DRPManager | null>(null);
  const [chatObject, setChatObject] = useState<DRPObject | null>(null);
  const [drpNode, setDrpNode] = useState<DRPNode | null>(null);
  const [llm, setLlm] = useState<Runnable<BaseLanguageModelInput, AIMessageChunk, ChatOpenAICallOptions> | null>(null);

  useEffect(() => {
    let mounted = true;

    const drpNode = new DRPNode({
        network_config: networkConfig,
    });

    drpNode.start().then(() => {
      if (mounted) {
        setDrpNode(drpNode);
      }
    });

    return () => {
      mounted = false;
    };
  }, []);

  useEffect(() => {
    if (!drpManager) return;

    const tools = [
      askDRPChatTool(drpManager),
      answerDRPChatTool(drpManager),
      queryAnswerDRPChatTool(drpManager),
      queryConversationDRPChatTool(drpManager),
    ];
    const llm = new ChatOpenAI({
      model: import.meta.env.VITE_OPENAI_MODEL,
      temperature: 0,
      apiKey: import.meta.env.VITE_OPENAI_API_KEY,
    }).bindTools(tools);
    setLlm(llm);
  }, [drpManager]);

  return (
    <DRPContext.Provider value={{ drpNode, chatObject, llm, setChatObject }}>
      {children}
    </DRPContext.Provider>
  );
}; 