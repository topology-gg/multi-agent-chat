import { ThemeProvider, createTheme } from '@mui/material/styles';
import { CssBaseline, Container } from '@mui/material';
import Grid2 from '@mui/material/Grid2';
import LocalDRPStatus from './components/LocalDRPStatus';
import ChatWindow from './components/ChatWindow';
import { DRPProvider } from './contexts/DRPContext';

const theme = createTheme({
  palette: {
    mode: 'light',
  },
});

function App() {
  return (
    <ThemeProvider theme={theme}>
      <CssBaseline />
      <DRPProvider>
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
      </DRPProvider>
    </ThemeProvider>
  );
}

export default App;