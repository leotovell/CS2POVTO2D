// Write the canvas updating stuff and demo logic here (NOT UI updates - NO ROUND TIMER etc)

// export as required

// Global vars
const roundTimeMins = document.getElementById("roundTimeMinutes");
const roundTimeSecs = document.getElementById("roundTimeSeconds");
const backgroundDiv = document.getElementById("scrubBarBackground");
const currentTickSpan = document.getElementById("currentTickSpan");
const scrubBar = document.getElementById("scrubBar");
const roundSelect = document.getElementById("roundSelect");

import { settings, tickStore } from "../renderer.js";

let canvas;
let ctx;
let map;

export function loadCanvasVars(canvasEl, ctxEl) {
  canvas = canvasEl;
  ctx = ctxEl;
}

export function loadMapVars(mapdata) {
  map = mapdata;
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

  console.log(tickStore.tickMap);

  // Whilst we are at it, let's grab the max virtual tick possible.
  tickStore.maxTick = Object.keys(tickMap).length;
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

  console.log(tickPairs);

  // Find the closest virtual tick (less than or equal to demoTick)
  let closest = undefined;
  for (const [virtual, actual] of tickPairs) {
    if (actual <= demoTick) {
      closest = virtual;
    } else {
      break;
    }
  }

  return closest;
}

/**
 * @description Updates the `Round Timer`, `Current Round` UI elements.
 * @author Leo Tovell
 *
 * @exports
 * @param {Number} currentTick
 */
export function updateRoundInfo() {
  let round = tickStore.currentRound;

  roundSelect.value = round.roundNumber;

  let roundTimeM = "1";
  let roundTimeS = "55";

  if (tickStore.currentDemoTick < round.freezeEndTick) {
    // let lengthOfFreezeTimeInTicks = round.freezeEndTick - round.startTick;
    // let ticksRemaining = lengthOfFreezeTimeInTicks - (tickStore.currentDemoTick - round.freezeEndTick);
    // let timeRemaining = ticksRemaining / 64;
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
    // let lengthOfRoundEnd = round.officiallyEndedTick - round.endTick; // How many ticks between end of round and official end of round?
    // let ticksRemaining = lengthOfEndOfRoundInTicks - tickStore.currentDemoTick;
    // let timeRemaining = ticksRemaining / 64;
    let lengthOfRoundEnd = round.officiallyEndedTick - round.endTick;
    let ticksIntoRoundEnd = tickStore.currentDemoTick - round.endTick;
    let timeRemaining = (lengthOfRoundEnd - ticksIntoRoundEnd) / 64;
    roundTimeM = Math.floor(timeRemaining / 60);
    roundTimeS = String(Math.floor(timeRemaining % 60)).padStart(2, "0");
  }

  roundTimeMins.innerHTML = roundTimeM;
  roundTimeSecs.innerHTML = roundTimeS;
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
export function worldToMap(x, y) {
  const offsetX = map.pos_x;
  const offsetY = map.pos_y;
  const scale = map.scale;
  const mapX = (x - offsetX) / scale;
  const mapY = (offsetY - y) / scale;
  return [mapX, mapY];
}

export function drawPlayer(player) {
  const [x, y] = worldToMap(player.X, player.Y, map);

  // Player name
  ctx.font = "12px Arial";
  ctx.fillStyle = "white";
  ctx.textAlign = "center";
  ctx.textBaseline = "bottom";
  ctx.fillText(player.name, x, y - 10);

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
    ctx.strokeStyle = player.team_num == 2 ? "orange" : "blue";
    ctx.lineWidth = 2;
    ctx.stroke();
  }

  // Player Circle
  ctx.beginPath();
  ctx.arc(x, y, 5, 0, 2 * Math.PI);
  ctx.fillStyle = player.team_num == 2 ? "orange" : "blue";
  if (player.alive == false) {
    ctx.fillStyle = "gray";
  }
  ctx.fill();
}

export function drawGrenade(grenade) {
  const [x, y] = worldToMap(grenade.x, grenade.y);

  ctx.beginPath();
  ctx.arc(x, y, 5, 0, 2 * Math.PI);
  ctx.fillStyle = "teal";
  ctx.fill();
}

export function seekToDemoTime(scrubbedTick) {
  if (settings.multiRoundOverlayMode) {
    tickStore.multiRoundMasterTick = scrubbedTick;
  } else {
    tickStore.currentTick = scrubbedTick;
  }
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

export function drawTick(tick, mapImage) {
  updateRoundInfo();

  currentTickSpan.innerHTML = tickStore.currentTick + " of " + tickStore.maxTick;

  ctx.clearRect(0, 0, canvas.width, canvas.height);
  ctx.drawImage(mapImage, 0, 0, canvas.width, canvas.height);

  // NORMAL MODE - ROUND BY ROUND
  if (!settings.multiRoundOverlayMode) {
    // If tick exists, draw it's contents.
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
          if (!settings.showNadesThrownByHiddenPlayers && !settings.hiddenPlayers.has(nade.name)) {
            drawGrenade(nade);
          }
        }
      }
    }

    scrubBar.max = tickStore.maxTick;
    scrubBar.value = tickStore.currentTick;
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
