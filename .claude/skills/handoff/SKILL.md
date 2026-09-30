---
name: handoff
description: End-of-session handoff — record state in docs/PROGRESS.md so the next session starts without re-exploring.
disable-model-invocation: true
---
Prepend an entry to `docs/PROGRESS.md` (keep the file under ~60 lines; drop entries older than the last 5):

```
## YYYY-MM-DD — <task id> <short title>
Done: <1–3 bullets, with file paths>
State: <what works / what is stubbed>
Next: <the very next concrete step>
Gotchas: <non-obvious facts learned; omit if none>
```
If a decision was made that future sessions must not re-litigate, add one line to `docs/DECISIONS.md`.
Commit `docs: handoff`. Then tell the user: session can be `/clear`ed.
