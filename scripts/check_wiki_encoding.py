#!/usr/bin/env python3
"""
Modulo: scripts
Arquivo: check_wiki_encoding.py
Funcao no sistema: validar textos de UI/wiki contra corrupcao de encoding (mojibake e '?' dentro de palavras).
"""

from __future__ import annotations

import re
from pathlib import Path


ROOT = Path(__file__).resolve().parents[1]

TARGETS = [
    ROOT / "frontend" / "src" / "wiki",
    ROOT / "frontend" / "src" / "components",
    ROOT / "frontend" / "src" / "App.jsx",
]

EXT_OK = {".md", ".js", ".jsx", ".css", ".cjs"}

RE_INTERNAL_QMARK = re.compile(r"[A-Za-z\u00C0-\u00FF]\?[A-Za-z\u00C0-\u00FF]")
RE_REPLACEMENT = re.compile(r"\uFFFD")
RE_MOJIBAKE = re.compile(r"Ã[§£¡©ª³º­‰“”]|Â[ºª°]|â[€“—€]")


def iter_files():
    for target in TARGETS:
        if target.is_file():
            if target.suffix.lower() in EXT_OK:
                yield target
            continue
        if not target.exists():
            continue
        for p in target.rglob("*"):
            if p.is_file() and p.suffix.lower() in EXT_OK:
                yield p


def has_bad_internal_qmark(line: str) -> bool:
    """Detecta '?' em palavras corrompidas, ignorando query string valida."""
    for m in RE_INTERNAL_QMARK.finditer(line):
        q_idx = m.start() + 1
        suffix = line[q_idx:]

        if suffix.startswith("?raw"):
            continue

        token_tail = re.split(r"[\s`\"']", suffix, maxsplit=1)[0]
        if "=" in token_tail or "&" in token_tail:
            continue

        return True
    return False


def main() -> int:
    errors: list[str] = []
    for p in iter_files():
        try:
            text = p.read_text(encoding="utf-8")
        except Exception as exc:
            errors.append(f"{p}: leitura UTF-8 falhou ({exc})")
            continue

        for i, line in enumerate(text.splitlines(), start=1):
            if RE_REPLACEMENT.search(line):
                errors.append(f"{p}:{i}: caractere de substituicao (�) detectado")
            if RE_MOJIBAKE.search(line):
                errors.append(f"{p}:{i}: possivel mojibake detectado")
            if has_bad_internal_qmark(line):
                errors.append(f"{p}:{i}: '?' dentro de palavra (provavel acentuacao corrompida)")

    if errors:
        print("FALHA: validacao de encoding/acentuacao encontrou problemas:\n")
        for err in errors:
            print(f"- {err}")
        print("\nCorrecao sugerida: ajustar acentuacao pt-BR e garantir UTF-8 nos arquivos.")
        return 1

    print("OK: validacao de encoding/acentuacao sem problemas.")
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
