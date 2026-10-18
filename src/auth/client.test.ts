import { describe, expect, it } from "vitest";
import { cloudConfiguration } from "./config";
describe("public-only Supabase configuration", () => {
  it("allows local-only use without configuration", () =>
    expect(cloudConfiguration().error).toContain("not configured"));
  it("accepts only HTTPS and public publishable/legacy anon keys", () => {
    expect(
      cloudConfiguration(
        "https://example.supabase.co",
        "sb_publishable_example_public_key",
      ).error,
    ).toBe("");
    const jwt = (role: string) =>
      `eyJhbGciOiJIUzI1NiJ9.${btoa(JSON.stringify({ role }))}.signature`;
    expect(
      cloudConfiguration("https://example.supabase.co", jwt("anon")).error,
    ).toBe("");
    expect(
      cloudConfiguration("https://example.supabase.co", jwt("service_role"))
        .error,
    ).toContain("invalid");
    expect(
      cloudConfiguration("https://example.supabase.co", "sb_secret_not_public")
        .error,
    ).toContain("invalid");
    expect(
      cloudConfiguration(
        "http://example.supabase.co",
        "sb_publishable_example_public_key",
      ).error,
    ).toContain("invalid");
  });
});
