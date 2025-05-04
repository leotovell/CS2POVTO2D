// write the UI updating stuff here (NOT THE CANVAS UPDATES);

import { settings, settingsToConfigure, tickStore } from "../renderer.js";
// import bombSVG from "../img/logo/bomb.svg";

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

export function disableElement(element) {
  element.disabled = true;
}

export function enableElement(element) {
  element.disabled = false;
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

    console.log(round.winReason);

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

    switch (round.winReason) {
      case "bomb_defused":
        fetch("./img/logo/bomb_defused.svg")
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
        break;
      case "bomb_exploded":
        fetch("./img/logo/bomb.svg")
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
        break;
      case "t_killed":
      case "ct_killed":
        fetch("./img/logo/killed.svg")
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
        break;
      case "time_ran_out":
        fetch("./img/logo/time_ran_out.svg")
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
        break;
      default:
        break;
    }

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
