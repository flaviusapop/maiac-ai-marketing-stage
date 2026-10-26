/* Figma work labels. The existing page/menu/team/footer code stays independent. */
(() => {
  'use strict';
  let dispose;
  const init = () => {
    dispose?.();
    const root = document.documentElement;
    const cards = [...document.querySelectorAll('.work-card')];
    const mouse = matchMedia('(hover: hover) and (pointer: fine)');
    const events = new AbortController();
    let active = null, cursor = null, frame = 0, point = null;
    const on = (target, type, listener, options = {}) => target.addEventListener(type, listener, { ...options, signal: events.signal });
    const clear = () => {
      cancelAnimationFrame(frame);
      frame = 0;
      active?.classList.remove('is-work-hovered');
      active = null;
      cursor?.remove();
      cursor = null;
    };
    const updateMode = () => {
      clear();
      root.classList.toggle('work-cursor-ready', mouse.matches);
    };
    const place = () => {
      frame = 0;
      if (!cursor || !point) return;
      const bounds = cursor.getBoundingClientRect();
      const x = Math.max(8, Math.min(point.x + 12, innerWidth - bounds.width - 8));
      const y = Math.max(8, Math.min(point.y + 12, innerHeight - bounds.height - 8));
      cursor.style.transform = `translate3d(${x}px, ${y}px, 0)`;
    };
    const move = event => {
      if (event.pointerType !== 'mouse' || !mouse.matches) {
        clear();
        root.classList.remove('work-cursor-ready');
        return;
      }
      const card = event.currentTarget;
      if (document.querySelector('dialog[open]')) { clear(); return; }
      if (active !== card) {
        clear();
        const source = card.querySelector('[data-work-label]');
        if (!source) return;
        cursor = source.cloneNode(true);
        cursor.removeAttribute('data-work-label');
        cursor.classList.add('work-label--cursor');
        document.body.append(cursor);
        active = card;
        root.classList.add('work-cursor-ready');
        card.classList.add('is-work-hovered');
      }
      point = { x: event.clientX, y: event.clientY };
      if (!frame) frame = requestAnimationFrame(place);
    };
    cards.forEach(card => {
      on(card, 'pointerenter', move);
      on(card, 'pointermove', move, { passive: true });
      on(card, 'pointerleave', clear);
      on(card, 'pointercancel', clear);
    });
    on(window, 'scroll', () => {
      if (active && point && document.elementFromPoint(point.x, point.y)?.closest('.work-card') !== active) clear();
    }, { passive: true });
    on(window, 'resize', clear, { passive: true });
    on(window, 'blur', clear);
    on(document, 'keydown', clear);
    on(document, 'visibilitychange', clear);
    on(document, 'pointerdown', event => {
      if (event.pointerType !== 'mouse') {
        clear();
        root.classList.remove('work-cursor-ready');
      }
    }, { passive: true });
    on(mouse, 'change', updateMode);
    updateMode();
    dispose = () => {
      events.abort();
      clear();
      root.classList.remove('work-cursor-ready');
    };
  };
  init();
  addEventListener('pageshow', event => { if (event.persisted) init(); });
  addEventListener('pagehide', () => dispose?.());
})();
