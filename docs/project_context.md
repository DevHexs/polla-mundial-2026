# ⚽ Contexto del Proyecto: Polla Mundial 2026 — UR Deliveries

> [!IMPORTANT]
> **DOCUMENTO DE CONTEXTO PARA AGENTES DE IA**  
> Este archivo sirve como base de conocimiento para cualquier agente de IA que interactúe con el repositorio. **Con cada interacción que involucre cambios significativos o estructurales en el código, los datos o el flujo de trabajo, este documento DEBE ser actualizado para reflejar el estado actual del proyecto.**

---

## 📋 Resumen General
Este proyecto es una aplicación web estática, minimalista y elegante diseñada para gestionar y visualizar las posiciones de la "polla" (quiniela/porra de predicciones) de la fase de grupos del Mundial de la FIFA 2026 para el grupo interno de **UR Deliveries**.

La aplicación funciona 100% en el lado del cliente (frontend). No cuenta con base de datos tradicional ni servidor activo; toda la lógica se calcula dinámicamente en el navegador al leer archivos JSON.

---

## 🛠️ Stack Tecnológico
1.  **Core (HTML/JS)**: HTML5 semántico ([index.html](file:///Users/hex/Documents/polla-mundial-2026/index.html)) y JavaScript Vanilla ([app.js](file:///Users/hex/Documents/polla-mundial-2026/js/app.js)).
2.  **Estilos (CSS)**: CSS Vanilla ([style.css](file:///Users/hex/Documents/polla-mundial-2026/css/style.css)) con variables de diseño personalizadas y soporte responsivo para móviles.
3.  **Scripts de Soporte (Python)**: Scripts para importación y exportación de datos entre CSV y JSON.

---

## 📂 Estructura de Archivos del Proyecto
*   **[index.html](file:///Users/hex/Documents/polla-mundial-2026/index.html)**: Estructura principal del dashboard. Define las secciones principales (Posiciones, Predicciones, Fechas, Partidos), estadísticas generales y el modal para ver los detalles individuales de un participante.
*   **[css/style.css](file:///Users/hex/Documents/polla-mundial-2026/css/style.css)**: Estilos visuales de la aplicación, incluyendo animaciones, sombras, diseño de podio de posiciones y responsive design.
*   **[js/app.js](file:///Users/hex/Documents/polla-mundial-2026/js/app.js)**: Lógica y motor de puntos.
    *   Lee la información de [matches.json](file:///Users/hex/Documents/polla-mundial-2026/data/matches.json) y [predictions.json](file:///Users/hex/Documents/polla-mundial-2026/data/predictions.json).
    *   Calcula los standings ordenando a los participantes mediante [computeStandings](file:///Users/hex/Documents/polla-mundial-2026/js/app.js#L81).
    *   Determina los puntos por partido usando la función [scorePredict](file:///Users/hex/Documents/polla-mundial-2026/js/app.js#L56).
    *   Controla la navegación de pestañas (Tabs), filtros y la visualización de fechas en el huso horario de Panamá.
*   **Carpeta `data/`**:
    *   **[matches.json](file:///Users/hex/Documents/polla-mundial-2026/data/matches.json)**: Catálogo de partidos oficiales de la fase de grupos. Cada partido tiene un identificador único (ej. `A1`), los nombres de los equipos, banderas (emojis), fecha, hora UTC, marcador real (`homeScore`, `awayScore`) y estado (`status` que puede ser `"pending"` o `"finished"`).
    *   **[predictions.json](file:///Users/hex/Documents/polla-mundial-2026/data/predictions.json)**: Contiene la lista de participantes junto con sus respectivos avatares y el mapa de sus predicciones asignadas al ID de cada partido.
    *   **[group_dates.json](file:///Users/hex/Documents/polla-mundial-2026/data/group_dates.json)**: Información organizativa de los grupos del mundial.
*   **Carpeta `scripts/`**:
    *   **[csv_to_json.py](file:///Users/hex/Documents/polla-mundial-2026/scripts/csv_to_json.py)**: Script auxiliar en Python que traduce un archivo CSV con las apuestas ingresadas por los participantes a la estructura correspondiente en [predictions.json](file:///Users/hex/Documents/polla-mundial-2026/data/predictions.json). Resuelve inconsistencias de nombres y variaciones ortográficas de los países usando un diccionario de alias (`TEAM_ALIASES`).
    *   **[export_to_csv.py](file:///Users/hex/Documents/polla-mundial-2026/scripts/export_to_csv.py)**: Script auxiliar que permite exportar la información del archivo [predictions.json](file:///Users/hex/Documents/polla-mundial-2026/data/predictions.json) a un archivo CSV para análisis externos.

---

## 🏆 Sistema de Puntuación
La lógica implementada en [scorePredict](file:///Users/hex/Documents/polla-mundial-2026/js/app.js#L56) calcula los puntos de la siguiente manera:
*   **Marcador Exacto (3 Puntos):** Coincidencia perfecta de los goles del local y visitante predichos con los resultados reales.
*   **Acierto de Ganador o Empate (1 Punto):** Coincidencia del resultado general (ej. ganó local o empate) pero con un marcador de goles diferente.
*   **Error Total (0 Puntos):** Ningún acierto en el resultado ni en goles.

### Criterio de Desempate en Posiciones
Si dos o más participantes empatan en puntos, la clasificación los ordena bajo los siguientes criterios en orden de prioridad:
1.  Mayor puntaje total.
2.  Mayor cantidad de marcadores exactos (🎯).
3.  Mayor cantidad de aciertos de ganador/empate (✅).

---

## ⚙️ Flujo para Actualizar Marcadores
Para reportar el resultado de un partido finalizado:
1.  Abrir el archivo [matches.json](file:///Users/hex/Documents/polla-mundial-2026/data/matches.json).
2.  Buscar el objeto del partido mediante su `"id"` (ej. `A3`).
3.  Establecer los goles reales correspondientes en `"homeScore"` y `"awayScore"`.
4.  Cambiar `"status"` de `"pending"` a `"finished"`.
5.  Guardar los cambios y recargar el navegador. El dashboard recalculará la tabla de posiciones y el podio al instante.

---

## 💻 Ejecución Local
Para visualizar y probar la aplicación web localmente en macOS:
```bash
python3 -m http.server 8888
```
Abrir la dirección: 👉 [http://localhost:8888](http://localhost:8888)
