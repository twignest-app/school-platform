// GrowNest · Staff management (school admins)
const ROLES = {school_admin: "School admin", leader: "Leader", observer: "Observer"};
const aRole = r => ({school_admin: "a school admin", leader: "a leader", observer: "an observer"})[r];
const ROLE_HELP = {school_admin: "Everything, including all appraisals, staff and settings", leader: "All observations and learning walks, SEF evidence, school settings", observer: "Only their own observations, walks and appraisals"};
let ctx = null, staff = [];

async function init(){
  ctx = await requireStaff(); if (!ctx) return;
  headerButtons([["app.html","Dashboard"],["settings.html","School settings"]]);
  if (ctx.staff.role !== "school_admin") { $("main").innerHTML = '<div class="card narrow"><h2>School admins only</h2><p>Ask your school admin if you need to change who has access to GrowNest.</p></div>'; return; }
  $("schoolName").textContent = ctx.school.name;
  $("code").textContent = ctx.school.join_code;
  $("roleHelp").innerHTML = Object.entries(ROLES).map(([k, v]) => `<li><b>${v}:</b> ${ROLE_HELP[k]}</li>`).join("");
  await load();
}
async function load(){
  const {data, error} = await sb.from("staff").select("id,full_name,job_title,email,role,active,created_at").eq("school_id", ctx.school.id).order("full_name");
  if (error) return showMsg($("msg"), friendly(error), "err");
  staff = data; render();
}
const admins = () => staff.filter(s => s.active && s.role === "school_admin");
function render(){
  const act = staff.filter(s => s.active), off = staff.filter(s => !s.active);
  const row = s => `<tr><td><b>${esc(s.full_name)}</b>${s.id === ctx.user.id ? ' <span class="lchip">You</span>' : ""}<br><span class="muted" style="font-size:.88rem">${esc([s.job_title, s.email].filter(Boolean).join(" · "))}</span></td>
    <td>${s.active ? `<select data-role="${s.id}">${Object.entries(ROLES).map(([k, v]) => `<option value="${k}" ${s.role === k ? "selected" : ""}>${v}</option>`).join("")}</select>` : `<span class="muted">${ROLES[s.role]}</span>`}</td>
    <td style="text-align:right">${s.active ? (s.id === ctx.user.id ? "" : `<button class="btn ghost small" data-off="${s.id}" style="color:var(--danger)">Remove access</button>`) : `<button class="btn sage small" data-on="${s.id}">Give access</button>`}</td></tr>`;
  $("active").innerHTML = act.length ? `<table class="t">${act.map(row).join("")}</table>` : '<p class="muted">No active staff.</p>';
  $("inactive").innerHTML = off.length ? `<table class="t">${off.map(row).join("")}</table>` : '<p class="muted">No one is waiting or removed.</p>';
}
document.addEventListener("change", async e => {
  const id = e.target.dataset.role; if (!id) return;
  const s = staff.find(x => x.id === id), role = e.target.value;
  if (s.role === "school_admin" && role !== "school_admin" && admins().length <= 1) { e.target.value = "school_admin"; return showMsg($("msg"), "Your school needs at least one school admin. Make someone else a school admin first.", "err"); }
  if (id === ctx.user.id && role !== "school_admin" && !confirm("You will lose access to this page and to all appraisals. Continue?")) { e.target.value = s.role; return; }
  const {error} = await sb.from("staff").update({role}).eq("id", id);
  if (error) { e.target.value = s.role; return showMsg($("msg"), friendly(error), "err"); }
  s.role = role; showMsg($("msg"), `${s.full_name} is now ${aRole(role)}.`, "ok");
  if (id === ctx.user.id && role !== "school_admin") setTimeout(() => location.href = "app.html", 1200);
});
document.addEventListener("click", async e => {
  const b = e.target.closest("button"); if (!b) return;
  if (b.dataset.off) { const s = staff.find(x => x.id === b.dataset.off);
    if (s.role === "school_admin" && admins().length <= 1) return showMsg($("msg"), "Your school needs at least one school admin.", "err");
    if (!confirm(`Remove ${s.full_name}’s access to GrowNest? Their past observations stay in teachers’ records.`)) return;
    const {error} = await sb.from("staff").update({active: false}).eq("id", s.id); if (error) return showMsg($("msg"), friendly(error), "err");
    showMsg($("msg"), `${s.full_name} can no longer sign in to your school’s GrowNest.`, "ok"); load(); }
  if (b.dataset.on) { const s = staff.find(x => x.id === b.dataset.on);
    const {error} = await sb.from("staff").update({active: true}).eq("id", s.id); if (error) return showMsg($("msg"), friendly(error), "err");
    showMsg($("msg"), `${s.full_name} now has access as ${aRole(s.role)}.`, "ok"); load(); }
  if (b.id === "newCode") {
    if (!confirm("Create a new school code? The old code will stop working, so anyone who hasn’t joined yet will need the new one.")) return;
    const chars = "ABCDEFGHJKLMNPQRSTUVWXYZ23456789", a = new Uint32Array(8); crypto.getRandomValues(a);
    const code = [...a].map(n => chars[n % chars.length]).join("");
    const {error} = await sb.from("schools").update({join_code: code}).eq("id", ctx.school.id); if (error) return showMsg($("msg"), friendly(error), "err");
    $("code").textContent = code; showMsg($("msg"), "New school code created.", "ok"); }
  if (b.id === "copyCode") { try { await navigator.clipboard.writeText($("code").textContent); b.textContent = "Copied ✓"; setTimeout(() => b.textContent = "Copy", 1200); } catch (_) {} }
});
init();
