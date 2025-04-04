import React, { useEffect, useState } from 'react';
import { Box, Typography, Paper, IconButton } from '@mui/material';
import EditIcon from '@mui/icons-material/Edit';
import { compressPeerId } from '../utils/utils';
import { useDRP } from '../contexts/DRPAgentContext';
import { ChatDRP } from '../contexts/ai-chat/chat.drp';
import { ConnectButton } from '@rainbow-me/rainbowkit';
import { UniSatConnect } from './UniSatConnect';

interface PeerList {
  id: string;
}

const LocalDRPStatus: React.FC = () => {
  const { drpNode, setChatObject, chatObject } = useDRP();
  const [drpChatId, setDrpChatId] = useState("chat");
  const [hashGraphSize, setHashGraphSize] = useState("1");
  const [bootstrapPeers, setBootstrapPeers] = useState<PeerList[]>([]);
  const [connectedPeers, setConnectedPeers] = useState<PeerList[]>([]);
  const [editingField, setEditingField] = useState<string | null>(null);

  const bootstrapPeerIds = new Set(bootstrapPeers.map(peer => peer.id));

  const extractPeerIdFromMultiaddr = (multiaddr: string): string => {
    const parts = multiaddr.split('/p2p/');
    return parts[parts.length - 1];
  };

  useEffect(() => {
    if (!drpNode) return;

    const updatePeers = async () => {
      const peers = drpNode.networkNode.getAllPeers();
      const bootstrapPeers = drpNode.networkNode.getBootstrapNodes();
      const connectedPeers = peers.filter(peer => !bootstrapPeers.includes(peer));
      
      setConnectedPeers(connectedPeers.map(peer => ({ id: peer })));
      
      const formattedBootstrapPeers = bootstrapPeers.map(multiaddr => ({
        id: extractPeerIdFromMultiaddr(multiaddr)
      }));
      setBootstrapPeers(formattedBootstrapPeers);
    };

    updatePeers();
    const interval = setInterval(updatePeers, 2000);
    return () => clearInterval(interval);
  }, [drpNode]);

  useEffect(() => {
    if (!chatObject) return;

    const interval = setInterval(() => {
      setHashGraphSize(chatObject.hashGraph.getAllVertices().length.toString() ?? "0");
    }, 1000);

    return () => clearInterval(interval);
  }, [chatObject]);

  const handleConfirmEdit = async (field: string, value: string) => {
    if (!drpNode) return;

    if (field === "drpChatId") {
      const object = await drpNode.createObject({
        id: value,
        drp: new ChatDRP()
      });
      setChatObject(object);
    }

    setEditingField(null);
  };

  const handleEdit = (field: string, value: any) => {
    switch (field) {
      case 'drpChatId':
        setDrpChatId(value);
        break;
    }
  };

  const renderEditableField = (label: string, value: string | number, field: string) => (
    <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
      <Typography>
        {label}:{' '}
        {editingField === field ? (
          <input
            value={value}
            onChange={(e) => handleEdit(field, e.target.value)}
            onBlur={() => handleConfirmEdit(field, String(value))}
            onKeyDown={(e) => {
              if (e.key === 'Enter') {
                handleConfirmEdit(field, String(value));
              }
            }}
            autoFocus
          />
        ) : (
          <span>{value}</span>
        )}
      </Typography>
      <IconButton
        size="small"
        onClick={() => setEditingField(field)}
        sx={{ opacity: 0.5, '&:hover': { opacity: 1 } }}
      >
        <EditIcon fontSize="small" />
      </IconButton>
    </Box>
  );

  const renderReadOnlyField = (label: string, value: string | number) => (
    <Typography>
      {label}: {value}
    </Typography>
  );

  if (!drpNode || !drpNode.networkNode.peerId) {
    return null;
  }

  return (
    <Paper sx={{ p: 2, height: '100%' }}>
      <Typography variant="h6" gutterBottom>
        Local DRP Status
      </Typography>
      <Box sx={{ mb: 2 }}>
        {renderReadOnlyField('Peer ID', compressPeerId(drpNode.networkNode.peerId))}
        {renderEditableField('DRP Chat ID', drpChatId, 'drpChatId')}
        {renderReadOnlyField('Hash Graph size', hashGraphSize)}
      </Box>
      
      <Box>
        <Typography variant="subtitle2" gutterBottom>Connected Peers</Typography>
        {bootstrapPeers.map((peer) => (
          <Typography key={peer.id} variant="body2">
            <strong>B </strong>{compressPeerId(peer.id)}
          </Typography>
        ))}
        {connectedPeers.filter(peer => !bootstrapPeerIds.has(peer.id)).map((peer) => (
          <Typography key={peer.id} variant="body2">
            {compressPeerId(peer.id)}
          </Typography>
        ))}
      </Box>

      <Box sx={{ mt: 2, display: 'flex', flexDirection: 'column', gap: 2 }}>
        <ConnectButton />
        <UniSatConnect />
      </Box>
    </Paper>
  );
};

export default LocalDRPStatus; 