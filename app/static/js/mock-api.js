/* Sakit-Learn · API TIRUAN untuk pengembangan frontend tanpa backend.
   Meniru endpoint backend Flask: /api/auth/*, /api/predict, /api/history*, /api/feedback, /api/model-info.
   Data disimpan di localStorage browser. HANYA UNTUK PENGEMBANGAN: jangan pakai password asli.
   Reset data dari console browser: SLMock.reset() */
(() => {
  "use strict";

  /* ---------------- penyimpanan ---------------- */
  const KEY = { users: "sl_users", history: "sl_history", feedback: "sl_feedback", session: "sl_session", seq: "sl_seq" };
  const mem = {}; // cadangan bila localStorage tidak tersedia
  const read = (k, fallback) => {
    try { const v = localStorage.getItem(k); return v ? JSON.parse(v) : fallback; } catch { return k in mem ? mem[k] : fallback; }
  };
  const write = (k, v) => { mem[k] = v; try { localStorage.setItem(k, JSON.stringify(v)); } catch { /* abaikan */ } };
  const nextId = (name) => { const s = read(KEY.seq, { user: 1, log: 0 }); s[name] = (s[name] || 0) + 1; write(KEY.seq, s); return s[name]; };

  if (!read(KEY.users, null)) {
    write(KEY.users, [{ id: 1, name: "Demo User", username: "demo", password: "demo123" }]);
    write(KEY.seq, { user: 1, log: 0 });
  }

  /* ---------------- model (tiruan aturan, sama dengan backend/models.py) ---------------- */
  const KEYS = ["under", "normal", "over", "obese"];
  const WEIGHTS = { lightgbm: 0.5, mlp: 0.5 };
  const CATEGORIES = {
    under: { key: "under", name: "Underweight", label: "Kurus (Underweight)" },
    normal: { key: "normal", name: "Normal weight", label: "Berat badan normal" },
    over: { key: "over", name: "Overweight", label: "Kelebihan berat badan" },
    obese: { key: "obese", name: "Obese", label: "Obesitas" },
  };
  const RECOMMENDATIONS = {
    under: "Tingkatkan asupan kalori bergizi dan konsultasikan ke ahli gizi.",
    normal: "Pertahankan pola makan sehat dan aktivitas fisik rutin.",
    over: "Kurangi makanan tinggi gula/lemak dan tingkatkan olahraga.",
    obese: "Segera konsultasi ke dokter atau ahli gizi untuk program penurunan berat badan.",
  };
  const LIMITS = { age: [1, 120], height: [50, 250], weight: [10, 300], activity: [1, 4] };
  const OPTIMAL = { age: [18, 79], height: [136, 201], weight: [26, 119], activity: [1, 4] };
  const PER_CLASS = [
    { key: "under", precision: 94.1, recall: 93.2, f1: 93.6, margin: 1.4 },
    { key: "normal", precision: 96.8, recall: 96.1, f1: 96.4, margin: 0.9 },
    { key: "over", precision: 94.6, recall: 94.9, f1: 94.7, margin: 1.2 },
    { key: "obese", precision: 96.3, recall: 95.8, f1: 96.0, margin: 1.0 },
  ];
  const r1 = (n) => Math.round(n * 10) / 10;

  function modelInfo() {
    const avg = (m) => r1(PER_CLASS.reduce((s, r) => s + r[m], 0) / PER_CLASS.length);
    return {
      n_train: 2111, weights: WEIGHTS, optimal_range: OPTIMAL,
      overall: { accuracy: { value: 95.2, margin: 1.3 }, f1: { value: 94.8, margin: 1.5 }, precision: { value: 95.5, margin: 1.1 }, recall: { value: 94.3, margin: 1.7 } },
      per_class: PER_CLASS.map((r) => ({ ...r, name: CATEGORIES[r.key].name })),
      average: { precision: avg("precision"), recall: avg("recall"), f1: avg("f1"), margin: avg("margin") },
    };
  }

  function validate(d) {
    const errors = {}, clean = {};
    for (const f of ["age", "height", "weight"]) {
      const [lo, hi] = LIMITS[f];
      const raw = d[f];
      const v = raw === null || raw === undefined || raw === "" ? NaN : Number(raw);
      if (Number.isNaN(v)) errors[f] = "Isi dengan angka.";
      else if (!Number.isFinite(v) || v < lo || v > hi) errors[f] = `Harus antara ${lo} dan ${hi}.`;
      else clean[f] = v;
    }
    if (d.gender === "Male" || d.gender === "Female") clean.gender = d.gender; else errors.gender = "Pilih salah satu gender.";
    const act = Number(d.activity);
    if (Number.isInteger(act) && act >= 1 && act <= 4) clean.activity = act; else errors.activity = "Pilih tingkat aktivitas 1 sampai 4.";
    return { clean, errors };
  }

  const normalize = (s) => {
    const c = Object.fromEntries(KEYS.map((k) => [k, Math.max(s[k], 1e-3)]));
    const total = KEYS.reduce((t, k) => t + c[k], 0);
    return Object.fromEntries(KEYS.map((k) => [k, c[k] / total]));
  };
  const BANDS = [[17, [.85, .10, .03, .02]], [18.5, [.70, .25, .03, .02]], [22, [.08, .82, .07, .03]], [25, [.03, .85, .09, .03]],
    [27.5, [.02, .35, .55, .08]], [30, [.01, .15, .70, .14]], [35, [.01, .05, .35, .59]], [Infinity, [.01, .02, .10, .87]]];

  function lightgbm(bmi, act) {
    const row = BANDS.find(([limit]) => bmi < limit)[1];
    const s = Object.fromEntries(KEYS.map((k, i) => [k, row[i]]));
    if (act >= 4) { s.under += .03; s.normal += .05; s.over -= .04; s.obese -= .04; }
    else if (act === 1) { s.over += .03; s.obese += .03; s.normal -= .04; s.under -= .02; }
    return normalize(s);
  }
  function mlp(age, gender, bmi, act) {
    const sq = (x) => x * x;
    const l = {
      under: -sq((bmi - 17) / 2.5) - sq((act - 2) / 1.5), normal: -sq((bmi - 22) / 3) - sq((act - 3) / 1.5),
      over: -sq((bmi - 27.5) / 3) - sq((act - 2) / 1.5), obese: -sq((bmi - 35) / 4) - sq((act - 1.5) / 1.5),
    };
    if (age > 50) { l.over += .3; l.obese += .3; } else if (age < 25) { l.normal += .2; l.under += .15; }
    if (gender === "Female") { l.over += .1; l.normal += .1; }
    const e = Object.fromEntries(KEYS.map((k) => [k, Math.exp(l[k])]));
    const t = KEYS.reduce((s, k) => s + e[k], 0);
    return Object.fromEntries(KEYS.map((k) => [k, e[k] / t]));
  }
  const pct = (p) => Object.fromEntries(KEYS.map((k) => [k, r1(p[k] * 100)]));

  function predict(c) {
    const bmi = c.weight / (c.height / 100) ** 2;
    const lg = lightgbm(bmi, c.activity), ml = mlp(c.age, c.gender, bmi, c.activity);
    const probs = Object.fromEntries(KEYS.map((k) => [k, WEIGHTS.lightgbm * lg[k] + WEIGHTS.mlp * ml[k]]));
    const winner = KEYS.reduce((a, b) => (probs[b] > probs[a] ? b : a));
    const names = { age: ["Usia", "tahun"], height: ["Tinggi badan", "cm"], weight: ["Berat badan", "kg"] };
    const warnings = Object.entries(names).filter(([f]) => c[f] < OPTIMAL[f][0] || c[f] > OPTIMAL[f][1]).map(([f, [n, u]]) =>
      `${n} ${c[f]} ${u} berada di luar rentang data latih (${OPTIMAL[f][0]}-${OPTIMAL[f][1]} ${u}). Hasil bisa kurang akurat.`);
    return { bmi: r1(bmi), category: CATEGORIES[winner], confidence: r1(probs[winner] * 100), probabilities: pct(probs),
      models: { lightgbm: pct(lg), mlp: pct(ml) }, recommendation: RECOMMENDATIONS[winner], warnings };
  }

  /* ---------------- helper respons ---------------- */
  const ok = (data, status = 200) => ({ status, data });
  const fail = (status, error, fields) => ({ status, data: fields ? { error, fields } : { error } });
  const currentUser = () => {
    const s = read(KEY.session, null);
    return s ? read(KEY.users, []).find((u) => u.id === s.user_id) || null : null;
  };
  const publicUser = (u) => ({ name: u.name, username: u.username });
  const serialize = (r) => ({
    id: r.id, created_at: r.created_at, age: r.age, gender: r.gender, height: r.height, weight: r.weight, activity: r.activity,
    bmi: r.bmi, confidence: r.confidence, category: CATEGORIES[r.category], probabilities: r.probabilities,
  });
  const userRows = (uid) => read(KEY.history, []).filter((r) => r.user_id === uid).sort((a, b) => b.id - a.id); // terbaru dulu

  /* ---------------- endpoint ---------------- */
  function register(d) {
    const name = String(d.name ?? "").trim(), username = String(d.username ?? "").trim().toLowerCase();
    const password = String(d.password ?? ""), confirm = String(d.confirm ?? "");
    const errors = {};
    if (name.length < 2 || name.length > 60) errors.name = "Nama harus 2 sampai 60 karakter.";
    if (!/^[a-z0-9_.]{3,30}$/.test(username)) errors.username = "Username 3-30 karakter: huruf kecil, angka, titik, atau garis bawah.";
    if (password.length < 6) errors.password = "Password minimal 6 karakter.";
    if (password !== confirm) errors.confirm = "Konfirmasi password tidak sama.";
    if (Object.keys(errors).length) return fail(422, "Periksa kembali isian Anda.", errors);
    const users = read(KEY.users, []);
    if (users.some((u) => u.username === username)) return fail(409, "Username sudah dipakai. Coba username lain.", { username: "Sudah dipakai." });
    const user = { id: nextId("user"), name, username, password }; // id 1 = akun demo
    write(KEY.users, [...users, user]);
    write(KEY.session, { user_id: user.id });
    return ok({ user: publicUser(user) }, 201);
  }

  function login(d) {
    const username = String(d.username ?? "").trim().toLowerCase();
    const u = read(KEY.users, []).find((x) => x.username === username);
    if (!u || u.password !== String(d.password ?? "")) return fail(401, "Username atau password salah.");
    write(KEY.session, { user_id: u.id });
    return ok({ user: publicUser(u) });
  }

  function history(q, me) {
    const term = (q.get("q") || "").trim().toLowerCase(), cat = q.get("category") || "";
    let items = userRows(me.id).map(serialize);
    if (KEYS.includes(cat)) items = items.filter((i) => i.category.key === cat);
    if (term) items = items.filter((i) => i.category.name.toLowerCase().includes(term) || i.category.label.toLowerCase().includes(term) || i.created_at.slice(0, 10).includes(term));
    if (q.get("sort") === "asc") items.reverse();
    return ok({ items, count: items.length });
  }

  function stats(q, me) {
    const tz = Math.max(-840, Math.min(840, parseInt(q.get("tz") || "0", 10) || 0));
    const rows = userRows(me.id);
    const by = Object.fromEntries(KEYS.map((k) => [k, 0]));
    rows.forEach((r) => { by[r.category] += 1; });
    const confs = rows.map((r) => r.confidence);
    const days = {};
    rows.forEach((r) => { const d = new Date(Date.parse(r.created_at) + tz * 60000).toISOString().slice(0, 10); days[d] = (days[d] || 0) + 1; });
    return ok({
      total: rows.length,
      avg_confidence: confs.length ? r1(confs.reduce((a, b) => a + b, 0) / confs.length) : null,
      max_confidence: confs.length ? Math.max(...confs) : null, min_confidence: confs.length ? Math.min(...confs) : null,
      top_category: rows.length ? CATEGORIES[KEYS.reduce((a, b) => (by[b] > by[a] ? b : a))] : null,
      by_category: by,
      recent: rows.slice(0, 10).reverse().map((r) => ({ id: r.id, confidence: r.confidence, category: r.category })),
      by_day: Object.keys(days).sort().slice(-10).map((d) => ({ date: d, count: days[d] })),
    });
  }

  function doPredict(d, me) {
    const { clean, errors } = validate(d);
    if (Object.keys(errors).length) return fail(422, "Periksa kembali isian Anda.", errors);
    const result = predict(clean);
    const row = { id: nextId("log"), user_id: me.id, created_at: new Date().toISOString().replace(/\.\d+Z$/, "+00:00"),
      age: clean.age, gender: clean.gender, height: clean.height, weight: clean.weight, activity: clean.activity,
      bmi: result.bmi, category: result.category.key, confidence: result.confidence, probabilities: result.probabilities };
    const all = [...read(KEY.history, []), row];
    const mine = all.filter((r) => r.user_id === me.id).sort((a, b) => b.id - a.id).slice(100).map((r) => r.id); // batas 100 per user
    write(KEY.history, all.filter((r) => !mine.includes(r.id)));
    return ok({ ...result, id: row.id }, 201);
  }

  function feedback(d, me) {
    if (!Number.isInteger(d.classification_id) || typeof d.is_correct !== "boolean") return fail(400, "Data umpan balik tidak valid.");
    if (!userRows(me.id).some((r) => r.id === d.classification_id)) return fail(404, "Hasil klasifikasi tidak ditemukan.");
    const list = read(KEY.feedback, []).filter((f) => !(f.classification_id === d.classification_id && f.user_id === me.id));
    write(KEY.feedback, [...list, { classification_id: d.classification_id, user_id: me.id, is_correct: d.is_correct }]);
    return ok({ ok: true });
  }

  async function handle(path, { method = "GET", body } = {}) {
    await new Promise((r) => setTimeout(r, 120)); // meniru jeda jaringan
    const url = new URL(path, "http://mock.local"), p = url.pathname, q = url.searchParams;
    const d = body && typeof body === "object" ? body : {};

    if (p === "/api/model-info" && method === "GET") return ok(modelInfo());
    if (p === "/api/auth/register" && method === "POST") return register(d);
    if (p === "/api/auth/login" && method === "POST") return login(d);
    if (p === "/api/auth/logout" && method === "POST") { write(KEY.session, null); return ok({ ok: true }); }
    if (p === "/api/auth/me" && method === "GET") { const u = currentUser(); return ok({ user: u ? publicUser(u) : null }); }

    const me = currentUser();
    if (!me) return fail(401, "Sesi berakhir. Silakan masuk kembali.");

    if (p === "/api/predict" && method === "POST") return doPredict(d, me);
    if (p === "/api/history" && method === "GET") return history(q, me);
    if (p === "/api/history/stats" && method === "GET") return stats(q, me);
    if (p === "/api/history" && method === "DELETE") {
      const all = read(KEY.history, []), keep = all.filter((r) => r.user_id !== me.id);
      write(KEY.history, keep);
      return ok({ ok: true, deleted: all.length - keep.length });
    }
    const m = p.match(/^\/api\/history\/(\d+)$/);
    if (m && method === "DELETE") {
      const id = Number(m[1]), all = read(KEY.history, []);
      if (!all.some((r) => r.id === id && r.user_id === me.id)) return fail(404, "Riwayat tidak ditemukan.");
      write(KEY.history, all.filter((r) => r.id !== id));
      return ok({ ok: true });
    }
    if (p === "/api/feedback" && method === "POST") return feedback(d, me);
    return fail(404, "Data tidak ditemukan.");
  }

  window.SLMock = { handle, reset() { Object.values(KEY).forEach((k) => { delete mem[k]; try { localStorage.removeItem(k); } catch { /* abaikan */ } }); location.reload(); } };
})();
