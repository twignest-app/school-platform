/* TwigNest class sheet */
(function () {
  const esc = t => String(t ?? "").replace(/[&<>"]/g, c => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;" }[c]));
  const clamp = n => Math.max(0, Math.min(1, n));
  const DOT = { "": "", s: "✓", n: "!", e: "+" }, DOTL = { "": "not assessed", s: "secure", n: "not yet secure", e: "exceeding" };
  const POS = { below: "Below curriculum standards", inline: "In line with curriculum standards", above: "Above curriculum standards", none: "Not yet assessed" };
  const PROG = { below: "Below expected progress", inline: "Expected progress", above: "Better than expected progress" };
  const POSS = { below: "Below", inline: "In line", above: "Above", none: "Not yet assessed" }, PROGS = { below: "Below expected", inline: "Expected", above: "Better than expected" };
  function applyLabels(cfg) { const L = (cfg && cfg.labels) || {}; ["below", "inline", "above"].forEach(k => { if (L.att && L.att[k]) POS[k] = L.att[k]; if (L.prog && L.prog[k]) PROG[k] = L.prog[k]; }); }
  const badge = (c, t) => `<span class="badge b-${c}">${t}</span>`;
  let ctx, C, cls, studs = [], R = {}, ST = {}, TAUGHT = new Set(), LV = {}, CM = {}, NS = {}, PLANS = {}, planErr = false, ED = null, ui = { sub: null, strand: null, term: 0, group: "All", mode: "strand", view: "grid", more: false, oi: 0, pStrand: null, pid: null }, bound = false, pending = 0;

  const DEF_OS = [{ code: "s", label: "Secure", short: "✓", kind: "secure" }, { code: "n", label: "Not yet secure", short: "!", kind: "notyet" }, { code: "e", label: "Exceeding", short: "+", kind: "exceed" }];
  const gradeLevels = () => { const sc = (C && C.scale) || [], gm = (C && C.gradeMin) || [], gp = (C && C.gradePos) || [];
    return sc.map((n, i) => ({ code: "L" + (i + 1), label: /^\d+$/.test(String(n)) ? "Level " + n : String(n), short: String(n).slice(0, 3), kind: gp[i] === "below" ? "notyet" : gp[i] === "above" ? "exceed" : "secure", pct: gm[i + 1] == null ? gm[i] : (gm[i] + gm[i + 1]) / 2 })); };
  const useLv = () => !!(C && C.scale && C.scale.length && (C.objMode === "levels" || (C.objMode === undefined && C.scale.every(x => /^\d+$/.test(String(x))))));
  const OS = () => (useLv() ? gradeLevels() : C && C.objScale && C.objScale.length ? C.objScale : DEF_OS);
  const osOf = v => OS().find(x => x.code === v) || DEF_OS.find(x => x.code === v) || { code: v, label: v, short: "?", kind: "secure" };
  const credit = v => ({ notyet: 0, partial: .5, secure: 1, exceed: 1 })[osOf(v).kind] ?? 1;
  const markPct = v => { const o = osOf(v); if (o.pct != null) return o.pct; const gl = gradeLevels(), g = o.kind === "notyet" ? gl.filter(x => x.kind === "notyet").pop() : gl.find(x => x.kind === o.kind); return g ? g.pct : credit(v) * 100; };
  const isEx = v => osOf(v).kind === "exceed", isGap = v => !!v && credit(v) < 1;
  const lvNum = v => { const m = /^L(\d+)$/.exec(v || ""); return m && useLv() ? Math.min(7, +m[1]) : 0; };
  const dotCls = v => v ? (lvNum(v) ? "l" + lvNum(v) : ({ notyet: "n", partial: "p", secure: "s", exceed: "e" })[osOf(v).kind]) : "";
  const lvBadge = lv => useLv() && lv != null ? `<span class="badge b-l${Math.min(7, lv + 1)}">${esc(lab(lv))}</span>` : null;
  const dotTxt = v => v ? esc(osOf(v).short) : "";
  const defCode = () => (OS().find(x => x.kind === "secure") || OS()[0]).code;
  const cycle = v => { const order = [defCode(), ...OS().map(x => x.code).filter(c => c !== defCode())], i = order.indexOf(v); return v === "" || i < 0 ? order[0] : (order[i + 1] ?? ""); };
  const strands = () => { const o = []; C.subjects.forEach(sb => sb.strands.forEach(st => o.push([sb, st]))); return o; };
  const findStrand = id => strands().find(p => p[1].id === id) || [null, null];
  const findCol = id => { for (const [, st] of strands()) for (const c of st.cols) if (c.id === id) return c; return null; };
  const objs = (c, t) => ((c.objectives || {})[cls.grade_id] || [])[t] || [];
  const val = (sid, cid, k) => ((R[sid] || {})[cid] || {})[k];
  const stat = (sid, oid) => (ST[sid] || {})[oid] || "";
  const tLv = (sid, stid, k) => ((LV[sid] || {})[stid] || {})[k];
  const WT3 = ["working towards", "expected", "greater depth"];
  const isLvOk = c => !!(c && c.scale && c.scale.length && (c.objMode === "levels" || (c.objMode === undefined && c.scale.every(x => /^\d+$/.test(String(x))))));
  function lvCols(cfg) { if (!isLvOk(cfg)) return false; let ch = false; const first = k => Math.max(0, cfg.gradePos.indexOf(k));
    (cfg.subjects || []).forEach(sb => (sb.strands || []).forEach(st => (st.cols || []).forEach(c => {
      if (c.type !== "list") return; const wt = c.options && c.options.length === 3 && c.options.every((o, i) => String(o).trim().toLowerCase() === WT3[i]);
      if (!(c.lv || wt)) return;
      if (wt && !c.lv) { c.legacy = Object.assign({ [c.options[0]]: cfg.scale[Math.max(0, first("inline") - 1)], [c.options[1]]: cfg.scale[first("inline")], [c.options[2]]: cfg.scale[first("above")] }, c.legacy || {}); ch = true; }
      c.lv = true; c.options = cfg.scale.slice(); c.below = first("inline"); c.above = first("above"); }))); return ch; }
  function levelFromPct(p) { let lv = 0; C.gradeMin.forEach((x, i) => { if (p >= x) lv = i; }); return lv; }
  const lab = i => i == null ? "–" : C.scale[Math.max(0, Math.min(C.scale.length - 1, i))];

  function colEval(sid, c, k) {
    if (c.type === "comment") return null;
    if (c.type === "objectives") {
      if (k === "b") return null;
      if (useLv()) { let a = 0, sum = 0; objs(c, +k).filter(o => TAUGHT.has(o.id)).forEach(o => { const v = stat(sid, o.id); if (v) { a++; sum += markPct(v); } });
        if (!a) return null; const p = sum / a; return { band: ({ below: -1, inline: 0, above: 1 })[C.gradePos[levelFromPct(p)]] ?? 0, norm: clamp(p / 100) }; }
      let a = 0, sec = 0, ex = 0;
      objs(c, +k).filter(o => TAUGHT.has(o.id)).forEach(o => { const v = stat(sid, o.id); if (v) { a++; sec += credit(v); if (isEx(v)) ex++; } });
      if (!a) return null; const p = sec / a * 100, e = ex / a * 100;
      return { band: p < c.belowPct ? -1 : (p >= 90 && e >= c.abovePct) ? 1 : 0, norm: clamp(p / 100) };
    }
    const v = val(sid, c.id, k); if (v === undefined || v === "") return null;
    const pos = C.gradePos, gm = C.gradeMin, iS = (gm[pos.indexOf("inline")] ?? 50) / 100, aS = (gm[pos.indexOf("above")] ?? 90) / 100;
    const piece = (x, lo, hi, ls, hs) => x < lo ? iS * clamp((x - (lo - ls)) / ls) * .999 : x < hi ? iS + (aS - iS) * (x - lo) / (hi - lo) : aS + (1 - aS) * clamp((x - hi) / hs);
    if (c.type === "list" && c.lv) { let i = C.scale.indexOf(v); if (i < 0 && c.legacy && c.legacy[v] != null) i = C.scale.indexOf(c.legacy[v]); if (i < 0) return null;
      const gm = C.gradeMin, p = gm[i + 1] == null ? gm[i] : (gm[i] + gm[i + 1]) / 2; return { band: ({ below: -1, inline: 0, above: 1 })[C.gradePos[i]] ?? 0, norm: clamp(p / 100) }; }
    if (c.type === "list") { const i = c.options.indexOf(v); if (i < 0) return null; const n = c.options.length;
      const norm = i < c.below ? iS * (i + .5) / c.below : i < c.above ? iS + (aS - iS) * (i - c.below + .5) / (c.above - c.below) : aS + (1 - aS) * (i - c.above + .5) / (n - c.above);
      return { band: i < c.below ? -1 : i >= c.above ? 1 : 0, norm }; }
    const n = +v; if (isNaN(n)) return null;
    if (c.type === "standardised") return { band: n < c.below ? -1 : n >= c.above ? 1 : 0, norm: piece(n, c.below, c.above, 30, 15) };
    if (c.type === "readingAge") return { band: n < c.below ? -1 : n > c.above ? 1 : 0, norm: piece(n, c.below, c.above + .0001, 1.5, 1.5) };
    return { band: n < c.below ? -1 : n >= c.above ? 1 : 0, norm: clamp(n / c.max) };
  }
  function strandEval(sid, st, k) {
    const ev = st.cols.filter(c => k === "b" ? c.baseline : !c.baseline).map(c => colEval(sid, c, k)).filter(Boolean);
    if (!ev.length) return null;
    const pct = Math.round(ev.reduce((a, x) => a + x.norm, 0) / ev.length * 1000) / 10, sug = levelFromPct(pct);
    return { band: C.gradePos[sug] || "inline", sug, pct };
  }
  const baseIsLv = st => { const b = st.cols.filter(c => c.baseline); return b.length === 1 && b[0].type === "list" && !!b[0].lv; };
  function level(sid, st, k) { const t = k === "b" && baseIsLv(st) ? null : tLv(sid, st.id, k); if (t !== undefined && t !== null) return t; const e = strandEval(sid, st, k); return e ? e.sug : null; }
  function progress(sid, st, t) {
    const b = level(sid, st, "b"), c = level(sid, st, String(t)); if (b == null || c == null) return null;
    const steps = c - b, exp = C.steps * (t + 1) / C.terms.length;
    return { steps, band: steps < exp - .5 ? "below" : steps > exp + .5 ? "above" : "inline" };
  }

  function avgEval(sid, list, k) {
    const ls = list.map(st => [level(sid, st, k), strandEval(sid, st, k)]).filter(x => x[0] != null); if (!ls.length) return null;
    const lv = Math.round(ls.reduce((a, x) => a + x[0], 0) / ls.length), bs = ls.filter(x => x[1]).map(x => ({ below: -1, inline: 0, above: 1 })[x[1].band]);
    const b = bs.length ? bs.reduce((a, x) => a + x, 0) / bs.length : 0; return { lv, band: bs.length ? (C.gradePos[lv] || (b < -.33 ? "below" : b > .33 ? "above" : "inline")) : "none" };
  }
  function avgProgress(sid, list, t) {
    const ps = list.map(st => progress(sid, st, t)).filter(Boolean); if (!ps.length) return null;
    const steps = Math.round(ps.reduce((a, p) => a + p.steps, 0) / ps.length * 10) / 10, exp = C.steps * (t + 1) / C.terms.length;
    return { steps, band: steps < exp - .5 ? "below" : steps > exp + .5 ? "above" : "inline" };
  }
  function onTrack(sid, st, t) {
    const b = level(sid, st, "b"), c = level(sid, st, String(t)); if (b == null || c == null) return null;
    const max = C.scale.length - 1, target = Math.min(max, b + C.steps), proj = Math.min(max, Math.round(b + (c - b) / (t + 1) * C.terms.length));
    return { target, proj, ok: proj >= target };
  }
  const trackCount = (sid, list, t) => { const r = list.map(st => onTrack(sid, st, t)).filter(Boolean); return { ok: r.filter(x => x.ok).length, n: r.length }; };
  const allStrands = () => strands().map(p => p[1]);
  const sname = (sb, st) => sb.name === st.name ? sb.name : `${sb.name}: ${st.name}`;
  const signed = n => (n > 0 ? "+" : "") + n;
  function fixFor(c, sid, k) {
    if (c.type === "score" || c.type === "rubric") return `Go through the ${c.name.toLowerCase()} with the student to find the questions lost, then re-teach those areas in small steps.`;
    if (c.type === "standardised") return "Use the test report to find the weakest areas and target them in small-group work.";
    if (c.type === "readingAge") return "Daily guided reading at the right level, plus a home reading log checked weekly.";
    if (c.type === "list" && c.lv) return "Plan targeted support to move up a level, and check again at the next checkpoint.";
    if (c.type === "list") { const v = val(sid, c.id, k), i = c.options.indexOf(v); return `Targeted group work to move from ${v} towards ${c.options[Math.max(c.below, i + 1)] || c.options[i]}.`; }
    return "Plan targeted support and review at the next checkpoint.";
  }
  function plan(sid, t) {
    const k = String(t), gaps = [], ahead = [];
    strands().forEach(([sb, st]) => {
      const nm = sname(sb, st), ot = onTrack(sid, st, t), pr = progress(sid, st, t), urgent = (pr && pr.band === "below") || (ot && !ot.ok), before = gaps.length;
      if (ot && !ot.ok) gaps.push({ nm, pri: 0, gap: `Not on track: heading for ${lab(ot.proj)} by the end of the year, target ${lab(ot.target)}.`, fix: "Plan targeted support this term and review progress at the next checkpoint." });
      st.cols.forEach(c => {
        if (c.type === "objectives") { for (let ti = 0; ti <= t; ti++) objs(c, ti).forEach(o => { if (!TAUGHT.has(o.id)) return; const v = stat(sid, o.id);
          if (isGap(v)) gaps.push({ nm, pri: urgent ? 0 : 1, gap: `${osOf(v).label}: ${o.text}`, fix: o.step || "Re-teach in a small group and check again." });
          else if (!v) gaps.push({ nm, pri: 2, gap: `Not assessed yet: ${o.text}`, fix: "Assess this objective to complete the picture." }); }); return; }
        if (c.type === "comment") return;
        const kk = c.baseline ? "b" : k, e = colEval(sid, c, kk);
        if (!e) gaps.push({ nm, pri: 2, gap: `Missing: ${c.name}`, fix: "Record this result so the picture is complete." });
        else if (e.band < 0 && !c.baseline) gaps.push({ nm, pri: urgent ? 0 : 1, gap: `${c.name} is below expectations (${val(sid, c.id, kk)}).`, fix: fixFor(c, sid, kk) });
      });
      const e = strandEval(sid, st, k), real = gaps.slice(before).some(g => g.pri < 2);
      if (e && !real) {
        if (e.band === "above") ahead.push({ nm, text: "Working above expectations. Offer greater-depth challenges, open-ended problems and chances to explain their thinking." });
        st.cols.filter(c => c.type === "objectives").forEach(c => objs(c, t + 1).filter(o => !TAUGHT.has(o.id)).slice(0, 2).forEach(o => ahead.push({ nm, text: `Ready for next: ${o.text}. Pre-teach key vocabulary to give a head start.` })));
        if (e.band === "inline" && t + 1 >= C.terms.length) ahead.push({ nm, text: "Secure this year’s learning and share next steps with next year’s teacher." });
      }
    });
    gaps.sort((a, b) => a.pri - b.pri); return { gaps, ahead };
  }
  function chart(sid, st) {
    const pts = [["Baseline", level(sid, st, "b")], ...C.terms.map((t, i) => [t, i <= ui.term ? level(sid, st, String(i)) : null])], n = C.scale.length;
    const b = level(sid, st, "b"), target = b == null ? null : Math.min(n - 1, b + C.steps);
    const X = i => 70 + i * (360 / Math.max(1, pts.length - 1)), Y = v => 180 - v * (150 / Math.max(1, n - 1));
    let g = `<svg viewBox="0 0 460 215" width="100%" style="max-width:620px;display:block" role="img" aria-label="Levels from baseline across the year">`;
    for (let v = 0; v < n; v++) g += `<line x1="56" x2="450" y1="${Y(v)}" y2="${Y(v)}" stroke="var(--line)"/><text x="48" y="${Y(v) + 4}" font-size="11" text-anchor="end" fill="var(--muted)">${esc(C.scale[v]).slice(0, 6)}</text>`;
    if (target != null) g += `<line x1="56" x2="450" y1="${Y(target)}" y2="${Y(target)}" stroke="var(--plum)" stroke-dasharray="5 4"/><text x="450" y="${Y(target) - 6}" font-size="11" text-anchor="end" fill="var(--plum)">Target ${esc(lab(target))}</text>`;
    const kn = pts.map((p, i) => [i, p[1]]).filter(p => p[1] != null);
    g += `<polyline fill="none" stroke="var(--sage)" stroke-width="3" points="${kn.map(([i, v]) => X(i) + "," + Y(v)).join(" ")}"/>`;
    kn.forEach(([i, v]) => g += `<circle cx="${X(i)}" cy="${Y(v)}" r="6" fill="var(--sage)"/>`);
    pts.forEach((p, i) => g += `<text x="${X(i)}" y="205" font-size="12" text-anchor="middle" fill="var(--muted)">${esc(p[0])}</text>`);
    return g + "</svg>";
  }
  function renderOverview(head) {
    const t = ui.term, k = String(t), all = allStrands();
    let h = `<thead><tr><th class="namecol">Student</th>${C.subjects.map(sb => `<th class="colh"><b>${esc(sb.name)}</b>level</th>`).join("")}<th class="colh"><b>Overall</b>all subjects</th><th class="colh"><b>Progress</b>since baseline</th><th class="colh"><b>On track</b>for end-of-year target</th><th class="colh"><b>Below expected</b>click to plan</th></tr></thead><tbody>`;
    visible().forEach(s => {
      const ov = avgEval(s.id, all, k), pr = avgProgress(s.id, all, t), tr = trackCount(s.id, all, t), gp = gapList(s.id, t).open.length;
      h += `<tr><td class="namecol"><button class="name" data-prof="${s.id}">${esc(s.full_name)}</button>${s.student_number ? `<span class="sid">${esc(s.student_number)}</span>` : ""}<div class="tags">${(s.groups || []).map(g => `<span class="tag">${esc(g)}</span>`).join("")}</div></td>`;
      C.subjects.forEach(sb => { const e = avgEval(s.id, sb.strands, k); h += `<td>${e ? (lvBadge(e.lv) || badge(e.band, esc(lab(e.lv)))) : badge("none", "–")}</td>`; });
      h += `<td>${ov ? (lvBadge(ov.lv) || badge(ov.band, esc(lab(ov.lv)))) : "–"}</td><td>${pr ? badge(pr.band, signed(pr.steps) + " · " + PROGS[pr.band]) : "–"}</td>
        <td>${tr.n ? badge(tr.ok === tr.n ? "inline" : tr.ok >= tr.n / 2 ? "none" : "below", `${tr.ok} of ${tr.n}`) : "–"}</td><td style="white-space:nowrap"><button class="gapbtn" data-gaps="${s.id}" aria-label="Gaps and progress plan for ${esc(s.full_name)}">${gp ? badge(gp > 4 ? "below" : "none", gp) : badge("inline", "0")}</button>${planTag(s.id)}</td></tr>`;
    });
    const vs = visible(); let okN = 0, known = 0, progN = 0, pk = 0, need = 0;
    vs.forEach(x => { const ov = avgEval(x.id, all, k), pr = avgProgress(x.id, all, t), tr = trackCount(x.id, all, t);
      if (ov && ov.band !== "none") { known++; if (ov.band !== "below") okN++; } if (pr) { pk++; if (pr.band !== "below") progN++; }
      if ((ov && ov.band === "below") || (tr.n && tr.ok < tr.n / 2)) need++; });
    const m = (l, v, sub) => `<div class="metric"><span>${l}</span><b>${v}</b>${sub ? `<small>${sub}</small>` : ""}</div>`;
    ctx.el.innerHTML = head + `<div class="metrics">${m("In line or above", known ? `${okN} of ${known}` : "–", "against curriculum standards")}${m("Expected progress", pk ? Math.round(progN / pk * 100) + "%" : "–", "or better since baseline")}${m("Need support", need, "below or not on track")}</div>
      <div class="sheetwrap"><table class="sheet">${h}</tbody></table></div><p class="note">Levels are the average of each subject’s strands. Tap a name for the full year, gaps and next steps.</p>`;
  }
  function openProfile(sid) {
    ui.pid = sid; const s = studs.find(x => x.id === sid), t = ui.term, k = String(t), all = allStrands();
    if (!ui.pStrand || !findStrand(ui.pStrand)[1]) ui.pStrand = ui.strand || all[0].id;
    const [psb, pst] = findStrand(ui.pStrand), ov = avgEval(sid, all, k), pr = avgProgress(sid, all, t), tr = trackCount(sid, all, t), pl = plan(sid, t);
    const kpi = (l, v) => `<div class="kpi"><span>${l}</span><b>${v}</b></div>`;
    let yr = ""; C.subjects.forEach(sb => sb.strands.forEach(st => { const ot = onTrack(sid, st, t), p = progress(sid, st, t);
      yr += `<tr><td style="text-align:left"><b>${esc(sb.name)}</b>${sb.name !== st.name ? ` <span class="note">${esc(st.name)}</span>` : ""}</td><td>${esc(lab(level(sid, st, "b")))}</td>${C.terms.map((x, i) => `<td>${i <= t ? esc(lab(level(sid, st, String(i)))) : "<span class='note'>–</span>"}</td>`).join("")}
        <td>${ot ? esc(lab(ot.target)) : "–"}</td><td>${p ? badge(p.band, signed(p.steps)) : "–"}</td><td>${ot ? badge(ot.ok ? "inline" : "below", ot.ok ? "On track" : `Heading for ${esc(lab(ot.proj))}`) : "–"}</td></tr>`; }));
    let data = ""; pst.cols.forEach(c => {
      if (c.type === "objectives") C.terms.forEach((tn, ti) => objs(c, ti).forEach(o => { if (!TAUGHT.has(o.id)) return; const v = stat(sid, o.id); data += `<li><i class="dot ${dotCls(v)}" style="width:22px;height:22px;font-size:11px;flex:none" title="${esc(v ? osOf(v).label : "Not assessed")}">${dotTxt(v)}</i><span>${esc(tn)}: ${esc(o.text)}</span></li>`; }));
      else { const keys = c.baseline ? [["b", "Baseline"]] : C.terms.map((x, i) => [String(i), x]); const vals = keys.map(([kk, l]) => { const v = val(sid, c.id, kk); return v == null ? "" : `${esc(l)}: <b>${esc(v)}</b>`; }).filter(Boolean);
        if (vals.length) data = `<li><span><b>${esc(c.name)}</b> ${vals.join(", ")}</span></li>` + data; } });
    const gapsH = pl.gaps.length ? `<ul class="plan">${pl.gaps.map(g => `<li>${g.pri === 0 ? badge("below", "Priority") : g.pri === 2 ? badge("none", "Check") : ""} <b>${esc(g.nm)}.</b> ${esc(g.gap)}<div class="fix">${esc(g.fix)}</div></li>`).join("")}</ul>` : `<p class="ok">No gaps recorded.</p>`;
    const aheadH = pl.ahead.length ? `<ul class="plan">${pl.ahead.map(a => `<li><b>${esc(a.nm)}.</b> ${esc(a.text)}</li>`).join("")}</ul>` : `<p class="note">Next steps appear here once a strand has no gaps.</p>`;
    let d = document.getElementById("tnProfile"); if (!d) { d = document.createElement("dialog"); d.id = "tnProfile"; document.body.appendChild(d); }
    d.innerHTML = `<div class="dlg"><div class="row" style="justify-content:space-between;align-items:flex-start"><div><h2 style="margin:0;color:var(--plum);font-family:Poppins,sans-serif">${esc(s.full_name)}${s.student_number ? ` <span class="sid">${esc(s.student_number)}</span>` : ""}</h2><div class="tags">${(s.groups || []).map(x => `<span class="tag">${esc(x)}</span>`).join("")}</div></div><div class="row"><button class="btn small" data-print="${sid}">Print report</button><button class="btn ghost small" data-pclose="1">Close</button></div></div>
      <div class="card"><h2>Overall, ${esc(C.terms[t])}</h2><div class="kpis">${kpi("Overall level", ov ? esc(lab(ov.lv)) : "–")}${kpi("Against curriculum standards", ov ? badge(ov.band, POS[ov.band]) : "–")}${kpi("Progress since baseline", pr ? badge(pr.band, signed(pr.steps) + " · " + PROG[pr.band]) : "–")}${kpi("On track for targets", tr.n ? `${tr.ok} of ${tr.n} strands` : "–")}</div></div>
      <div class="card"><h2>The year at a glance</h2><div class="tablewrap"><table class="sheet"><tr><th style="text-align:left">Subject</th><th>Baseline</th>${C.terms.map(x => `<th>${esc(x)}</th>`).join("")}<th>Target</th><th>Progress</th><th>End of year</th></tr>${yr}</table></div>
        <p class="note">“End of year” projects the student’s current rate of progress to the final term.</p></div>
      <div class="card"><h2>Progress from baseline</h2><div class="row">${strands().map(([a, b]) => `<button class="chip" data-pstrand="${b.id}" aria-pressed="${b.id === ui.pStrand}">${esc(sname(a, b))}</button>`).join("")}</div>${chart(sid, pst)}</div>
      <div class="grid2"><div class="card"><h2>Gaps to fill</h2>${gapsH}</div><div class="card"><h2>Ideas to move forward</h2>${aheadH}</div></div>
      <div class="card"><h2>Next steps for ${esc(C.terms[t])}</h2><p class="note">Suggested from the gaps above. Edit them in your own words: they’re saved for this student and used in the report comment and printed report.</p>
        ${strands().map(([a, b]) => `<label class="note" for="pn-${sid}-${b.id}" style="display:block;margin-top:10px"><b>${esc(sname(a, b))}</b>${nsSaved(String(t), sid, b.id) ? " · edited by teacher" : ""}</label><textarea id="pn-${sid}-${b.id}" class="rstep"${dirAttr(b)} data-pns="${sid}|${b.id}">${esc(nsFor(sid, b, t))}</textarea>`).join("")}</div>
      <div class="card"><h2>${esc(sname(psb, pst))}: all recorded data</h2><ul class="plan objl">${data || `<li class="note">Nothing recorded yet.</li>`}</ul></div></div>`;
    if (!d.open) d.showModal();
  }

  const BANDS = ["Low", "Middle", "High"];
  const STATUS = { none: ["none", "Not started"], draft: ["none", "Draft"], ready: ["above", "Ready to check"], changes: ["below", "Changes needed"], approved: ["inline", "Approved"] };
  const cmt = (t, sid, stid) => ((CM[t] || {})[sid] || {})[stid] || null;
  const role = () => ctx.role || "teacher";
  function autoBand(sid, st, k) {
    const lv = level(sid, st, k), e = strandEval(sid, st, k); if (lv == null || !e) return 1;
    const m = C.gradeMin, lo = m[lv], hi = m[lv + 1] ?? 100.0001; if (e.pct < lo) return 0; if (e.pct >= hi) return 2;
    const f = (e.pct - lo) / Math.max(.0001, hi - lo); return f < 1 / 3 ? 0 : f >= 2 / 3 ? 2 : 1;
  }
  const BANK_AR = [
    ["أداء {name} في {strand} في بداياته الأولى، ويحتاج إلى دعم مكثف ومستمر من المعلم للمشاركة في التعلم.", "أداء {name} في {strand} في مراحله الأولى، ويحتاج إلى دعم كبير للوصول إلى التعلم.", "يظهر أداء {name} في {strand} خطوات أولى صغيرة بدعم كبير من المعلم."],
    ["بدأت مهارات {name} في {strand} بالتطور، مع الاعتماد على نمذجة المعلم لإنجاز المهام.", "بدأت مهارات {name} في {strand} بالتطور، ويكون التعلم أفضل مع دعم المعلم ونمذجته.", "تتطور المهارات الأولية لدى {name} في {strand}، مع بدء إنجاز بعض المهام بدعم أقل."],
    ["تتطور مهارات {name} في {strand} نحو المستوى المتوقع، مع الحاجة إلى دعم منتظم.", "تتطور مهارات {name} في {strand} بثبات نحو المستوى المتوقع، مع قدر من الدعم.", "أصبح أداء {name} في {strand} قريبا من المستوى المتوقع، مع الحاجة إلى الدعم في بعض الأحيان فقط."],
    ["بلغ أداء {name} في {strand} المستوى المتوقع، مع ثقة متنامية في تطبيق التعلم الجديد.", "أداء {name} في {strand} في المستوى المتوقع، مع تطبيق التعلم الجديد بثقة متزايدة.", "أداء {name} في {strand} في المستوى المتوقع بثقة، مع تطبيق التعلم الجديد بدعم قليل."],
    ["أداء {name} في {strand} ثابت في المستوى المتوقع، مع بداية التطبيق المستقل للمهارات.", "أداء {name} في {strand} ثابت في المستوى المتوقع، مع تطبيق المهارات باستقلالية.", "أداء {name} في {strand} ثابت جدا، مع تطبيق المهارات باستقلالية ودقة."],
    ["أداء {name} في {strand} أعلى من المستوى المتوقع، مع بداية تطبيق المهارات في سياقات جديدة.", "أداء {name} في {strand} أعلى من المستوى المتوقع، مع تطبيق المهارات بثقة في سياقات جديدة.", "أداء {name} في {strand} أعلى بكثير من المستوى المتوقع، مع تطبيق المهارات بثقة ودقة في سياقات جديدة."],
    ["أداء {name} في {strand} متميز، مع فهم عميق للتعلم.", "أداء {name} في {strand} متميز، مع فهم ممتاز وتطبيق مبدع للمهارات.", "أداء {name} في {strand} متميز جدا، مع فهم استثنائي وتطبيق مبدع ومستقل للمهارات."]];
  const AR_GEN = "مواصلة تطبيق هذا التعلم وتعزيزه في سياقات جديدة.", AR_DEEP = "خوض تحديات أعمق تنمي التفكير وتوسعه.";
  const isArSt = st => { const p = findStrand(st.id); return !!(p[0] && p[0].lang === "ar"); };
  const arName = s => { if (!s.arabic_name) return s.full_name.split(" ")[0]; const w = s.arabic_name.trim().split(/\s+/); return /^عبد/.test(w[0]) && w[0].length <= 3 && w[1] ? w[0] + " " + w[1] : w[0]; };
  const dirAttr = st => isArSt(st) ? ' dir="rtl" lang="ar"' : "";
  function draftAr(sid, st, t, lvO, bandO) {
    const k = String(t), s = studs.find(x => x.id === sid), si = studs.indexOf(s), ti = strands().findIndex(p => p[1].id === st.id);
    const lv = lvO ?? level(sid, st, k); if (lv == null) return { text: "", lv: null, band: 1 };
    const band = bandO ?? autoBand(sid, st, k), bank = (C.reports || {}).bankAr || BANK_AR, row = bank[lv] || [], nm = arName(s);
    let base = (row[band] || row[1] || "").replace(/\{name\}/g, nm).replace(/\{strand\}/g, st.name);
    const pre = ["", "خلال هذا الفصل، ", "على مدار الفصل، ", "في الأسابيع الأخيرة، "][(si + ti) % 4]; if (pre) base = pre + base;
    const sec = [], gaps = [];
    st.cols.filter(c => c.type === "objectives").forEach(c => { for (let i = 0; i <= t; i++) objs(c, i).forEach(o => { const v = stat(sid, o.id); if (!v) return; if (isEx(v)) sec.unshift(o); else if (credit(v) >= 1) sec.push(o); else gaps.push(o); }); });
    let str = ""; if (sec.length) { const o = sec[si % Math.min(2, sec.length)]; str = [` ومن نقاط القوة لدى ${nm}: ${o.text}.`, ` ومن أبرز المهارات المتقنة لدى ${nm}: ${o.text}.`, ` ومن الجوانب المتميزة لدى ${nm}: ${o.text}.`][(si + ti) % 3].replace(/\.\./g, "."); }
    const saved = nsSaved(String(t), sid, st.id), e = strandEval(sid, st, k);
    const nx = " الخطوة التالية: " + (saved ? saved.trim() : gaps.length ? (gaps[0].step || "مزيد من التدريب على: " + gaps[0].text) : e && e.band === "above" ? AR_DEEP : AR_GEN).replace(/[^.!؟]$/, m => m + ".");
    let text = base + str + nx; const lim = (C.reports || {}).limit || 600; if (text.length > lim) text = base + nx;
    return { text: text.trim(), lv, band };
  }
  function draft(sid, st, t, lvO, bandO) {
    if (isArSt(st)) return draftAr(sid, st, t, lvO, bandO);
    const k = String(t), s = studs.find(x => x.id === sid), si = studs.indexOf(s), ti = strands().findIndex(p => p[1].id === st.id);
    const lv = lvO ?? level(sid, st, k); if (lv == null) return { text: "", lv: null, band: 1 };
    const band = bandO ?? autoBand(sid, st, k), bank = (C.reports || {}).bank || [], row = bank[lv] || [], nm = s.full_name.split(" ")[0];
    const fill = x => (x || "").replace(/\{name\}/g, nm).replace(/\{strand\}/g, st.name.toLowerCase());
    let base = fill(row[band] || row[1] || ""); const pre = ["", "This term, ", "Throughout the term, ", "Over recent weeks, "][(si + ti) % 4];
    if (pre && base.startsWith(nm)) base = pre + base;
    const sec = [], gaps = [];
    st.cols.filter(c => c.type === "objectives").forEach(c => { for (let i = 0; i <= t; i++) objs(c, i).forEach(o => { const v = stat(sid, o.id); if (!v) return; if (isEx(v)) sec.unshift(o); else if (credit(v) >= 1) sec.push(o); else gaps.push(o); }); });
    const lc = x => x.charAt(0).toLowerCase() + x.slice(1).replace(/^know /i, "understand ");
    let str = ""; if (sec.length) { const o = sec[si % Math.min(2, sec.length)];
      str = [` A particular strength is that ${nm} can ${lc(o.text)}.`, ` ${nm} can now ${lc(o.text)} with confidence.`, ` ${nm} has shown that they can ${lc(o.text)}.`][(si + ti) % 3]; }
    const e = strandEval(sid, st, k); let nx;
    const savedNs = nsSaved(String(t), sid, st.id);
    if (savedNs) nx = ` Next step: ${savedNs.trim().replace(/[^.!?]$/, m => m + ".")}`;
    else if (gaps.length) nx = ` Next step: ${gaps[0].step || "further practice to " + lc(gaps[0].text) + "."}`;
    if (!nx) { const low = st.cols.filter(c => !c.baseline && c.type !== "objectives").map(c => [c, colEval(sid, c, k)]).find(([, x]) => x && x.band < 0);
      nx = low ? ` Next step: ${fixFor(low[0], sid, k)}` : e && e.band === "above" ? " Next step: take on greater-depth challenges that stretch thinking further." : " Next step: continue to apply and consolidate this learning in new contexts."; }
    let text = base + str + nx; const lim = (C.reports || {}).limit || 600; if (text.length > lim) text = base + nx;
    return { text: text.trim(), lv, band };
  }
  const nsSaved = (t, sid, stid) => ((NS[t] || {})[sid] || {})[stid];
  function nsAuto(sid, st, t) {
    if (isArSt(st)) { const gaps = []; st.cols.filter(c => c.type === "objectives").forEach(c => { for (let i = 0; i <= t; i++) objs(c, i).forEach(o => { const v = stat(sid, o.id); if (v && isGap(v)) gaps.push(o); }); });
      if (gaps.length) return [...new Set(gaps.map(o => o.step || "مزيد من التدريب على: " + o.text))].slice(0, 2).join(" "); const e = strandEval(sid, st, String(t)); return e && e.band === "above" ? AR_DEEP : AR_GEN; }
    const pl = plan(sid, t), nm = sname(...findStrand(st.id)), mine = pl.gaps.filter(g => g.nm === nm && g.pri < 2).map(g => g.fix);
    const GEN = "Plan targeted support this term and review progress at the next checkpoint.", spec = [...new Set(mine)].filter(x => x !== GEN), uniq = spec.length ? spec.slice(0, 2) : [...new Set(mine)].slice(0, 1); if (uniq.length) return uniq.join(" ");
    const a = pl.ahead.filter(x => x.nm === nm).map(x => x.text); return a[0] || "Continue to apply and consolidate this learning in new contexts.";
  }
  const nsFor = (sid, st, t) => nsSaved(String(t), sid, st.id) || nsAuto(sid, st, t);
  function progFinal(sid, st, t) { const c = cmt(String(t), sid, st.id), p = progress(sid, st, t);
    if (c && c.progress) return { band: c.progress, steps: p ? p.steps : null, over: true }; return p; }
  const RP_COL = { none: "grey", draft: "lilac", ready: "blue", changes: "amber", approved: "green" };
  const RP_LABEL = { none: "Not started", draft: "Draft", ready: "Ready to check", changes: "Changes needed", approved: "Approved" };
  const RP_CSS = `<style>
    .rp{--g:#2F9E5B;--g-s:#E3F5EA;--b:#2F7BD8;--b-s:#E4EFFC;--a:#D98A1C;--a-s:#FDF1DE;--l:#8A63C9;--l-s:#F0E9FB;--n:#9B92AB;--n-s:#F1EEF5}
    @media (prefers-color-scheme: dark){:root:not([data-theme="light"]) .rp{--g:#6FD39A;--g-s:#1E3A2A;--b:#7DB3F3;--b-s:#1C2C44;--a:#F2B35C;--a-s:#3A2C16;--l:#C3A6F0;--l-s:#30254A;--n:#B7AEC6;--n-s:#2B2533}}
    .rp-head{background:linear-gradient(135deg,var(--plum-soft),var(--card));border:1px solid var(--line);border-radius:18px;padding:18px 20px;margin-bottom:14px}
    .rp-head h2{margin:0 0 4px}.rp-bar{display:flex;height:12px;border-radius:99px;overflow:hidden;background:var(--n-s);margin:12px 0 10px}.rp-bar i{display:block;height:100%}
    .rp-legend{display:flex;flex-wrap:wrap;gap:6px 14px;font-size:13.5px;color:var(--ink)}.rp-legend span{display:inline-flex;align-items:center;gap:6px}.rp-legend b{font-size:15px}
    .rp-dot{width:10px;height:10px;border-radius:50%;display:inline-block}
    .rp-pill{display:inline-flex;align-items:center;gap:6px;border-radius:99px;padding:4px 12px;font-weight:800;font-size:12.5px;white-space:nowrap}
    .rp-grey{background:var(--n-s);color:var(--n)}.rp-lilac{background:var(--l-s);color:var(--l)}.rp-blue{background:var(--b-s);color:var(--b)}.rp-amber{background:var(--a-s);color:var(--a)}.rp-green{background:var(--g-s);color:var(--g)}
    .bg-grey{background:var(--n)}.bg-lilac{background:var(--l)}.bg-blue{background:var(--b)}.bg-amber{background:var(--a)}.bg-green{background:var(--g)}
    .rp-row{display:flex;align-items:center;gap:12px;width:100%;text-align:left;background:var(--card);border:1px solid var(--line);border-left:6px solid var(--n);border-radius:14px;padding:12px 14px;margin-bottom:8px;cursor:pointer;font:inherit;color:inherit}
    .rp-row:hover{box-shadow:0 4px 14px rgba(70,45,91,.10)}.rp-row .nm{font-weight:800;color:var(--plum);min-width:150px}.rp-row .pv{flex:1;color:var(--muted);font-size:14px;overflow:hidden;white-space:nowrap;text-overflow:ellipsis}
    .rp-row.c-grey,.rcard.c-grey{border-left-color:var(--n)}.rp-row.c-lilac,.rcard.c-lilac{border-left-color:var(--l)}.rp-row.c-blue,.rcard.c-blue{border-left-color:var(--b)}.rp-row.c-amber,.rcard.c-amber{border-left-color:var(--a)}.rp-row.c-green,.rcard.c-green{border-left-color:var(--g)}
    .rp .rcard{border-left:6px solid var(--n);border-radius:16px;padding:16px 18px;box-shadow:0 6px 20px rgba(70,45,91,.10)}
    .rp-data{display:flex;flex-wrap:wrap;gap:8px;margin:10px 0 4px}.rp-data .rp-pill{font-weight:700}
    .rp details.rp-judge{margin:4px 0 6px}.rp details summary{cursor:pointer;color:var(--plum-2);font-weight:700;font-size:13.5px}
    .rp .rtext{border-radius:12px}.rp-actions{display:flex;flex-wrap:wrap;gap:8px;justify-content:flex-end;margin-top:12px}
    .rp-more{display:flex;flex-wrap:wrap;gap:8px;margin-top:12px}
    @media (max-width:640px){.rp-row{flex-wrap:wrap}.rp-row .nm{min-width:0}.rp-row .pv{flex-basis:100%;order:3}}
  </style>`;
  const rpPill = st => `<span class="rp-pill rp-${RP_COL[st] || "grey"}">${RP_LABEL[st] || RP_LABEL.none}</span>`;
  function card(sid, st, title) {
    const t = ui.term, k = String(t), chk = role() === "checker", s = studs.find(x => x.id === sid), c = cmt(k, sid, st.id) || { status: "none" };
    const e = strandEval(sid, st, k), tl = tLv(sid, st.id, k), p = progress(sid, st, t), lim = (C.reports || {}).limit || 600;
    const text = c.text || draft(sid, st, t).text, locked = !chk && (c.status === "ready" || c.status === "approved");
    const key = `${sid}|${st.id}`, over = (tl !== undefined && tl !== null) || !!c.progress, colr = RP_COL[c.status || "none"];
    const att = tl !== undefined && tl !== null ? C.scale[tl] : e ? lab(e.sug) : null, prog = c.progress ? PROG[c.progress] : p ? PROG[p.band] : null;
    return `<div class="rcard c-${colr}" id="rc-${sid}-${st.id}"><div class="row" style="justify-content:space-between;align-items:center"><h3 style="margin:0">${title}</h3>
        <div class="row" style="gap:6px">${rpPill(c.status || "none")}<button class="mini" data-ropen="${key}" aria-label="Close">Close</button></div></div>
      ${c.note ? `<div class="msg info" style="margin-top:8px">Checker’s note: ${esc(c.note)}</div>` : ""}
      <div class="rp-data"><span class="rp-pill rp-lilac">Attainment: ${att ? esc(att) : "–"}${e && !over ? ` (${e.pct}%)` : ""}</span><span class="rp-pill rp-blue">Progress: ${prog ? esc(prog) : "–"}</span>${over ? `<span class="rp-pill rp-amber">Teacher judgement</span>` : `<span class="note" style="align-self:center">from this term’s data</span>`}</div>
      ${locked || chk ? "" : `<details class="rp-judge" ${over ? "open" : ""}><summary>Change attainment or progress</summary>
        <div class="rgrid"><div><label class="note" for="rl-${key}"><b>Attainment this term</b></label><select id="rl-${key}" data-rlv="${key}"><option value="">From the data: ${e ? esc(lab(e.sug)) + " (" + e.pct + "%)" : "–"}</option>${C.scale.map((x, i) => `<option value="${i}" ${tl === i ? "selected" : ""}>${esc(x)}</option>`).join("")}</select></div>
        <div><label class="note" for="rp-${key}"><b>Progress this term</b></label><select id="rp-${key}" data-rpg="${key}"><option value="">From the data: ${p ? PROG[p.band] : "–"}</option>${Object.entries(PROG).map(([v, l]) => `<option value="${v}" ${c.progress === v ? "selected" : ""}>${l}</option>`).join("")}</select></div></div></details>`}
      <label class="note" for="rt-${key}"><b>Report comment</b>${c.text ? "" : " · drafted from the data, not saved yet"}</label>
      ${isArSt(st) && !s.arabic_name ? `<p class="note" style="color:var(--amber);margin:0 0 4px">No Arabic name saved for ${esc(s.full_name)}, so the English first name is used. Add it in Classes and students.</p>` : ""}
      <textarea id="rt-${key}" data-rtx="${key}" class="rtext"${dirAttr(st)} ${locked ? "readonly" : ""}>${esc(text)}</textarea>
      <div class="row" style="justify-content:space-between"><span class="note">${chk ? "" : locked ? (c.status === "approved" ? "Approved by the buddy checker." : "Waiting for the buddy checker.") : "Changes save when you click away."}</span><span class="note rcount" id="rn-${key}">${text.length} / ${lim}</span></div>
      <details ${nsFor(sid, st, t) ? "open" : ""}><summary>Next step <span class="note" style="font-weight:400">(used in the report)</span></summary>
        <textarea id="rs-${key}" data-rns="${key}" class="rstep"${dirAttr(st)} ${locked ? "readonly" : ""} style="margin-top:6px">${esc(nsFor(sid, st, t))}</textarea></details>
      ${chk ? `<label class="note" for="rk-${key}"><b>Note for the teacher</b></label><input type="text" id="rk-${key}" data-rnote="${key}" value="${esc(c.note || "")}">` : ""}
      <div class="rp-actions">${chk ? `<button class="btn ghost small" data-rc="return" data-k="${key}" ${c.status === "ready" ? "" : "disabled"}>Return with note</button><button class="btn small" data-rc="approve" data-k="${key}" ${["ready", "changes"].includes(c.status) ? "" : "disabled"}>Approve</button>`
        : locked ? `<button class="btn ghost small" data-rc="recall" data-k="${key}">${c.status === "approved" ? "Reopen" : "Take back to edit"}</button>`
        : `<button class="btn ghost small" data-rc="redraft" data-k="${key}">Redraft from the data</button><button class="btn small" data-rc="send" data-k="${key}" ${text.length > lim || !text.trim() ? "disabled" : ""}>Send for checking</button>`}</div></div>`;
  }
  function rpRow(sid, st, title) {
    const k = String(ui.term), c = cmt(k, sid, st.id) || { status: "none" }, key = `${sid}|${st.id}`;
    if (ui.ropen === key) return card(sid, st, title);
    const pv = c.text ? esc(c.text) : `<i>Not started. A draft from the data is ready.</i>`;
    return `<button class="rp-row c-${RP_COL[c.status || "none"]}" data-ropen="${key}"><span class="nm">${title}</span><span class="pv">${pv}</span>${rpPill(c.status || "none")}<span aria-hidden="true" style="color:var(--muted)">›</span></button>`;
  }
  function renderReports(head) {
    const t = String(ui.term), list = strands(), vs = visible(); let tot = 0; const cnt = { none: 0, draft: 0, ready: 0, changes: 0, approved: 0 };
    vs.forEach(s => list.forEach(([, st]) => { tot++; const c = cmt(t, s.id, st.id); cnt[c ? c.status : "none"]++; }));
    const chk = role() === "checker";
    if (!ui.rview) ui.rview = "subject"; if (!list.find(p => p[1].id === ui.rstrand)) ui.rstrand = list[0] && list[0][1].id; if (!vs.find(x => x.id === ui.rstud)) ui.rstud = vs[0] && vs[0].id;
    const seg = ["approved", "ready", "changes", "draft", "none"].map(k => cnt[k] ? `<i class="bg-${RP_COL[k]}" style="width:${cnt[k] / tot * 100}%" title="${RP_LABEL[k]}: ${cnt[k]}"></i>` : "").join("");
    let h = head + RP_CSS + `<div class="rp"><div class="rp-head"><div class="row" style="justify-content:space-between;align-items:flex-start"><div><h2>Report comments · ${esc(C.terms[ui.term])}</h2>
        <p class="note" style="margin:0">${cnt.approved} of ${tot} approved</p></div>
        ${chk ? `<button class="btn" data-rp="next">Check the next comment</button>` : cnt.none ? `<button class="btn" data-rp="draftall">Draft all ${cnt.none} empty comments</button>` : ""}</div>
      <div class="rp-bar">${seg}</div>
      <div class="rp-legend">${["approved", "ready", "changes", "draft", "none"].map(k => `<span><i class="rp-dot bg-${RP_COL[k]}"></i>${RP_LABEL[k]} <b>${cnt[k]}</b></span>`).join("")}</div>
      <div class="rp-more"><button class="btn ghost small" data-rp="export">Export approved (Excel)</button><button class="btn ghost small" data-rp="printall">Print all reports</button></div></div>
      <div class="tabs2" role="tablist" style="margin-top:6px"><button role="tab" data-rv="subject" aria-selected="${ui.rview === "subject"}">By subject</button><button role="tab" data-rv="student" aria-selected="${ui.rview === "student"}">By student</button><button role="tab" data-rv="status" aria-selected="${ui.rview === "status"}">Overview</button></div>`;
    if (!vs.length) { ctx.el.innerHTML = h + `<div class="card"><p class="note">No students match these filters.</p></div></div>`; return; }
    if (ui.rview === "subject") {
      const [sb, st] = findStrand(ui.rstrand);
      h += `<div class="fbar"><label class="fl" for="rvStrand">Subject</label><select id="rvStrand" class="fsel">${list.map(([a, b]) => `<option value="${b.id}" ${b.id === ui.rstrand ? "selected" : ""}>${esc(sname(a, b))}</option>`).join("")}</select>
        <span class="note">Tap a student to write or check their comment.</span></div>`;
      h += vs.map(x => rpRow(x.id, st, `${esc(x.full_name)}${isArSt(st) && x.arabic_name ? ` <span dir="rtl" lang="ar" class="arname">${esc(x.arabic_name)}</span>` : ""}`)).join("");
    } else if (ui.rview === "student") {
      const i = vs.findIndex(x => x.id === ui.rstud), x = vs[i];
      h += `<div class="fbar"><button class="btn ghost small" data-rstep="-1" ${i <= 0 ? "disabled" : ""}>← Previous</button><label class="fl" for="rvStud">Student</label><select id="rvStud" class="fsel">${vs.map(y => `<option value="${y.id}" ${y.id === ui.rstud ? "selected" : ""}>${esc(y.full_name)}</option>`).join("")}</select><button class="btn ghost small" data-rstep="1" ${i >= vs.length - 1 ? "disabled" : ""}>Next →</button><button class="btn ghost small" data-print="${x.id}">Print this report</button></div>`;
      h += `<div class="card" style="margin-bottom:12px"><h2 style="margin:0">${esc(x.full_name)}${x.arabic_name ? ` <span dir="rtl" lang="ar" class="arname">${esc(x.arabic_name)}</span>` : ""} ${x.student_number ? `<span class="sid">${esc(x.student_number)}</span>` : ""}</h2><div class="tags">${(x.groups || []).map(g => `<span class="tag">${esc(g)}</span>`).join("")}</div></div>`;
      h += list.map(([a, b]) => rpRow(x.id, b, esc(sname(a, b)))).join("");
    } else {
      let tb = `<thead><tr><th class="namecol">Student</th>${list.map(([a, b]) => `<th class="colh"><b>${esc(sname(a, b))}</b></th>`).join("")}</tr></thead><tbody>`;
      vs.forEach(x => { tb += `<tr><td class="namecol"><button class="name" data-rgo="student|${x.id}">${esc(x.full_name)}</button></td>`;
        list.forEach(([a, b]) => { const c = cmt(t, x.id, b.id), stt = c ? c.status : "none";
          tb += `<td><button class="rp-pill rp-${RP_COL[stt]}" style="border:0;cursor:pointer" data-rgo="subject|${b.id}|${x.id}">${RP_LABEL[stt]}</button></td>`; }); tb += `</tr>`; });
      h += `<div class="sheetwrap"><table class="sheet">${tb}</tbody></table></div><p class="note">Tap a status to open that comment, or a name to see all of that student’s comments.</p>`;
    }
    ctx.el.innerHTML = h + `</div>`;
  }
  function exportCSV() {
    const t = String(ui.term), list = strands(), q = v => `"${String(v ?? "").replace(/"/g, '""')}"`;
    let csv = "\ufeff" + [q("Student"), q("Student ID"), ...list.map(([a, b]) => q(sname(a, b) + " level") + "," + q(sname(a, b) + " progress") + "," + q(sname(a, b) + " comment") + "," + q(sname(a, b) + " next step"))].join(",") + "\n";
    studs.forEach(s => { csv += [q(s.full_name), q(s.student_number || ""), ...list.map(([, b]) => { const c = cmt(t, s.id, b.id), pf = progFinal(s.id, b, ui.term);
      return c && c.status === "approved" ? [q(lab(level(s.id, b, t))), q(pf ? PROG[pf.band] : ""), q(c.text), q(nsFor(s.id, b, ui.term))].join(",") : [q(""), q(""), q(""), q("")].join(","); })].join(",") + "\n"; });
    const a = document.createElement("a"); a.href = URL.createObjectURL(new Blob([csv], { type: "text/csv" })); a.download = `${cls.name} report comments ${C.terms[ui.term]}.csv`; a.click();
  }
  function upC(sid, stid, patch) {
    const t = String(ui.term), prev = cmt(t, sid, stid) || { student_id: sid, strand_id: stid, term: t, text: "", level: null, band: 1, status: "draft", note: "", progress: null };
    const row = Object.assign({}, prev, patch, { student_id: sid, strand_id: stid, term: t }); if (!row.status || row.status === "none") row.status = "draft";
    delete row.updated_at; delete row.updated_by;
    (((CM[t] = CM[t] || {})[sid] = (CM[t] || {})[sid] || {}))[stid] = row;
    return run(ctx.sb.from("report_comments").upsert(row));
  }
  async function reportAction(a) {
    if (a === "export") return exportCSV();
    if (a === "printall") return printReports(visible());
    if (a === "draftall") { const rows = []; visible().forEach(s => strands().forEach(([, st]) => { const c = cmt(String(ui.term), s.id, st.id); if (!c || !c.text) { const d = draft(s.id, st, ui.term); if (d.text) rows.push({ student_id: s.id, strand_id: st.id, term: String(ui.term), text: d.text, level: d.lv, band: d.band, status: "draft", note: "", progress: c ? c.progress || null : null }); } }));
      rows.forEach(r => (((CM[r.term] = CM[r.term] || {})[r.student_id] = (CM[r.term] || {})[r.student_id] || {}))[r.strand_id] = r); render(); if (rows.length) run(ctx.sb.from("report_comments").upsert(rows)); return; }
    if (a === "next") { for (const [, st] of strands()) for (const s of visible()) { const c = cmt(String(ui.term), s.id, st.id); if (c && c.status === "ready") { ui.rview = "subject"; ui.rstrand = st.id; ui.ropen = `${s.id}|${st.id}`; render(); return focusCard(s.id, st.id); } } return alert("There are no comments waiting to be checked."); }
  }
  function focusCard(sid, stid) { setTimeout(() => { const el = document.getElementById(`rc-${sid}-${stid}`); if (el) { el.scrollIntoView({ behavior: "smooth", block: "center" }); el.classList.add("flash"); setTimeout(() => el.classList.remove("flash"), 1600); } }, 60); }
  function openNext(sid, stid, want) { // after finishing a comment, open the next one that still needs work
    const t = String(ui.term), vs = visible();
    if (ui.rview === "student") { const list = strands().map(p => p[1]), i = list.findIndex(x => x.id === stid);
      const nx = list.slice(i + 1).find(st => want.includes((cmt(t, sid, st.id) || { status: "none" }).status)); ui.ropen = nx ? `${sid}|${nx.id}` : null; return nx ? [sid, nx.id] : null; }
    const i = vs.findIndex(x => x.id === sid), nx = vs.slice(i + 1).concat(vs.slice(0, i)).find(x => want.includes((cmt(t, x.id, stid) || { status: "none" }).status));
    ui.ropen = nx ? `${nx.id}|${stid}` : null; return nx ? [nx.id, stid] : null;
  }
  async function cardAction(a, key) {
    const [sid, stid] = key.split("|"), st = findStrand(stid)[1], t = String(ui.term), ta = document.getElementById(`rt-${key}`);
    if (a === "redraft") { const d = draft(sid, st, ui.term); ta.value = d.text; await upC(sid, stid, { text: d.text, level: d.lv, band: d.band }); return render(); }
    if (a === "send") { await upC(sid, stid, { text: ta.value.trim(), status: "ready", note: "" }); const n = openNext(sid, stid, ["none", "draft", "changes"]); render(); return n ? focusCard(n[0], n[1]) : null; }
    if (a === "recall") { await upC(sid, stid, { status: "draft" }); render(); return focusCard(sid, stid); }
    if (a === "approve") { await upC(sid, stid, { text: ta.value.trim(), status: "approved", note: "" }); const n = openNext(sid, stid, ["ready"]); render(); return n ? focusCard(n[0], n[1]) : null; }
    if (a === "return") { const n = (document.getElementById(`rk-${key}`) || {}).value || ""; if (!n.trim()) return alert("Add a note so the teacher knows what to change."); await upC(sid, stid, { note: n.trim(), status: "changes" }); render(); return focusCard(sid, stid); }
  }

  function reportHTML(s) {
    const t = ui.term, k = String(t), all = allStrands(), ov = avgEval(s.id, all, k), withG = ui.printGraphs !== false;
    const pbs = all.map(st => progFinal(s.id, st, t)).filter(Boolean).map(p => ({ below: -1, inline: 0, above: 1 })[p.band]), pav = pbs.length ? pbs.reduce((x, y) => x + y, 0) / pbs.length : null;
    const pr = pav == null ? null : { band: pav < -.33 ? "below" : pav > .33 ? "above" : "inline" };
    let rows = "", graphs = "";
    C.subjects.forEach(sb => sb.strands.forEach(st => { const e = strandEval(s.id, st, k), lv = level(s.id, st, k), p = progFinal(s.id, st, t), ot = onTrack(s.id, st, t), cm = cmt(k, s.id, st.id);
      const posB = lv != null ? (C.gradePos[lv] || (e && e.band)) : null;
      rows += `<tr><td><b>${esc(sb.name)}</b>${sb.name !== st.name ? `<br>${esc(st.name)}` : ""}</td><td>${esc(lab(level(s.id, st, "b")))}</td><td>${esc(lab(lv))}</td><td>${posB ? POS[posB] : "–"}</td><td>${p ? PROG[p.band] : "–"}</td><td>${ot == null ? "–" : ot.ok ? "On track" : "Needs support"}</td></tr>
        ${cm && cm.status === "approved" && cm.text ? (isArSt(st) ? `<tr class="cm"><td colspan="6" dir="rtl" lang="ar" style="text-align:right">${esc(cm.text)}</td></tr>` : `<tr class="cm"><td colspan="6">${esc(cm.text)}<br><b>Next step:</b> ${esc(nsFor(s.id, st, t))}</td></tr>`) : ""}`;
      if (withG) graphs += `<div class="rg"><b>${esc(sname(sb, st))}</b>${chart(s.id, st)}</div>`; }));
    return `<section class="rep"><div class="rh"><img src="logo.png" alt=""><div><h1>${esc(s.full_name)}${s.arabic_name ? ` <span dir="rtl" lang="ar" style="font-weight:600">${esc(s.arabic_name)}</span>` : ""}</h1><p>${s.student_number ? `Student ID ${esc(s.student_number)}. ` : ""}${esc(ctx.schoolName || "")}${ctx.schoolName ? ", " : ""}${esc(cls.name)}. ${esc(C.terms[t])} report, ${esc(cls.year)}</p></div></div>
      <p class="sum"><b>Overall:</b> level ${ov ? esc(lab(ov.lv)) : "–"}, ${ov ? POS[ov.band].toLowerCase() : "not yet assessed"}. Progress since the start of the year: ${pr ? PROG[pr.band].toLowerCase() : "–"}.</p>
      <table><thead><tr><th>Subject</th><th>Start of year</th><th>${esc(C.terms[t])}</th><th>Against curriculum standards</th><th>Progress</th><th>End-of-year target</th></tr></thead><tbody>${rows}</tbody></table>
      ${withG ? `<h2>Progress from the start of the year</h2><div class="rgs">${graphs}</div>` : ""}</section>`;
  }
  function printReports(list) {
    const go = withG => { ui.printGraphs = withG; let p = document.getElementById("tnPrint"); if (!p) { p = document.createElement("div"); p.id = "tnPrint"; document.body.appendChild(p); }
      p.innerHTML = list.map(reportHTML).join(""); document.querySelectorAll("dialog[open]").forEach(d => d.close()); setTimeout(() => window.print(), 300); };
    let d = document.getElementById("tnPrintOpt"); if (!d) { d = document.createElement("dialog"); d.id = "tnPrintOpt"; document.body.appendChild(d); }
    d.innerHTML = `<div class="dlg"><h2 style="margin:0 0 6px;color:var(--plum);font-family:Poppins,sans-serif">Print ${list.length === 1 ? "report" : list.length + " reports"}</h2><p class="note">Choose <b>Save as PDF</b> in the print window to download a PDF instead of printing.</p>
      <label class="check" style="margin:12px 0"><input type="checkbox" id="pgG" checked> Include progress graphs</label><div class="row"><button class="btn" id="pgGo">Print</button><button class="btn ghost" id="pgX">Cancel</button></div></div>`;
    document.querySelectorAll("dialog[open]").forEach(x => x.close()); d.showModal();
    document.getElementById("pgX").onclick = () => d.close(); document.getElementById("pgGo").onclick = () => { const g = document.getElementById("pgG").checked; d.close(); go(g); };
  }

  async function load() {
    const sb = ctx.sb;
    const [s, st] = await Promise.all([
      sb.from("school_setups").select("*").eq("school_id", cls.school_id).eq("year", cls.year).limit(1),
      sb.from("students").select("*").eq("class_id", cls.id).eq("archived", false).order("full_name")]);
    if (s.error || st.error) throw (s.error || st.error);
    if (!s.data.length) throw new Error("This school’s setup for " + cls.year + " couldn’t be found.");
    C = s.data[0].config; lvCols(C); applyLabels(C); if (ctx.subjects) C = Object.assign({}, C, { subjects: C.subjects.filter(x => ctx.subjects.includes(x.id)) }); studs = st.data;
    const ids = studs.map(x => x.id);
    R = {}; ST = {}; LV = {}; TAUGHT = new Set();
    const tg = await sb.from("taught").select("obj_id").eq("class_id", cls.id);
    if (tg.error) throw tg.error; tg.data.forEach(r => TAUGHT.add(r.obj_id));
    if (ids.length) {
      const [r, o, l] = await Promise.all([sb.from("results").select("*").in("student_id", ids), sb.from("objective_status").select("*").in("student_id", ids), sb.from("student_levels").select("*").in("student_id", ids)]);
      const err = r.error || o.error || l.error; if (err) throw err;
      r.data.forEach(x => { ((R[x.student_id] = R[x.student_id] || {})[x.col_id] = (R[x.student_id] || {})[x.col_id] || {})[x.term] = x.value; });
      o.data.forEach(x => (ST[x.student_id] = ST[x.student_id] || {})[x.obj_id] = x.status);
      l.data.forEach(x => { ((LV[x.student_id] = LV[x.student_id] || {})[x.strand_id] = (LV[x.student_id] || {})[x.strand_id] || {})[x.term] = x.level; });
      const cm = await sb.from("report_comments").select("*").in("student_id", ids); if (cm.error) throw cm.error;
      CM = {}; cm.data.forEach(x => { ((CM[x.term] = CM[x.term] || {})[x.student_id] = (CM[x.term] || {})[x.student_id] || {})[x.strand_id] = x; });
      const pp = await sb.from("progress_plans").select("*").in("student_id", ids).eq("status", "active"); PLANS = {}; planErr = !!pp.error;
      if (!pp.error) pp.data.forEach(x => { if (!PLANS[x.student_id] || String(x.updated_at) > String(PLANS[x.student_id].updated_at)) PLANS[x.student_id] = x; });
      const ns = await sb.from("next_steps").select("*").in("student_id", ids); NS = {}; if (!ns.error) ns.data.forEach(x => { ((NS[x.term] = NS[x.term] || {})[x.student_id] = (NS[x.term] || {})[x.student_id] || {})[x.strand_id] = x.text; });
    }
  }

  function saving(delta, err) {
    pending += delta; const el = document.getElementById("shSave"); if (!el) return;
    if (err) { el.textContent = "Not saved: " + err; el.style.color = "var(--red)"; return; }
    el.style.color = "var(--muted)"; el.textContent = pending > 0 ? "Saving…" : "All changes saved";
  }
  async function run(q) { saving(1); const { error } = await q; saving(-1, error && error.message); return !error; }

  const visible = () => studs.filter(s => ui.group === "All" || (s.groups || []).includes(ui.group));
  function hint(c) { return { score: `out of ${c.max}`, rubric: `out of ${c.max}`, standardised: "standardised", readingAge: "years", list: "choose", comment: "notes" }[c.type] || ""; }
  function cell(s, c, k) {
    const v = val(s.id, c.id, k) ?? "", ev = colEval(s.id, c, k), cl = ev ? ["tb", "ti", "ta"][ev.band + 1] : "";
    const a = `data-v="${s.id}|${c.id}|${k}" aria-label="${esc(s.full_name)}, ${esc(c.name)}" class="in ${cl}"`;
    if (c.type === "list") { const cur = c.lv && c.legacy && c.legacy[v] != null && !c.options.includes(v) ? c.legacy[v] : v;
      return `<select ${a}><option value=""></option>${c.options.map(o => `<option ${o === cur ? "selected" : ""}>${esc(o)}</option>`).join("")}</select>`; }
    if (c.type === "comment") return `<input type="text" ${a} value="${esc(v)}" style="width:170px;text-align:left">`;
    return `<input type="number" step="any" ${a} value="${esc(v)}">`;
  }
  function lvOpts(s, st, k) { const t = tLv(s.id, st.id, k), e = strandEval(s.id, st, k);
    return `<option value="">Auto (${e ? esc(lab(e.sug)) + " · " + e.pct + "%" : "–"})</option>` + C.scale.map((x, i) => `<option value="${i}" ${t === i ? "selected" : ""}>${esc(x)}</option>`).join(""); }
  function summary(s, st) { const k = String(ui.term), lv = level(s.id, st, k), p = progress(s.id, st, ui.term), bd = lv == null ? "none" : (C.gradePos[lv] || "inline");
    return { pos: lvBadge(lv) || badge(bd, lv == null ? "–" : esc(lab(lv))), prog: p ? badge(p.band, (p.steps > 0 ? "+" : "") + p.steps + " · " + PROGS[p.band]) : badge("none", "–") }; }

  /* ---- Gaps and progress plans ---- */
  const isoDay = d => { const z = new Date(d); z.setMinutes(z.getMinutes() - z.getTimezoneOffset()); return z.toISOString().slice(0, 10); };
  const fmtD = d => d ? new Date(d + "T00:00:00").toLocaleDateString("en-GB", { day: "numeric", month: "short" }) : "";
  const daysTo = d => Math.round((new Date(d + "T00:00:00") - new Date(isoDay(new Date()) + "T00:00:00")) / 864e5);
  const mini = v => v ? `<i class="dot ${dotCls(v)}" style="width:24px;height:24px;font-size:11px;font-style:normal;display:inline-flex" title="${esc(osOf(v).label)}">${dotTxt(v)}</i>` : `<i class="dot" style="width:24px;height:24px;display:inline-flex" title="Not assessed"></i>`;
  function gapList(sid, t) {
    const open = [], na = [];
    strands().forEach(([sb, st]) => st.cols.forEach(c => { if (c.type !== "objectives") return;
      for (let ti = 0; ti <= t; ti++) objs(c, ti).forEach(o => { if (!TAUGHT.has(o.id)) return; const v = stat(sid, o.id), it = { o, nm: sname(sb, st), term: ti, v };
        if (isGap(v)) open.push(it); else if (!v) na.push(it); }); }));
    return { open, na };
  }
  const planOf = sid => PLANS[sid] || null;
  const inPlan = (sid, oid) => { const p = planOf(sid); return !!(p && (p.objectives || []).some(x => x.obj_id === oid)); };
  function planTag(sid) { const p = planOf(sid); if (!p) return ""; const d = daysTo(p.ends);
    return d < 0 ? `<span class="badge b-below" style="margin-left:6px">Review due</span>` : `<span class="tag" style="margin-left:6px">Plan until ${esc(fmtD(p.ends))}</span>`; }
  async function savePlan(sid, objectives, ends, note) {
    const old = planOf(sid), row = { id: old ? old.id : (crypto.randomUUID ? crypto.randomUUID() : "pp" + Date.now() + Math.random().toString(36).slice(2, 8)), school_id: cls.school_id, class_id: cls.id, student_id: sid, objectives, starts: old ? old.starts : isoDay(new Date()), ends, note: note || null, status: "active", updated_at: new Date().toISOString() };
    const ok = await run(ctx.sb.from("progress_plans").upsert(row)); if (ok) PLANS[sid] = row; return ok;
  }
  function openGaps(sid) {
    ui.gsid = sid; ui.glen = null; const p = planOf(sid); ui.gsel = new Set(p ? p.objectives.map(x => x.obj_id) : []);
    let d = document.getElementById("tnGaps"); if (!d) { d = document.createElement("dialog"); d.id = "tnGaps"; document.body.appendChild(d); }
    renderGaps(); if (!d.open) d.showModal();
  }
  function renderGaps() {
    const d = document.getElementById("tnGaps"), sid = ui.gsid, s = studs.find(x => x.id === sid); if (!d || !s) return;
    const t = ui.term, { open, na } = gapList(sid, t), p = planOf(sid), goalC = defCode();
    let h = `<div class="dlg"><div class="row" style="justify-content:space-between;align-items:flex-start;gap:10px"><div><h2 style="margin:0;color:var(--plum);font-family:Poppins,sans-serif">${esc(s.full_name)}</h2>
      <p class="note" style="margin:4px 0 0">${open.length ? `Below the expected level in ${open.length} objective${open.length === 1 ? "" : "s"} taught so far` : "No objectives below the expected level"}${na.length ? ` · ${na.length} not assessed yet` : ""}</p></div><button class="btn ghost small" data-pclose="1">Close</button></div>`;
    if (planErr) h += `<div class="msg err" style="margin-top:12px">Progress plans can’t be saved yet. The school lead needs to run the one-time database update (progress-plans.sql) in Supabase.</div>`;
    if (p) {
      const dl = daysTo(p.ends), done = p.objectives.filter(x => { const v = stat(sid, x.obj_id); return v && !isGap(v); }).length;
      h += `<div class="card" style="margin-top:14px;border:2px solid var(--plum)"><div class="row" style="justify-content:space-between;align-items:center;flex-wrap:wrap;gap:8px"><h2 style="margin:0">Progress plan</h2>
        <span class="note">${esc(fmtD(p.starts))} to ${esc(fmtD(p.ends))} · ${dl < 0 ? `<b style="color:var(--red)">review due</b>` : dl === 0 ? "ends today" : dl + " day" + (dl === 1 ? "" : "s") + " left"} · <b>${done} of ${p.objectives.length}</b> reached the expected level</span></div>
        <table class="onelist" style="margin-top:8px"><tr><th style="text-align:left">Focus objective</th><th>Started at</th><th>Now</th><th></th></tr>${p.objectives.map(x => { const v = stat(sid, x.obj_id), ok = v && !isGap(v);
          return `<tr><td><span class="note">${esc(x.nm || "")}</span><br><span dir="auto">${esc(x.text)}</span></td><td style="text-align:center">${mini(x.start)}</td><td style="text-align:center">${mini(v)}</td><td>${ok ? badge("inline", "Reached") : badge("none", "Working on it")}</td></tr>`; }).join("")}</table>
        ${p.note ? `<p style="margin:10px 0 0"><b>Support:</b> ${esc(p.note)}</p>` : ""}
        <div class="row" style="margin-top:12px;gap:8px;flex-wrap:wrap"><button class="btn small" data-gpdone="complete">Finish plan</button><button class="btn ghost small" data-gpdone="ended">Remove plan</button><span class="note">To change it, tick or untick objectives below and save again.</span></div></div>`;
    }
    h += `<div class="card" style="margin-top:14px"><h2 style="margin-top:0">Choose what to focus on</h2><p class="note">Tick the objectives to work on. Two or three at a time works best. Use <b>Re-check</b> when you assess again: the gap closes once the student reaches ${esc(osOf(goalC).label)}.</p>`;
    if (!open.length) h += `<p class="ok">Nothing below the expected level right now.</p>`;
    let last = null;
    open.forEach(it => { if (it.nm !== last) { h += `<h3 style="font-size:14px;margin:14px 0 4px;color:var(--plum)">${esc(it.nm)}</h3>`; last = it.nm; }
      h += `<div class="gaprow"><label class="gapchk"><input type="checkbox" data-gsel="${it.o.id}" ${ui.gsel.has(it.o.id) ? "checked" : ""}><span><span dir="auto">${esc(it.o.text)}</span> <span class="tag">${esc(C.terms[it.term])}</span>${inPlan(sid, it.o.id) ? ` <span class="tag">In plan</span>` : ""}</span></label>
        <div class="row" style="gap:6px;align-items:center;margin:6px 0 0 30px;flex-wrap:wrap"><span class="note">Now</span>${mini(it.v)}<span class="note" style="margin-left:8px">Re-check</span>${OS().map(x => `<button class="dot pick ${it.v === x.code ? dotCls(x.code) : ""}" style="width:30px;height:30px;font-size:12px" data-grc="${sid}|${it.o.id}|${x.code}" title="${esc(x.label)}" aria-label="Re-check: ${esc(x.label)}">${esc(x.short)}</button>`).join("")}</div>
        <p class="note" style="margin:6px 0 0 30px">Next step: ${esc(it.o.step || "Re-teach in a small group and check again.")}</p></div>`; });
    if (na.length) h += `<details style="margin-top:14px"><summary class="note">Not assessed yet (${na.length}). These are a reminder for you, not gaps for the student.</summary><ul class="plan">${na.map(it => `<li><b>${esc(it.nm)}.</b> ${esc(it.o.text)}</li>`).join("")}</ul></details>`;
    h += `</div>`;
    if (open.length || p) h += `<div class="card gpfoot"><div class="row" style="gap:12px;flex-wrap:wrap;align-items:flex-end">
        <div><b id="gpCount">${ui.gsel.size} selected</b></div>
        <div><label class="fl" for="gpLen">Focus for</label><select id="gpLen" class="fsel">${[...(p ? [["keep", "Keep end date (" + fmtD(p.ends) + ")"]] : []), [2, "2 weeks"], [3, "3 weeks"], [4, "4 weeks"], [6, "6 weeks"], [8, "8 weeks"], ["date", "Until a date…"]].map(([v, l]) => `<option value="${v}" ${String(v) === String(ui.glen || (p ? "keep" : 4)) ? "selected" : ""}>${esc(l)}</option>`).join("")}</select></div>
        <div id="gpEndW" style="${String(ui.glen) === "date" ? "" : "display:none"}"><label class="fl" for="gpEnd">End date</label><input type="date" id="gpEnd" class="fsel" value="${esc(p ? p.ends : "")}"></div>
        <div style="flex:1;min-width:220px"><label class="fl" for="gpNote">How you’ll support (optional)</label><input type="text" id="gpNote" class="fsel" style="width:100%" value="${esc(p ? p.note || "" : "")}" placeholder="e.g. Small group, 3 times a week with the LSA"></div>
        <button class="btn" data-gpsave="1" ${ui.gsel.size ? "" : "disabled"}>${p ? "Update plan" : "Save progress plan"}</button></div></div>`;
    d.innerHTML = h + `</div>`;
  }
  function renderClassGaps(head) {
    const t = ui.term, vs = visible(), rows = [];
    strands().forEach(([sb, st]) => st.cols.forEach(c => { if (c.type !== "objectives") return;
      for (let ti = 0; ti <= t; ti++) objs(c, ti).forEach(o => { if (!TAUGHT.has(o.id)) return; const below = vs.filter(s => isGap(stat(s.id, o.id))), asd = vs.filter(s => stat(s.id, o.id)).length;
        if (below.length) rows.push({ o, nm: sname(sb, st), term: ti, below, asd }); }); }));
    rows.sort((a, b) => b.below.length / Math.max(1, b.asd) - a.below.length / Math.max(1, a.asd) || b.below.length - a.below.length);
    const sugg = r => r.below.length / Math.max(1, r.asd) >= .5 ? badge("below", "Re-teach to the whole class") : r.below.length >= 2 ? badge("none", "Small group") : badge("inline", "Individual support");
    let h = `<div class="card"><h2 style="margin-top:0">Objectives to revisit</h2><p class="note">Taught objectives where students are below the expected level, most urgent first. Click a name to open that student’s gaps and progress plan.</p></div>`;
    if (!rows.length) h += `<div class="card"><p class="ok">No taught objectives are below the expected level for these students.</p></div>`;
    rows.forEach(r => { h += `<div class="card"><div class="row" style="justify-content:space-between;align-items:flex-start;gap:10px;flex-wrap:wrap"><div style="flex:1;min-width:240px"><span class="note">${esc(r.nm)} · ${esc(C.terms[r.term])}</span><div style="font-weight:700;margin-top:2px" dir="auto">${esc(r.o.text)}</div></div>
      <div style="text-align:right">${sugg(r)}<div class="note" style="margin-top:4px">${r.below.length} of ${r.asd} assessed below expected</div></div></div>
      <div class="row" style="gap:6px;flex-wrap:wrap;margin-top:10px">${r.below.map(s => `<button class="chip" data-gaps="${s.id}" style="display:inline-flex;gap:6px;align-items:center">${mini(stat(s.id, r.o.id))}${esc(s.full_name)}${inPlan(s.id, r.o.id) ? " · in plan" : ""}</button>`).join("")}</div>
      ${r.o.step ? `<p class="note" style="margin:10px 0 0">Next step: ${esc(r.o.step)}</p>` : ""}
      <div style="margin-top:10px"><button class="btn ghost small" data-gpgroup="${r.o.id}">Add to ${r.below.length === 1 ? "this student’s" : "these students’"} progress plan${r.below.length === 1 ? "" : "s"}</button></div></div>`; });
    ctx.el.innerHTML = head + h;
  }
  async function addGroup(oid) {
    const t = ui.term, list = visible().filter(s => isGap(stat(s.id, oid))); let o = null, nm = "";
    strands().forEach(([sb, st]) => st.cols.forEach(c => { if (c.type !== "objectives") return; for (let ti = 0; ti <= t; ti++) objs(c, ti).forEach(x => { if (x.id === oid) { o = x; nm = sname(sb, st); } }); }));
    if (!o) return; let n = 0;
    for (const s of list) { const p = planOf(s.id), cur = p ? p.objectives.slice() : [];
      if (cur.some(x => x.obj_id === oid)) continue; cur.push({ obj_id: oid, start: stat(s.id, oid), text: o.text, nm });
      const ends = p ? p.ends : isoDay(new Date(Date.now() + 28 * 864e5)); if (await savePlan(s.id, cur, ends, p ? p.note : "")) n++; }
    render(); const el = document.getElementById("shSave"); if (el && !planErr) el.textContent = n ? `Added to ${n} progress plan${n === 1 ? "" : "s"}` : "Already in their plans";
  }
  const lvRange = band => { const r = C.scale.filter((x, i) => C.gradePos[i] === band); return r.length > 1 ? `${r[0]}–${r[r.length - 1]}` : (r[0] || ""); };
  const allLbl = () => useLv() ? esc(osOf(defCode()).label) : esc(osOf(defCode()).label.toLowerCase());
  const usePick = () => OS().length > 3;
  const termObjs = (tc, t) => { const o = []; tc.forEach(c => { if (c.type === "objectives") objs(c, t).forEach(x => o.push(x)); }); return o; };
  const PREF = () => "tn-sheet-" + (cls && cls.id);
  function savePrefs() { try { localStorage.setItem(PREF(), JSON.stringify({ sub: ui.sub, strand: ui.strand, term: ui.term, mode: ui.mode, view: ui.view, more: ui.more })); } catch (e) { } }
  function loadPrefs() { try { const p = JSON.parse(localStorage.getItem(PREF()) || "null"); if (p) Object.assign(ui, p); } catch (e) { } }
  function addCss() {
    if (document.getElementById("tnSheetCss")) return; const st = document.createElement("style"); st.id = "tnSheetCss";
    st.textContent = `#tnPick{position:fixed;z-index:1000;display:flex;gap:6px;align-items:center;flex-wrap:wrap;max-width:calc(100vw - 16px);background:var(--card);border:1px solid var(--line);border-radius:14px;padding:8px;box-shadow:0 8px 24px rgba(0,0,0,.18)}
.dot.pick{width:40px;height:40px;font-size:15px;color:var(--ink)}.dot.pick.s,.dot.pick.e{color:#fff}.dot.pick.n{color:var(--amber)}
.marks{display:flex;gap:6px;flex-wrap:wrap;align-items:center}.chiprow{display:flex;gap:6px;flex-wrap:wrap;margin:8px 0}
.onelist{width:100%;border-collapse:collapse}.onelist td{padding:10px 6px;border-bottom:1px solid var(--line);vertical-align:middle}
.seg{display:inline-flex;border:1px solid var(--line);border-radius:999px;overflow:hidden}.seg button{border:0;background:var(--card);padding:7px 14px;font-weight:700;cursor:pointer;color:var(--ink)}.seg button[aria-pressed="true"]{background:var(--plum);color:#fff}
.onehead h2{font-size:19px;line-height:1.4;margin:12px 0 10px}
.dot.l1,.b-l1{background:#B4473A;border:2px solid #B4473A;color:#fff}.dot.l2,.b-l2{background:#C8623A;border:2px solid #C8623A;color:#fff}.dot.l3,.b-l3{background:#C98A1E;border:2px solid #C98A1E;color:#fff}
.dot.l4,.b-l4{background:#7FA052;border:2px solid #7FA052;color:#fff}.dot.l5,.b-l5{background:#4F7A47;border:2px solid #4F7A47;color:#fff}.dot.l6,.b-l6{background:#7A5A98;border:2px solid #7A5A98;color:#fff}.dot.l7,.b-l7{background:#462D5B;border:2px solid #462D5B;color:#fff}
dialog#tnGaps{border:0;border-radius:18px;padding:0;width:min(860px,95vw);max-height:92vh;background:var(--bg);color:var(--ink)}dialog#tnGaps::backdrop{background:rgba(40,25,60,.45)}
@media (max-width:700px){dialog#tnGaps{width:100vw;max-width:100vw;max-height:100vh;height:100vh;border-radius:0;margin:0}}
.gapbtn{border:0;background:none;padding:0;cursor:pointer}.gapbtn .badge{text-decoration:underline;text-underline-offset:2px}
.gaprow{padding:10px 0;border-bottom:1px solid var(--line)}.gapchk{display:flex;gap:10px;align-items:flex-start;cursor:pointer}.gapchk input{width:20px;height:20px;margin-top:2px;flex:none}
.gpfoot{position:sticky;bottom:0;box-shadow:0 -6px 18px rgba(0,0,0,.08)}
.dot.pick.l1,.dot.pick.l2,.dot.pick.l3,.dot.pick.l4,.dot.pick.l5,.dot.pick.l6,.dot.pick.l7{color:#fff}`;
    document.head.appendChild(st);
  }
  function closePick() { const d = document.getElementById("tnPick"); if (d) d.remove(); }
  function openPick(btn) {
    closePick(); const [sid, oid] = btn.dataset.cell.split("|"), v = stat(sid, oid), d = document.createElement("div");
    d.id = "tnPick"; d.setAttribute("role", "dialog"); d.setAttribute("aria-label", "Choose a level");
    d.innerHTML = OS().map(x => `<button class="dot pick ${v === x.code ? dotCls(x.code) : ""}" data-pk="${sid}|${oid}|${x.code}" aria-pressed="${v === x.code}" title="${esc(x.label)}" aria-label="${esc(x.label)}">${esc(x.short)}</button>`).join("") + `<button class="mini" data-pk="${sid}|${oid}|">Clear</button>`;
    document.body.appendChild(d); const r = btn.getBoundingClientRect(), w = d.offsetWidth, hh = d.offsetHeight;
    d.style.left = Math.max(8, Math.min(r.left + r.width / 2 - w / 2, innerWidth - w - 8)) + "px";
    d.style.top = (r.bottom + hh + 8 > innerHeight ? Math.max(8, r.top - hh - 6) : r.bottom + 6) + "px";
    (d.querySelector('[aria-pressed="true"]') || d.querySelector("button")).focus({ preventScroll: true });
  }
  function markTaught(oid) { if (TAUGHT.has(oid)) return; TAUGHT.add(oid); document.querySelectorAll(`[data-taught="${oid}"]`).forEach(x => x.checked = true); run(ctx.sb.from("taught").upsert({ class_id: cls.id, obj_id: oid })); }
  function setMark(sid, oid, nx) {
    (ST[sid] = ST[sid] || {}); if (nx) ST[sid][oid] = nx; else delete ST[sid][oid];
    if (nx) markTaught(oid);
    const lbl = nx ? osOf(nx).label : "Not assessed";
    document.querySelectorAll(`[data-cell="${sid}|${oid}"]`).forEach(b => { b.className = "dot " + dotCls(nx); b.innerHTML = dotTxt(nx); b.title = lbl; b.setAttribute("aria-label", b.getAttribute("aria-label").replace(/: [^:]*$/, ": " + lbl.toLowerCase())); });
    document.querySelectorAll(`[data-set^="${sid}|${oid}|"]`).forEach(b => { const c = b.dataset.set.split("|")[2]; if (!c) { b.disabled = !nx; return; } const on = c === nx; b.className = "dot pick " + (on ? dotCls(c) : ""); b.setAttribute("aria-pressed", on); });
    refreshRow(sid);
    run(nx ? ctx.sb.from("objective_status").upsert({ student_id: sid, obj_id: oid, status: nx }) : ctx.sb.from("objective_status").delete().eq("student_id", sid).eq("obj_id", oid));
  }
  function markAll(oid) {
    markTaught(oid); const rows = visible().filter(s => !stat(s.id, oid)).map(s => ({ student_id: s.id, obj_id: oid, status: defCode() }));
    rows.forEach(r => (ST[r.student_id] = ST[r.student_id] || {})[oid] = r.status); render();
    if (rows.length) run(ctx.sb.from("objective_status").upsert(rows));
  }

  function render() {
    closePick();
    const subs = C.subjects; if (!subs.find(s => s.id === ui.sub)) ui.sub = subs[0]?.id;
    const sb = subs.find(s => s.id === ui.sub); if (!sb) { ctx.el.innerHTML = `<div class="card"><p>No subjects are set up yet.</p></div>`; return; }
    if (!sb.strands.find(s => s.id === ui.strand)) ui.strand = sb.strands[0]?.id;
    if (!(ui.term >= 0 && ui.term < C.terms.length)) ui.term = 0;
    if (!["strand", "overview", "gaps", "reports"].includes(ui.mode)) ui.mode = "strand";
    if (role() === "checker") ui.mode = "reports";
    const [, st] = findStrand(ui.strand), t = ui.term, k = String(t);
    const bc = st.cols.filter(c => c.baseline), tc = st.cols.filter(c => !c.baseline);
    let n = 0; tc.forEach(c => { n += c.type === "objectives" ? objs(c, t).length : 1; });
    savePrefs();
    const tabs = role() === "checker" ? [["reports", "Report comments"]] : [["strand", "Assess"], ["overview", "Overview"], ["gaps", "Gaps"], ["reports", "Report comments"]];
    const sel = (id, label, opts, cur) => `<label class="fl" for="${id}">${label}</label><select id="${id}" class="fsel">${opts.map(([v, l]) => `<option value="${esc(v)}" ${String(v) === String(cur) ? "selected" : ""}>${esc(l)}</option>`).join("")}</select>`;
    let h = `<div class="crumb"><button class="crumbbtn" data-sh="back">${esc(ctx.crumb || "My classes")}</button> <span aria-hidden="true">›</span> ${esc(cls.name)}</div>
      <div class="phead"><div><h1 class="ptitle">${ctx.siblings && ctx.siblings.length > 1 ? `<select id="shCls" aria-label="Switch class" class="titlesel">${ctx.siblings.map(x => `<option value="${x.id}" ${x.id === cls.id ? "selected" : ""}>${esc(x.name)}</option>`).join("")}</select>` : esc(cls.name)}</h1>
        <p class="psub">${esc(ctx.gradeName || "")}${ctx.gradeName ? ", " : ""}${studs.length} student${studs.length === 1 ? "" : "s"}${ctx.subjects ? ` · <span class="tag">${esc(C.subjects.map(x => x.name).join(", "))}</span>` : ""}</p></div>
        <div class="row">${role() === "checker" ? "" : `<button class="btn ghost small" data-sh="upload">Upload results</button>`}<span class="note" id="shSave">All changes saved</span></div></div>
      <div class="tabs2" role="tablist">${tabs.map(([m, l]) => `<button role="tab" data-mode="${m}" aria-selected="${ui.mode === m}">${l}</button>`).join("")}</div>
      <div class="fbar">${sel("shTerm", "Term", C.terms.map((x, i) => [i, x]), t)}${sel("shGrp", "Students", [["All", "All students"], ...(C.groups || []).map(g => [g, g])], ui.group)}</div>`;
    if (ui.mode === "strand") {
      h += `<div class="chiprow" role="group" aria-label="Subject">${subs.map(x => `<button class="chip" data-psub="${x.id}" aria-pressed="${x.id === ui.sub}">${esc(x.name)}</button>`).join("")}</div>`;
      if (sb.strands.length > 1) h += `<div class="chiprow" role="group" aria-label="Strand">${sb.strands.map(x => `<button class="chip" data-pstr="${x.id}" aria-pressed="${x.id === ui.strand}" style="font-size:13px;padding:5px 11px">${esc(x.name)}</button>`).join("")}</div>`;
      h += `<div class="row" style="margin:6px 0 10px;gap:10px;flex-wrap:wrap"><div class="seg" role="group" aria-label="How to assess"><button data-view="grid" aria-pressed="${ui.view !== "one"}">Whole class grid</button><button data-view="one" aria-pressed="${ui.view === "one"}">One objective at a time</button></div>
        ${ui.view !== "one" ? `<button class="mini" data-more="1" aria-pressed="${!!ui.more}">${ui.more ? "Hide" : "Show"} baseline and teacher levels</button>` : ""}</div>`;
    }
    h += `<div class="legend"><span><i class="dot" style="width:18px;height:18px"></i>Not assessed</span>${OS().map(x => `<span><i class="dot ${dotCls(x.code)}" style="width:18px;height:18px;font-size:10px">${esc(x.short)}</i>${esc(x.label)}</span>`).join("")}<span>${usePick() ? "Tap a circle to choose a level" : "Tap a circle to change it"}</span>${useLv() ? "" : `<span>Levels ${["below", "inline", "above"].filter(lvRange).map(b => badge(b, esc(lvRange(b)))).join(" ")}</span>`}</div>`;
    if (!studs.length) { ctx.el.innerHTML = h + `<div class="card"><p class="note">This class has no students yet. The school lead adds them in Classes and students.</p></div>`; return; }
    if (ui.mode === "overview") return renderOverview(h.replace(/<div class="legend">[\s\S]*$/, ""));
    if (ui.mode === "reports") return renderReports(h.replace(/<div class="legend">[\s\S]*$/, ""));
    if (ui.mode === "gaps") return renderClassGaps(h.replace(/<div class="legend">[\s\S]*$/, ""));
    if (ui.view === "one") return renderOne(h, tc, t);
    const more = !!ui.more;
    let th = `<thead><tr><th class="namecol"></th>${more ? `<th class="grp" colspan="${bc.length + 1}">Baseline</th>` : ""}<th class="grp" colspan="${n || 1}">${esc(C.terms[t])}</th><th class="grp" colspan="${more ? 3 : 1}">${more ? "Summary" : "Level"}</th></tr><tr><th class="namecol">Student</th>`;
    if (more) { bc.forEach(c => th += `<th class="colh"><b>${esc(c.name)}</b>${hint(c)}</th>`); th += `<th class="colh"><b>Baseline level</b>${baseIsLv(st) ? "from the assessment" : "scale"}</th>`; }
    tc.forEach(c => { if (c.type === "objectives") objs(c, t).forEach(o => { const tg = TAUGHT.has(o.id);
      th += `<th class="obj"><span class="t">${esc(o.text)}</span><label><input type="checkbox" data-taught="${o.id}" ${tg ? "checked" : ""}> Taught</label><button class="mini" data-all="${o.id}">Mark all ${allLbl()}</button></th>`; });
      else th += `<th class="colh"><b>${esc(c.name)}</b>${hint(c)}</th>`; });
    if (!n) th += `<th class="note" style="max-width:220px;white-space:normal">Nothing to assess in ${esc(C.terms[t])} yet</th>`;
    th += `<th>Level</th>${more ? `<th class="colh"><b>Teacher level</b>Auto shows the suggestion</th><th>Progress from baseline</th>` : ""}</tr></thead><tbody>`;
    visible().forEach(s => { const sm = summary(s, st);
      th += `<tr><td class="namecol"><button class="name" data-prof="${s.id}">${esc(s.full_name)}</button>${s.student_number ? `<span class="sid">${esc(s.student_number)}</span>` : ""}<div class="tags">${(s.groups || []).map(g => `<span class="tag">${esc(g)}</span>`).join("")}</div></td>`;
      if (more) { bc.forEach(c => th += `<td>${cell(s, c, "b")}</td>`);
        th += baseIsLv(st) ? `<td id="bl-${s.id}">${lvBadge(level(s.id, st, "b")) || badge("none", "–")}</td>` : `<td><select class="lv" data-lv="${s.id}|${st.id}|b" aria-label="Baseline level for ${esc(s.full_name)}">${lvOpts(s, st, "b")}</select></td>`; }
      tc.forEach(c => { if (c.type === "objectives") objs(c, t).forEach(o => { const v = stat(s.id, o.id);
        th += `<td><button class="dot ${dotCls(v)}" data-cell="${s.id}|${o.id}" title="${esc(v ? osOf(v).label : "Not assessed")}" aria-label="${esc(s.full_name)}, ${esc(o.text)}: ${esc(v ? osOf(v).label.toLowerCase() : "not assessed")}">${dotTxt(v)}</button></td>`; });
        else th += `<td>${cell(s, c, k)}</td>`; });
      if (!n) th += `<td></td>`;
      th += `<td id="pos-${s.id}">${sm.pos}</td>${more ? `<td><select class="lv" data-lv="${s.id}|${st.id}|${k}" aria-label="Teacher level for ${esc(s.full_name)}">${lvOpts(s, st, k)}</select></td><td id="prog-${s.id}">${sm.prog}</td>` : ""}</tr>`; });
    const noObj = tc.some(c => c.type === "objectives" && !objs(c, t).length);
    ctx.el.innerHTML = h + `<div class="sheetwrap"><table class="sheet">${th}</tbody></table></div>
      <p class="note">Tap a circle to record. The objective is ticked as taught for you, and everything saves as you go.${!n ? ` This strand has no objectives or tests for ${esc(C.terms[t])} yet, so there is nothing to record here. The school lead adds objectives in Setup, step 6 (Curriculum objectives).` : noObj ? ` Some objective columns have no objectives for ${esc(C.terms[t])} yet. The school lead adds them in Setup, step 6 (Curriculum objectives).` : ""}</p>`;
  }
  function renderOne(h, tc, t) {
    const list = termObjs(tc, t); if (!(ui.oi >= 0 && ui.oi < list.length)) ui.oi = 0;
    if (!list.length) { ctx.el.innerHTML = h + `<div class="card"><p class="note">There are no objectives for this strand and term yet. The school lead adds them in School setup, step 6. Scores and tests are entered in the whole class grid.</p></div>`; return; }
    const o = list[ui.oi], tg = TAUGHT.has(o.id);
    let b = `<div class="card onehead"><div class="row" style="justify-content:space-between;align-items:center;flex-wrap:wrap;gap:8px">
        <button class="btn ghost small" data-onav="-1" ${ui.oi ? "" : "disabled"}>‹ Previous</button>
        <select id="oneJump" class="fsel" aria-label="Go to objective">${list.map((x, i) => `<option value="${i}" ${i === ui.oi ? "selected" : ""}>Objective ${i + 1} of ${list.length}</option>`).join("")}</select>
        <button class="btn ghost small" data-onav="1" ${ui.oi < list.length - 1 ? "" : "disabled"}>Next ›</button></div>
      <h2>${esc(o.text)}</h2>
      <div class="row" style="gap:14px;flex-wrap:wrap;align-items:center"><button class="btn small" data-all="${o.id}">Mark everyone ${allLbl()}</button><label><input type="checkbox" data-taught="${o.id}" ${tg ? "checked" : ""}> Taught</label><span class="note">Then change the students who are different.</span></div></div>
      <div class="card"><table class="onelist">`;
    visible().forEach(s => { const v = stat(s.id, o.id);
      b += `<tr><td class="namecol"><button class="name" data-prof="${s.id}">${esc(s.full_name)}</button><div class="tags">${(s.groups || []).map(g => `<span class="tag">${esc(g)}</span>`).join("")}</div></td>
        <td><div class="marks" role="group" aria-label="${esc(s.full_name)}">${OS().map(x => `<button class="dot pick ${v === x.code ? dotCls(x.code) : ""}" data-set="${s.id}|${o.id}|${x.code}" aria-pressed="${v === x.code}" title="${esc(x.label)}" aria-label="${esc(x.label)}">${esc(x.short)}</button>`).join("")}<button class="mini" data-set="${s.id}|${o.id}|" ${v ? "" : "disabled"}>Clear</button></div></td></tr>`; });
    ctx.el.innerHTML = h + b + `</table></div><p class="note">Scores and tests are entered in the whole class grid.</p>`;
  }
  function refreshRow(sid) {
    const [, st] = findStrand(ui.strand), s = studs.find(x => x.id === sid), sm = summary(s, st);
    const p = document.getElementById("pos-" + sid), g = document.getElementById("prog-" + sid), bl = document.getElementById("bl-" + sid); if (bl) bl.innerHTML = lvBadge(level(sid, st, "b")) || badge("none", "–"); if (p) p.innerHTML = sm.pos; if (g) g.innerHTML = sm.prog;
    document.querySelectorAll(`[data-lv^="${sid}|"]`).forEach(el => { if (document.activeElement !== el) el.innerHTML = lvOpts(s, st, el.dataset.lv.split("|")[2]); });
  }

  async function onClick(e) {
    if (!e.target.closest("#tnPick") && !e.target.closest("[data-cell]")) closePick();
    const t = e.target.closest("button"); if (!t || !ctx || !(ctx.el.contains(t) || t.closest("#tnProfile") || t.closest("#tnEditor") || t.closest("#tnPick") || t.closest("#tnGaps"))) return;
    if (t.dataset.gaps) return openGaps(t.dataset.gaps);
    if (t.dataset.grc) { const [sid, oid, code] = t.dataset.grc.split("|"); setMark(sid, oid, code); renderGaps(); if (ui.mode === "overview" || ui.mode === "gaps") render(); return; }
    if (t.dataset.gpgroup) return addGroup(t.dataset.gpgroup);
    if (t.dataset.gpdone) { const sid = ui.gsid, p = planOf(sid); if (!p) return; if (t.dataset.gpdone === "ended" && !confirm("Remove this progress plan?")) return;
      if (await run(ctx.sb.from("progress_plans").update({ status: t.dataset.gpdone === "complete" ? "completed" : "ended", updated_at: new Date().toISOString() }).eq("id", p.id))) { delete PLANS[sid]; ui.gsel = new Set(); } renderGaps(); return render(); }
    if (t.dataset.gpsave) { const sid = ui.gsid, len = document.getElementById("gpLen").value, end = len === "keep" && planOf(sid) ? planOf(sid).ends : len === "date" ? document.getElementById("gpEnd").value : isoDay(new Date(Date.now() + +len * 7 * 864e5));
      if (!end) { alert("Choose an end date for the plan."); return; } const { open } = gapList(sid, ui.term), p = planOf(sid), byId = {};
      open.forEach(it => byId[it.o.id] = { obj_id: it.o.id, start: it.v, text: it.o.text, nm: it.nm }); if (p) p.objectives.forEach(x => { if (!byId[x.obj_id]) byId[x.obj_id] = x; else byId[x.obj_id].start = x.start; });
      const objectives = [...ui.gsel].map(id => byId[id]).filter(Boolean);
      if (await savePlan(sid, objectives, end, document.getElementById("gpNote").value.trim())) { renderGaps(); render(); } else renderGaps(); return; }
    if (t.dataset.pk !== undefined) { const [sid, oid, code] = t.dataset.pk.split("|"); closePick(); setMark(sid, oid, code); const c = ctx.el.querySelector(`[data-cell="${sid}|${oid}"]`); if (c) c.focus({ preventScroll: true }); return; }
    if (t.dataset.set !== undefined) { const [sid, oid, code] = t.dataset.set.split("|"); return setMark(sid, oid, code); }
    if (t.dataset.psub) { ui.sub = t.dataset.psub; ui.strand = null; ui.oi = 0; return render(); }
    if (t.dataset.pstr) { ui.strand = t.dataset.pstr; ui.oi = 0; return render(); }
    if (t.dataset.view) { ui.view = t.dataset.view; return render(); }
    if (t.dataset.more) { ui.more = !ui.more; return render(); }
    if (t.dataset.onav) { ui.oi = (ui.oi || 0) + +t.dataset.onav; render(); window.scrollTo(0, 0); return; }
    if (t.dataset.pclose) return t.closest("dialog").close();
    if (t.dataset.print) return printReports([studs.find(x => x.id === t.dataset.print)]);
    if (t.dataset.rp) { t.disabled = true; try { await reportAction(t.dataset.rp, t); } finally { t.disabled = false; } return; }
    if (t.dataset.rv) { ui.rview = t.dataset.rv; return render(); }
    if (t.dataset.ropen) { ui.ropen = ui.ropen === t.dataset.ropen ? null : t.dataset.ropen; render(); const el = document.getElementById("rc-" + t.dataset.ropen.replace("|", "-")); if (el) el.scrollIntoView({ block: "nearest" }); return; }
    if (t.dataset.rgo) { const [v, a, b] = t.dataset.rgo.split("|"); ui.rview = v; if (v === "student") ui.rstud = a; else { ui.rstrand = a; if (b) ui.ropen = `${b}|${a}`; } render(); if (v === "subject" && b) focusCard(b, a); return; }
    if (t.dataset.rstep) { const vs = visible(), i = vs.findIndex(x => x.id === ui.rstud) + +t.dataset.rstep; if (vs[i]) { ui.rstud = vs[i].id; render(); window.scrollTo(0, 0); } return; }
    if (t.dataset.rc) { t.disabled = true; try { await cardAction(t.dataset.rc, t.dataset.k); } finally { t.disabled = false; } return; }
    if (t.dataset.pstrand) { ui.pStrand = t.dataset.pstrand; return openProfile(ui.pid); }
    if (t.dataset.sh === "back") return ctx.back();
    if (t.dataset.sh === "upload") {
      const st = findStrand(ui.strand)[1], first = st && st.cols.find(c => !["objectives", "comment"].includes(c.type));
      return TNResults.open({ sb: ctx.sb, C, scopeText: `For ${cls.name}. Rows for students in other classes are ignored.`, limitClass: cls.name,
        students: studs.map(x => ({ ...x, class_name: cls.name })), colId: first ? first.id : null, term: first && first.baseline ? "b" : String(ui.term),
        existing: (sid, cid, k) => val(sid, cid, k),
        onDone: async n => { await load(); render(); ctx.el.insertAdjacentHTML("afterbegin", `<div class="msg ok" style="margin-bottom:10px">Saved ${n} result${n === 1 ? "" : "s"}.</div>`); } });
    }
    if (t.dataset.mode) { ui.mode = t.dataset.mode; return render(); }
    if (t.dataset.prof) { ui.pStrand = null; return openProfile(t.dataset.prof); }
    if (t.dataset.term) { ui.term = +t.dataset.term; return render(); }
    if (t.dataset.grp) { ui.group = t.dataset.grp; return render(); }
    if (t.dataset.cell) {
      if (usePick()) { if (document.getElementById("tnPick") && document.getElementById("tnPick").dataset.for === t.dataset.cell) return closePick(); openPick(t); document.getElementById("tnPick").dataset.for = t.dataset.cell; return; }
      const [sid, oid] = t.dataset.cell.split("|"); return setMark(sid, oid, cycle(stat(sid, oid)));
    }
    if (t.dataset.all) return markAll(t.dataset.all);
  }
  async function onChange(e) {
    const t = e.target; if (!ctx || !(ctx.el.contains(t) || (t.closest && (t.closest("#tnProfile") || t.closest("#tnGaps"))))) return;
    if (t.dataset.gsel) { t.checked ? ui.gsel.add(t.dataset.gsel) : ui.gsel.delete(t.dataset.gsel); const c = document.getElementById("gpCount"), b = document.querySelector("[data-gpsave]"); if (c) c.textContent = ui.gsel.size + " selected"; if (b) b.disabled = !ui.gsel.size; return; }
    if (t.id === "gpLen") { ui.glen = t.value; const w = document.getElementById("gpEndW"); if (w) w.style.display = t.value === "date" ? "" : "none"; return; }
    if (t.id === "shCls") { const nc = ctx.siblings.find(x => x.id === t.value); return TNSheet.open(Object.assign({}, ctx, { cls: nc })); }
    if (t.id === "rvStrand") { ui.rstrand = t.value; return render(); }
    if (t.id === "rvStud") { ui.rstud = t.value; return render(); }
    if (t.dataset.rlv) { const [sid, stid] = t.dataset.rlv.split("|"), k = String(ui.term), m = ((LV[sid] = LV[sid] || {})[stid] = (LV[sid] || {})[stid] || {});
      if (t.value === "") delete m[k]; else m[k] = +t.value;
      await run(t.value === "" ? ctx.sb.from("student_levels").delete().eq("student_id", sid).eq("strand_id", stid).eq("term", k) : ctx.sb.from("student_levels").upsert({ student_id: sid, strand_id: stid, term: k, level: +t.value }));
      if (cmt(k, sid, stid)) await upC(sid, stid, { level: t.value === "" ? null : +t.value }); render(); return focusCard(sid, stid); }
    if (t.dataset.rpg) { const [sid, stid] = t.dataset.rpg.split("|"); await upC(sid, stid, { progress: t.value || null }); render(); return focusCard(sid, stid); }
    if (t.dataset.rtx) { const [sid, stid] = t.dataset.rtx.split("|"), c = cmt(String(ui.term), sid, stid); if (!c || c.text !== t.value.trim()) await upC(sid, stid, { text: t.value.trim() }); return; }
    if (t.dataset.rns || t.dataset.pns) { const [sid, stid] = (t.dataset.rns || t.dataset.pns).split("|"), k = String(ui.term), v = t.value.trim(), st = findStrand(stid)[1];
      const m = ((NS[k] = NS[k] || {})[sid] = (NS[k] || {})[sid] || {}); if (!v || v === nsAuto(sid, st, ui.term)) { delete m[stid]; return run(ctx.sb.from("next_steps").delete().eq("student_id", sid).eq("strand_id", stid).eq("term", k)); }
      m[stid] = v; return run(ctx.sb.from("next_steps").upsert({ student_id: sid, strand_id: stid, term: k, text: v })); }
    if (t.id === "shTerm") { ui.term = +t.value; return render(); }
    if (t.id === "shGrp") { ui.group = t.value; return render(); }
    if (t.id === "shSub") { ui.sub = t.value; ui.strand = null; return render(); }
    if (t.id === "oneJump") { ui.oi = +t.value; return render(); }
    if (t.id === "shStr") { ui.strand = t.value; return render(); }
    if (t.dataset.taught) {
      const oid = t.dataset.taught; if (t.checked) TAUGHT.add(oid); else TAUGHT.delete(oid); render();
      run(t.checked ? ctx.sb.from("taught").upsert({ class_id: cls.id, obj_id: oid }) : ctx.sb.from("taught").delete().eq("class_id", cls.id).eq("obj_id", oid)); return;
    }
    if (t.dataset.v) {
      const [sid, cid, k] = t.dataset.v.split("|"), c = findCol(cid); let v = t.value.trim();
      const m = ((R[sid] = R[sid] || {})[cid] = (R[sid] || {})[cid] || {}); if (v === "") delete m[k]; else m[k] = v;
      const ev = colEval(sid, c, k); t.classList.remove("tb", "ti", "ta"); if (ev) t.classList.add(["tb", "ti", "ta"][ev.band + 1]);
      refreshRow(sid);
      run(v === "" ? ctx.sb.from("results").delete().eq("student_id", sid).eq("col_id", cid).eq("term", k) : ctx.sb.from("results").upsert({ student_id: sid, col_id: cid, term: k, value: v })); return;
    }
    if (t.dataset.lv) {
      const [sid, stid, k] = t.dataset.lv.split("|"), m = ((LV[sid] = LV[sid] || {})[stid] = (LV[sid] || {})[stid] || {});
      if (t.value === "") delete m[k]; else m[k] = +t.value; refreshRow(sid);
      run(t.value === "" ? ctx.sb.from("student_levels").delete().eq("student_id", sid).eq("strand_id", stid).eq("term", k) : ctx.sb.from("student_levels").upsert({ student_id: sid, strand_id: stid, term: k, level: +t.value }));
    }
  }

  document.addEventListener("input", e => { const t = e.target; if (!t.dataset || !t.dataset.rtx) return; const n = t.value.trim().length, lim = (C.reports || {}).limit || 600, el = document.getElementById("rn-" + t.dataset.rtx);
    if (el) { el.textContent = `${n} / ${lim}`; el.style.color = n > lim ? "var(--red)" : ""; el.style.fontWeight = n > lim ? "800" : ""; }
    const b = document.querySelector(`[data-rc="send"][data-k="${t.dataset.rtx}"]`); if (b) b.disabled = !n || n > lim; });
  window.TNSheet = {
    async open(context) {
      ctx = context; cls = ctx.cls; pending = 0; addCss(); closePick(); Object.assign(ui, { mode: "strand", view: "grid", more: false, oi: 0 }); loadPrefs();
      if (ctx.mode) ui.mode = ctx.mode; if (ctx.role === "checker") ui.mode = "reports";
      if (!bound) { document.addEventListener("click", onClick); document.addEventListener("change", onChange); document.addEventListener("keydown", e => { if (e.key === "Escape") closePick(); }); window.addEventListener("scroll", closePick, { passive: true }); bound = true; }
      ctx.el.innerHTML = `<div class="card"><p class="note">Loading ${esc(cls.name)}…</p></div>`;
      try { await load(); render(); } catch (err) { ctx.el.innerHTML = `<div class="card"><div class="msg err">${esc(err.message || err)}</div><p><button class="btn ghost" data-sh="back">← Back</button></p></div>`; }
    },
    close() { ctx = null; }
  };
})();
