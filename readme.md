# CS2 Demo 2D viewer

## Initial idea

This project was initially supposed to be strictly for creating gifs or short videos of executes recorded using the in-game `record` command which creates a POV demo (~3MB/min). However, POV demos currently are super buggy and don't contain quite enough information to create a useful top-down view. The largest piece of missing data are the grenades, it is frequently missing coordinates of each grenade, something not missing in sourceTV-recorded demos.

## New Direction

Now, the focus is on creating an interactive 2D viewer, similar to/inspired by [SCL.GG](https://scl.gg), allowing a team to analyse their own, and opposition demos. See the [feature map](#feature-map) to see plans and current product state.

## Feature Map

_&check; = fully supported_<br>
_&cross; = not currently supported_<br>
_\~ = tbc_<br>
_name = in development_<br>

| Feature               |   POV   | SourceTV |
| :-------------------- | :-----: | :------: |
| **Basic Viewer**      |
| -> Show Players       | &check; | &check;  |
| -> Player Direction   | &check; | &check;  |
| -> Show Grenades      | &cross; |   Leo    |
| -> Grenade Flightpath | &cross; |   Leo    |
| -> Firing Indicator   |    ~    |    ~     |
| **Usability/QOL**     |
| -> Scrubbing          | &check; | &check;  |
| -> Round Timer        | &cross; | &check;  |
| -> Skip To Round      | &cross; |   Leo    |
| -> Player Filters     |   Leo   |   Leo    |
| -> Round Filters      |   Leo   |   Leo    |

TODO:

- fix the goToRound feature
- Add second layer to map for multi-layer maps such as de_nuke
- Add c4 carrier + c4 planting/defusing.

## Installation

### Easiest Method (Recommended for Most Users)

1. Head to the **[Latest Release](https://github.com/yourusername/yourrepo/releases)**.
2. Download and run `demoreview Setup 1.0.0.exe`.
3. Once installed, you can search **"demoreview"** in your Windows Start menu to launch the app.

---

### Run from Source (Development)

1. Clone the repository:
   ```bash
   git clone https://github.com/leotovell/CS2POVTO2D
   cd CS2POVTO2D
   ```
2. Install dependencies:
   ```bash
   npm install
   ```
3. Start the app:
   ```bash
   npm run start
   ```

---

### Build from Source

1. Clone the repository and install dependencies as shown above.
2. Build the app:
   ```bash
   npm run dist
   ```
3. Run either:
   - `dist/win-unpacked/demoreview.exe` (runs in place, no installation), or
   - `dist/demoreview Setup 1.0.0.exe` to install on your system.

### Third-Party Libraries/Resources

- [demoparser](https://github.com/LaihoE/demoparser) by @laihoe
- [cs2-map-images](https://github.com/ghostcap-gaming/cs2-map-images) collection
- expressJS
