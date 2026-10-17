import { describe, expect, it } from "vitest";
import { fitWorldPopover } from "./world-popover";
const bounds = { left: 12, top: 130, right: 378, bottom: 760 };
describe("World popover placement", () => {
  it("opens below its trigger when the complete card fits", () => {
    const p = fitWorldPopover(
      { left: 18, right: 180, top: 210, bottom: 252 },
      bounds,
      300,
    );
    expect(p.placement).toBe("below");
    expect(p.top).toBe(262);
    expect(p.width).toBe(320);
  });
  it("flips above a low trigger instead of covering bottom tools", () => {
    const p = fitWorldPopover(
      { left: 18, right: 180, top: 600, bottom: 642 },
      bounds,
      300,
    );
    expect(p.placement).toBe("above");
    expect(p.top).toBe(290);
  });
  it("fits a tall overloaded journey into a short viewport", () => {
    const b = { ...bounds, bottom: 405 };
    const p = fitWorldPopover(
      { left: 18, right: 180, top: 320, bottom: 362 },
      b,
      470,
    );
    expect(p.placement).toBe("fitted");
    expect(p.top).toBe(130);
    expect(p.maxHeight).toBe(275);
  });
  it("clamps horizontal placement on narrow phones and right-aligned tools", () => {
    for (const width of [320, 390, 430, 768, 1440])
      for (const end of [false, true]) {
        const b = { left: 12, right: width - 12, top: 100, bottom: 500 };
        const p = fitWorldPopover(
          { left: width - 80, right: width - 12, top: 400, bottom: 442 },
          b,
          300,
          320,
          end,
        );
        expect(p.left).toBeGreaterThanOrEqual(b.left);
        expect(p.left + p.width).toBeLessThanOrEqual(b.right);
        expect(p.top).toBeGreaterThanOrEqual(b.top);
        expect(p.top + Math.min(300, p.maxHeight)).toBeLessThanOrEqual(
          b.bottom,
        );
      }
  });
  it("refits an open panel when its trigger moves outside the viewport", () => {
    const p = fitWorldPopover(
      { left: 10, right: 130, top: 1200, bottom: 1240 },
      bounds,
      300,
    );
    expect(p.top + 300).toBeLessThanOrEqual(bounds.bottom);
  });
  it("does not mutate its anchor/bounds", () => {
    const a = { left: 20, right: 180, top: 200, bottom: 242 };
    const before = JSON.stringify([a, bounds]);
    fitWorldPopover(a, bounds, 500);
    expect(JSON.stringify([a, bounds])).toBe(before);
  });
});
