/** These are public browser credentials. Secret/service-role keys are rejected. */
export function cloudConfiguration(url = "", key = "") {
  if (!url && !key)
    return { error: "Cloud login is not configured. Local mode still works." };
  try {
    if (new URL(url).protocol !== "https:") throw new Error();
    let publicKey = key.startsWith("sb_publishable_") && key.length > 20;
    if (key.startsWith("eyJ")) {
      const payload = JSON.parse(
        atob(key.split(".")[1].replace(/-/g, "+").replace(/_/g, "/")),
      );
      publicKey = payload.role === "anon";
    }
    if (!publicKey) throw new Error();
    return { url, key, error: "" };
  } catch {
    return {
      error:
        "Cloud configuration is invalid. Use an HTTPS project URL and its publishable key, never a secret/service-role key.",
    };
  }
}
