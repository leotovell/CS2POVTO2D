import { app, BrowserWindow, ipcMain, dialog } from "electron";
import { parseHeader, parsePlayerInfo, parseEvents, parseEvent, listGameEvents, parseTicks, parseGrenades } from "@laihoe/demoparser2";
import path from "node:path";
import { readFileSync } from "node:fs";
let mainWindow;

let currentMap = "de_mirage"; //placeholder

function createWindow() {
    mainWindow = new BrowserWindow({
        webPreferences: {
            preload: path.join(path.resolve(), "preload.js"),
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
        const header = parseHeader(demoPath);
        const players = parsePlayerInfo(demoPath);
        const events = listGameEvents(demoPath);
        currentMap = header.map_name;

        // Let's get the score
        const roundEnds = parseEvents(demoPath, ["round_end"]);

        return {
            header: header,
            players: players,
            roundEnds: roundEnds,
            events: events,
        };
    });

    ipcMain.handle("demo:process", (_, path) => {
        console.log("Processing demo:", path);

        const mapDataPath = path.join(app.getAppPath(), "map-data", "map-data.json");
        let mapData = JSON.parse(readFileSync(mapDataPath, "utf-8"));
        let thisMapData = mapData[header.map_name];
        const ticks = parseTicks(path, ["X", "Y", "team_num", "yaw", "is_alive", "rotation"]);
        const grenades = parseGrenades(path);
        const roundStartEvents = parseEvents(path, ["round_start", "round_freeze_end"]);
        let roundStarts = roundStartEvents.filter((e) => e.event_name == "round_start").map((e) => e.tick);
        let freezeEnds = roundStartEvents.filter((e) => e.event_name == "round_freeze_end").map((e) => e.tick);

        // Combine ticks into 1 object so 1 tick has all required data.
        let groupedTicks = {};
        ticks.forEach((data) => {
            if (!groupedTicks[data.tick]) {
                groupedTicks[data.tick] = {
                    players: [],
                    grenades: [],
                    nadePaths: {},
                };
            }

            const playerExists = groupedTicks[data.tick].players.some((player) => player.name === data.name);

            if (!playerExists) {
                groupedTicks[data.tick].players.push({
                    name: data.name,
                    X: data.X,
                    Y: data.Y,
                    yaw: data.yaw,
                    team_num: data.team_num,
                    alive: data.is_alive,
                });
            }
        });

        grenades.forEach((nade) => {
            // console.log(nade.grenade_entity_id);
            if (nade.x != null && nade.y != null) {
                if (!groupedTicks[nade.tick]) {
                    groupedTicks[nade.tick] = {
                        players: [],
                        grenades: [],
                    };
                }

                // Add to the current tick's grenade list
                groupedTicks[nade.tick].grenades.push({
                    id: nade.grenade_entity_id,
                    type: nade.grenade_type,
                    name: nade.name,
                    x: nade.x,
                    y: nade.y,
                    z: nade.z,
                });
            }
        });

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

        return {
            ticks: groupedTicks,
            nades: grenades,
            roundStarts: roundStarts,
            freezeEnds: freezeEnds,
            mapData: thisMapData,
        };
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
