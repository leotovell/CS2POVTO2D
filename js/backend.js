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
    processedEvents[e + "_events"] = events.filter((ev) => ev.event_name == e).map((ev) => ev.tick);
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
 * @returns {Object} An object where k=tick and v=an object containing player information
 */
export function processBasicTicks(demoBuffer) {
  // Get the demo ticks
  const ticks = debugTime("parseTicks", () => parseTicks(demoBuffer, ["X", "Y", "team_num", "yaw", "is_alive", "rotation"]));

  let processedTicks = {};
  debugTime("Processing Ticks", () => {
    ticks.forEach((data) => {
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

/**
 * Processes grenade events and returns an updated version of the ticks object containing grenade information in each tick where relevant.
 *
 * @author Leo Tovell
 *
 * @export
 * @param {Buffer} demoBuffer A `Buffer` of the demo file.
 * @param {Object} ticks The result of `processBasicTicks()` - an object where k=tick and v=information for that tick
 * @returns {Object} An updated version of `@param ticks` including a grenades object for each tick.
 */

// export function processGrenades(demoBuffer, ticks) {
//   const grenades = debugTime("parseGrenades", () => parseGrenades(demoBuffer));

//   debugTime("Processing grenades", () => {
//     grenades.forEach((nade) => {
//       if (nade.x != null && nade.y != null) {
//         if (!ticks[nade.tick]) {
//           ticks[nade.tick] = {
//             players: [],
//             grenades: [],
//           };
//         }

//         // Add to the current tick's grenade list
//         ticks[nade.tick].grenades.push({
//           id: nade.grenade_entity_id,
//           type: nade.grenade_type,
//           name: nade.name,
//           x: nade.x,
//           y: nade.y,
//           z: nade.z,
//         });
//       }
//     });
//   });

//   return ticks;
// }

export function processGrenades(grenades, ticks) {
  // const grenades = debugTime("parseGrenades", () => parseGrenades(demoBuffer));

  debugTime("Processing grenades", () => {
    grenades.forEach((nade) => {
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
