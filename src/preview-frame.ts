/**
 * Window name of the dev preview app iframe. Shared by ResponsivePreview (which
 * names the frame) and the auth client/main shell (which check `window.name`).
 * The outer preview shell must not create a competing Supabase auth client or
 * a second app instance; only the mounted app inside this frame does.
 */
export const PREVIEW_FRAME_NAME = "study-world-app";
