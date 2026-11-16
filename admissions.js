/* ===== Nestopia · Admissions =====
   Families apply online (apply.html). The admissions team reviews each application, books an assessment, makes an
   offer, and once the family accepts, enrols the child into a class in one click. Each step emails the family. */
const PLATFORM = "Nestopia";
const sb = supabase.createClient("https://gvhzbxpgebgjnegdiijp.supabase.co", "sb_publishable_aEQ4MVt00kNu8PaVtrNnqQ_9guhxPYM");
const app = document.getElementById("app"), who = document.getElementById("who"), dlg = document.getElementById("dlg");
const esc = t => String(t ?? "").replace(/[&<>"]/g, c => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;" }[c]));
const toast = m => { const t = document.getElementById("toast"); t.textContent = m; t.classList.add("on"); clearTimeout(toast.h); toast.h = setTimeout(() => t.classList.remove("on"), 3000); };
const fmtD = d => d ? new Date(String(d).length === 10 ? d + "T12:00:00" : d).toLocaleDateString("en-GB", { day: "numeric", month: "short", year: "numeric" }) : "";
const ST = { new: ["New", "part"], reviewing: ["Being reviewed", "part"], assessment: ["Assessment booked", "part"], offered: ["Offer sent", "ok"], accepted: ["Accepted: ready to enrol", "ok"], enrolled: ["Enrolled", "ok"], waitlist: ["Waiting list", "none"], declined: ["Declined", "warn"], withdrawn: ["Withdrawn", "none"] };
const OPEN = ["new", "reviewing", "assessment", "offered", "accepted"];

let me, school, C = {}, setupId, year, canEdit = false, apps = [], classes = [], ui = { st: "open", grade: "" };
const gName = id => ((C.grades || []).find(g => String(g.id) === String(id)) || {}).name || "";
const mail = id => sb.functions.invoke("nestopia-mail", { body: { action: "admission", id } }).catch(() => {});
function fail(t){ app.innerHTML = `<div class="card"><div class="msg">${esc(t)}</div></div>`; }
const age = d => { if (!d) return ""; const b = new Date(d + "T12:00:00"), n = new Date(); let y = n.getFullYear() - b.getFullYear(); if (n < new Date(n.getFullYear(), b.getMonth(), b.getDate())) y--; return y + " years"; };

async function start(){
  const { data: { session } } = await sb.auth.getSession(); if (!session) { location.href = "./"; return; }
  const { data: p } = await sb.from("profiles").select("*").eq("id", session.user.id).single();
  if (!p || !p.school_id) return fail("Your account isn’t linked to a school yet.");
  me = p; who.innerHTML = `<span>${esc(p.full_name || p.email)}</span><a class="btn ghost small" href="./">← ${esc(PLATFORM)}</a>`;
  const { data: s } = await sb.from("schools").select("*").eq("id", p.school_id).single(); school = s;
  if (!school || school.status !== "active" || !p.active) return fail("Your school or account isn’t active yet.");
  if (window.hubInit) hubInit("admissions");
  const lv = (await NestAccess.mine(sb)).admissions || "N"; if (lv === "N") return; canEdit = lv === "E";
  const set = await sb.from("school_setups").select("id,year,config").eq("school_id", school.id).order("updated_at", { ascending: false }).limit(1);
  if (set.data && set.data[0]) { setupId = set.data[0].id; C = set.data[0].config || {}; year = set.data[0].year; }
  let cq = sb.from("classes").select("id,name,grade_id").eq("school_id", school.id); if (year) cq = cq.eq("year", year);
  classes = ((await cq).data || []).sort((a, b) => String(a.name).localeCompare(String(b.name), undefined, { numeric: true }));
  await load(); window.addEventListener("hashchange", route); route();
}
async function load(){ const r = await sb.from("admissions").select("*").eq("school_id", String(school.id)).order("created_at", { ascending: false }); if (r.error) return fail("Please run admissions.sql in Supabase first."); apps = r.data || []; }
function route(){ const h = location.hash.slice(1); if (h.startsWith("a=")) return detail(h.slice(2)); if (h === "settings") return settings(); list(); }

function list(){
  const cnt = k => apps.filter(a => k === "open" ? OPEN.includes(a.status) : a.status === k).length;
  const shown = apps.filter(a => (ui.st === "open" ? OPEN.includes(a.status) : a.status === ui.st) && (!ui.grade || a.grade_id === ui.grade));
  const link = location.origin + "/apply.html?s=" + school.id, A = C.admissions || {};
  app.innerHTML = `<div class="phead"><div><h1 class="ptitle">Admissions</h1><p class="note" style="margin:0">Applications from families, from the first form to enrolment.</p></div>
      <div class="row"><button class="btn ghost" id="cp">🔗 Copy the application link</button>${canEdit ? '<a class="btn ghost" href="#settings">⚙️ Settings</a>' : ""}</div></div>
    ${!A.open ? `<p class="okmsg" style="background:var(--amber-soft);color:var(--amber)">Applications are closed. ${canEdit ? 'Open them in <a href="#settings">Settings</a> when you’re ready.' : ""}</p>` : ""}
    <div class="metrics">${[["new", "New"], ["assessment", "Assessments"], ["offered", "Offers out"], ["accepted", "Ready to enrol"], ["enrolled", "Enrolled"]].map(([k, l]) => `<div class="metric"><span>${l}</span><b>${cnt(k)}</b></div>`).join("")}</div>
    <div class="row" style="margin-bottom:10px"><div class="stg">${[["open", "In progress"], ["new", "New"], ["reviewing", "Being reviewed"], ["assessment", "Assessment"], ["offered", "Offer sent"], ["accepted", "Ready to enrol"], ["enrolled", "Enrolled"], ["waitlist", "Waiting list"], ["declined", "Declined"], ["withdrawn", "Withdrawn"]]
      .map(([k, l]) => `<button class="chip" data-s="${k}" aria-pressed="${ui.st === k}">${l} (${cnt(k)})</button>`).join("")}</div>
      <select id="gf"><option value="">All grades</option>${(C.grades || []).map(g => `<option value="${esc(g.id)}" ${ui.grade === String(g.id) ? "selected" : ""}>${esc(g.name)}</option>`).join("")}</select></div>
    ${shown.length ? shown.map(a => `<button class="lrow" data-a="${a.id}"><span style="flex:1"><b>${esc(a.child.name || "")}</b> · ${esc(gName(a.grade_id))}<br><span class="note">${esc([a.parent.name, a.parent.phone, "applied " + fmtD(a.created_at)].filter(Boolean).join(" · "))}</span></span>
      ${(a.docs || []).length ? `<span class="note">📎 ${a.docs.length}</span>` : ""}<span class="cnt ${ST[a.status][1]}">${ST[a.status][0]}</span></button>`).join("")
      : `<div class="card empty"><p class="note">No applications here yet.</p></div>`}`;
  app.querySelectorAll("[data-s]").forEach(b => b.onclick = () => { ui.st = b.dataset.s; list(); });
  document.getElementById("gf").onchange = e => { ui.grade = e.target.value; list(); };
  app.querySelectorAll("[data-a]").forEach(b => b.onclick = () => location.hash = "a=" + b.dataset.a);
  document.getElementById("cp").onclick = async () => { try { await navigator.clipboard.writeText(link); toast("Link copied. Put it on your website or send it to families."); } catch (_) { prompt("Copy this link:", link); } };
}

async function detail(id){
  const a = apps.find(x => x.id === id); if (!a) { location.hash = ""; return; }
  const c = a.child || {}, p = a.parent || {}, x = a.extra || {};
  const row = (l, v) => v ? `<b>${l}</b><span>${esc(v)}</span>` : "";
  const acts = [];
  if (canEdit && a.status !== "enrolled") {
    if (["new"].includes(a.status)) acts.push(`<button class="btn ghost" data-m="reviewing">👀 Start reviewing</button>`);
    if (["new", "reviewing", "waitlist", "assessment"].includes(a.status)) acts.push(`<button class="btn ghost" data-m="assessment">📅 ${a.status === "assessment" ? "Change the assessment" : "Book an assessment"}</button>`);
    if (["new", "reviewing", "assessment", "waitlist"].includes(a.status)) acts.push(`<button class="btn" data-m="offered">🎉 Offer a place</button>`);
    if (["accepted", "offered"].includes(a.status)) acts.push(`<button class="btn" data-enrol>🎒 Enrol ${esc((c.name || "").split(" ")[0])}</button>`);
    if (OPEN.includes(a.status)) acts.push(`<button class="btn ghost" data-m="waitlist">⏳ Waiting list</button><button class="btn ghost" data-m="declined">✖ Decline</button>`);
    if (["waitlist", "declined", "withdrawn"].includes(a.status)) acts.push(`<button class="btn ghost" data-m="reviewing">↺ Reopen</button>`);
  }
  const urls = await Promise.all((a.docs || []).map(async d => { const { data } = await sb.storage.from("admissions").createSignedUrl(d.path, 3600); return data ? data.signedUrl : null; }));
  app.innerHTML = `<p><a href="#" class="note" id="bk">← All applications</a></p>
    <div class="card"><div class="row" style="justify-content:space-between"><span class="cnt ${ST[a.status][1]}">${ST[a.status][0]}</span><span class="note">Applied ${fmtD(a.created_at)}</span></div>
      <h1 class="ptitle" style="margin-top:6px">${esc(c.name || "")}${c.arabic_name ? ` <span dir="rtl" lang="ar" class="note" style="font-size:18px">${esc(c.arabic_name)}</span>` : ""}</h1>
      <p class="note" style="margin:0">${esc([gName(a.grade_id), c.dob ? age(c.dob) : "", a.start_date ? "start " + fmtD(a.start_date) : ""].filter(Boolean).join(" · "))}</p>
      ${a.status === "assessment" && a.assessment_at ? `<p style="margin:8px 0 0">📅 Assessment: <b>${esc(new Date(a.assessment_at).toLocaleString("en-GB", { weekday: "short", day: "numeric", month: "short", hour: "2-digit", minute: "2-digit" }))}</b></p>` : ""}
      ${a.status === "enrolled" && a.student_id ? `<p class="okmsg" style="margin-top:8px">🎒 Enrolled. <a href="students.html">Open Students</a> · <a href="parents.html">Parent portal invitations</a></p>` : ""}
      <div class="row" style="margin-top:12px">${acts.join("")}</div></div>
    <div class="two"><div class="card"><h2>👧 Child</h2><div class="kv">${row("Date of birth", c.dob ? fmtD(c.dob) + " (" + age(c.dob) + ")" : "")}${row("Gender", c.gender)}${row("Nationality", c.nationality)}${row("Emirati", c.emirati)}${row("Current school", c.current_school)}${row("Brothers or sisters here", x.siblings)}${row("Heard about us", x.heard)}</div></div>
      <div class="card"><h2>👪 Family</h2><div class="kv">${row("Parent", [p.name, p.relation].filter(Boolean).join(", "))}${row("Email", p.email)}${row("Mobile", p.phone)}${row("Second parent", [p.name2, p.relation2].filter(Boolean).join(", "))}${row("Email", p.email2)}${row("Mobile", p.phone2)}${row("Address", p.address)}</div></div></div>
    <div class="two"><div class="card"><h2>🩺 Health and support</h2><div class="kv">${row("Allergies", c.allergies) || ""}${row("Medical", c.conditions)}${row("Medication", c.medication)}${row("Support needs", c.support)}</div>${!(c.allergies || c.conditions || c.medication || c.support) ? '<p class="note">Nothing shared.</p>' : ""}</div>
      <div class="card"><h2>📎 Documents</h2>${(a.docs || []).length ? a.docs.map((d, i) => `<p style="margin:4px 0">${urls[i] ? `<a href="${urls[i]}" target="_blank" rel="noopener">${esc(d.name)}</a>` : esc(d.name)} <span class="note">${fmtD(d.at)}</span></p>`).join("") : '<p class="note">None yet. The family can add them from their tracking link.</p>'}</div></div>
    <div class="card"><h2>Notes and history</h2>${canEdit ? `<div class="row" style="margin-bottom:10px"><input type="text" id="nt" placeholder="Add a note for the admissions team (the family doesn’t see this)" style="flex:1"><button class="btn small" id="na">Add</button></div>` : ""}
      ${[...(a.notes || []).map(n => ({ at: n.at, html: `📝 <b>${esc(n.name || "")}</b>: ${esc(n.text)}` })), ...(a.history || []).map(h => ({ at: h.at, html: `→ <b>${esc((ST[h.to] || [h.to])[0])}</b>${h.name ? " by " + esc(h.name) : ""}${h.note ? ": " + esc(h.note) : ""}` }))]
        .sort((m, n) => String(n.at).localeCompare(String(m.at))).map(e => `<div class="hist">${e.html} <span>· ${fmtD(e.at)}</span></div>`).join("")}</div>`;
  document.getElementById("bk").onclick = e => { e.preventDefault(); location.hash = ""; };
  const na = document.getElementById("na"); if (na) na.onclick = async () => { const t = document.getElementById("nt").value.trim(); if (!t) return;
    const { error } = await sb.rpc("admissions_note", { p_id: a.id, p_text: t }); if (error) return alert(error.message); await load(); detail(id); };
  app.querySelectorAll("[data-m]").forEach(b => b.onclick = () => moveDialog(a, b.dataset.m));
  const en = app.querySelector("[data-enrol]"); if (en) en.onclick = () => enrolDialog(a);
}
function moveDialog(a, to){
  const first = (a.child.name || "").split(" ")[0];
  const T = { reviewing: ["Start reviewing", "", false], assessment: ["Book an assessment", `The family gets an email with the date and time.`, true], offered: ["Offer a place", `The family gets an email and accepts or declines from their link.`, true],
    waitlist: ["Move to the waiting list", "The family gets a kind email.", true], declined: ["Decline", "The family gets a kind email. Add a short message if you like.", true] }[to];
  dlg.innerHTML = `<form class="dlg" method="dialog"><h2>${T[0]}: ${esc(a.child.name)}</h2>${T[1] ? `<p class="note" style="margin:0">${T[1]}</p>` : ""}
    ${to === "assessment" ? `<label class="f">Date and time<input type="datetime-local" id="at" required></label>` : ""}
    ${to === "offered" ? `<div class="two"><label class="f">Grade<select id="og">${(C.grades || []).map(g => `<option value="${esc(g.id)}" ${String(g.id) === String(a.grade_id) ? "selected" : ""}>${esc(g.name)}</option>`).join("")}</select></label><label class="f">Start date<input type="date" id="os" value="${esc(a.start_date || "")}"></label></div>` : ""}
    ${to !== "reviewing" ? `<label class="f">Message to the family (optional)<textarea id="nm" rows="3" placeholder="${to === "assessment" ? "e.g. Please come to the main reception. It takes about 45 minutes." : to === "offered" ? "e.g. Fees and the next steps are attached in our welcome pack." : ""}"></textarea></label>` : ""}
    ${T[2] ? `<label class="checks"><input type="checkbox" id="em" checked> Email the family</label>` : ""}
    <div class="row" style="justify-content:flex-end"><button class="btn ghost" value="cancel" formnovalidate>Cancel</button><button class="btn" value="ok">${T[0]}</button></div></form>`;
  dlg.showModal(); dlg.onchange = null; dlg.onclick = null;
  dlg.querySelector("form").onsubmit = async e => { if (!e.submitter || e.submitter.value !== "ok") return; e.preventDefault();
    const g = id => { const el = document.getElementById(id); return el ? el.value : null; };
    const offer = to === "offered" ? { grade_id: g("og"), start: g("os") || null, note: (g("nm") || "").trim() || null } : null;
    const { error } = await sb.rpc("admissions_move", { p_id: a.id, p_status: to, p_note: to === "offered" ? null : (g("nm") || "").trim() || null, p_at: to === "assessment" ? new Date(g("at")).toISOString() : null, p_offer: offer });
    if (error) return alert(error.message);
    if (T[2] && document.getElementById("em").checked) mail(a.id);
    dlg.close(); toast(`${first}: ${ST[to][0].toLowerCase()}.`); await load(); detail(a.id); };
}
function enrolDialog(a){
  const g = (a.offer && a.offer.grade_id) || a.grade_id, cl = classes.filter(c => String(c.grade_id) === String(g)), other = classes.filter(c => String(c.grade_id) !== String(g));
  dlg.innerHTML = `<form class="dlg" method="dialog"><h2>🎒 Enrol ${esc(a.child.name)}</h2>
    ${a.status === "offered" ? `<p class="okmsg" style="background:var(--amber-soft);color:var(--amber)">The family hasn’t accepted the offer in Nestopia yet. Enrol only if they told you they accept.</p>` : ""}
    <label class="f">Name on the school record<input type="text" id="en" value="${esc(a.child.name || "")}" required></label>
    <label class="f">Class<select id="ec" required><option value="">Choose…</option>${cl.length ? `<optgroup label="${esc(gName(g))}">${cl.map(c => `<option value="${c.id}">${esc(c.name)}</option>`).join("")}</optgroup>` : ""}${other.length ? `<optgroup label="Other classes">${other.map(c => `<option value="${c.id}">${esc(c.name)}</option>`).join("")}</optgroup>` : ""}</select></label>
    <p class="note" style="margin:0">This adds the student to the class, copies their health notes into the medical record and the parents into family contacts, makes the parent portal invitation and emails it to the family.</p>
    <div class="row" style="justify-content:flex-end"><button class="btn ghost" value="cancel" formnovalidate>Cancel</button><button class="btn" value="ok" id="eb">Enrol</button></div></form>`;
  dlg.showModal(); dlg.onchange = null; dlg.onclick = null;
  dlg.querySelector("form").onsubmit = async e => { if (!e.submitter || e.submitter.value !== "ok") return; e.preventDefault(); document.getElementById("eb").disabled = true;
    const { error } = await sb.rpc("admissions_enrol", { p_id: a.id, p_class: document.getElementById("ec").value, p_name: document.getElementById("en").value });
    if (error) { document.getElementById("eb").disabled = false; return alert(error.message); }
    try { await sb.rpc("parent_make_codes"); } catch (_) {}
    mail(a.id); dlg.close(); toast("Enrolled. The family has been emailed their parent portal invitation."); await load(); detail(a.id); };
}
function settings(){
  if (!canEdit) { location.hash = ""; return; }
  const A = Object.assign({ open: false, intro: "", grades: null }, C.admissions || {}), sel = new Set((A.grades || (C.grades || []).map(g => String(g.id))).map(String));
  app.innerHTML = `<p><a href="#" class="note" id="bk">← Admissions</a></p><div class="card"><h2>Admissions settings</h2>
    <label class="checks" style="margin-bottom:10px"><input type="checkbox" id="so" ${A.open ? "checked" : ""}> <b>Applications are open</b></label>
    <p style="margin:0 0 6px;font-weight:700">Grades families can apply for</p><div class="checks" style="margin-bottom:12px">${(C.grades || []).map(g => `<label><input type="checkbox" data-g="${esc(g.id)}" ${sel.has(String(g.id)) ? "checked" : ""}> ${esc(g.name)}</label>`).join("")}</div>
    <label class="f">Welcome message at the top of the form (optional)<textarea id="si" rows="4" placeholder="e.g. Thank you for choosing our school. Applications for 2027–2028 close on 31 March. We will contact you within a week.">${esc(A.intro || "")}</textarea></label>
    <div class="row" style="margin-top:12px"><button class="btn" id="ss">Save</button><a class="btn ghost" href="apply.html?s=${school.id}" target="_blank" rel="noopener">👀 See the form</a></div></div>`;
  document.getElementById("bk").onclick = e => { e.preventDefault(); location.hash = ""; };
  document.getElementById("ss").onclick = async () => {
    const { data: row, error: e1 } = await sb.from("school_setups").select("id,config").eq("id", setupId).single(); if (e1) return alert("This wasn’t saved: " + e1.message);
    const cfg = row.config || {}; cfg.admissions = { open: document.getElementById("so").checked, intro: document.getElementById("si").value.trim(), grades: [...app.querySelectorAll("[data-g]:checked")].map(x => x.dataset.g) };
    const { error } = await sb.from("school_setups").update({ config: cfg }).eq("id", setupId); if (error) return alert("This wasn’t saved: " + error.message);
    C = cfg; toast("Admissions settings saved."); };
}
start();
