/* Nestopia · TwigNest summary for the School hub overview.
   The calculations are copied from twignest/school.js: keep them the same. */
async function twigLoad(sbc, schoolId, onlyIds){
  const set = await sbc.from("school_setups").select("year,config").eq("school_id", schoolId).order("updated_at", { ascending: false }).limit(1);
  const C = set.data && set.data[0] ? set.data[0].config : null; const year = set.data && set.data[0] ? set.data[0].year : null;
  if (!C || !C.subjects || !C.terms) return null;
  let cq = sbc.from("classes").select("*").eq("school_id", schoolId); if (year) cq = cq.eq("year", year);
  const classes = (await cq).data || [];
  const all = async (t, cols, f0) => { const out = []; for (let f = 0; ; f += 1000) { let q = sbc.from(t).select(cols); if (f0) q = f0(q); const { data, error } = await q.range(f, f + 999); if (error) throw error; out.push(...data); if (data.length < 1000) break; } return out; };
  const studs = onlyIds ? await all("students", "id,class_id,archived", q => q.in("id", onlyIds)) : await all("students", "id,class_id,archived", q => q.eq("school_id", schoolId).eq("archived", false));
  const by = q => onlyIds ? q.in("student_id", onlyIds) : q;
  const sIds = new Set(studs.map(s => String(s.id))), R = {}, ST = {}, LV = {}, TG = {};
  (await all("results", "student_id,col_id,term,value", by)).forEach(x => { if (!sIds.has(String(x.student_id))) return; const a = R[x.student_id] = R[x.student_id] || {}; (a[x.col_id] = a[x.col_id] || {})[x.term] = x.value; });
  (await all("objective_status", "student_id,obj_id,status", by)).forEach(x => { if (sIds.has(String(x.student_id))) (ST[x.student_id] = ST[x.student_id] || {})[x.obj_id] = x.status; });
  (await all("student_levels", "student_id,strand_id,term,level", by)).forEach(x => { if (!sIds.has(String(x.student_id))) return; const a = LV[x.student_id] = LV[x.student_id] || {}; (a[x.strand_id] = a[x.strand_id] || {})[x.term] = x.level; });
  (await all("taught", "class_id,obj_id")).forEach(x => (TG[x.class_id] = TG[x.class_id] || new Set()).add(x.obj_id));
  const esc_ = t => String(t ?? ""), clamp = n => Math.max(0, Math.min(1, n));
  const DEF_OS = [{ code: "s", label: "Secure", short: "✓", kind: "secure" }, { code: "n", label: "Not yet secure", short: "!", kind: "notyet" }, { code: "e", label: "Exceeding", short: "+", kind: "exceed" }];
  const OS = () => (C && C.objScale && C.objScale.length ? C.objScale : DEF_OS);
  const osOf = v => OS().find(x => x.code === v) || DEF_OS.find(x => x.code === v) || { code: v, label: v, short: "?", kind: "secure" };
  const credit = v => ({ notyet: 0, partial: .5, secure: 1, exceed: 1 })[osOf(v).kind] ?? 1;
  const isEx = v => osOf(v).kind === "exceed", isGap = v => !!v && credit(v) < 1;
  const _dc = v => v ? ({ notyet: "n", partial: "p", secure: "s", exceed: "e" })[osOf(v).kind] : "";
  const _dt = v => v ? esc_(osOf(v).short) : "";
  const defCode = () => (OS().find(x => x.kind === "secure") || OS()[0]).code;
  const cycle = v => { const order = [defCode(), ...OS().map(x => x.code).filter(c => c !== defCode())], i = order.indexOf(v); return v === "" || i < 0 ? order[0] : (order[i + 1] ?? ""); };
  const strands = () => { const o = []; C.subjects.forEach(sb => sb.strands.forEach(st => o.push([sb, st]))); return o; };
  const clsOf = s => classes.find(c => String(c.id) === String(s.class_id));
  const objsFor = (c, gid, t) => ((c.objectives || {})[gid] || [])[t] || [];
  const val = (sid, cid, k) => ((R[sid] || {})[cid] || {})[k];
  const stat = (sid, oid) => (ST[sid] || {})[oid] || "";
  function levelFromPct(p) { let lv = 0; C.gradeMin.forEach((x, i) => { if (p >= x) lv = i; }); return lv; }
  function colEval(s, c, k) {
    if (c.type === "comment") return null;
    if (c.type === "objectives") {
      if (k === "b") return null; const cl = clsOf(s), tg = TG[cl.id] || new Set(); let a = 0, sec = 0, ex = 0;
      objsFor(c, cl.grade_id, +k).filter(o => tg.has(o.id)).forEach(o => { const v = stat(s.id, o.id); if (v) { a++; sec += credit(v); if (isEx(v)) ex++; } });
      if (!a) return null; const p = sec / a * 100, e = ex / a * 100; return { band: p < c.belowPct ? -1 : (p >= 90 && e >= c.abovePct) ? 1 : 0, norm: clamp(p / 100) };
    }
    const v = val(s.id, c.id, k); if (v === undefined || v === "") return null;
    const pos = C.gradePos, gm = C.gradeMin, iS = (gm[pos.indexOf("inline")] ?? 50) / 100, aS = (gm[pos.indexOf("above")] ?? 90) / 100;
    const piece = (x, lo, hi, ls, hs) => x < lo ? iS * clamp((x - (lo - ls)) / ls) * .999 : x < hi ? iS + (aS - iS) * (x - lo) / (hi - lo) : aS + (1 - aS) * clamp((x - hi) / hs);
    if (c.type === "list") { const i = c.options.indexOf(v); if (i < 0) return null; const n = c.options.length;
      return { band: i < c.below ? -1 : i >= c.above ? 1 : 0, norm: i < c.below ? iS * (i + .5) / c.below : i < c.above ? iS + (aS - iS) * (i - c.below + .5) / (c.above - c.below) : aS + (1 - aS) * (i - c.above + .5) / (n - c.above) }; }
    const n = +v; if (isNaN(n)) return null;
    if (c.type === "standardised") return { band: n < c.below ? -1 : n >= c.above ? 1 : 0, norm: piece(n, c.below, c.above, 30, 15) };
    if (c.type === "readingAge") return { band: n < c.below ? -1 : n > c.above ? 1 : 0, norm: piece(n, c.below, c.above + .0001, 1.5, 1.5) };
    return { band: n < c.below ? -1 : n >= c.above ? 1 : 0, norm: clamp(n / c.max) };
  }
  function strandEval(s, st, k) {
    const ev = st.cols.filter(c => k === "b" ? c.baseline : !c.baseline).map(c => colEval(s, c, k)).filter(Boolean); if (!ev.length) return null;
    const pct = ev.reduce((a, x) => a + x.norm, 0) / ev.length * 100, sug = levelFromPct(pct); return { band: C.gradePos[sug] || "inline", sug };
  }
  function level(s, st, k) { const t = ((LV[s.id] || {})[st.id] || {})[k]; if (t !== undefined && t !== null) return t; const e = strandEval(s, st, k); return e ? e.sug : null; }
  function progress(s, st, t) { const b = level(s, st, "b"), c = level(s, st, String(t)); if (b == null || c == null) return null; const steps = c - b, exp = C.steps * (t + 1) / C.terms.length; return { band: steps < exp - .5 ? "below" : steps > exp + .5 ? "above" : "inline" }; }
  function onTrack(s, st, t) { const b = level(s, st, "b"), c = level(s, st, String(t)); if (b == null || c == null) return null; const max = C.scale.length - 1; return Math.min(max, Math.round(b + (c - b) / (t + 1) * C.terms.length)) >= Math.min(max, b + C.steps); }
  function avgBand(s, list, k) { const bs = list.map(st => strandEval(s, st, k)).filter(Boolean).map(e => ({ below: -1, inline: 0, above: 1 })[e.band]); if (!bs.length) return null; const b = bs.reduce((a, x) => a + x, 0) / bs.length; return b < -.33 ? "below" : b > .33 ? "above" : "inline"; }
  function avgProg(s, list, t) { const ps = list.map(st => progress(s, st, t)).filter(Boolean).map(p => ({ below: -1, inline: 0, above: 1 })[p.band]); if (!ps.length) return null; const b = ps.reduce((a, x) => a + x, 0) / ps.length; return b < -.33 ? "below" : b > .33 ? "above" : "inline"; }


  return { C, classes, studs, strands, avgBand, avgProg, level, progress, strandEval, objsFor, stat, isGap, isEx, clsOf };
}
async function twigSchoolSummary(sbc, schoolId){
  const T = await twigLoad(sbc, schoolId); if (!T) return null;
  const { C, studs, strands, avgBand, avgProg } = T;
  const sts = strands().map(p => p[1]);
  const terms = C.terms.map((name, k) => {
    let a = 0, an = 0, g = 0, gn = 0;
    studs.forEach(s => { const b = avgBand(s, sts, String(k)); if (b) { an++; if (b !== "below") a++; } const pr = avgProg(s, sts, k); if (pr) { gn++; if (pr !== "below") g++; } });
    return { name, attainment: an ? Math.round(a / an * 100) : null, progress: gn ? Math.round(g / gn * 100) : null, n: an };
  });
  return { students: studs.length, terms };
}
