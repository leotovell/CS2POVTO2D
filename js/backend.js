import { parseHeader, parsePlayerInfo, parseEvents, parseEvent, listGameEvents, parseTicks, parseGrenades } from "@laihoe/demoparser2";

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

export function cleanDemoData(data) {
  const { round_start_events, round_freeze_end_events, round_end_events, round_officially_ended_events, tick_data } = data;

  console.log(`Initial round_start_events count: ${round_start_events.length}`);

  const updatedRoundStarts = [];
  let removedRanges = []; // {start, end, shift}
  let totalTickShift = 0;

  // Go through round_start_events and track duplicate rounds
  for (let i = 0; i < round_start_events.length; i++) {
    const current = round_start_events[i];
    const next = round_start_events[i + 1];

    if (next && current.round === next.round) {
      const removedTickCount = next.tick - current.tick;
      console.log(`Duplicate round ${current.round} detected at ticks ${current.tick} and ${next.tick} - removing earlier`);

      removedRanges.push({
        start: current.tick,
        end: next.tick,
        shift: removedTickCount,
      });

      // Move the next round back
      next.tick = current.tick;
      totalTickShift += removedTickCount;
      continue;
    }

    const adjustedTick = current.tick - totalTickShift;
    updatedRoundStarts.push({
      ...current,
      tick: adjustedTick,
    });
  }

  console.log(`Removed ranges:`, removedRanges);
  console.log(`Final round_start_events count: ${updatedRoundStarts.length}`);

  // Function to calculate adjusted tick
  function shiftTick(tick) {
    let totalShift = 0;
    for (const { start, end, shift } of removedRanges) {
      if (tick >= end) {
        totalShift += shift;
      }
    }
    return tick - totalShift;
  }

  // General event adjustment helper
  function adjustEvents(events, label) {
    const before = events.length;
    const filtered = events.filter((e) => !removedRanges.some(({ start, end }) => e.tick >= start && e.tick < end)).map((e) => ({ ...e, tick: shiftTick(e.tick) }));
    const after = filtered.length;

    console.log(`Adjusted ${label}: ${before} -> ${after}`);
    return filtered;
  }

  const adjustedFreezeEnds = adjustEvents(round_freeze_end_events, "freeze_end_events");
  const adjustedRoundEnds = adjustEvents(round_end_events, "round_end_events");
  const adjustedOfficialEnds = adjustEvents(round_officially_ended_events, "round_officially_ended_events");

  // Adjust tick data
  const adjustedTickData = {};
  let ticksRemoved = 0;
  let ticksKept = 0;
  for (const tickStr in tick_data) {
    const tick = parseInt(tickStr);
    const inRemoved = removedRanges.some(({ start, end }) => tick >= start && tick < end);
    if (inRemoved) {
      ticksRemoved++;
      continue;
    }

    const newTick = shiftTick(tick);
    adjustedTickData[newTick] = tick_data[tick];
    ticksKept++;
  }

  console.log(`Tick data: ${ticksRemoved} ticks removed, ${ticksKept} ticks kept`);

  return {
    round_start_events: updatedRoundStarts,
    round_freeze_end_events: adjustedFreezeEnds,
    round_end_events: adjustedRoundEnds,
    round_officially_ended_events: adjustedOfficialEnds,
    tick_data: adjustedTickData,
  };
}

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
  const ticks = debugTime("parseTicks", () => parseTicks(demoBuffer, ["X", "Y", "team_num", "yaw", "is_alive", "rotation", "inventory"]));

  const { round_start_events, round_freeze_end_events, round_end_events, round_officially_ended_events } = demoRoundEvents;

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

      const playerExists = processedTicks[data.tick].players.some((player) => player.name === data.name);
      if (!playerExists) {
        processedTicks[data.tick].players.push({
          name: data.name,
          X: data.X, // apply the coord transformation here
          Y: data.Y,
          yaw: data.yaw,
          team_num: data.team_num,
          alive: data.is_alive,
          has_c4: data.inventory.includes("C4 Explosive"),
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

    rounds.push({
      roundNumber,
      startTick,
      freezeEndTick,
      endTick,
      officiallyEndedTick: officiallyEndedTick !== Infinity ? officiallyEndedTick : endTick,
      isLastRound: officiallyEndedTick === Infinity,
      winner: endEvent?.winner,
      winReason: endEvent?.reason,
      ticks: roundTicks,
      beforeScoreA,
      beforeScoreB,
      afterScoreA: teamAScore,
      afterScoreB: teamBScore,
      events: [demoRoundEvents],
      teamASide, // optional if frontend needs this info too
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
        if (nade.tick >= round.start_tick && nade.tick <= round.end_tick) {
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
