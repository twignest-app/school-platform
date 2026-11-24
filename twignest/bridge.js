/* ThinkNest platforms → Nestopia (Whole Nest schools)
   Reads a summary from Maths Quest, Science Quest and Spelling Bee and matches it to the school's own curriculum objectives.
   Nothing is saved here: teachers decide what to record. */
(function () {
  const API = { url: "https://xpbkdnkfufkahaszfycd.supabase.co", key: "sb_publishable_QIAV_9tLUBbDCu7FHqaTEw_zYQ0teEG" };
  const SQY = { kg2: 1, g1: 2, g2: 3, g3: 4, g4: 5, g5: 6 };
  const P = {
    maths_quest: { label: "Maths Quest", icon: "🧮", rpc: "nest_bridge_mq", nc: "mq-nc.json", subj: /math|numeracy/i,
      own: (k, NC, g) => +k.split("-")[0] === +g },                      // keys look like 2-NI-1: grade first
    science_quest: { label: "Science Quest", icon: "🔬", rpc: "nest_bridge_sq", nc: "sq-nc.json", subj: /science/i,
      own: (k, NC, g) => !!NC[k] && NC[k].g === String(g) },            // keys look like y3-pl-1, each tagged with its grade
    spelling_bee: { label: "Spelling Bee", icon: "🐝", rpc: "nest_bridge_sb", nc: "sb-nc.json", subj: /english|literacy/i, strand: /spell|transcription/i,
      own: () => true, prep: x => sbPrep(x) }                           // words are sorted into spelling objectives here
  };
  // Spelling Bee: each word → the spelling objectives it practises, for the child's year (grade 0 = KG2 = Year 1)
  const SUF = new Set(["dbl", "drope", "yi", "ful", "ies", "es", "tion", "sion", "cian", "ture", "sure", "ous", "able", "ance", "cious", "cial", "ly", "ment", "ed", "ing", "pre"]);
  function sbCats(word) {
    const S = window.SPELL; if (!S) return [];
    const w = S.low(word), pats = S.patternRules(w).map(p => p.id), c = new Set();
    if (S.TRICKY.has(w)) c.add("tricky");
    if (S.HOMO.some(g => g.includes(w))) c.add("homo");
    pats.forEach(id => c.add(SUF.has(id) ? (id === "pre" ? "pre" : id === "es" || id === "ies" ? "plural" : id === "ing" || id === "ed" ? "inged" : ["ment", "ful", "ly"].includes(id) ? "mfl" : "suf") : id === "kn" ? "kn" : "gpc"));
    if (!c.size) c.add("none");
    return [...c];
  }
  function sbIdx(g, cat) {
    const y = +g + 1, suf = ["suf", "pre", "plural", "inged", "mfl"].includes(cat);
    if (y === 1) return cat === "plural" ? 5 : cat === "pre" ? 6 : cat === "inged" ? 7 : (suf || cat === "homo") ? 8 : cat === "tricky" ? 1 : 0;
    if (y === 2) return cat === "gpc" || cat === "kn" ? 1 : cat === "mfl" ? 6 : suf ? 7 : cat === "homo" ? 5 : cat === "tricky" ? 2 : 0;
    if (y <= 4) return suf ? 0 : cat === "homo" ? 1 : cat === "none" ? null : 2;
    return suf ? 0 : cat === "kn" ? 1 : cat === "homo" ? 2 : cat === "none" ? null : 3;
  }
  function sbPrep(x) {
    const g = +x.grade, m = {}, add = (word, c, w) => { const ks = new Set(sbCats(word).map(cat => sbIdx(g, cat)).filter(i => i != null).map(i => g + "-" + i));
      ks.forEach(k => { const v = m[k] = m[k] || [0, 0]; v[0] += c; v[1] += w; }); };
    const R = x.right || {}, W = x.wrong || {}, all = new Set([...Object.keys(R), ...Object.keys(W)]);
    all.forEach(word => { const c = Math.max(0, parseInt(R[word]) || 0), w = Math.max(0, parseInt(W[word]) || 0); if (c + w) add(word, c, w); });
    return m;
  }

  const STOP = new Set("the a an and or of to in on for with by from using use including their they them is are be as at that this any given numbers number e g eg".split(" "));
  const toks = t => new Set((String(t || "").toLowerCase().match(/[a-z0-9]+/g) || []).filter(w => !STOP.has(w)).map(w => w.length > 4 && w.endsWith("s") ? w.slice(0, -1) : w));
  const norm = v => String(v ?? "").trim().replace(/^0+(?=\d)/, "").toLowerCase();
  const NCS = {}, maps = new Map();

  async function loadNC(id) { if (!NCS[id]) NCS[id] = await fetch(P[id].nc + "?v=20261124c").then(r => r.json()); return NCS[id]; }

  // Each platform objective is split into its parts; each part goes to the school objective it matches best.
  function mapFor(id, list) {
    const sig = id + "|" + list.map(o => o.id).join(","); if (maps.has(sig)) return maps.get(sig);
    const objT = list.map(o => [o.id, toks(o.text)]), out = {};
    Object.entries(NCS[id] || {}).forEach(([k, v]) => String(v.o).split(";").forEach(part => {
      const a = toks(part); if (a.size < 2) return;
      let best = null, bs = 0; objT.forEach(([oid, b]) => { let h = 0; a.forEach(w => { if (b.has(w)) h++; }); const s = h / a.size; if (s > bs) { bs = s; best = oid; } });
      if (best && bs >= 0.5) (out[best] = out[best] || new Set()).add(k);
    }));
    maps.set(sig, out); return out;
  }

  async function one(id, token, studs) {
    const p = P[id]; let j;
    try {
      const r = await fetch(API.url + "/rest/v1/rpc/" + p.rpc, { method: "POST", headers: { apikey: API.key, Authorization: "Bearer " + API.key, "Content-Type": "application/json" }, body: JSON.stringify({ p_token: token }) });
      j = await r.json(); if (!r.ok) return { id, p, error: p.label + " couldn’t be reached just now." };
    } catch (e) { return { id, p, error: p.label + " couldn’t be reached just now." }; }
    if (j.error) return { id, p, error: j.error === "off" ? p.label + " sharing is switched off for your school." : "The link to " + p.label + " needs setting up again." };
    const NC = await loadNC(id);
    const byNum = {}; studs.forEach(s => { if (s.student_number) byNum[norm(s.student_number)] = s.id; });
    const ev = {}; let linked = 0;
    (j.students || []).forEach(x => {
      const sid = byNum[norm(x.ref)]; if (!sid) return; linked++;
      const m = {}; Object.entries(p.prep ? p.prep(x) : (x.nc || {})).forEach(([k, cw]) => { if (p.own(k, NC, x.grade)) m[k] = cw; });   // their own grade's objectives only
      ev[sid] = { nc: m, last: x.last_seen };
    });
    return { id, p, ev, linked, inClass: studs.length };
  }

  // Returns { maths_quest: {...}, science_quest: {...} } for the platforms this school is linked to
  async function load(sb, cls, studs) {
    const { data, error } = await sb.from("platform_links").select("platform,token,enabled").eq("school_id", String(cls.school_id));
    if (error || !data) return null;
    const links = data.filter(x => x.enabled && P[x.platform]); if (!links.length) return null;
    const res = await Promise.all(links.map(l => one(l.platform, l.token, studs).catch(() => null)));
    const out = {}; res.forEach(r => { if (r) out[r.id] = r; }); return out;
  }

  // Which linked platform fits this subject and strand (Maths → Maths Quest, Science → Science Quest, English spelling → Spelling Bee)
  function forSubject(B, sb, st) {
    if (!B || !sb) return null; const nm = [sb.name, ...(sb.aliases || [])].join(" "), sn = st ? [st.name, ...(st.aliases || [])].join(" ") : "";
    return Object.values(B).find(r => r.p.subj.test(nm) && (!r.p.strand || !st || r.p.strand.test(sn))) || null;
  }
  const subjectMatches = (id, sb) => !!P[id] && P[id].subj.test([sb.name, ...(sb.aliases || [])].join(" "));

  // Right and wrong answers for one child on one school objective (list = all the subject's objectives)
  function forObj(R, sid, oid, list) {
    if (!R || !R.ev || !R.ev[sid] || !NCS[R.id]) return null;
    const keys = mapFor(R.id, list)[oid]; if (!keys) return null;
    let c = 0, w = 0; keys.forEach(k => { const v = R.ev[sid].nc[k]; if (v) { c += +v[0] || 0; w += +v[1] || 0; } });
    return c + w ? { c, w, n: c + w, pct: Math.round(c / (c + w) * 100) } : null;
  }

  window.NestBridge = { load, forSubject, subjectMatches, forObj, wanted: sb => Object.values(P).some(p => p.subj.test([sb.name, ...(sb.aliases || [])].join(" "))) };
})();
