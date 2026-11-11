// GrowNest · School settings: phases used to group SEF evidence
const GRADES = ["Pre-K","KG1","KG2","Grade 1","Grade 2","Grade 3","Grade 4","Grade 5","Grade 6","Grade 7","Grade 8","Grade 9","Grade 10","Grade 11","Grade 12"];
let ctx = null, phases = [];

async function init(){
  ctx = await requireStaff(); if (!ctx) return;
  headerButtons([["app.html","Dashboard"],["sef.html","SEF evidence"]]);
  $("schoolName").textContent = ctx.school.name;
  renderLogo();
  if (ctx.staff.role === "school_admin") $("backupBox").classList.remove("hide");
  if (!["school_admin","leader"].includes(ctx.staff.role)) {
    $("editor").classList.add("hide");
    showMsg($("msg"), "Only school admins and leaders can change the phases. Ask your school admin if they need updating.", "info");
  }
  const {data, error} = await sb.from("school_phases").select("*").eq("school_id", ctx.school.id).order("sort");
  if (error) return showMsg($("msg"), friendly(error), "err");
  phases = (data || []).map(p => ({name: p.name, label: p.label || "", grades: p.grades || []}));
  render();
}
function render(){
  const used = g => phases.findIndex(p => p.grades.includes(g));
  $("phases").innerHTML = phases.length ? phases.map((p, i) => `
    <div class="ph-card">
      <div class="ph-head">
        <label class="f" style="margin:0;flex:1;min-width:140px">Phase name<input data-i="${i}" data-f="name" value="${esc(p.name)}"></label>
        <label class="f" style="margin:0;flex:2;min-width:180px">Description (optional)<input data-i="${i}" data-f="label" value="${esc(p.label)}" placeholder="e.g. Kindergarten"></label>
        <button class="btn ghost small" data-del="${i}" style="color:var(--danger);align-self:flex-end">Remove</button>
      </div>
      <p class="muted" style="margin:10px 0 6px;font-size:.88rem">Grades in this phase</p>
      <div class="also">${GRADES.map(g => { const u = used(g); const on = u === i;
        return `<button type="button" class="alsob" data-i="${i}" data-g="${esc(g)}" aria-pressed="${on}" ${u >= 0 && !on ? 'disabled style="opacity:.35"' : ""}>${esc(g)}</button>`; }).join("")}</div>
    </div>`).join("")
    : `<p class="muted">No phases yet. Add your phases below, or start from the suggested set and adjust it to match your school’s SEF.</p>`;
}
document.addEventListener("click", e => {
  const b = e.target.closest("button"); if (!b) return;
  if (b.dataset.g) { const p = phases[+b.dataset.i]; const g = b.dataset.g;
    p.grades = p.grades.includes(g) ? p.grades.filter(x => x !== g) : [...p.grades, g].sort((a, c) => GRADES.indexOf(a) - GRADES.indexOf(c)); render(); }
  if (b.dataset.del) { phases.splice(+b.dataset.del, 1); render(); }
});
document.addEventListener("input", e => { const i = e.target.dataset.i, f = e.target.dataset.f; if (i != null && f) phases[+i][f] = e.target.value; });
$("addPhase").onclick = () => { phases.push({name: "Phase " + (phases.length + 1), label: "", grades: []}); render(); };
$("suggest").onclick = () => {
  if (phases.length && !confirm("Replace the current phases with the suggested set?")) return;
  phases = [
    {name: "Phase 1", label: "Kindergarten", grades: ["Pre-K","KG1","KG2"]},
    {name: "Phase 2", label: "Primary", grades: ["Grade 1","Grade 2","Grade 3","Grade 4","Grade 5"]},
    {name: "Phase 3", label: "Middle", grades: ["Grade 6","Grade 7","Grade 8","Grade 9"]},
    {name: "Phase 4", label: "Secondary", grades: ["Grade 10","Grade 11","Grade 12"]}];
  render(); showMsg($("msg"), "Suggested phases added. Adjust them to match your school’s SEF, then tap Save phases.", "info");
};
$("savePhases").onclick = async () => {
  if (phases.some(p => !p.name.trim())) return showMsg($("msg"), "Please give every phase a name.", "err");
  $("savePhases").disabled = true;
  const del = await sb.from("school_phases").delete().eq("school_id", ctx.school.id);
  if (del.error) { $("savePhases").disabled = false; return showMsg($("msg"), friendly(del.error), "err"); }
  if (phases.length) {
    const {error} = await sb.from("school_phases").insert(phases.map((p, i) => ({school_id: ctx.school.id, name: p.name.trim(), label: p.label.trim() || null, grades: p.grades, sort: i + 1})));
    if (error) { $("savePhases").disabled = false; return showMsg($("msg"), friendly(error), "err"); }
  }
  $("savePhases").disabled = false;
  showMsg($("msg"), "Phases saved. SEF evidence will now be grouped by these phases.", "ok");
};
function renderLogo(){
  const p = ctx.school.logo_path, admin = ctx.staff.role === "school_admin";
  $("logoBox").innerHTML = (p ? `<img src="${logoUrl(p)}" alt="School logo" style="max-height:90px;max-width:260px;display:block;margin:6px 0 12px;background:#fff;border:1px solid var(--line);border-radius:10px;padding:8px">` : '<p class="muted">No logo yet. GrowNest’s logo is used on forms until you add one.</p>')
    + (admin ? `<label class="btn ghost small" style="cursor:pointer">${p ? "Change logo" : "Upload logo"}<input type="file" id="logoFile" accept="image/png,image/jpeg" class="hide"></label>${p ? ' <button class="btn ghost small" id="logoDel" style="color:var(--danger)">Remove logo</button>' : ""}<p class="muted" style="font-size:.85rem;margin-top:8px">PNG or JPG. It appears on Word forms and on emails to teachers.</p>` : '<p class="muted" style="font-size:.85rem">Only school admins can change the logo.</p>');
  const f = $("logoFile"); if (f) f.onchange = () => uploadLogo(f.files[0]);
  const d = $("logoDel"); if (d) d.onclick = removeLogo;
}
async function uploadLogo(file){
  if (!file) return;
  try {
    const img = await createImageBitmap(file), k = Math.min(1, 600 / Math.max(img.width, img.height));
    const cv = document.createElement("canvas"); cv.width = Math.round(img.width * k); cv.height = Math.round(img.height * k);
    cv.getContext("2d").drawImage(img, 0, 0, cv.width, cv.height);
    const blob = await new Promise(r => cv.toBlob(r, "image/png"));
    const path = ctx.school.id + "/logo-" + Date.now() + ".png", old = ctx.school.logo_path;
    const up = await sb.storage.from("school-logos").upload(path, blob, {contentType: "image/png", upsert: true}); if (up.error) throw up.error;
    const {error} = await sb.from("schools").update({logo_path: path}).eq("id", ctx.school.id); if (error) throw error;
    if (old) sb.storage.from("school-logos").remove([old]).catch(() => {});
    ctx.school.logo_path = path; renderLogo(); showMsg($("msg"), "Logo saved. It will appear on Word forms and teacher emails.", "ok");
  } catch (e) { showMsg($("msg"), friendly(e), "err"); }
}
async function removeLogo(){
  if (!confirm("Remove your school logo?")) return;
  const old = ctx.school.logo_path;
  const {error} = await sb.from("schools").update({logo_path: null}).eq("id", ctx.school.id); if (error) return showMsg($("msg"), friendly(error), "err");
  if (old) sb.storage.from("school-logos").remove([old]).catch(() => {});
  ctx.school.logo_path = null; renderLogo(); showMsg($("msg"), "Logo removed.", "ok");
}
init();

// ---------- Full backup (school admins) ----------
async function fetchAll(table, cols, filter){
  const out = []; let from = 0;
  for (;;) {
    let q = sb.from(table).select(cols).range(from, from + 999); if (filter) q = filter(q);
    const {data, error} = await q; if (error) throw error;
    out.push(...(data || [])); if (!data || data.length < 1000) break; from += 1000;
  }
  return out;
}
function flat(r){ const o = {}; Object.entries(r).forEach(([k, v]) => { if (k === "response_token") return; o[k] = Array.isArray(v) ? v.join(", ") : (v && typeof v === "object" ? JSON.stringify(v) : v); }); return o; }
function bstatus(t){ $("bkStatus").textContent = t; }
async function backupData(){
  if (!window.XLSX) return showMsg($("msg"), t("The Excel maker didn’t load. Check your connection and refresh.", "لم يتم تحميل أداة Excel. تحقّق من الاتصال وحدّث الصفحة."), "err");
  const btn = $("bkData"); btn.disabled = true;
  try {
    const sid = ctx.school.id, bySchool = q => q.eq("school_id", sid);
    bstatus(t("Gathering teachers and staff…", "جارٍ جمع المعلمين والموظفين…"));
    const [teachers, staff, phases, walks, obs, sef, inds] = await Promise.all([
      fetchAll("teachers", "*", bySchool), fetchAll("staff", "id,full_name,job_title,email,role,active,created_at", bySchool), fetchAll("school_phases", "*", bySchool),
      fetchAll("walks", "*", bySchool), fetchAll("observations", "*", bySchool), fetchAll("sef_entries", "*", bySchool), fetchAll("indicators", "code,title,moe_ref")]);
    const T = Object.fromEntries(teachers.map(x => [x.id, x.full_name])), S = Object.fromEntries(staff.map(x => [x.id, x.full_name])), I = Object.fromEntries(inds.map(x => [x.code, x.title]));
    const O = Object.fromEntries(obs.map(o => [o.id, o])), ids = obs.map(o => o.id), judg = [], ticks = [], ev = [];
    for (let i = 0; i < ids.length; i += 100) {
      bstatus(t(`Gathering observation details… ${Math.min(i + 100, ids.length)} of ${ids.length}`, `جارٍ جمع تفاصيل الملاحظات… ${Math.min(i + 100, ids.length)} من ${ids.length}`));
      const chunk = ids.slice(i, i + 100);
      const [j, s, e] = await Promise.all([fetchAll("observation_judgements", "*", q => q.in("observation_id", chunk)),
        fetchAll("observation_statements", "observation_id, statements(indicator_code,level,kind,text)", q => q.in("observation_id", chunk)),
        fetchAll("evidence", "*", q => q.in("observation_id", chunk))]);
      judg.push(...j); ticks.push(...s); ev.push(...e);
    }
    const who = id => ({teacher: T[O[id]?.teacher_id] || "", date: O[id]?.observed_on || "", type: O[id]?.type || ""});
    const sheets = [
      ["Teachers", teachers.map(flat)],
      ["Staff", staff.map(flat)],
      ["Observations", obs.map(o => ({teacher: T[o.teacher_id] || "", observer: S[o.observer_id] || "", ...flat(o)}))],
      ["Judgements", judg.map(r => ({...who(r.observation_id), indicator_title: I[r.indicator_code] || "", ...flat(r)}))],
      ["Ticked statements", ticks.filter(r => r.statements).map(r => ({...who(r.observation_id), observation_id: r.observation_id, indicator: r.statements.indicator_code, level: r.statements.level, kind: r.statements.kind, statement: r.statements.text}))],
      ["Learning walks", walks.map(w => ({observer: S[w.observer_id] || "", ...flat(w)}))],
      ["Photos", ev.map(r => ({...who(r.observation_id), ...flat(r)}))],
      ["SEF write-up", sef.map(flat)],
      ["Phases", phases.map(flat)]];
    const wb = XLSX.utils.book_new();
    sheets.forEach(([name, rows]) => { const ws = rows.length ? XLSX.utils.json_to_sheet(rows) : XLSX.utils.aoa_to_sheet([["No records"]]); XLSX.utils.book_append_sheet(wb, ws, name); });
    const info = XLSX.utils.aoa_to_sheet([["GrowNest backup"], ["School", ctx.school.name], ["Downloaded", new Date().toLocaleString("en-GB")], ["By", ctx.staff.full_name],
      ["Teachers", teachers.length], ["Observations, walk visits and appraisals", obs.length], ["Photos (files are in the separate photos zip)", ev.length]]);
    XLSX.utils.book_append_sheet(wb, info, "About this backup"); wb.SheetNames.unshift(wb.SheetNames.pop());
    XLSX.writeFile(wb, `GrowNest backup - ${ctx.school.name} - ${new Date().toISOString().slice(0, 10)}.xlsx`.replace(/[\\/:*?"<>|]/g, ""));
    bstatus(""); showMsg($("msg"), t(`Backup downloaded: ${teachers.length} teachers and ${obs.length} observations, walk visits and appraisals.`, `تم تنزيل النسخة الاحتياطية: ${teachers.length} معلمًا و${obs.length} من الملاحظات والزيارات وتقييمات الأداء.`), "ok");
  } catch (e) { bstatus(""); showMsg($("msg"), friendly(e), "err"); }
  btn.disabled = false;
}
async function backupPhotos(){
  if (!window.JSZip) return showMsg($("msg"), t("The zip maker didn’t load. Check your connection and refresh.", "لم يتم تحميل أداة الضغط. تحقّق من الاتصال وحدّث الصفحة."), "err");
  const btn = $("bkPhotos"); btn.disabled = true;
  try {
    const sid = ctx.school.id;
    const [ev, obs, teachers] = await Promise.all([fetchAll("evidence", "*", q => q.eq("school_id", sid)), fetchAll("observations", "id,teacher_id,observed_on", q => q.eq("school_id", sid)), fetchAll("teachers", "id,full_name", q => q.eq("school_id", sid))]);
    if (!ev.length) { btn.disabled = false; return showMsg($("msg"), t("There are no photos to download yet.", "لا توجد صور للتنزيل بعد."), "info"); }
    const O = Object.fromEntries(obs.map(o => [o.id, o])), T = Object.fromEntries(teachers.map(x => [x.id, x.full_name])), z = new JSZip(), clean = s => String(s || "").replace(/[\\/:*?"<>|]/g, "").trim();
    let n = 0, failed = 0;
    for (const e of ev) {
      bstatus(t(`Downloading photos… ${n + failed + 1} of ${ev.length}`, `جارٍ تنزيل الصور… ${n + failed + 1} من ${ev.length}`));
      const {data, error} = await sb.storage.from("evidence").download(e.storage_path);
      if (error || !data) { failed++; continue; }
      const o = O[e.observation_id] || {}, ext = (e.storage_path.split(".").pop() || "jpg").slice(0, 4);
      z.file(`${clean(T[o.teacher_id]) || "Teacher"}/${o.observed_on || "date"} ${clean(e.indicator_code)} ${clean(e.caption).slice(0, 40)} ${e.id.slice(0, 6)}.${ext}`.replace(/ +/g, " "), data); n++;
    }
    if (ctx.school.logo_path) { try { const r = await fetch(logoUrl(ctx.school.logo_path)); if (r.ok) z.file("School logo.png", await r.blob()); } catch (_) {} }
    bstatus(t("Making the zip file…", "جارٍ إنشاء الملف المضغوط…"));
    const blob = await z.generateAsync({type: "blob"}), a = document.createElement("a");
    a.href = URL.createObjectURL(blob); a.download = `GrowNest photos - ${clean(ctx.school.name)} - ${new Date().toISOString().slice(0, 10)}.zip`; document.body.appendChild(a); a.click(); a.remove();
    bstatus(""); showMsg($("msg"), t(`${n} photos downloaded${failed ? `, ${failed} couldn’t be downloaded` : ""}.`, `تم تنزيل ${n} صورة${failed ? `، وتعذّر تنزيل ${failed}` : ""}.`), failed ? "info" : "ok");
  } catch (e) { bstatus(""); showMsg($("msg"), friendly(e), "err"); }
  btn.disabled = false;
}
if ($("bkData")) { $("bkData").onclick = backupData; $("bkPhotos").onclick = backupPhotos; }
