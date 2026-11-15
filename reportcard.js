/* ===== Nestopia report card template =====
   One template used everywhere: School Hub preview, print/PDF, Word download and the Parent Portal.
   Each school changes it in Report cards → Template settings (saved in school_setups.config.card). */
(function () {
  const esc = t => String(t ?? "").replace(/[&<>"]/g, c => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;" }[c]));
  const DEF = {
    title: "Student Progress Report", titleAr: "تقرير تقدّم الطالب", nameAr: "", logo: "",
    color: "#33405A", accent: "#7BB3E6", bilingual: true,
    show: { arabicName: true, studentNumber: true, teachers: true, issued: true, nextTerm: true, attendance: true, late: true, stars: true, key: true, signatures: true, parentAck: true },
    levelStyle: "bar", levelNames: [], subjects: {},
    sig: [{ role: "Class teacher", name: "" }, { role: "Principal", name: "" }],
    footer: "Shared with families on the Nestopia Parent Portal",
    termInfo: {}, parents: "publish", published: {}
  };
  // a school's settings merged over the defaults (keeps working when new options are added later)
  function settings(card) {
    const c = card || {}, out = JSON.parse(JSON.stringify(DEF));
    Object.keys(c).forEach(k => { if (k === "show") Object.assign(out.show, c.show || {}); else if (c[k] !== undefined && c[k] !== null) out[k] = c[k]; });
    if (!Array.isArray(out.sig)) out.sig = DEF.sig;
    return out;
  }
  const mix = (hex, a) => { const h = String(hex || "#33405A").replace("#", ""), n = parseInt(h.length === 3 ? h.replace(/./g, "$&$&") : h, 16);
    if (isNaN(n)) return "#EEF3FA"; const r = n >> 16 & 255, g = n >> 8 & 255, b = n & 255, f = x => Math.round(x * a + 255 * (1 - a));
    return "#" + [f(r), f(g), f(b)].map(x => x.toString(16).padStart(2, "0")).join(""); };

  /* d = { card, scale, subjects, termName, termIndex, year, school, student:{name,arabic,number,cls}, teachers:[], att:{n,in,late}, stars, cm(strandId) → {level,text} } */
  function render(d) {
    const S = settings(d.card), col = S.color || DEF.color, acc = S.accent || DEF.accent, soft = mix(acc, .16), line = "#D9E0EA";
    const scale = d.scale || [], ti = (S.termInfo || {})[d.termIndex] || {};
    const lvName = i => (S.levelNames && S.levelNames[i]) || "";
    const lab = i => i == null || i === "" ? "" : (scale[i] != null ? scale[i] : i);
    const bil = (en, ar, stack) => !(S.bilingual && ar) ? en : stack ? `${en}<br><span lang="ar" dir="rtl" style="font-weight:600;opacity:.8;font-size:.92em;text-transform:none;letter-spacing:0">${ar}</span>`
      : `${en}<span style="opacity:.6"> · </span><span lang="ar" dir="rtl" style="font-weight:600;opacity:.8;text-transform:none;letter-spacing:0">${ar}</span>`;
    const meter = i => { if (i == null || i === "" || S.levelStyle === "hide") return "";
      const n = +i + 1, max = Math.max(scale.length, n), name = lvName(+i);
      if (S.levelStyle === "name") return `<b style="color:${col}">${esc(name || lab(i))}</b>`;
      if (S.levelStyle === "number") return `<b style="color:${col};font-size:15px">${esc(lab(i))}</b>${name ? `<br><span style="font-size:10.5px;color:#56637a;font-weight:700">${esc(name)}</span>` : ""}`;
      return `<b style="color:${col};font-size:15px">${esc(lab(i))}</b><table cellspacing="2" cellpadding="0" style="border-collapse:separate;margin:2px 0 1px -2px"><tr>${Array.from({ length: max }, (_, k) =>
        `<td style="width:10px;height:7px;font-size:1px;line-height:1px;border-radius:2px;background:${k < n ? acc : "#DDE5F0"}">&nbsp;</td>`).join("")}</tr></table>${name ? `<span style="font-size:10.5px;color:#56637a;font-weight:700">${esc(name)}</span>` : ""}`; };
    const cell = "padding:8px 9px;border-bottom:1px solid " + line + ";vertical-align:top;line-height:1.45";

    // header
    let h = `<div class="rc" style="font-family:'Nunito Sans','Nunito','Noto Sans Arabic',Arial,sans-serif;color:#1f2a3d;font-size:12.5px;background:#fff;max-width:794px;margin:0 auto">
      <div style="height:7px;background:${col};border-radius:4px 4px 0 0"></div>
      <table width="100%" cellspacing="0" cellpadding="0" style="border-collapse:collapse;border-bottom:2px solid ${col};margin:14px 0 12px"><tr>
        ${S.logo ? `<td style="width:72px;padding:0 12px 12px 0;vertical-align:middle"><img src="${esc(S.logo)}" alt="" style="max-width:66px;max-height:66px;display:block"></td>` : ""}
        <td style="padding:0 0 12px;vertical-align:middle"><div style="font-family:Poppins,Arial,sans-serif;font-size:20px;font-weight:700;color:${col}">${esc(d.school || "")}</div>${S.bilingual && S.nameAr ? `<div lang="ar" dir="rtl" style="font-size:13px;color:#56637a;text-align:left">${esc(S.nameAr)}</div>` : ""}</td>
        <td style="padding:0 0 12px;text-align:right;vertical-align:middle"><div style="font-family:Poppins,Arial,sans-serif;font-size:17px;font-weight:700;color:${col}">${esc(S.title)}</div>
          <div style="font-size:12.5px;color:#56637a">${S.bilingual && S.titleAr ? `<span lang="ar" dir="rtl">${esc(S.titleAr)}</span> · ` : ""}${esc(d.termName || "")}${d.year ? " · " + esc(d.year) : ""}</div></td></tr></table>`;

    // student details
    const st = d.student || {}, info = [[bil("Student", "الطالب"), esc(st.name) + (S.show.arabicName && st.arabic ? `<span style="color:#8b97ab"> · </span><span lang="ar" dir="rtl" style="color:#56637a;font-weight:600">${esc(st.arabic)}</span>` : "")], [bil("Class", "الصف"), esc(st.cls)]];
    if (S.show.studentNumber && st.number) info.push([bil("Student number", "رقم الطالب"), esc(st.number)]);
    if (S.show.teachers && (d.teachers || []).length) info.push([bil("Teacher", "المعلم"), esc(d.teachers.join(", "))]);
    if (S.show.issued && ti.issued) info.push([bil("Issued", "تاريخ الإصدار"), esc(fmtDate(ti.issued))]);
    if (S.show.nextTerm && ti.next) info.push([bil("Next term starts", "بداية الفصل القادم"), esc(fmtDate(ti.next))]);
    const rows3 = []; for (let k = 0; k < info.length; k += 3) rows3.push(info.slice(k, k + 3));
    h += `<table width="100%" cellspacing="0" cellpadding="0" style="border-collapse:collapse;margin-bottom:10px">${rows3.map(r => `<tr>${r.map(([l, v]) =>
      `<td style="padding:3px 14px 6px 0;vertical-align:top;width:33%"><div style="font-size:10.5px;font-weight:800;color:#5d6a80;text-transform:uppercase;letter-spacing:.04em">${l}</div><div style="font-size:14px;font-weight:800">${v}</div></td>`).join("")}</tr>`).join("")}</table>`;

    // summary boxes
    const a = d.att, tiles = [];
    if (S.show.attendance && a && a.n) tiles.push([bil("Attendance", "الحضور"), Math.round(a.in / a.n * 100) + "%", `${a.in} of ${a.n} days`]);
    if (S.show.late && a && a.n) tiles.push([bil("Punctuality", "الالتزام بالوقت"), String(a.late || 0), (a.late === 1 ? "late arrival" : "late arrivals")]);
    if (S.show.stars && d.stars != null) tiles.push([bil("Stars earned", "النجوم"), String(d.stars), "this school year"]);
    if (tiles.length) h += `<table width="100%" cellspacing="8" cellpadding="0" style="border-collapse:separate;margin:0 -8px 4px"><tr>${tiles.map(([l, b, s]) =>
      `<td style="background:${soft};border-radius:12px;padding:10px 12px;vertical-align:top"><div style="font-size:10.5px;font-weight:800;color:#5d6a80;text-transform:uppercase;letter-spacing:.04em">${l}</div><div style="font-family:Poppins,Arial,sans-serif;font-size:22px;font-weight:700;color:${col}">${esc(b)}</div><div style="font-size:12px;color:#56637a">${esc(s)}</div></td>`).join("")}</tr></table>`;

    // level key
    if (S.show.key && scale.length && S.levelStyle !== "hide") h += `<div style="margin:2px 0 10px;font-size:11.5px;color:#3d4a60"><b style="margin-right:4px">${bil("Levels", "المستويات")}</b> ${scale.map((x, i) =>
      `<span style="display:inline-block;border:1px solid ${line};border-radius:20px;padding:2px 8px;margin:2px 2px"><b style="color:${col}">${esc(x)}</b>${lvName(i) ? " " + esc(lvName(i)) : ""}</span>`).join("")}</div>`;

    // subjects: tables and boxes, in the school's subject order
    let table = "";
    const flush = () => { if (table) h += `<table width="100%" cellspacing="0" cellpadding="0" style="border-collapse:collapse;margin-top:6px"><thead><tr>
        <th style="background:${col};color:#fff;text-align:left;padding:7px 9px;font-size:12px;width:21%">${bil("Area", "المجال", 1)}</th>${S.levelStyle === "hide" ? "" : `<th style="background:${col};color:#fff;text-align:left;padding:7px 9px;font-size:12px;width:15%">${bil("Level", "المستوى", 1)}</th>`}<th style="background:${col};color:#fff;text-align:left;padding:7px 9px;font-size:12px">${bil("Comment", "التعليق", 1)}</th></tr></thead><tbody>${table}</tbody></table>`; table = ""; };
    let any = false;
    (d.subjects || []).forEach(sub => {
      const how = (S.subjects || {})[sub.id] || "table"; if (how === "hide") return;
      const items = (sub.strands || []).map(stx => [stx, d.cm(stx.id)]).filter(([, c]) => c && (c.text || c.level != null)); if (!items.length) return;
      any = true; const rtl = sub.lang === "ar" ? ' dir="rtl" lang="ar"' : "";
      if (how === "box") { flush();
        items.forEach(([stx, c]) => { const title = items.length === 1 ? sub.name : sub.name + " · " + stx.name;
          h += `<div style="border:1px solid ${line};border-radius:12px;padding:12px 14px;margin-top:12px;line-height:1.5;page-break-inside:avoid">
            <div style="font-family:Poppins,Arial,sans-serif;font-size:14px;font-weight:700;color:${col};margin-bottom:5px">${esc(title)}${c.level != null && c.level !== "" && S.levelStyle !== "hide" ? ` <span style="font-family:'Nunito Sans',Arial,sans-serif;font-size:11px;font-weight:800;border-radius:20px;padding:2px 9px;background:${soft};color:${col};margin-left:6px">${esc(lab(c.level))}${lvName(+c.level) ? " · " + esc(lvName(+c.level)) : ""}</span>` : ""}</div>
            <div${rtl} style="white-space:pre-line">${esc(c.text || "")}</div></div>`; });
        return; }
      table += `<tr style="page-break-inside:avoid"><td colspan="${S.levelStyle === "hide" ? 2 : 3}" style="background:${soft};font-family:Poppins,Arial,sans-serif;font-weight:600;color:${col};font-size:13px;padding:6px 9px">${esc(sub.name)}</td></tr>` +
        items.map(([stx, c]) => `<tr style="page-break-inside:avoid"><td style="${cell};font-weight:800"${rtl}>${esc(stx.name)}</td>${S.levelStyle === "hide" ? "" : `<td style="${cell}">${meter(c.level)}</td>`}<td style="${cell};white-space:pre-line"${rtl}>${esc(c.text || "")}</td></tr>`).join("");
    });
    flush();
    if (!any) h += `<p style="color:#56637a;margin:14px 0">No comments to show yet for this term.</p>`;

    // signatures
    if (S.show.signatures || S.show.parentAck) {
      const sigs = (S.show.signatures ? S.sig : []).filter(x => x && (x.role || x.name)).map(x => [x.name || (/teacher/i.test(x.role || "") ? (d.teachers || []).join(", ") : ""), x.role]);
      if (S.show.parentAck) sigs.push([d.ack ? "Seen on " + fmtDate(d.ack) : "Parent / guardian", d.ack ? "Parent / guardian" : "Confirmed on the Parent Portal"]);
      if (sigs.length) h += `<table width="100%" cellspacing="14" cellpadding="0" style="border-collapse:separate;margin:18px -14px 0;page-break-inside:avoid"><tr>${sigs.map(([n, r]) =>
        `<td style="border-top:1px solid #8b97ab;padding-top:6px;vertical-align:top;font-size:12px;color:#3d4a60;width:${Math.floor(100 / sigs.length)}%"><b style="display:block;color:#1f2a3d">${esc(n || " ")}</b>${esc(r || "")}</td>`).join("")}</tr></table>`;
    }
    h += `<div style="display:flex;justify-content:space-between;gap:10px;font-size:10.5px;color:#5d6a80;border-top:1px solid ${line};padding-top:8px;margin-top:14px"><span>${esc(st.name || "")} · ${esc(st.cls || "")} · ${esc(d.termName || "")}</span><span>${esc(S.footer || "")}</span></div></div>`;
    return h;
  }
  function fmtDate(v) { const x = new Date(String(v).length === 10 ? v + "T12:00:00" : v); return isNaN(x) ? String(v) : x.toLocaleDateString("en-GB", { day: "numeric", month: "long", year: "numeric" }); }

  // a printable page with one or more report cards; the browser's print dialog saves it as a PDF
  function printPage(cards, title) {
    const w = window.open("", "_blank"); if (!w) { alert("Please allow pop-ups to print or save the report card."); return; }
    w.document.write(`<!doctype html><html><head><meta charset="utf-8"><title>${esc(title || "Report card")}</title>
      <link href="https://fonts.googleapis.com/css2?family=Poppins:wght@500;600;700&family=Nunito+Sans:wght@400;600;700;800&family=Noto+Sans+Arabic:wght@400;600;700&display=swap" rel="stylesheet">
      <style>@page{size:A4;margin:12mm}body{margin:0;background:#E9EEF5}.sheet{background:#fff;max-width:794px;margin:18px auto;padding:30px 36px;box-shadow:0 6px 24px rgba(51,64,90,.15)}
      .np{max-width:794px;margin:14px auto 0;background:#FFF4D6;padding:10px 14px;border-radius:8px;font-family:Arial,sans-serif;font-size:14px}
      @media print{body{background:#fff}.np{display:none}.sheet{box-shadow:none;margin:0;padding:0;max-width:none;page-break-after:always}.sheet:last-child{page-break-after:auto}*{-webkit-print-color-adjust:exact;print-color-adjust:exact}}</style></head><body>
      <p class="np">To save as a PDF, choose <b>Save as PDF</b> in the print window. · لحفظ الملف اختر «حفظ بصيغة PDF».</p>
      ${cards.map(c => `<div class="sheet">${c}</div>`).join("")}
      <script>window.onload = () => setTimeout(() => window.print(), 600);<\/script></body></html>`);
    w.document.close();
  }
  window.ReportCard = { render, settings, printPage, DEF, esc, fmtDate };
})();
