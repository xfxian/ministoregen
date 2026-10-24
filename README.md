# Miniature Storage Inlay Generator

A web app for generating 3D-printable storage inlays for miniature figures. Configure the dimensions of your container (Gridfinity bins or custom), add sections with different base hole sizes, and export the model as an STL file ready for slicing.

Live at: https://xfxian.github.io/ministoregen

## Features

- **Start from your collection**: list groups of miniatures (base shape and size, count, height); the bin size, height and pocket layout follow
- **Gridfinity bins** that stack: spec foot profile, stacking lip and 7 mm height units, built as one watertight solid
- **Two pocket modes**: a drop-in inlay that passes through the stacking lip, or pockets cut straight into the bin floor
- **Round, oval, square and rectangular bases** with game presets; staggered or straight packing, whichever fits more
- **Fit check** with warnings and one-click fixes (too tall, does not fit, base wider than the bin)
- **3D, top and cut-away views**, with optional stand-ins for the miniatures
- **Library** of saved designs in the browser, with export and import as a file
- **Share link** that carries the whole design; undo and redo
- **STL export** for the bin and the inlay

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
  App.jsx               # layout, header actions (save, share, download)
  model/                # project state, layout planner, pocket outlines (pure, tested)
  geometry/             # Gridfinity shell and printable parts on manifold-3d (tested)
  state/                # project state hook (undo, URL, local storage) and the design library
  components/           # panel steps, 3D viewport and scene, library dialog
```

Contributor and agent workflow notes live in `AGENTS.md`.

## CI/CD

Pull requests are linted, tested, built and get a preview deployment. Pushes to `main` deploy to GitHub Pages. Dependabot opens grouped dependency updates once a month.
