import {
	type ByteString,
	prop,
	type PubKey,
	sha256,
	type Sha256,
	type Sig,
	SmartContract,
	method,
	assert,
	type Int32,
} from "@scrypt-inc/scrypt-ts-btc";

export class HTLC extends SmartContract {
	@prop()
	readonly alicePubKey: PubKey;

	@prop()
	readonly bobPubKey: PubKey;

	@prop()
	readonly hashX: Sha256;

	@prop()
	readonly timeout: Int32; // Can be a timestamp or block height.

	constructor(
		alicePubKey: PubKey,
		bobPubKey: PubKey,
		hashX: Sha256,
		timeout: Int32,
	) {
		super(...arguments);
		this.alicePubKey = alicePubKey;
		this.bobPubKey = bobPubKey;
		this.hashX = hashX;
		this.timeout = timeout;
	}

	@method()
	public unlock(x: ByteString, bobSig: Sig) {
		// Check if H(x) == this.hashX
		assert(sha256(x) === this.hashX, "Invalid secret.");
	}

	@method()
	public cancel(aliceSig: Sig) {
		// Check if the timeout has passed
		assert(
			Math.floor(Date.now() / 1000) >= this.timeout,
			"Timeout has not passed.",
		);

		// Verify Alices signature.
		assert(this.checkSig(aliceSig, this.alicePubKey), "Invalid signature.");
	}
}