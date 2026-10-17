// Shared mockup helpers: top bar, subject chips, icons, progress rings.
const SUBJECTS = {
  maths:   { name: "SSC Mathematics",             short: "Maths",        color: "var(--s-maths)",   soft: "var(--s-maths-soft)",   icon: "calculator" },
  reason:  { name: "SSC Reasoning",               short: "Reasoning",    color: "var(--s-reason)",  soft: "var(--s-reason-soft)",  icon: "puzzle" },
  english: { name: "English & Vocabulary",        short: "English",      color: "var(--s-english)", soft: "var(--s-english-soft)", icon: "book-open" },
  gk:      { name: "GK & General Studies",        short: "GK",           color: "var(--s-gk)",      soft: "var(--s-gk-soft)",      icon: "globe" },
  dsa:     { name: "Data Structures & Algorithms", short: "DSA",         color: "var(--s-dsa)",     soft: "var(--s-dsa-soft)",     icon: "network" },
  soft:    { name: "Software Development",        short: "Software Dev", color: "var(--s-soft)",    soft: "var(--s-soft-soft)",    icon: "code" },
};

const BRAND_SVG = `<svg viewBox="0 0 40 40" aria-hidden="true">
  <path d="M7 19 C 10 33, 30 33, 33 19 Z" fill="#b07a52"/>
  <path d="M12 26 L 20 37 L 27 26 Z" fill="#8f6142"/>
  <ellipse cx="20" cy="19" rx="13.5" ry="5.2" fill="#6cbf6f"/>
  <path d="M20 4 L 23.4 15.5 L 20 18 L 16.6 15.5 Z" fill="#7d9cf6"/>
  <path d="M20 4 L 23.4 15.5 L 20 18 Z" fill="#5f7fe8"/>
</svg>`;

const TABS = [
  ["world", "map", "World"],
  ["today", "sun", "Today", "9"],
  ["revisions", "refresh-ccw", "Revisions", "4", "red"],
  ["tests", "clipboard-check", "Tests"],
  ["analytics", "chart-column", "Analytics"],
  ["settings", "settings", "Settings"],
];

function topbar(active, floating) {
  const tabs = TABS.map(([id, icon, label, count, cls]) =>
    `<a class="tab ${id === active ? "active" : ""}"><i data-icon="${icon}"></i>${label}${count ? `<span class="count ${cls || ""}">${count}</span>` : ""}</a>`
  ).join("");
  return `<header class="topbar ${floating ? "floating" : ""}">
    <div class="brand">${BRAND_SVG}<span>Study World</span></div>
    <nav class="tabs">${tabs}</nav>
    <div class="top-right">
      <span class="chip"><i data-icon="calendar"></i>Thu, 15 Oct</span>
      <span class="chip streak"><i data-icon="flame"></i>12-day streak</span>
      <button class="btn primary"><i data-icon="clipboard-paste"></i>Paste targets</button>
    </div>
  </header>`;
}

// Progress ring as inline SVG.
function ring(pct, color, size = 28, stroke = 4, track = "rgba(30,36,64,.12)") {
  const r = (size - stroke) / 2, c = 2 * Math.PI * r, off = c * (1 - pct / 100);
  return `<svg width="${size}" height="${size}" viewBox="0 0 ${size} ${size}" style="flex:none;transform:rotate(-90deg)">
    <circle cx="${size / 2}" cy="${size / 2}" r="${r}" fill="none" stroke="${track}" stroke-width="${stroke}"/>
    <circle cx="${size / 2}" cy="${size / 2}" r="${r}" fill="none" stroke="${color}" stroke-width="${stroke}"
      stroke-linecap="round" stroke-dasharray="${c}" stroke-dashoffset="${off}"/></svg>`;
}

function subjectIcon(key, size = 34, radius = 10) {
  const s = SUBJECTS[key];
  return `<span style="width:${size}px;height:${size}px;border-radius:${radius}px;background:${s.soft};color:${s.color};display:inline-flex;align-items:center;justify-content:center;flex:none"><i data-icon="${s.icon}"></i></span>`;
}

function renderIcons(root = document) {
  root.querySelectorAll("i[data-icon]").forEach((el) => {
    const svg = (window.ICONS || {})[el.dataset.icon];
    if (!svg) { el.outerHTML = `<b style="color:red">[${el.dataset.icon}]</b>`; return; }
    const cls = ["ic", ...el.classList].join(" ");
    const style = el.getAttribute("style") || "";
    el.outerHTML = svg.replace("<svg", `<svg class="${cls}" style="${style}"`);
  });
}

document.addEventListener("DOMContentLoaded", async () => {
  const tb = document.querySelector("[data-topbar]");
  if (tb) tb.outerHTML = topbar(tb.dataset.topbar, tb.hasAttribute("data-floating"));
  if (typeof window.pageInit === "function") window.pageInit();

  document.querySelectorAll(".subj[data-s]").forEach((el) => {
    const s = SUBJECTS[el.dataset.s];
    const label = el.dataset.label || s.short;
    el.style.background = s.soft;
    el.style.color = s.color;
    el.innerHTML = `<span class="dot" style="background:${s.color}"></span>${label}`;
  });
  document.querySelectorAll("[data-subject-icon]").forEach((el) => {
    el.outerHTML = subjectIcon(el.dataset.subjectIcon, +(el.dataset.size || 34), +(el.dataset.radius || 10));
  });
  document.querySelectorAll("[data-ring]").forEach((el) => {
    const [pct, color, size, stroke] = el.dataset.ring.split(",");
    el.outerHTML = ring(+pct, color, +(size || 28), +(stroke || 4));
  });

  renderIcons();
  await document.fonts.ready;
  const imgs = [...document.images].map((img) => img.complete ? null : new Promise((r) => { img.onload = img.onerror = r; }));
  await Promise.all(imgs);
  window.__ready = true;
});
