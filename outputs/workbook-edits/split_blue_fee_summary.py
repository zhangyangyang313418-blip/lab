from __future__ import annotations

import subprocess
import tempfile
import zipfile
from pathlib import Path
import xml.etree.ElementTree as ET


NS = {"m": "http://schemas.openxmlformats.org/spreadsheetml/2006/main"}
MAIN_NS = NS["m"]
ET.register_namespace("", MAIN_NS)

SOURCE = Path(
    "/Users/clytia/Desktop/Codex/产品测试流程自动化/outputs/workbook-edits/final/"
    "MLA测试项目及费用预估_全部特殊项目标识_费用汇总补全_蓝色费用表格已填写_实验室页备注修正_电脑报告费用补全.xlsx"
)
FINAL_BASE = Path(
    "/Users/clytia/Desktop/Codex/产品测试流程自动化/outputs/workbook-edits/final/"
    "MLA测试项目及费用预估_全部特殊项目标识_费用汇总补全_蓝色费用表格已填写_实验室页备注修正_电脑报告费用分阶段放置.xlsx"
)
EXPORT_OUTPUT = Path(
    "/Users/clytia/Desktop/Codex/产品测试流程自动化/outputs/mla-fee-export-template/"
    "MLA测试项目及费用预估_test-flow组别顺序模板.xlsx"
)

STYLE_BY_COLUMN = {
    "Q": "65",
    "R": "138",
    "S": "139",
    "T": "139",
    "U": "140",
    "V": "139",
    "W": "139",
}

ROWS = {
    27: {
        "Q": "DV Computer Fee",
        "R": 12000,
        "T": 12000,
    },
    28: {
        "Q": "DV Report Fee",
        "R": 1950,
        "T": 1950,
    },
    29: {
        "Q": "DV Total cost",
        "R": "=SUM(R26:R28)",
        "S": "=SUM(S26:S28)",
        "T": "=SUM(T26:T28)",
    },
    30: {
        "Q": "PV Computer Fee",
        "U": 12000,
        "W": 12000,
    },
    31: {
        "Q": "PV Report Fee",
        "U": 2100,
        "W": 2100,
    },
    32: {
        "Q": "PV Total cost",
        "U": "=SUM(U26:U31)",
        "V": "=SUM(V26:V31)",
        "W": "=SUM(W26:W31)",
    },
}


def q(name: str) -> str:
    return f"{{{MAIN_NS}}}{name}"


def col_number(col: str) -> int:
    total = 0
    for ch in col:
        total = total * 26 + ord(ch) - 64
    return total


def cell_col(ref: str) -> str:
    return "".join(ch for ch in ref if ch.isalpha())


def row_cells(row: ET.Element) -> list[ET.Element]:
    return list(row.findall("m:c", NS))


def get_or_create_row(sheet_data: ET.Element, row_num: int) -> ET.Element:
    row = sheet_data.find(f"m:row[@r='{row_num}']", NS)
    if row is not None:
        return row

    row = ET.Element(q("row"), {"r": str(row_num)})
    rows = list(sheet_data.findall("m:row", NS))
    insert_at = len(rows)
    for idx, existing in enumerate(rows):
        if int(existing.attrib["r"]) > row_num:
            insert_at = idx
            break
    sheet_data.insert(insert_at, row)
    return row


def get_or_create_cell(row: ET.Element, col: str) -> ET.Element:
    row_num = int(row.attrib["r"])
    ref = f"{col}{row_num}"
    cell = row.find(f"m:c[@r='{ref}']", NS)
    if cell is not None:
        return cell

    cell = ET.Element(q("c"), {"r": ref})
    wanted = col_number(col)
    cells = row_cells(row)
    insert_at = len(cells)
    for idx, existing in enumerate(cells):
        if col_number(cell_col(existing.attrib["r"])) > wanted:
            insert_at = idx
            break
    row.insert(insert_at, cell)
    return cell


def reset_cell(cell: ET.Element, col: str) -> None:
    ref = cell.attrib["r"]
    cell.clear()
    cell.attrib["r"] = ref
    cell.attrib["s"] = STYLE_BY_COLUMN[col]


def set_blank(cell: ET.Element, col: str) -> None:
    reset_cell(cell, col)


def set_text(cell: ET.Element, col: str, value: str) -> None:
    reset_cell(cell, col)
    cell.attrib["t"] = "inlineStr"
    inline = ET.SubElement(cell, q("is"))
    text = ET.SubElement(inline, q("t"))
    text.text = value


def set_number(cell: ET.Element, col: str, value: int | float) -> None:
    reset_cell(cell, col)
    cell.attrib["t"] = "n"
    v = ET.SubElement(cell, q("v"))
    v.text = str(int(value)) if float(value).is_integer() else str(value)


def set_formula(cell: ET.Element, col: str, value: str) -> None:
    reset_cell(cell, col)
    formula = ET.SubElement(cell, q("f"))
    formula.text = value.removeprefix("=")
    ET.SubElement(cell, q("v"))


def set_cell(cell: ET.Element, col: str, value: str | int | float | None) -> None:
    if value is None:
        set_blank(cell, col)
    elif isinstance(value, (int, float)):
        set_number(cell, col, value)
    elif value.startswith("="):
        set_formula(cell, col, value)
    else:
        set_text(cell, col, value)


def ensure_full_calc(workdir: Path) -> None:
    workbook_path = workdir / "xl/workbook.xml"
    tree = ET.parse(workbook_path)
    root = tree.getroot()
    calc_pr = root.find("m:calcPr", NS)
    if calc_pr is None:
        calc_pr = ET.SubElement(root, q("calcPr"))
    calc_pr.attrib["fullCalcOnLoad"] = "1"
    calc_pr.attrib["forceFullCalc"] = "1"
    tree.write(workbook_path, encoding="UTF-8", xml_declaration=True)


def patch_workbook(source: Path, output: Path) -> None:
    output.parent.mkdir(parents=True, exist_ok=True)
    with tempfile.TemporaryDirectory() as td:
        workdir = Path(td) / "xlsx"
        with zipfile.ZipFile(source) as zf:
            zf.extractall(workdir)

        sheet_path = workdir / "xl/worksheets/sheet1.xml"
        tree = ET.parse(sheet_path)
        root = tree.getroot()
        sheet_data = root.find("m:sheetData", NS)
        if sheet_data is None:
            raise RuntimeError("Missing sheetData in 费用预估")

        for row_num, values in ROWS.items():
            row = get_or_create_row(sheet_data, row_num)
            for col in STYLE_BY_COLUMN:
                set_cell(get_or_create_cell(row, col), col, values.get(col))

        tree.write(sheet_path, encoding="UTF-8", xml_declaration=True)
        ensure_full_calc(workdir)

        if output.exists():
            output.unlink()
        subprocess.run(["zip", "-qr", str(output), "."], cwd=workdir, check=True)


if __name__ == "__main__":
    patch_workbook(SOURCE, FINAL_BASE)
    patch_workbook(FINAL_BASE, EXPORT_OUTPUT)
    print(FINAL_BASE)
    print(EXPORT_OUTPUT)
