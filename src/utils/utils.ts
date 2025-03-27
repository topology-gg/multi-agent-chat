const compressPeerId = (peerId: string) => {
	const compressed = `${peerId.slice(0, 2)}...${peerId.slice(-5)}`;
	return compressed;
};

export { compressPeerId };
