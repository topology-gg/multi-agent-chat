import { randomBytes } from "node:crypto";
import { type UTXO, bsv } from "scrypt-ts";
import { MempoolProvider, DefaultSigner } from "@scrypt-inc/scrypt-ts-btc";

import ECPairFactory, { type TinySecp256k1Interface } from "@scrypt-inc/ecpair";

export const inputSatoshis = 10000;

export const inputIndex = 0;

export const dummyUTXO = {
	txId: randomBytes(32).toString("hex"),
	outputIndex: 0,
	script: "", // placeholder
	satoshis: inputSatoshis,
};

export function getDummyUTXO(satoshis: number = inputSatoshis): UTXO {
	return Object.assign({}, dummyUTXO, { satoshis });
}

export function getDefaultProvider(): MempoolProvider {
	return new MempoolProvider("btc-signet");
}

export function getDefaultBTCsigner(): DefaultSigner {
	const keys = ECPairFactory(
		undefined as unknown as TinySecp256k1Interface,
	).fromWIF(
		"cQ234567890123456789012345678901234567890123456789012345678901234567890123456789",
	);
	return new DefaultSigner(keys);
}

export const sleep = async (seconds: number) => {
	return new Promise((resolve) => {
		setTimeout(() => {
			resolve({});
		}, seconds * 1000);
	});
};

export function randomPrivateKey() {
	const privateKey = bsv.PrivateKey.fromRandom("testnet");
	const publicKey = bsv.PublicKey.fromPrivateKey(privateKey);
	const publicKeyHash = bsv.crypto.Hash.sha256ripemd160(publicKey.toBuffer());
	const address = publicKey.toAddress();
	return [privateKey, publicKey, publicKeyHash, address] as const;
}

const compressPeerId = (peerId: string) => {
	const compressed = `${peerId.slice(0, 2)}...${peerId.slice(-5)}`;
	return compressed;
};

export { compressPeerId };
