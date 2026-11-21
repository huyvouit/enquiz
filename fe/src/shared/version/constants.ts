/** The release this build belongs to (plan D21), set by vite.config.ts. */
export const APP_VERSION: string = import.meta.env.VITE_APP_VERSION || 'dev'
export const GIT_COMMIT: string = import.meta.env.VITE_GIT_COMMIT || 'unknown'
