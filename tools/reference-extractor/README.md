# Reference extractor

Builds `public/ishaara/templates.json` from photos of ISL letters, using the
same MediaPipe Hand Landmarker (tasks-vision 1.2.3, float16 model) and the same
normalisation (`src/isl/pose.ts`) as the app, so references line up with what a
learner's webcam produces.

1. Put photos in `<data dir>/rgb/<LETTER>/<n>.jpg` and a `list.json` of
   `{ "letter": "A", "file": "rgb/A/1.jpg" }` entries. Optionally add the
   dataset's `manifest.csv` to skip padded duplicates.
2. Run the page: `ISL_DATA_DIR=<data dir> npx vite --config tools/reference-extractor/vite.config.ts`,
   open http://localhost:5180 in Chrome and wait for "Done". It writes
   `<data dir>/landmarks.json`.
3. `npx tsx tools/reference-extractor/build-references.ts <data dir>` — orients,
   filters and keeps the 10 most typical samples per letter, prints a
   leave-one-out accuracy report, and writes `public/ishaara/templates.json`.

The shipped set comes from *A Multimodal Indian Sign Language Dataset for
English and Marathi Alphabets* (Hambir et al., Mendeley Data, 2026,
[doi:10.17632/2tj6c7pzfk.1](https://doi.org/10.17632/2tj6c7pzfk.1), CC BY 4.0):
the English A–Z RGB photos, four signers. The photos themselves are not
committed.
