// Движок юмора «Хаха». Чистая логика без DOM: грузится и в браузере, и в Node (scripts/lint_data.js).
// Вектор вкуса по 6 осям, стиль по 4 шкалам HSQ-lite, совместимость, общие ржаки, титул, радар (SVG-строка),
// детерминированные реакции мок-анкет (архетипы + сидированный шум, зеркала и обратные к пользователю).
(function () {
  'use strict';
  const H = (globalThis.Haha = globalThis.Haha || {});

  const AXES = ['absurd', 'sarcasm', 'dark', 'selfirony', 'wordplay', 'observational'];
  const AXIS_LABEL = {
    absurd: 'Абсурд', sarcasm: 'Сарказм', dark: 'Чёрный', selfirony: 'Самоирония', wordplay: 'Каламбур', observational: 'Бытовой'
  };
  const AXIS_NOUN = {
    absurd: 'Абсурдист', sarcasm: 'Саркаст', dark: 'Чернушник', selfirony: 'Самоироник', wordplay: 'Каламбурист', observational: 'Наблюдатель'
  };
  const AXIS_PHRASE = {
    absurd: 'абсурд', sarcasm: 'сарказм', dark: 'чёрный юмор', selfirony: 'самоирония', wordplay: 'каламбуры', observational: 'бытовой юмор'
  };
  const STYLES = ['affiliative', 'selfEnhancing', 'aggressive', 'selfDefeating'];
  const STYLE_LABEL = {
    affiliative: 'Шучу для компании', selfEnhancing: 'Юмор как броня', aggressive: 'Подкалываю', selfDefeating: 'Шучу над собой'
  };
  // Реакция → вес: не смешно, смешно, ржу. Пропуск не учитывается.
  const RW = { '-1': -0.5, '1': 0.5, '2': 1 };
  // Константы формулы совместимости и генерации мок-реакций. Подобраны так, чтобы зеркала давали >= 95, обратные <= 55, архетипы 55..90.
  const CFG = { wCos: 0.35, wDist: 0.35, wStyle: 0.2, wLaughs: 0.1, lo: 0.24, hi: 0.98, gamma: 0.75, ampBase: 0.55, ampWild: 0.7, thrLove: 0.42, thrLike: 0.02 };

  // Архетипы мок-анкет: предпочтения по осям (-1 не заходит, 0 нейтрально, 1 заходит) и типичные ответы по стилю (1..5).
  const ARCHETYPES = {
    absurdist:  { pref: { absurd: 1, sarcasm: 0, dark: 0, selfirony: 0, wordplay: 1, observational: -1 }, style: [4, 4, 2, 3, 3] },
    sarcast:    { pref: { absurd: -1, sarcasm: 1, dark: 1, selfirony: 0, wordplay: 0, observational: 0 }, style: [3, 3, 4, 2, 2] },
    darkling:   { pref: { absurd: 0, sarcasm: 1, dark: 1, selfirony: 0, wordplay: -1, observational: 0 }, style: [3, 4, 4, 3, 2] },
    selfironic: { pref: { absurd: 0, sarcasm: -1, dark: 0, selfirony: 1, wordplay: 0, observational: 1 }, style: [4, 3, 2, 4, 4] },
    punster:    { pref: { absurd: 1, sarcasm: 0, dark: -1, selfirony: 0, wordplay: 1, observational: 0 }, style: [4, 3, 2, 3, 3] },
    observer:   { pref: { absurd: -1, sarcasm: 0, dark: 0, selfirony: 1, wordplay: 0, observational: 1 }, style: [5, 3, 1, 3, 4] }
  };

  function fnv1a(str) {
    let h = 0x811c9dc5;
    for (let i = 0; i < str.length; i++) { h ^= str.charCodeAt(i); h = Math.imul(h, 0x01000193); }
    return h >>> 0;
  }
  function mulberry32(a) {
    return function () {
      a |= 0; a = (a + 0x6D2B79F5) | 0;
      let t = Math.imul(a ^ (a >>> 15), 1 | a);
      t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
      return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
    };
  }
  const clamp = (x, a, b) => Math.min(b, Math.max(a, x));
  const cards = () => (H.data && H.data.CARDS) || [];
  const questions = () => (H.data && H.data.STYLE_QUESTIONS) || [];

  // Вектор вкуса. v[k] в [-0.5, 1] по отвеченным карточкам; v̂ центрирован (снимает «смеётся над всем»); disp в [0,1] для радара.
  function vectorFromReactions(reactions) {
    reactions = reactions || {};
    const num = {}, den = {};
    AXES.forEach((k) => { num[k] = 0; den[k] = 0; });
    let answered = 0;
    for (const c of cards()) {
      const r = RW[String(reactions[c.id])];
      if (r === undefined) continue;
      answered++;
      for (const k of AXES) { const w = c.w[k] || 0; num[k] += r * w; den[k] += w; }
    }
    const v = {};
    AXES.forEach((k) => { v[k] = den[k] > 0 ? num[k] / den[k] : 0; });
    const mean = AXES.reduce((s, k) => s + v[k], 0) / AXES.length;
    const vhat = {}, disp = {};
    AXES.forEach((k) => { vhat[k] = v[k] - mean; disp[k] = clamp((v[k] + 0.5) / 1.5, 0, 1); });
    return { v, vhat, disp, answered };
  }

  // Стиль: 4 шкалы в [0,1]. Неотвеченная шкала = 0.5.
  function styleFromAnswers(answers) {
    answers = answers || [];
    const acc = {};
    STYLES.forEach((s) => { acc[s] = []; });
    questions().forEach((q, i) => {
      const a = answers[i];
      if (!(a >= 1 && a <= 5)) return;
      const val = q.reverse ? 6 - a : a;
      acc[q.scale].push((val - 1) / 4);
    });
    const s = {};
    STYLES.forEach((k) => { s[k] = acc[k].length ? acc[k].reduce((x, y) => x + y, 0) / acc[k].length : 0.5; });
    return s;
  }

  function cosine(a, b) {
    let dot = 0, na = 0, nb = 0;
    for (const k of AXES) { dot += a[k] * b[k]; na += a[k] * a[k]; nb += b[k] * b[k]; }
    if (na < 1e-9 || nb < 1e-9) return 0;
    return dot / Math.sqrt(na * nb);
  }

  // Общие ржаки: карточки, над которыми смеялись оба. Сначала «оба ржу», потом «один ржу», потом «оба смешно».
  function sharedLaughs(a, b) {
    const out = [];
    for (const c of cards()) {
      const ra = a.reactions[c.id], rb = b.reactions[c.id];
      if (ra >= 1 && rb >= 1) out.push({ id: c.id, score: (ra === 2 ? 1 : 0) + (rb === 2 ? 1 : 0) });
    }
    out.sort((x, y) => y.score - x.score);
    return out.map((x) => x.id);
  }

  // Совместимость двух людей {reactions, answers}. pct в 45..99, стабилен между перезагрузками.
  function compatibility(a, b) {
    const va = vectorFromReactions(a.reactions), vb = vectorFromReactions(b.reactions);
    const cos = cosine(va.vhat, vb.vhat);
    const sa = styleFromAnswers(a.answers), sb = styleFromAnswers(b.answers);
    const style = 1 - STYLES.reduce((s, k) => s + Math.abs(sa[k] - sb[k]), 0) / STYLES.length;
    let inter = 0, union = 0;
    for (const c of cards()) {
      const la = a.reactions[c.id] >= 1, lb = b.reactions[c.id] >= 1;
      if (la && lb) inter++;
      if (la || lb) union++;
    }
    const laughs = union ? inter / union : 0;
    const dist = 1 - AXES.reduce((s, k) => s + Math.abs(va.disp[k] - vb.disp[k]), 0) / AXES.length;
    const r = CFG.wCos * (cos + 1) / 2 + CFG.wDist * dist + CFG.wStyle * style + CFG.wLaughs * laughs;
    const x = clamp((r - CFG.lo) / (CFG.hi - CFG.lo), 0, 1);
    const pct = 45 + Math.round(54 * Math.pow(x, CFG.gamma));
    return { pct, r, cos, dist, style, laughs, shared: sharedLaughs(a, b) };
  }

  // Титул по двум сильнейшим осям.
  function title(vhat) {
    const sorted = AXES.slice().sort((x, y) => vhat[y] - vhat[x]);
    const max = Math.max(...AXES.map((k) => Math.abs(vhat[k])));
    if (max < 0.08) return 'Всеядный смехач';
    const first = AXIS_NOUN[sorted[0]];
    const second = AXIS_NOUN[sorted[1]].toLowerCase();
    return first + '-' + second;
  }
  function topAxes(vhat, n) {
    return AXES.slice().sort((x, y) => vhat[y] - vhat[x]).slice(0, n || 2);
  }

  // Радар: строка SVG, 1 или 2 вектора (disp по осям). Без DOM.
  let radarSeq = 0;
  function radarSVG(vectors, opts) {
    opts = opts || {};
    const size = opts.size || 240;
    const cx = size / 2, cy = size / 2, R = size * 0.36;
    const uid = 'rg' + (++radarSeq);
    const pt = (k, r) => {
      const ang = (-90 + 60 * AXES.indexOf(k)) * Math.PI / 180;
      return [cx + r * Math.cos(ang), cy + r * Math.sin(ang)];
    };
    const ring = (f) => AXES.map((k) => pt(k, R * f).map((n) => n.toFixed(1)).join(',')).join(' ');
    let s = `<svg class="radar" viewBox="0 0 ${size} ${size}" width="${size}" height="${size}" role="img" aria-label="Юмор-профиль">`;
    s += `<defs><linearGradient id="${uid}a" x1="0" y1="0" x2="1" y2="1"><stop offset="0" style="stop-color:var(--r-me-1)"/><stop offset="1" style="stop-color:var(--r-me-2)"/></linearGradient>`;
    s += `<linearGradient id="${uid}b" x1="0" y1="0" x2="1" y2="1"><stop offset="0" style="stop-color:var(--r-you-1)"/><stop offset="1" style="stop-color:var(--r-you-2)"/></linearGradient></defs>`;
    for (const f of [0.25, 0.5, 0.75, 1]) s += `<polygon points="${ring(f)}" fill="none" style="stroke:var(--edge-2)" stroke-width="1"/>`;
    for (const k of AXES) { const [x, y] = pt(k, R); s += `<line x1="${cx}" y1="${cy}" x2="${x.toFixed(1)}" y2="${y.toFixed(1)}" style="stroke:var(--edge)"/>`; }
    (vectors || []).forEach((vec, i) => {
      const disp = vec.disp || vec;
      const pts = AXES.map((k) => pt(k, R * (0.15 + 0.85 * clamp(disp[k] || 0, 0, 1))).map((n) => n.toFixed(1)).join(',')).join(' ');
      const g = i === 0 ? `url(#${uid}a)` : `url(#${uid}b)`;
      s += `<polygon points="${pts}" fill="${g}" fill-opacity="${i === 0 ? 0.28 : 0.22}" stroke="${g}" stroke-width="2" stroke-linejoin="round"/>`;
    });
    if (opts.labels !== false) {
      for (const k of AXES) {
        const [x, y] = pt(k, R + 22);
        s += `<text x="${x.toFixed(1)}" y="${(y + 4).toFixed(1)}" text-anchor="middle" font-size="11" style="fill:var(--muted);font-family:var(--font-label)">${AXIS_LABEL[k]}</text>`;
      }
    }
    s += '</svg>';
    return s;
  }

  // Реакции и ответы мок-анкеты. Детерминированы: id анкеты + хэш ответов пользователя. Без Math.random.
  const memo = new Map();
  function reactionsOf(profile, user) {
    user = user || {};
    const ur = user.reactions || {}, ua = user.answers || [];
    const answered = Object.keys(ur).length;
    const userHash = fnv1a(JSON.stringify(ur) + '|' + JSON.stringify(ua));
    const key = profile.id + ':' + userHash;
    if (memo.has(key)) return memo.get(key);

    const rng = mulberry32(fnv1a(profile.id + ':' + userHash));
    const arch = ARCHETYPES[profile.archetype] || ARCHETYPES.observer;
    const reactions = {}, answers = [];
    const role = answered >= 10 ? profile.role : null;

    if (role === 'mirror') {
      for (const c of cards()) if (ur[c.id] !== undefined) reactions[c.id] = ur[c.id];
      const ids = Object.keys(reactions);
      const flips = 2 + Math.floor(rng() * 2); // 2..3 переворота
      for (let i = 0; i < flips && ids.length; i++) {
        const id = ids[Math.floor(rng() * ids.length)];
        reactions[id] = reactions[id] === 2 ? 1 : reactions[id] === 1 ? 2 : 1;
      }
      ua.forEach((a, i) => { answers[i] = clamp(a + (rng() < 0.3 ? (rng() < 0.5 ? -1 : 1) : 0), 1, 5); });
    } else if (role === 'inverse') {
      for (const c of cards()) if (ur[c.id] !== undefined) reactions[c.id] = ur[c.id] === -1 ? 2 : -1;
      const ids = Object.keys(reactions);
      if (ids.length) { const id = ids[Math.floor(rng() * ids.length)]; reactions[id] = reactions[id] === -1 ? 1 : -1; }
      ua.forEach((a, i) => { answers[i] = 6 - a; });
    } else {
      const amp = profile.wild ? CFG.ampWild : CFG.ampBase;
      for (const c of cards()) {
        let t = 0;
        for (const k of AXES) t += (arch.pref[k] || 0) * (c.w[k] || 0);
        t += (rng() * 2 - 1) * amp;
        reactions[c.id] = t > CFG.thrLove ? 2 : t > CFG.thrLike ? 1 : -1;
      }
      questions().forEach((q, i) => {
        const base = arch.style[i] || 3;
        answers[i] = clamp(base + (rng() < 0.4 ? (rng() < 0.5 ? -1 : 1) : 0), 1, 5);
      });
    }
    const out = { reactions, answers };
    memo.set(key, out);
    return out;
  }

  H.humor = {
    AXES, AXIS_LABEL, AXIS_NOUN, AXIS_PHRASE, STYLES, STYLE_LABEL, ARCHETYPES, CFG, clearMemo: () => memo.clear(),
    fnv1a, mulberry32, clamp,
    vectorFromReactions, styleFromAnswers, cosine, compatibility, sharedLaughs, title, topAxes, radarSVG, reactionsOf
  };
})();
