# Performance

Geometry is rebuilt on the main thread whenever the design changes, so build time is what users feel while editing.

Run the timing test with:

```sh
BENCH=1 npx vitest run src/geometry/bench.test.js --disableConsoleIntercept
```

Scenario: 5 × 5 bin (largest default), 47 pockets (25 mm and 32 mm round bases), feet and stacking lip, Node 22 on the CI-class container.

## History

| Date | Version | Scenario | Bin build | Inlay build | Bin triangles |
| --- | --- | --- | --- | --- | --- |
| 2026-10-24 | collection-first UI | inlay mode, 32 segments | 138 ms | 134 ms | 8,108 |
| 2026-10-24 | collection-first UI | floor pockets, 32 segments | 181 ms | – | 20,140 |
| 2026-10-24 | collection-first UI | floor pockets, 64 segments | 402 ms | – | 39,404 |

Next step if editing feels sluggish: move part building into a Web Worker so the UI stays responsive during rebuilds.
