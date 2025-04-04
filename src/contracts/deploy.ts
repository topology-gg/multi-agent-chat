import { getDefaultProvider } from "../utils/utils.ts";

import { type P2PKH, type Sha256, bsv, sha256, toByteString } from "scrypt-ts";
import artifact from "../../artifacts/btc.json";

import {
	call,
	Covenant,
	deploy,
	ExtPsbt,
	toBitcoinNetwork,
	toXOnly,
	type UnisatAPI,
	UnisatSigner,
	PubKey,
} from "@scrypt-inc/scrypt-ts-btc";
import { HTLC } from "./btc.ts";

declare global {
	interface Window {
		unisat: UnisatAPI;
	}
}

HTLC.loadArtifact(artifact);
const signer = new UnisatSigner(window.unisat as unknown as UnisatAPI);
const bobPrivKey = bsv.PrivateKey.fromWIF(
	"cUhLQnBVuhpErA6vPyej9adhFAXiS3RPBxRdAc5pcAqPK9k4yx7s",
);
const bobPubKey = bobPrivKey.publicKey;
console.log("bobAddress", bobPubKey.toAddress().toString());

const x = toByteString(
	"f00cfd8df5f92d5e94d1ecbd9b427afd14e03f8a3292ca4128cd59ef7b9643bc",
);
const xHash = sha256(x);
const lockTimeMin = 1743168090n;

const deployBTC = async (
	bobPubKey: bsv.PublicKey,
	xHash: Sha256,
	lockTimeMin: bigint,
) => {
	console.log("signer public key", toXOnly(await signer.getPublicKey(), true));
	const covenant = Covenant.createCovenant(
		new HTLC(
			PubKey(toXOnly(await signer.getPublicKey(), true)),
			PubKey(toXOnly(bobPubKey.toHex(), true)),
			xHash,
			lockTimeMin,
		),
		{
			network: "btc-signet",
		},
	);

	const provider = getDefaultProvider();

	try {
		const deployTx = await deploy(
			signer,
			provider,
			covenant,
			"btc-signet",
			4000,
		);
		console.log("HTLC contract deployed: ", deployTx.extractTransaction().getId());
		return deployTx;
	} catch (error) {
		console.log(error);
	}
};

export async function main(duration: number) {
	const lockTimeMin = BigInt(Math.floor(Date.now() / 1000) + duration);
	console.log("lockTimeMin", lockTimeMin);
	const htlcDeployTx = await deployBTC(bobPubKey, xHash, lockTimeMin);
}

export async function withdraw() {
	const txId =
		"105bd664f81899ddfc41a81d3b30617d636000cfb6427cd53372324d2519645a";
	const restoredCovenant = Covenant.createCovenant(
		new HTLC(
			PubKey(toXOnly(await signer.getPublicKey(), true)),
			PubKey(toXOnly(bobPubKey.toHex(), true)),
			xHash,
			1743762864n,
		),
		{
			network: "btc-signet",
		},
	);
	const provider = getDefaultProvider();
	const utxos = await provider.getUtxos(restoredCovenant.address);
	const tx = utxos.find((utxo) => utxo.txId === txId);
	console.log(utxos);
	if (!tx) {
		throw new Error("TX not found");
	}
	restoredCovenant.bindToUtxo(tx);

	const address = await signer.getAddress();
	try {
		const tx = await call(signer, provider, restoredCovenant, {
			invokeMethod: (contract: HTLC, psbt: ExtPsbt) => {
				contract.cancel(psbt.getSig(0, { address: address }));
			},
		});
		console.log("HTLC contract deployed: ", tx.extractTransaction().getId());
	} catch (error) {
		console.log(error);
	}
}

export async function unlock(secret: string) {
	const txId =
		"fb630bc9a7afcdfa175101a00560f8a358dafe9fd61f631b00ef724347707a4e";
	
	// Verify secret hash matches
	const secretBytes = toByteString(secret);
	const calculatedHash = sha256(secretBytes);
	if (calculatedHash !== xHash) {
		throw new Error("Invalid secret - hash does not match");
	}

	const restoredCovenant = Covenant.createCovenant(
		new HTLC(
			PubKey("c8f705e1a4774a9abb80144ed468f4c98caa19e7af16be8e3e6598f48165b0f3"),
			PubKey(toXOnly(bobPubKey.toHex(), true)),
			xHash,
			1743763941n,
		),
		{
			network: "btc-signet",
		},
	);
	
	const provider = getDefaultProvider();
	const utxos = await provider.getUtxos(restoredCovenant.address);
	const tx = utxos.find((utxo) => utxo.txId === txId);
	console.log("Contract UTXOs:", utxos);
	console.log("Using UTXO:", tx);

	if (!tx) {
		throw new Error("TX not found");
	}
	restoredCovenant.bindToUtxo(tx);

	const address = await signer.getAddress();
	console.log("Signing with address:", address);
	
	try {
		const tx = await call(signer, provider, restoredCovenant, {
			invokeMethod: (contract: HTLC, psbt: ExtPsbt) => {
				const sig = psbt.getSig(0, { address });
				if (!sig) {
					throw new Error("Failed to generate signature");
				}
				console.log("Using signature:", sig);
				contract.unlock(secretBytes, sig);
			},
		});
		console.log("Transaction hex:", tx.toHex());
		return tx;
	} catch (error) {
		console.error("Detailed error:", error);
		throw error;
	}
}
