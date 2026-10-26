# Share links and backups

ministoregen has no server. Everything a person makes lives in their browser's local
storage, so there are two ways to move it somewhere else:

- **Backup file** (Library → Back up / Restore): one JSON file with the collection, the
  open single bin, saved single-bin designs and loaded unit libraries. Restoring merges
  designs and libraries, and replaces the collection and single bin after asking. This
  is the complete, lossless way to move to another device.
- **Share link** (share button in the header): the collection, or one bin, packed into
  the URL hash. Handy for sending to yourself or a friend. Opening a collection link asks
  whether to replace your own collection, add to it, or keep yours. Preview settings
  (colour, wireframe) and unit libraries are not part of a link.

## Link format

| Hash | Content |
| --- | --- |
| `#c=` | collection, compact form, deflated, base64url |
| `#b=` | single bin, compact form, deflated, base64url |
| `#p=` | single bin, plain JSON in base64url (older links; still opened, no longer made) |

The compact form (`src/model/share.js`) is versioned with its own `v` field. Decoding
expands it into the ordinary stored collection or project and runs it through
`normalizeCollection` / `normalizeProject`, so links get the same repairs and limits as
anything read from storage. Model fields the compact form does not know yet travel under
their full name, so a new setting is never silently dropped from a link. The round-trip
test in `src/model/share.test.js` sets every field to a non-default value; extend it when
adding fields.

What makes the links short:

1. Ids are left out. Case items point at units and models by position.
2. Anything equal to its default is left out: model fields, bin and layout settings,
   `sizeY` equal to `sizeX`, the next palette colour, default touchpoints of a model
   without a base, case names like "Case 2".
3. Model fields get one-letter keys, base shapes and palette colours become indexes, units
   are `[name, ...models]` and case items one flat list of numbers.
4. The JSON is compressed with the browser's built-in `CompressionStream('deflate-raw')`
   (no dependency) and written as base64url.

## Measured lengths

Measured 2026-10-26 with `typicalCollection` from `src/model/share.test.js`: units from the
generic library with their own names, sorted into cases. Payload characters only; the page
address adds about 40.

| Units | Cases | Minis | Plain JSON, base64 | Plain JSON, deflated | Compact, base64 | **Compact, deflated (used)** | Compact, brotli |
| ---: | ---: | ---: | ---: | ---: | ---: | ---: | ---: |
| 3 | 1 | 13 | 1,895 | 694 | 252 | **184** | 175 |
| 8 | 3 | 22 | 5,194 | 1,023 | 595 | **310** | 275 |
| 20 | 6 | 58 | 12,756 | 1,666 | 1,456 | **610** | 538 |
| 40 | 11 | 120 | 24,531 | 2,511 | 2,860 | **880** | 778 |
| 80 | 18 | 236 | 46,618 | 3,866 | 5,516 | **1,307** | 1,126 |

Unit names are most of what is left. Links up to a few thousand characters work in
browsers, chat apps and mail; the app warns when a link passes 8,000 characters and points
to the backup file instead.

## Options considered and not taken

- **Brotli**: about 12% shorter, but browsers cannot compress brotli natively, and a
  JavaScript encoder would add far more to the app than it saves.
- **Preset dictionary for deflate**: helps only tiny links (about 30% for 3 units) and
  makes larger ones longer; `CompressionStream` has no dictionary support either.
- **Denser alphabet than base64url**: the fragment allows about 80 safe characters, which
  saves around 5%, but chat apps and mail clients tend to break links at some of them.
- **Referencing unit libraries by URL**: units copy their models from a library when added
  and are then edited freely; they keep no link back. Pointing at a library entry would
  only save the unit name, needs the library to stay online and unchanged, and breaks for
  libraries loaded from a file.
- **A link-shortening service**: needs a server or a third party that sees the data.
