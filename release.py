#!/usr/bin/env python3
"""One command for releasing the extension to the resume app's install page.

    python3 release.py

Run it after bumping "version" in manifest.json and committing (and pushing) this repo. It does the checking and the building, so the order cannot go wrong:

  1. Refuses if this repo has uncommitted or untracked files (a file you forgot to commit would be left out of the zip), and prints the commit
     block for them. Warns if commits here are not pushed yet.
  2. Checks the version is a real step forward from the newest zip already in the resume repo (or that the zip for it is already up to date).
  3. Builds job-scoring-extension-<version>.zip with package.py into the resume repo's extension/ folder (older zips there are removed).
  4. Opens the zip and checks its manifest has that version and its files match what git tracks here.
  5. Runs the resume repo's extension tests, if its virtualenv is there.
  6. Prints the commit block for the resume repo, ready to paste.

It never commits or pushes anything itself: you do that, with the blocks it prints.

    python3 release.py --resume ~/code/personal-projects/resume     (the default is ../../resume from here)
    python3 release.py --no-tests                                    (skip step 5)"""
import argparse
import json
import os
import re
import subprocess
import sys
import tempfile
import zipfile
from pathlib import Path

HERE = Path(__file__).resolve().parent
NAME = "job-scoring-extension"
LEFT_OUT = {"package.py", "release.py", ".gitignore"}  # build tooling, not part of the extension (package.py leaves out the first and last of these too)


def git(repo: Path, *args: str) -> str:
    return subprocess.run(["git", *args], cwd=repo, check=True, capture_output=True, text=True).stdout


def changed_files(repo: Path):
    """Paths from `git status --porcelain` (each line is two status letters, a space, then the path; the first line must not be stripped)."""
    return [line[3:] for line in git(repo, "status", "--porcelain").splitlines() if line.strip()]


def tilde(path: Path) -> str:
    home = str(Path.home())
    text = str(path)
    return "~" + text[len(home):] if text.startswith(home) else text


def safe(text: str) -> str:
    """A line fit for a double-quoted shell string: no quotes, backticks, dollar signs, backslashes or exclamation marks."""
    return re.sub(r'["`$\\!]', "", text).strip()


def version_key(text: str):
    return tuple(int(part) for part in text.split("."))


def newest_zip(folder: Path):
    found = []
    for path in folder.glob(f"{NAME}-*.zip"):
        m = re.fullmatch(rf"{NAME}-(\d+(?:\.\d+){{0,3}})\.zip", path.name)
        if m:
            found.append((version_key(m.group(1)), m.group(1), path))
    return max(found) if found else None


def commit_block(repo: Path, subject: str, bullets, add: str = "-A") -> str:
    message = "\n\n".join([safe(subject), "\n".join(f"- {safe(b)}" for b in bullets)])
    lines = [f"cd {tilde(repo)} &&", f"git add {add} &&", f'git commit -m "{message}" &&', "git push"]
    return "\n".join(lines)


def fail(message: str, block: str = "") -> int:
    sys.stdout.flush()  # so this comes after anything printed just before it
    print(f"\nSTOP: {message}", file=sys.stderr)
    if block:
        print("\n" + block, file=sys.stderr)
    return 1


def main() -> int:
    parser = argparse.ArgumentParser(description=__doc__.split("\n")[0])
    parser.add_argument("--resume", default=str((HERE / ".." / ".." / "resume").resolve()), help="the resume repo (default: ../../resume)")
    parser.add_argument("--no-tests", action="store_true", help="do not run the resume repo's extension tests")
    args = parser.parse_args()
    resume = Path(args.resume).expanduser().resolve()
    target = resume / "extension"
    if not (resume / "app").is_dir():
        return fail(f"{tilde(resume)} does not look like the resume repo (no app/ folder). Use --resume to point at it.")

    # 1. this repo is fully committed
    dirty = changed_files(HERE)
    if dirty:
        print("These files here are not committed yet:\n  " + "\n  ".join(dirty))
        return fail("commit them first (the zip is built from what is committed), then run this again.",
                    commit_block(HERE, "Describe the change here", ["What changed", "Why"]))
    try:
        ahead = int(git(HERE, "rev-list", "--count", "@{u}..HEAD").strip())
    except subprocess.CalledProcessError:
        ahead = 0  # no upstream set: nothing to compare with
    if ahead:
        print(f"Note: {ahead} commit(s) here are not pushed yet. Push them too (cd {tilde(HERE)} && git push), so the zip's source is on GitHub.")

    # 2. the version
    version = json.loads((HERE / "manifest.json").read_text())["version"]
    if not re.fullmatch(r"\d+(\.\d+){0,3}", version):
        return fail(f"manifest.json version {version!r} is not like 1.2.3")
    latest = newest_zip(target)
    if latest and version_key(version) < latest[0]:
        return fail(f"manifest.json says {version} but the resume repo already has {latest[1]}. Did you forget to bump the version?")

    # 3. build (into a scratch folder first, so a same-version zip can be compared without touching the real one)
    with tempfile.TemporaryDirectory() as scratch:
        built = subprocess.run([sys.executable, str(HERE / "package.py"), "--to", scratch], cwd=HERE, capture_output=True, text=True)
        if built.returncode != 0:
            return fail("package.py failed:\n" + (built.stderr or built.stdout))
        fresh = Path(scratch) / f"{NAME}-{version}.zip"
        existing = target / fresh.name
        if existing.exists():
            if existing.read_bytes() == fresh.read_bytes():
                print(f"Version {version} is already built and up to date in {tilde(target)}.")
                changed = False
            else:
                return fail(f"{existing.name} already exists in the resume repo with DIFFERENT contents. A released version must not change: bump the version in manifest.json, commit, and run this again.")
        else:
            changed = True
        if changed:
            target.mkdir(parents=True, exist_ok=True)
            fresh_bytes = fresh.read_bytes()
            for old in target.glob(f"{NAME}-*.zip"):
                old.unlink()
            existing.write_bytes(fresh_bytes)
            print(f"Built {tilde(existing)} ({existing.stat().st_size:,} bytes)")

    # 4. look inside it
    with zipfile.ZipFile(existing) as z:
        inside = set(z.namelist())
        shipped = json.loads(z.read("manifest.json"))["version"]
    expected = {n for n in git(HERE, "ls-files").splitlines() if n and n not in LEFT_OUT}
    if shipped != version:
        return fail(f"the zip's manifest says {shipped}, not {version}")
    if inside != expected:
        return fail("the zip's files do not match what git tracks here: missing " + str(sorted(expected - inside)) + ", extra " + str(sorted(inside - expected)))
    print(f"Checked: the zip holds all {len(inside)} tracked files and its manifest says {version}.")

    # 5. the resume repo's own checks of what it will serve
    python = resume / "venv" / "bin" / "python"
    if args.no_tests:
        print("Skipped the resume repo's extension tests (--no-tests).")
    elif not python.exists():
        print(f"Skipped the resume repo's extension tests: no virtualenv at {tilde(python)}.")
    else:
        tests = subprocess.run([str(python), "-m", "pytest", "tests/test_extension.py", "tests/test_extension_updates.py", "-q", "-p", "no:warnings"],
                               cwd=resume, capture_output=True, text=True, env={**os.environ, "PYTHONDONTWRITEBYTECODE": "1"})
        last = (tests.stdout.strip().splitlines() or ["(no output)"])[-1]
        if tests.returncode != 0:
            print(tests.stdout[-2000:])
            return fail(f"the resume repo's extension tests failed ({last}). Fix that before releasing.")
        print(f"Resume repo extension tests: {last}")

    # 6. what to commit over there
    pending = changed_files(resume)
    elsewhere = [path for path in pending if not path.startswith("extension/")]
    release_pending = [path for path in pending if path.startswith("extension/")]
    if not changed and not release_pending:
        print("\nNothing to commit for the release: the resume repo already has this zip.")
        if elsewhere:
            print("Note: the resume repo has other uncommitted changes (not part of the release; commit them yourself if they belong with it):\n  " + "\n  ".join(elsewhere))
        return 0
    subject = git(HERE, "log", "-1", "--format=%s").strip()
    sha = git(HERE, "rev-parse", "--short", "HEAD").strip()
    block = commit_block(resume, f"Extension {version} zip", [f"Built from extension commit {sha}: {subject}", "Replaces the previous zip; the install page and update notice serve the newest"], add="extension")
    print("\nNow commit and push the resume repo (this adds only the extension/ folder):\n")
    print(block)
    if elsewhere:
        print("\nNote: the resume repo has other uncommitted changes, which the block above leaves out on purpose:\n  " + "\n  ".join(elsewhere))
    return 0


if __name__ == "__main__":
    sys.exit(main())
