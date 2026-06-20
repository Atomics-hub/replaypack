# Hosted CI Trace

Private GitHub Actions run:

- repository: `Atomics-hub/replaypack`
- run: `27862242074`
- commit: `423d84a546a41beee203fee7493717fe6459e084`
- failed step: `Run npm pack --pack-destination dist`

Failure excerpt:

```text
npm error code ENOENT
npm error syscall open
npm error path /home/runner/work/replaypack/replaypack/dist/replaypack-0.2.0.tgz
npm error enoent ENOENT: no such file or directory
```

Follow-up private GitHub Actions run:

- run: `27862264865`
- commit: `72280ad405158d2010a4c3da934b656f89943627`
- conclusion: `success`
