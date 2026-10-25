# ministoregen

A web app that designs 3D-printable [Gridfinity](https://gridfinity.xyz/) bins for storing tabletop miniatures. List the miniatures you want to store, and it sizes the bin, lays out a pocket for every base and exports STL files ready for slicing. Everything runs in the browser; designs are saved locally, never on a server.

Live at: https://xfxian.github.io/ministoregen

## Features

- **My collection**: list the units you own (base shape and size, count, height), then sort them into cases automatically or by dragging; every case sizes its own bin
- **Single bin**: skip the collection and design one bin from a list of miniature groups; the bin size, height and pocket layout follow
- **Gridfinity bins** that stack: spec foot profile, stacking lip and 7 mm height units, built as one watertight solid
- **Two pocket modes**: a drop-in inlay that passes through the stacking lip, or pockets cut straight into the bin floor
- **Round, oval, square and rectangular bases** with game presets; staggered or straight packing, bases turned where that fits more, and smaller bases filling the room next to large ones
- **Lids**: flat, or stackable with a baseplate grid on top; optional snap clips keep either one on
- **Fit check** with warnings and one-click fixes (too tall, does not fit, base wider than the bin)
- **Plan, 3D and cut-away views**, with optional stand-ins for the miniatures
- **Library** of saved designs in the browser; one backup file holds the designs and the collection
- **Share link** that carries the whole design; undo and redo
- **STL export** for the bin and the inlay, or every case at once as a zip

## Tech stack

- [React](https://react.dev/) + [Vite](https://vite.dev/)
- [Three.js](https://threejs.org/) via [@react-three/fiber](https://r3f.docs.pmnd.rs/) and [@react-three/drei](https://github.com/pmndrs/drei)
- [Material UI](https://mui.com/)
- [manifold-3d](https://github.com/elalish/manifold) for solid geometry

## Development

```sh
npm install
npm run dev       # dev server at http://localhost:5173
npm run build     # production build to dist/
npm run preview   # serve the production build locally
npm test          # run tests (vitest)
npm run lint      # lint with ESLint
```

## Project structure

```
src/
  App.jsx               # header, mode switch, export and share
  theme.js              # colours, fonts and the dark MUI theme
  export.js             # binary STL and zip writer
  model/                # project and collection state, case sorting, layout planner, pocket outlines (pure, tested)
  geometry/             # Gridfinity shell and printable parts on manifold-3d (tested)
  state/                # undo history, project and collection hooks (URL, local storage), design library
  components/           # single-bin steps, plan drawing, 3D viewport, library dialog
  components/collection # units, shelf, case board and case detail
```

Contributor and agent workflow notes live in `AGENTS.md`.

## CI/CD

Pull requests are linted, tested, built and get a preview deployment. Pushes to `main` deploy to GitHub Pages. Dependabot opens grouped dependency updates once a month.

## Credits

- Gridfinity is a modular storage system by Zack Freedman. Shell dimensions follow the [Gridfinity specification](https://gridfinity.xyz/specification/) as implemented by [gridfinity-rebuilt-openscad](https://github.com/kennetek/gridfinity-rebuilt-openscad) (MIT).

## License

[MIT](LICENSE)
