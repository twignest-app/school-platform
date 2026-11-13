/* Nestopia · English / العربية switch for GrowNest and TwigNest (the hub pages have the same switch built into hub.js).
   Uses the shared dictionary hub-ar.js. Each person's choice is remembered and shared with the hub. */
(function () {
  const BASE = (document.currentScript && document.currentScript.src || "").replace(/[^/]*$/, "");
  let LANG = (() => { try { return localStorage.getItem("nest_staff_lang") || "en"; } catch (_) { return "en"; } })();
  const EMO = /^(\s*)((?:[\p{Extended_Pictographic}\uFE0F\u200D]|\s)*)(.*?)(\s*(?:→|↗|:|…)?)(\s*)$/u;
  const trCore = core => { const D = window.NEST_AR || {}; if (D[core]) return D[core]; const m = core.match(/^(.*?)\s*(\(\d+\))$/); if (m && D[m[1]]) return D[m[1]] + " " + m[2]; return window.trAr ? window.trAr(core) : null; };
  function trNode(n){ const orig = n._en != null ? n._en : n.nodeValue;
    if (LANG !== "ar") { if (n._en != null) { n.nodeValue = n._en; n._en = null; } return; }
    if (!/[A-Za-z]/.test(orig)) return; const m = orig.match(EMO); if (!m) return; const t = trCore(m[3].trim()); if (!t) return;
    n._en = orig; n.nodeValue = m[1] + m[2] + t + (m[4] || "").replace("→", "←").replace("←", LANG === "ar" ? "←" : "→") + m[5]; }
  function translate(root){
    const w = document.createTreeWalker(root, NodeFilter.SHOW_TEXT, { acceptNode: x => x.parentNode && (/^(SCRIPT|STYLE|TEXTAREA)$/.test(x.parentNode.nodeName) || (x.parentNode.closest && x.parentNode.closest(".nest-langsw"))) ? NodeFilter.FILTER_REJECT : NodeFilter.FILTER_ACCEPT });
    const list = []; let x; while ((x = w.nextNode())) list.push(x); list.forEach(trNode);
    root.querySelectorAll("[placeholder],[title],[aria-label]").forEach(el => ["placeholder", "title", "aria-label"].forEach(a => { if (!el.hasAttribute(a)) return; const k = "_en_" + a, v = el[k] != null ? el[k] : el.getAttribute(a);
      if (LANG !== "ar") { if (el[k] != null) { el.setAttribute(a, el[k]); el[k] = null; } return; } const t = trCore(String(v).trim()); if (t) { el[k] = v; el.setAttribute(a, t); } }));
  }
  const css = document.createElement("style");
  css.textContent = `[dir="rtl"] th,[dir="rtl"] td{text-align:right}.nest-langsw{font:inherit;font-weight:800;border:2px solid #E6E0EE;background:#fff;color:#462D5B;border-radius:99px;padding:5px 12px;cursor:pointer}`;
  document.head.appendChild(css);
  function apply(){ document.documentElement.dir = LANG === "ar" ? "rtl" : "ltr"; document.documentElement.lang = LANG; translate(document.body); }
  function loadAr(cb){ if (window.NEST_AR) return cb(); const s = document.createElement("script"); s.src = BASE + "hub-ar.js?v=5"; s.onload = cb; document.head.appendChild(s); }
  function addSwitch(){
    if (document.querySelector(".nest-langsw")) return;
    const host = document.querySelector("header .wrap > div:last-child, header .wrap, header") || document.querySelector("#side .me") || null;
    const b = document.createElement("button"); b.type = "button"; b.className = "nest-langsw"; b.textContent = LANG === "ar" ? "English" : "العربية";
    b.onclick = () => { LANG = LANG === "ar" ? "en" : "ar"; try { localStorage.setItem("nest_staff_lang", LANG); } catch (_) {} b.textContent = LANG === "ar" ? "English" : "العربية"; loadAr(apply); };
    if (host) host.appendChild(b); else { b.style.cssText = "position:fixed;bottom:14px;inset-inline-start:14px;z-index:99"; document.body.appendChild(b); }
  }
  let t = null; const run = () => { addSwitch(); if (LANG === "ar") loadAr(apply); };
  const start = () => { run(); new MutationObserver(() => { clearTimeout(t); t = setTimeout(run, 40); }).observe(document.body, { childList: true, subtree: true }); };
  document.readyState === "loading" ? document.addEventListener("DOMContentLoaded", start) : start();
})();
