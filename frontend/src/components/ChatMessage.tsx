import React from 'react';
import { Box, Paper, Typography, Avatar } from '@mui/material';
import SmartToyIcon from '@mui/icons-material/SmartToy';
import PersonIcon from '@mui/icons-material/Person';
import CloudIcon from '@mui/icons-material/Cloud';

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
          alignItems: 'flex-start',
          justifyContent: message.type === 'human' ? 'flex-end' : 'flex-start',
          gap: 1,
        }}
      >
        {message.type === 'agent' && (
          <Avatar sx={{ bgcolor: '#1976d2', boxShadow: 2 }}>
            <SmartToyIcon />
          </Avatar>
        )}
        <Paper
          elevation={3}
          sx={{
            p: 2,
            backgroundColor: message.type === 'human' ? '#e3f2fd' : '#f5f5f5',
            maxWidth: '70%',
            border: '2px solid',
            borderColor: message.type === 'human' ? '#1976d2' : '#757575',
            borderRadius: 2,
            boxShadow: '0 2px 8px rgba(0,0,0,0.1)',
          }}
        >
          <Typography>{message.message}</Typography>
        </Paper>
        {message.type === 'human' && (
          <Avatar sx={{ bgcolor: '#4caf50', boxShadow: 2 }}>
            <PersonIcon />
          </Avatar>
        )}
      </Box>

      {/* Agent conversation sub-box */}
      {message.type === 'human' && message.agentConversation && (
        <Box
          sx={{
            ml: 4,
            mt: 1,
            p: 2,
            borderLeft: '4px solid #1976d2',
            borderRadius: '8px',
            bgcolor: 'rgba(25, 118, 210, 0.04)',
            boxShadow: 'inset 0 0 8px rgba(0,0,0,0.05)',
          }}
        >
          <Typography 
            variant="caption" 
            color="primary" 
            sx={{ 
              display: 'block', 
              mb: 1,
              fontWeight: 'medium',
              textTransform: 'uppercase',
              letterSpacing: '0.5px'
            }}
          >
            Agent Processing
          </Typography>
          
          {/* Local Agent Message */}
          <Box sx={{ display: 'flex', alignItems: 'flex-start', gap: 1, mb: 1 }}>
            <Avatar sx={{ width: 28, height: 28, bgcolor: '#1976d2', boxShadow: 1 }}>
              <SmartToyIcon sx={{ fontSize: 18 }} />
            </Avatar>
            <Paper
              elevation={2}
              sx={{
                p: 1.5,
                backgroundColor: '#f0f4f8',
                maxWidth: '60%',
                border: '2px solid #1976d2',
                borderRadius: 2,
                boxShadow: '0 1px 4px rgba(0,0,0,0.1)',
              }}
            >
              <Typography variant="caption" display="block" color="primary" fontWeight="medium">
                Local Agent
              </Typography>
              <Typography variant="body2">
                {message.agentConversation.localMessage}
              </Typography>
            </Paper>
          </Box>

          {/* Remote Agent Response */}
          {message.agentConversation.remoteResponse && (
            <Box sx={{ display: 'flex', justifyContent: 'flex-end', alignItems: 'flex-start', gap: 1 }}>
              <Paper
                elevation={2}
                sx={{
                  p: 1.5,
                  backgroundColor: '#fff3e0',
                  maxWidth: '60%',
                  border: '2px solid #f57c00',
                  borderRadius: 2,
                  boxShadow: '0 1px 4px rgba(0,0,0,0.1)',
                }}
              >
                <Typography variant="caption" display="block" color="#f57c00" fontWeight="medium">
                  Remote Agent
                </Typography>
                <Typography variant="body2">
                  {message.agentConversation.remoteResponse}
                </Typography>
              </Paper>
              <Avatar sx={{ width: 28, height: 28, bgcolor: '#f57c00', boxShadow: 1 }}>
                <CloudIcon sx={{ fontSize: 18 }} />
              </Avatar>
            </Box>
          )}
        </Box>
      )}
    </Box>
  );
};

export default ChatMessage; 