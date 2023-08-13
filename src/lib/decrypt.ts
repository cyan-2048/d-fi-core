import { md5 } from "./md5";
import { Blowfish } from "egoroof-blowfish";
import { Buffer } from "./buffer.js";

const getBlowfishKey = (trackId: string) => {
	const SECRET = "g4el58wc" + "0zvf9na1";
	const idMd5 = md5(trackId);
	let bfKey = "";
	for (let i = 0; i < 16; i++) {
		bfKey += String.fromCharCode(idMd5.charCodeAt(i) ^ idMd5.charCodeAt(i + 16) ^ SECRET.charCodeAt(i));
	}
	return bfKey;
};

/**
 *
 * @returns Promise that resolves after setimmediate
 */
const sleep = () =>
	new Promise((resolve) => {
		// if setImmediate is not available, use setTimeout
		if (typeof setImmediate === "undefined") return setTimeout(resolve, 0);
		setImmediate(resolve);
	});

/**
 *
 * @param source Downloaded song from `getTrackDownloadUrl`
 * @param trackId Song ID as string
 * @param progressCallback Callback that gets called with the progress in percent
 * @param _async Whether to use async or sync, sync will block the main thread, set to false when using webworker
 */
export const decryptDownload = async (_source: ArrayBuffer, trackId: string, progressCallback?: (n: number) => void, _async = true) => {
	const source = Buffer.from(_source);
	// let part_size = 0x1800;
	let chunk_size = 2048;
	const blowFishKey = getBlowfishKey(trackId);

	const bf = new Blowfish(blowFishKey, Blowfish.MODE.CBC, Blowfish.PADDING.SPACES); // only key isn't optional
	bf.setIv(Buffer.from([0, 1, 2, 3, 4, 5, 6, 7]));

	let i = 0;
	let position = 0;

	const source_len = source.length;

	const destBuffer = Buffer.alloc(source_len);
	destBuffer.fill(0);

	let progressNum = 0;

	while (position < source_len) {
		const chunk = Buffer.alloc(chunk_size);
		const size = source_len - position;
		chunk_size = size >= 2048 ? 2048 : size;

		let chunkString;
		chunk.fill(0);
		source.copy(chunk, 0, position, position + chunk_size);
		if (i % 3 > 0 || chunk_size < 2048) chunkString = chunk.toString("binary");
		else chunkString = Buffer.from(bf.decode(chunk, Blowfish.TYPE.UINT8_ARRAY)).toString("binary");

		destBuffer.write(chunkString, position, chunkString.length, "binary");

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
