/* Service features for Figma frame 69:152. main.js owns the shared header, menu,
   hash navigation, active links, js class and footer; this file never touches them.
   Native static content is the fallback. */
(() => {
  'use strict';
  let dispose;
  const init = () => {
    dispose?.();
    const $ = (selector, scope = document) => scope?.querySelector(selector);
    const $$ = (selector, scope = document) => [...(scope?.querySelectorAll(selector) || [])];
    const motion = matchMedia('(prefers-reduced-motion: reduce)');
    const desktop = matchMedia('(min-width: 900px)');
    const lifecycle = new AbortController();
    const cleanups = [];
    const on = (target, type, listener, options = {}) => target?.addEventListener(type, listener, { ...options, signal: lifecycle.signal });
    const header = $('[data-site-header]');
    let frame = 0, layoutNeeded = true;
    on(desktop, 'change', () => { layoutNeeded = true; requestTick(); });

    // The service stack remains ordinary document content on small/short screens.
    const services = $('[data-service-panel]')?.closest('.services');
    const panels = $$('[data-service-panel]');
    const track = $('[data-platform-track]');
    let measuredWidth = innerWidth;
    const measure = () => {
      services?.classList.toggle('is-stackable', desktop.matches &&
        panels.every(panel => panel.offsetHeight + header.offsetHeight + 24 <= innerHeight));
      const slides = $$('[data-testimonial-slide]');
      const carousel = $('[data-testimonials]');
      if (carousel) {
        // Measure all source slides in the same slot so the controls never jump.
        const active = Number(carousel.dataset.activeSlide || 0);
        carousel.style.removeProperty('--testimonial-height');
        const minimum = desktop.matches ? 680 : 560;
        let tallest = minimum;
        slides.forEach(slide => {
          slide.hidden = false;
          tallest = Math.max(tallest, slide.offsetHeight);
        });
        carousel.style.setProperty('--testimonial-height', `${tallest}px`);
        if (carousel.classList.contains('is-enhanced')) slides.forEach((slide, i) => { slide.hidden = i !== active; });
      }
      layoutNeeded = false;
    };
    const paint = () => {
      frame = 0;
      if (layoutNeeded) measure();
      panels.forEach((panel, index) => {
        const next = panels[index + 1];
        if (!next || !services.classList.contains('is-stackable')) {
          panel.style.removeProperty('--panel-ink');
          return;
        }
        const rect = panel.getBoundingClientRect();
        const covered = Math.max(0, Math.min(1, (rect.bottom - next.getBoundingClientRect().top) / rect.height));
        panel.style.setProperty('--panel-ink', `color-mix(in srgb, var(--ink), var(--placeholder) ${covered * 100}%)`);
      });
    };
    function requestTick() { if (!frame) frame = requestAnimationFrame(paint); }
    on(window, 'scroll', requestTick, { passive: true });
    on(window, 'resize', () => {
      if (innerWidth !== measuredWidth) { measuredWidth = innerWidth; hidePortrait(); }
      layoutNeeded = true;
      requestTick();
    });
    on(window, 'load', () => { layoutNeeded = true; requestTick(); });
    on(document.fonts, 'loadingdone', () => { layoutNeeded = true; requestTick(); });
    const sizes = new ResizeObserver(() => { layoutNeeded = true; requestTick(); });
    [header, services].filter(Boolean).forEach(element => sizes.observe(element));
    cleanups.push(() => sizes.disconnect());

    // Native horizontal scrolling owns touch, trackpad, and wheel behavior.
    // Mouse dragging is an additional input path, never a vertical wheel trap.
    let drag = null;
    const finishDrag = () => {
      if (!drag || !track) return;
      const id = drag.id;
      drag = null;
      track.classList.remove('is-dragging');
      if (track.hasPointerCapture(id)) track.releasePointerCapture(id);
    };
    on(track, 'pointerdown', event => {
      if (event.pointerType !== 'mouse' || event.button !== 0) return;
      drag = { id: event.pointerId, x: event.clientX, left: track.scrollLeft };
      track.setPointerCapture(event.pointerId);
      track.focus({ preventScroll: true });
    });
    on(track, 'pointermove', event => {
      if (!drag || event.pointerId !== drag.id) return;
      const delta = event.clientX - drag.x;
      if (Math.abs(delta) > 3) {
        track.classList.add('is-dragging');
        track.scrollLeft = drag.left - delta;
        event.preventDefault();
      }
    });
    ['pointerup', 'pointercancel', 'lostpointercapture'].forEach(type => on(track, type, finishDrag));
    on(track, 'dragstart', event => event.preventDefault());
    const syncTrack = () => track?.parentElement.classList.toggle('is-at-end', track.scrollWidth - track.clientWidth - track.scrollLeft < 2);
    on(track, 'scroll', syncTrack, { passive: true });
    on(track, 'keydown', event => {
      if (event.target !== track || event.ctrlKey || event.metaKey || event.altKey) return;
      if (!['ArrowLeft', 'ArrowRight', 'Home', 'End'].includes(event.key)) return;
      event.preventDefault();
      const amount = (track.firstElementChild?.getBoundingClientRect().width || 360) + 16;
      const left = event.key === 'Home' ? 0 : event.key === 'End' ? track.scrollWidth : track.scrollLeft + (event.key === 'ArrowRight' ? amount : -amount);
      track.scrollTo({ left, behavior: motion.matches ? 'instant' : 'smooth' });
    });
    cleanups.push(finishDrag);
    syncTrack();

    const carousel = $('[data-testimonials]');
    const slides = $$('[data-testimonial-slide]', carousel);
    const previous = $('[data-testimonial-prev]', carousel);
    const next = $('[data-testimonial-next]', carousel);
    const status = $('[data-testimonial-status]', carousel);
    let activeSlide = 0, swipe = null;
    const colors = ['var(--ink)', 'var(--sky)', 'var(--signal)'];
    const changeSlide = (direction, announce = true) => {
      activeSlide = (activeSlide + direction + slides.length) % slides.length;
      slides.forEach((slide, index) => { slide.hidden = index !== activeSlide; });
      carousel.dataset.activeSlide = String(activeSlide);
      carousel.style.setProperty('--testimonial-background', colors[activeSlide]);
      carousel.style.setProperty('--testimonial-foreground', activeSlide === 0 ? 'var(--paper)' : 'var(--ink)');
      if (announce) status.textContent = `Testimonial ${activeSlide + 1} of ${slides.length}: ${$('figcaption span', slides[activeSlide]).textContent}`;
      if (!motion.matches && typeof carousel.animate === 'function') {
        $$('blockquote, figcaption', slides[activeSlide]).forEach(content => content.animate([{ opacity: .25 }, { opacity: 1 }], { duration: 180, easing: 'ease-out' }));
      }
    };
    if (carousel && slides.length) {
      measure();
      carousel.classList.add('is-enhanced');
      $('[data-testimonial-controls]', carousel).hidden = false;
      changeSlide(0, false);
      on(previous, 'click', () => changeSlide(-1));
      on(next, 'click', () => changeSlide(1));
      on(carousel, 'keydown', event => {
        if (!['ArrowLeft', 'ArrowRight'].includes(event.key) || event.ctrlKey || event.metaKey || event.altKey) return;
        event.preventDefault();
        changeSlide(event.key === 'ArrowRight' ? 1 : -1);
      });
      // Passive TouchEvents preserve ordinary page scrolling and pinch zoom.
      on(carousel, 'touchstart', event => {
        swipe = event.touches.length === 1 && !event.target.closest('button')
          ? { x: event.touches[0].clientX, y: event.touches[0].clientY, id: event.touches[0].identifier } : null;
      }, { passive: true });
      on(carousel, 'touchmove', event => { if (event.touches.length !== 1) swipe = null; }, { passive: true });
      on(carousel, 'touchend', event => {
        if (!swipe || event.touches.length) { swipe = null; return; }
        const touch = [...event.changedTouches].find(item => item.identifier === swipe.id);
        if (touch) {
          const dx = touch.clientX - swipe.x, dy = touch.clientY - swipe.y;
          if (Math.abs(dx) > 48 && Math.abs(dx) > Math.abs(dy) * 1.4) changeSlide(dx < 0 ? 1 : -1);
        }
        swipe = null;
      }, { passive: true });
      on(carousel, 'touchcancel', () => { swipe = null; }, { passive: true });
    }

    const portrait = $('[data-portrait-cursor]');
    const trigger = $('[data-portrait-trigger]');
    const finePointer = matchMedia('(hover: hover) and (pointer: fine) and (min-width: 900px)');
    function hidePortrait() {
      portrait?.classList.remove('is-visible');
      trigger?.classList.remove('has-portrait');
    }
    const positionPortrait = event => {
      portrait.style.setProperty('--cursor-x', `${event.clientX - 12}px`);
      portrait.style.setProperty('--cursor-y', `${event.clientY - 12}px`);
    };
    on(trigger, 'pointerenter', event => {
      if (!finePointer.matches || event.pointerType !== 'mouse' || !portrait.complete || !portrait.naturalWidth) return;
      portrait.hidden = false;
      positionPortrait(event);
      portrait.classList.add('is-visible');
      trigger.classList.add('has-portrait');
    });
    on(trigger, 'pointermove', event => { if (trigger.classList.contains('has-portrait')) positionPortrait(event); });
    ['pointerleave', 'pointercancel', 'blur', 'click'].forEach(type => on(trigger, type, hidePortrait));
    on(finePointer, 'change', hidePortrait);
    on(document, 'visibilitychange', hidePortrait);
    on(window, 'scroll', hidePortrait, { passive: true });
    cleanups.push(hidePortrait);

    paint();
    dispose = () => {
      lifecycle.abort();
      cleanups.forEach(cleanup => cleanup());
      cancelAnimationFrame(frame);
      carousel?.classList.remove('is-enhanced');
      slides.forEach(slide => { slide.hidden = false; });
      const controls = $('[data-testimonial-controls]');
      if (controls) controls.hidden = true;
      dispose = undefined;
    };
  };
  // A failed feature module leaves native content; shared main.js state is untouched.
  try { init(); } catch (error) {
    console.error('[Maiac agentic page] Enhancement unavailable:', error);
  }
  window.addEventListener('pagehide', () => dispose?.());
  window.addEventListener('pageshow', event => { if (event.persisted) init(); });
})();
