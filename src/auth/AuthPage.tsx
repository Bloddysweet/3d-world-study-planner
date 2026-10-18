import { useEffect, useState } from "react";
import { Link, useLocation, useNavigate } from "react-router-dom";
import { Field, Heading, Page } from "../components/ui";
import { useAuth } from "./AuthProvider";
import { cloudConfigurationError, supabase } from "./client";
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
    setMessage("");
    setError("");
  }
  return (
    <Page className="auth-page">
      <Heading
        title={
          recovering
            ? "Choose a new password"
            : mode === "signup"
              ? "Create your account"
              : mode === "forgot"
                ? "Reset your password"
                : "Welcome to Study World"
        }
        description="Your private study progress, on your devices. Local mode is still available."
      />
      <section className="panel auth-card">
        {!supabase ? (
          <>
            <p role="alert">{cloudConfigurationError}</p>
            <p>
              Add VITE_SUPABASE_URL and VITE_SUPABASE_PUBLISHABLE_KEY to the
              hosting environment, then rebuild.
            </p>
          </>
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
                  if (!supabase) return;
                  setError("");
                  setMessage("");
                  if (recovering && password !== confirmation) {
                    setError("The two passwords do not match.");
                    return;
                  }
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
                        "Check your email to confirm your account, then sign in. Open the confirmation link in this browser. If no email arrives, the project owner may need to configure email delivery.",
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
        <Link to="/" className="account-local-link">
          Back to my world — {auth.user ? "stay signed in" : "continue locally"}
        </Link>
        <p className="small muted">
          Signing in never automatically uploads your existing browser progress
          or demo data.
        </p>
      </section>
    </Page>
  );
}
