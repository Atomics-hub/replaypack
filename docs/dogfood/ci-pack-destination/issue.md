# CI pack destination must work on fresh runners

The first hosted private GitHub Actions run failed even though local smoke tests passed.

Root cause: the workflow ran `npm pack --pack-destination dist` before `dist/` existed. Local runs had already created `dist/`, so the issue was masked outside a clean runner.

The fix must make the package step fresh-runner safe.
