import { md5 } from "./md5";
import { Blowfish } from "egoroof-blowfish";

const getBlowfishKey = (trackId: string) => {
	const SECRET = "g4el58wc" + "0zvf9na1";
	const idMd5 = md5(trackId);
	let bfKey = "";
	for (let i = 0; i < 16; i++) {
		bfKey += String.fromCharCode(idMd5.charCodeAt(i) ^ idMd5.charCodeAt(i + 16) ^ SECRET.charCodeAt(i));
	}
	return bfKey;
};

function copy(this: Uint8Array, target: Uint8Array, targetStart: number, start?: number, end?: number) {
	if (!start) start = 0;
	if (!end && end !== 0) end = this.length;
	if (targetStart >= target.length) targetStart = target.length;
	if (!targetStart) targetStart = 0;
	if (end > 0 && end < start) end = start;

	// Copy 0 bytes; we're done
	if (end === start) return 0;
	if (target.length === 0 || this.length === 0) return 0;

	// Fatal error conditions
	if (targetStart < 0) {
		throw new RangeError("targetStart out of bounds");
	}
	if (start < 0 || start >= this.length) throw new RangeError("Index out of range");
	if (end < 0) throw new RangeError("sourceEnd out of bounds");

	// Are we oob?
	if (end > this.length) end = this.length;
	if (target.length - targetStart < end - start) {
		end = target.length - targetStart + start;
	}

	const len = end - start;

	if (this === target && typeof Uint8Array.prototype.copyWithin === "function") {
		// Use built-in when available, missing from IE11
		this.copyWithin(targetStart, start, end);
	} else {
		Uint8Array.prototype.set.call(target, this.subarray(start, end), targetStart);
	}

	return len;
}

/**
 *
 * @returns Promise that resolves after setimmediate
 */
const sleep = () =>
	new Promise((resolve) => {
		// if setImmediate is not available, use setTimeout
		// @ts-ignore
		if (typeof setImmediate === "undefined") return setTimeout(resolve, 0);
		// @ts-ignore
		setImmediate(resolve);
	});

const createEmptyBuffer = (len: number) => new Uint8Array(new ArrayBuffer(len));

/**
 *
 * @param source Downloaded song from `getTrackDownloadUrl`
 * @param trackId Song ID as string
 * @param progressCallback Callback that gets called with the progress in percent
 * @param _async Whether to use async or sync, sync will block the main thread, set to false when using webworker
 */
export const decryptDownload = async (_source: ArrayBuffer, trackId: string, progressCallback?: (n: number) => void, _async = true) => {
	const source = new Uint8Array(_source);
	//const source = new Uint8Array(_source);
	// let part_size = 0x1800;
	let chunk_size = 2048;
	const blowFishKey = getBlowfishKey(trackId);

	const bf = new Blowfish(blowFishKey, Blowfish.MODE.CBC, Blowfish.PADDING.SPACES); // only key isn't optional
	bf.setIv(new Uint8Array([0, 1, 2, 3, 4, 5, 6, 7]));

	let i = 0;
	let position = 0;

	const source_len = source.length;

	// buffer filled with zeros, with length of source
	const destBuffer = createEmptyBuffer(source_len);

	let progressNum = 0;

	while (position < source_len) {
		const chunk = createEmptyBuffer(chunk_size);
		const size = source_len - position;
		chunk_size = size >= 2048 ? 2048 : size;

		let chunkToWrite: Uint8Array;

		copy.call(source, chunk, 0, position, position + chunk_size);

		if (i % 3 > 0 || chunk_size < 2048) chunkToWrite = chunk;
		else chunkToWrite = bf.decode(chunk, Blowfish.TYPE.UINT8_ARRAY);

		console.log(position, source_len);

		destBuffer.set(chunk_size == 2048 ? chunkToWrite : chunkToWrite.slice(0, chunk_size), position);

		// destBuffer.write(chunkToWrite, position, chunkToWrite.length, "binary");

		position += chunk_size;

		if (_async) await sleep();

		const progressNumNew = Math.floor((position / source_len) * 100);
		if (progressNumNew != progressNum) {
			progressCallback?.((progressNum = progressNumNew));
		}

		i++;
	}

	return destBuffer;
};
