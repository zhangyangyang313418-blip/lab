from __future__ import annotations

import copy
import re
import shutil
import subprocess
import tempfile
import zipfile
from collections import defaultdict
from pathlib import Path
import xml.etree.ElementTree as ET


ROOT = Path("/Users/clytia/Desktop/Codex/产品测试流程自动化")
SOURCE = ROOT / "outputs/mla-fee-export-template/MLA测试项目及费用预估_test-flow组别顺序模板.xlsx"
OUTPUT = ROOT / "outputs/workbook-edits/final/MLA测试项目及费用预估_费用预估模板已同步后续页面.xlsx"

NS = {
    "m": "http://schemas.openxmlformats.org/spreadsheetml/2006/main",
    "r": "http://schemas.openxmlformats.org/officeDocument/2006/relationships",
}
MAIN_NS = NS["m"]
REL_NS = NS["r"]
ET.register_namespace("", MAIN_NS)
ET.register_namespace("r", REL_NS)

GROUPS = [
    "Group A",
    "Group B",
    "Group C",
    "Group D-1",
    "Group D-2",
    "Group D-3",
    "Group D-4",
    "Group D-5",
    "Group D-6",
    "Group D-7",
    "Group D-8",
    "Group D-9",
    "Group E-1",
    "Group E-2",
]

LAB_ADDITIONAL_FEES = {
    "SGS": {"computerUnit": 250, "reportUnit": 0},
    "华测": {"computerUnit": 450, "reportUnit": 0},
    "苏勃": {"computerUnit": 150, "reportUnit": 150},
}

COMPUTER_COEFFICIENT = 48
REPORT_COUNTS = {"DV": 13, "PV": 14}
TARGET_SHEETS = ["SGS", "华测", "苏勃"]
LAB_HEADER = ["组别顺序", "组内顺序", "Phase", "Group", "测试编号", "测试项目", "样品范围", "计费基数", "测试时间", "计费方式", "单价", "委外费用", "费用计算公式", "备注"]


def q(name: str) -> str:
    return f"{{{MAIN_NS}}}{name}"


def col_to_num(col: str) -> int:
    total = 0
    for ch in col:
        total = total * 26 + ord(ch.upper()) - 64
    return total


def num_to_col(num: int) -> str:
    chars: list[str] = []
    while num:
        num, rem = divmod(num - 1, 26)
        chars.append(chr(65 + rem))
    return "".join(reversed(chars))


def cell_col(ref: str) -> int:
    return col_to_num("".join(ch for ch in ref if ch.isalpha()))


def cell_row(ref: str) -> int:
    return int("".join(ch for ch in ref if ch.isdigit()))


def sheet_paths(workdir: Path) -> dict[str, Path]:
    workbook = ET.parse(workdir / "xl/workbook.xml").getroot()
    rels = ET.parse(workdir / "xl/_rels/workbook.xml.rels").getroot()
    rel_by_id = {rel.attrib["Id"]: rel.attrib["Target"] for rel in rels}

    paths: dict[str, Path] = {}
    sheets = workbook.find("m:sheets", NS)
    if sheets is None:
        raise RuntimeError("Missing workbook sheets")
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


def load_shared_strings(workdir: Path) -> list[str]:
    shared_path = workdir / "xl/sharedStrings.xml"
    if not shared_path.exists():
        return []
    root = ET.parse(shared_path).getroot()
    values: list[str] = []
    for item in root.findall("m:si", NS):
        values.append("".join(text.text or "" for text in item.findall(".//m:t", NS)))
    return values


def cell_text(cell: ET.Element | None, shared_strings: list[str]) -> str | None:
    if cell is None:
        return None
    formula = cell.find("m:f", NS)
    if formula is not None:
        return f"={formula.text or ''}"
    value = cell.find("m:v", NS)
    if cell.attrib.get("t") == "inlineStr":
        inline = cell.find("m:is", NS)
        return "".join(text.text or "" for text in inline.findall(".//m:t", NS)) if inline is not None else ""
    if value is None or value.text is None:
        return None
    if cell.attrib.get("t") == "s":
        return shared_strings[int(value.text)]
    return value.text


def numeric(value: str | None) -> float:
    if value in (None, ""):
        return 0.0
    try:
        return float(str(value).replace(",", ""))
    except ValueError:
        return 0.0


def cached_numeric(cell: ET.Element | None) -> float:
    if cell is None:
        return 0.0
    value = cell.find("m:v", NS)
    return numeric(value.text if value is not None else None)


def get_cell(row: ET.Element, col_num: int) -> ET.Element | None:
    row_num = row.attrib["r"]
    ref = f"{num_to_col(col_num)}{row_num}"
    return row.find(f"m:c[@r='{ref}']", NS)


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


def shift_rows_down(root: ET.Element, start_row: int, amount: int) -> None:
    sheet_data = root.find("m:sheetData", NS)
    if sheet_data is None:
        raise RuntimeError("Missing sheetData")

    rows = sorted(sheet_data.findall("m:row", NS), key=lambda item: int(item.attrib["r"]), reverse=True)
    for row in rows:
        row_num = int(row.attrib["r"])
        if row_num < start_row:
            continue
        new_row_num = row_num + amount
        row.attrib["r"] = str(new_row_num)
        for cell in row.findall("m:c", NS):
            col = num_to_col(cell_col(cell.attrib["r"]))
            cell.attrib["r"] = f"{col}{new_row_num}"

    merge_cells = root.find("m:mergeCells", NS)
    if merge_cells is not None:
        for merge in merge_cells.findall("m:mergeCell", NS):
            merge.attrib["ref"] = shift_range_ref(merge.attrib["ref"], start_row, amount)


def shift_cell_ref(ref: str, start_row: int, amount: int) -> str:
    match = re.fullmatch(r"(\$?[A-Z]+)(\$?)(\d+)", ref)
    if not match:
        return ref
    col, dollar, row_text = match.groups()
    row_num = int(row_text)
    if row_num >= start_row:
        row_num += amount
    return f"{col}{dollar}{row_num}"


def shift_range_ref(ref: str, start_row: int, amount: int) -> str:
    parts = ref.split(":")
    return ":".join(shift_cell_ref(part, start_row, amount) for part in parts)


def insert_cell_sorted(row: ET.Element, cell: ET.Element) -> None:
    wanted = cell_col(cell.attrib["r"])
    cells = list(row.findall("m:c", NS))
    insert_at = len(cells)
    for idx, existing in enumerate(cells):
        if cell_col(existing.attrib["r"]) > wanted:
            insert_at = idx
            break
    row.insert(insert_at, cell)


def set_cell_preserve_style(cell: ET.Element, value: str | int | float | None) -> None:
    if value is None:
        reset_cell(cell)
    elif isinstance(value, (int, float)):
        set_number(cell, value)
    else:
        set_text(cell, value)


def set_row_values(row: ET.Element, values: list[str | int | float | None]) -> None:
    for idx, value in enumerate(values, start=1):
        cell = get_cell(row, idx)
        if cell is None:
            cell = ET.Element(q("c"), {"r": f"{num_to_col(idx)}{row.attrib['r']}"})
            insert_cell_sorted(row, cell)
        set_cell_preserve_style(cell, value)


def clear_cells(sheet_data: ET.Element, min_row: int, max_row: int, min_col: int, max_col: int) -> None:
    for row in sheet_data.findall("m:row", NS):
        row_num = int(row.attrib["r"])
        if row_num < min_row or row_num > max_row:
            continue
        for cell in list(row.findall("m:c", NS)):
            col = cell_col(cell.attrib["r"])
            if min_col <= col <= max_col:
                row.remove(cell)


def clone_template_cells(template_root: ET.Element) -> dict[tuple[int, int], ET.Element]:
    cells: dict[tuple[int, int], ET.Element] = {}
    for row in template_root.findall("m:sheetData/m:row", NS):
        row_num = int(row.attrib["r"])
        if not 10 <= row_num <= 28:
            continue
        for cell in row.findall("m:c", NS):
            col_num = cell_col(cell.attrib["r"])
            if 17 <= col_num <= 23:
                cells[(row_num, col_num)] = copy.deepcopy(cell)
    return cells


def clone_template_row_attrs(template_root: ET.Element) -> dict[int, dict[str, str]]:
    attrs: dict[int, dict[str, str]] = {}
    for row in template_root.findall("m:sheetData/m:row", NS):
        row_num = int(row.attrib["r"])
        if 10 <= row_num <= 28:
            attrs[row_num] = dict(row.attrib)
    return attrs


def apply_row_attrs(target_row: ET.Element, template_attrs: dict[str, str]) -> None:
    current_height = numeric(target_row.attrib.get("ht"))
    template_height = numeric(template_attrs.get("ht"))
    for key in ("s", "customFormat"):
        if key in template_attrs and key not in target_row.attrib:
            target_row.attrib[key] = template_attrs[key]
    if template_height and template_height > current_height:
        target_row.attrib["ht"] = template_attrs["ht"]
        target_row.attrib["customHeight"] = "1"
    target_row.attrib["spans"] = "1:23"


def reset_cell(cell: ET.Element) -> str | None:
    ref = cell.attrib["r"]
    style = cell.attrib.get("s")
    cell.clear()
    cell.attrib["r"] = ref
    if style is not None:
        cell.attrib["s"] = style
    return style


def set_number(cell: ET.Element, value: float | int | None) -> None:
    reset_cell(cell)
    if value is None:
        return
    v = ET.SubElement(cell, q("v"))
    v.text = str(int(value)) if float(value).is_integer() else str(value)


def set_text(cell: ET.Element, value: str) -> None:
    reset_cell(cell)
    cell.attrib["t"] = "inlineStr"
    inline = ET.SubElement(cell, q("is"))
    text = ET.SubElement(inline, q("t"))
    text.text = value


def set_formula(cell: ET.Element, formula: str, cached: float | int) -> None:
    reset_cell(cell)
    formula_el = ET.SubElement(cell, q("f"))
    formula_el.text = formula.removeprefix("=")
    value_el = ET.SubElement(cell, q("v"))
    value_el.text = str(int(cached)) if float(cached).is_integer() else str(cached)


def add_template_cell(row: ET.Element, template_cell: ET.Element, row_num: int, col_num: int) -> ET.Element:
    cell = copy.deepcopy(template_cell)
    cell.attrib["r"] = f"{num_to_col(col_num)}{row_num}"
    insert_cell_sorted(row, cell)
    return cell


def clone_row(root: ET.Element, row_num: int) -> ET.Element:
    row = root.find(f"m:sheetData/m:row[@r='{row_num}']", NS)
    if row is None:
        raise RuntimeError(f"Missing template row {row_num}")
    return copy.deepcopy(row)


def remove_intersecting_merges(root: ET.Element, min_row: int, max_row: int, min_col: int, max_col: int) -> None:
    merge_cells = root.find("m:mergeCells", NS)
    if merge_cells is None:
        return

    def intersects(ref: str) -> bool:
        start, _, end = ref.partition(":")
        end = end or start
        row1, row2 = cell_row(start), cell_row(end)
        col1, col2 = cell_col(start), cell_col(end)
        return row1 <= max_row and row2 >= min_row and col1 <= max_col and col2 >= min_col

    for merge in list(merge_cells.findall("m:mergeCell", NS)):
        if intersects(merge.attrib["ref"]):
            merge_cells.remove(merge)
    if len(list(merge_cells)) == 0:
        root.remove(merge_cells)
    else:
        merge_cells.attrib["count"] = str(len(list(merge_cells)))


def add_merge(root: ET.Element, ref: str) -> None:
    merge_cells = root.find("m:mergeCells", NS)
    if merge_cells is None:
        sheet_data = root.find("m:sheetData", NS)
        merge_cells = ET.Element(q("mergeCells"))
        children = list(root)
        insert_at = children.index(sheet_data) + 1 if sheet_data is not None else len(children)
        root.insert(insert_at, merge_cells)
    if not any(merge.attrib.get("ref") == ref for merge in merge_cells.findall("m:mergeCell", NS)):
        ET.SubElement(merge_cells, q("mergeCell"), {"ref": ref})
    merge_cells.attrib["count"] = str(len(list(merge_cells.findall("m:mergeCell", NS))))


def remove_merge(root: ET.Element, ref: str) -> None:
    merge_cells = root.find("m:mergeCells", NS)
    if merge_cells is None:
        return
    for merge in list(merge_cells.findall("m:mergeCell", NS)):
        if merge.attrib.get("ref") == ref:
            merge_cells.remove(merge)
    if len(list(merge_cells)) == 0:
        root.remove(merge_cells)
    else:
        merge_cells.attrib["count"] = str(len(list(merge_cells.findall("m:mergeCell", NS))))


def template_cols(template_root: ET.Element) -> list[ET.Element]:
    cols = template_root.find("m:cols", NS)
    if cols is None:
        return []
    result: list[ET.Element] = []
    for col in cols.findall("m:col", NS):
        min_col = int(col.attrib["min"])
        max_col = int(col.attrib["max"])
        if max_col >= 17 and min_col <= 23:
            cloned = copy.deepcopy(col)
            cloned.attrib["min"] = str(max(min_col, 17))
            cloned.attrib["max"] = str(min(max_col, 23))
            result.append(cloned)
    return result


def apply_template_cols(root: ET.Element, new_cols: list[ET.Element]) -> None:
    cols = root.find("m:cols", NS)
    if cols is None:
        cols = ET.Element(q("cols"))
        children = list(root)
        insert_at = 0
        for idx, child in enumerate(children):
            if child.tag in {q("sheetPr"), q("dimension"), q("sheetViews"), q("sheetFormatPr")}:
                insert_at = idx + 1
        root.insert(insert_at, cols)

    preserved: list[ET.Element] = []
    for col in cols.findall("m:col", NS):
        min_col = int(col.attrib["min"])
        max_col = int(col.attrib["max"])
        if max_col < 17 or min_col > 23:
            preserved.append(col)
            continue
        if min_col < 17:
            left = copy.deepcopy(col)
            left.attrib["max"] = "16"
            preserved.append(left)
        if max_col > 23:
            right = copy.deepcopy(col)
            right.attrib["min"] = "24"
            preserved.append(right)

    for col in list(cols.findall("m:col", NS)):
        cols.remove(col)
    for col in sorted([*preserved, *[copy.deepcopy(col) for col in new_cols]], key=lambda item: (int(item.attrib["min"]), int(item.attrib["max"]))):
        cols.append(col)


def update_dimension(root: ET.Element) -> None:
    max_row = 1
    max_col = 1
    sheet_data = root.find("m:sheetData", NS)
    if sheet_data is not None:
        for row in sheet_data.findall("m:row", NS):
            max_row = max(max_row, int(row.attrib["r"]))
            for cell in row.findall("m:c", NS):
                max_col = max(max_col, cell_col(cell.attrib["r"]))
    dimension = root.find("m:dimension", NS)
    if dimension is None:
        dimension = ET.Element(q("dimension"))
        root.insert(0, dimension)
    dimension.attrib["ref"] = f"A1:{num_to_col(max_col)}{max_row}"


def lab_group_totals(root: ET.Element, shared_strings: list[str]) -> dict[tuple[str, str], float]:
    totals: dict[tuple[str, str], float] = defaultdict(float)
    sheet_data = root.find("m:sheetData", NS)
    if sheet_data is None:
        return totals
    for row in sheet_data.findall("m:row", NS):
        phase = cell_text(get_cell(row, 3), shared_strings)
        group = cell_text(get_cell(row, 1), shared_strings)
        if phase not in {"DV", "PV"} or group not in GROUPS:
            continue
        totals[(phase, group)] += numeric(cell_text(get_cell(row, 12), shared_strings))
    return totals


def lab_additional_rows(lab_name: str, phase: str) -> list[list[str | int | float | None]]:
    additional = LAB_ADDITIONAL_FEES[lab_name]
    computer_fee = additional["computerUnit"] * COMPUTER_COEFFICIENT
    report_fee = additional["reportUnit"] * REPORT_COUNTS[phase]
    report_basis = f"{REPORT_COUNTS[phase]}份报告" if phase == "DV" else f"{REPORT_COUNTS[phase]} 份报告"
    return [
        [
            "Additional Fee",
            "1",
            phase,
            "费用汇总附加费用",
            "Computer fee",
            "Computer fee",
            None,
            "48 月/台系数",
            None,
            "按系数",
            f"{additional['computerUnit']}/月/台",
            computer_fee,
            f"{lab_name} {additional['computerUnit']}/月/台 × {COMPUTER_COEFFICIENT} = {format_whole_currency(computer_fee)}",
            f"Computer Fee 当前按 {lab_name} 报价计入",
        ],
        [
            "Additional Fee",
            "2",
            phase,
            "费用汇总附加费用",
            "Report fee",
            "Report fee",
            None,
            report_basis,
            None,
            "按报告份数",
            f"{additional['reportUnit']}/份",
            report_fee,
            f"{lab_name} {additional['reportUnit']}/份 × {REPORT_COUNTS[phase]} 份 = {format_whole_currency(report_fee)}",
            f"Report Fee 当前按 {lab_name} 报价计入",
        ],
    ]


def format_whole_currency(value: int | float) -> str:
    return f"{int(value):,}"


def find_pv_start_row(root: ET.Element, shared_strings: list[str]) -> int:
    sheet_data = root.find("m:sheetData", NS)
    if sheet_data is None:
        raise RuntimeError("Missing sheetData")
    for row in sheet_data.findall("m:row", NS):
        first = cell_text(get_cell(row, 1), shared_strings)
        if first == "PV 组别顺序":
            return int(row.attrib["r"])
    raise RuntimeError("Could not find PV section start")


def row_value(row: ET.Element, col_num: int, shared_strings: list[str]) -> str | None:
    return cell_text(get_cell(row, col_num), shared_strings)


def find_lab_style_templates(root: ET.Element, shared_strings: list[str], before_row: int | None = None) -> list[ET.Element]:
    sheet_data = root.find("m:sheetData", NS)
    if sheet_data is None:
        raise RuntimeError("Missing sheetData")

    candidates = [
        row
        for row in sheet_data.findall("m:row", NS)
        if (before_row is None or int(row.attrib["r"]) < before_row)
        and (row_value(row, 1, shared_strings) or "").startswith("Group")
        and "：" in (row_value(row, 1, shared_strings) or "")
    ]
    if not candidates:
        raise RuntimeError("Could not find lab group title style")

    title = candidates[-1]
    title_row_num = int(title.attrib["r"])
    header = sheet_data.find(f"m:row[@r='{title_row_num + 1}']", NS)
    data = sheet_data.find(f"m:row[@r='{title_row_num + 2}']", NS)
    if header is None or data is None:
        raise RuntimeError("Could not find lab header/data style rows")
    return [copy.deepcopy(title), copy.deepcopy(header), copy.deepcopy(data), copy.deepcopy(data)]


def insert_additional_block(
    root: ET.Element,
    insert_at: int,
    phase: str,
    lab_name: str,
    template_rows: list[ET.Element],
) -> None:
    sheet_data = root.find("m:sheetData", NS)
    if sheet_data is None:
        raise RuntimeError("Missing sheetData")

    shift_rows_down(root, insert_at, 4)
    title_row = copy.deepcopy(template_rows[0])
    header_row = copy.deepcopy(template_rows[1])
    computer_row = copy.deepcopy(template_rows[2])
    report_row = copy.deepcopy(template_rows[3])
    rows = [title_row, header_row, computer_row, report_row]
    for offset, row in enumerate(rows):
        row_num = insert_at + offset
        row.attrib["r"] = str(row_num)
        row.attrib["spans"] = "1:23"
        for cell in row.findall("m:c", NS):
            col = num_to_col(cell_col(cell.attrib["r"]))
            cell.attrib["r"] = f"{col}{row_num}"
        sheet_data.insert(row_insert_index(sheet_data, row_num), row)

    set_row_values(title_row, [f"{phase}附加费用", *([None] * 13)])
    set_row_values(header_row, LAB_HEADER)
    additional_rows = lab_additional_rows(lab_name, phase)
    set_row_values(computer_row, additional_rows[0])
    set_row_values(report_row, additional_rows[1])
    remove_merge(root, f"A{insert_at}:N{insert_at}")
    add_merge(root, f"A{insert_at}:N{insert_at}")


def row_insert_index(sheet_data: ET.Element, row_num: int) -> int:
    rows = list(sheet_data.findall("m:row", NS))
    for idx, row in enumerate(rows):
        if int(row.attrib["r"]) > row_num:
            return idx
    return len(rows)


def clear_existing_additional_blocks(root: ET.Element, shared_strings: list[str]) -> None:
    sheet_data = root.find("m:sheetData", NS)
    if sheet_data is None:
        return
    block_starts: list[tuple[int, int]] = []
    for row in sheet_data.findall("m:row", NS):
        first = cell_text(get_cell(row, 1), shared_strings)
        if first in {"DV附加费用", "PV附加费用"}:
            start = int(row.attrib["r"])
            next_row = sheet_data.find(f"m:row[@r='{start + 1}']", NS)
            count = 4 if row_value(next_row, 1, shared_strings) == "组别顺序" else 3
            block_starts.append((start, count))
    if not block_starts:
        return
    for start, count in sorted(block_starts, reverse=True):
        delete_rows(root, start, count)


def delete_rows(root: ET.Element, start_row: int, count: int) -> None:
    sheet_data = root.find("m:sheetData", NS)
    if sheet_data is None:
        return
    end_row = start_row + count - 1
    for row in list(sheet_data.findall("m:row", NS)):
        row_num = int(row.attrib["r"])
        if start_row <= row_num <= end_row:
            sheet_data.remove(row)
        elif row_num > end_row:
            new_row_num = row_num - count
            row.attrib["r"] = str(new_row_num)
            for cell in row.findall("m:c", NS):
                col = num_to_col(cell_col(cell.attrib["r"]))
                cell.attrib["r"] = f"{col}{new_row_num}"

    merge_cells = root.find("m:mergeCells", NS)
    if merge_cells is not None:
        for merge in list(merge_cells.findall("m:mergeCell", NS)):
            shifted = delete_rows_from_range_ref(merge.attrib["ref"], start_row, end_row, count)
            if shifted is None:
                merge_cells.remove(merge)
            else:
                merge.attrib["ref"] = shifted
        if len(list(merge_cells)) == 0:
            root.remove(merge_cells)
        else:
            merge_cells.attrib["count"] = str(len(list(merge_cells.findall("m:mergeCell", NS))))


def delete_rows_from_range_ref(ref: str, start_row: int, end_row: int, count: int) -> str | None:
    parts = ref.split(":")
    rows = [cell_row(part) for part in parts]
    if min(rows) <= end_row and max(rows) >= start_row:
        return None
    shifted_parts = []
    for part in parts:
        row_num = cell_row(part)
        if row_num > end_row:
            match = re.fullmatch(r"(\$?[A-Z]+)(\$?)(\d+)", part)
            if not match:
                shifted_parts.append(part)
                continue
            col, dollar, _row_text = match.groups()
            shifted_parts.append(f"{col}{dollar}{row_num - count}")
        else:
            shifted_parts.append(part)
    return ":".join(shifted_parts)


def add_lab_additional_fee_blocks(root: ET.Element, shared_strings: list[str], lab_name: str, template_root: ET.Element) -> None:
    clear_existing_additional_blocks(root, shared_strings)
    dv_insert = find_pv_start_row(root, shared_strings)
    dv_templates = find_lab_style_templates(root, shared_strings, before_row=dv_insert)
    insert_additional_block(root, dv_insert, "DV", lab_name, dv_templates)
    pv_insert = max_used_row(root) + 1
    pv_templates = find_lab_style_templates(root, shared_strings)
    insert_additional_block(root, pv_insert, "PV", lab_name, pv_templates)


def max_used_row(root: ET.Element) -> int:
    sheet_data = root.find("m:sheetData", NS)
    if sheet_data is None:
        return 1
    rows = [int(row.attrib["r"]) for row in sheet_data.findall("m:row", NS)]
    return max(rows) if rows else 1


def set_summary_values(root: ET.Element, shared_strings: list[str], lab_name: str) -> None:
    sheet_data = root.find("m:sheetData", NS)
    if sheet_data is None:
        raise RuntimeError(f"Missing sheetData in {lab_name}")
    totals = lab_group_totals(root, shared_strings)
    max_row = max_used_row(root)
    fee_range = f"$L$1:$L${max_row}"
    phase_range = f"$C$1:$C${max_row}"
    group_range = f"$A$1:$A${max_row}"
    additional = LAB_ADDITIONAL_FEES[lab_name]
    computer_fee = additional["computerUnit"] * COMPUTER_COEFFICIENT
    dv_report_fee = additional["reportUnit"] * REPORT_COUNTS["DV"]
    pv_report_fee = additional["reportUnit"] * REPORT_COUNTS["PV"]

    for idx, group in enumerate(GROUPS, start=12):
        row = sheet_data.find(f"m:row[@r='{idx}']", NS)
        if row is None:
            raise RuntimeError(f"Missing summary row {idx} in {lab_name}")
        cells = {num_to_col(col): get_cell(row, col) for col in range(17, 24)}
        if group == "Group D-8" and totals.get(("DV", group), 0) == 0:
            for col in ("R", "S", "T"):
                set_text(cells[col], "N/A")
        else:
            dv_total = totals.get(("DV", group), 0)
            set_formula(cells["R"], f'SUMIFS({fee_range},{phase_range},"DV",{group_range},$Q{idx})', dv_total)
            set_number(cells["S"], 0)
            set_formula(cells["T"], f'SUMIFS({fee_range},{phase_range},"DV",{group_range},$Q{idx})', dv_total)

        pv_total = totals.get(("PV", group), 0)
        set_formula(cells["U"], f'SUMIFS({fee_range},{phase_range},"PV",{group_range},$Q{idx})', pv_total)
        set_number(cells["V"], 0)
        set_formula(cells["W"], f'SUMIFS({fee_range},{phase_range},"PV",{group_range},$Q{idx})', pv_total)

    row_26 = sheet_data.find("m:row[@r='26']", NS)
    row_27 = sheet_data.find("m:row[@r='27']", NS)
    row_28 = sheet_data.find("m:row[@r='28']", NS)
    if row_26 is None or row_27 is None or row_28 is None:
        raise RuntimeError(f"Missing additional fee rows in {lab_name}")

    for row, dv_fee, pv_fee in ((row_26, computer_fee, computer_fee), (row_27, dv_report_fee, pv_report_fee)):
        cells = {num_to_col(col): get_cell(row, col) for col in range(17, 24)}
        set_number(cells["R"], dv_fee)
        set_number(cells["S"], None)
        set_number(cells["T"], dv_fee)
        set_number(cells["U"], pv_fee)
        set_number(cells["V"], None)
        set_number(cells["W"], pv_fee)

    dv_group_total = sum(totals.get(("DV", group), 0) for group in GROUPS)
    pv_group_total = sum(totals.get(("PV", group), 0) for group in GROUPS)
    total_cells = {num_to_col(col): get_cell(row_28, col) for col in range(17, 24)}
    set_formula(total_cells["R"], "SUM(R12:R27)", dv_group_total + computer_fee + dv_report_fee)
    set_formula(total_cells["S"], "SUM(S12:S25)", 0)
    set_formula(total_cells["T"], "SUM(T12:T25)", dv_group_total)
    set_formula(total_cells["U"], "SUM(U12:U27)", pv_group_total + computer_fee + pv_report_fee)
    set_formula(total_cells["V"], "SUM(V12:V25)", 0)
    set_formula(total_cells["W"], "SUM(W12:W25)", pv_group_total)


def normalize_fee_estimate_total_formulas(root: ET.Element) -> None:
    sheet_data = root.find("m:sheetData", NS)
    if sheet_data is None:
        raise RuntimeError("Missing sheetData in 费用预估")

    total_row = sheet_data.find("m:row[@r='28']", NS)
    if total_row is None:
        raise RuntimeError("Missing 费用预估 total row")

    formulas = {
        18: "SUM(R12:R27)",
        19: "SUM(S12:S25)",
        20: "SUM(T12:T25)",
        21: "SUM(U12:U27)",
        22: "SUM(V12:V25)",
        23: "SUM(W12:W25)",
    }
    for col_num, formula in formulas.items():
        cell = get_cell(total_row, col_num)
        if cell is None:
            raise RuntimeError(f"Missing 费用预估 total cell {num_to_col(col_num)}28")
        cached = cached_numeric(cell)
        set_formula(cell, formula, cached)


def apply_summary_template(
    root: ET.Element,
    template_cells: dict[tuple[int, int], ET.Element],
    template_row_attrs: dict[int, dict[str, str]],
) -> None:
    sheet_data = root.find("m:sheetData", NS)
    if sheet_data is None:
        raise RuntimeError("Missing sheetData")

    clear_cells(sheet_data, 1, 28, 15, 23)
    remove_intersecting_merges(root, 1, 28, 15, 23)

    for row_num in range(10, 29):
        row = get_or_create_row(sheet_data, row_num)
        apply_row_attrs(row, template_row_attrs[row_num])
        for col_num in range(17, 24):
            template_cell = template_cells.get((row_num, col_num))
            if template_cell is not None:
                add_template_cell(row, template_cell, row_num, col_num)

    add_merge(root, "Q10:W10")


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


def patch() -> None:
    OUTPUT.parent.mkdir(parents=True, exist_ok=True)
    with tempfile.TemporaryDirectory() as td:
        workdir = Path(td) / "xlsx"
        with zipfile.ZipFile(SOURCE) as workbook_zip:
            workbook_zip.extractall(workdir)

        paths = sheet_paths(workdir)
        shared_strings = load_shared_strings(workdir)
        template_tree = ET.parse(paths["费用预估"])
        template_root = template_tree.getroot()
        normalize_fee_estimate_total_formulas(template_root)
        template_tree.write(paths["费用预估"], encoding="UTF-8", xml_declaration=True)
        template_cells = clone_template_cells(template_root)
        template_row_attrs = clone_template_row_attrs(template_root)
        summary_cols = template_cols(template_root)

        for sheet_name in TARGET_SHEETS:
            tree = ET.parse(paths[sheet_name])
            root = tree.getroot()
            add_lab_additional_fee_blocks(root, shared_strings, sheet_name, template_root)
            apply_summary_template(root, template_cells, template_row_attrs)
            apply_template_cols(root, summary_cols)
            set_summary_values(root, shared_strings, sheet_name)
            update_dimension(root)
            tree.write(paths[sheet_name], encoding="UTF-8", xml_declaration=True)

        ensure_full_calc(workdir)

        if OUTPUT.exists():
            OUTPUT.unlink()
        subprocess.run(["zip", "-qr", str(OUTPUT), "."], cwd=workdir, check=True)

    shutil.copyfile(OUTPUT, SOURCE)


if __name__ == "__main__":
    patch()
    print(OUTPUT)
    print(SOURCE)
