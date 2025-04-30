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

// export function cleanDemoData(data) {
//   const {
//     round_start_events,
//     round_freeze_end_events,
//     round_end_events,
//     round_officially_ended_events,
//     tick_data, // { [tick]: {...} }
//   } = data;

//   console.log("running");

//   // Step 1: Keep only last round_start for each round number
//   let lastRoundStarts = {};
//   for (let evt of round_start_events) {
//     lastRoundStarts[evt.round] = evt; // overwrite previous
//   }

//   const finalRoundStarts = Object.values(lastRoundStarts).sort((a, b) => a.tick - b.tick);

//   // Step 2: Create a map of removed ranges and how many ticks to subtract after each
//   let removedTicks = [];
//   let tickOffset = 0;
//   let adjustedRoundStarts = [];
//   let i = 0;

//   while (i < round_start_events.length) {
//     const thisRound = round_start_events[i];
//     const isLast = lastRoundStarts[thisRound.round] === thisRound;

//     if (isLast) {
//       thisRound.tick -= tickOffset;
//       adjustedRoundStarts.push(thisRound);
//       i++;
//     } else {
//       const nextRoundTick = round_start_events[i + 1]?.tick || adjustedRoundStarts.at(-1)?.tick || 0;
//       const gap = nextRoundTick - thisRound.tick;
//       removedTicks.push({ start: thisRound.tick, end: nextRoundTick, offset: gap });
//       tickOffset += gap;
//       i++;
//     }
//   }

//   // Step 3: Adjust ticks in event arrays and tick_data
//   const adjustTick = (tick) => {
//     let offset = 0;
//     for (let { start, end, offset: delta } of removedTicks) {
//       if (tick >= end) offset += delta;
//     }
//     return tick - offset;
//   };

//   function adjustEventArray(events) {
//     return events.map((evt) => ({ ...evt, tick: adjustTick(evt.tick) }));
//   }

//   // Adjust tick-based object keys
//   const adjustedTickData = {};
//   for (let tickStr in tick_data) {
//     const tick = parseInt(tickStr);
//     const newTick = adjustTick(tick);
//     adjustedTickData[newTick] = tick_data[tick];
//   }

//   // Deduplicate round_officially_ended_events by tick
//   const seenTicks = new Set();
//   const dedupedRoundOfficiallyEndedEvents = adjustEventArray(round_officially_ended_events).filter((evt) => {
//     if (seenTicks.has(evt.tick)) return false;
//     seenTicks.add(evt.tick);
//     return true;
//   });

//   return {
//     round_start_events: adjustedRoundStarts,
//     round_freeze_end_events: adjustEventArray(round_freeze_end_events),
//     round_end_events: adjustEventArray(round_end_events),
//     round_officially_ended_events: dedupedRoundOfficiallyEndedEvents,
//     tick_data: adjustedTickData,
//   };
// }

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

/**
 * Processes ticks and returns an object containing each tick and respective information.
 *
 * @author Leo Tovell
 *
 * @export
 * @param {Buffer} demoBuffer A `Buffer` of the demo file.
 * @param {Number} ticksToAdjust An amount of ticks to adjust all ticks after `omitEnd` by. Used when removing knife rounds.
 * @param {Number} omitStart The start of the range of ticks we are omitting. In this case, the two rounds after knife round before pistol.
 * @param {Number} omitEnd The end of the range of ticks we are omitting. Any ticks after this are adjusted by -`ticksToAdjust`
 * @returns {Object} An object where k=tick and v=an object containing player information
 */
export function processBasicTicks(demoBuffer, ticksToAdjust, omitStart, omitEnd) {
  // Get the demo ticks
  const ticks = debugTime("parseTicks", () => parseTicks(demoBuffer, ["X", "Y", "team_num", "yaw", "is_alive", "rotation"]));

  let processedTicks = {};
  debugTime("Processing Ticks", () => {
    ticks.forEach((data) => {
      // Is the tick in the range to be omitted?
      // if (data.tick >= omitStart && data.tick < omitEnd) return;
      // if (data.tick >= omitEnd) data.tick -= ticksToAdjust;
      if (!processedTicks[data.tick]) {
        processedTicks[data.tick] = {
          players: [],
          grenades: [],
        };
      }

      const playerExists = processedTicks[data.tick].players.some((player) => player.name === data.name);

      if (!playerExists) {
        processedTicks[data.tick].players.push({
          name: data.name,
          X: data.X,
          Y: data.Y,
          yaw: data.yaw,
          team_num: data.team_num,
          alive: data.is_alive,
        });
      }
    });
  });

  return processedTicks;
}

export function processGrenades(grenades, ticks, ticksToAdjust, omitStart, omitEnd) {
  // const grenades = debugTime("parseGrenades", () => parseGrenades(demoBuffer));

  debugTime("Processing grenades", () => {
    grenades.forEach((nade) => {
      // if (nade.tick >= omitStart && nade.tick < omitEnd) return;
      // if (nade.tick >= omitEnd) nade.tick -= ticksToAdjust;
      if (nade.x != null && nade.y != null) {
        if (!ticks[nade.tick]) {
          ticks[nade.tick] = {
            players: [],
            grenades: [],
          };
        }

        // Add to the current tick's grenade list
        ticks[nade.tick].grenades.push({
          id: nade.grenade_entity_id,
          type: nade.grenade_type,
          name: nade.name,
          x: nade.x,
          y: nade.y,
          z: nade.z,
        });
      }
    });
  });

  return ticks;
}
