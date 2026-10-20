import { useEffect, useState } from "react";
import { Link, useLocation, useNavigate } from "react-router-dom";
import { Field, Heading, Page } from "../components/ui";
import { ArrowLeft, IslandMark } from "../components/icons";
import { useAuth } from "./AuthProvider";
import { supabase } from "./client";

function GoogleMark() {
  return (
    <svg viewBox="0 0 18 18" width="17" height="17" aria-hidden="true">
      <path
        fill="#4285F4"
        d="M17.64 9.2c0-.64-.06-1.25-.16-1.84H9v3.48h4.84a4.14 4.14 0 0 1-1.8 2.72v2.26h2.92c1.7-1.57 2.68-3.88 2.68-6.62Z"
      />
      <path
        fill="#34A853"
        d="M9 18c2.43 0 4.47-.8 5.96-2.18l-2.92-2.26c-.8.54-1.84.86-3.04.86-2.34 0-4.32-1.58-5.03-3.7H.96v2.33A9 9 0 0 0 9 18Z"
      />
      <path
        fill="#FBBC05"
        d="M3.97 10.72a5.4 5.4 0 0 1 0-3.44V4.95H.96a9 9 0 0 0 0 8.1l3.01-2.33Z"
      />
      <path
        fill="#EA4335"
        d="M9 3.58c1.32 0 2.5.45 3.44 1.35l2.58-2.59C13.46.89 11.43 0 9 0A9 9 0 0 0 .96 4.95l3.01 2.33C4.68 5.16 6.66 3.58 9 3.58Z"
      />
    </svg>
  );
}
export function AuthPage() {
  const auth = useAuth(),
    location = useLocation(),
    navigate = useNavigate();
  const [mode, setMode] = useState<"login" | "signup" | "forgot" | "password">(
    location.pathname === "/reset-password" ? "password" : "login",
  );
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [confirmation, setConfirmation] = useState("");
  const [agreed, setAgreed] = useState(false);
  const [busy, setBusy] = useState(false),
    [message, setMessage] = useState(""),
    [error, setError] = useState("");
  const recovering = mode === "password" || auth.recovery;
  useEffect(() => {
    if (auth.user && !auth.recovery && location.pathname !== "/reset-password")
      navigate("/settings#account", { replace: true });
  }, [auth.user, auth.recovery, location.pathname, navigate]);
  function changeMode(next: typeof mode) {
    setMode(next);
    setPassword("");
    setConfirmation("");
    setAgreed(false);
    setMessage("");
    setError("");
  }
  async function signInWithGoogle() {
    if (!supabase) return;
    setError("");
    setBusy(true);
    const result = await supabase.auth.signInWithOAuth({
      provider: "google",
      options: { redirectTo: `${window.location.origin}/auth/callback` },
    });
    if (result.error) {
      setError(result.error.message);
      setBusy(false);
    }
  }
  return (
    <Page className="auth-page">
      <section className="panel auth-card">
        <div className="auth-card-top">
          <Link className="auth-brand" to="/">
            <span className="auth-brand-mark">
              <IslandMark size={34} />
            </span>
            <span className="auth-brand-text">
              <strong>Study World</strong>
              <em>A LITTLE EVERY DAY</em>
            </span>
          </Link>
          <Link className="auth-back" to="/">
            <ArrowLeft size={15} />
            Back to home
          </Link>
        </div>
        <Heading
          title={
            recovering
              ? "Choose a new password"
              : mode === "signup"
                ? "Create your account"
                : mode === "forgot"
                  ? "Reset your password"
                  : "Welcome back"
          }
          description={
            recovering
              ? "Set a new password for your account."
              : mode === "signup"
                ? "Create your private study world."
                : mode === "forgot"
                  ? "We’ll email you a secure reset link."
                  : "Sign in to continue your study world."
          }
        />
        {!supabase ? (
          <div className="callout soft" role="status">
            <strong>Sign-in is unavailable right now</strong>
            <p>Please try again shortly, or contact support if it persists.</p>
          </div>
        ) : (
          <>
            {auth.error && (
              <p role="alert" className="callout rose">
                {auth.error}
              </p>
            )}
            {location.pathname === "/auth/callback" && !auth.user && (
              <p className="callout amber">
                If your email link expired or was opened on a different browser,
                request a new link or sign in below.
              </p>
            )}
            {!recovering && mode !== "forgot" && (
              <>
                <button
                  type="button"
                  className="btn auth-google"
                  disabled={busy}
                  onClick={signInWithGoogle}
                >
                  <GoogleMark />
                  Continue with Google
                </button>
                <div className="auth-divider">
                  <span>or continue with email</span>
                </div>
              </>
            )}
            {recovering && !auth.user ? (
              <>
                <p>
                  Open a valid password-reset email in the browser where you
                  requested it, or request a new link below.
                </p>
                <button className="btn" onClick={() => changeMode("forgot")}>
                  Request reset link
                </button>
              </>
            ) : (
              <form
                onSubmit={async (event) => {
                  event.preventDefault();
                  setError("");
                  setMessage("");
                  if (recovering && password !== confirmation) {
                    setError("Both passwords should match.");
                    return;
                  }
                  if (mode === "signup" && !agreed) {
                    setError("Please tick “I agree” to continue.");
                    return;
                  }
                  if (!supabase) return;
                  setBusy(true);
                  try {
                    if (recovering) {
                      const result = await supabase.auth.updateUser({
                        password,
                      });
                      if (result.error) throw result.error;
                      auth.finishRecovery?.();
                      navigate("/settings#account", { replace: true });
                    } else if (mode === "forgot") {
                      const result = await supabase.auth.resetPasswordForEmail(
                        email.trim(),
                        {
                          redirectTo: `${window.location.origin}/reset-password`,
                        },
                      );
                      if (result.error) throw result.error;
                      setMessage(
                        "If this address has an account, a reset email will arrive. Check spam too. Open the link in this browser.",
                      );
                    } else if (mode === "signup") {
                      const result = await supabase.auth.signUp({
                        email: email.trim(),
                        password,
                        options: {
                          emailRedirectTo: `${window.location.origin}/auth/callback`,
                        },
                      });
                      if (result.error) throw result.error;
                      setPassword("");
                      setMessage(
                        `Check your email — we've sent a confirmation to ${email.trim()}. Open its link, or enter the one-time code (OTP) it contains, to confirm your account, then sign in. Check spam if nothing arrives.`,
                      );
                    } else {
                      const result = await supabase.auth.signInWithPassword({
                        email: email.trim(),
                        password,
                      });
                      if (result.error) throw result.error;
                    }
                  } catch (reason) {
                    setError(
                      reason instanceof Error
                        ? reason.message
                        : "Could not connect. Please try again.",
                    );
                  } finally {
                    setBusy(false);
                  }
                }}
              >
                <fieldset disabled={busy} className="auth-fields">
                  {!recovering && (
                    <Field label="Email address">
                      <input
                        required
                        type="email"
                        autoComplete="email"
                        value={email}
                        onChange={(e) => setEmail(e.target.value)}
                        maxLength={254}
                      />
                    </Field>
                  )}
                  {(recovering || mode !== "forgot") && (
                    <Field
                      label={recovering ? "New password" : "Password"}
                      hint={
                        mode === "signup" || recovering
                          ? "Use at least 8 characters."
                          : undefined
                      }
                    >
                      <input
                        required
                        type="password"
                        minLength={mode === "signup" || recovering ? 8 : 1}
                        maxLength={128}
                        autoComplete={
                          mode === "login" && !recovering
                            ? "current-password"
                            : "new-password"
                        }
                        value={password}
                        onChange={(e) => setPassword(e.target.value)}
                      />
                    </Field>
                  )}
                  {recovering && (
                    <Field label="Repeat new password">
                      <input
                        required
                        type="password"
                        minLength={8}
                        maxLength={128}
                        autoComplete="new-password"
                        value={confirmation}
                        onChange={(e) => setConfirmation(e.target.value)}
                      />
                    </Field>
                  )}
                  {mode === "signup" && !recovering && (
                    <label className="auth-consent">
                      <input
                        type="checkbox"
                        checked={agreed}
                        onChange={(e) => setAgreed(e.target.checked)}
                      />
                      I agree to the privacy terms — my study data stays in my
                      account and is never shared.
                    </label>
                  )}
                  <button type="submit" className="btn primary">
                    {busy
                      ? "Please wait…"
                      : recovering
                        ? "Save new password"
                        : mode === "signup"
                          ? "Create account"
                          : mode === "forgot"
                            ? "Send reset link"
                            : "Sign in"}
                  </button>
                </fieldset>
              </form>
            )}
            {error && (
              <p className="callout rose" role="alert">
                {error}
              </p>
            )}
            {message && (
              <p className="callout" role="status">
                {message}
              </p>
            )}
            {!recovering && (
              <div className="account-actions">
                <button
                  className="btn"
                  disabled={busy}
                  onClick={() =>
                    changeMode(mode === "signup" ? "login" : "signup")
                  }
                >
                  {mode === "signup"
                    ? "I already have an account"
                    : "Create an account"}
                </button>
                <button
                  className="btn"
                  disabled={busy}
                  onClick={() =>
                    changeMode(mode === "forgot" ? "login" : "forgot")
                  }
                >
                  {mode === "forgot" ? "Back to sign in" : "Forgot password?"}
                </button>
              </div>
            )}
          </>
        )}
        <p className="small muted">
          Your existing browser progress stays untouched until you import it.
        </p>
        <p className="auth-legal">
          By continuing, you agree to our{" "}
          <Link to="/terms">Terms of Service</Link> and{" "}
          <Link to="/privacy">Privacy Policy</Link>.
        </p>
      </section>
    </Page>
  );
}
