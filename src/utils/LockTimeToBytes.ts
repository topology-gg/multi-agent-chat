import {
	type ByteString,
	type Int32,
	int32ToByteString,
	len,
	method,
	SmartContractLib,
} from "@scrypt-inc/scrypt-ts-btc";
import { toByteString } from "scrypt-ts";

export class LockTimeToBytes extends SmartContractLib {
	@method()
	static lockTimeToBytes(lockTime: Int32): ByteString {
		const lockTimeBytes = int32ToByteString(lockTime);
		const l = len(lockTimeBytes);

		if (l == 0n) return toByteString("00000000");
		if (l == 1n) return toByteString("000000") + lockTimeBytes;
		if (l == 2n) return toByteString("0000") + lockTimeBytes;
		if (l == 3n) return toByteString("00") + lockTimeBytes;
		if (l == 4n) return lockTimeBytes;
	}
}
