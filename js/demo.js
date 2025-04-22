// Write the canvas updating stuff and demo logic here (NOT UI updates - NO ROUND TIMER etc)

// export as required

// Global vars
const roundTimeMins = document.getElementById("roundTimeMinutes");
const roundTimeSecs = document.getElementById("roundTimeSeconds");
const backgroundDiv = document.getElementById("scrubBarBackground");
const currentTickSpan = document.getElementById("currentTickSpan");
const scrubBar = document.getElementById("scrubBar");

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

/**
 * @description Updates the `Round Timer`, `Current Round` UI elements.
 * @author Leo Tovell
 *
 * @exports
 * @param {Number} currentTick
 */
export function updateRoundInfo(currentTick, roundStarts, freezeEnds) {
  // find latest round start
  let lastRoundStart = -Infinity;
  for (const num of roundStarts) {
    if (num <= currentTick && num > lastRoundStart) {
      lastRoundStart = num;
    }
  }

  let lastFreezeEnds = -Infinity;
  for (const num of freezeEnds) {
    if (num <= currentTick && num > lastFreezeEnds) {
      lastFreezeEnds = num;
    }
  }
  // Conditional: if lastRoundStart > lastFreezeEnds then pause the timer at 1:55s (we are in a freeze time or a timeout)
  if (lastRoundStart > lastFreezeEnds) {
    roundTimeMins.innerHTML = "1";
    roundTimeSecs.innerHTML = "55";
  } else {
    // work out round tick
    let roundTick = currentTick - lastFreezeEnds;

    // Divide to get the current seconds elapsed
    let secondsElapsedInRound = roundTick / 64;

    // Minus from total round allowance (default = 115s (1m55s))
    let roundTimeRemaining = 115 - secondsElapsedInRound;

    // Work out minutes + seconds and change HTML values;
    roundTimeMins.innerHTML = Math.floor(roundTimeRemaining / 60);
    roundTimeSecs.innerHTML = String(Math.floor(roundTimeRemaining % 60)).padStart(2, "0");
  }
}

// NEEDS FIXING
export function renderRoundSegments(tickList, totalTicks) {
  const barWidth = scrubBar.offsetWidth;
  backgroundDiv.innerHTML = ""; // Clear previous

  for (let i = 0; i < tickList.length - 1; i++) {
    const startTick = tickList[i];
    const endTick = tickList[i + 1];

    const startPercent = startTick / totalTicks;
    const endPercent = endTick / totalTicks;
    const segmentWidth = (endPercent - startPercent) * barWidth;

    const segment = document.createElement("div");
    segment.style.position = "absolute";
    segment.style.left = `${startPercent * 100}%`;
    segment.style.width = `${segmentWidth}%`;
    segment.style.height = "100%";
    segment.style.background = i % 2 === 0 ? "#f0f0f0" : "#e0e0e0";
    backgroundDiv.appendChild(segment);
  }
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

export function seekToDemoTime(scrubbedTick, tickKeys) {
  let newIndex = tickKeys.indexOf(scrubbedTick);
  if (newIndex === -1) {
    // fallback to closest tick
    newIndex = tickKeys.findIndex((tick) => tick >= scrubbedTick);
    if (newIndex === -1) newIndex = tickKeys.length - 1;
  }
  return newIndex;
}

export function drawTick(tickKey, tick, lastTick, roundStarts, freezeEnds, mapImage) {
  console.log(tickKey);
  updateRoundInfo(tickKey, roundStarts, freezeEnds);

  currentTickSpan.innerHTML = tickKey + " of " + lastTick;

  ctx.clearRect(0, 0, canvas.width, canvas.height);
  ctx.drawImage(mapImage, 0, 0, canvas.width, canvas.height);

  // If tick exists, draw it's contents.
  if (tick) {
    if (tick.players) {
      for (const player of tick.players) {
        drawPlayer(player);
      }
    }

    if (tick.grenades) {
      for (const nade of tick.grenades) {
        drawGrenade(nade);
      }
    }
  }

  scrubBar.max = lastTick;
  scrubBar.value = tickKey;
}
