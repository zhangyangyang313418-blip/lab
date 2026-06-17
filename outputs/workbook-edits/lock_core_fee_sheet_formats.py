from __future__ import annotations

import shutil
import subprocess
import tempfile
import zipfile
from pathlib import Path
import xml.etree.ElementTree as ET


ROOT = Path("/Users/clytia/Desktop/Codex/产品测试流程自动化")
SOURCE = ROOT / "outputs/workbook-edits/final/MLA测试项目及费用预估_费用预估模板已同步后续页面.xlsx"
OUTPUT = ROOT / "outputs/workbook-edits/final/MLA测试项目及费用预估_费用预估模板已同步后续页面_格式锁定.xlsx"
EXPORT_TEMPLATE = ROOT / "outputs/mla-fee-export-template/MLA测试项目及费用预估_test-flow组别顺序模板.xlsx"

NS = {
    "m": "http://schemas.openxmlformats.org/spreadsheetml/2006/main",
    "r": "http://schemas.openxmlformats.org/officeDocument/2006/relationships",
}
MAIN_NS = NS["m"]
REL_NS = NS["r"]
ET.register_namespace("", MAIN_NS)
ET.register_namespace("r", REL_NS)

def q(name: str) -> str:
    return f"{{{MAIN_NS}}}{name}"


def sheet_paths(workdir: Path) -> dict[str, Path]:
    workbook = ET.parse(workdir / "xl/workbook.xml").getroot()
    rels = ET.parse(workdir / "xl/_rels/workbook.xml.rels").getroot()
    rel_by_id = {rel.attrib["Id"]: rel.attrib["Target"] for rel in rels}
    sheets = workbook.find("m:sheets", NS)
    if sheets is None:
        raise RuntimeError("Missing sheets")

    paths: dict[str, Path] = {}
    for sheet in sheets:
        rel_id = sheet.attrib[f"{{{REL_NS}}}id"]
        target = rel_by_id[rel_id]
        if target.startswith("/"):
            target_path = workdir / target.lstrip("/")
        elif target.startswith("xl/"):
            target_path = workdir / target
        else:
            target_path = workdir / "xl" / target
        paths[sheet.attrib["name"]] = target_path
    return paths


def remove_sheet_protection(sheet_path: Path) -> None:
    tree = ET.parse(sheet_path)
    root = tree.getroot()
    existing = root.find("m:sheetProtection", NS)
    if existing is not None:
        root.remove(existing)
    tree.write(sheet_path, encoding="UTF-8", xml_declaration=True)


def lock() -> None:
    OUTPUT.parent.mkdir(parents=True, exist_ok=True)
    with tempfile.TemporaryDirectory() as td:
        workdir = Path(td) / "xlsx"
        with zipfile.ZipFile(SOURCE) as workbook_zip:
            workbook_zip.extractall(workdir)

        for sheet_path in sheet_paths(workdir).values():
            remove_sheet_protection(sheet_path)

        if OUTPUT.exists():
            OUTPUT.unlink()
        subprocess.run(["zip", "-qr", str(OUTPUT), "."], cwd=workdir, check=True)

    shutil.copyfile(OUTPUT, EXPORT_TEMPLATE)


if __name__ == "__main__":
    lock()
    print(OUTPUT)
    print(EXPORT_TEMPLATE)
