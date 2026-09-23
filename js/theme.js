// Темы оформления «Хаха»: реестр, применение и запоминание выбора.
// Грузится в <head> до первой отрисовки, поэтому экран не мигает чужой темой.
// Приоритет: ?theme= в адресе > сохранённый выбор > «Ночь». При ?embed=1 выбор не сохраняется.
// На странице дизайн-системы <html data-theme-auto="off">: там темы живут на вложенных блоках.
(function () {
  'use strict';
  const H = (globalThis.Haha = globalThis.Haha || {});
  const KEY = 'haha.theme';
  const THEMES = [
    { id: 'night', name: 'Ночь', tagline: 'тёмный премиум, неон заката', audience: '20-35, кто ценит «дорого» и вечерние свидания', scheme: 'dark', bg: '#09090C', swatch: ['#FF5E3A', '#FFC24A', '#131318'] },
    { id: 'meme', name: 'Мем', tagline: 'необрутализм, чистый прикол', audience: '18-25, мемы, TikTok, «по приколу» в лоб', scheme: 'light', bg: '#FFF8E1', swatch: ['#FF4FA3', '#FFD23F', '#3355FF'] },
    { id: 'journal', name: 'Журнал', tagline: 'бумага, засечки, умная ирония', audience: '25-38, стендап, книги, тонкий юмор', scheme: 'light', bg: '#F2EBDD', swatch: ['#BF3F2A', '#C98B2B', '#1E1A16'] },
    { id: 'sticker', name: 'Стикер', tagline: 'мягкий пастельный, как стикерпак', audience: 'широкая аудитория, дружелюбно, Telegram-стиль', scheme: 'light', bg: '#F6F1FF', swatch: ['#7B5CFF', '#FF6FB5', '#2FD39A'] }
  ];
  const byId = {};
  THEMES.forEach((t) => { byId[t.id] = t; });
  const root = document.documentElement;
  const q = new URLSearchParams(location.search);
  const embed = q.get('embed') === '1';
  if (embed) root.classList.add('embed');

  function stored() { try { return localStorage.getItem(KEY); } catch (e) { return null; } }
  function current() { return byId[root.getAttribute('data-theme')] ? root.getAttribute('data-theme') : 'night'; }
  function apply(id, opts) {
    const t = byId[id] || byId.night;
    root.setAttribute('data-theme', t.id);
    root.style.colorScheme = t.scheme;
    const meta = document.querySelector('meta[name="theme-color"]');
    if (meta) meta.setAttribute('content', t.bg);
    if (opts && opts.persist && !embed) { try { localStorage.setItem(KEY, t.id); } catch (e) { /* приватный режим */ } }
    if (H.tg && typeof H.tg.setColors === 'function') H.tg.setColors(t.bg);
    try { document.dispatchEvent(new CustomEvent('haha:theme', { detail: t })); } catch (e) { /* старый движок */ }
    return t;
  }

  if (root.getAttribute('data-theme-auto') !== 'off') {
    const fromUrl = q.get('theme');
    if (fromUrl && byId[fromUrl]) apply(fromUrl, { persist: true });
    else apply(stored() || 'night');
  }
  H.theme = { THEMES, byId, current, apply, embed, set: (id) => apply(id, { persist: true }) };
})();
