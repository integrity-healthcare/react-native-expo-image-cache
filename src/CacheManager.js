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
            const result = await RNFS.downloadFile({
                fromUrl: uri,
                toFile: path
            });
            await result.promise;
            return Platform.OS === "android" ? `file://${path}` : path;
        } catch (e) {
            // do nothing
        }

        return null;
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

    static async clearCacheFiles(olderThan: Date): Promise<void> {
        try {
            const hasBaseDir = await RNFS.exists(BASE_DIR);
            if (!hasBaseDir) {
                return;
            }

            let cacheFiles: ?Array<Object> = null;
            cacheFiles = await RNFS.readDir(BASE_DIR);
            cacheFiles = cacheFiles.filter(cacheFile => cacheFile.mtime && cacheFile.mtime < olderThan)
            if (!cacheFiles && cacheFiles.length <= 0) {
                return;
            }

            const promises = cacheFiles.map(cacheFile => RNFS.unlink(cacheFile.path));
            // Be aware that it is fail-fast.
            await Promise.all(promises);
        } catch (e) {
            return;
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
