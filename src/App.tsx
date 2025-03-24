import React, { useEffect, useState } from 'react';
import { ThemeProvider, createTheme } from '@mui/material/styles';
import { CssBaseline, Container } from '@mui/material';
import Grid2 from '@mui/material/Grid2';
import LocalDRPStatus from './components/LocalDRPStatus';
import ChatWindow from './components/ChatWindow';
import { DRPNode } from '@ts-drp/node';
import { DRPObject } from '@ts-drp/object';
import { ChatOpenAI, ChatOpenAICallOptions, OpenAI } from '@langchain/openai';
import { answerDRPChatTool, askDRPChatTool, DRPManager, queryAnswerDRPChatTool, queryConversationDRPChatTool } from './ai-chat/tools';
import { Runnable, RunnableConfig } from '@langchain/core/runnables';
import { BaseLanguageModelInput } from '@langchain/core/language_models/base';
import { AIMessage, AIMessageChunk } from '@langchain/core/messages';

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
  const [chatObject, setChatObject] = useState<DRPObject<ChatDRP> | null>(null);
  const [llm, setLlm] = useState<Runnable<
    BaseLanguageModelInput,
    AIMessageChunk,
    ChatOpenAICallOptions
  > | null>(null);

  useEffect(() => {
    let mounted = true;

    const drpManager = new DRPManager(
      process.env.REACT_APP_KEY_SEED || undefined
    );
    drpManager.start().then(() => {
      if (mounted) {
        setDrpManager(drpManager);
      }
    });

    return () => {
      mounted = false;
      drpManager?.stop();
    };
  }, []);

  useEffect(() => {
    if (!drpManager) return;
    console.log("Peer ID: ", drpManager.peerID);

    const tools = [
      askDRPChatTool(drpManager),
      answerDRPChatTool(drpManager),
      queryAnswerDRPChatTool(drpManager),
      queryConversationDRPChatTool(drpManager),
    ];
    const llm = new ChatOpenAI({
      model: process.env.REACT_APP_OPENAI_MODEL,
      temperature: 0,
      apiKey: process.env.REACT_APP_OPENAI_API_KEY,
    }).bindTools(tools);
    setLlm(llm);
  }, [drpManager]);

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
