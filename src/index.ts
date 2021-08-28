import { createAvatar } from '@dicebear/avatars';
const style_gridy = require('@dicebear/avatars-gridy-sprites');
import { blake2sHex } from 'blakets';
import { hash, verify } from 'doge-passwd';
import nsblob from 'nsblob';

export type PictureBody = Buffer | string;

export type IncompletePictureMeta = {
	'content-type': string;
	'content-length'?: number | string;
};

export type PictureMeta = {
	'content-type': string;
	'content-length': number | string;
};

export type Picture =
	| PictureBody
	| {
			head: PictureMeta;
			body: PictureBody;
	  };

export interface ProfileData {
	username?: string;
	password?: string;
	picture?: Picture | Promise<Picture>;
	gender?: string;
}

export async function create_image_store_raw(
	img: Buffer | string,
	meta?: IncompletePictureMeta
): Promise<Picture> {
	return meta
		? {
				head: {
					...meta,
					'content-length': img.length,
				},
				body: await nsblob.store(img),
		  }
		: nsblob.store(img);
}

export async function create_image_store(
	img: Picture,
	meta?: IncompletePictureMeta
): Promise<Picture | undefined> {
	if (img instanceof Buffer) {
		return create_image_store_raw(img, meta);
	} else if (typeof img === 'string') {
		if (img.match(/^[0-9a-f]{64}$/)) {
			return meta?.['content-type'] && meta?.['content-length']
				? {
						head: meta as PictureMeta,
						body: img,
				  }
				: img;
		} else return create_image_store_raw(img, meta);
	} else if (typeof img === 'object') {
		return create_image_store(img.body, img.head);
	}
}

export async function fetch_image_store(
	img: Picture,
	meta?: PictureMeta
): Promise<Picture | undefined> {
	if (img instanceof Buffer || typeof img === 'string') {
		if (typeof img === 'string' && img.match(/^[0-9a-f]{64}$/)) {
			return meta
				? {
						head: meta,
						body: await nsblob.fetch(img),
				  }
				: nsblob.fetch(img);
		} else
			return meta
				? {
						head: {
							...meta,
							'content-length': img.length,
						},
						body: img,
				  }
				: img;
	} else if (typeof img === 'object') {
		return fetch_image_store(
			img.body,
			meta ? { ...meta, ...img.head } : img.head
		);
	}
}

export function generate_avatar(username: string): Picture {
	const body = createAvatar(style_gridy, {
		seed: blake2sHex(username || ''),
		mood: ['happy'],
	});
	return {
		head: {
			'content-type': 'image/svg+xml',
			'content-length': body.length,
		},
		body,
	};
}

export async function get_picture(profile: Profile): Promise<Picture> {
	const fd = await profile.data.picture;
	const ret = fd && (await fetch_image_store(fd));
	return ret || generate_avatar(profile.username || '');
}

export class Profile implements ProfileData {
	data: ProfileData;
	constructor(data?: string | ProfileData) {
		if (typeof data === 'object') {
			this.data = data;
		} else {
			try {
				this.data = data ? JSON.parse(data) : {};
				if (typeof this.data !== 'object') {
					this.data = {};
				}
			} catch (error) {
				this.data = {};
			}
		}
	}
	/**
	 * Method to be used by the internals of JSON.stringify
	 * @returns an object, not JSON!
	 */
	toJSON() {
		return {
			username: this.username,
			password: this.password,
			gender: this.gender,
			...this.data,
		};
	}
	/**
	 * creates JSON string from this object
	 * @returns JSON
	 */
	toString() {
		return JSON.stringify(this);
	}
	get username(): string | undefined {
		return this.data.username || undefined;
	}
	set username(v: string | undefined) {
		v && (this.data.username = v);
	}
	get password(): string | undefined {
		return this.data.password || undefined;
	}
	set password(p: string | undefined) {
		p && (this.data.password = hash(p));
	}
	check_password(p: string): boolean {
		return !!this.data.password && verify(p, this.data.password);
	}
	get picture(): Picture | Promise<Picture> {
		return get_picture(this);
	}
	set picture(p: Picture | Promise<Picture>) {
		Promise.resolve(p)
			.then(create_image_store)
			.then((p) => (this.data.picture = p));
	}
	get gender(): string | undefined {
		return this.data.gender ?? undefined;
	}
	set gender(v: string | undefined) {
		this.data.gender = v;
	}
}
