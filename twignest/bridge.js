/* ThinkNest platforms → Nestopia (Whole Nest schools)
   Reads a summary from Maths Quest and matches it to the school's own curriculum objectives.
   Nothing is saved here: teachers decide what to record. */
(function () {
  const MQ = { url: "https://xpbkdnkfufkahaszfycd.supabase.co", key: "sb_publishable_QIAV_9tLUBbDCu7FHqaTEw_zYQ0teEG" };
  const STOP = new Set("the a an and or of to in on for with by from using use including their they them is are be as at that this any given numbers number e g eg".split(" "));
  const toks = t => new Set((String(t || "").toLowerCase().match(/[a-z0-9]+/g) || []).filter(w => !STOP.has(w)).map(w => w.length > 4 && w.endsWith("s") ? w.slice(0, -1) : w));
  const norm = v => String(v ?? "").trim().replace(/^0+(?=\d)/, "").toLowerCase();
  let NC = null;
  const maps = new Map();

  async function loadNC() { if (!NC) NC = await fetch("mq-nc.json?v=20261124").then(r => r.json()); return NC; }

  // Each Maths Quest objective is split into its parts; each part goes to the school objective it matches best.
  function mapFor(list) {
    const sig = list.map(o => o.id).join(","); if (maps.has(sig)) return maps.get(sig);
    const objT = list.map(o => [o.id, toks(o.text)]), out = {};
    Object.entries(NC || {}).forEach(([k, v]) => String(v.o).split(";").forEach(part => {
      const a = toks(part); if (a.size < 2) return;
      let best = null, bs = 0; objT.forEach(([id, b]) => { let h = 0; a.forEach(w => { if (b.has(w)) h++; }); const s = h / a.size; if (s > bs) { bs = s; best = id; } });
      if (best && bs >= 0.5) (out[best] = out[best] || new Set()).add(k);
    }));
    maps.set(sig, out); return out;
  }

  async function load(sb, cls, studs) {
    const { data, error } = await sb.from("platform_links").select("platform,token,enabled").eq("school_id", String(cls.school_id));
    if (error || !data) return null;                                   // not set up: show nothing
    const link = data.find(x => x.platform === "maths_quest" && x.enabled); if (!link) return null;
    let j;
    try {
      const r = await fetch(MQ.url + "/rest/v1/rpc/nest_bridge_mq", { method: "POST", headers: { apikey: MQ.key, Authorization: "Bearer " + MQ.key, "Content-Type": "application/json" }, body: JSON.stringify({ p_token: link.token }) });
      j = await r.json(); if (!r.ok) return { error: "Maths Quest couldn’t be reached just now." };
    } catch (e) { return { error: "Maths Quest couldn’t be reached just now." }; }
    if (j.error) return { error: j.error === "off" ? "Maths Quest sharing is switched off for your school." : "The link to Maths Quest needs setting up again." };
    await loadNC();
    const byNum = {}; studs.forEach(s => { if (s.student_number) byNum[norm(s.student_number)] = s.id; });
    const ev = {}; let linked = 0;
    (j.students || []).forEach(x => {
      const sid = byNum[norm(x.ref)]; if (!sid) return; linked++;
      const m = {}; Object.entries(x.nc || {}).forEach(([k, cw]) => { if (+k.split("-")[0] === +x.grade) m[k] = cw; });   // their own grade's objectives only
      ev[sid] = { nc: m, last: x.last_seen };
    });
    return { ev, linked, inClass: studs.length };
  }

  // Right and wrong answers for one child on one school objective (list = all objectives the strand shows)
  function forObj(B, sid, oid, list) {
    if (!B || !B.ev || !B.ev[sid] || !NC) return null;
    const keys = mapFor(list)[oid]; if (!keys) return null;
    let c = 0, w = 0; keys.forEach(k => { const v = B.ev[sid].nc[k]; if (v) { c += +v[0] || 0; w += +v[1] || 0; } });
    return c + w ? { c, w, n: c + w, pct: Math.round(c / (c + w) * 100) } : null;
  }

  window.NestBridge = { load, forObj };
})();
