# Original API specification — reference only

**What this is.** `v2/openapi.json` is the *published* OpenAPI 3.0 specification of the original
project's public v2 API (`calcom/cal.diy`), retrieved from the repository and kept here as-is.

**Why it is not in `docs/`.** The submission layout mandates exactly seven files in `docs/`. This is
not one of them; it lives outside that tree so the mandated layout stays clean.

**How it is used — and how it is not.** It is **reference material for the interface only**.

- It is **not** code, and no line of it is compiled, imported, copied or depended on by the rebuild.
- Nothing in `docs/` cites it, and the rebuild does not implement the original's v2 API surface.
- `/api` in the rebuild is defined solely by `docs/API.md`, which was written from scratch for this
  Brief (campus scheduling) rather than modelled on this specification.

**Provenance.** Retrieved from the original repository at the commit named in `docs/OBSERVATIONS.md`
(`54343aa`). Original licence: MIT. Kept verbatim; not modified, so it can be diffed against
upstream if that is ever useful.

**Why keep it at all.** It is the original's own description of what its API does, which is useful
context when reading the claims in `docs/OBSERVATIONS.md` about behaviour that cannot be seen from a
single line of code. If a reviewer would rather it not be here, deleting this directory breaks
nothing — zero files reference it.
