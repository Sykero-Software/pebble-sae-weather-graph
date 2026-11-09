# Sae Weather Graph

Pebble watch app for viewing weather forecasts as a scrollable graph.

![screenshot](screenshots/screenshot_01_initial_zoom.png)

## Development with JailBee

Development of this fork makes extensive use of [JailBee](https://jailbee.gisgro.io/)
for isolated development environments. With JailBee and its Linux/Incus
prerequisites installed, run from this repository on the **host**:

```sh
jailbee init
jailbee base build          # one-time toolchain image; rebuild after SDK changes
jailbee new dev
jailbee tmux dev
```

Development normally happens with Claude Code inside the container. Before
creating it, enable `agents.claude.enabled` and `agents.claude.autostart`
in your host's `~/.config/jailbee/global.yaml`; `jailbee tmux dev` then attaches to
the session running Claude. Ask Claude to make changes and run the project's
builds and tests.

The committed [configuration](.jailbee/config.yaml) and
[installer](.jailbee/install.d/45-pebble-sdk.sh) provide Node.js 24,
pebble-tool 5.1.2, Pebble SDK 4.44 and a headless emulator; no parent
repository is required. Building the image installs the SDK under the
[Pebble developer terms](https://developer.repebble.com/legal/sdk-license/index.html).
Keep personal agent/IDE settings and credentials in JailBee's host-local config.
Commit inside the container, then run `jailbee git pull dev` on the host;
publish from the host, not the container.

### Makefile

The project uses _Makefile_ to define common build routines.

### Weather data

Weather data is fetched from the Finnish Meteorological Institute's (FMI) open
data service for locations in Scandinavia, with
[Open-Meteo](https://open-meteo.com) as a fallback for other locations.

Displayed data includes temperature, precipitation, wind speed and direction,
cloud cover, UV index, relative humidity, and sun conditions (golden hour,
darkness, sunrise/sunset ticks).

### Configuration

The app is configurable via the Pebble phone app. Settings include displayed
data layers per zoom level, units, date/time format, and up to five preset
locations.
