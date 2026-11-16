/* ===== Nestopia · Staff leave and cover =====
   Staff ask for leave or report sick. School leaders approve it. Approved leave lists the classes that need cover
   each day; a leader picks who covers, the absent teacher leaves cover work, and the cover teacher is told.
   Only the person and school leaders see the reason for leave. */
const PLATFORM = "Nestopia";
const sb = supabase.createClient("https://gvhzbxpgebgjnegdiijp.supabase.co", "sb_publishable_aEQ4MVt00kNu8PaVtrNnqQ_9guhxPYM");
const app = document.getElementById("app"), who = document.getElementById("who"), dlg = document.getElementById("dlg");
const esc = t => String(t ?? "").replace(/[&<>"]/g, c => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;" }[c]));
const toast = m => { const t = document.getElementById("toast"); t.textContent = m; t.classList.add("on"); clearTimeout(toast.h); toast.h = setTimeout(() => t.classList.remove("on"), 2800); };
const fmtD = d => d ? new Date(d + "T12:00:00").toLocaleDateString("en-GB", { weekday: "short", day: "numeric", month: "short" }) : "";
const today = () => { const p = Object.fromEntries(new Intl.DateTimeFormat("en-GB", { timeZone: "Asia/Dubai", year: "numeric", month: "2-digit", day: "2-digit" }).formatToParts(new Date()).map(x => [x.type, x.value])); return `${p.year}-${p.month}-${p.day}`; };
const addD = (d, n) => { const x = new Date(d + "T12:00:00"); x.setDate(x.getDate() + n); return x.toISOString().slice(0, 10); };
const KINDS = { sick: "🤒 Sick", annual: "🌴 Annual leave", personal: "🏠 Personal", appointment: "🩺 Appointment", training: "🎓 Training or course", compassionate: "🕊️ Compassionate", other: "📌 Other" };
const PART = { full: "Full day", am: "Morning only", pm: "Afternoon only" };
const ST = { pending: ["Waiting for approval", "part"], approved: ["Approved", "ok"], declined: ["Declined", "warn"], cancelled: ["Cancelled", "none"] };

let me, school, C = {}, lead = false, classes = [], staff = [], ui = { tab: "mine", day: null };
const nameOf = id => (staff.find(s => s.id === id) || {}).full_name || "a colleague";
const clsName = id => (classes.find(c => String(c.id) === String(id)) || {}).name || "";
const subjName = id => id ? ((C.subjects || []).find(s => String(s.id) === String(id)) || {}).name || "" : "";
// school days (Monday to Friday) in a range, halved for half days
const days = l => { let n = 0; for (let d = l.from_date; d <= l.to_date; d = addD(d, 1)) { const w = new Date(d + "T12:00:00").getDay(); if (w >= 1 && w <= 5) n++; } return l.part === "full" ? n : n / 2; };
const mail = body => sb.functions.invoke("nestopia-mail", { body: Object.assign({ action: "leave" }, body) }).catch(() => {});
function fail(t){ app.innerHTML = `<div class="card"><div class="msg">${esc(t)}</div></div>`; }
const yearStart = () => { const t = today(), y = +t.slice(0, 4); return (+t.slice(5, 7) >= 8 ? y : y - 1) + "-08-01"; };

async function start(){
  const { data: { session } } = await sb.auth.getSession(); if (!session) { location.href = "./"; return; }
  const { data: p } = await sb.from("profiles").select("*").eq("id", session.user.id).single();
  if (!p || !p.school_id) return fail("Your account isn’t linked to a school yet.");
  me = p; who.innerHTML = `<span>${esc(p.full_name || p.email)}</span><a class="btn ghost small" href="./">← ${esc(PLATFORM)}</a>`;
  const { data: s } = await sb.from("schools").select("*").eq("id", p.school_id).single(); school = s;
  if (!school || school.status !== "active" || !p.active) return fail("Your school or account isn’t active yet.");
  if (window.hubInit) hubInit("leave");
  lead = window.NestAccess ? ((await NestAccess.mine(sb))["cover"] === "E") : ["school_lead", "coordinator", "admin"].includes(p.role);   // Edit on cover in the access grid
  const set = await sb.from("school_setups").select("year,config").eq("school_id", school.id).order("updated_at", { ascending: false }).limit(1);
  if (set.data && set.data[0]) C = set.data[0].config || {};
  classes = ((await sb.from("classes").select("id,name,grade_id").eq("school_id", school.id)).data || []).sort((a, b) => String(a.name).localeCompare(String(b.name), undefined, { numeric: true }));
  staff = ((await sb.from("profiles").select("id,full_name,role,active").eq("school_id", school.id)).data || []).filter(x => x.active !== false).sort((a, b) => String(a.full_name).localeCompare(String(b.full_name)));
  ui.day = today();
  const h = location.hash.slice(1); if (["mine", "requests", "cover", "away", "record"].includes(h)) ui.tab = h;
  draw();
}
async function draw(){
  if (!lead && ["requests", "cover", "record"].includes(ui.tab)) ui.tab = "mine";
  let pend = 0; if (lead) { const r = await sb.from("staff_leave").select("id", { count: "exact", head: true }).eq("school_id", String(school.id)).eq("status", "pending"); pend = r.count || 0; }
  app.innerHTML = `<div class="phead"><div><h1 class="ptitle">Leave and cover</h1><p class="note" style="margin:0">Ask for leave, report sick, and see who is covering which class.</p></div>
      <div class="row"><button class="btn ghost" id="sick">🤒 Report sick today</button><button class="btn" id="ask">+ Ask for leave</button></div></div>
    <div class="tabs" role="tablist">${[["mine", "My leave and cover"], lead && ["requests", `Requests (${pend})`], lead && ["cover", "Arrange cover"], ["away", "Who’s away"], lead && ["record", "Leave record"]].filter(Boolean)
      .map(([k, l]) => `<button class="tab" data-t="${k}" aria-selected="${ui.tab === k}">${l}</button>`).join("")}</div><div id="pane"><p class="note">Loading…</p></div>`;
  app.querySelectorAll("[data-t]").forEach(b => b.onclick = () => { ui.tab = b.dataset.t; history.replaceState(null, "", "#" + ui.tab); draw(); });
  document.getElementById("ask").onclick = () => askDialog(false);
  document.getElementById("sick").onclick = () => askDialog(true);
  try { await ({ mine, requests, cover, away, record })[ui.tab](); } catch (e) { document.getElementById("pane").innerHTML = `<div class="msg">${esc(e.message || e)}</div>`; }
}
const pill = st => `<span class="cnt ${ST[st][1]}">${ST[st][0]}</span>`;
const when = l => `${fmtD(l.from_date)}${l.to_date !== l.from_date ? " to " + fmtD(l.to_date) : ""}${l.part !== "full" ? " · " + PART[l.part].toLowerCase() : ""}`;

// ---------- my leave, my cover duties, cover for my classes ----------
async function mine(){
  const p = document.getElementById("pane"), t = today();
  const [lv, duty, mineAway] = await Promise.all([
    sb.from("staff_leave").select("*").eq("staff_id", me.id).gte("to_date", yearStart()).order("from_date", { ascending: false }),
    sb.from("staff_cover").select("*").eq("cover_id", me.id).gte("day", t).order("day"),
    sb.from("staff_cover").select("*").eq("absent_id", me.id).gte("day", t).order("day")]);
  if (lv.error) throw lv.error;
  const L = lv.data || [], taken = L.filter(x => x.status === "approved").reduce((a, x) => a + days(x), 0);
  p.innerHTML = `${(duty.data || []).length ? `<div class="card"><h2>🧑‍🏫 Cover you are doing</h2>${(duty.data || []).map(c => `<div class="cv"><b>${esc(fmtD(c.day))}</b><div><b>${esc(clsName(c.class_id))}</b>${c.subject_id ? " · " + esc(subjName(c.subject_id)) : ""} · ${esc(c.period)}<br><span class="note">For ${esc(nameOf(c.absent_id))}</span>${c.work ? `<p style="margin:6px 0 0;white-space:pre-line">📋 ${esc(c.work)}</p>` : '<p class="note" style="margin:6px 0 0">No cover work added yet.</p>'}</div><div></div></div>`).join("")}</div>` : ""}
    ${(mineAway.data || []).length ? `<div class="card"><h2>📋 Cover work for your classes while you’re away</h2><p class="note" style="margin-top:0">Add what the class should do, so whoever covers knows the plan.</p>${(mineAway.data || []).map(c => `<div class="cv"><b>${esc(fmtD(c.day))}</b><div><b>${esc(clsName(c.class_id))}</b>${c.subject_id ? " · " + esc(subjName(c.subject_id)) : ""} · ${esc(c.period)}<br><span class="note">${c.cover_id ? "Covered by " + esc(nameOf(c.cover_id)) : "Cover not arranged yet"}</span>${c.work ? `<p style="margin:6px 0 0;white-space:pre-line">${esc(c.work)}</p>` : ""}</div><div><button class="btn ghost small" data-work="${c.id}">${c.work ? "Edit" : "Add"} cover work</button></div></div>`).join("")}</div>` : ""}
    <div class="card"><h2>My leave this school year</h2><p class="note" style="margin-top:0">${taken} school day${taken === 1 ? "" : "s"} of approved leave since August.</p>
      ${L.length ? L.map(l => `<div class="lv"><div class="grow"><b>${esc(KINDS[l.kind])}</b> · ${esc(when(l))}<small>${l.reason ? esc(l.reason) : ""}${l.note ? ` · Note from ${esc(nameOf(l.decided_by))}: ${esc(l.note)}` : ""}</small></div>${pill(l.status)}
        ${["pending", "approved"].includes(l.status) && l.to_date >= t ? `<button class="btn ghost small" data-cancel="${l.id}">Cancel</button>` : ""}</div>`).join("") : '<p class="note">No leave yet.</p>'}</div>`;
  const all = [...(mineAway.data || [])];
  p.querySelectorAll("[data-work]").forEach(b => b.onclick = () => workDialog(all.find(c => c.id === b.dataset.work)));
  p.querySelectorAll("[data-cancel]").forEach(b => b.onclick = async () => { if (!confirm("Cancel this leave?")) return;
    const { error } = await sb.rpc("leave_decide", { p_leave: b.dataset.cancel, p_action: "cancel" }); if (error) return alert(error.message); toast("Cancelled."); draw(); });
}
function workDialog(c){
  dlg.innerHTML = `<form class="dlg" method="dialog" id="wf"><h2>Cover work</h2><p class="note" style="margin:0">${esc(clsName(c.class_id))}${c.subject_id ? " · " + esc(subjName(c.subject_id)) : ""} · ${esc(fmtD(c.day))} · ${esc(c.period)}</p>
    <label class="f">What should the class do? Where are the resources?<textarea id="wt" rows="7" placeholder="e.g. Maths: page 34 in the workbook, questions 1–10. Reading books are in the blue box. Ahmed needs to sit at the front.">${esc(c.work || "")}</textarea></label>
    <div class="checks"><label><input type="checkbox" id="wall"> Use the same work for all ${esc(c.absent_id === me.id ? "my" : "their")} cover on ${esc(fmtD(c.day))}</label></div>
    <div class="row" style="justify-content:flex-end"><button class="btn ghost" value="cancel">Cancel</button><button class="btn" value="ok">Save</button></div></form>`;
  dlg.showModal(); dlg.onchange = null; dlg.onclick = null;
  document.getElementById("wf").onsubmit = async e => { if (e.submitter && e.submitter.value === "cancel") return; e.preventDefault();
    const txt = document.getElementById("wt").value; let ids = [c.id];
    if (document.getElementById("wall").checked) { const r = await sb.from("staff_cover").select("id").eq("absent_id", c.absent_id).eq("day", c.day); ids = (r.data || []).map(x => x.id); }
    for (const id of ids) { const { error } = await sb.rpc("cover_work", { p_cover: id, p_work: txt }); if (error) return alert("This wasn’t saved: " + error.message); }
    dlg.close(); toast("Cover work saved."); draw(); };
}

// ---------- ask for leave / report sick (leaders can add leave for anyone) ----------
function askDialog(sick){
  const t = today();
  dlg.innerHTML = `<form class="dlg" method="dialog" id="af"><h2>${sick ? "🤒 Report sick" : "Ask for leave"}</h2>
    ${sick ? '<p class="note" style="margin:0">Sick leave for today is approved straight away, so cover can be arranged. Get well soon.</p>' : ""}
    ${lead ? `<label class="f">For<select id="aw"><option value="">Me</option>${staff.filter(s => s.id !== me.id).map(s => `<option value="${s.id}">${esc(s.full_name)}</option>`).join("")}</select></label>` : ""}
    <div class="two"><label class="f">Type<select id="ak">${Object.entries(KINDS).map(([k, v]) => `<option value="${k}" ${(sick ? "sick" : "annual") === k ? "selected" : ""}>${v}</option>`).join("")}</select></label>
      <label class="f">Day or days<select id="ap">${Object.entries(PART).map(([k, v]) => `<option value="${k}">${v}</option>`).join("")}</select></label></div>
    <div class="two"><label class="f">From<input type="date" id="af1" value="${sick ? t : ""}" required></label><label class="f">To<input type="date" id="af2" value="${sick ? t : ""}" required></label></div>
    <label class="f">Reason or details <span class="note">(only you and school leaders see this)</span><textarea id="ar" rows="3"></textarea></label>
    ${lead ? '<p class="note" style="margin:0">Leave you add for someone else is approved straight away.</p>' : ""}
    <div class="msg" id="ae" hidden></div>
    <div class="row" style="justify-content:flex-end"><button class="btn ghost" value="cancel" formnovalidate>Cancel</button><button class="btn" value="ok" id="as">${sick ? "Report sick" : "Send request"}</button></div></form>`;
  dlg.showModal(); dlg.onclick = null;
  dlg.onchange = e => { if (e.target.id === "af1") { const b = document.getElementById("af2"); if (!b.value || b.value < e.target.value) b.value = e.target.value; } };
  document.getElementById("af").onsubmit = async e => { if (e.submitter && e.submitter.value === "cancel") return; e.preventDefault();
    const g = id => { const el = document.getElementById(id); return el ? el.value : ""; }, er = document.getElementById("ae");
    document.getElementById("as").disabled = true;
    const { data, error } = await sb.rpc("leave_request", { p_kind: g("ak"), p_from: g("af1"), p_to: g("af2"), p_part: g("ap"), p_reason: g("ar"), p_staff: g("aw") || null });
    if (error) { document.getElementById("as").disabled = false; er.hidden = false; er.textContent = error.message; return; }
    mail({ id: data.id, kind: "request" });
    dlg.close(); toast(data.status === "approved" ? "Done. Cover will now be arranged." : "Request sent to school leaders."); draw(); };
}

// ---------- requests (leaders) ----------
async function requests(){
  const p = document.getElementById("pane");
  const r = await sb.from("staff_leave").select("*").eq("school_id", String(school.id)).eq("status", "pending").order("from_date"); if (r.error) throw r.error;
  const L = r.data || [], away = (await sb.rpc("staff_away", { p_from: today(), p_to: addD(today(), 120) })).data || [];
  p.innerHTML = L.length ? L.map(l => { const clash = away.filter(a => a.staff_id !== l.staff_id && a.to_date >= l.from_date && a.from_date <= l.to_date);
    return `<div class="lv"><div class="grow"><b>${esc(nameOf(l.staff_id))}</b> · ${esc(KINDS[l.kind])}<small>${esc(when(l))} · ${days(l)} school day${days(l) === 1 ? "" : "s"}${l.reason ? " · " + esc(l.reason) : ""}</small>
      ${clash.length ? `<small style="color:var(--amber)">Also away then: ${esc([...new Set(clash.map(a => a.name))].join(", "))}</small>` : ""}</div>
      <button class="btn small" data-d="${l.id}|approve">Approve</button><button class="btn ghost small" data-d="${l.id}|decline">Decline</button></div>`; }).join("")
    : '<div class="card empty"><p class="note">No leave requests waiting. ✨</p></div>';
  p.querySelectorAll("[data-d]").forEach(b => b.onclick = async () => { const [id, a] = b.dataset.d.split("|");
    const note = a === "decline" ? prompt("Add a short note for them (optional):", "") : ""; if (note === null) return;
    const { error } = await sb.rpc("leave_decide", { p_leave: id, p_action: a, p_note: note || null }); if (error) return alert(error.message);
    mail({ id, kind: "decided" }); toast(a === "approve" ? "Approved. Their classes are now on the cover list." : "Declined."); draw(); });
}

// ---------- arrange cover (leaders) ----------
async function cover(){
  const p = document.getElementById("pane"), d = ui.day;
  const dow = (new Date(d + "T12:00:00").getDay() || 7);
  const [cv, aw, wk, tt] = await Promise.all([sb.from("staff_cover").select("*").eq("school_id", String(school.id)).eq("day", d),
    sb.rpc("staff_away", { p_from: d, p_to: d }), sb.from("staff_cover").select("cover_id").eq("school_id", String(school.id)).gte("day", addD(d, -6)).lte("day", d).not("cover_id", "is", null),
    sb.from("timetable_slots").select("teacher_id,period_id,class_id").eq("school_id", String(school.id)).eq("day", dow)]);
  const PO = ((C.timetable || {}).periods || []).map(p => p.id), pord = c => { const i = PO.indexOf(c.period_id); return i < 0 ? 99 : i; };
  const teaching = (tid, pid) => pid ? (tt.data || []).filter(x => x.teacher_id === tid && x.period_id === pid).map(x => clsName(x.class_id)) : [];
  if (cv.error) throw cv.error;
  const rows = (cv.data || []).sort((a, b) => String(nameOf(a.absent_id)).localeCompare(nameOf(b.absent_id)) || pord(a) - pord(b) || clsName(a.class_id).localeCompare(clsName(b.class_id), undefined, { numeric: true }));
  const awayIds = new Set((aw.data || []).map(a => a.staff_id)), load = {}, week = {};
  rows.forEach(c => { if (c.cover_id) load[c.cover_id] = (load[c.cover_id] || 0) + 1; });
  (wk.data || []).forEach(c => week[c.cover_id] = (week[c.cover_id] || 0) + 1);
  const open = rows.filter(c => !c.cover_id).length;
  const opts = c => `<option value="">Choose who covers…</option>${staff.filter(s => s.id !== c.absent_id).map(s => `<option value="${s.id}" ${c.cover_id === s.id ? "selected" : ""} ${awayIds.has(s.id) ? "disabled" : ""}>${esc(s.full_name)}${awayIds.has(s.id) ? " (away)" : teaching(s.id, c.period_id).length ? ` (teaching ${teaching(s.id, c.period_id).join(", ")})` : load[s.id] ? ` (${load[s.id]} today` + (week[s.id] ? `, ${week[s.id]} this week)` : ")") : week[s.id] ? ` (${week[s.id]} this week)` : ""}</option>`).join("")}`;
  const groups = {}; rows.forEach(c => (groups[c.absent_id || "x"] = groups[c.absent_id || "x"] || []).push(c));
  p.innerHTML = `<div class="row" style="margin-bottom:12px"><button class="btn ghost small" id="dp">←</button><input type="date" id="dd" value="${d}" style="width:auto"><button class="btn ghost small" id="dn">→</button>
      <b>${esc(new Date(d + "T12:00:00").toLocaleDateString("en-GB", { weekday: "long", day: "numeric", month: "long" }))}</b><span style="flex:1"></span>
      <button class="btn ghost small" id="addc">+ Add a cover lesson</button><button class="btn ghost small" id="prc">🖨️ Print the cover sheet</button></div>
    <div class="metrics"><div class="metric"><span>Staff away</span><b>${awayIds.size}</b></div><div class="metric"><span>Lessons to cover</span><b>${rows.length}</b></div><div class="metric"><span>Not arranged yet</span><b style="color:${open ? "var(--red)" : "var(--sage)"}">${open}</b></div></div>
    ${rows.length ? Object.entries(groups).map(([aid, list]) => `<div class="card"><h2>${aid === "x" ? "Other cover" : "For " + esc(nameOf(aid))}</h2>
      ${list.map(c => `<div class="cv"><div><b>${esc(clsName(c.class_id) || "—")}</b><br><span class="note">${esc(c.period)}</span></div>
        <div>${c.subject_id ? `<b>${esc(subjName(c.subject_id))}</b>` : '<b>Class teacher</b>'}${c.work ? `<p style="margin:4px 0 0;white-space:pre-line;font-size:14px">📋 ${esc(c.work)}</p>` : '<p class="note" style="margin:4px 0 0">No cover work yet.</p>'}
          <p style="margin:4px 0 0"><button class="mini" data-work="${c.id}">${c.work ? "Edit" : "Add"} work</button> <button class="mini" data-del="${c.id}">Remove</button></p></div>
        <div><select data-cov="${c.id}">${opts(c)}</select></div></div>`).join("")}</div>`).join("")
      : '<div class="card empty"><p class="note">No cover needed on this day. ✨</p></div>'}`;
  const go = n => { ui.day = n; cover(); };
  document.getElementById("dp").onclick = () => go(addD(d, -1)); document.getElementById("dn").onclick = () => go(addD(d, 1));
  document.getElementById("dd").onchange = e => e.target.value && go(e.target.value);
  p.querySelectorAll("[data-cov]").forEach(s => s.onchange = async () => { const id = s.dataset.cov;
    const { error } = await sb.from("staff_cover").update({ cover_id: s.value || null }).eq("id", id); if (error) return alert("This wasn’t saved: " + error.message);
    if (s.value) mail({ id, kind: "cover" }); toast(s.value ? `${nameOf(s.value)} will cover. They’ll get an email.` : "Removed."); cover(); });
  p.querySelectorAll("[data-work]").forEach(b => b.onclick = () => workDialog(rows.find(c => c.id === b.dataset.work)));
  p.querySelectorAll("[data-del]").forEach(b => b.onclick = async () => { if (!confirm("Remove this cover lesson?")) return; const { error } = await sb.from("staff_cover").delete().eq("id", b.dataset.del); if (error) return alert(error.message); cover(); });
  document.getElementById("addc").onclick = () => addCover(d);
  document.getElementById("prc").onclick = () => printCover(d, rows);
}
function addCover(d){
  dlg.innerHTML = `<form class="dlg" method="dialog" id="cf"><h2>Add a cover lesson</h2><p class="note" style="margin:0">For cover that isn’t from a leave request, such as a teacher on a trip or in a meeting.</p>
    <div class="two"><label class="f">Day<input type="date" id="c1" value="${d}" required></label><label class="f">Class<select id="c2" required><option value="">Choose…</option>${classes.map(c => `<option value="${c.id}">${esc(c.name)}</option>`).join("")}</select></label></div>
    <div class="two"><label class="f">When<input type="text" id="c3" value="All day" placeholder="e.g. Period 3, or 10:00–10:45"></label><label class="f">Subject (optional)<select id="c4"><option value="">Class teacher</option>${(C.subjects || []).map(s => `<option value="${esc(s.id)}">${esc(s.name)}</option>`).join("")}</select></label></div>
    <label class="f">Teacher who is out (optional)<select id="c5"><option value="">—</option>${staff.map(s => `<option value="${s.id}">${esc(s.full_name)}</option>`).join("")}</select></label>
    <div class="row" style="justify-content:flex-end"><button class="btn ghost" value="cancel" formnovalidate>Cancel</button><button class="btn" value="ok">Add</button></div></form>`;
  dlg.showModal(); dlg.onchange = null; dlg.onclick = null;
  document.getElementById("cf").onsubmit = async e => { if (e.submitter && e.submitter.value === "cancel") return; e.preventDefault();
    const g = id => document.getElementById(id).value;
    const { error } = await sb.from("staff_cover").insert({ school_id: String(school.id), day: g("c1"), class_id: g("c2"), period: g("c3").trim() || "All day", subject_id: g("c4") || null, absent_id: g("c5") || null, created_by: me.id });
    if (error) return alert("This wasn’t saved: " + error.message); dlg.close(); ui.day = g("c1"); cover(); };
}
function printCover(d, rows){
  const w = window.open("", "_blank"); if (!w) return alert("Please allow pop-ups to print.");
  w.document.write(`<!DOCTYPE html><html><head><meta charset="utf-8"><title>Cover ${d}</title><style>body{font-family:Arial,sans-serif;font-size:13px;margin:24px}h1{font-size:19px;margin:0 0 4px}table{width:100%;border-collapse:collapse;margin-top:12px}th,td{border:1px solid #bbb;padding:7px;text-align:left;vertical-align:top}th{background:#f0ecf5}</style></head><body>
    <h1>${esc(school.name || "")}: cover for ${esc(new Date(d + "T12:00:00").toLocaleDateString("en-GB", { weekday: "long", day: "numeric", month: "long", year: "numeric" }))}</h1>
    <table><thead><tr><th>Class</th><th>When</th><th>Subject</th><th>Teacher away</th><th>Covered by</th><th>Cover work</th></tr></thead><tbody>
    ${rows.map(c => `<tr><td>${esc(clsName(c.class_id))}</td><td>${esc(c.period)}</td><td>${esc(subjName(c.subject_id) || "Class teacher")}</td><td>${esc(c.absent_id ? nameOf(c.absent_id) : "")}</td><td><b>${esc(c.cover_id ? nameOf(c.cover_id) : "NOT ARRANGED")}</b></td><td style="white-space:pre-line">${esc(c.work || "")}</td></tr>`).join("")}
    </tbody></table><script>setTimeout(()=>print(),300)<\/script></body></html>`);
  w.document.close();
}

// ---------- who's away (everyone, no reasons) ----------
async function away(){
  const p = document.getElementById("pane"), t = today();
  const { data, error } = await sb.rpc("staff_away", { p_from: t, p_to: addD(t, 30) }); if (error) throw error;
  const A = data || [];
  p.innerHTML = `<div class="card"><h2>Staff away in the next 30 days</h2>${A.length ? A.map(a => `<div class="lv"><div class="grow"><b>${esc(a.name || "")}</b><small>${esc(when(a))}</small></div>${a.from_date <= t && a.to_date >= t ? '<span class="cnt warn">Away today</span>' : ""}</div>`).join("") : '<p class="note">Nobody is away. ✨</p>'}</div>`;
}

// ---------- leave record (leaders) ----------
async function record(){
  const p = document.getElementById("pane");
  const r = await sb.from("staff_leave").select("staff_id,kind,from_date,to_date,part").eq("school_id", String(school.id)).eq("status", "approved").gte("to_date", yearStart()); if (r.error) throw r.error;
  const T = {}; (r.data || []).forEach(l => { const x = T[l.staff_id] = T[l.staff_id] || { total: 0 }; x[l.kind] = (x[l.kind] || 0) + days(l); x.total += days(l); });
  const kinds = Object.keys(KINDS).filter(k => Object.values(T).some(x => x[k]));
  const list = staff.filter(s => T[s.id]).sort((a, b) => T[b.id].total - T[a.id].total);
  p.innerHTML = `<div class="card"><div class="row" style="justify-content:space-between"><h2 style="margin:0">Approved leave since August (school days)</h2><button class="btn ghost small" id="dl">⬇️ Download</button></div>
    ${list.length ? `<div class="tablewrap"><table class="reg"><thead><tr><th>Staff</th>${kinds.map(k => `<th>${KINDS[k]}</th>`).join("")}<th>Total</th></tr></thead><tbody>
    ${list.map(s => `<tr><td><b>${esc(s.full_name)}</b></td>${kinds.map(k => `<td>${T[s.id][k] || ""}</td>`).join("")}<td><b>${T[s.id].total}</b></td></tr>`).join("")}</tbody></table></div>` : '<p class="note">No approved leave yet this school year.</p>'}</div>`;
  document.getElementById("dl").onclick = () => { const q = v => `"${String(v ?? "").replace(/"/g, '""')}"`;
    const lines = [["Staff", ...kinds.map(k => KINDS[k].replace(/^\S+\s/, "")), "Total"].map(q).join(",")].concat(list.map(s => [s.full_name, ...kinds.map(k => T[s.id][k] || 0), T[s.id].total].map(q).join(",")));
    const a = document.createElement("a"); a.href = URL.createObjectURL(new Blob(["﻿" + lines.join("\n")], { type: "text/csv" })); a.download = "leave-record.csv"; a.click(); };
}
start();
