import React, { useEffect, useState } from 'react';
import { Box, Typography, Paper, IconButton } from '@mui/material';
import EditIcon from '@mui/icons-material/Edit';
import { compressPeerId } from '../utils/utils';
import { DRPObject } from '@ts-drp/object';
import { DRPManager } from '../ai-chat/tools';

interface PeerList {
  id: string;
}

interface LocalDRPStatusProps {
  drpManager: DRPManager;
  onChatObjectCreated: (chatObject: DRPObject) => void;
}

const LocalDRPStatus: React.FC<LocalDRPStatusProps> = ({
  drpManager,
  onChatObjectCreated
}) => {
  const [drpChatId, setDrpChatId] = useState("chat");
  const [hashGraphSize, setHashGraphSize] = useState("1");
  const [bootstrapPeers, setBootstrapPeers] = useState<PeerList[]>(drpManager.networkNode.getBootstrapNodes().map(id => ({ id })));
  const [connectedPeers, setConnectedPeers] = useState<PeerList[]>([]);
  const [editingField, setEditingField] = useState<string | null>(null);

  // Create a Set of bootstrap peer IDs for efficient lookup
  const bootstrapPeerIds = new Set(bootstrapPeers.map(peer => peer.id));

  const extractPeerIdFromMultiaddr = (multiaddr: string): string => {
    // Lấy phần cuối cùng sau "/p2p/"
    const parts = multiaddr.split('/p2p/');
    return parts[parts.length - 1];
  };

  useEffect(() => {
    const updatePeers = async () => {
      const peers = drpManager.networkNode.getAllPeers();
      const bootstrapPeers = drpManager.networkNode.getBootstrapNodes();
      const connectedPeers = peers.filter(peer => !bootstrapPeers.includes(peer));
      
      setConnectedPeers(connectedPeers.map(peer => ({ id: peer })));
      
      // Trích xuất peer ID từ multiaddress của bootstrap peers
      const formattedBootstrapPeers = bootstrapPeers.map(multiaddr => ({
        id: extractPeerIdFromMultiaddr(multiaddr)
      }));
      setBootstrapPeers(formattedBootstrapPeers);
    };

    updatePeers();
    const interval = setInterval(updatePeers, 2000);
    return () => clearInterval(interval);
  }, [drpManager]);

  useEffect(() => {
    const initChatObject = async () => {
      const object = await drpManager.createObject(drpChatId);
      onChatObjectCreated(object);
    };

    initChatObject();
  }, [drpChatId, drpManager, onChatObjectCreated]);

    useEffect(() => {
    const interval = setInterval(() => {
      setHashGraphSize(drpManager.object.hashGraph.getAllVertices().length.toString());
    }, 1000);

    // Cleanup function để tránh memory leak
    return () => clearInterval(interval);
  }, [drpManager]);


  const handleConfirmEdit = async (field: string, value: string) => {
    if (field === "drpChatId") {
      const object = await drpManager.createObject(value);
      onChatObjectCreated(object);
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

  return (
    <Paper sx={{ p: 2, height: '100%' }}>
      <Typography variant="h6" gutterBottom>
        Local DRP Status
      </Typography>
      <Box sx={{ mb: 2 }}>
        {renderReadOnlyField('Peer ID', compressPeerId(drpManager.peerID))}
        {renderEditableField('DRP Chat ID', drpChatId, 'drpChatId')}
        {renderReadOnlyField('Hash Graph size', hashGraphSize)}
      </Box>
      
      <Box>
        <Typography variant="subtitle2" gutterBottom>Connected Peers</Typography>
        {connectedPeers.map((peer) => (
          <Typography key={peer.id} variant="body2">
            {bootstrapPeerIds.has(peer.id) && <strong>B </strong>}{compressPeerId(peer.id)}
          </Typography>
        ))}
      </Box>
    </Paper>
  );
};

export default LocalDRPStatus; 