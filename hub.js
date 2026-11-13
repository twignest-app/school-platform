/* Nestopia · School hub frame
   Adds the School hub sidebar to any Nestopia page. Each page calls hubInit("<its id>") once it knows who is signed in.
   GrowNest and TwigNest keep their own screens and get a "← School hub" button instead. */
(function () {
  const ICONS = {
    overview: '<path d="M3 11l9-7 9 7"/><path d="M5 10v10h14V10"/>',
    students: '<circle cx="9" cy="8" r="3.2"/><path d="M3 20c0-3.3 2.7-5.5 6-5.5s6 2.2 6 5.5"/><path d="M16 5.2a3 3 0 010 5.8M18 14.6c1.9.7 3 2.6 3 5.4"/>',
    attendance: '<circle cx="12" cy="12" r="9"/><path d="M8 12.5l2.6 2.6L16.5 9"/>',
    planning: '<path d="M4 5.5C6.5 4 9.5 4 12 5.5 14.5 4 17.5 4 20 5.5V19c-2.5-1.5-5.5-1.5-8 0-2.5-1.5-5.5-1.5-8 0z"/><path d="M12 5.5V19"/>',
    assessments: '<rect x="5" y="4" width="14" height="17" rx="2"/><path d="M9 4V3h6v1M9 10h6M9 14h6M9 18h4"/>',
    grownest: '<path d="M12 21v-8"/><path d="M12 13c0-4 3-6 7-6 0 4-3 6-7 6zM12 15c0-3-2.5-5-6-5 0 3 2.5 5 6 5z"/>',
    twignest: '<path d="M4 20h16"/><path d="M7 20v-6M11 20V9M15 20v-4M19 20V6"/>',
    reports: '<path d="M7 3h7l4 4v14H7z"/><path d="M14 3v4h4M10 12h5M10 16h5"/>',
    calendar: '<rect x="4" y="5" width="16" height="15" rx="2"/><path d="M4 10h16M9 3v4M15 3v4"/>',
    inclusion: '<path d="M12 20s-7-4.3-7-10a4 4 0 017-2.6A4 4 0 0119 10c0 5.7-7 10-7 10z"/>',
    wellbeing: '<path d="M12 3l1.8 4.6L18.5 9l-4.7 1.4L12 15l-1.8-4.6L5.5 9l4.7-1.4z"/><path d="M18 15l.8 2 2 .8-2 .8-.8 2-.8-2-2-.8 2-.8z"/>',
    evidence: '<path d="M6 3h8l4 4v14H6z"/><path d="M14 3v4h4M9 13l2 2 4-4"/>',
    conferences: '<circle cx="8" cy="8" r="3"/><circle cx="16" cy="8" r="3"/><path d="M2.5 19c.6-3 2.8-4.5 5.5-4.5S12.9 16 13.5 19M10.5 19c.6-3 2.8-4.5 5.5-4.5s4.9 1.5 5.5 4.5"/>',
    behaviour: '<path d="M12 3l2.6 5.3 5.9.9-4.3 4.1 1 5.8L12 16.4 6.8 19.1l1-5.8L3.5 9.2l5.9-.9z"/>',
    messages: '<path d="M4 5h16v11H8l-4 4z"/><path d="M8 9h8M8 12h5"/>',
    parents: '<circle cx="9" cy="7" r="3"/><path d="M3.5 19c.6-3.4 2.8-5.5 5.5-5.5s4.9 2.1 5.5 5.5"/><circle cx="17" cy="10" r="2.2"/><path d="M15.5 19c.3-2.3 1.4-3.8 3-4.2"/>',
    settings: '<circle cx="12" cy="12" r="3"/><path d="M12 2.5v3M12 18.5v3M2.5 12h3M18.5 12h3M5.3 5.3l2.1 2.1M16.6 16.6l2.1 2.1M5.3 18.7l2.1-2.1M16.6 7.4l2.1-2.1"/>'
  };
  // [id, label, link, module needed (null = always), soon]
  const NAV = [
    ["overview", "Overview", "index.html", null],
    ["students", "Students", "students.html", "twignest"],
    ["attendance", "Attendance", "attendance.html", null],
    ["behaviour", "Behaviour", "behaviour.html", "behaviour"],
    ["planning", "Planning", "planning.html", "planning"],
    ["grownest", "GrowNest", "grownest/app.html", "grownest"],
    ["twignest", "TwigNest", "twignest/", "twignest"],
    ["sub", "Class sheets", "twignest/#sheets", "twignest", false, "twignest"],
    ["sub", "School view", "twignest/#school", "twignest", false, "twignest"],
    ["reports", "Report cards", "reports.html", "twignest", false, "twignest"],
    ["messages", "Messages", "messages.html", null],
    ["calendar", "Calendar", "calendar.html", null],
    ["label", "Support"],
    ["inclusion", "Inclusion", "inclusion.html", "inclusion"],
    ["wellbeing", "Wellbeing", "wellbeing.html", "wellbeing"],
    ["evidence", "Evidence packs", "evidence.html", "evidence"],
    ["parents", "Parent portal", "parents.html", "parents"],
    ["conferences", "Parent conferences", "conferences.html", "conferences"],
    ["label", ""],
    ["settings", "Settings", "settings.html", null]
  ];
  const CSS = `
  .hubwrap{display:grid;grid-template-columns:248px minmax(0,1fr);min-height:calc(100vh - 64px)}
  .hubside{border-right:1px solid var(--line);background:var(--card);padding:18px 12px;position:sticky;top:64px;height:calc(100vh - 64px);overflow:auto}
  .hubside .hlabel{font-size:11.5px;font-weight:800;letter-spacing:.08em;text-transform:uppercase;color:var(--muted);margin:16px 12px 6px}
  .hubside .hlabel:empty{border-top:1px solid var(--line);margin:12px 8px}
  .hubside a{display:flex;align-items:center;gap:12px;padding:10px 12px;border-radius:12px;color:var(--ink);text-decoration:none;font-weight:700;font-size:15.5px}
  .hubside a svg{width:20px;height:20px;fill:none;stroke:currentColor;stroke-width:1.7;stroke-linecap:round;stroke-linejoin:round;flex:none;opacity:.8}
  .hubside a:hover{background:var(--bg,#F3F5FA)}
  .hubside a[aria-current="page"]{background:var(--hub-active,#E8EEF8);color:var(--hub-ink,var(--ink))}
  .hubside a.soon{opacity:.5}
  .hubside a.hsub{padding:7px 12px 7px 44px;font-size:14.5px;font-weight:600;color:var(--muted)}
  .hubside a.hsub[aria-current="page"]{color:var(--hub-ink,var(--ink));font-weight:800}
  .hubside a .soonlbl{margin-left:auto;font-size:10.5px;font-weight:800;background:var(--line);border-radius:99px;padding:2px 7px}
  .hubmain{min-width:0}
  .hubmain > main{max-width:1180px}
  .hubtoggle{display:none;font:inherit;font-weight:800;border:1px solid var(--line);background:var(--card);color:var(--ink);border-radius:12px;padding:8px 12px;cursor:pointer}
  @media (max-width: 900px){
    .hubwrap{grid-template-columns:1fr}
    .hubside{position:fixed;left:0;top:0;bottom:0;height:auto;width:min(290px,84vw);z-index:40;transform:translateX(-105%);transition:transform .2s;box-shadow:0 10px 40px rgba(0,0,0,.18)}
    .hubside.open{transform:none}
    .hubtoggle{display:inline-block}
    .hubshade{position:fixed;inset:0;background:rgba(20,20,40,.35);z-index:39;display:none}
    .hubshade.open{display:block}
  }
  @media print{.hubside,.hubtoggle{display:none}.hubwrap{display:block}}
  [dir="rtl"] .hubside{border-right:0;border-left:1px solid var(--line)}
  [dir="rtl"] .hubside a.hsub{padding:7px 44px 7px 12px}
  [dir="rtl"] .hubside a .soonlbl{margin-left:0;margin-right:auto}
  [dir="rtl"] th,[dir="rtl"] td{text-align:right}
  @media (max-width: 900px){[dir="rtl"] .hubside{left:auto;right:0;transform:translateX(105%)}[dir="rtl"] .hubside.open{transform:none}}`;

  // ---------- Arabic for staff: one switch, every hub page ----------
  let LANG = (() => { try { return localStorage.getItem("nest_staff_lang") || "en"; } catch (_) { return "en"; } })();
  const EMO = /^(\s*)((?:[\p{Extended_Pictographic}\uFE0F\u200D]|\s)*)(.*?)(\s*(?:→|↗|:|…)?)(\s*)$/u;
  const trCore = core => { const D = window.NEST_AR || {}; if (D[core]) return D[core]; const m = core.match(/^(.*?)\s*(\(\d+\))$/); if (m && D[m[1]]) return D[m[1]] + " " + m[2]; return window.trAr ? window.trAr(core) : null; };
  function trNode(n){
    const orig = n._en != null ? n._en : n.nodeValue;
    if (LANG !== "ar") { if (n._en != null) { n.nodeValue = n._en; n._en = null; } return; }
    if (!/[A-Za-z]/.test(orig)) return;
    const m = orig.match(EMO); if (!m) return; const t = trCore(m[3].trim()); if (!t) return;
    n._en = orig; n.nodeValue = m[1] + m[2] + t + (m[4] || "").replace("→", "←") + m[5];
  }
  function translate(root){
    if (!root || LANG !== "ar" && !root.querySelector) return;
    const w = document.createTreeWalker(root, NodeFilter.SHOW_TEXT, { acceptNode: x => x.parentNode && (/^(SCRIPT|STYLE|TEXTAREA)$/.test(x.parentNode.nodeName) || (x.parentNode.closest && x.parentNode.closest(".langsw"))) ? NodeFilter.FILTER_REJECT : NodeFilter.FILTER_ACCEPT });
    const list = []; let x; while ((x = w.nextNode())) list.push(x); list.forEach(trNode);
    root.querySelectorAll && root.querySelectorAll("[placeholder],[title],[aria-label]").forEach(el => ["placeholder", "title", "aria-label"].forEach(a => { if (!el.hasAttribute(a)) return; const k = "_en_" + a, v = el[k] != null ? el[k] : el.getAttribute(a);
      if (LANG !== "ar") { if (el[k] != null) { el.setAttribute(a, el[k]); el[k] = null; } return; } const t = trCore(String(v).trim()); if (t) { el[k] = v; el.setAttribute(a, t); } }));
  }
  function applyLang(){ document.documentElement.dir = LANG === "ar" ? "rtl" : "ltr"; document.documentElement.lang = LANG; translate(document.body); }
  function loadAr(cb){ if (window.NEST_AR) return cb(); const s = document.createElement("script"); s.src = "hub-ar.js?v=5"; s.onload = cb; document.head.appendChild(s); }
  function addSwitch(){
    const hdr = document.querySelector("header"); if (!hdr || hdr.querySelector(".langsw")) return;
    const b = document.createElement("button"); b.type = "button"; b.className = "btn ghost small langsw"; b.textContent = LANG === "ar" ? "English" : "العربية"; b.style.marginInlineEnd = "8px";
    b.onclick = () => { LANG = LANG === "ar" ? "en" : "ar"; try { localStorage.setItem("nest_staff_lang", LANG); } catch (_) {} b.textContent = LANG === "ar" ? "English" : "العربية"; loadAr(applyLang); };
    const right = hdr.querySelector(".who") || hdr.lastElementChild; if (right) right.insertBefore(b, right.firstChild); else hdr.appendChild(b);
  }
  window.nestStaffLang = () => LANG;
  { let t = null; const run = () => { addSwitch(); if (LANG === "ar") loadAr(applyLang); };
    const start = () => { run(); new MutationObserver(() => { clearTimeout(t); t = setTimeout(run, 40); }).observe(document.body, { childList: true, subtree: true }); };
    document.readyState === "loading" ? document.addEventListener("DOMContentLoaded", start) : start(); }
  // Two-step log-in: on any hub page, if the code hasn't been entered yet, go to the sign-in page to enter it
  (async () => { try { const c = window.sb || (typeof sb !== "undefined" ? sb : null); if (!c || !c.auth.mfa) return;
    const { data: aal } = await c.auth.mfa.getAuthenticatorAssuranceLevel(); if (aal && aal.nextLevel === "aal2" && aal.currentLevel !== "aal2" && !/index\.html$|\/$/.test(location.pathname)) location.href = "./"; } catch (_) {} })();
  // Access log: record that someone opened a sensitive record (safeguarding, wellbeing, inclusion)
  window.nestLog = function (area, record, student) { try { const c = window.sb || (typeof sb !== "undefined" ? sb : null); if (c) c.rpc("audit_view", { p_area: area, p_record: record == null ? null : String(record), p_student: student == null ? null : String(student) }).then(() => {}, () => {}); } catch (_) {} };
  // Nestopia emails: tell the server what happened; it decides who to email (never blocks the page)
  window.nestMail = function (action, id) { try { const c = window.sb || (typeof sb !== "undefined" ? sb : null); if (c && id) c.functions.invoke("nestopia-mail", { body: { action, id } }).catch(() => {}); } catch (_) {} };
  // attendance emails to parents go out once the school's chosen time has passed: any open hub page asks, at most every 10 minutes
  window.nestAttDue = function (force) { try { const c = window.sb || (typeof sb !== "undefined" ? sb : null); if (!c) return; const k = "nest_attdue", last = +(localStorage.getItem(k) || 0);
    if (!force && Date.now() - last < 10 * 60e3) return; localStorage.setItem(k, String(Date.now())); c.functions.invoke("nestopia-mail", { body: { action: "attendance_due" } }).catch(() => {}); } catch (_) {} };
  setTimeout(() => window.nestAttDue(false), 4000); setInterval(() => window.nestAttDue(false), 10 * 60e3);
  window.hubInit = async function (active) {
    try {
      if (document.querySelector(".hubwrap")) { document.querySelectorAll(".hubside a").forEach(a => a.toggleAttribute("aria-current", a.dataset.id === active)); return; }
      const sbc = window.sb || (typeof sb !== "undefined" ? sb : null); if (!sbc) return;
      const { data: { session } } = await sbc.auth.getSession(); if (!session) return;
      const { data: p } = await sbc.from("profiles").select("role,school_id,active").eq("id", session.user.id).single();
      if (!p || !p.school_id || !p.active) return;
      const { data: s } = await sbc.from("schools").select("modules,status").eq("id", p.school_id).single();
      if (!s || s.status !== "active") return;
      const on = s.modules || [], lead = ["school_lead", "coordinator", "admin"].includes(p.role);
      const items = NAV.filter(n => n[0] === "label" || !n[3] || on.includes(n[3]));
      // drop empty group labels
      const list = items.filter((n, k) => n[0] !== "label" || (items[k + 1] && items[k + 1][0] !== "label"));
      if (!document.getElementById("hubcss")) { const st = document.createElement("style"); st.id = "hubcss"; st.textContent = CSS; document.head.appendChild(st); }
      const main = document.querySelector("main"); if (!main) return;
      const wrap = document.createElement("div"); wrap.className = "hubwrap";
      const side = document.createElement("nav"); side.className = "hubside"; side.setAttribute("aria-label", "School hub");
      side.innerHTML = list.map(n => n[0] === "label" ? `<div class="hlabel">${n[1]}</div>`
        : n[5] ? `<a href="${n[2]}" data-id="${n[0]}" class="hsub" ${n[0] === active ? 'aria-current="page"' : ""}>${n[1]}</a>`
        : `<a href="${n[2]}" data-id="${n[0]}" class="${n[4] ? "soon" : ""}" ${n[0] === active ? 'aria-current="page"' : ""} ${n[4] ? 'title="Coming soon"' : ""}><svg viewBox="0 0 24 24" aria-hidden="true">${ICONS[n[0]] || ""}</svg>${n[1]}${n[4] ? '<span class="soonlbl">Soon</span>' : ""}</a>`).join("");
      side.querySelectorAll("a.soon").forEach(a => a.addEventListener("click", e => { e.preventDefault(); alert(a.textContent.replace("Soon", "").trim() + " is coming soon to the School hub."); }));
      const box = document.createElement("div"); box.className = "hubmain";
      main.parentNode.insertBefore(wrap, main); wrap.append(side, box); box.append(main);
      const shade = document.createElement("div"); shade.className = "hubshade"; document.body.append(shade);
      const hdr = document.querySelector("header");
      if (hdr && !hdr.querySelector(".hubtoggle")) {
        const t = document.createElement("button"); t.type = "button"; t.className = "hubtoggle"; t.textContent = "☰ Menu"; t.setAttribute("aria-label", "Open the School hub menu");
        hdr.insertBefore(t, hdr.firstChild);
        const flip = v => { side.classList.toggle("open", v); shade.classList.toggle("open", v); };
        t.onclick = () => flip(!side.classList.contains("open")); shade.onclick = () => flip(false);
      }
    } catch (_) { /* the page still works without the sidebar */ }
  };
})();
