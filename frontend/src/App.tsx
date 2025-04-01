import { ThemeProvider, createTheme } from '@mui/material/styles';
import { CssBaseline, Container } from '@mui/material';
import Grid2 from '@mui/material/Grid2';
import LocalDRPStatus from './components/LocalDRPStatus.tsx';
import ChatWindow from './components/ChatWindow.tsx';
import { DRPAgentProvider } from './contexts/DRPAgentContext.tsx';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import '@rainbow-me/rainbowkit/styles.css';
import {
  RainbowKitProvider,
} from '@rainbow-me/rainbowkit';
import { WagmiProvider } from 'wagmi';
import { wagmiConfig } from './wagmi.config.ts';

const theme = createTheme({
  palette: {
    mode: 'light',
  },
});

const queryClient = new QueryClient();

function App() {
  return (
    <WagmiProvider config={wagmiConfig}>
      <QueryClientProvider client={queryClient}>
        <RainbowKitProvider>
          <ThemeProvider theme={theme}>
            <CssBaseline />
            <DRPAgentProvider>
              <Container maxWidth="xl" sx={{ height: '100vh', py: 2 }}>
                <Grid2 container spacing={2} sx={{ height: '100%' }}>
                  <Grid2 size={{ md: 3 }}>
                    <LocalDRPStatus />
                  </Grid2>
                  <Grid2 size={{ md: 9 }} sx={{ height: '100%' }}>
                    <ChatWindow />
                  </Grid2>
                </Grid2>
              </Container>
            </DRPAgentProvider>
          </ThemeProvider>
        </RainbowKitProvider>
      </QueryClientProvider>
    </WagmiProvider>

  );
}

export default App;