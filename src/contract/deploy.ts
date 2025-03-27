import {
	getDefaultProvider,
	getDefaultBTCsigner,
	inputSatoshis,
} from "../utils/utils";

import {
	type MethodCallOptions,
	PubKey,
	type Sha256,
	bsv,
	findSig,
	sha256,
	toByteString,
} from "scrypt-ts";

import { Covenant, deploy } from "@scrypt-inc/scrypt-ts-btc";
import { HTLC } from "./btc";

const deployBTC = async (
	alicePubKey: bsv.PublicKey,
	bobPubKey: bsv.PublicKey,
	xHash: Sha256,
	lockTimeMin: bigint,
) => {
	const covenan = Covenant.createCovenant(
		new HTLC(
			PubKey(alicePubKey.toHex()),
			PubKey(bobPubKey.toHex()),
			xHash,
			lockTimeMin,
		),
	);

	const provider = getDefaultProvider();
	const signer = getDefaultBTCsigner();

	const deployTx = await deploy(signer, provider, covenan);
	return deployTx;
};

async function main(methodName: string) {
	const alicePrivKey = bsv.PrivateKey.fromWIF(
		"cR7U8GpUdeDiBnYrUdYLoxxpbaMk5SeJ6gpRUbR7zWrgo8TGXs11",
	);
	const alicePubKey = alicePrivKey.publicKey;

	const bobPrivKey = bsv.PrivateKey.fromWIF(
		"cUhLQnBVuhpErA6vPyej9adhFAXiS3RPBxRdAc5pcAqPK9k4yx7s",
	);
	const bobPubKey = bobPrivKey.publicKey;

	console.log("aliceAddress", alicePubKey.toAddress().toString());
	console.log("bobAddress", bobPubKey.toAddress().toString());

	const amount = inputSatoshis;

	const x = toByteString(
		"f00cfd8df5f92d5e94d1ecbd9b427afd14e03f8a3292ca4128cd59ef7b9643bc",
	);
	const xHash = sha256(x);

	const lockTimeMin = 1673510000n;

	await CrossChainSwap.compile();

	const crossChainSwap = new CrossChainSwap(
		PubKey(alicePubKey.toHex()),
		PubKey(bobPubKey.toHex()),
		xHash,
		lockTimeMin,
	);

	// Connect Bob signer.
	await crossChainSwap.connect(getDefaultSigner(bobPrivKey));

	// Contract deployment.
	const deployTx = await crossChainSwap.deploy(amount);
	console.log("CrossChainSwap contract deployed: ", deployTx.id);

	const htlcDeployTx = await deployBTC(
		alicePubKey,
		bobPubKey,
		xHash,
		lockTimeMin,
	);
	console.log("HTLC contract deployed: ", htlcDeployTx.getId());

	if (methodName === "unlock") {
		// Alice unlocks contract and takes the funds.
		await crossChainSwap.connect(getDefaultSigner(alicePrivKey));

		const { tx: callTx, atInputIndex } = await crossChainSwap.methods.unlock(
			x,
			(sigResps) => findSig(sigResps, alicePubKey),
			{
				pubKeyOrAddrToSign: alicePubKey,
			} as MethodCallOptions<CrossChainSwap>,
		);
		console.log('CrossChainSwap "unlock" method called: ', callTx.id);
	} else {
		// Bob withdraws after timeout passed.
		const { tx: callTx, atInputIndex } = await crossChainSwap.methods.cancel(
			(sigResps) => findSig(sigResps, bobPubKey),
			{
				lockTime: 1673523720,
				pubKeyOrAddrToSign: bobPubKey,
			} as MethodCallOptions<CrossChainSwap>,
		);
		console.log('CrossChainSwap "cancel" method called: ', callTx.id);
	}
}
