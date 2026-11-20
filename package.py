#!/usr/bin/env python3
"""Build the installable zip of this extension: job-scoring-extension-<version>.zip, the version taken from manifest.json.

    python3 package.py --to ~/code/personal-projects/resume/extension

The zip holds exactly the files git tracks (so no .DS_Store, no stray notes, and nothing that is not committed), with manifest.json at its
top level, because that is the folder Chrome's "Load unpacked" wants. It is built the same way every time (sorted names, fixed timestamps),
so packaging the same commit twice gives the same bytes. It refuses to run with uncommitted changes to tracked files, so a zip always matches a commit.

The resume app serves the newest zip in its extension/ folder on its install page, so after bumping "version" in manifest.json: commit
here, run this with --to pointing at the resume repo's extension/ folder, then commit and push the resume repo. Older zips in that
folder are removed (git history keeps them)."""
import argparse
import json
import re
import subprocess
import sys
import zipfile
from pathlib import Path

HERE = Path(__file__).resolve().parent
NAME = "job-scoring-extension"
LEFT_OUT = {"package.py", ".gitignore"}  # build tooling, not part of the extension


def git(*args: str) -> str:
    return subprocess.run(["git", *args], cwd=HERE, check=True, capture_output=True, text=True).stdout


def main() -> int:
    parser = argparse.ArgumentParser(description=__doc__.split("\n")[0])
    parser.add_argument("--to", default=str(HERE / "dist"), help="folder to write the zip into (default: ./dist)")
    parser.add_argument("--allow-dirty", action="store_true", help="package even with uncommitted changes (testing only)")
    args = parser.parse_args()

    if git("status", "--porcelain", "--untracked-files=no").strip() and not args.allow_dirty:
        print("There are uncommitted changes. Commit them first, so the zip matches a commit.", file=sys.stderr)
        return 1
    version = json.loads((HERE / "manifest.json").read_text())["version"]
    if not re.fullmatch(r"\d+(\.\d+){0,3}", version):
        print(f"manifest.json version {version!r} is not like 1.2.3", file=sys.stderr)
        return 1

    names = sorted(n for n in git("ls-files").splitlines() if n and n not in LEFT_OUT)
    for needed in ("manifest.json", "background.js"):
        if needed not in names:
            print(f"{needed} is not tracked by git", file=sys.stderr)
            return 1

    out_dir = Path(args.to).expanduser()
    out_dir.mkdir(parents=True, exist_ok=True)
    target = out_dir / f"{NAME}-{version}.zip"
    with zipfile.ZipFile(target, "w", zipfile.ZIP_DEFLATED) as z:
        for name in names:
            info = zipfile.ZipInfo(name, date_time=(1980, 1, 1, 0, 0, 0))
            info.external_attr = 0o644 << 16
            info.compress_type = zipfile.ZIP_DEFLATED
            z.writestr(info, (HERE / name).read_bytes())
    removed = []
    for old in sorted(out_dir.glob(f"{NAME}-*.zip")):
        if old != target:
            old.unlink()
            removed.append(old.name)
    print(f"Wrote {target} ({target.stat().st_size:,} bytes, {len(names)} files, version {version})")
    if removed:
        print("Removed older: " + ", ".join(removed))
    return 0


if __name__ == "__main__":
    sys.exit(main())
