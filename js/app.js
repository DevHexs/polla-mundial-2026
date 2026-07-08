// ===== POLLA MUNDIAL 2026 — Motor de puntos =====

const POINTS_EXACT = 3;
const POINTS_WINNER = 1;

let matchesData = [];
let predictionsData = [];
let groupDatesData = {};
let simulatedPoints = {};
let isPanicMode = false;
let isPanicEditing = false;



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
  setupPanicMode();
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
  const sorted = predictionsData
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

      // En Modo Pánico, sobreescribir con los puntos simulados si existen
      if (isPanicMode && simulatedPoints[participant.name] !== undefined) {
        totalPoints = simulatedPoints[participant.name];
      }

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

  let currentRank = 1;
  return sorted.map((p, i) => {
    if (i > 0) {
      const prev = sorted[i - 1];
      const isTied = p.totalPoints === prev.totalPoints &&
                     p.exactCount === prev.exactCount &&
                     p.winnerCount === prev.winnerCount;
      if (!isTied) {
        currentRank = i + 1;
      }
    }
    return { ...p, rank: currentRank };
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

  function getPodiumTitle(p, rank) {
    if (rank === 1) {
      return p.exactCount >= 4 ? "👑 Gran Gurú" : "🔥 Líder Indiscutible";
    } else if (rank === 2) {
      return p.exactCount > p.winnerCount / 2
        ? "🎯 Puntería de Élite"
        : "⚡ Al Acecho";
    } else {
      return p.winnerCount > 5 ? "🧠 Estratega" : "🛡️ En la Pelea";
    }
  }

  standings.slice(0, 3).forEach((p, i) => {
    const rank = p.rank;
    const card = document.createElement("div");
    card.className = `podium-card ${rankClasses[rank - 1]}`;

    // Detect ties
    const tiedWith = standings.filter((other) => other.name !== p.name && other.rank === rank);
    const isTied = tiedWith.length > 0;

    let title = getPodiumTitle(p, rank);
    let tieBadgeHtml = "";

    if (isTied && rank <= 3) {
      const tiedNames = tiedWith.map((other) => other.name).join(" y ");
      tieBadgeHtml = `<div class="podium-tie-badge" title="Empatado con ${tiedNames}">🤝 Duelo de Titanes</div>`;
      title = `⚔️ Co-Líder (${title})`;
    }

    const medal = rank <= 3 ? medals[rank - 1] : "🏅";

    card.innerHTML = `
      <div class="podium-badge-title">${title}</div>
      <span class="podium-medal">${medal}</span>
      ${tieBadgeHtml}
      <div class="podium-name">${p.avatar} ${p.name}</div>
      <div class="podium-pts">${p.totalPoints}</div>
      <div class="podium-pts-label">puntos</div>
      <div class="podium-breakdown">
        <span class="badge-exact">🎯 ${p.exactCount} exactos</span>
        <span class="badge-winner">✅ ${p.winnerCount} ganador</span>
      </div>
    `;

    // Confetti effect on hover for the 1st place (including tied first place)
    if (rank === 1) {
      card.addEventListener("mouseenter", () => {
        const emojis = ["⚽", "🥇", "✨", "👑", "🎉", "🔥"];
        for (let j = 0; j < 15; j++) {
          const emojiSpan = document.createElement("span");
          emojiSpan.className = "floating-emoji";
          emojiSpan.textContent =
            emojis[Math.floor(Math.random() * emojis.length)];

          const xOffset = `${(Math.random() - 0.5) * 160}px`;
          const rotation = `${(Math.random() - 0.5) * 180}deg`;
          emojiSpan.style.setProperty("--x-offset", xOffset);
          emojiSpan.style.setProperty("--rotation", rotation);

          emojiSpan.style.left = `${20 + Math.random() * 60}%`;
          emojiSpan.style.animationDelay = `${Math.random() * 0.15}s`;

          card.appendChild(emojiSpan);
          setTimeout(() => emojiSpan.remove(), 1200);
        }
      });
    }

    card.addEventListener("click", (e) => {
      // Don't open modal if they clicked on a floating emoji
      if (e.target.classList.contains("floating-emoji")) return;
      openModal(p);
    });
    container.appendChild(card);
  });
}

// ===== CALCULAR LOGROS Y MEDALLAS DINÁMICAS =====
function calculateAdvancedBadges(standings) {
  const finishedMatches = matchesData
    .filter((m) => m.status === "finished")
    .sort((a, b) => {
      const aInfo = getPanamaDateTime(a);
      const bInfo = getPanamaDateTime(b);
      return aInfo.sortValue.localeCompare(bInfo.sortValue);
    });

  const badges = {}; // name -> array of badges
  standings.forEach((p) => {
    badges[p.name] = [];
  });

  if (standings.length === 0) return badges;

  // 1. 🐢 El "Farolillo Rojo" (Último lugar)
  const lastParticipantName = standings[standings.length - 1].name;
  badges[lastParticipantName].push({
    emoji: "🐢",
    title: "Farolillo Rojo",
    class: "tag-remontando",
    desc: "Preparando la remontada..."
  });

  // 2. 🎯 El Francotirador (Mayor % de exactos respecto a sus predicciones totales)
  let maxExactRatio = 0;
  const ratios = standings.map((p) => {
    const ratio = p.predictedCount > 0 ? p.exactCount / p.predictedCount : 0;
    if (p.exactCount > 0 && ratio > maxExactRatio) maxExactRatio = ratio;
    return { name: p.name, ratio };
  });
  if (maxExactRatio > 0) {
    ratios.forEach((r) => {
      if (r.ratio === maxExactRatio) {
        badges[r.name].push({
          emoji: "🎯",
          title: "Francotirador",
          class: "tag-francotirador",
          desc: `Precisión del ${(r.ratio * 100).toFixed(0)}% en aciertos exactos`
        });
      }
    });
  }

  // 3. ⚖️ El Pacifista (Rey del Empate - más empates reales predichos correctamente)
  const drawCounts = standings.map((p) => {
    let correctDraws = 0;
    finishedMatches.forEach((m) => {
      if (m.homeScore === m.awayScore) {
        const pred = p.predictions[m.id];
        if (pred && pred.homeScore === pred.awayScore) {
          correctDraws++;
        }
      }
    });
    return { name: p.name, count: correctDraws };
  });
  const maxDraws = Math.max(...drawCounts.map((d) => d.count));
  if (maxDraws > 0) {
    drawCounts.forEach((d) => {
      if (d.count === maxDraws) {
        badges[d.name].push({
          emoji: "⚖️",
          title: "Pacifista",
          class: "tag-pacifista",
          desc: `Acertó ${d.count} empates en el mundial`
        });
      }
    });
  }

  // 4. ⚽ El Optimista & 5. 🛡️ El Conservador (Promedio de goles predichos)
  const avgGoals = standings.map((p) => {
    let total = 0, count = 0;
    Object.values(p.predictions).forEach((pred) => {
      if (pred && pred.homeScore !== undefined && pred.homeScore !== null) {
        total += Number(pred.homeScore) + Number(pred.awayScore);
        count++;
      }
    });
    return { name: p.name, avg: count > 0 ? total / count : 0 };
  });

  const maxAvg = Math.max(...avgGoals.map((x) => x.avg));
  const minAvg = Math.min(...avgGoals.map((x) => x.avg));

  if (maxAvg > 0) {
    avgGoals.forEach((x) => {
      if (x.avg === maxAvg) {
        badges[x.name].push({
          emoji: "⚽",
          title: "Optimista",
          class: "tag-optimista",
          desc: `Promedio de goles predichos más alto: ${x.avg.toFixed(2)} por partido`
        });
      }
      if (x.avg === minAvg && minAvg < maxAvg) {
        badges[x.name].push({
          emoji: "🛡️",
          title: "Conservador",
          class: "tag-conservador",
          desc: `Promedio de goles predichos más bajo: ${x.avg.toFixed(2)} por partido`
        });
      }
    });
  }

  // 6. 💔 El Casi Casi (Errores por exactamente 1 gol tras acertar ganador)
  const casiCasiCounts = standings.map((p) => {
    let count = 0;
    finishedMatches.forEach((m) => {
      const pred = p.predictions[m.id];
      if (pred && pred.homeScore !== null && pred.awayScore !== null) {
        const result = scorePredict(pred, m);
        if (result.type === "winner") {
          const err = Math.abs(Number(pred.homeScore) - m.homeScore) + Math.abs(Number(pred.awayScore) - m.awayScore);
          if (err === 1) {
            count++;
          }
        }
      }
    });
    return { name: p.name, count };
  });
  const maxCasiCasi = Math.max(...casiCasiCounts.map((x) => x.count));
  if (maxCasiCasi > 0) {
    casiCasiCounts.forEach((x) => {
      if (x.count === maxCasiCasi) {
        badges[x.name].push({
          emoji: "💔",
          title: "Casi Casi",
          class: "tag-casicasi",
          desc: `Estuvo a exactamente 1 gol de acertar marcador exacto en ${x.count} ocasiones`
        });
      }
    });
  }

  // 7. 🦁 El Rebelde (Acertar resultados sorprendentes donde sumó <= 25% del grupo)
  const rebeldeCounts = {};
  standings.forEach((p) => { rebeldeCounts[p.name] = 0; });
  finishedMatches.forEach((m) => {
    const scorers = [];
    standings.forEach((p) => {
      const pred = p.predictions[m.id];
      if (pred) {
        const result = scorePredict(pred, m);
        if (result.points > 0) {
          scorers.push(p.name);
        }
      }
    });
    if (scorers.length > 0 && (scorers.length / standings.length) <= 0.25) {
      scorers.forEach((name) => {
        rebeldeCounts[name]++;
      });
    }
  });
  const maxRebelde = Math.max(...Object.values(rebeldeCounts));
  if (maxRebelde > 0) {
    standings.forEach((p) => {
      if (rebeldeCounts[p.name] === maxRebelde) {
        badges[p.name].push({
          emoji: "🦁",
          title: "Rebelde",
          class: "tag-rebelde",
          desc: `Acertó ${rebeldeCounts[p.name]} resultados sorpresa donde casi nadie sumó puntos`
        });
      }
    });
  }

  // 8. 🔮 El Clónico (Predicciones idénticas repetidas)
  const clonicoFreqs = standings.map((p) => {
    const counts = {};
    Object.values(p.predictions).forEach((pred) => {
      if (pred && pred.homeScore !== undefined && pred.homeScore !== null) {
        const key = `${pred.homeScore}-${pred.awayScore}`;
        counts[key] = (counts[key] || 0) + 1;
      }
    });
    let maxKey = "";
    let maxFreq = 0;
    Object.entries(counts).forEach(([key, val]) => {
      if (val > maxFreq) {
        maxFreq = val;
        maxKey = key;
      }
    });
    return { name: p.name, score: maxKey, freq: maxFreq };
  });
  const maxFreqVal = Math.max(...clonicoFreqs.map((x) => x.freq));
  if (maxFreqVal > 5) {
    clonicoFreqs.forEach((x) => {
      if (x.freq === maxFreqVal) {
        badges[x.name].push({
          emoji: "🔮",
          title: "Clónico",
          class: "tag-clonico",
          desc: `Repitió su marcador favorito (${x.score}) unas ${x.freq} veces en sus apuestas`
        });
      }
    });
  }

  if (finishedMatches.length > 0) {
    // 9. 🔥 En Racha (Más puntos en la última fecha de partidos terminados)
    const lastMatch = finishedMatches[finishedMatches.length - 1];
    const lastDateStr = getPanamaDateTime(lastMatch).dateStr;
    const lastMatchesOnDate = finishedMatches.filter(
      (m) => getPanamaDateTime(m).dateStr === lastDateStr
    );

    const lastDatePoints = standings.map((p) => {
      let pts = 0;
      lastMatchesOnDate.forEach((m) => {
        const result = scorePredict(p.predictions[m.id], m);
        pts += result.points;
      });
      return { name: p.name, pts };
    });
    const maxLastDatePoints = Math.max(...lastDatePoints.map((x) => x.pts));
    if (maxLastDatePoints > 0) {
      lastDatePoints.forEach((x) => {
        if (x.pts === maxLastDatePoints) {
          badges[x.name].push({
            emoji: "🔥",
            title: "En Racha",
            class: "tag-racha",
            desc: `Sumó ${x.pts} pts en la última fecha jugada`
          });
        }
      });
    }

    // 10. 🎢 La Montaña Rusa (Mayor cantidad de cambios de posición/volatilidad de rango)
    const playerPointsHistory = {};
    standings.forEach((p) => {
      playerPointsHistory[p.name] = 0;
    });

    const rankChanges = {};
    standings.forEach((p) => {
      rankChanges[p.name] = 0;
    });

    let previousRanks = {};

    finishedMatches.forEach((m) => {
      standings.forEach((p) => {
        const result = scorePredict(p.predictions[m.id], m);
        playerPointsHistory[p.name] += result.points;
      });

      const snapshotStandings = standings
        .map((p) => ({
          name: p.name,
          points: playerPointsHistory[p.name],
          exactCount: p.exactCount,
          winnerCount: p.winnerCount
        }))
        .sort((a, b) => {
          if (b.points !== a.points) return b.points - a.points;
          if (b.exactCount !== a.exactCount) return b.exactCount - a.exactCount;
          return b.winnerCount - a.winnerCount;
        });

      const currentRanks = {};
      snapshotStandings.forEach((p, idx) => {
        currentRanks[p.name] = idx + 1;
      });

      if (Object.keys(previousRanks).length > 0) {
        standings.forEach((p) => {
          const diff = Math.abs(currentRanks[p.name] - previousRanks[p.name]);
          rankChanges[p.name] += diff;
        });
      }
      previousRanks = currentRanks;
    });

    const maxChanges = Math.max(...Object.values(rankChanges));
    if (maxChanges > 0) {
      standings.forEach((p) => {
        if (rankChanges[p.name] === maxChanges) {
          badges[p.name].push({
            emoji: "🎢",
            title: "Montaña Rusa",
            class: "tag-volatil",
            desc: `Cambió de posición ${rankChanges[p.name]} veces en el torneo`
          });
        }
      });
    }
  }

  // 11. 🧱 Portero de Acero (Predijo más partidos 0-0)
  const cerosCounts = standings.map((p) => {
    let count = 0;
    Object.values(p.predictions).forEach((pred) => {
      if (pred && Number(pred.homeScore) === 0 && Number(pred.awayScore) === 0) {
        count++;
      }
    });
    return { name: p.name, count };
  });
  const maxCeros = Math.max(...cerosCounts.map((x) => x.count));
  if (maxCeros >= 3) {
    cerosCounts.forEach((x) => {
      if (x.count === maxCeros) {
        badges[x.name].push({
          emoji: "🧱",
          title: "Portero de Acero",
          class: "tag-portero",
          desc: `Predijo ${x.count} partidos con marcador 0-0. ¡Creía en el fútbol aburrido!`
        });
      }
    });
  }

  // 12. 🤡 El Puyero (Adivino Fallido — predijo más empates pero acertó el menor % de ellos)
  const puyeroCounts = standings.map((p) => {
    let predictedDraws = 0;
    let correctDraws = 0;
    finishedMatches.forEach((m) => {
      const pred = p.predictions[m.id];
      if (pred && Number(pred.homeScore) === Number(pred.awayScore)) {
        predictedDraws++;
        if (m.homeScore === m.awayScore) correctDraws++;
      }
    });
    const failRate = predictedDraws > 0 ? (predictedDraws - correctDraws) / predictedDraws : 0;
    return { name: p.name, predictedDraws, correctDraws, failRate };
  });
  // Must have predicted at least 3 draws to qualify
  const puyeroQualified = puyeroCounts.filter((x) => x.predictedDraws >= 3);
  if (puyeroQualified.length > 0) {
    const maxFailRate = Math.max(...puyeroQualified.map((x) => x.failRate));
    if (maxFailRate >= 0.7) {
      puyeroQualified.forEach((x) => {
        if (x.failRate === maxFailRate) {
          badges[x.name].push({
            emoji: "🤡",
            title: "El Puyero",
            class: "tag-puyero",
            desc: `Apostó ${x.predictedDraws} empates y solo acertó ${x.correctDraws}. ¡Los empates no son lo suyo!`
          });
        }
      });
    }
  }

  // 13. 🏖️ El Vacacionista (Menos predicciones ingresadas — se fue de vacaciones)
  const minPredicted = Math.min(...standings.map((p) => p.predictedCount));
  // Only give this badge if the participant actually missed a significant number
  const maxPredicted = Math.max(...standings.map((p) => p.predictedCount));
  if (maxPredicted > 0 && minPredicted < maxPredicted * 0.8) {
    standings.forEach((p) => {
      if (p.predictedCount === minPredicted) {
        badges[p.name].push({
          emoji: "🏖️",
          title: "Vacacionista",
          class: "tag-vacacionista",
          desc: `Solo ingresó ${p.predictedCount} predicciones de ${maxPredicted}. ¡Parece que se fue de vacaciones durante el mundial!`
        });
      }
    });
  }

  // 14. 🐑 La Oveja (Sus predicciones son las más similares a las del líder)
  if (standings.length >= 2) {
    const leader = standings[0];
    const similarityCounts = standings.slice(1).map((p) => {
      let sameCount = 0;
      Object.keys(leader.predictions).forEach((matchId) => {
        const leaderPred = leader.predictions[matchId];
        const pPred = p.predictions[matchId];
        if (leaderPred && pPred &&
            Number(leaderPred.homeScore) === Number(pPred.homeScore) &&
            Number(leaderPred.awayScore) === Number(pPred.awayScore)) {
          sameCount++;
        }
      });
      return { name: p.name, sameCount };
    });
    const maxSimilarity = Math.max(...similarityCounts.map((x) => x.sameCount));
    if (maxSimilarity >= 5) {
      similarityCounts.forEach((x) => {
        if (x.sameCount === maxSimilarity) {
          badges[x.name].push({
            emoji: "🐑",
            title: "La Oveja",
            class: "tag-oveja",
            desc: `Copió ${x.sameCount} predicciones exactas del líder. ¡Beeee, beeee!`
          });
        }
      });
    }
  }

  // 15. 💸 El Apostador Loco (Predijo el marcador más escandaloso — mayor diferencia de goles en una sola predicción)
  const escandalosoData = standings.map((p) => {
    let maxDiff = 0;
    let worstScore = "";
    Object.values(p.predictions).forEach((pred) => {
      if (pred && pred.homeScore !== null && pred.awayScore !== null) {
        const diff = Math.abs(Number(pred.homeScore) - Number(pred.awayScore));
        if (diff > maxDiff) {
          maxDiff = diff;
          worstScore = `${pred.homeScore}-${pred.awayScore}`;
        }
      }
    });
    return { name: p.name, maxDiff, worstScore };
  });
  const maxEscandaloso = Math.max(...escandalosoData.map((x) => x.maxDiff));
  if (maxEscandaloso >= 5) {
    escandalosoData.forEach((x) => {
      if (x.maxDiff === maxEscandaloso) {
        badges[x.name].push({
          emoji: "💸",
          title: "Apostador Loco",
          class: "tag-apostador",
          desc: `Predijo un marcador de ${x.worstScore}. ¡Eso no es una predicción, es una fantasía!`
        });
      }
    });
  }

  // 16. 🍍 La Piña (Peor racha — más partidos consecutivos sin sumar un solo punto)
  if (finishedMatches.length >= 5) {
    const rachaMalaCounts = standings.map((p) => {
      let maxBadStreak = 0;
      let currentStreak = 0;
      finishedMatches.forEach((m) => {
        const result = scorePredict(p.predictions[m.id], m);
        if (result.points === 0) {
          currentStreak++;
          if (currentStreak > maxBadStreak) maxBadStreak = currentStreak;
        } else {
          currentStreak = 0;
        }
      });
      return { name: p.name, streak: maxBadStreak };
    });
    const maxBadStreak = Math.max(...rachaMalaCounts.map((x) => x.streak));
    if (maxBadStreak >= 5) {
      rachaMalaCounts.forEach((x) => {
        if (x.streak === maxBadStreak) {
          badges[x.name].push({
            emoji: "🍍",
            title: "La Piña",
            class: "tag-pina",
            desc: `Encadenó ${x.streak} partidos consecutivos sin sumar ni un punto. ¡Qué mala pata!`
          });
        }
      });
    }
  }

  // 17. 🎲 El Seis Doble (Predijo empates con marcador idéntico más veces — ej: 1-1, 2-2, etc.)
  const seisDobleData = standings.map((p) => {
    let tiedPredCount = 0;
    let mostFreqTied = "";
    const tiedFreqs = {};
    Object.values(p.predictions).forEach((pred) => {
      if (pred && pred.homeScore !== null && pred.awayScore !== null) {
        if (Number(pred.homeScore) === Number(pred.awayScore) && Number(pred.homeScore) > 0) {
          tiedPredCount++;
          const key = `${pred.homeScore}-${pred.awayScore}`;
          tiedFreqs[key] = (tiedFreqs[key] || 0) + 1;
        }
      }
    });
    let maxTiedFreq = 0;
    Object.entries(tiedFreqs).forEach(([key, val]) => {
      if (val > maxTiedFreq) { maxTiedFreq = val; mostFreqTied = key; }
    });
    return { name: p.name, tiedPredCount, mostFreqTied, maxTiedFreq };
  });
  const maxSeis = Math.max(...seisDobleData.map((x) => x.tiedPredCount));
  if (maxSeis >= 4) {
    seisDobleData.forEach((x) => {
      if (x.tiedPredCount === maxSeis) {
        badges[x.name].push({
          emoji: "🎲",
          title: "Seis Doble",
          class: "tag-seisdoble",
          desc: `Predijo ${x.tiedPredCount} empates con marcador idéntico (más frecuente: ${x.mostFreqTied}). ¡Fan del domino!`
        });
      }
    });
  }

  // 18. 📭 Dirección Incorrecta (Predijo que un equipo ganaba, pero ese equipo perdió por 2 o más goles)
  const direccionIncorrectaCounts = standings.map((p) => {
    let count = 0;
    finishedMatches.forEach((m) => {
      const pred = p.predictions[m.id];
      if (pred && pred.homeScore !== null && pred.awayScore !== null) {
        const predHomeWin = Number(pred.homeScore) > Number(pred.awayScore);
        const predAwayWin = Number(pred.awayScore) > Number(pred.homeScore);
        const realHomeWin = m.homeScore > m.awayScore;
        const realAwayWin = m.awayScore > m.homeScore;

        if (predHomeWin && realAwayWin && (m.awayScore - m.homeScore >= 2)) {
          count++;
        } else if (predAwayWin && realHomeWin && (m.homeScore - m.awayScore >= 2)) {
          count++;
        }
      }
    });
    return { name: p.name, count };
  });

  const maxDireccionIncorrecta = Math.max(...direccionIncorrectaCounts.map((x) => x.count));
  if (maxDireccionIncorrecta > 0) {
    direccionIncorrectaCounts.forEach((x) => {
      if (x.count === maxDireccionIncorrecta) {
        badges[x.name].push({
          emoji: "📭",
          title: "Dirección Incorrecta",
          class: "tag-direccion-incorrecta",
          desc: `Predijo la victoria de un equipo que terminó siendo goleado (perdió por 2+ goles de diferencia) en ${x.count} ocasiones. ¡Le entregó el paquete a la casa equivocada!`
        });
      }
    });
  }

  // 19. 🛃 Retraso de Aduana (Tiene predicciones de la fase actual pendientes sin ingresar)
  const pendingMatches = matchesData.filter((m) => m.status === "pending");
  if (pendingMatches.length > 0) {
    // Ordenar partidos pendientes por fecha y hora para encontrar el más próximo
    const sortedPending = [...pendingMatches].sort((a, b) => {
      const dateDiff = a.date.localeCompare(b.date);
      if (dateDiff !== 0) return dateDiff;
      return a.time.localeCompare(b.time);
    });
    const currentPhaseGroup = sortedPending[0].group;

    // Filtrar los partidos pendientes solo para la fase actual
    const currentPhasePending = pendingMatches.filter((m) => m.group === currentPhaseGroup);

    standings.forEach((p) => {
      let missingCount = 0;
      currentPhasePending.forEach((m) => {
        const pred = p.predictions[m.id];
        if (!pred || pred.homeScore === null || pred.awayScore === null || pred.homeScore === undefined || pred.awayScore === undefined) {
          missingCount++;
        }
      });
      if (missingCount > 0) {
        const phaseName = currentPhaseGroup === "QF" ? "Cuartos de Final" :
                          currentPhaseGroup === "SF" ? "Semifinales" :
                          currentPhaseGroup === "FINAL" ? "Final" :
                          currentPhaseGroup === "R16" ? "Octavos de Final" :
                          currentPhaseGroup === "R32" ? "Dieciseisavos de Final" : `Grupo ${currentPhaseGroup}`;

        badges[p.name].push({
          emoji: "🛃",
          title: "Retraso de Aduana",
          class: "tag-retraso-aduana",
          desc: `Tiene ${missingCount} partidos pendientes de ${phaseName} sin pronosticar. ¡Su paquete está retenido en aduana por falta de documentación!`
        });
      }
    });
  }


  // 20. 🪙 Propina Mínima (Muchos aciertos de ganador simple, pero casi ningún marcador exacto)
  const propinaData = standings
    .map((p) => {
      const totalHits = p.exactCount + p.winnerCount;
      const ratio = totalHits > 0 ? p.exactCount / totalHits : 1;
      return { name: p.name, exact: p.exactCount, winner: p.winnerCount, ratio, totalHits };
    })
    .filter((x) => x.totalHits >= 3);

  if (propinaData.length > 0) {
    const minRatio = Math.min(...propinaData.map((x) => x.ratio));
    if (minRatio < 0.20 || minRatio === 0) {
      propinaData.forEach((x) => {
        if (x.ratio === minRatio) {
          badges[x.name].push({
            emoji: "🪙",
            title: "Propina Mínima",
            class: "tag-propina-minima",
            desc: `Logró ${x.winner} aciertos de ganador simple pero solo ${x.exact} marcadores exactos. ¡Mucho esfuerzo repartiendo para recibir solo propinas!`
          });
        }
      });
    }
  }

  return badges;
}

// ===== MOSTRAR DETALLE DEL LOGRO (MODAL) =====
function showBadgeInfoModal(badgeTitle, badgeEmoji, badgeDesc) {
  const existing = document.getElementById("badge-info-modal");
  if (existing) existing.remove();

  const overlay = document.createElement("div");
  overlay.id = "badge-info-modal";
  overlay.className = "modal-overlay open";
  overlay.style.zIndex = "2000"; // Display on top of other modals

  overlay.innerHTML = `
    <div class="modal" style="max-width: 360px; padding: 24px; text-align: center; border-radius: var(--radius-lg); position: relative; margin: auto;">
      <button class="modal-close" id="badge-modal-close" style="position: absolute; right: 16px; top: 16px; font-size: 1.2rem; background: none; border: none; cursor: pointer; color: var(--text-secondary);">✕</button>
      <div style="font-size: 3rem; margin-bottom: 12px; animation: bounce 1s ease infinite;">${badgeEmoji}</div>
      <h3 style="font-size: 1.25rem; font-weight: 800; color: var(--primary); margin-bottom: 8px; text-transform: uppercase; letter-spacing: 0.05em;">${badgeTitle}</h3>
      <p style="font-size: 0.9rem; color: var(--text-secondary); line-height: 1.5; margin-bottom: 16px;">${badgeDesc}</p>
      <button id="badge-modal-btn" style="background: var(--primary); color: white; border: none; padding: 8px 24px; border-radius: var(--radius-sm); font-weight: 700; cursor: pointer; transition: background var(--transition);">Entendido</button>
    </div>
  `;

  document.body.appendChild(overlay);

  const close = () => {
    overlay.classList.remove("open");
    setTimeout(() => overlay.remove(), 200);
  };

  overlay.querySelector("#badge-modal-close").addEventListener("click", close);
  overlay.querySelector("#badge-modal-btn").addEventListener("click", close);
  overlay.addEventListener("click", (e) => {
    if (e.target === overlay) close();
  });
}

// ===== TABLA DE POSICIONES =====
function renderRankingTable(standings) {
  const tbody = document.getElementById("ranking-body");
  tbody.innerHTML = "";

  const allBadges = calculateAdvancedBadges(standings);

  standings.forEach((p, i) => {
    const rank = p.rank;
    let rankHtml;
    if (isPanicEditing) {
      const isFirst = i === 0;
      const isLast = i === standings.length - 1;
      rankHtml = `
        <div class="panic-controls">
          <button class="panic-move-btn up-btn" ${isFirst ? "disabled" : ""} onclick="event.stopPropagation(); moveParticipant(${i}, -1);">🔼</button>
          <button class="panic-move-btn down-btn" ${isLast ? "disabled" : ""} onclick="event.stopPropagation(); moveParticipant(${i}, 1);">🔽</button>
        </div>
      `;
    } else {
      if (rank === 1) rankHtml = `<span class="rank-badge r1">🥇</span>`;
      else if (rank === 2) rankHtml = `<span class="rank-badge r2">🥈</span>`;
      else if (rank === 3) rankHtml = `<span class="rank-badge r3">🥉</span>`;
      else rankHtml = `<span class="rank-badge rn">${rank}</span>`;
    }

    // Insert zone headers for a fun experience
    if (i === 0) {
      const header = document.createElement("div");
      header.className = "ranking-zone-header zone-champions";
      header.innerHTML = "🌟 Zona Champions (Puestos 1-3)";
      tbody.appendChild(header);
    } else if (i === 3) {
      const header = document.createElement("div");
      header.className = "ranking-zone-header zone-media";
      header.innerHTML = "⚔️ Mitad de Tabla (Puestos 4-6)";
      tbody.appendChild(header);
    } else if (i === 6) {
      const header = document.createElement("div");
      header.className = "ranking-zone-header zone-repechaje";
      header.innerHTML = "🥶 Zona de Repechaje (Puestos 7-9)";
      tbody.appendChild(header);
    }

    const row = document.createElement("div");
    row.className = `ranking-row${isPanicEditing ? " panic-mode-active-row" : ""}`;
    row.innerHTML = `
      <div class="col-rank">${rankHtml}</div>
      <div class="col-name">
        <span class="avatar-circle" style="background: rgba(0,0,0,0.04); font-size:1.1rem;">${p.avatar}</span>
        <div class="name-badges-wrapper">
          <span style="font-weight:600;">${p.name}</span>
          <span class="row-badges-container" style="display: inline-flex; gap: 4px; flex-wrap: wrap;"></span>
        </div>
      </div>
      <div class="col-pts">${p.totalPoints}</div>
      <div class="col-exact">🎯 ${p.exactCount}</div>
      <div class="col-winner">✅ ${p.winnerCount}</div>
      <div class="col-total">${p.predictedCount}</div>
    `;

    // Add badge elements individually with click listeners
    const badgesContainer = row.querySelector(".row-badges-container");
    const pBadges = allBadges[p.name] || [];
    pBadges.forEach((badge) => {
      const span = document.createElement("span");
      span.className = `badge-tag ${badge.class}`;
      span.title = badge.desc;
      span.innerHTML = `${badge.emoji} <span class="badge-text">${badge.title}</span>`;
      span.addEventListener("click", (e) => {
        e.stopPropagation(); // Prevent opening the participant modal
        showBadgeInfoModal(badge.title, badge.emoji, badge.desc);
      });
      badgesContainer.appendChild(span);
    });

    row.addEventListener("click", () => {
      if (!isPanicEditing) {
        openModal(p);
      }
    });
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
  if (!match.time)
    return {
      sortValue: match.date + "T99:99",
      dateStr: match.date,
      timeStr: "",
    };

  const [y, m, d] = match.date.split("-").map(Number);
  const [h, min] = match.time.split(":").map(Number);

  // Rule: If UTC hour is between 0 and 6, the match takes place on the next day in UTC compared to local date
  let utcDay = d;
  if (h >= 0 && h <= 6) {
    utcDay = d + 1;
  }

  const utcDate = new Date(Date.UTC(y, m - 1, utcDay, h, min));

  // Subtract 5 hours from UTC timestamp to get Panama time
  const panamaTimeMs = utcDate.getTime() - 5 * 60 * 60 * 1000;
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

      let penaltyHtml = "";
      if (isFinished && match.homeScore === match.awayScore && KNOCKOUT_GROUPS.includes(match.group)) {
        if (match.homePenalties !== undefined && match.awayPenalties !== undefined && match.homePenalties !== null && match.awayPenalties !== null) {
          penaltyHtml = `<div class="match-penalties" style="font-size: 0.8em; opacity: 0.7; font-weight: bold; margin-top: 2px;">(${match.homePenalties} - ${match.awayPenalties} Pen.)</div>`;
        }
      }

      const scoreHtml =
        isFinished || isLive
          ? `<div style="display: flex; flex-direction: column; align-items: center;">
               <div style="display: flex; align-items: center;">
                 <div class="score-box">${match.homeScore}</div>
                 <span class="score-separator">–</span>
                 <div class="score-box">${match.awayScore}</div>
               </div>
               ${penaltyHtml}
             </div>`
          : `<div class="score-pending">vs</div>`;

      const statusLabel = isFinished
        ? "Finalizado"
        : isLive
          ? "🔴 En vivo"
          : match.time
            ? formatPanamaTime(match.time)
            : "Pendiente";
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
          resultHtml = `<span class="pred-result pending">${match.time ? formatPanamaTime(match.time) : "Pendiente"}</span>`;
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
            matchesData.forEach((m) => {
              matchesMap[m.id] = m;
            });
            const roundsConfig = [
              {
                key: "R16",
                matches: [
                  "R16_1",
                  "R16_2",
                  "R16_3",
                  "R16_4",
                  "R16_5",
                  "R16_6",
                  "R16_7",
                  "R16_8",
                ],
              },
              { key: "QF", matches: ["QF_1", "QF_2", "QF_3", "QF_4"] },
              { key: "SF", matches: ["SF_1", "SF_2"] },
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
      const todayMs = new Date(
        yyyy,
        today.getMonth(),
        today.getDate(),
      ).getTime();

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
    let penaltySuffix = "";
    if (isFinished && match.homeScore === match.awayScore && KNOCKOUT_GROUPS.includes(match.group)) {
      if (match.homePenalties !== undefined && match.awayPenalties !== undefined && match.homePenalties !== null && match.awayPenalties !== null) {
        penaltySuffix = ` (${match.homePenalties} - ${match.awayPenalties} Pen.)`;
      }
    }
    const realScoreHtml =
      isFinished || isLive
        ? `<span class="real-score-footer">Real: <strong>${match.homeScore} – ${match.awayScore}${penaltySuffix}</strong></span>`
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
            ${isFinished ? "Finalizado" : isLive ? "🔴 En vivo" : match.time ? `${formatDate(getPanamaDateTime(match).dateStr)} · ${formatPanamaTime(match.time)}` : formatDate(getPanamaDateTime(match).dateStr)}
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
  const uniqueDates = [
    ...new Set(matchesData.map((m) => getPanamaDateTime(m).dateStr)),
  ].sort();

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

  const matches = matchesData.filter(
    (m) => getPanamaDateTime(m).dateStr === selectedDateStr,
  );

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

    let penaltyHtml = "";
    if (isFinished && match.homeScore === match.awayScore && KNOCKOUT_GROUPS.includes(match.group)) {
      if (match.homePenalties !== undefined && match.awayPenalties !== undefined && match.homePenalties !== null && match.awayPenalties !== null) {
        penaltyHtml = `<div class="match-penalties" style="font-size: 0.8em; opacity: 0.7; font-weight: bold; margin-top: 2px;">(${match.homePenalties} - ${match.awayPenalties} Pen.)</div>`;
      }
    }

    const scoreHtml =
      isFinished || isLive
        ? `<div style="display: flex; flex-direction: column; align-items: center;">
             <div style="display: flex; align-items: center;">
               <div class="score-box">${match.homeScore}</div>
               <span class="score-separator">–</span>
               <div class="score-box">${match.awayScore}</div>
             </div>
             ${penaltyHtml}
           </div>`
        : `<div class="score-pending">vs</div>`;

    const statusLabel = isFinished
      ? "Finalizado"
      : isLive
        ? "🔴 En vivo"
        : match.time
          ? formatPanamaTime(match.time)
          : formatDate(getPanamaDateTime(match).dateStr);
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

const KNOCKOUT_GROUPS = ["R32", "R16", "QF", "SF", "FINAL"];

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
  let homeWinner = false,
    awayWinner = false;
  if (isFinished && match.homeScore !== null && match.awayScore !== null) {
    if (match.homeScore > match.awayScore) {
      homeWinner = true;
    } else if (match.awayScore > match.homeScore) {
      awayWinner = true;
    } else if (KNOCKOUT_GROUPS.includes(match.group)) {
      if (match.homePenalties !== undefined && match.awayPenalties !== undefined && match.homePenalties !== null && match.awayPenalties !== null) {
        if (Number(match.homePenalties) > Number(match.awayPenalties)) {
          homeWinner = true;
        } else if (Number(match.awayPenalties) > Number(match.homePenalties)) {
          awayWinner = true;
        }
      }
    }
  }

  const statusLabel = isFinished
    ? "Finalizado"
    : isLive
      ? "🔴 En vivo"
      : match.time
        ? `${formatDate(getPanamaDateTime(match).dateStr)} · ${formatPanamaTime(match.time)}`
        : formatDate(getPanamaDateTime(match).dateStr);

  let homeScore = isFinished || isLive ? String(match.homeScore) : "";
  let awayScore = isFinished || isLive ? String(match.awayScore) : "";

  if (isFinished && match.homeScore === match.awayScore && KNOCKOUT_GROUPS.includes(match.group)) {
    if (match.homePenalties !== undefined && match.awayPenalties !== undefined && match.homePenalties !== null && match.awayPenalties !== null) {
      homeScore += ` (${match.homePenalties})`;
      awayScore += ` (${match.awayPenalties})`;
    }
  }

  const shortName = (name) => (name.length > 16 ? name.split(" ")[0] : name);

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

  let homeWinner = false,
    awayWinner = false;
  if (isFinished && match.homeScore !== null && match.awayScore !== null) {
    if (match.homeScore > match.awayScore) {
      homeWinner = true;
    } else if (match.awayScore > match.homeScore) {
      awayWinner = true;
    } else if (KNOCKOUT_GROUPS.includes(match.group)) {
      if (match.homePenalties !== undefined && match.awayPenalties !== undefined && match.homePenalties !== null && match.awayPenalties !== null) {
        if (Number(match.homePenalties) > Number(match.awayPenalties)) {
          homeWinner = true;
        } else if (Number(match.awayPenalties) > Number(match.homePenalties)) {
          awayWinner = true;
        }
      }
    }
  }

  const statusLabel = isFinished
    ? "Finalizado"
    : isLive
      ? "🔴 En vivo"
      : match.time
        ? `${formatDate(getPanamaDateTime(match).dateStr)} · ${formatPanamaTime(match.time)}`
        : "Pendiente";

  const statusClass = isFinished ? "finished" : isLive ? "live" : "pending";

  let homeScore = isFinished || isLive ? String(match.homeScore) : "—";
  let awayScore = isFinished || isLive ? String(match.awayScore) : "—";

  if (isFinished && match.homeScore === match.awayScore && KNOCKOUT_GROUPS.includes(match.group)) {
    if (match.homePenalties !== undefined && match.awayPenalties !== undefined && match.homePenalties !== null && match.awayPenalties !== null) {
      homeScore += ` (${match.homePenalties})`;
      awayScore += ` (${match.awayPenalties})`;
    }
  }

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

  // MATCH_HEIGHT: height of a bt-card in px (top-bar ~24 + 2x team-row ~38 each = ~100)
  const MATCH_H = 104;
  const MATCH_W = 236; // column width
  const GAP_X = 40; // horizontal gap between columns

  const roundsConfig = [
    {
      key: "R16",
      matches: [
        "R16_1",
        "R16_2",
        "R16_3",
        "R16_4",
        "R16_5",
        "R16_6",
        "R16_7",
        "R16_8",
      ],
      label: "Octavos",
    },
    { key: "QF", matches: ["QF_1", "QF_2", "QF_3", "QF_4"], label: "Cuartos" },
    { key: "SF", matches: ["SF_1", "SF_2"], label: "Semis" },
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
  finalContent.style.cssText =
    "display:flex; flex-direction:column; gap:20px; flex:1; justify-content:center;";

  const f2Match = matchesMap["F_2"];
  if (f2Match) {
    const w2 = document.createElement("div");
    w2.style.cssText = "padding: 0 8px;";
    w2.dataset.matchId = "F_2";

    const label2 = document.createElement("div");
    label2.style.cssText =
      "font-size:0.6rem; font-weight:800; text-transform:uppercase; letter-spacing:0.06em; color:var(--accent); margin-bottom:6px; text-align:center;";
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
    label1.style.cssText =
      "font-size:0.6rem; font-weight:800; text-transform:uppercase; letter-spacing:0.06em; color:#a1826e; margin-bottom:6px; text-align:center;";
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
  requestAnimationFrame(() =>
    drawBracketConnectors(tree, roundsConfig, matchesMap),
  );
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
    let top = 0,
      left = 0;
    let cur = el;
    while (cur && cur !== tree) {
      top += cur.offsetTop;
      left += cur.offsetLeft;
      cur = cur.offsetParent;
    }
    return { top, left, width: el.offsetWidth, height: el.offsetHeight };
  }

  const wrapperMap = {};
  tree.querySelectorAll("[data-match-id]").forEach((el) => {
    // Only pick direct wrappers (not nested cards)
    if (
      el.dataset.matchId &&
      !el.classList.contains("bt-card") &&
      !el.classList.contains("bm-card")
    ) {
      wrapperMap[el.dataset.matchId] = el;
    }
  });

  const connections = [
    ...Object.entries(R16_TO_QF).map(([target, sources]) => ({
      target,
      sources,
    })),
    ...Object.entries(QF_TO_SF).map(([target, sources]) => ({
      target,
      sources,
    })),
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

      const path = document.createElementNS(
        "http://www.w3.org/2000/svg",
        "path",
      );
      path.setAttribute(
        "d",
        `M ${sX} ${sY} C ${midX} ${sY}, ${midX} ${tY}, ${tX} ${tY}`,
      );
      path.setAttribute(
        "class",
        `bracket-connector-path${isFinished ? " finished" : ""}`,
      );
      svg.appendChild(path);
    });
  });

  tree.insertBefore(svg, tree.firstChild);
}

// ── Main render function ──
function renderBracket() {
  // Build match lookup map
  const matchesMap = {};
  matchesData.forEach((m) => {
    matchesMap[m.id] = m;
  });

  const r32Matches = matchesData
    .filter((m) => m.group === "R32")
    .sort((a, b) => {
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
let bracketMobileRound = "R16";

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
      selector
        .querySelectorAll(".bracket-round-btn")
        .forEach((b) => b.classList.remove("active"));
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
    matchesData.forEach((m) => {
      matchesMap[m.id] = m;
    });

    // Determine which matches to show for this round
    const roundMatchIds = {
      R16: [
        "R16_1",
        "R16_2",
        "R16_3",
        "R16_4",
        "R16_5",
        "R16_6",
        "R16_7",
        "R16_8",
      ],
      QF: ["QF_1", "QF_2", "QF_3", "QF_4"],
      SF: ["SF_1", "SF_2"],
      FINAL: ["F_2", "F_1"],
    };

    const ids = roundMatchIds[round] || [];
    const matches = ids
      .map((id) => matchesMap[id])
      .filter(Boolean)
      .sort((a, b) => {
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
  const isLive = match.status === "live";

  let homeWinner = false,
    awayWinner = false,
    isDraw = false;
  if (isFinished && match.homeScore !== null && match.awayScore !== null) {
    if (match.homeScore > match.awayScore) {
      homeWinner = true;
    } else if (match.awayScore > match.homeScore) {
      awayWinner = true;
    } else {
      isDraw = true;
      if (KNOCKOUT_GROUPS.includes(match.group)) {
        if (match.homePenalties !== undefined && match.awayPenalties !== undefined && match.homePenalties !== null && match.awayPenalties !== null) {
          if (Number(match.homePenalties) > Number(match.awayPenalties)) {
            homeWinner = true;
          } else if (Number(match.awayPenalties) > Number(match.homePenalties)) {
            awayWinner = true;
          }
        }
      }
    }
  }

  const statusClass = isFinished ? "finished" : isLive ? "live" : "pending";
  const statusLabel = isFinished
    ? "Finalizado"
    : isLive
      ? "🔴 En vivo"
      : "Pendiente";

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
    let penaltyText = "";
    if (isFinished && match.homeScore === match.awayScore && KNOCKOUT_GROUPS.includes(match.group)) {
      if (match.homePenalties !== undefined && match.awayPenalties !== undefined && match.homePenalties !== null && match.awayPenalties !== null) {
        penaltyText = `<div class="bmc-penalties-label" style="font-size: 0.85em; opacity: 0.8; margin-top: 4px;">(${match.homePenalties} - ${match.awayPenalties} Pen.)</div>`;
      }
    }
    scoreCenterHtml = `
      <div class="bmc-score-center">
        <div class="bmc-score">${match.homeScore}<span class="bmc-score-sep"> – </span>${match.awayScore}</div>
        ${penaltyText}
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
    const isPenaltyWin = match.homeScore === match.awayScore && KNOCKOUT_GROUPS.includes(match.group);
    if (homeWinner) {
      resultStripHtml = `<div class="bmc-result-strip win-home">🏆 Ganó ${match.home}${isPenaltyWin ? " (penales)" : ""}</div>`;
    } else if (awayWinner) {
      resultStripHtml = `<div class="bmc-result-strip win-away">🏆 Ganó ${match.away}${isPenaltyWin ? " (penales)" : ""}</div>`;
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
    matchesData.forEach((m) => {
      matchesMap[m.id] = m;
    });
    const roundsConfig = [
      {
        key: "R16",
        matches: [
          "R16_1",
          "R16_2",
          "R16_3",
          "R16_4",
          "R16_5",
          "R16_6",
          "R16_7",
          "R16_8",
        ],
      },
      { key: "QF", matches: ["QF_1", "QF_2", "QF_3", "QF_4"] },
      { key: "SF", matches: ["SF_1", "SF_2"] },
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

  document
    .getElementById("bpm-close-btn")
    .addEventListener("click", closeBracketPredModal);
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

  let penaltyDisplay = "";
  if (isFinished && match.homeScore === match.awayScore && KNOCKOUT_GROUPS.includes(match.group)) {
    if (match.homePenalties !== undefined && match.awayPenalties !== undefined && match.homePenalties !== null && match.awayPenalties !== null) {
      penaltyDisplay = `<div style="font-size:0.8rem; font-weight:bold; opacity:0.8; margin-top:2px;">(${match.homePenalties} - ${match.awayPenalties} Pen.)</div>`;
    }
  }

  const scoreDisplay =
    isFinished || isLive
      ? `<div style="display:flex; flex-direction:column; align-items:center;">
           <span class="bpm-score-display">${match.homeScore} – ${match.awayScore}</span>
           ${penaltyDisplay}
         </div>`
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
  sectionLabel.style.cssText =
    "font-size:0.68rem; font-weight:800; color:var(--text-muted); text-transform:uppercase; letter-spacing:0.06em; margin-bottom:4px;";
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
      if (result.type === "exact") {
        badgeClass = "exact";
        badgeText = `🎯 +${POINTS_EXACT}pts`;
      } else if (result.type === "winner") {
        badgeClass = "winner";
        badgeText = `✅ +${POINTS_WINNER}pt`;
      } else if (result.type === "wrong") {
        badgeClass = "wrong";
        badgeText = "❌ 0pts";
      } else {
        badgeClass = "pending";
        badgeText = "Pendiente";
      }
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
    empty.style.cssText =
      "text-align:center;color:var(--text-muted);font-size:0.85rem;padding:24px 0;";
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

// ===== MODO PÁNICO (SIMULACIÓN DE POSICIONES) =====
function setupPanicMode() {
  const toggleBtn = document.getElementById("panic-mode-toggle");
  const banner = document.getElementById("panic-warning-banner");
  const resetBtn = document.getElementById("panic-reset-btn");

  if (toggleBtn) {
    toggleBtn.addEventListener("click", () => {
      isPanicEditing = !isPanicEditing;
      if (isPanicEditing) {
        isPanicMode = true; // La simulación de puntos queda activa
        toggleBtn.textContent = "🚨 Modo Pánico: ON (Editando)";
        toggleBtn.classList.add("active");
        if (banner) banner.style.display = "flex";

        // Inicializar puntos simulados con el estado actual
        if (Object.keys(simulatedPoints).length === 0) {
          const currentStandings = computeStandings();
          currentStandings.forEach((p) => {
            simulatedPoints[p.name] = p.totalPoints;
          });
        }
      } else {
        // Apagamos modo edición pero conservamos los puntos simulados
        toggleBtn.textContent = "🚨 Modo Pánico: ON (Edit OFF)";
        toggleBtn.classList.remove("active");
        
        // Mantenemos el banner visible para advertir que los puntos siguen simulados
        if (banner) banner.style.display = "flex";
      }

      // Re-calcular y re-renderizar todo
      const standings = computeStandings();
      renderPodium(standings);
      renderRankingTable(standings);
    });
  }

  if (resetBtn) {
    resetBtn.addEventListener("click", () => {
      isPanicMode = false;
      isPanicEditing = false;
      simulatedPoints = {};

      if (toggleBtn) {
        toggleBtn.textContent = "🚨 Modo Pánico: OFF";
        toggleBtn.classList.remove("active");
      }
      if (banner) banner.style.display = "none";

      const normalStandings = computeStandings();
      renderPodium(normalStandings);
      renderRankingTable(normalStandings);
    });
  }
}

function moveParticipant(fromIndex, direction) {
  if (!isPanicEditing) return;
  const toIndex = fromIndex + direction;
  const standings = computeStandings();

  if (toIndex < 0 || toIndex >= standings.length) return;

  const p1 = standings[fromIndex];
  const p2 = standings[toIndex];

  // Asegurar que todos tengan un valor en simulatedPoints
  standings.forEach((p) => {
    if (simulatedPoints[p.name] === undefined) {
      simulatedPoints[p.name] = p.totalPoints;
    }
  });

  if (direction === 1) {
    // Moviendo hacia abajo: el participante que baja toma los puntos del de abajo menos 1
    const p2Pts = simulatedPoints[p2.name];
    simulatedPoints[p1.name] = p2Pts - 1;
  } else if (direction === -1) {
    // Moviendo hacia arriba: el participante que sube toma los puntos del de arriba más 1
    const p2Pts = simulatedPoints[p2.name];
    simulatedPoints[p1.name] = p2Pts + 1;
  }

  // Volver a calcular las posiciones con los nuevos puntos simulados y renderizar
  const newStandings = computeStandings();
  renderPodium(newStandings);
  renderRankingTable(newStandings);
}

