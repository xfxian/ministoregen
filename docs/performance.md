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

## Planning

Planning (pocket layout and footprint) runs on every edit, and sorting a collection plans each case many times. Run the timing test with:

```sh
BENCH=1 npx vitest run src/model/planBench.test.js --disableConsoleIntercept
```

`BENCH=sides` adds the scenarios with overhang per side. Every run changes one base size a little, so caches start cold as they do while editing. The size column is the result: bin size, or cases and grid cells after sorting.

| Date | Version | Scenario | Time | Size |
| --- | --- | --- | --- | --- |
| 2026-10-25 | mixed models (before free placement) | 5×5 infantry bin, 80 pockets | 0.5 ms | 5×5×6u |
| 2026-10-25 | mixed models (before free placement) | mixed case, 15 models, even overhang | 0.4 ms | 5×5×13u |
| 2026-10-25 | mixed models (before free placement) | sort 7 units | 4.7 ms | 3 cases, 51 cells |
| 2026-10-25 | mixed models (before free placement) | sort 21 units | 13.4 ms | 6 cases, 150 cells |
| 2026-10-25 | overhang per side, free placement | 5×5 infantry bin, 80 pockets | 3.5 ms | 5×5×6u |
| 2026-10-25 | overhang per side, free placement | mixed case, 15 models, even overhang | 14.2 ms | 5×5×13u |
| 2026-10-25 | overhang per side, free placement | sort 7 units | 89 ms | 3 cases, 46 cells |
| 2026-10-25 | overhang per side, free placement | sort 21 units | 178 ms | 7 cases, 143 cells |
| 2026-10-25 | overhang per side, free placement | sort 21 units, overhang per side | 188 ms | 7 cases, 129 cells |

Free placement made planning slower, but it stays far below a geometry rebuild and saves grid cells. Measured steps, each kept: checking distances along 90 instead of 360 directions, settling only the best few free spots, and sharing one result between an area and the same area turned took the mixed case from 137 ms to 14 ms and sorting 7 units from 540 ms to 89 ms.

Next step if editing feels sluggish: move part building into a Web Worker so the UI stays responsive during rebuilds.
