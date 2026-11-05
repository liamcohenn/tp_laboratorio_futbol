/* Carga del CSV, filtros, cálculos (agregados, regresión) y secciones interactivas.
   Todos los números de la página salen de acá: no hay cifras escritas a mano en el HTML. */
(function () {
  document.documentElement.classList.add("js");

  const ARCHIVO_REAL = "data/ventas.csv";
  const ARCHIVO_MUESTRA = "data/ventas_MUESTRA.csv";
  const REQUERIDAS = ["jugador", "club_vendedor", "liga", "temporada_venta", "grupo", "fee_venta", "fee_compra", "anios_en_club"];
  const GRUPOS = ["cantera", "comprado"];
  // El notebook deja `liga` como código de Transfermarkt (ARG1, ES1, ...); acá se traduce para mostrar.
  const LIGA_NOMBRE = {
    ARG1: "Liga Profesional Argentina", ES1: "LaLiga (España)", FR1: "Ligue 1 (Francia)",
    GB1: "Premier League (Inglaterra)", MEX1: "Liga MX (México)", NL1: "Eredivisie (Países Bajos)",
    PO1: "Liga Portugal", SA1: "Saudi Pro League (Arabia Saudita)",
  };
  const nombreLiga = (codigo) => LIGA_NOMBRE[String(codigo || "").trim().toUpperCase()] || String(codigo || "").trim();

  const $ = (s) => document.querySelector(s);
  const fmt = (v) => Graficos.fmt(v);
  const pct = (v) => isNaN(v) ? "—" : Math.round(v * 100) + "%";
  const esc = (s) => String(s ?? "").replace(/[&<>"']/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[c]));
  const num = (v) => {
    if (v == null || String(v).trim() === "") return NaN;
    return parseFloat(String(v).trim().replace(",", "."));
  };

  let TODOS = [];
  const estado = { ligas: new Set(), desde: null, hasta: null };

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
        club_comprador: String(r.club_comprador || "").trim(), liga: nombreLiga(r.liga),
        liga_cod: String(r.liga || "").trim().toUpperCase(),
        temporada_venta: parseInt(r.temporada_venta, 10), grupo: g, fee_venta: fv, fee_compra: fc,
        anios_en_club: num(r.anios_en_club), edad_venta: num(r.edad_venta),
      };
      // Si el costo de compra es desconocido (comprados sin fee de llegada registrado), la rentabilidad
      // queda sin definir en vez de asumir 0 — igual que en el notebook del grupo. La venta sigue contando
      // para ingresos, promedios y el resto de los gráficos.
      o.rentabilidad = tieneRent && !isNaN(num(r.rentabilidad)) ? num(r.rentabilidad) : fv - fc;
      return o;
    }).filter((o) => {
      const ok = GRUPOS.includes(o.grupo) && !isNaN(o.fee_venta) && !isNaN(o.anios_en_club) && !isNaN(o.temporada_venta);
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
  // El dataset tiene ~235 clubes: filtrar por club haría 235 chips inmanejables, así que el filtro
  // es por liga (8 opciones) y el club sigue visible en el ranking, el comparador y las tablas.
  const clubesUnicos = () => {
    const m = new Map();
    TODOS.forEach((r) => m.set(r.club_vendedor, r.liga));
    return [...m.entries()].sort((a, b) => a[1].localeCompare(b[1]) || a[0].localeCompare(b[0]));
  };
  const ligasUnicas = () => [...new Set(TODOS.map((r) => r.liga))].sort();
  const filtrados = () => TODOS.filter((r) => estado.ligas.has(r.liga) && r.temporada_venta >= estado.desde && r.temporada_venta <= estado.hasta);

  function armarFiltros() {
    const cont = $("#chips-clubes");
    const ligas = ligasUnicas();
    ligas.forEach((l) => estado.ligas.add(l));
    const nClubesPorLiga = new Map();
    clubesUnicos().forEach(([, l]) => nClubesPorLiga.set(l, (nClubesPorLiga.get(l) || 0) + 1));
    const boton = (txt, html, fn) => {
      const b = document.createElement("button");
      b.type = "button"; b.className = "chip"; b.innerHTML = html; b.dataset.liga = txt;
      b.addEventListener("click", fn); cont.appendChild(b); return b;
    };
    boton("__todos", "Todas", () => { ligas.forEach((l) => estado.ligas.add(l)); actualizar(); });
    ligas.forEach((l) => boton(l, `${esc(l)} <small>${nClubesPorLiga.get(l) || 0} clubes</small>`, () => {
      // Click en una liga con todas activas = ver solo esa. Si no, alterna (sin dejar cero).
      if (estado.ligas.size === ligas.length) { estado.ligas.clear(); estado.ligas.add(l); }
      else if (estado.ligas.has(l)) { if (estado.ligas.size > 1) estado.ligas.delete(l); }
      else estado.ligas.add(l);
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
    const total = ligasUnicas().length;
    document.querySelectorAll("#chips-clubes .chip").forEach((b) => {
      const on = b.dataset.liga === "__todos" ? estado.ligas.size === total : estado.ligas.size !== total && estado.ligas.has(b.dataset.liga);
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
    const ligas = ligasUnicas();
    const nClubesPorLiga = new Map();
    clubes.forEach(([, l]) => nClubesPorLiga.set(l, (nClubesPorLiga.get(l) || 0) + 1));
    pintarClave("pct_cantera", pct(ca.total / tot));
    pintarClave("pct_n_cantera", pct(ca.n / TODOS.length));
    pintarClave("n_ventas", TODOS.length.toLocaleString("es-AR"));
    pintarClave("total", fmt(tot));
    pintarClave("prom_cantera", fmt(ca.prom));
    pintarClave("prom_comprado", fmt(co.prom));
    pintarClave("periodo", `${Math.min(...anios)}–${Math.max(...anios)}`);
    pintarClave("n_clubes", clubes.length);
    pintarClave("n_ligas", ligas.length);
    pintarClave("lista_ligas", ligas.map((l) => `${l} (${nClubesPorLiga.get(l) || 0} clubes)`).join(", "));
  }

  function hechos() {
    const ca = porGrupo(TODOS, "cantera"), co = porGrupo(TODOS, "comprado");
    const rca = resumen(ca), rco = resumen(co);
    const tot = rca.total + rco.total;
    const rentCoConocida = co.map((r) => r.rentabilidad).filter((v) => !isNaN(v));
    const perdida = rentCoConocida.filter((v) => v < 0).length;
    const regCa = regresion(ca), regCo = regresion(co);

    const porLiga = ligasUnicas().map((l) => {
      const rows = TODOS.filter((r) => r.liga === l);
      const t = suma(rows.map((r) => r.fee_venta));
      return { l, n: rows.length, share: t ? suma(rows.filter((r) => r.grupo === "cantera").map((r) => r.fee_venta)) / t : NaN };
    }).filter((x) => !isNaN(x.share)).sort((a, b) => b.share - a.share);

    const MIN_VENTAS_CLUB = 15;
    const mapaClubes = new Map();
    TODOS.forEach((r) => { if (!mapaClubes.has(r.club_vendedor)) mapaClubes.set(r.club_vendedor, { liga: r.liga, rows: [] }); mapaClubes.get(r.club_vendedor).rows.push(r); });
    const porClub = [...mapaClubes.entries()].map(([c, { liga, rows }]) => {
      const t = suma(rows.map((r) => r.fee_venta));
      return { c, liga, n: rows.length, share: t ? suma(rows.filter((r) => r.grupo === "cantera").map((r) => r.fee_venta)) / t : NaN };
    }).filter((x) => x.n >= MIN_VENTAS_CLUB && !isNaN(x.share)).sort((a, b) => b.share - a.share);

    const L = [];
    L.push(`Las ventas de cantera suman <strong>${fmt(rca.total)}</strong> (${pct(rca.total / tot)} de los ingresos) con ${rca.n} ventas (${pct(rca.n / (rca.n + rco.n))} del total). Las de comprados suman <strong>${fmt(rco.total)}</strong> con ${rco.n} ventas.`);
    L.push(`Fee promedio por venta: cantera <strong>${fmt(rca.prom)}</strong> (mediana ${fmt(rca.med)}) vs. comprados <strong>${fmt(rco.prom)}</strong> (mediana ${fmt(rco.med)}).`);
    L.push(`Rentabilidad: cantera <strong>${fmt(media(ca.map((r) => r.rentabilidad)))}</strong> de media por venta (sin costo de adquisición) vs. comprados <strong>${fmt(media(rentCoConocida))}</strong> entre los ${rentCoConocida.length} de ${rco.n} con costo de compra conocido. De esos, ${perdida} (${pct(perdida / rentCoConocida.length)}) se vendieron por menos de lo que costaron.`);
    if (porLiga.length > 1) {
      const a = porLiga[0], z = porLiga[porLiga.length - 1];
      L.push(`La liga más dependiente de la cantera es <strong>${esc(a.l)}</strong>: ${pct(a.share)} de sus ingresos por ventas. La menos dependiente es <strong>${esc(z.l)}</strong>, con ${pct(z.share)}.`);
    }
    if (porClub.length) {
      const top = porClub[0];
      L.push(`Entre los clubes con al menos ${MIN_VENTAS_CLUB} ventas, el más dependiente de su cantera es <strong>${esc(top.c)}</strong> (${esc(top.liga)}): ${pct(top.share)} de sus ingresos vienen de jugadores propios.`);
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

    const ligas = ligasUnicas().filter((l) => estado.ligas.has(l));
    const grupos = ligas.map((l) => rows.filter((r) => r.liga === l));
    const etiquetas = ligas.map((l) => [l, ""]);
    if (ligas.length > 1) { grupos.push(rows); etiquetas.push(["Total", "selección"]); }
    const stats = GRUPOS.map((g) => grupos.map((rs) => resumen(porGrupo(rs, g))));

    const ca = porGrupo(rows, "cantera"), co = porGrupo(rows, "comprado");
    return {
      evolucion: { anios, cantera: serie("cantera"), comprado: serie("comprado"), n: [cuenta("cantera"), cuenta("comprado")] },
      promedio: { etiquetas, stats, nombres: etiquetas.map((e) => e.filter(Boolean).join(" ")) },
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
    $("#t-promedio").innerHTML = tabla(["Liga", "Cantera: prom.", "mediana", "n", "Comprados: prom.", "mediana", "n"],
      p.nombres.map((nm, i) => [esc(nm), fmt(p.stats[0][i].prom), fmt(p.stats[0][i].med), p.stats[0][i].n, fmt(p.stats[1][i].prom), fmt(p.stats[1][i].med), p.stats[1][i].n]));

    const s = d.dispersion;
    const txtReg = (nom, r) => r ? `${nom}: fee ≈ ${r.a.toFixed(2)} ${r.b >= 0 ? "+" : "−"} ${Math.abs(r.b).toFixed(2)} × años (R² ${r.r2.toFixed(2)}, n ${r.n})` : `${nom}: datos insuficientes para la regresión`;
    $("#d-dispersion").textContent = `${s.cantera.length + s.comprado.length} ventas graficadas. ${txtReg("Cantera", s.regCantera)}. ${txtReg("Comprados", s.regComprado)}.`;
    $("#t-dispersion").innerHTML = tabla(["Grupo", "Intercepto a (M€)", "Pendiente b (M€/año)", "R²", "n"],
      [["Cantera", s.regCantera], ["Comprados", s.regComprado]].map(([g, r]) => r ? [g, r.a.toFixed(2), r.b.toFixed(2), r.r2.toFixed(2), r.n] : [g, "—", "—", "—", "—"]));
  }

  /* ---------- Aclaración de la rentabilidad de cantera (ícono "?") ---------- */
  // La rentabilidad de un canterano es el fee de venta completo: el costo de formarlo no figura en
  // Transfermarkt, así que se toma como 0. El ícono lo aclara al lado de cada cifra.
  const info = (texto, etiqueta = "Qué incluye esta rentabilidad") =>
    `<button type="button" class="info" aria-label="${esc(etiqueta)}" data-tip="${esc(texto)}">?</button>`;
  const TIP_CANTERA_GENERAL = "Para la cantera, la rentabilidad es el fee de venta completo: el costo de adquisición se toma como 0 porque Transfermarkt no registra lo que el club gastó en formar al jugador (divisiones juveniles, sueldos, viajes, infraestructura). La rentabilidad real es algo menor, pero ese costo suele ser chico al lado del fee.";
  const tipCantera = (r) => `Los ${fmt(r.fee_venta)} son lo que pagó ${r.club_comprador || "el club comprador"} por ${r.jugador}: el fee de venta completo. Como salió de las inferiores de ${r.club_vendedor}, el costo de adquisición se toma como 0, porque Transfermarkt no registra lo que el club gastó en formarlo (divisiones juveniles, sueldos, viajes, infraestructura). La rentabilidad real es algo menor, pero ese costo suele ser chico al lado del fee.`;

  /* ---------- Simulador por edad de venta ---------- */
  // Reemplaza al simulador lineal por años en el club, que extrapolaba precios crecientes sin techo.
  // Acá no hay modelo: para cada edad E se toman las ventas reales con edad entre E−1 y E+1 y se
  // muestra su mediana. Así la curva sube y baja como en la realidad (el valor cae después del pico).
  const EDAD_MIN = 17, EDAD_MAX = 34, MIN_N_CURVA = 10;
  function cuantil(a, q) {
    if (!a.length) return NaN;
    const s = [...a].sort((x, y) => x - y), pos = (s.length - 1) * q, i = Math.floor(pos);
    return s[i] + (s[Math.min(i + 1, s.length - 1)] - s[i]) * (pos - i);
  }
  const ventana = (rows, e) => rows.filter((r) => {
    const ed = Math.floor(r.edad_venta);
    return !isNaN(ed) && ed >= e - 1 && ed <= e + 1;
  });
  function curvaEdad(rows) {
    const edades = [];
    for (let e = EDAD_MIN; e <= EDAD_MAX; e++) edades.push(e);
    const serie = (g) => edades.map((e) => {
      const v = ventana(porGrupo(rows, g), e);
      return { n: v.length, med: v.length >= MIN_N_CURVA ? mediana(v.map((r) => r.fee_venta)) : null };
    });
    return { edades, cantera: serie("cantera"), comprado: serie("comprado") };
  }
  const n1 = (v) => v.toLocaleString("es-AR", { maximumFractionDigits: 1, minimumFractionDigits: 1 });

  function simulador(rows) {
    const g = document.querySelector('input[name="sim-grupo"]:checked').value;
    const e = +$("#sim-edad").value;
    $("#sim-edad-out").textContent = e;
    const curva = curvaEdad(rows);
    Graficos.dibujar({ edad: Object.assign({}, curva, { sel: e, grupo: g }) });

    const v = ventana(porGrupo(rows, g), e);
    const fees = v.map((r) => r.fee_venta);
    const aviso = $("#sim-aviso"), frase = $("#sim-frase");
    if (g === "cantera") $("#sim-rent-lbl").innerHTML = `Rentabilidad típica ${info(TIP_CANTERA_GENERAL)}`;
    else $("#sim-rent-lbl").textContent = "Rentabilidad típica · % con ganancia";
    if (!v.length) {
      ["#sim-valor", "#sim-rango", "#sim-rent", "#sim-n"].forEach((k) => ($(k).textContent = "—"));
      frase.textContent = "";
      aviso.textContent = "No hay ventas de este grupo con esa edad en la selección actual. Probá con otra edad o con más ligas.";
      return;
    }
    const med = mediana(fees);
    $("#sim-valor").textContent = fmt(med);
    $("#sim-rango").textContent = `${n1(cuantil(fees, 0.25))} – ${n1(cuantil(fees, 0.75))} M€`;
    $("#sim-n").textContent = v.length.toLocaleString("es-AR");
    if (g === "cantera") {
      $("#sim-rent").textContent = fmt(med);
    } else {
      const rc = v.map((r) => r.rentabilidad).filter((x) => !isNaN(x));
      const gan = rc.filter((x) => x > 0).length;
      $("#sim-rent").textContent = rc.length ? `${signo(mediana(rc))} · ${pct(gan / rc.length)}` : "—";
    }

    // Edad pico (mediana más alta) del grupo, para ubicar la edad elegida respecto de ella.
    const serie = curva[g];
    let pico = -1;
    serie.forEach((p, i) => { if (p.med != null && (pico < 0 || p.med > serie[pico].med)) pico = i; });
    const nombre = g === "cantera" ? "de cantera" : "comprado";
    let txt = `Un jugador ${nombre} vendido con ${e - 1} a ${e + 1} años se vendió típicamente por ${fmt(med)} (mediana de ${v.length} ventas).`;
    if (pico >= 0) {
      const ep = curva.edades[pico], mp = serie[pico].med;
      txt += ` La mediana más alta de este grupo está en los ${ep} años (${fmt(mp)}).`;
      if (e > ep && med < mp) txt += ` A esta edad el precio típico ya está ${pct(1 - med / mp)} por debajo del pico.`;
      else if (e < ep) txt += " A esta edad el jugador todavía no llegó a su pico de valor.";
    }
    frase.textContent = txt;
    aviso.textContent = v.length < MIN_N_CURVA ? `Solo ${v.length} ventas en esta ventana: el dato es poco confiable.` : "";
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
      <td class="num"><span class="rk-barra"><i style="width:${Math.max(2, (r.rentabilidad / max) * 80)}px" aria-hidden="true"></i>${fmt(r.rentabilidad)}${info(tipCantera(r))}</span></td>
    </tr>`).join("") : `<tr><td colspan="6" class="vacio">No hay ventas de cantera con estos filtros.</td></tr>`;
  }

  /* ---------- Cabeza a cabeza ---------- */
  // Solo las 5 ventas más caras (un jugador una vez por liga) de las ligas más fuertes del dataset
  // —Serie A y Bundesliga no están— más Argentina. Con las 5.280 ventas el desplegable era inmanejable.
  const LIGAS_H2H = ["GB1", "ES1", "FR1", "PO1", "NL1", "ARG1"];
  const POR_LIGA_H2H = 5;
  function armarH2H() {
    const grupos = LIGAS_H2H.map((cod) => {
      const vistos = new Set();
      const top = TODOS.filter((r) => r.liga_cod === cod)
        .sort((a, b) => b.fee_venta - a.fee_venta)
        .filter((r) => !vistos.has(r.jugador) && vistos.add(r.jugador))
        .slice(0, POR_LIGA_H2H);
      return { liga: nombreLiga(cod), top };
    }).filter((x) => x.top.length);
    const html = grupos.map(({ liga, top }) => `<optgroup label="${esc(liga)}">${top.map((r) =>
      `<option value="${r.id}">${esc(r.jugador)} · ${esc(r.club_vendedor)} → ${esc(r.club_comprador || "s/d")} · ${fmt(r.fee_venta)}</option>`).join("")}</optgroup>`).join("");
    $("#h2h-a").innerHTML = html; $("#h2h-b").innerHTML = html;
    const opciones = grupos.flatMap((x) => x.top);
    const mejor = (g, k) => opciones.filter((r) => r.grupo === g).sort((a, b) => b[k] - a[k])[0];
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
      ["Rentabilidad", "rentabilidad", (v, r) => fmt(v) + (r.grupo === "cantera" ? info(tipCantera(r)) : ""), true],
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
        <div class="h2h-lado a${gA ? " gana" : ""}">${f(va, A)}${barra(va)}</div>
        <div class="met">${lbl}</div>
        <div class="h2h-lado b${gB ? " gana" : ""}">${barra(vb)}${f(vb, B)}</div>
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
    $("#sim-edad").addEventListener("input", () => simulador(filtrados()));
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

  /* ---------- Paneles "Cómo se lee" ---------- */
  document.querySelectorAll(".btn-explica").forEach((b) => b.addEventListener("click", () => {
    const panel = document.getElementById(b.getAttribute("aria-controls"));
    const abrir = b.getAttribute("aria-expanded") !== "true";
    b.setAttribute("aria-expanded", abrir);
    panel.hidden = !abrir;
  }));

  /* ---------- Tooltip de los íconos "?" ----------
     Un solo globo con position: fixed, para que no lo recorten las tablas con scroll horizontal. */
  const tip = document.createElement("div");
  tip.className = "tip"; tip.id = "tip"; tip.setAttribute("role", "tooltip"); tip.hidden = true;
  document.body.appendChild(tip);
  let tipAncla = null;
  function mostrarTip(el) {
    tipAncla = el;
    tip.textContent = el.dataset.tip;
    tip.hidden = false;
    el.setAttribute("aria-describedby", "tip");
    const r = el.getBoundingClientRect(), w = tip.offsetWidth, h = tip.offsetHeight;
    const x = Math.max(8, Math.min(r.left + r.width / 2 - w / 2, innerWidth - w - 8));
    let y = r.top - h - 12, lado = "arriba";
    if (y < 72) { y = r.bottom + 12; lado = "abajo"; }
    tip.style.left = x + "px"; tip.style.top = y + "px";
    tip.dataset.lado = lado;
    tip.style.setProperty("--flecha", (r.left + r.width / 2 - x) + "px");
  }
  function ocultarTip() {
    if (tipAncla) tipAncla.removeAttribute("aria-describedby");
    tipAncla = null; tip.hidden = true;
  }
  document.addEventListener("pointerover", (e) => { const el = e.target.closest(".info"); if (el && el !== tipAncla) mostrarTip(el); });
  document.addEventListener("pointerout", (e) => { const el = e.target.closest(".info"); if (el && !el.contains(e.relatedTarget)) ocultarTip(); });
  document.addEventListener("focusin", (e) => { const el = e.target.closest(".info"); if (el) mostrarTip(el); });
  document.addEventListener("focusout", (e) => { if (e.target.closest(".info")) ocultarTip(); });
  document.addEventListener("click", (e) => { const el = e.target.closest(".info"); if (el) mostrarTip(el); else ocultarTip(); });
  document.addEventListener("keydown", (e) => { if (e.key === "Escape") ocultarTip(); });
  window.addEventListener("scroll", ocultarTip, { passive: true });

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
