// Write the canvas updating stuff and demo logic here (NOT UI updates - NO ROUND TIMER etc)

// export as required

// Global vars
const roundTimeMins = document.getElementById("roundTimeMinutes");
const roundTimeSecs = document.getElementById("roundTimeSeconds");
const backgroundDiv = document.getElementById("scrubBarBackground");
const currentTickSpan = document.getElementById("currentTick");
const currentDemoTickSpan = document.getElementById("currentDemoTick");
const scrubBar = document.getElementById("timeline-range");
const roundSelect = document.getElementById("roundSelect");
const teamAlphaNameSpan = document.getElementById("teamAlphaName");
const teamAlphaScoreSpan = document.getElementById("teamAlphaScore");
const teamBetaNameSpan = document.getElementById("teamBetaName");
const teamBetaScoreSpan = document.getElementById("teamBetaScore");

import { settings, tickStore, CTColor, TColor, TBombColor, canvasSettings } from "../renderer.js";
import { clearKillFeed, setActiveRound, updateEventTimeline, updateKillFeed, updatePlayerHUD } from "./ui.js";

let canvas;
let ctx;
let map;
let imgDrawX, imgDrawY;
let lowerDrawX, lowerDrawY;
let mainMapImg, lowerMapImg;

export function loadCanvasVars(canvasEl, ctxEl) {
  canvas = canvasEl;
  ctx = ctxEl;
}

export function loadMapVars(mapdata) {
  map = mapdata;
}

export function loadMapImgContext(main, lower) {
  mainMapImg = main;
  lowerMapImg = lower;
}

const playerDirectionLineLength = 10;

export function constructTickMap(rounds) {
  let virtualTick = 0;
  const tickMap = {};

  rounds.forEach((round, round_index) => {
    for (let actualTick = round.startTick; actualTick <= round.officiallyEndedTick; actualTick++) {
      tickMap[virtualTick] = { round_index, actualTick };
      virtualTick++;
    }
  });

  tickStore.tickMap = tickMap;

  // Whilst we are at it, let's grab the max virtual tick possible.
  tickStore.maxTick = Object.keys(tickMap).length;

  // Also for scrubbing let's grab the starting virtual ticks for each round startTick.
  // const roundStartTicks = {};

  // rounds.forEach()

  // tickStore.roundVirtualStartTicks = roundStartTicks;
}

export function getTickData(tick) {
  const map = tickStore.tickMap[tick];
  if (!map) return null;

  const round = tickStore.rounds[map.round_index];
  return round.ticks[map.actualTick] || null;
}

export function getRoundInfo(tick) {
  const map = tickStore.tickMap[tick];
  if (!map) return null;

  const round = tickStore.rounds[map.round_index];
  return round;
}

export function getVirtualTickFromDemoTick(demoTick) {
  const tickPairs = Object.entries(tickStore.tickMap)
    .map(([virtual, actual]) => [virtual, actual.actualTick])
    .sort((a, b) => a[1] - b[1]);

  // Find the closest virtual tick (less than or equal to demoTick)
  let closest = undefined;
  for (const [virtual, actual] of tickPairs) {
    if (actual <= demoTick) {
      closest = virtual;
    } else {
      break;
    }
  }

  return parseInt(closest);
}

const teamAName = localStorage.getItem("teamAName");
const teamBName = localStorage.getItem("teamBName");

/**
 * @description Updates the `Round Timer`, `Current Round` UI elements.
 * @author Leo Tovell
 *
 * @exports
 * @param {Number} currentTick
 */
export function updateRoundInfo() {
  let round = tickStore.currentRound;

  // roundSelect.value = round.roundNumber;

  let roundTimeM = "1";
  let roundTimeS = "55";

  if (tickStore.currentDemoTick < round.freezeEndTick) {
    let lengthOfPreround = round.freezeEndTick - round.startTick;
    let ticksIntoPreround = tickStore.currentDemoTick - round.startTick;
    let timeRemaining = (lengthOfPreround - ticksIntoPreround) / 64;
    roundTimeM = Math.floor(timeRemaining / 60);
    roundTimeS = String(Math.floor(timeRemaining % 60)).padStart(2, "0");
  } else if (tickStore.currentDemoTick < round.endTick) {
    // What tick are we at into the round?
    let roundTick = tickStore.currentDemoTick - round.freezeEndTick;
    let secondsElapsedInRound = roundTick / 64;
    let roundTimeRemaining = 115 - secondsElapsedInRound;
    roundTimeM = Math.floor(roundTimeRemaining / 60);
    roundTimeS = String(Math.floor(roundTimeRemaining % 60)).padStart(2, "0");
  } else if (tickStore.currentDemoTick > round.endTick) {
    let lengthOfRoundEnd = round.officiallyEndedTick - round.endTick;
    let ticksIntoRoundEnd = tickStore.currentDemoTick - round.endTick;
    let timeRemaining = (lengthOfRoundEnd - ticksIntoRoundEnd) / 64;
    roundTimeM = Math.floor(timeRemaining / 60);
    roundTimeS = String(Math.floor(timeRemaining % 60)).padStart(2, "0");
  }

  roundTimeMins.innerHTML = roundTimeM;
  roundTimeSecs.innerHTML = roundTimeS;

  // Now update the team scores

  const isPreEnd = tickStore.currentDemoTick < round.endTick;
  const teamAlphaScore = isPreEnd ? round.beforeScoreA : round.afterScoreA;
  const teamBetaScore = isPreEnd ? round.beforeScoreB : round.afterScoreB;

  // Calculate side for team A
  let aSide;
  if (round.roundNumber <= 12) {
    aSide = "ct";
  } else if (round.roundNumber <= 24) {
    aSide = "t";
  } else {
    const otRound = round.roundNumber - 25;
    const otHalf = Math.floor(otRound / 3);
    const isFirstHalf = otRound % 6 < 3;

    if ((otHalf % 2 === 0 && isFirstHalf) || (otHalf % 2 === 1 && !isFirstHalf)) {
      aSide = "t";
    } else {
      aSide = "ct";
    }
  }

  // Set scores
  teamAlphaScoreSpan.innerHTML = teamAlphaScore;
  teamBetaScoreSpan.innerHTML = teamBetaScore;

  // Apply inline color styling
  if (aSide === "ct") {
    teamAlphaScoreSpan.style.color = CTColor; // CT blue
    teamAlphaNameSpan.style.color = CTColor;
    teamBetaScoreSpan.style.color = TColor; // T orange
    teamBetaNameSpan.style.color = TColor;
  } else {
    teamAlphaScoreSpan.style.color = TColor; // T orange
    teamAlphaNameSpan.style.color = TColor;
    teamBetaScoreSpan.style.color = CTColor; // CT blue
    teamBetaNameSpan.style.color = CTColor;
  }
}

// NEEDS FIXING
export function renderRoundSegments(rounds) {
  const barWidth = scrubBar.offsetWidth;
  backgroundDiv.innerHTML = ""; // Clear previous

  rounds.forEach((round) => {
    const startTick = round.startTick;
    const endTick = round.endTick;

    const startPercent = startTick / tickStore.maxTick;
    const endPercent = endTick / tickStore.maxTick;
    const segmentWidth = (endPercent - startPercent) * barWidth;

    const segment = document.createElement("div");
    segment.style.position = "absolute";
    segment.style.left = `${startPercent * 100}%`;
    segment.style.width = `${segmentWidth}%`;
    segment.style.height = "100%";
    segment.style.background = round.roundNumber % 2 === 0 ? "#f0f0f0" : "#e0e0e0";
    backgroundDiv.appendChild(segment);
  });
}

/**
 * A helper function that returns a correctly scaled X,Y coord for the current map.
 * @author Leo Tovell
 *
 * @export
 * @param {Number} x X coordinate to scale
 * @param {Number} y Y coordinate to scale
 * @param {Object} map Map information (from map-data.json)
 * @returns {{}}
 */
// export function worldToMap(x, y) {
//   const offsetX = map.pos_x;
//   const offsetY = map.pos_y;
//   const scale = map.scale;
//   let mapX = (x - offsetX) / scale;
//   let mapY = (offsetY - y) / scale;
//   mapY -= map.src_y;
//   return [mapX, mapY];
// }
export function worldToMap(x, y, z, map) {
  const offsetX = map.pos_x;
  const offsetY = map.pos_y;
  const scale = map.scale;

  // Convert world coordinates to image space
  let imgX = (x - offsetX) / scale;
  let imgY = (offsetY - y) / scale;

  let useLowerMap = map.lower_level_max_units != -1000000.0 && z < map.lower_level_max_units;

  if (!useLowerMap) {
    // --- Upper map logic (unchanged) ---
    const baseWidth = canvas.offsetWidth / 1;
    const aspectRatio = map.src_height / map.src_width;
    const baseHeight = baseWidth * aspectRatio;

    const drawX = (imgX - map.src_x) * (baseWidth / map.src_width) + imgDrawX;
    const drawY = (imgY - map.src_y) * (baseHeight / map.src_height) + imgDrawY;

    return [drawX, drawY];
  } else {
    // --- Lower map logic ---
    const lowerBaseWidth = canvas.offsetWidth / 3.8;
    const lowerAspectRatio = map.lower_src_height / map.lower_src_width;
    const lowerBaseHeight = lowerBaseWidth * lowerAspectRatio;

    const drawX = (imgX - map.lower_src_x) * (lowerBaseWidth / map.lower_src_width) + lowerDrawX;
    const drawY = (imgY - map.lower_src_y) * (lowerBaseHeight / map.lower_src_height) + lowerDrawY;

    return [drawX, drawY];
  }
}

export function drawPlayer(player) {
  const [x, y] = worldToMap(player.X, player.Y, player.Z, map);

  // Player name
  ctx.font = "12px Arial";
  ctx.fillStyle = "white";
  ctx.textAlign = "center";
  ctx.textBaseline = "bottom";
  if (player.alive === true) {
    ctx.fillText(player.name, x, y - 10);
  }

  // Player direction line
  let yawAsDegrees = -player.yaw * (Math.PI / 180);

  const dx = playerDirectionLineLength * Math.cos(yawAsDegrees);
  const dy = playerDirectionLineLength * Math.sin(yawAsDegrees);

  const finishX = x + dx;
  const finishY = y + dy;

  if (player.alive === true) {
    ctx.beginPath();
    ctx.moveTo(x, y);
    ctx.lineTo(finishX, finishY);
    ctx.strokeStyle = player.team_num == 2 ? TColor : CTColor;
    ctx.lineWidth = 2;
    ctx.stroke();
  }

  // Player Circle
  const radius = 5;
  ctx.beginPath();
  ctx.fillStyle = player.team_num == 2 ? TColor : CTColor;
  if (player.has_c4) ctx.fillStyle = TBombColor;

  if (player.alive === false) {
    // Draw a cross instead of a circle
    ctx.strokeStyle = ctx.fillStyle;
    ctx.lineWidth = 2;

    ctx.beginPath();
    ctx.moveTo(x - radius, y - radius);
    ctx.lineTo(x + radius, y + radius);
    ctx.moveTo(x + radius, y - radius);
    ctx.lineTo(x - radius, y + radius);
    ctx.stroke();
  } else {
    // Draw a filled circle
    ctx.beginPath();
    ctx.arc(x, y, radius, 0, 2 * Math.PI);
    ctx.fill();
  }
}

export function drawGrenade(grenade) {
  const [x, y] = worldToMap(grenade.x, grenade.y, grenade.z, map);

  ctx.beginPath();
  if (grenade.type == "CSmokeGrenadeProjectile") {
    ctx.arc(x, y, 28, 0, 2 * Math.PI);
    ctx.fillStyle = "grey";
  } else {
    ctx.arc(x, y, 5, 0, 2 * Math.PI);
    ctx.fillStyle = "teal";
  }
  ctx.fill();
}

/**
 *
 * @author Leo Tovell
 *
 * @description Takes a (virtual) tick to seek to in the demo. You can get the virtual tick using `getVirtualTickFromDemoTick`
 *
 * @export
 * @param {*} scrubbedTick
 */
export function seekToDemoTime(scrubbedTick) {
  if (settings.multiRoundOverlayMode) {
    tickStore.multiRoundMasterTick = scrubbedTick;
  } else {
    tickStore.currentTick = scrubbedTick;
  }
  drawTick(getTickData(scrubbedTick), mainMapImg, lowerMapImg);
}

export function goToRound(roundNumber) {
  // 1. Find the real tick that the round starts at
  const round = tickStore.rounds.find((round) => round.roundNumber === roundNumber);
  const roundStartTick = Object.keys(round.ticks)[0];
  if (roundStartTick === undefined) return console.warn(`Round ${roundNumber} not found`);

  console.log("Found round, start tick:", roundStartTick);

  // 2. Inverse search tickMap: find the virtual tick that maps to this actual tick
  const virtualTick = getVirtualTickFromDemoTick(roundStartTick);

  console.log("Demo to Virtual Tick:", virtualTick);

  if (virtualTick === undefined) return console.warn(`No virtual tick found for tick ${roundStartTick}`);

  // 3. Set the virtual tick (convert from string to number if needed)
  tickStore.currentTick = virtualTick;
  tickStore.currentRound = round;
}

let lowerMapDrawn = {
  x: 0,
  y: 0,
  width: 0,
  height: 0,
};

export function drawTick(tick, mainMapImg, lowerMapImg) {
  updateRoundInfo();

  if (tick != undefined) {
    // let thisRound = getRoundInfo(tick.demoTick);
    // console.log(tickStore.lastRound, tickStore.currentRound, tickStore.isNewRound);
    if (tickStore.isNewRound) {
      updateEventTimeline(tickStore.currentRound);
      setActiveRound(tickStore.currentRound.roundNumber);
      clearKillFeed();
    }
    updateKillFeed();
    updatePlayerHUD();
  }

  currentTickSpan.innerHTML = tickStore.currentTick + " of " + tickStore.maxTick;
  currentDemoTickSpan.innerHTML = tickStore.currentDemoTick;

  ctx.setTransform(1, 0, 0, 1, 0, 0);
  ctx.clearRect(0, 0, canvas.width, canvas.height);

  ctx.translate(canvasSettings.offsetX, canvasSettings.offsetY);
  ctx.scale(canvasSettings.zoom, canvasSettings.zoom);

  const baseWidth = canvas.offsetWidth / 1;
  const aspectRatio = map.src_height / map.src_width;
  const baseHeight = baseWidth * aspectRatio;
  const offsetY = map.offset_y ?? 0;
  imgDrawY = canvas.height - baseHeight + offsetY;
  imgDrawX = 0;

  ctx.drawImage(mainMapImg, map.src_x, map.src_y, map.src_width, map.src_height, imgDrawX, imgDrawY, baseWidth, baseHeight);

  if (canvasSettings.layers == 2) {
    const lowerBaseWidth = canvas.offsetWidth / 3.8;
    const lowerAspectRatio = map.lower_src_height / map.lower_src_width;
    const lowerBaseHeight = lowerBaseWidth * lowerAspectRatio;

    lowerDrawX = 70;
    lowerDrawY = 0;

    ctx.drawImage(lowerMapImg, map.lower_src_x, map.lower_src_y, map.lower_src_width, map.lower_src_height, 70, 0, lowerBaseWidth, lowerBaseHeight);
  }

  // NORMAL MODE - ROUND BY ROUND
  if (!settings.multiRoundOverlayMode) {
    // If tick exists, draw it's contents.
    if (tick) {
      if (tick.grenades) {
        for (const nade of tick.grenades) {
          if (!settings.showNadesThrownByHiddenPlayers && !settings.hiddenPlayers.has(nade.name)) {
            drawGrenade(nade);
          }
        }
      }
      if (tick.players) {
        for (const player of tick.players) {
          if (!settings.hiddenPlayers.has(player.name)) {
            drawPlayer(player);
          }
        }
      }
    }

    scrubBar.max = tickStore.currentRound.officiallyEndedTick - tickStore.currentRound.startTick;
    scrubBar.value = tickStore.currentDemoTick - tickStore.currentRound.startTick;
  } else {
    // MULTIROUND MODE - OVERLAYED ALL ROUNDS SPECIFIED

    // longest round tick
    let longestRoundTicks = 0;

    // Get the longest round tick
    for (const round of tickStore.rounds) {
      const diff = round.officiallyEndedTick - round.startTick;
      if (diff > longestRoundTicks) longestRoundTicks = diff;
    }
    tickStore.multiRoundSelection.forEach((round) => {
      // What's the current tick?
      const roundTick = tickStore.multiRoundMasterTick + round.freezeEndTick;
      if (roundTick < round.officiallyEndedTick) {
        tick = round.ticks[roundTick];
        if (tick) {
          if (tick.players) {
            for (const player of tick.players) {
              if (!settings.hiddenPlayers.has(player.name)) {
                drawPlayer(player);
              }
            }
          }
          if (tick.grenades) {
            for (const nade of tick.grenades) {
              if (settings.showNadesThrownByHiddenPlayers && !settings.hiddenPlayers.has(nade.name)) {
                drawGrenade(nade);
              }
            }
          }
        }
      }
    });

    // Finally update the scrub-bar, and incrememnt the master tick
    scrubBar.max = longestRoundTicks;
    scrubBar.value = tickStore.multiRoundMasterTick;
  }
}
