# Dataset crudo — Transfermarkt

Fuente: [dcaribou/transfermarkt-datasets](https://github.com/dcaribou/transfermarkt-datasets) (scraping de Transfermarkt, también publicado en Kaggle). Actualizado hasta el 2026-07-06 (el pipeline está pausado desde esa fecha, no hay ETA de reanudación).

## Cómo se obtuvo (reproducible sin cuenta de Kaggle)

```bash
curl -LO https://pub-e682421888d945d684bcae8890b0ec20.r2.dev/data/transfers.csv.gz
curl -LO https://pub-e682421888d945d684bcae8890b0ec20.r2.dev/data/players.csv.gz
curl -LO https://pub-e682421888d945d684bcae8890b0ec20.r2.dev/data/clubs.csv.gz
curl -LO https://pub-e682421888d945d684bcae8890b0ec20.r2.dev/data/competitions.csv.gz
gunzip -k *.csv.gz
```

Los `.csv.gz` quedan versionados en el repo (livianos, ~10 MB en total). Los `.csv` descomprimidos están en `.gitignore` porque se regeneran con el comando de arriba.

## Tablas incluidas

| Archivo | Filas | Contenido |
|---|---|---|
| `transfers.csv` | ~175.000 | Una fila por movimiento de jugador: `player_id`, `transfer_date`, `transfer_season`, `from_club_id`, `to_club_id`, `from_club_name`, `to_club_name`, `transfer_fee`, `market_value_in_eur`, `player_name` |
| `players.csv` | ~50.000 | Ficha de cada jugador: posición, pie hábil, nacionalidad, fecha de nacimiento, club actual, valor de mercado, etc. |
| `clubs.csv` | ~800 | Nombre, país y competencia doméstica de cada club |
| `competitions.csv` | ~65 | Catálogo de ligas/copas |

## Hallazgo clave para clasificar "cantera" vs "comprado"

`transfers.csv` **no** trae un flag explícito de "jugador propio". Pero el `from_club_name` de una promoción desde las inferiores sigue un patrón reconocible: el nombre del equipo juvenil/reserva del propio club, con sufijos como `U15`, `U16`, `U17`, `U19`, `U21`, `U23`, `Youth`, `B`, `II`, `Sub-15` (ej.: `"Ajax U21"`, `"Barça U19"`, `"Boca Juniors II"`, `"Benfica B"`).

Regla de clasificación propuesta para el notebook:

1. Para cada jugador, tomar su **primera transferencia** (`transfer_date` mínimo).
2. Si `from_club_name` matchea el patrón juvenil/reserva (regex tipo `U1[5-9]|U2[0-3]|Youth|Juvenil|Reserve|Sub-?\d{2}| II$|II\)| B$|B\)$`) **y** el nombre base coincide con el `to_club_name` de esa misma fila (ej. `"Ajax U21"` → `"Ajax"`), clasificar ese jugador como **cantera** del club al que fue promovido.
2. Si no matchea ese patrón, es una **compra** (transferencia externa real).

Ojo: esto clasifica la *llegada* del jugador al club. La pregunta de investigación es sobre las *ventas* — hay que cruzar esto con las transferencias de **salida** de cada club (próxima transferencia después de la promoción/compra) para calcular fee de venta y rentabilidad. Esa lógica va en el notebook, no acá.

## Limitaciones a mencionar en el informe

- El patrón de nombres de equipos juveniles no cubre el 100% de los clubes (algunos países nombran distinto sus reservas); conviene revisar manualmente los clubes que el grupo vaya a analizar en detalle.
- `transfer_fee` en 0 no siempre es "gratis": puede ser préstamo, fin de contrato o directamente un dato faltante en el scraping original — conviene chequear `market_value_in_eur` como referencia cruzada.
