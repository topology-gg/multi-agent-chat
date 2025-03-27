import { getDefaultProvider } from "../utils/utils.ts";

import { PubKey, type Sha256, bsv, sha256, toByteString } from "scrypt-ts";
import artifact from "../../artifacts/btc.json";

import {
	Covenant,
	ExtPsbt,
	toBitcoinNetwork,
	type UnisatAPI,
	UnisatSigner,
} from "@scrypt-inc/scrypt-ts-btc";
import { HTLC } from "./btc.ts";

declare global {
	interface Window {
		unisat: UnisatAPI;
	}
}

const signer = new UnisatSigner(window.unisat as unknown as UnisatAPI);
HTLC.loadArtifact(artifact);

const deployBTC = async (
	bobPubKey: bsv.PublicKey,
	xHash: Sha256,
	lockTimeMin: bigint,
) => {
	const covenan = Covenant.createCovenant(
		new HTLC(
			PubKey(await signer.getPublicKey()),
			PubKey(bobPubKey.toHex()),
			xHash,
			lockTimeMin,
		),
	);

	const provider = getDefaultProvider();

	const psbt = new ExtPsbt({
		network: toBitcoinNetwork("btc-signet"),
	});
	const utxos = await provider.getUtxos(await signer.getAddress());
	const fee = await provider.getFeeRate();
	psbt
		.spendUTXO(utxos)
		.addCovenantOutput(covenan, 10000)
		.change(await signer.getAddress(), fee);

	const [signedPsbtHex] = await signer.signPsbts([
		{
			psbtHex: psbt.toHex(),
			options: psbt.psbtOptions(),
		},
	]);
	console.log(signedPsbtHex);
	const signedPsbt = ExtPsbt.fromHex(signedPsbtHex);
	const tx = signedPsbt.extractTransaction();
	console.log("HTLC contract deployed: ", tx.toHex());

	const resp = await provider.broadcast(tx.toHex());
	console.log("HTLC contract deploy response: ", resp);

	return tx;
};

export async function main() {
	const bobPrivKey = bsv.PrivateKey.fromWIF(
		"cUhLQnBVuhpErA6vPyej9adhFAXiS3RPBxRdAc5pcAqPK9k4yx7s",
	);
	const bobPubKey = bobPrivKey.publicKey;
	console.log("bobAddress", bobPubKey.toAddress().toString());

	const x = toByteString(
		"f00cfd8df5f92d5e94d1ecbd9b427afd14e03f8a3292ca4128cd59ef7b9643bc",
	);
	const xHash = sha256(x);
	const lockTimeMin = 1673510000n;
	const htlcDeployTx = await deployBTC(bobPubKey, xHash, lockTimeMin);
}
