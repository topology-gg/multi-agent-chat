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
import { type P2PKH, type Sha256, bsv, sha256, toByteString } from "scrypt-ts";
import { HTLC } from "./contracts/htlc";
import artifact from "../artifacts/htlc.json";
import { getDefaultProvider } from "./utils";

declare global {
	interface Window {
		unisat: UnisatAPI;
	}
}
HTLC.loadArtifact(artifact);

const signer = new UnisatSigner(window.unisat as unknown as UnisatAPI);
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
			4000,
		);
		console.log("HTLC contract deployed: ", deployTx.toHex());
		return deployTx;
	} catch (error) {
		console.log(error);
	}
};
