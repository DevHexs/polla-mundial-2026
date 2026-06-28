// ===== POLLA MUNDIAL 2026 — Motor de puntos =====

const POINTS_EXACT = 3;
const POINTS_WINNER = 1;

let matchesData = [];
let predictionsData = [];
let groupDatesData = {};

// ===== BOOT =====
document.addEventListener("DOMContentLoaded", () => {
  // Limpiar datos obsoletos de predicciones del localStorage (ya no se usa)
  localStorage.removeItem("ur_predictions_data");
  Promise.all([
    fetch("data/matches.json").then((r) => r.json()),
    fetch("data/predictions.json").then((r) => r.json()),
    fetch("data/group_dates.json").then((r) => r.json()),
  ])
    .then(([matches, predictions, groupDates]) => {
      matchesData = matches.sort((a, b) => {
        const aInfo = getPanamaDateTime(a);
        const bInfo = getPanamaDateTime(b);
        return aInfo.sortValue.localeCompare(bInfo.sortValue);
      });
      // Siempre usar el JSON como fuente de verdad (ignorar localStorage)
      predictionsData = predictions;
      groupDatesData = groupDates;
      init();
    })
    .catch((err) => {
      console.error("Error cargando datos:", err);
      document.getElementById("loading-msg").textContent =
        "⚠️ No se pudieron cargar los datos. Abre el archivo en un servidor local.";
    });
});

// ===== INIT =====
function init() {
  const standings = computeStandings();
  renderStats();
  renderPodium(standings);
  renderRankingTable(standings);
  renderMatches();
  renderPredictionsTab(standings);
  initDatesTab();
  renderBracket();
  setupTabs();
  setupModal();
  setupBracketPredModal();
}

// ===== PUNTOS =====
function getMatchResult(match) {
  if (match.status !== "finished") return null;
  if (match.homeScore === null || match.awayScore === null) return null;
  if (match.homeScore > match.awayScore) return "home";
  if (match.awayScore > match.homeScore) return "away";
  return "draw";
}

function scorePredict(prediction, match) {
  if (!prediction) return { points: 0, type: "no-pred" };
  if (match.status !== "finished") return { points: 0, type: "pending" };

  const realResult = getMatchResult(match);
  const { homeScore, awayScore } = prediction;

  // Exact
  if (homeScore === match.homeScore && awayScore === match.awayScore) {
    return { points: POINTS_EXACT, type: "exact" };
  }

  // Winner / draw
  let predResult = null;
  if (homeScore > awayScore) predResult = "home";
  else if (awayScore > homeScore) predResult = "away";
  else predResult = "draw";

  if (predResult === realResult) {
    return { points: POINTS_WINNER, type: "winner" };
  }

  return { points: 0, type: "wrong" };
}

function computeStandings() {
  return predictionsData
    .map((participant) => {
      let totalPoints = 0,
        exactCount = 0,
        winnerCount = 0,
        predictedCount = 0;

      matchesData.forEach((match) => {
        const pred = participant.predictions[match.id];
        const result = scorePredict(pred, match);
        if (pred) predictedCount++;
        totalPoints += result.points;
        if (result.type === "exact") exactCount++;
        if (result.type === "winner") winnerCount++;
      });

      return {
        name: participant.name,
        avatar: participant.avatar,
        totalPoints,
        exactCount,
        winnerCount,
        predictedCount,
        predictions: participant.predictions,
      };
    })
    .sort((a, b) => {
      if (b.totalPoints !== a.totalPoints) return b.totalPoints - a.totalPoints;
      if (b.exactCount !== a.exactCount) return b.exactCount - a.exactCount;
      return b.winnerCount - a.winnerCount;
    });
}

// ===== STATS GENERALES =====
function renderStats() {
  const finished = matchesData.filter((m) => m.status === "finished").length;
  const pending = matchesData.filter((m) => m.status === "pending").length;
  const live = matchesData.filter((m) => m.status === "live").length;

  document.getElementById("stat-finished").textContent = finished;
  document.getElementById("stat-pending").textContent = pending + live;
  document.getElementById("stat-total").textContent = matchesData.length;
  document.getElementById("stat-participants").textContent =
    predictionsData.length;
}

// ===== PODIO TOP 3 =====
function renderPodium(standings) {
  const medals = ["🥇", "🥈", "🥉"];
  const rankClasses = ["rank-1", "rank-2", "rank-3"];
  const container = document.getElementById("podium-container");
  container.innerHTML = "";

  standings.slice(0, 3).forEach((p, i) => {
    const card = document.createElement("div");
    card.className = `podium-card ${rankClasses[i]}`;
    card.innerHTML = `
      <span class="podium-medal">${medals[i]}</span>
      <div class="podium-name">${p.avatar} ${p.name}</div>
      <div class="podium-pts">${p.totalPoints}</div>
      <div class="podium-pts-label">puntos</div>
      <div class="podium-breakdown">
        <span class="badge-exact">🎯 ${p.exactCount} exactos</span>
        <span class="badge-winner">✅ ${p.winnerCount} ganador</span>
      </div>
    `;
    card.addEventListener("click", () => openModal(p));
    container.appendChild(card);
  });
}

// ===== TABLA DE POSICIONES =====
function renderRankingTable(standings) {
  const tbody = document.getElementById("ranking-body");
  tbody.innerHTML = "";

  standings.forEach((p, i) => {
    const rank = i + 1;
    let rankHtml;
    if (rank === 1) rankHtml = `<span class="rank-badge r1">🥇</span>`;
    else if (rank === 2) rankHtml = `<span class="rank-badge r2">🥈</span>`;
    else if (rank === 3) rankHtml = `<span class="rank-badge r3">🥉</span>`;
    else rankHtml = `<span class="rank-badge rn">${rank}</span>`;

    const row = document.createElement("div");
    row.className = "ranking-row";
    row.innerHTML = `
      <div class="col-rank">${rankHtml}</div>
      <div class="col-name">
        <span class="avatar-circle" style="background: rgba(0,0,0,0.04); font-size:1.1rem;">${p.avatar}</span>
        ${p.name}
      </div>
      <div class="col-pts">${p.totalPoints}</div>
      <div class="col-exact">🎯 ${p.exactCount}</div>
      <div class="col-winner">✅ ${p.winnerCount}</div>
      <div class="col-total">${p.predictedCount}</div>
    `;
    row.addEventListener("click", () => openModal(p));
    tbody.appendChild(row);
  });
}

// ===== PARTIDOS =====
const GROUPS_ORDER = [
  "A",
  "B",
  "C",
  "D",
  "E",
  "F",
  "G",
  "H",
  "I",
  "J",
  "K",
  "L",
  "R32",
  "R16",
  "QF",
  "SF",
  "FINAL",
];
const GROUPS_NAMES = {
  A: "Grupo A — México, Sudáfrica, Corea del Sur, Chequia",
  B: "Grupo B — Canadá, Bosnia y Herz., Qatar, Suiza",
  C: "Grupo C — Brasil, Marruecos, Escocia, Haití",
  D: "Grupo D — Estados Unidos, Paraguay, Australia, Türkiye",
  E: "Grupo E — Alemania, Curaçao, Costa de Marfil, Ecuador",
  F: "Grupo F — Países Bajos, Japón, Suecia, Túnez",
  G: "Grupo G — Bélgica, Egipto, Irán, Nueva Zelanda",
  H: "Grupo H — España, Cabo Verde, Arabia Saudita, Uruguay",
  I: "Grupo I — Francia, Senegal, Irak, Noruega",
  J: "Grupo J — Argentina, Argelia, Austria, Jordania",
  K: "Grupo K — Portugal, Uzbekistán, Colombia, RD Congo",
  L: "Grupo L — Inglaterra, Croacia, Ghana, Panamá",
  R32: "Dieciseisavos de Final (16avos)",
  R16: "Octavos de Final",
  QF: "Cuartos de Final",
  SF: "Semifinales",
  FINAL: "Final y Tercer Puesto",
};

function formatDate(dateStr) {
  const [y, m, d] = dateStr.split("-").map(Number);
  const date = new Date(y, m - 1, d);
  return date.toLocaleDateString("es", { day: "numeric", month: "short" });
}

function formatPanamaTime(utcTimeStr) {
  if (!utcTimeStr) return "";
  const [h, m] = utcTimeStr.split(":").map(Number);
  const panamaHour = (h - 5 + 24) % 24;
  const ampm = panamaHour >= 12 ? "p.m." : "a.m.";
  let displayHour = panamaHour % 12;
  if (displayHour === 0) displayHour = 12;
  return `${displayHour}:${String(m).padStart(2, "0")} ${ampm}`;
}

function getPanamaDateTime(match) {
  if (!match.time) return { sortValue: match.date + "T99:99", dateStr: match.date, timeStr: "" };
  
  const [y, m, d] = match.date.split("-").map(Number);
  const [h, min] = match.time.split(":").map(Number);
  
  // Rule: If UTC hour is between 0 and 6, the match takes place on the next day in UTC compared to local date
  let utcDay = d;
  if (h >= 0 && h <= 6) {
    utcDay = d + 1;
  }
  
  const utcDate = new Date(Date.UTC(y, m - 1, utcDay, h, min));
  
  // Subtract 5 hours from UTC timestamp to get Panama time
  const panamaTimeMs = utcDate.getTime() - (5 * 60 * 60 * 1000);
  const panamaDate = new Date(panamaTimeMs);
  
  const pY = panamaDate.getUTCFullYear();
  const pM = String(panamaDate.getUTCMonth() + 1).padStart(2, "0");
  const pD = String(panamaDate.getUTCDate()).padStart(2, "0");
  const dateStr = `${pY}-${pM}-${pD}`;
  
  const pH = panamaDate.getUTCHours();
  const pMin = panamaDate.getUTCMinutes();
  const sortValue = `${dateStr}T${String(pH).padStart(2, "0")}:${String(pMin).padStart(2, "0")}`;
  
  return { sortValue, dateStr, timeStr: formatPanamaTime(match.time) };
}

function renderMatches() {
  const container = document.getElementById("matches-container");
  container.innerHTML = "";

  GROUPS_ORDER.forEach((group) => {
    const groupMatches = matchesData.filter((m) => m.group === group);
    if (groupMatches.length === 0) return;

    const section = document.createElement("div");
    section.className = "group-section";

    const title = document.createElement("div");
    title.className = "group-title";
    title.textContent = GROUPS_NAMES[group] || `Grupo ${group}`;
    section.appendChild(title);

    const list = document.createElement("div");
    list.className = "matches-list";

    groupMatches.forEach((match) => {
      const card = document.createElement("div");
      card.className = `match-card status-${match.status}`;

      const isFinished = match.status === "finished";
      const isLive = match.status === "live";

      const scoreHtml =
        isFinished || isLive
          ? `<div class="score-box">${match.homeScore}</div>
           <span class="score-separator">–</span>
           <div class="score-box">${match.awayScore}</div>`
          : `<div class="score-pending">vs</div>`;

      const statusLabel = isFinished
        ? "Finalizado"
        : isLive
          ? "🔴 En vivo"
          : (match.time ? formatPanamaTime(match.time) : "Pendiente");
      const statusClass = isFinished ? "finished" : isLive ? "live" : "pending";

      card.innerHTML = `
        <div class="match-team home">
          <span class="team-flag">${match.homeFlag}</span>
          <span class="team-name">${match.home}</span>
        </div>
        <div class="match-score">${scoreHtml}</div>
        <div class="match-team away">
          <span class="team-flag">${match.awayFlag}</span>
          <span class="team-name">${match.away}</span>
        </div>
        <div class="match-date-col">
          <span class="match-date">${formatDate(getPanamaDateTime(match).dateStr)}</span>
          <span class="status-pill ${statusClass}">${statusLabel}</span>
        </div>
      `;
      list.appendChild(card);
    });

    section.appendChild(list);
    container.appendChild(section);
  });
}

// ===== MODAL DETALLE PARTICIPANTE =====
function openModal(participant) {
  const overlay = document.getElementById("modal-overlay");
  const ptsTxt = `${participant.totalPoints} pts · 🎯 ${participant.exactCount} exactos · ✅ ${participant.winnerCount} ganador`;

  const avatarEl = document.getElementById("modal-avatar-txt");
  avatarEl.textContent = participant.avatar;
  avatarEl.style.fontSize = "1.4rem";
  avatarEl.style.background = "rgba(255,255,255,0.2)";
  document.getElementById("modal-participant-name").textContent =
    participant.name;
  document.getElementById("modal-participant-pts").textContent = ptsTxt;

  const body = document.getElementById("modal-body");
  body.innerHTML = "";

  // Group by group letter
  const hasPreds = Object.keys(participant.predictions).length > 0;

  if (!hasPreds) {
    body.innerHTML = `<div class="empty-state">
      <span class="empty-icon">📝</span>
      <p>Las predicciones de <strong>${participant.name}</strong> aún no han sido ingresadas.</p>
    </div>`;
  } else {
    GROUPS_ORDER.forEach((group) => {
      const groupMatches = matchesData.filter((m) => m.group === group);
      const groupPreds = groupMatches.filter(
        (m) => participant.predictions[m.id],
      );
      if (groupPreds.length === 0) return;

      const groupTitle = document.createElement("div");
      groupTitle.className = "modal-group-title";
      groupTitle.textContent = GROUPS_NAMES[group] || `Grupo ${group}`;
      body.appendChild(groupTitle);

      groupMatches.forEach((match) => {
        const pred = participant.predictions[match.id];
        const result = scorePredict(pred, match);

        const row = document.createElement("div");
        row.className = "pred-row";

        const homeShort = match.home.split(" ")[0];
        const awayShort = match.away.split(" ")[0];
        const predScore = pred ? `${pred.homeScore} – ${pred.awayScore}` : "—";

        let resultHtml = "";
        if (!pred) {
          resultHtml = `<span class="pred-result no-pred">Sin pred.</span>`;
        } else if (result.type === "pending") {
          resultHtml = `<span class="pred-result pending">${match.time ? formatPanamaTime(match.time) : 'Pendiente'}</span>`;
        } else if (result.type === "exact") {
          resultHtml = `<span class="pred-result exact">🎯 +${POINTS_EXACT}pts</span>`;
        } else if (result.type === "winner") {
          resultHtml = `<span class="pred-result winner">✅ +${POINTS_WINNER}pt</span>`;
        } else {
          resultHtml = `<span class="pred-result wrong">❌ 0pts</span>`;
        }

        row.innerHTML = `
          <div class="pred-teams">${homeShort} vs ${awayShort}</div>
          <div class="pred-score">${predScore}</div>
          ${resultHtml}
        `;
        body.appendChild(row);
      });
    });
  }

  overlay.classList.add("open");
  document.body.style.overflow = "hidden";
}

function closeModal() {
  document.getElementById("modal-overlay").classList.remove("open");
  document.body.style.overflow = "";
}

function setupModal() {
  document
    .getElementById("modal-close-btn")
    .addEventListener("click", closeModal);
  document.getElementById("modal-overlay").addEventListener("click", (e) => {
    if (e.target === e.currentTarget) closeModal();
  });
  document.addEventListener("keydown", (e) => {
    if (e.key === "Escape") closeModal();
  });
}

// ===== TABS =====
function setupTabs() {
  const tabs = document.querySelectorAll(".tab-btn");
  const contents = document.querySelectorAll(".tab-content");

  tabs.forEach((btn) => {
    btn.addEventListener("click", () => {
      tabs.forEach((t) => t.classList.remove("active"));
      contents.forEach((c) => c.classList.remove("active"));
      btn.classList.add("active");
      document.getElementById(btn.dataset.tab).classList.add("active");

      // Redraw SVG connectors when bracket tab becomes visible
      if (btn.dataset.tab === "tab-bracket") {
        requestAnimationFrame(() => {
          const tree = document.getElementById("bracket-tree");
          if (tree && tree.children.length > 0) {
            const matchesMap = {};
            matchesData.forEach((m) => { matchesMap[m.id] = m; });
            const roundsConfig = [
              { key: "R16", matches: ["R16_1","R16_2","R16_3","R16_4","R16_5","R16_6","R16_7","R16_8"] },
              { key: "QF",  matches: ["QF_1","QF_2","QF_3","QF_4"] },
              { key: "SF",  matches: ["SF_1","SF_2"] },
            ];
            drawBracketConnectors(tree, roundsConfig, matchesMap);
          }
        });
      }
    });
  });
}

// ===== VISTA DE PREDICCIONES POR PARTICIPANTE =====
let selectedParticipantName = "";

function renderPredictionsTab(standings) {
  const container = document.getElementById("participants-selector-container");
  if (!container) return;

  container.innerHTML = "";

  if (standings.length === 0) return;

  // Seleccionar por defecto al primero de la tabla
  if (
    !selectedParticipantName ||
    !standings.some((s) => s.name === selectedParticipantName)
  ) {
    selectedParticipantName = standings[0].name;
  }

  standings.forEach((p) => {
    const btn = document.createElement("button");
    btn.className = `selector-btn ${p.name === selectedParticipantName ? "active" : ""}`;
    btn.innerHTML = `<span class="avatar-circle" style="width:22px; height:22px; font-size:0.9rem; display:inline-flex; margin-right:6px; background:rgba(0,0,0,0.04);">${p.avatar}</span> ${p.name}`;
    btn.addEventListener("click", () => {
      selectedParticipantName = p.name;
      document
        .querySelectorAll(".selector-btn")
        .forEach((b) => b.classList.remove("active"));
      btn.classList.add("active");
      renderParticipantPredictions(p.name);
    });
    container.appendChild(btn);
  });

  // Agregar event listeners a los filtros (una sola vez)
  const groupSelect = document.getElementById("filter-group-select");
  const statusSelect = document.getElementById("filter-status-select");

  if (groupSelect && !groupSelect.dataset.listener) {
    groupSelect.dataset.listener = "true";
    groupSelect.addEventListener("change", () => {
      renderParticipantPredictions(selectedParticipantName);
    });

    // Determinar el valor default de grupo (fase) según la fecha actual (solo 16avos en adelante)
    const today = new Date();
    const yyyy = today.getFullYear();
    const mm = String(today.getMonth() + 1).padStart(2, "0");
    const dd = String(today.getDate()).padStart(2, "0");
    const todayStr = `${yyyy}-${mm}-${dd}`;

    const phases = ["R32", "R16", "QF", "SF", "FINAL"];
    let matchedPhase = null;

    // 1. Buscar coincidencia exacta de fecha
    for (const phase of phases) {
      const matches = groupDatesData[phase] || [];
      if (matches.some((m) => m.date === todayStr)) {
        matchedPhase = phase;
        break;
      }
    }

    // 2. Si no hay coincidencia exacta (por ejemplo, día de descanso), buscar por rango [minDate, maxDate]
    if (!matchedPhase) {
      for (const phase of phases) {
        const matches = groupDatesData[phase] || [];
        if (matches.length > 0) {
          const dates = matches.map((m) => m.date).sort();
          const minDate = dates[0];
          const maxDate = dates[dates.length - 1];
          if (todayStr >= minDate && todayStr <= maxDate) {
            matchedPhase = phase;
            break;
          }
        }
      }
    }

    // 3. Si sigue sin haber coincidencia, buscar la fase más cercana a la fecha de hoy
    if (!matchedPhase) {
      let closestPhase = null;
      let minDiff = Infinity;
      const todayMs = new Date(yyyy, today.getMonth(), today.getDate()).getTime();

      for (const phase of phases) {
        const matches = groupDatesData[phase] || [];
        if (matches.length > 0) {
          const dates = matches.map((m) => m.date).sort();
          const minDateStr = dates[0];
          const [y, m, d] = minDateStr.split("-").map(Number);
          const phaseStartMs = new Date(y, m - 1, d).getTime();

          const diff = Math.abs(phaseStartMs - todayMs);
          if (diff < minDiff) {
            minDiff = diff;
            closestPhase = phase;
          }
        }
      }

      if (closestPhase && todayStr >= "2026-06-28") {
        matchedPhase = closestPhase;
      }
    }

    if (matchedPhase) {
      groupSelect.value = matchedPhase;
    }
  }

  if (statusSelect && !statusSelect.dataset.listener) {
    statusSelect.dataset.listener = "true";
    statusSelect.addEventListener("change", () => {
      renderParticipantPredictions(selectedParticipantName);
    });
  }

  renderParticipantPredictions(selectedParticipantName);
}

function renderParticipantPredictions(name) {
  const grid = document.getElementById("predictions-grid-container");
  if (!grid) return;

  grid.innerHTML = "";

  const participant = predictionsData.find((p) => p.name === name);
  if (!participant) return;

  const groupFilter =
    document.getElementById("filter-group-select")?.value || "ALL";
  const statusFilter =
    document.getElementById("filter-status-select")?.value || "ALL";

  // Filtrar partidos
  let filteredMatches = [...matchesData];
  if (groupFilter !== "ALL") {
    filteredMatches = filteredMatches.filter((m) => m.group === groupFilter);
  }
  if (statusFilter !== "ALL") {
    filteredMatches = filteredMatches.filter((m) => m.status === statusFilter);
  }

  if (filteredMatches.length === 0) {
    grid.innerHTML = `
      <div class="empty-state" style="grid-column: 1 / -1; padding: 48px; text-align: center; color: var(--text-muted);">
        <span style="font-size: 2.5rem; display: block; margin-bottom: 8px;">🔍</span>
        <p>No se encontraron partidos para los filtros seleccionados.</p>
      </div>
    `;
    return;
  }

  // Ordenar partidos por fecha y hora en Panamá
  const sortedMatches = filteredMatches.sort((a, b) => {
    const aInfo = getPanamaDateTime(a);
    const bInfo = getPanamaDateTime(b);
    return aInfo.sortValue.localeCompare(bInfo.sortValue);
  });

  sortedMatches.forEach((match) => {
    const pred = participant.predictions[match.id];
    const result = scorePredict(pred, match);

    const isFinished = match.status === "finished";
    const isLive = match.status === "live";

    const card = document.createElement("div");
    card.className = "pred-card";

    let resultHtml = "";
    let borderStyle = "";
    if (!pred) {
      resultHtml = `<span class="pred-result no-pred">Sin pred.</span>`;
      borderStyle = "border-left: 4px solid var(--border);";
    } else if (result.type === "pending") {
      resultHtml = `<span class="pred-result pending">Pendiente</span>`;
      borderStyle = "border-left: 4px solid var(--border);";
    } else if (result.type === "exact") {
      resultHtml = `<span class="pred-result exact">🎯 +${POINTS_EXACT}pts</span>`;
      borderStyle = "border-left: 4px solid var(--success);";
    } else if (result.type === "winner") {
      resultHtml = `<span class="pred-result winner">✅ +${POINTS_WINNER}pt</span>`;
      borderStyle = "border-left: 4px solid var(--warning);";
    } else {
      resultHtml = `<span class="pred-result wrong">❌ 0pts</span>`;
      borderStyle = "border-left: 4px solid var(--danger);";
    }

    card.style = borderStyle;

    const predScoreStr = pred ? `${pred.homeScore} – ${pred.awayScore}` : "—";
    const realScoreHtml =
      isFinished || isLive
        ? `<span class="real-score-footer">Real: <strong>${match.homeScore} – ${match.awayScore}</strong></span>`
        : "";

    const scoreDisplayHtml = `
      <div class="pred-card-prediction-score">
        <div class="pred-score-val">${predScoreStr}</div>
        <div class="pred-score-label">Predicción</div>
      </div>
    `;

    card.innerHTML = `
      <div class="pred-card-header">
        <span>Grupo ${match.group}</span>
        <span>ID: ${match.id}</span>
      </div>
      <div class="pred-card-body">
        <div class="pred-card-team home">
          <span class="team-flag">${match.homeFlag}</span>
          <span class="team-name" style="font-size:0.8rem;">${match.home.split(" ")[0]}</span>
        </div>
        ${scoreDisplayHtml}
        <div class="pred-card-team away">
          <span class="team-flag">${match.awayFlag}</span>
          <span class="team-name" style="font-size:0.8rem;">${match.away.split(" ")[0]}</span>
        </div>
      </div>
      <div class="pred-card-footer">
        <div style="display:flex; flex-direction:column; gap:2px; align-items:flex-start;">
          <span class="status-date" style="font-size:0.65rem; color: var(--text-muted); font-weight:500;">
            ${isFinished ? "Finalizado" : isLive ? "🔴 En vivo" : (match.time ? `${formatDate(getPanamaDateTime(match).dateStr)} · ${formatPanamaTime(match.time)}` : formatDate(getPanamaDateTime(match).dateStr))}
          </span>
          ${realScoreHtml}
        </div>
        ${resultHtml}
      </div>
    `;
    grid.appendChild(card);
  });
}

// ===== TAB: FECHAS (PARTIDOS DEL DÍA Y SUS PRONÓSTICOS) =====
let selectedDateStr = "";

function initDatesTab() {
  const dateSelect = document.getElementById("date-select");
  if (!dateSelect) return;

  // Extraer fechas únicas y ordenarlas cronológicamente
  const uniqueDates = [...new Set(matchesData.map((m) => getPanamaDateTime(m).dateStr))].sort();

  dateSelect.innerHTML = "";
  uniqueDates.forEach((dateVal) => {
    const opt = document.createElement("option");
    opt.value = dateVal;

    // Formatear fecha para el usuario
    const [y, m, d] = dateVal.split("-").map(Number);
    const dateObj = new Date(y, m - 1, d);
    const formatted = dateObj.toLocaleDateString("es", {
      weekday: "long",
      day: "numeric",
      month: "long",
    });
    opt.textContent = formatted.charAt(0).toUpperCase() + formatted.slice(1);

    dateSelect.appendChild(opt);
  });

  // Preseleccionar la fecha actual del sistema, o la más cercana disponible
  const today = new Date();
  const yyyy = today.getFullYear();
  const mm = String(today.getMonth() + 1).padStart(2, "0");
  const dd = String(today.getDate()).padStart(2, "0");
  const todayStr = `${yyyy}-${mm}-${dd}`;

  if (uniqueDates.includes(todayStr)) {
    selectedDateStr = todayStr;
  } else if (uniqueDates.length > 0) {
    // Buscar la fecha más cercana disponible en el calendario de partidos
    const todayMs = new Date(yyyy, today.getMonth(), today.getDate()).getTime();
    let closestDate = uniqueDates[0];
    let minDiff = Infinity;

    uniqueDates.forEach((dStr) => {
      const [y, m, d] = dStr.split("-").map(Number);
      const dateMs = new Date(y, m - 1, d).getTime();
      const diff = Math.abs(dateMs - todayMs);
      if (diff < minDiff) {
        minDiff = diff;
        closestDate = dStr;
      }
    });
    selectedDateStr = closestDate;
  }

  dateSelect.value = selectedDateStr;

  // Event listener
  if (!dateSelect.dataset.listener) {
    dateSelect.dataset.listener = "true";
    dateSelect.addEventListener("change", (e) => {
      selectedDateStr = e.target.value;
      renderDateMatches();
    });
  }

  renderDateMatches();
}

function renderDateMatches() {
  const container = document.getElementById("date-matches-container");
  if (!container) return;

  container.innerHTML = "";

  if (!selectedDateStr) return;

  const matches = matchesData.filter((m) => getPanamaDateTime(m).dateStr === selectedDateStr);

  if (matches.length === 0) {
    container.innerHTML = `
      <div class="empty-state" style="padding: 40px; background: var(--card-bg); border-radius: var(--radius-md); border:1px solid var(--border);">
        <span class="empty-icon">📅</span>
        <p>No hay partidos programados para esta fecha.</p>
      </div>
    `;
    return;
  }

  matches.forEach((match) => {
    const matchBlock = document.createElement("div");
    matchBlock.className = "date-match-block";
    matchBlock.style =
      "background: var(--card-bg); border: 1px solid var(--border); border-radius: var(--radius-md); padding: 18px; box-shadow: var(--shadow-sm); display: flex; flex-direction: column; gap: 16px;";

    const isFinished = match.status === "finished";
    const isLive = match.status === "live";

    const scoreHtml =
      isFinished || isLive
        ? `<div class="score-box">${match.homeScore}</div>
         <span class="score-separator">–</span>
         <div class="score-box">${match.awayScore}</div>`
        : `<div class="score-pending">vs</div>`;

    const statusLabel = isFinished
      ? "Finalizado"
      : isLive
        ? "🔴 En vivo"
        : (match.time ? formatPanamaTime(match.time) : formatDate(getPanamaDateTime(match).dateStr));
    const statusClass = isFinished ? "finished" : isLive ? "live" : "pending";

    // 1. HTML del partido (encabezado)
    let matchHeaderHtml = `
      <div class="match-card" style="box-shadow: none; border: none; padding: 0; pointer-events: none; border-left: none;">
        <div class="match-team home">
          <span class="team-flag">${match.homeFlag}</span>
          <span class="team-name">${match.home}</span>
        </div>
        <div class="match-score">${scoreHtml}</div>
        <div class="match-team away">
          <span class="team-flag">${match.awayFlag}</span>
          <span class="team-name">${match.away}</span>
        </div>
        <div class="match-date-col">
          <span class="match-date">Grupo ${match.group} · ID: ${match.id}</span>
          <span class="status-pill ${statusClass}">${statusLabel}</span>
        </div>
      </div>
    `;

    // 2. Pronósticos de los participantes
    let predGridHtml = `
      <div style="font-size: 0.72rem; font-weight: 800; color: var(--text-muted); text-transform: uppercase; letter-spacing: 0.05em; border-top: 1px solid var(--border); padding-top: 14px; margin-top: 4px;">
        Pronósticos de los participantes
      </div>
      <div style="display: grid; grid-template-columns: repeat(auto-fill, minmax(170px, 1fr)); gap: 10px; margin-top: 10px;">
    `;

    // Ordenar participantes según la tabla de posiciones actual
    const standings = computeStandings();

    standings.forEach((p) => {
      const pred = p.predictions[match.id];
      const result = scorePredict(pred, match);

      const predScoreStr = pred ? `${pred.homeScore} – ${pred.awayScore}` : "—";

      let pointsBadgeHtml = "";
      if (pred) {
        if (result.type === "exact") {
          pointsBadgeHtml = `<span style="font-size: 0.65rem; font-weight: 700; color: var(--success); background: var(--success-light); padding: 1px 6px; border-radius: 10px;">🎯 +3</span>`;
        } else if (result.type === "winner") {
          pointsBadgeHtml = `<span style="font-size: 0.65rem; font-weight: 700; color: var(--warning); background: var(--warning-light); padding: 1px 6px; border-radius: 10px;">✅ +1</span>`;
        } else if (result.type === "wrong") {
          pointsBadgeHtml = `<span style="font-size: 0.65rem; font-weight: 700; color: var(--danger); background: var(--danger-light); padding: 1px 6px; border-radius: 10px;">❌ 0</span>`;
        }
      } else {
        pointsBadgeHtml = `<span style="font-size: 0.65rem; font-style: italic; color: var(--text-muted);">Sin pred.</span>`;
      }

      predGridHtml += `
        <div style="display: flex; align-items: center; justify-content: space-between; background: var(--bg); border: 1px solid var(--border); padding: 8px 12px; border-radius: var(--radius-sm); font-size: 0.8rem;">
          <div style="display: flex; align-items: center; gap: 6px; font-weight: 600; color: var(--text-primary);">
            <span style="font-size: 1rem;">${p.avatar}</span>
            <span>${p.name}</span>
          </div>
          <div style="display: flex; flex-direction: column; align-items: flex-end; gap: 2px;">
            <strong style="color: var(--primary); font-size: 0.85rem;">${predScoreStr}</strong>
            ${pointsBadgeHtml}
          </div>
        </div>
      `;
    });

    predGridHtml += `</div>`;

    matchBlock.innerHTML = matchHeaderHtml + predGridHtml;
    container.appendChild(matchBlock);
  });
}


function updateStandingsAndStatsOnly() {
  const standings = computeStandings();
  renderStats();
  renderPodium(standings);
  renderRankingTable(standings);
  renderDateMatches();
}

// =====================================================
// ===== BRACKET — FASE ELIMINATORIA ================
// =====================================================

const BRACKET_ROUND_NAMES = {
  R32: "Dieciseisavos de Final",
  R16: "Octavos de Final",
  QF: "Cuartos de Final",
  SF: "Semifinales",
  FINAL: "Final",
};

// Pairing: R32 matches feed into R16 matches (by index)
// R32_1 + R32_2 → R16_1, R32_3 + R32_4 → R16_2 ... etc.
const R32_TO_R16 = {
  R16_1: ["R32_1", "R32_2"],
  R16_2: ["R32_3", "R32_4"],
  R16_3: ["R32_5", "R32_6"],
  R16_4: ["R32_7", "R32_8"],
  R16_5: ["R32_9", "R32_10"],
  R16_6: ["R32_11", "R32_12"],
  R16_7: ["R32_13", "R32_14"],
  R16_8: ["R32_15", "R32_16"],
};
const R16_TO_QF = {
  QF_1: ["R16_1", "R16_2"],
  QF_2: ["R16_3", "R16_4"],
  QF_3: ["R16_5", "R16_6"],
  QF_4: ["R16_7", "R16_8"],
};
const QF_TO_SF = {
  SF_1: ["QF_1", "QF_2"],
  SF_2: ["QF_3", "QF_4"],
};
// F_1 = 3rd place (SF losers), F_2 = Final (SF winners)

// ── Helper: build a bracket match card (for tree) ──
function buildBtCard(match, extraClass = "") {
  const isFinished = match.status === "finished";
  const isLive = match.status === "live";

  // Determine winner team for styling
  let homeWinner = false, awayWinner = false;
  if (isFinished && match.homeScore !== null && match.awayScore !== null) {
    if (match.homeScore > match.awayScore) homeWinner = true;
    else if (match.awayScore > match.homeScore) awayWinner = true;
  }

  const statusLabel = isFinished
    ? "Finalizado"
    : isLive
      ? "🔴 En vivo"
      : (match.time ? `${formatDate(getPanamaDateTime(match).dateStr)} · ${formatPanamaTime(match.time)}` : formatDate(getPanamaDateTime(match).dateStr));

  const homeScore = isFinished || isLive ? String(match.homeScore) : "";
  const awayScore = isFinished || isLive ? String(match.awayScore) : "";

  const shortName = (name) => name.length > 12 ? name.split(" ")[0] : name;

  const card = document.createElement("div");
  card.className = `bt-card status-${match.status}${extraClass ? " " + extraClass : ""}`;
  card.dataset.matchId = match.id;
  card.innerHTML = `
    <div class="bt-top">
      <span>${match.id}</span>
      <span>${statusLabel}</span>
    </div>
    <div class="bt-team${homeWinner ? " winner" : ""}">
      <div class="bt-team-info">
        <span class="bt-flag">${match.homeFlag}</span>
        <span class="bt-name${homeWinner ? " winner-name" : ""}">${shortName(match.home)}</span>
      </div>
      <span class="bt-score${homeWinner ? " winner-score" : ""}">${homeScore}</span>
    </div>
    <div class="bt-team${awayWinner ? " winner" : ""}">
      <div class="bt-team-info">
        <span class="bt-flag">${match.awayFlag}</span>
        <span class="bt-name${awayWinner ? " winner-name" : ""}">${shortName(match.away)}</span>
      </div>
      <span class="bt-score${awayWinner ? " winner-score" : ""}">${awayScore}</span>
    </div>
  `;
  card.addEventListener("click", () => openBracketPredModal(match));
  return card;
}

// ── Helper: build a bm-card (for R32 grid and mobile) ──
function buildBmCard(match) {
  const isFinished = match.status === "finished";
  const isLive = match.status === "live";

  let homeWinner = false, awayWinner = false;
  if (isFinished && match.homeScore !== null && match.awayScore !== null) {
    if (match.homeScore > match.awayScore) homeWinner = true;
    else if (match.awayScore > match.homeScore) awayWinner = true;
  }

  const statusLabel = isFinished
    ? "Finalizado"
    : isLive
      ? "🔴 En vivo"
      : (match.time ? `${formatDate(getPanamaDateTime(match).dateStr)} · ${formatPanamaTime(match.time)}` : "Pendiente");

  const statusClass = isFinished ? "finished" : isLive ? "live" : "pending";

  const homeScore = isFinished || isLive ? String(match.homeScore) : "—";
  const awayScore = isFinished || isLive ? String(match.awayScore) : "—";

  const card = document.createElement("div");
  card.className = `bm-card status-${match.status}`;
  card.dataset.matchId = match.id;
  card.innerHTML = `
    <div class="bm-card-top">
      <span>${match.id}</span>
      <span class="bm-status-pill ${statusClass}">${statusLabel}</span>
    </div>
    <div class="bm-teams">
      <div class="bm-team${homeWinner ? " winner" : ""}">
        <div class="bm-team-info">
          <span class="bm-flag">${match.homeFlag}</span>
          <span class="bm-name${homeWinner ? " winner-name" : ""}">${match.home}</span>
        </div>
        <span class="bm-score${homeWinner ? " winner-score" : ""}">${homeScore}</span>
      </div>
      <div class="bm-team${awayWinner ? " winner" : ""}">
        <div class="bm-team-info">
          <span class="bm-flag">${match.awayFlag}</span>
          <span class="bm-name${awayWinner ? " winner-name" : ""}">${match.away}</span>
        </div>
        <span class="bm-score${awayWinner ? " winner-score" : ""}">${awayScore}</span>
      </div>
    </div>
  `;
  card.addEventListener("click", () => openBracketPredModal(match));
  return card;
}

// ── Render R32 grid section ──
function renderBracketR32(r32Matches) {
  const grid = document.getElementById("bracket-r32-grid");
  if (!grid) return;
  grid.innerHTML = "";
  r32Matches.forEach((m) => grid.appendChild(buildBmCard(m)));
}

// ── Render bracket tree (R16 → QF → SF → Final) ──
function renderBracketTree(matchesMap) {
  const tree = document.getElementById("bracket-tree");
  if (!tree) return;
  tree.innerHTML = "";

  // MATCH_HEIGHT: height of a bt-card in px (top-bar ~22 + 2x team-row ~35 each = ~92)
  const MATCH_H = 92;
  const MATCH_W = 200; // column width
  const GAP_X   = 40; // horizontal gap between columns

  const roundsConfig = [
    { key: "R16", matches: ["R16_1","R16_2","R16_3","R16_4","R16_5","R16_6","R16_7","R16_8"], label: "Octavos" },
    { key: "QF",  matches: ["QF_1","QF_2","QF_3","QF_4"], label: "Cuartos" },
    { key: "SF",  matches: ["SF_1","SF_2"], label: "Semis" },
  ];

  // Maximum slots = 8 (R16); each slot = card height + generous padding
  const maxSlots = 8;
  const slotH = MATCH_H + 32; // 32px breathing room between cards
  const totalH = maxSlots * slotH;
  const headerH = 28;

  const colEls = []; // store column elements for SVG positions

  roundsConfig.forEach((round, roundIdx) => {
    const col = document.createElement("div");
    col.className = "bracket-round-col";
    col.style.width = MATCH_W + "px";

    const header = document.createElement("div");
    header.className = "bracket-round-header";
    header.textContent = round.label;
    col.appendChild(header);

    // Content area with fixed height
    const content = document.createElement("div");
    content.style.cssText = `position:relative; height:${totalH}px;`;

    const matchCount = round.matches.length;
    round.matches.forEach((matchId, idx) => {
      const match = matchesMap[matchId];
      if (!match) return;

      // Calculate vertical center position for this slot
      const slotSize = totalH / matchCount;
      const topCenter = slotSize * idx + slotSize / 2;
      const topPx = topCenter - MATCH_H / 2;

      const wrapper = document.createElement("div");
      wrapper.style.cssText = `position:absolute; top:${topPx}px; left:8px; right:8px;`;
      wrapper.dataset.matchId = matchId;
      wrapper.dataset.roundKey = round.key;
      wrapper.dataset.slotIdx = idx;

      const card = buildBtCard(match);
      wrapper.appendChild(card);
      content.appendChild(wrapper);
    });

    col.appendChild(content);
    tree.appendChild(col);
    colEls.push({ col, round: round.key, config: round });

    // Add gap spacer between columns (except before final)
    if (roundIdx < roundsConfig.length - 1) {
      const spacer = document.createElement("div");
      spacer.style.cssText = `width:${GAP_X}px; flex-shrink:0;`;
      tree.appendChild(spacer);
    }
  });

  // ── Final column (3rd place + Final, separated) ──
  const gapSpacer = document.createElement("div");
  gapSpacer.style.cssText = `width:${GAP_X}px; flex-shrink:0;`;
  tree.appendChild(gapSpacer);

  const finalCol = document.createElement("div");
  finalCol.className = "bracket-round-col col-final";
  finalCol.style.cssText = `width:${MATCH_W}px; height:${totalH + headerH}px; justify-content:center; display:flex; flex-direction:column; gap:20px;`;

  const finalHeader = document.createElement("div");
  finalHeader.className = "bracket-round-header";
  finalHeader.textContent = "Final";
  finalCol.appendChild(finalHeader);

  // Final match (F_2)
  const finalContent = document.createElement("div");
  finalContent.style.cssText = "display:flex; flex-direction:column; gap:20px; flex:1; justify-content:center;";

  const f2Match = matchesMap["F_2"];
  if (f2Match) {
    const w2 = document.createElement("div");
    w2.style.cssText = "padding: 0 8px;";
    w2.dataset.matchId = "F_2";

    const label2 = document.createElement("div");
    label2.style.cssText = "font-size:0.6rem; font-weight:800; text-transform:uppercase; letter-spacing:0.06em; color:var(--accent); margin-bottom:6px; text-align:center;";
    label2.textContent = "🏆 Gran Final";
    w2.appendChild(label2);

    const card2 = buildBtCard(f2Match, "final-card");
    w2.appendChild(card2);
    finalContent.appendChild(w2);
  }

  // 3rd place match (F_1)
  const f1Match = matchesMap["F_1"];
  if (f1Match) {
    const w1 = document.createElement("div");
    w1.style.cssText = "padding: 0 8px;";
    w1.dataset.matchId = "F_1";

    const label1 = document.createElement("div");
    label1.style.cssText = "font-size:0.6rem; font-weight:800; text-transform:uppercase; letter-spacing:0.06em; color:#a1826e; margin-bottom:6px; text-align:center;";
    label1.textContent = "🥉 3er Puesto";
    w1.appendChild(label1);

    const card1 = buildBtCard(f1Match, "third-card");
    w1.appendChild(card1);
    finalContent.appendChild(w1);
  }

  finalCol.appendChild(finalContent);
  tree.appendChild(finalCol);
  colEls.push({ col: finalCol, round: "FINAL" });

  // ── Draw SVG connectors after layout paint ──
  requestAnimationFrame(() => drawBracketConnectors(tree, roundsConfig, matchesMap));
}

// ── Draw SVG connector paths ──
// Uses offsetTop/offsetLeft (relative to tree) instead of getBoundingClientRect
// so it works correctly even when the tab panel was previously hidden (display:none).
function drawBracketConnectors(tree, roundsConfig, matchesMap) {
  const existing = tree.querySelector(".bracket-svg-connectors");
  if (existing) existing.remove();

  const treeW = tree.scrollWidth;
  const treeH = tree.scrollHeight;

  const svg = document.createElementNS("http://www.w3.org/2000/svg", "svg");
  svg.classList.add("bracket-svg-connectors");
  svg.setAttribute("width", treeW);
  svg.setAttribute("height", treeH);
  svg.style.cssText = `position:absolute; top:0; left:0; width:${treeW}px; height:${treeH}px; pointer-events:none; z-index:1;`;

  // Get element offset relative to the #bracket-tree container
  function getOffsetInTree(el) {
    let top = 0, left = 0;
    let cur = el;
    while (cur && cur !== tree) {
      top  += cur.offsetTop;
      left += cur.offsetLeft;
      cur   = cur.offsetParent;
    }
    return { top, left, width: el.offsetWidth, height: el.offsetHeight };
  }

  const wrapperMap = {};
  tree.querySelectorAll("[data-match-id]").forEach((el) => {
    // Only pick direct wrappers (not nested cards)
    if (el.dataset.matchId && !el.classList.contains("bt-card") && !el.classList.contains("bm-card")) {
      wrapperMap[el.dataset.matchId] = el;
    }
  });

  const connections = [
    ...Object.entries(R16_TO_QF).map(([target, sources]) => ({ target, sources })),
    ...Object.entries(QF_TO_SF).map(([target, sources]) => ({ target, sources })),
    { target: "F_2", sources: ["SF_1", "SF_2"] },
  ];

  connections.forEach(({ target, sources }) => {
    const targetEl = wrapperMap[target];
    if (!targetEl) return;
    const tOff = getOffsetInTree(targetEl);
    const tX = tOff.left;
    const tY = tOff.top + tOff.height / 2;

    sources.forEach((srcId) => {
      const srcEl = wrapperMap[srcId];
      if (!srcEl) return;
      const sOff = getOffsetInTree(srcEl);
      const srcMatch = matchesMap[srcId];
      const isFinished = srcMatch && srcMatch.status === "finished";

      const sX = sOff.left + sOff.width;
      const sY = sOff.top + sOff.height / 2;
      const midX = (sX + tX) / 2;

      const path = document.createElementNS("http://www.w3.org/2000/svg", "path");
      path.setAttribute("d", `M ${sX} ${sY} C ${midX} ${sY}, ${midX} ${tY}, ${tX} ${tY}`);
      path.setAttribute("class", `bracket-connector-path${isFinished ? " finished" : ""}`);
      svg.appendChild(path);
    });
  });

  tree.insertBefore(svg, tree.firstChild);
}

// ── Main render function ──
function renderBracket() {
  // Build match lookup map
  const matchesMap = {};
  matchesData.forEach((m) => { matchesMap[m.id] = m; });

  const r32Matches = matchesData.filter((m) => m.group === "R32").sort((a, b) => {
    const aInfo = getPanamaDateTime(a);
    const bInfo = getPanamaDateTime(b);
    return aInfo.sortValue.localeCompare(bInfo.sortValue);
  });

  renderBracketR32(r32Matches);
  renderBracketTree(matchesMap);

  // Mobile selector logic
  setupBracketMobileSelector();
}

// ── Mobile round selector ──
let bracketMobileRound = "R32";

function setupBracketMobileSelector() {
  const selector = document.getElementById("bracket-round-selector");
  if (!selector) return;

  // Apply initial mobile visibility
  applyBracketMobileRound(bracketMobileRound);

  selector.querySelectorAll(".bracket-round-btn").forEach((btn) => {
    if (btn.dataset.listener) return;
    btn.dataset.listener = "true";
    btn.addEventListener("click", () => {
      bracketMobileRound = btn.dataset.round;
      selector.querySelectorAll(".bracket-round-btn").forEach((b) => b.classList.remove("active"));
      btn.classList.add("active");
      applyBracketMobileRound(bracketMobileRound);
    });
  });
}

function applyBracketMobileRound(round) {
  const r32Section = document.getElementById("bracket-r32-section");
  const mainSection = document.getElementById("bracket-main-section");
  if (!r32Section || !mainSection) return;

  const isMobile = window.innerWidth <= 768;
  if (!isMobile) {
    r32Section.classList.remove("mobile-visible");
    mainSection.classList.remove("mobile-visible");
    return;
  }

  if (round === "R32") {
    r32Section.classList.add("mobile-visible");
    mainSection.classList.remove("mobile-visible");
  } else {
    r32Section.classList.remove("mobile-visible");
    mainSection.classList.add("mobile-visible");

    // Build match lookup
    const matchesMap = {};
    matchesData.forEach((m) => { matchesMap[m.id] = m; });

    // Determine which matches to show for this round
    const roundMatchIds = {
      R16:   ["R16_1","R16_2","R16_3","R16_4","R16_5","R16_6","R16_7","R16_8"],
      QF:    ["QF_1","QF_2","QF_3","QF_4"],
      SF:    ["SF_1","SF_2"],
      FINAL: ["F_2","F_1"],
    };

    const ids = roundMatchIds[round] || [];
    const matches = ids.map((id) => matchesMap[id]).filter(Boolean).sort((a, b) => {
      const aInfo = getPanamaDateTime(a);
      const bInfo = getPanamaDateTime(b);
      return aInfo.sortValue.localeCompare(bInfo.sortValue);
    });

    renderBracketMobileCards(matches, round);
  }
}

// ── Build a single mobile versus card ──
function buildBmcCard(match, roundLabel) {
  const isFinished = match.status === "finished";
  const isLive     = match.status === "live";

  let homeWinner = false, awayWinner = false, isDraw = false;
  if (isFinished && match.homeScore !== null && match.awayScore !== null) {
    if (match.homeScore > match.awayScore)       homeWinner = true;
    else if (match.awayScore > match.homeScore)  awayWinner = true;
    else                                          isDraw = true;
  }

  const statusClass = isFinished ? "finished" : isLive ? "live" : "pending";
  const statusLabel = isFinished ? "Finalizado" : isLive ? "🔴 En vivo" : "Pendiente";

  const dateTimeStr = match.time
    ? `${formatDate(getPanamaDateTime(match).dateStr)} · ${formatPanamaTime(match.time)}`
    : formatDate(getPanamaDateTime(match).dateStr);

  // Extra class for final/third
  let extraClass = "";
  if (match.id === "F_2") extraClass = " final-card";
  if (match.id === "F_1") extraClass = " third-card";

  // Score center HTML
  let scoreCenterHtml;
  if (isFinished || isLive) {
    scoreCenterHtml = `
      <div class="bmc-score-center">
        <div class="bmc-score">${match.homeScore}<span class="bmc-score-sep"> – </span>${match.awayScore}</div>
        <div class="bmc-score-label">${isLive ? "En juego" : "Final"}</div>
      </div>`;
  } else {
    scoreCenterHtml = `
      <div class="bmc-score-center">
        <div class="bmc-vs">VS</div>
        <div class="bmc-score-label">${dateTimeStr}</div>
      </div>`;
  }

  // Winner badge
  const winBadge = `<span class="bmc-winner-badge">✓ Ganador</span>`;

  // Result strip (only for finished matches)
  let resultStripHtml = "";
  if (isFinished) {
    if (homeWinner) {
      resultStripHtml = `<div class="bmc-result-strip win-home">🏆 Ganó ${match.home}</div>`;
    } else if (awayWinner) {
      resultStripHtml = `<div class="bmc-result-strip win-away">🏆 Ganó ${match.away}</div>`;
    } else {
      resultStripHtml = `<div class="bmc-result-strip draw">🤝 Empate (penales)</div>`;
    }
  }

  // Special header for Final matches
  let specialLabel = roundLabel;
  if (match.id === "F_2") specialLabel = "🏆 Gran Final";
  if (match.id === "F_1") specialLabel = "🥉 Tercer Puesto";

  const card = document.createElement("div");
  card.className = `bmc-card status-${match.status}${extraClass}`;

  card.innerHTML = `
    <div class="bmc-header">
      <span class="bmc-header-left">${specialLabel} · ${match.id}</span>
      <div class="bmc-header-right">
        ${isFinished || isLive ? `<span class="bmc-datetime">${dateTimeStr}</span>` : ""}
        <span class="bmc-status-dot ${statusClass}">${statusLabel}</span>
      </div>
    </div>
    <div class="bmc-body">
      <div class="bmc-team home${homeWinner ? " winner" : ""}">
        <span class="bmc-flag">${match.homeFlag}</span>
        <span class="bmc-name">${match.home}</span>
        ${homeWinner ? winBadge : ""}
      </div>
      ${scoreCenterHtml}
      <div class="bmc-team away${awayWinner ? " winner" : ""}">
        <span class="bmc-flag">${match.awayFlag}</span>
        <span class="bmc-name">${match.away}</span>
        ${awayWinner ? winBadge : ""}
      </div>
    </div>
    ${resultStripHtml}
    <div class="bmc-footer">
      <span class="bmc-footer-icon">📊</span>
      Ver pronósticos de este partido
    </div>
  `;

  // Click on card (except footer) → open predictions popover
  card.addEventListener("click", (e) => {
    openBracketPredModal(match);
  });

  return card;
}

// ── Render mobile cards for a given round ──
function renderBracketMobileCards(matches, round) {
  const container = document.getElementById("bracket-mobile-cards");
  if (!container) return;
  container.innerHTML = "";

  if (matches.length === 0) {
    container.innerHTML = `<div style="text-align:center;color:var(--text-muted);padding:32px 0;font-size:0.85rem;">
      <span style="font-size:2rem;display:block;margin-bottom:8px;">📅</span>
      No hay partidos programados para esta ronda.
    </div>`;
    return;
  }

  const roundLabel = BRACKET_ROUND_NAMES[round] || round;
  matches.forEach((match) => {
    container.appendChild(buildBmcCard(match, roundLabel));
  });
}


// Re-apply mobile visibility on resize
window.addEventListener("resize", () => {
  applyBracketMobileRound(bracketMobileRound);
  // Redraw SVG connectors on resize
  const tree = document.getElementById("bracket-tree");
  if (tree && tree.children.length > 0) {
    const matchesMap = {};
    matchesData.forEach((m) => { matchesMap[m.id] = m; });
    const roundsConfig = [
      { key: "R16", matches: ["R16_1","R16_2","R16_3","R16_4","R16_5","R16_6","R16_7","R16_8"] },
      { key: "QF",  matches: ["QF_1","QF_2","QF_3","QF_4"] },
      { key: "SF",  matches: ["SF_1","SF_2"] },
    ];
    drawBracketConnectors(tree, roundsConfig, matchesMap);
  }
});

// =====================================================
// ===== BRACKET PREDICTIONS POPOVER ================
// =====================================================

function setupBracketPredModal() {
  // Inject modal HTML into body if not present
  if (document.getElementById("bracket-pred-overlay")) return;

  const overlay = document.createElement("div");
  overlay.className = "bracket-pred-overlay";
  overlay.id = "bracket-pred-overlay";
  overlay.innerHTML = `
    <div class="bracket-pred-modal" id="bracket-pred-modal">
      <div class="bpm-header">
        <div class="bpm-match-info">
          <div class="bpm-round-label" id="bpm-round-label">Fase</div>
          <div class="bpm-teams-display" id="bpm-teams-display"></div>
        </div>
        <button class="bpm-close" id="bpm-close-btn" aria-label="Cerrar">✕</button>
      </div>
      <div class="bpm-body" id="bpm-body"></div>
    </div>
  `;
  document.body.appendChild(overlay);

  document.getElementById("bpm-close-btn").addEventListener("click", closeBracketPredModal);
  overlay.addEventListener("click", (e) => {
    if (e.target === overlay) closeBracketPredModal();
  });
  document.addEventListener("keydown", (e) => {
    if (e.key === "Escape") closeBracketPredModal();
  });
}

function openBracketPredModal(match) {
  const overlay = document.getElementById("bracket-pred-overlay");
  if (!overlay) return;

  const isFinished = match.status === "finished";
  const isLive = match.status === "live";

  // Header
  document.getElementById("bpm-round-label").textContent =
    BRACKET_ROUND_NAMES[match.group] || match.group;

  const scoreDisplay = isFinished || isLive
    ? `<span class="bpm-score-display">${match.homeScore} – ${match.awayScore}</span>`
    : `<span style="opacity:0.7;font-size:0.85rem;">vs</span>`;

  document.getElementById("bpm-teams-display").innerHTML = `
    <span class="bpm-flag">${match.homeFlag}</span>
    <span>${match.home}</span>
    ${scoreDisplay}
    <span>${match.away}</span>
    <span class="bpm-flag">${match.awayFlag}</span>
  `;

  // Body: participants sorted by standings
  const body = document.getElementById("bpm-body");
  body.innerHTML = "";

  const standings = computeStandings();

  // Section label
  const sectionLabel = document.createElement("div");
  sectionLabel.style.cssText = "font-size:0.68rem; font-weight:800; color:var(--text-muted); text-transform:uppercase; letter-spacing:0.06em; margin-bottom:4px;";
  sectionLabel.textContent = "Pronósticos";
  body.appendChild(sectionLabel);

  let hasAnyPred = false;
  standings.forEach((p) => {
    const pred = p.predictions[match.id];
    const result = scorePredict(pred, match);

    if (pred) hasAnyPred = true;

    const predScoreStr = pred ? `${pred.homeScore} – ${pred.awayScore}` : "—";

    let badgeClass = "no-pred";
    let badgeText = "Sin pred.";
    if (pred) {
      if (result.type === "exact")  { badgeClass = "exact";  badgeText = `🎯 +${POINTS_EXACT}pts`; }
      else if (result.type === "winner") { badgeClass = "winner"; badgeText = `✅ +${POINTS_WINNER}pt`; }
      else if (result.type === "wrong")  { badgeClass = "wrong";  badgeText = "❌ 0pts"; }
      else { badgeClass = "pending"; badgeText = "Pendiente"; }
    }

    const row = document.createElement("div");
    row.className = "bpm-pred-row";
    row.innerHTML = `
      <div class="bpm-pred-participant">
        <span style="font-size:1.1rem;">${p.avatar}</span>
        <span style="white-space:nowrap;overflow:hidden;text-overflow:ellipsis;">${p.name}</span>
      </div>
      <div class="bpm-pred-right">
        <span class="bpm-pred-score">${predScoreStr}</span>
        <span class="bpm-result-badge ${badgeClass}">${badgeText}</span>
      </div>
    `;
    body.appendChild(row);
  });

  if (!hasAnyPred) {
    const empty = document.createElement("div");
    empty.style.cssText = "text-align:center;color:var(--text-muted);font-size:0.85rem;padding:24px 0;";
    empty.innerHTML = `<span style="font-size:2rem;display:block;margin-bottom:8px;">📝</span>Ningún participante tiene predicción para este partido.`;
    body.appendChild(empty);
  }

  overlay.classList.add("open");
  document.body.style.overflow = "hidden";
}

function closeBracketPredModal() {
  const overlay = document.getElementById("bracket-pred-overlay");
  if (overlay) overlay.classList.remove("open");
  document.body.style.overflow = "";
}
