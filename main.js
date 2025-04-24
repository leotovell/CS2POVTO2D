import { app, BrowserWindow, ipcMain, dialog, Menu, MenuItem } from "electron";
import * as nodePath from "node:path";
import { readFileSync, writeFile } from "node:fs";
import { readFile } from "node:fs/promises";
import { parseHeader, parsePlayerInfo, parseEvents, parseEvent, listGameEvents, parseTicks, parseGrenades } from "@laihoe/demoparser2";
import { debugTime, previewDemo, processBasicTicks, processEvents, processGrenades } from "./js/backend.js";
import { Worker } from "worker_threads";
import express from "express";
import { Readable } from "node:stream";
import bodyParser from "body-parser";

let mainWindow;
let currentMap = "de_mirage"; //placeholder
let demoFilePath;
let demoFileBuffer;
let isPreprocessed = false;

// global vars for demo data

let demoHeader;
let demoScoreboard;
let demoTicks;
let demoEvents;
let demoMapData;

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

// Set up HTTP server
const api = express();
api.use(bodyParser.json({ limit: "500mb" }));

api.get("/api/demo/process", async (req, res) => {
  console.log("here");
  res.setHeader("Content-Type", "application/json");

  let returnObj;

  if (demoFilePath.endsWith(".dem")) {
    const mapDataPath = nodePath.join(app.getAppPath(), "map-data", "map-data.json");
    let mapData = JSON.parse(readFileSync(mapDataPath, "utf-8"));
    let thisMapData = mapData[currentMap];
    const { round_start_events, round_freeze_end_events } = processEvents(demoFileBuffer, ["round_start", "round_freeze_end"]);

    let [processedTicks, grenades] = await Promise.all([runWorker("ticks", demoFileBuffer), runWorker("grenades", demoFileBuffer)]);

    // Add in grenades to the groupedTicks (runs AFTER the promise resolves)
    demoTicks = processGrenades(grenades, processedTicks);
    demoEvents = {
      roundStarts: round_start_events,
      freezeEnds: round_freeze_end_events,
    };
    demoMapData = thisMapData;

    returnObj = {
      ticks: demoTicks,
      // nades: grenades,
      roundStarts: round_start_events,
      freezeEnds: round_freeze_end_events,
      mapData: thisMapData,
      scoreboard: demoScoreboard,
    };

    console.log("Size:", Buffer.byteLength(JSON.stringify(returnObj), "uft-8"));

    // return returnObj;
  } else if (demoFilePath.endsWith(".json")) {
    returnObj = {
      ticks: demoTicks,
      roundStarts: demoEvents.roundStarts,
      freezeEnds: demoEvents.freezeEnds,
      mapData: demoMapData,
      scoreboard: demoScoreboard,
    };

    console.log("Size:", Buffer.byteLength(JSON.stringify(returnObj), "uft-8"));
    // return returnObj;
  }

  res.json(returnObj);
});

api.listen(3000, () => {
  console.log("API listening on port http://localhost:3000");
});

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
        { name: "Pre-processed Demos", extensions: ["json"] },
      ],
      title: "Choose Demo",
    });
    return result.filePaths;
  });

  ipcMain.handle("demo:preview", async (_, demoPath) => {
    console.log("Previewing demo:", demoPath);

    demoFilePath = demoPath;

    // Identify if its a .dem or .json
    if (demoPath.endsWith(".dem")) {
      // Read file into buffer.
      demoFileBuffer = readFileSync(demoPath);

      const { header, players } = previewDemo(demoFileBuffer);
      demoHeader = header;

      currentMap = header.map_name;

      // Let's get the score

      let game_phase_events = parseEvent(demoFileBuffer, "round_end", [], ["game_phase", "team_rounds_total", "team_clan_name"]);
      let end_event = game_phase_events.filter((e) => e.game_phase == 5);
      let teamAScore = end_event[0].t_team_rounds_total;
      let teamBScore = end_event[0].ct_team_rounds_total;
      let teamAName = end_event[0].t_team_clan_name;
      let teamBName = end_event[0].ct_team_clan_name;

      demoScoreboard = {
        teamAlpha: {
          name: teamAName,
          players: players.filter((player) => player.team_number == 2),
          score: teamAScore,
        },
        teamBeta: {
          name: teamBName,
          players: players.filter((player) => player.team_number == 3),
          score: teamBScore,
        },
      };
    } else if (demoPath.endsWith(".json")) {
      // Read it in
      try {
        const data = await readFile(demoPath, "utf-8");
        const importedDemo = JSON.parse(data);
        demoHeader = importedDemo.header;
        demoScoreboard = importedDemo.scoreboard;
        demoTicks = importedDemo.ticks;
        demoEvents = importedDemo.events;
        demoMapData = importedDemo.mapdata;
      } catch (err) {
        console.error("Error reading/parsing .json:", err);
      }
    }

    return {
      header: demoHeader,
      scoreboard: demoScoreboard,
    };
  });

  ipcMain.handle("demo:saveProcessedDemo", async () => {
    let fileName = demoFilePath.split("\\").slice(-1)[0];
    let fileNameWithoutExt = fileName.endsWith(".dem") ? fileName.slice(0, -4) : fileName;
    let processedDemoFilePath = nodePath.join("saved", fileNameWithoutExt + ".json");
    console.log("Saving demo here:", processedDemoFilePath);

    let processedDemo = {
      header: demoHeader,
      scoreboard: demoScoreboard,
      ticks: demoTicks,
      events: demoEvents,
      mapdata: demoMapData,
    };

    writeFile(processedDemoFilePath, JSON.stringify(processedDemo), "utf-8", (err) => {
      if (err) {
        console.error("Error writing:", processedDemoFilePath);
        console.error(err);
        return false;
      } else {
        console.log("Successfully wrote:", processedDemoFilePath);
        return true;
      }
    });
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
