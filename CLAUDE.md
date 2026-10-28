# TP Grupal — Laboratorio de Métodos Cuantitativos (FCE UBA, 2C 2026)

Repo del grupo para el trabajo práctico integrador grupal de la materia "Laboratorio de Métodos Cuantitativos Aplicados a la Gestión". Tema elegido: **fútbol**.

**Pregunta de investigación (ya definida):** ¿Qué peso y qué rentabilidad tienen las ventas de jugadores formados en inferiores frente a las de jugadores comprados?

**Dataset:** Transfermarkt (tablas `transfers`, `players`, `clubs`, `competitions`), descargado en `datos/raw/` — ver [`datos/raw/README.md`](datos/raw/README.md) para el detalle de columnas y la regla propuesta para clasificar "cantera" vs "comprado" a partir de los nombres de equipos juveniles/reserva en `from_club_name`.

Falta: acotar el análisis a un club o puñado de clubes/ligas (todo Transfermarkt es demasiado amplio).

Repo de la cátedra (solo lectura, ahí está la consigna completa en PDF): https://github.com/Datso653/Laboratorio-de-metodos-Cuantitativos-Aplicados-a-la-gestion — `Integradoras/TP_Grupal/tp_grupal_2C_2026.pdf`

Integrantes conocidos: Liam Cohen (GitHub: liamcohenn, dueño del repo), Renzo Bianco (GitHub: renzobianco). Completar si hay más integrantes.

## Entrega: viernes 6 de noviembre de 2026, antes del inicio de la clase

Nota: la inscripción del grupo (formulario con dataset y pregunta de investigación) vencía el 18 de octubre de 2026 — verificar con el grupo/docente si ya se completó.

## Qué hay que entregar (las 3 partes son obligatorias e independientes)

### 1. Notebook en Python (Google Colab → exportado a `.ipynb` en `notebooks/`)
- Completamente ejecutado al momento de la entrega (no se acepta un notebook sin correr).
- Cada bloque de código precedido por una celda Markdown explicando qué hace y por qué.
- Indicar qué celdas tuvieron asistencia de IA y qué prompt se usó.
- Carga y exploración inicial: `.head()`, `.tail()`, `.dtypes`, nulos, duplicados, `.describe()`.
- Una celda Markdown con la pregunta de investigación: cuál es, por qué vale la pena responderla, y (al final) qué respuesta encontraron.
- Al menos 2 transformaciones justificadas (filtrar, convertir tipos, columnas derivadas, manejo de nulos).
- Al menos 2 estadísticos de resumen agrupados con `.groupby()`.
- Mínimo 3 gráficos de tipos distintos (evolución/distribución, comparación entre categorías, relación entre dos variables), cada uno con título, ejes etiquetados, celda Markdown de interpretación, y exportado con `plt.savefig()` para el informe.

### 2. Informe académico en PDF (`informe/`)
- LaTeX/Overleaf (recomendado) o Word/Google Docs exportado a PDF.
- 3–5 páginas (sin portada ni referencias), redacción en tercera persona/impersonal.
- Estructura: Resumen (5-8 líneas) · Introducción (1/2 pág) · Datos y metodología (1/2 pág) · Resultados (1-2 pág, gráficos del notebook) · Conclusiones (1/2 pág) · Reflexión metodológica (1/4 pág, uso de IA y revisiones) · Bibliografía (opcional).
- Debe ser autónomo: un lector externo lo entiende sin abrir el notebook.
- Revisión intragrupal obligatoria antes de cerrar el documento (contrastar afirmaciones con el notebook/datos).

### 3. Presentación + defensa en vivo (`presentacion/`)
- Viernes 6/11, formato virtual, horario habitual de clase, máx. 10 min por grupo (exposición 5-7 min), todos los integrantes conectados.
- Diapositivas obligatorias hechas con IA (Canva Magic Design / PowerPoint Copilot), 6-10 slides.
- Complemento opcional (elegir 1 o ninguno): video explicativo (2-4 min) o sitio web desplegado (Streamlit/GitHub Pages) con los 3 gráficos, resultados y conclusiones.

## Reglas importantes
- **Repo con todos como colaboradores y commits reales de cada uno** — se revisa el historial para detectar "freeriders" (quien no tenga commits significativos no acredita el trabajo grupal, sin importar lo que diga el PDF de entrega).
- Dataset de libre elección, se valora originalidad; no hay restricción temática más allá de la elegida (fútbol).
- El repo debe contener al momento de la entrega, como mínimo: notebook `.ipynb`, PDF del informe, el dataset (o instrucciones para descargarlo) y el archivo/link de la presentación.

## Estructura de este repo
- `notebooks/` — notebook de Colab exportado.
- `datos/` — dataset o instrucciones para obtenerlo.
- `informe/` — informe académico en PDF (y link a Overleaf si aplica).
- `presentacion/` — slides/video/sitio web.
