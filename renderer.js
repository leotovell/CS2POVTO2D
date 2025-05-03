// const { enableLoader, disableLoader } = require("./js/ui");
import {
  drawGrenade,
  drawPlayer,
  drawTick,
  loadCanvasVars,
  loadMapVars,
  renderRoundSegments,
  seekToDemoTime,
  updateRoundInfo,
  worldToMap,
  goToRound,
  constructTickMap,
  getTickData,
  getRoundInfo,
  getVirtualTickFromDemoTick,
} from "./js/demo.js";
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
      demoFileNameSpan.innerHTML = filePaths[0].split("/").slice(-1)[0];
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

    localStorage.setItem("teamAName", teamAName);
    localStorage.setItem("teamBName", teamBName);

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
  tickMap: null,
  rounds: null,
  currentTick: 0,
  maxTick: Infinity,
  currentDemoTick: 0,
  currentRound: 0,
  multiRoundSelection: new Set(),
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
  OTSelection: "y", //n = no, y = yes, o = only
  sideSelected: "CT",
  winConditions: new Set(["bomb_defused", "bomb_detonated", "t_killed", "ct_killed", "time_ran_out"]), // All by default.
};

export const TColor = "#f79b4e";
export const CTColor = "#4ea5f7";

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

  saveDemoBtn.addEventListener("click", async () => {
    const res = await window.electron.saveProcessedDemo();
    console.log(res);
    if (res == true) {
      alert("Demo saved successfully");
    } else {
      alert("Failed to save demo.");
    }
  });

  document.getElementById("teamAlphaName").innerHTML = localStorage.getItem("teamAName");
  document.getElementById("teamBetaName").innerHTML = localStorage.getItem("teamBName");

  // Process and store the demo ticks
  enableLoader(loader, loaderText, "Processing Demo...");
  const res = await fetch("http://localhost:3000/api/demo/process");

  const { rounds, mapData: map, scoreboard } = await res.json();

  tickStore.rounds = rounds;

  constructTickMap(rounds);

  disableLoader(loader);
  loadCanvasVars(canvas, ctx);
  loadMapVars(map);

  // Set up the player filters checkboxes
  const playerFiltersModal = document.getElementById("playerFiltersModalTeamBox");
  setupPlayerFiltersModal(playerFiltersModal, scoreboard);
  setupSettingsListeners();
  setupMultiRoundsPanel(document.getElementById("multi-rounds-list"), rounds);

  // Flags
  const tickrate = 64;
  let paused = false;
  let isScrubbing = false;
  let animationTimeout;
  let wasPlayingBeforeScrub = false;

  let tick;

  // Basic event listeners
  let speedMultiplier = parseFloat(speedMultiplierSelect.value);
  speedMultiplierSelect.onchange = (e) => {
    speedMultiplier = parseFloat(e.target.value);
  };

  // Loading the map image background and beginning the replay!
  const mapImg = new Image();
  mapImg.src = "map-data/" + localStorage.getItem("demoMapName") + ".png";

  mapImg.onload = () => {
    // renderRoundSegments(rounds);

    function drawFrame() {
      if (paused || isScrubbing) return;

      tick = getTickData(tickStore.currentTick);
      if (tick != null) {
        tickStore.currentDemoTick = tick.demoTick;
        tickStore.currentRound = getRoundInfo(tickStore.currentTick);

        // Update the forward/backward round buttons
        if (tickStore.currentRound.roundNumber == 1) {
          disableElement(prevRoundBtn);
        } else {
          enableElement(prevRoundBtn);
        }
        if (tickStore.currentRound.roundNumber == tickStore.rounds.length) {
          disableElement(nextRoundBtn);
        } else {
          enableElement(nextRoundBtn);
        }

        // Are we between a round start and freeze end? Skip to the desired freeze time length.
        if (tickStore.currentDemoTick < tickStore.currentRound.freezeEndTick - settings.freezeTimeLength * tickrate) {
          tickStore.currentTick = getVirtualTickFromDemoTick(tickStore.currentRound.freezeEndTick - settings.freezeTimeLength * tickrate);
        }

        drawTick(tick, mapImg);
      } else {
        console.warn("Skipping tick", tickStore.currentTick, "due to missing data - likely due to demo inconsistencies.");
      }
      const tickDurationMs = 1000 / speedMultiplier / tickrate;

      if (settings.multiRoundOverlayMode) {
        tickStore.multiRoundMasterTick++;
      } else {
        tickStore.currentTick++;
      }

      if (tickStore.currentTick < tickStore.maxTick) {
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
      console.log(newTick);
      seekToDemoTime(newTick);
      tickStore.currentRound = getRoundInfo(tickStore.currentTick);

      tick = getTickData(tickStore.currentTick);
      tickStore.currentDemoTick = tick.demoTick;
      if (tick == null) {
        console.warn("Skipping tick", tickStore.currentTick, "due to missing data - likely due to demo inconsistencies.");
      } else {
        drawTick(tick, mapImg); // Just render the frame without resuming playback
      }

      roundSelect.value = tickStore.currentRound.roundNumber;
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

    // Add round select options (and also init the listener)
    for (let round of tickStore.rounds) {
      const option = document.createElement("option");
      option.value = round.roundNumber;
      option.innerHTML = round.roundNumber;
      roundSelect.append(option);
    }

    roundSelect.addEventListener("input", () => {
      goToRound(roundSelect.value); //change selected tick
    });

    prevRoundBtn.addEventListener("click", () => {
      if (tickStore.currentRound.roundNumber - 1 < 1) {
        alert("No previous round!");
      } else {
        goToRound(tickStore.currentRound.roundNumber - 1);
        roundSelect.value = tickStore.currentRound.roundNumber;
      }
    });

    disableElement(prevRoundBtn);

    nextRoundBtn.addEventListener("click", () => {
      if (tickStore.currentRound.isLastRound) {
        alert("No further round!");
      } else {
        // tickStore.currentRound++;
        const nextRoundNumber = tickStore.currentRound.roundNumber + 1;
        goToRound(nextRoundNumber);
        roundSelect.value = nextRoundNumber;
      }
    });

    // Start playback
    drawFrame();
  };
}
