/* Standalone enhancements for Figma frame 69:152. Native static content is the fallback. */
(() => {
  'use strict';
  let dispose;
  const init = () => {
    dispose?.();
    const $ = (selector, scope = document) => scope?.querySelector(selector);
    const $$ = (selector, scope = document) => [...(scope?.querySelectorAll(selector) || [])];
    const root = document.documentElement;
    const motion = matchMedia('(prefers-reduced-motion: reduce)');
    const desktop = matchMedia('(min-width: 900px)');
    const lifecycle = new AbortController();
    const cleanups = [];
    const on = (target, type, listener, options = {}) => target?.addEventListener(type, listener, { ...options, signal: lifecycle.signal });
    const header = $('[data-site-header]'), menu = $('[data-menu]');
    const openers = $$('[data-menu-open]'), navLinks = $$('[data-nav-link]'), sections = $$('[data-section]');
    let frame = 0, layoutNeeded = true, opener = null, lockedY = 0, lastActive = null;
    // The native modal stays open/inert/locked for every visible frame, including
    // exit. WAAPI only supplies the visual interpolation; it never owns navigation.
    const menuClose = $('[data-menu-close]', menu);
    let menuState = 'closed', menuAnimations = [], menuRun = 0, bodyStyle = null, rootMinSize = null, menuWidth = 0, menuCut = 0;
    const setMenuState = state => { menuState = state; menu.dataset.menuState = state; };
    const cancelMenuMotion = () => {
      menuRun++;
      menuAnimations.forEach(animation => animation.cancel());
      menuAnimations = [];
    };
    const restoreOpener = () => {
      const returnTarget = [opener, $('.site-header__logo'), ...openers].find(control => {
        if (!control?.getClientRects().length || control.closest('[inert]')) return false;
        const rect = control.getBoundingClientRect();
        return rect.bottom > 0 && rect.top < innerHeight && rect.right > 0 && rect.left < innerWidth;
      });
      returnTarget?.focus({ preventScroll: true });
    };
    const finishMenuClose = (restore = true) => {
      if (menuState === 'closed' && !menu.open && !bodyStyle && !rootMinSize) return;
      // Keep the final exit mask until the dialog leaves the native top layer.
      // close() restores background availability before destination focus.
      if (menu.open) menu.close();
      cancelMenuMotion();
      setMenuState('closed');
      menu.style.removeProperty('--menu-scrollbar-gap');
      root.classList.remove('menu-open');
      document.body.classList.remove('menu-open');
      document.body.style.removeProperty('--menu-page-scrollbar');
      if (bodyStyle) {
        for (const [property, value, priority] of bodyStyle) {
          if (value) document.body.style.setProperty(property, value, priority);
          else document.body.style.removeProperty(property);
        }
        bodyStyle = null;
      }
      // Restore real content to flow before releasing its reserved scroll range.
      if (rootMinSize) {
        const [value, priority] = rootMinSize;
        if (value) root.style.setProperty('min-block-size', value, priority);
        else root.style.removeProperty('min-block-size');
        rootMinSize = null;
      }
      window.scrollTo({ top: lockedY, behavior: 'instant' });
      openers.forEach(button => button.setAttribute('aria-expanded', 'false'));
      if (restore) restoreOpener();
      requestTick();
    };
    const settleMenu = () => {
      if (menuState === 'closing') finishMenuClose();
      else if (menu.open) { cancelMenuMotion(); setMenuState('open'); }
    };
    const animateMenu = opening => {
      const state = opening ? 'opening' : 'closing';
      if (menuState === state || (opening && menuState === 'open')) return;
      // Reveal one opaque surface below the stationary head. Crossfading the page
      // and menu would superimpose two sets of type and two CTA positions.
      // A reversal samples the current rendered clip once, before cancellation.
      // There are no frame-loop layout reads or timeout-based completion handlers.
      const clip = menuAnimations.length ? getComputedStyle(menu).clipPath : '';
      const sampled = clip.startsWith('inset(') ? parseFloat(clip.split(/\s+/)[2]) : NaN;
      const from = Number.isFinite(sampled) ? sampled : opening ? menuCut : 0;
      const to = opening ? 0 : menuCut;
      cancelMenuMotion();
      setMenuState(state);
      if (motion.matches || typeof menu.animate !== 'function' || !CSS.supports('clip-path', 'inset(0)') || document.hidden) { settleMenu(); return; }
      const styles = getComputedStyle(menu);
      const duration = parseFloat(styles.getPropertyValue(opening ? '--dur-menu-in' : '--dur-menu-out')) * Math.abs(to - from) / menuCut;
      if (!duration) { settleMenu(); return; }
      const run = menuRun;
      try {
        menuAnimations.push(menu.animate(
          [{ clipPath: `inset(0% 0% ${from}% 0%)` }, { clipPath: `inset(0% 0% ${to}% 0%)` }],
          { duration, easing: styles.getPropertyValue('--ease-out').trim(), fill: 'both' }
        ));
        Promise.all(menuAnimations.map(animation => animation.finished)).then(() => {
          if (run === menuRun) settleMenu();
        }).catch(() => { /* Cancellation belongs to the newer state. */ });
      } catch {
        // Older/partial WAAPI implementations retain a working native dialog.
        settleMenu();
      }
    };
    const closeMenu = (restore = true, immediate = false) => {
      // An external native close can precede pagehide in the same task. Clean
      // up even then, before lifecycle teardown aborts the queued close handler.
      if (immediate) { finishMenuClose(restore); return; }
      if (!menu.open) return;
      if (!restore) finishMenuClose(restore);
      else animateMenu(false);
    };
    const openMenu = button => {
      if (menu.open) { if (menuState === 'closing') animateMenu(true); return; }
      // Native close events are queued. Reconcile a synchronous external close
      // before a new open can snapshot the previous session's fixed body styles.
      if (menuState !== 'closed' || bodyStyle || rootMinSize) finishMenuClose(false);
      opener = button;
      lockedY = scrollY;
      menuWidth = innerWidth;
      // Lock before native autofocus can scroll anything. Keep the current body
      // width while the viewport scrollbar is absent, avoiding page reflow.
      const bodyWidth = document.body.getBoundingClientRect().width;
      const scrollbarWidth = innerWidth - root.clientWidth;
      const documentHeight = root.scrollHeight;
      rootMinSize = [root.style.getPropertyValue('min-block-size'), root.style.getPropertyPriority('min-block-size')];
      // A fixed body otherwise collapses the root and resets scrollY to zero.
      // Keep that range intact before removing the body from normal flow.
      root.style.setProperty('min-block-size', `${documentHeight}px`);
      document.body.style.setProperty('--menu-page-scrollbar', `${scrollbarWidth}px`);
      bodyStyle = ['position', 'top', 'width'].map(property => [property, document.body.style.getPropertyValue(property), document.body.style.getPropertyPriority(property)]);
      root.classList.add('menu-open');
      document.body.classList.add('menu-open');
      Object.assign(document.body.style, { position: 'fixed', top: `${-lockedY}px`, width: `${bodyWidth}px` });
      try { menu.showModal(); } catch { finishMenuClose(); return; }
      openers.forEach(b => b.setAttribute('aria-expanded', 'true'));
      menu.scrollTop = 0;
      menuClose.focus({ preventScroll: true });
      // Classic scrollbars disappear from the page on lock. A short menu may
      // have no scrollbar of its own; retain the opener's original right edge.
      const menuScrollbar = menu.offsetWidth - menu.clientWidth;
      menu.style.setProperty('--menu-scrollbar-gap', `${Math.max(0, scrollbarWidth - menuScrollbar)}px`);
      const headerBottom = $('.menu__head', menu).getBoundingClientRect().bottom + parseFloat(getComputedStyle(menu).paddingTop);
      menuCut = Math.max(0, 100 * (1 - headerBottom / menu.getBoundingClientRect().height));
      animateMenu(true);
    };
    setMenuState('closed');
    openers.forEach(button => on(button, 'click', () => openMenu(button)));
    on(menuClose, 'click', () => closeMenu());
    on(menu, 'cancel', event => { event.preventDefault(); closeMenu(); });
    const revealForInteraction = () => {
      if (menuState === 'opening' || menuState === 'closing') {
        cancelMenuMotion();
        setMenuState('open');
      }
    };
    // A keyboard user can reach the bottom CTA before the reveal edge. Expose
    // the whole menu immediately rather than focus a visually clipped control.
    on(menu, 'focusin', event => { if (event.target !== menuClose) revealForInteraction(); });
    // Direct input can reveal immediately; a queued programmatic scrollTop reset
    // from a previous visit must not cancel the next entry.
    on(menu, 'wheel', revealForInteraction, { passive: true });
    on(menu, 'touchmove', revealForInteraction, { passive: true });
    // Covers native/external close without allowing an old queued close event to
    // tear down a newly reopened dialog.
    on(menu, 'close', () => { if (!menu.open) finishMenuClose(); });
    on(menu, 'keydown', event => {
      if ([' ', 'PageDown', 'PageUp', 'Home', 'End', 'ArrowDown', 'ArrowUp'].includes(event.key)) revealForInteraction();
      if (event.key !== 'Tab') return;
      const controls = $$('a[href],button:not([disabled])', menu).filter(control => control.getClientRects().length);
      const index = controls.indexOf(document.activeElement);
      event.preventDefault();
      controls[(index + (event.shiftKey ? -1 : 1) + controls.length) % controls.length].focus();
    });
    on(desktop, 'change', () => { closeMenu(true, true); layoutNeeded = true; requestTick(); });
    on(motion, 'change', settleMenu);
    on(document, 'visibilitychange', () => { if (document.hidden) closeMenu(true, true); });

    // href/hash navigation stays native. Focus follows closure and hash assignment,
    // without a timeout or animation-completion race.
    on(document, 'click', event => {
      const link = event.target.closest('a[href^="#"]');
      if (!link || event.defaultPrevented || event.button !== 0 || event.ctrlKey || event.metaKey || event.altKey || event.shiftKey) return;
      const target = document.getElementById(link.hash.slice(1));
      if (!target) return;
      const fromMenu = menu.contains(link);
      if (fromMenu) closeMenu(false);
      if (fromMenu || link.hasAttribute('data-nav-link') || link.hasAttribute('data-cta')) {
        event.preventDefault();
        if (location.hash !== link.hash) location.hash = link.hash;
        else target.scrollIntoView({ block: 'start' });
        const focusTarget = link.hasAttribute('data-cta') ? $('#f-name') : ($('h1, h2', target) || target);
        if (!focusTarget.matches('input, textarea, button, a')) focusTarget.tabIndex = -1;
        focusTarget.focus({ preventScroll: true });
        if (link.hasAttribute('data-cta')) focusTarget.scrollIntoView({ block: 'center', behavior: motion.matches ? 'instant' : 'smooth' });
      }
    });
    // The service stack remains ordinary document content on small/short screens.
    const services = $('[data-service-panel]')?.closest('.services');
    const panels = $$('[data-service-panel]');
    const track = $('[data-platform-track]');
    let measuredWidth = innerWidth;
    const measure = () => {
      root.style.setProperty('--header-h', `${header.getBoundingClientRect().height}px`);
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
      const line = innerHeight * .35;
      const active = sections.filter(section => section.getBoundingClientRect().top <= line).at(-1)?.id || '';
      if (active !== lastActive) {
        lastActive = active;
        navLinks.forEach(link => {
          const current = link.hash === `#${active}`;
          link.classList.toggle('is-active', current);
          if (current) link.setAttribute('aria-current', 'location');
          else link.removeAttribute('aria-current');
        });
      }
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
      if (menu.open) {
        if (innerWidth !== menuWidth) closeMenu(true, true);
        else settleMenu();
      }
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

    root.classList.add('js');
    paint();
    dispose = () => {
      closeMenu(false, true);
      lifecycle.abort();
      cleanups.forEach(cleanup => cleanup());
      cancelAnimationFrame(frame);
      root.classList.remove('js');
      carousel?.classList.remove('is-enhanced');
      slides.forEach(slide => { slide.hidden = false; });
      const controls = $('[data-testimonial-controls]');
      if (controls) controls.hidden = true;
    };
  };
  try { init(); } catch (error) {
    document.documentElement.classList.remove('js');
    console.error('[Maiac agentic page] Enhancement unavailable:', error);
  }
  window.addEventListener('pagehide', () => dispose?.());
  window.addEventListener('pageshow', event => { if (event.persisted) init(); });
})();
