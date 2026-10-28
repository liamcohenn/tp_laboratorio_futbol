/* Carga del CSV, filtros, cálculos (agregados, regresión) y secciones interactivas.
   Todos los números de la página salen de acá: no hay cifras escritas a mano en el HTML. */
(function () {
  document.documentElement.classList.add("js");

  const ARCHIVO_REAL = "data/ventas.csv";
  const ARCHIVO_MUESTRA = "data/ventas_MUESTRA.csv";
  const REQUERIDAS = ["jugador", "club_vendedor", "liga", "temporada_venta", "grupo", "fee_venta", "fee_compra", "anios_en_club"];
  const GRUPOS = ["cantera", "comprado"];

  const $ = (s) => document.querySelector(s);
  const fmt = (v) => Graficos.fmt(v);
  const pct = (v) => isNaN(v) ? "—" : Math.round(v * 100) + "%";
  const esc = (s) => String(s ?? "").replace(/[&<>"']/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[c]));
  const num = (v) => {
    if (v == null || String(v).trim() === "") return NaN;
    return parseFloat(String(v).trim().replace(",", "."));
  };

  let TODOS = [];
  const estado = { clubes: new Set(), desde: null, hasta: null };

  /* ---------- Estadística ---------- */
  const suma = (a) => a.reduce((s, v) => s + v, 0);
  const media = (a) => a.length ? suma(a) / a.length : NaN;
  function mediana(a) {
    if (!a.length) return NaN;
    const s = [...a].sort((x, y) => x - y), m = s.length >> 1;
    return s.length % 2 ? s[m] : (s[m - 1] + s[m]) / 2;
  }
  // Mínimos cuadrados ordinarios: y = a + b·x
  function regresion(rows) {
    const n = rows.length;
    if (n < 3) return null;
    const xs = rows.map((r) => r.anios_en_club), ys = rows.map((r) => r.fee_venta);
    const mx = media(xs), my = media(ys);
    let sxy = 0, sxx = 0, syy = 0;
    for (let i = 0; i < n; i++) { sxy += (xs[i] - mx) * (ys[i] - my); sxx += (xs[i] - mx) ** 2; syy += (ys[i] - my) ** 2; }
    if (sxx === 0) return null;
    const b = sxy / sxx, a = my - b * mx;
    return { a, b, n, r2: syy === 0 ? 0 : (sxy * sxy) / (sxx * syy), xmin: Math.min(...xs), xmax: Math.max(...xs) };
  }
  const resumen = (rows) => {
    const f = rows.map((r) => r.fee_venta);
    return { n: f.length, total: suma(f), prom: media(f), med: mediana(f) };
  };
  const porGrupo = (rows, g) => rows.filter((r) => r.grupo === g);

  /* ---------- Carga ---------- */
  async function traer(url) {
    const r = await fetch(url, { cache: "no-store" });
    if (!r.ok) throw new Error(r.status);
    return r.text();
  }

  async function cargar() {
    let texto, esMuestra = false, archivo = ARCHIVO_REAL;
    try { texto = await traer(ARCHIVO_REAL); }
    catch (e) {
      try { texto = await traer(ARCHIVO_MUESTRA); esMuestra = true; archivo = ARCHIVO_MUESTRA; }
      catch (e2) {
        error(location.protocol === "file:"
          ? "El navegador no deja leer el CSV abriendo el archivo directo. Correr <code>python -m http.server</code> dentro de <code>docs/</code> y entrar a http://localhost:8000."
          : "No se encontró <code>data/ventas.csv</code> ni el archivo de muestra.");
        return;
      }
    }
    const res = Papa.parse(texto, { header: true, skipEmptyLines: true, transformHeader: (h) => h.trim().toLowerCase() });
    const faltan = REQUERIDAS.filter((c) => !res.meta.fields.includes(c));
    if (faltan.length) { error(`Al CSV le faltan columnas: <code>${faltan.join(", ")}</code>. Ver docs/README.md.`); return; }

    const tieneRent = res.meta.fields.includes("rentabilidad");
    let descartadas = 0;
    TODOS = res.data.map((r) => {
      let g = String(r.grupo || "").trim().toLowerCase();
      if (g === "comprados") g = "comprado";
      const fv = num(r.fee_venta);
      let fc = num(r.fee_compra);
      if (g === "cantera" && isNaN(fc)) fc = 0;
      const o = {
        jugador: String(r.jugador || "").trim(), club_vendedor: String(r.club_vendedor || "").trim(),
        club_comprador: String(r.club_comprador || "").trim(), liga: String(r.liga || "").trim(),
        temporada_venta: parseInt(r.temporada_venta, 10), grupo: g, fee_venta: fv, fee_compra: fc,
        anios_en_club: num(r.anios_en_club), edad_venta: num(r.edad_venta),
      };
      o.rentabilidad = tieneRent && !isNaN(num(r.rentabilidad)) ? num(r.rentabilidad) : fv - fc;
      return o;
    }).filter((o) => {
      const ok = GRUPOS.includes(o.grupo) && !isNaN(o.fee_venta) && !isNaN(o.fee_compra) && !isNaN(o.anios_en_club) && !isNaN(o.temporada_venta);
      if (!ok) descartadas++;
      return ok;
    });
    TODOS.forEach((r, i) => (r.id = i));
    if (descartadas) console.warn(`${descartadas} filas descartadas por datos incompletos o grupo inválido.`);

    $("#banner-muestra").hidden = !esMuestra;
    $("#fuente-archivo").textContent = archivo + (esMuestra ? " (DATOS DE MUESTRA)" : "") + ` · ${TODOS.length} ventas`;
    iniciar();
  }

  function error(html) {
    const d = document.createElement("div");
    d.className = "banner-muestra"; d.setAttribute("role", "alert"); d.innerHTML = html;
    document.body.prepend(d);
  }

  /* ---------- Filtros ---------- */
  const clubesUnicos = () => {
    const m = new Map();
    TODOS.forEach((r) => m.set(r.club_vendedor, r.liga));
    return [...m.entries()].sort((a, b) => a[1].localeCompare(b[1]));
  };
  const filtrados = () => TODOS.filter((r) => estado.clubes.has(r.club_vendedor) && r.temporada_venta >= estado.desde && r.temporada_venta <= estado.hasta);

  function armarFiltros() {
    const cont = $("#chips-clubes");
    const clubes = clubesUnicos();
    clubes.forEach(([c]) => estado.clubes.add(c));
    const boton = (txt, html, fn) => {
      const b = document.createElement("button");
      b.type = "button"; b.className = "chip"; b.innerHTML = html; b.dataset.club = txt;
      b.addEventListener("click", fn); cont.appendChild(b); return b;
    };
    boton("__todos", "Todos", () => { clubes.forEach(([c]) => estado.clubes.add(c)); actualizar(); });
    clubes.forEach(([c, liga]) => boton(c, `${esc(c)} <small>${esc(liga)}</small>`, () => {
      // Click en un club con todos activos = ver solo ese club. Si no, alterna (sin dejar cero).
      if (estado.clubes.size === clubes.length) { estado.clubes.clear(); estado.clubes.add(c); }
      else if (estado.clubes.has(c)) { if (estado.clubes.size > 1) estado.clubes.delete(c); }
      else estado.clubes.add(c);
      actualizar();
    }));

    const anios = [...new Set(TODOS.map((r) => r.temporada_venta))].sort((a, b) => a - b);
    estado.desde = anios[0]; estado.hasta = anios[anios.length - 1];
    for (const sel of [$("#anio-desde"), $("#anio-hasta")]) {
      sel.innerHTML = anios.map((a) => `<option value="${a}">${a}</option>`).join("");
    }
    $("#anio-desde").value = estado.desde; $("#anio-hasta").value = estado.hasta;
    $("#anio-desde").addEventListener("change", (e) => { estado.desde = +e.target.value; if (estado.desde > estado.hasta) { estado.hasta = estado.desde; $("#anio-hasta").value = estado.hasta; } actualizar(); });
    $("#anio-hasta").addEventListener("change", (e) => { estado.hasta = +e.target.value; if (estado.hasta < estado.desde) { estado.desde = estado.hasta; $("#anio-desde").value = estado.desde; } actualizar(); });
  }

  function pintarChips() {
    const total = clubesUnicos().length;
    document.querySelectorAll("#chips-clubes .chip").forEach((b) => {
      const on = b.dataset.club === "__todos" ? estado.clubes.size === total : estado.clubes.size !== total && estado.clubes.has(b.dataset.club);
      b.setAttribute("aria-pressed", on);
    });
  }

  /* ---------- Hero y conclusiones (sobre el dataset completo) ---------- */
  function pintarClave(k, v) { document.querySelectorAll(`[data-k="${k}"]`).forEach((el) => (el.textContent = v)); }

  function hero() {
    const ca = resumen(porGrupo(TODOS, "cantera")), co = resumen(porGrupo(TODOS, "comprado"));
    const tot = ca.total + co.total;
    const anios = TODOS.map((r) => r.temporada_venta);
    const clubes = clubesUnicos();
    pintarClave("pct_cantera", pct(ca.total / tot));
    pintarClave("pct_n_cantera", pct(ca.n / TODOS.length));
    pintarClave("n_ventas", TODOS.length.toLocaleString("es-AR"));
    pintarClave("total", fmt(tot));
    pintarClave("prom_cantera", fmt(ca.prom));
    pintarClave("prom_comprado", fmt(co.prom));
    pintarClave("periodo", `${Math.min(...anios)}–${Math.max(...anios)}`);
    pintarClave("n_clubes", clubes.length);
    pintarClave("n_ligas", new Set(clubes.map((c) => c[1])).size);
    pintarClave("lista_clubes", clubes.map(([c, l]) => `${c} (${l})`).join(", "));
  }

  function hechos() {
    const ca = porGrupo(TODOS, "cantera"), co = porGrupo(TODOS, "comprado");
    const rca = resumen(ca), rco = resumen(co);
    const tot = rca.total + rco.total;
    const rentCo = co.map((r) => r.rentabilidad);
    const perdida = co.filter((r) => r.rentabilidad < 0).length;
    const regCa = regresion(ca), regCo = regresion(co);
    const porClub = clubesUnicos().map(([c, l]) => {
      const rows = TODOS.filter((r) => r.club_vendedor === c);
      const t = suma(rows.map((r) => r.fee_venta));
      return { c, l, share: t ? suma(rows.filter((r) => r.grupo === "cantera").map((r) => r.fee_venta)) / t : NaN };
    }).filter((x) => !isNaN(x.share)).sort((a, b) => b.share - a.share);

    const L = [];
    L.push(`Las ventas de cantera suman <strong>${fmt(rca.total)}</strong> (${pct(rca.total / tot)} de los ingresos) con ${rca.n} ventas. Las de comprados suman <strong>${fmt(rco.total)}</strong> con ${rco.n} ventas.`);
    L.push(`Fee promedio por venta: cantera <strong>${fmt(rca.prom)}</strong> (mediana ${fmt(rca.med)}) vs. comprados <strong>${fmt(rco.prom)}</strong> (mediana ${fmt(rco.med)}).`);
    L.push(`Rentabilidad media: cantera <strong>${fmt(media(ca.map((r) => r.rentabilidad)))}</strong> por venta (sin costo de adquisición) vs. comprados <strong>${fmt(media(rentCo))}</strong>. ${perdida} de ${co.length} comprados (${pct(perdida / co.length)}) se vendieron por menos de lo que costaron.`);
    if (porClub.length > 1) {
      const a = porClub[0], z = porClub[porClub.length - 1];
      L.push(`El club más dependiente de la cantera es <strong>${esc(a.c)}</strong> (${esc(a.l)}): ${pct(a.share)} de sus ingresos por ventas. El menos dependiente es <strong>${esc(z.c)}</strong> (${esc(z.l)}), con ${pct(z.share)}.`);
    }
    if (regCa && regCo) L.push(`Por cada año extra en el club, el fee de venta varía en promedio <strong>${signo(regCa.b)}</strong> para la cantera (R² ${regCa.r2.toFixed(2)}) y <strong>${signo(regCo.b)}</strong> para los comprados (R² ${regCo.r2.toFixed(2)}).`);
    $("#hechos-lista").innerHTML = L.map((x) => `<li>${x}</li>`).join("");
  }
  const signo = (v) => (v >= 0 ? "+" : "−") + fmt(Math.abs(v));

  /* ---------- Gráficos ---------- */
  function datosGraficos(rows) {
    const anios = [];
    for (let a = estado.desde; a <= estado.hasta; a++) anios.push(a);
    const serie = (g) => anios.map((a) => suma(rows.filter((r) => r.grupo === g && r.temporada_venta === a).map((r) => r.fee_venta)));
    const cuenta = (g) => anios.map((a) => rows.filter((r) => r.grupo === g && r.temporada_venta === a).length);

    const clubes = clubesUnicos().filter(([c]) => estado.clubes.has(c));
    const grupos = clubes.map(([c]) => rows.filter((r) => r.club_vendedor === c));
    const etiquetas = clubes.map(([c, l]) => [c.length > 18 ? c.slice(0, 17) + "…" : c, l]);
    if (clubes.length > 1) { grupos.push(rows); etiquetas.push(["Total", "selección"]); }
    const stats = GRUPOS.map((g) => grupos.map((rs) => resumen(porGrupo(rs, g))));

    const ca = porGrupo(rows, "cantera"), co = porGrupo(rows, "comprado");
    return {
      evolucion: { anios, cantera: serie("cantera"), comprado: serie("comprado"), n: [cuenta("cantera"), cuenta("comprado")] },
      promedio: { etiquetas, stats, nombres: etiquetas.map((e) => e.join(" ")) },
      dispersion: { cantera: ca, comprado: co, regCantera: regresion(ca), regComprado: regresion(co) },
    };
  }

  function tabla(cab, filas) {
    return `<table><thead><tr>${cab.map((c, i) => `<th scope="col"${i ? ' class="num"' : ""}>${c}</th>`).join("")}</tr></thead><tbody>${
      filas.map((f) => `<tr>${f.map((v, i) => i ? `<td class="num">${v}</td>` : `<th scope="row">${v}</th>`).join("")}</tr>`).join("")}</tbody></table>`;
  }

  function descripciones(d) {
    const e = d.evolucion;
    const tc = suma(e.cantera), tk = suma(e.comprado);
    const picoC = e.anios[e.cantera.indexOf(Math.max(...e.cantera))], picoK = e.anios[e.comprado.indexOf(Math.max(...e.comprado))];
    $("#d-evolucion").textContent = `Entre ${estado.desde} y ${estado.hasta}, la cantera sumó ${fmt(tc)} y los comprados ${fmt(tk)}. El año de mayores ingresos fue ${tc ? picoC : "—"} para la cantera y ${tk ? picoK : "—"} para los comprados.`;
    $("#t-evolucion").innerHTML = tabla(["Temporada", "Cantera (M€)", "Ventas", "Comprados (M€)", "Ventas"],
      e.anios.map((a, i) => [a, fmt(e.cantera[i]), e.n[0][i], fmt(e.comprado[i]), e.n[1][i]]));

    const p = d.promedio;
    const ult = p.stats[0].length - 1;
    $("#d-promedio").textContent = `En la selección, el fee promedio de venta es ${fmt(p.stats[0][ult].prom)} para la cantera (${p.stats[0][ult].n} ventas) y ${fmt(p.stats[1][ult].prom)} para los comprados (${p.stats[1][ult].n} ventas).`;
    $("#t-promedio").innerHTML = tabla(["Club", "Cantera: prom.", "mediana", "n", "Comprados: prom.", "mediana", "n"],
      p.nombres.map((nm, i) => [esc(nm), fmt(p.stats[0][i].prom), fmt(p.stats[0][i].med), p.stats[0][i].n, fmt(p.stats[1][i].prom), fmt(p.stats[1][i].med), p.stats[1][i].n]));

    const s = d.dispersion;
    const txtReg = (nom, r) => r ? `${nom}: fee ≈ ${r.a.toFixed(2)} ${r.b >= 0 ? "+" : "−"} ${Math.abs(r.b).toFixed(2)} × años (R² ${r.r2.toFixed(2)}, n ${r.n})` : `${nom}: datos insuficientes para la regresión`;
    $("#d-dispersion").textContent = `${s.cantera.length + s.comprado.length} ventas graficadas. ${txtReg("Cantera", s.regCantera)}. ${txtReg("Comprados", s.regComprado)}.`;
    $("#t-dispersion").innerHTML = tabla(["Grupo", "Intercepto a (M€)", "Pendiente b (M€/año)", "R²", "n"],
      [["Cantera", s.regCantera], ["Comprados", s.regComprado]].map(([g, r]) => r ? [g, r.a.toFixed(2), r.b.toFixed(2), r.r2.toFixed(2), r.n] : [g, "—", "—", "—", "—"]));
  }

  /* ---------- Simulador ---------- */
  function simulador(rows) {
    const g = document.querySelector('input[name="sim-grupo"]:checked').value;
    const x = +$("#sim-anios").value;
    $("#sim-anios-out").textContent = x.toLocaleString("es-AR", { minimumFractionDigits: 1 });
    const reg = regresion(porGrupo(rows, g));
    const aviso = $("#sim-aviso");
    if (!reg) {
      $("#sim-valor").textContent = "—"; $("#sim-pendiente").textContent = "—"; $("#sim-r2").textContent = "—";
      aviso.textContent = "Hay muy pocas ventas de este grupo con los filtros actuales para ajustar una regresión (se necesitan al menos 3).";
      return;
    }
    const y = reg.a + reg.b * x;
    $("#sim-valor").textContent = y < 0 ? "≈ 0 M€" : fmt(y);
    $("#sim-pendiente").textContent = signo(reg.b);
    $("#sim-r2").textContent = `${reg.r2.toFixed(2)} · ${reg.n}`;
    const av = [];
    if (x < reg.xmin || x > reg.xmax) av.push(`${x} años está fuera del rango observado (${reg.xmin}–${reg.xmax}): es una extrapolación.`);
    if (y < 0) av.push("La recta da un valor negativo en este punto, señal de que el modelo lineal no sirve en este rango.");
    if (reg.n < 10) av.push(`La estimación se basa en solo ${reg.n} ventas.`);
    if (reg.r2 < 0.1) av.push(`R² de ${reg.r2.toFixed(2)}: los años en el club explican muy poco de la variación del fee.`);
    aviso.textContent = av.join(" ");
  }

  /* ---------- Ranking ---------- */
  function ranking(rows) {
    const top = porGrupo(rows, "cantera").sort((a, b) => b.rentabilidad - a.rentabilidad).slice(0, 10);
    const max = top.length ? Math.max(...top.map((r) => r.rentabilidad)) : 1;
    $("#ranking-body").innerHTML = top.length ? top.map((r, i) => `<tr>
      <td class="pos">${i + 1}</td>
      <td><span class="jug">${esc(r.jugador)}</span><br><span class="nota">→ ${esc(r.club_comprador || "s/d")}</span></td>
      <td class="col-club">${esc(r.club_vendedor)}</td>
      <td class="num">${r.temporada_venta}</td>
      <td class="num">${r.anios_en_club.toLocaleString("es-AR")}</td>
      <td class="num"><span class="rk-barra"><i style="width:${Math.max(2, (r.rentabilidad / max) * 80)}px" aria-hidden="true"></i>${fmt(r.rentabilidad)}</span></td>
    </tr>`).join("") : `<tr><td colspan="6" class="vacio">No hay ventas de cantera con estos filtros.</td></tr>`;
  }

  /* ---------- Cabeza a cabeza ---------- */
  function armarH2H() {
    const porClub = clubesUnicos().map(([c, l]) => {
      const rows = TODOS.filter((r) => r.club_vendedor === c).sort((a, b) => a.jugador.localeCompare(b.jugador));
      return `<optgroup label="${esc(c)} (${esc(l)})">${rows.map((r) => `<option value="${r.id}">${esc(r.jugador)} · ${r.temporada_venta}</option>`).join("")}</optgroup>`;
    }).join("");
    $("#h2h-a").innerHTML = porClub; $("#h2h-b").innerHTML = porClub;
    const mejor = (g, k) => porGrupo(TODOS, g).sort((a, b) => b[k] - a[k])[0];
    const a = mejor("cantera", "rentabilidad"), b = mejor("comprado", "fee_venta");
    if (a) $("#h2h-a").value = a.id;
    if (b) $("#h2h-b").value = b.id;
    $("#h2h-a").addEventListener("change", h2h); $("#h2h-b").addEventListener("change", h2h);
    h2h();
  }

  function h2h() {
    const A = TODOS[+$("#h2h-a").value], B = TODOS[+$("#h2h-b").value];
    if (!A || !B) { $("#h2h-cuerpo").innerHTML = ""; return; }
    const tag = (r) => `<span><i class="sw sw-${r.grupo}"></i>${r.grupo === "cantera" ? "Cantera" : "Comprado"} · ${esc(r.club_vendedor)} → ${esc(r.club_comprador || "s/d")}</span>`;
    // [etiqueta, campo, formato, mayor es mejor (null = no se compara)]
    const metricas = [
      ["Fee de venta", "fee_venta", fmt, true],
      ["Fee de compra", "fee_compra", fmt, null],
      ["Rentabilidad", "rentabilidad", fmt, true],
      ["Años en el club", "anios_en_club", (v) => v.toLocaleString("es-AR"), null],
      ["Edad a la venta", "edad_venta", (v) => isNaN(v) ? "—" : v, null],
      ["Temporada", "temporada_venta", (v) => v, null],
    ];
    const filas = metricas.map(([lbl, k, f, mejorMayor]) => {
      const va = A[k], vb = B[k];
      const comparable = mejorMayor !== null && !isNaN(va) && !isNaN(vb) && va !== vb;
      const mx = Math.max(Math.abs(va) || 0, Math.abs(vb) || 0) || 1;
      const barra = (v) => mejorMayor !== null && !isNaN(v) ? `<i style="width:${Math.max(2, (Math.max(v, 0) / mx) * 70)}px" aria-hidden="true"></i>` : "";
      const gA = comparable && va > vb, gB = comparable && vb > va;
      return `<div class="h2h-fila">
        <div class="h2h-lado a${gA ? " gana" : ""}">${f(va)}${barra(va)}</div>
        <div class="met">${lbl}</div>
        <div class="h2h-lado b${gB ? " gana" : ""}">${barra(vb)}${f(vb)}</div>
      </div>`;
    }).join("");
    $("#h2h-cuerpo").innerHTML = `<div class="h2h-cab"><div><strong>${esc(A.jugador)}</strong>${tag(A)}</div><div><strong>${esc(B.jugador)}</strong>${tag(B)}</div></div>${filas}`;
  }

  /* ---------- Orquestación ---------- */
  function actualizar() {
    pintarChips();
    const rows = filtrados();
    $("#filtro-estado").textContent = `${rows.length} ventas en la selección`;
    const d = datosGraficos(rows);
    Graficos.dibujar(d);
    descripciones(d);
    simulador(rows);
    ranking(rows);
  }

  function iniciar() {
    armarFiltros();
    hero();
    hechos();
    const maxAnios = Math.ceil(Math.max(...TODOS.map((r) => r.anios_en_club)));
    $("#sim-anios").max = Math.max(1, maxAnios);
    $("#sim-anios").addEventListener("input", () => simulador(filtrados()));
    document.querySelectorAll('input[name="sim-grupo"]').forEach((i) => i.addEventListener("change", () => simulador(filtrados())));
    armarH2H();
    actualizar();
  }

  /* ---------- Tema ---------- */
  const mqClaro = window.matchMedia("(prefers-color-scheme: light)");
  const temaActual = () => document.documentElement.dataset.theme || (mqClaro.matches ? "light" : "dark");
  function etiquetaTema() {
    $("#toggle-tema").setAttribute("aria-label", temaActual() === "dark" ? "Cambiar a modo claro" : "Cambiar a modo oscuro");
  }
  $("#toggle-tema").addEventListener("click", () => {
    const nuevo = temaActual() === "dark" ? "light" : "dark";
    document.documentElement.dataset.theme = nuevo;
    try { localStorage.setItem("tema", nuevo); } catch (e) {}
    etiquetaTema();
    Graficos.retema();
  });
  mqClaro.addEventListener("change", () => { if (!document.documentElement.dataset.theme) { etiquetaTema(); Graficos.retema(); } });
  etiquetaTema();

  /* ---------- Scroll: revelado, sección activa y progreso ---------- */
  const io = new IntersectionObserver((es) => es.forEach((e) => { if (e.isIntersecting) { e.target.classList.add("visible"); io.unobserve(e.target); } }), { threshold: 0.12 });
  document.querySelectorAll(".reveal").forEach((el) => io.observe(el));

  const links = [...document.querySelectorAll(".pasos a")];
  const ioNav = new IntersectionObserver((es) => es.forEach((e) => {
    if (e.isIntersecting) links.forEach((l) => l.classList.toggle("activo", l.getAttribute("href") === "#" + e.target.id));
  }), { rootMargin: "-45% 0px -50% 0px" });
  document.querySelectorAll("main > section[id]").forEach((s) => ioNav.observe(s));

  const barra = $("#barra-progreso");
  window.addEventListener("scroll", () => {
    const h = document.documentElement.scrollHeight - innerHeight;
    barra.style.width = (h > 0 ? (scrollY / h) * 100 : 0) + "%";
  }, { passive: true });

  cargar();
})();
