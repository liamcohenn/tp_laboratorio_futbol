// Genera docs/data/ventas.csv a partir del dataset crudo de Transfermarkt
// (datos/raw/{transfers,players,clubs,competitions}.csv), clasificando cada
// venta como "cantera" o "comprado" según el patrón de nombres de equipos
// juveniles/reserva documentado en datos/raw/README.md.
//
// Uso: node datos/scripts/build_ventas.js

const fs = require("fs");
const path = require("path");

const RAW = path.join(__dirname, "..", "raw");
const OUT = path.join(__dirname, "..", "..", "docs", "data", "ventas.csv");

function parseCsv(text) {
  const lines = text.split(/\r?\n/).filter((l) => l.length > 0);
  const header = splitCsvLine(lines[0]);
  const rows = [];
  for (let i = 1; i < lines.length; i++) {
    const fields = splitCsvLine(lines[i]);
    if (fields.length !== header.length) continue;
    const row = {};
    header.forEach((h, idx) => (row[h] = fields[idx]));
    rows.push(row);
  }
  return rows;
}

function splitCsvLine(line) {
  const out = [];
  let cur = "";
  let inQuotes = false;
  for (let i = 0; i < line.length; i++) {
    const c = line[i];
    if (inQuotes) {
      if (c === '"' && line[i + 1] === '"') {
        cur += '"';
        i++;
      } else if (c === '"') {
        inQuotes = false;
      } else {
        cur += c;
      }
    } else if (c === '"') {
      inQuotes = true;
    } else if (c === ",") {
      out.push(cur);
      cur = "";
    } else {
      cur += c;
    }
  }
  out.push(cur);
  return out;
}

const transfers = parseCsv(fs.readFileSync(path.join(RAW, "transfers.csv"), "utf8"));
const players = parseCsv(fs.readFileSync(path.join(RAW, "players.csv"), "utf8"));

const dobById = new Map();
for (const p of players) dobById.set(p.player_id, p.date_of_birth);

// Clubes analizados: uno por liga, elegidos por tener historial fuerte y bien
// documentado de ventas de cantera en este dataset (ver datos/raw/README.md).
const CLUBS = [
  { id: "131", name: "FC Barcelona", liga: "LaLiga (España)", baseNames: ["Barcelona", "Barça"] },
  { id: "610", name: "Ajax Amsterdam", liga: "Eredivisie (Países Bajos)", baseNames: ["Ajax"] },
  { id: "294", name: "SL Benfica", liga: "Liga Portugal", baseNames: ["Benfica"] },
  { id: "189", name: "Boca Juniors", liga: "Liga Profesional Argentina", baseNames: ["Boca Juniors"] },
];

function isYouthArrival(fromClubName, baseNames) {
  const pattern = new RegExp(
    `^(${baseNames.join("|")})\\s*(U1[5-9]|U2[0-3]|Youth|Sub-?\\d{2}|II|B)\\b`,
    "i"
  );
  return pattern.test(fromClubName.trim());
}

function yearsBetween(d1, d2) {
  const a = new Date(d1);
  const b = new Date(d2);
  return Math.round(((b - a) / (1000 * 60 * 60 * 24 * 365.25)) * 10) / 10;
}

function ageAt(dob, date) {
  if (!dob) return "";
  const a = new Date(dob);
  const b = new Date(date);
  let age = b.getFullYear() - a.getFullYear();
  const m = b.getMonth() - a.getMonth();
  if (m < 0 || (m === 0 && b.getDate() < a.getDate())) age--;
  return age;
}

const rows = [];
let discardedNoDeparture = 0;
let discardedFreeDeparture = 0;

for (const club of CLUBS) {
  const events = transfers.filter(
    (t) => t.from_club_id === club.id || t.to_club_id === club.id
  );
  const byPlayer = new Map();
  for (const e of events) {
    if (!byPlayer.has(e.player_id)) byPlayer.set(e.player_id, []);
    byPlayer.get(e.player_id).push(e);
  }

  for (const [playerId, evs] of byPlayer) {
    evs.sort((a, b) => new Date(a.transfer_date) - new Date(b.transfer_date));

    let stintStart = null; // { date, grupo, feeCompra }

    for (const e of evs) {
      const isArrival = e.to_club_id === club.id;
      const isDeparture = e.from_club_id === club.id;

      if (isArrival && !stintStart) {
        const grupo = isYouthArrival(e.from_club_name, club.baseNames) ? "cantera" : "comprado";
        stintStart = {
          date: e.transfer_date,
          grupo,
          feeCompra: grupo === "cantera" ? 0 : Number(e.transfer_fee) / 1e6,
        };
      } else if (isDeparture && stintStart) {
        const feeVenta = Number(e.transfer_fee) / 1e6;
        if (feeVenta > 0) {
          rows.push({
            jugador: e.player_name,
            club_vendedor: club.name,
            club_comprador: e.to_club_name,
            liga: club.liga,
            temporada_venta: new Date(e.transfer_date).getFullYear(),
            grupo: stintStart.grupo,
            fee_venta: feeVenta.toFixed(3),
            fee_compra: stintStart.feeCompra.toFixed(3),
            anios_en_club: yearsBetween(stintStart.date, e.transfer_date),
            edad_venta: ageAt(dobById.get(playerId), e.transfer_date),
          });
        } else {
          discardedFreeDeparture++;
        }
        stintStart = null; // cierra el pase; una nueva llegada abriría otro
      }
    }
    if (stintStart) discardedNoDeparture++; // sigue en el club, sin venta todavía
  }
}

const cols = [
  "jugador",
  "club_vendedor",
  "club_comprador",
  "liga",
  "temporada_venta",
  "grupo",
  "fee_venta",
  "fee_compra",
  "anios_en_club",
  "edad_venta",
];

const csv = [cols.join(",")]
  .concat(
    rows.map((r) =>
      cols
        .map((c) => {
          const v = String(r[c] ?? "");
          return /[",\n]/.test(v) ? `"${v.replace(/"/g, '""')}"` : v;
        })
        .join(",")
    )
  )
  .join("\n");

fs.mkdirSync(path.dirname(OUT), { recursive: true });
fs.writeFileSync(OUT, csv, "utf8");

const canteraCount = rows.filter((r) => r.grupo === "cantera").length;
console.log(`Filas generadas: ${rows.length} (cantera: ${canteraCount}, comprado: ${rows.length - canteraCount})`);
console.log(`Stints sin venta registrada todavía (jugador sigue/sigue en el club): ${discardedNoDeparture}`);
console.log(`Salidas descartadas por no tener fee (préstamo/fin de contrato/libre): ${discardedFreeDeparture}`);
console.log(`Escrito en ${OUT}`);
