# Unit libraries (unit packs)

A unit library is a JSON file listing units and the models they are made of: base shape and size, how many, how tall, and how far a model reaches past its base. In the app, **My collection → From library** opens a library, and a picked unit lands in the unit dialog, where counts and heights can be adjusted before adding it.

The app ships one library, **Generic bases**, with common base setups and no game's unit names. Libraries for a specific game are community files that people load themselves:

- **By address**: paste an `https://` link to the JSON file. The server must allow cross-origin requests; raw files on GitHub (`https://raw.githubusercontent.com/...`) and GitHub Pages do. A library loaded by address can be loaded again later to pick up updates.
- **From a file** on the device.

Loaded libraries are kept in the browser, like the collection. Nothing is sent to a server.

## What belongs in a library

Only facts about the physical models: unit and model names, base sizes, model counts, typical heights and overhangs. These are what a person reads off the box or measures.

Do not put in:

- rules text, stat lines, points or wargear options;
- logos, artwork, photos or anything copied from a publisher's documents (write your own list instead);
- anything suggesting a publisher made or endorses the library.

The app shows every community library with a note that it is unofficial and not affiliated with or endorsed by Games Workshop or any other publisher. Unit names remain the property of their owners. Library authors should add a similar note to their own repository.

## Format

```json
{
  "format": "ministoregen-unit-pack",
  "version": 1,
  "name": "Example skirmish pack",
  "description": "One or two sentences shown above the unit list.",
  "author": "Your name",
  "licence": "CC0-1.0",
  "source": "https://github.com/your-name/your-packs",
  "units": [
    {
      "name": "Rifle squad",
      "category": "Infantry",
      "models": [
        { "name": "Sergeant", "shape": "round", "sizeX": 32, "count": 1, "heightMm": 38 },
        { "name": "Trooper", "shape": "round", "sizeX": 28.5, "count": 9, "heightMm": 34 }
      ]
    }
  ]
}
```

A complete example with every field is in [examples/unit-pack-example.json](examples/unit-pack-example.json).

### Library fields

| Field | Required | Meaning |
| --- | --- | --- |
| `format` | yes | Always `"ministoregen-unit-pack"`. |
| `version` | yes | Format version, currently `1`. |
| `name` | yes | Shown in the library picker. Up to 80 characters. |
| `description` | no | Shown above the unit list. Up to 400 characters. |
| `author` | no | Who maintains the library. |
| `licence` | no | Licence of the library data, for example `CC0-1.0` or `CC-BY-4.0`. `license` works too. |
| `source` | no | An `http(s)` link to where the library is maintained; shown as a link. |
| `units` | yes | Up to 5000 units. |

### Unit fields

| Field | Required | Meaning |
| --- | --- | --- |
| `name` | yes | Up to 60 characters. |
| `category` | no | Groups units in the list, for example `Infantry` or a faction. Search also matches it. |
| `models` | yes | One to 12 models. A unit mixing bases (a vehicle and its drones) lists each as its own model. |

### Model fields

| Field | Required | Meaning |
| --- | --- | --- |
| `name` | no | Shown when a unit has several models, for example `Sergeant`. |
| `shape` | yes | `round`, `oval`, `square`, `rect`, or `pads` for a model without a base. |
| `sizeX` | yes | Width in mm (the diameter for round bases). |
| `sizeY` | for oval, rect, pads | Length in mm, front to back. Round and square bases may leave it out. Ovals are written short side first (`35` × `60`). |
| `count` | no | How many of this model the unit has. Default 1. |
| `heightMm` | no | Height in mm including the base. Default 30. |
| `overhang` | no | How far the model reaches past its base in mm: one number for every side, or `{ "front", "right", "back", "left" }`. |
| `pads` | no | For `pads` models: touchpoints as `{ "x", "y", "sizeX", "sizeY", "shape" }`, centred on the footprint, front up, `shape` `round` or `rect`. Left out, the app places four corner legs. |

Values out of range are clamped, and units without a name or a usable base are skipped (the app says how many). Pocket depth, finger notches and colours are not part of a library: they belong to whoever prints the bin.

## Hosting a library

Keep game-specific libraries in their own repository, not in ministoregen. A repository on GitHub works without any setup: commit the JSON file and share its raw link, for example `https://raw.githubusercontent.com/<user>/<repo>/main/packs/my-army.json`.
