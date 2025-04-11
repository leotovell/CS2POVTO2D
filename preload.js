const { contextBridge, ipcRenderer } = require("electron/renderer");

contextBridge.exposeInMainWorld("electron", {
  openFileDialog: () => ipcRenderer.invoke("dialog:openFile"),
  previewDemo: (path) => ipcRenderer.invoke("demo:preview", path),
  processDemo: (path) => ipcRenderer.invoke("demo:process", path),
});
