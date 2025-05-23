import { app, BrowserWindow, ipcMain, dialog, Menu, MenuItem } from "electron";
import * as nodePath from "node:path";
import { readFileSync, writeFile } from "node:fs";
import { readFile } from "node:fs/promises";
import { parseHeader, parsePlayerInfo, parseEvents, parseEvent, listGameEvents, parseTicks, parseGrenades } from "@laihoe/demoparser2";
import { cleanDemoData, debugTime, previewDemo, processBasicTicks, processEvents, processGrenades } from "./js/backend.js";
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
let demoRounds;
let demoMapData;

function runWorker(task, buffer, demoRoundEvents) {
  return new Promise((resolve, reject) => {
    const worker = new Worker("./parseWorker.js", {
      workerData: { task, buffer, demoRoundEvents },
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
  res.setHeader("Content-Type", "application/json");

  let returnObj;

  if (demoFilePath.endsWith(".dem")) {
    const mapDataPath = nodePath.join(app.getAppPath(), "map-data", "map-data.json");
    let mapData = JSON.parse(readFileSync(mapDataPath, "utf-8"));
    let thisMapData = mapData[currentMap];
    let { round_start_events, round_freeze_end_events, round_end_events, round_officially_ended_events, is_bomb_planted_events, is_bomb_dropped_events } = processEvents(demoFileBuffer, [
      "round_start",
      "round_freeze_end",
      "round_end",
      "round_officially_ended",
      "is_bomb_dropped",
      "is_bomb_planted",
    ]);

    console.log(is_bomb_dropped_events);
    console.log(is_bomb_planted_events);

    const demoRoundEvents = {
      round_start_events,
      round_freeze_end_events,
      round_end_events,
      round_officially_ended_events,
      is_bomb_dropped_events,
      is_bomb_planted_events,
    };

    // Work out how many ticks to adjust by, and from what ticks onwards do we begin adjusting. This is to negate the knife round delay...

    let [rounds, grenades] = await Promise.all([runWorker("ticks", demoFileBuffer, demoRoundEvents), runWorker("grenades", demoFileBuffer)]);
    // Add in grenades to the groupedTicks (runs AFTER the promise resolves)
    rounds = processGrenades(grenades, rounds);

    demoMapData = thisMapData;
    demoRounds = rounds;

    returnObj = {
      rounds: demoRounds,
      mapData: thisMapData,
      scoreboard: demoScoreboard,
    };

    console.log("Size:", Buffer.byteLength(JSON.stringify(returnObj), "uft-8"));

    // return returnObj;
  } else if (demoFilePath.endsWith(".json")) {
    returnObj = {
      rounds: demoRounds,
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
    },
  });
  mainWindow.loadFile("index.new.html");
}

app.whenReady().then(() => {
  ipcMain.handle("dialog:openFile", async () => {
    const result = await dialog.showOpenDialog(mainWindow, {
      properties: ["openFile"],
      filters: [
        {
          name: "Demo File",
          extensions: ["dem", "json"],
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
        // demoTicks = importedDemo.ticks;
        // demoEvents = importedDemo.events;
        demoMapData = importedDemo.mapdata;
        demoRounds = importedDemo.rounds;
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
    // Platform specific
    let fileName = nodePath.basename(demoFilePath);
    let fileNameWithoutExt = fileName.endsWith(".dem") ? fileName.slice(0, -4) : fileName;
    let processedDemoFilePath = nodePath.join("saved", fileNameWithoutExt + ".json");
    console.log("Saving demo here:", processedDemoFilePath);

    let processedDemo = {
      header: demoHeader,
      scoreboard: demoScoreboard,
      rounds: demoRounds,
      mapdata: demoMapData,
    };

    return new Promise((resolve) => {
      writeFile(processedDemoFilePath, JSON.stringify(processedDemo), "utf-8", (err) => {
        if (err) {
          console.error("Error writing:", processedDemoFilePath);
          console.error(err);
          resolve(false);
        } else {
          console.log("Successfully wrote:", processedDemoFilePath);
          resolve(true);
        }
      });
    });
  });

  console.log("Initialising Window...");

  createWindow();
  mainWindow.maximize();

  app.on("activate", function () {
    if (BrowserWindow.getAllWindows().length === 0) createWindow();
  });
});

app.on("window-all-closed", function () {
  if (process.platform !== "darwin") app.quit();
});
