// write the UI updating stuff here (NOT THE CANVAS UPDATES);

import { settings, settingsToConfigure } from "../renderer.js";

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

export function setupMultiRoundsPanel(element, rounds) {
  // rounds is a list of freezeEnds
  let roundCount = 0;
  rounds.forEach((round) => {
    roundCount++;
    const roundListItem = document.createElement("li");
    roundListItem.className = "list-group-item d-flex align-items-center";

    const roundCheckbox = document.createElement("input");
    roundCheckbox.type = "checkbox";
    roundCheckbox.className = "form-check-input me-2";
    roundCheckbox.id = "round_" + roundCount;
    roundCheckbox.checked = true;

    const roundLabel = document.createElement("label");
    roundLabel.className = "form-check-label";
    roundLabel.setAttribute("for", "round_" + roundCount);
    roundLabel.innerHTML = "Round " + roundCount;

    roundListItem.append(roundCheckbox);
    roundListItem.append(roundLabel);

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
    console.log("setting_" + setting.name);
    const element = document.getElementById("setting_" + setting.name);
    if (setting.type == "checkbox") {
      // Set to default
      element.checked = setting.defaultValue;

      // Add listener
      element.addEventListener("change", () => {
        settings[setting.name] = element.checked;
        console.log(settings);
      });
    }
  });
}
