/* Nestopia · Inclusion: provision map, exam arrangements (from IEPs) and transition notes.
   Uses the globals of inclusion.html: sb, me, school, isMgr, studs, reg, plans, classes, esc, toast, dlg, fmt, stud, cls, regOf */
let intv = [], intvSt = [], trans = [];
const AREAS = ["Literacy", "Numeracy", "Speech and language", "Social and emotional", "Behaviour", "Physical and sensory", "English language (EAL)", "Challenge and extension", "Other"];
const MEASURES = ["Reading age", "Spelling age", "Phonics screening check score", "RWI assessment (group/level)", "Book band / running record", "Standardised score (e.g. GL / CAT4)", "Teacher assessment (1–7 attainment level)", "Baseline vs end-of-intervention test", "Times tables / number fluency check", "Writing sample against criteria", "Boxall Profile", "Speech and language checklist", "Behaviour / observation log", "Attendance"];
const IMPACT = { good: ["Good progress", "sage"], some: ["Some progress", "gt"], none: ["No change yet", "sod"] };
const acYear = () => { const d = new Date(), y = d.getMonth() >= 7 ? d.getFullYear() : d.getFullYear() - 1; return y + "–" + (y + 1); };

async function provLoad(){
  const sid = String(school.id);
  const [a, b, c] = await Promise.all([sb.from("inclusion_interventions").select("*").eq("school_id", sid).order("created_at", { ascending: false }),
    sb.from("inclusion_intervention_students").select("*").eq("school_id", sid), sb.from("inclusion_transitions").select("*").eq("school_id", sid)]);
  intv = a.data || []; intvSt = b.data || []; trans = c.data || []; return !a.error;
}

/* ---------- Provision map ---------- */
async function provPane(){
  const pane = document.getElementById("pane"); pane.innerHTML = '<div class="card"><p class="note">Loading…</p></div>';
  if (!(await provLoad())) { pane.innerHTML = '<div class="card"><div class="msg">The provision map needs its database step first. Please run the Inclusion provision update in Supabase.</div></div>'; return; }
  const members = id => intvSt.filter(x => x.intervention_id === id);
  const impactOf = id => { const m = members(id).filter(x => x.impact); return m.length ? Math.round(m.filter(x => x.impact === "good").length / m.length * 100) : null; };
  const byArea = AREAS.map(a => [a, intv.filter(i => (i.area || "Other") === a)]).filter(([, l]) => l.length);
  const running = intv.filter(i => i.status === "running"), inAny = new Set(intvSt.filter(x => running.some(i => i.id === x.intervention_id)).map(x => x.student_id));
  const regIds = reg.filter(r => r.active !== false).map(r => String(r.student_id)), noProv = regIds.filter(id => !inAny.has(id) && !plans.some(p => String(p.student_id) === id && p.status === "active"));
  pane.innerHTML = `<div class="metrics"><div class="metric"><span>Interventions running</span><b>${running.length}</b></div><div class="metric"><span>Students in an intervention</span><b>${inAny.size}</b></div>
      <div class="metric"><span>On the register with no plan or intervention</span><b style="color:${noProv.length ? "var(--red)" : "var(--plum)"}">${noProv.length}</b></div></div>
    <div class="card"><div class="row" style="justify-content:space-between"><h2>🧩 Provision map</h2><div class="row"><button class="btn ghost small" id="pmWord">⬇ Word</button><button class="btn small" id="pmNew">+ Add an intervention</button></div></div>
      <p class="note" style="margin-top:0">Every intervention, who it’s for, and whether it’s working. Record a starting and finishing measure for each student to show impact.</p>
      ${byArea.length ? byArea.map(([a, list]) => `<h3 style="color:var(--plum);margin:14px 0 6px">${esc(a)}</h3><div class="tablewrap"><table class="reg"><tr><th>Intervention</th><th class="hide-sm">Who and how often</th><th>Students</th><th>Impact</th><th>Status</th></tr>
        ${list.map(i => { const im = impactOf(i.id); return `<tr><td><button class="nm" data-iv="${i.id}">${esc(i.name)}</button>${i.start_date ? `<br><span class="note">${fmt(i.start_date)}${i.end_date ? " to " + fmt(i.end_date) : ""}</span>` : ""}</td><td class="hide-sm">${esc([i.staff, i.frequency, i.weeks ? i.weeks + " weeks" : ""].filter(Boolean).join(" · "))}</td>
          <td>${members(i.id).length}</td><td>${im == null ? '<span class="note">Not measured yet</span>' : `<b style="color:${im >= 60 ? "var(--sage)" : im >= 30 ? "var(--amber)" : "var(--red)"}">${im}%</b> <span class="note">good progress</span>`}</td><td><span class="tag ${i.status === "running" ? "eal" : "other"}">${{ planned: "Planned", running: "Running", finished: "Finished" }[i.status]}</span></td></tr>`; }).join("")}</table></div>`).join("")
        : '<p class="note" style="margin:0">No interventions yet.</p>'}</div>
    ${noProv.length ? `<div class="card"><h2>On the register with no plan or intervention <span class="note">(${noProv.length})</span></h2><p style="margin:0">${noProv.map(id => `<span class="tag other">${esc((stud(id) || {}).full_name || "Student")}</span>`).join("")}</p></div>` : ""}`;
  document.getElementById("pmNew").onclick = () => editIntv(null);
  pane.querySelectorAll("[data-iv]").forEach(b => b.onclick = () => editIntv(intv.find(i => i.id === b.dataset.iv)));
  document.getElementById("pmWord").onclick = () => {
    const html = `<!doctype html><html><head><meta charset="utf-8"><style>body{font-family:Arial,sans-serif}h1{color:#462D5B}td,th{border:1px solid #bbb;padding:6px;text-align:left;font-size:10pt}table{border-collapse:collapse;width:100%}th{background:#EDE6F5}</style></head><body>
      <h1>Provision map ${esc(acYear())}</h1><p>${esc(school.name)}</p><table><tr><th>Area</th><th>Intervention</th><th>Who and how often</th><th>Students</th><th>Good progress</th><th>Status</th></tr>
      ${intv.map(i => `<tr><td>${esc(i.area || "Other")}</td><td>${esc(i.name)}</td><td>${esc([i.staff, i.frequency, i.weeks ? i.weeks + " weeks" : ""].filter(Boolean).join(" · "))}</td><td>${members(i.id).length}</td><td>${impactOf(i.id) == null ? "–" : impactOf(i.id) + "%"}</td><td>${esc(i.status)}</td></tr>`).join("")}</table></body></html>`;
    const a = document.createElement("a"); a.href = URL.createObjectURL(new Blob(["\ufeff" + html], { type: "application/msword" })); a.download = "Provision map " + acYear() + ".doc"; document.body.appendChild(a); a.click(); a.remove(); };
}
function editIntv(i){
  const m = i ? intvSt.filter(x => x.intervention_id === i.id) : [], regStuds = reg.filter(r => r.active !== false).map(r => stud(r.student_id)).filter(Boolean).sort((a, b) => a.full_name.localeCompare(b.full_name));
  const others = studs.filter(s => !regStuds.includes(s));
  const opt = s => `<option value="${esc(s.id)}">${esc(s.full_name)}${cls(s.class_id) ? " · " + esc(cls(s.class_id).name) : ""}</option>`;
  const mrow = x => { const s = stud(x.student_id) || { full_name: "Student" }; return `<tr data-st="${esc(x.student_id)}"><td>${esc(s.full_name)}</td><td><input data-en value="${esc(x.entry || "")}" placeholder="e.g. reading age 6.2" style="width:120px"></td><td><input data-ex value="${esc(x.exit || "")}" style="width:120px"></td>
    <td><select data-im><option value="">–</option>${Object.entries(IMPACT).map(([k, v]) => `<option value="${k}" ${x.impact === k ? "selected" : ""}>${v[0]}</option>`).join("")}</select></td><td><button type="button" class="btn ghost small" data-rm>✕</button></td></tr>`; };
  dlg.innerHTML = `<form class="dlg"><h2>${i ? "Intervention" : "Add an intervention"}</h2>
    <div class="two"><label class="f">Name <input type="text" name="n" required value="${esc(i ? i.name : "")}" placeholder="For example: Phonics catch-up group"></label><label class="f">Area <select name="a">${AREAS.map(a => `<option ${i && i.area === a ? "selected" : ""}>${a}</option>`).join("")}</select></label></div>
    <div class="two"><label class="f">Who runs it <input type="text" name="s" value="${esc(i ? i.staff || "" : "")}" placeholder="LSA, SENCO, speech therapist"></label><label class="f">How often <input type="text" name="fq" value="${esc(i ? i.frequency || "" : "")}" placeholder="3 × 20 minutes a week"></label></div>
    <div class="two"><label class="f">Starts <input type="date" name="sd" value="${esc(i ? i.start_date || "" : "")}"></label><label class="f">Ends <input type="date" name="ed" value="${esc(i ? i.end_date || "" : "")}"></label></div>
    <div class="two"><label class="f">How progress is measured ${(() => { const cur = i ? i.measure || "" : "", oth = cur && !MEASURES.includes(cur); return `<select name="ms"><option value="">Choose…</option>${MEASURES.map(m => `<option ${cur === m ? "selected" : ""}>${esc(m)}</option>`).join("")}<option value="__other" ${oth ? "selected" : ""}>Other (please specify)</option></select><input type="text" name="mso" value="${esc(oth ? cur : "")}" placeholder="Type how progress is measured" style="margin-top:6px;${oth ? "" : "display:none"}">`; })()}</label><label class="f">Status <select name="st">${["planned", "running", "finished"].map(k => `<option value="${k}" ${(i ? i.status : "running") === k ? "selected" : ""}>${{ planned: "Planned", running: "Running", finished: "Finished" }[k]}</option>`).join("")}</select></label></div>
    <div><b>Students</b> <span class="note">(add a starting measure now, and a finishing measure and impact at the end)</span>
      <div class="tablewrap"><table class="reg" id="mt"><tr><th>Student</th><th>Start</th><th>End</th><th>Impact</th><th></th></tr>${m.map(mrow).join("")}</table></div>
      <div class="row" style="margin-top:6px"><select id="addSt"><option value="">Add a student…</option><optgroup label="On the inclusion register">${regStuds.map(opt).join("")}</optgroup><optgroup label="Other students">${others.map(opt).join("")}</optgroup></select></div></div>
    <div class="row" style="justify-content:space-between"><div>${i ? '<button type="button" class="btn ghost small" id="delI">Delete</button>' : ""}</div><div class="row"><button type="button" class="btn ghost" data-x>Cancel</button><button class="btn">Save</button></div></div></form>`;
  const f = dlg.querySelector("form"), mt = document.getElementById("mt");
  dlg.querySelector("[data-x]").onclick = () => dlg.close();
  f.ms.onchange = () => { const o = f.ms.value === "__other"; f.mso.style.display = o ? "" : "none"; if (o) f.mso.focus(); };
  document.getElementById("addSt").onchange = e => { const v = e.target.value; if (v && !mt.querySelector(`[data-st="${v}"]`)) mt.insertAdjacentHTML("beforeend", mrow({ student_id: v })); e.target.value = ""; };
  mt.onclick = e => { const r = e.target.closest("[data-rm]"); if (r) r.closest("tr").remove(); };
  const di = document.getElementById("delI"); if (di) di.onclick = async () => { if (!confirm("Delete this intervention?")) return; await sb.from("inclusion_interventions").delete().eq("id", i.id); dlg.close(); provPane(); };
  f.onsubmit = async e => { e.preventDefault();
    const row = { school_id: String(school.id), name: f.n.value.trim(), area: f.a.value, staff: f.s.value.trim() || null, frequency: f.fq.value.trim() || null, start_date: f.sd.value || null, end_date: f.ed.value || null, measure: (f.ms.value === "__other" ? f.mso.value.trim() : f.ms.value) || null, status: f.st.value };
    if (row.start_date && row.end_date) row.weeks = Math.max(1, Math.round((new Date(row.end_date) - new Date(row.start_date)) / (7 * 864e5)));
    const res = i ? await sb.from("inclusion_interventions").update(row).eq("id", i.id).select().single() : await sb.from("inclusion_interventions").insert(row).select().single();
    if (res.error) return toast(res.error.message);
    const id = res.data.id, rows = [...mt.querySelectorAll("[data-st]")].map(r => ({ intervention_id: id, student_id: r.dataset.st, school_id: String(school.id), entry: r.querySelector("[data-en]").value.trim() || null, exit: r.querySelector("[data-ex]").value.trim() || null, impact: r.querySelector("[data-im]").value || null }));
    const gone = m.map(x => x.student_id).filter(s => !rows.some(r => r.student_id === s));
    if (gone.length) await sb.from("inclusion_intervention_students").delete().eq("intervention_id", id).in("student_id", gone);
    if (rows.length) { const { error } = await sb.from("inclusion_intervention_students").upsert(rows, { onConflict: "intervention_id,student_id" }); if (error) return toast(error.message); }
    dlg.close(); toast("Saved"); provPane(); };
  dlg.showModal();
}

/* ---------- Exam arrangements, gathered from every active IEP ---------- */
function examPane(){
  const pane = document.getElementById("pane");
  const rows = plans.filter(p => p.status === "active" && stud(p.student_id)).map(p => { const d = p.doc || {}; return [stud(p.student_id), [...(d.exam || []), d.exam_other].filter(Boolean)]; }).filter(([, a]) => a.length);
  const by = {}; rows.forEach(([s, a]) => { const k = String(s.id); by[k] = by[k] || [s, new Set()]; a.forEach(x => by[k][1].add(x)); });
  const list = Object.values(by).sort((a, b) => String((cls(a[0].class_id) || {}).name).localeCompare(String((cls(b[0].class_id) || {}).name), undefined, { numeric: true }) || a[0].full_name.localeCompare(b[0].full_name));
  const counts = {}; list.forEach(([, a]) => a.forEach(x => counts[x] = (counts[x] || 0) + 1));
  pane.innerHTML = `<div class="card"><div class="row" style="justify-content:space-between"><h2>📝 Exam arrangements</h2>${list.length ? '<button class="btn ghost small" id="exWord">⬇ Word: list for exam week</button>' : ""}</div>
    <p class="note" style="margin-top:0">Made automatically from the exam and assessment arrangements ticked in each student’s IEP. To change one, edit the student’s IEP.</p>
    ${list.length ? `<p style="margin:0 0 10px">${Object.entries(counts).sort((a, b) => b[1] - a[1]).map(([k, n]) => `<span class="tag eal">${esc(k)} · ${n}</span>`).join("")}</p>
      <div class="tablewrap"><table class="reg"><tr><th>Class</th><th>Student</th><th>Arrangements</th></tr>${list.map(([s, a]) => `<tr><td>${esc((cls(s.class_id) || {}).name || "")}</td><td><b>${esc(s.full_name)}</b></td><td>${[...a].map(x => `<span class="tag other">${esc(x)}</span>`).join("")}</td></tr>`).join("")}</table></div>`
      : '<p class="note" style="margin:0">No exam arrangements yet. Add them in each student’s IEP (Exam and assessment arrangements).</p>'}</div>`;
  const w = document.getElementById("exWord"); if (w) w.onclick = () => {
    const html = `<!doctype html><html><head><meta charset="utf-8"><style>body{font-family:Arial,sans-serif}h1{color:#462D5B}td,th{border:1px solid #bbb;padding:6px;text-align:left;font-size:10.5pt}table{border-collapse:collapse;width:100%}th{background:#EDE6F5}</style></head><body>
      <h1>Exam arrangements</h1><p>${esc(school.name)} · ${new Date().toLocaleDateString("en-GB")} · Confidential: for staff running assessments</p><table><tr><th>Class</th><th>Student</th><th>Arrangements</th><th>Done ✓</th></tr>
      ${list.map(([s, a]) => `<tr><td>${esc((cls(s.class_id) || {}).name || "")}</td><td>${esc(s.full_name)}</td><td>${esc([...a].join("; "))}</td><td></td></tr>`).join("")}</table></body></html>`;
    const a = document.createElement("a"); a.href = URL.createObjectURL(new Blob(["\ufeff" + html], { type: "application/msword" })); a.download = "Exam arrangements.doc"; document.body.appendChild(a); a.click(); a.remove(); };
}

/* ---------- Transition notes ---------- */
async function transPane(){
  const pane = document.getElementById("pane"); pane.innerHTML = '<div class="card"><p class="note">Loading…</p></div>';
  if (!(await provLoad())) { pane.innerHTML = '<div class="card"><div class="msg">Transition notes need their database step first. Please run the Inclusion provision update in Supabase.</div></div>'; return; }
  const yr = acYear(), list = reg.filter(r => r.active !== false && stud(r.student_id)).map(r => stud(r.student_id)).sort((a, b) => String((cls(a.class_id) || {}).name).localeCompare(String((cls(b.class_id) || {}).name), undefined, { numeric: true }) || a.full_name.localeCompare(b.full_name));
  const noteOf = id => trans.find(t => t.student_id === String(id) && t.year === yr), done = list.filter(s => noteOf(s.id)).length;
  pane.innerHTML = `<div class="card"><div class="row" style="justify-content:space-between"><h2>🔄 Transition notes · ${esc(yr)}</h2><span class="note">${done} of ${list.length} written</span></div>
    <p class="note" style="margin-top:0">A short handover for each student on the register, for next year’s teachers. They see it on the student in Inclusion.</p>
    ${list.length ? `<div class="tablewrap"><table class="reg"><tr><th>Student</th><th>Class</th><th>Note</th></tr>${list.map(s => { const n = noteOf(s.id); return `<tr><td><b>${esc(s.full_name)}</b></td><td>${esc((cls(s.class_id) || {}).name || "")}</td><td>${n ? `<span class="tag eal">✓ Written</span> ` : ""}<button class="btn ghost small" data-tn="${esc(s.id)}">${n ? "Edit" : "Write"}</button></td></tr>`; }).join("")}</table></div>` : '<p class="note" style="margin:0">No students on the register.</p>'}</div>`;
  pane.querySelectorAll("[data-tn]").forEach(b => b.onclick = () => editTrans(b.dataset.tn));
}
function editTrans(sid){
  const yr = acYear(), n = trans.find(t => t.student_id === String(sid) && t.year === yr) || {}, s = stud(sid);
  dlg.innerHTML = `<form class="dlg"><h2>🔄 Transition note · ${esc(s.full_name)}</h2><p class="note" style="margin-top:0">${esc(yr)} · for next year’s teachers</p>
    <label class="f">What works well <textarea name="w" rows="3" placeholder="For example: short tasks with a visual timer; praise in private">${esc(n.works || "")}</textarea></label>
    <label class="f">Strategies to keep using <textarea name="s" rows="3">${esc(n.strategies || "")}</textarea></label>
    <label class="f">Things to watch <textarea name="t" rows="2" placeholder="For example: anxious at the start of term; struggles with change">${esc(n.watch || "")}</textarea></label>
    <label class="f">Who to contact <input type="text" name="c" value="${esc(n.contact || "")}" placeholder="SENCO, speech therapist, a parent’s preferred contact"></label>
    <div class="row" style="justify-content:flex-end"><button type="button" class="btn ghost" data-x>Cancel</button><button class="btn">Save</button></div></form>`;
  const f = dlg.querySelector("form"); dlg.querySelector("[data-x]").onclick = () => dlg.close();
  f.onsubmit = async e => { e.preventDefault(); const { error } = await sb.from("inclusion_transitions").upsert({ student_id: String(sid), school_id: String(school.id), year: yr, works: f.w.value.trim() || null, strategies: f.s.value.trim() || null, watch: f.t.value.trim() || null, contact: f.c.value.trim() || null, updated_by: me.id, updated_at: new Date().toISOString() }, { onConflict: "student_id,year" });
    if (error) return toast(error.message); dlg.close(); toast("Saved"); if (document.getElementById("pane")) transPane(); };
  dlg.showModal();
}
/* On a student's Inclusion record: their interventions and the latest transition note */
async function provStudentHtml(sid){
  try { const [a, b] = await Promise.all([sb.from("inclusion_intervention_students").select("*, inclusion_interventions(name,frequency,status)").eq("student_id", String(sid)), sb.from("inclusion_transitions").select("*").eq("student_id", String(sid)).order("year", { ascending: false }).limit(1)]);
    const iv = (a.data || []).filter(x => x.inclusion_interventions), t = (b.data || [])[0];
    return `${iv.length ? `<div class="box"><h3>🧩 Interventions</h3>${iv.map(x => `<p style="margin:4px 0">${esc(x.inclusion_interventions.name)} <span class="note">· ${esc(x.inclusion_interventions.frequency || "")}${x.impact ? " · " + IMPACT[x.impact][0] : ""}</span></p>`).join("")}</div>` : ""}
      ${t ? `<div class="box"><h3>🔄 Transition note (${esc(t.year)})</h3>${t.works ? `<p style="margin:4px 0"><b>What works:</b> ${esc(t.works)}</p>` : ""}${t.strategies ? `<p style="margin:4px 0"><b>Strategies:</b> ${esc(t.strategies)}</p>` : ""}${t.watch ? `<p style="margin:4px 0"><b>Watch for:</b> ${esc(t.watch)}</p>` : ""}${t.contact ? `<p class="note" style="margin:4px 0">Contact: ${esc(t.contact)}</p>` : ""}</div>` : ""}`; } catch (_) { return ""; }
}
