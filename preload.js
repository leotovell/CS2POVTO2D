const { contextBridge, ipcRenderer } = require("electron/renderer");

// import { contextBridge, ipcRenderer } from "electron/renderer";

contextBridge.exposeInMainWorld("electron", {
  openFileDialog: () => ipcRenderer.invoke("dialog:openFile"),
  previewDemo: (path) => ipcRenderer.invoke("demo:preview", path),
  processDemo: () => ipcRenderer.invoke("demo:process"),
  saveProcessedDemo: () => ipcRenderer.invoke("demo:saveProcessedDemo"),
});
