import React, { createContext, useContext, useState, useEffect } from 'react';
import { DRPObject } from '@ts-drp/object';
import { ChatOpenAI } from '@langchain/openai';
import { answerDRPChatTool, askDRPChatTool, queryAnswerDRPChatTool, queryConversationDRPChatTool } from './ai-chat/tools';
import { DRPNode } from '@ts-drp/node';
import { DRPNetworkNodeConfig } from '@ts-drp/types';
import { createReactAgent } from "@langchain/langgraph/prebuilt";
import { CompiledStateGraph } from '@langchain/langgraph/web';
import { ChatDRP } from './ai-chat/chat.drp';
import { useWriteContract } from 'wagmi'
import { UnisatAPI, UnisatSigner } from '@scrypt-inc/scrypt-ts-btc';
import { newBTC_HTLCAction, newETH_HTLCAction, withdrawETH_HTLCAction, withdrawBTC_HTLCAction } from './ai-chat/htlc-tools';
import { SystemMessage } from '@langchain/core/messages';

const networkConfig: DRPNetworkNodeConfig = {
    listen_addresses: ['/p2p-circuit', '/webrtc'],
    log_config: {
      level: 'silent'
    }
};

interface DRPAgentContextType {
  chatObject: DRPObject | null;
  drpNode: DRPNode | null;
  agent: CompiledStateGraph<any, any, any, any, any, any> | null;
  setChatObject: (object: DRPObject) => void;
}

const DRPAgentContext = createContext<DRPAgentContextType | null>(null);

export const useDRP = () => {
  const context = useContext(DRPAgentContext);
  if (!context) {
    throw new Error('useDRP must be used within a DRPProvider');
  }
  return context;
};

declare global {
	interface Window {
		unisat: UnisatAPI;
	}
}

const signer = new UnisatSigner(window.unisat as unknown as UnisatAPI);

export const DRPAgentProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const [chatObject, setChatObject] = useState<DRPObject | null>(null);
  const [drpNode, setDrpNode] = useState<DRPNode | null>(null);
  const [agent, setAgent] = useState<CompiledStateGraph<any, any, any, any, any, any> | null>(null);
  const { writeContractAsync } = useWriteContract()

  useEffect(() => {
    let mounted = true;

    const drpNode = new DRPNode({
        network_config: networkConfig,
        log_config: {
          level: 'silent'
        }
    });

    drpNode.start().then(async () => {
      if (mounted) {
        setDrpNode(drpNode);
      }
      const object = await drpNode.createObject({
        id: 'chat', 
        drp: new ChatDRP()
      });
      setChatObject(object);
    });

    return () => {
      mounted = false;
    };
  }, []);

  useEffect(() => {
    if (!drpNode) return;
    if (!chatObject) return;
    if (!writeContractAsync) return;

    const tools = [
      askDRPChatTool(chatObject),
      answerDRPChatTool(chatObject),
      queryAnswerDRPChatTool(chatObject),
      queryConversationDRPChatTool(chatObject),
      newBTC_HTLCAction(signer, chatObject),
      newETH_HTLCAction(writeContractAsync, chatObject),  
      withdrawETH_HTLCAction(writeContractAsync, chatObject),
      withdrawBTC_HTLCAction(signer, chatObject),
    ];
    const llm = new ChatOpenAI({
      model: import.meta.env.VITE_OPENAI_MODEL,
      temperature: 0,
      apiKey: import.meta.env.VITE_OPENAI_API_KEY,
    });

    const agent = createReactAgent({
      llm,
      tools,
      prompt: new SystemMessage("You are a helpful assistant that can answer questions and help with tasks.")
      
    });

    setAgent(agent);
  }, [drpNode, chatObject, writeContractAsync]);

  return (
    <DRPAgentContext.Provider value={{ drpNode, chatObject, agent, setChatObject }}>
      {children}
    </DRPAgentContext.Provider>
  );
}; 