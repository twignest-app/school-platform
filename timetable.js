/* ===== Nestopia · Timetable =====
   Each school sets its days and periods. School leaders build the weekly timetable for every class (a cell can hold
   more than one group, e.g. Arabic A and Arabic B at the same time). Teachers see their own week; clashes are flagged. */
const PLATFORM = "Nestopia";
const sb = supabase.createClient("https://gvhzbxpgebgjnegdiijp.supabase.co", "sb_publishable_aEQ4MVt00kNu8PaVtrNnqQ_9guhxPYM");
const app = document.getElementById("app"), who = document.getElementById("who"), dlg = document.getElementById("dlg");
const esc = t => String(t ?? "").replace(/[&<>"]/g, c => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;" }[c]));
const toast = m => { const t = document.getElementById("toast"); t.textContent = m; t.classList.add("on"); clearTimeout(toast.h); toast.h = setTimeout(() => t.classList.remove("on"), 2800); };
const DAYN = { 1: "Monday", 2: "Tuesday", 3: "Wednesday", 4: "Thursday", 5: "Friday", 6: "Saturday", 7: "Sunday" };
const todayDow = () => { const d = new Date(new Date().toLocaleString("en-US", { timeZone: "Asia/Dubai" })).getDay(); return d === 0 ? 7 : d; };
const P = (id, name, start, end, brk, days) => ({ id, name, start, end, brk: !!brk, days: days || [1, 2, 3, 4, 5] });
// a starting point every school can change (Friday is shorter)
const DEF = { days: [1, 2, 3, 4, 5], periods: [P("p1", "Period 1", "07:45", "08:30"), P("p2", "Period 2", "08:30", "09:15"), P("b1", "Break", "09:15", "09:35", 1),
  P("p3", "Period 3", "09:35", "10:20"), P("p4", "Period 4", "10:20", "11:05"), P("b2", "Lunch", "11:05", "11:35", 1, [1, 2, 3, 4]),
  P("p5", "Period 5", "11:35", "12:20", 0, [1, 2, 3, 4]), P("p6", "Period 6", "12:20", "13:05", 0, [1, 2, 3, 4]), P("p7", "Period 7", "13:05", "13:50", 0, [1, 2, 3, 4])] };

let me, school, C = {}, setupId, year, lead = false, classes = [], staff = [], ct = [], slots = [], ui = { tab: null, cls: null, tch: null };
const TT = () => (C.timetable && C.timetable.periods && C.timetable.periods.length) ? C.timetable : DEF;
const clsName = id => (classes.find(c => String(c.id) === String(id)) || {}).name || "";
const tName = id => (staff.find(s => s.id === id) || {}).full_name || "";
const short = n => { const p = String(n || "").trim().split(/\s+/); return p.length > 1 ? p[0] + " " + p[p.length - 1][0] + "." : p[0] || ""; };
const subjName = s => s.subject_id ? ((C.subjects || []).find(x => String(x.id) === String(s.subject_id)) || {}).name || "Lesson" : s.label || "Lesson";
const gradeOf = cid => (classes.find(c => String(c.id) === String(cid)) || {}).grade_id;
const clashes = s => s.teacher_id ? slots.filter(x => x.id !== s.id && x.teacher_id === s.teacher_id && x.day === s.day && x.period_id === s.period_id) : [];
function fail(t){ app.innerHTML = `<div class="card"><div class="msg">${esc(t)}</div></div>`; }
async function fetchAll(q){ const out = []; for (let f = 0; ; f += 1000) { const { data, error } = await q().range(f, f + 999); if (error) throw error; out.push(...data); if (data.length < 1000) break; } return out; }

async function start(){
  const { data: { session } } = await sb.auth.getSession(); if (!session) { location.href = "./"; return; }
  const { data: p } = await sb.from("profiles").select("*").eq("id", session.user.id).single();
  if (!p || !p.school_id) return fail("Your account isn’t linked to a school yet.");
  me = p; who.innerHTML = `<span>${esc(p.full_name || p.email)}</span><a class="btn ghost small" href="./">← ${esc(PLATFORM)}</a>`;
  const { data: s } = await sb.from("schools").select("*").eq("id", p.school_id).single(); school = s;
  if (!school || school.status !== "active" || !p.active) return fail("Your school or account isn’t active yet.");
  if (window.hubInit) hubInit("timetable");
  lead = window.NestAccess ? ((await NestAccess.mine(sb))["timetable"] === "E") : ["school_lead", "coordinator", "admin"].includes(p.role);   // Edit on timetable in the access grid
  const set = await sb.from("school_setups").select("id,year,config").eq("school_id", school.id).order("updated_at", { ascending: false }).limit(1);
  if (set.data && set.data[0]) { setupId = set.data[0].id; C = set.data[0].config || {}; year = set.data[0].year; }
  let cq = sb.from("classes").select("id,name,grade_id").eq("school_id", school.id); if (year) cq = cq.eq("year", year);
  classes = ((await cq).data || []).sort((a, b) => String(a.name).localeCompare(String(b.name), undefined, { numeric: true }));
  staff = ((await sb.from("profiles").select("id,full_name,active").eq("school_id", school.id)).data || []).filter(x => x.active !== false).sort((a, b) => String(a.full_name).localeCompare(String(b.full_name)));
  ct = classes.length ? ((await sb.from("class_teachers").select("class_id,teacher_id,subject_id").in("class_id", classes.map(c => c.id))).data || []) : [];
  await load();
  const mineC = ct.find(x => x.teacher_id === me.id && !x.subject_id);
  ui.cls = String((mineC && mineC.class_id) || (classes[0] || {}).id || "");
  ui.tch = me.id;
  ui.tab = location.hash.slice(1) || (slots.some(x => x.teacher_id === me.id) ? "mine" : "class");
  draw();
}
async function load(){ slots = await fetchAll(() => sb.from("timetable_slots").select("*").eq("school_id", String(school.id))); }

function draw(){
  if (ui.tab === "settings" && !lead) ui.tab = "class";
  app.innerHTML = `<div class="phead"><div><h1 class="ptitle">Timetable</h1><p class="note" style="margin:0">${lead ? "Build each class’s week. Teachers see their own timetable, parents see their child’s, and cover is listed lesson by lesson." : "Your week, and the timetable for every class."}</p></div>
      <div class="row noprint"><button class="btn ghost" id="prt">🖨️ Print</button></div></div>
    <div class="tabs" role="tablist">${[["mine", "My timetable"], ["class", "Classes"], ["teacher", "Teachers"], lead && ["settings", "⚙️ Days and periods"]].filter(Boolean)
      .map(([k, l]) => `<button class="tab" data-t="${k}" aria-selected="${ui.tab === k}">${l}</button>`).join("")}</div><div id="pane"></div>`;
  app.querySelectorAll("[data-t]").forEach(b => b.onclick = () => { ui.tab = b.dataset.t; history.replaceState(null, "", "#" + ui.tab); draw(); });
  document.getElementById("prt").onclick = () => print();
  ({ mine: () => teacherView(me.id, true), class: classView, teacher: () => teacherView(ui.tch, false), settings })[ui.tab]();
}

// the grid: periods down the side, days across the top
function grid(cell){
  const T = TT(), dw = todayDow();
  return `<div class="tablewrap"><table class="tt"><thead><tr><th class="pn"></th>${T.days.map(d => `<th class="${d === dw ? "today" : ""}">${DAYN[d]}${d === dw ? " · today" : ""}</th>`).join("")}</tr></thead><tbody>
    ${T.periods.map(p => `<tr><th class="pn">${esc(p.name)}<small>${esc(p.start || "")}${p.end ? "–" + esc(p.end) : ""}</small></th>
      ${T.days.map(d => { const on = (p.days || T.days).includes(d);
        return `<td class="${d === dw ? "today" : ""}">${!on ? '<div class="ttc off"></div>' : p.brk ? `<div class="ttc brk">${esc(p.name)}</div>` : cell(d, p)}</td>`; }).join("")}</tr>`).join("")}
  </tbody></table></div>`;
}

// ---------- one class ----------
function classView(){
  const pane = document.getElementById("pane"), cid = ui.cls, mine = slots.filter(s => String(s.class_id) === String(cid));
  const grades = (C.grades || []).filter(g => classes.some(c => String(c.grade_id) === String(g.id)));
  const opts = grades.map(g => `<optgroup label="${esc(g.name)}">${classes.filter(c => String(c.grade_id) === String(g.id)).map(c => `<option value="${c.id}" ${String(c.id) === String(cid) ? "selected" : ""}>${esc(c.name)}</option>`).join("")}</optgroup>`).join("")
    + classes.filter(c => !grades.some(g => String(g.id) === String(c.grade_id))).map(c => `<option value="${c.id}" ${String(c.id) === String(cid) ? "selected" : ""}>${esc(c.name)}</option>`).join("");
  const count = {}; mine.forEach(s => { const n = subjName(s); count[n] = (count[n] || 0) + 1; });
  const nClash = mine.filter(s => clashes(s).length).length;
  pane.innerHTML = `<div class="row noprint" style="margin-bottom:12px"><label class="f" style="display:flex;gap:8px;align-items:center">Class <select id="cs">${opts}</select></label><span style="flex:1"></span>
      ${lead ? '<button class="btn ghost small" id="copy">📋 Copy from another class</button><button class="btn ghost small" id="clr">🗑 Clear</button>' : ""}</div>
    <h2 style="margin:0 0 8px;color:var(--plum)">${esc(clsName(cid))}</h2>
    ${nClash ? `<p class="msg">⚠️ ${nClash} lesson${nClash === 1 ? " has a teacher" : "s have teachers"} booked in two places at once (shown in red).</p>` : ""}
    ${grid((d, p) => { const here = mine.filter(s => s.day === d && s.period_id === p.id), cl = here.some(s => clashes(s).length);
      const inner = here.map(s => `<div class="sl"><b>${esc(subjName(s))}</b><small>${esc(short(tName(s.teacher_id)))}${s.room ? " · " + esc(s.room) : ""}</small></div>`).join("") || (lead ? '<small style="color:var(--muted)">+ add</small>' : "");
      return lead ? `<button class="ttc ${cl ? "clash" : ""}" data-c="${d}|${p.id}">${inner}</button>` : `<div class="ttc ${cl ? "clash" : ""}">${inner}</div>`; })}
    ${Object.keys(count).length ? `<div class="card" style="margin-top:14px"><h2>Lessons each week</h2><div class="chips">${Object.entries(count).sort((a, b) => b[1] - a[1]).map(([n, k]) => `<span class="chip" style="cursor:default">${esc(n)}: ${k}</span>`).join("")}</div></div>` : ""}`;
  document.getElementById("cs").onchange = e => { ui.cls = e.target.value; classView(); };
  pane.querySelectorAll("[data-c]").forEach(b => b.onclick = () => { const [d, pid] = b.dataset.c.split("|"); cellDialog(cid, +d, pid); });
  const cp = document.getElementById("copy"); if (cp) cp.onclick = () => copyDialog(cid);
  const cr = document.getElementById("clr"); if (cr) cr.onclick = async () => { if (!mine.length || !confirm(`Clear the whole timetable for ${clsName(cid)}?`)) return;
    const { error } = await sb.from("timetable_slots").delete().eq("school_id", String(school.id)).eq("class_id", String(cid)); if (error) return alert(error.message); await load(); classView(); };
}
function cellDialog(cid, day, pid){
  const p = TT().periods.find(x => x.id === pid), subs = window.NestSubjects ? NestSubjects.forGrade(C.subjects, gradeOf(cid)) : (C.subjects || []);
  const here = slots.filter(s => String(s.class_id) === String(cid) && s.day === day && s.period_id === pid).map(s => Object.assign({}, s));
  const teachersOf = (sid) => new Set(ct.filter(x => String(x.class_id) === String(cid) && (sid ? String(x.subject_id || "") === String(sid) : !x.subject_id)).map(x => x.teacher_id));
  const busy = (tid, keep) => slots.filter(x => x.teacher_id === tid && x.day === day && x.period_id === pid && String(x.class_id) !== String(cid) && x.id !== keep);
  let rows = here.length ? here : [{ subject_id: "", label: "", teacher_id: "", room: "" }];
  const draw = () => {
    dlg.innerHTML = `<form class="dlg" method="dialog" id="cf"><h2>${esc(clsName(cid))} · ${DAYN[day]} · ${esc(p.name)}</h2>
      <p class="note" style="margin:0">Add more than one line when groups are taught at the same time (for example Arabic A and Arabic B).</p>
      ${rows.map((r, i) => { const sug = teachersOf(r.subject_id), b = r.teacher_id ? busy(r.teacher_id, r.id) : [];
        return `<div class="srow2"><select data-k="${i}|subject_id"><option value="">Choose a subject…</option>${subs.map(s => `<option value="${esc(s.id)}" ${String(r.subject_id) === String(s.id) ? "selected" : ""}>${esc(s.name)}</option>`).join("")}<option value="__other" ${!r.subject_id && (r.label || r._other) ? "selected" : ""}>Something else…</option></select>
        <select data-k="${i}|teacher_id"><option value="">Teacher…</option>${staff.map(t => `<option value="${t.id}" ${r.teacher_id === t.id ? "selected" : ""}>${sug.has(t.id) ? "⭐ " : ""}${esc(t.full_name)}${busy(t.id, r.id).length ? " (busy)" : ""}</option>`).join("")}</select>
        <input type="text" data-k="${i}|room" value="${esc(r.room || "")}" placeholder="Room">
        <button type="button" class="mini" data-rm="${i}">✕</button>
        ${!r.subject_id && (r.label || r._other) ? `<input type="text" data-k="${i}|label" value="${esc(r.label || "")}" placeholder="e.g. Assembly, Library, Clubs" style="grid-column:1/-2">` : ""}
        ${b.length ? `<span class="warn" style="grid-column:1/-1">⚠️ ${esc(tName(r.teacher_id))} already teaches ${esc(b.map(x => clsName(x.class_id)).join(", "))} at this time.</span>` : ""}</div>`; }).join("")}
      <p style="margin:0"><button type="button" class="btn ghost small" id="addr">+ Another group at the same time</button></p>
      <div class="row" style="justify-content:flex-end"><button class="btn ghost" value="cancel" formnovalidate>Cancel</button><button class="btn" value="ok" id="sv">Save</button></div></form>`;
    if (!dlg.open) dlg.showModal();
    dlg.querySelector("form").onsubmit = save;
  };
  draw();
  dlg.onchange = e => { const k = e.target.dataset.k; if (!k) return; const [i, f] = k.split("|");
    if (f === "subject_id") { if (e.target.value === "__other") { rows[i].subject_id = ""; rows[i]._other = true; } else { rows[i].subject_id = e.target.value; rows[i].label = ""; rows[i]._other = false;
        if (!rows[i].teacher_id) { const s = [...teachersOf(e.target.value)]; if (s.length === 1) rows[i].teacher_id = s[0]; } } draw(); return; }
    rows[i][f] = e.target.value; if (f === "teacher_id") draw(); };
  dlg.onclick = e => { if (e.target.id === "addr") { rows.push({ subject_id: "", label: "", teacher_id: "", room: "" }); draw(); }
    const rm = e.target.closest("[data-rm]"); if (rm) { rows.splice(+rm.dataset.rm, 1); if (!rows.length) rows.push({ subject_id: "", label: "", teacher_id: "", room: "" }); draw(); } };
  async function save(e){ if (e.submitter && e.submitter.value === "cancel") return; e.preventDefault();
    if (!(await ensureTT())) return;
    const keep = rows.filter(r => r.subject_id || (r.label || "").trim());
    const del = here.filter(h => !keep.some(r => r.id === h.id)).map(h => h.id);
    if (del.length) { const { error } = await sb.from("timetable_slots").delete().in("id", del); if (error) return alert("This wasn’t saved: " + error.message); }
    for (const r of keep) { const row = { school_id: String(school.id), class_id: String(cid), day, period_id: pid, subject_id: r.subject_id || null, label: r.subject_id ? null : (r.label || "").trim(), teacher_id: r.teacher_id || null, room: (r.room || "").trim() || null, updated_at: new Date().toISOString() };
      const { error } = r.id ? await sb.from("timetable_slots").update(row).eq("id", r.id) : await sb.from("timetable_slots").insert(row); if (error) return alert("This wasn’t saved: " + error.message); }
    dlg.close(); await load(); classView(); }
}
// the first time lessons are added, save the days and periods so cover and the parent portal can use them
async function ensureTT(){
  if (C.timetable && C.timetable.periods && C.timetable.periods.length) return true;
  if (!setupId) { alert("Finish the school setup in TwigNest first."); return false; }
  const { data: row, error: e1 } = await sb.from("school_setups").select("id,config").eq("id", setupId).single(); if (e1) { alert(e1.message); return false; }
  const cfg = row.config || {}; if (!cfg.timetable) cfg.timetable = JSON.parse(JSON.stringify(DEF));
  const { error } = await sb.from("school_setups").update({ config: cfg }).eq("id", setupId); if (error) { alert(error.message); return false; }
  C = cfg; return true;
}
function copyDialog(cid){
  dlg.innerHTML = `<form class="dlg" method="dialog"><h2>Copy a timetable into ${esc(clsName(cid))}</h2>
    <label class="f">Copy from<select id="cf1">${classes.filter(c => String(c.id) !== String(cid) && slots.some(s => String(s.class_id) === String(c.id))).map(c => `<option value="${c.id}">${esc(c.name)}</option>`).join("") || '<option value="">No other class has a timetable yet</option>'}</select></label>
    <div class="checks"><label><input type="checkbox" id="cf2"> Copy the teachers too (usually not, as each class has its own teachers)</label></div>
    <p class="note" style="margin:0">This replaces what ${esc(clsName(cid))} has now.</p>
    <div class="row" style="justify-content:flex-end"><button class="btn ghost" value="cancel">Cancel</button><button class="btn" value="ok">Copy</button></div></form>`;
  dlg.showModal(); dlg.onchange = null; dlg.onclick = null;
  dlg.querySelector("form").onsubmit = async e => { if (e.submitter && e.submitter.value === "cancel") return; e.preventDefault();
    if (!(await ensureTT())) return;
    const from = document.getElementById("cf1").value, tch = document.getElementById("cf2").checked; if (!from) return dlg.close();
    const { error: e1 } = await sb.from("timetable_slots").delete().eq("school_id", String(school.id)).eq("class_id", String(cid)); if (e1) return alert(e1.message);
    const rows = slots.filter(s => String(s.class_id) === String(from)).map(s => {
      let t = tch ? s.teacher_id : null;
      if (!tch) { const m = ct.find(x => String(x.class_id) === String(cid) && String(x.subject_id || "") === String(s.subject_id || "")); if (m && s.subject_id) t = m.teacher_id; }
      return { school_id: String(school.id), class_id: String(cid), day: s.day, period_id: s.period_id, subject_id: s.subject_id, label: s.label, teacher_id: t, room: null }; });
    if (rows.length) { const { error } = await sb.from("timetable_slots").insert(rows); if (error) return alert(error.message); }
    dlg.close(); await load(); toast("Copied. Check the teachers for each lesson."); classView(); };
}

// ---------- one teacher ----------
function teacherView(tid, own){
  const pane = document.getElementById("pane"), mine = slots.filter(s => s.teacher_id === tid);
  const n = mine.length, free = TT().periods.filter(p => !p.brk).reduce((a, p) => a + (p.days || TT().days).filter(d => TT().days.includes(d)).length, 0) - new Set(mine.map(s => s.day + "|" + s.period_id)).size;
  pane.innerHTML = `${own ? "" : `<div class="row noprint" style="margin-bottom:12px"><label class="f" style="display:flex;gap:8px;align-items:center">Teacher <select id="ts">${staff.map(t => `<option value="${t.id}" ${t.id === tid ? "selected" : ""}>${esc(t.full_name)}</option>`).join("")}</select></label></div>`}
    <h2 style="margin:0 0 4px;color:var(--plum)">${esc(tName(tid))}</h2><p class="note" style="margin:0 0 10px">${n} lesson${n === 1 ? "" : "s"} a week · ${Math.max(free, 0)} free period${free === 1 ? "" : "s"}</p>
    ${n ? grid((d, p) => { const here = mine.filter(s => s.day === d && s.period_id === p.id);
      return `<div class="ttc ${here.length > 1 ? "clash" : ""}">${here.map(s => `<div class="sl"><b>${esc(clsName(s.class_id))}</b><small>${esc(subjName(s))}${s.room ? " · " + esc(s.room) : ""}</small></div>`).join("")}</div>`; })
      : `<div class="card empty"><p class="note">${own ? "Your timetable hasn’t been added yet." : "No lessons for this teacher yet."}${lead ? " Add lessons from the Classes tab." : ""}</p></div>`}`;
  const ts = document.getElementById("ts"); if (ts) ts.onchange = e => { ui.tch = e.target.value; teacherView(ui.tch, false); };
}

// ---------- days and periods (leaders) ----------
function settings(){
  const pane = document.getElementById("pane"), S = JSON.parse(JSON.stringify(TT())), usedP = new Set(slots.map(s => s.period_id));
  const drawS = () => {
    pane.innerHTML = `<div class="card"><h2>School days</h2><div class="checks">${[1, 2, 3, 4, 5, 6, 7].map(d => `<label><input type="checkbox" data-day="${d}" ${S.days.includes(d) ? "checked" : ""}> ${DAYN[d]}</label>`).join("")}</div></div>
      <div class="card"><h2>Periods and breaks</h2><p class="note" style="margin-top:0">Untick a day for a period that doesn’t happen that day (for example the afternoon on a short Friday).</p>
      ${S.periods.map((p, i) => `<div class="prow"><input type="text" data-p="${i}|name" value="${esc(p.name)}"><input type="time" data-p="${i}|start" value="${esc(p.start || "")}"><input type="time" data-p="${i}|end" value="${esc(p.end || "")}">
        <div class="dchk">${S.days.map(d => `<label><input type="checkbox" data-pd="${i}|${d}" ${(p.days || S.days).includes(d) ? "checked" : ""}>${DAYN[d].slice(0, 2)}</label>`).join("")}</div>
        <label style="font-size:13px;display:flex;gap:4px;align-items:center"><input type="checkbox" data-pb="${i}" ${p.brk ? "checked" : ""}> Break</label>
        <span><button class="mini" data-mv="${i}|-1" ${i === 0 ? "disabled" : ""}>↑</button><button class="mini" data-mv="${i}|1" ${i === S.periods.length - 1 ? "disabled" : ""}>↓</button><button class="mini" data-del="${i}" ${usedP.has(p.id) ? 'title="Lessons use this period"' : ""}>✕</button></span></div>`).join("")}
      <div class="row" style="margin-top:12px"><button class="btn ghost small" id="addp">+ Add a period</button><button class="btn ghost small" id="addb">+ Add a break</button><span style="flex:1"></span><span class="note" id="sm"></span><button class="btn" id="saveS">Save</button></div></div>`;
    pane.querySelectorAll("[data-day]").forEach(c => c.onchange = () => { const d = +c.dataset.day; S.days = c.checked ? [...S.days, d].sort() : S.days.filter(x => x !== d); drawS(); });
    pane.querySelectorAll("[data-p]").forEach(c => c.onchange = () => { const [i, f] = c.dataset.p.split("|"); S.periods[i][f] = c.value; });
    pane.querySelectorAll("[data-pd]").forEach(c => c.onchange = () => { const [i, d] = c.dataset.pd.split("|").map(Number), p = S.periods[i]; p.days = p.days || [...S.days]; p.days = c.checked ? [...new Set([...p.days, d])].sort() : p.days.filter(x => x !== d); });
    pane.querySelectorAll("[data-pb]").forEach(c => c.onchange = () => { S.periods[+c.dataset.pb].brk = c.checked; });
    pane.querySelectorAll("[data-mv]").forEach(b => b.onclick = () => { const [i, d] = b.dataset.mv.split("|").map(Number); [S.periods[i], S.periods[i + d]] = [S.periods[i + d], S.periods[i]]; drawS(); });
    pane.querySelectorAll("[data-del]").forEach(b => b.onclick = () => { const p = S.periods[+b.dataset.del]; if (usedP.has(p.id) && !confirm(`Lessons are timetabled in “${p.name}”. Remove it anyway? Those lessons won’t show.`)) return; S.periods.splice(+b.dataset.del, 1); drawS(); });
    const add = brk => { const last = S.periods[S.periods.length - 1] || {}; S.periods.push({ id: (brk ? "b" : "p") + Date.now().toString(36), name: brk ? "Break" : "Period " + (S.periods.filter(x => !x.brk).length + 1), start: last.end || "", end: "", brk, days: [...S.days] }); drawS(); };
    document.getElementById("addp").onclick = () => add(false); document.getElementById("addb").onclick = () => add(true);
    document.getElementById("saveS").onclick = async () => {
      if (!setupId) return alert("Finish the school setup in TwigNest first.");
      if (S.periods.some(p => !String(p.name).trim())) return alert("Every period needs a name.");
      const { data: row, error: e1 } = await sb.from("school_setups").select("id,config").eq("id", setupId).single(); if (e1) return alert("This wasn’t saved: " + e1.message);
      const cfg = row.config || {}; cfg.timetable = { days: S.days, periods: S.periods.map(p => ({ id: p.id, name: String(p.name).trim(), start: p.start || "", end: p.end || "", brk: !!p.brk, days: (p.days || S.days).filter(d => S.days.includes(d)) })) };
      const { error } = await sb.from("school_setups").update({ config: cfg }).eq("id", setupId); if (error) return alert("This wasn’t saved: " + error.message);
      C = cfg; document.getElementById("sm").textContent = "Saved ✓"; toast("Days and periods saved."); };
  };
  drawS();
}
start();
