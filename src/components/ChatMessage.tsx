import React from 'react';
import { Box, Paper, Typography, Avatar } from '@mui/material';
import SmartToyIcon from '@mui/icons-material/SmartToy';
import PersonIcon from '@mui/icons-material/Person';

export interface AgentConversation {
  localMessage: string;
  remoteResponse?: string;
  timestamp: number;
}

// Define message structure
interface ChatMessageData {
  type: 'human' | 'agent';
  message: string;
  agentConversation?: {
    localMessage: string;
    remoteResponse?: string;
    timestamp: number;
  };
}

// Component props
interface ChatMessageProps {
  message: ChatMessageData;
}

const ChatMessage: React.FC<ChatMessageProps> = ({ message }) => {
  return (
    <Box sx={{ mb: 2 }}>
      {/* Main message */}
      <Box
        sx={{
          display: 'flex',
          justifyContent: message.type === 'human' ? 'flex-end' : 'flex-start',
        }}
      >
        <Paper
          sx={{
            p: 2,
            backgroundColor: message.type === 'human' ? '#e3f2fd' : '#f5f5f5',
            maxWidth: '70%',
          }}
        >
          <Typography>{message.message}</Typography>
        </Paper>
      </Box>

      {/* Agent conversation sub-box */}
      {message.type === 'human' && message.agentConversation && (
        <Box
          sx={{
            ml: 4,
            mt: 1,
            p: 1,
            borderLeft: '2px solid #e0e0e0',
          }}
        >
          <Typography variant="caption" color="textSecondary">
            Agent Processing
          </Typography>
          
          {/* Local Agent Message */}
          <Box sx={{ display: 'flex', mb: 1 }}>
            <Paper
              sx={{
                p: 1,
                backgroundColor: '#f0f4f8',
                maxWidth: '60%',
              }}
            >
              <Typography variant="caption" display="block" color="textSecondary">
                Local Agent
              </Typography>
              <Typography variant="body2">
                {message.agentConversation.localMessage}
              </Typography>
            </Paper>
          </Box>

          {/* Remote Agent Response */}
          {message.agentConversation.remoteResponse && (
            <Box sx={{ display: 'flex', justifyContent: 'flex-end' }}>
              <Paper
                sx={{
                  p: 1,
                  backgroundColor: '#fff3e0',
                  maxWidth: '60%',
                }}
              >
                <Typography variant="caption" display="block" color="textSecondary">
                  Remote Agent
                </Typography>
                <Typography variant="body2">
                  {message.agentConversation.remoteResponse}
                </Typography>
              </Paper>
            </Box>
          )}
        </Box>
      )}
    </Box>
  );
};

export default ChatMessage; 