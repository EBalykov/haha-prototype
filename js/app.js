// «Хаха»: состояние, роутер, экраны. Один ключ localStorage, стек экранов, оверлеи как записи стека,
// детерминированное демо (третий лайк подряд = мэтч, зеркальные анкеты, автоответы по сценарию).
(function () {
  'use strict';
  const H = globalThis.Haha;
  const D = H.data, E = H.humor, TG = H.tg;
  const KEY = 'haha.v1';
  const VERSION = (document.querySelector('meta[name="app-version"]') || {}).content || '0.0.0';
  const $ = (sel, root) => (root || document).querySelector(sel);
  const $$ = (sel, root) => Array.from((root || document).querySelectorAll(sel));
  const esc = (s) => String(s == null ? '' : s).replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
  const PHOTO = (f) => 'assets/photos/' + f;
  const clamp = E.clamp;
  const profileById = (id) => D.PROFILES.find((p) => p.id === id);
  const cardById = (id) => D.CARDS.find((c) => c.id === id);
  const pad2 = (n) => (n < 10 ? '0' : '') + n;
  const fmtTime = (ts) => { const d = new Date(ts); return pad2(d.getHours()) + ':' + pad2(d.getMinutes()); };
  const plural = (n, one, few, many) => { const m = n % 10, h = n % 100; return n + ' ' + (h >= 11 && h <= 14 ? many : m === 1 ? one : m >= 2 && m <= 4 ? few : many); };

  // ---------- Состояние ----------
  function fresh() {
    return {
      v: 1, seed: 7, updatedAt: 0, gate: 'splash',
      me: { name: '', age: null, gender: null, seeking: null, city: 'Москва', photos: [], bio: '', joke: '', tg: null, invitedBy: null, step: 0 },
      humor: { reactions: {}, answers: [], doneAt: 0 },
      decisions: [], matches: [], chats: {}, premium: false,
      filters: { ageMin: 22, ageMax: 38, distKm: 30, minHumor: 0 },
      jotd: { votes: {}, myCaption: null },
      demo: { streak: 0, superUsed: 0, seeded: false }
    };
  }
  let S = load();
  let memOnly = false;
  function load() {
    try {
      const raw = localStorage.getItem(KEY);
      if (!raw) return fresh();
      const s = JSON.parse(raw);
      if (!s || s.v !== 1) return fresh();
      const f = fresh();
      Object.values(s.chats || {}).forEach((c) => { c.typing = false; c.pending = 0; });
      return Object.assign(f, s, {
        me: Object.assign(f.me, s.me || {}), humor: Object.assign(f.humor, s.humor || {}),
        filters: Object.assign(f.filters, s.filters || {}), jotd: Object.assign(f.jotd, s.jotd || {}), demo: Object.assign(f.demo, s.demo || {})
      });
    } catch (e) { return fresh(); }
  }
  let saveTimer = 0;
  let resetting = false; // во время сброса демо flush() молчит, иначе pagehide вернёт состояние обратно
  function save() { S.updatedAt = Date.now(); clearTimeout(saveTimer); saveTimer = setTimeout(flush, 150); }
  function flush() {
    clearTimeout(saveTimer);
    if (resetting) return;
    try { localStorage.setItem(KEY, JSON.stringify(S)); }
    catch (e) { if (!memOnly) { memOnly = true; toast('Память браузера недоступна, прогресс не сохранится'); } }
  }
  window.addEventListener('pagehide', flush);
  document.addEventListener('visibilitychange', () => { if (document.hidden) flush(); });

  // ---------- Производные ----------
  const meHumor = () => ({ reactions: S.humor.reactions, answers: S.humor.answers });
  const otherHumor = (p) => E.reactionsOf(p, meHumor());
  const compat = (p) => E.compatibility(meHumor(), otherHumor(p));
  const seeking = () => S.me.seeking || 'f';
  const fitsGender = (p) => seeking() === 'any' || p.gender === seeking();
  const decidedIds = () => new Set(S.decisions.map((d) => d.id));
  const matchedIds = () => new Set(S.matches.map((m) => m.id));
  function deckProfiles() {
    const dec = decidedIds(), mat = matchedIds(), f = S.filters;
    return D.PROFILES.filter((p) => fitsGender(p) && !p.seeded && !dec.has(p.id) && !mat.has(p.id)
      && p.age >= f.ageMin && p.age <= f.ageMax && p.distKm <= f.distKm && (!f.minHumor || compat(p).pct >= f.minHumor));
  }
  const likesYouProfiles = () => { const dec = decidedIds(), mat = matchedIds(); return D.PROFILES.filter((p) => fitsGender(p) && p.likesYou && !dec.has(p.id) && !mat.has(p.id)); };
  const laughedProfiles = () => D.PROFILES.filter((p) => fitsGender(p) && p.laughedAtJoke);
  const unreadCount = (id) => { const c = S.chats[id]; return c ? c.msgs.filter((m) => m.from === 'them' && m.ts > (c.readAt || 0)).length : 0; };
  const totalUnread = () => S.matches.reduce((s, m) => s + unreadCount(m.id), 0);
  const myPhoto = () => (S.me.photos && S.me.photos[0] ? PHOTO(S.me.photos[0]) : '');
  function cardShort(c) {
    if (c.fmt === 'line') return c.text;
    if (c.fmt === 'dialog') return c.lines.map((l) => l.who + ': ' + l.text).join(' ');
    return c.meme.top + '. ' + c.meme.bottom;
  }
  function ensureSeeded() {
    if (S.demo.seeded) return;
    const base = Date.now() - 20 * 3600e3;
    D.PROFILES.filter((p) => p.seeded && fitsGender(p)).forEach((p, k) => {
      S.matches.push({ id: p.id, ts: base + k * 60e3, via: 'seed', icebreaker: null });
      S.chats[p.id] = { msgs: (D.SEED_CHATS[p.id] || []).map((m, i) => ({ from: m.from, kind: 'text', text: m.text, ts: base + k * 60e3 + i * 90e3 })), replyIdx: 0, readAt: Date.now() };
    });
    S.demo.seeded = true;
    save();
  }

  // ---------- Тост и хелперы UI ----------
  let toastTimer = 0;
  function toast(msg, ms) {
    const el = $('#toast');
    el.textContent = msg; el.classList.add('on');
    clearTimeout(toastTimer);
    toastTimer = setTimeout(() => el.classList.remove('on'), ms || 2200);
  }
  function delegate(root, handlers) {
    root.onclick = function (e) {
      const t = e.target.closest('[data-act]');
      if (!t || !root.contains(t)) return;
      const fn = handlers[t.dataset.act];
      if (fn) { e.preventDefault(); fn(t, e); }
    };
  }
  const hbadge = (pct, extra) => `<span class="hbadge ${extra || ''}"><span>🤣</span><span class="n">${pct}%</span><span>по юмору</span></span>`;
  function confettiHTML() {
    const rng = E.mulberry32(42);
    const colors = ['#FF6A3D', '#FFC53D', '#3DDC97', '#7C5CFF', '#4FC3F7', '#fff'];
    let s = '';
    for (let i = 0; i < 16; i++) s += `<i class="confetti" style="left:${Math.round(rng() * 100)}%;background:${colors[i % colors.length]};animation-delay:${(rng() * 0.8).toFixed(2)}s;animation-duration:${(2 + rng() * 1.4).toFixed(2)}s"></i>`;
    return s;
  }

  // ---------- Роутер ----------
  const screens = {};
  const stack = [];
  const R = {
    define(name, def) { screens[name] = def; },
    go(name, params) { closeOverlaysIfPushingScreen(name); push({ name, params: params || {} }); },
    replace(name, params) { const prev = stack.pop(); push({ name, params: params || {} }, prev); },
    reset(name, params) { const prev = current(); stack.length = 0; push({ name, params: params || {} }, prev, true); },
    back, current
  };
  function current() { return stack[stack.length - 1]; }
  function isOverlay(entry) { return !!(entry && screens[entry.name] && screens[entry.name].overlay); }
  function closeOverlaysIfPushingScreen(name) {
    if (screens[name] && screens[name].overlay) return;
    while (isOverlay(current())) { stack.pop(); }
    hideOverlay();
  }
  function push(entry, prev, isTab) {
    prev = prev || current();
    stack.push(entry);
    try { history.pushState({ d: stack.length }, ''); } catch (e) { /* file:// */ }
    render(entry, prev, isTab ? 'tab' : 'push');
  }
  function back(silent) {
    const top = current();
    if (!top) return false;
    const def = screens[top.name];
    if (def && def.onBack && def.onBack(top.params)) { afterNav(); return true; }
    if (stack.length <= 1) { afterNav(); return false; }
    stack.pop();
    if (def.overlay) { hideOverlay(); afterNav(); return true; }
    render(current(), top, 'pop');
    return true;
  }
  window.addEventListener('popstate', (e) => {
    const d = (e.state && e.state.d) || 0;
    if (d < stack.length) back(true);
  });
  let overlayEl = null;
  function hideOverlay() {
    const ov = $('#overlay');
    const sheet = $('.sheet', ov);
    if (sheet) { sheet.classList.remove('in'); setTimeout(() => { if (!$('.sheet.in', ov)) { ov.classList.remove('on'); ov.innerHTML = ''; } }, 320); }
    else { ov.classList.remove('on'); ov.innerHTML = ''; }
    overlayEl = null;
  }
  function render(entry, prev, dir) {
    const def = screens[entry.name];
    if (def.overlay) {
      const ov = $('#overlay');
      ov.innerHTML = '';
      ov.classList.add('on');
      def.render(ov, entry.params);
      overlayEl = ov;
      requestAnimationFrame(() => { const sh = $('.sheet', ov); if (sh) requestAnimationFrame(() => sh.classList.add('in')); });
      afterNav();
      return;
    }
    const el = $(`.screen[data-screen="${entry.name}"]`);
    const prevEl = prev && !isOverlay(prev) ? $(`.screen[data-screen="${prev.name}"]`) : null;
    if (document.activeElement && document.activeElement.blur) document.activeElement.blur();
    def.render(el, entry.params);
    $$('.screen.on').forEach((s) => { if (s !== el) s.classList.remove('on', 'tabin'); });
    if (prevEl && prevEl !== el) {
      if (dir === 'pop') { prevEl.classList.add('leaving'); setTimeout(() => prevEl.classList.remove('leaving'), 260); }
    }
    el.classList.remove('leaving');
    el.classList.toggle('tabin', dir === 'tab');
    el.classList.add('on');
    const sc = $('.scroll', el); if (sc && dir !== 'pop') sc.scrollTop = 0;
    afterNav();
  }
  function afterNav() {
    const top = current();
    const def = top ? screens[top.name] : null;
    const tb = $('#tabbar');
    const showTabs = !!(def && def.tab && !isOverlay(top));
    tb.hidden = !showTabs;
    if (showTabs) $$('.tab', tb).forEach((t) => t.classList.toggle('on', t.dataset.tab === top.name));
    updateBadges();
    TG.setBack(stack.length > 1 || isOverlay(top));
  }
  function updateBadges() {
    const likes = likesYouProfiles().length, unread = totalUnread();
    const dl = $('.tab[data-tab="likes"] .dot'), dc = $('.tab[data-tab="chats"] .dot');
    dl.hidden = !likes; dl.textContent = likes;
    dc.hidden = !unread; dc.textContent = unread;
  }
  $$('#tabbar .tab').forEach((t) => t.addEventListener('click', () => {
    if (current() && current().name === t.dataset.tab && !isOverlay(current())) return;
    TG.haptic('selection');
    R.reset(t.dataset.tab);
  }));
  TG.onBack = () => back();

  // ---------- Сплэш ----------
  R.define('splash', {
    render(el) {
      el.className = 'screen splash';
      const invite = S.me.invitedBy ? `<span class="chip on">🎟 По приглашению @${esc(S.me.invitedBy)}</span>` : '';
      el.innerHTML = `
        <div class="hero">
          <div class="emoji" id="splash-logo">😂</div>
          <div class="logo grad-text">${esc(D.APP.name)}</div>
          <div class="tagline">${esc(D.APP.tagline)}</div>
          <p class="muted">Свайпай, как привык. Мэтчись по чувству юмора.</p>
          ${invite}
        </div>
        <div class="cta">
          <button class="btn primary block" data-act="start">Начать</button>
          <button class="btn tg block" data-act="tg">✈️ Войти через Telegram</button>
        </div>
        <div class="legal">18+. Нажимая «Начать», ты принимаешь правила сервиса. Это прототип: анкеты и переписки вымышленные.</div>`;
      delegate(el, {
        start() { S.gate = 'onboarding'; save(); TG.haptic('light'); R.reset('onboarding'); },
        tg() {
          if (TG.user) { S.me.name = S.me.name || TG.user.name.split(' ')[0]; S.me.tg = TG.user; toast('Привет, ' + S.me.name + '!'); }
          else toast('Вне Telegram вход имитируется');
          S.gate = 'onboarding'; save(); R.reset('onboarding');
        }
      });
      let pressTimer = 0;
      const logo = $('#splash-logo', el);
      const startPress = () => { pressTimer = setTimeout(() => { H.demo.fill(); }, 1500); };
      const endPress = () => clearTimeout(pressTimer);
      logo.addEventListener('pointerdown', startPress);
      ['pointerup', 'pointerleave', 'pointercancel'].forEach((ev) => logo.addEventListener(ev, endPress));
    }
  });

  // ---------- Онбординг ----------
  const OB_STEPS = ['name', 'age', 'gender', 'city', 'photos', 'bio', 'joke'];
  R.define('onboarding', {
    onBack() { if (S.me.step > 0) { S.me.step--; save(); renderOnboarding(); return true; } return false; },
    render(el) { el.className = 'screen ob'; renderOnboarding(el); }
  });
  function renderOnboarding(el) {
    el = el || $('.screen[data-screen="onboarding"]');
    const i = clamp(S.me.step, 0, OB_STEPS.length - 1);
    const step = OB_STEPS[i];
    const me = S.me;
    let body = '', title = '', sub = '';
    if (step === 'name') { title = 'Как тебя зовут?'; sub = 'Так тебя увидят в анкете'; body = `<input class="input" id="ob-name" placeholder="Имя" maxlength="20" value="${esc(me.name)}" autocomplete="given-name">`; }
    if (step === 'age') { title = 'Сколько тебе лет?'; sub = 'Только 18+, без исключений'; body = `<input class="input" id="ob-age" type="number" inputmode="numeric" placeholder="Возраст" min="18" max="99" value="${me.age || ''}">`; }
    if (step === 'gender') {
      title = 'Кто ты и кого ищешь?';
      body = `<div class="field"><div class="label">Я</div><div class="seg" id="ob-g">
          <button type="button" data-v="m" class="${me.gender === 'm' ? 'on' : ''}">Парень</button><button type="button" data-v="f" class="${me.gender === 'f' ? 'on' : ''}">Девушка</button></div></div>
        <div class="field"><div class="label">Ищу</div><div class="seg" id="ob-s">
          <button type="button" data-v="f" class="${me.seeking === 'f' ? 'on' : ''}">Девушек</button><button type="button" data-v="m" class="${me.seeking === 'm' ? 'on' : ''}">Парней</button><button type="button" data-v="any" class="${me.seeking === 'any' ? 'on' : ''}">Всех</button></div></div>`;
    }
    if (step === 'city') {
      title = 'Где ты?'; sub = 'Показываем людей рядом';
      body = `<button class="btn soft block" data-act="geo">📍 Определить по геолокации</button><div class="chips" id="ob-city">${D.APP.cities.map((c) => `<button type="button" class="chip ${me.city === c ? 'on' : ''}" data-v="${esc(c)}">${esc(c)}</button>`).join('')}</div>`;
    }
    if (step === 'photos') {
      title = 'Добавь фото'; sub = 'До трёх. В прототипе выбери из готовых';
      body = `<div class="photo-grid" id="ob-photos">${D.PHOTO_PRESETS.map((f) => { const k = me.photos.indexOf(f); return `<button type="button" data-v="${f}" class="${k >= 0 ? 'on' : ''}" style="background-image:url('${PHOTO(f)}')">${k >= 0 ? `<span class="badge grad num">${k + 1}</span>` : ''}</button>`; }).join('')}<button type="button" class="upload" data-act="upload">📷<br>Загрузить</button></div>`;
    }
    if (step === 'bio') { title = 'Пара слов о себе'; sub = 'Коротко и по-человечески'; body = `<textarea class="input" id="ob-bio" maxlength="140" placeholder="Например: делаю продукты и плохие каламбуры">${esc(me.bio)}</textarea>`; }
    if (step === 'joke') { title = 'Твоя коронная шутка'; sub = 'Её увидят на карточке. Это и есть первое впечатление'; body = `<textarea class="input" id="ob-joke" maxlength="140" placeholder="Например: купил умную колонку, теперь дома двое, кто меня не слушает">${esc(me.joke)}</textarea>`; }
    el.innerHTML = `
      <div class="topbar"><button class="iconbtn" data-act="back" aria-label="Назад">←</button><div class="grow"><div class="progress"><i style="width:${Math.round((i + 1) / OB_STEPS.length * 100)}%"></i></div></div><div class="spacer"></div></div>
      <div class="head"><h1>${title}</h1>${sub ? `<p class="muted">${sub}</p>` : ''}</div>
      <div class="body">${body}</div>
      <div class="foot"><button class="btn primary block" data-act="next">${i === OB_STEPS.length - 1 ? 'Дальше: тест на юмор' : 'Дальше'}</button></div>`;
    delegate(el, {
      back() { if (!back()) { S.gate = 'splash'; save(); R.reset('splash'); } },
      geo() { me.city = me.city || 'Москва'; toast('Геолокация: ' + me.city + ' (имитация)'); save(); renderOnboarding(el); },
      upload() { const free = D.PHOTO_PRESETS.find((f) => !me.photos.includes(f)); if (free && me.photos.length < 3) { me.photos.push(free); save(); renderOnboarding(el); toast('Фото добавлено (в прототипе из готовых)'); } else toast('Максимум три фото'); },
      next() {
        if (step === 'name') { const v = $('#ob-name', el).value.trim(); if (v.length < 2) return toast('Напиши имя'); me.name = v; }
        if (step === 'age') { const v = parseInt($('#ob-age', el).value, 10); if (!(v >= 18 && v <= 99)) return toast('Только 18+'); me.age = v; }
        if (step === 'gender') { if (!me.gender || !me.seeking) return toast('Выбери оба варианта'); }
        if (step === 'city') { if (!me.city) return toast('Выбери город'); }
        if (step === 'photos') { if (!me.photos.length) return toast('Хотя бы одно фото'); }
        if (step === 'bio') { me.bio = $('#ob-bio', el).value.trim(); }
        if (step === 'joke') { const v = $('#ob-joke', el).value.trim(); if (v.length < 5) return toast('Без шутки нельзя, это же «Хаха»'); me.joke = v; }
        TG.haptic('light');
        if (i < OB_STEPS.length - 1) { me.step = i + 1; save(); renderOnboarding(el); }
        else { me.step = 0; S.gate = 'quiz'; save(); R.reset('quiz'); }
      }
    });
    $$('#ob-g button', el).forEach((b) => b.addEventListener('click', () => { me.gender = b.dataset.v; save(); renderOnboarding(el); }));
    $$('#ob-s button', el).forEach((b) => b.addEventListener('click', () => { me.seeking = b.dataset.v; save(); renderOnboarding(el); }));
    $$('#ob-city .chip', el).forEach((b) => b.addEventListener('click', () => { me.city = b.dataset.v; save(); renderOnboarding(el); }));
    $$('#ob-photos button[data-v]', el).forEach((b) => b.addEventListener('click', () => {
      const f = b.dataset.v, k = me.photos.indexOf(f);
      if (k >= 0) me.photos.splice(k, 1); else if (me.photos.length < 3) me.photos.push(f); else return toast('Максимум три фото');
      save(); renderOnboarding(el);
    }));
    const inp = $('input, textarea', el); if (inp && window.innerWidth > 500) inp.focus();
  }

  // ---------- Тест на юмор ----------
  let quizDeck = null;
  function renderQuizCard(c) {
    const el = document.createElement('div');
    el.className = 'qcard bg' + (c.bg || 1);
    let inner = '';
    if (c.fmt === 'line') inner = `<div class="txt ${c.text.length > 90 ? 's' : ''}">${esc(c.text)}</div>`;
    else if (c.fmt === 'dialog') inner = `<div class="dlg">${c.lines.map((l) => `<div class="ln"><span class="who">${esc(l.who)}</span><span class="say">${esc(l.text)}</span></div>`).join('')}</div>`;
    else inner = `<div class="cap">${esc(c.meme.top)}</div><div class="scene">${c.meme.scene}</div><div class="cap">${esc(c.meme.bottom)}</div>`;
    el.innerHTML = `<div class="topic">${esc(c.topic)}</div>${inner}<div class="stamp like">Смешно</div><div class="stamp nope">Не смешно</div><div class="stamp super">Ржу</div>`;
    return el;
  }
  R.define('quiz', {
    onBack() { if (quizDeck && quizDeck.canUndo()) { const last = quizDeck.undo(); if (last) { delete S.humor.reactions[last.item.id]; save(); updateQuizProgress(); } return true; } return false; },
    render(el) {
      el.className = 'screen';
      const total = D.CARDS.length;
      el.innerHTML = `
        <div class="topbar"><button class="iconbtn" data-act="undo" aria-label="Вернуть">↩</button><div class="ttl">Тест на юмор</div><div class="spacer"></div></div>
        <div class="pad"><div class="progress"><i id="quiz-bar" style="width:0%"></i></div><div class="row" style="justify-content:space-between;padding-top:6px"><span class="small muted" id="quiz-n">1 из ${total}</span><span class="small muted">Оцени, насколько смешно</span></div></div>
        <div class="deckwrap"><div class="qhint"><span>← не смешно</span><span>↑ ржу</span><span>смешно →</span></div><div class="deck" id="quiz-deck"></div>
        <div class="qactions"><button class="qbtn" data-act="nope"><b>😐</b>Не смешно</button><button class="qbtn" data-act="like"><b>🙂</b>Смешно</button><button class="qbtn rzh" data-act="super"><b>🤣</b>Ржу</button></div></div>`;
      const pending = D.CARDS.filter((c) => S.humor.reactions[c.id] === undefined);
      if (quizDeck) quizDeck.destroy();
      quizDeck = H.swipe.create($('#quiz-deck', el), {
        items: pending, stack: 2, renderCard: renderQuizCard,
        onThreshold: () => TG.haptic('light'),
        onDecision(card, kind) {
          S.humor.reactions[card.id] = kind === 'super' ? 2 : kind === 'like' ? 1 : -1;
          save(); updateQuizProgress();
          if (Object.keys(S.humor.reactions).length >= D.CARDS.length) { S.gate = 'style'; save(); setTimeout(() => R.reset('style'), 250); }
        },
        onEmpty() { /* переход делает onDecision */ }
      });
      delegate(el, {
        undo() { screens.quiz.onBack(); },
        nope() { quizDeck.nope(); }, like() { quizDeck.like(); }, super() { quizDeck.superlike(); }
      });
      updateQuizProgress();
    }
  });
  function updateQuizProgress() {
    const n = Object.keys(S.humor.reactions).length, total = D.CARDS.length;
    const bar = $('#quiz-bar'), lab = $('#quiz-n');
    if (bar) bar.style.width = Math.round(n / total * 100) + '%';
    if (lab) lab.textContent = Math.min(n + 1, total) + ' из ' + total;
  }

  // ---------- Вопросы о стиле ----------
  R.define('style', {
    render(el) {
      el.className = 'screen';
      const draw = () => {
        el.innerHTML = `
          <div class="topbar"><div class="spacer"></div><div class="ttl">Как ты шутишь</div><div class="spacer"></div></div>
          <div class="scroll pad"><p class="muted" style="padding-bottom:8px">Пять утверждений. Отвечай честно, это влияет на подбор.</p>
          <div class="stack">${D.STYLE_QUESTIONS.map((q, i) => `<div class="panel stack" style="gap:10px"><div class="qnum">Вопрос ${i + 1} из 5</div><h3>${esc(q.text)}</h3>
            <div class="likert" data-q="${i}">${[1, 2, 3, 4, 5].map((v) => `<button type="button" data-v="${v}" class="${S.humor.answers[i] === v ? 'on' : ''}">${v}</button>`).join('')}</div>
            <div class="likert-labels"><span>${esc(D.STYLE_SCALE[0])}</span><span>${esc(D.STYLE_SCALE[4])}</span></div></div>`).join('')}
          <button class="btn primary block" data-act="done" ${D.STYLE_QUESTIONS.every((q, i) => S.humor.answers[i] >= 1) ? '' : 'disabled'}>Показать мой юмор-профиль</button>
          <div style="height:24px"></div></div></div>`;
        $$('.likert button', el).forEach((b) => b.addEventListener('click', () => {
          const i = +b.closest('.likert').dataset.q; S.humor.answers[i] = +b.dataset.v; save(); TG.haptic('selection');
          const st = $('.scroll', el).scrollTop; draw(); $('.scroll', el).scrollTop = st;
        }));
        delegate(el, { done() { S.humor.doneAt = Date.now(); S.gate = 'result'; save(); TG.haptic('success'); R.reset('result'); } });
      };
      draw();
    }
  });

  // ---------- Результат ----------
  function axisBarsHTML(vec) {
    return `<div class="axisbars">${E.AXES.map((k) => `<div class="axisbar"><span>${esc(E.AXIS_LABEL[k])}</span><div class="bar"><i style="width:${Math.round(vec.disp[k] * 100)}%"></i></div><span class="val">${Math.round(vec.disp[k] * 100)}</span></div>`).join('')}</div>`;
  }
  function styleSummary(answers) {
    const s = E.styleFromAnswers(answers);
    const top = E.STYLES.slice().sort((a, b) => s[b] - s[a])[0];
    return E.STYLE_LABEL[top];
  }
  R.define('result', {
    render(el) {
      el.className = 'screen';
      const vec = E.vectorFromReactions(S.humor.reactions);
      const title = E.title(vec.vhat);
      const top = E.topAxes(vec.vhat, 2);
      const topics = D.CARDS.filter((c) => c.axis === top[0] && S.humor.reactions[c.id] >= 1).slice(0, 3).map((c) => c.topic);
      const laughs = Object.values(S.humor.reactions).filter((r) => r === 2).length;
      el.innerHTML = `
        <div class="scroll pad center" style="justify-content:flex-start;gap:14px;padding-top:12px">
          <div class="qnum">Твой юмор-профиль</div>
          <div class="title-big grad-text">${esc(title)}</div>
          <p class="muted">Ржёшь над ${plural(laughs, 'шуткой', 'шутками', 'шутками')} из ${D.CARDS.length}. Сильнее всего заходят ${esc(E.AXIS_PHRASE[top[0]])} и ${esc(E.AXIS_PHRASE[top[1]])}.</p>
          <div class="radarwrap">${E.radarSVG([vec], { size: 260 })}</div>
          <div class="panel" style="width:100%;text-align:left">${axisBarsHTML(vec)}</div>
          <div class="panel soft" style="width:100%;text-align:left"><b>Похожие на тебя ржут над:</b><div class="chips" style="padding-top:8px">${topics.map((t) => `<span class="chip tiny">${esc(t)}</span>`).join('') || '<span class="muted small">пока ни над чем, странно</span>'}</div>
            <p class="small muted" style="padding-top:8px">Стиль: ${esc(styleSummary(S.humor.answers).toLowerCase())}</p></div>
          <button class="btn primary block" data-act="go">Смотреть анкеты</button>
          <button class="btn ghost block" data-act="share">Поделиться результатом</button>
          <div style="height:24px"></div>
        </div>`;
      delegate(el, {
        go() { S.gate = 'app'; save(); ensureSeeded(); TG.haptic('success'); R.reset('feed'); },
        share() { toast('Ссылка на результат скопирована (имитация)'); }
      });
    }
  });

  // ---------- Лента ----------
  let feedDeck = null, feedSig = '';
  function feedSignature() { return [S.decisions.length, S.matches.length, seeking(), JSON.stringify(S.filters), S.humor.doneAt].join('|'); }
  function renderProfileCard(p) {
    const el = document.createElement('div');
    const c = compat(p);
    el._idx = 0;
    el.innerHTML = `
      <div class="photo" style="background-image:url('${PHOTO(p.photos[0])}')"></div><div class="shade"></div>
      <div class="dots">${p.photos.map((_, i) => `<i class="${i === 0 ? 'on' : ''}"></i>`).join('')}</div>
      <div class="stamp like">Да</div><div class="stamp nope">Нет</div><div class="stamp super">Ржу 🤣</div>
      <div class="info">
        ${hbadge(c.pct)}
        <div class="name">${esc(p.name)}, ${p.age} ${p.verified ? '<span class="v" title="Фото проверено">✔︎</span>' : ''}<button class="iconbtn" data-noswipe data-act="info" data-id="${p.id}" aria-label="Подробнее" style="margin-left:auto;pointer-events:auto;background:rgba(0,0,0,.35);width:36px;height:36px;font-size:16px">ⓘ</button></div>
        <div class="meta">📍 ${p.distKm} км · ${esc(p.city)} · общих ржак: <b>${c.shared.length}</b> из ${D.CARDS.length}</div>
        <div class="joke">«${esc(p.joke)}»</div>
        <div class="tagrow">${p.tags.map((t) => `<span>${esc(t)}</span>`).join('')}</div>
      </div>`;
    return el;
  }
  function setCardPhoto(el, p, idx) {
    el._idx = idx;
    $('.photo', el).style.backgroundImage = `url('${PHOTO(p.photos[idx])}')`;
    $$('.dots i', el).forEach((d, i) => d.classList.toggle('on', i === idx));
  }
  function preload(list) { list.forEach((p) => { const im = new Image(); im.src = PHOTO(p.photos[0]); }); }
  function evaluateMatch(p, kind) {
    if (kind === 'nope') { S.demo.streak = 0; return false; }
    S.demo.streak++;
    const hit = p.role === 'mirror' || p.likesYou || S.demo.streak >= 3;
    if (hit) S.demo.streak = 0;
    return hit;
  }
  function recordDecision(p, kind) {
    const matched = evaluateMatch(p, kind);
    S.decisions.push({ id: p.id, kind, ts: Date.now(), matched });
    if (kind === 'super') S.demo.superUsed++;
    if (matched) {
      const c = compat(p);
      S.matches.push({ id: p.id, ts: Date.now(), via: kind, icebreaker: c.shared[0] || null });
      if (!S.chats[p.id]) S.chats[p.id] = { msgs: [], replyIdx: 0, readAt: Date.now() };
    }
    save();
    return matched;
  }
  R.define('feed', {
    tab: true,
    render(el) {
      el.className = 'screen tabroot';
      const sig = feedSignature();
      if (feedDeck && feedSig === sig && el.childElementCount) { updateUndo(); return; }
      feedSig = sig;
      el.innerHTML = `
        <div class="feedtop"><div class="brand grad-text">${esc(D.APP.name)}</div><div class="row"><span class="small muted">📍 ${esc(S.me.city)}</span><button class="iconbtn" data-act="filters" aria-label="Фильтры">⚙︎</button></div></div>
        <button class="banner" data-act="jotd"><span class="em">🏆</span><div class="grow"><b>Шутка дня: подпиши мем</b><span>${D.JOTD.captions.length} подписей · ты в ${esc(D.JOTD.myRank)}</span></div><span class="muted">›</span></button>
        <div class="deckwrap"><div class="deck" id="feed-deck"></div>
        <div class="actions"><button class="act undo" data-act="undo" aria-label="Отменить">↩</button><button class="act big nope" data-act="nope" aria-label="Нет">✕</button><button class="act super" data-act="super" aria-label="Рассмешил">🤣</button><button class="act big like" data-act="like" aria-label="Да">❤️</button></div></div>`;
      const list = deckProfiles();
      preload(list.slice(0, 3));
      if (feedDeck) feedDeck.destroy();
      const deckEl = $('#feed-deck', el);
      feedDeck = H.swipe.create(deckEl, {
        items: list, stack: 3, renderCard: renderProfileCard,
        onThreshold: () => TG.haptic('light'),
        onPhotoTap(p, dir) { const top = $('.card[data-depth="0"]', deckEl); if (!top) return; const n = p.photos.length; setCardPhoto(top, p, (top._idx + dir + n) % n); TG.haptic('selection'); },
        onDecision(p, kind) {
          const matched = recordDecision(p, kind);
          feedSig = feedSignature();
          preload(deckProfiles().slice(1, 3));
          updateUndo(); updateBadges();
          if (matched) { TG.haptic('success'); R.go('match', { id: p.id }); }
          else if (kind === 'super') toast(p.name + ' узнает, что рассмешил' + (S.me.gender === 'f' ? 'а' : '') + ' тебя 🤣');
        },
        onEmpty() {
          deckEl.innerHTML = `<div class="empty"><div style="font-size:48px">🫥</div><h3>Анкеты рядом закончились</h3><p class="muted small">Расширь фильтры или загляни вечером: новые люди приходят каждый день.</p><button class="btn soft" data-act="filters">Расширить фильтры</button><button class="btn ghost sm" data-act="rewind">Показать заново (демо)</button></div>`;
        }
      });
      delegate(el, {
        filters() { R.go('filters'); },
        jotd() { R.go('jotd'); },
        info(t) { R.go('person', { id: t.dataset.id }); },
        nope() { feedDeck.nope(); }, like() { feedDeck.like(); }, super() { feedDeck.superlike(); },
        undo() {
          const last = S.decisions[S.decisions.length - 1];
          if (!last) return;
          if (last.matched) return toast('Мэтч не отменить, это уже история');
          if (!feedDeck.canUndo()) { S.decisions.pop(); save(); feedSig = ''; R.reset('feed'); return; }
          const u = feedDeck.undo();
          if (u) { S.decisions.pop(); S.demo.streak = Math.max(0, S.demo.streak - (u.kind === 'nope' ? 0 : 1)); save(); feedSig = feedSignature(); updateUndo(); TG.haptic('light'); }
        },
        rewind() { S.decisions = S.decisions.filter((d) => d.matched); S.demo.streak = 0; save(); feedSig = ''; R.reset('feed'); }
      });
      updateUndo();
    }
  });
  function updateUndo() {
    const b = $('.screen[data-screen="feed"] .act.undo'); if (!b) return;
    const last = S.decisions[S.decisions.length - 1];
    b.disabled = !last || last.matched;
  }

  // ---------- Анкета целиком ----------
  R.define('person', {
    render(el, params) {
      el.className = 'screen';
      const p = profileById(params.id); if (!p) { back(); return; }
      const c = compat(p);
      const mine = E.vectorFromReactions(S.humor.reactions), theirs = E.vectorFromReactions(otherHumor(p).reactions);
      const isMatched = matchedIds().has(p.id), isDecided = decidedIds().has(p.id);
      let idx = 0;
      const draw = () => {
        el.innerHTML = `
          <div class="scroll" style="padding-top:0">
            <div class="hero-photo" style="background-image:url('${PHOTO(p.photos[idx])}')"><div class="shade"></div>
              <div class="topbar"><button class="iconbtn" data-act="back" aria-label="Назад" style="background:rgba(0,0,0,.4)">←</button><div class="ttl"></div><button class="iconbtn" data-act="more" aria-label="Ещё" style="background:rgba(0,0,0,.4)">⋯</button></div>
              <div class="thumbs">${p.photos.map((f, i) => `<button type="button" data-act="thumb" data-i="${i}" class="${i === idx ? 'on' : ''}" style="background-image:url('${PHOTO(f)}')"></button>`).join('')}</div>
            </div>
            <div class="section" style="padding-top:0">
              <div class="row"><h1>${esc(p.name)}, ${p.age}</h1>${p.verified ? '<span class="badge ok">✔︎ фото проверено</span>' : ''}</div>
              <div class="muted">📍 ${p.distKm} км · ${esc(p.city)}</div>
              ${hbadge(c.pct)}
            </div>
            <div class="section"><h3>Юмор-совместимость</h3>
              <div class="panel"><div class="radarwrap">${E.radarSVG([mine, theirs], { size: 240 })}</div>
              <div class="legend"><span><i style="background:linear-gradient(135deg,#FF6A3D,#FFC53D)"></i>ты</span><span><i style="background:linear-gradient(135deg,#7C5CFF,#4DD0E1)"></i>${esc(p.name)}</span></div>
              <p class="small muted" style="padding-top:8px">Вкус ${Math.round((c.cos + 1) / 2 * 100)}% · стиль ${Math.round(c.style * 100)}% · общие ржаки ${c.shared.length} из ${D.CARDS.length}. Стиль: ${esc(styleSummary(otherHumor(p).answers).toLowerCase())}.</p></div>
            </div>
            <div class="section"><h3>Вы оба ржёте над <span class="badge grad">${c.shared.length}</span></h3>
              <div class="laughs">${c.shared.slice(0, 6).map((id) => { const card = cardById(id); const both = S.humor.reactions[id] === 2 && otherHumor(p).reactions[id] === 2; return `<div class="laugh ${both ? 'both' : ''}"><span class="em">${both ? '🤣' : '😄'}</span><div><div>${esc(cardShort(card))}</div><div class="tiny muted">${esc(card.topic)}${both ? ' · оба ржали' : ''}</div></div></div>`; }).join('') || '<p class="muted small">Общих пока нет. Но кто знает.</p>'}</div>
            </div>
            <div class="section"><h3>Коронная шутка</h3><div class="panel soft">«${esc(p.joke)}»</div></div>
            <div class="section"><h3>О себе</h3><p>${esc(p.bio)}</p><div class="chips">${p.tags.map((t) => `<span class="chip tiny">${esc(t)}</span>`).join('')}</div></div>
            <div class="section" style="padding-bottom:calc(24px + var(--safe-b))">
              ${isMatched ? `<button class="btn primary block" data-act="chat">Написать сообщение</button>` : isDecided ? '<p class="muted small" style="text-align:center">Ты уже решил(а) по этой анкете</p>' : `<div class="actions" style="padding:0"><button class="act big nope" data-act="nope">✕</button><button class="act super" data-act="super">🤣</button><button class="act big like" data-act="like">❤️</button></div>`}
              <button class="btn ghost block sm" data-act="report" style="margin-top:8px">Пожаловаться или скрыть</button>
            </div>
          </div>`;
        delegate(el, {
          back() { back(); },
          more() { toast('Поделиться анкетой, скрыть, пожаловаться'); },
          thumb(t) { idx = +t.dataset.i; draw(); },
          chat() { R.go('chat', { id: p.id }); },
          report() { toast('Жалоба отправлена модерации (имитация). Анкета скрыта.'); S.decisions.push({ id: p.id, kind: 'nope', ts: Date.now(), matched: false }); save(); back(); },
          nope() { decideFromPerson(p, 'nope'); }, like() { decideFromPerson(p, 'like'); }, super() { decideFromPerson(p, 'super'); }
        });
      };
      draw();
    }
  });
  function decideFromPerson(p, kind) {
    const matched = recordDecision(p, kind);
    feedSig = '';
    back();
    if (matched) { TG.haptic('success'); setTimeout(() => R.go('match', { id: p.id }), 200); }
    else TG.haptic('light');
  }

  // ---------- Мэтч (оверлей) ----------
  R.define('match', {
    overlay: true,
    render(ov, params) {
      const p = profileById(params.id);
      const c = compat(p);
      const ice = c.shared[0] ? cardById(c.shared[0]) : null;
      ov.innerHTML = `<div class="match">${confettiHTML()}
        <div class="qnum">Совпадение ${c.pct}% по юмору</div>
        <h1 class="grad-text">Ха-ха, это мэтч!</h1>
        <div class="pair"><div class="ava xl" style="background-image:url('${myPhoto()}')"></div><div class="heart">🤣</div><div class="ava xl" style="background-image:url('${PHOTO(p.photos[0])}')"></div></div>
        <p class="muted">Ты и ${esc(p.name)} понравились друг другу</p>
        ${ice ? `<div class="panel soft ice"><div class="tiny muted" style="text-transform:uppercase;letter-spacing:.06em">Вы оба ржали над</div><div style="padding-top:4px">«${esc(cardShort(ice))}»</div></div>` : ''}
        <div class="cta">
          <button class="btn primary block" data-act="chat">Написать</button>
          ${ice ? `<button class="btn soft block" data-act="meme">Отправить этот мем 😂</button>` : ''}
          <button class="btn ghost block" data-act="weekender">📅 Позвать на выходные</button>
          <button class="btn sm" data-act="later" style="background:transparent;color:var(--muted)">Позже</button>
        </div></div>`;
      delegate(ov, {
        chat() { R.go('chat', { id: p.id }); },
        meme() { sendMessage(p.id, { kind: 'meme', ref: ice.id, text: '😂' }); R.go('chat', { id: p.id }); },
        weekender() { R.go('weekender', { id: p.id }); },
        later() { back(); }
      });
    }
  });

  // ---------- Weekender (шит) ----------
  R.define('weekender', {
    overlay: true,
    render(ov, params) {
      const p = profileById(params.id);
      let sel = D.WEEKENDER_PLANS[0].id;
      const draw = () => {
        ov.innerHTML = `<div class="dim" data-act="close"></div><div class="sheet"><div class="grab"></div>
          <div class="row"><span style="font-size:28px">📅</span><div><h2>Weekender подобрал субботу</h2><p class="small muted">Планы для двоих рядом с вами. Выбери план, приглашение улетит в ваш чат</p></div></div>
          <div class="stack" style="gap:8px">${D.WEEKENDER_PLANS.map((w) => `<button type="button" class="plan ${w.id === sel ? 'on' : ''}" data-act="pick" data-id="${w.id}"><span class="em">${w.emoji}</span><div class="grow"><b>${esc(w.title)}</b><span>${esc(w.place)} · ${esc(w.time)}</span><span>${esc(w.price)} · ${esc(w.note)}</span></div>${w.id === sel ? '<span class="badge grad">✓</span>' : ''}</button>`).join('')}</div>
          <button class="btn primary block" data-act="send">Отправить приглашение</button>
          <p class="tiny muted" style="text-align:center">Партнёрская интеграция с Weekender. В прототипе планы статичные.</p></div>`;
        delegate(ov, {
          close() { back(); },
          pick(t) { sel = t.dataset.id; draw(); requestAnimationFrame(() => $('.sheet', ov).classList.add('in')); },
          send() {
            const w = D.WEEKENDER_PLANS.find((x) => x.id === sel);
            sendMessage(p.id, { kind: 'date', ref: w.id, text: w.title }, 'date');
            TG.haptic('success');
            R.go('chat', { id: p.id });
            toast('Приглашение отправлено');
          }
        });
      };
      draw();
    }
  });

  // ---------- Премиум и оплата (шиты) ----------
  R.define('premium', {
    overlay: true,
    render(ov) {
      const pr = D.PREMIUM;
      ov.innerHTML = `<div class="dim" data-act="close"></div><div class="sheet">
        <div class="grab"></div><h2 class="grad-text">${esc(pr.title)}</h2>
        <div class="list">${pr.perks.map((x, i) => `<div class="perk"><span class="em">${['♾️', '👀', '🎯', '🚀', '↩️'][i] || '✨'}</span><span>${esc(x)}</span></div>`).join('')}</div>
        <div class="starsheet"><div class="price">${esc(pr.price)}</div><p class="small muted">Оплата через Telegram Stars. Отменить можно в любой момент.</p></div>
        ${S.premium ? '<button class="btn soft block" disabled>Премиум уже активен</button>' : '<button class="btn primary block" data-act="pay">Оформить за 299 ⭐</button>'}
        <button class="btn ghost block" data-act="close">Не сейчас</button></div>`;
      delegate(ov, { close() { back(); }, pay() { R.go('stars'); } });
    }
  });
  R.define('stars', {
    overlay: true,
    render(ov) {
      ov.innerHTML = `<div class="dim" data-act="close"></div><div class="sheet starsheet">
        <div class="grab"></div><div style="font-size:44px">⭐</div><h2>Telegram Stars</h2>
        <div class="panel" style="text-align:left"><div class="row" style="justify-content:space-between"><span>Хаха Премиум, 1 месяц</span><b>299 ⭐</b></div><div class="row small muted" style="justify-content:space-between;padding-top:6px"><span>Баланс</span><span>1 250 ⭐</span></div></div>
        <button class="btn primary block" data-act="confirm">Подтвердить и оплатить</button>
        <button class="btn ghost block" data-act="close">Отмена</button>
        <p class="tiny muted">Имитация платёжного окна Telegram. В настоящем приложении здесь openInvoice с валютой XTR.</p></div>`;
      delegate(ov, {
        close() { back(); },
        confirm() { S.premium = true; save(); TG.haptic('success'); back(); setTimeout(() => { back(); toast('Премиум активен. Лайки теперь видны 👀'); if (current() && current().name === 'likes') R.reset('likes'); }, 250); }
      });
    }
  });

  // ---------- Лайки ----------
  R.define('likes', {
    tab: true,
    render(el) {
      el.className = 'screen tabroot';
      const likes = likesYouProfiles(), laughed = laughedProfiles();
      el.innerHTML = `
        <div class="topbar"><div class="spacer"></div><div class="ttl">Лайки</div><div class="spacer"></div></div>
        <div class="scroll">
          <div class="section"><h3>Кто лайкнул тебя <span class="badge grad">${likes.length}</span></h3>${S.premium ? '' : '<p class="small muted">С Премиумом видно, кто именно. Пока только силуэты.</p>'}</div>
          <div class="likegrid" style="padding-top:10px">${likes.map((p) => { const c = compat(p); return `<button type="button" class="${S.premium ? '' : 'blur'}" data-act="${S.premium ? 'person' : 'premium'}" data-id="${p.id}"><div class="ph" style="background-image:url('${PHOTO(p.photos[0])}')"></div>${S.premium ? `<span class="hb">${hbadge(c.pct)}</span><div class="cap">${esc(p.name)}, ${p.age}</div>` : '<div class="lock">🔒</div>'}</button>`; }).join('') || '<p class="muted small" style="grid-column:1/-1;text-align:center">Пока никто. Свайпай активнее.</p>'}</div>
          <div class="section"><h3>Кто ржал над твоей шуткой <span class="badge">${laughed.length}</span></h3><p class="small muted">«${esc(S.me.joke || '...')}»</p>
            <div class="list">${laughed.map((p) => { const c = compat(p); return `<button type="button" class="item" data-act="person" data-id="${p.id}"><div class="ava" style="background-image:url('${PHOTO(p.photos[0])}')"></div><div class="grow"><div><b>${esc(p.name)}</b>, ${p.age}</div><div class="small muted">🤣 ржёт над твоей шуткой · ${c.pct}% по юмору</div></div><span class="faint">›</span></button>`; }).join('')}</div></div>
          <div style="height:16px"></div></div>`;
      delegate(el, { person(t) { R.go('person', { id: t.dataset.id }); }, premium() { R.go('premium'); } });
    }
  });

  // ---------- Чаты ----------
  const timers = [];
  function sendMessage(id, msg, replyKind) {
    if (!S.chats[id]) S.chats[id] = { msgs: [], replyIdx: 0, readAt: Date.now() };
    S.chats[id].msgs.push(Object.assign({ from: 'me', ts: Date.now() }, msg));
    save();
    scheduleReply(id, replyKind || (msg.kind === 'meme' ? 'meme' : 'text'));
    if (current() && current().name === 'chat' && current().params.id === id) renderMessages(id);
  }
  function pickReply(id, kind, idx) {
    const p = profileById(id);
    if (kind === 'date') return { kind: 'text', text: D.POOL.date[idx % D.POOL.date.length] };
    const scripted = D.REPLIES[id];
    if (scripted && idx < scripted.length) return { kind: 'text', text: scripted[idx] };
    if (kind === 'meme') {
      const shared = compat(p).shared;
      const pick = D.POOL.meme[(idx + E.fnv1a(id)) % D.POOL.meme.length];
      const ref = shared.length ? shared[(idx + 1) % shared.length] : null;
      return ref ? { kind: 'meme', ref, text: pick.text } : { kind: 'text', text: pick.text };
    }
    return { kind: 'text', text: D.POOL.text[(idx + E.fnv1a(id)) % D.POOL.text.length] };
  }
  function scheduleReply(id, kind) {
    const chat = S.chats[id];
    chat.pending = (chat.pending || 0) + 1;
    const reply = pickReply(id, kind, chat.replyIdx + chat.pending - 1);
    const delay = Math.min(2000, 800 + 40 * (reply.text || '').length);
    chat.typing = true;
    if (current() && current().name === 'chat' && current().params.id === id) renderMessages(id);
    const t = setTimeout(() => {
      chat.pending = Math.max(0, (chat.pending || 0) - 1);
      chat.typing = chat.pending > 0;
      chat.msgs.push(Object.assign({ from: 'them', ts: Date.now() }, reply));
      chat.replyIdx++;
      const open = current() && current().name === 'chat' && current().params.id === id;
      if (open) { chat.readAt = Date.now(); renderMessages(id); TG.haptic('selection'); }
      else { toast('💬 ' + profileById(id).name + ': ' + (reply.text || '😂')); updateBadges(); if (current() && current().name === 'chats') R.reset('chats'); }
      save();
    }, delay);
    timers.push(t);
  }
  R.define('chats', {
    tab: true,
    render(el) {
      el.className = 'screen tabroot';
      const ms = S.matches.slice().sort((a, b) => lastTs(b.id) - lastTs(a.id));
      const fresh = ms.filter((m) => !(S.chats[m.id] && S.chats[m.id].msgs.some((x) => x.from === 'me')));
      el.innerHTML = `
        <div class="topbar"><div class="spacer"></div><div class="ttl">Чаты</div><div class="spacer"></div></div>
        <div class="scroll">
          ${fresh.length ? `<div class="section" style="padding-bottom:0"><h3>Новые мэтчи <span class="badge grad">${fresh.length}</span></h3></div><div class="mrow">${fresh.map((m) => { const p = profileById(m.id); return `<button type="button" data-act="open" data-id="${p.id}"><div class="ava lg ring" style="width:64px;height:64px;background-image:url('${PHOTO(p.photos[0])}')"></div><span>${esc(p.name)}</span></button>`; }).join('')}</div>` : ''}
          <div class="section" style="padding-bottom:4px"><h3>Сообщения</h3></div>
          <div class="list chatlist">${ms.map((m) => { const p = profileById(m.id), chat = S.chats[m.id] || { msgs: [] }, last = chat.msgs[chat.msgs.length - 1], un = unreadCount(m.id), c = compat(m.id ? p : p); return `<button type="button" class="item" data-act="open" data-id="${p.id}"><div class="ava" style="background-image:url('${PHOTO(p.photos[0])}')"></div><div class="grow"><div class="name"><span>${esc(p.name)} <span class="tiny" style="color:var(--amber)">🤣 ${c.pct}%</span></span><span>${last ? fmtTime(last.ts) : ''}</span></div><div class="last ${un ? 'unread' : ''}">${last ? (last.from === 'me' ? 'Ты: ' : '') + esc(msgPreview(last)) : 'Это мэтч! Напиши первым'}</div></div>${un ? `<span class="dot">${un}</span>` : ''}</button>`; }).join('') || '<p class="muted small" style="text-align:center;padding:24px">Мэтчей пока нет. Иди свайпать 😉</p>'}</div>
        </div>`;
      delegate(el, { open(t) { R.go('chat', { id: t.dataset.id }); } });
    }
  });
  function lastTs(id) { const c = S.chats[id]; return c && c.msgs.length ? c.msgs[c.msgs.length - 1].ts : (S.matches.find((m) => m.id === id) || {}).ts || 0; }
  function msgPreview(m) { if (m.kind === 'meme') return '😂 мем'; if (m.kind === 'date') return '📅 ' + m.text; return m.text; }
  R.define('chat', {
    render(el, params) {
      el.className = 'screen';
      const p = profileById(params.id);
      const c = compat(p);
      if (!S.chats[p.id]) S.chats[p.id] = { msgs: [], replyIdx: 0, readAt: Date.now() };
      S.chats[p.id].readAt = Date.now(); save();
      const stickers = c.shared.slice(0, 6);
      const hasDate = S.chats[p.id].msgs.some((m) => m.kind === 'date');
      el.innerHTML = `
        <div class="topbar"><button class="iconbtn" data-act="back" aria-label="Назад">←</button><button type="button" class="row grow" data-act="person" style="background:transparent;border:0;color:inherit;text-align:left;padding:0"><div class="ava" style="width:40px;height:40px;background-image:url('${PHOTO(p.photos[0])}')"></div><div><div style="font-weight:800">${esc(p.name)}</div><div class="tiny" style="color:var(--amber)">🤣 ${c.pct}% по юмору · ${c.shared.length} общих ржак</div></div></button><button class="iconbtn" data-act="more">⋯</button></div>
        <div class="chat"><div class="msgs" id="msgs"></div>
          ${hasDate ? '' : `<div class="datecard"><button type="button" class="plan" data-act="weekender"><span class="em">📅</span><div class="grow"><b>Предложить свидание</b><span>Weekender подберёт план на субботу</span></div><span class="badge grad">›</span></button></div>`}
          ${stickers.length ? `<div class="stickers">${stickers.map((id) => `<button type="button" data-act="sticker" data-id="${id}">😂 ${esc(cardById(id).topic)}</button>`).join('')}</div>` : ''}
          <div class="composer"><input class="input grow" id="chat-input" placeholder="Напиши что-нибудь смешное" autocomplete="off" enterkeyhint="send"><button class="send" data-act="send" aria-label="Отправить">➤</button></div>
        </div>`;
      const input = $('#chat-input', el);
      const send = () => { const v = input.value.trim(); if (!v) return; input.value = ''; sendMessage(p.id, { kind: 'text', text: v }); TG.haptic('light'); };
      input.addEventListener('keydown', (e) => { if (e.key === 'Enter') { e.preventDefault(); send(); } });
      input.addEventListener('focus', () => setTimeout(() => { const m = $('#msgs', el); if (m) m.scrollTop = m.scrollHeight; }, 300));
      delegate(el, {
        back() { back(); },
        person() { R.go('person', { id: p.id }); },
        more() { toast('Отменить мэтч, пожаловаться, заблокировать'); },
        weekender() { R.go('weekender', { id: p.id }); },
        sticker(t) { sendMessage(p.id, { kind: 'meme', ref: t.dataset.id, text: '😂' }); },
        send() { send(); }
      });
      renderMessages(p.id);
    }
  });
  function renderMessages(id) {
    const box = $('#msgs'); if (!box) return;
    const chat = S.chats[id], p = profileById(id);
    box.innerHTML = chat.msgs.map((m) => {
      if (m.kind === 'meme') { const c = cardById(m.ref); return `<div class="bubble meme ${m.from === 'me' ? 'me' : ''}"><div>😂 ${esc(m.text || '')}</div><div class="mm">${c ? esc(cardShort(c)) : ''}</div><span class="t">${fmtTime(m.ts)}</span></div>`; }
      if (m.kind === 'date') { const w = D.WEEKENDER_PLANS.find((x) => x.id === m.ref) || {}; return `<div class="bubble date ${m.from === 'me' ? 'me' : ''}"><b>📅 Приглашение на субботу</b>${w.emoji || ''} ${esc(w.title || m.text)}<br><span class="small">${esc(w.place || '')} · ${esc(w.time || '')}</span><span class="t">${fmtTime(m.ts)}</span></div>`; }
      return `<div class="bubble ${m.from === 'me' ? 'me' : ''}">${esc(m.text)}<span class="t">${fmtTime(m.ts)}</span></div>`;
    }).join('') + (chat.typing ? `<div class="bubble typing" aria-label="${esc(p.name)} печатает"><i></i><i></i><i></i></div>` : '');
    box.scrollTop = box.scrollHeight;
    if (!chat.msgs.length) box.innerHTML = `<div class="center muted small" style="padding:24px"><div style="font-size:40px">🤝</div><p>Это мэтч с ${esc(p.name)}. Начни с мема из общих ржак или просто напиши.</p></div>`;
  }

  // ---------- Шутка дня ----------
  R.define('jotd', {
    render(el) {
      el.className = 'screen';
      const draw = () => {
        const caps = D.JOTD.captions.map((c) => ({ ...c, votes: c.votes + (S.jotd.votes[c.id] ? 1 : 0) }));
        if (S.jotd.myCaption) caps.push({ id: 'mine', text: S.jotd.myCaption, author: S.me.name || 'ты', votes: 1, mine: true });
        caps.sort((a, b) => b.votes - a.votes);
        el.innerHTML = `
          <div class="topbar"><button class="iconbtn" data-act="back">←</button><div class="ttl">Шутка дня</div><div class="spacer"></div></div>
          <div class="scroll stack" style="gap:14px;padding-bottom:24px">
            <div class="jotd-meme bg${D.JOTD.meme.bg}"><div class="cap" style="font-size:20px;font-weight:900;text-transform:uppercase;text-shadow:0 2px 0 #000">${esc(D.JOTD.meme.top)}</div><div class="scene" style="font-size:80px">${D.JOTD.meme.scene}</div><div class="tiny" style="color:rgba(255,255,255,.7)">Подпиши мем. Лучшие подписи видят все</div></div>
            <div class="rank"><span style="font-size:26px">🏆</span><div class="grow"><b>Твой рейтинг юмора: ${esc(D.JOTD.myRank)}</b><div class="small muted">Голоса за твои подписи поднимают тебя в ленте</div></div></div>
            ${S.jotd.myCaption ? '' : `<div class="pad row"><input class="input grow" id="cap-input" maxlength="60" placeholder="Твоя подпись"><button class="btn primary" data-act="cap">Отправить</button></div>`}
            <div class="caps">${caps.map((c) => `<div class="capitem ${c.mine ? 'mine' : ''}"><div class="grow"><div>${esc(c.text)}</div><div class="who">${esc(c.author)}${c.mine ? ' (ты)' : ''}</div></div><button type="button" class="vote ${S.jotd.votes[c.id] ? 'on' : ''}" data-act="vote" data-id="${c.id}" ${c.mine ? 'disabled' : ''}>😂 ${c.votes}</button></div>`).join('')}</div>
          </div>`;
        delegate(el, {
          back() { back(); },
          cap() { const v = $('#cap-input', el).value.trim(); if (v.length < 3) return toast('Слишком коротко'); S.jotd.myCaption = v; save(); TG.haptic('success'); toast('Подпись в игре. Голоса начислятся к вечеру'); draw(); },
          vote(t) { const id = t.dataset.id; S.jotd.votes[id] = S.jotd.votes[id] ? 0 : 1; save(); TG.haptic('selection'); const st = $('.scroll', el).scrollTop; draw(); $('.scroll', el).scrollTop = st; }
        });
      };
      draw();
    }
  });

  // ---------- Профиль ----------
  R.define('me', {
    tab: true,
    render(el) {
      el.className = 'screen tabroot';
      const vec = E.vectorFromReactions(S.humor.reactions);
      const done = Object.keys(S.humor.reactions).length >= D.CARDS.length;
      el.innerHTML = `
        <div class="topbar"><div class="spacer"></div><div class="ttl">Профиль</div><button class="iconbtn" data-act="edit" aria-label="Редактировать">✎</button></div>
        <div class="scroll">
          <div class="mehead"><div class="ava xl" style="background-image:url('${myPhoto()}')"></div><h2>${esc(S.me.name || 'Без имени')}${S.me.age ? ', ' + S.me.age : ''}</h2><div class="muted small">📍 ${esc(S.me.city)} ${S.premium ? '· <span class="badge grad">Премиум</span>' : ''}</div>${done ? hbadge('', '') .replace('%', '').replace('<span class="n"></span>', `<span class="n">${esc(E.title(vec.vhat))}</span>`).replace('по юмору', '') : ''}</div>
          <div class="section"><h3>Мой юмор-профиль</h3><div class="panel">${done ? `<div class="radarwrap">${E.radarSVG([vec], { size: 220 })}</div>${axisBarsHTML(vec)}<p class="small muted" style="padding-top:8px">Стиль: ${esc(styleSummary(S.humor.answers).toLowerCase())}. Коронная шутка: «${esc(S.me.joke)}»</p>` : '<p class="muted">Тест ещё не пройден</p>'}<button class="btn ghost block sm" data-act="retake" style="margin-top:10px">Пройти тест заново</button></div></div>
          <div class="section settings"><div class="list">
            <button type="button" class="item" data-act="filters"><span class="em">🎯</span><span class="grow">Фильтры поиска</span><span class="small muted">${S.filters.ageMin}-${S.filters.ageMax} · ${S.filters.distKm} км</span><span class="chev">›</span></button>
            <button type="button" class="item" data-act="premium"><span class="em">⭐</span><span class="grow">Хаха Премиум</span><span class="badge grad">${S.premium ? 'активен' : '299 ⭐'}</span><span class="chev">›</span></button>
            <button type="button" class="item" data-act="invite"><span class="em">🎟</span><span class="grow">Пригласить друга</span><span class="chev">›</span></button>
            <button type="button" class="item" data-act="safety"><span class="em">🛡</span><span class="grow">Безопасность и верификация</span><span class="badge ok">✔︎</span><span class="chev">›</span></button>
            <button type="button" class="item" data-act="reset"><span class="em">🧹</span><span class="grow" style="color:var(--danger)">Сбросить демо</span><span class="chev">›</span></button>
          </div></div>
          <div class="version">${esc(D.APP.name)} v${esc(VERSION)} · прототип · ${TG.available ? 'Telegram ' + esc(TG.platform) + ' ' + esc(TG.version) : 'браузер'}</div>
        </div>`;
      delegate(el, {
        edit() { S.me.step = 0; R.go('onboarding'); },
        retake() { S.humor.reactions = {}; S.humor.answers = []; S.humor.doneAt = 0; save(); R.go('quiz'); },
        filters() { R.go('filters'); },
        premium() { R.go('premium'); },
        invite() { const url = 'https://t.me/share/url?url=' + encodeURIComponent('https://t.me/haha_dating_bot/app?startapp=' + encodeURIComponent(S.me.name || 'friend')) + '&text=' + encodeURIComponent('Заходи в Хаха: знакомства по приколу'); if (TG.available) TG.openLink(url); else toast('Ссылка-приглашение скопирована (имитация)'); },
        safety() { toast('Фото проверено селфи-верификацией. Жалобы разбирает модерация 24/7.'); },
        reset() { if (confirm('Сбросить всё демо и начать с чистого экрана?')) H.demo.reset(); }
      });
    }
  });

  // ---------- Фильтры ----------
  R.define('filters', {
    render(el) {
      el.className = 'screen';
      const f = S.filters;
      const draw = () => {
        el.innerHTML = `
          <div class="topbar"><button class="iconbtn" data-act="back">←</button><div class="ttl">Фильтры</div><div class="spacer"></div></div>
          <div class="scroll pad filters stack">
            <div class="field"><div class="label">Показывать</div><div class="seg" id="f-seek"><button type="button" data-v="f" class="${seeking() === 'f' ? 'on' : ''}">Девушек</button><button type="button" data-v="m" class="${seeking() === 'm' ? 'on' : ''}">Парней</button><button type="button" data-v="any" class="${seeking() === 'any' ? 'on' : ''}">Всех</button></div></div>
            <div class="field"><div class="label">Возраст: <span class="rangeval">${f.ageMin}-${f.ageMax}</span></div><input type="range" class="slider" id="f-min" min="18" max="45" value="${f.ageMin}"><input type="range" class="slider" id="f-max" min="18" max="45" value="${f.ageMax}"></div>
            <div class="field"><div class="label">Расстояние: <span class="rangeval">${f.distKm} км</span></div><input type="range" class="slider" id="f-dist" min="1" max="50" value="${f.distKm}"></div>
            <div class="field"><div class="label">Юмор-совместимость не ниже: <span class="rangeval">${f.minHumor ? f.minHumor + '%' : 'любая'}</span> ${S.premium ? '' : '<span class="badge">⭐ Премиум</span>'}</div><input type="range" class="slider" id="f-humor" min="0" max="95" step="5" value="${f.minHumor}" ${S.premium ? '' : 'disabled'}></div>
            <p class="small muted">Подходит анкет: <b>${deckProfiles().length}</b></p>
            <button class="btn primary block" data-act="apply">Показать анкеты</button></div>`;
        $$('#f-seek button', el).forEach((b) => b.addEventListener('click', () => { S.me.seeking = b.dataset.v; save(); draw(); }));
        const bind = (id, key, fix) => { const inp = $('#' + id, el); inp.addEventListener('input', () => { f[key] = +inp.value; if (fix) fix(); $$('.rangeval', el); save(); }); inp.addEventListener('change', () => draw()); };
        bind('f-min', 'ageMin', () => { if (f.ageMin > f.ageMax) f.ageMax = f.ageMin; });
        bind('f-max', 'ageMax', () => { if (f.ageMax < f.ageMin) f.ageMin = f.ageMax; });
        bind('f-dist', 'distKm'); bind('f-humor', 'minHumor');
        delegate(el, { back() { back(); }, apply() { feedSig = ''; S.demo.seeded = S.demo.seeded && true; ensureSeededFor(); R.reset('feed'); } });
      };
      draw();
    }
  });
  function ensureSeededFor() { /* при смене «кого показывать» добавляем стартовые чаты нового пола */
    const have = matchedIds();
    D.PROFILES.filter((p) => p.seeded && fitsGender(p) && !have.has(p.id)).forEach((p, k) => {
      const base = Date.now() - 20 * 3600e3;
      S.matches.push({ id: p.id, ts: base + k * 60e3, via: 'seed', icebreaker: null });
      S.chats[p.id] = { msgs: (D.SEED_CHATS[p.id] || []).map((m, i) => ({ from: m.from, kind: 'text', text: m.text, ts: base + i * 90e3 })), replyIdx: 0, readAt: Date.now() };
    });
    save();
  }

  // ---------- Демо ----------
  H.demo = {
    fill() {
      const cp = D.CANON_PERSONA;
      S = fresh();
      Object.assign(S.me, cp.me, { step: 0 });
      S.humor = { reactions: Object.assign({}, cp.reactions), answers: cp.answers.slice(), doneAt: Date.now() };
      S.gate = 'app';
      ensureSeeded();
      flush();
      feedSig = '';
      toast('Демо-персона загружена: ' + S.me.name);
      TG.haptic('success');
      R.reset('feed');
    },
    reset() {
      resetting = true;
      timers.forEach(clearTimeout);
      clearTimeout(saveTimer);
      S = fresh();
      try { localStorage.removeItem(KEY); } catch (e) { /* игнорируем */ }
      const u = new URL(location.href); u.search = ''; u.hash = '';
      location.replace(u.toString());
    },
    state() { return S; }
  };

  // ---------- Старт ----------
  function boot() {
    const q = new URLSearchParams(location.search);
    const wantReset = q.get('reset') === '1' || location.hash === '#reset' || TG.startParam === 'reset';
    if (wantReset) { try { localStorage.removeItem(KEY); } catch (e) { /* игнорируем */ } S = fresh(); if (location.search || location.hash) { const u = new URL(location.href); u.search = ''; u.hash = ''; history.replaceState(null, '', u.toString()); } }
    if (TG.startParam && TG.startParam !== 'reset' && !S.me.invitedBy) { S.me.invitedBy = TG.startParam.slice(0, 24); save(); }
    if (TG.user && !S.me.tg) { S.me.tg = TG.user; save(); }
    const g = S.gate;
    if (g === 'app') { ensureSeeded(); R.reset('feed'); }
    else if (g === 'result') R.reset('result');
    else if (g === 'style') R.reset('style');
    else if (g === 'quiz') R.reset('quiz');
    else if (g === 'onboarding') R.reset('onboarding');
    else R.reset('splash');
  }
  H.app = { R, state: () => S, save, toast, version: VERSION };
  if (TG.ready) boot(); else document.addEventListener('haha:tgready', boot, { once: true });
  TG.init();
})();
