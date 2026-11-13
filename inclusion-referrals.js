/* Nestopia · Inclusion referrals
   Teacher refers a student → inclusion head reviews and assigns → team member proposes an observation time on the
   shared calendar → teacher confirms or reschedules → team member writes observation feedback → head decides the outcome
   → (if needed) parent meeting on the calendar → next steps recorded → added to the register with an IEP.
   Uses the globals of inclusion.html: sb, me, school, isMgr, staff, studs, esc, toast, dlg, fmt, stud, cls, regOf, load, render, openEntry, openPlan */

let refs = [], events = [], obsv = [];
const CONCERNS = ["Reading and writing", "Maths", "Speech, language and communication", "Attention and focus", "Behaviour", "Social and emotional", "Physical or sensory", "English language (EAL)", "Very able: needs more challenge", "Attendance or wellbeing", "Other"];
const URGENCY = { routine: "Routine", soon: "Soon (within 2 weeks)", urgent: "Urgent" };
const OUTCOMES = { strategies: "Strategies for the class teacher", monitor: "Monitor and review later", external: "Refer to an outside specialist", register: "Add to the inclusion register" };
const REF_STATUS = {
  submitted: ["Waiting for the inclusion head", "amber"], more_info: ["More information requested", "amber"], declined: ["Not taken forward", "other"],
  assigned: ["Assigned: observation time being arranged", "blue"], scheduling: ["Observation time waiting for confirmation", "amber"], scheduled: ["Observation booked", "blue"],
  observed: ["Observed: feedback with the inclusion head", "blue"], meeting: ["Parent meeting being arranged", "blue"], next_steps: ["Parent meeting held: next steps", "blue"], closed: ["Closed", "sage"]
};
const isHead = () => ["school_lead", "admin"].includes(me.role) || !!me.inclusion_head;
const nameOf = id => (staff.find(p => p.id === id) || {}).full_name || "";
const dt = s => s ? new Date(s).toLocaleString("en-GB", { weekday: "short", day: "numeric", month: "short", hour: "numeric", minute: "2-digit" }) : "";
const toLocal = iso => { if (!iso) return ""; const d = new Date(iso); d.setMinutes(d.getMinutes() - d.getTimezoneOffset()); return d.toISOString().slice(0, 16); };
const refTag = r => { const s = REF_STATUS[r.status] || [r.status, "other"]; return `<span class="tag ${({ amber: "gt", blue: "eal", sage: "sod", other: "other" })[s[1]]}">${esc(r.status === "closed" && r.outcome ? "Closed: " + OUTCOMES[r.outcome] : s[0])}</span>`; };
const evOf = r => events.filter(e => String(e.referral_id) === String(r.id) && e.status !== "cancelled").sort((a, b) => (b.created_at || "").localeCompare(a.created_at || ""));
const obsOf = r => obsv.find(o => String(o.referral_id) === String(r.id));

async function refLoad(){
  const sid = school.id;
  const get = async (t, order) => { const out = []; for (let f = 0; ; f += 1000) { const { data, error } = await sb.from(t).select("*").eq("school_id", sid).order(order, { ascending: false }).range(f, f + 999); if (error) return out; out.push(...data); if (data.length < 1000) break; } return out; };
  [refs, events, obsv] = await Promise.all([get("inclusion_referrals", "created_at"), get("inclusion_events", "starts_at"), get("inclusion_observations", "created_at")]);
}

/* ===== Teacher: refer a student ===== */
function openReferral(rid){
  const r = rid ? refs.find(x => String(x.id) === String(rid)) : null;
  dlg.innerHTML = `<form class="dlg"><h2>${r ? "Edit referral" : "🙋 Refer a student to the inclusion team"}</h2>
    <p class="note" style="margin:0">The inclusion head will review this and may ask a team member to observe the student in your lesson.</p>
    ${r ? `<p><b>${esc(stud(r.student_id).full_name)}</b></p>` : `<label class="f">Student <select name="s" required><option value="">Choose…</option>${studs.map(s => `<option value="${esc(s.id)}">${esc(s.full_name)}${cls(s.class_id) ? " · " + esc(cls(s.class_id).name) : ""}</option>`).join("")}</select></label>`}
    ${r && r.status === "more_info" && r.head_note ? `<div class="box"><b>The inclusion head asked:</b> ${esc(r.head_note)}</div>` : ""}
    <div><b>Areas of concern</b><div class="checks">${CONCERNS.map(c => `<label><input type="checkbox" name="c" value="${esc(c)}" ${r && (r.concerns || []).includes(c) ? "checked" : ""}> ${esc(c)}</label>`).join("")}</div></div>
    <label class="f">What have you noticed? <textarea name="d" rows="4" required placeholder="Specific examples: what happens, when, how often">${esc(r ? r.details || "" : "")}</textarea></label>
    <label class="f">What have you already tried? <textarea name="t" rows="3" placeholder="For example: seating change, visual timetable, small-group support, talking with parents">${esc(r ? r.tried || "" : "")}</textarea></label>
    <label class="f">How is it affecting learning or wellbeing? <textarea name="i" rows="2">${esc(r ? r.impact || "" : "")}</textarea></label>
    <div class="two"><label class="f">How urgent is it? <select name="u">${Object.entries(URGENCY).map(([k, v]) => `<option value="${k}" ${(r ? r.urgency : "routine") === k ? "selected" : ""}>${v}</option>`).join("")}</select></label>
      <div class="checks" style="align-self:end"><label><input type="checkbox" name="p" ${r && r.parent_aware ? "checked" : ""}> Parents are aware of my concern</label></div></div>
    <div class="msg" id="rerr" hidden></div>
    <div class="row" style="justify-content:flex-end"><button type="button" class="btn ghost" data-x>Cancel</button><button class="btn">${r ? "Send again" : "Send to the inclusion head"}</button></div></form>`;
  const f = dlg.querySelector("form"); dlg.querySelector("[data-x]").onclick = () => dlg.close();
  f.onsubmit = async e => {
    e.preventDefault(); const err = document.getElementById("rerr"); err.hidden = true;
    const concerns = [...f.querySelectorAll("input[name=c]:checked")].map(x => x.value);
    if (!concerns.length) { err.textContent = "Tick at least one area of concern."; err.hidden = false; return; }
    const row = { concerns, details: f.d.value.trim(), tried: f.t.value.trim() || null, impact: f.i.value.trim() || null, urgency: f.u.value, parent_aware: f.p.checked, status: "submitted", updated_at: new Date().toISOString() };
    const { data: saved, error } = r ? await sb.from("inclusion_referrals").update(row).eq("id", r.id).select("id").single() : await sb.from("inclusion_referrals").insert(Object.assign(row, { school_id: school.id, student_id: f.s.value, teacher_id: me.id })).select("id").single();
    if (!error && window.nestMail) nestMail("referral", saved ? saved.id : r && r.id);
    if (error) { err.textContent = /inclusion_referrals/.test(error.message) ? "Please run the referrals database step first." : error.message; err.hidden = false; return; }
    dlg.close(); await refLoad(); render(); toast("Sent to the inclusion head");
  };
  dlg.showModal();
}

/* What each person needs to do next (also used for the home page reminder) */
function myTasks(){
  const t = [];
  refs.forEach(r => {
    const ev = evOf(r)[0];
    if (r.teacher_id === me.id && r.status === "more_info") t.push([r, "Add the information the inclusion head asked for"]);
    if (ev && ev.teacher_id === me.id && ev.status === "proposed" && ev.proposed_by !== me.id) t.push([r, (ev.kind === "parent_meeting" ? "Confirm the parent meeting time" : "Confirm the observation time") + " (" + dt(ev.starts_at) + ")"]);
    if (ev && ev.staff_id === me.id && ev.status === "reschedule") t.push([r, "The teacher suggested another time"]);
    if (isHead() && r.status === "submitted") t.push([r, "New referral to review"]);
    if (isHead() && r.status === "observed") t.push([r, "Observation feedback to read and decide next steps"]);
    if (r.assigned_to === me.id && r.status === "assigned") t.push([r, "Propose an observation time"]);
    if (r.assigned_to === me.id && r.status === "scheduled" && ev && ev.kind === "observation" && new Date(ev.starts_at) < new Date() && !obsOf(r)) t.push([r, "Write the observation feedback"]);
    if ((isHead() || r.assigned_to === me.id) && r.status === "meeting" && ev && ev.kind === "parent_meeting" && ev.status === "confirmed" && new Date(ev.starts_at) < new Date()) t.push([r, "Record the parent meeting and next steps"]);
    if ((isHead() || r.assigned_to === me.id) && r.status === "next_steps") t.push([r, "Add to the register and write the IEP"]);
  });
  return t;
}
function tasksHtml(){
  const t = myTasks(); if (!t.length) return "";
  return `<div class="card" style="border-left:5px solid var(--amber)"><h2>Your next steps <span class="note">(${t.length})</span></h2>${t.map(([r, what]) => `<div class="row" style="justify-content:space-between;border-bottom:1px solid var(--line);padding:8px 0"><span><b>${esc(stud(r.student_id) ? stud(r.student_id).full_name : "Student")}</b>: ${esc(what)}</span><button class="btn small" data-ref="${esc(r.id)}">Open</button></div>`).join("")}</div>`;
}

/* Teacher's Inclusion page: their referrals and requests */
function refTeacherHtml(){
  const mine = refs.filter(r => r.teacher_id === me.id || events.some(e => String(e.referral_id) === String(r.id) && e.teacher_id === me.id));
  return tasksHtml() + `<div class="card"><div class="row" style="justify-content:space-between"><h2>My referrals</h2><button class="btn" id="newref">🙋 Refer a student</button></div>
    ${mine.length ? `<div class="tablewrap"><table class="reg"><tr><th>Student</th><th>Sent</th><th>Where it is now</th></tr>${mine.map(r => `<tr><td><button class="nm" data-ref="${esc(r.id)}">${esc(stud(r.student_id) ? stud(r.student_id).full_name : "Student")}</button></td><td>${fmt((r.created_at || "").slice(0, 10))}</td><td>${refTag(r)}</td></tr>`).join("")}</table></div>`
      : '<p class="note" style="margin:0">If you’re worried about a student, refer them here. The inclusion team will follow it up with you.</p>'}</div>`;
}
function refBind(root){
  const nr = root.querySelector("#newref"); if (nr) nr.onclick = () => openReferral(null);
  root.querySelectorAll("[data-ref]").forEach(b => b.onclick = () => openRefCase(b.dataset.ref));
}

/* ===== One referral: the whole story, with the right buttons for each person ===== */
function openRefCase(rid){
  const r = refs.find(x => String(x.id) === String(rid)); if (!r) return;
  if (window.nestLog) nestLog("referral", r.id, r.student_id);
  const s = stud(r.student_id) || { full_name: "Student" }, evs = evOf(r), ev = evs[0], o = obsOf(r), head = isHead(), mine = r.assigned_to === me.id, teacher = r.teacher_id === me.id;
  const step = (done, txt) => `<li style="color:${done ? "var(--ink)" : "var(--muted)"}">${done ? "✅" : "⬜"} ${txt}</li>`;
  const order = ["submitted", "assigned", "scheduling", "scheduled", "observed", "meeting", "next_steps", "closed"], at = order.indexOf(r.status);
  let act = "";
  if (head && ["submitted", "more_info"].includes(r.status)) act += `<div class="box"><h3>Review</h3><label class="f">Assign to <select id="asg">${staff.filter(p => p.inclusion_lead || p.inclusion_head || ["school_lead", "coordinator"].includes(p.role)).map(p => `<option value="${p.id}" ${r.assigned_to === p.id ? "selected" : ""}>${esc(p.full_name || p.email)}</option>`).join("")}</select></label>
      <label class="f" style="margin-top:8px">Note (the team member and teacher will see it) <textarea id="hnote" rows="2">${esc(r.head_note || "")}</textarea></label>
      <div class="row" style="margin-top:8px"><button class="btn" id="doAssign">Assign and ask for an observation</button><button class="btn ghost" id="doInfo">Ask the teacher for more information</button><button class="btn ghost" id="doDecline">Don’t take forward</button></div></div>`;
  if (mine && ["assigned", "scheduling", "scheduled"].includes(r.status) && (!ev || ev.kind === "observation")) act += `<div class="box"><h3>Observation time</h3>
      ${ev && ev.status === "reschedule" ? `<p style="margin:0 0 8px"><b>The teacher suggested:</b> ${dt(ev.suggested_at)}${ev.response_note ? " · “" + esc(ev.response_note) + "”" : ""}</p><button class="btn small" id="takeSug">Accept this time</button>` : ""}
      ${!ev || ev.status === "reschedule" ? propForm("observation") : ev.status === "proposed" ? `<p class="note" style="margin:0">Waiting for the teacher to confirm ${dt(ev.starts_at)}.</p>` : `<p class="note" style="margin:0">Booked for ${dt(ev.starts_at)}.</p>`}
      ${r.status === "scheduled" && !o ? `<p style="margin:10px 0 0"><button class="btn" id="writeObs">Write the observation feedback</button></p>` : ""}</div>`;
  if (ev && ev.teacher_id === me.id && ev.status === "proposed" && ev.proposed_by !== me.id) act += `<div class="box"><h3>${ev.kind === "parent_meeting" ? "Parent meeting" : "Observation"} request</h3><p style="margin:0 0 8px">${esc(nameOf(ev.staff_id) || "The inclusion team")} proposed <b>${dt(ev.starts_at)}</b>${ev.location ? " · " + esc(ev.location) : ""}.</p>
      <div class="row"><button class="btn" id="evOk">✅ Confirm</button></div>
      <div class="two" style="margin-top:10px"><label class="f">Or suggest another time <input type="datetime-local" id="sugAt"></label><label class="f">Note <input type="text" id="sugNote" placeholder="For example: I teach PE then; Tuesday after break works"></label></div><button class="btn ghost small" id="evSug" style="margin-top:8px">Suggest this time</button></div>`;
  if (teacher && r.status === "more_info") act += `<div class="box"><p style="margin:0 0 8px"><b>The inclusion head asked:</b> ${esc(r.head_note || "")}</p><button class="btn" id="editRef">Add the information</button></div>`;
  if (head && r.status === "observed") act += `<div class="box"><h3>Decide next steps</h3><div class="checks">${Object.entries(OUTCOMES).map(([k, v]) => `<label><input type="radio" name="oc" value="${k}" ${o && o.recommendation === k ? "checked" : ""}> ${v}</label>`).join("")}</div>
      <label class="f" style="margin-top:8px">Message to the class teacher (strategies, or what happens next) <textarea id="ocNote" rows="3">${esc(o ? o.strategies || "" : "")}</textarea></label><button class="btn" id="doOutcome" style="margin-top:8px">Save next steps</button></div>`;
  if ((head || mine) && r.status === "meeting" && (!ev || ev.kind !== "parent_meeting" || ev.status === "reschedule")) act += `<div class="box"><h3>Parent meeting</h3>${ev && ev.kind === "parent_meeting" && ev.status === "reschedule" ? `<p style="margin:0 0 8px"><b>The teacher suggested:</b> ${dt(ev.suggested_at)}${ev.response_note ? " · “" + esc(ev.response_note) + "”" : ""}</p><button class="btn small" id="takeSug">Accept this time</button>` : ""}${propForm("parent_meeting")}</div>`;
  if ((head || mine) && r.status === "meeting" && ev && ev.kind === "parent_meeting" && ev.status === "confirmed") act += `<div class="box"><h3>Parent meeting booked: ${dt(ev.starts_at)}</h3><p class="note" style="margin:0 0 8px">With ${esc(ev.attendees || "the parents")}, ${esc(nameOf(ev.staff_id))} and ${esc(nameOf(ev.teacher_id))}.</p><button class="btn" id="recMeet">Record the meeting and next steps</button></div>`;
  if ((head || mine) && r.status === "next_steps") act += `<div class="box"><h3>Last step</h3><p class="note" style="margin:0 0 8px">Add ${esc(s.full_name)} to the inclusion register, then write the IEP or other plan. The plan’s review date will appear in “Reviews due”.</p><button class="btn" id="toReg">Add to the register and write the plan</button></div>`;
  dlg.innerHTML = `<div class="dlg"><div class="row" style="justify-content:space-between;align-items:flex-start"><div><h2>Referral: ${esc(s.full_name)}</h2><p class="note" style="margin:2px 0 0">${esc((cls(s.class_id) || {}).name || "")} · from ${esc(nameOf(r.teacher_id) || "a teacher")} · ${fmt((r.created_at || "").slice(0, 10))} · ${esc(URGENCY[r.urgency] || "")}</p></div><button class="btn ghost small" data-x>Close</button></div>
    <p style="margin:0">${refTag(r)}${r.assigned_to ? ` <span class="note">Assigned to ${esc(nameOf(r.assigned_to))}</span>` : ""}</p>
    <ul style="list-style:none;padding:0;margin:0;display:grid;gap:3px;font-size:14px">${step(true, "Referred by the teacher")}${step(at >= 1, "Reviewed and assigned by the inclusion head")}${step(at >= 3, "Observation booked")}${step(at >= 4 || !!o, "Observation feedback written")}${step(at >= 5 || r.status === "closed", "Next steps decided")}${r.outcome === "register" || at >= 5 ? step(at >= 6, "Parent meeting held") + step(r.status === "closed" && r.outcome === "register", "On the register with a plan") : ""}</ul>
    ${act}
    <div class="box"><h3>The concern</h3><p style="margin:0">${(r.concerns || []).map(c => `<span class="tag other">${esc(c)}</span>`).join("")}</p><p style="margin:8px 0 0">${esc(r.details || "")}</p>${r.tried ? `<p class="note" style="margin:6px 0 0"><b>Already tried:</b> ${esc(r.tried)}</p>` : ""}${r.impact ? `<p class="note" style="margin:6px 0 0"><b>Impact:</b> ${esc(r.impact)}</p>` : ""}<p class="note" style="margin:6px 0 0">${r.parent_aware ? "Parents are aware." : "Parents are not aware yet."}</p></div>
    ${r.head_note && r.status !== "more_info" ? `<div class="box"><b>Inclusion head’s note:</b> ${esc(r.head_note)}</div>` : ""}
    ${r.decline_reason ? `<div class="box"><b>Why it wasn’t taken forward:</b> ${esc(r.decline_reason)}</div>` : ""}
    ${o && (isMgr) ? `<div class="box"><h3>Observation feedback · ${esc(nameOf(o.observer_id))} · ${fmt((o.observed_on || "").slice(0, 10))}</h3>${o.lesson ? `<p class="note" style="margin:0">${esc(o.lesson)}</p>` : ""}<p style="margin:6px 0 0"><b>Strengths:</b> ${esc(o.strengths || "–")}</p><p style="margin:6px 0 0"><b>Difficulties seen:</b> ${esc(o.difficulties || "–")}</p><p style="margin:6px 0 0"><b>Strategies tried or suggested:</b> ${esc(o.strategies || "–")}</p><p style="margin:6px 0 0"><b>Recommendation:</b> ${esc(OUTCOMES[o.recommendation] || "")}${o.notes ? " · " + esc(o.notes) : ""}</p></div>` : ""}
    ${r.outcome_note ? `<div class="box"><b>Next steps from the inclusion team:</b> ${esc(r.outcome_note)}</div>` : ""}
    ${evs.length ? `<div class="box"><h3>Calendar</h3>${evs.map(e => `<p style="margin:4px 0" class="note">${e.kind === "parent_meeting" ? "👪 Parent meeting" : "👀 Observation"} · ${dt(e.starts_at)} · ${esc({ proposed: "waiting for confirmation", confirmed: "confirmed", reschedule: "new time suggested", done: "done", cancelled: "cancelled" }[e.status] || e.status)}</p>`).join("")}</div>` : ""}</div>`;
  const $ = id => document.getElementById(id), upd = async (row) => { const { error } = await sb.from("inclusion_referrals").update(Object.assign(row, { updated_at: new Date().toISOString() })).eq("id", r.id); if (error) { toast(error.message); return false; } if (window.nestMail) nestMail("referral", r.id); return true; };
  const done = async (msg) => { await refLoad(); render(); openRefCase(r.id); toast(msg); };
  dlg.querySelector("[data-x]").onclick = () => dlg.close();
  if ($("doAssign")) $("doAssign").onclick = async () => { if (await upd({ status: "assigned", assigned_to: $("asg").value, head_note: $("hnote").value.trim() || null, reviewed_by: me.id })) done("Assigned"); };
  if ($("doInfo")) $("doInfo").onclick = async () => { if (!$("hnote").value.trim()) return toast("Write what you’d like to know in the note."); if (await upd({ status: "more_info", head_note: $("hnote").value.trim(), reviewed_by: me.id })) done("Sent back to the teacher"); };
  if ($("doDecline")) $("doDecline").onclick = async () => { const why = prompt("Why isn’t it being taken forward? The teacher will see this, so suggest what they can do in class.", ""); if (!why) return; if (await upd({ status: "declined", decline_reason: why.trim(), reviewed_by: me.id })) done("Saved"); };
  if ($("editRef")) $("editRef").onclick = () => openReferral(r.id);
  if ($("propose")) $("propose").onclick = async () => {
    const at = $("pAt").value, mins = +$("pLen").value || 30; if (!at) return toast("Choose a date and time.");
    const kind = $("propose").dataset.kind, st = new Date(at);
    if (ev && ["proposed", "reschedule"].includes(ev.status)) await sb.from("inclusion_events").update({ status: "cancelled" }).eq("id", ev.id);
    const { data: newEv, error } = await sb.from("inclusion_events").insert({ school_id: school.id, referral_id: r.id, student_id: r.student_id, kind, starts_at: st.toISOString(), ends_at: new Date(st.getTime() + mins * 60e3).toISOString(), location: $("pLoc").value.trim() || null, attendees: $("pWho") ? $("pWho").value.trim() || null : null, teacher_id: r.teacher_id, staff_id: r.assigned_to || me.id, proposed_by: me.id, status: "proposed" }).select("id").single();
    if (!error && newEv && window.nestMail) nestMail("event", newEv.id);
    if (error) return toast(/inclusion_events/.test(error.message) ? "Please run the referrals database step first." : error.message);
    if (kind === "observation") await upd({ status: "scheduling" });
    done("Sent to the teacher to confirm");
  };
  if ($("takeSug")) $("takeSug").onclick = async () => { const len = new Date(ev.ends_at) - new Date(ev.starts_at); const { error } = await sb.from("inclusion_events").update({ starts_at: ev.suggested_at, ends_at: new Date(new Date(ev.suggested_at).getTime() + len).toISOString(), status: "confirmed" }).eq("id", ev.id); if (error) return toast(error.message); if (window.nestMail) nestMail("event", ev.id); if (ev.kind === "observation") await upd({ status: "scheduled" }); done("Booked"); };
  if ($("evOk")) $("evOk").onclick = async () => { const { error } = await sb.from("inclusion_events").update({ status: "confirmed", responded_at: new Date().toISOString() }).eq("id", ev.id); if (error) return toast(error.message); if (window.nestMail) nestMail("event", ev.id); if (ev.kind === "observation") await sb.from("inclusion_referrals").update({ status: "scheduled", updated_at: new Date().toISOString() }).eq("id", r.id); done("Confirmed. It’s in the calendar."); };
  if ($("evSug")) $("evSug").onclick = async () => { const at = $("sugAt").value; if (!at) return toast("Choose the time that suits you."); const { error } = await sb.from("inclusion_events").update({ status: "reschedule", suggested_at: new Date(at).toISOString(), response_note: $("sugNote").value.trim() || null, responded_at: new Date().toISOString() }).eq("id", ev.id); if (error) return toast(error.message); if (window.nestMail) nestMail("event", ev.id); done("Your suggested time was sent"); };
  if ($("writeObs")) $("writeObs").onclick = () => openObservation(r, ev);
  if ($("doOutcome")) $("doOutcome").onclick = async () => {
    const oc = (dlg.querySelector("input[name=oc]:checked") || {}).value; if (!oc) return toast("Choose the next step.");
    const row = { outcome: oc, outcome_note: $("ocNote").value.trim() || null, status: oc === "register" ? "meeting" : "closed", closed_at: oc === "register" ? null : new Date().toISOString() };
    if (await upd(row)) done(oc === "register" ? "Next: arrange the parent meeting" : "Closed. The teacher can see the next steps.");
  };
  if ($("recMeet")) $("recMeet").onclick = () => recordMeeting(r, ev);
  if ($("toReg")) $("toReg").onclick = async () => {
    dlg.close();
    const map = { "Reading and writing": "sod", "Maths": "sod", "Speech, language and communication": "sod", "Attention and focus": "sod", "Behaviour": "sod", "Social and emotional": "sod", "Physical or sensory": "sod", "English language (EAL)": "eal", "Very able: needs more challenge": "gt" };
    window.REF_PREFILL = { categories: [...new Set((r.concerns || []).map(c => map[c] || "other"))], after: async () => { await sb.from("inclusion_referrals").update({ status: "closed", closed_at: new Date().toISOString(), updated_at: new Date().toISOString() }).eq("id", r.id); await refLoad(); } };
    openEntry(regOf(r.student_id) ? r.student_id : null, r.student_id);
  };
  dlg.open || dlg.showModal();
}
const propForm = kind => `<div class="two" style="margin-top:8px"><label class="f">Date and time <input type="datetime-local" id="pAt"></label><label class="f">Length <select id="pLen">${[20, 30, 40, 45, 60].map(m => `<option value="${m}" ${m === (kind === "parent_meeting" ? 30 : 40) ? "selected" : ""}>${m} minutes</option>`).join("")}</select></label></div>
  <div class="two" style="margin-top:8px"><label class="f">${kind === "parent_meeting" ? "Where (room or online link)" : "Lesson or room"} <input type="text" id="pLoc" placeholder="${kind === "parent_meeting" ? "Meeting room 2, or a Teams link" : "Maths, Grade 2B"}"></label>${kind === "parent_meeting" ? `<label class="f">Parents attending <input type="text" id="pWho" placeholder="Mother and father, phone 050…"></label>` : "<div></div>"}</div>
  <button class="btn" id="propose" data-kind="${kind}" style="margin-top:8px">Send this time to the teacher</button>`;

/* ===== Observation feedback (inclusion team member) ===== */
function openObservation(r, ev){
  dlg.innerHTML = `<form class="dlg"><h2>Observation feedback · ${esc(stud(r.student_id).full_name)}</h2>
    <div class="two"><label class="f">Date <input type="date" name="d" value="${esc((ev ? ev.starts_at : new Date().toISOString()).slice(0, 10))}"></label><label class="f">Lesson <input type="text" name="l" value="${esc(ev ? ev.location || "" : "")}"></label></div>
    <label class="f">Strengths seen <textarea name="s" rows="2"></textarea></label>
    <label class="f">Difficulties seen <textarea name="df" rows="3"></textarea></label>
    <label class="f">Strategies tried in the lesson, or suggested for the teacher <textarea name="st" rows="3"></textarea></label>
    <div><b>Recommendation</b><div class="checks">${Object.entries(OUTCOMES).map(([k, v]) => `<label><input type="radio" name="rec" value="${k}"> ${v}</label>`).join("")}</div></div>
    <label class="f">Anything else for the inclusion head <textarea name="n" rows="2"></textarea></label>
    <div class="row" style="justify-content:flex-end"><button type="button" class="btn ghost" data-back>Back</button><button class="btn">Send to the inclusion head</button></div></form>`;
  const f = dlg.querySelector("form"); dlg.querySelector("[data-back]").onclick = () => openRefCase(r.id);
  f.onsubmit = async e => {
    e.preventDefault(); const rec = (f.querySelector("input[name=rec]:checked") || {}).value; if (!rec) return toast("Choose a recommendation.");
    const { error } = await sb.from("inclusion_observations").insert({ school_id: school.id, referral_id: r.id, event_id: ev ? ev.id : null, observer_id: me.id, observed_on: f.d.value, lesson: f.l.value.trim() || null, strengths: f.s.value.trim() || null, difficulties: f.df.value.trim() || null, strategies: f.st.value.trim() || null, recommendation: rec, notes: f.n.value.trim() || null });
    if (error) return toast(error.message);
    if (ev) await sb.from("inclusion_events").update({ status: "done" }).eq("id", ev.id);
    await sb.from("inclusion_referrals").update({ status: "observed", updated_at: new Date().toISOString() }).eq("id", r.id);
    if (window.nestMail) nestMail("referral", r.id);
    await refLoad(); render(); openRefCase(r.id); toast("Sent to the inclusion head");
  };
}

/* ===== After the parent meeting: record it, then add to the register ===== */
function recordMeeting(r, ev){
  dlg.innerHTML = `<form class="dlg"><h2>Parent meeting · ${esc(stud(r.student_id).full_name)}</h2>
    <label class="f">Who attended <input type="text" name="a" value="${esc([ev.attendees, nameOf(ev.staff_id), nameOf(ev.teacher_id)].filter(Boolean).join(", "))}"></label>
    <label class="f">What was discussed <textarea name="w" rows="3"></textarea></label>
    <label class="f">Agreed next steps (school and home) <textarea name="g" rows="3" required></textarea></label>
    <div class="checks"><label><input type="checkbox" name="ok" checked> Parents agreed to the next steps and to the support</label></div>
    <div class="row" style="justify-content:flex-end"><button type="button" class="btn ghost" data-back>Back</button><button class="btn">Save</button></div></form>`;
  const f = dlg.querySelector("form"); dlg.querySelector("[data-back]").onclick = () => openRefCase(r.id);
  f.onsubmit = async e => {
    e.preventDefault();
    const { error } = await sb.from("inclusion_meetings").insert({ school_id: school.id, student_id: r.student_id, meeting_date: ev.starts_at.slice(0, 10), kind: "start", attendees: f.a.value.trim() || null, discussed: f.w.value.trim() || null, agreed: f.g.value.trim(), parent_agreed: f.ok.checked, created_by: me.id, updated_by: me.id });
    if (error) return toast(error.message);
    await sb.from("inclusion_events").update({ status: "done" }).eq("id", ev.id);
    await sb.from("inclusion_referrals").update({ status: "next_steps", updated_at: new Date().toISOString() }).eq("id", r.id);
    if (window.nestMail) nestMail("referral", r.id);
    await refLoad(); await load(); render(); openRefCase(r.id); toast("Saved. Last step: add to the register and write the plan.");
  };
}

/* ===== The inclusion head and team: all referrals ===== */
function refPane(){
  const pane = document.getElementById("pane");
  const open = refs.filter(r => !["closed", "declined"].includes(r.status)), shut = refs.filter(r => ["closed", "declined"].includes(r.status));
  const row = r => `<tr><td><button class="nm" data-ref="${esc(r.id)}">${esc(stud(r.student_id) ? stud(r.student_id).full_name : "Student")}</button><br><span class="note">${esc((cls((stud(r.student_id) || {}).class_id) || {}).name || "")}</span></td><td class="hide-sm">${esc(nameOf(r.teacher_id))}</td><td>${(r.concerns || []).slice(0, 2).map(c => `<span class="tag other">${esc(c)}</span>`).join("")}</td><td class="hide-sm">${esc(URGENCY[r.urgency] || "")}</td><td class="hide-sm">${esc(nameOf(r.assigned_to))}</td><td>${refTag(r)}</td></tr>`;
  pane.innerHTML = tasksHtml() + `<div class="card"><div class="row" style="justify-content:space-between"><h2>Referrals</h2><button class="btn ghost" id="newref">🙋 Refer a student</button></div>
    ${open.length ? `<div class="tablewrap"><table class="reg"><tr><th>Student</th><th class="hide-sm">From</th><th>Concern</th><th class="hide-sm">Urgency</th><th class="hide-sm">Assigned to</th><th>Where it is now</th></tr>${open.map(row).join("")}</table></div>` : '<p class="note">No open referrals.</p>'}
    ${shut.length ? `<details style="margin-top:14px"><summary class="note">Closed (${shut.length})</summary><div class="tablewrap"><table class="reg">${shut.map(row).join("")}</table></div></details>` : ""}</div>`;
  refBind(pane);
}

/* ===== Shared calendar: observations and parent meetings ===== */
let calMonth = null;
function calPane(host){
  const pane = host || document.getElementById("pane");
  const d0 = calMonth || new Date(); const y = d0.getFullYear(), m = d0.getMonth(), first = new Date(y, m, 1), days = new Date(y, m + 1, 0).getDate(), pad = (first.getDay() + 6) % 7;
  const mineOnly = !isMgr;
  const evs = events.filter(e => e.status !== "cancelled" && (!mineOnly || e.teacher_id === me.id || e.staff_id === me.id));
  const on = day => evs.filter(e => { const t = new Date(e.starts_at); return t.getFullYear() === y && t.getMonth() === m && t.getDate() === day; }).sort((a, b) => a.starts_at.localeCompare(b.starts_at));
  let cells = ""; for (let i = 0; i < pad; i++) cells += '<div class="calcell empty"></div>';
  for (let dd = 1; dd <= days; dd++) { const isToday = new Date().toDateString() === new Date(y, m, dd).toDateString();
    cells += `<div class="calcell ${isToday ? "today" : ""}"><b>${dd}</b>${on(dd).map(e => `<button class="calev ${e.kind} ${e.status}" data-ref="${esc(e.referral_id)}" title="${esc(dt(e.starts_at))}">${new Date(e.starts_at).toLocaleTimeString("en-GB", { hour: "numeric", minute: "2-digit" })} ${e.kind === "parent_meeting" ? "👪" : "👀"} ${esc((stud(e.student_id) || { full_name: "" }).full_name.split(" ")[0])}${e.status === "proposed" || e.status === "reschedule" ? " ?" : ""}</button>`).join("")}</div>`; }
  pane.innerHTML = `<div class="card"><div class="row" style="justify-content:space-between"><h2>Inclusion calendar</h2><div class="row"><button class="btn ghost small" id="calPrev">‹</button><b>${first.toLocaleDateString("en-GB", { month: "long", year: "numeric" })}</b><button class="btn ghost small" id="calNext">›</button></div></div>
    <p class="note">${mineOnly ? "Your observations and parent meetings." : "All observations and parent meetings."} 👀 observation · 👪 parent meeting · <b>?</b> waiting for confirmation.</p>
    <div class="calgrid">${["Mon", "Tue", "Wed", "Thu", "Fri", "Sat", "Sun"].map(x => `<div class="calhead">${x}</div>`).join("")}${cells}</div></div>`;
  pane.querySelector("#calPrev").onclick = () => { calMonth = new Date(y, m - 1, 1); calPane(host); };
  pane.querySelector("#calNext").onclick = () => { calMonth = new Date(y, m + 1, 1); calPane(host); };
  refBind(pane);
}
