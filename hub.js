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
    settings: '<circle cx="12" cy="12" r="3"/><path d="M12 2.5v3M12 18.5v3M2.5 12h3M18.5 12h3M5.3 5.3l2.1 2.1M16.6 16.6l2.1 2.1M5.3 18.7l2.1-2.1M16.6 7.4l2.1-2.1"/>'
  };
  // [id, label, link, module needed (null = always), soon]
  const NAV = [
    ["overview", "Overview", "index.html", null],
    ["students", "Students", "students.html", "twignest"],
    ["attendance", "Attendance", "attendance.html", null],
    ["planning", "Planning", "planning.html", "planning"],
    ["assessments", "Assessments", "twignest/", "twignest"],
    ["grownest", "GrowNest", "grownest/app.html", "grownest"],
    ["twignest", "TwigNest", "twignest/", "twignest"],
    ["reports", "Reports", "reports.html", "twignest"],
    ["calendar", "Calendar", "calendar.html", null],
    ["label", "Support"],
    ["inclusion", "Inclusion", "inclusion.html", "inclusion"],
    ["wellbeing", "Wellbeing", "wellbeing.html", "wellbeing"],
    ["evidence", "Evidence packs", "evidence.html", "evidence"],
    ["conferences", "Parent conferences", "conferences.html", null],
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
  @media print{.hubside,.hubtoggle{display:none}.hubwrap{display:block}}`;

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
      const items = NAV.filter(n => n[0] === "label" || !n[3] || on.includes(n[3])).filter(n => !(n[0] === "settings" && !lead));
      // drop empty group labels
      const list = items.filter((n, k) => n[0] !== "label" || (items[k + 1] && items[k + 1][0] !== "label"));
      if (!document.getElementById("hubcss")) { const st = document.createElement("style"); st.id = "hubcss"; st.textContent = CSS; document.head.appendChild(st); }
      const main = document.querySelector("main"); if (!main) return;
      const wrap = document.createElement("div"); wrap.className = "hubwrap";
      const side = document.createElement("nav"); side.className = "hubside"; side.setAttribute("aria-label", "School hub");
      side.innerHTML = list.map(n => n[0] === "label" ? `<div class="hlabel">${n[1]}</div>`
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
