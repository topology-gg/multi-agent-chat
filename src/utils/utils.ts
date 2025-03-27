import * as bitcoin from "bitcoinjs-lib";
import * as tools from "uint8array-tools";

interface KeyPair {
	publicKey: Uint8Array;
}

const TESTNET = bitcoin.networks.testnet;

const compressPeerId = (peerId: string) => {
	const compressed = `${peerId.slice(0, 2)}...${peerId.slice(-5)}`;
	return compressed;
};

const getScript = (
	alice: KeyPair,
	bob: KeyPair,
	xHash: Buffer,
	locktime: number,
): Uint8Array => {
	return bitcoin.script.compile([
        bitcoin.opcodes.OP_IF,
        bitcoin.opcodes.OP_SHA256,
        xHash,
        bitcoin.opcodes.OP_EQUALVERIFY,
        bitcoin.opcodes.OP_DUP,
        bitcoin.opcodes.OP_HASH160,
        bitcoin.crypto.hash160(alice.publicKey),
        bitcoin.opcodes.OP_ELSE,
        bitcoin.script.number.encode(locktime).toString('hex'),
        bitcoin.opcodes.OP_CHECKSEQUENCEVERIFY,
        bitcoin.opcodes.OP_DROP,
        bitcoin.opcodes.OP_DUP,
        bitcoin.opcodes.OP_HASH160,
        bitcoin.crypto.hash160(alice.publicKey),
        bitcoin.opcodes.OP_ENDIF,
        bitcoin.opcodes.OP_EQUALVERIFY,
        bitcoin.opcodes.OP_CHECKSIG
    ]);
};

const publishHTLC = async (
	alice: KeyPair,
	bob: KeyPair,
	xHash: string,
	locktime: number,
) => {
	const redeemScript = getScript(alice, bob, xHash, locktime);
	const redeemScriptHex = tools.toHex(redeemScript);
	const redeemScriptHash = bitcoin.crypto.sha256(redeemScript);
	const redeemScriptHashHex = tools.toHex(redeemScriptHash);

	const redeemScriptHashBuffer = Buffer.from(redeemScriptHashHex, "hex");

	const tx = new bitcoin.Transaction();
	tx.addInput("", redeemScriptHashBuffer, bitcoin.Transaction.DEFAULT_SEQUENCE);
	tx.addOutput("", bitcoin.Transaction.DEFAULT_SEQUENCE);

	const signedTx = await tx.();
	const txHex = signedTx.toHex();
	console.log(txHex);

	return txHex;
};

export { compressPeerId, getScript, publishHTLC };
