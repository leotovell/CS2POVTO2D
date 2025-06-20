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
  loadMapImgContext,
} from "./js/demo.js";
import {
  enableLoader,
  disableLoader,
  setElementVisible,
  disableElement,
  enableElement,
  setupPlayerFiltersModal,
  setupSettingsListeners,
  setupMultiRoundsPanel,
  setElementInvisible,
  showFlashMessage,
  preloadSVG,
  generateRoundList,
  toggleElementVisibility,
  generatePlayerHUD,
} from "./js/ui.js";
import { loadPage } from "./js/utils.js";

let game_icons_path = "./img/game_icons/";
let game_icons = [
  "airborne-kill-icon",
  "blind-icon",
  "bomb-icon",
  "defuser-icon",
  "elimination-headshot-icon",
  "elimination-icon",
  "explosion-icon",
  "focus-icon",
  "headshot-icon",
  "jump-icon",
  "noscope-icon",
  "penetrate-icon",
  "play-circle-icon",
  "play-icon",
  "through-smoke-kill-icon",
  "clock-icon",
  "health-icon",
  "dollar-icon",
  "armor-icon",
  "assist-icon",
];
let weapon_icons_path = "./img/game_icons/weapons/";
let weapon_icons = [
  "ak47-icon",
  "aug-icon",
  "awp-icon",
  "bizon-icon",
  "cz75a-icon",
  "deagle-icon",
  "decoy-icon",
  "dual-elite-icon",
  "famas-icon",
  "five-seven-icon",
  "flashbang-icon",
  "g3sg1-icon",
  "galilar-icon",
  "glock-icon",
  "he-grenade-icon",
  "helmet-icon",
  "incendiary-grenade-icon",
  "kevlar-icon",
  "knife-icon",
  "knife",
  "knifegg",
  "knife_bayonet",
  "knife_bowie",
  "knife_butterfly",
  "knife_canis",
  "knife_cord",
  "knife_css",
  "knife_falchion",
  "knife_flip",
  "knife_gut",
  "knife_gypsy_jackknife",
  "knife_karambit",
  "knife_kukri",
  "knife_m9_bayonet",
  "knife_outdoor",
  "knife_push",
  "knife_skeleton",
  "knife_stiletto",
  "knife_t",
  "knife_tactical",
  "knife_twinblade",
  "knife_ursus",
  "knife_widowmaker",
  "m249-icon",
  "m4a1-icon",
  "m4a1-silencer-off-icon",
  "m4a1_silencer-icon",
  "m4a4-icon",
  "mac10-icon",
  "mag7-icon",
  "molotov-icon",
  "mp5sd-icon",
  "mp7-icon",
  "mp9-icon",
  "negev-icon",
  "nova-icon",
  "p2000-icon",
  "p250-icon",
  "p90-icon",
  "revolver-icon",
  "sawed-off-icon",
  "scar20-icon",
  "sg553-icon",
  "smoke-grenade-icon",
  "ssg08-icon",
  "tec9-icon",
  "ump45-icon",
  "usps-silencer-off-icon",
  "usp_silencer-icon",
  "world-icon",
  "xm1014-icon",
  "zeus-icon",
  "bomb-icon",
];

// Preload all SVGs in the img folder:
preloadSVG("blind-icon", "img/game_icons/blind-icon.svg");
preloadSVG("headshot-icon", "img/game_icons/headshot-icon.svg");
preloadSVG("elimination-icon", "img/game_icons/elimination-icon.svg");
preloadSVG("jump-icon", "img/game_icons/jump-icon.svg");

game_icons.forEach(async (icon) => {
  await preloadSVG(icon, `${game_icons_path}${icon}.svg`);
});

weapon_icons.forEach(async (icon) => {
  await preloadSVG(icon, `${weapon_icons_path}${icon}.svg`);
});

document.addEventListener("DOMContentLoaded", function () {
  const page = document.body.id;

  if (page === "home") {
    initHomePage();
    // } else if (page === "preview-demo") {
    //   initDemoPreviewPage();
  } else if (page === "viewer") {
    initDemoReviewPage();
  }
});

async function initHomePage() {
  const originalConsoleError = console.error;
  console.error = function (...args) {
    originalConsoleError.apply(console, args);
    showFlashMessage("Console error: " + args.join(" "), "error");
  };

  window.onerror = function (message, source, lineno, colno, error) {
    showFlashMessage(`JS Error: ${message} at ${lineno}:${colno}`, "error");
    return false;
  };

  window.onunhandledrejection = function (event) {
    showFlashMessage(`Unhandled Promise Rejection: ${event.reason}`, "error");
  };

  let isDemoSelected = false;
  let demoPath = "";

  const uploadDemoBtn = document.getElementById("uploadDemoBtn");
  const loader = document.getElementById("loader");
  const previewContainer = document.getElementById("preview-container");
  const previewButtons = document.getElementById("preview-btns");
  const previewMapImg = document.getElementById("p_mapImg");
  const scoreboardDiv = document.getElementById("ScoreboardInformation");
  const POVDemoDiv = document.getElementById("POVInformation");
  const cancelPreviewBtn = document.getElementById("cancelPreviewBtn");
  const processDemoBtn = document.getElementById("processDemoBtn");
  const previewTeamAPlayerDiv = document.getElementById("p_teamAPlayers");
  const previewTeamBPlayerDiv = document.getElementById("p_teamBPlayers");
  const teamAScoreSpan = document.getElementById("teamAScore");
  const teamBScoreSpan = document.getElementById("teamBScore");
  const teamANameSpan = document.getElementById("teamAName");
  const teamBNameSpan = document.getElementById("teamBName");

  hideDemoPreview();

  uploadDemoBtn.addEventListener("click", async (e) => {
    e.preventDefault();

    const filePaths = await window.electron.openFileDialog();

    if (filePaths && filePaths.length > 0) {
      isDemoSelected = true;
      demoPath = filePaths[0];
      localStorage.setItem("demoPath", demoPath);
      console.log("Processing now");
      previewDemo(demoPath);
    } else {
      console.log("No file selected.");
    }
  });

  cancelPreviewBtn.addEventListener("click", () => {
    hideDemoPreview();
    // Unselect any selected demos.
  });

  processDemoBtn.addEventListener("click", () => {
    // Show the next page, with a full-screen loading bar (no opacity).
    loadPage("viewer.new.html");
  });

  async function previewDemo(path) {
    // Hide, in-case we already had stuff loaded in.
    hideDemoPreview();
    previewContainer.style.visibility = "unset";
    loader.style.visibility = "unset";

    // Preview logic
    const { header, scoreboard } = await window.electron.previewDemo(demoPath);
    localStorage.setItem("demoMapName", header.map_name);
    localStorage.setItem("demoHeader", header);
    localStorage.setItem("demoScoreboard", scoreboard);

    console.log(header);

    // set map image
    previewMapImg.src = "img/maps/" + header.map_name + ".png";

    // Set the score + team names

    const teamAScore = scoreboard.teamAlpha.score;
    const teamBScore = scoreboard.teamBeta.score;

    teamAScoreSpan.innerHTML = teamAScore;
    teamAScoreSpan.className = teamAScore > teamBScore ? "text-success" : "text-danger";
    teamANameSpan.innerHTML = scoreboard.teamAlpha.name;

    teamBScoreSpan.innerHTML = teamBScore;
    teamBScoreSpan.className = teamBScore > teamAScore ? "text-success" : "text-danger";
    teamBNameSpan.innerHTML = scoreboard.teamBeta.name;

    // Populate scoreboard
    if (scoreboard) {
      previewTeamAPlayerDiv.innerHTML = ""; // clear it.
      scoreboard.teamAlpha.players.forEach((player) => {
        let entry = document.createElement("div");
        entry.className = "col";
        entry.innerHTML = player.name;
        previewTeamAPlayerDiv.append(entry);
        entry.style.margin = "0";
      });
      previewTeamBPlayerDiv.innerHTML = ""; // clear it.
      scoreboard.teamBeta.players.forEach((player) => {
        let entry = document.createElement("div");
        entry.className = "col";
        entry.innerHTML = player.name;
        previewTeamBPlayerDiv.append(entry);
        entry.style.margin = "0";
      });
    }

    localStorage.setItem("teamAName", scoreboard.teamAlpha.name);
    localStorage.setItem("teamBName", scoreboard.teamBeta.name);

    // Show everything (set everything to visibility: unset)
    for (let i = 0; i < previewContainer.children.length; i++) {
      previewContainer.children[i].style.visibility = "unset";
    }

    previewButtons.style.visibility = "unset";

    loader.style.visibility = "hidden";

    console.log("preview Loaded");
  }

  function hideDemoPreview(path) {
    previewContainer.style.visibility = "hidden";
    for (let i = 0; i < previewContainer.children.length; i++) {
      previewContainer.children[i].style.visibility = "hidden";
    }
    previewButtons.style.visibility = "hidden";
  }

  // const previewDemoBtn = document.getElementById("previewDemoBtn");
  // previewDemoBtn.addEventListener("click", async (e) => {
  //   e.preventDefault();
  //   if (!isDemoSelected) {
  //     alert("Please select a demo.");
  //     return;
  //   }
  //   enableLoader(loader, loaderText, "Previewing Demo...");
  //   const demoPreviewInfo = await window.electron.previewDemo(demoPath, isFaceitCheckbox.checked);
  //   console.log(demoPreviewInfo);
  //   localStorage.setItem("demoMapName", demoPreviewInfo.header.map_name);
  //   localStorage.setItem("demoHeader", JSON.stringify(demoPreviewInfo.header));
  //   localStorage.setItem("demoScoreboard", JSON.stringify(demoPreviewInfo.scoreboard));
  //   disableLoader(loader);
  //   loadPage("demoPreview.html");
  // });
}

function previewDemo(filePath) {
  const loader = document.getElementById("loader");
  const loaderText = document.getElementById("loader-text");
  const previewMapImg = document.getElementById("p_mapImg");
  const scoreboardDiv = document.getElementById("ScoreboardInformation");
  const POVDemoDiv = document.getElementById("POVInformation");
  const demoHeader = JSON.parse(localStorage.getItem("demoHeader"));

  // Set the loader to visible!
  loader.style.visibility = "unset";

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

    localStorage.setItem("teamAName", teamAName);
    localStorage.setItem("teamBName", teamBName);

    // Set score
    // teamAScoreSpan.innerHTML = teamAScore;
    // teamAScoreSpan.className = teamAScore > teamBScore ? "text-success" : "text-danger";
    // teamANameSpan.innerHTML = teamAName;

    // teamBScoreSpan.innerHTML = teamBScore;
    // teamBScoreSpan.className = teamBScore > teamAScore ? "text-success" : "text-danger";
    // teamBNameSpan.innerHTML = teamBName;

    // Add players to scoreboard
    // if (demoScoreboard) {
    //   demoScoreboard.teamAlpha.players.forEach((player) => {
    //     let entry = document.createElement("div");
    //     entry.className = "col";
    //     entry.innerHTML = player.name;
    //     previewTeamAPlayerDiv.append(entry);
    //     entry.style.margin = "0";
    //   });
    //   demoScoreboard.teamBeta.players.forEach((player) => {
    //     let entry = document.createElement("div");
    //     entry.className = "col";
    //     entry.innerHTML = player.name;
    //     previewTeamBPlayerDiv.append(entry);
    //     entry.style.margin = "0";
    //   });
    // }
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
  roundVirtualStartTicks: null,
  currentTick: 0,
  maxTick: Infinity,
  currentDemoTick: 0,
  currentRound: 0,
  multiRoundSelection: new Set(),
  multiRoundMasterTick: 0,
  lastRound: 1,
  isNewRound: false,
};

export let settings = {
  // Team side settings
  teamA: "", // CT Start
  teamB: "", // T Start

  // Player Filter Settings
  hiddenPlayers: new Set(),
  showNadesThrownByHiddenPlayers: false,

  // Render/Animation Settings
  showShootingTracers: false,
  freezeTimeLength: 3,
  killFeedDuration: 6.0,

  // Multi-round overlay
  multiRoundOverlayMode: false,
  teamSelected: "",
  OTSelection: 0, //-1 = no, 0 = yes, 1 = only
  sideSelected: "CT",
  winConditions: new Set(["bomb_defused", "bomb_detonated", "t_killed", "ct_killed", "time_ran_out"]), // All by default.
};

export const TColor = "#f79b4e";
export const TBombColor = "#c76f26";
export const CTColor = "#4ea5f7";

export let settingsToConfigure = [
  { name: "showNadesThrownByHiddenPlayers", type: "checkbox", defaultValue: false },
  { name: "showShootingTracers", type: "checkbox", defaultValue: true },
  { name: "freezeTimeLength", type: "select", defaultValue: 3 },
  { name: "killFeedDuration", type: "number", defaultValue: 6 },
];

export let canvasSettings = {
  zoom: 1,
  offsetX: 0,
  offsetY: 0,
  isDragging: false,
  lastMouseX: 0,
  lastMouseY: 0,
  mainImage: 0,
  layers: 1,
};

export let svgCache = {};

function resizeCanvas() {
  const scale = window.devicePixelRatio || 1;
  const rect = canvas.getBoundingClientRect();

  // Set physical canvas size in pixels
  canvas.width = rect.width * scale;
  canvas.height = rect.height * scale;

  // Clear any old transforms
  ctx.setTransform(1, 0, 0, 1, 0, 0);

  // Scale to fit a 1024x1024 logical coordinate space
  const scaleX = canvas.width / 1024;
  const scaleY = canvas.height / 1024;
  const uniformScale = Math.min(scaleX, scaleY);

  // Center the drawing in the canvas
  const offsetX = (canvas.width - 1024 * uniformScale) / 2;
  const offsetY = (canvas.height - 1024 * uniformScale) / 2;

  ctx.translate(offsetX, offsetY);
  ctx.scale(uniformScale, uniformScale);
}

export let teamAPlayers = [];
export let teamBPlayers = [];
export let allPlayers = [];

async function initDemoReviewPage() {
  // Define all HTML elements
  const loader = document.getElementById("loader");
  const loaderText = document.getElementById("loader-text");
  const currentTickSpan = document.getElementById("currentTickSpan");
  const canvas = document.getElementById("minimap");
  const ctx = canvas.getContext("2d");
  const speedMultiplierSelect = document.getElementById("speedMultiplierSelect");
  const scrubBar = document.getElementById("timeline-range");
  // const playPauseBtn = document.getElementById("playPauseBtn");
  const playBtn = document.getElementById("play-btn");
  const pauseBtn = document.getElementById("pause-btn");
  const roundSelect = document.getElementById("roundSelect");
  const prevRoundBtn = document.getElementById("prevRoundBtn");
  const nextRoundBtn = document.getElementById("nextRoundBtn");
  const saveDemoBtn = document.getElementById("saveDemoBtn");
  const roundsPanel = document.getElementById("roundsPanel");
  const multiRoundOverlay = document.getElementById("multiRoundOverlay");
  const exitMultiRoundModeBtn = document.getElementById("exit-multi-round-btn");
  const multiRoundOverlayToggleBtn = document.getElementById("multiRoundOverlayToggleBtn");
  const printTickbtn = document.getElementById("printCurrentTick");
  const printTickstoreBtn = document.getElementById("printCurrentTickstore");
  const printRoundBtn = document.getElementById("printCurrentRound");
  const debugPanel = document.getElementById("debugPanel");

  enableLoader(loader, loaderText, "Processing Demo...<br/>This may take up to a minute.");

  const originalConsoleError = console.error;
  console.error = function (...args) {
    originalConsoleError.apply(console, args);
    showFlashMessage("Console error: " + args.join(" "), "error");
  };

  window.onerror = function (message, source, lineno, colno, error) {
    showFlashMessage(`JS Error: ${message} at ${lineno}:${colno}`, "error");
    return false;
  };

  window.onunhandledrejection = function (event) {
    showFlashMessage(`Unhandled Promise Rejection: ${event.reason}`, "error");
  };

  let isDebugPanelShowing = false;

  printTickbtn.onclick = () => {
    console.log(tick);
  };

  printTickstoreBtn.onclick = () => {
    console.log(tickStore);
  };

  printRoundBtn.onclick = () => {
    console.log(tickStore.currentRound);
  };

  // multiRoundOverlayToggleBtn.addEventListener("click", () => {
  //   // Show overlay
  //   multiRoundOverlay.style.visibility = "visible";

  //   // Shows rounds panel
  //   roundsPanel.style.visibility = "visible";

  //   // Hide enter multi-round button;
  //   multiRoundOverlayToggleBtn.style.display = "none";

  //   settings.multiRoundOverlayMode = true;
  // });

  // exitMultiRoundModeBtn.addEventListener("click", () => {
  //   multiRoundOverlay.style.visibility = "hidden";

  //   roundsPanel.style.visibility = "hidden";

  //   multiRoundOverlayToggleBtn.style.display = "";

  //   settings.multiRoundOverlayMode = false;
  // });

  saveDemoBtn.addEventListener("click", async () => {
    const res = await window.electron.saveProcessedDemo();
    console.log(res);
    if (res == true) {
      alert("Demo saved successfully");
    } else {
      alert("Failed to save demo.");
    }
  });

  const teamAName = localStorage.getItem("teamAName");
  const teamBName = localStorage.getItem("teamBName");

  document.getElementById("teamAlphaName").innerHTML = teamAName;
  document.getElementById("teamBetaName").innerHTML = teamBName;

  settings.teamA = teamAName;
  settings.teamB = teamBName;

  settings.teamSelected = localStorage.getItem("teamAName");
  // Process and store the demo ticks
  // enableLoader(loader, loaderText, "Processing Demo...");
  const res = await fetch("http://localhost:3000/api/demo/process");

  const { rounds, mapData: map, scoreboard } = await res.json();

  tickStore.rounds = rounds;

  // Set players onto their respective teams;
  scoreboard.teamAlpha.players.forEach((player) => {
    teamAPlayers.push(player.name);
  });

  scoreboard.teamBeta.players.forEach((player) => {
    teamBPlayers.push(player.name);
  });

  allPlayers = teamAPlayers.concat(teamBPlayers);

  constructTickMap(rounds);

  // disableLoader(loader);
  loadCanvasVars(canvas, ctx);
  loadMapVars(map);

  // Set up the player filters checkboxes
  // const playerFiltersModal = document.getElementById("playerFiltersModalTeamBox");
  // setupPlayerFiltersModal(playerFiltersModal, scoreboard);
  // setupSettingsListeners();
  // setupMultiRoundsPanel(document.getElementById("multi-rounds-list"), rounds);

  generateRoundList(rounds);
  generatePlayerHUD();

  // Flags
  const tickrate = 64;
  let paused = false;
  let isScrubbing = false;
  let animationTimeout;
  let wasPlayingBeforeScrub = false;

  let tick;

  let beginPlaying = true;

  // Basic event listeners
  // let speedMultiplier = parseFloat(speedMultiplierSelect.value);
  // speedMultiplierSelect.onchange = (e) => {
  //   speedMultiplier = parseFloat(e.target.value);
  // };

  let speedMultiplier = 1;

  document.querySelectorAll(".speed-btn").forEach((btn) => {
    btn.addEventListener("click", () => {
      const speed = btn.getAttribute("data-speed");
      // Replace this with your actual speed control logic
      speedMultiplier = speed;

      // Update the visible speed label
      document.getElementById("currentSpeedLabel").textContent = "x" + speed;

      // Close dropdown manually
      // bootstrap.Dropdown.getInstance(btn.closest(".dropdown")).hide();
    });
  });

  // Loading the map image background and beginning the replay!

  const mainMapImg = new Image();
  const lowerMapImg = new Image();

  let imagesLoaded = 0;
  canvasSettings.layers = map.lower_level_max_units !== -1000000.0 ? 2 : 1;

  const onAllImagesLoaded = () => {
    loadMapImgContext(mainMapImg, lowerMapImg);
    resizeCanvas();
    resetView();
    // renderRoundSegments(rounds);

    // Begin paused?

    function drawFrame() {
      if (paused || isScrubbing) return;

      tick = getTickData(tickStore.currentTick);

      if (tick != null) {
        tickStore.currentDemoTick = tick.demoTick;
        tickStore.lastRound = tickStore.currentRound;
        tickStore.currentRound = getRoundInfo(tickStore.currentTick);
        tickStore.isNewRound = tickStore.currentRound != tickStore.lastRound;

        if (tickStore.currentDemoTick < tickStore.currentRound.freezeEndTick - settings.freezeTimeLength * tickrate) {
          // Update the forward/backward round buttons
          // if (tickStore.currentRound.roundNumber == 1) {
          //   disableElement(prevRoundBtn);
          // } else {
          //   enableElement(prevRoundBtn);
          // }
          // if (tickStore.currentRound.roundNumber == tickStore.rounds.length) {
          //   disableElement(nextRoundBtn);
          // } else {
          //   enableElement(nextRoundBtn);
          // }

          // Are we between a round start and freeze end? Skip to the desired freeze time length.
          tickStore.currentTick = getVirtualTickFromDemoTick(tickStore.currentRound.freezeEndTick - settings.freezeTimeLength * tickrate);
        }

        drawTick(tick, mainMapImg, lowerMapImg);
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
      }
    }

    // --- Scrubbing logic ---
    scrubBar.addEventListener("input", () => {
      // Only pause if it was playing before scrubbing
      if (!paused && !isScrubbing) {
        wasPlayingBeforeScrub = true;
        paused = true;
      }

      isScrubbing = true; // Start scrubbing
      clearTimeout(animationTimeout); // Stop any current animation

      // Current round starting virtual tick
      let vStartTick = getVirtualTickFromDemoTick(tickStore.currentRound.startTick);

      // const newTick = parseInt(scrubBar.value) + parseInt(vStartTick); // Must do this + the virtual round start tick..
      const newTick = parseInt(scrubBar.value) + parseInt(vStartTick); // Must do this + the virtual round start tick..

      seekToDemoTime(newTick);
      tickStore.currentRound = getRoundInfo(tickStore.currentTick);

      tick = getTickData(tickStore.currentTick);
      tickStore.currentDemoTick = tick.demoTick;
      if (tick == null) {
        console.warn("Skipping tick", tickStore.currentTick, "due to missing data - likely due to demo inconsistencies.");
      } else {
        drawTick(tick, mainMapImg, lowerMapImg); // Just render the frame without resuming playback
      }

      // roundSelect.value = tickStore.currentRound.roundNumber;
    });

    scrubBar.addEventListener("change", () => {
      isScrubbing = false; // End scrubbing

      // If it was playing before scrubbing, resume playback
      paused = !wasPlayingBeforeScrub;
      // playPauseBtn.innerText = paused ? "Play" : "Pause";

      if (!paused) {
        drawFrame(); // Resume playback if it was playing before
      }
    });

    playBtn.addEventListener("click", () => {
      if (paused) {
        playBtn.classList.add("active");
        pauseBtn.classList.remove("active");
        paused = false;
        drawFrame();
      }
    });

    pauseBtn.addEventListener("click", () => {
      if (!paused) {
        pauseBtn.classList.add("active");
        playBtn.classList.remove("active");
        paused = true;
        clearTimeout(animationTimeout);
      }
    });

    // Add round select options (and also init the listener)
    // for (let round of tickStore.rounds) {
    //   const option = document.createElement("option");
    //   option.value = round.roundNumber;
    //   option.innerHTML = round.roundNumber;
    //   roundSelect.append(option);
    // }

    // roundSelect.addEventListener("input", () => {
    //   goToRound(roundSelect.value); //change selected tick
    // });

    // prevRoundBtn.addEventListener("click", () => {
    //   if (tickStore.currentRound.roundNumber - 1 < 1) {
    //     alert("No previous round!");
    //   } else {
    //     goToRound(tickStore.currentRound.roundNumber - 1);
    //     roundSelect.value = tickStore.currentRound.roundNumber;
    //   }
    // });

    // disableElement(prevRoundBtn);

    // nextRoundBtn.addEventListener("click", () => {
    //   if (tickStore.currentRound.isLastRound) {
    //     alert("No further round!");
    //   } else {
    //     // tickStore.currentRound++;
    //     const nextRoundNumber = tickStore.currentRound.roundNumber + 1;
    //     goToRound(nextRoundNumber);
    //     roundSelect.value = nextRoundNumber;
    //   }
    // });

    // Start playback
    drawFrame();
    // Disable the loader
    disableLoader(loader);
  };

  const checkIfAllImagesLoaded = () => {
    imagesLoaded++;
    if (imagesLoaded === canvasSettings.layers) {
      onAllImagesLoaded();
    }
  };

  mainMapImg.onload = checkIfAllImagesLoaded;
  lowerMapImg.onload = checkIfAllImagesLoaded;

  mainMapImg.src = `map-data/${localStorage.getItem("demoMapName")}.png`;
  if (canvasSettings.layers == 2) {
    lowerMapImg.src = `map-data/${localStorage.getItem("demoMapName")}_lower.png`;
  }

  // mapImg.onload = () => {};

  function clampOffsets() {
    // const scaledWidth = 1024 * canvasSettings.zoom;
    // const scaledHeight = 1024 * canvasSettings.zoom;
    // const minOffsetX = Math.min(0, canvas.width - scaledWidth);
    // const minOffsetY = Math.min(0, canvas.height - scaledHeight);
    // canvasSettings.offsetX = Math.max(minOffsetX, Math.min(canvasSettings.offsetX, 0));
    // canvasSettings.offsetY = Math.max(minOffsetY, Math.min(canvasSettings.offsetY, 0));
  }

  canvas.addEventListener("wheel", (e) => {
    e.preventDefault();

    const zoomFactor = 1.1;

    // Get mouse position relative to canvas
    const rect = canvas.getBoundingClientRect();
    const mouseX = e.clientX - rect.left;
    const mouseY = e.clientY - rect.top;

    // Convert to world (map) coordinates
    const worldX = (mouseX - canvasSettings.offsetX) / canvasSettings.zoom;
    const worldY = (mouseY - canvasSettings.offsetY) / canvasSettings.zoom;

    // Apply zoom
    const delta = e.deltaY < 0 ? zoomFactor : 1 / zoomFactor;
    canvasSettings.zoom *= delta;
    canvasSettings.zoom = Math.min(Math.max(canvasSettings.zoom, 1), 5);

    // Adjust offset so the world point under the mouse stays stationary
    canvasSettings.offsetX = mouseX - worldX * canvasSettings.zoom;
    canvasSettings.offsetY = mouseY - worldY * canvasSettings.zoom;

    clampOffsets();
    drawTick(tick, mainMapImg, lowerMapImg);
  });

  canvas.addEventListener("mousedown", (e) => {
    canvasSettings.isDragging = true;
    canvasSettings.lastMouseX = e.clientX;
    canvasSettings.lastMouseY = e.clientY;
  });

  canvas.addEventListener("mouseup", () => {
    canvasSettings.isDragging = false;
  });

  canvas.addEventListener("mouseleave", () => {
    canvasSettings.isDragging = false;
  });

  canvas.addEventListener("mousemove", (e) => {
    if (!canvasSettings.isDragging) return;

    const dx = e.clientX - canvasSettings.lastMouseX;
    const dy = e.clientY - canvasSettings.lastMouseY;

    canvasSettings.offsetX += dx;
    canvasSettings.offsetY += dy;

    canvasSettings.lastMouseX = e.clientX;
    canvasSettings.lastMouseY = e.clientY;

    clampOffsets();
    drawTick(tick, mainMapImg, lowerMapImg);
  });

  const resetView = () => {
    canvasSettings.zoom = 1;
    // canvasSettings.offsetX = (canvas.width - 1024) / 2;
    // canvasSettings.offsetY = (canvas.height - 1024) / 2;
    canvasSettings.offsetX = 0;
    canvasSettings.offsetY = 0;
    clampOffsets();
    drawTick(tick, mainMapImg, lowerMapImg);
  };

  const settingsModal = document.getElementById("settingsModal");

  document.addEventListener("keydown", (e) => {
    debugPanel.querySelector("#lastKeyPressed").innerHTML = e.code;
    if (e.code === "KeyR") {
      e.preventDefault(); // Prevent page scrolling
      resetView();
    }
    if (e.code === "KeyD") {
      e.preventDefault();
      if (isDebugPanelShowing) {
        setElementInvisible(debugPanel);
      } else {
        setElementVisible(debugPanel);
      }
      isDebugPanelShowing = !isDebugPanelShowing;
    }
    if (e.code === "Space") {
      if (paused) {
        playBtn.click();
      } else {
        pauseBtn.click();
      }
    }
    if (e.code === "KeyS") {
      console.log("lol");
      toggleElementVisibility(settingsModal);
    }
  });
}
