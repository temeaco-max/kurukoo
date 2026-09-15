#!/usr/bin/env python3
"""One-shot classifier for the Remix frontend sync (read-only analysis).

Classifies every difference between the local frontend tree (frontend/ at
local HEAD) and canonical remix-of-start-the-journey main:
  A = identical to canonical main (no action)
  C = local content matches an older canonical blob (stale; canonical is newer)
  B = local content not in canonical history (local-only work)
  D = both sides changed from the common version (conflict, needs review)
Also prints canonical-new files (only in canonical main).
"""
import subprocess

REPO = "/Users/mac/Antigravity/Kurukoo v2"

def sh(*args):
    r = subprocess.run(["git"] + list(args), capture_output=True, text=True, cwd=REPO)
    return r.stdout.strip()

def blob_exists(rev):
    return subprocess.run(["git", "cat-file", "-e", rev], capture_output=True, cwd=REPO).returncode == 0

def main():
    files = [l.split(" ", 1)[1].strip() for l in open("/tmp/sync-diff.txt") if l.strip()]
    print(f"canonical: remix-origin/main = {sh('rev-parse', 'remix-origin/main')}")
    print(f"local HEAD: {sh('rev-parse', 'HEAD')}")
    print(f"delta files: {len(files)}")
    print("-" * 100)
    for f in files:
        lp = "frontend/" + f
        if not blob_exists("HEAD:" + lp):
            print(f"CANONICAL-NEW   {f:58} only in canonical main")
            continue
        local_hash = sh("rev-parse", "HEAD:" + lp)
        canon_hash = sh("rev-parse", "remix-origin/main:" + f)
        if local_hash == canon_hash:
            print(f"A               {f:58} identical to canonical main")
            continue
        # does the local blob exist anywhere in canonical history?
        hist = sh("log", "remix-origin/main", "--format=%h %ad %s", "--date=short",
                  "--find-object=" + local_hash, "--", f).splitlines()
        if hist:
            print(f"C               {f:58} local == canonical blob at: {hist[0][:70]}")
            continue
        # local-only content. find the merge-base of the file content:
        canon_recent = sh("log", "remix-origin/main", "--format=%h %ad %s", "--date=short",
                          "-3", "--", f).splitlines()
        local_recent = sh("log", "HEAD", "--format=%h %ad %s", "--date=short",
                          "-3", "--", lp).splitlines()
        print(f"B-or-D          {f:58}")
        print(f"                canonical recent: {' | '.join(c[:60] for c in canon_recent)}")
        print(f"                local recent:     {' | '.join(c[:60] for c in local_recent)}")

if __name__ == "__main__":
    main()
