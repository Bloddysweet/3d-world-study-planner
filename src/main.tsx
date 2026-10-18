import React, { Component } from "react";
import type { ErrorInfo, ReactNode } from "react";
import ReactDOM from "react-dom/client";
import {
  BrowserRouter,
  Link,
  Route,
  Routes,
  useLocation,
} from "react-router-dom";
import { ArrowRight, Check, ShieldAlert, Sprout } from "./components/icons";
import { AppProvider, useApp } from "./data/AppProvider";
import { DialogProvider } from "./components/ui";
import { WorldPage, SubjectPage } from "./pages/World";
import { TodayPage, RevisionsPage } from "./pages/Planner";
import { TestsPage } from "./pages/Tests";
import { AnalyticsPage } from "./pages/Analytics";
import { SettingsPage } from "./pages/Settings";
import "./styles.css";
import "./reference.css";
import { AppHeader } from "./components/AppHeader";
import "./components/app-header.css";
import ResponsivePreview, {
  PREVIEW_FRAME_NAME,
} from "./components/ResponsivePreview";
import { AccountBoundary, AuthProvider } from "./auth/AuthProvider";
import { AuthPage } from "./auth/AuthPage";
import "./auth/account.css";
class ErrorBoundary extends Component<
  { children: ReactNode },
  { error: boolean }
> {
  state = { error: false };
  static getDerivedStateFromError() {
    return { error: true };
  }
  componentDidCatch(error: Error, info: ErrorInfo) {
    console.error("Study World could not render", error, info);
  }
  render() {
    return this.state.error ? (
      <div className="fatal-error">
        <Sprout size={40} />
        <h1>Let’s take a little pause.</h1>
        <p>
          Something unexpected happened. Your saved browser data has not been
          reset.
        </p>
        <button className="btn primary" onClick={() => location.reload()}>
          Reload the app
        </button>
      </div>
    ) : (
      this.props.children
    );
  }
}
function Shell() {
  const { data, demo, switchDemo, notice, blocked, storageMessage } = useApp(),
    location = useLocation();
  React.useEffect(() => {
    window.scrollTo(0, 0);
    const page = location.pathname.split("/")[1];
    document.title = `${page ? page[0].toUpperCase() + page.slice(1) : "Your world"} · Study World`;
  }, [location.pathname]);
  const shell = React.useRef<HTMLDivElement>(null);
  React.useLayoutEffect(() => {
    const root = shell.current;
    if (!root) return;
    const header = root.querySelector<HTMLElement>(".site-header")!;
    const notices = root.querySelector<HTMLElement>(".site-notices")!;
    const intro = root.querySelector<HTMLElement>(".world-introduction");
    const measure = () => {
      root.style.setProperty(
        "--site-header-height",
        `${Math.ceil(header.getBoundingClientRect().height)}px`,
      );
      root.style.setProperty(
        "--world-intro-height",
        `${Math.ceil(intro?.getBoundingClientRect().height ?? 0)}px`,
      );
      root.style.setProperty(
        "--site-notices-height",
        `${Math.ceil(notices.getBoundingClientRect().height)}px`,
      );
    };
    const observer = new ResizeObserver(measure);
    observer.observe(header);
    observer.observe(notices);
    if (intro) observer.observe(intro);
    measure();
    return () => observer.disconnect();
  }, [location.pathname, data.preferences.worldMode]);
  const immersive =
    location.pathname === "/" && data.preferences.worldMode === "3d";
  return (
    <div
      ref={shell}
      className={`app-shell reference-shell ${immersive ? "immersive-shell" : ""} ${demo ? "demo-shell" : ""} ${blocked ? "blocked-shell" : ""}`}
    >
      <a className="skip-link" href="#main">
        Skip to content
      </a>
      <AppHeader />
      <div className="site-notices">
        {demo && (
          <div className="demo-banner">
            <span>
              <strong>Demo sandbox.</strong> Example data, separate from your
              personal world.
            </span>
            <button onClick={switchDemo}>
              Return to my workspace <ArrowRight size={12} />
            </button>
          </div>
        )}
        {blocked && (
          <div className="storage-banner" role="alert">
            <ShieldAlert size={19} />
            <span>{storageMessage}</span>
            <Link to="/settings">Backups & recovery</Link>
          </div>
        )}
      </div>
      <main id="main" tabIndex={-1}>
        <Routes>
          <Route path="/" element={<WorldPage />} />
          <Route path="/subjects/:id" element={<SubjectPage />} />
          <Route path="/today" element={<TodayPage />} />
          <Route path="/revisions" element={<RevisionsPage />} />
          <Route path="/tests" element={<TestsPage />} />
          <Route path="/analytics" element={<AnalyticsPage />} />
          <Route path="/settings" element={<SettingsPage />} />
          <Route path="/login" element={<AuthPage />} />
          <Route path="/auth/callback" element={<AuthPage />} />
          <Route path="/reset-password" element={<AuthPage />} />
          <Route
            path="*"
            element={
              <div className="empty">
                <h1>A little off the path.</h1>
                <p>This page doesn’t exist.</p>
                <Link to="/" className="btn primary">
                  Back to your world
                </Link>
              </div>
            }
          />
        </Routes>
      </main>
      <footer className="app-footer">
        <span>
          <Sprout size={15} />A little every day goes a long way.
        </span>
        <span>Local-first. Quietly yours.</span>
      </footer>
      <div
        aria-live="polite"
        aria-atomic="true"
        className={`toast ${notice ? "visible" : ""}`}
      >
        {notice && (
          <>
            <Check size={17} />
            {notice}
          </>
        )}
      </div>
    </div>
  );
}
ReactDOM.createRoot(document.getElementById("root")!).render(
  <React.StrictMode>
    {import.meta.env.DEV && window.name !== PREVIEW_FRAME_NAME ? (
      <ResponsivePreview />
    ) : (
      <ErrorBoundary>
        <AuthProvider>
          <BrowserRouter>
            {/* Remounts the whole study UI when the signed-in account changes,
                discarding prior-account forms and dialogs. */}
            <AccountBoundary>
              <AppProvider>
                <DialogProvider>
                  <Shell />
                </DialogProvider>
              </AppProvider>
            </AccountBoundary>
          </BrowserRouter>
        </AuthProvider>
      </ErrorBoundary>
    )}
  </React.StrictMode>,
);
