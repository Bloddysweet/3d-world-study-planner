import { createClient } from "@supabase/supabase-js";

import { PREVIEW_FRAME_NAME } from "../preview-frame";
import { cloudConfiguration } from "./config";
const config = cloudConfiguration(
  import.meta.env.VITE_SUPABASE_URL,
  import.meta.env.VITE_SUPABASE_PUBLISHABLE_KEY,
);
export const cloudConfigurationError = config.error;
export const supabase =
  config.url &&
  config.key &&
  !(
    import.meta.env.DEV &&
    typeof window !== "undefined" &&
    window.name !== PREVIEW_FRAME_NAME
  )
    ? createClient(config.url, config.key, {
        auth: {
          flowType: "pkce",
          persistSession: true,
          autoRefreshToken: true,
          detectSessionInUrl: true,
        },
        global: {
          fetch: (input, init) =>
            fetch(input, {
              ...init,
              signal: init?.signal
                ? AbortSignal.any([init.signal, AbortSignal.timeout(20_000)])
                : AbortSignal.timeout(20_000),
            }),
        },
      })
    : null;
