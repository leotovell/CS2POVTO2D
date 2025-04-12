document.addEventListener("DOMContentLoaded", function () {
  const page = document.body.id;

  if (page === "home") {
    initHomePage();
  } else if (page === "preview-demo") {
    initDemoPreviewPage();
  } else if (page === "review-demo") {
    initDemoReviewPage();
  }
});

function initHomePage() {
  let isDemoSelected = false;
  let demoPath = "";

  const demoFileNameSpan = document.getElementById("demoFilePathPreview");
  const removeDemoBtn = document.getElementById("removeDemoBtn");
  const submitBtn = document.getElementById("uploadDemoBtn");
  const loader = document.getElementById("loader");
  const loaderText = document.getElementById("loader-text");

  submitBtn.addEventListener("click", async (e) => {
    e.preventDefault();

    const filePaths = await window.electron.openFileDialog();

    if (filePaths && filePaths.length > 0) {
      isDemoSelected = true;
      console.log("path:", filePaths[0]);
      demoPath = filePaths[0];
      localStorage.setItem("demoPath", demoPath);
      demoFileNameSpan.innerHTML = filePaths[0].split("\\").slice(-1)[0];
      demoFileNameSpan.style.visibility = "visible";
      removeDemoBtn.style.visibility = "visible";
    } else {
      console.log("No file selected.");
    }
  });

  removeDemoBtn.addEventListener("click", (e) => {
    isDemoSelected = false;
    removeDemoBtn.style.visibility = "hidden";
    demoFileNameSpan.style.visibility = "hidden";
  });

  const previewDemoBtn = document.getElementById("previewDemoBtn");
  previewDemoBtn.addEventListener("click", async (e) => {
    e.preventDefault();
    if (!isDemoSelected) {
      alert("Please select a demo.");
      return;
    }
    loaderText.innerHTML = "Previewing Demo...";
    loader.style.display = "flex";
    const demoPreviewInfo = await window.electron.previewDemo(demoPath);
    localStorage.setItem("demoMapData", JSON.stringify(demoPreviewInfo.mapdata));
    localStorage.setItem("demoMapName", demoPreviewInfo.header.map_name);
    localStorage.setItem("demoHeader", JSON.stringify(demoPreviewInfo.header));
    localStorage.setItem("demoPlayers", JSON.stringify(demoPreviewInfo.players));
    localStorage.setItem("demoRoundEnds", JSON.stringify(demoPreviewInfo.roundEnds));
    localStorage.setItem("demoEvents", JSON.stringify(demoPreviewInfo.events));
    loader.style.display = "none";
    window.location.href = "demoPreview.html";
  });
}

function initDemoPreviewPage() {
  const loader = document.getElementById("loader");
  const loaderText = document.getElementById("loader-text");
  const previewMapImg = document.getElementById("p_mapImg");
  const scoreboardDiv = document.getElementById("ScoreboardInformation");
  const POVDemoDiv = document.getElementById("POVInformation");
  // const previewMapName = document.getElementById("p_mapName");

  const demoHeader = JSON.parse(localStorage.getItem("demoHeader"));
  console.log(demoHeader);
  if (demoHeader.client_name == "SourceTV Demo") {
    scoreboardDiv.style.visibility = "visible";
    // It's a server-recorded demo.
    const demoPlayers = JSON.parse(localStorage.getItem("demoPlayers"));
    const previewTeamAPlayerDiv = document.getElementById("p_teamAPlayers");
    const previewTeamBPlayerDiv = document.getElementById("p_teamBPlayers");

    if (demoPlayers) {
      demoPlayers.forEach((player) => {
        // new entry for player
        // <div class="col">PlayerB1</div>
        let entry = document.createElement("div");
        entry.className = "col";
        entry.innerHTML = player.name;
        if (player.team_number === 2) {
          previewTeamAPlayerDiv.append(entry);
        } else if (player.team_number === 3) {
          previewTeamBPlayerDiv.append(entry);
        }
        entry.style.margin = "0";
      });
    }

    console.log("--------");

    const demoEvents = JSON.parse(localStorage.getItem("demoEvents"));
    console.log(demoEvents);

    console.log("----");
    console.log(JSON.parse(localStorage.getItem("demoMatchWinPanel")));
  } else {
    // It's a POV demo. We don't analyse the scoreboard or score for this.
    POVDemoDiv.style.visibility = "visible";
    const recordedBySpan = document.getElementById("recordedBySpan");
    recordedBySpan.innerHTML = demoHeader.client_name;
  }

  if (demoHeader) {
    previewMapImg.src = "img/maps/" + demoHeader.map_name + ".png";
    // previewMapName.innerHTML = demoPreviewInfo.map_name.replace("de_", "");
  } else {
    alert("No data");
  }

  // Buttons
  const backBtn = document.getElementById("backBtn");
  const nextBtn = document.getElementById("nextBtn");

  backBtn.addEventListener("click", (e) => {
    e.preventDefault();
    window.history.back();
  });

  nextBtn.addEventListener("click", async (e) => {
    e.preventDefault();
    // Fully analyse the demo and return the 2d data in JSON format for each tick.
    loader.style.display = "flex";
    loaderText.innerHTML = "Processing Demo...";

    loader.style.display = "none";
    window.location.href = "demoViewer.html";
  });
}

async function initDemoReviewPage() {
  const loader = document.getElementById("loader");
  const loaderText = document.getElementById("loader-text");
  const currentTickSpan = document.getElementById("currentTickSpan");

  // Process and store the demo ticks
  loader.style.display = "flex";
  loaderText.innerHTML = "Processing Demo...";
  const demoTicks = await window.electron.processDemo(localStorage.getItem("demoPath"));
  // localStorage.setItem("demoTicks", JSON.stringify(demoTicks.ticks));
  window.demoTicks = demoTicks.ticks;
  window.nades = demoTicks.nades;
  window.nadeFlightPaths = demoTicks.nadePaths;
  loader.style.display = "none";

  const canvas = document.getElementById("minimap");
  const ctx = canvas.getContext("2d");
  // const ticks = JSON.parse(localStorage.getItem("demoTicks"));
  const ticks = window.demoTicks;
  const map = JSON.parse(localStorage.getItem("demoMapData"));

  console.log(ticks);

  const tickrate = 64;
  let i = 0;
  let paused = false;
  let isScrubbing = false;
  let animationTimeout;
  let wasPlayingBeforeScrub = false;

  const speedMultiplierSelect = document.getElementById("speedMultiplierSelect");
  let speedMultiplier = parseFloat(speedMultiplierSelect.value);
  speedMultiplierSelect.onchange = (e) => {
    speedMultiplier = parseFloat(e.target.value);
  };

  const scrubBar = document.getElementById("scrubBar");
  const playPauseBtn = document.getElementById("playPauseBtn");
  const backgroundDiv = document.getElementById("scrubBarBackground");

  const mapImg = new Image();
  mapImg.src = "map-data/" + localStorage.getItem("demoMapName") + ".png";

  mapImg.onload = () => {
    const tickKeys = Object.keys(ticks)
      .map(Number)
      .sort((a, b) => a - b);
    const lastTick = tickKeys[tickKeys.length - 1];

    function renderRoundSegments(tickList, totalTicks) {
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
        segment.style.width = `${segmentWidth}px`;
        segment.style.height = "100%";
        segment.style.background = i % 2 === 0 ? "#f0f0f0" : "#e0e0e0";
        backgroundDiv.appendChild(segment);
      }
    }

    roundTicks = JSON.parse(localStorage.getItem("demoRoundEnds"));

    // roundTicksIntoArray
    const roundTicksAsArr = [];
    roundTicks.forEach((r) => {
      roundTicksAsArr.push(r.tick);
    });

    renderRoundSegments(roundTicksAsArr, lastTick);

    function worldToMap(x, y, map) {
      const offsetX = map.pos_x;
      const offsetY = map.pos_y;
      const scale = map.scale;
      const mapX = (x - offsetX) / scale;
      const mapY = (offsetY - y) / scale;
      return [mapX, mapY];
    }

    function updateScrubBar(currentTick) {
      scrubBar.max = lastTick;
      scrubBar.value = currentTick;
    }

    function seekToDemoTime(scrubbedTick) {
      let newIndex = tickKeys.indexOf(scrubbedTick);
      if (newIndex === -1) {
        // fallback to closest tick
        newIndex = tickKeys.findIndex((tick) => tick >= scrubbedTick);
        if (newIndex === -1) newIndex = tickKeys.length - 1;
      }
      i = newIndex;
    }

    function drawCurrentTickFrame() {
      const tickKey = tickKeys[i];
      const tick = ticks[tickKey];

      currentTickSpan.innerHTML = tickKey + " of " + lastTick;

      ctx.clearRect(0, 0, canvas.width, canvas.height);
      ctx.drawImage(mapImg, 0, 0, canvas.width, canvas.height);

      if (tick && tick.players) {
        for (const player of tick.players) {
          const [x, y] = worldToMap(player.X, player.Y, map);

          // Draw the player name above the player marker
          ctx.font = "12px Arial";
          ctx.fillStyle = "white";
          ctx.textAlign = "center";
          ctx.textBaseline = "bottom";
          ctx.fillText(player.name, x, y - 10);

          // Draw directional line (yaw)
          const lineLength = 10;

          let yawDeg = player.yaw; // CS2 yaw
          let fixedYawRad = -yawDeg * (Math.PI / 180); // Invert to match canvas trig

          const dx = lineLength * Math.cos(fixedYawRad);
          const dy = lineLength * Math.sin(fixedYawRad);

          const new_x = x + dx;
          const new_y = y + dy;

          if (player.alive === true) {
            ctx.beginPath();
            ctx.moveTo(x, y);
            ctx.lineTo(new_x, new_y);
            ctx.strokeStyle = "blue";
            ctx.lineWidth = 2;
            ctx.stroke();
          }

          // Draw the player circle on top
          ctx.beginPath();
          ctx.arc(x, y, 5, 0, 2 * Math.PI);
          ctx.fillStyle = player.team_num == 2 ? "orange" : "blue";
          if (player.alive == false) {
            ctx.fillStyle = "gray";
          }
          ctx.fill();
        }
      }

      if (tick && tick.grenades) {
        tick.grenades.forEach((nade) => {
          const [x, y] = worldToMap(nade.x, nade.y, map);

          ctx.beginPath();
          ctx.arc(x, y, 5, 0, 2 * Math.PI);
          ctx.fillStyle = "teal";
          ctx.fill();

          // Also draw the path
          const path = window.nadeFlightPaths[nade.id];
          const [pathOriginX, pathOriginY] = worldToMap(path.origin[0], path.origin[1], map);
          const [pathX, pathY] = worldToMap(path.path[tickKey][0], path.path[tickKey][1], map);
          ctx.setLineDash([5, 3]);
          ctx.beginPath();
          ctx.moveTo(pathOriginX, pathOriginY);
          ctx.lineTo(pathX, pathY);
          ctx.stroke();
        });
      }

      // if (tick && tick.nadePaths) {
      //   for (const nadeId in tick.nadePaths) {
      //     const nadeData = tick.nadePaths[nadeId];
      //     const path = nadeData.path;
      //     const activatedTick = nadeData.detonateTick ?? Infinity; // fallback if not set

      //     // Draw the path as a line
      //     if (path.length > 1) {
      //       ctx.beginPath();
      //       for (let i = 0; i < path.length - 1; i++) {
      //         const [x1, y1] = worldToMap(path[i].x, path[i].y, map);
      //         const [x2, y2] = worldToMap(path[i + 1].x, path[i + 1].y, map);

      //         ctx.moveTo(x1, y1);
      //         ctx.lineTo(x2, y2);
      //       }

      //       // Set color based on grenade type
      //       switch (nadeData.type) {
      //         case "CHEGrenadeProjectile":
      //           ctx.strokeStyle = "purple";
      //           break;
      //         case "CSmokeGrenadeProjectile":
      //           ctx.strokeStyle = "teal";
      //           break;
      //         case "CFlashbangGrenadeProjectile":
      //           ctx.strokeStyle = "white";
      //           break;
      //         case "CInfernoGrenadeProjectile":
      //         case "CMolotovGrenadeProjectile":
      //           ctx.strokeStyle = "coral";
      //           break;
      //         default:
      //           ctx.strokeStyle = "gray";
      //           break;
      //       }

      //       ctx.lineWidth = 2;
      //       ctx.setLineDash([4, 2]); // dotted line
      //       ctx.stroke();
      //       ctx.setLineDash([]); // reset dash
      //     }

      //     // Draw the bloom/activation circle if it's this tick
      //     if (tickKey === activatedTick) {
      //       const lastPoint = path[path.length - 1];
      //       const [bx, by] = worldToMap(lastPoint.x, lastPoint.y, map);

      //       ctx.beginPath();
      //       ctx.arc(bx, by, 15, 0, 2 * Math.PI);

      //       switch (nadeData.type) {
      //         case "CSmokeGrenadeProjectile":
      //           ctx.fillStyle = "rgba(0, 128, 128, 0.3)"; // semi-transparent teal
      //           break;
      //         case "CFlashbangGrenadeProjectile":
      //           ctx.fillStyle = "rgba(255, 255, 255, 0.4)";
      //           break;
      //         case "CInfernoGrenadeProjectile":
      //         case "CMolotovGrenadeProjectile":
      //           ctx.fillStyle = "rgba(255, 127, 80, 0.4)";
      //           break;
      //         default:
      //           ctx.fillStyle = "rgba(200, 200, 200, 0.3)";
      //           break;
      //       }

      //       ctx.fill();
      //     }
      //   }
      // }

      updateScrubBar(tickKey);
    }

    function drawFrame() {
      if (paused || isScrubbing) return;

      drawCurrentTickFrame(); // just render
      const tickDurationMs = 1000 / speedMultiplier / tickrate;

      i++;
      if (i < tickKeys.length) {
        animationTimeout = setTimeout(drawFrame, tickDurationMs);
      } else {
        console.log("Playback complete");
        paused = true;
        playPauseBtn.innerText = "Play";
      }
    }

    // --- Scrubbing logic ---
    scrubBar.addEventListener("input", () => {
      // Only pause if it was playing before scrubbing
      if (!paused && !isScrubbing) {
        wasPlayingBeforeScrub = true;
        paused = true;
        playPauseBtn.innerText = "Play";
      }

      isScrubbing = true; // Start scrubbing
      clearTimeout(animationTimeout); // Stop any current animation

      const newTick = parseInt(scrubBar.value);
      seekToDemoTime(newTick);
      drawCurrentTickFrame(); // Just render the frame without resuming playback
    });

    scrubBar.addEventListener("change", () => {
      isScrubbing = false; // End scrubbing

      // If it was playing before scrubbing, resume playback
      paused = !wasPlayingBeforeScrub;
      playPauseBtn.innerText = paused ? "Play" : "Pause";

      if (!paused) {
        drawFrame(); // Resume playback if it was playing before
      }
    });

    // --- Play / Pause Button ---
    playPauseBtn.addEventListener("click", () => {
      paused = !paused;
      if (!paused) {
        playPauseBtn.innerText = "Pause";
        drawFrame();
      } else {
        playPauseBtn.innerText = "Play";
        clearTimeout(animationTimeout);
      }
    });

    // Start playback
    drawFrame();
  };
}
