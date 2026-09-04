"""Synchronisiert die Einzelservice-`app`-Pakete in den Monolith-Vendor-Bereich.

Der Monolith führt alle vier Python-Services in EINEN Prozess zusammen.
Da jeder Einzelservice ein Top-Level-Paket mit dem Namen `app` nutzt, wäre
ein direktes Nebeneinander-Importieren kollisionsbehaftet (identische
Modulnamen, inkl. Laufzeit-Imports, z. B. in notification tasks.py).

Lösung: Die `app/`-Verzeichnisse werden in `monolith/vendor/<service>/app`
kopiert und alle `app.*`-Imports auf den jeweiligen Vendor-Namespace
umgeschrieben (z. B. `app.routes.chores` -> `chore.app.routes.chores`).
Dadurch bleibt der Original-Code unangetastet (kein Wegwerfen) und der
Monolith erhält disjunkte, deterministisch importierbare Pakete.
"""

from __future__ import annotations

import argparse
import re
import shutil
import sys
from pathlib import Path

REPO_ROOT = Path(__file__).resolve().parent.parent

SERVICES = {
    "chore": "chore-service",
    "log": "log-service",
    "notify": "notification-service",
    "ai": "ai-copilot-service",
}

IMPORT_RE = re.compile(r"(?P<prefix>\b(from|import)\s+)app(?P<suffix>\.[\w.]+|\s)")

APP_MARKER = "__INIT__"


def rewrite_imports(content: str, package: str) -> str:
    """Ersetzt `from app.x` / `import app.x` durch `from <package>.app.x`."""

    def repl(m: re.Match) -> str:
        prefix = m.group("prefix")
        suffix = m.group("suffix")
        return f"{prefix}{package}.app{suffix}"

    return IMPORT_RE.sub(repl, content)


def ensure_init(directory: Path) -> None:
    init_file = directory / "__init__.py"
    if not init_file.exists():
        init_file.write_text("", encoding="utf-8")


def sync(service: str, service_dir: str, vendor_root: Path) -> Path:
    src_app = REPO_ROOT / "services" / service_dir / "app"
    if not src_app.is_dir():
        raise FileNotFoundError(f"Quell-Verzeichnis fehlt: {src_app}")

    target = vendor_root / service / "app"
    if target.exists():
        shutil.rmtree(target)
    shutil.copytree(src_app, target, ignore=shutil.ignore_patterns("__pycache__"))

    ensure_init(vendor_root / service)
    ensure_init(target)

    # Alle .py-Dateien (außer __init__.py-Inhalt, kein Bedarf) import-umschreiben
    for py in target.rglob("*.py"):
        content = py.read_text(encoding="utf-8")
        new_content = rewrite_imports(content, service)
        if new_content != content:
            py.write_text(new_content, encoding="utf-8")
        # __pycache__ entfernen
        for cache in py.parent.glob("__pycache__"):
            if cache.is_dir():
                shutil.rmtree(cache, ignore_errors=True)

    return target


def main() -> int:
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument(
        "--force",
        action="store_true",
        help="Auch bei bereits vendorisierten Paketen erneut synchronisieren.",
    )
    args = parser.parse_args()

    vendor_root = REPO_ROOT / "monolith" / "vendor"
    vendor_root.mkdir(parents=True, exist_ok=True)

    for package, service_dir in SERVICES.items():
        target_app = vendor_root / package / "app"
        sync(package, service_dir, vendor_root)
        print(f"[sync] {service_dir:24s} -> vendor/{package}/app")
    return 0


if __name__ == "__main__":
    sys.exit(main())
