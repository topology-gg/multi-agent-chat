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
			100000,
		);
		console.log("HTLC contract deployed: ", deployTx.toHex());
		return deployTx;
	} catch (error) {
		console.log(error);
	}
};

export async function main() {
	const htlcDeployTx = await deployBTC(bobPubKey, xHash, lockTimeMin);
}

export async function withdraw() {
	const txId =
		"3eebbd765714e8d9772422c0b162ed84c7e4f18f3832323fca75d4a9c3eb2459";
	const restoredCovenant = Covenant.createCovenant(
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
	const utxos = await provider.getUtxos(restoredCovenant.address);
	const tx = utxos.find((utxo) => utxo.txId === txId);
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
		console.log("HTLC contract deployed: ", tx.toHex());
	} catch (error) {
		console.log(error);
	}
}

export async function unlock(secret: string) {
	const txId =
		"3eebbd765714e8d9772422c0b162ed84c7e4f18f3832323fca75d4a9c3eb2459";
	const restoredCovenant = Covenant.createCovenant(
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
	const utxos = await provider.getUtxos(restoredCovenant.address);
	const tx = utxos.find((utxo) => utxo.txId === txId);
	if (!tx) {
		throw new Error("TX not found");
	}
	restoredCovenant.bindToUtxo(tx);

	const address = await signer.getAddress();
	try {
		const tx = await call(signer, provider, restoredCovenant, {
			invokeMethod: (contract: HTLC, psbt: ExtPsbt) => {
				contract.unlock(
					toByteString(secret),
					psbt.getSig(0, { address: address }),
				);
			},
		});
		console.log("HTLC contract deployed: ", tx.toHex());
	} catch (error) {
		console.log(error);
	}
}
