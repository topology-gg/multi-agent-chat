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
} from "@scrypt-inc/scrypt-ts-btc";

export class HTLC extends SmartContract {
	@prop()
	readonly alicePubKey: PubKey;

	@prop()
	readonly bobPubKey: PubKey;

	@prop()
	readonly hashX: Sha256;

	@prop()
	readonly timeout: bigint; // Can be a timestamp or block height.

	constructor(
		alicePubKey: PubKey,
		bobPubKey: PubKey,
		hashX: Sha256,
		timeout: bigint,
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

		// Verify Bobs signature.
		assert(this.checkSig(bobSig, this.bobPubKey));
	}

	@method()
	public cancel(aliceSig: Sig) {
		// Verify Alices signature.
		assert(this.checkSig(aliceSig, this.alicePubKey));
	}
}
