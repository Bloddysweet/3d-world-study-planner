import { useEffect, useRef, useState } from "react";
import { Monitor, Smartphone, Tablet, RotateCw } from "./icons";
import "./responsive-preview.css";

// A same-origin frame gives CSS, dialogs and the 3D canvas a real viewport.
// There is only one mounted app; resizing never reloads its workspace or drafts.
import { PREVIEW_FRAME_NAME } from "../preview-frame";
export { PREVIEW_FRAME_NAME };
type Mode = "desktop" | "tablet" | "mobile";
const devices = [
  { mode: "desktop", label: "Desktop", Icon: Monitor },
  { mode: "tablet", label: "Tablet", Icon: Tablet },
  { mode: "mobile", label: "Mobile", Icon: Smartphone },
] as const;

export default function ResponsivePreview() {
  const stage = useRef<HTMLDivElement>(null);
  const [mode, setMode] = useState<Mode>("mobile");
  const [fit, setFit] = useState(true);
  const [mobileWidth, setMobileWidth] = useState(390);
  const [landscape, setLandscape] = useState(false);
  const [available, setAvailable] = useState({ width: 0, height: 0 });
  const [source] = useState(
    () => location.pathname + location.search + location.hash,
  );
  useEffect(() => {
    const element = stage.current;
    if (!element) return;
    const observer = new ResizeObserver(([entry]) => {
      setAvailable({
        width: entry.contentRect.width,
        height: entry.contentRect.height,
      });
    });
    observer.observe(element);
    return () => observer.disconnect();
  }, []);
  const portrait =
    mode === "tablet"
      ? { width: 768, height: 1024 }
      : { width: mobileWidth, height: mobileWidth === 320 ? 720 : 844 };
  const viewport =
    mode === "desktop"
      ? {
          width: Math.max(1, Math.floor(available.width)),
          height: Math.max(1, Math.floor(available.height)),
        }
      : landscape
        ? { width: portrait.height, height: portrait.width }
        : portrait;
  const scale =
    mode !== "desktop" && !fit
      ? 1
      : Math.min(
          1,
          available.width / viewport.width,
          available.height / viewport.height,
        );
  return (
    <div className="responsive-preview">
      <header
        className="responsive-preview-toolbar"
        aria-label="Responsive layout preview"
      >
        <strong className="responsive-preview-title">Layout preview</strong>
        <div
          className="responsive-preview-modes"
          role="group"
          aria-label="Preview device"
        >
          {devices.map(({ mode: value, label, Icon }) => (
            <button
              key={value}
              type="button"
              aria-pressed={mode === value}
              onClick={() => {
                setMode(value);
                setLandscape(false);
              }}
            >
              <Icon size={16} aria-hidden="true" />
              {label}
            </button>
          ))}
        </div>
        {mode === "mobile" && (
          <label className="responsive-preview-width">
            <span className="sr-only">Mobile preview width</span>
            <select
              aria-label="Mobile preview width"
              value={mobileWidth}
              onChange={(e) => setMobileWidth(Number(e.target.value))}
            >
              <option value={320}>320 px</option>
              <option value={390}>390 px</option>
              <option value={430}>430 px</option>
            </select>
          </label>
        )}
        {mode !== "desktop" && (
          <button
            type="button"
            className="responsive-preview-rotate"
            aria-label="Rotate preview"
            aria-pressed={landscape}
            onClick={() => setLandscape((value) => !value)}
          >
            <RotateCw size={16} aria-hidden="true" />
            <span>Rotate</span>
          </button>
        )}
        {mode !== "desktop" && (
          <button
            type="button"
            className="responsive-preview-rotate"
            aria-label="Show actual preview size"
            aria-pressed={!fit}
            onClick={() => setFit((value) => !value)}
          >
            100%
          </button>
        )}
        <output className="responsive-preview-size" aria-live="polite">
          {viewport.width} × {viewport.height}{" "}
          <span>· {Math.round(scale * 100)}%</span>
        </output>
      </header>
      <div
        className={`responsive-preview-stage ${mode !== "desktop" && !fit ? "is-unscaled" : ""}`}
        ref={stage}
      >
        <div
          className={`responsive-preview-device is-${mode}`}
          style={{
            width: viewport.width * scale,
            height: viewport.height * scale,
            visibility: available.width > 0 ? "visible" : "hidden",
          }}
        >
          <iframe
            name={PREVIEW_FRAME_NAME}
            title="Study World interactive app preview"
            src={source}
            style={{
              width: viewport.width,
              height: viewport.height,
              transform: `scale(${scale})`,
            }}
          />
        </div>
      </div>
      <p className="responsive-preview-note">
        Live app · size changes keep your work · layout preview, not
        touch-device emulation
      </p>
    </div>
  );
}
