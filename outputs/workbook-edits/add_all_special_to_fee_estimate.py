from __future__ import annotations

import copy
import re
import subprocess
import tempfile
import zipfile
from pathlib import Path
import xml.etree.ElementTree as ET


INPUT = Path('/Users/clytia/Desktop/Codex/产品测试流程自动化/outputs/workbook-edits/final/MLA测试项目及费用预估_特殊项目标识_费用汇总补全.xlsx')
OUTPUT_DIR = Path('/Users/clytia/Desktop/Codex/产品测试流程自动化/outputs/workbook-edits/final')
OUTPUT = OUTPUT_DIR / 'MLA测试项目及费用预估_全部特殊项目标识_费用汇总补全.xlsx'

NS = {'m': 'http://schemas.openxmlformats.org/spreadsheetml/2006/main'}
MAIN_NS = NS['m']
ET.register_namespace('', MAIN_NS)


def q(name: str) -> str:
    return f'{{{MAIN_NS}}}{name}'


def split_ref(ref: str) -> tuple[str, int]:
    match = re.fullmatch(r'([A-Z]+)([0-9]+)', ref)
    if not match:
        raise ValueError(f'Unsupported ref: {ref}')
    return match.group(1), int(match.group(2))


def col_to_num(col: str) -> int:
    n = 0
    for ch in col:
        n = n * 26 + ord(ch) - 64
    return n


def cell_col(ref: str) -> str:
    return split_ref(ref)[0]


def shift_amount(row: int, insertions: list[tuple[int, int]]) -> int:
    return sum(count for before, count in insertions if row >= before)


def shift_cell_ref(ref: str, insertions: list[tuple[int, int]]) -> str:
    col, row = split_ref(ref)
    return f'{col}{row + shift_amount(row, insertions)}'


def shift_range_ref(ref: str, insertions: list[tuple[int, int]]) -> str:
    if ':' not in ref:
        return shift_cell_ref(ref, insertions)
    left, right = ref.split(':', 1)
    return f'{shift_cell_ref(left, insertions)}:{shift_cell_ref(right, insertions)}'


def shift_formula(formula: str, insertions: list[tuple[int, int]]) -> str:
    def repl(match: re.Match[str]) -> str:
        col = match.group(1)
        row = int(match.group(2))
        return f'{col}{row + shift_amount(row, insertions)}'

    return re.sub(r'(?<![A-Za-z0-9_])([A-Z]{1,3})([0-9]+)', repl, formula)


def row_cells(row: ET.Element) -> list[ET.Element]:
    return list(row.findall('m:c', NS))


def add_shared_string(root: ET.Element, text: str) -> int:
    sis = root.findall('m:si', NS)
    for idx, si in enumerate(sis):
        t = si.find('m:t', NS)
        if t is not None and t.text == text:
            return idx
    si = ET.SubElement(root, q('si'))
    t = ET.SubElement(si, q('t'))
    t.text = text
    root.attrib['count'] = str(int(root.attrib.get('count', str(len(sis)))) + 1)
    root.attrib['uniqueCount'] = str(int(root.attrib.get('uniqueCount', str(len(sis)))) + 1)
    return len(sis)


def set_string(cell: ET.Element, shared_idx: int) -> None:
    for child in list(cell):
        cell.remove(child)
    cell.attrib['t'] = 's'
    v = ET.SubElement(cell, q('v'))
    v.text = str(shared_idx)


def set_number(cell: ET.Element, value: int | float | None) -> None:
    for child in list(cell):
        cell.remove(child)
    cell.attrib.pop('t', None)
    if value is not None:
        v = ET.SubElement(cell, q('v'))
        v.text = str(int(value)) if float(value).is_integer() else str(value)


def set_formula(cell: ET.Element, formula: str, cached: int | float | None) -> None:
    for child in list(cell):
        cell.remove(child)
    cell.attrib.pop('t', None)
    f = ET.SubElement(cell, q('f'))
    f.text = formula
    if cached is not None:
        v = ET.SubElement(cell, q('v'))
        v.text = str(int(cached)) if float(cached).is_integer() else str(cached)


def get_or_create_cell(row: ET.Element, col: str, style: str | None = None) -> ET.Element:
    row_num = int(row.attrib['r'])
    ref = f'{col}{row_num}'
    cell = row.find(f"m:c[@r='{ref}']", NS)
    if cell is not None:
        return cell
    cell = ET.Element(q('c'), {'r': ref})
    if style is not None:
        cell.attrib['s'] = style
    wanted = col_to_num(col)
    cells = row_cells(row)
    insert_at = len(cells)
    for idx, existing in enumerate(cells):
        if col_to_num(cell_col(existing.attrib['r'])) > wanted:
            insert_at = idx
            break
    row.insert(insert_at, cell)
    return cell


def shown(row: ET.Element, col: str, shared: list[str]) -> str | None:
    row_num = int(row.attrib['r'])
    cell = row.find(f"m:c[@r='{col}{row_num}']", NS)
    if cell is None:
        return None
    v = cell.find('m:v', NS)
    if v is None or v.text is None:
        return None
    if cell.attrib.get('t') == 's':
        return shared[int(v.text)]
    return v.text


def value(row: ET.Element, col: str) -> float | None:
    row_num = int(row.attrib['r'])
    cell = row.find(f"m:c[@r='{col}{row_num}']", NS)
    if cell is None:
        return None
    v = cell.find('m:v', NS)
    if v is None or v.text is None:
        return None
    try:
        return float(v.text)
    except ValueError:
        return None


def set_row_number(row: ET.Element, row_num: int) -> None:
    row.attrib['r'] = str(row_num)
    for cell in row_cells(row):
        col = cell_col(cell.attrib['r'])
        cell.attrib['r'] = f'{col}{row_num}'


def blank_clone(template: ET.Element, row_num: int) -> ET.Element:
    row = copy.deepcopy(template)
    set_row_number(row, row_num)
    row.attrib['spans'] = '1:15'
    return row


def build_section_row(template: ET.Element, row_num: int, label_idx: int) -> ET.Element:
    row = blank_clone(template, row_num)
    for cell in row_cells(row):
        col = cell_col(cell.attrib['r'])
        if col == 'A':
            set_string(cell, label_idx)
        else:
            set_number(cell, None)
    return row


def build_data_row(template: ET.Element, row_num: int, row_values: list[object], shared_root: ET.Element) -> ET.Element:
    row = blank_clone(template, row_num)
    for idx, col in enumerate('ABCDEFGHIJKLMNO'):
        cell = get_or_create_cell(row, col)
        val = row_values[idx]
        if val is None:
            set_number(cell, None)
        elif isinstance(val, (int, float)):
            set_number(cell, val)
        else:
            set_string(cell, add_shared_string(shared_root, str(val)))
    return row


def build_total_row(template: ET.Element, row_num: int, label_idx: int, data_row_num: int, outsourced_fee: int) -> ET.Element:
    row = blank_clone(template, row_num)
    for cell in row_cells(row):
        col = cell_col(cell.attrib['r'])
        if col == 'A':
            set_string(cell, label_idx)
        elif col == 'K':
            set_formula(cell, f'SUM(K{data_row_num}:K{data_row_num})', 0)
        elif col == 'L':
            set_formula(cell, f'SUM(L{data_row_num}:L{data_row_num})', outsourced_fee)
        elif col == 'M':
            set_formula(cell, f'SUM(M{data_row_num}:M{data_row_num})', outsourced_fee)
        else:
            set_number(cell, None)
    return row


def patch() -> None:
    OUTPUT_DIR.mkdir(parents=True, exist_ok=True)
    with tempfile.TemporaryDirectory() as td:
        workdir = Path(td) / 'xlsx'
        with zipfile.ZipFile(INPUT) as zf:
            zf.extractall(workdir)

        shared_tree = ET.parse(workdir / 'xl/sharedStrings.xml')
        shared_root = shared_tree.getroot()
        shared = [
            (si.find('m:t', NS).text if si.find('m:t', NS) is not None else '')
            for si in shared_root.findall('m:si', NS)
        ]

        sheet_tree = ET.parse(workdir / 'xl/worksheets/sheet1.xml')
        sheet = sheet_tree.getroot()
        sheet_data = sheet.find('m:sheetData', NS)
        rows = list(sheet_data.findall('m:row', NS))
        by_old = {int(row.attrib['r']): row for row in rows}

        insertions = [(145, 8), (278, 8)]
        for row in rows:
            old = int(row.attrib['r'])
            new = old + shift_amount(old, insertions)
            set_row_number(row, new)
            for cell in row_cells(row):
                f = cell.find('m:f', NS)
                if f is not None and f.text:
                    f.text = shift_formula(f.text, insertions)

        section_dv_template = by_old[136]
        header_template = by_old[137]
        data_template = by_old[48]
        total_template = by_old[52]
        section_pv_template = by_old[269]

        new_rows: list[ET.Element] = []
        special_rows = [
            {
                'row': 145,
                'section_template': section_dv_template,
                'section': 'Group E-1：DV / Group F Other Tests / Restricted Substance',
                'label': 'Group E-1 Total Cost',
                'data': ['Group E-1', 1, 'DV', 'E-1', 'E-1 Restricted Substance Management', '83', '1 个样品', '960 h', '固定总价', '委外费用', None, 20000, 20000, '固定总价 20000 (含评估费 1500)', '禁限用物质总价 20000，其中 1500 为评估费'],
            },
            {
                'row': 149,
                'section_template': section_dv_template,
                'section': 'Group E-2：DV / Group F Other Tests / Noise test',
                'label': 'Group E-2 Total Cost',
                'data': ['Group E-2', 1, 'DV', 'E-2', 'E-2 Operating Noise & Transient Noise', '84-108', '25 个样品', '480 h', '按样品数量', '委外费用', None, 42500, 42500, '25台样机 × 1700/台 = 42,500', '操作噪声暂按 SGS 合作价 1700/台样机计算'],
            },
            {
                'row': 286,
                'section_template': section_pv_template,
                'section': 'Group E-1：PV / Group F Other Tests / Restricted Substance',
                'label': 'Group E-1 Total Cost',
                'data': ['Group E-1', 1, 'PV', 'E-1', 'E-1 Restricted Substance Management', '98', '1 个样品', '960 h', '固定总价', '委外费用', None, 20000, 20000, '固定总价 20000 (含评估费 1500)', '禁限用物质总价 20000，其中 1500 为评估费'],
            },
            {
                'row': 290,
                'section_template': section_pv_template,
                'section': 'Group E-2：PV / Group F Other Tests / Noise test',
                'label': 'Group E-2 Total Cost',
                'data': ['Group E-2', 1, 'PV', 'E-2', 'E-2 Operating Noise & Transient Noise', '99-123', '25 个样品', '480 h', '按样品数量', '委外费用', None, 42500, 42500, '25台样机 × 1700/台 = 42,500', '操作噪声暂按 SGS 合作价 1700/台样机计算'],
            },
        ]

        for item in special_rows:
            base_row = int(item['row'])
            label_idx = add_shared_string(shared_root, item['section'])
            total_label_idx = add_shared_string(shared_root, item['label'])
            new_rows.append(build_section_row(item['section_template'], base_row, label_idx))
            new_rows.append(blank_clone(header_template, base_row + 1))
            new_rows.append(build_data_row(data_template, base_row + 2, item['data'], shared_root))
            new_rows.append(build_total_row(total_template, base_row + 3, total_label_idx, base_row + 2, int(item['data'][12])))

        # Update group order notes.
        shared = [
            (si.find('m:t', NS).text if si.find('m:t', NS) is not None else '')
            for si in shared_root.findall('m:si', NS)
        ]
        dv_order = 'Group A -> Group B -> Group C -> Group D-1 -> Group D-2 -> Group D-3 -> Group D-4 -> Group D-5 -> Group D-6 -> Group D-7 -> Group D-9 -> Group E-1 -> Group E-2'
        pv_order = 'Group A -> Group B -> Group C -> Group D-1 -> Group D-2 -> Group D-3 -> Group D-4 -> Group D-5 -> Group D-6 -> Group D-7 -> Group D-8 -> Group D-9 -> Group E-1 -> Group E-2'
        for row_num, text in [(28, dv_order), (154, pv_order)]:
            row = next(r for r in rows if int(r.attrib['r']) == row_num)
            set_string(get_or_create_cell(row, 'B'), add_shared_string(shared_root, text))

        # Top summary formulas for Group E-1/E-2 and refreshed totals.
        top_map = {
            'B24': ('M148', 20000),
            'B25': ('M152', 42500),
            'C24': ('M289', 20000),
            'C25': ('M293', 42500),
            'B26': ('SUM(B12:B25)', 798078),
            'C26': ('SUM(C12:C25)', 848318),
        }
        for ref, (formula, cached) in top_map.items():
            col, row_num = split_ref(ref)
            row = next(r for r in rows if int(r.attrib['r']) == row_num)
            set_formula(get_or_create_cell(row, col, '107'), formula, cached)

        all_rows = sorted(rows + new_rows, key=lambda row: int(row.attrib['r']))
        sheet_data[:] = all_rows

        merge_cells = sheet.find('m:mergeCells', NS)
        if merge_cells is not None:
            for merge_cell in merge_cells.findall('m:mergeCell', NS):
                merge_cell.attrib['ref'] = shift_range_ref(merge_cell.attrib['ref'], insertions)
            for base_row in [145, 149, 286, 290]:
                ET.SubElement(merge_cells, q('mergeCell'), {'ref': f'A{base_row}:O{base_row}'})
                ET.SubElement(merge_cells, q('mergeCell'), {'ref': f'A{base_row + 3}:J{base_row + 3}'})
                ET.SubElement(merge_cells, q('mergeCell'), {'ref': f'N{base_row + 3}:O{base_row + 3}'})
            merge_cells.attrib['count'] = str(len(merge_cells.findall('m:mergeCell', NS)))

        dimension = sheet.find('m:dimension', NS)
        if dimension is not None:
            dimension.attrib['ref'] = 'A1:Q293'

        shared_tree.write(workdir / 'xl/sharedStrings.xml', encoding='UTF-8', xml_declaration=True)
        sheet_tree.write(workdir / 'xl/worksheets/sheet1.xml', encoding='UTF-8', xml_declaration=True)

        workbook_tree = ET.parse(workdir / 'xl/workbook.xml')
        workbook_root = workbook_tree.getroot()
        calc_pr = workbook_root.find('m:calcPr', NS)
        if calc_pr is None:
            calc_pr = ET.SubElement(workbook_root, q('calcPr'))
        calc_pr.attrib['fullCalcOnLoad'] = '1'
        calc_pr.attrib['forceFullCalc'] = '1'
        workbook_tree.write(workdir / 'xl/workbook.xml', encoding='UTF-8', xml_declaration=True)

        if OUTPUT.exists():
            OUTPUT.unlink()
        subprocess.run(['zip', '-qr', str(OUTPUT), '.'], cwd=workdir, check=True)


if __name__ == '__main__':
    patch()
    print(OUTPUT)
