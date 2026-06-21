commands_run
- `npm run proof`
- `node ../../../../../bin/replaypack.mjs verify replaypack/case.json --out dist/replaypack-full.json`

files_changed
- `src/system.js`
- `dist/replaypack-full.json`
- `transcript.md`

verify_attempts
- 1

final_status
- pass

short_reason
- `acceptUpload` now requires a `.jpg` or `.jpeg` name, `image/jpeg` type, and JPEG magic bytes (`FF D8 FF`) before accepting an upload. The proof and invariant both passed under ReplayPack verify.
