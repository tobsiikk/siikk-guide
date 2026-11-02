/* siikk-guide – Sprachumschaltung
 * Deutsch ist die Grundsprache. Für andere Sprachen liegt in lang/<code>.json ein Wörterbuch
 * { "deutscher Text": "Übersetzung" }. Fehlt ein Eintrag, bleibt der deutsche Text stehen.
 * Übersetzt werden die Daten (DATA) und alles, was die Seite anzeigt (Texte, title, alt, aria-label, placeholder).
 */
(function(){
  var SPRACHEN = [
    ['de', 'Deutsch', 'DE'], ['en', 'English', 'EN'], ['fr', 'Français', 'FR'], ['es', 'Español', 'ES'], ['ru', 'Русский', 'RU']
  ];
  var KEY = 'siikk-sprache';
  function gewaehlt(){
    var m = /[?&]lang=(\w\w)/.exec(location.search); if (m) return m[1];
    try { var s = localStorage.getItem(KEY); if (s) return s; } catch (e) {}
    return 'de';
  }
  var lang = gewaehlt();
  if (!SPRACHEN.some(function(s){ return s[0] === lang; })) lang = 'de';
  var DICT = null, PAT = null, RE = [], BLOCK = 'P,LI,H1,H2,H3,H4,TD,TH,FIGCAPTION,SUMMARY,DD,DT,LABEL,BUTTON,A,SPAN,B,DIV,SMALL,OPTION';
  var INLINE = { B:1, I:1, EM:1, STRONG:1, SPAN:1, A:1, CODE:1, BR:1, SMALL:1, S:1, U:1, SUP:1, SUB:1 };
  var NUM = /\d+(?:[.,:]\d+)*/g;

  function norm(s){ return s.replace(/\s+/g, ' ').trim(); }
  function muster(s){ var n = 0; return s.replace(NUM, function(){ return '{' + (n++) + '}'; }); }
  function tr(s){
    if (!DICT || !s) return null;
    var k = norm(s); if (!k || !/[A-Za-zÄÖÜäöüß]/.test(k)) return null;
    if (DICT[k] !== undefined) return DICT[k];
    var zahlen = k.match(NUM);
    if (zahlen) { var p = PAT[muster(k)]; if (p !== undefined) return p.replace(/\{(\d+)\}/g, function(_, i){ return zahlen[+i] !== undefined ? zahlen[+i] : ''; }); }
    // Regeln aus dem Wörterbuch ("RE:<regex>": "Ziel mit $1 $2"), Gruppen werden selbst übersetzt
    for (var r = 0; r < RE.length; r++) {
      var m = RE[r][0].exec(k);
      if (m) return RE[r][1].replace(/\$(\d)/g, function(_, i){ var g = m[+i] || ''; var x = /[A-Za-zÄÖÜäöüß]/.test(g) ? tr(g) : null; if (x === null && /\*$/.test(g)) { x = tr(g.slice(0, -1)); if (x !== null) x += '*'; } return x !== null ? x : g; });
    }
    // mehrere Sätze einzeln übersetzen
    var saetze = k.split(/(?<=[.!?])\s+(?=[A-ZÄÖÜ„"(])/);
    if (saetze.length > 1) {
      var ok2 = false, out2 = saetze.map(function(t){ var x = tr(t); if (x !== null) { ok2 = true; return x; } return t; });
      if (ok2) return out2.join(' ');
    }
    // Teile wie "WoW: Forever · Druide" einzeln übersetzen
    var teile = k.split(/( · | – | — | \| )/);
    if (teile.length > 1) {
      var ok = false, out = teile.map(function(t, i){ if (i % 2) return t; var x = tr1(t); if (x !== null) { ok = true; return x; } return t; });
      if (ok) return out.join('');
    }
    return null;
  }
  function tr1(t){
    var k = norm(t); if (!k) return null;
    if (DICT[k] !== undefined) return DICT[k];
    var zahlen = k.match(NUM);
    if (zahlen) { var p = PAT[muster(k)]; if (p !== undefined) return p.replace(/\{(\d+)\}/g, function(_, i){ return zahlen[+i] || ''; }); }
    return null;
  }
  function mitRand(orig, neu){ var a = /^\s*/.exec(orig)[0], b = /\s*$/.exec(orig)[0]; return a + neu + b; }

  // ---- Daten übersetzen
  var SKIP = { id:1, en:1, talent:1, datei:1, logo:1, farbe:1, vor:1, url:1, link:1, hash:1, icon:1, sym:1, addon:1, fraktion:1, typ:1, bewertung:1, leveln:1, art:1, groesse:1, version:1, datum:1, klassen:1 };
  function daten(o){
    if (Array.isArray(o)) { for (var i = 0; i < o.length; i++) { if (typeof o[i] === 'string') { var t = tr(o[i]); if (t !== null) o[i] = t; } else if (o[i] && typeof o[i] === 'object') daten(o[i]); } return; }
    for (var k in o) {
      if (!Object.prototype.hasOwnProperty.call(o, k) || SKIP[k]) continue;
      var v = o[k];
      if (typeof v === 'string') { if (v.indexOf('data:') === 0) continue; var x = tr(v); if (x !== null) o[k] = x; }
      else if (v && typeof v === 'object') daten(v);
    }
  }

  // ---- Seite übersetzen
  function nurInline(el){
    for (var c = el.firstChild; c; c = c.nextSibling) {
      if (c.nodeType === 1 && !INLINE[c.tagName]) return false;
      if (c.nodeType === 1 && c.querySelector && c.querySelector('div,p,ul,ol,table,section,figure,img,svg,button,input,select')) return false;
    }
    return true;
  }
  var ATTR = ['title', 'alt', 'aria-label', 'placeholder'];
  function knoten(root){
    if (!DICT || !root) return;
    var els = root.nodeType === 1 ? [root].concat([].slice.call(root.querySelectorAll('*'))) : [];
    els.forEach(function(el){
      if (el.closest && el.closest('script,style,svg,code,[data-i18n-aus]')) return;
      ATTR.forEach(function(a){ var v = el.getAttribute && el.getAttribute(a); if (v) { var t = tr(v); if (t !== null && t !== v) el.setAttribute(a, t); } });
      if (el.dataset && el.dataset.i18nFertig === lang) return;
      if (BLOCK.indexOf(el.tagName) >= 0 && el.firstChild && nurInline(el) && (el.innerHTML.indexOf('<') >= 0)) {
        var h = norm(el.innerHTML), t = DICT[h];
        if (t !== undefined && t !== h) { el.innerHTML = t; el.dataset.i18nFertig = lang; return; }
      }
    });
    var w = document.createTreeWalker(root, NodeFilter.SHOW_TEXT, null), n, liste = [];
    while ((n = w.nextNode())) liste.push(n);
    liste.forEach(function(n){
      var p = n.parentNode; if (!p || (p.closest && p.closest('script,style,code,[data-i18n-aus]'))) return;
      var t = tr(n.nodeValue); if (t !== null && norm(t) !== norm(n.nodeValue)) n.nodeValue = mitRand(n.nodeValue, t);
    });
  }
  var titelOrig = null;
  function titel(){ var t = tr(document.title); if (t !== null && t !== document.title) document.title = t; }

  // ---- Umschalter in der Kopfzeile
  function umschalter(){
    var bar = document.querySelector('.bar'); if (!bar || document.getElementById('sprache')) return;
    var aktuell = SPRACHEN.filter(function(s){ return s[0] === lang; })[0];
    var w = document.createElement('div'); w.className = 'sprache'; w.id = 'sprache'; w.setAttribute('data-i18n-aus', '');
    w.innerHTML = '<button type="button" class="sprache-knopf" aria-haspopup="true" aria-expanded="false" title="Sprache / Language"><svg viewBox="0 0 24 24" width="16" height="16" fill="none" stroke="currentColor" stroke-width="1.8" aria-hidden="true"><circle cx="12" cy="12" r="9"/><path d="M3 12h18M12 3c3 3.2 3 14.8 0 18M12 3c-3 3.2-3 14.8 0 18"/></svg><span>' + aktuell[2] + '</span></button>' +
      '<div class="sprache-liste" hidden>' + SPRACHEN.map(function(s){ return '<button type="button" data-lang="' + s[0] + '"' + (s[0] === lang ? ' aria-current="true"' : '') + '><b>' + s[2] + '</b> ' + s[1] + '</button>'; }).join('') + '</div>';
    var ad = document.getElementById('bar-ad');
    if (ad) bar.insertBefore(w, ad); else bar.appendChild(w);
    var knopf = w.querySelector('.sprache-knopf'), liste = w.querySelector('.sprache-liste');
    knopf.addEventListener('click', function(e){ e.stopPropagation(); var auf = liste.hidden; liste.hidden = !auf; knopf.setAttribute('aria-expanded', auf ? 'true' : 'false'); });
    document.addEventListener('click', function(){ liste.hidden = true; knopf.setAttribute('aria-expanded', 'false'); });
    liste.addEventListener('click', function(e){
      var b = e.target.closest('[data-lang]'); if (!b) return;
      try { localStorage.setItem(KEY, b.dataset.lang); } catch (x) {}
      if (/[?&]lang=/.test(location.search)) { var q = location.search.replace(/([?&])lang=\w\w&?/, '$1').replace(/[?&]$/, ''); location.href = location.pathname + q + location.hash; }
      else location.reload();
    });
  }

  function start(){
    umschalter();
    if (lang === 'de') { document.documentElement.classList.remove('i18n-lade'); return; }
    document.documentElement.lang = lang;
    fetch('lang/' + lang + '.json', { cache: 'no-cache' }).then(function(r){ return r.ok ? r.json() : {}; }).catch(function(){ return {}; }).then(function(d){
      DICT = {}; PAT = {};
      for (var k in d) { if (k.indexOf('RE:') === 0) { try { RE.push([new RegExp(k.slice(3)), d[k]]); } catch (x) {} continue; } var nk = norm(k); DICT[nk] = d[k]; if (NUM.test(nk)) PAT[muster(nk)] = muster2(nk, d[k]); NUM.lastIndex = 0; }
      if (window.DATA) daten(window.DATA);
      // neu zeichnen mit übersetzten Daten
      window.dispatchEvent(new HashChangeEvent('hashchange'));
      knoten(document.body); titel();
      new MutationObserver(function(ms){
        ms.forEach(function(m){ m.addedNodes.forEach(function(n){ if (n.nodeType === 1) knoten(n); else if (n.nodeType === 3 && n.parentNode) knoten(n.parentNode); }); if (m.type === 'characterData' && m.target.parentNode) knoten(m.target.parentNode); });
        titel();
      }).observe(document.body, { childList: true, subtree: true, characterData: true });
      new MutationObserver(titel).observe(document.querySelector('title') || document.head, { childList: true, subtree: true, characterData: true });
      document.documentElement.classList.remove('i18n-lade');
    });
  }
  // Zahlen in der Übersetzung an dieselben Stellen wie im Original setzen
  function muster2(de, ziel){
    var zd = de.match(NUM) || [], i = 0, used = {};
    return ziel.replace(NUM, function(z){ var j = zd.indexOf(z); while (j >= 0 && used[j]) j = zd.indexOf(z, j + 1); if (j < 0) return z; used[j] = 1; return '{' + j + '}'; });
  }
  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', start); else start();
  window.siikkSprache = lang;
})();
