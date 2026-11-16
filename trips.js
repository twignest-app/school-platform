/* ===== Nestopia · Trips and permission slips =====
   A teacher plans a trip, event or activity for some classes. It goes to parents in the Parent Portal (after an SLT
   check if the school wants one). Parents say yes or no and sign. Staff see every reply, mark payments, record paper
   slips and print the list for the day. */
const PLATFORM = "Nestopia";
const sb = supabase.createClient("https://gvhzbxpgebgjnegdiijp.supabase.co", "sb_publishable_aEQ4MVt00kNu8PaVtrNnqQ_9guhxPYM");
const app = document.getElementById("app"), who = document.getElementById("who"), dlg = document.getElementById("dlg");
const esc = t => String(t ?? "").replace(/[&<>"]/g, c => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;" }[c]));
const toast = m => { const t = document.getElementById("toast"); t.textContent = m; t.classList.add("on"); clearTimeout(toast.h); toast.h = setTimeout(() => t.classList.remove("on"), 2800); };
const fmtD = d => d ? new Date(d + "T12:00:00").toLocaleDateString("en-GB", { weekday: "short", day: "numeric", month: "short", year: "numeric" }) : "";
const today = () => { const p = Object.fromEntries(new Intl.DateTimeFormat("en-GB", { timeZone: "Asia/Dubai", year: "numeric", month: "2-digit", day: "2-digit" }).formatToParts(new Date()).map(x => [x.type, x.value])); return `${p.year}-${p.month}-${p.day}`; };
const KINDS = { trip: ["🚌", "Trip"], event: ["🎭", "Event"], activity: ["⚽", "Activity"], form: ["📝", "Consent form"] };
const STATUS = { draft: ["Draft", "none"], pending: ["Waiting for SLT approval", "part"], sent: ["Sent to parents", "ok"], cancelled: ["Cancelled", "warn"] };

let me, school, C = {}, setupId, year, lead = false, classes = [], myClassIds = new Set(), trips = [], studs = [], staff = {}, R = {};
let ui = { tab: "up", filter: "all" };
const T = () => Object.assign({ approval: false }, C.trips || {});
const gradeName = id => ((C.grades || []).find(g => String(g.id) === String(id)) || {}).name || "";
const clsName = id => (classes.find(c => String(c.id) === String(id)) || {}).name || "";
const mine = t => lead || t.created_by === me.id;
const studsOf = t => studs.filter(s => (t.class_ids || []).includes(String(s.class_id)));
const canMark = (t, s) => mine(t) || myClassIds.has(String(s.class_id));

function fail(t){ app.innerHTML = `<div class="card"><div class="msg">${esc(t)}</div></div>`; }
async function fetchAll(q){ const out = []; for (let f = 0; ; f += 1000) { const { data, error } = await q().range(f, f + 999); if (error) throw error; out.push(...data); if (data.length < 1000) break; } return out; }
const mail = body => sb.functions.invoke("nestopia-mail", { body: Object.assign({ action: "trip" }, body) }).catch(() => {});

async function start(){
  const { data: { session } } = await sb.auth.getSession(); if (!session) { location.href = "./"; return; }
  const { data: p } = await sb.from("profiles").select("*").eq("id", session.user.id).single();
  if (!p || !p.school_id) return fail("Your account isn’t linked to a school yet.");
  me = p; who.innerHTML = `<span>${esc(p.full_name || p.email)}</span><a class="btn ghost small" href="./">← ${esc(PLATFORM)}</a>`;
  const { data: s } = await sb.from("schools").select("*").eq("id", p.school_id).single(); school = s;
  if (!school || school.status !== "active" || !p.active) return fail("Your school or account isn’t active yet.");
  if (window.hubInit) hubInit("trips");
  lead = ["school_lead", "coordinator", "admin"].includes(p.role);
  const set = await sb.from("school_setups").select("id,year,config").eq("school_id", school.id).order("updated_at", { ascending: false }).limit(1);
  if (set.data && set.data[0]) { setupId = set.data[0].id; C = set.data[0].config || {}; year = set.data[0].year; }
  let cq = sb.from("classes").select("*").eq("school_id", school.id); if (year) cq = cq.eq("year", year);
  classes = ((await cq).data || []).sort((a, b) => String(a.name).localeCompare(String(b.name), undefined, { numeric: true }));
  myClassIds = new Set(((await sb.from("class_teachers").select("class_id").eq("teacher_id", me.id)).data || []).map(x => String(x.class_id)));
  (((await sb.from("profiles").select("id,full_name").eq("school_id", school.id)).data) || []).forEach(x => staff[x.id] = x.full_name);
  const ids = classes.map(c => c.id);
  studs = ids.length ? (await fetchAll(() => sb.from("students").select("id,full_name,class_id").in("class_id", ids).eq("archived", false))).sort((a, b) => String(a.full_name).localeCompare(String(b.full_name))) : [];
  await load();
  window.addEventListener("hashchange", route); route();
}
async function load(){
  trips = await fetchAll(() => sb.from("trips").select("*").eq("school_id", String(school.id)).order("trip_date", { ascending: true, nullsFirst: false }));
  R = {}; const ids = trips.map(t => t.id);
  for (let i = 0; i < ids.length; i += 200) (await fetchAll(() => sb.from("trip_replies").select("*").in("trip_id", ids.slice(i, i + 200)))).forEach(r => (R[r.trip_id] = R[r.trip_id] || {})[String(r.student_id)] = r);
}
function route(){
  const h = location.hash.slice(1);
  if (h.startsWith("trip=")) return openTrip(h.slice(5));
  listView();
}
function counts(t){
  const list = studsOf(t), rr = R[t.id] || {}; let y = 0, n = 0, paid = 0;
  list.forEach(s => { const r = rr[String(s.id)]; if (r && r.answer === "yes") y++; if (r && r.answer === "no") n++; if (r && r.paid) paid++; });
  return { all: list.length, y, n, w: list.length - y - n, paid };
}
const pill = st => `<span class="cnt ${STATUS[st][1]}">${STATUS[st][0]}</span>`;
const classList = t => { const byG = {}; (t.class_ids || []).forEach(id => { const c = classes.find(x => String(x.id) === String(id)); if (c) (byG[c.grade_id] = byG[c.grade_id] || []).push(c.name); });
  return Object.entries(byG).map(([g, names]) => { const all = classes.filter(c => String(c.grade_id) === String(g)).length; return names.length === all && all > 1 ? `All of ${gradeName(g) || "the grade"}` : names.join(", "); }).join(" · ") || "No classes yet"; };

// ---------- list ----------
function listView(){
  const d0 = today(), past = t => t.status === "cancelled" || (t.end_date || t.trip_date || "9999") < d0;
  const pend = trips.filter(t => t.status === "pending");
  const sets = { up: trips.filter(t => !past(t) && (t.status !== "draft" || mine(t))), mine: trips.filter(t => t.created_by === me.id && !past(t)), pend, past: trips.filter(past).reverse() };
  if (ui.tab === "pend" && !lead) ui.tab = "up";
  const list = sets[ui.tab] || [];
  app.innerHTML = `<div class="phead"><div><h1 class="ptitle">Trips and forms</h1><p class="note" style="margin:0">Plan a trip, event or activity, send the permission slip to parents and see every reply in one place.</p></div>
      <div class="row"><button class="btn" id="new">+ New trip or form</button>${lead ? '<button class="btn ghost" id="set">⚙️ Settings</button>' : ""}</div></div>
    <div class="tabs" role="tablist">
      <button class="tab" data-t="up" aria-selected="${ui.tab === "up"}">Coming up (${sets.up.length})</button>
      <button class="tab" data-t="mine" aria-selected="${ui.tab === "mine"}">Made by me (${sets.mine.length})</button>
      ${lead ? `<button class="tab" data-t="pend" aria-selected="${ui.tab === "pend"}">Waiting for approval (${pend.length})</button>` : ""}
      <button class="tab" data-t="past" aria-selected="${ui.tab === "past"}">Past and cancelled</button></div>
    ${list.length ? `<div class="ugrid">${list.map(t => { const c = counts(t), k = KINDS[t.kind] || KINDS.trip;
      return `<a class="tcard" href="#trip=${t.id}"><div class="row" style="justify-content:space-between"><span class="note">${k[0]} ${k[1]}</span>${pill(t.status)}</div>
        <h3>${esc(t.title)}</h3><div class="note">${t.trip_date ? "📅 " + esc(fmtD(t.trip_date)) : "📅 No date yet"}${t.place ? " · 📍 " + esc(t.place) : ""}</div>
        <div class="note">👥 ${esc(classList(t))}</div>
        ${t.status === "sent" || t.status === "cancelled" ? `<div class="tbar"><i class="y" style="width:${c.all ? c.y / c.all * 100 : 0}%"></i><i class="n" style="width:${c.all ? c.n / c.all * 100 : 0}%"></i></div>
        <div class="note"><b style="color:var(--sage)">${c.y} yes</b> · <b style="color:var(--red)">${c.n} no</b> · ${c.w} waiting${t.cost ? ` · ${c.paid} paid` : ""}</div>` : ""}</a>`; }).join("")}</div>`
      : `<div class="card empty"><p style="font-size:40px;margin:0">🚌</p><p class="note">${ui.tab === "pend" ? "Nothing is waiting for your approval." : ui.tab === "past" ? "No past trips yet." : "No trips yet. Click “New trip or form” to plan one."}</p></div>`}`;
  app.querySelectorAll("[data-t]").forEach(b => b.onclick = () => { ui.tab = b.dataset.t; listView(); });
  document.getElementById("new").onclick = () => editDialog(null);
  const st = document.getElementById("set"); if (st) st.onclick = settingsDialog;
}

// ---------- create / edit ----------
function editDialog(t){
  const x = Object.assign({ kind: "trip", title: "", class_ids: [], ask_medical: true, ask_phone: true }, t || {});
  const chosen = new Set((x.class_ids || []).map(String)), grades = (C.grades || []).filter(g => classes.some(c => String(c.grade_id) === String(g.id)));
  const loose = classes.filter(c => !grades.some(g => String(g.id) === String(c.grade_id)));
  const box = (g, cl) => `<div class="gradebox">${g ? `<label><input type="checkbox" data-allg="${esc(g.id)}" ${cl.every(c => chosen.has(String(c.id))) ? "checked" : ""}> ${esc(g.name)} (whole grade)</label>` : ""}
      <div class="checks" style="margin-top:6px">${cl.map(c => `<label><input type="checkbox" name="cls" value="${esc(c.id)}" data-g="${esc(c.grade_id)}" ${chosen.has(String(c.id)) ? "checked" : ""}> ${esc(c.name)}${myClassIds.has(String(c.id)) ? " ⭐" : ""}</label>`).join("")}</div></div>`;
  dlg.innerHTML = `<form class="dlg" method="dialog" id="tf"><h2>${t ? "Edit" : "New"} trip or form</h2>
    ${t && t.status === "sent" ? '<p class="okmsg" style="background:var(--amber-soft);color:var(--amber)">This has already gone to parents. They will see your changes straight away, and replies already given are kept.</p>' : ""}
    <div class="two"><label class="f">What is it?<select id="fk">${Object.entries(KINDS).map(([k, v]) => `<option value="${k}" ${x.kind === k ? "selected" : ""}>${v[0]} ${v[1]}</option>`).join("")}</select></label>
      <label class="f">Title<input type="text" id="ft" required maxlength="120" value="${esc(x.title)}" placeholder="e.g. Visit to Sharjah Aquarium"></label></div>
    <div class="f3"><label class="f">Date<input type="date" id="fd" value="${esc(x.trip_date || "")}"></label>
      <label class="f">Leaves at<input type="time" id="fl" value="${esc(x.leave_time || "")}"></label>
      <label class="f">Back at<input type="time" id="fb" value="${esc(x.return_time || "")}"></label></div>
    <div class="two"><label class="f">Place<input type="text" id="fp" maxlength="160" value="${esc(x.place || "")}" placeholder="Where it happens"></label>
      <label class="f">Parents reply by<input type="date" id="fr" value="${esc(x.reply_by || "")}"></label></div>
    <label class="f">About it (what students will do and learn)<textarea id="fx" rows="3">${esc(x.details || "")}</textarea></label>
    <label class="f">What to bring or wear<textarea id="fw" rows="2" placeholder="e.g. School PE uniform, a packed lunch, a water bottle and a hat">${esc(x.bring || "")}</textarea></label>
    <div class="two"><label class="f">Cost (leave empty if free)<input type="text" id="fc" maxlength="60" value="${esc(x.cost || "")}" placeholder="e.g. AED 45"></label>
      <label class="f">How to pay<input type="text" id="fn" maxlength="200" value="${esc(x.pay_note || "")}" placeholder="e.g. Pay at the school office by Thursday"></label></div>
    <label class="f">Staff going<input type="text" id="fs" maxlength="300" value="${esc(x.staff_going || "")}" placeholder="Names of the staff going (staff only, parents don't see this)"></label>
    <div><b style="font-size:14px">Which classes?</b> <span class="note">⭐ your classes</span>
      <div style="margin-top:6px;max-height:260px;overflow:auto">${grades.map(g => box(g, classes.filter(c => String(c.grade_id) === String(g.id)))).join("")}${loose.length ? box(null, loose) : ""}</div></div>
    <div class="checks"><label><input type="checkbox" id="fm" ${x.ask_medical ? "checked" : ""}> Ask parents about medical or dietary needs for the day</label>
      <label><input type="checkbox" id="fph" ${x.ask_phone ? "checked" : ""}> Ask for a phone number to call on the day</label></div>
    <div class="msg" id="fe" hidden></div>
    <div class="row" style="justify-content:flex-end"><button class="btn ghost" value="cancel" formnovalidate>Cancel</button><button class="btn" id="fsv" value="save">Save</button></div></form>`;
  dlg.showModal();
  dlg.onchange = e => { const a = e.target.closest("[data-allg]"); if (a) dlg.querySelectorAll(`input[name=cls][data-g="${a.dataset.allg}"]`).forEach(c => c.checked = a.checked);
    const c = e.target.closest("input[name=cls]"); if (c) { const g = dlg.querySelector(`[data-allg="${c.dataset.g}"]`); if (g) g.checked = [...dlg.querySelectorAll(`input[name=cls][data-g="${c.dataset.g}"]`)].every(y => y.checked); } };
  dlg.onclick = null;
  document.getElementById("tf").onsubmit = async e => {
    if (e.submitter && e.submitter.value === "cancel") return;
    e.preventDefault();
    const v = id => document.getElementById(id).value.trim(), er = document.getElementById("fe");
    const row = { kind: v("fk"), title: v("ft"), trip_date: v("fd") || null, leave_time: v("fl") || null, return_time: v("fb") || null, place: v("fp") || null,
      reply_by: v("fr") || null, details: v("fx") || null, bring: v("fw") || null, cost: v("fc") || null, pay_note: v("fn") || null, staff_going: v("fs") || null,
      class_ids: [...dlg.querySelectorAll("input[name=cls]:checked")].map(c => String(c.value)), ask_medical: document.getElementById("fm").checked, ask_phone: document.getElementById("fph").checked };
    if (!row.title) { er.hidden = false; er.textContent = "Please add a title."; return; }
    if (row.reply_by && row.trip_date && row.reply_by > row.trip_date) { er.hidden = false; er.textContent = "The reply date should be on or before the day itself."; return; }
    document.getElementById("fsv").disabled = true;
    const res = t ? await sb.from("trips").update(row).eq("id", t.id).select().single()
                  : await sb.from("trips").insert(Object.assign(row, { school_id: String(school.id), created_by: me.id, status: "draft" })).select().single();
    if (res.error) { document.getElementById("fsv").disabled = false; er.hidden = false; er.textContent = "This wasn’t saved: " + res.error.message; return; }
    dlg.close(); await load(); toast("Saved."); location.hash = "trip=" + res.data.id; if (t) openTrip(res.data.id);
  };
}

// ---------- one trip ----------
async function act(t, action, note){
  const { data, error } = await sb.rpc("trip_status", { p_trip: t.id, p_action: action, p_note: note || null });
  if (error) return alert(error.message);
  if (data === "sent") mail({ id: t.id, kind: "send" });
  if (data === "pending") mail({ id: t.id, kind: "pending" });
  if (action === "return") mail({ id: t.id, kind: "returned" });
  if (action === "cancel" && t.status === "sent") mail({ id: t.id, kind: "cancelled" });
  toast({ sent: "Sent to parents. They’ll see it in the Parent Portal and get an email.", pending: "Sent to school leaders for approval.", draft: "Sent back to the organiser.", cancelled: "Cancelled. Parents have been told." }[data] || "Done.");
  await load(); openTrip(t.id);
}
function openTrip(id){
  const t = trips.find(x => x.id === id); if (!t) return listView();
  const c = counts(t), k = KINDS[t.kind] || KINDS.trip, rr = R[t.id] || {}, d0 = today(), live = t.status === "sent" || t.status === "cancelled";
  const last = (t.history || []).slice(-1)[0] || {};
  const rows = studsOf(t).map(s => ({ s, r: rr[String(s.id)] || {} })).filter(({ r }) => ui.filter === "all" || (ui.filter === "wait" && !r.answer) || (ui.filter === "yes" && r.answer === "yes")
    || (ui.filter === "no" && r.answer === "no") || (ui.filter === "notes" && r.note) || (ui.filter === "unpaid" && r.answer === "yes" && !r.paid));
  const btns = [];
  if (mine(t) && t.status !== "cancelled") btns.push(`<button class="btn ghost" data-a="edit">✏️ Edit</button>`);
  if (mine(t) && t.status === "draft") btns.push(`<button class="btn" data-a="send">${T().approval && !lead ? "📤 Send for SLT approval" : "📤 Send to parents"}</button>`);
  if (lead && t.status === "pending") btns.push(`<button class="btn" data-a="approve">✅ Approve and send to parents</button><button class="btn ghost" data-a="return">↩️ Send back with a note</button>`);
  if (mine(t) && t.status === "sent" && c.w) btns.push(`<button class="btn ghost" data-a="remind">🔔 Remind ${c.w} waiting</button>`);
  if (live) btns.push(`<button class="btn ghost" data-a="print">🖨️ Print the list</button><button class="btn ghost" data-a="csv">⬇️ Download</button>`);
  if (mine(t) && t.status === "sent") btns.push(`<button class="btn ghost" data-a="cancel">✖ Cancel</button>`);
  if (mine(t) && t.status !== "sent") btns.push(`<button class="btn ghost" data-a="del">🗑 Delete</button>`);
  const onDay = t.trip_date && t.trip_date <= d0;
  app.innerHTML = `<p><a href="#" class="note">← All trips and forms</a></p>
    <div class="card"><div class="row" style="justify-content:space-between"><span class="note">${k[0]} ${k[1]} · made by ${esc(staff[t.created_by] || "a colleague")}</span>${pill(t.status)}</div>
      <h1 class="ptitle" style="margin-top:6px">${esc(t.title)}</h1>
      ${t.status === "draft" && last.action === "return" ? `<p class="msg">↩️ Sent back by ${esc(last.name || "a school leader")}${last.note ? ": " + esc(last.note) : "."}</p>` : ""}
      <div class="facts"><div><b>Date</b>${t.trip_date ? esc(fmtD(t.trip_date)) : "Not set yet"}</div><div><b>Time</b>${esc([t.leave_time, t.return_time].filter(Boolean).join(" to ") || "Not set")}</div>
        <div><b>Place</b>${esc(t.place || "Not set")}</div><div><b>Parents reply by</b>${t.reply_by ? esc(fmtD(t.reply_by)) : "Any time before the day"}</div>
        <div><b>Cost</b>${esc(t.cost || "Free")}${t.pay_note ? `<br><span class="note">${esc(t.pay_note)}</span>` : ""}</div><div><b>Classes</b>${esc(classList(t))}</div>
        ${t.staff_going ? `<div><b>Staff going</b>${esc(t.staff_going)}</div>` : ""}</div>
      ${t.details ? `<p style="white-space:pre-line;margin:6px 0">${esc(t.details)}</p>` : ""}${t.bring ? `<p style="white-space:pre-line;margin:6px 0"><b>Bring or wear:</b> ${esc(t.bring)}</p>` : ""}
      <div class="row" style="margin-top:12px">${btns.join("")}</div></div>
    ${live ? `<div class="metrics"><div class="metric"><span>Going</span><b style="color:var(--sage)">${c.y}</b></div><div class="metric"><span>Not going</span><b style="color:var(--red)">${c.n}</b></div>
      <div class="metric"><span>Waiting for a reply</span><b>${c.w}</b></div>${t.cost ? `<div class="metric"><span>Paid</span><b>${c.paid} of ${c.y}</b></div>` : ""}</div>
    <div class="card"><div class="chips">${[["all", "Everyone"], ["wait", "Waiting"], ["yes", "Going"], ["no", "Not going"], ["notes", "With notes"]].concat(t.cost ? [["unpaid", "Going, not paid"]] : []).map(([f, l]) => `<button class="chip" data-f="${f}" aria-pressed="${ui.filter === f}">${l}</button>`).join("")}</div>
      <div class="tablewrap"><table class="reg"><thead><tr><th>Student</th><th>Class</th><th>Reply</th><th class="hide-sm">Signed by</th><th>Notes for the day</th>${t.ask_phone ? '<th class="hide-sm">Phone</th>' : ""}${t.cost ? "<th>Paid</th>" : ""}${onDay ? "<th>Came</th>" : ""}</tr></thead><tbody>
      ${rows.map(({ s, r }) => { const ok = canMark(t, s) && t.status === "sent";
        return `<tr><td><b>${esc(s.full_name)}</b></td><td>${esc(clsName(s.class_id))}</td>
        <td>${r.answer ? `<span class="ans ${r.answer}">${r.answer === "yes" ? "✓ Going" : "✗ Not going"}</span>${r.by_staff ? ' <span class="note">(paper)</span>' : ""}${ok && r.by_staff ? ` <button class="mini" data-m="${s.id}|answer|">undo</button>` : ""}`
          : `<span class="ans wait">Waiting</span>${ok ? ` <button class="mini" data-m="${s.id}|answer|yes" title="Record a paper slip: going">✓</button><button class="mini" data-m="${s.id}|answer|no" title="Record a paper slip: not going">✗</button>` : ""}`}</td>
        <td class="hide-sm">${esc(r.signed_name || "")}${r.answered_at ? `<br><span class="note">${new Date(r.answered_at).toLocaleDateString("en-GB", { day: "numeric", month: "short" })}</span>` : ""}</td>
        <td>${r.note ? `<span class="medi">${esc(r.note)}</span>` : ""}</td>${t.ask_phone ? `<td class="hide-sm">${esc(r.phone || "")}</td>` : ""}
        ${t.cost ? `<td>${r.answer === "yes" ? `<input type="checkbox" data-m="${s.id}|paid" ${r.paid ? "checked" : ""} ${canMark(t, s) ? "" : "disabled"} aria-label="Paid">` : ""}</td>` : ""}
        ${onDay ? `<td>${r.answer === "yes" ? `<select data-m="${s.id}|attended" ${canMark(t, s) ? "" : "disabled"}><option value="">–</option><option value="true" ${r.attended === true ? "selected" : ""}>Came</option><option value="false" ${r.attended === false ? "selected" : ""}>Didn’t come</option></select>` : ""}</td>` : ""}</tr>`; }).join("") || `<tr><td colspan="8" class="note">No students here.</td></tr>`}
      </tbody></table></div></div>`
    : `<div class="card"><p class="note" style="margin:0">${t.status === "pending" ? "⏳ A school leader will check this before it goes to parents." : "When you’re happy with it, click <b>Send to parents</b>. Parents will see it in the Parent Portal, get an email, and can say yes or no and sign."} ${studsOf(t).length} student${studsOf(t).length === 1 ? "" : "s"} in the chosen classes.</p></div>`}`;
  app.querySelector('a[href="#"]').onclick = e => { e.preventDefault(); location.hash = ""; };
  app.querySelectorAll("[data-f]").forEach(b => b.onclick = () => { ui.filter = b.dataset.f; openTrip(id); });
  app.querySelectorAll("[data-a]").forEach(b => b.onclick = async () => {
    const a = b.dataset.a;
    if (a === "edit") return editDialog(t);
    if (a === "send") { if (!(t.class_ids || []).length) return alert("Choose at least one class first (Edit)."); if (!t.trip_date) return alert("Add the date first (Edit).");
      if (!confirm(T().approval && !lead ? "Send this to a school leader to approve?" : `Send this to the parents of ${studsOf(t).length} students? They’ll get an email too.`)) return; return act(t, "send"); }
    if (a === "approve") { if (!confirm("Approve and send to parents now?")) return; return act(t, "approve"); }
    if (a === "return") { const n = prompt("What should the organiser change?", ""); if (n === null) return; return act(t, "return", n); }
    if (a === "cancel") { const n = prompt("Cancel this for everyone? Parents will be told. You can add a short reason:", ""); if (n === null) return; return act(t, "cancel", n); }
    if (a === "del") { if (!confirm("Delete this for good?")) return; const { error } = await sb.from("trips").delete().eq("id", t.id); if (error) return alert(error.message); await load(); location.hash = ""; return; }
    if (a === "remind") { if (t.reminded_at && Date.now() - new Date(t.reminded_at).getTime() < 20 * 3600e3) return alert("A reminder already went out today. You can send another tomorrow.");
      if (!confirm(`Email a reminder to the parents of the ${c.w} students who haven’t replied?`)) return; b.disabled = true;
      const { data, error } = await sb.functions.invoke("nestopia-mail", { body: { action: "trip", id: t.id, kind: "remind" } });
      if (error || (data && data.error)) { b.disabled = false; return alert("The reminder didn’t go: " + ((data && data.error) || error.message)); }
      toast(`Reminder sent to ${data && data.sent != null ? data.sent : "the"} parent${data && data.sent === 1 ? "" : "s"}.`); await load(); return openTrip(t.id); }
    if (a === "print") return printList(t);
    if (a === "csv") return csv(t);
  });
  app.querySelectorAll("[data-m]").forEach(el => { const ev = el.tagName === "BUTTON" ? "onclick" : "onchange"; el[ev] = async () => {
    const [sid, field, val] = el.dataset.m.split("|"), value = field === "paid" ? String(el.checked) : field === "attended" ? el.value : val;
    const { error } = await sb.rpc("trip_staff_mark", { p_trip: t.id, p_student: String(sid), p_field: field, p_value: value });
    if (error) { alert("This wasn’t saved: " + error.message); return openTrip(id); }
    const r = ((R[t.id] = R[t.id] || {})[String(sid)] = R[t.id][String(sid)] || {});
    if (field === "answer") Object.assign(r, { answer: value || null, by_staff: !!value, signed_name: value ? (r.signed_name || "Paper slip") : null, answered_at: value ? new Date().toISOString() : null });
    if (field === "paid") r.paid = value === "true"; if (field === "attended") r.attended = value === "" ? null : value === "true";
    if (field !== "attended") openTrip(id); else toast("Saved.");
  }; });
}
function printList(t){
  const rr = R[t.id] || {}, going = studsOf(t).filter(s => (rr[String(s.id)] || {}).answer === "yes"), notGoing = studsOf(t).filter(s => (rr[String(s.id)] || {}).answer !== "yes");
  const w = window.open("", "_blank"); if (!w) return alert("Please allow pop-ups to print.");
  w.document.write(`<!DOCTYPE html><html><head><meta charset="utf-8"><title>${esc(t.title)}</title><style>body{font-family:Arial,sans-serif;font-size:12.5px;margin:24px;color:#222}h1{font-size:19px;margin:0}p{margin:4px 0}
    table{width:100%;border-collapse:collapse;margin-top:12px}th,td{border:1px solid #bbb;padding:6px;text-align:left;vertical-align:top}th{background:#f0ecf5}td.box{width:60px}.n{color:#a35d00;font-weight:bold}</style></head><body>
    <h1>${esc(school.name || "")}: ${esc(t.title)}</h1><p>${esc(fmtD(t.trip_date))}${t.leave_time ? " · leaves " + esc(t.leave_time) : ""}${t.return_time ? " · back " + esc(t.return_time) : ""}${t.place ? " · " + esc(t.place) : ""}</p>
    ${t.staff_going ? `<p>Staff: ${esc(t.staff_going)}</p>` : ""}<p><b>${going.length}</b> going${notGoing.length ? ` · not going or no reply: ${esc(notGoing.map(s => s.full_name).join(", "))}` : ""}</p>
    <table><thead><tr><th>#</th><th>Student</th><th>Class</th><th>Notes for the day</th>${t.ask_phone ? "<th>Phone</th>" : ""}<th>Out</th><th>Back</th></tr></thead><tbody>
    ${going.map((s, i) => { const r = rr[String(s.id)]; return `<tr><td>${i + 1}</td><td>${esc(s.full_name)}</td><td>${esc(clsName(s.class_id))}</td><td class="n">${esc(r.note || "")}</td>${t.ask_phone ? `<td>${esc(r.phone || "")}</td>` : ""}<td class="box"></td><td class="box"></td></tr>`; }).join("")}
    </tbody></table><script>setTimeout(()=>print(),300)<\/script></body></html>`);
  w.document.close();
}
function csv(t){
  const rr = R[t.id] || {}, q = v => `"${String(v ?? "").replace(/"/g, '""')}"`;
  const lines = [["Student", "Class", "Reply", "Signed by", "Paper slip", "Notes for the day", "Phone", "Paid", "Came"].map(q).join(",")].concat(studsOf(t).map(s => { const r = rr[String(s.id)] || {};
    return [s.full_name, clsName(s.class_id), r.answer === "yes" ? "Going" : r.answer === "no" ? "Not going" : "Waiting", r.signed_name, r.by_staff ? "Yes" : "", r.note, r.phone, r.paid ? "Yes" : "", r.attended === true ? "Yes" : r.attended === false ? "No" : ""].map(q).join(","); }));
  const a = document.createElement("a"); a.href = URL.createObjectURL(new Blob(["﻿" + lines.join("\n")], { type: "text/csv" })); a.download = t.title.replace(/[^\w]+/g, "-") + ".csv"; a.click();
}

// ---------- settings (school leaders) ----------
function settingsDialog(){
  if (!setupId) return alert("Finish the school setup in TwigNest first.");
  dlg.innerHTML = `<form class="dlg" method="dialog" id="sf"><h2>Trips settings</h2>
    <label style="display:flex;gap:10px;align-items:flex-start;font-weight:600"><input type="checkbox" id="sa" ${T().approval ? "checked" : ""} style="margin-top:5px"> <span>A school leader must approve trips before they go to parents<br><span class="note">Teachers click “Send for SLT approval”. Leaders see it under “Waiting for approval” and in their morning email.</span></span></label>
    <div class="row" style="justify-content:flex-end"><button class="btn ghost" value="cancel">Cancel</button><button class="btn" id="ss" value="ok">Save</button></div></form>`;
  dlg.showModal(); dlg.onchange = null; dlg.onclick = null;
  document.getElementById("sf").onsubmit = async e => { if (e.submitter && e.submitter.value === "cancel") return; e.preventDefault();
    const { data: row, error: e1 } = await sb.from("school_setups").select("id,config").eq("id", setupId).single(); if (e1) return alert("This wasn’t saved: " + e1.message);
    const cfg = row.config || {}; cfg.trips = Object.assign({}, cfg.trips || {}, { approval: document.getElementById("sa").checked });
    const { error } = await sb.from("school_setups").update({ config: cfg }).eq("id", setupId); if (error) return alert("This wasn’t saved: " + error.message);
    C = cfg; dlg.close(); toast("Trips settings saved."); listView(); };
}
start();
