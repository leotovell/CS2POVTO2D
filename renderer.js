// const { enableLoader, disableLoader } = require("./js/ui");
import { drawGrenade, drawPlayer, drawTick, loadCanvasVars, loadMapVars, renderRoundSegments, seekToDemoTime, updateRoundInfo, worldToMap, goToRound } from "./js/demo.js";
import { enableLoader, disableLoader, setElementVisible, disableElement, enableElement, setupPlayerFiltersModal, setupSettingsListeners, setupMultiRoundsPanel } from "./js/ui.js";
import { loadPage } from "./js/utils.js";

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
  const isFaceitCheckbox = document.getElementById("setting_isFaceit");

  submitBtn.addEventListener("click", async (e) => {
    e.preventDefault();

    const filePaths = await window.electron.openFileDialog();

    if (filePaths && filePaths.length > 0) {
      isDemoSelected = true;
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
    enableLoader(loader, loaderText, "Previewing Demo...");
    const demoPreviewInfo = await window.electron.previewDemo(demoPath, isFaceitCheckbox.checked);
    console.log(demoPreviewInfo);
    localStorage.setItem("demoMapName", demoPreviewInfo.header.map_name);
    localStorage.setItem("demoHeader", JSON.stringify(demoPreviewInfo.header));
    localStorage.setItem("demoScoreboard", JSON.stringify(demoPreviewInfo.scoreboard));
    disableLoader(loader);
    loadPage("demoPreview.html");
  });
}

function initDemoPreviewPage() {
  const loader = document.getElementById("loader");
  const loaderText = document.getElementById("loader-text");
  const previewMapImg = document.getElementById("p_mapImg");
  const scoreboardDiv = document.getElementById("ScoreboardInformation");
  const POVDemoDiv = document.getElementById("POVInformation");
  const demoHeader = JSON.parse(localStorage.getItem("demoHeader"));

  if (demoHeader.client_name == "SourceTV Demo") {
    setElementVisible(scoreboardDiv);
    // It's a server-recorded demo.
    const demoScoreboard = JSON.parse(localStorage.getItem("demoScoreboard"));
    const previewTeamAPlayerDiv = document.getElementById("p_teamAPlayers");
    const previewTeamBPlayerDiv = document.getElementById("p_teamBPlayers");
    const teamAScoreSpan = document.getElementById("teamAScore");
    const teamBScoreSpan = document.getElementById("teamBScore");
    const teamANameSpan = document.getElementById("teamAName");
    const teamBNameSpan = document.getElementById("teamBName");
    const teamAScore = demoScoreboard.teamAlpha.score;
    const teamBScore = demoScoreboard.teamBeta.score;
    const teamAName = demoScoreboard.teamAlpha.name;
    const teamBName = demoScoreboard.teamBeta.name;

    // Set score
    teamAScoreSpan.innerHTML = teamAScore;
    teamAScoreSpan.className = teamAScore > teamBScore ? "text-success" : "text-danger";
    teamANameSpan.innerHTML = teamAName;

    teamBScoreSpan.innerHTML = teamBScore;
    teamBScoreSpan.className = teamBScore > teamAScore ? "text-success" : "text-danger";
    teamBNameSpan.innerHTML = teamBName;

    // Add players to scoreboard
    if (demoScoreboard) {
      demoScoreboard.teamAlpha.players.forEach((player) => {
        let entry = document.createElement("div");
        entry.className = "col";
        entry.innerHTML = player.name;
        previewTeamAPlayerDiv.append(entry);
        entry.style.margin = "0";
      });
      demoScoreboard.teamBeta.players.forEach((player) => {
        let entry = document.createElement("div");
        entry.className = "col";
        entry.innerHTML = player.name;
        previewTeamBPlayerDiv.append(entry);
        entry.style.margin = "0";
      });
    }
  } else {
    // It's a POV demo. We don't analyse the scoreboard or score for this.
    setElementVisible(POVDemoDiv);
    const recordedBySpan = document.getElementById("recordedBySpan");
    recordedBySpan.innerHTML = demoHeader.client_name;
  }

  if (demoHeader) {
    previewMapImg.src = "img/maps/" + demoHeader.map_name + ".png";
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
    // redirect to the analyser page
    window.location.href = "demoViewer.html";
  });
}

export let tickStore = {
  tickKeys: null,
  tickData: null,
  currentTick: 0,
  currentRound: 0,
  multiRoundTicks: new Set(),
  multiRoundMasterTick: 0,
};

export let settings = {
  // Player Filter Settings
  hiddenPlayers: new Set(),
  showNadesThrownByHiddenPlayers: false,

  // Render/Animation Settings
  showShootingTracers: false,
  freezeTimeLength: 3,

  // Multi-round overlay
  multiRoundOverlayMode: false,
};

// NEXT WORK ON LAYERING ROUNDS OVER EACH OTHER

export let settingsToConfigure = [
  { name: "showNadesThrownByHiddenPlayers", type: "checkbox", defaultValue: false },
  { name: "showShootingTracers", type: "checkbox", defaultValue: true },
  { name: "freezeTimeLength", type: "select", defaultValue: 3 },
];

async function initDemoReviewPage() {
  // Define all HTML elements
  const loader = document.getElementById("loader");
  const loaderText = document.getElementById("loader-text");
  const currentTickSpan = document.getElementById("currentTickSpan");
  const canvas = document.getElementById("minimap");
  const ctx = canvas.getContext("2d");
  const speedMultiplierSelect = document.getElementById("speedMultiplierSelect");
  const scrubBar = document.getElementById("scrubBar");
  const playPauseBtn = document.getElementById("playPauseBtn");
  const roundSelect = document.getElementById("roundSelect");
  const prevRoundBtn = document.getElementById("prevRoundBtn");
  const nextRoundBtn = document.getElementById("nextRoundBtn");
  const saveDemoBtn = document.getElementById("saveDemoBtn");
  const roundsPanel = document.getElementById("roundsPanel");
  const multiRoundOverlay = document.getElementById("multiRoundOverlay");
  const exitMultiRoundModeBtn = document.getElementById("exit-multi-round-btn");
  const multiRoundOverlayToggleBtn = document.getElementById("multiRoundOverlayToggleBtn");

  multiRoundOverlayToggleBtn.addEventListener("click", () => {
    // Show overlay
    multiRoundOverlay.style.visibility = "visible";

    // Shows rounds panel
    roundsPanel.style.visibility = "visible";

    // Hide enter multi-round button;
    multiRoundOverlayToggleBtn.style.display = "none";

    settings.multiRoundOverlayMode = true;
  });

  exitMultiRoundModeBtn.addEventListener("click", () => {
    multiRoundOverlay.style.visibility = "hidden";

    roundsPanel.style.visibility = "hidden";

    multiRoundOverlayToggleBtn.style.display = "";

    settings.multiRoundOverlayMode = false;
  });

  // What is a knife round?
  // roundStarts:
  // index 0 - KNIFE ROUND
  // index 1 - TEAM_SWITCH DECIDE
  // index 2 - TEAM_SWITCHED -> LIVE COUNTDOWN
  // index 3 - PISTOL // ROUND 1
  // index 4... are live rounds.

  // So really we need to remove index 1 + 2; so:
  // index 0 - KNIFE ROUND
  // index 1 - PISTOL

  // Also, perhaps we should edit the freezetime down to 5 seconds only (5 * 64) by using freeze_time_ends events and round_end_events

  // round_

  // TODO
  // Next we add event listeners to each roundListCheckbox so when it's checked we create/delete the tick_counter for it in tickStore.multiRoundTicks;
  // Then need to adjust drawTick to account for multi-tick mode.
  // Have a master tick, i.e currentTick for each round we do tickStore.multiRoundStartTicks.forEach(roundStartTick => tick = roundTick[currentTick + roundStartTick]) etc etc
  // Always need to check when the round ends, so for example if we are viewing round 7 and 8, the scrub-bar MAX value is max([round+1.startTick - round.startTick, ...])
  // Conditional for each round where we stop rendering each round after the indivual round tick exceeds round+1.startTick, as that's no longer the round we want to view - perhaps remove the players/nades? think about what to do with expired rounds.
  // If this is slow - let's move some processing to the nodejs such as worldToMap is run on every coordinate - we could do it in the initial processing?

  saveDemoBtn.addEventListener("click", async () => {
    const res = await window.electron.saveProcessedDemo();
    console.log(res);
    if (res == true) {
      alert("Demo saved successfully");
    } else {
      alert("Failed to save demo.");
    }
  });

  // Process and store the demo ticks
  enableLoader(loader, loaderText, "Processing Demo...");
  // const { ticks, nades, nadeFlightPaths, roundStarts, freezeEnds, mapData: map } = await window.electron.processDemo();
  const res = await fetch("http://localhost:3000/api/demo/process");
  const { ticks, nades, nadeFlightPaths, events, mapData: map, scoreboard } = await res.json();
  const { roundStarts, freezeEnds, roundEnds, roundOfficiallyEnded } = events;

  tickStore.tickData = ticks;
  disableLoader(loader);
  loadCanvasVars(canvas, ctx);
  loadMapVars(map);

  // Set up the player filters checkboxes
  const playerFiltersModal = document.getElementById("playerFiltersModalTeamBox");
  setupPlayerFiltersModal(playerFiltersModal, scoreboard);
  setupSettingsListeners();
  setupMultiRoundsPanel(document.getElementById("multi-rounds-list"), freezeEnds, roundEnds);

  console.log("starts: ", roundStarts);
  console.log("freeze: ", freezeEnds);
  console.log("ends: ", roundEnds);
  console.log("oends: ", roundOfficiallyEnded);

  // Flags
  const tickrate = 64;
  let paused = false;
  let isScrubbing = false;
  let animationTimeout;
  let wasPlayingBeforeScrub = false;

  // Basic event listeners
  let speedMultiplier = parseFloat(speedMultiplierSelect.value);
  speedMultiplierSelect.onchange = (e) => {
    speedMultiplier = parseFloat(e.target.value);
  };

  // Loading the map image background and beginning the replay!
  const mapImg = new Image();
  mapImg.src = "map-data/" + localStorage.getItem("demoMapName") + ".png";

  mapImg.onload = () => {
    // sort the ticks into ascending order
    const tickKeys = Object.keys(ticks)
      .map(Number)
      .sort((a, b) => a - b);

    tickStore.tickKeys = tickKeys;

    // Work out what the last tick is, to calculate various timers etc
    const lastTick = tickKeys[tickKeys.length - 1];

    renderRoundSegments(roundStarts, lastTick);

    function drawFrame() {
      if (paused || isScrubbing) return;

      console.log("Current Tick:", tickStore.currentTick);

      let manuallyJumped = false;

      const futureFreezeEnds = freezeEnds.filter((ends) => ends.tick > tickStore.currentTick);
      const nextFreezeEnd = futureFreezeEnds.length > 0 ? Math.min(...futureFreezeEnds.map((end) => end.tick)) : null;
      const desiredFreezeTimeLengthInTicks = settings.freezeTimeLength * tickrate;

      if (!settings.multiRoundOverlayMode && nextFreezeEnd != null) {
        const correspondingRoundStart = [...roundStarts].reverse().find((start) => start.tick <= nextFreezeEnd);
        const targetFreezeTimeTick = nextFreezeEnd - desiredFreezeTimeLengthInTicks;

        if (correspondingRoundStart && tickStore.currentTick > correspondingRoundStart.tick && tickStore.currentTick < targetFreezeTimeTick) {
          console.log("JUMPED:", tickStore.currentTick, ">", correspondingRoundStart.tick, "AND", tickStore.currentTick, "<", targetFreezeTimeTick, "TRUE");
          tickStore.currentTick = targetFreezeTimeTick;
          manuallyJumped = true;
          console.log("New tick after Jumping:", tickStore.currentTick);
        }
      }

      const tickKey = tickKeys[tickStore.currentTick];
      const tick = ticks[tickKey];

      // Update the forward/backward round buttons
      if (tickStore.currentRound == 1) {
        disableElement(prevRoundBtn);
      } else {
        enableElement(prevRoundBtn);
      }
      if (tickStore.currentRound == roundStarts.length) {
        disableElement(nextRoundBtn);
      } else {
        enableElement(nextRoundBtn);
      }

      // drawCurrentTickFrame(); // just render
      drawTick(tickKey, tick, lastTick, roundStarts, freezeEnds, mapImg);
      const tickDurationMs = 1000 / speedMultiplier / tickrate;

      if (!manuallyJumped) {
        if (settings.multiRoundOverlayMode) {
          tickStore.multiRoundMasterTick++;
        } else {
          tickStore.currentTick++;
        }
      }

      if (tickStore.currentTick < tickKeys.length) {
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
      seekToDemoTime(newTick, tickKeys);
      // Find out what round we are now on.
      if (settings.multiRoundOverlayMode) {
        let lastRoundStart = -Infinity;
        for (const num of roundStarts) {
          if (num <= tickStore.currentTick && num > lastRoundStart) {
            lastRoundStart = num;
          }
        }
        tickStore.currentRound = roundStarts.indexOf(lastRoundStart);
        // Update the currentRoundCounter
        roundSelect.value = tickStore.currentRound;
      }
      const tickKey = tickKeys[tickStore.currentTick];
      const tick = ticks[tickKey];
      drawTick(tickKey, tick, lastTick, roundStarts, freezeEnds, mapImg); // Just render the frame without resuming playback
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
      // if (!paused) {
      //   playPauseBtn.click();
      // }
    });

    // Add round select options (and also init the listener)
    for (let round = 0; round < roundStarts.length; round++) {
      const option = document.createElement("option");
      option.value = round;
      option.innerHTML = round;
      roundSelect.append(option);
    }

    roundSelect.addEventListener("input", () => {
      goToRound(roundSelect.value, roundStarts); //change selected tick
      tickStore.currentRound = roundSelect.value;
    });

    prevRoundBtn.addEventListener("click", () => {
      if (tickStore.currentRound - 1 < 1) {
        alert("No previous round!");
      } else {
        tickStore.currentRound--;
        goToRound(tickStore.currentRound, roundStarts);
        roundSelect.value = tickStore.currentRound;
      }
    });

    nextRoundBtn.addEventListener("click", () => {
      if (tickStore.currentRound + 1 > roundStarts.length) {
        alert("No further round!");
      } else {
        tickStore.currentRound++;
        goToRound(tickStore.currentRound, roundStarts);
        roundSelect.value = tickStore.currentRound;
      }
    });

    // Start playback
    drawFrame();
  };
}
