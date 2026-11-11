// GrowNest · Observation criteria (GrowNest owner only)
let inds = [], stmts = [], also = [], cur = null, curLevel = 4, tab = "lesson";
const KIND = {strength: "What went well", development: "Next steps"};

async function init(){
  const ctx = await requireStaff(); if (!ctx) return;
  headerButtons([["app.html","Dashboard"]]);
  const {data: owner} = await sb.rpc("is_platform_admin");
  if (!owner) { $("main").innerHTML = '<div class="card narrow"><h2>Owner only</h2><p>This page is only available to the GrowNest owner.</p></div>'; return; }
  await loadAll(); render();
}
async function loadAll(){
  const [i, s, a] = await Promise.all([sb.from("indicators").select("*").order("sort"), sb.from("statements").select("*").order("sort"), sb.from("also_seen_options").select("*").order("sort")]);
  if (i.error || s.error) return showMsg($("msg"), friendly(i.error || s.error), "err");
  inds = i.data || []; stmts = s.data || []; also = a.data || [];
  if (!cur) cur = (inds.find(x => x.used_in.includes("formal_observation")) || inds[0] || {}).code;
}
function render(){
  document.querySelectorAll(".ctabs button").forEach(b => b.setAttribute("aria-selected", b.dataset.tab === tab));
  if (tab === "also") return renderAlso();
  const list = inds.filter(x => tab === "lesson" ? x.used_in.includes("formal_observation") : x.used_in.includes("appraisal"));
  if (!list.some(x => x.code === cur)) cur = list[0] && list[0].code;
  $("side").innerHTML = list.map(x => `<button type="button" data-cur="${x.code}" aria-selected="${x.code === cur}"><b>${esc(x.code)}</b> ${esc(x.title)}</button>`).join("");
  const ind = inds.find(x => x.code === cur); if (!ind) { $("panel").innerHTML = ""; return; }
  const lesson = ind.used_in.includes("formal_observation");
  let html = `<div class="card"><h2>${esc(ind.code)} · edit wording</h2>
    <label class="f">Title<input id="iTitle" value="${esc(ind.title)}"></label>
    <label class="f">MOE reference<input id="iMoe" value="${esc(ind.moe_ref || "")}" placeholder="e.g. 3.1.3"></label>
    <label class="f">Look-fors (shown under the title on the form)<textarea id="iLook" rows="3">${esc(ind.look_fors || "")}</textarea></label>
    <label class="f">Title (Arabic)<input id="iTitleAr" dir="rtl" value="${esc(ind.title_ar || "")}"></label>
    <label class="f">Look-fors (Arabic)<textarea id="iLookAr" dir="rtl" rows="3">${esc(ind.look_fors_ar || "")}</textarea></label>
    <button class="btn primary small" id="saveInd">Save wording</button> <span class="muted" id="indSt" style="font-size:.85rem"></span></div>`;
  if (lesson) {
    html += `<div class="card" style="margin-top:16px"><h2>Feedback statements</h2>
      <p class="muted" style="margin-top:-6px">Choose a level to see and edit its statements. Edited or removed statements are retired, so past observations keep the wording they were given.</p>
      <div class="lvls">${LEVELS.map(l => `<button type="button" data-lv="${l.n}" aria-pressed="${l.n === curLevel}" style="background:${l.bg};color:${l.fg}"><b>${l.n}</b><span>${l.name}</span></button>`).join("")}</div>
      <div class="kinds">${["strength","development"].map(k => kindBlock(ind, k)).join("")}</div></div>
      <div class="card" style="margin-top:16px"><h2>Preview</h2><p class="muted" style="margin-top:-6px">How this indicator looks to an observer at level ${curLevel} · ${lvl(curLevel).name}.</p>${preview(ind)}</div>`;
  }
  $("panel").innerHTML = html;
}
function kindBlock(ind, kind){
  const rows = stmts.filter(s => s.indicator_code === ind.code && s.level === curLevel && s.kind === kind && s.active !== false).sort((a, b) => a.sort - b.sort);
  return `<div><h3>${KIND[kind]}</h3>${rows.map((s, i) => `<div class="srow"><div style="flex:1;display:flex;flex-direction:column;gap:4px"><textarea data-sid="${s.id}" rows="3">${esc(s.text)}</textarea><textarea data-sidar="${s.id}" dir="rtl" rows="3" placeholder="Arabic wording">${esc(s.text_ar || "")}</textarea></div>
    <div class="sbtns"><button type="button" title="Move up" data-up="${s.id}" ${i === 0 ? "disabled" : ""}>↑</button><button type="button" title="Move down" data-down="${s.id}" ${i === rows.length - 1 ? "disabled" : ""}>↓</button><button type="button" title="Save" data-savest="${s.id}">Save</button><button type="button" title="Remove" data-rm="${s.id}" class="rm">Remove</button></div></div>`).join("") || '<p class="muted">No statements at this level yet.</p>'}
    <div class="srow"><div style="flex:1;display:flex;flex-direction:column;gap:4px"><textarea data-new="${kind}" rows="2" placeholder="Add a new statement…"></textarea><textarea data-newar="${kind}" dir="rtl" rows="2" placeholder="Arabic wording (optional)"></textarea></div><div class="sbtns"><button type="button" data-add="${kind}">Add</button></div></div></div>`;
}
function preview(ind){
  const L = lvl(curLevel), ss = k => stmts.filter(s => s.indicator_code === ind.code && s.level === curLevel && s.kind === k && s.active !== false).sort((a, b) => a.sort - b.sort);
  return `<div class="pv"><h3 style="margin:0 0 4px">${esc(ind.title)} <span class="lchip">MOE ${esc(ind.moe_ref || "")}</span></h3><p class="muted" style="margin:0 0 10px;font-size:.88rem">${esc(ind.look_fors || "")}</p>
    <div class="lvls small">${LEVELS.map(l => `<span style="background:${l.bg};color:${l.fg};opacity:${l.n === curLevel ? 1 : .5};${l.n === curLevel ? "outline:2px solid #151A2E" : ""}"><b>${l.n}</b></span>`).join("")}</div>
    <div class="kinds">${["strength","development"].map(k => `<div><h4>${KIND[k]}</h4>${ss(k).map(s => `<div class="ckp"><i></i>${esc(s.text)}</div>`).join("") || '<p class="muted">–</p>'}</div>`).join("")}</div></div>`;
}
function renderAlso(){
  $("side").innerHTML = '<p class="muted" style="padding:6px">Optional tick boxes on observations and walk visits. Each one feeds the SEF elements you link it to.</p>';
  const rows = [...also].sort((a, b) => a.sort - b.sort);
  $("panel").innerHTML = `<div class="card"><h2>“Also seen in this lesson” options</h2>
    <table class="t"><tr><th>Option</th><th>Arabic</th><th>SEF elements</th><th>Shown</th><th></th></tr>${rows.map((o, i) => `<tr>
      <td><input data-al="${o.code}" data-f="label" value="${esc(o.label)}"></td>
      <td><input data-al="${o.code}" data-f="label_ar" dir="rtl" value="${esc(o.label_ar || "")}" placeholder="Arabic"></td>
      <td><input data-al="${o.code}" data-f="els" value="${esc((o.els || []).join(", "))}" placeholder="e.g. 2.2.2, 4.2.3" style="width:150px"></td>
      <td><input type="checkbox" data-al="${o.code}" data-f="active" ${o.active ? "checked" : ""}></td>
      <td style="white-space:nowrap"><button type="button" class="btn ghost small" data-aup="${o.code}" ${i === 0 ? "disabled" : ""}>↑</button> <button type="button" class="btn ghost small" data-adown="${o.code}" ${i === rows.length - 1 ? "disabled" : ""}>↓</button> <button type="button" class="btn primary small" data-asave="${o.code}">Save</button></td></tr>`).join("")}</table>
    <h3 style="margin-top:20px">Add an option</h3>
    <div style="display:flex;gap:10px;flex-wrap:wrap"><input id="newAl" placeholder="e.g. Use of the outdoor learning environment" style="flex:2;min-width:220px"><input id="newEls" placeholder="SEF elements, e.g. 4.2.2" style="flex:1;min-width:150px"><button class="btn primary small" id="addAl">Add option</button></div>
    <p class="muted" style="font-size:.85rem;margin-top:10px">Untick “Shown” to hide an option from new observations. Past observations keep their ticks.</p></div>`;
}
const elsOf = v => String(v || "").split(/[,;\s]+/).map(x => x.trim()).filter(x => /^\d\.\d(\.\d)?$/.test(x));
async function done(p, okMsg){ const {error} = await p; if (error) { showMsg($("msg"), friendly(error), "err"); return false; } if (okMsg) showMsg($("msg"), okMsg, "ok"); return true; }

document.addEventListener("click", async e => {
  const b = e.target.closest("button"); if (!b) return;
  if (b.dataset.tab) { tab = b.dataset.tab; render(); return; }
  if (b.dataset.cur) { cur = b.dataset.cur; render(); return; }
  if (b.dataset.lv) { curLevel = +b.dataset.lv; render(); return; }
  if (b.id === "saveInd") {
    const ok = await done(sb.from("indicators").update({title: $("iTitle").value.trim(), moe_ref: $("iMoe").value.trim() || null, look_fors: $("iLook").value.trim(), title_ar: $("iTitleAr").value.trim() || null, look_fors_ar: $("iLookAr").value.trim() || null}).eq("code", cur));
    if (ok) { await loadAll(); render(); showMsg($("msg"), "Wording saved. It now shows for every school.", "ok"); } return; }
  const ind = inds.find(x => x.code === cur);
  if (b.dataset.savest) { // retire the old wording and add the new one in its place
    const old = stmts.find(s => s.id === b.dataset.savest), text = document.querySelector(`textarea[data-sid="${old.id}"]`).value.trim(), textAr = document.querySelector(`textarea[data-sidar="${old.id}"]`).value.trim() || null;
    if (!text) return showMsg($("msg"), "A statement can’t be empty. Use Remove instead.", "err");
    if (text === old.text && textAr === (old.text_ar || null)) return;
    if (text === old.text) { if (await done(sb.from("statements").update({text_ar: textAr}).eq("id", old.id), "Arabic wording saved.")) { try { sessionStorage.removeItem("gn_ar_db"); } catch (_) {} await loadAll(); render(); } return; }
    if (await done(sb.from("statements").insert({indicator_code: old.indicator_code, level: old.level, kind: old.kind, text, text_ar: textAr, sort: old.sort}))
      && await done(sb.from("statements").update({active: false}).eq("id", old.id), "Statement updated.")) { await loadAll(); render(); } return; }
  if (b.dataset.rm) { if (!confirm("Remove this statement from the form? Past observations keep it.")) return;
    if (await done(sb.from("statements").update({active: false}).eq("id", b.dataset.rm), "Statement removed.")) { await loadAll(); render(); } return; }
  if (b.dataset.add) { const kind = b.dataset.add, ta = document.querySelector(`textarea[data-new="${kind}"]`), text = ta.value.trim(), textAr = (document.querySelector(`textarea[data-newar="${kind}"]`).value || "").trim() || null; if (!text) return;
    const n = stmts.filter(s => s.indicator_code === ind.code && s.level === curLevel && s.kind === kind && s.active !== false).length;
    if (await done(sb.from("statements").insert({indicator_code: ind.code, level: curLevel, kind, text, text_ar: textAr, sort: n + 1}), "Statement added.")) { await loadAll(); render(); } return; }
  if (b.dataset.up || b.dataset.down) { const id = b.dataset.up || b.dataset.down, s0 = stmts.find(s => s.id === id);
    const rows = stmts.filter(s => s.indicator_code === s0.indicator_code && s.level === s0.level && s.kind === s0.kind && s.active !== false).sort((a, c) => a.sort - c.sort);
    const i = rows.findIndex(s => s.id === id), j = b.dataset.up ? i - 1 : i + 1; if (j < 0 || j >= rows.length) return;
    [rows[i], rows[j]] = [rows[j], rows[i]];
    for (let k = 0; k < rows.length; k++) await sb.from("statements").update({sort: k + 1}).eq("id", rows[k].id);
    await loadAll(); render(); return; }
  if (b.dataset.asave) { const c = b.dataset.asave, g = f => document.querySelector(`[data-al="${c}"][data-f="${f}"]`);
    const label = g("label").value.trim(); if (!label) return showMsg($("msg"), "Please enter the option text.", "err");
    if (await done(sb.from("also_seen_options").update({label, label_ar: g("label_ar").value.trim() || null, els: elsOf(g("els").value), active: g("active").checked}).eq("code", c), "Option saved.")) await loadAll(); return; }
  if (b.dataset.aup || b.dataset.adown) { const c = b.dataset.aup || b.dataset.adown, rows = [...also].sort((a, d) => a.sort - d.sort), i = rows.findIndex(o => o.code === c), j = b.dataset.aup ? i - 1 : i + 1;
    if (j < 0 || j >= rows.length) return; [rows[i], rows[j]] = [rows[j], rows[i]];
    for (let k = 0; k < rows.length; k++) await sb.from("also_seen_options").update({sort: k + 1}).eq("code", rows[k].code);
    await loadAll(); render(); return; }
  if (b.id === "addAl") { const label = $("newAl").value.trim(); if (!label) return;
    const code = label.toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/^-|-$/g, "").slice(0, 30) + "-" + Date.now().toString(36).slice(-4);
    if (await done(sb.from("also_seen_options").insert({code, label, els: elsOf($("newEls").value), sort: also.length + 1}), "Option added.")) { await loadAll(); render(); } return; }
  if (b.id === "dlXlsx") return downloadXlsx();
  if (b.id === "dlDocx") return downloadDocx();
});

function downloadXlsx(){
  if (!window.XLSX) return showMsg($("msg"), "The Excel maker didn’t load. Refresh and try again.", "err");
  const wb = XLSX.utils.book_new();
  const i = [["Code","Title","MOE reference","Look-fors","Used in"], ...inds.map(x => [x.code, x.title, x.moe_ref || "", x.look_fors || "", x.used_in.join(", ")])];
  const s = [["Indicator","Level","Level name","Type","Order","Statement"], ...stmts.filter(x => x.active !== false).sort((a, b) => a.indicator_code.localeCompare(b.indicator_code, undefined, {numeric: true}) || b.level - a.level || a.kind.localeCompare(b.kind) || a.sort - b.sort).map(x => [x.indicator_code, x.level, lvl(x.level).name, KIND[x.kind], x.sort, x.text])];
  const a = [["Option","SEF elements","Shown"], ...also.map(o => [o.label, (o.els || []).join(", "), o.active ? "Yes" : "No"])];
  [[i, "Indicators"], [s, "Feedback statements"], [a, "Also seen options"]].forEach(([rows, name]) => { const ws = XLSX.utils.aoa_to_sheet(rows); ws["!cols"] = rows[0].map((_, k) => ({wch: Math.min(80, Math.max(10, ...rows.map(r => String(r[k] ?? "").length + 2)))})); XLSX.utils.book_append_sheet(wb, ws, name); });
  XLSX.writeFile(wb, "GrowNest observation criteria.xlsx");
}
async function downloadDocx(){
  if (!window.JSZip) return showMsg($("msg"), "The Word maker didn’t load. Refresh and try again.", "err");
  const x = t => String(t ?? "").replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;");
  const p = (t, o = {}) => `<w:p><w:pPr><w:spacing w:before="${o.bf || 0}" w:after="${o.af ?? 60}"/>${o.ind ? '<w:ind w:left="300" w:hanging="200"/>' : ""}</w:pPr><w:r><w:rPr>${o.b ? "<w:b/>" : ""}${o.i ? "<w:i/>" : ""}<w:color w:val="${o.c || "222222"}"/><w:sz w:val="${o.sz || 20}"/></w:rPr><w:t xml:space="preserve">${x(t)}</w:t></w:r></w:p>`;
  let b = p("GrowNest observation criteria", {b: true, sz: 40, c: "4A2C5E", af: 60}) + p("Indicators, look-fors and feedback statements on the six-point UAE MOE scale", {sz: 20, c: "76658A", af: 240});
  for (const ind of inds.filter(v => v.used_in.includes("formal_observation"))) {
    b += p(`${ind.code} ${ind.title}${ind.moe_ref ? " (MOE " + ind.moe_ref + ")" : ""}`, {b: true, sz: 26, c: "4A2C5E", bf: 240}) + p(ind.look_fors || "", {i: true, sz: 19, c: "555555", af: 120});
    for (const L of LEVELS) { b += p(`${L.n} · ${L.name}`, {b: true, sz: 21, c: "6F9E6B", bf: 120});
      for (const k of ["strength","development"]) { const ss = stmts.filter(s => s.indicator_code === ind.code && s.level === L.n && s.kind === k && s.active !== false).sort((a, c) => a.sort - c.sort);
        if (ss.length) b += p(KIND[k], {b: true, sz: 19}) + ss.map(s => p("•  " + s.text, {sz: 19, ind: true})).join(""); } } }
  b += p("Appraisal areas", {b: true, sz: 28, c: "4A2C5E", bf: 360}) + inds.filter(v => v.used_in.includes("appraisal")).map(v => p(`${v.code} ${v.title}${v.moe_ref ? " (MOE " + v.moe_ref + ")" : ""}: ${v.look_fors || ""}`, {sz: 19, ind: true})).join("");
  b += p("“Also seen in this lesson” options", {b: true, sz: 28, c: "4A2C5E", bf: 360}) + also.filter(o => o.active).map(o => p(`•  ${o.label} (SEF ${(o.els || []).join(", ")})`, {sz: 19, ind: true})).join("");
  const doc = `<?xml version="1.0" encoding="UTF-8" standalone="yes"?><w:document xmlns:w="http://schemas.openxmlformats.org/wordprocessingml/2006/main"><w:body>${b}<w:sectPr><w:pgSz w:w="11906" w:h="16838"/><w:pgMar w:top="900" w:right="900" w:bottom="900" w:left="900" w:header="300" w:footer="300" w:gutter="0"/></w:sectPr></w:body></w:document>`;
  const z = new JSZip();
  z.file("[Content_Types].xml", `<?xml version="1.0" encoding="UTF-8" standalone="yes"?><Types xmlns="http://schemas.openxmlformats.org/package/2006/content-types"><Default Extension="rels" ContentType="application/vnd.openxmlformats-package.relationships+xml"/><Default Extension="xml" ContentType="application/xml"/><Override PartName="/word/document.xml" ContentType="application/vnd.openxmlformats-officedocument.wordprocessingml.document.main+xml"/></Types>`);
  z.file("_rels/.rels", `<?xml version="1.0" encoding="UTF-8" standalone="yes"?><Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships"><Relationship Id="rId1" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/officeDocument" Target="word/document.xml"/></Relationships>`);
  z.file("word/document.xml", doc);
  const blob = await z.generateAsync({type: "blob", mimeType: "application/vnd.openxmlformats-officedocument.wordprocessingml.document"});
  const a = document.createElement("a"); a.href = URL.createObjectURL(blob); a.download = "GrowNest observation criteria.docx"; document.body.appendChild(a); a.click(); a.remove();
}
init();
