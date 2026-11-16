/* ===== Nestopia · New school year =====
   A guided, one-time step at the end of the year: name the new year, check the new classes, choose where each class
   goes (and any student who doesn't follow their class), carry over teachers and the timetable, preview, then start.
   Last year's assessment and report data is archived, not deleted, and parents keep last year's report cards. */
const PLATFORM = "Nestopia";
const sb = supabase.createClient("https://gvhzbxpgebgjnegdiijp.supabase.co", "sb_publishable_aEQ4MVt00kNu8PaVtrNnqQ_9guhxPYM");
const app = document.getElementById("app"), who = document.getElementById("who");
const esc = t => String(t ?? "").replace(/[&<>"]/g, c => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;" }[c]));
const toast = m => { const t = document.getElementById("toast"); t.textContent = m; t.classList.add("on"); clearTimeout(toast.h); toast.h = setTimeout(() => t.classList.remove("on"), 3000); };

let me, school, C = {}, year, classes = [], studs = [], S = null;
const grades = () => C.grades || [];
const gName = id => (grades().find(g => String(g.id) === String(id)) || {}).name || "No grade";
const suffix = n => String(n || "").replace(/^(grade|year|kg|pre-?k|g)?\s*\d*\s*/i, "").trim().toLowerCase();
function fail(t){ app.innerHTML = `<div class="card"><div class="msg">${esc(t)}</div></div>`; }
async function fetchAll(q){ const out = []; for (let f = 0; ; f += 1000) { const { data, error } = await q().range(f, f + 999); if (error) throw error; out.push(...data); if (data.length < 1000) break; } return out; }
const nextYear = y => { const m = String(y || "").match(/(\d{4})\D+(\d{2,4})/); if (!m) return ""; const a = +m[1] + 1, b = +m[2] + 1; return `${a}-${String(b).length === 2 ? String(b).padStart(2, "0") : b}`; };

async function start(){
  const { data: { session } } = await sb.auth.getSession(); if (!session) { location.href = "./"; return; }
  const { data: p } = await sb.from("profiles").select("*").eq("id", session.user.id).single();
  if (!p || !p.school_id) return fail("Your account isn’t linked to a school yet.");
  me = p; who.innerHTML = `<span>${esc(p.full_name || p.email)}</span><a class="btn ghost small" href="./">← ${esc(PLATFORM)}</a>`;
  const { data: s } = await sb.from("schools").select("*").eq("id", p.school_id).single(); school = s;
  if (!school || school.status !== "active" || !p.active) return fail("Your school or account isn’t active yet.");
  if (window.hubInit) hubInit("newyear");
  if ((await NestAccess.mine(sb)).settings !== "E") return fail("Only people who can change school settings can start a new school year.");
  const set = await sb.from("school_setups").select("id,year,config").eq("school_id", school.id).order("updated_at", { ascending: false }).limit(1);
  if (!set.data || !set.data[0]) return fail("Finish the school setup in TwigNest first.");
  C = set.data[0].config || {}; year = set.data[0].year;
  classes = ((await sb.from("classes").select("id,name,grade_id").eq("school_id", school.id).eq("year", year)).data || []).sort((a, b) => String(a.name).localeCompare(String(b.name), undefined, { numeric: true }));
  studs = classes.length ? (await fetchAll(() => sb.from("students").select("id,full_name,class_id,archived").in("class_id", classes.map(c => c.id)).eq("archived", false))).sort((a, b) => String(a.full_name).localeCompare(String(b.full_name))) : [];
  plan(); draw();
}
// a starting plan: the same classes next year; each class moves to the class with the same letter in the next grade; the top grade leaves
function plan(){
  const G = grades().map(g => String(g.id)), nc = [];
  classes.forEach((c, i) => nc.push({ key: "k" + i, name: c.name, grade_id: c.grade_id }));
  const moves = {};
  classes.forEach(c => { const gi = G.indexOf(String(c.grade_id));
    if (gi < 0) { moves[c.id] = (nc.find(n => n.name === c.name) || {}).key || ""; return; }
    if (gi === G.length - 1) { moves[c.id] = "leave"; return; }
    const cand = nc.filter(n => String(n.grade_id) === G[gi + 1]); moves[c.id] = ((cand.find(n => suffix(n.name) === suffix(c.name)) || cand[0]) || {}).key || ""; });
  S = { y1: nextYear(year), nc, moves, except: {}, teachers: true, timetable: true, preview: null };
}
const target = k => k === "leave" ? "Leaving the school" : (S.nc.find(n => n.key === k) ? `${S.nc.find(n => n.key === k).name} (${gName(S.nc.find(n => n.key === k).grade_id)})` : "—");
const tOpts = (sel, withNone) => `${withNone ? '<option value="">Choose…</option>' : ""}${grades().map(g => { const L = S.nc.filter(n => String(n.grade_id) === String(g.id)); return L.length ? `<optgroup label="${esc(g.name)} ${esc(S.y1)}">${L.map(n => `<option value="${n.key}" ${sel === n.key ? "selected" : ""}>${esc(n.name)}</option>`).join("")}</optgroup>` : ""; }).join("")}<option value="leave" ${sel === "leave" ? "selected" : ""}>🎓 Leaving the school</option>`;

function draw(){
  const byG = grades().map(g => [g, classes.filter(c => String(c.grade_id) === String(g.id))]).filter(x => x[1].length);
  const missing = classes.filter(c => !S.moves[c.id]);
  app.innerHTML = `<div class="phead"><div><h1 class="ptitle">New school year</h1><p class="note" style="margin:0">Do this once, at the end of the school year. Nothing changes until the last step.</p></div></div>
    <div class="card"><div class="step"><b>1</b><h2 style="margin:0">The new year</h2></div><p class="note">This year is <b>${esc(year)}</b>. Grades, subjects, curriculum objectives, the report card template, timetable periods and all your settings carry over.</p>
      <label class="f" style="max-width:260px">New school year<input type="text" id="y1" value="${esc(S.y1)}" placeholder="2027-2028"></label></div>
    <div class="card"><div class="step"><b>2</b><h2 style="margin:0">The classes for ${esc(S.y1 || "next year")}</h2></div><p class="note">These start as copies of this year’s classes. Rename, add or remove them.</p>
      ${grades().map(g => `<div class="gcol"><b>${esc(g.name)}</b><div class="row" style="margin-top:6px">${S.nc.filter(n => String(n.grade_id) === String(g.id)).map(n => `<span class="row" style="gap:4px"><input type="text" data-nn="${n.key}" value="${esc(n.name)}" style="width:110px"><button class="mini" data-nx="${n.key}" title="Remove">✕</button></span>`).join("")}<button class="btn ghost small" data-na="${esc(g.id)}">+ Class</button></div></div>`).join("")}</div>
    <div class="card"><div class="step"><b>3</b><h2 style="margin:0">Where each class goes</h2></div><p class="note">Each class moves up to the next grade. The oldest grade leaves the school (their records are kept).</p>
      ${byG.map(([g, cl]) => `<h3 style="margin:12px 0 4px;font-size:15px">${esc(g.name)}</h3>${cl.map(c => `<div class="mvrow"><b>${esc(c.name)}</b><span class="note">${(n => n + (n === 1 ? " student" : " students"))(studs.filter(s => String(s.class_id) === String(c.id)).length)}</span><span>→</span><select data-mv="${c.id}">${tOpts(S.moves[c.id], true)}</select></div>`).join("")}`).join("")}
      ${classes.filter(c => !grades().some(g => String(g.id) === String(c.grade_id))).map(c => `<div class="mvrow"><b>${esc(c.name)}</b><span class="note">no grade</span><span>→</span><select data-mv="${c.id}">${tOpts(S.moves[c.id], true)}</select></div>`).join("")}
      ${missing.length ? `<p class="msg">Choose where ${missing.length === 1 ? "this class goes" : "these classes go"}: ${esc(missing.map(c => c.name).join(", "))}.</p>` : ""}</div>
    <div class="card"><div class="step"><b>4</b><h2 style="margin:0">Students who don’t follow their class</h2></div><p class="note">For example a student staying in the same grade, changing class, or leaving the school.</p>
      ${Object.entries(S.except).map(([sid, k]) => { const s = studs.find(x => String(x.id) === sid) || {}; return `<div class="mvrow"><b>${esc(s.full_name || "")}</b><span class="note">${esc((classes.find(c => String(c.id) === String(s.class_id)) || {}).name || "")}</span><span>→</span><span class="row"><select data-ex="${sid}">${tOpts(k)}</select><button class="mini" data-exx="${sid}">✕</button></span></div>`; }).join("")}
      <div class="row" style="margin-top:8px"><select id="exs" style="max-width:360px"><option value="">Add a student…</option>${studs.filter(s => !S.except[s.id]).map(s => `<option value="${s.id}">${esc(s.full_name)} (${esc((classes.find(c => String(c.id) === String(s.class_id)) || {}).name || "")})</option>`).join("")}</select></div></div>
    <div class="card"><div class="step"><b>5</b><h2 style="margin:0">Carry over</h2></div>
      <div class="checks" style="flex-direction:column;align-items:flex-start"><label><input type="checkbox" id="ot" ${S.teachers ? "checked" : ""}> Teachers stay with their class name (the 3A teacher teaches the new 3A). You can change any of them in TwigNest afterwards.</label>
        <label><input type="checkbox" id="ott" ${S.timetable ? "checked" : ""}> Copy each class’s timetable to the new class with the same name.</label></div>
      <p class="note" style="margin:8px 0 0">📦 Last year’s levels, report comments, next steps and report cards are <b>archived</b>, so the new year starts fresh. Parents keep last year’s report cards in the Parent Portal.</p></div>
    <div class="card"><div class="step"><b>6</b><h2 style="margin:0">Check and start</h2></div>
      <div id="pv">${S.preview ? `<p><b>${esc(S.preview.from)} → ${esc(S.preview.to)}</b>: ${S.preview.classes} new classes, <b>${S.preview.moving}</b> students moving into them, <b>${S.preview.leaving}</b> leaving the school.</p>` : ""}</div>
      <div class="row"><button class="btn ghost" id="chk">👀 Check what will happen</button>${S.preview ? `<button class="btn" id="go">🎉 Start ${esc(S.y1)}</button>` : ""}</div></div>`;
  bind();
}
function bind(){
  const reset = () => { S.preview = null; };
  document.getElementById("y1").oninput = e => { S.y1 = e.target.value.trim(); reset(); };
  document.getElementById("y1").onchange = () => draw();
  app.querySelectorAll("[data-nn]").forEach(i => i.oninput = () => { S.nc.find(n => n.key === i.dataset.nn).name = i.value; reset(); });
  app.querySelectorAll("[data-nn]").forEach(i => i.onchange = () => draw());
  app.querySelectorAll("[data-nx]").forEach(b => b.onclick = () => { const k = b.dataset.nx; S.nc = S.nc.filter(n => n.key !== k); Object.keys(S.moves).forEach(c => { if (S.moves[c] === k) S.moves[c] = ""; }); Object.keys(S.except).forEach(s => { if (S.except[s] === k) delete S.except[s]; }); reset(); draw(); });
  app.querySelectorAll("[data-na]").forEach(b => b.onclick = () => { const n = prompt("Name of the new class:", ""); if (!n || !n.trim()) return; S.nc.push({ key: "n" + Date.now().toString(36), name: n.trim(), grade_id: b.dataset.na }); reset(); draw(); });
  app.querySelectorAll("[data-mv]").forEach(s => s.onchange = () => { S.moves[s.dataset.mv] = s.value; reset(); draw(); });
  app.querySelectorAll("[data-ex]").forEach(s => s.onchange = () => { S.except[s.dataset.ex] = s.value; reset(); });
  app.querySelectorAll("[data-exx]").forEach(b => b.onclick = () => { delete S.except[b.dataset.exx]; reset(); draw(); });
  document.getElementById("exs").onchange = e => { if (!e.target.value) return; const s = studs.find(x => String(x.id) === e.target.value); S.except[e.target.value] = S.moves[s.class_id] || "leave"; reset(); draw(); };
  document.getElementById("ot").onchange = e => { S.teachers = e.target.checked; };
  document.getElementById("ott").onchange = e => { S.timetable = e.target.checked; };
  document.getElementById("chk").onclick = () => run(true);
  const go = document.getElementById("go"); if (go) go.onclick = () => run(false);
}
async function run(dry){
  if (!S.y1) return alert("Please type the new school year.");
  const missing = classes.filter(c => !S.moves[c.id]); if (missing.length) return alert("Choose where every class goes first: " + missing.map(c => c.name).join(", "));
  if (S.nc.some(n => !String(n.name).trim())) return alert("Every new class needs a name.");
  const used = new Set([...Object.values(S.moves), ...Object.values(S.except)]);
  if (!dry) { const typed = prompt(`This moves every student into ${S.y1} and archives this year’s assessment data. It can’t be undone from here.\n\nType ${S.y1} to start:`, ""); if (typed === null) return; if (typed.trim() !== S.y1) return alert("That didn’t match, so nothing has changed."); }
  const args = { p_new_year: S.y1, p_classes: S.nc.map(n => ({ key: n.key, name: n.name.trim(), grade_id: n.grade_id })), p_moves: S.moves, p_except: S.except, p_teachers: S.teachers, p_timetable: S.timetable, p_dry: dry };
  const b = document.getElementById(dry ? "chk" : "go"); b.disabled = true;
  const { data, error } = await sb.rpc("rollover_year", args); b.disabled = false;
  if (error) return alert(error.message);
  if (dry) { S.preview = data; draw(); document.getElementById("pv").scrollIntoView({ behavior: "smooth", block: "center" }); return; }
  app.innerHTML = `<div class="card" style="text-align:center;padding:40px"><p style="font-size:60px;margin:0">🎉</p><h1 class="ptitle">Welcome to ${esc(data.to)}!</h1>
    <p>${data.classes} classes are ready, ${data.moving} students have moved up and ${data.leaving} have left. ${data.archived} records from ${esc(data.from)} are archived.</p>
    <p class="note">Next: check teachers in TwigNest → Classes, the timetable, and enrol new students from Admissions.</p>
    <p><a class="btn" href="twignest/#classes">Check the classes</a> <a class="btn ghost" href="timetable.html">Timetable</a> <a class="btn ghost" href="admissions.html">Admissions</a></p></div>`;
}
start();
