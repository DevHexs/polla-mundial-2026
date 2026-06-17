// ===== POLLA MUNDIAL 2026 — Motor de puntos =====

const POINTS_EXACT  = 3;
const POINTS_WINNER = 1;

let matchesData      = [];
let predictionsData  = [];

// ===== BOOT =====
document.addEventListener('DOMContentLoaded', () => {
  Promise.all([
    fetch('data/matches.json').then(r => r.json()),
    fetch('data/predictions.json').then(r => r.json())
  ])
  .then(([matches, predictions]) => {
    matchesData     = matches;
    predictionsData = predictions;
    init();
  })
  .catch(err => {
    console.error('Error cargando datos:', err);
    document.getElementById('loading-msg').textContent =
      '⚠️ No se pudieron cargar los datos. Abre el archivo en un servidor local.';
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
  setupTabs();
  setupModal();
}

// ===== PUNTOS =====
function getMatchResult(match) {
  if (match.status !== 'finished') return null;
  if (match.homeScore === null || match.awayScore === null) return null;
  if (match.homeScore > match.awayScore) return 'home';
  if (match.awayScore > match.homeScore) return 'away';
  return 'draw';
}

function scorePredict(prediction, match) {
  if (!prediction) return { points: 0, type: 'no-pred' };
  if (match.status !== 'finished') return { points: 0, type: 'pending' };

  const realResult   = getMatchResult(match);
  const { homeScore, awayScore } = prediction;

  // Exact
  if (homeScore === match.homeScore && awayScore === match.awayScore) {
    return { points: POINTS_EXACT, type: 'exact' };
  }

  // Winner / draw
  let predResult = null;
  if (homeScore > awayScore) predResult = 'home';
  else if (awayScore > homeScore) predResult = 'away';
  else predResult = 'draw';

  if (predResult === realResult) {
    return { points: POINTS_WINNER, type: 'winner' };
  }

  return { points: 0, type: 'wrong' };
}

function computeStandings() {
  return predictionsData.map(participant => {
    let totalPoints = 0, exactCount = 0, winnerCount = 0, predictedCount = 0;

    matchesData.forEach(match => {
      const pred   = participant.predictions[match.id];
      const result = scorePredict(pred, match);
      if (pred) predictedCount++;
      totalPoints += result.points;
      if (result.type === 'exact')  exactCount++;
      if (result.type === 'winner') winnerCount++;
    });

    return {
      name: participant.name,
      avatar: participant.avatar,
      totalPoints,
      exactCount,
      winnerCount,
      predictedCount,
      predictions: participant.predictions
    };
  }).sort((a, b) => {
    if (b.totalPoints !== a.totalPoints) return b.totalPoints - a.totalPoints;
    if (b.exactCount  !== a.exactCount)  return b.exactCount - a.exactCount;
    return b.winnerCount - a.winnerCount;
  });
}

// ===== STATS GENERALES =====
function renderStats() {
  const finished = matchesData.filter(m => m.status === 'finished').length;
  const pending  = matchesData.filter(m => m.status === 'pending').length;
  const live     = matchesData.filter(m => m.status === 'live').length;

  document.getElementById('stat-finished').textContent = finished;
  document.getElementById('stat-pending').textContent  = pending + live;
  document.getElementById('stat-total').textContent    = matchesData.length;
  document.getElementById('stat-participants').textContent = predictionsData.length;
}

// ===== PODIO TOP 3 =====
function renderPodium(standings) {
  const medals = ['🥇', '🥈', '🥉'];
  const rankClasses = ['rank-1', 'rank-2', 'rank-3'];
  const container = document.getElementById('podium-container');
  container.innerHTML = '';

  standings.slice(0, 3).forEach((p, i) => {
    const card = document.createElement('div');
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
    card.addEventListener('click', () => openModal(p));
    container.appendChild(card);
  });
}

// ===== TABLA DE POSICIONES =====
function renderRankingTable(standings) {
  const tbody = document.getElementById('ranking-body');
  tbody.innerHTML = '';

  standings.forEach((p, i) => {
    const rank = i + 1;
    let rankHtml;
    if (rank === 1) rankHtml = `<span class="rank-badge r1">🥇</span>`;
    else if (rank === 2) rankHtml = `<span class="rank-badge r2">🥈</span>`;
    else if (rank === 3) rankHtml = `<span class="rank-badge r3">🥉</span>`;
    else rankHtml = `<span class="rank-badge rn">${rank}</span>`;

    const row = document.createElement('div');
    row.className = 'ranking-row';
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
    row.addEventListener('click', () => openModal(p));
    tbody.appendChild(row);
  });
}

// ===== PARTIDOS =====
const GROUPS_ORDER = ['A','B','C','D','E','F','G','H','I','J','K','L'];
const GROUPS_NAMES = {
  A: 'Grupo A — México, Sudáfrica, Corea del Sur, Chequia',
  B: 'Grupo B — Canadá, Bosnia y Herz., Qatar, Suiza',
  C: 'Grupo C — Brasil, Marruecos, Escocia, Haití',
  D: 'Grupo D — Estados Unidos, Paraguay, Australia, Türkiye',
  E: 'Grupo E — Alemania, Curaçao, Costa de Marfil, Ecuador',
  F: 'Grupo F — Países Bajos, Japón, Suecia, Túnez',
  G: 'Grupo G — Bélgica, Egipto, Irán, Nueva Zelanda',
  H: 'Grupo H — España, Cabo Verde, Arabia Saudita, Uruguay',
  I: 'Grupo I — Francia, Senegal, Irak, Noruega',
  J: 'Grupo J — Argentina, Argelia, Austria, Jordania',
  K: 'Grupo K — Portugal, Uzbekistán, Colombia, Jamaica',
  L: 'Grupo L — Inglaterra, Croacia, Ghana, Panamá'
};

function formatDate(dateStr) {
  const [y, m, d] = dateStr.split('-').map(Number);
  const date = new Date(y, m - 1, d);
  return date.toLocaleDateString('es', { day: 'numeric', month: 'short' });
}

function renderMatches() {
  const container = document.getElementById('matches-container');
  container.innerHTML = '';

  GROUPS_ORDER.forEach(group => {
    const groupMatches = matchesData.filter(m => m.group === group);
    if (groupMatches.length === 0) return;

    const section = document.createElement('div');
    section.className = 'group-section';

    const title = document.createElement('div');
    title.className = 'group-title';
    title.textContent = GROUPS_NAMES[group] || `Grupo ${group}`;
    section.appendChild(title);

    const list = document.createElement('div');
    list.className = 'matches-list';

    groupMatches.forEach(match => {
      const card = document.createElement('div');
      card.className = `match-card status-${match.status}`;

      const isFinished = match.status === 'finished';
      const isLive     = match.status === 'live';

      const scoreHtml = isFinished || isLive
        ? `<div class="score-box">${match.homeScore}</div>
           <span class="score-separator">–</span>
           <div class="score-box">${match.awayScore}</div>`
        : `<div class="score-pending">vs</div>`;

      const statusLabel = isFinished ? 'Finalizado' : isLive ? '🔴 En vivo' : formatDate(match.date);
      const statusClass = isFinished ? 'finished' : isLive ? 'live' : 'pending';

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
          <span class="match-date">${formatDate(match.date)}</span>
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
  const overlay = document.getElementById('modal-overlay');
  const ptsTxt = `${participant.totalPoints} pts · 🎯 ${participant.exactCount} exactos · ✅ ${participant.winnerCount} ganador`;

  const avatarEl = document.getElementById('modal-avatar-txt');
  avatarEl.textContent = participant.avatar;
  avatarEl.style.fontSize = '1.4rem';
  avatarEl.style.background = 'rgba(255,255,255,0.2)';
  document.getElementById('modal-participant-name').textContent = participant.name;
  document.getElementById('modal-participant-pts').textContent  = ptsTxt;

  const body = document.getElementById('modal-body');
  body.innerHTML = '';

  // Group by group letter
  const hasPreds = Object.keys(participant.predictions).length > 0;

  if (!hasPreds) {
    body.innerHTML = `<div class="empty-state">
      <span class="empty-icon">📝</span>
      <p>Las predicciones de <strong>${participant.name}</strong> aún no han sido ingresadas.</p>
    </div>`;
  } else {
    GROUPS_ORDER.forEach(group => {
      const groupMatches = matchesData.filter(m => m.group === group);
      const groupPreds = groupMatches.filter(m => participant.predictions[m.id]);
      if (groupPreds.length === 0) return;

      const groupTitle = document.createElement('div');
      groupTitle.className = 'modal-group-title';
      groupTitle.textContent = `Grupo ${group}`;
      body.appendChild(groupTitle);

      groupMatches.forEach(match => {
        const pred = participant.predictions[match.id];
        const result = scorePredict(pred, match);

        const row = document.createElement('div');
        row.className = 'pred-row';

        const homeShort = match.home.split(' ')[0];
        const awayShort = match.away.split(' ')[0];
        const predScore = pred ? `${pred.homeScore} – ${pred.awayScore}` : '—';

        let resultHtml = '';
        if (!pred) {
          resultHtml = `<span class="pred-result no-pred">Sin pred.</span>`;
        } else if (result.type === 'pending') {
          resultHtml = `<span class="pred-result pending">Pendiente</span>`;
        } else if (result.type === 'exact') {
          resultHtml = `<span class="pred-result exact">🎯 +${POINTS_EXACT}pts</span>`;
        } else if (result.type === 'winner') {
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

  overlay.classList.add('open');
  document.body.style.overflow = 'hidden';
}

function closeModal() {
  document.getElementById('modal-overlay').classList.remove('open');
  document.body.style.overflow = '';
}

function setupModal() {
  document.getElementById('modal-close-btn').addEventListener('click', closeModal);
  document.getElementById('modal-overlay').addEventListener('click', e => {
    if (e.target === e.currentTarget) closeModal();
  });
  document.addEventListener('keydown', e => {
    if (e.key === 'Escape') closeModal();
  });
}

// ===== TABS =====
function setupTabs() {
  const tabs    = document.querySelectorAll('.tab-btn');
  const contents = document.querySelectorAll('.tab-content');

  tabs.forEach(btn => {
    btn.addEventListener('click', () => {
      tabs.forEach(t => t.classList.remove('active'));
      contents.forEach(c => c.classList.remove('active'));
      btn.classList.add('active');
      document.getElementById(btn.dataset.tab).classList.add('active');
    });
  });
}

// ===== VISTA DE PREDICCIONES POR PARTICIPANTE =====
let selectedParticipantName = "";

function renderPredictionsTab(standings) {
  const container = document.getElementById('participants-selector-container');
  if (!container) return;

  container.innerHTML = '';
  
  if (standings.length === 0) return;
  
  // Seleccionar por defecto al primero de la tabla
  if (!selectedParticipantName || !standings.some(s => s.name === selectedParticipantName)) {
    selectedParticipantName = standings[0].name;
  }

  standings.forEach(p => {
    const btn = document.createElement('button');
    btn.className = `selector-btn ${p.name === selectedParticipantName ? 'active' : ''}`;
    btn.innerHTML = `<span class="avatar-circle" style="width:22px; height:22px; font-size:0.9rem; display:inline-flex; margin-right:6px; background:rgba(0,0,0,0.04);">${p.avatar}</span> ${p.name}`;
    btn.addEventListener('click', () => {
      selectedParticipantName = p.name;
      document.querySelectorAll('.selector-btn').forEach(b => b.classList.remove('active'));
      btn.classList.add('active');
      renderParticipantPredictions(p.name);
    });
    container.appendChild(btn);
  });

  renderParticipantPredictions(selectedParticipantName);
}

function renderParticipantPredictions(name) {
  const grid = document.getElementById('predictions-grid-container');
  if (!grid) return;

  grid.innerHTML = '';
  
  const participant = predictionsData.find(p => p.name === name);
  if (!participant) return;

  // Ordenar partidos por grupo y luego por ID
  const sortedMatches = [...matchesData].sort((a, b) => {
    if (a.group !== b.group) return a.group.localeCompare(b.group);
    return a.id.localeCompare(b.id);
  });

  sortedMatches.forEach(match => {
    const pred = participant.predictions[match.id];
    const result = scorePredict(pred, match);

    const isFinished = match.status === 'finished';
    const isLive     = match.status === 'live';

    const card = document.createElement('div');
    card.className = 'pred-card';

    let resultHtml = '';
    let borderStyle = '';
    if (!pred) {
      resultHtml = `<span class="pred-result no-pred">Sin pred.</span>`;
      borderStyle = 'border-left: 4px solid var(--border);';
    } else if (result.type === 'pending') {
      resultHtml = `<span class="pred-result pending">Pendiente</span>`;
      borderStyle = 'border-left: 4px solid var(--border);';
    } else if (result.type === 'exact') {
      resultHtml = `<span class="pred-result exact">🎯 +${POINTS_EXACT}pts</span>`;
      borderStyle = 'border-left: 4px solid var(--success);';
    } else if (result.type === 'winner') {
      resultHtml = `<span class="pred-result winner">✅ +${POINTS_WINNER}pt</span>`;
      borderStyle = 'border-left: 4px solid var(--warning);';
    } else {
      resultHtml = `<span class="pred-result wrong">❌ 0pts</span>`;
      borderStyle = 'border-left: 4px solid var(--danger);';
    }

    card.style = borderStyle;

    const predScoreStr = pred ? `${pred.homeScore} – ${pred.awayScore}` : '—';
    const realScoreHtml = isFinished || isLive
      ? `<span class="real-score-footer">Real: <strong>${match.homeScore} – ${match.awayScore}</strong></span>`
      : '';

    card.innerHTML = `
      <div class="pred-card-header">
        <span>Grupo ${match.group}</span>
        <span>ID: ${match.id}</span>
      </div>
      <div class="pred-card-body">
        <div class="pred-card-team home">
          <span class="team-flag">${match.homeFlag}</span>
          <span class="team-name" style="font-size:0.8rem;">${match.home.split(' ')[0]}</span>
        </div>
        <div class="pred-card-prediction-score">
          <div class="pred-score-val">${predScoreStr}</div>
          <div class="pred-score-label">Predicción</div>
        </div>
        <div class="pred-card-team away">
          <span class="team-flag">${match.awayFlag}</span>
          <span class="team-name" style="font-size:0.8rem;">${match.away.split(' ')[0]}</span>
        </div>
      </div>
      <div class="pred-card-footer">
        <div style="display:flex; flex-direction:column; gap:2px; align-items:flex-start;">
          <span class="status-date" style="font-size:0.65rem; color: var(--text-muted); font-weight:500;">
            ${isFinished ? 'Finalizado' : isLive ? '🔴 En vivo' : formatDate(match.date)}
          </span>
          ${realScoreHtml}
        </div>
        ${resultHtml}
      </div>
    `;
    grid.appendChild(card);
  });
}

