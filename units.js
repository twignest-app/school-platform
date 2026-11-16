/* ===== Nestopia · Units and lessons planner =====
   Grade teams plan units (PYP layout by default, each school can change the sections) and the lessons inside them.
   Marking a lesson as taught ticks its objectives as taught for that class, so Curriculum coverage updates itself. */
const PLATFORM = "Nestopia";
const sb = supabase.createClient("https://gvhzbxpgebgjnegdiijp.supabase.co", "sb_publishable_aEQ4MVt00kNu8PaVtrNnqQ_9guhxPYM");
const app = document.getElementById("app"), who = document.getElementById("who"), dlg = document.getElementById("dlg");
const esc = t => String(t ?? "").replace(/[&<>"]/g, c => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;" }[c]));
const toast = m => { const t = document.getElementById("toast"); t.textContent = m; t.classList.add("on"); clearTimeout(toast.h); toast.h = setTimeout(() => t.classList.remove("on"), 2800); };
const fmtD = d => d ? new Date(d + "T12:00:00").toLocaleDateString("en-GB", { day: "numeric", month: "short", year: "numeric" }) : "";
const today = () => new Date().toISOString().slice(0, 10);

// the PYP unit layout every school starts with; each school can rename, hide or add sections
const DEF_SECTIONS = [
  ["theme", "Transdisciplinary theme"], ["central", "Central idea"], ["lines", "Lines of inquiry"], ["concepts", "Specified concepts"],
  ["related", "Related concepts"], ["atl", "ATL skills"], ["profile", "Learner profile attributes"], ["tuning", "Tuning in and provocation"],
  ["sat", "Summative assessment task (SAT) and rubric"], ["formative", "Formative assessment"], ["action", "Action"],
  ["resources", "Resources"], ["reflection", "Teacher reflection"]].map(([key, label]) => ({ key, label, on: true }));
const LESSON_FIELDS = [["success", "Success criteria"], ["starter", "Starter"], ["main", "Main activities"], ["plenary", "Plenary"],
  ["support", "Support"], ["challenge", "Challenge"], ["resources", "Resources"], ["assessment", "Assessment"], ["homework", "Homework"]];
const STATUS = { draft: ["Draft", "none"], submitted: ["Waiting for review", "part"], changes: ["Changes requested", "warn"], approved: ["Approved", "ok"] };

let me, school, C, setupId, year, lead = false, classes = [], myClassIds = new Set(), units = [], lessons = [], LT = [], TG = {}, staff = {};
let ui = { grade: null, unit: null };
const P = () => Object.assign({ sections: DEF_SECTIONS, review: false }, C.planner || {});
const grades = () => C.grades || [];
const gradeName = id => (grades().find(g => String(g.id) === String(id)) || {}).name || "";
const gradeClasses = g => classes.filter(c => String(c.grade_id) === String(g));
const teachesGrade = g => gradeClasses(g).some(c => myClassIds.has(String(c.id)));
const canEdit = u => lead || (teachesGrade(u.grade_id) && u.status !== "approved");
const canTeach = cid => lead || myClassIds.has(String(cid));

function fail(t){ app.innerHTML = `<div class="card"><div class="msg">${esc(t)}</div></div>`; }
async function fetchAll(q){ const out = []; for (let f = 0; ; f += 1000) { const { data, error } = await q().range(f, f + 999); if (error) throw error; out.push(...data); if (data.length < 1000) break; } return out; }

// every curriculum objective for a grade, from the TwigNest setup
function objectivesFor(gid, subjectIds){
  const out = [], subs = (window.NestSubjects ? NestSubjects.forGrade(C.subjects, gid) : C.subjects || []).filter(sb => !subjectIds || !subjectIds.length || subjectIds.includes(sb.id));
  subs.forEach(sb => (sb.strands || []).forEach(st => (st.cols || []).filter(c => c.type === "objectives").forEach(c =>
    ((c.objectives || {})[gid] || []).forEach((list, ti) => (list || []).forEach(o => out.push({ id: o.id, text: o.text, subject: sb.name, sid: sb.id, strand: st.name, term: (C.terms || [])[ti] || "" }))))));
  return out;
}
const objIndex = gid => Object.fromEntries(objectivesFor(gid).map(o => [o.id, o]));
// how many of this grade's classes have been taught each objective
function taughtCount(oid, gid){ const gc = gradeClasses(gid); return [gc.filter(c => (TG[c.id] || new Set()).has(oid)).length, gc.length]; }

async function start(){
  const { data: { session } } = await sb.auth.getSession(); if (!session) { location.href = "./"; return; }
  const { data: p } = await sb.from("profiles").select("*").eq("id", session.user.id).single();
  if (!p || !p.school_id) return fail("Your account isn’t linked to a school yet.");
  me = p; who.innerHTML = `<span>${esc(p.full_name || p.email)}</span><a class="btn ghost small" href="./">← ${esc(PLATFORM)}</a>`;
  const { data: s } = await sb.from("schools").select("*").eq("id", p.school_id).single(); school = s;
  if (!school || school.status !== "active" || !p.active) return fail("Your school or account isn’t active yet.");
  if (window.hubInit) hubInit("units");
  if (!(school.modules || []).includes("planning")) return fail("Planning isn’t switched on for your school yet.");
  lead = ["school_lead", "coordinator", "admin"].includes(p.role);
  const set = await sb.from("school_setups").select("id,year,config").eq("school_id", school.id).order("updated_at", { ascending: false }).limit(1);
  if (!set.data || !set.data[0]) return fail("Finish the school setup in TwigNest first (grades, subjects and curriculum objectives).");
  setupId = set.data[0].id; C = set.data[0].config; year = set.data[0].year;
  classes = ((await sb.from("classes").select("*").eq("school_id", school.id).eq("year", year)).data || []).sort((a, b) => String(a.name).localeCompare(String(b.name), undefined, { numeric: true }));
  const ct = (await sb.from("class_teachers").select("class_id,teacher_id").eq("teacher_id", me.id)).data || [];
  myClassIds = new Set(ct.map(x => String(x.class_id)));
  const mine = classes.find(c => myClassIds.has(String(c.id)));
  ui.grade = mine ? String(mine.grade_id) : grades()[0] ? String(grades()[0].id) : null;
  await loadUnits();
  window.addEventListener("hashchange", route); route();
}
async function loadUnits(){
  units = await fetchAll(() => sb.from("unit_plans").select("*").eq("school_id", String(school.id)).order("start_date", { ascending: true, nullsFirst: false }));
}
async function loadTaught(gid){
  const ids = gradeClasses(gid).map(c => c.id); TG = {}; if (!ids.length) return;
  (await fetchAll(() => sb.from("taught").select("class_id,obj_id").in("class_id", ids))).forEach(x => (TG[x.class_id] = TG[x.class_id] || new Set()).add(x.obj_id));
}
function route(){
  const h = location.hash.slice(1);
  if (h.startsWith("unit=")) return openUnit(h.slice(5));
  if (h === "settings" && lead) return settingsView();
  listView();
}
function tabs(active){
  return `<div class="phead"><div><h1 class="ptitle">Units and lessons</h1><p class="note" style="margin:0">${esc(school.name)} · plans linked to your curriculum objectives and coverage</p></div>
    <a class="btn ghost" href="planning.html">📊 Curriculum coverage</a></div>
    <div class="tabs" role="tablist"><a class="tab" role="tab" href="#" aria-selected="${active === "list"}">Units</a>${lead ? `<a class="tab" role="tab" href="#settings" aria-selected="${active === "settings"}">Planner settings</a>` : ""}</div>`;
}

/* ---------- list of units ---------- */
async function listView(){
  if (!ui.grade) { app.innerHTML = tabs("list") + `<div class="card"><p class="note">Add grades in TwigNest setup first.</p></div>`; return; }
  await loadTaught(ui.grade);
  const list = units.filter(u => String(u.grade_id) === String(ui.grade)), idx = objIndex(ui.grade), all = Object.keys(idx);
  const planned = new Set(list.flatMap(u => u.objectives || []).filter(id => idx[id]));
  app.innerHTML = tabs("list") + `<div class="card"><div class="row" style="justify-content:space-between;margin-bottom:12px">
      <div class="row"><label class="note" for="gr"><b>Grade</b></label><select id="gr">${grades().map(g => `<option value="${esc(g.id)}" ${String(g.id) === String(ui.grade) ? "selected" : ""}>${esc(g.name)}${teachesGrade(g.id) ? " (my grade)" : ""}</option>`).join("")}</select></div>
      ${lead || teachesGrade(ui.grade) ? `<button class="btn" id="newU">+ New unit</button>` : ""}</div>
    <div class="metrics" style="margin-bottom:12px"><div class="metric"><span>Units</span><b>${list.length}</b></div>
      <div class="metric"><span>Objectives planned in a unit</span><b>${all.length ? Math.round(planned.size / all.length * 100) : 0}%</b></div>
      <div class="metric"><span>Not planned yet</span><b>${all.length - planned.size}</b></div></div>
    ${list.length ? `<div class="ugrid">${list.map(u => { const objs = (u.objectives || []).filter(id => idx[id]), done = objs.filter(id => { const [a, b] = taughtCount(id, u.grade_id); return b && a === b; }).length, st = STATUS[u.status] || STATUS.draft;
      return `<a class="ucard" href="#unit=${esc(u.id)}"><div class="row" style="justify-content:space-between"><b>${esc(u.title)}</b>${P().review ? `<span class="cnt ${st[1]}">${st[0]}</span>` : ""}</div>
        <p class="note" style="margin:4px 0">${u.start_date ? fmtD(u.start_date) + (u.end_date ? " – " + fmtD(u.end_date) : "") : "No dates yet"}</p>
        ${(u.sections || {}).central ? `<p class="ucentral">“${esc(u.sections.central)}”</p>` : ""}
        <div class="bar"><i class="a" style="width:${objs.length ? done / objs.length * 100 : 0}%"></i></div>
        <small class="note">${objs.length} objective${objs.length === 1 ? "" : "s"} · ${done} taught in every class</small></a>`; }).join("")}</div>`
      : `<p class="note">No units for ${esc(gradeName(ui.grade))} yet.${lead || teachesGrade(ui.grade) ? " Press <b>New unit</b> to plan the first one." : ""}</p>`}</div>`;
  document.getElementById("gr").onchange = e => { ui.grade = e.target.value; listView(); };
  const nb = document.getElementById("newU"); if (nb) nb.onclick = async () => {
    const title = prompt("Unit title (you can change it later):", "New unit"); if (title === null) return;
    const { data, error } = await sb.from("unit_plans").insert({ school_id: String(school.id), year, grade_id: String(ui.grade), title: title.trim() || "New unit" }).select().single();
    if (error) return alert("The unit couldn’t be created: " + error.message);
    units.push(data); location.hash = "unit=" + data.id; };
}

/* ---------- one unit ---------- */
async function openUnit(id){
  let u = units.find(x => x.id === id);
  if (!u) { const { data } = await sb.from("unit_plans").select("*").eq("id", id).maybeSingle(); if (!data) { location.hash = ""; return; } u = data; units.push(u); }
  ui.grade = String(u.grade_id); ui.unit = u;
  await loadTaught(u.grade_id);
  lessons = await fetchAll(() => sb.from("lesson_plans").select("*").eq("unit_id", u.id).order("lesson_date", { ascending: true, nullsFirst: false }).order("sort"));
  LT = lessons.length ? await fetchAll(() => sb.from("lesson_taught").select("*").in("lesson_id", lessons.map(l => l.id))) : [];
  drawUnit();
}
function drawUnit(){
  const u = ui.unit, ed = canEdit(u), dis = ed ? "" : " disabled", idx = objIndex(u.grade_id), S = P(), st = STATUS[u.status] || STATUS.draft;
  const subs = window.NestSubjects ? NestSubjects.forGrade(C.subjects, u.grade_id) : C.subjects || [];
  const chosen = new Set(u.objectives || []), objs = [...chosen].filter(x => idx[x]);
  const fully = objs.filter(x => { const [a, b] = taughtCount(x, u.grade_id); return b && a === b; }).length;
  const last = (u.history || []).filter(h => h.note).slice(-1)[0];
  app.innerHTML = `<p style="margin:0 0 10px"><a href="#" class="note">← All ${esc(gradeName(u.grade_id))} units</a></p>
  <div class="card"><div class="row" style="justify-content:space-between;align-items:flex-start">
      <div style="flex:1;min-width:240px"><label class="f">Unit title<input type="text" data-u="title" value="${esc(u.title)}"${dis} style="font-size:20px;font-weight:700"></label></div>
      <div class="row">${S.review ? `<span class="cnt ${st[1]}" style="font-size:14px">${st[0]}</span>` : ""}${reviewButtons(u)}<button class="btn ghost small" id="prt">🖨 Print</button>
        ${(lead || (teachesGrade(u.grade_id) && ["draft", "changes"].includes(u.status))) ? `<button class="btn ghost small" id="delU">Delete</button>` : ""}</div></div>
    ${u.status === "changes" && last ? `<div class="msg" style="margin:8px 0 0">Changes requested by ${esc(last.by || "a leader")}: ${esc(last.note)}</div>` : ""}
    ${!ed && u.status === "approved" ? `<p class="note">This unit is approved. Ask a leader to reopen it if it needs changes. You can still add lessons and mark them as taught.</p>` : ""}
    <div class="f3"><label class="f">Grade<input type="text" value="${esc(gradeName(u.grade_id))}" disabled></label>
      <label class="f">Starts<input type="date" data-u="start_date" value="${esc(u.start_date || "")}"${dis}></label>
      <label class="f">Ends<input type="date" data-u="end_date" value="${esc(u.end_date || "")}"${dis}></label></div>
    <p class="note" style="margin:10px 0 4px"><b>Subjects in this unit</b></p>
    <div class="checks">${subs.map(sb => `<label><input type="checkbox" data-subj="${esc(sb.id)}" ${(u.subjects || []).includes(sb.id) ? "checked" : ""}${dis}> ${esc(sb.name)}</label>`).join("")}</div>
    <p class="note" id="svm" style="margin:8px 0 0">${ed ? "Changes save automatically." : ""}</p></div>

  <div class="card"><h2>Unit plan</h2><div class="secs">${S.sections.filter(x => x.on !== false).map(x => `<label class="f">${esc(x.label)}<textarea rows="3" dir="auto" data-sec="${esc(x.key)}"${dis}>${esc((u.sections || {})[x.key] || "")}</textarea></label>`).join("")}</div></div>

  <div class="card"><div class="row" style="justify-content:space-between"><h2 style="margin:0">Curriculum objectives</h2><span class="note">${objs.length} chosen · <b>${fully}</b> taught in every class</span></div>
    <div class="bar" style="margin:8px 0 12px"><i class="a" style="width:${objs.length ? fully / objs.length * 100 : 0}%"></i></div>
    <div id="olist"></div></div>

  <div class="card"><div class="row" style="justify-content:space-between"><h2 style="margin:0">Lessons</h2>${lead || teachesGrade(u.grade_id) ? `<button class="btn" id="newL">+ Add lesson</button>` : ""}</div>
    ${lessons.length ? `<div style="margin-top:10px">${lessons.map(l => { const tc = LT.filter(x => x.lesson_id === l.id).map(x => (classes.find(c => String(c.id) === String(x.class_id)) || {}).name).filter(Boolean);
      return `<button class="lrow" data-les="${esc(l.id)}"><span class="ld">${l.lesson_date ? fmtD(l.lesson_date) : "No date"}</span><b>${esc(l.title)}</b><span class="note">${(l.objectives || []).length} objective${(l.objectives || []).length === 1 ? "" : "s"}</span>
        <span class="row" style="gap:4px;margin-left:auto">${tc.length ? tc.map(n => `<span class="cnt ok">✔ ${esc(n)}</span>`).join("") : '<span class="cnt none">Not taught yet</span>'}</span></button>`; }).join("")}</div>`
      : `<p class="note">No lessons yet. Add lessons to plan the unit week by week. When a lesson is taught, mark it and its objectives count as taught for that class.</p>`}</div>`;
  drawObjectives();
  // unit details save automatically
  let tmr; const saveU = patch => { Object.assign(u, patch); document.getElementById("svm").textContent = "Saving…"; clearTimeout(tmr);
    tmr = setTimeout(async () => { const { error } = await sb.from("unit_plans").update(patch.__all ? { title: u.title, start_date: u.start_date || null, end_date: u.end_date || null, subjects: u.subjects, sections: u.sections, objectives: u.objectives } : patch).eq("id", u.id);
      document.getElementById("svm").textContent = error ? "Not saved: " + error.message : "Saved ✓"; }, 700); };
  app.querySelectorAll("[data-u]").forEach(x => x.addEventListener("input", () => saveU({ __all: 1, [x.dataset.u]: x.value || null })));
  app.querySelectorAll("[data-sec]").forEach(x => x.addEventListener("input", () => { u.sections = Object.assign({}, u.sections, { [x.dataset.sec]: x.value }); saveU({ __all: 1 }); }));
  app.querySelectorAll("[data-subj]").forEach(x => x.addEventListener("change", () => { const set = new Set(u.subjects || []); x.checked ? set.add(x.dataset.subj) : set.delete(x.dataset.subj); u.subjects = [...set]; saveU({ __all: 1 }); drawObjectives(); }));
  const ol = document.getElementById("olist");
  ol.addEventListener("change", e => { if (e.target.id !== "addObj" || !e.target.value) return; const set = new Set(u.objectives || []); set.add(e.target.value); u.objectives = [...set]; saveU({ __all: 1 }); drawObjectives(); });
  ol.addEventListener("click", e => { const b = e.target.closest("[data-rmobj]"); if (!b) return; u.objectives = (u.objectives || []).filter(x => x !== b.dataset.rmobj); saveU({ __all: 1 }); drawObjectives(); });
  document.getElementById("prt").onclick = () => printUnit(u);
  const db = document.getElementById("delU"); if (db) db.onclick = async () => { if (!confirm(`Delete “${u.title}” and its ${lessons.length} lesson${lessons.length === 1 ? "" : "s"}? Objectives already ticked as taught stay ticked.`)) return;
    const { error } = await sb.from("unit_plans").delete().eq("id", u.id); if (error) return alert(error.message); units = units.filter(x => x.id !== u.id); location.hash = ""; };
  const nl = document.getElementById("newL"); if (nl) nl.onclick = () => lessonDialog(null);
  app.querySelectorAll("[data-les]").forEach(b => b.onclick = () => lessonDialog(lessons.find(l => l.id === b.dataset.les)));
  app.querySelectorAll("[data-rv]").forEach(b => b.onclick = () => review(b.dataset.rv));
}
// one drop-down of objectives, grouped by subject and strand
function objSelect(id, list, placeholder){
  const groups = {}; list.forEach(o => (groups[o.subject + " · " + o.strand] = groups[o.subject + " · " + o.strand] || []).push(o));
  return `<select id="${id}" class="objsel" aria-label="${esc(placeholder)}"><option value="">${esc(placeholder)}</option>${Object.entries(groups).map(([g, os]) =>
    `<optgroup label="${esc(g)}">${os.map(o => `<option value="${esc(o.id)}" title="${esc(o.text)}">${esc(o.text.length > 110 ? o.text.slice(0, 107) + "…" : o.text)}${o.term ? " (" + esc(o.term) + ")" : ""}</option>`).join("")}</optgroup>`).join("")}</select>`;
}
function drawObjectives(){
  const u = ui.unit, ed = canEdit(u), idx = objIndex(u.grade_id), chosen = (u.objectives || []).filter(x => idx[x]);
  const avail = objectivesFor(u.grade_id, (u.subjects || []).length ? u.subjects : null).filter(o => !chosen.includes(o.id));
  document.getElementById("olist").innerHTML = `${ed ? ((u.subjects || []).length ? (avail.length ? `<div class="row" style="margin-bottom:10px">${objSelect("addObj", avail, `Add an objective (${avail.length} available)…`)}</div>` : `<p class="note">Every objective for these subjects is in the unit.</p>`)
      : `<p class="note">Tick the subjects in this unit above, then add objectives from the list.</p>`) : ""}
    ${chosen.length ? `<div class="chosen">${chosen.map(id => { const o = idx[id], [a, b] = taughtCount(id, u.grade_id);
      return `<div class="crow"><span class="tag sod">${esc(o.subject)}</span><span style="flex:1">${esc(o.text)}</span><span class="cnt ${b && a === b ? "ok" : a ? "part" : "none"}" title="Taught in ${a} of ${b} classes">${a}/${b} taught</span>${ed ? `<button type="button" class="mini" data-rmobj="${esc(id)}" aria-label="Remove">✕</button>` : ""}</div>`; }).join("")}</div>`
      : `<p class="note" style="margin:0">No objectives in this unit yet.</p>`}`;
}

/* ---------- checking (optional, set in Planner settings) ---------- */
function reviewButtons(u){
  if (!P().review) return "";
  const t = teachesGrade(u.grade_id), b = [];
  if ((t || lead) && ["draft", "changes"].includes(u.status)) b.push(["submit", "📤 Send for review", ""]);
  if (lead && u.status === "submitted") { b.push(["approve", "✔ Approve", ""]); b.push(["changes", "↩ Request changes", "ghost "]); }
  if (lead && u.status === "approved") b.push(["reopen", "Reopen", "ghost "]);
  return b.map(([a, l, c]) => `<button class="btn ${c}small" data-rv="${a}">${l}</button>`).join("");
}
async function review(a){
  const u = ui.unit; let note = null;
  if (a === "changes") { note = prompt("What should the team change? They will see this note."); if (note === null) return; }
  const next = { submit: "submitted", approve: "approved", changes: "changes", reopen: "draft" }[a];
  const history = (u.history || []).concat([{ action: a, by: me.full_name, at: new Date().toISOString(), note }]);
  const { error } = await sb.from("unit_plans").update({ status: next, history }).eq("id", u.id);
  if (error) return alert(error.message);
  Object.assign(u, { status: next, history }); toast({ submit: "Sent for review.", approve: "Unit approved.", changes: "Sent back with your note.", reopen: "Unit reopened." }[a]); drawUnit();
}

/* ---------- a lesson ---------- */
function lessonDialog(l){
  const u = ui.unit, idx = objIndex(u.grade_id), isNew = !l, can = lead || teachesGrade(u.grade_id);
  l = l || { title: "", lesson_date: today(), objectives: [], fields: {} };
  const uo = (u.objectives || []).filter(x => idx[x]), gc = gradeClasses(u.grade_id), done = new Set(LT.filter(x => x.lesson_id === l.id).map(x => String(x.class_id)));
  dlg.className = "wide";
  dlg.innerHTML = `<form class="dlg" id="lf"><div class="row" style="justify-content:space-between"><h2>${isNew ? "New lesson" : "Lesson"}</h2><button type="button" class="btn ghost small" data-x>Close</button></div>
    <div class="f3"><label class="f" style="grid-column:span 2">Title<input type="text" name="title" value="${esc(l.title)}" required placeholder="e.g. What makes a community?"${can ? "" : " disabled"}></label>
      <label class="f">Date<input type="date" name="date" value="${esc(l.lesson_date || "")}"${can ? "" : " disabled"}></label></div>
    <div><p class="note" style="margin:0 0 4px"><b>Objectives for this lesson</b> (from the unit)</p>
      ${uo.length ? `<div id="lobj"></div>` : `<p class="note">Add objectives to the unit first.</p>`}</div>
    <div class="secs">${LESSON_FIELDS.map(([k, lab]) => `<label class="f">${lab}<textarea rows="2" dir="auto" name="f_${k}"${can ? "" : " disabled"}>${esc((l.fields || {})[k] || "")}</textarea></label>`).join("")}</div>
    ${isNew ? "" : `<div class="box"><h3>✔ Taught</h3><p class="note" style="margin:0 0 6px">Tick each class once it has had this lesson. Its objectives are then ticked as taught for that class in TwigNest and on Curriculum coverage.</p>
      <div class="checks">${gc.map(c => `<label><input type="checkbox" name="tc" value="${esc(c.id)}" ${done.has(String(c.id)) ? "checked" : ""}${canTeach(c.id) ? "" : " disabled"}> ${esc(c.name)}</label>`).join("") || '<span class="note">No classes in this grade yet.</span>'}</div></div>`}
    <div class="row" style="justify-content:space-between">${!isNew && can ? `<button type="button" class="btn ghost" id="delL">Delete lesson</button>` : "<span></span>"}<button class="btn">${isNew ? "Add lesson" : "Save"}</button></div></form>`;
  const f = dlg.querySelector("#lf");
  let lo = (l.objectives || []).filter(x => uo.includes(x));
  const drawLo = () => { const box = dlg.querySelector("#lobj"); if (!box) return; const rest = uo.filter(x => !lo.includes(x)).map(x => idx[x]);
    box.innerHTML = `${can && rest.length ? `<div class="row" style="margin-bottom:8px">${objSelect("addLo", rest, "Add an objective from the unit…")}</div>` : ""}
      ${lo.length ? `<div class="chosen">${lo.map(id => `<div class="crow"><span class="tag sod">${esc(idx[id].subject)}</span><span style="flex:1">${esc(idx[id].text)}</span>${can ? `<button type="button" class="mini" data-rmlo="${esc(id)}" aria-label="Remove">✕</button>` : ""}</div>`).join("")}</div>` : `<p class="note" style="margin:0">No objectives chosen for this lesson yet.</p>`}`; };
  drawLo();
  dlg.onchange = e => { if (e.target.id === "addLo" && e.target.value) { lo.push(e.target.value); drawLo(); } };
  dlg.onclick = e => { const b = e.target.closest("[data-rmlo]"); if (b) { lo = lo.filter(x => x !== b.dataset.rmlo); drawLo(); } };
  dlg.querySelector("[data-x]").onclick = () => dlg.close();
  f.onsubmit = async e => { e.preventDefault(); const btn = f.querySelector("button.btn:not(.ghost)"); btn.disabled = true;
    try {
      if (can) {
        const row = { title: f.title.value.trim() || "Lesson", lesson_date: f.date.value || null, objectives: lo.slice(),
          fields: Object.fromEntries(LESSON_FIELDS.map(([k]) => [k, f["f_" + k].value.trim()]).filter(([, v]) => v)) };
        const q = isNew ? sb.from("lesson_plans").insert(Object.assign({ unit_id: u.id, sort: lessons.length + 1 }, row)).select().single() : sb.from("lesson_plans").update(row).eq("id", l.id).select().single();
        const { data, error } = await q; if (error) throw error; Object.assign(l, data);
      }
      if (!isNew) { // classes newly marked as taught: tick the lesson's objectives for them too
        const want = new Set([...f.querySelectorAll('[name="tc"]:checked')].map(x => x.value));
        for (const c of gc) { const cid = String(c.id); if (!canTeach(cid)) continue;
          if (want.has(cid) && !done.has(cid)) {
            const r1 = await sb.from("lesson_taught").upsert({ lesson_id: l.id, class_id: cid, taught_on: f.date.value || today() }); if (r1.error) throw r1.error;
            if ((l.objectives || []).length) { const r2 = await sb.from("taught").upsert(l.objectives.map(oid => ({ class_id: c.id, obj_id: oid }))); if (r2.error) throw r2.error;
              (TG[c.id] = TG[c.id] || new Set()); l.objectives.forEach(oid => TG[c.id].add(oid)); }
          } else if (!want.has(cid) && done.has(cid)) { const r3 = await sb.from("lesson_taught").delete().eq("lesson_id", l.id).eq("class_id", cid); if (r3.error) throw r3.error; }
        }
      }
      dlg.close(); toast(isNew ? "Lesson added. Open it again to mark classes as taught." : "Lesson saved."); openUnit(u.id);
    } catch (err) { btn.disabled = false; alert("This wasn’t saved: " + (err.message || err)); } };
  const dl = dlg.querySelector("#delL"); if (dl) dl.onclick = async () => { if (!confirm("Delete this lesson? Objectives already ticked as taught stay ticked.")) return;
    const { error } = await sb.from("lesson_plans").delete().eq("id", l.id); if (error) return alert(error.message); dlg.close(); openUnit(u.id); };
  dlg.showModal();
}

/* ---------- print a unit with its lessons ---------- */
function printUnit(u){
  const idx = objIndex(u.grade_id), S = P(), w = window.open("", "_blank"); if (!w) return alert("Please allow pop-ups to print the unit.");
  const objs = (u.objectives || []).filter(x => idx[x]), bySub = {}; objs.forEach(id => (bySub[idx[id].subject] = bySub[idx[id].subject] || []).push(idx[id]));
  w.document.write(`<!doctype html><html><head><meta charset="utf-8"><title>${esc(u.title)}</title><style>@page{size:A4;margin:14mm}body{font-family:Arial,sans-serif;color:#1f2a3d;font-size:11pt;line-height:1.45}
    h1{color:#33405A;margin:0}h2{color:#33405A;font-size:13pt;border-bottom:2px solid #7BB3E6;padding-bottom:3px;margin:16px 0 6px}h3{font-size:11pt;margin:10px 0 4px}
    .meta{color:#56637a;margin:4px 0 10px}.sec{margin:0 0 8px}.sec b{display:block;color:#33405A}p{margin:0;white-space:pre-line}ul{margin:4px 0 0 18px;padding:0}
    .les{border:1px solid #D9E0EA;border-radius:8px;padding:8px 10px;margin:8px 0;page-break-inside:avoid}</style></head><body>
    <h1>${esc(u.title)}</h1><p class="meta">${esc(school.name)} · ${esc(gradeName(u.grade_id))}${u.start_date ? " · " + fmtD(u.start_date) + (u.end_date ? " – " + fmtD(u.end_date) : "") : ""}</p>
    ${S.sections.filter(x => x.on !== false && (u.sections || {})[x.key]).map(x => `<div class="sec"><b>${esc(x.label)}</b><p dir="auto">${esc(u.sections[x.key])}</p></div>`).join("")}
    ${objs.length ? `<h2>Curriculum objectives</h2>${Object.entries(bySub).map(([s, os]) => `<h3>${esc(s)}</h3><ul>${os.map(o => `<li>${esc(o.text)}</li>`).join("")}</ul>`).join("")}` : ""}
    ${lessons.length ? `<h2>Lessons</h2>${lessons.map(l => `<div class="les"><b>${esc(l.title)}</b>${l.lesson_date ? ` · ${fmtD(l.lesson_date)}` : ""}
      ${(l.objectives || []).filter(x => idx[x]).length ? `<ul>${l.objectives.filter(x => idx[x]).map(x => `<li>${esc(idx[x].text)}</li>`).join("")}</ul>` : ""}
      ${LESSON_FIELDS.filter(([k]) => (l.fields || {})[k]).map(([k, lab]) => `<div class="sec" style="margin-top:4px"><b>${lab}</b><p dir="auto">${esc(l.fields[k])}</p></div>`).join("")}</div>`).join("")}` : ""}
    <script>window.onload = () => setTimeout(() => window.print(), 400);<\/script></body></html>`);
  w.document.close();
}

/* ---------- planner settings (school leaders) ---------- */
function settingsView(){
  const S = JSON.parse(JSON.stringify(P()));
  const draw = () => {
    app.innerHTML = tabs("settings") + `<div class="card"><h2>Unit plan sections</h2><p class="note">These are the boxes teachers fill in for every unit. Rename, hide, reorder or add your own. Changing a name keeps what teachers already wrote.</p>
      <div id="secl">${S.sections.map((x, i) => `<div class="row srow"><input type="checkbox" data-on="${i}" ${x.on !== false ? "checked" : ""} aria-label="Show ${esc(x.label)}"><input type="text" data-lab="${i}" value="${esc(x.label)}" style="flex:1">
        <button class="btn ghost small" data-mv="${i}|-1" ${i === 0 ? "disabled" : ""} aria-label="Move up">↑</button><button class="btn ghost small" data-mv="${i}|1" ${i === S.sections.length - 1 ? "disabled" : ""} aria-label="Move down">↓</button>
        ${x.custom ? `<button class="btn ghost small" data-del="${i}">Remove</button>` : ""}</div>`).join("")}</div>
      <p><button class="btn ghost small" id="addS">+ Add a section</button> <button class="btn ghost small" id="pyp">Use the PYP layout again</button></p></div>
    <div class="card"><h2>Checking units</h2><label class="checks"><label><input type="checkbox" id="rv" ${S.review ? "checked" : ""}> Units are checked by a leader or coordinator before they are final</label></label>
      <p class="note" style="margin:6px 0 0">When this is on, teams press <b>Send for review</b>. School leaders and coordinators approve the unit or send it back with a note. Approved units can only be changed by a leader.</p></div>
    <div class="row"><button class="btn" id="saveS">Save settings</button><span class="note" id="sm"></span></div>`;
    app.querySelectorAll("[data-on]").forEach(x => x.onchange = () => { S.sections[+x.dataset.on].on = x.checked; });
    app.querySelectorAll("[data-lab]").forEach(x => x.oninput = () => { S.sections[+x.dataset.lab].label = x.value; });
    app.querySelectorAll("[data-mv]").forEach(b => b.onclick = () => { const [i, d] = b.dataset.mv.split("|").map(Number), j = i + d; [S.sections[i], S.sections[j]] = [S.sections[j], S.sections[i]]; draw(); });
    app.querySelectorAll("[data-del]").forEach(b => b.onclick = () => { S.sections.splice(+b.dataset.del, 1); draw(); });
    document.getElementById("addS").onclick = () => { const l = prompt("Name of the new section:", ""); if (!l || !l.trim()) return; S.sections.push({ key: "c" + Date.now().toString(36), label: l.trim(), on: true, custom: true }); draw(); };
    document.getElementById("pyp").onclick = () => { if (!confirm("Go back to the PYP sections? Your own sections are kept at the end.")) return; S.sections = DEF_SECTIONS.map(x => Object.assign({}, x)).concat(S.sections.filter(x => x.custom)); draw(); };
    document.getElementById("rv").onchange = e => { S.review = e.target.checked; };
    document.getElementById("saveS").onclick = async () => {
      if (S.sections.some(x => !x.label.trim())) return alert("Every section needs a name.");
      const { data: row, error: e1 } = await sb.from("school_setups").select("id,config").eq("id", setupId).single(); if (e1) return alert("This wasn’t saved: " + e1.message);
      const cfg = row.config || {}; cfg.planner = { sections: S.sections.map(x => ({ key: x.key, label: x.label.trim(), on: x.on !== false, custom: !!x.custom })), review: !!S.review };
      const { error } = await sb.from("school_setups").update({ config: cfg }).eq("id", setupId); if (error) return alert("This wasn’t saved: " + error.message);
      C = cfg; document.getElementById("sm").textContent = "Saved ✓"; toast("Planner settings saved."); };
  };
  draw();
}
start();
