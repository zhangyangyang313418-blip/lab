from __future__ import annotations

import copy
import re
import shutil
import subprocess
import tempfile
import zipfile
from pathlib import Path
import xml.etree.ElementTree as ET


INPUT = Path('/Users/clytia/Desktop/MLA测试项目及费用预估_费用预估页增加费用汇总_D8样品数更新.xlsx')
OUTPUT_DIR = Path('/Users/clytia/Desktop/Codex/产品测试流程自动化/outputs/workbook-edits/final')
OUTPUT = OUTPUT_DIR / 'MLA测试项目及费用预估_特殊项目标识_费用汇总补全.xlsx'

NS = {'m': 'http://schemas.openxmlformats.org/spreadsheetml/2006/main'}
MAIN_NS = NS['m']
ET.register_namespace('', MAIN_NS)

SPECIAL_CODES = {'K14', 'E-1', 'E-2'}
SUMMARY_ORDER = [
    'Group A',
    'Group B',
    'Group C',
    'Group D-1',
    'Group D-2',
    'Group D-3',
    'Group D-4',
    'Group D-5',
    'Group D-6',
    'Group D-7',
    'Group D-8',
    'Group D-9',
    'Group E-1',
    'Group E-2',
]
SUMMARY_ROW_BY_GROUP = {group: 12 + i for i, group in enumerate(SUMMARY_ORDER)}


def q(name: str) -> str:
    return f'{{{MAIN_NS}}}{name}'


def split_ref(ref: str) -> tuple[str, int]:
    match = re.fullmatch(r'([A-Z]+)([0-9]+)', ref)
    if not match:
        raise ValueError(f'Unsupported cell reference: {ref}')
    return match.group(1), int(match.group(2))


def cell_col(ref: str) -> str:
    return split_ref(ref)[0]


def shift_cell_ref(ref: str, inserted_before: list[int]) -> str:
    col, row = split_ref(ref)
    shift = sum(1 for before in inserted_before if row >= before)
    return f'{col}{row + shift}'


def shift_range_ref(ref: str, inserted_before: list[int]) -> str:
    if ':' not in ref:
        return shift_cell_ref(ref, inserted_before)
    left, right = ref.split(':', 1)
    return f'{shift_cell_ref(left, inserted_before)}:{shift_cell_ref(right, inserted_before)}'


def shift_formula(formula: str, inserted_before: list[int]) -> str:
    def repl(match: re.Match[str]) -> str:
        col = match.group(1)
        row = int(match.group(2))
        shift = sum(1 for before in inserted_before if row >= before)
        return f'{col}{row + shift}'

    return re.sub(r'(?<![A-Za-z0-9_])([A-Z]{1,3})([0-9]+)', repl, formula)


def set_cell_number(cell: ET.Element, value: float | int | None) -> None:
    cell.attrib.pop('t', None)
    for child in list(cell):
        cell.remove(child)
    if value is not None:
        v = ET.SubElement(cell, q('v'))
        v.text = str(int(value)) if float(value).is_integer() else str(value)


def set_cell_formula(cell: ET.Element, formula: str, cached_value: float | int | None) -> None:
    cell.attrib.pop('t', None)
    for child in list(cell):
        cell.remove(child)
    f = ET.SubElement(cell, q('f'))
    f.text = formula
    if cached_value is not None:
        v = ET.SubElement(cell, q('v'))
        v.text = str(int(cached_value)) if float(cached_value).is_integer() else str(cached_value)


def formula_cached_value(row: ET.Element, col: str) -> float | int | None:
    val = cell_value(row, col)
    return val if isinstance(val, (int, float)) else None


def cell_value(row: ET.Element, col: str) -> float | str | None:
    cell = row.find(f"m:c[@r='{col}{row.attrib['r']}']", NS)
    if cell is None:
        return None
    v = cell.find('m:v', NS)
    if v is None or v.text is None:
        return None
    if cell.attrib.get('t') == 's':
        return v.text
    try:
        num = float(v.text)
    except ValueError:
        return v.text
    return int(num) if num.is_integer() else num


def row_cells(row: ET.Element) -> list[ET.Element]:
    return list(row.findall('m:c', NS))


def get_or_create_cell(row: ET.Element, col: str, style: str | None = None) -> ET.Element:
    row_num = int(row.attrib['r'])
    ref = f'{col}{row_num}'
    cell = row.find(f"m:c[@r='{ref}']", NS)
    if cell is not None:
        return cell
    cell = ET.Element(q('c'), {'r': ref})
    if style is not None:
        cell.attrib['s'] = style
    cells = row_cells(row)
    insert_at = len(cells)
    wanted = col_to_num(col)
    for idx, existing in enumerate(cells):
        if col_to_num(cell_col(existing.attrib['r'])) > wanted:
            insert_at = idx
            break
    row.insert(insert_at, cell)
    return cell


def col_to_num(col: str) -> int:
    n = 0
    for ch in col:
        n = n * 26 + ord(ch) - 64
    return n


def add_shared_string(root: ET.Element, text: str) -> int:
    sis = root.findall('m:si', NS)
    for idx, si in enumerate(sis):
        t = si.find('m:t', NS)
        if t is not None and t.text == text:
            return idx
    si = ET.SubElement(root, q('si'))
    t = ET.SubElement(si, q('t'))
    t.text = text
    count = int(root.attrib.get('count', str(len(sis))))
    unique = int(root.attrib.get('uniqueCount', str(len(sis))))
    root.attrib['count'] = str(count + 1)
    root.attrib['uniqueCount'] = str(unique + 1)
    return len(sis)


def clone_total_row(template_row: ET.Element, new_row_num: int, label_idx: int, start_row: int, end_row: int, totals: dict[str, float]) -> ET.Element:
    row = copy.deepcopy(template_row)
    row.attrib['r'] = str(new_row_num)
    row.attrib.pop('ht', None)
    row.attrib['spans'] = '1:15'
    for cell in row_cells(row):
        col = cell_col(cell.attrib['r'])
        cell.attrib['r'] = f'{col}{new_row_num}'
        if col == 'A':
            for child in list(cell):
                cell.remove(child)
            cell.attrib['t'] = 's'
            v = ET.SubElement(cell, q('v'))
            v.text = str(label_idx)
        elif col in {'K', 'L', 'M'}:
            formula = f'SUM({col}{start_row}:{col}{end_row})'
            set_cell_formula(cell, formula, totals[col])
        else:
            for child in list(cell):
                cell.remove(child)
            cell.attrib.pop('t', None)
    return row


def compute_group_blocks(rows: list[ET.Element], shared: list[str]) -> list[dict[str, object]]:
    def shared_text(row: ET.Element, col: str) -> str | None:
        row_num = int(row.attrib['r'])
        cell = row.find(f"m:c[@r='{col}{row_num}']", NS)
        if cell is None or cell.attrib.get('t') != 's':
            return None
        v = cell.find('m:v', NS)
        if v is None or v.text is None:
            return None
        idx = int(v.text)
        return shared[idx] if idx < len(shared) else None

    blocks = []
    section_rows = []
    for row in rows:
        row_num = int(row.attrib['r'])
        a_text = shared_text(row, 'A')
        if a_text and re.match(r'^Group .+：', a_text):
            group = a_text.split('：', 1)[0]
            phase = 'PV' if '：PV /' in a_text else 'DV'
            section_rows.append({
                'group': group,
                'phase': phase,
                'section_row': row_num,
                'header_row': row_num + 1,
                'data_start': row_num + 2,
            })

    for section in section_rows:
        group = section['group']
        phase = section['phase']
        data_rows = []
        total_row = None
        for row in rows:
            row_num = int(row.attrib['r'])
            if row_num <= section['header_row']:
                continue
            a_text = shared_text(row, 'A')
            c_text = shared_text(row, 'C')
            if a_text == group and c_text == phase:
                data_rows.append(row_num)
            if a_text == f'{group} Total Cost':
                total_row = row_num
        if not data_rows:
            continue
        block = dict(section)
        block['last_data_row'] = max(data_rows)
        block['insert_before'] = (total_row + 1) if total_row is not None else (max(data_rows) + 1)
        block['existing_total_row'] = total_row
        blocks.append(block)
    return blocks


def build_special_styles(styles_root: ET.Element, base_style_ids: set[str]) -> dict[str, str]:
    fills = styles_root.find('m:fills', NS)
    cell_xfs = styles_root.find('m:cellXfs', NS)
    if fills is None or cell_xfs is None:
        raise RuntimeError('styles.xml missing fills or cellXfs')

    fill = ET.SubElement(fills, q('fill'))
    pattern = ET.SubElement(fill, q('patternFill'), {'patternType': 'solid'})
    ET.SubElement(pattern, q('fgColor'), {'rgb': 'FFFFE2CC'})
    ET.SubElement(pattern, q('bgColor'), {'indexed': '64'})
    fill_id = str(len(fills.findall('m:fill', NS)) - 1)
    fills.attrib['count'] = str(len(fills.findall('m:fill', NS)))

    style_map = {}
    xfs = cell_xfs.findall('m:xf', NS)
    for base_id in sorted(base_style_ids, key=int):
        base = xfs[int(base_id)]
        xf = copy.deepcopy(base)
        xf.attrib['fillId'] = fill_id
        xf.attrib['applyFill'] = '1'
        cell_xfs.append(xf)
        style_map[base_id] = str(len(cell_xfs.findall('m:xf', NS)) - 1)
    cell_xfs.attrib['count'] = str(len(cell_xfs.findall('m:xf', NS)))
    return style_map


def patch() -> None:
    OUTPUT_DIR.mkdir(parents=True, exist_ok=True)
    with tempfile.TemporaryDirectory() as td:
        workdir = Path(td) / 'xlsx'
        with zipfile.ZipFile(INPUT) as zf:
            zf.extractall(workdir)

        shared_tree = ET.parse(workdir / 'xl/sharedStrings.xml')
        shared_root = shared_tree.getroot()
        shared_strings = [
            (si.find('m:t', NS).text if si.find('m:t', NS) is not None else '')
            for si in shared_root.findall('m:si', NS)
        ]

        sheet_tree = ET.parse(workdir / 'xl/worksheets/sheet1.xml')
        sheet_root = sheet_tree.getroot()
        sheet_data = sheet_root.find('m:sheetData', NS)
        if sheet_data is None:
            raise RuntimeError('sheet1.xml missing sheetData')
        rows = list(sheet_data.findall('m:row', NS))
        blocks = compute_group_blocks(rows, shared_strings)

        insert_blocks = [b for b in blocks if not (b['group'] == 'Group A' and b['phase'] == 'DV')]
        for b in insert_blocks:
            b['insert_at'] = int(b['insert_before'])
            b['label'] = f"{b['group']} Total Cost"
            b['label_idx'] = add_shared_string(shared_root, b['label'])
        shared_tree.write(workdir / 'xl/sharedStrings.xml', encoding='UTF-8', xml_declaration=True)

        # Refresh shared string lookup after appending labels.
        shared_strings = [
            (si.find('m:t', NS).text if si.find('m:t', NS) is not None else '')
            for si in shared_root.findall('m:si', NS)
        ]

        insert_before = sorted(int(b['insert_at']) for b in insert_blocks)
        old_to_new: dict[int, int] = {}
        for row in rows:
            old = int(row.attrib['r'])
            old_to_new[old] = old + sum(1 for before in insert_before if old >= before)

        # Shift existing rows and cell references first.
        for row in rows:
            old = int(row.attrib['r'])
            new = old_to_new[old]
            row.attrib['r'] = str(new)
            for cell in row_cells(row):
                col, _ = split_ref(cell.attrib['r'])
                cell.attrib['r'] = f'{col}{new}'
                f = cell.find('m:f', NS)
                if f is not None and f.text:
                    f.text = shift_formula(f.text, insert_before)

        total_template = next(row for row in rows if old_to_new.get(52) == int(row.attrib['r']))
        new_rows = []
        for b in insert_blocks:
            original_insert_at = int(b['insert_at'])
            new_row_num = original_insert_at + sum(1 for before in insert_before if before < original_insert_at)
            start = old_to_new[int(b['data_start'])]
            end = old_to_new[int(b['last_data_row'])]
            totals = {'K': 0.0, 'L': 0.0, 'M': 0.0}
            for row in rows:
                row_num = int(row.attrib['r'])
                if start <= row_num <= end:
                    for col in totals:
                        val = cell_value(row, col)
                        if isinstance(val, (int, float)):
                            totals[col] += float(val)
            new_rows.append(
                clone_total_row(total_template, new_row_num, int(b['label_idx']), start, end, totals)
            )
            b['total_row_new'] = new_row_num

        all_rows = sorted(rows + new_rows, key=lambda r: int(r.attrib['r']))
        sheet_data[:] = all_rows

        # Apply special project color to rows whose test code is listed in SPECIAL_CODES.
        styles_tree = ET.parse(workdir / 'xl/styles.xml')
        styles_root = styles_tree.getroot()
        special_rows = []
        base_style_ids: set[str] = set()
        for row in all_rows:
            row_num = int(row.attrib['r'])
            d = row.find(f"m:c[@r='D{row_num}']", NS)
            if d is None or d.attrib.get('t') != 's':
                continue
            v = d.find('m:v', NS)
            code = shared_strings[int(v.text)] if v is not None and v.text is not None else ''
            if code in SPECIAL_CODES:
                special_rows.append(row)
                for cell in row_cells(row):
                    if 1 <= col_to_num(cell_col(cell.attrib['r'])) <= 15:
                        base_style_ids.add(cell.attrib.get('s', '0'))
        special_style_map = build_special_styles(styles_root, base_style_ids) if base_style_ids else {}
        for row in special_rows:
            for cell in row_cells(row):
                if 1 <= col_to_num(cell_col(cell.attrib['r'])) <= 15:
                    base = cell.attrib.get('s', '0')
                    cell.attrib['s'] = special_style_map.get(base, base)
        styles_tree.write(workdir / 'xl/styles.xml', encoding='UTF-8', xml_declaration=True)

        # Merge ranges: shift existing ranges and add the two Group Total Cost merges for each new row.
        merge_cells = sheet_root.find('m:mergeCells', NS)
        if merge_cells is not None:
            for merge_cell in merge_cells.findall('m:mergeCell', NS):
                merge_cell.attrib['ref'] = shift_range_ref(merge_cell.attrib['ref'], insert_before)
            for b in insert_blocks:
                row_num = int(b['total_row_new'])
                ET.SubElement(merge_cells, q('mergeCell'), {'ref': f'A{row_num}:J{row_num}'})
                ET.SubElement(merge_cells, q('mergeCell'), {'ref': f'N{row_num}:O{row_num}'})
            merge_cells.attrib['count'] = str(len(merge_cells.findall('m:mergeCell', NS)))

        # Top summary formulas link to the inserted group total rows.
        phase_group_to_total = {('DV', 'Group A'): old_to_new[52]}
        for b in insert_blocks:
            phase_group_to_total[(str(b['phase']), str(b['group']))] = int(b['total_row_new'])

        for group, summary_row in SUMMARY_ROW_BY_GROUP.items():
            row = next((r for r in all_rows if int(r.attrib['r']) == summary_row), None)
            if row is None:
                continue
            b_cell = get_or_create_cell(row, 'B', '107')
            c_cell = get_or_create_cell(row, 'C', '107')
            if ('DV', group) in phase_group_to_total:
                total_row = phase_group_to_total[('DV', group)]
                target_row = next(r for r in all_rows if int(r.attrib['r']) == total_row)
                set_cell_formula(b_cell, f'M{total_row}', formula_cached_value(target_row, 'M'))
            else:
                set_cell_number(b_cell, None)
            if ('PV', group) in phase_group_to_total:
                total_row = phase_group_to_total[('PV', group)]
                target_row = next(r for r in all_rows if int(r.attrib['r']) == total_row)
                set_cell_formula(c_cell, f'M{total_row}', formula_cached_value(target_row, 'M'))
            else:
                set_cell_number(c_cell, None)

        total_row = next(r for r in all_rows if int(r.attrib['r']) == 26)
        dv_total = 0.0
        pv_total = 0.0
        for summary_row in SUMMARY_ROW_BY_GROUP.values():
            row = next((r for r in all_rows if int(r.attrib['r']) == summary_row), None)
            if row is None:
                continue
            b_val = formula_cached_value(row, 'B')
            c_val = formula_cached_value(row, 'C')
            if b_val is not None:
                dv_total += b_val
            if c_val is not None:
                pv_total += c_val
        set_cell_formula(get_or_create_cell(total_row, 'B', '107'), 'SUM(B12:B25)', dv_total)
        set_cell_formula(get_or_create_cell(total_row, 'C', '107'), 'SUM(C12:C25)', pv_total)

        # Expand dimension.
        dimension = sheet_root.find('m:dimension', NS)
        if dimension is not None:
            dimension.attrib['ref'] = f'A1:Q{255 + len(insert_blocks)}'

        sheet_tree.write(workdir / 'xl/worksheets/sheet1.xml', encoding='UTF-8', xml_declaration=True)

        # Keep table metadata coherent with the larger worksheet.
        table_path = workdir / 'xl/tables/table1.xml'
        if table_path.exists():
            table_tree = ET.parse(table_path)
            table_root = table_tree.getroot()
            if table_root.attrib.get('ref') == 'A1:O255':
                table_root.attrib['ref'] = f'A1:O{255 + len(insert_blocks)}'
            table_tree.write(table_path, encoding='UTF-8', xml_declaration=True)

        # Ask Excel-compatible apps to recalculate formulas when opened.
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
