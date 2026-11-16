/* ===== Nestopia · Fees and payments =====
   Set fees per grade, create invoices (for grades, classes or one student), record payments (cash, card, transfer,
   cheque) with receipts, print invoices, and remind families about overdue amounts. Parents see their invoices and
   how to pay in the Parent Portal. Nestopia records payments; it doesn't take card payments online. */
const PLATFORM = "Nestopia";
const sb = supabase.createClient("https://gvhzbxpgebgjnegdiijp.supabase.co", "sb_publishable_aEQ4MVt00kNu8PaVtrNnqQ_9guhxPYM");
const app = document.getElementById("app"), who = document.getElementById("who"), dlg = document.getElementById("dlg");
const esc = t => String(t ?? "").replace(/[&<>"]/g, c => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;" }[c]));
const toast = m => { const t = document.getElementById("toast"); t.textContent = m; t.classList.add("on"); clearTimeout(toast.h); toast.h = setTimeout(() => t.classList.remove("on"), 3000); };
const fmtD = d => d ? new Date(String(d).length === 10 ? d + "T12:00:00" : d).toLocaleDateString("en-GB", { day: "numeric", month: "short", year: "numeric" }) : "";
const today = () => { const p = Object.fromEntries(new Intl.DateTimeFormat("en-GB", { timeZone: "Asia/Dubai", year: "numeric", month: "2-digit", day: "2-digit" }).formatToParts(new Date()).map(x => [x.type, x.value])); return `${p.year}-${p.month}-${p.day}`; };
const METHOD = { cash: "Cash", card: "Card", transfer: "Bank transfer", cheque: "Cheque", other: "Other" };

let me, school, C = {}, setupId, year, canEdit = false, classes = [], studs = [], inv = [], pays = [], ui = { tab: "overview", st: "unpaid", q: "", cls: "" };
const F = () => Object.assign({ currency: "AED", how: "", items: [] }, C.fees || {});
const money = n => `${F().currency} ${Number(n || 0).toLocaleString("en-GB", { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
const clsName = id => (classes.find(c => String(c.id) === String(id)) || {}).name || "";
const stu = id => studs.find(s => String(s.id) === String(id)) || { full_name: "(left the school)" };
const gradeOfS = s => (classes.find(c => String(c.id) === String(s.class_id)) || {}).grade_id;
const paidOf = i => pays.filter(p => p.invoice_id === i.id).reduce((a, p) => a + Number(p.amount), 0);
const state = i => { if (i.status === "cancelled") return "cancelled"; const p = paidOf(i), b = Number(i.total) - p; if (b <= 0.001) return "paid"; if (i.due_date && i.due_date < today()) return "overdue"; return p > 0 ? "part" : "unpaid"; };
const SL = { unpaid: ["Unpaid", "part"], part: ["Part paid", "part"], overdue: ["Overdue", "warn"], paid: ["Paid", "ok"], cancelled: ["Cancelled", "none"] };
function fail(t){ app.innerHTML = `<div class="card"><div class="msg">${esc(t)}</div></div>`; }
async function fetchAll(q){ const out = []; for (let f = 0; ; f += 1000) { const { data, error } = await q().range(f, f + 999); if (error) throw error; out.push(...data); if (data.length < 1000) break; } return out; }

async function start(){
  const { data: { session } } = await sb.auth.getSession(); if (!session) { location.href = "./"; return; }
  const { data: p } = await sb.from("profiles").select("*").eq("id", session.user.id).single();
  if (!p || !p.school_id) return fail("Your account isn’t linked to a school yet.");
  me = p; who.innerHTML = `<span>${esc(p.full_name || p.email)}</span><a class="btn ghost small" href="./">← ${esc(PLATFORM)}</a>`;
  const { data: s } = await sb.from("schools").select("*").eq("id", p.school_id).single(); school = s;
  if (!school || school.status !== "active" || !p.active) return fail("Your school or account isn’t active yet.");
  if (window.hubInit) hubInit("fees");
  const lv = (await NestAccess.mine(sb)).fees || "N"; if (lv === "N") return; canEdit = lv === "E";
  const set = await sb.from("school_setups").select("id,year,config").eq("school_id", school.id).order("updated_at", { ascending: false }).limit(1);
  if (set.data && set.data[0]) { setupId = set.data[0].id; C = set.data[0].config || {}; year = set.data[0].year; }
  classes = ((await sb.from("classes").select("id,name,grade_id").eq("school_id", school.id)).data || []).sort((a, b) => String(a.name).localeCompare(String(b.name), undefined, { numeric: true }));
  studs = (await fetchAll(() => sb.from("students").select("id,full_name,class_id,archived").eq("school_id", school.id))).sort((a, b) => String(a.full_name).localeCompare(String(b.full_name)));
  await load();
  const h = location.hash.slice(1); if (["overview", "invoices", "new", "settings"].includes(h)) ui.tab = h;
  draw();
}
async function load(){
  const r = await sb.from("fee_invoices").select("*").eq("school_id", String(school.id)).order("seq", { ascending: false }); if (r.error) return fail("Please run fees.sql in Supabase first.");
  inv = r.data || []; pays = [];
  for (let i = 0; i < inv.length; i += 200) pays.push(...((await sb.from("fee_payments").select("*").in("invoice_id", inv.slice(i, i + 200).map(x => x.id))).data || []));
}
function draw(){
  if (!canEdit && ["new", "settings"].includes(ui.tab)) ui.tab = "overview";
  app.innerHTML = `<div class="phead"><div><h1 class="ptitle">Fees</h1><p class="note" style="margin:0">Invoices, payments and balances. Families see theirs in the Parent Portal.</p></div></div>
    <div class="tabs" role="tablist">${[["overview", "Overview"], ["invoices", "Invoices"], canEdit && ["new", "+ New invoices"], canEdit && ["settings", "⚙️ Fees and settings"]].filter(Boolean)
      .map(([k, l]) => `<button class="tab" data-t="${k}" aria-selected="${ui.tab === k}">${l}</button>`).join("")}</div><div id="pane"></div>`;
  app.querySelectorAll("[data-t]").forEach(b => b.onclick = () => { ui.tab = b.dataset.t; history.replaceState(null, "", "#" + ui.tab); draw(); });
  ({ overview, invoices, new: newInv, settings })[ui.tab]();
}

// ---------- overview ----------
function overview(){
  const live = inv.filter(i => i.status !== "cancelled"), billed = live.reduce((a, i) => a + Number(i.total), 0), got = live.reduce((a, i) => a + paidOf(i), 0);
  const od = live.filter(i => state(i) === "overdue"), odAmt = od.reduce((a, i) => a + Number(i.total) - paidOf(i), 0);
  const byG = {}; live.forEach(i => { const g = gradeOfS(stu(i.student_id)) || "?"; const x = byG[g] = byG[g] || { b: 0, p: 0 }; x.b += Number(i.total); x.p += paidOf(i); });
  const gName = id => ((C.grades || []).find(g => String(g.id) === String(id)) || {}).name || "Other";
  document.getElementById("pane").innerHTML = `<div class="metrics"><div class="metric"><span>Invoiced</span><b class="money" style="font-size:22px">${money(billed)}</b></div><div class="metric"><span>Collected</span><b class="money" style="font-size:22px;color:var(--sage)">${money(got)}</b></div>
      <div class="metric"><span>Still to pay</span><b class="money" style="font-size:22px">${money(billed - got)}</b></div><div class="metric"><span>Overdue</span><b class="money" style="font-size:22px;color:var(--red)">${money(odAmt)}</b><span>${od.length} invoice${od.length === 1 ? "" : "s"}</span></div></div>
    ${canEdit && od.length ? `<div class="card"><div class="row" style="justify-content:space-between"><p style="margin:0"><b>${od.length}</b> overdue invoice${od.length === 1 ? "" : "s"}. Families can be reminded by email (once every 3 days).</p><button class="btn" id="rem">📧 Remind overdue families</button></div></div>` : ""}
    <div class="card"><h2>By grade</h2>${Object.keys(byG).length ? `<table class="reg"><tr><th>Grade</th><th>Invoiced</th><th>Collected</th><th>Still to pay</th><th></th></tr>${Object.entries(byG).map(([g, x]) => `<tr><td>${esc(gName(g))}</td><td class="money">${money(x.b)}</td><td class="money">${money(x.p)}</td><td class="money">${money(x.b - x.p)}</td><td style="width:30%"><div class="bar"><i class="a" style="width:${x.b ? x.p / x.b * 100 : 0}%"></i></div></td></tr>`).join("")}</table>` : '<p class="note">No invoices yet.</p>'}</div>`;
  const rm = document.getElementById("rem"); if (rm) rm.onclick = async () => { if (!confirm("Email the families with overdue invoices?")) return; rm.disabled = true;
    const { data, error } = await sb.functions.invoke("nestopia-mail", { body: { action: "fees", kind: "overdue" } });
    rm.disabled = false; if (error || (data && data.error)) return alert("The reminders didn’t go: " + ((data && data.error) || error.message)); toast(`Reminders sent to ${data.sent || 0} famil${data.sent === 1 ? "y" : "ies"}.`); await load(); };
}

// ---------- invoices ----------
function invoices(){
  const pane = document.getElementById("pane");
  const rows = inv.filter(i => { const s = stu(i.student_id), st = state(i);
    return (ui.st === "all" || (ui.st === "unpaid" ? ["unpaid", "part", "overdue"].includes(st) : st === ui.st)) && (!ui.cls || String(s.class_id) === ui.cls)
      && (!ui.q || (s.full_name || "").toLowerCase().includes(ui.q.toLowerCase()) || String(i.number || "").toLowerCase().includes(ui.q.toLowerCase()) || String(i.title).toLowerCase().includes(ui.q.toLowerCase())); });
  pane.innerHTML = `<div class="row" style="margin-bottom:10px"><input type="search" id="q" placeholder="Search a student, invoice number or title" value="${esc(ui.q)}" style="max-width:320px">
      <select id="cf"><option value="">All classes</option>${classes.map(c => `<option value="${c.id}" ${String(c.id) === ui.cls ? "selected" : ""}>${esc(c.name)}</option>`).join("")}</select>
      <div class="chips" style="margin:0">${[["unpaid", "To pay"], ["overdue", "Overdue"], ["paid", "Paid"], ["cancelled", "Cancelled"], ["all", "All"]].map(([k, l]) => `<button class="chip" data-s="${k}" aria-pressed="${ui.st === k}">${l}</button>`).join("")}</div></div>
    <div class="card"><div class="tablewrap"><table class="reg"><thead><tr><th>Invoice</th><th>Student</th><th>For</th><th>Total</th><th>Paid</th><th>Balance</th><th>Due</th><th></th></tr></thead><tbody>
    ${rows.slice(0, 400).map(i => { const s = stu(i.student_id), p = paidOf(i), st = state(i);
      return `<tr><td><b>${esc(i.number || "")}</b><br><span class="cnt ${SL[st][1]}">${SL[st][0]}</span></td><td><b>${esc(s.full_name)}</b><br><span class="note">${esc(clsName(s.class_id))}</span></td><td>${esc(i.title)}</td>
        <td class="money">${money(i.total)}</td><td class="money">${money(p)}</td><td class="money"><b>${money(Number(i.total) - p)}</b></td><td>${esc(fmtD(i.due_date))}</td>
        <td><div class="row" style="flex-wrap:nowrap">${canEdit && ["unpaid", "part", "overdue"].includes(st) ? `<button class="btn small" style="white-space:nowrap" data-pay="${i.id}">💵 Payment</button>` : ""}<button class="mini" data-pr="${i.id}" title="Print">🖨️</button>${canEdit && st !== "cancelled" && !p ? `<button class="mini" data-cx="${i.id}" title="Cancel">✕</button>` : ""}</div></td></tr>`; }).join("") || `<tr><td colspan="8" class="note">No invoices here.</td></tr>`}
    </tbody></table></div>${rows.length > 400 ? `<p class="note">Showing the first 400. Search to narrow it down.</p>` : ""}</div>`;
  const q = document.getElementById("q"); q.oninput = () => { ui.q = q.value; clearTimeout(q.t); q.t = setTimeout(() => { invoices(); const n = document.getElementById("q"); n.focus(); n.setSelectionRange(n.value.length, n.value.length); }, 250); };
  document.getElementById("cf").onchange = e => { ui.cls = e.target.value; invoices(); };
  pane.querySelectorAll("[data-s]").forEach(b => b.onclick = () => { ui.st = b.dataset.s; invoices(); });
  pane.querySelectorAll("[data-pay]").forEach(b => b.onclick = () => payDialog(inv.find(i => i.id === b.dataset.pay)));
  pane.querySelectorAll("[data-pr]").forEach(b => b.onclick = () => printInv(inv.find(i => i.id === b.dataset.pr)));
  pane.querySelectorAll("[data-cx]").forEach(b => b.onclick = async () => { const n = prompt("Cancel this invoice? You can add a reason:", ""); if (n === null) return;
    const { error } = await sb.rpc("fees_cancel", { p_invoice: b.dataset.cx, p_note: n }); if (error) return alert(error.message); await load(); invoices(); });
}
function payDialog(i){
  const bal = Number(i.total) - paidOf(i), s = stu(i.student_id);
  dlg.innerHTML = `<form class="dlg" method="dialog"><h2>💵 Payment: ${esc(s.full_name)}</h2><p class="note" style="margin:0">${esc(i.number)} · ${esc(i.title)} · balance <b>${money(bal)}</b></p>
    <div class="two"><label class="f">Amount (${esc(F().currency)})<input type="number" id="pa" min="0.01" step="0.01" max="${bal.toFixed(2)}" value="${bal.toFixed(2)}" required></label><label class="f">Paid on<input type="date" id="pd" value="${today()}" max="${today()}"></label></div>
    <div class="two"><label class="f">Method<select id="pm">${Object.entries(METHOD).map(([k, v]) => `<option value="${k}">${v}</option>`).join("")}</select></label><label class="f">Reference (optional)<input type="text" id="pr" maxlength="80" placeholder="Card slip, transfer or cheque number"></label></div>
    <div class="checks"><label><input type="checkbox" id="pp" checked> Print a receipt</label></div>
    <div class="row" style="justify-content:flex-end"><button class="btn ghost" value="cancel" formnovalidate>Cancel</button><button class="btn" value="ok" id="pb">Record payment</button></div></form>`;
  dlg.showModal(); dlg.onchange = null; dlg.onclick = null;
  dlg.querySelector("form").onsubmit = async e => { if (!e.submitter || e.submitter.value !== "ok") return; e.preventDefault(); document.getElementById("pb").disabled = true;
    const amt = +document.getElementById("pa").value, { data, error } = await sb.rpc("fees_pay", { p_invoice: i.id, p_amount: amt, p_method: document.getElementById("pm").value, p_ref: document.getElementById("pr").value, p_on: document.getElementById("pd").value || null });
    if (error) { document.getElementById("pb").disabled = false; return alert(error.message); }
    const pr = document.getElementById("pp").checked; dlg.close(); await load(); toast(`Payment recorded. Receipt ${data}.`); invoices(); if (pr) printInv(i, data); };
}
// an invoice, or a receipt for one payment
function printInv(i, receipt){
  const s = stu(i.student_id), P = pays.filter(p => p.invoice_id === i.id), paid = P.reduce((a, p) => a + Number(p.amount), 0), r = receipt ? P.find(p => p.receipt_no === receipt) : null;
  const logo = (C.card || {}).logo, sub = (i.items || []).reduce((a, x) => a + Number(x.amount || 0), 0);
  const w = window.open("", "_blank"); if (!w) return alert("Please allow pop-ups to print.");
  w.document.write(`<!DOCTYPE html><html><head><meta charset="utf-8"><title>${esc(r ? r.receipt_no : i.number)}</title><style>body{font-family:Arial,sans-serif;font-size:13px;margin:32px;color:#222}h1{font-size:22px;margin:0;color:#462D5B}table{width:100%;border-collapse:collapse;margin-top:14px}td,th{padding:7px;border-bottom:1px solid #ddd;text-align:left}td.n,th.n{text-align:right}.top{display:flex;justify-content:space-between;align-items:flex-start;gap:20px}.tot td{font-weight:bold;border-bottom:0}.box{background:#F6F1FB;border-radius:8px;padding:10px 12px;margin-top:16px;white-space:pre-line}</style></head><body>
    <div class="top"><div>${logo ? `<img src="${esc(logo)}" style="max-height:64px;margin-bottom:6px"><br>` : ""}<b style="font-size:16px">${esc(school.name || "")}</b></div><div style="text-align:right"><h1>${r ? "Receipt" : "Invoice"}</h1><b>${esc(r ? r.receipt_no : i.number)}</b><br>${r ? "Paid on " + esc(fmtD(r.paid_on)) : "Issued " + esc(fmtD(i.created_at)) + (i.due_date ? "<br>Due " + esc(fmtD(i.due_date)) : "")}</div></div>
    <p style="margin-top:20px"><b>Student:</b> ${esc(s.full_name)} · ${esc(clsName(s.class_id))}<br><b>For:</b> ${esc(i.title)}${r ? "<br><b>Invoice:</b> " + esc(i.number) : ""}</p>
    ${r ? `<table><tr><th>Payment</th><th>Method</th><th class="n">Amount</th></tr><tr><td>${esc(i.title)}</td><td>${esc(METHOD[r.method] || r.method)}${r.reference ? " · " + esc(r.reference) : ""}</td><td class="n">${money(r.amount)}</td></tr>
      <tr class="tot"><td colspan="2">Balance still to pay on this invoice</td><td class="n">${money(Number(i.total) - paid)}</td></tr></table>`
    : `<table><tr><th>Item</th><th class="n">Amount</th></tr>${(i.items || []).map(x => `<tr><td>${esc(x.label)}</td><td class="n">${money(x.amount)}</td></tr>`).join("")}
      ${Number(i.discount) ? `<tr><td>Discount</td><td class="n">− ${money(i.discount)}</td></tr>` : ""}<tr class="tot"><td>Total</td><td class="n">${money(i.total)}</td></tr>
      ${paid ? `<tr><td>Paid so far</td><td class="n">${money(paid)}</td></tr><tr class="tot"><td>Balance</td><td class="n">${money(Number(i.total) - paid)}</td></tr>` : ""}</table>
      ${F().how ? `<div class="box"><b>How to pay</b><br>${esc(F().how)}</div>` : ""}`}
    ${i.note ? `<p style="margin-top:12px">${esc(i.note)}</p>` : ""}<script>setTimeout(()=>print(),300)<\/script></body></html>`);
  w.document.close();
}

// ---------- new invoices ----------
function newInv(){
  const pane = document.getElementById("pane"), items = F().items || [], grades = (C.grades || []).filter(g => classes.some(c => String(c.grade_id) === String(g.id)));
  const S = { who: "grades", grades: new Set(), classes: new Set(), one: null, pick: new Set(), lines: [], disc: {} };
  const amountFor = (it, gid) => Number((it.amounts || {})[gid] || 0);
  const targets = () => S.who === "one" ? studs.filter(s => String(s.id) === String(S.one)) : studs.filter(s => !s.archived && (S.who === "grades" ? S.grades.has(String(gradeOfS(s))) : S.classes.has(String(s.class_id))));
  const linesFor = s => [...items.filter(it => S.pick.has(it.id)).map(it => ({ label: it.label, amount: amountFor(it, gradeOfS(s)) })).filter(x => x.amount > 0), ...S.lines.filter(l => l.label && Number(l.amount) > 0).map(l => ({ label: l.label, amount: Number(l.amount) }))];
  const render = () => {
    const T = targets(), tot = T.reduce((a, s) => a + Math.max(0, linesFor(s).reduce((b, x) => b + x.amount, 0) - Number(S.disc[s.id] || 0)), 0);
    pane.innerHTML = `<div class="card"><h2>1. What for?</h2><label class="f" style="max-width:520px">Title families will see<input type="text" id="tt" value="${esc(S.title || "")}" placeholder="e.g. Term 2 tuition 2026–2027"></label>
        ${items.length ? `<p style="margin:12px 0 4px;font-weight:700">From your fees list (amounts by grade)</p><div class="checks">${items.map(it => `<label><input type="checkbox" data-it="${esc(it.id)}" ${S.pick.has(it.id) ? "checked" : ""}> ${esc(it.label)}</label>`).join("")}</div>` : `<p class="note">Tip: add your fees per grade in ⚙️ Fees and settings, so amounts fill in by themselves.</p>`}
        <p style="margin:12px 0 4px;font-weight:700">Other lines (same for everyone)</p>${S.lines.map((l, k) => `<div class="row" style="margin-bottom:6px"><input type="text" data-ll="${k}" value="${esc(l.label)}" placeholder="e.g. Uniform" style="max-width:300px"><input type="number" data-la="${k}" value="${esc(l.amount)}" min="0" step="0.01" placeholder="Amount" style="max-width:140px"><button class="mini" data-lr="${k}">✕</button></div>`).join("")}
        <button class="btn ghost small" id="al">+ Add a line</button>
        <div class="two" style="margin-top:12px;max-width:520px"><label class="f">Due date<input type="date" id="dd" value="${esc(S.due || "")}"></label></div></div>
      <div class="card"><h2>2. Who for?</h2><div class="chips">${[["grades", "Whole grades"], ["classes", "Classes"], ["one", "One student"]].map(([k, l]) => `<button class="chip" data-w="${k}" aria-pressed="${S.who === k}">${l}</button>`).join("")}</div>
        ${S.who === "grades" ? `<div class="checks">${grades.map(g => `<label><input type="checkbox" data-g="${esc(g.id)}" ${S.grades.has(String(g.id)) ? "checked" : ""}> ${esc(g.name)}</label>`).join("")}</div>`
        : S.who === "classes" ? `<div class="checks">${classes.map(c => `<label><input type="checkbox" data-c="${c.id}" ${S.classes.has(String(c.id)) ? "checked" : ""}> ${esc(c.name)}</label>`).join("")}</div>`
        : `<select id="os"><option value="">Choose a student…</option>${studs.filter(s => !s.archived).map(s => `<option value="${s.id}" ${String(S.one) === String(s.id) ? "selected" : ""}>${esc(s.full_name)} (${esc(clsName(s.class_id))})</option>`).join("")}</select>`}</div>
      <div class="card"><h2>3. Check and create</h2>${T.length ? `<div class="tablewrap" style="max-height:380px;overflow:auto"><table class="reg fs"><tr><th>Student</th><th>Class</th><th>Amount</th><th>Discount</th><th>Total</th></tr>
        ${T.map(s => { const sub = linesFor(s).reduce((a, x) => a + x.amount, 0); return `<tr><td>${esc(s.full_name)}</td><td>${esc(clsName(s.class_id))}</td><td class="money">${money(sub)}</td><td><input type="number" min="0" step="0.01" data-d="${s.id}" value="${esc(S.disc[s.id] || "")}" placeholder="0"></td><td class="money"><b>${money(Math.max(0, sub - Number(S.disc[s.id] || 0)))}</b></td></tr>`; }).join("")}</table></div>
        <div class="row" style="margin-top:12px;justify-content:space-between"><label class="checks"><input type="checkbox" id="em" checked> Email the families</label><span><b>${T.length}</b> invoice${T.length === 1 ? "" : "s"} · <b class="money">${money(tot)}</b> <button class="btn" id="go">Create invoices</button></span></div>` : '<p class="note">Choose who the invoices are for.</p>'}</div>`;
  };
  render();
  pane.oninput = e => { const t = e.target;
    if (t.id === "tt") S.title = t.value; if (t.id === "dd") S.due = t.value;
    if (t.dataset.ll != null) S.lines[+t.dataset.ll].label = t.value; if (t.dataset.la != null) { S.lines[+t.dataset.la].amount = t.value; }
    if (t.dataset.d) { S.disc[t.dataset.d] = t.value; } };
  pane.onchange = e => { const t = e.target;
    if (t.dataset.it) { t.checked ? S.pick.add(t.dataset.it) : S.pick.delete(t.dataset.it); if (!S.title && t.checked) S.title = (items.find(x => x.id === t.dataset.it) || {}).label; render(); }
    if (t.dataset.g) { t.checked ? S.grades.add(t.dataset.g) : S.grades.delete(t.dataset.g); render(); }
    if (t.dataset.c) { t.checked ? S.classes.add(t.dataset.c) : S.classes.delete(t.dataset.c); render(); }
    if (t.id === "os") { S.one = t.value; render(); }
    if (t.dataset.la != null || t.dataset.d) render(); };
  pane.onclick = async e => { const t = e.target.closest("button"); if (!t) return;
    if (t.dataset.w) { S.who = t.dataset.w; render(); }
    if (t.id === "al") { S.lines.push({ label: "", amount: "" }); render(); }
    if (t.dataset.lr != null) { S.lines.splice(+t.dataset.lr, 1); render(); }
    if (t.id === "go") {
      const T = targets(); if (!(S.title || "").trim()) return alert("Please add a title.");
      const groups = {}; T.forEach(s => { const L = linesFor(s), k = JSON.stringify(L); if (!L.length) return; (groups[k] = groups[k] || { L, ids: [] }).ids.push(String(s.id)); });
      if (!Object.keys(groups).length) return alert("There’s nothing to invoice. Choose fees or add a line with an amount.");
      if (!confirm(`Create ${T.length} invoice${T.length === 1 ? "" : "s"}?`)) return;
      t.disabled = true; let n = 0; const disc = Object.fromEntries(Object.entries(S.disc).filter(([, v]) => Number(v) > 0).map(([k, v]) => [String(k), Number(v)]));
      const before = new Set(inv.map(x => x.id));
      for (const g of Object.values(groups)) { const { data, error } = await sb.rpc("fees_create", { p_students: g.ids, p_title: S.title.trim(), p_items: g.L, p_due: S.due || null, p_discounts: disc }); if (error) { t.disabled = false; return alert(error.message); } n += data || 0; }
      await load();
      if (document.getElementById("em").checked) { const ids = inv.filter(x => !before.has(x.id)).map(x => x.id); if (ids.length) sb.functions.invoke("nestopia-mail", { body: { action: "fees", kind: "issued", ids } }).catch(() => {}); }
      toast(`${n} invoice${n === 1 ? "" : "s"} created.`); ui.tab = "invoices"; ui.st = "unpaid"; draw(); }
  };
}

// ---------- fees list and settings ----------
function settings(){
  const pane = document.getElementById("pane"), S = JSON.parse(JSON.stringify(F())), grades = C.grades || [];
  const render = () => {
    pane.innerHTML = `<div class="card"><h2>Your fees, by grade</h2><p class="note" style="margin-top:0">Add each fee once with its amount for every grade (for example tuition per term, transport, books). New invoices fill these amounts in by themselves.</p>
      <div class="tablewrap"><table class="reg fs"><tr><th>Fee</th>${grades.map(g => `<th>${esc(g.name)}</th>`).join("")}<th></th></tr>
      ${S.items.map((it, k) => `<tr><td><input type="text" data-l="${k}" value="${esc(it.label)}" placeholder="e.g. Tuition, Term 1" style="min-width:180px;border:1px solid var(--line);border-radius:8px;padding:6px 8px"></td>${grades.map(g => `<td><input type="number" min="0" step="0.01" data-a="${k}|${esc(g.id)}" value="${esc((it.amounts || {})[g.id] ?? "")}"></td>`).join("")}<td><button class="mini" data-r="${k}">✕</button></td></tr>`).join("")}</table></div>
      <button class="btn ghost small" id="ai" style="margin-top:8px">+ Add a fee</button></div>
      <div class="card"><h2>Settings</h2><div class="two" style="max-width:520px"><label class="f">Currency<input type="text" id="cu" value="${esc(S.currency)}" maxlength="6"></label></div>
        <label class="f" style="margin-top:10px">How to pay (shown to parents and on invoices)<textarea id="hw" rows="4" placeholder="e.g. Pay at the school office (cash or card), or by bank transfer to: Bank name, Account name, IBAN AE00 0000 0000 0000 0000 000. Please write the invoice number as the reference.">${esc(S.how || "")}</textarea></label>
        <div class="row" style="margin-top:12px"><button class="btn" id="sv">Save</button><span class="note" id="sm"></span></div></div>`;
  };
  render();
  pane.oninput = e => { const t = e.target; if (t.dataset.l != null) S.items[+t.dataset.l].label = t.value;
    if (t.dataset.a) { const [k, g] = t.dataset.a.split("|"), it = S.items[+k]; it.amounts = it.amounts || {}; if (t.value === "") delete it.amounts[g]; else it.amounts[g] = Number(t.value); }
    if (t.id === "cu") S.currency = t.value.trim() || "AED"; if (t.id === "hw") S.how = t.value; };
  pane.onclick = async e => { const t = e.target.closest("button"); if (!t) return;
    if (t.id === "ai") { S.items.push({ id: "f" + Date.now().toString(36), label: "", amounts: {} }); render(); }
    if (t.dataset.r != null) { S.items.splice(+t.dataset.r, 1); render(); }
    if (t.id === "sv") { if (!setupId) return alert("Finish the school setup in TwigNest first.");
      const { data: row, error: e1 } = await sb.from("school_setups").select("id,config").eq("id", setupId).single(); if (e1) return alert("This wasn’t saved: " + e1.message);
      const cfg = row.config || {}; cfg.fees = { currency: S.currency, how: (S.how || "").trim(), items: S.items.filter(x => (x.label || "").trim()).map(x => ({ id: x.id, label: x.label.trim(), amounts: x.amounts || {} })) };
      const { error } = await sb.from("school_setups").update({ config: cfg }).eq("id", setupId); if (error) return alert("This wasn’t saved: " + error.message);
      C = cfg; document.getElementById("sm").textContent = "Saved ✓"; toast("Fees saved."); } };
}
start();
