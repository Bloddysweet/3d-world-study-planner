export interface PopoverRect {
  left: number;
  top: number;
  right: number;
  bottom: number;
}
export interface PopoverLayout {
  left: number;
  top: number;
  width: number;
  maxHeight: number;
  placement: "below" | "above" | "fitted";
}

/** Fit against the actual visible world, after the header and bottom tools are
 * reserved. Short viewports scroll the content, never clip the close/action UI. */
export function fitWorldPopover(
  anchor: PopoverRect,
  bounds: PopoverRect,
  naturalHeight: number,
  preferredWidth = 320,
  alignEnd = false,
): PopoverLayout {
  const width = Math.max(
    1,
    Math.min(preferredWidth, bounds.right - bounds.left),
  );
  const maxHeight = Math.max(1, bounds.bottom - bounds.top);
  const height = Math.min(Math.max(1, naturalHeight), maxHeight);
  const clamp = (v: number, min: number, max: number) =>
    Math.max(min, Math.min(v, Math.max(min, max)));
  const left = clamp(
    alignEnd ? anchor.right - width : anchor.left,
    bounds.left,
    bounds.right - width,
  );
  const below = anchor.bottom + 10,
    above = anchor.top - 10 - height;
  if (!alignEnd && below + height <= bounds.bottom)
    return {
      left,
      top: Math.max(bounds.top, below),
      width,
      maxHeight,
      placement: "below",
    };
  if (above >= bounds.top && above + height <= bounds.bottom)
    return { left, top: above, width, maxHeight, placement: "above" };
  return {
    left,
    top: clamp(anchor.top, bounds.top, bounds.bottom - height),
    width,
    maxHeight,
    placement: "fitted",
  };
}
