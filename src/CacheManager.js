// @flow
import {Platform} from "react-native";
import RNFS from "react-native-fs";
import SHA1 from "crypto-js/sha1";

const BASE_DIR = `${RNFS.DocumentDirectoryPath}/expo-image-cache/`;

export class CacheEntry {

    key: string;
    path: string;

    constructor(key: string) {
        this.key = key;
    }

    async getPath(extension: string, fetchPresignedUrl: () => ?string): Promise<?string> {
        const {key} = this;
        const {path, exists} = await getCacheEntry(key, extension);
        if (exists) {
            return Platform.OS === "android" ? `file://${path}` : path;
        }

        const uri = await fetchPresignedUrl();
        if (!uri) {
            return null;
        }

        try {
            await RNFS.downloadFile({
                fromUrl: uri,
                toFile: path
            });
        } catch (e) {
            return null;
        }

        const downloaded = await RNFS.exists(path);
        if (!downloaded) {
            return null;
        }

        return Platform.OS === "android" ? `file://${path}` : path;
    }
}

export default class CacheManager {

    static entries: { [key: string]: CacheEntry } = {};

    static get(key: string): CacheEntry {
        if (!CacheManager.entries[key]) {
            CacheManager.entries[key] = new CacheEntry(key);
        }
        return CacheManager.entries[key];
    }

    static async clearCache(): Promise<void> {
        try {
            const hasBaseDir = await RNFS.exists(BASE_DIR);
            if (hasBaseDir) {
                await RNFS.unlink(BASE_DIR);
                await createCacheDirectory();
            }
        } catch (e) {
            // do nothing
        }
    }
}

const createCacheDirectory = async (): Promise<void> => {
    await RNFS.mkdir(BASE_DIR, {
        ...Platform.select({
            ios: {
                NSURLIsExcludedFromBackupKey: true
            },
            android: {}
        })
    });
};

const getCacheEntry = async (key: string, extension: string): Promise<{ exists: boolean, path: string }> => {
    try {
        const hasBaseDir = await RNFS.exists(BASE_DIR);
        if (!hasBaseDir) {
            await createCacheDirectory();
        }
    } catch (e) {
        // do nothing
    }

    const path = `${BASE_DIR}${SHA1(key)}${extension}`;
    const exists = await RNFS.exists(path);
    return { exists, path };
};
