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
- [three-stdlib](https://github.com/pmndrs/three-stdlib) for STL export

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
  App.jsx          # main component: state, UI controls, STL export
  ModelPreview.jsx # Three.js canvas setup (lights, camera, grid)
  Inlay.jsx        # 3D geometry: rounded rect, bezier ellipse, hex layout
  config.js        # shared constants (defaults, Gridfinity dimensions, base sizes)
  setupTests.js    # vitest/jest-dom setup
```

## CI/CD

Pushes to `main` trigger a GitHub Actions workflow that lints, tests, builds, and deploys to GitHub Pages automatically.
