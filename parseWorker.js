import { parentPort, workerData } from "worker_threads";
import { parseGrenades } from "@laihoe/demoparser2";
import { processBasicTicks, debugTime } from "./js/backend.js";

if (workerData.task === "ticks") {
  console.log("Ticks - Started");
  const result = processBasicTicks(workerData.buffer, workerData.demoRoundEvents);
  parentPort.postMessage(result);
} else if (workerData.task === "grenades") {
  console.log("Nades - Started");
  const result = debugTime("parseGrenades", () => parseGrenades(workerData.buffer));
  parentPort.postMessage(result);
}
