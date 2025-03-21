import React, { useEffect, useState } from 'react';
import { ThemeProvider, createTheme } from '@mui/material/styles';
import { CssBaseline, Container } from '@mui/material';
import Grid2 from '@mui/material/Grid2';
import LocalDRPStatus from './components/LocalDRPStatus';
import ChatWindow from './components/ChatWindow';
import { DRPNode } from '@ts-drp/node';
import { DRPObject } from '@ts-drp/object';
import { ChatOpenAI, ChatOpenAICallOptions, OpenAI } from '@langchain/openai';
import { answerDRPChatTool, askDRPChatTool, DRPManager, readDRPChatTool } from './ai-chat/tools';
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
import { answerQuestionPrompt, startConversationPrompt } from './ai-chat/prompts';

const theme = createTheme({
  palette: {
    mode: 'light',
  },
});

// const mockData = {
//   initialPeerId: '0x.1234',
//   initialDrpChatId: 'AAAAAAAAAAAAAAA',
//   initialHashGraphSize: 10,
//   initialBootstrapPeers: [
//     { id: '0x.1234' },
//     { id: '0x.ABCD' },
//   ],
//   initialConnectedPeers: [
//     { id: '0x.1234' },
//     { id: '0x.ABCD' },
//     { id: '0x.DEFG' },
//   ],
// };


function App() {
  const [drpManager, setDrpManager] = useState<DRPManager | null>(null);
  const [chatObject, setChatObject] = useState<DRPObject | null>(null);
  const [llm, setLlm] = useState<Runnable<BaseLanguageModelInput, AIMessageChunk, ChatOpenAICallOptions> | null>(null);

  useEffect(() => {
    const initialize = async () => {      
      const drpManager = new DRPManager(process.env.REACT_APP_KEY_SEED || '');
      await drpManager.start();
      setDrpManager(drpManager);

      const tools = [askDRPChatTool(drpManager), answerDRPChatTool(drpManager), readDRPChatTool(drpManager)];
      const llm = new ChatOpenAI({
        model: 'gpt-4o-mini',
        temperature: 0,
        apiKey: process.env.REACT_APP_OPENAI_API_KEY,
      }).bindTools(tools);
      setLlm(llm);
    }

    initialize();
  }, []);

  return (
    <ThemeProvider theme={theme}>
      <CssBaseline />
      <Container maxWidth="xl" sx={{ height: '100vh', py: 2 }}>
        <Grid2 container spacing={2} sx={{ height: '100%' }}>
          <Grid2 size={{ md: 3 }}>
            {drpManager && drpManager.started && <LocalDRPStatus drpManager={drpManager} onChatObjectCreated={setChatObject} />}
          </Grid2>
          <Grid2 size={{ md: 9 }} sx={{ height: '100%' }}>
            {chatObject && drpManager?.started && llm && <ChatWindow drpManager={drpManager} llm={llm} />}
          </Grid2>
        </Grid2>
      </Container>
    </ThemeProvider>
  );
}

export default App;
