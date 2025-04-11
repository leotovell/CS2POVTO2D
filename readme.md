# CS2 Demo 2D viewer

## Initial idea

This project was initially supposed to be strictly for creating gifs or short videos of executes recorded using the in-game `record` command which creates a POV demo (~3MB/min). However, POV demos currently are super buggy and don't contain quite enough information to create a useful top-down view. The largest piece of missing data are the grenades, it is frequently missing coordinates of each grenade, something not missing in sourceTV-recorded demos.

## New Direction

Now, the focus is on creating an interactive 2D viewer, similar to/inspired by SCL.gg, allowing a team to analyse their own, and opposition demos. See the _feature map (link)_ to see plans and current product state.

## Feature Map

_&check; = fully supported_<br>
_&cross; = not currently supported_<br>
_~ = to implement_<br>
_name = currently in development by name_<br>

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
| -> Round Timer        | &cross; | &cross;  |
| -> Skip To Round      |    ~    |    ~     |
