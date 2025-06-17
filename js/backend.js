import { parseHeader, parsePlayerInfo, parseEvents, parseEvent, listGameEvents, parseTicks, parseGrenades, parsePlayerSkins } from "@laihoe/demoparser2";

const DEBUG = true;

export function debugTime(label, fn) {
  if (!DEBUG) return fn();

  const start = performance.now();
  const result = fn();
  const end = performance.now();
  console.log(`${label} completed in ${Math.round(end - start)}ms`);
  return result;
}

/**
 * Returns an object containing information required to preview a demo.
 *
 * @author Leo Tovell
 *
 * @export
 * @param {Buffer} demoBuffer A `Buffer` of the demo file.
 */
export function previewDemo(demoBuffer) {
  const header = debugTime("parseHeader", () => parseHeader(demoBuffer));
  const players = debugTime("parsePlayerInfo", () => parsePlayerInfo(demoBuffer));

  return {
    header,
    players,
  };
}

// export function cleanDemoData(data) {
//   const { round_start_events, round_freeze_end_events, round_end_events, round_officially_ended_events, tick_data } = data;

//   console.log(`Initial round_start_events count: ${round_start_events.length}`);

//   const updatedRoundStarts = [];
//   let removedRanges = []; // {start, end, shift}
//   let totalTickShift = 0;

//   // Go through round_start_events and track duplicate rounds
//   for (let i = 0; i < round_start_events.length; i++) {
//     const current = round_start_events[i];
//     const next = round_start_events[i + 1];

//     if (next && current.round === next.round) {
//       const removedTickCount = next.tick - current.tick;
//       console.log(`Duplicate round ${current.round} detected at ticks ${current.tick} and ${next.tick} - removing earlier`);

//       removedRanges.push({
//         start: current.tick,
//         end: next.tick,
//         shift: removedTickCount,
//       });

//       // Move the next round back
//       next.tick = current.tick;
//       totalTickShift += removedTickCount;
//       continue;
//     }

//     const adjustedTick = current.tick - totalTickShift;
//     updatedRoundStarts.push({
//       ...current,
//       tick: adjustedTick,
//     });
//   }

//   console.log(`Removed ranges:`, removedRanges);
//   console.log(`Final round_start_events count: ${updatedRoundStarts.length}`);

//   // Function to calculate adjusted tick
//   function shiftTick(tick) {
//     let totalShift = 0;
//     for (const { start, end, shift } of removedRanges) {
//       if (tick >= end) {
//         totalShift += shift;
//       }
//     }
//     return tick - totalShift;
//   }

//   // General event adjustment helper
//   function adjustEvents(events, label) {
//     const before = events.length;
//     const filtered = events.filter((e) => !removedRanges.some(({ start, end }) => e.tick >= start && e.tick < end)).map((e) => ({ ...e, tick: shiftTick(e.tick) }));
//     const after = filtered.length;

//     console.log(`Adjusted ${label}: ${before} -> ${after}`);
//     return filtered;
//   }

//   const adjustedFreezeEnds = adjustEvents(round_freeze_end_events, "freeze_end_events");
//   const adjustedRoundEnds = adjustEvents(round_end_events, "round_end_events");
//   const adjustedOfficialEnds = adjustEvents(round_officially_ended_events, "round_officially_ended_events");

//   // Adjust tick data
//   const adjustedTickData = {};
//   let ticksRemoved = 0;
//   let ticksKept = 0;
//   for (const tickStr in tick_data) {
//     const tick = parseInt(tickStr);
//     const inRemoved = removedRanges.some(({ start, end }) => tick >= start && tick < end);
//     if (inRemoved) {
//       ticksRemoved++;
//       continue;
//     }

//     const newTick = shiftTick(tick);
//     adjustedTickData[newTick] = tick_data[tick];
//     ticksKept++;
//   }

//   console.log(`Tick data: ${ticksRemoved} ticks removed, ${ticksKept} ticks kept`);

//   return {
//     round_start_events: updatedRoundStarts,
//     round_freeze_end_events: adjustedFreezeEnds,
//     round_end_events: adjustedRoundEnds,
//     round_officially_ended_events: adjustedOfficialEnds,
//     tick_data: adjustedTickData,
//   };
// }

/**
 * A handy helper function to get a list of events from the demo (always more efficient than individual calls to `parseEvent()`)
 * @author Leo Tovell
 *
 * @export
 * @param {Buffer} demoBuffer A `Buffer` of the demo file.
 * @param {String[]} wanted_events A
 * @returns {Object} A deconstructed object of `wanted_events` where each event has `_events` appended to the end. For example `round_start` becomes `round_start_events` and is a list of ticks when `round_start` occurs.
 * @likely-to-deprecate-soon Likely will be replaced soon as it has limited functionality
 */
export function processEvents(demoBuffer, wanted_events) {
  const events = debugTime("parseEvents", () => parseEvents(demoBuffer, wanted_events));
  const processedEvents = {};
  for (const e of wanted_events) {
    // processedEvents[e + "_events"] = events.filter((ev) => ev.event_name == e).map((ev) => ev.tick);
    processedEvents[e + "_events"] = events.filter((ev) => ev.event_name == e);
  }
  return { ...processedEvents };
}

export function processBasicTicks(demoBuffer, demoRoundEvents) {
  // Get all weapons

  const ticks = debugTime("parseTicks", () => parseTicks(demoBuffer, ["X", "Y", "Z", "team_num", "yaw", "is_alive", "rotation", "inventory", "active_weapon_name", "balance", "armor_value", "health", "life_state"]));

  const { round_start_events, round_freeze_end_events, round_end_events, round_officially_ended_events, bomb_dropped_events, bomb_planted_events, bomb_defused_events, bomb_begindefuse_events, player_death_events, scoreboards } = demoRoundEvents;

  // Inventories
  let inventories = {};
  let activeWeapons = {};
  let armorValues = {};
  let balanceValues = {};
  let healthValues = {};

  // Create a map of tick -> { players, grenades }
  const processedTicks = {};
  debugTime("Processing Ticks", () => {
    ticks.forEach((data) => {
      if (!processedTicks[data.tick]) {
        processedTicks[data.tick] = {
          players: [],
          grenades: [],
          demoTick: data.tick,
        };
      }

      if (!inventories[data.tick]) {
        inventories[data.tick] = [];
      }

      if (!activeWeapons[data.tick]) {
        activeWeapons[data.tick] = [];
      }

      if (!armorValues[data.tick]) {
        armorValues[data.tick] = [];
      }

      if (!balanceValues[data.tick]) {
        balanceValues[data.tick] = [];
      }

      if (!healthValues[data.tick]) {
        healthValues[data.tick] = [];
      }

      const playerExists = processedTicks[data.tick].players.some((player) => player.name === data.name);
      if (!playerExists) {
        processedTicks[data.tick].players.push({
          name: data.name,
          X: data.X, // apply the coord transformation here
          Y: data.Y,
          Z: data.Z,
          yaw: data.yaw,
          team_num: data.team_num,
          alive: data.is_alive,
          has_c4: data.inventory.includes("C4 Explosive"),
          state: data.life_state,
        });

        // Add inventory entry
        if (data.is_alive) {
          inventories[data.tick].push({
            name: data.name,
            inventory: data.inventory,
          });
          activeWeapons[data.tick].push({
            name: data.name,
            weapon: data.active_weapon_name,
          });
          armorValues[data.tick].push({
            name: data.name,
            armor: data.armor_value,
          });
          healthValues[data.tick].push({
            name: data.name,
            health: data.health,
          });
        }
        // Balance may change when dead so add all the time.
        balanceValues[data.tick].push({
          name: data.name,
          balance: data.balance,
        });
      }
    });
  });

  // Step 1: Build structured round array
  const rounds = [];

  let teamAScore = 0;
  let teamBScore = 0;

  for (let i = 0; i < round_start_events.length; i++) {
    const thisRoundNum = round_start_events[i].round;
    const nextRoundNum = round_start_events[i + 1]?.round ?? -1;
    if (thisRoundNum == nextRoundNum) continue;

    const roundNumber = rounds.length + 1;

    const startEvent = round_start_events[i];
    const startTick = startEvent?.tick;
    const freezeEndTick = round_freeze_end_events.filter((ev) => ev.tick > startTick).sort((a, b) => a.tick - b.tick)[0].tick;

    const endEvent = round_end_events.filter((ev) => ev.tick > startTick).sort((a, b) => a.tick - b.tick)[0];
    const endTick = endEvent?.tick;
    const officiallyEndedTick = round_officially_ended_events.filter((ev) => ev.tick > endTick).sort((a, b) => a.tick - b.tick)[0]?.tick ?? Infinity;

    const roundTicks = {};

    const isLastRound = officiallyEndedTick === Infinity;

    if (Number.isFinite(officiallyEndedTick)) {
      for (let tick = startTick; tick <= officiallyEndedTick; tick++) {
        if (processedTicks[tick]) {
          roundTicks[tick] = processedTicks[tick];
        }
      }
    } else {
      const allTicks = Object.keys(processedTicks)
        .map(Number)
        .filter((t) => t >= startTick)
        .sort((a, b) => a - b);
      for (const tick of allTicks) {
        roundTicks[tick] = processedTicks[tick];
      }
    }

    // Determine what side Team A is on
    let teamASide;
    if (roundNumber <= 12) {
      teamASide = "CT";
    } else if (roundNumber <= 24) {
      teamASide = "T";
    } else {
      // Overtime logic — each OT half is 3 rounds, swap each half
      const otIndex = roundNumber - 25; // round 25 is first OT round
      const otHalf = Math.floor(otIndex / 3);
      const inHalf = otIndex % 6 < 3; // true for first half of each OT

      if (otHalf % 2 === 0) {
        // OT 1, OT 3, etc.
        teamASide = inHalf ? "T" : "CT";
      } else {
        // OT 2, OT 4, etc.
        teamASide = inHalf ? "CT" : "T";
      }
    }

    const beforeScoreA = teamAScore;
    const beforeScoreB = teamBScore;

    // Increment correct team score
    if (endEvent?.winner === teamASide) {
      teamAScore++;
    } else if (endEvent?.winner === "T" || endEvent?.winner === "CT") {
      teamBScore++;
    }

    // Events for the timeline - kills, freeze_end, bomb_plants, bomb_defuse, bomb_explode (win-conditions)
    let eventsForTimeline = [];
    // Freeze_end
    eventsForTimeline.push({
      tick: freezeEndTick,
      event: "freeze_end",
    });

    // Scoreboard
    let roundScoreboard = {};
    scoreboards
      .filter((ev) => ev.tick == startTick)
      .forEach((ev) => {
        if (!roundScoreboard[ev.name]) roundScoreboard[ev.name] = {};

        roundScoreboard[ev.name][ev.tick] = {
          k: ev.kills_total,
          a: ev.assists_total,
          d: ev.deaths_total,
        };
      });

    // Kills
    player_death_events.forEach((ev) => {
      if (ev.tick > startTick && ev.tick < officiallyEndedTick) {
        eventsForTimeline.push({
          tick: ev.tick,
          event: "kill",
          attacker: ev.attacker_name,
          died: ev.user_name,
        });
      }
    });

    // Win Conditions
    eventsForTimeline.push({
      tick: endTick,
      event: "round_won",
      winner: endEvent.winner,
      reason: endEvent.reason,
    });

    let deaths = {};

    // Filter the player_death events to only keep the info we want.
    const filtered_player_death_events = [];
    player_death_events.forEach((ev) => {
      if (ev.tick > startTick && ev.tick < officiallyEndedTick) {
        const event = {};

        event.tick = ev.tick;

        event.assisted = ev.assister_name != null ? true : false;
        if (event.assisted) event.assistType = ev.assistedflash == true ? "flash" : "damage";
        if (event.assisted) event.assistedBy = ev.assister_name;

        event.attacker = ev.attacker_name;
        event.attackerProps = [];
        if (ev.attackerblind) event.attackerProps.push("blind");
        if (ev.attackerinair) event.attackerProps.push("jumping");
        if (ev.headshot) event.attackerProps.push("hs");
        if (ev.noscope) event.attackerProps.push("noscope");
        if (ev.penetrated > 0) event.attackerProps.push("wallbang");
        if (ev.thrusmoke) event.attackerProps.push("smoke");

        event.player = ev.user_name;
        event.weapon = ev.weapon;

        deaths[ev.user_name] = ev.tick;

        if (event.weapon == "world" && isLastRound && event.tick > officiallyEndedTick) {
          // Ignore
        } else {
          filtered_player_death_events.push(event);
          // Update killers scoreboard +1 kill
          // Update scoreboard get the most recent scoreboard then update the values
          let lastScoreboardKeys = Object.keys(roundScoreboard[event.attacker]).filter((t) => t < event.tick);
          let lastScoreboardKey = lastScoreboardKeys[lastScoreboardKeys.length - 1];
          let lastScoreboard = roundScoreboard[event.attacker][lastScoreboardKey];

          let k = lastScoreboard.k + 1;
          let a = lastScoreboard.a;
          let d = lastScoreboard.d;

          roundScoreboard[event.attacker][event.tick] = {
            k,
            a,
            d,
          };

          // Was there an assister?
          if (event.assisted) {
            // console.log(event);
            if (event.assistType == "damage") {
              let lastScoreboardKeys = Object.keys(roundScoreboard[event.assistedBy]).filter((t) => t < event.tick);
              let lastScoreboardKey = lastScoreboardKeys[lastScoreboardKeys.length - 1];
              let lastScoreboard = roundScoreboard[event.assistedBy][lastScoreboardKey];

              let k = lastScoreboard.k;
              let a = lastScoreboard.a + 1;
              let d = lastScoreboard.d;

              roundScoreboard[event.assistedBy][event.tick] = {
                k,
                a,
                d,
              };
            }
          }

          // Update victims scoreboard +1 death
          lastScoreboardKeys = Object.keys(roundScoreboard[event.player]).filter((t) => t < event.tick);
          lastScoreboardKey = lastScoreboardKeys[lastScoreboardKeys.length - 1];
          lastScoreboard = roundScoreboard[event.player][lastScoreboardKey];

          k = lastScoreboard.k;
          a = lastScoreboard.a;
          d = lastScoreboard.d + 1;

          roundScoreboard[event.player][event.tick] = {
            k,
            a,
            d,
          };
        }
      }
    });

    // Active weapons

    let roundInventoryChanges = {};
    let lastInventories = {}; // Track last inventory per player

    Object.keys(roundTicks).forEach((tick) => {
      const tickNum = Number(tick);
      const tickInventories = inventories[tickNum];

      if (!tickInventories) return;

      tickInventories.forEach(({ name, inventory }) => {
        // Convert inventory to a string for easier comparison (or use JSON.stringify)
        const invString = inventory.join(",");

        // Compare with last known inventory
        if (!lastInventories[name] || lastInventories[name] !== invString) {
          // Inventory changed
          if (!roundInventoryChanges[name]) {
            roundInventoryChanges[name] = {};
          }
          roundInventoryChanges[name][tick] = inventory;
          lastInventories[name] = invString;
        }
      });
    });

    let roundActiveWeaponChanges = {};
    let lastWeaponChange = {}; // Track last active weapon per player

    Object.keys(roundTicks).forEach((tick) => {
      const tickNum = Number(tick);
      const tickWeapons = activeWeapons[tickNum];

      if (!tickWeapons) return;

      tickWeapons.forEach(({ name, weapon }) => {
        // Compare with last known active weapon
        if (!lastWeaponChange[name] || lastWeaponChange[name] !== weapon) {
          // Weapon changed
          if (!roundActiveWeaponChanges[name]) {
            roundActiveWeaponChanges[name] = {};
          }
          roundActiveWeaponChanges[name][tick] = weapon;
          lastWeaponChange[name] = weapon;
        }
      });
    });

    let roundBalanceChanges = {};
    let lastBalanceChange = {}; // Track last active weapon per player

    Object.keys(roundTicks).forEach((tick) => {
      const tickNum = Number(tick);
      const tickBalances = balanceValues[tickNum];

      if (!tickBalances) return;

      tickBalances.forEach(({ name, balance }) => {
        // Compare with last known balance
        if (!(name in lastBalanceChange) || lastBalanceChange[name] !== balance) {
          // balance changed
          if (!roundBalanceChanges[name]) {
            roundBalanceChanges[name] = {};
          }
          roundBalanceChanges[name][tick] = balance;
          lastBalanceChange[name] = balance;
        }
      });
    });

    let roundArmorChanges = {};
    let lastArmorChange = {}; // Track last active weapon per player

    Object.keys(roundTicks).forEach((tick) => {
      const tickNum = Number(tick);
      const tickArmor = armorValues[tickNum];

      if (!tickArmor) return;

      tickArmor.forEach(({ name, armor }) => {
        // Compare with last known active weapon
        if (!(name in lastArmorChange) || lastArmorChange[name] !== armor) {
          // Weapon changed
          if (!roundArmorChanges[name]) {
            roundArmorChanges[name] = {};
          }
          roundArmorChanges[name][tick] = armor;
          lastArmorChange[name] = armor;
        }
      });
    });

    let roundHealthChanges = {};
    let lastHealthChange = {}; // Track last active weapon per player

    Object.keys(roundTicks).forEach((tick) => {
      const tickNum = Number(tick);
      const tickHealth = healthValues[tickNum];

      if (!tickHealth) return;

      tickHealth.forEach(({ name, health }) => {
        // Compare with last known active weapon
        if (!(name in lastHealthChange) || lastHealthChange[name] !== health) {
          // Weapon changed
          if (!roundHealthChanges[name]) {
            roundHealthChanges[name] = {};
          }
          roundHealthChanges[name][tick] = health;
          lastHealthChange[name] = health;
        }
      });
    });

    // Filter Inventory

    rounds.push({
      roundNumber,
      startTick,
      freezeEndTick,
      endTick,
      officiallyEndedTick: officiallyEndedTick !== Infinity ? officiallyEndedTick : endTick,
      isLastRound,
      winner: endEvent?.winner,
      winReason: endEvent?.reason,
      ticks: roundTicks,
      beforeScoreA,
      beforeScoreB,
      afterScoreA: teamAScore,
      afterScoreB: teamBScore,
      events: [demoRoundEvents],
      timelineEvents: eventsForTimeline,
      kills: filtered_player_death_events,
      teamASide, // optional if frontend needs this info too
      length: (officiallyEndedTick !== Infinity ? officiallyEndedTick : endTick) - startTick,
      inventories: roundInventoryChanges,
      activeWeapons: roundActiveWeaponChanges,
      armorValues: roundArmorChanges,
      balanceValues: roundBalanceChanges,
      roundScoreboard,
      healthValues: roundHealthChanges,
      deaths,
    });
  }

  return rounds;
}

export function processGrenades(grenades, rounds) {
  debugTime("Processing grenades", () => {
    grenades.forEach((nade) => {
      if (nade.x == null || nade.y == null) return;

      // Find the round that contains this tick
      for (const round of rounds) {
        if (nade.tick >= round.startTick && nade.tick <= round.officiallyEndedTick) {
          // Ensure the tick exists in this round (you only stored populated ticks)
          const tickData = round.ticks[nade.tick];
          if (tickData) {
            tickData.grenades.push({
              id: nade.grenade_entity_id,
              type: nade.grenade_type,
              name: nade.name,
              x: nade.x,
              y: nade.y,
              z: nade.z,
            });
          }
          break; // Once matched, stop searching
        }
      }
    });
  });

  return rounds;
}
