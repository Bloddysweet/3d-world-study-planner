import { describe, expect, it } from "vitest";
import { renderToStaticMarkup } from "react-dom/server";
import {
  IslandMark,
  StudyIcon,
  STUDY_ICON_NAMES,
  RevisionIcon,
  RotateCcw,
  WorldIcon,
  Compass,
} from "./icons";
import { SubjectIcon } from "./ui";

describe("Study World vector family", () => {
  it("renders every original glyph as a decorative, self-contained vector", () => {
    expect(STUDY_ICON_NAMES.length).toBeGreaterThan(40);
    expect(new Set(STUDY_ICON_NAMES).size).toBe(STUDY_ICON_NAMES.length);
    for (const name of STUDY_ICON_NAMES) {
      const svg = renderToStaticMarkup(<StudyIcon name={name} />);
      expect(svg).toContain('viewBox="0 0 32 32"');
      expect(svg).toContain(`data-study-icon="${name}"`);
      expect(svg).toContain('aria-hidden="true"');
      expect(svg).toContain('focusable="false"');
      expect(svg).toMatch(/<(path|rect|circle) /);
      expect(svg).not.toMatch(
        /<(script|image|filter|use)|\sid=|\shref=|undefined/,
      );
    }
  });
  it("inherits colour and uses the same rounded stroke system", () => {
    for (const name of STUDY_ICON_NAMES) {
      const svg = renderToStaticMarkup(<StudyIcon name={name} />);
      expect(svg).toContain('stroke="currentColor"');
      expect(svg).toContain('stroke-width="2.1"');
      expect(svg).toContain('stroke-linecap="round"');
      expect(svg).toContain('stroke-linejoin="round"');
      expect(svg).not.toMatch(/#[0-9a-f]{3,8}/i);
    }
  });
  it("exposes standalone labels instead of hiding named images", () => {
    const svg = renderToStaticMarkup(
      <StudyIcon name="world" aria-label="Explore your study world" />,
    );
    expect(svg).toContain('role="img"');
    expect(svg).toContain('aria-label="Explore your study world"');
    expect(svg).not.toContain("aria-hidden");
    expect(
      renderToStaticMarkup(
        <StudyIcon name="world" aria-labelledby="world-heading" />,
      ),
    ).toContain('role="img"');
  });
  it("forwards dimensions, colour, classes and stroke overrides", () => {
    const svg = renderToStaticMarkup(
      <StudyIcon
        name="maths"
        size={32}
        className="custom"
        color="#123456"
        strokeWidth={2.5}
      />,
    );
    expect(svg).toContain('width="32" height="32"');
    expect(svg).toContain('class="study-icon custom"');
    expect(svg).toContain('color="#123456"');
    expect(svg).toContain('stroke-width="2.5"');
  });
  it("can repeat without document IDs, masks or external dependencies", () => {
    const svg = renderToStaticMarkup(
      <>
        <StudyIcon name="world" />
        <StudyIcon name="world" />
      </>,
    );
    expect(svg.match(/<svg/g)).toHaveLength(2);
    expect(svg).not.toMatch(/\sid=|url\(|<defs|<mask|<clipPath/);
  });
  it("uses a separate full-colour island brand mark", () => {
    const svg = renderToStaticMarkup(<IslandMark aria-label="Study World" />);
    expect(svg).toContain('viewBox="0 0 40 40"');
    expect(svg).toContain('data-study-icon="island-mark"');
    expect(svg).toContain('fill="#7ea75e"');
    expect(svg).toContain('fill="#485bb2"');
    expect(svg).toContain('role="img"');
    expect(svg).not.toMatch(/\sid=|<image|<filter/);
  });
  it("keeps revision learning distinct from undo and rotation actions", () => {
    expect(Compass).toBe(WorldIcon);
    expect(renderToStaticMarkup(<RevisionIcon />)).toContain(
      'data-study-icon="revisions"',
    );
    expect(renderToStaticMarkup(<RotateCcw />)).toContain(
      'data-study-icon="undo"',
    );
  });
  it("preserves all dynamic subject colours and theme identities", () => {
    for (const theme of [
      "maths",
      "reasoning",
      "english",
      "gk",
      "dsa",
      "software",
      "generic",
    ] as const) {
      const svg = renderToStaticMarkup(
        <SubjectIcon subject={{ theme, color: "#a45283" }} size={24} />,
      );
      expect(svg).toContain("color:#a45283");
      expect(svg).toContain("background:#a4528316");
      expect(svg).toContain(
        `data-study-icon="${theme === "generic" ? "grow" : theme}"`,
      );
      expect(svg).toContain('width="24" height="24"');
    }
  });
});
