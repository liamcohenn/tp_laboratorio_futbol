# Sitio web (complemento opcional de la Parte 3)

Sitio estático (HTML/CSS/JS + Chart.js 4.4.1 + PapaParse 5.4.1 desde cdnjs), sin backend. Se publica con GitHub Pages desde la carpeta `/docs` de `main`.

## Datos: cómo reemplazar la muestra

El sitio busca primero `docs/data/ventas.csv`. Si no existe, usa `docs/data/ventas_MUESTRA.csv` (**datos ficticios**) y muestra un aviso rojo arriba de todo. Cuando el CSV real esté en su lugar, el aviso desaparece solo. No hay que tocar código.

Una fila por **venta con fee** de un jugador del plantel profesional:

| columna | tipo | obligatoria | nota |
|---|---|---|---|
| `jugador` | texto | sí | |
| `club_vendedor` | texto | sí | el club analizado (uno por liga) |
| `club_comprador` | texto | no | aparece en tooltips, ranking y comparador |
| `liga` | texto | sí | liga del club vendedor |
| `temporada_venta` | entero | sí | año de la venta, p. ej. `2021` |
| `grupo` | texto | sí | exactamente `cantera` o `comprado` |
| `fee_venta` | número | sí | **millones de €**, punto decimal (`12.5`) |
| `fee_compra` | número | sí | millones de €; `0` para cantera |
| `anios_en_club` | número | sí | años entre la llegada/debut y la venta |
| `edad_venta` | entero | no | |
| `rentabilidad` | número | no | si no está, se calcula `fee_venta − fee_compra` |

Exportar desde el notebook (Colab):

```python
cols = ["jugador", "club_vendedor", "club_comprador", "liga", "temporada_venta",
        "grupo", "fee_venta", "fee_compra", "anios_en_club", "edad_venta"]
df_ventas[cols].to_csv("ventas.csv", index=False)   # descargarlo y copiarlo a docs/data/
```

Las filas con `grupo` inválido o con `fee_venta`, `fee_compra`, `anios_en_club` o `temporada_venta` vacíos se descartan, y se avisa en la consola del navegador. Si falta una columna obligatoria, el sitio lo indica en pantalla.

Todos los números del sitio (dato destacado, gráficos, regresión del simulador, ranking, "Lo que dicen los números") se calculan en `js/app.js` a partir de este CSV.

## Lo que queda por completar a mano

Buscar `[completar` en `index.html`: interpretación de cada gráfico, respuesta a la pregunta, fuente de los datos, integrantes y revisión humana en el comentario de IA del principio.

## Verlo localmente

Al abrir `index.html` con doble clic no carga el CSV, porque el navegador bloquea `fetch` en `file://`. Se necesita un servidor local. Cualquiera de estas opciones sirve:

- VS Code: extensión **Live Server** → clic derecho en `docs/index.html` → *Open with Live Server*.
- `npx serve docs` (con Node instalado), desde la raíz del repo.
- `python -m http.server` dentro de `docs/` (con Python instalado).

## Publicar en GitHub Pages

El dueño del repo hace esto una vez: **Settings → Pages → Source: Deploy from a branch → `main` / `/docs` → Save**. Queda en `https://liamcohenn.github.io/tp_laboratorio_futbol/`.

## Uso de IA

Código generado con Claude Opus 5.5 (`claude-opus-5-5`) vía Claude Code, el 28/10/2026. El detalle está en el comentario al principio de `index.html`.
