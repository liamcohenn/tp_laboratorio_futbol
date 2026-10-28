/* Gráficos del sitio (Chart.js 4). Reciben datos ya agregados desde app.js
   y leen los colores de los tokens CSS, así se adaptan al tema activo. */
(function () {
  const charts = {};
  let ultimo = null;

  const css = (v) => getComputedStyle(document.documentElement).getPropertyValue(v).trim();
  const fmt = (v) => v == null || isNaN(v) ? "—" : v.toLocaleString("es-AR", { maximumFractionDigits: 1, minimumFractionDigits: 1 }) + " M€";
  const fmtEje = (v) => v.toLocaleString("es-AR", { maximumFractionDigits: 0 });

  function paleta() {
    return {
      cantera: css("--cantera"), comprado: css("--comprado"),
      surface: css("--surface-1"), surface2: css("--surface-2"),
      grid: css("--grid"), line: css("--line"),
      t1: css("--text-1"), t2: css("--text-2"), t3: css("--text-3"),
    };
  }
  const alpha = (hex, a) => hex + Math.round(a * 255).toString(16).padStart(2, "0");

  function base(p) {
    Chart.defaults.font.family = "Inter, system-ui, sans-serif";
    Chart.defaults.font.size = 12;
    Chart.defaults.color = p.t2;
    Chart.defaults.borderColor = p.grid;
    return {
      responsive: true,
      maintainAspectRatio: false,
      animation: { duration: window.matchMedia("(prefers-reduced-motion: reduce)").matches ? 0 : 500 },
      plugins: {
        legend: { display: false },
        tooltip: {
          backgroundColor: p.surface2, titleColor: p.t1, bodyColor: p.t2, footerColor: p.t3,
          borderColor: p.line, borderWidth: 1, padding: 10, cornerRadius: 8,
          boxWidth: 10, boxHeight: 10, boxPadding: 4, usePointStyle: true,
          titleFont: { weight: "600" },
        },
      },
      scales: {},
    };
  }
  const eje = (p, titulo, extra = {}) => Object.assign({
    grid: { color: p.grid, drawTicks: false },
    border: { color: p.line },
    ticks: { color: p.t3, padding: 6 },
    title: { display: true, text: titulo, color: p.t2, font: { size: 12, weight: "500" } },
  }, extra);

  function evolucion(d, p) {
    const o = base(p);
    o.interaction = { mode: "index", intersect: false };
    o.scales.x = eje(p, "Temporada de venta", { grid: { display: false } });
    o.scales.y = eje(p, "Ingresos por ventas (M€)", { beginAtZero: true, ticks: { color: p.t3, callback: fmtEje } });
    o.plugins.tooltip.callbacks = {
      label: (c) => ` ${c.dataset.label}: ${fmt(c.parsed.y)} (${d.n[c.datasetIndex][c.dataIndex]} ventas)`,
    };
    const serie = (label, data, color) => ({
      label, data, borderColor: color, backgroundColor: alpha(color, .1), fill: true,
      borderWidth: 2, tension: .25, pointRadius: 4, pointHoverRadius: 6,
      pointBackgroundColor: color, pointBorderColor: p.surface, pointBorderWidth: 2,
    });
    return {
      type: "line",
      data: { labels: d.anios, datasets: [serie("Cantera", d.cantera, p.cantera), serie("Comprados", d.comprado, p.comprado)] },
      options: o,
    };
  }

  function promedio(d, p) {
    const o = base(p);
    o.scales.x = eje(p, "Club", { grid: { display: false }, ticks: { color: p.t3, autoSkip: false, maxRotation: 0 } });
    o.scales.y = eje(p, "Fee promedio de venta (M€)", { beginAtZero: true, ticks: { color: p.t3, callback: fmtEje } });
    o.plugins.tooltip.callbacks = {
      label: (c) => {
        const s = d.stats[c.datasetIndex][c.dataIndex];
        return s.n ? ` ${c.dataset.label}: promedio ${fmt(s.prom)} · mediana ${fmt(s.med)} · ${s.n} ventas` : ` ${c.dataset.label}: sin ventas`;
      },
    };
    const serie = (label, i, color) => ({
      label, data: d.stats[i].map((s) => s.n ? s.prom : null), backgroundColor: color,
      borderRadius: { topLeft: 4, topRight: 4 }, borderSkipped: "start",
      maxBarThickness: 24, categoryPercentage: .55, barPercentage: .9,
    });
    return {
      type: "bar",
      data: { labels: d.etiquetas, datasets: [serie("Cantera", 0, p.cantera), serie("Comprados", 1, p.comprado)] },
      options: o,
    };
  }

  function dispersion(d, p) {
    const o = base(p);
    o.scales.x = eje(p, "Años en el club antes de la venta", { type: "linear", beginAtZero: true });
    o.scales.y = eje(p, "Fee de venta (M€)", { beginAtZero: true, ticks: { color: p.t3, callback: fmtEje } });
    o.interaction = { mode: "nearest", intersect: true };
    o.plugins.tooltip.filter = (c) => c.dataset.type !== "line";
    o.plugins.tooltip.callbacks = {
      title: (cs) => cs[0].raw.r.jugador,
      label: (c) => {
        const r = c.raw.r;
        const out = [` ${r.club_vendedor} → ${r.club_comprador || "s/d"} (${r.temporada_venta})`,
          ` ${r.anios_en_club.toLocaleString("es-AR")} años en el club · venta ${fmt(r.fee_venta)}`];
        if (r.grupo === "comprado") out.push(` compra ${fmt(r.fee_compra)} · rentabilidad ${fmt(r.rentabilidad)}`);
        return out;
      },
    };
    const puntos = (label, rows, color) => ({
      label, data: rows.map((r) => ({ x: r.anios_en_club, y: r.fee_venta, r })),
      backgroundColor: alpha(color, .85), borderColor: p.surface, borderWidth: 2,
      pointRadius: 5, pointHoverRadius: 8, pointHitRadius: 8,
    });
    const recta = (label, reg, color) => reg ? {
      type: "line", label, data: [{ x: reg.xmin, y: reg.a + reg.b * reg.xmin }, { x: reg.xmax, y: reg.a + reg.b * reg.xmax }],
      borderColor: color, borderWidth: 2, borderDash: [6, 4], pointRadius: 0, fill: false,
    } : null;
    const ds = [puntos("Cantera", d.cantera, p.cantera), puntos("Comprados", d.comprado, p.comprado),
      recta("Tendencia cantera", d.regCantera, p.cantera), recta("Tendencia comprados", d.regComprado, p.comprado)].filter(Boolean);
    return { type: "scatter", data: { datasets: ds }, options: o };
  }

  const builders = { evolucion, promedio, dispersion };
  const ids = { evolucion: "g-evolucion", promedio: "g-promedio", dispersion: "g-dispersion" };

  function dibujar(datos) {
    ultimo = datos;
    const p = paleta();
    for (const k of Object.keys(builders)) {
      const cfg = builders[k](datos[k], p);
      if (charts[k]) {
        charts[k].data = cfg.data;
        charts[k].options = cfg.options;
        charts[k].update();
      } else {
        charts[k] = new Chart(document.getElementById(ids[k]), cfg);
      }
    }
  }

  function retema() {
    for (const k of Object.keys(charts)) { charts[k].destroy(); delete charts[k]; }
    if (ultimo) dibujar(ultimo);
  }

  window.Graficos = { dibujar, retema, fmt };
})();
