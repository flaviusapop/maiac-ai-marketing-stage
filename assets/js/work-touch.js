/* Passive finger-following, bounded to each work photo. Native pan/pinch stay native. */
(() => {
  'use strict';
  let dispose;
  const init = () => {
    dispose?.();
    const reduced = matchMedia('(prefers-reduced-motion: reduce)');
    const events = new AbortController();
    const returns = new Map();
    let active = null, frame = 0;
    const on = (target, type, fn, options = {}) => target.addEventListener(type, fn, { ...options, signal: events.signal });
    const cancelReturns = () => {
      returns.forEach(animation => animation.cancel());
      returns.clear();
    };
    const reset = (settle = false) => {
      cancelAnimationFrame(frame);
      frame = 0;
      if (active) {
        const { label } = active;
        const from = getComputedStyle(label).transform;
        active = null;
        label.style.removeProperty('transform');
        label.classList.remove('is-touch-following');
        if (settle && !reduced.matches && from !== 'none' && label.animate) {
          const animation = label.animate([{ transform: from }, { transform: 'translate3d(0, 0, 0)' }], {
            duration: 240, easing: 'cubic-bezier(0.16, 1, 0.3, 1)'
          });
          returns.set(label, animation);
          const done = () => { if (returns.get(label) === animation) returns.delete(label); };
          animation.onfinish = done;
          animation.oncancel = done;
        }
      }
      if (!settle) cancelReturns();
    };
    const place = () => {
      frame = 0;
      if (!active) return;
      const { media, label, point } = active;
      const rect = media.getBoundingClientRect();
      if (point.x < rect.left || point.x > rect.right || point.y < rect.top || point.y > rect.bottom) {
        reset(true);
        return;
      }
      const width = label.offsetWidth, height = label.offsetHeight;
      const localX = point.x - rect.left, localY = point.y - rect.top;
      // Prefer above/right of the finger; flip when needed and keep every edge inside.
      const desiredX = localX + 18 + width <= rect.width - 12 ? localX + 18 : localX - width - 18;
      const desiredY = localY - height - 24 >= 12 ? localY - height - 24 : localY + 24;
      const x = Math.max(12, Math.min(desiredX, rect.width - width - 12));
      const y = Math.max(12, Math.min(desiredY, rect.height - height - 12));
      label.style.transform = `translate3d(${x - label.offsetLeft}px, ${y - label.offsetTop}px, 0)`;
    };
    const queue = () => { if (active && !frame) frame = requestAnimationFrame(place); };
    document.querySelectorAll('.work-card__media').forEach(media => {
      on(media, 'touchstart', event => {
        if (event.touches.length !== 1 || reduced.matches || document.querySelector('dialog[open]')) {
          reset();
          return;
        }
        reset();
        const label = media.querySelector('[data-work-label]');
        if (!label) return;
        document.documentElement.classList.remove('work-cursor-ready');
        const touch = event.touches[0];
        active = { media, label, id: touch.identifier, point: { x: touch.clientX, y: touch.clientY } };
        label.classList.add('is-touch-following');
        queue();
      }, { passive: true });
    });
    // Touch events keep observing a finger when the browser owns the pan gesture.
    // No preventDefault, touch-action override, pointer capture or click interception.
    on(document, 'touchstart', event => { if (event.touches.length !== 1) reset(); }, { passive: true });
    on(document, 'touchmove', event => {
      if (!active) return;
      if (event.touches.length !== 1) { reset(); return; }
      const touch = [...event.touches].find(point => point.identifier === active.id);
      if (!touch) { reset(true); return; }
      active.point = { x: touch.clientX, y: touch.clientY };
      queue();
    }, { passive: true });
    on(document, 'touchend', () => reset(true), { passive: true });
    on(document, 'touchcancel', () => reset(true), { passive: true });
    on(window, 'scroll', queue, { passive: true });
    on(window, 'resize', () => reset(), { passive: true });
    on(window, 'blur', () => reset());
    on(document, 'visibilitychange', () => reset());
    on(document, 'keydown', () => reset());
    on(reduced, 'change', () => reset());
    dispose = () => { events.abort(); reset(); };
  };
  init();
  addEventListener('pagehide', () => dispose?.());
  addEventListener('pageshow', event => { if (event.persisted) init(); });
})();
