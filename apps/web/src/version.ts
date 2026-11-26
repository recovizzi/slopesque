// The extension's version (apps/extension/package.json, put in at the build: vite.config.ts).
declare const __EXT_VERSION__: string;
export const EXT_VERSION = __EXT_VERSION__;
// The released extension, or the development one (« Slopesque (dev) », beside it): SLOPESQUE_RELEASE=1 at the build.
declare const __RELEASE__: boolean;
export const RELEASE = __RELEASE__;
export const APP_NAME = RELEASE ? 'Slopesque' : 'Slopesque (dev)';
