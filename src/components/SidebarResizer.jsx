import { useRef } from 'react';
import { DEFAULT_SIDEBAR_W, MAX_SIDEBAR_W, MIN_SIDEBAR_W } from '../lib/storage.js';

const KEY_STEP = 16;
// dragging this far left of the minimum closes the sidebar
const CLOSE_BELOW = MIN_SIDEBAR_W - 80;

const clamp = (w) => Math.min(MAX_SIDEBAR_W, Math.max(MIN_SIDEBAR_W, Math.round(w)));

// The sidebar's right edge: drag (or arrow keys) to resize, double-click to reset, drag far left to close.
// `onResize(w, done)`: `done` is true when the drag ends, so the width is saved once rather than on every move.
export default function SidebarResizer({ width, onResize, onClose, onDragging }) {
  const drag = useRef(null);

  function onPointerDown(e) {
    if (e.button !== 0) return;
    e.preventDefault();
    e.currentTarget.setPointerCapture(e.pointerId);
    drag.current = { startX: e.clientX, startW: width, last: width };
    onDragging(true);
  }

  function onPointerMove(e) {
    if (!drag.current) return;
    const raw = drag.current.startW + e.clientX - drag.current.startX;
    drag.current.raw = raw;
    drag.current.last = clamp(raw);
    onResize(drag.current.last, false);
  }

  function onPointerUp() {
    if (!drag.current) return;
    const { raw, last, startW } = drag.current;
    drag.current = null;
    onDragging(false);
    if (raw < CLOSE_BELOW) {
      onResize(startW, true);
      onClose();
    } else onResize(last, true);
  }

  function onKeyDown(e) {
    if (e.key === 'ArrowLeft' || e.key === 'ArrowRight') {
      e.preventDefault();
      onResize(clamp(width + (e.key === 'ArrowRight' ? KEY_STEP : -KEY_STEP)), true);
    } else if (e.key === 'Home' || e.key === 'End') {
      e.preventDefault();
      onResize(e.key === 'Home' ? MIN_SIDEBAR_W : MAX_SIDEBAR_W, true);
    }
  }

  return (
    <div
      className="sidebar-resizer"
      role="separator"
      aria-orientation="vertical"
      aria-label="Resize sidebar"
      aria-valuenow={width}
      aria-valuemin={MIN_SIDEBAR_W}
      aria-valuemax={MAX_SIDEBAR_W}
      tabIndex={0}
      title="Drag to resize · double-click to reset"
      onPointerDown={onPointerDown}
      onPointerMove={onPointerMove}
      onPointerUp={onPointerUp}
      onPointerCancel={onPointerUp}
      onDoubleClick={() => onResize(DEFAULT_SIDEBAR_W, true)}
      onKeyDown={onKeyDown}
    />
  );
}
