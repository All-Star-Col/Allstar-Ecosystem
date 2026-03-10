#!/usr/bin/env python3
from __future__ import annotations

import argparse
import ast
from dataclasses import dataclass
from pathlib import Path
from typing import Iterable

LOGGING_IMPORT = "from src.core.logging_config import get_logger"
LOGGER_DECL = "logger = get_logger(__name__)"
SKIP_FILES = {"src/core/logging_config.py"}


@dataclass
class Result:
    path: Path
    updated: bool
    skipped_reason: str | None = None


def _detect_newline(text: str) -> str:
    return "\r\n" if "\r\n" in text else "\n"


def _has_docstring_node(node: ast.AST) -> bool:
    return (
        isinstance(node, ast.Expr)
        and isinstance(node.value, ast.Constant)
        and isinstance(node.value.value, str)
    )


def _top_import_end_line(tree: ast.Module) -> int:
    body = tree.body
    if not body:
        return 0

    idx = 1 if _has_docstring_node(body[0]) else 0
    last_import_end = 0

    while idx < len(body) and isinstance(body[idx], (ast.Import, ast.ImportFrom)):
        last_import_end = body[idx].end_lineno or body[idx].lineno
        idx += 1

    if last_import_end:
        return last_import_end
    if idx == 1 and _has_docstring_node(body[0]):
        return body[0].end_lineno or body[0].lineno
    return 0


def _has_get_logger_import(tree: ast.Module) -> bool:
    for node in tree.body:
        if isinstance(node, ast.ImportFrom) and node.module == "src.core.logging_config":
            if any(alias.name == "get_logger" for alias in node.names):
                return True
    return False


def _has_module_level_logger(tree: ast.Module) -> bool:
    for node in tree.body:
        if isinstance(node, ast.Assign):
            for target in node.targets:
                if isinstance(target, ast.Name) and target.id == "logger":
                    return True
        if isinstance(node, ast.AnnAssign):
            if isinstance(node.target, ast.Name) and node.target.id == "logger":
                return True
    return False


def _inject_logger_setup(text: str) -> tuple[str, bool]:
    tree = ast.parse(text)
    newline = _detect_newline(text)
    lines = text.splitlines(keepends=True)
    changed = False

    if not _has_get_logger_import(tree):
        insert_at = _top_import_end_line(tree)
        lines.insert(insert_at, f"{LOGGING_IMPORT}{newline}")
        text = "".join(lines)
        tree = ast.parse(text)
        lines = text.splitlines(keepends=True)
        changed = True

    if not _has_module_level_logger(tree):
        insert_at = _top_import_end_line(tree)
        block = [f"{LOGGER_DECL}{newline}"]
        if insert_at >= len(lines) or lines[insert_at].strip():
            block.append(newline)
        lines[insert_at:insert_at] = block
        changed = True

    return "".join(lines), changed


def _iter_python_files(paths: Iterable[Path], include_init: bool) -> Iterable[Path]:
    for path in paths:
        if path.is_file() and path.suffix == ".py":
            candidates = [path]
        else:
            candidates = sorted(path.rglob("*.py"))

        for candidate in candidates:
            rel_posix = candidate.as_posix()
            if rel_posix in SKIP_FILES or rel_posix.endswith("/src/core/logging_config.py"):
                continue
            if not include_init and candidate.name == "__init__.py":
                continue
            yield candidate


def run(paths: list[Path], apply: bool, include_init: bool) -> int:
    results: list[Result] = []

    for file_path in _iter_python_files(paths, include_init=include_init):
        try:
            with file_path.open("r", encoding="utf-8", newline="") as fh:
                original = fh.read()
            updated, changed = _inject_logger_setup(original)
        except SyntaxError as exc:
            results.append(Result(path=file_path, updated=False, skipped_reason=f"syntax_error:{exc.lineno}"))
            continue
        except UnicodeDecodeError:
            results.append(Result(path=file_path, updated=False, skipped_reason="decode_error"))
            continue

        if changed:
            if apply:
                with file_path.open("w", encoding="utf-8", newline="") as fh:
                    fh.write(updated)
            results.append(Result(path=file_path, updated=True))
        else:
            results.append(Result(path=file_path, updated=False))

    changed_files = [r for r in results if r.updated]
    skipped = [r for r in results if r.skipped_reason]

    mode = "APPLY" if apply else "DRY-RUN"
    print(f"[{mode}] scanned={len(results)} changed={len(changed_files)} skipped={len(skipped)}")

    if changed_files:
        print("Changed files:")
        for item in changed_files:
            print(f" - {item.path.as_posix()}")

    if skipped:
        print("Skipped files:")
        for item in skipped:
            print(f" - {item.path.as_posix()} ({item.skipped_reason})")

    return 0


def parse_args() -> argparse.Namespace:
    parser = argparse.ArgumentParser(
        description="Add `get_logger` import and `logger = get_logger(__name__)` to Python modules."
    )
    parser.add_argument(
        "paths",
        nargs="*",
        default=["src"],
        help="Files/directories to scan (default: src).",
    )
    parser.add_argument(
        "--apply",
        action="store_true",
        help="Write changes to files. Without this flag it only shows what would change.",
    )
    parser.add_argument(
        "--include-init",
        action="store_true",
        help="Also process __init__.py files.",
    )
    return parser.parse_args()


def main() -> int:
    args = parse_args()
    paths = [Path(p) for p in args.paths]
    return run(paths=paths, apply=args.apply, include_init=args.include_init)


if __name__ == "__main__":
    raise SystemExit(main())
