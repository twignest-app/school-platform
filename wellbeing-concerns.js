/* Nestopia · Wellbeing: pastoral concerns
   Any teacher logs a concern about a student they teach. Wellbeing concerns go to the wellbeing team.
   Safeguarding concerns go ONLY to the safeguarding lead(s) and school leaders.
   Uses the globals of wellbeing.html: sb, me, school, isTeam, isLead, staff, studs, classes, checks, esc, toast, dlg, fmt, stud, cls, face, today, load, render */

let concerns = [], cActions = [];
const CCATS = { emotional: "Emotional wellbeing", friendship: "Friendships or bullying", behaviour: "Behaviour", attendance: "Attendance or punctuality", family: "Family circumstances", health: "Health", online: "Online safety", other: "Something else", safeguarding: "🔒 Safeguarding or child protection" };
const CSTATUS = { new: ["New", "gt"], open: ["Being followed up", "eal"], monitoring: ["Monitoring", "eal"], closed: ["Closed", "other"] };
const isDSL = () => ["school_lead", "admin"].includes(me.role) || !!me.safeguarding_lead;
const sName = id => (staff.find(p => p.id === id) || {}).full_name || "";

async function concernsLoad(){
  const get = async (t) => { const out = []; for (let f = 0; ; f += 1000) { const { data, error } = await sb.from(t).select("*").eq("school_id", school.id).order("created_at", { ascending: false }).range(f, f + 999); if (error) return out; out.push(...data); if (data.length < 1000) break; } return out; };
  [concerns, cActions] = await Promise.all([get("wellbeing_concerns"), get("wellbeing_actions")]);
}

/* ---- Log a concern (any teacher, for a student they teach) ---- */
function openConcern(preStudent){
  const list = isTeam ? studs : studs.filter(s => (typeof myClassIds !== "undefined" ? myClassIds : []).includes(String(s.class_id)));
  dlg.innerHTML = `<form class="dlg"><h2>📝 Log a concern</h2>
    <p class="note" style="margin:0">Write what you saw or heard, factually. If a child is in immediate danger, act now and tell the safeguarding lead in person as well.</p>
    <label class="f">Student <select name="s" required><option value="">Choose…</option>${list.map(s => `<option value="${esc(s.id)}" ${String(preStudent) === String(s.id) ? "selected" : ""}>${esc(s.full_name)}${cls(s.class_id) ? " · " + esc(cls(s.class_id).name) : ""}</option>`).join("")}</select></label>
    <label class="f">What is it about? <select name="c" required>${Object.entries(CCATS).map(([k, v]) => `<option value="${k}">${v}</option>`).join("")}</select></label>
    <p class="lock" id="sgNote" hidden>🔒 Safeguarding concerns go only to the school’s safeguarding lead(s). Other staff won’t see them.</p>
    <div class="two"><label class="f">When did it happen? <input type="date" name="d" value="${today()}"></label><div class="checks" style="align-self:end"><label><input type="checkbox" name="u"> Urgent: needs attention today</label></div></div>
    <label class="f">What did you see or hear? <textarea name="w" rows="4" required placeholder="Facts: what happened, where, who was there"></textarea></label>
    <label class="f">The student’s own words (if they said anything) <textarea name="q" rows="2" placeholder="Write their exact words, in quotation marks"></textarea></label>
    <label class="f">What have you done so far? <textarea name="a" rows="2" placeholder="For example: talked with the student; informed the class teacher"></textarea></label>
    <div class="row" style="justify-content:flex-end"><button type="button" class="btn ghost" data-x>Cancel</button><button class="btn">Send</button></div></form>`;
  const f = dlg.querySelector("form"); dlg.querySelector("[data-x]").onclick = () => dlg.close();
  f.c.onchange = () => { document.getElementById("sgNote").hidden = f.c.value !== "safeguarding"; };
  f.onsubmit = async e => {
    e.preventDefault();
    const sg = f.c.value === "safeguarding";
    const { error } = await sb.from("wellbeing_concerns").insert({ school_id: school.id, student_id: f.s.value, category: f.c.value, safeguarding: sg, urgent: f.u.checked, happened_on: f.d.value, details: f.w.value.trim(), child_words: f.q.value.trim() || null, actions_taken: f.a.value.trim() || null, logged_by: me.id, status: "new" });
    if (error) return toast(/wellbeing_concerns/.test(error.message) ? "Please run the Wellbeing Part 2 database step first." : error.message);
    dlg.close(); await concernsLoad(); render(); toast(sg ? "Sent to the safeguarding lead" : "Sent to the wellbeing team");
  };
  dlg.showModal();
}

/* ---- One concern: the story, actions and status ---- */
function openConcernCase(id){
  const c = concerns.find(x => String(x.id) === String(id)); if (!c) return;
  const s = stud(c.student_id) || { full_name: "Student" }, canAct = c.safeguarding ? isDSL() : isTeam || c.assigned_to === me.id;
  const acts = cActions.filter(a => String(a.concern_id) === String(c.id)).sort((a, b) => a.created_at.localeCompare(b.created_at));
  const assignees = staff.filter(p => c.safeguarding ? (p.safeguarding_lead || ["school_lead"].includes(p.role)) : (p.wellbeing_team || ["school_lead", "coordinator"].includes(p.role)));
  dlg.innerHTML = `<div class="dlg"><div class="row" style="justify-content:space-between;align-items:flex-start"><div><h2>${c.safeguarding ? "🔒 " : ""}${esc(s.full_name)}</h2><p class="note" style="margin:2px 0 0">${esc((cls(s.class_id) || {}).name || "")} · ${esc(CCATS[c.category] || c.category)} · ${fmt(c.happened_on)} · logged by ${esc(sName(c.logged_by) || "a teacher")}${c.urgent ? ' · <b style="color:var(--red)">Urgent</b>' : ""}</p></div><button class="btn ghost small" data-x>Close</button></div>
    <p style="margin:0"><span class="tag ${CSTATUS[c.status][1]}">${CSTATUS[c.status][0]}</span>${c.assigned_to ? ` <span class="note">With ${esc(sName(c.assigned_to))}</span>` : ""}${c.parents_informed ? ' <span class="note">· Parents informed</span>' : ""}</p>
    <div class="box"><p style="margin:0">${esc(c.details)}</p>${c.child_words ? `<p style="margin:8px 0 0"><b>In the student’s words:</b> “${esc(c.child_words)}”</p>` : ""}${c.actions_taken ? `<p class="note" style="margin:8px 0 0"><b>Done so far:</b> ${esc(c.actions_taken)}</p>` : ""}</div>
    ${canAct ? `<div class="box"><h3>Follow up</h3><div class="two"><label class="f">Who is following this up <select id="cAs"><option value="">Not assigned</option>${assignees.map(p => `<option value="${p.id}" ${c.assigned_to === p.id ? "selected" : ""}>${esc(p.full_name || p.email)}</option>`).join("")}</select></label>
        <label class="f">Status <select id="cSt">${Object.entries(CSTATUS).map(([k, v]) => `<option value="${k}" ${c.status === k ? "selected" : ""}>${v[0]}</option>`).join("")}</select></label></div>
      <div class="checks" style="margin-top:8px"><label><input type="checkbox" id="cPi" ${c.parents_informed ? "checked" : ""}> Parents have been informed</label></div>
      <label class="f" style="margin-top:8px">Add an action or note <textarea id="cAct" rows="2" placeholder="For example: met the student at lunch; called mother; agreed a daily check-in"></textarea></label>
      <div class="row" style="margin-top:8px"><button class="btn" id="cSave">Save</button>${!c.safeguarding ? `<a class="btn ghost" href="inclusion.html#register" title="If the student needs ongoing support">Refer to inclusion →</a>` : ""}</div></div>` : `<p class="note">${c.safeguarding ? "🔒 Thank you. This has gone to the safeguarding lead." : "The wellbeing team will follow this up."}</p>`}
    ${(canAct || !c.safeguarding) && acts.length ? `<div class="box"><h3>Actions</h3>${acts.map(a => `<p style="margin:6px 0"><span class="note">${new Date(a.created_at).toLocaleDateString("en-GB", { day: "numeric", month: "short" })} · ${esc(sName(a.created_by))}:</span> ${esc(a.body)}</p>`).join("")}</div>` : ""}</div>`;
  dlg.querySelector("[data-x]").onclick = () => dlg.close();
  const sv = document.getElementById("cSave");
  if (sv) sv.onclick = async () => {
    const st = document.getElementById("cSt").value;
    const { error } = await sb.from("wellbeing_concerns").update({ assigned_to: document.getElementById("cAs").value || null, status: st === "new" && document.getElementById("cAs").value ? "open" : st, parents_informed: document.getElementById("cPi").checked, updated_at: new Date().toISOString(), closed_at: st === "closed" ? new Date().toISOString() : null }).eq("id", c.id);
    if (error) return toast(error.message);
    const body = document.getElementById("cAct").value.trim();
    if (body) { const { error: ae } = await sb.from("wellbeing_actions").insert({ school_id: school.id, concern_id: c.id, body, created_by: me.id }); if (ae) return toast(ae.message); }
    await concernsLoad(); render(); openConcernCase(c.id); toast("Saved");
  };
  dlg.open || dlg.showModal();
}

/* ---- Lists ---- */
const cRow = c => { const s = stud(c.student_id) || { full_name: "Student" };
  return `<tr><td><button class="nm" data-cc="${esc(c.id)}">${c.safeguarding ? "🔒 " : ""}${esc(s.full_name)}</button><br><span class="note">${esc((cls(s.class_id) || {}).name || "")}</span></td><td>${esc(CCATS[c.category] || c.category)}${c.urgent ? ' <b style="color:var(--red)">· Urgent</b>' : ""}</td><td class="hide-sm">${fmt(c.happened_on)}</td><td class="hide-sm">${esc(sName(c.assigned_to))}</td><td><span class="tag ${CSTATUS[c.status][1]}">${CSTATUS[c.status][0]}</span></td></tr>`; };
const cTable = list => list.length ? `<div class="tablewrap"><table class="reg"><tr><th>Student</th><th>About</th><th class="hide-sm">When</th><th class="hide-sm">With</th><th>Status</th></tr>${list.map(cRow).join("")}</table></div>` : '<p class="note" style="margin:0">Nothing here.</p>';
function bindCC(root){ root.querySelectorAll("[data-cc]").forEach(b => b.onclick = () => openConcernCase(b.dataset.cc)); root.querySelectorAll("[data-logc]").forEach(b => b.onclick = () => openConcern(b.dataset.logc || null)); root.querySelectorAll("[data-stu]").forEach(b => b.onclick = () => openStudentWB(b.dataset.stu)); }

function concernsPane(){
  const pane = document.getElementById("pane"), sg = ui.tab === "safeguarding";
  const list = concerns.filter(c => !!c.safeguarding === sg);
  const open = list.filter(c => c.status !== "closed"), shut = list.filter(c => c.status === "closed");
  pane.innerHTML = `<div class="card"><div class="row" style="justify-content:space-between"><h2>${sg ? "🔒 Safeguarding concerns" : "Concerns"} <span class="note">(${open.length} open)</span></h2><button class="btn" data-logc="">📝 Log a concern</button></div>
    ${sg ? '<p class="lock">Only the safeguarding lead(s) and school leaders can see this list.</p>' : ""}
    ${cTable(open.sort((a, b) => (b.urgent - a.urgent) || b.created_at.localeCompare(a.created_at)))}
    ${shut.length ? `<details style="margin-top:14px"><summary class="note">Closed (${shut.length})</summary>${cTable(shut)}</details>` : ""}</div>`;
  bindCC(pane);
}
function myConcernsHtml(){
  const mine = concerns.filter(c => c.logged_by === me.id);
  return `<div class="card"><div class="row" style="justify-content:space-between"><h2>Concerns I’ve logged</h2><button class="btn ghost" data-logc="">📝 Log a concern</button></div>${mine.length ? cTable(mine) : '<p class="note" style="margin:0">If you’re worried about a student, log it here. It goes to the right person straight away.</p>'}</div>`;
}

/* ---- One student: check-ins over time and concerns ---- */
function openStudentWB(sid){
  const s = stud(sid); if (!s) return;
  const days = []; for (let k = 29; k >= 0; k--) { const d = new Date(Date.now() - k * 864e5); days.push(d.getFullYear() + "-" + String(d.getMonth() + 1).padStart(2, "0") + "-" + String(d.getDate()).padStart(2, "0")); }
  const mine = checks.filter(c => String(c.student_id) === String(sid));
  const cs = concerns.filter(c => String(c.student_id) === String(sid));
  dlg.innerHTML = `<div class="dlg"><div class="row" style="justify-content:space-between"><h2>${esc(s.full_name)}</h2><button class="btn ghost small" data-x>Close</button></div><p class="note" style="margin:0">${esc((cls(s.class_id) || {}).name || "")}</p>
    <div class="box"><h3>Check-ins, last 30 days</h3><div style="display:flex;gap:3px;flex-wrap:wrap">${days.map(d => { const c = mine.find(x => x.day === d); return `<span title="${fmt(d)}${c ? ": " + face(c.mood)[2] + (c.talk ? ", wanted to talk" : "") : ""}" style="font-size:20px;opacity:${c ? 1 : .18}">${c ? face(c.mood)[1] : "·"}</span>`; }).join("")}</div></div>
    <div class="box"><div class="row" style="justify-content:space-between"><h3>Concerns</h3><button class="btn small" data-logc="${esc(sid)}">📝 Log a concern</button></div>${cs.length ? cTable(cs) : '<p class="note" style="margin:0">No concerns logged.</p>'}</div></div>`;
  dlg.querySelector("[data-x]").onclick = () => dlg.close(); bindCC(dlg);
  dlg.open || dlg.showModal();
}
