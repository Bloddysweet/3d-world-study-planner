import type { SVGProps } from "react";

/** Original Study World vectors: soft facets, rounded edges and island motifs.
 * All glyphs share a 32-unit artboard and inherit the surrounding text/subject colour.
 * No fonts, images, IDs, filters, animation or external requests are needed.
 */
const glyphs = {
  pauseMotion: (
    <>
      <rect
        x="8"
        y="6"
        width="5"
        height="20"
        rx="1.5"
        fill="currentColor"
        fillOpacity=".18"
      />
      <rect
        x="19"
        y="6"
        width="5"
        height="20"
        rx="1.5"
        fill="currentColor"
        fillOpacity=".18"
      />
    </>
  ),
  playMotion: (
    <path d="m10 6 16 10-16 10Z" fill="currentColor" fillOpacity=".18" />
  ),
  world: (
    <>
      <path
        fill="currentColor"
        fillOpacity=".16"
        stroke="none"
        d="m4 18 12-6 12 6-12 11Z"
      />
      <path d="m4 18 12 6 12-6-12-6Zm0 0 6 8 6 3 6-3 6-8M16 24v5" />
      <path fill="currentColor" fillOpacity=".25" d="m16 3 4 8-4 5-4-5Z" />
      <path d="M16 3v13" />
    </>
  ),
  today: (
    <>
      <path
        fill="currentColor"
        fillOpacity=".13"
        stroke="none"
        d="M4 12h23v17H4z"
      />
      <path d="M16 12H4v17h23V16M4 18h23M8 23l2 2 3-4m4 3h6" />
      <circle cx="23" cy="8" r="3.5" fill="currentColor" fillOpacity=".18" />
      <path d="M23 2.5v-1M23 15v-1M17 8h-1m14 0h-1m-10-4-1-1m10 10-1-1m0-8 1-1" />
    </>
  ),
  revisions: (
    <>
      <path
        fill="currentColor"
        fillOpacity=".14"
        stroke="none"
        d="M9 9h15v16H9z"
      />
      <path d="M12 8h12v17H12l-4 3V12l4-4M12 8v17M16 13h5m-5 5h3" />
      <path d="M4 19a12 12 0 0 1 3-11M3 12l4-4 2 5M28 16a12 12 0 0 1-3 9m4-4-4 4-2-5" />
    </>
  ),
  tests: (
    <>
      <path
        fill="currentColor"
        fillOpacity=".14"
        stroke="none"
        d="M7 7h18v21H7z"
      />
      <path d="M11 7H7v21h18V7h-4M12 4h8v6h-8zM11 17l3 3 7-7M11 25h10" />
    </>
  ),
  analytics: (
    <>
      <path
        fill="currentColor"
        fillOpacity=".2"
        stroke="none"
        d="M6 20h5v8H6zm8-5h5v13h-5zm8-7h5v20h-5z"
      />
      <path d="M4 28h25M6 24v-4h5v4m3 0v-9h5v9m3 0V8h5v16M6 13l8-5 4 2 7-6" />
    </>
  ),
  settings: (
    <>
      <path d="M5 8h22M5 16h22M5 24h22" />
      <rect x="9" y="5" width="6" height="6" rx="2" fill="currentColor" />
      <rect x="19" y="13" width="6" height="6" rx="2" fill="currentColor" />
      <rect x="7" y="21" width="6" height="6" rx="2" fill="currentColor" />
    </>
  ),
  maths: (
    <>
      <path
        fill="currentColor"
        fillOpacity=".13"
        stroke="none"
        d="M5 7h22v19H5z"
      />
      <path d="M5 28V7h22v21M8 12h16M8 18h16M8 24h16" />
      <rect x="10" y="9" width="4" height="6" rx="1.5" fill="currentColor" />
      <rect x="18" y="15" width="4" height="6" rx="1.5" fill="currentColor" />
      <rect x="12" y="21" width="4" height="6" rx="1.5" fill="currentColor" />
    </>
  ),
  reasoning: (
    <>
      <path
        fill="currentColor"
        fillOpacity=".15"
        stroke="none"
        d="m5 20 7-4 7 4-7 4Zm7-10 7-4 7 4-7 4Z"
      />
      <path d="m5 20 7-4 7 4-7 4Zm0 0v5l7 4 7-4v-5M12 24v5m0-19 7-4 7 4-7 4Zm0 0v5m7-1v5l7-4v-5M22 22l5-3v8l-5 3" />
    </>
  ),
  english: (
    <>
      <path
        fill="currentColor"
        fillOpacity=".16"
        stroke="none"
        d="m5 11 14-5 8 4-14 5Z"
      />
      <path d="m5 11 14-5 8 4-14 5Zm0 0v5l8 4 14-5v-5M5 21l8 4 14-5M5 21v5l8 4 14-5v-5M13 15v5m0 5v5M9 4l7-2" />
    </>
  ),
  gk: (
    <>
      <circle cx="16" cy="13" r="10" fill="currentColor" fillOpacity=".12" />
      <path d="M6 13h20M16 3c-6 5-6 15 0 20 6-5 6-15 0-20M8 8h16M8 18h16M16 23v5M10 29h12" />
    </>
  ),
  dsa: (
    <>
      <path d="M16 10v5M7 20v-5h18v5M16 15v5" />
      <path
        fill="currentColor"
        fillOpacity=".16"
        d="m16 3 5 3-5 4-5-4Zm-9 17 5 3-5 5-5-5Zm9 0 5 3-5 5-5-5Zm9 0 5 3-5 5-5-5Z"
      />
    </>
  ),
  software: (
    <>
      <path
        fill="currentColor"
        fillOpacity=".13"
        stroke="none"
        d="M6 6h20v17H6z"
      />
      <path d="M6 23V6h20v17M3 23h26l-3 5H6ZM12 11l-3 3 3 3m8-6 3 3-3 3M18 10l-3 8" />
    </>
  ),
  grow: (
    <>
      <path
        fill="currentColor"
        fillOpacity=".13"
        stroke="none"
        d="m5 24 11-4 11 4-11 5Z"
      />
      <path d="m5 24 11 5 11-5M16 23V11M16 16C6 16 5 10 6 7c7-1 10 3 10 9Zm0-5C16 5 21 3 26 4c0 6-4 10-10 10" />
    </>
  ),
  calendar: (
    <>
      <rect x="5" y="7" width="22" height="22" rx="4" />
      <path
        fill="currentColor"
        fillOpacity=".14"
        stroke="none"
        d="M6 8h20v7H6z"
      />
      <path d="M5 15h22M11 3v7M21 3v7M11 20h2m6 0h2m-10 5h2m6 0h2" />
    </>
  ),
  schedule: (
    <>
      <path d="M14 28H6V8h20v7M6 14h20M11 4v7M21 4v7" />
      <circle cx="23" cy="23" r="7" fill="currentColor" fillOpacity=".1" />
      <path d="M23 19v4l3 2" />
    </>
  ),
  paste: (
    <>
      <path
        fill="currentColor"
        fillOpacity=".12"
        stroke="none"
        d="M6 7h15v22H6z"
      />
      <path d="M10 7H6v22h13M10 4h8v6h-8zM22 13h5v15H14V13h3M17 19h7m-7 5h5" />
    </>
  ),
  add: (
    <>
      <path
        fill="currentColor"
        fillOpacity=".1"
        stroke="none"
        d="m16 3 13 13-13 13L3 16Z"
      />
      <path d="M16 8v16M8 16h16" />
    </>
  ),
  minus: (
    <>
      <path
        fill="currentColor"
        fillOpacity=".1"
        stroke="none"
        d="m16 3 13 13-13 13L3 16Z"
      />
      <path d="M8 16h16" />
    </>
  ),
  check: (
    <>
      <path
        fill="currentColor"
        fillOpacity=".13"
        stroke="none"
        d="m5 18 8 8L28 9l-5-4-10 13-4-5Z"
      />
      <path d="m5 17 8 8L27 7" />
    </>
  ),
  completed: (
    <>
      <path
        fill="currentColor"
        fillOpacity=".1"
        d="m16 3 11 6v14l-11 6-11-6V9Z"
      />
      <path d="m10 16 4 4 8-9" />
    </>
  ),
  edit: (
    <>
      <path
        fill="currentColor"
        fillOpacity=".15"
        stroke="none"
        d="m8 18 13-13 6 6-13 13-8 2Z"
      />
      <path d="m8 18 13-13 6 6-13 13-8 2Zm10-10 6 6M8 18l6 6M5 29h23" />
    </>
  ),
  delete: (
    <>
      <path
        fill="currentColor"
        fillOpacity=".12"
        stroke="none"
        d="m8 11 2 18h12l2-18Z"
      />
      <path d="M5 10h22M12 6h8M8 10l2 19h12l2-19M13 15v8m6-8v8" />
    </>
  ),
  archive: (
    <>
      <path
        fill="currentColor"
        fillOpacity=".13"
        stroke="none"
        d="M7 12h18v16H7z"
      />
      <path d="M5 6h22v6H5ZM7 12v16h18V12M13 18h6M12 23h8" />
    </>
  ),
  arrowRight: (
    <>
      <path d="M5 16h21m-8-8 8 8-8 8" />
    </>
  ),
  arrowLeft: (
    <>
      <path d="M27 16H6m8-8-8 8 8 8" />
    </>
  ),
  chevronRight: <path d="m12 7 9 9-9 9" />,
  chevronLeft: <path d="m20 7-9 9 9 9" />,
  undo: (
    <>
      <path
        fill="currentColor"
        fillOpacity=".11"
        stroke="none"
        d="M6 15a11 11 0 1 0 7-9v9Z"
      />
      <path d="M7 14a10 10 0 1 1-1 8M7 5v9h9" />
    </>
  ),
  redo: (
    <>
      <path
        fill="currentColor"
        fillOpacity=".11"
        stroke="none"
        d="M26 15a11 11 0 1 1-7-9v9Z"
      />
      <path d="M25 14a10 10 0 1 0 1 8M25 5v9h-9" />
    </>
  ),
  close: <path d="m9 9 14 14M23 9 9 23" />,
  menu: (
    <>
      <path
        fill="currentColor"
        fillOpacity=".12"
        stroke="none"
        d="M5 6h22v5H5zM5 21h22v5H5z"
      />
      <path d="M6 9h20M6 16h20M6 23h20" />
    </>
  ),
  clock: (
    <>
      <circle cx="16" cy="16" r="12" fill="currentColor" fillOpacity=".1" />
      <path d="M16 8v9l6 3M16 4v1m0 22v1M4 16h1m22 0h1" />
    </>
  ),
  flag: (
    <>
      <path d="M7 29V5M7 6c6-4 12 4 19 0v13c-7 4-13-4-19 0" />
      <path
        fill="currentColor"
        fillOpacity=".14"
        stroke="none"
        d="M8 8c6-2 11 3 16 0v9c-5 2-10-3-16 0z"
      />
    </>
  ),
  info: (
    <>
      <path d="M7 7h18v16H14l-6 5v-5H7Z" />
      <path d="M16 14v5M16 10h.01" />
    </>
  ),
  link: (
    <>
      <path d="m13 10 4-4a6 6 0 0 1 9 9l-4 4m-3 3-4 4a6 6 0 0 1-9-9l4-4M11 21l10-10" />
    </>
  ),
  download: (
    <>
      <path
        fill="currentColor"
        fillOpacity=".12"
        stroke="none"
        d="M5 23h22v6H5z"
      />
      <path d="M16 3v18m-6-6 6 6 6-6M5 22v7h22v-7" />
    </>
  ),
  upload: (
    <>
      <path
        fill="currentColor"
        fillOpacity=".12"
        stroke="none"
        d="M5 23h22v6H5z"
      />
      <path d="M16 21V3m-6 6 6-6 6 6M5 22v7h22v-7" />
    </>
  ),
  home: (
    <>
      <path
        fill="currentColor"
        fillOpacity=".12"
        stroke="none"
        d="M7 15h18v14H7z"
      />
      <path d="M3 16 16 4l13 12M7 14v15h18V14M13 29V19h6v10" />
    </>
  ),
  layers: (
    <>
      <path fill="currentColor" fillOpacity=".13" d="m3 11 13-7 13 7-13 7Z" />
      <path d="m4 18 12 7 12-7M7 24l9 5 9-5" />
    </>
  ),
  leaf: (
    <>
      <path
        fill="currentColor"
        fillOpacity=".15"
        d="M6 25C0 10 15 3 27 5c2 14-7 24-21 20Z"
      />
      <path d="m4 29 17-18M11 22v-7m0 7h8" />
    </>
  ),
  shield: (
    <>
      <path
        fill="currentColor"
        fillOpacity=".12"
        d="m16 3 11 5v8c0 7-6 11-11 14C11 27 5 23 5 16V8Z"
      />
      <path d="m10 16 4 4 8-9" />
    </>
  ),
  warning: (
    <>
      <path
        fill="currentColor"
        fillOpacity=".12"
        d="m16 3 11 5v8c0 7-6 11-11 14C11 27 5 23 5 16V8Z"
      />
      <path d="M16 10v8m0 5h.01" />
    </>
  ),
  sparkles: (
    <>
      <path
        fill="currentColor"
        fillOpacity=".15"
        d="m14 5 3 8 8 3-8 3-3 8-3-8-8-3 8-3Z"
      />
      <path d="M25 3v6m-3-3h6M26 24v5m-2.5-2.5h5" />
    </>
  ),
  palette: (
    <>
      <path
        fill="currentColor"
        fillOpacity=".12"
        d="M26 19c-2 6-8 10-14 9C-1 26 2 7 13 4c10-3 21 8 12 11-4 1-3 5 1 4Z"
      />
      <circle cx="11" cy="11" r="1.2" fill="currentColor" />
      <circle cx="19" cy="9" r="1.2" fill="currentColor" />
      <circle cx="8" cy="19" r="1.2" fill="currentColor" />
    </>
  ),
  brain: (
    <>
      <path
        fill="currentColor"
        fillOpacity=".12"
        d="M16 6C8-1 1 10 6 15c-7 7 1 17 10 11 9 6 17-4 10-11C31 10 24-1 16 6Z"
      />
      <path d="M16 6v20M9 9c4 0 4 5 1 6m12-6c-4 0-4 5-1 6M8 21c4-3 5 0 5 2m11-2c-4-3-5 0-5 2" />
    </>
  ),
  reading: (
    <>
      <path
        fill="currentColor"
        fillOpacity=".1"
        d="M16 8C11 4 7 4 3 6v20c4-2 8-2 13 2 5-4 9-4 13-2V6c-4-2-8-2-13 2Z"
      />
      <path d="M16 8v20M7 11l5 1m-5 5 5 1m9-5 2 2 4-5" />
    </>
  ),
  circle: <circle cx="16" cy="16" r="10" />,
  desktop: (
    <>
      <path
        fill="currentColor"
        fillOpacity=".12"
        stroke="none"
        d="M4 5h24v17H4z"
      />
      <rect x="4" y="5" width="24" height="17" rx="3" />
      <path d="M16 22v6M10 29h12" />
    </>
  ),
  mobile: (
    <>
      <rect x="9" y="3" width="14" height="26" rx="3" />
      <path
        fill="currentColor"
        fillOpacity=".12"
        stroke="none"
        d="M10 7h12v18H10z"
      />
      <path d="M14 6h4m-3 20h2" />
    </>
  ),
  tablet: (
    <>
      <rect x="5" y="3" width="22" height="26" rx="3" />
      <path
        fill="currentColor"
        fillOpacity=".12"
        stroke="none"
        d="M6 7h20v18H6z"
      />
      <path d="M15 26h2" />
    </>
  ),
};

export type StudyIconName = keyof typeof glyphs;
export const STUDY_ICON_NAMES = Object.keys(glyphs) as StudyIconName[];
export type IconProps = Omit<SVGProps<SVGSVGElement>, "children" | "name"> & {
  size?: number | string;
};

export function StudyIcon({
  name,
  size = 22,
  className,
  ...props
}: IconProps & { name: StudyIconName }) {
  const labelled = !!(props["aria-label"] || props["aria-labelledby"]);
  return (
    <svg
      xmlns="http://www.w3.org/2000/svg"
      width={size}
      height={size}
      viewBox="0 0 32 32"
      fill="none"
      stroke="currentColor"
      strokeWidth={2.1}
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden={labelled ? undefined : true}
      role={labelled ? "img" : undefined}
      focusable="false"
      className={`study-icon${className ? ` ${className}` : ""}`}
      data-study-icon={name}
      {...props}
    >
      {glyphs[name]}
    </svg>
  );
}

/** Full-colour brand mark: the island, its blue crystal and a growing leaf. */
export function IslandMark({ size = 40, className, ...props }: IconProps) {
  const labelled = !!(props["aria-label"] || props["aria-labelledby"]);
  return (
    <svg
      xmlns="http://www.w3.org/2000/svg"
      width={size}
      height={size}
      viewBox="0 0 40 40"
      fill="none"
      aria-hidden={labelled ? undefined : true}
      role={labelled ? "img" : undefined}
      focusable="false"
      className={`study-icon island-mark${className ? ` ${className}` : ""}`}
      data-study-icon="island-mark"
      {...props}
    >
      <path d="m5 23 15 15 15-15-15-6Z" fill="#b58b67" />
      <path d="M20 26v12l15-15-15 3Z" fill="#8d6956" />
      <path d="m5 22 15-7 15 7-15 8Z" fill="#7ea75e" />
      <path d="m5 22 15 3 15-3-15 8Z" fill="#5f8c50" />
      <path d="m19 3-5 13 5 8 6-8Z" fill="#7394df" />
      <path d="M19 3v21l6-8Z" fill="#485bb2" />
      <path d="m19 3-5 13 5-3Z" fill="#b8d7ec" />
      <path d="M25 19c-1-5 2-9 7-10 1 5-1 9-7 10Z" fill="#659359" />
      <path
        d="m25 20 4-7"
        stroke="#406b49"
        strokeWidth="1.4"
        strokeLinecap="round"
      />
      <path
        d="m10 25 3 5m14-2-3 6"
        stroke="#cfac7f"
        strokeWidth="1.3"
        strokeLinecap="round"
      />
    </svg>
  );
}
const icon = (name: StudyIconName) => {
  const Component = (props: IconProps) => <StudyIcon name={name} {...props} />;
  Component.displayName = `StudyIcon(${name})`;
  return Component;
};
export const WorldIcon = icon("world"),
  TodayIcon = icon("today"),
  RevisionIcon = icon("revisions"),
  TestIcon = icon("tests"),
  AnalyticsIcon = icon("analytics"),
  SettingsIcon = icon("settings");
export const MathsIcon = icon("maths"),
  ReasoningIcon = icon("reasoning"),
  EnglishIcon = icon("english"),
  GeographyIcon = icon("gk"),
  DataIcon = icon("dsa"),
  SoftwareIcon = icon("software"),
  GrowthIcon = icon("grow");
// Existing component names remain compatible while all rendering uses original artwork.
export const Compass = WorldIcon,
  LayoutList = TodayIcon,
  BarChart3 = AnalyticsIcon,
  Settings2 = SettingsIcon;
export const Calculator = MathsIcon,
  Puzzle = ReasoningIcon,
  BookOpen = EnglishIcon,
  Globe2 = GeographyIcon,
  Network = DataIcon,
  Code2 = SoftwareIcon,
  Sprout = GrowthIcon;
export const ClipboardCheck = TestIcon,
  CalendarDays = icon("calendar"),
  CalendarClock = icon("schedule"),
  ClipboardPaste = icon("paste");
export const Plus = icon("add"),
  Minus = icon("minus"),
  Check = icon("check"),
  CheckCircle2 = icon("completed"),
  Edit3 = icon("edit"),
  Trash2 = icon("delete"),
  Archive = icon("archive");
export const ArrowRight = icon("arrowRight"),
  ArrowLeft = icon("arrowLeft"),
  ChevronRight = icon("chevronRight"),
  ChevronLeft = icon("chevronLeft"),
  RotateCcw = icon("undo"),
  RotateCw = icon("redo"),
  X = icon("close"),
  Menu = icon("menu");
export const Clock3 = icon("clock"),
  Flag = icon("flag"),
  Info = icon("info"),
  Link2 = icon("link"),
  Download = icon("download"),
  Upload = icon("upload"),
  Home = icon("home"),
  Layers3 = icon("layers"),
  Leaf = icon("leaf");
export const ShieldCheck = icon("shield"),
  ShieldAlert = icon("warning"),
  Sparkles = icon("sparkles"),
  Palette = icon("palette"),
  Brain = icon("brain"),
  BookOpenCheck = icon("reading"),
  Circle = icon("circle");
export const Monitor = icon("desktop"),
  Smartphone = icon("mobile"),
  Tablet = icon("tablet");

export const PauseMotion = icon("pauseMotion"),
  PlayMotion = icon("playMotion");
