// Мост Telegram Mini App с фолбэком на обычный браузер. Ждёт SDK (как _tg.html в Weekender), проверяет версии Bot API,
// держит --app-h из viewportStableHeight, даёт хаптику и BackButton. Бренд тёмный всегда: themeParams не читаем.
(function () {
  'use strict';
  const H = (globalThis.Haha = globalThis.Haha || {});
  const BRAND_BG = '#0B0B0F';
  const T = {
    available: false, wa: null, platform: 'browser', version: '0', user: null, startParam: null, ready: false,
    onBack: null
  };

  function has(v) {
    try { return !!(T.wa && T.wa.isVersionAtLeast && T.wa.isVersionAtLeast(v)); } catch (e) { return false; }
  }

  function applyViewport() {
    let h = 0;
    if (T.available && T.wa && T.wa.viewportStableHeight) h = T.wa.viewportStableHeight;
    else if (window.visualViewport && window.visualViewport.height) h = window.visualViewport.height;
    else h = window.innerHeight;
    if (h > 0) document.documentElement.style.setProperty('--app-h', Math.round(h) + 'px');
  }

  function setup(wa) {
    T.wa = wa;
    T.platform = wa.platform || 'unknown';
    T.version = wa.version || '0';
    T.available = !!(wa.initData || (wa.platform && wa.platform !== 'unknown'));
    if (!T.available) { T.platform = 'browser'; finish(); return; }
    try { wa.ready(); } catch (e) { /* игнорируем */ }
    try { wa.expand(); } catch (e) { /* игнорируем */ }
    if (has('6.9')) { try { wa.setHeaderColor(BRAND_BG); wa.setBackgroundColor(BRAND_BG); } catch (e) { /* старый клиент */ } }
    if (has('7.10')) { try { wa.setBottomBarColor(BRAND_BG); } catch (e) { /* игнорируем */ } }
    if (has('7.7')) { try { wa.disableVerticalSwipes(); } catch (e) { /* игнорируем */ } }
    else document.documentElement.classList.add('no-vswipe');
    if (has('6.1')) {
      try { wa.BackButton.onClick(function () { if (typeof T.onBack === 'function') T.onBack(); }); } catch (e) { /* игнорируем */ }
    }
    try { wa.onEvent('viewportChanged', applyViewport); } catch (e) { /* игнорируем */ }
    const u = wa.initDataUnsafe && wa.initDataUnsafe.user;
    if (u) T.user = { id: u.id, name: [u.first_name, u.last_name].filter(Boolean).join(' '), photo: u.photo_url || null };
    T.startParam = (wa.initDataUnsafe && wa.initDataUnsafe.start_param) || null;
    finish();
  }

  function finish() {
    T.ready = true;
    applyViewport();
    if (window.visualViewport) window.visualViewport.addEventListener('resize', applyViewport);
    window.addEventListener('resize', applyViewport);
    document.dispatchEvent(new CustomEvent('haha:tgready'));
  }

  // SDK с CDN может прийти позже нашего скрипта: ждём до ~6 с, потом работаем как обычная страница.
  function init() {
    let tries = 0;
    (function poll() {
      const wa = window.Telegram && window.Telegram.WebApp;
      if (wa) return setup(wa);
      if (++tries > 40) { T.available = false; return finish(); }
      setTimeout(poll, 150);
    })();
  }

  function haptic(kind) {
    if (!T.available || !has('6.1')) return;
    try {
      const hf = T.wa.HapticFeedback;
      if (kind === 'success' || kind === 'warning' || kind === 'error') hf.notificationOccurred(kind);
      else if (kind === 'selection') hf.selectionChanged();
      else hf.impactOccurred(kind || 'light');
    } catch (e) { /* игнорируем */ }
  }

  function setBack(visible) {
    if (!T.available || !has('6.1')) return;
    try { visible ? T.wa.BackButton.show() : T.wa.BackButton.hide(); } catch (e) { /* игнорируем */ }
  }

  function openLink(url) {
    if (T.available && T.wa.openTelegramLink && /^https:\/\/t\.me\//.test(url)) { try { T.wa.openTelegramLink(url); return; } catch (e) { /* ниже */ } }
    if (T.available && T.wa.openLink) { try { T.wa.openLink(url); return; } catch (e) { /* ниже */ } }
    window.open(url, '_blank');
  }

  function alert(msg) {
    if (T.available && has('6.2')) { try { T.wa.showAlert(msg); return; } catch (e) { /* ниже */ } }
    window.alert(msg);
  }

  H.tg = T;
  T.init = init; T.has = has; T.haptic = haptic; T.setBack = setBack; T.applyViewport = applyViewport; T.openLink = openLink; T.alert = alert;
})();
