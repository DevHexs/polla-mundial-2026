# ⚽ Polla Mundial 2026 — UR Deliveries

¡Bienvenidos al centro de control del oráculo de **UR Deliveries**! Aquí es donde demostramos quién tiene la visión del fútbol de su lado y quién debería quedarse manejando la logística de envíos.


Esta es una aplicación web estática, limpia y elegante para seguir los puntajes de la polla interna del mundial de manera automática.

---

## 🏆 El Sistema de Puntos

*   **🎯 Marcador Exacto (3 Puntos):** Le atinaste a los dos marcadores perfectamente. Eres un dios del pronóstico.
*   **✅ Ganador o Empate (1 Punto):** Dijiste que ganaba local, y ganó local (pero con otros goles). Te llevas tu humilde punto de consolación.
*   **❌ Error Total (0 Puntos):** Mejor suerte para la próxima jornada de entregas.

---

## 💻 Ejecución Local

Para levantar el servidor localmente en macOS y ver los cálculos al instante:

```bash
python3 -m http.server 8888
```

Luego abre tu navegador en: 👉 [http://localhost:8888](http://localhost:8888)

---

## ⚙️ Cómo Actualizar el Dashboard

Todo corre del lado del cliente leyendo dos archivos JSON dentro de la carpeta `data/`:

### 1. Actualizar Marcadores Reales
Abre `data/matches.json`, busca el partido por su ID (ej. `A3`) y cambia:
*   `homeScore` y `awayScore` por los goles reales.
*   `status` de `"pending"` a `"finished"`.

### 2. Actualizar Predicciones
Abre `data/predictions.json` y edita o agrega los pronósticos de los participantes bajo su respectivo nombre.

Al guardar cualquiera de los dos archivos y recargar la página (`Cmd + R`), la tabla de posiciones y el podio se recalcularán de inmediato.

---

¡Que gane el mejor! 🏆⚽
