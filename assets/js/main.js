/* Maiac AI Marketing local footer study. Native scrolling, SVG artwork and bounded Canvas 2D; no dependencies. */
(() => {
  'use strict';
  let dispose;
  const init = () => {
    dispose?.();
    const $ = (s, scope = document) => scope.querySelector(s);
    const $$ = (s, scope = document) => [...scope.querySelectorAll(s)];
    const root = document.documentElement;
    const motion = matchMedia('(prefers-reduced-motion: reduce)');
    const desktop = matchMedia('(min-width: 900px)');
    const lifecycle = new AbortController();
    const cleanups = [];
    const on = (target, event, listener, options = {}) => target?.addEventListener(event, listener, { ...options, signal: lifecycle.signal });
    const header = $('[data-site-header]');
    const page = $('[data-page]'), footer = $('[data-footer]'), menu = $('[data-menu]');
    const openers = $$('[data-menu-open]'), navLinks = $$('[data-nav-link]'), sections = $$('[data-section]');
    const mark = $('[data-footer-mark]');
    const mainMark = $('.site-footer__mark-img', mark);
    let frame = 0, layoutNeeded = true, pageStateNeeded = true, opener = null, lockedY = 0, lastActive = null;
    let atPageEnd = false, preservePageEnd = false;

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
    const team = $('[data-team-scroller]');
    const teamSection = team?.closest('.team'), teamPin = $('[data-team-pin]');
    let teamPinned = false, teamStart = 0, teamTravel = 0;
    let measureTeam = () => {}, paintTeam = () => {};
    let pointer = null, wheelTimer = 0, wheelStart = 0;
    if (team) {
      const snapPoints = () => {
        const max = team.scrollWidth - team.clientWidth;
        const origin = team.getBoundingClientRect().left;
        const padding = parseFloat(getComputedStyle(team).scrollPaddingLeft) || 0;
        return [...new Set([0, ...$$('.member', team).map(member =>
          Math.max(0, Math.min(max, member.getBoundingClientRect().left - origin + team.scrollLeft - padding))), max])].sort((a, b) => a - b);
      };
      const settleTeam = (start, minimum) => {
        const left = team.scrollLeft, distance = left - start;
        const points = snapPoints();
        let target = points.reduce((best, point) => Math.abs(point - left) < Math.abs(best - left) ? point : best, points[0]);
        // A deliberate short gesture must escape the current card instead of
        // losing all its movement when mandatory snapping is restored.
        if (distance >= minimum) target = Math.max(target, points.find(point => point > start + 1) ?? points.at(-1));
        else if (distance <= -minimum) target = Math.min(target, points.findLast(point => point < start - 1) ?? 0);
        team.classList.remove('is-dragging', 'is-wheeling');
        team.scrollTo({ left: target, behavior: motion.matches ? 'instant' : 'smooth' });
      };
      const endDrag = event => {
        if (!pointer) return;
        const { id, left } = pointer;
        pointer = null;
        if (event?.type === 'pointerup') settleTeam(left, 32);
        else team.classList.remove('is-dragging', 'is-wheeling');
        if (team.hasPointerCapture(id)) team.releasePointerCapture(id);
      };
      cleanups.push(endDrag, () => { clearTimeout(wheelTimer); team.classList.remove('is-wheeling'); });
      on(team, 'pointerdown', event => {
        if (teamPinned || event.pointerType !== 'mouse' || event.button !== 0) return;
        clearTimeout(wheelTimer);
        wheelTimer = 0;
        pointer = { id: event.pointerId, x: event.clientX, left: team.scrollLeft };
        team.setPointerCapture(event.pointerId);
        team.focus({ preventScroll: true });
      });
      on(team, 'pointermove', event => {
        if (!pointer || pointer.id !== event.pointerId) return;
        const dx = event.clientX - pointer.x;
        if (Math.abs(dx) > 3) {
          team.classList.add('is-dragging');
          team.classList.remove('is-wheeling');
          team.scrollLeft = pointer.left - dx;
          event.preventDefault();
        }
      });
      ['pointerup', 'pointercancel', 'lostpointercapture'].forEach(type => on(team, type, endDrag));
      on(team, 'dragstart', event => event.preventDefault());
      on(team, 'wheel', event => {
        if (teamPinned) return; // Native page scrolling drives the sticky stage.
        // Preserve horizontal/diagonal trackpad input and browser pinch/zoom gestures.
        if (event.ctrlKey || event.metaKey || event.deltaX !== 0 || event.shiftKey || !event.deltaY) return;
        const max = team.scrollWidth - team.clientWidth, left = team.scrollLeft;
        if ((event.deltaY > 0 && left >= max - 1) || (event.deltaY < 0 && left <= 1) || max <= 1) return;
        const unit = event.deltaMode === 1 ? parseFloat(getComputedStyle(team).lineHeight) || 20 : event.deltaMode === 2 ? team.clientWidth : 1;
        event.preventDefault();
        if (!wheelTimer) wheelStart = left;
        clearTimeout(wheelTimer);
        team.classList.add('is-wheeling');
        team.scrollLeft = Math.max(0, Math.min(max, left + event.deltaY * unit));
        wheelTimer = setTimeout(() => { wheelTimer = 0; settleTeam(wheelStart, 12); }, 160);
      }, { passive: false });
      on(team, 'keydown', event => {
        if (event.target !== team || !['ArrowRight', 'ArrowLeft'].includes(event.key) || event.ctrlKey || event.metaKey || event.altKey) return;
        event.preventDefault();
        const points = snapPoints();
        const target = event.key === 'ArrowRight'
          ? points.find(point => point > team.scrollLeft + 1) ?? points.at(-1)
          : points.findLast(point => point < team.scrollLeft - 1) ?? 0;
        if (teamPinned) window.scrollTo({ top: teamStart + target, behavior: motion.matches ? 'instant' : 'smooth' });
        else team.scrollTo({ left: target, behavior: motion.matches ? 'instant' : 'smooth' });
      });
      if (teamSection && teamPin) {
        const resetPin = () => {
          teamPinned = false;
          teamTravel = 0;
          teamSection.classList.remove('is-scroll-driven');
          ['--team-travel', '--team-card-fit', '--team-pin-top'].forEach(name => teamSection.style.removeProperty(name));
        };
        measureTeam = () => {
          const previousTravel = teamTravel, previousStart = teamStart;
          const progress = teamPinned && previousTravel > 0 ? (scrollY - previousStart) / previousTravel : -1;
          // Short/zoomed windows retain the ordinary accessible horizontal row.
          // Pinned user-controlled scrolling is an explicit Reduce Motion exception.
          if (innerHeight < 600 || !CSS.supports('height', '100svh')) { resetPin(); return; }
          endDrag();
          clearTimeout(wheelTimer); wheelTimer = 0;
          team.classList.remove('is-dragging', 'is-wheeling');
          teamSection.classList.add('is-scroll-driven');
          teamSection.style.setProperty('--team-pin-top', `${header.getBoundingClientRect().height + 24}px`);
          const heading = $('.split--head', teamPin), members = $$('.member', team);
          // Fit complete photographs and the longest caption, including rewrapped roles.
          for (let pass = 0; pass < 3; pass++) {
            const style = getComputedStyle(teamPin);
            const captions = Math.max(...members.map(member => member.getBoundingClientRect().height - $('picture', member).getBoundingClientRect().height));
            const available = teamPin.clientHeight - parseFloat(style.paddingTop) - parseFloat(style.paddingBottom)
              - heading.getBoundingClientRect().height - parseFloat(getComputedStyle(heading).marginBottom) - captions;
            if (available < 190) { resetPin(); return; }
            teamSection.style.setProperty('--team-card-fit', `${Math.floor(available * .75)}px`);
          }
          if (teamPin.scrollHeight > teamPin.clientHeight + 2) { resetPin(); return; }
          teamTravel = Math.max(0, team.scrollWidth - team.clientWidth);
          teamSection.style.setProperty('--team-travel', `${teamTravel}px`);
          teamStart = teamSection.getBoundingClientRect().top + scrollY + parseFloat(getComputedStyle(teamSection).borderTopWidth);
          teamPinned = true;
          if (progress >= 0 && progress <= 1 && Math.abs(previousTravel - teamTravel) > 1) {
            window.scrollTo({ top: teamStart + progress * teamTravel, behavior: 'instant' });
          }
        };
        paintTeam = () => {
          if (!teamPinned) return;
          const offset = Math.max(0, Math.min(teamTravel, scrollY - teamStart));
          if (Math.abs(team.scrollLeft - offset) > .5) team.scrollLeft = offset;
        };
        cleanups.push(resetPin);
      }
    }

    // Persistent narrowing artwork: scrolling uncovers it without changing its pose.
    const copies = Array.from({ length: 7 }, () => {
      const copy = mainMark.cloneNode(false);
      copy.className = 'site-footer__mark-copy';
      copy.alt = '';
      mark.insertBefore(copy, mainMark);
      return copy;
    });
    mark.classList.add('is-accordion');
    // User-selected exception: direct pointer/touch motion stays active under reduced
    // motion. Other page effects continue to honor the motion media query.
    const flowCanvas = document.createElement('canvas');
    flowCanvas.className = 'site-footer__flow';
    flowCanvas.setAttribute('aria-hidden', 'true');
    mark.append(flowCanvas);
    const columns = 24, rows = 28, count = (columns + 1) * (rows + 1);
    const flowX = new Float32Array(count), flowY = new Float32Array(count);
    let artWidth = 0, artHeight = 0, artDpr = 1, footerHeight = 1, geometry = [];
    let contours = null, contoursLoading = false, preparedPaths = [], pathsDirty = true, flowContext = null;
    let pointerPoint = null, pointerInput = null, velocityX = 0, velocityY = 0;
    let flowTime = 0, flowActive = false, touchTarget = null;
    let touchGesture = null, touchBlocked = false, touchMomentumUntil = 0;
    let lastTouchPosition = null, lastDirectTouchTime = -Infinity;
    const boundedScrollY = () => Math.max(0, Math.min(scrollY, root.scrollHeight - innerHeight));
    let lastScrollTop = boundedScrollY(), lastScrollTime = performance.now();
    const resetFlow = () => {
      flowX.fill(0); flowY.fill(0);
      pointerPoint = null; pointerInput = null; velocityX = 0; velocityY = 0;
      touchTarget = null;
      flowTime = 0; flowActive = false;
      mark.classList.remove('is-flowing');
    };
    const measureArt = () => {
      const rect = mark.getBoundingClientRect();
      const copyCount = desktop.matches ? 5 : 2;
      const nextDpr = Math.min(devicePixelRatio || 1, 2);
      // Mobile browser chrome can resize the viewport without changing the art.
      // Keep the current field unless the artwork geometry actually changes.
      if (Math.abs(rect.width - artWidth) < 0.1 && Math.abs(rect.height - artHeight) < 0.1 &&
        nextDpr === artDpr && geometry.length === copyCount + 1) return;
      artWidth = rect.width; artHeight = rect.height;
      artDpr = nextDpr;
      // Fill the footer vertically without changing the approved horizontal rhythm
      // when the viewport narrows. The SVG viewport itself keeps its native ratio.
      const sourceWidth = artHeight * 847 / 537;
      // Three mobile marks share the full width, retaining the narrowing rhythm.
      const mainWidth = desktop.matches ? artWidth / 3 * 847 / 537 : artWidth / (1 + 0.5 + 0.5 * 0.62);
      let x = 0;
      copies.forEach((copy, i) => { copy.hidden = i >= copyCount; });
      geometry = copies.slice(0, copyCount).reverse().map((image, i) => {
        const width = mainWidth * 0.5 * 0.62 ** (copyCount - 1 - i);
        const item = { image, x, width };
        x += width;
        return item;
      });
      geometry.push({ image: mainMark, x, width: mainWidth });
      geometry.forEach(({ image, x, width }) => {
        // Keep the SVG viewport at its intrinsic aspect ratio before narrowing it.
        // A full-art-width viewport letterboxes the SVG, then squeezes it twice.
        image.style.inlineSize = `${sourceWidth}px`;
        image.style.transform = `translate3d(${x}px,0,0) scaleX(${width / sourceWidth})`;
        image.style.opacity = '1';
      });
      pathsDirty = true;
      resetFlow();
    };
    const loadContours = () => {
      if (contours || contoursLoading) return;
      contoursLoading = true;
      // Derived from the shipped SVG offline, so moving the mouse never has to
      // sample SVG geometry or import a graphics library.
      fetch(new URL('maiac-ma-contours.json?v=8b6473761048', mainMark.src), { signal: lifecycle.signal })
        .then(response => { if (!response.ok) throw new Error(`Artwork data: ${response.status}`); return response.json(); })
        .then(data => { contours = data.paths; pathsDirty = true; })
        .catch(error => { if (error.name !== 'AbortError') console.warn('[Maiac] Cursor effect unavailable; static artwork retained.', error); });
    };
    const preparePaths = () => {
      if (!contours || !artWidth || !artHeight) return false;
      flowContext ||= flowCanvas.getContext('2d', { alpha: false });
      if (!flowContext) return false;
      if (pathsDirty) {
        flowCanvas.width = Math.ceil(artWidth * artDpr);
        flowCanvas.height = Math.ceil(artHeight * artDpr);
        preparedPaths = geometry.map(({ x, width }) => contours.map(glyph => glyph.map(contour => contour.map(([sourceX, sourceY]) => {
          const px = x + sourceX / 847 * width, py = sourceY / 537 * artHeight;
          const gx = Math.max(0, Math.min(columns, px / artWidth * columns));
          const gy = Math.max(0, Math.min(rows, py / artHeight * rows));
          const ix = Math.min(columns - 1, Math.floor(gx)), iy = Math.min(rows - 1, Math.floor(gy));
          const tx = gx - ix, ty = gy - iy, i = iy * (columns + 1) + ix;
          return [px, py, i, (1 - tx) * (1 - ty), tx * (1 - ty), (1 - tx) * ty, tx * ty];
        }))));
        pathsDirty = false;
      }
      return true;
    };
    // Original Canvas 2D contour renderer keeps curves continuous on every engine.
    // No WebGL, image readback, external code, scroll interception or idle render loop.
    const paintFlow = now => {
      if (!flowActive) return;
      if (document.hidden || !preparePaths()) { resetFlow(); return; }
      const elapsed = Math.max(1, Math.min(64, now - flowTime));
      const touchDriven = pointerInput ? pointerInput.kind !== 'pointer' : Boolean(touchTarget);
      const decay = Math.exp(-elapsed / (touchDriven ? 330 : 230));
      flowTime = now;
      let energy = 0;
      for (let i = 0; i < count; i++) {
        flowX[i] *= decay; flowY[i] *= decay;
      }
      let force = null;
      if (pointerInput) {
        // Consume movement once per frame, independent of mouse polling frequency.
        const { x, y, dx, dy, start, time } = pointerInput;
        const dt = Math.max(8, Math.min(80, time - start));
        const smoothing = 1 - Math.exp(-(touchDriven ? dt : elapsed) / (touchDriven ? 55 : 24));
        velocityX += (dx / dt - velocityX) * smoothing;
        velocityY += (dy / dt - velocityY) * smoothing;
        if (touchDriven) {
          touchTarget = { x: touchTarget?.x ?? x, y: touchTarget?.y ?? y, toX: x, toY: y,
            vx: velocityX, vy: velocityY, time };
        } else {
          touchTarget = null;
          force = { x, y, vx: velocityX, vy: velocityY, strength: 1 };
        }
        pointerInput = null;
      }
      if (touchTarget) {
        // Bridge sparse touch/scroll events for at most80ms. A stationary finger
        // cannot sustain motion; after this short bridge the field only settles.
        const age = Math.max(0, now - touchTarget.time);
        if (age < 80) {
          const follow = 1 - Math.exp(-elapsed / 32);
          touchTarget.x += (touchTarget.toX - touchTarget.x) * follow;
          touchTarget.y += (touchTarget.toY - touchTarget.y) * follow;
          force = { x: touchTarget.x, y: touchTarget.y, vx: touchTarget.vx, vy: touchTarget.vy,
            strength: Math.max(0, 1 - age / 80) };
        }
      }
      if (force) {
        const { x, y, vx, vy, strength } = force;
        const targetX = Math.min(160, artWidth * (touchDriven ? 0.095 : 0.115)) * Math.tanh(vx * 0.85) * strength;
        const targetY = (touchDriven ? 30 : 36) * Math.tanh(vy * 0.65) * strength;
        const rx = Math.max(touchDriven ? 110 : 90, artWidth * (touchDriven ? 0.24 : 0.17));
        const ry = Math.max(40, artHeight * (touchDriven ? 0.29 : 0.24));
        const response = 1 - Math.exp(-elapsed / (touchDriven ? 70 : 40));
        for (let row = 1; row < rows; row++) {
          const py = row / rows * artHeight;
          for (let col = 1; col < columns; col++) {
            const px = col / columns * artWidth, i = row * (columns + 1) + col;
            const influence = Math.exp(-0.5 * (((px - x) / rx) ** 2 + ((py - y) / ry) ** 2)) * Math.sin(Math.PI * row / rows) ** 2;
            const blend = response * influence;
            flowX[i] += (targetX - flowX[i]) * blend;
            flowY[i] += (targetY - flowY[i]) * blend;
          }
        }
      }
      for (let i = 0; i < count; i++) energy = Math.max(energy, Math.abs(flowX[i]), Math.abs(flowY[i]));
      if (energy < 0.12) {
        // Let a fresh, gentle gesture build a field across sparse input frames.
        // The bridge expires after80ms, so this cannot create an idle loop.
        if (touchDriven && force) { requestTick(false); return; }
        resetFlow(); return;
      }
      const ctx = flowContext;
      ctx.setTransform(artDpr, 0, 0, artDpr, 0, 0);
      ctx.fillStyle = '#0b0b0b'; ctx.fillRect(0, 0, artWidth, artHeight);
      ctx.fillStyle = '#ffffff';
      for (const copy of preparedPaths) for (const glyph of copy) {
        ctx.beginPath();
        for (const contour of glyph) {
          for (let n = 0; n < contour.length; n++) {
            const [x, y, i, a, b, c, d] = contour[n], j = i + columns + 1;
            const dx = flowX[i] * a + flowX[i + 1] * b + flowX[j] * c + flowX[j + 1] * d;
            const dy = flowY[i] * a + flowY[i + 1] * b + flowY[j] * c + flowY[j + 1] * d;
            if (n) ctx.lineTo(x + dx, y + dy); else ctx.moveTo(x + dx, y + dy);
          }
          ctx.closePath();
        }
        ctx.fill('nonzero');
      }
      mark.classList.add('is-flowing');
      requestTick(false);
    };
    const queueFlow = ({ x, y, dx, dy, start, time, kind }) => {
      if (Math.abs(dx) + Math.abs(dy) <= 0.05 || menu.open || document.hidden) return false;
      // Native scroll is only a fallback; never add its force to a fresh finger sample.
      if (kind === 'scroll' && pointerInput && pointerInput.kind !== 'scroll') return false;
      if (pointerInput?.kind !== kind) pointerInput = null;
      pointerInput = {
        x, y, dx: (pointerInput?.dx || 0) + dx, dy: (pointerInput?.dy || 0) + dy,
        start: pointerInput?.start ?? start, time, kind,
      };
      if (!flowActive) flowTime = time;
      flowActive = true;
      requestTick(false);
      return true;
    };
    const visibleArtPoint = (clientX, clientY, clamp = false) => {
      const rect = mark.getBoundingClientRect();
      const top = Math.max(0, rect.top, root.classList.contains('footer-reveal') ? page.getBoundingClientRect().bottom : 0);
      const bottom = Math.min(innerHeight, rect.bottom);
      if (bottom <= top || (!clamp && (clientX < rect.left || clientX > rect.right || clientY < top || clientY > bottom))) return null;
      return {
        x: Math.max(0, Math.min(artWidth, clientX - rect.left)),
        y: Math.max(top, Math.min(bottom, clientY)) - rect.top,
      };
    };
    const stopTouch = (reset = true, blocked = false) => {
      touchGesture = null; touchMomentumUntil = 0; touchBlocked = blocked;
      lastTouchPosition = null; lastDirectTouchTime = -Infinity;
      if (reset) resetFlow();
    };
    on(footer, 'pointermove', event => {
      if (!['mouse', 'pen'].includes(event.pointerType) || touchGesture || document.hidden) return;
      const rect = mark.getBoundingClientRect(), now = performance.now();
      const x = event.clientX - rect.left, y = event.clientY - rect.top;
      if (x < 0 || x > artWidth || y < 0 || y > artHeight) { pointerPoint = null; return; }
      if (pointerPoint) {
        const dx = x - pointerPoint.x, dy = y - pointerPoint.y;
        queueFlow({ x, y, dx, dy, start: pointerPoint.time, time: now, kind: 'pointer' });
      }
      pointerPoint = { x, y, time: now };
    }, { passive: true });
    ['pointerleave', 'pointercancel'].forEach(type => on(footer, type, () => { pointerPoint = null; }));
    // Passive TouchEvents survive native pan's pointercancel, so scrolling and
    // pinch zoom keep their browser behavior. No finger capture or touch-action override.
    on(document, 'touchstart', event => {
      // Warm the small artwork data on the first gesture, before a fast fling
      // reaches the footer on a slower mobile connection.
      if (event.touches.length === 1) loadContours();
      if (event.touches.length !== 1 || touchBlocked) { stopTouch(true, true); return; }
      stopTouch(false);
      pointerPoint = null;
      preservePageEnd = false;
      if (menu.open || document.hidden || event.target?.closest?.('a,button,input,textarea,select,[contenteditable],[data-team-scroller]')) return;
      const touch = event.touches[0], now = performance.now();
      touchGesture = { id: touch.identifier, x: touch.clientX, y: touch.clientY, time: now };
      lastTouchPosition = { x: touch.clientX, y: touch.clientY };
      lastScrollTop = boundedScrollY(); lastScrollTime = now;
    }, { passive: true });
    on(document, 'touchmove', event => {
      if (event.touches.length !== 1 || touchBlocked) { stopTouch(true, true); return; }
      if (!touchGesture || menu.open || document.hidden) return;
      const touch = Array.from(event.touches).find(item => item.identifier === touchGesture.id);
      if (!touch) { stopTouch(); return; }
      const now = performance.now(), point = visibleArtPoint(touch.clientX, touch.clientY);
      if (point && queueFlow({ ...point, dx: touch.clientX - touchGesture.x, dy: touch.clientY - touchGesture.y,
        start: touchGesture.time, time: now, kind: 'touch' })) {
        lastDirectTouchTime = now;
      }
      touchGesture = { ...touchGesture, x: touch.clientX, y: touch.clientY, time: now };
      lastTouchPosition = { x: touch.clientX, y: touch.clientY };
    }, { passive: true });
    on(document, 'touchend', event => {
      if (touchBlocked) { if (!event.touches.length) stopTouch(); return; }
      if (touchGesture && !Array.from(event.touches).some(touch => touch.identifier === touchGesture.id)) {
        touchGesture = null;
        touchMomentumUntil = performance.now() + 900;
      }
    }, { passive: true });
    on(document, 'touchcancel', event => stopTouch(true, event.touches.length > 0), { passive: true });
    on(document, 'keydown', () => stopTouch());
    on(document, 'click', event => { if (event.target?.closest?.('a,button')) stopTouch(); });
    on(mainMark, 'load', () => { layoutNeeded = true; requestTick(); });
    on(document, 'visibilitychange', () => {
      stopTouch();
      if (document.hidden) { cancelAnimationFrame(frame); frame = 0; }
      else requestTick();
    });
    cleanups.push(() => { stopTouch(); copies.forEach(copy => copy.remove()); flowCanvas.remove(); mark.classList.remove('is-accordion'); mainMark.style.removeProperty('transform'); mainMark.style.removeProperty('inline-size'); });
    const measure = () => {
      // Reserve the fixed header's actual size for initial layout and hash targets.
      root.style.setProperty('--header-h', `${header.getBoundingClientRect().height}px`);
      measureTeam();
      // Both modes use the same natural height, so a short window cannot oscillate.
      const height = footer.getBoundingClientRect().height, fits = height <= innerHeight;
      footerHeight = height;
      root.classList.toggle('footer-reveal', fits);
      root.classList.toggle('no-footer-reveal', !fits);
      root.style.setProperty('--footer-h', `${height}px`);
      measureArt();
      layoutNeeded = false;
    };
    const paint = (now = performance.now()) => {
      frame = 0;
      if (menu.open) { stopTouch(); return; }
      if (layoutNeeded) measure();
      // Deformation/settling frames do not need header, section or curtain reads.
      // Real scroll/layout/menu events still refresh all page state immediately.
      if (!pageStateNeeded) { paintFlow(now); return; }
      pageStateNeeded = false;
      paintTeam();
      if (preservePageEnd) {
        preservePageEnd = false;
        window.scrollTo({ top: root.scrollHeight, behavior: 'instant' });
      }
      atPageEnd = root.scrollHeight - innerHeight - scrollY <= 2;
      // Latest start above 35% stays active through continuation blocks and gaps.
      const line = innerHeight * 0.35;
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
      const height = footerHeight;
      const pageBottom = page.getBoundingClientRect().bottom;
      if (pageBottom < innerHeight + 600) loadContours();
      const uncovered = Math.max(0, Math.min(height, innerHeight - pageBottom));
      const p = root.classList.contains('footer-reveal') ? uncovered / height : 1;
      const rest = motion.matches ? 0 : 1 - p * p * (3 - 2 * p);
      footer.style.setProperty('--reveal-rest', String(rest));
      footer.style.setProperty('--reveal-progress', String(p));
      const footerRect = footer.getBoundingClientRect();
      if (footerRect.bottom <= 0 || footerRect.top >= innerHeight || (!uncovered && root.classList.contains('footer-reveal'))) resetFlow();
      else paintFlow(now);
    };
    function requestTick(updatePage = true) {
      if (updatePage) pageStateNeeded = true;
      if (!frame) frame = requestAnimationFrame(paint);
    }
    on(window, 'scroll', () => {
      const now = performance.now(), top = boundedScrollY(), delta = top - lastScrollTop;
      if ((touchGesture || now < touchMomentumUntil) && lastTouchPosition && !touchBlocked && !menu.open && !document.hidden && now - lastDirectTouchTime > 32 && Math.abs(delta) < Math.min(500, innerHeight * 0.75)) {
        const point = visibleArtPoint(lastTouchPosition.x, lastTouchPosition.y, true);
        if (point) queueFlow({ ...point, dx: 0, dy: -delta, start: lastScrollTime, time: now, kind: 'scroll' });
      }
      lastScrollTop = top; lastScrollTime = now;
      requestTick();
    }, { passive: true });
    on(window, 'resize', () => {
      // Width changes can replace the opener or reflow its coordinates. Settle
      // immediately; height-only browser toolbar changes leave the modal intact.
      if (menu.open) {
        if (innerWidth !== menuWidth) closeMenu(true, true);
        else settleMenu();
      }
      // Retain a fully uncovered footer across responsive reflow without moving
      // readers who were part-way through the page before the resize.
      preservePageEnd ||= atPageEnd && !touchGesture;
      touchMomentumUntil = 0;
      lastScrollTop = boundedScrollY(); lastScrollTime = performance.now();
      layoutNeeded = true;
      requestTick();
    });
    on(window, 'load', () => { layoutNeeded = true; requestTick(); });
    on(motion, 'change', requestTick);
    on(document.fonts, 'loadingdone', () => { layoutNeeded = true; requestTick(); });
    const observer = new ResizeObserver(() => { layoutNeeded = true; requestTick(); });
    [footer, mark, page, header, teamPin].filter(Boolean).forEach(element => observer.observe(element));
    cleanups.push(() => observer.disconnect());
    $('[data-year]').textContent = new Date().getFullYear();
    root.classList.add('js');
    paint();
    dispose = () => {
      closeMenu(false, true);
      lifecycle.abort();
      cleanups.forEach(cleanup => cleanup());
      cancelAnimationFrame(frame);
      root.classList.remove('js', 'footer-reveal');
    };
  };
  try { init(); } catch (error) {
    document.documentElement.classList.remove('js', 'footer-reveal');
    console.error('[Maiac] Enhancement unavailable:', error);
  }
  window.addEventListener('pagehide', () => dispose?.());
  window.addEventListener('pageshow', event => { if (event.persisted) init(); });
})();
