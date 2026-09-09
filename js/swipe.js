// Колода со свайпами на Pointer Events. Работает в iOS Safari внутри Telegram и в десктопном Chrome.
// create(container, {items, renderCard, onDecision, onPhotoTap, onEmpty, onThreshold, stack}) → {like, nope, superlike, undo, push, destroy, remaining, top}
(function () {
  'use strict';
  const H = (globalThis.Haha = globalThis.Haha || {});
  const clamp = (x, a, b) => Math.min(b, Math.max(a, x));

  function create(container, opts) {
    const items = (opts.items || []).slice();
    const stackSize = opts.stack || 3;
    const cards = [];      // [{item, el, bound}], 0 = верхняя
    const history = [];    // для undo: {item, kind}
    let active = null;     // состояние перетаскивания
    let busy = false;      // идёт вылет
    let suppressClick = false;
    let destroyed = false;

    container.addEventListener('click', function (e) {
      if (suppressClick) { e.stopPropagation(); e.preventDefault(); suppressClick = false; }
    }, true);

    function thresholdX(w) { return Math.min(120, w * 0.33); }

    function mount() {
      while (cards.length < stackSize && items.length) {
        const item = items.shift();
        const el = opts.renderCard(item);
        el.classList.add('card');
        container.appendChild(el);
        cards.push({ item, el, bound: false });
      }
      layout();
      if (!cards.length && opts.onEmpty) opts.onEmpty();
    }

    function layout() {
      cards.forEach(function (c, i) {
        c.el.dataset.depth = String(i);
        if (i === 0) attach(c); else detach(c);
        if (i > 0) { c.el.style.transform = ''; c.el.classList.add('settle'); }
      });
      container.style.setProperty('--p', '0');
    }

    function attach(c) { if (c.bound) return; c.bound = true; c.el.addEventListener('pointerdown', onDown); }
    function detach(c) { if (!c.bound) return; c.bound = false; c.el.removeEventListener('pointerdown', onDown); }

    function onDown(e) {
      if (busy || active || destroyed) return;
      if (e.pointerType === 'mouse' && e.button !== 0) return;
      if (e.target && e.target.closest && e.target.closest('[data-noswipe]')) return;
      const el = e.currentTarget;
      const rect = el.getBoundingClientRect();
      active = {
        el, id: e.pointerId, x0: e.clientX, y0: e.clientY, t0: performance.now(), dx: 0, dy: 0, moved: false,
        grabTop: (e.clientY - rect.top) < rect.height / 2, w: rect.width, h: rect.height, samples: [], raf: 0, hapt: false
      };
      el.classList.remove('settle');
      el.style.transition = 'none';
      try { el.setPointerCapture(e.pointerId); } catch (_) { /* игнорируем */ }
      el.addEventListener('pointermove', onMove);
      el.addEventListener('pointerup', onUp);
      el.addEventListener('pointercancel', onCancel);
    }

    function onMove(e) {
      if (!active || e.pointerId !== active.id) return;
      active.dx = e.clientX - active.x0;
      active.dy = e.clientY - active.y0;
      if (!active.moved && Math.hypot(active.dx, active.dy) > 8) active.moved = true;
      active.samples.push({ x: e.clientX, y: e.clientY, t: performance.now() });
      if (active.samples.length > 8) active.samples.shift();
      if (active.moved && !active.raf) active.raf = requestAnimationFrame(paint);
    }

    function paint() {
      if (!active) return;
      active.raf = 0;
      const a = active;
      const rot = clamp(a.dx / a.w * 20, -20, 20) * (a.grabTop ? 1 : -1);
      a.el.style.transform = 'translate3d(' + a.dx + 'px,' + a.dy + 'px,0) rotate(' + rot.toFixed(2) + 'deg)';
      const T = thresholdX(a.w), Ty = a.h * 0.25;
      const like = clamp(a.dx / T, 0, 1), nope = clamp(-a.dx / T, 0, 1);
      const vertical = a.dy < 0 && Math.abs(a.dy) > 1.5 * Math.abs(a.dx);
      const sup = vertical ? clamp(-a.dy / Ty, 0, 1) : 0;
      a.el.style.setProperty('--s-like', (vertical ? 0 : like).toFixed(2));
      a.el.style.setProperty('--s-nope', (vertical ? 0 : nope).toFixed(2));
      a.el.style.setProperty('--s-super', sup.toFixed(2));
      const p = clamp(Math.max(Math.abs(a.dx) / T, vertical ? -a.dy / Ty : 0), 0, 1);
      container.style.setProperty('--p', p.toFixed(2));
      const crossed = like >= 1 || nope >= 1 || sup >= 1;
      if (crossed && !a.hapt) { a.hapt = true; if (opts.onThreshold) opts.onThreshold(); }
      else if (!crossed) a.hapt = false;
    }

    function velocity(a) {
      const s = a.samples;
      if (s.length < 2) return { vx: 0, vy: 0 };
      const now = performance.now();
      let first = s[0];
      for (let i = 0; i < s.length; i++) { if (now - s[i].t <= 100) { first = s[i]; break; } }
      const last = s[s.length - 1];
      const dt = Math.max(16, last.t - first.t);
      return { vx: (last.x - first.x) / dt, vy: (last.y - first.y) / dt };
    }

    function release(a) {
      if (a.raf) cancelAnimationFrame(a.raf);
      a.el.removeEventListener('pointermove', onMove);
      a.el.removeEventListener('pointerup', onUp);
      a.el.removeEventListener('pointercancel', onCancel);
      try { a.el.releasePointerCapture(a.id); } catch (_) { /* игнорируем */ }
    }

    function onUp(e) {
      if (!active || e.pointerId !== active.id) return;
      const a = active;
      release(a);
      active = null;
      if (!a.moved) {
        if (performance.now() - a.t0 < 350 && opts.onPhotoTap && cards[0]) {
          const rect = a.el.getBoundingClientRect();
          opts.onPhotoTap(cards[0].item, (e.clientX - rect.left) < rect.width / 2 ? -1 : 1);
          suppressClick = true;
          setTimeout(function () { suppressClick = false; }, 300);
        }
        a.el.style.transition = '';
        return;
      }
      suppressClick = true;
      setTimeout(function () { suppressClick = false; }, 300);
      const v = velocity(a);
      const T = thresholdX(a.w), Ty = a.h * 0.25, V = 0.6;
      const vertical = a.dy < 0 && Math.abs(a.dy) > 1.5 * Math.abs(a.dx);
      let kind = null;
      if (vertical && (a.dy < -Ty || v.vy < -V)) kind = 'super';
      else if (!vertical && (a.dx > T || v.vx > V)) kind = 'like';
      else if (!vertical && (a.dx < -T || v.vx < -V)) kind = 'nope';
      if (kind && cards[0] && cards[0].el === a.el) fly(cards[0], kind, { dx: a.dx, dy: a.dy, vx: v.vx, vy: v.vy });
      else snapBack(a.el);
    }

    function onCancel(e) {
      if (!active || e.pointerId !== active.id) return;
      const a = active;
      release(a);
      active = null;
      snapBack(a.el);
    }

    function snapBack(el) {
      el.style.transition = 'transform 0.38s cubic-bezier(0.3, 1.4, 0.5, 1)';
      el.style.transform = '';
      ['like', 'nope', 'super'].forEach(function (k) { el.style.setProperty('--s-' + k, '0'); });
      container.style.setProperty('--p', '0');
      const end = function () { el.style.transition = ''; el.removeEventListener('transitionend', end); };
      el.addEventListener('transitionend', end);
      setTimeout(end, 420);
    }

    function fly(card, kind, m) {
      if (busy) return;
      busy = true;
      const el = card.el;
      const w = container.clientWidth || 360, h = container.clientHeight || 520;
      const sign = kind === 'nope' ? -1 : 1;
      let tx, ty, rot;
      if (kind === 'super') { tx = m.dx || 0; ty = -(h + 240); rot = 0; }
      else { tx = sign * (w + 260) + (m.dx || 0); ty = (m.dy || 0) + (m.vy || 0) * 180; rot = sign * 28; }
      el.style.transition = 'transform 0.36s ease-out, opacity 0.36s';
      el.style.setProperty('--s-' + kind, '1');
      el.style.transform = 'translate3d(' + tx + 'px,' + ty + 'px,0) rotate(' + rot + 'deg)';
      let done = false;
      const finish = function () {
        if (done) return;
        done = true;
        clearTimeout(tm);
        el.removeEventListener('transitionend', finish);
        el.remove();
        const idx = cards.indexOf(card);
        if (idx >= 0) cards.splice(idx, 1);
        history.push({ item: card.item, kind });
        busy = false;
        mount();
        if (opts.onDecision) opts.onDecision(card.item, kind);
      };
      el.addEventListener('transitionend', finish);
      const tm = setTimeout(finish, 460);
    }

    function decide(kind) {
      if (busy || active || !cards[0]) return false;
      const w = container.clientWidth || 360;
      const T = thresholdX(w);
      fly(cards[0], kind, { dx: kind === 'super' ? 0 : (kind === 'nope' ? -1 : 1) * T * 0.4, dy: 0, vx: 0, vy: 0 });
      return true;
    }

    function undo() {
      if (busy || active || !history.length) return null;
      const last = history.pop();
      const el = opts.renderCard(last.item);
      el.classList.add('card');
      const w = container.clientWidth || 360, h = container.clientHeight || 520;
      const sign = last.kind === 'nope' ? -1 : 1;
      el.style.transition = 'none';
      el.style.transform = last.kind === 'super'
        ? 'translate3d(0,' + (-(h + 240)) + 'px,0)'
        : 'translate3d(' + (sign * (w + 260)) + 'px,0,0) rotate(' + (sign * 28) + 'deg)';
      if (cards.length >= stackSize) { const b = cards.pop(); items.unshift(b.item); b.el.remove(); }
      cards.unshift({ item: last.item, el, bound: false });
      container.appendChild(el);
      layout();
      void el.getBoundingClientRect();
      el.style.transition = 'transform 0.38s cubic-bezier(0.3, 1.2, 0.5, 1)';
      el.style.transform = '';
      setTimeout(function () { el.style.transition = ''; }, 420);
      return last;
    }

    function push(more) { (more || []).forEach(function (it) { items.push(it); }); mount(); }
    function destroy() {
      destroyed = true;
      if (active) { release(active); active = null; }
      cards.forEach(function (c) { detach(c); c.el.remove(); });
      cards.length = 0; items.length = 0; history.length = 0;
    }

    mount();
    return {
      like: function () { return decide('like'); },
      nope: function () { return decide('nope'); },
      superlike: function () { return decide('super'); },
      undo, push, destroy,
      remaining: function () { return cards.length + items.length; },
      top: function () { return cards[0] ? cards[0].item : null; },
      canUndo: function () { return history.length > 0 && !busy; },
      isBusy: function () { return busy || !!active; }
    };
  }

  H.swipe = { create };
})();
