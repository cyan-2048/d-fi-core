import instance from "../lib/request";
import type { trackType } from "../types";

interface userData {
	license_token: string;
	can_stream_lossless: boolean;
	can_stream_hq: boolean;
	country: string;
}

export class WrongLicense extends Error {
	constructor(format: string) {
		super();
		this.name = "WrongLicense";
		this.message = `Your account can't stream ${format} tracks`;
	}
}

export class GeoBlocked extends Error {
	constructor(country: string) {
		super();
		this.name = "GeoBlocked";
		this.message = `This track is not available in your country (${country})`;
	}
}

let user_data: userData | null = null;

const dzAuthenticate = async (): Promise<userData> => {
	const { results } = await instance.get("https://www.deezer.com/ajax/gw-light.php", {
		method: "deezer.getUserData",
		api_version: "1.0",
		api_token: "null",
	});
	user_data = {
		license_token: results.USER.OPTIONS.license_token,
		can_stream_lossless: results.USER.OPTIONS.web_lossless || results.USER.OPTIONS.mobile_loseless,
		can_stream_hq: results.USER.OPTIONS.web_hq || results.USER.OPTIONS.mobile_hq,
		country: results.COUNTRY,
	};
	return user_data;
};

const getTrackUrlFromServer = async (track_token: string, format: string): Promise<string | null> => {
	const user = user_data ? user_data : await dzAuthenticate();
	if ((format === "FLAC" && !user.can_stream_lossless) || (format === "MP3_320" && !user.can_stream_hq)) {
		throw new WrongLicense(format);
	}

	const response = await instance.post("https://media.deezer.com/v1/get_url", {
		license_token: user.license_token,
		media: [
			{
				type: "FULL",
				formats: [{ format, cipher: "BF_CBC_STRIPE" }],
			},
		],
		track_tokens: [track_token],
	});

	if (response.data.length > 0) {
		if (response.data[0].errors) {
			if (response.data[0].errors[0].code === 2002) {
				throw new GeoBlocked(user.country);
			}
			throw new Error(Object.entries(response.data[0].errors[0]).join(", "));
		}
		return response.data[0].media.length > 0 ? response.data[0].media[0].sources[0].url : null;
	}
	return null;
};

/**
 * @param track Track info json returned from `getTrackInfo`
 * @param quality 1 = 128kbps, 3 = 320kbps and 9 = flac (around 1411kbps)
 */
export const getTrackDownloadUrl = async (track: trackType, quality: number): Promise<{ trackUrl: string; isEncrypted: boolean; fileSize: number } | null> => {
	let wrongLicense: WrongLicense | null = null;
	let geoBlocked: GeoBlocked | null = null;
	let formatName: string;
	switch (quality) {
		case 9:
			formatName = "FLAC";
			break;
		case 3:
			formatName = "MP3_320";
			break;
		case 1:
			formatName = "MP3_128";
			break;
		default:
			throw new Error(`Unknown quality ${quality}`);
	}

	// Get URL with the official API
	try {
		const url = await getTrackUrlFromServer(track.TRACK_TOKEN, formatName);
		if (url) {
			const fileSize = await testUrl(url);
			if (fileSize > 0) {
				return {
					trackUrl: url,
					isEncrypted: url.includes("/mobile/") || url.includes("/media/"),
					fileSize: fileSize,
				};
			}
		}
	} catch (err) {
		if (err instanceof WrongLicense) {
			wrongLicense = err;
		} else if (err instanceof GeoBlocked) {
			geoBlocked = err;
		} else {
			throw err;
		}
	}

	if (wrongLicense) {
		throw wrongLicense;
	}
	if (geoBlocked) {
		throw geoBlocked;
	}
	return null;
};

async function testUrl(url: string): Promise<number> {
	return new Promise((resolve) => {
		// @ts-ignore
		const xhr = new XMLHttpRequest({ mozSystem: true });
		xhr.open("HEAD", url);
		xhr.addEventListener("load", (e) => {
			resolve(Number(xhr.getResponseHeader("content-length")));
		});
		xhr.send();
	});
}
