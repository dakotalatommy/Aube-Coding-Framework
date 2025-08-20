#!/usr/bin/env python3
"""
Safe repo cleaner: lists (or moves) unreferenced docs.
- Gathers all ` paths ` from Bootstrap Prompt.md and Technical/Brand boots + RCLP.
- Finds files under "GitHub Repo Docs/" not referenced anywhere.
- Default: dry run (prints). Use --apply to move to archive/unused/.
"""
import re
import shutil
import argparse
from pathlib import Path


ROOT = Path.cwd()
BOOT = ROOT / "Bootstrap Prompt.md"
TECH = ROOT / "BrandVX Technical" / "BrandVX Technical README.md"
BRAND = ROOT / "BrandVX Brand-Voice" / "BrandVX Brand-Voice Boot Instructions README.md"
RCLP = ROOT / "Boot Instructions" / "RCLP.md"
GITHUB_DOCS = ROOT / "GitHub Repo Docs"
ARCHIVE = ROOT / "archive" / "unused"


def extract_paths(p: Path) -> set[str]:
    if not p.exists():
        return set()
    txt = p.read_text(encoding="utf-8", errors="ignore")
    return set(rel.strip().lstrip("/") for rel in re.findall(r"`([^`]+)`", txt))


def main() -> None:
    ap = argparse.ArgumentParser()
    ap.add_argument("--apply", action="store_true", help="Move unreferenced files to archive/unused/")
    args = ap.parse_args()

    referenced: set[str] = set()
    for f in [BOOT, TECH, BRAND, RCLP]:
        referenced |= extract_paths(f)

    # Normalize to absolute paths that exist; also keep a stem set for loose matching (.pdf/.md)
    ref_set: set[str] = set()
    def norm(s: str) -> str:
        # normalize filename stem for fuzzy match
        return re.sub(r"[^a-z0-9]", "", s.lower())
    ref_stems: set[str] = set()
    for r in referenced:
        rp = ROOT / r
        if rp.exists():
            ref_set.add(str(rp.resolve()))
            ref_stems.add(norm(rp.stem))
        else:
            candidate = GITHUB_DOCS / Path(r).name
            if candidate.exists():
                ref_set.add(str(candidate.resolve()))
                ref_stems.add(norm(candidate.stem))
            else:
                # collect fuzzy stem from the referenced name
                ref_stems.add(norm(Path(r).stem))

    unref: list[Path] = []
    if GITHUB_DOCS.exists():
        for p in GITHUB_DOCS.rglob("*"):
            if p.is_file():
                if str(p.resolve()) in ref_set:
                    continue
                # fuzzy by stem ignoring extension/case/punctuation
                if norm(p.stem) in ref_stems:
                    continue
                unref.append(p)

    if not unref:
        print("No unreferenced docs found.")
        return

    print("Unreferenced docs (dry-run):")
    for p in unref:
        print("-", p.relative_to(ROOT))

    if args.apply:
        ARCHIVE.mkdir(parents=True, exist_ok=True)
        for p in unref:
            dest = ARCHIVE / p.name
            shutil.move(str(p), str(dest))
        print(f"Moved {len(unref)} file(s) to {ARCHIVE}")


if __name__ == "__main__":
    main()


