# Miniature Storage Inlay Generator

A web app for generating 3D-printable storage inlays for miniature figures. Configure the dimensions of your container (Gridfinity bins or custom), add sections with different base hole sizes, and export the model as an STL file ready for slicing.

Live at: https://xfxian.github.io/ministoregen

## Features

- **Inlay configuration**: Set length, width, corner radius, depth, margin, and printing clearance
- **Gridfinity mode**: Select standard Gridfinity bin dimensions by unit count
- **Multi-section support**: Divide the inlay into sections with different hole sizes (e.g. 25mm and 32mm bases side-by-side)
- **Hexagonal packing**: Holes are automatically laid out in a hex grid for maximum density
- **Bezier ellipse holes**: Configurable curvature factor for a precise fit
- **3D preview**: Interactive Three.js viewport with color picker and wireframe mode
- **STL export**: Download the model for direct use in your slicer

## Tech stack

- [React](https://react.dev/) + [Vite](https://vite.dev/)
- [Three.js](https://threejs.org/) via [@react-three/fiber](https://r3f.docs.pmnd.rs/) and [@react-three/drei](https://github.com/pmndrs/drei)
- [Material UI](https://mui.com/)

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
  App.jsx               # app state, layout, STL export
  ModelPreview.jsx      # three.js canvas (lights, camera, grid)
  Inlay.jsx             # inlay geometry: rounded plate with hex-packed base holes
  Bin.jsx               # renders the bin mesh
  binGeometry.js        # Gridfinity bin geometry (feet, floor, walls, stacking lip)
  config.js             # defaults and Gridfinity constants
  components/           # sidebar, miniature wizard, inputs, download button
  utils/                # section and wizard math
```

Contributor and agent workflow notes live in `AGENTS.md`.

## CI/CD

Pull requests are linted, tested, built and get a preview deployment. Pushes to `main` deploy to GitHub Pages. Dependabot opens grouped dependency updates once a month.
