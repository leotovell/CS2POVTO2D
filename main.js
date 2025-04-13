import { app, BrowserWindow, ipcMain, dialog } from "electron";
import * as nodePath from "node:path";
import { readFileSync } from "node:fs";
import { parseHeader, parsePlayerInfo, parseEvents, parseEvent, listGameEvents, parseTicks, parseGrenades } from "@laihoe/demoparser2";
import { debugTime, previewDemo, processBasicTicks, processEvents, processGrenades } from "./js/backend.js";
import { Worker } from "worker_threads";

let mainWindow;
let currentMap = "de_mirage"; //placeholder
let demoFilePath;
let demoFileBuffer;

function runWorker(task, buffer) {
  return new Promise((resolve, reject) => {
    const worker = new Worker("./parseWorker.js", {
      workerData: { task, buffer },
    });

    worker.on("message", resolve);
    worker.on("error", reject),
      worker.on("exit", (code) => {
        if (code !== 0) reject(new Error("Worker stopped with exit code:", code));
      });
  });
}

function createWindow() {
  mainWindow = new BrowserWindow({
    webPreferences: {
      preload: nodePath.join(nodePath.resolve(), "preload.js"),
      contextIsolation: true,
      nodeIntegration: false,
      enableBlinkFeatures: "none",
    },
  });
  mainWindow.loadFile("index.html");
}

app.whenReady().then(() => {
  ipcMain.handle("dialog:openFile", async () => {
    const result = await dialog.showOpenDialog(mainWindow, {
      properties: ["openFile"],
      filters: [
        {
          name: "Demo File",
          extensions: ["dem"],
        },
      ],
      title: "Choose Demo",
    });
    return result.filePaths;
  });

  ipcMain.handle("demo:preview", (_, demoPath) => {
    console.log("Previewing demo:", demoPath);

    // Read file into buffer.
    demoFileBuffer = readFileSync(demoPath);
    demoFilePath = demoPath;

    const { header, players, events, roundEnds } = previewDemo(demoFileBuffer);

    currentMap = header.map_name;

    // Let's get the score

    return {
      header: header,
      players: players,
      roundEnds: roundEnds,
      events: events,
    };
  });

  ipcMain.handle("demo:process", async () => {
    console.log("Processing demo:", demoFilePath);

    const mapDataPath = nodePath.join(app.getAppPath(), "map-data", "map-data.json");
    let mapData = JSON.parse(readFileSync(mapDataPath, "utf-8"));
    let thisMapData = mapData[currentMap];
    const { round_start_events, round_freeze_end_events } = processEvents(demoFileBuffer, ["round_start", "round_freeze_end"]);

    // let [groupedTicks, grenades] = await Promise.all([
    //   new Promise((resolve) => {
    //     console.log("Processing Ticks!");
    //     const ticks = processBasicTicks(demoFileBuffer);
    //     resolve(ticks);
    //   }),
    //   new Promise((resolve) => {
    //     console.log("Processing Nades!");
    //     const grenades = debugTime("parseGrenades", () => parseGrenades(demoFileBuffer));
    //     resolve(grenades);
    //   }),
    // ]);

    let [groupedTicks, grenades] = await Promise.all([runWorker("ticks", demoFileBuffer), runWorker("grenades", demoFileBuffer)]);

    // Combine ticks into 1 object so 1 tick has all required data.
    // let groupedTicks = processBasicTicks(demoFileBuffer);

    // groupedTicks = processGrenades(demoFileBuffer, groupedTicks);
    groupedTicks = processGrenades(grenades, groupedTicks);

    // grenades.forEach((nade) => {
    //   if (nade.x != null && nade.y != null) {
    //     if (!groupedTicks[nade.tick]) {
    //       groupedTicks[nade.tick] = {
    //         players: [],
    //         grenades: [],
    //       };
    //     }

    //     // Add to the current tick's grenade list
    //     groupedTicks[nade.tick].grenades.push({
    //       id: nade.grenade_entity_id,
    //       type: nade.grenade_type,
    //       name: nade.name,
    //       x: nade.x,
    //       y: nade.y,
    //       z: nade.z,
    //     });
    //   }
    // });

    // let nadeFlightPaths = {};

    // Object.entries(groupedTicks).forEach(([tickNum, tick]) => {
    //   // Let's go through each nade and compile the flightPaths
    //   const nades = tick.grenades;
    //   // console.log(nades);
    //   nades.forEach((nade) => {
    //     if (!nadeFlightPaths[nade.id]) {
    //       nadeFlightPaths[nade.id] = {
    //         path: {},
    //         detonation_tick: null,
    //         expire_tick: null,
    //       };
    //     }

    //     nadeFlightPaths[nade.id].path[tickNum] = [nade.x, nade.y];
    //   });
    // });

    // // console.log(nadeFlightPaths);

    // grenadeActivations.forEach((event) => {
    //   const nade = nadeFlightPaths[event.entityid];
    //   if (!nade) {
    //     console.log("ERROR NO NADE");
    //     // console.log(event);
    //   }

    //   switch (event.event_name) {
    //     case "smokegrenade_detonate":
    //     case "flashbang_detonate":
    //     case "decoy_detonate":
    //     case "hegrenade_detonate":
    //     case "inferno_startburn":
    //       nade.detonation_tick = event.tick;
    //       break;

    //     case "smokegrenade_expired":
    //     case "inferno_expire":
    //       nade.expire_tick = event.tick;
    //       break;
    //   }
    // });

    // Attach detonation/expiration events to nade paths
    // grenadeActivations.forEach((event) => {
    //   const nade = nadePathsById[event.entityid];
    //   if (!nade) return;

    //   switch (event.event_name) {
    //     case "smokegrenade_detonate":
    //     case "flashbang_detonate":
    //     case "decoy_detonate":
    //     case "hegrenade_detonate":
    //     case "inferno_startburn":
    //       nade.detonateTick = event.tick;
    //       break;

    //     case "smokegrenade_expired":
    //     case "inferno_expire":
    //       nade.expireTick = event.tick;
    //       break;
    //   }
    // });

    const returnObj = {
      ticks: groupedTicks,
      // nades: grenades,
      roundStarts: round_start_events,
      freezeEnds: round_freeze_end_events,
      mapData: thisMapData,
    };

    console.log("Size:", Buffer.byteLength(JSON.stringify(returnObj), "uft-8"));

    return returnObj;
  });

  console.log("Initialising Window...");

  createWindow();

  app.on("activate", function () {
    if (BrowserWindow.getAllWindows().length === 0) createWindow();
  });
});

app.on("window-all-closed", function () {
  if (process.platform !== "darwin") app.quit();
});
