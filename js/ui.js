// write the UI updating stuff here (NOT THE CANVAS UPDATES);

import { allPlayers, CTColor, settings, settingsToConfigure, svgCache, TColor, teamAPlayers, teamBPlayers, tickStore } from "../renderer.js";
import { VANITY_TO_FILE } from "./CONSTANTS.js";
import { getVirtualTickFromDemoTick, seekToDemoTime, updateRoundInfo } from "./demo.js";

// export as required

/**
 * A utility function that enables a HTML loader, optionally with the given text.
 *
 * @export
 * @param {HTMLElement} loader Element containing the loader
 * @param {HTMLElement} loaderText Loader text element
 * @param {String} text Loader text
 */
export function enableLoader(loader, loaderText, text = "Loading...") {
  loader.style.display = "flex";
  loaderText.innerHTML = text;
}

/**
 * A utility function that disables a HTML Loader.
 *
 * @export
 * @param {HTMLElement} loader Element containing the loader
 */
export function disableLoader(loader) {
  loader.style.display = "none";
}

/**
 * A utility function that turns the given element visible.
 *
 * @export
 * @param {HTMLElement} element Element to turn visible
 */
export function setElementVisible(element) {
  element.style.visibility = "visible";
}

/**
 * A utility function that turns the given element invisible.
 *
 * @export
 * @param {HTMLElement} element Element to turn invisible
 */
export function setElementInvisible(element) {
  element.style.visibility = "hidden";
}

export function toggleElementVisibility(element) {
  if (element.style.visibility == "visible") {
    setElementInvisible(element);
  } else {
    setElementVisible(element);
  }
}

export function setElementDisplayNone(element) {
  element.style.display = "none";
}

export function setElementDisplayBlock(element) {
  element.style.display = "block";
}

export function disableElement(element) {
  element.disabled = true;
}

export function enableElement(element) {
  element.disabled = false;
}

function isTeamAOnCTSide(roundNumber) {
  // Regulation rounds
  if (roundNumber <= 12) {
    return true; // Team A starts CT
  }
  if (roundNumber > 12 && roundNumber <= 24) {
    return false; // Team A switches to T
  }

  // Overtime rounds
  const otRound = roundNumber - 25; // 0-based index
  const otHalf = Math.floor(otRound / 6); // Which OT half (0 = OT1 first half, 1 = OT1 second half, etc.)
  const roundInHalf = otRound % 6;
  const isFirstHalf = roundInHalf < 3;

  // In overtime: Team A is CT in 1st half of OT1, T in 2nd half of OT1, and it alternates every half
  return (otHalf % 2 === 0 && isFirstHalf) || (otHalf % 2 === 1 && !isFirstHalf);
}

// Preload SVGs
// export async function preloadSVG(key, url) {
//   const res = await fetch(url);
//   const svgText = await res.text();
//   svgCache[key] = svgText;
// }

// export function generateSVG(container, key) {
//   if (svgCache[key]) {
//     container.innerHTML = svgCache[key];
//   } else {
//     console.error("SVG not preloaded:", key);
//   }
// }

// Preload the entire SVG as text and cache it
export async function preloadSVG(key, url) {
  try {
    const res = await fetch(url);
    if (!res.ok) throw new Error(`Failed to fetch SVG: ${res.statusText}`);

    const svgText = await res.text();
    svgCache[key] = svgText;
  } catch (err) {
    console.error(`Error preloading SVG (${key}):`, err);
  }
}

// Parse cached SVG text into an SVGElement and return it
export function generateSVG(key) {
  const svgText = svgCache[key];
  if (!svgText) {
    console.error("SVG not preloaded or missing:", key);
    return null;
  }

  const parser = new DOMParser();
  const doc = parser.parseFromString(svgText, "image/svg+xml");
  const svgElement = doc.querySelector("svg");

  if (!svgElement) {
    console.error("No <svg> element found in cached SVG for key:", key);
    return null;
  }

  // Return a cloned node so you can insert it multiple times if needed
  return svgElement.cloneNode(true);
}

function updateMultiRoundsList(element) {
  console.log(settings);
  const roundNumToEl = {};

  tickStore.multiRoundSelection.clear();
  for (const round of element.children) {
    const roundNum = round.firstChild.id.replace("round_", "");
    round.firstChild.checked = false;
    roundNumToEl[roundNum] = round.firstChild;
  }

  const sideSet = new Set();
  const allRoundsInlcudingOTSet = new Set();
  const winConditionSet = new Set();

  for (const round of tickStore.rounds) {
    const rn = round.roundNumber;

    let selectedTeamIsCT = false;

    if (settings.teamSelected === settings.teamA) {
      // Team A: CT in rounds 1–12 and selected OT halves
      if (rn <= 12) {
        selectedTeamIsCT = true;
      } else if (rn > 24) {
        const otRound = rn - 25;
        const otHalf = Math.floor(otRound / 6);
        const roundInHalf = otRound % 6;
        const isFirstHalf = roundInHalf < 3;

        selectedTeamIsCT = (otHalf % 2 === 0 && isFirstHalf) || (otHalf % 2 === 1 && !isFirstHalf);
      }
    } else {
      // Team B: CT in rounds 13–24 and inverse OT halves
      if (rn > 12 && rn <= 24) {
        selectedTeamIsCT = true;
      } else if (rn > 24) {
        const otRound = rn - 25;
        const otHalf = Math.floor(otRound / 6);
        const roundInHalf = otRound % 6;
        const isFirstHalf = roundInHalf < 3;

        selectedTeamIsCT = (otHalf % 2 === 0 && !isFirstHalf) || (otHalf % 2 === 1 && isFirstHalf);
      }
    }

    // Now filter by sideSelected ("CT" or "T")
    const wantsCT = settings.sideSelected === "CT";
    if (selectedTeamIsCT === wantsCT) {
      sideSet.add(round);
    }

    // OT selection
    if (settings.OTSelection === -1) {
      // Only regulation.
      if (round.roundNumber < 25) {
        allRoundsInlcudingOTSet.add(round);
      }
    } else if (settings.OTSelection === 0) {
      allRoundsInlcudingOTSet.add(round);
    } else if (settings.OTSelection === 1) {
      if (round.roundNumber > 24) {
        allRoundsInlcudingOTSet.add(round);
      }
    }

    // Win conditions
    if (settings.winConditions.has(round.winReason)) {
      winConditionSet.add(round);
    }
  }

  // Build the intersection of all the sets to get the rounds to show.

  console.log(sideSet);
  console.log(allRoundsInlcudingOTSet);
  console.log(winConditionSet);

  const finalRounds = new Set([...sideSet].filter((item) => allRoundsInlcudingOTSet.has(item) && winConditionSet.has(item)));

  for (const round of finalRounds) {
    const el = roundNumToEl[round.roundNumber];
    if (el) {
      el.checked = true;
      tickStore.multiRoundSelection.add(round);
    }
  }

  // Now also disable/enable all of the filters neccessary.
}

export function setupMultiRoundsPanel(element, rounds) {
  // Add a presets tab - CT/T Side to show each team on one side only.
  // Include Overtimes (if exists) three-way-toggle. No-Yes-ONLY
  // If ONLY OT we also get a selection of OT's to choose (also hide reguation rounds.)

  const teamAOption = document.getElementById("teamAOption");
  const teamBOption = document.getElementById("teamBOption");

  teamAOption.value = settings.teamA;
  teamBOption.value = settings.teamB;
  teamAOption.innerHTML = settings.teamA;
  teamBOption.innerHTML = settings.teamB;
  // Set up team selection listeners
  document.getElementById("teamSelectForFilter").addEventListener("click", (ev) => {
    settings.teamSelected = ev.target.selectedOptions[0].value;
    updateMultiRoundsList(element);
  });

  // Setup the toggle listeners:
  const ctBtn = document.getElementById("btn-ct");
  const tBtn = document.getElementById("btn-t");

  ctBtn.addEventListener("click", () => {
    // CT SIDE SELECT
    ctBtn.classList.add("selected");
    tBtn.classList.remove("selected");
    settings.sideSelected = "CT";
    updateMultiRoundsList(element);

    // Also, unselect all rounds, and just select the rounds where team A is on ct side (first half + check with OT);
  });

  tBtn.addEventListener("click", () => {
    // T SIDE SELECT
    tBtn.classList.add("selected");
    ctBtn.classList.remove("selected");
    settings.sideSelected = "T";
    updateMultiRoundsList(element);
  });

  // OT Buttons
  const otButtons = document.querySelectorAll(".btn-ot");
  otButtons.forEach((btn) => {
    btn.addEventListener("click", (ev) => {
      otButtons.forEach((b) => b.classList.remove("selected"));
      btn.classList.add("selected");
      switch (ev.target.innerHTML) {
        case "No":
          settings.OTSelection = -1;
          break;
        case "Yes":
          settings.OTSelection = 0;
          break;
        case "Only":
          settings.OTSelection = 1;
      }
      updateMultiRoundsList(element);
    });
  });

  // Hide if OT is not in the game.
  if (tickStore.rounds.length < 25) {
    document.getElementById("ot-btn-cont").style.display = "none";
  }

  // Win Conditions
  document.getElementById("btn-bomb_exploded").addEventListener("click", (ev) => {
    if (ev.target.checked) {
      settings.winConditions.add("bomb_exploded");
    } else {
      settings.winConditions.delete("bomb_exploded");
    }
    // Update multi-round list + re-draw.
    updateMultiRoundsList(element);
  });

  document.getElementById("btn-bomb_defused").addEventListener("click", (ev) => {
    if (ev.target.checked) {
      settings.winConditions.add("bomb_defused");
    } else {
      settings.winConditions.delete("bomb_defused");
    }
    // Update multi-round list + re-draw.
    updateMultiRoundsList(element);
  });

  document.getElementById("btn-killed").addEventListener("click", (ev) => {
    if (ev.target.checked) {
      settings.winConditions.add("t_killed");
      settings.winConditions.add("ct_killed");
    } else {
      settings.winConditions.delete("t_killed");
      settings.winConditions.delete("ct_killed");
    }
    // Update multi-round list + re-draw.
    updateMultiRoundsList(element);
  });

  document.getElementById("btn-time_ran_out").addEventListener("click", (ev) => {
    if (ev.target.checked) {
      settings.winConditions.add("time_ran_out");
    } else {
      settings.winConditions.delete("time_ran_out");
    }
    // Update multi-round list + re-draw.
    updateMultiRoundsList(element);
  });

  // presetsCont = document.createElement;
  rounds.forEach((round) => {
    // Add custom attributes which denote:
    // Half: 1 or 2?
    // OT: -1 or 1,2,3,4... etc?
    // If yes: What half of ot?
    // Can then combine OT 1 + half 1 means CT side is a
    // Let's say OT 1 side 2 is CT side is b etc.

    const roundListItem = document.createElement("li");
    roundListItem.className = "list-group-item d-flex align-items-center";
    roundListItem.style.color = round.winner == "T" ? "orange" : "blue";

    const roundCheckbox = document.createElement("input");
    roundCheckbox.type = "checkbox";
    roundCheckbox.className = "form-check-input me-2";
    roundCheckbox.id = "round_" + round.roundNumber;
    roundCheckbox.checked = true;

    const winReasonSVG = document.createElement("svg");

    let svgFileName = "";

    switch (round.winReason) {
      case "bomb_defused":
        svgFileName = "./img/logo/bomb_defused.svg";
        break;
      case "bomb_exploded":
        svgFileName = "./img/logo/bomb.svg";
      case "t_killed":
      case "ct_killed":
        svgFileName = "./img/logo/killed.svg";
        break;
      case "time_ran_out":
        svgFileName = "./img/logo/time_ran_out.svg";
        break;
      default:
        break;
    }

    fetch(svgFileName)
      .then((res) => res.text())
      .then((data) => {
        winReasonSVG.innerHTML = data;

        const svgElement = winReasonSVG.querySelector("svg");

        svgElement.removeAttribute("width");
        svgElement.removeAttribute("height");
        svgElement.style.width = "30px";
        svgElement.style.height = "30px";

        svgElement.removeAttribute("fill");
        svgElement.style.fill = round.winner == "T" ? "orange" : "blue";
      });

    // Add event listener
    roundCheckbox.addEventListener("change", () => {
      if (roundCheckbox.checked) {
        // Add it to the multiround set.
        tickStore.multiRoundSelection.add(round);
      } else {
        tickStore.multiRoundSelection.delete(round);
      }
    });

    // By default, let's add every round to the tickStore as all the tickboxes start checked anyway.
    tickStore.multiRoundSelection.add(round);

    const labelWrapper = document.createElement("div");
    labelWrapper.className = "d-flex align-items-center justify-content-between w-100";

    const roundLabel = document.createElement("label");
    roundLabel.className = "form-check-label mb-0";
    roundLabel.setAttribute("for", "round_" + round.roundNumber);
    roundLabel.textContent = "Round " + round.roundNumber;

    winReasonSVG.classList.add("ms-2"); // optional small left margin

    labelWrapper.append(roundLabel);
    labelWrapper.append(winReasonSVG);

    roundListItem.append(roundCheckbox);
    roundListItem.append(labelWrapper);

    element.append(roundListItem);
  });
}

export function setupPlayerFiltersModal(modal, scoreboard) {
  // Team 1 title
  // for()
  modal.append(generateTeamPlayerFiltersHTML(scoreboard.teamAlpha));
  modal.append(generateTeamPlayerFiltersHTML(scoreboard.teamBeta));
}

function generateTeamPlayerFiltersHTML(team) {
  const container = document.createElement("div");
  container.className = "col-md-5 mb-4";

  const card = document.createElement("div");
  card.className = "card";
  container.append(card);

  const teamBox = document.createElement("div");
  teamBox.className = "card-header text-center fw-bold d-flex justify-content-center align-items-center gap-2";
  card.append(teamBox);

  const teamCheckbox = document.createElement("input");
  teamCheckbox.className = "form-check-input";
  teamCheckbox.type = "checkbox";
  teamCheckbox.id = "toggle" + team.name;
  teamCheckbox.checked = true;
  addTeamVisibilityFilter(teamCheckbox, team.players);
  const teamLabel = document.createElement("label");
  teamLabel.setAttribute("for", "toggle" + team.name);
  teamLabel.className = "mb-0";
  teamLabel.innerHTML = team.name;

  teamBox.append(teamCheckbox);
  teamBox.append(teamLabel);

  const playerList = document.createElement("ul");
  playerList.className = "list-group list-group-flush text-center";
  card.append(playerList);

  team.players.forEach((player) => {
    const playerListItem = document.createElement("li");
    playerListItem.className = "list-group-item d-flex justify-content-center align-items-center";

    const playerCheckbox = document.createElement("input");
    playerCheckbox.className = "form-check-input me-2";
    playerCheckbox.type = "checkbox";
    playerCheckbox.id = player.name;
    playerCheckbox.checked = true;

    const teamMates = team.players.filter((teamMate) => teamMate.name != player.name);

    addPlayerVisibilityFilter(playerCheckbox, player, teamMates, teamCheckbox);

    const playerLabel = document.createElement("label");
    playerLabel.setAttribute("for", player.name);
    playerLabel.innerHTML = player.name;

    playerListItem.append(playerCheckbox);
    playerListItem.append(playerLabel);

    playerList.append(playerListItem);
  });

  return container;
}

function addTeamVisibilityFilter(element, players) {
  element.addEventListener("change", () => {
    players.forEach((player) => {
      const playerCheckbox = document.getElementById(player.name);
      if (element.checked) {
        settings.hiddenPlayers.delete(player.name);
        playerCheckbox.checked = true;
      } else {
        settings.hiddenPlayers.add(player.name);
        playerCheckbox.checked = false;
      }
    });
  });
}

function addPlayerVisibilityFilter(element, player, teamMates, teamCheckbox) {
  element.addEventListener("change", () => {
    if (element.checked) {
      settings.hiddenPlayers.delete(player.name);
      // Check if all other players are checked, if they are set the teamCheckbox.checked to true.
      let allTeamMatesChecked = true;
      teamMates.forEach((teamMate) => {
        if (document.getElementById(teamMate.name).checked == false) {
          allTeamMatesChecked = false;
        }
      });
      if (allTeamMatesChecked) {
        teamCheckbox.checked = true;
      }
    } else {
      settings.hiddenPlayers.add(player.name);
      teamCheckbox.checked = false; //could trigger it's event and untick all?
    }
  });
}

export function setupSettingsListeners() {
  settingsToConfigure.forEach((setting) => {
    const element = document.getElementById("setting_" + setting.name);
    if (setting.type == "checkbox") {
      // Set to default
      element.checked = setting.defaultValue;

      // Add listener
      element.addEventListener("change", () => {
        settings[setting.name] = element.checked;
        console.log(settings);
      });
    } else if ((setting.type = "select")) {
      // set to default
      element.value = setting.defaultValue;

      element.addEventListener("change", () => {
        settings[setting.name] = element.value;
        console.log(settings);
      });
    }
  });
}

export function showFlashMessage(msg, type = "error", duration = 7000) {
  const container = document.getElementById("flash-container");

  const flash = document.createElement("div");
  flash.className = "flash-message";
  flash.innerText = msg;

  // Optional: style by type
  flash.style.background = type === "error" ? "#e74c3c" : "#2ecc71";
  flash.style.color = "#fff";
  flash.style.padding = "10px 15px";
  flash.style.marginTop = "10px";
  flash.style.borderRadius = "5px";
  flash.style.boxShadow = "0 2px 6px rgba(0,0,0,0.2)";
  flash.style.transition = "opacity 0.5s";

  container.appendChild(flash);

  // Automatically remove after delay
  setTimeout(() => {
    flash.style.opacity = 0;
    setTimeout(() => container.removeChild(flash), 500); // Fade out then remove
  }, duration);
}

export function updateEventTimeline(round) {
  // Firstly delete any children of "event-markers"
  const markersContainer = document.getElementById("event-markers");

  markersContainer.innerHTML = ""; // clear

  // const eventIconsContainer = document.getElementById("eventIconsContainer");

  let max = round.length;

  round.timelineEvents.forEach((event) => {
    let time = event.tick - round.startTick;
    const left = (time / max) * 100;
    const marker = document.createElement("div");
    marker.classList.add("event-marker");
    marker.style.left = `${left}%`;
    markersContainer.appendChild(marker);

    // event icons
    let svg;

    if (event.event == "kill") {
      let teamAIsCT = isTeamAOnCTSide(tickStore.currentRound.roundNumber);
      let attackerSide;
      if (teamAPlayers.includes(event.attacker)) {
        attackerSide = teamAIsCT ? "CT" : "T";
      } else {
        attackerSide = teamAIsCT ? "T" : "CT";
      }

      svg = generateSVG("focus-icon");

      svg.removeAttribute("width");
      svg.removeAttribute("height");
      svg.style.width = "32px";
      svg.style.height = "32px";
      svg.removeAttribute("fill");
      svg.style.color = attackerSide == "T" ? TColor : CTColor;
    }

    if (event.event == "freeze_end") {
      svg = generateSVG("play-circle-icon");

      svg.removeAttribute("width");
      svg.removeAttribute("height");
      svg.style.width = "32px";
      svg.style.height = "32px";
      svg.removeAttribute("fill");
      svg.style.fill = "white";
    }

    if (event.event == "round_won" && event.reason == "time_ran_out") {
      svg = generateSVG("clock-icon");

      svg.removeAttribute("width");
      svg.removeAttribute("height");
      svg.style.width = "32px";
      svg.style.height = "32px";
      svg.removeAttribute("fill");
      let winnerWasTeamA = event.winner == 2;
      if (winnerWasTeamA) {
        svg.style.fill = isTeamAOnCTSide(tickStore.currentRound.roundNumber) ? CTColor : TColor;
      } else {
        svg.style.fill = isTeamAOnCTSide(tickStore.currentRound.roundNumber) ? TColor : CTColor;
      }
    }

    if (event.event == "round_won" && (event.reason == "t_killed" || event.reason == "ct_killed")) {
      svg = generateSVG("elimination-icon");
      svg.removeAttribute("width");
      svg.removeAttribute("height");
      svg.style.width = "32px";
      svg.style.height = "32px";
      svg.removeAttribute("fill");

      let winnerWasTeamA = event.winner == 2;
      if (winnerWasTeamA) {
        svg.style.fill = isTeamAOnCTSide(tickStore.currentRound.roundNumber) ? CTColor : TColor;
      } else {
        svg.style.fill = isTeamAOnCTSide(tickStore.currentRound.roundNumber) ? TColor : CTColor;
      }
    }

    if (event.event == "round_won" && event.reason == "bomb_defused") {
      svg = generateSVG("defuser-icon");
      svg.removeAttribute("width");
      svg.removeAttribute("height");
      svg.style.width = "32px";
      svg.style.height = "32px";
      svg.removeAttribute("fill");
      svg.style.fill = CTColor;
    }

    if (event.event == "round_won" && event.reason == "bomb_exploded") {
      svg = generateSVG("explosion-icon");
      svg.removeAttribute("width");
      svg.removeAttribute("height");
      svg.style.width = "32px";
      svg.style.height = "32px";
      svg.removeAttribute("fill");
      svg.style.fill = TColor;
    }

    // get and insert the svg code

    svg.style.transform = "translate(-48%, -130%)";
    svg.style.position = "absolute";
    svg.setAttribute("class", "event-icon");

    svg.addEventListener("click", () => {
      // Calcaulte the virtual tick this occured - 64 ticks (one second before)
      let vTick = getVirtualTickFromDemoTick(event.tick);
      seekToDemoTime(parseInt(vTick) - 64);
    });

    marker.appendChild(svg);
  });
}

export function clearKillFeed() {
  const killFeedDiv = document.getElementById("killfeed");
  killFeedDiv.innerHTML = "";
}

export function updateKillFeed() {
  // Look at the current tick in the round, filter all of the kills in the round < this tick. If < 6 seconds (64 * 6) or settings.killFeedDuration value, then display.
  // To make it pretty we can generate HTML to do it. When the kill has expired we can cause it to fade off by applying a class making it go to display: none; or invisible etc, then delete it start of next round.

  const killFeedDiv = document.getElementById("killfeed");

  let currentTick = tickStore.currentDemoTick;
  let currentRound = tickStore.currentRound;
  let kills = tickStore.currentRound.kills;

  // Check which team is on CT side:
  let teamAIsCT = isTeamAOnCTSide(currentRound.roundNumber);

  kills.forEach((kill) => {
    let attackerSide;
    if (teamAPlayers.includes(kill.attacker)) {
      attackerSide = teamAIsCT ? "CT" : "T";
    } else {
      attackerSide = teamAIsCT ? "T" : "CT";
    }

    let playerSide;
    if (teamAPlayers.includes(kill.player)) {
      playerSide = teamAIsCT ? "CT" : "T";
    } else {
      playerSide = teamAIsCT ? "T" : "CT";
    }

    // Firstly has the kill occured?
    if (kill.tick < currentTick) {
      // Kill has occured either now or in the past.
      if (kill.tick < currentTick - settings.killFeedDuration * 64) {
        // It occured > x seconds ago - if not already - apply the expired class.
        let element = document.getElementById(`#KILLFEED_ROUND${currentRound.roundNumber}_${kill.attacker}-${kill.player}`);
        if (element != null) {
          // Just in-case we have skipped and it was never made!
          element.style.display = "none";
        }
      } else {
        // It occured within the last x seconds - let's keep displaying it or display it.
        let element = document.getElementById(`#KILLFEED_ROUND${currentRound.roundNumber}_${kill.attacker}-${kill.player}`);

        if (element == null) {
          let killContainer = document.createElement("div");
          killContainer.id = `#KILLFEED_ROUND${currentRound.roundNumber}_${kill.attacker}-${kill.player}`;
          killContainer.className = "badge bg-dark";
          // Pre-props

          if (kill.attackerProps.includes("blind")) {
            // Load the blind svg
            let blindSVG = generateSVG("blind-icon");

            // const svgElement = blindSVG.querySelector("svg");

            blindSVG.removeAttribute("width");
            blindSVG.removeAttribute("height");
            blindSVG.style.height = "25px";

            blindSVG.removeAttribute("fill");
            blindSVG.style.fill = "white";

            killContainer.append(blindSVG);
          }

          // Attacker name span
          let attackerNameSpan = document.createElement("span");
          attackerNameSpan.innerHTML = kill.attacker;
          attackerNameSpan.style.color = attackerSide == "T" ? TColor : CTColor;
          attackerNameSpan.style.paddingRight = "3%";
          killContainer.append(attackerNameSpan);

          // Was jumping?
          if (kill.attackerProps.includes("jumping")) {
            let svg = generateSVG("airborne-kill-icon");

            svg.removeAttribute("width");
            svg.removeAttribute("height");
            svg.style.height = "25px";
            svg.style.transform = "translate(25%, -45%)";

            svg.removeAttribute("fill");
            svg.style.fill = "white";
            killContainer.append(svg);
          }

          // Weapon

          // Just check if its a knife kill:
          let weaponSVG;
          if (kill.weapon.includes("knife")) {
            weaponSVG = generateSVG("knife-icon");
          } else {
            weaponSVG = generateSVG(`${kill.weapon}-icon`);
          }

          weaponSVG.removeAttribute("width");
          weaponSVG.removeAttribute("height");
          weaponSVG.style.height = "25px";

          weaponSVG.removeAttribute("fill");
          weaponSVG.style.fill = "white";

          killContainer.append(weaponSVG);

          // Other props

          if (kill.attackerProps.includes("noscope")) {
            let svg = generateSVG("noscope-icon");

            svg.removeAttribute("width");
            svg.removeAttribute("height");

            svg.style.height = "25px";

            svg.removeAttribute("fill");
            svg.style.fill = "white";

            killContainer.append(svg);
          }

          if (kill.attackerProps.includes("smoke")) {
            let svg = generateSVG("through-smoke-kill-icon");

            svg.removeAttribute("width");
            svg.removeAttribute("height");

            svg.style.height = "25px";

            svg.removeAttribute("fill");
            svg.style.fill = "white";

            killContainer.append(svg);
          }

          if (kill.attackerProps.includes("wallbang")) {
            let svg = generateSVG("penetrate-icon");

            svg.removeAttribute("width");
            svg.removeAttribute("height");

            svg.style.height = "25px";

            svg.removeAttribute("fill");
            svg.style.fill = "white";

            killContainer.append(svg);
          }

          if (kill.attackerProps.includes("hs")) {
            let svg = generateSVG("headshot-icon");

            svg.removeAttribute("width");
            svg.removeAttribute("height");

            svg.style.height = "25px";

            svg.removeAttribute("fill");
            svg.style.fill = "white";

            killContainer.append(svg);
          }

          // Player name span (died)
          let playerNameSpan = document.createElement("span");
          playerNameSpan.innerHTML = kill.player;
          playerNameSpan.style.color = playerSide == "T" ? TColor : CTColor;

          killContainer.append(playerNameSpan);

          killFeedDiv.append(killContainer);
        } else {
          element.style.display = "block";
        }
      }
    } else {
      // Kill is in the future, we need to hide it!
      let element = document.getElementById(`#KILLFEED_ROUND${currentRound.roundNumber}_${kill.attacker}-${kill.player}`);
      if (element != null) {
        element.style.display = "none";
      }
    }
  });

  // Determine attacker side:
  // let attackerSide = teamAPlayers.includes()
}

/**
 *
 * @author Leo Tovell
 *
 * @export
 */
export function generateRoundList(rounds) {
  const roundContainer = document.getElementById("roundSidebar");

  // For each round

  rounds.forEach((round) => {
    const teamAIsCT = isTeamAOnCTSide(round.roundNumber);

    let roundWinnerColor;
    // Round winner colour;
    roundWinnerColor = round.winner === "CT" ? CTColor : TColor;

    // Generate the round div
    const container = document.createElement("div");
    container.className = "container-fluid round row";

    const leftContainer = document.createElement("div");
    leftContainer.className = "col-4";
    leftContainer.innerHTML = `<h1>${round.roundNumber}</h1>`;
    leftContainer.style.gap = "10%";
    let winConditionSVG;
    if (round.winReason == "time_ran_out") winConditionSVG = generateSVG("clock-icon");
    else if (round.winReason == "ct_killed" || round.winReason == "t_killed") winConditionSVG = generateSVG("elimination-icon");
    else if (round.winReason == "bomb_exploded") winConditionSVG = generateSVG("explosion-icon");
    else if (round.winReason == "bomb_defused") winConditionSVG = generateSVG("defuser-icon");
    winConditionSVG.style.height = "2rem";
    winConditionSVG.style.width = "auto";
    winConditionSVG.style.color = roundWinnerColor;
    winConditionSVG.style.fill = roundWinnerColor;
    // winConditionSVG.style.position = "absolute";
    // winConditionSVG.style.transform = "translateX(2.5rem)";
    leftContainer.appendChild(winConditionSVG);

    const middleContainer = document.createElement("div");
    middleContainer.className = "col d-flex";
    middleContainer.id = "playersAliveDiv";

    // Calculate Players Alive on team A and team B:
    let teamAPlayersAliveCount = 5;
    let teamBPlayersAliveCount = 5;

    round.kills.forEach((kill) => {
      if (round.isLastRound) {
        if (kill.weapon == "world" && kill.tick > round.endTick) {
          // Ignore this
        } else if (teamAPlayers.includes(kill.player)) {
          teamAPlayersAliveCount--;
        } else {
          teamBPlayersAliveCount--;
        }
      } else if (teamAPlayers.includes(kill.player)) {
        teamAPlayersAliveCount--;
      } else {
        teamBPlayersAliveCount--;
      }
    });

    const teamAPlayersAlive = document.createElement("div");
    teamAPlayersAlive.className = "col";
    teamAPlayersAlive.innerHTML = "I".repeat(teamAPlayersAliveCount);
    teamAPlayersAlive.style.color = teamAIsCT ? CTColor : TColor;

    const divider = document.createElement("div");
    divider.innerHTML = "&nbsp;|&nbsp;";

    const teamBPlayersAlive = document.createElement("div");
    teamBPlayersAlive.className = "col";
    teamBPlayersAlive.innerHTML = "I".repeat(teamBPlayersAliveCount);
    teamBPlayersAlive.style.color = teamAIsCT ? TColor : CTColor;

    middleContainer.appendChild(teamAPlayersAlive);
    middleContainer.appendChild(divider);
    middleContainer.appendChild(teamBPlayersAlive);

    const rightContainer = document.createElement("div");
    rightContainer.className = "col-4";

    // What side is team A?
    let teamAScore = document.createElement("h1");
    teamAScore.innerHTML = round.afterScoreA;
    teamAScore.style.color = teamAIsCT ? CTColor : TColor;

    const scoreColon = document.createElement("h1");
    scoreColon.innerHTML = ":";

    let teamBScore = document.createElement("h1");
    teamBScore.innerHTML = round.afterScoreB;
    teamBScore.style.color = teamAIsCT ? TColor : CTColor;
    rightContainer.appendChild(teamAScore);
    rightContainer.appendChild(scoreColon);
    rightContainer.appendChild(teamBScore);

    container.appendChild(leftContainer);
    container.appendChild(middleContainer);
    container.appendChild(rightContainer);

    container.onclick = () => {
      tickStore.currentRound = round;
      seekToDemoTime(getVirtualTickFromDemoTick(round.startTick));
      updateEventTimeline(round);
      setActiveRound(round.roundNumber);
      // set
    };

    roundContainer.appendChild(container);
  });
}

export function setActiveRound(roundNumber) {
  // Remove active class from all, then add to that round.
  const roundContainer = document.getElementById("roundSidebar");

  Array.from(roundContainer.children).forEach((child) => {
    child.classList.remove("active");
  });

  Array.from(roundContainer.children)[roundNumber - 1].classList.add("active");

  clearKillFeed();
  updateRoundInfo();
}

export function generateSinglePlayerHUD(player) {
  const div = document.createElement("div");
  div.classList.add("flex-fill", "player", "d-flex");
  div.id = `player-hud-${player}`;
  const col1 = document.createElement("div");
  col1.classList.add("col-1", "d-flex", "flex-column");
  col1.style.width = "30%";

  const name = document.createElement("div");
  name.classList.add("d-flex", "align-items-center", "player-name");
  name.style.flex = "2";
  name.style.fontSize = "larger";
  name.innerHTML = player;

  const stats_container = document.createElement("div");
  stats_container.classList.add("d-grid", "scoreboard-stats", "gap-2");

  // kills
  const kill_stat = document.createElement("div");
  kill_stat.classList.add("d-flex", "align-items-center", "justify-content-center", "gap-1");
  const kill_icon = generateSVG("focus-icon");
  kill_icon.classList.add("stat-icon");
  kill_stat.append(kill_icon);
  const k_val = document.createElement("span");
  k_val.innerHTML = "0";
  k_val.id = "kills";
  k_val.style.fontSize = "larger";
  kill_stat.append(k_val);
  stats_container.append(kill_stat);

  // deaths
  const death_stat = document.createElement("div");
  death_stat.classList.add("d-flex", "align-items-center", "justify-content-center", "gap-1");
  const death_icon = generateSVG("elimination-icon");
  death_icon.classList.add("stat-icon");
  death_icon.style.fill = "white";
  death_stat.append(death_icon);
  const d_val = document.createElement("span");
  d_val.innerHTML = "0";
  d_val.id = "deaths";
  d_val.style.fontSize = "larger";
  death_stat.append(d_val);
  stats_container.append(death_stat);

  col1.append(name);
  col1.append(stats_container);
  div.append(col1);

  // Column 2 (active weapon + grenades)
  const col2 = document.createElement("div");
  col2.classList.add("col-2", "d-flex", "flex-column");
  col2.style.width = "40%";
  col2.style.height = "100%"; // Needed for 50% row heights

  // Top half: active weapon
  const weapon = document.createElement("div");
  weapon.classList.add("d-flex", "align-items-center", "rem1-padding-left");
  weapon.id = "weapon";
  weapon.setAttribute("current", "glock");
  weapon.style.height = "50%";
  const weaponSVG = generateSVG("glock-icon");
  weaponSVG.classList.add("svg-scale-lock"); // Use shared scaling class
  weaponSVG.removeAttribute("width");
  weaponSVG.removeAttribute("height");
  weapon.append(weaponSVG);

  // Bottom half: grenades
  const grenades = document.createElement("div");
  grenades.classList.add("d-flex", "align-items-center", "gap-1", "rem1-padding-left");
  grenades.id = "grenades";
  grenades.style.height = "50%";

  const smoke = generateSVG("smoke-grenade-icon");
  smoke.id = "smoke";
  const incend = generateSVG("incendiary-grenade-icon");
  incend.id = "incend";
  incend.style.display = "none";
  const molotov = generateSVG("molotov-icon");
  molotov.id = "molotov";
  const he = generateSVG("he-grenade-icon");
  he.id = "he";
  const flash1 = generateSVG("flashbang-icon");
  flash1.id = "flash1";
  const flash2 = generateSVG("flashbang-icon");
  flash2.id = "flash2";
  const bomb = generateSVG("bomb-icon");
  bomb.id = "bomb";

  [smoke, incend, molotov, he, flash1, flash2, bomb].forEach((g) => {
    g.classList.add("svg-scale-lock");
    g.removeAttribute("width");
    g.removeAttribute("height");
  });

  grenades.append(smoke, incend, molotov, he, flash1, flash2, bomb);

  // Append to column
  col2.append(weapon, grenades);

  div.append(col2);

  // Finally the three rows for health, armor and balance.

  const col3 = document.createElement("div");
  col3.classList.add("col-3", "d-flex", "flex-column");
  col3.style.width = "30%";
  col3.style.height = "100%";

  // Health row
  const health = document.createElement("div");
  health.classList.add("d-flex", "health-armor-bal");
  health.style.height = "33%";
  const h_val = document.createElement("span");
  h_val.innerHTML = "100";
  h_val.id = "health";
  health.append(h_val);
  const h_icon = generateSVG("health-icon");
  h_icon.removeAttribute("width");
  h_icon.removeAttribute("height");
  health.append(h_icon);
  // Armor row
  const armor = document.createElement("div");
  armor.classList.add("d-flex", "health-armor-bal");
  armor.style.height = "33%";
  const a_val = document.createElement("span");
  a_val.innerHTML = "0";
  a_val.id = "armor";
  armor.append(a_val);
  const a_icon = generateSVG("armor-icon");
  a_icon.removeAttribute("width");
  a_icon.removeAttribute("height");
  armor.append(a_icon);

  // Balance row
  const balance = document.createElement("div");
  balance.classList.add("d-flex", "health-armor-bal");
  balance.style.height = "33%";
  const b_val = document.createElement("span");
  b_val.innerHTML = "800";
  b_val.id = "balance";
  balance.append(b_val);
  const b_icon = generateSVG("dollar-icon");
  b_icon.removeAttribute("width");
  b_icon.removeAttribute("height");
  balance.append(b_icon);

  col3.append(health, armor, balance);
  div.append(col3);

  fitty(".player-name");

  return div;
}

export function generatePlayerHUD() {
  // Called initially to generate the HUD itself.
  const TeamAHUD = document.getElementById("teamAHUD");
  const TeamBHUD = document.getElementById("teamBHUD");

  // Add team title
  const teamATitle = document.createElement("div");
  teamATitle.classList.add("flex-fill", "title", "text-center");
  teamATitle.innerHTML = settings.teamA;
  TeamAHUD.append(teamATitle);

  // Add team title
  const teamBTitle = document.createElement("div");
  teamBTitle.classList.add("flex-fill", "title", "text-center");
  teamBTitle.innerHTML = settings.teamB;
  TeamBHUD.append(teamBTitle);

  teamAPlayers.forEach((player) => TeamAHUD.append(generateSinglePlayerHUD(player)));
  teamBPlayers.forEach((player) => TeamBHUD.append(generateSinglePlayerHUD(player)));

  // Add team Economy
  const teamAEcon = document.createElement("div");
  // teamAEcon.classList.add(["flex-fill", "economy", "text-align-center"]);
  teamAEcon.classList.add("flex-fill", "economy", "text-center");
  teamAEcon.innerHTML = "$14500";
  TeamAHUD.append(teamAEcon);

  // Add team Economy
  const teamBEcon = document.createElement("div");
  teamBEcon.classList.add("flex-fill", "economy", "text-center");
  teamBEcon.innerHTML = "$1800";
  TeamBHUD.append(teamBEcon);

  // fitty(".player-name");
}

const grenadeNames = ["Smoke Grenade", "High Explosive Grenade", "Molotov", "Flashbang", "Incendiary Grenade", "Decoy Grenade", "C4 Explosive"];

function updateGrenade(element, show) {
  const isVisible = element.style.display !== "none";
  if (show && !isVisible) setElementDisplayBlock(element);
  else if (!show && isVisible) setElementDisplayNone(element);
}

export function updatePlayerHUD() {
  // Get the HUD
  const TeamAHUD = document.getElementById("teamAHUD");
  const TeamBHUD = document.getElementById("teamBHUD");

  let currentTick = tickStore.currentDemoTick;
  let currentRound = tickStore.currentRound;

  // Check which team is on CT side:
  let teamAIsCT = isTeamAOnCTSide(currentRound.roundNumber);

  // Change HUD color if neccesary:
  TeamAHUD.style.backgroundColor = teamAIsCT ? "var(--ct-color)" : "var(--t-color)";
  TeamBHUD.style.backgroundColor = !teamAIsCT ? "var(--ct-color)" : "var(--t-color)";

  // Iterate through each player on team A:
  allPlayers.forEach((name) => {
    const playerHUD = document.getElementById("player-hud-" + name);
    const HUD_kills = playerHUD.querySelector("#kills");
    const HUD_deaths = playerHUD.querySelector("#deaths");
    const HUD_activeWeapon = playerHUD.querySelector("#weapon");
    const HUD_grenades = playerHUD.querySelector("#grenades");
    const HUD_health = playerHUD.querySelector("#health");
    const HUD_armor = playerHUD.querySelector("#armor");
    const HUD_balance = playerHUD.querySelector("#balance");
    const HUD_smoke = HUD_grenades.querySelector("#smoke");
    const HUD_incend = HUD_grenades.querySelector("#incend");
    const HUD_molotov = HUD_grenades.querySelector("#molotov");
    const HUD_he = HUD_grenades.querySelector("#he");
    const HUD_flash1 = HUD_grenades.querySelector("#flash1");
    const HUD_flash2 = HUD_grenades.querySelector("#flash2");
    const HUD_bomb = HUD_grenades.querySelector("#bomb");

    // First let's check if the player is alive since we only update cash when players are dead.
    // get death tick
    let deathTick = currentRound.deaths[name];
    deathTick = deathTick == undefined ? currentRound.officiallyEndedTick + 1 : deathTick;
    if (deathTick < currentTick) {
      // These things are updated SPECIFICALLY whne a plyer is DEAD and NOT ALIVE
      if (HUD_activeWeapon.innerHTML != "") {
        HUD_activeWeapon.innerHTML = "";
      }

      updateGrenade(HUD_smoke, false);
      updateGrenade(HUD_incend, false);
      updateGrenade(HUD_molotov, false);
      updateGrenade(HUD_he, false);
      updateGrenade(HUD_flash1, false);
      updateGrenade(HUD_flash2, false);
      updateGrenade(HUD_bomb, false);

      // Ensure health + armor is set to 0
      if (HUD_health.innerHTML != "0") {
        HUD_health.innerHTML = "0";
      }

      if (HUD_armor.innerHTML != "0") {
        HUD_armor.innerHTML = "0";
      }
    } else {
      // THESE things are updated SPECIFICALLY when a player is alive and NOT dead.

      // Inventory
      let invKeys = Object.keys(currentRound.inventories[name]).filter((t) => t < currentTick);
      let invKey = invKeys[invKeys.length - 1];
      let inventory = currentRound.inventories[name][invKey];
      if (inventory !== undefined) {
        const nades = inventory.filter((t) => grenadeNames.includes(t));
        const counts = {};
        for (const nade of nades) {
          counts[nade] = counts[nade] ? counts[nade] + 1 : 1;
        }
        // Next go throgh each grenade and we check if count[nade] == undefined. (zero) or 1-2 for flashes.
        const smoke = counts["Smoke Grenade"] ? 1 : 0;
        const incend = counts["Incendiary Grenade"] ? 1 : 0;
        const molotov = counts["Molotov"] ? 1 : 0;
        const he = counts["High Explosive Grenade"] ? 1 : 0;
        const flash = counts["Flashbang"] == 2 ? 2 : counts["Flashbang"] == 1 ? 1 : 0;
        const bomb = counts["C4 Explosive"] ? 1 : 0;

        updateGrenade(HUD_smoke, smoke);
        updateGrenade(HUD_incend, incend);
        updateGrenade(HUD_molotov, molotov);
        updateGrenade(HUD_he, he);
        updateGrenade(HUD_bomb, bomb);

        // For flashes:
        if (flash == 1) {
          updateGrenade(HUD_flash1, true);
          updateGrenade(HUD_flash2, false);
        } else if (flash == 2) {
          updateGrenade(HUD_flash1, true);
          updateGrenade(HUD_flash2, true);
        } else {
          updateGrenade(HUD_flash1, false);
          updateGrenade(HUD_flash2, false);
        }
      }

      // Active weapon
      let activeWeaponKeys = Object.keys(currentRound.activeWeapons[name]).filter((t) => t < currentTick);
      let activeWeaponkey = activeWeaponKeys[activeWeaponKeys.length - 1];
      let activeWeapon = currentRound.activeWeapons[name][activeWeaponkey];
      if (activeWeapon === undefined) {
        HUD_activeWeapon.innerHTML = "";
        HUD_activeWeapon.setAttribute("current", "none");
      } else if (HUD_activeWeapon.getAttribute("current") != activeWeapon) {
        HUD_activeWeapon.innerHTML = "";
        HUD_activeWeapon.setAttribute("current", activeWeapon);
        const weaponSVG = generateSVG(VANITY_TO_FILE[activeWeapon]);
        weaponSVG.classList.add("svg-scale-lock"); // Use shared scaling class
        weaponSVG.removeAttribute("width");
        weaponSVG.removeAttribute("height");
        HUD_activeWeapon.append(weaponSVG);
      }

      // Health
      let healthKeys = Object.keys(currentRound.healthValues[name]).filter((t) => t < currentTick);
      let healthKey = healthKeys[healthKeys.length - 1];
      let health = currentRound.healthValues[name][healthKey];
      if (HUD_health.innerHTML != health) {
        HUD_health.innerHTML = health;
      }

      // Armor
      let armorKeys = Object.keys(currentRound.armorValues[name]).filter((t) => t < currentTick);
      let armorKey = armorKeys[armorKeys.length - 1];
      let armor = currentRound.armorValues[name][armorKey];
      if (HUD_armor.innerHTML != armor) {
        HUD_armor.innerHTML = armor;
      }
    }

    // These things are updated regardless of whether the player is alive or dead! // I.e stats

    // Get scoreboard
    let scoreboardKeys = Object.keys(currentRound.roundScoreboard[name]).filter((t) => t < currentTick);
    let scoreboardKey = scoreboardKeys[scoreboardKeys.length - 1];
    let scoreboard = currentRound.roundScoreboard[name][scoreboardKey];
    if (scoreboard !== undefined) {
      if (HUD_kills.innerHTML != scoreboard.k) {
        HUD_kills.innerHTML = scoreboard.k;
      }
      if (HUD_deaths.innerHTML != scoreboard.d) {
        HUD_deaths.innerHTML = scoreboard.d;
      }
    }

    // Update cash balance
    let balanceKeys = Object.keys(currentRound.balanceValues[name]).filter((t) => t < currentTick);
    let balanceKey = balanceKeys[balanceKeys.length - 1];
    let balance = currentRound.balanceValues[name][balanceKey];
    if (HUD_balance.innerHTML != balance) {
      HUD_balance.innerHTML = balance;
    }

    // console.log(name + ", " + active_weapon);
    // Update the UI to reflect this. The inventory div in the UI will have a attribute "tickShown" and we can check this before updating it.
  });
}
