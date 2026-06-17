from __future__ import annotations

import subprocess
import tempfile
import zipfile
from pathlib import Path
import xml.etree.ElementTree as ET


INPUT = Path('/Users/clytia/Desktop/Codex/产品测试流程自动化/outputs/workbook-edits/final/MLA测试项目及费用预估_全部特殊项目标识_费用汇总补全.xlsx')
OUTPUT = Path('/Users/clytia/Desktop/Codex/产品测试流程自动化/outputs/workbook-edits/final/MLA测试项目及费用预估_全部特殊项目标识_费用汇总补全_蓝色费用表格已填写.xlsx')

NS = {'m': 'http://schemas.openxmlformats.org/spreadsheetml/2006/main'}
MAIN_NS = NS['m']
ET.register_namespace('', MAIN_NS)


def q(name: str) -> str:
    return f'{{{MAIN_NS}}}{name}'


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


def cell(row: ET.Element, col: str) -> ET.Element:
    row_num = row.attrib['r']
    found = row.find(f"m:c[@r='{col}{row_num}']", NS)
    if found is not None:
        return found
    created = ET.Element(q('c'), {'r': f'{col}{row_num}'})
    row.append(created)
    return created


def set_formula(c: ET.Element, formula: str, cached: float | int) -> None:
    style = c.attrib.get('s')
    ref = c.attrib['r']
    c.clear()
    c.attrib['r'] = ref
    if style is not None:
        c.attrib['s'] = style
    f = ET.SubElement(c, q('f'))
    f.text = formula
    v = ET.SubElement(c, q('v'))
    v.text = str(int(cached)) if float(cached).is_integer() else str(cached)


def set_text(c: ET.Element, shared_idx: int) -> None:
    style = c.attrib.get('s')
    ref = c.attrib['r']
    c.clear()
    c.attrib['r'] = ref
    if style is not None:
        c.attrib['s'] = style
    c.attrib['t'] = 's'
    v = ET.SubElement(c, q('v'))
    v.text = str(shared_idx)


def numeric_value(c: ET.Element | None) -> float:
    if c is None:
        return 0.0
    v = c.find('m:v', NS)
    if v is None or v.text is None:
        return 0.0
    try:
        return float(v.text)
    except ValueError:
        return 0.0


def get_cell(sheet: ET.Element, ref: str) -> ET.Element | None:
    return sheet.find(f".//m:c[@r='{ref}']", NS)


def patch() -> None:
    with tempfile.TemporaryDirectory() as td:
        workdir = Path(td) / 'xlsx'
        with zipfile.ZipFile(INPUT) as zf:
            zf.extractall(workdir)

        shared_tree = ET.parse(workdir / 'xl/sharedStrings.xml')
        shared_root = shared_tree.getroot()
        na_idx = add_shared_string(shared_root, 'N/A')

        sheet_tree = ET.parse(workdir / 'xl/worksheets/sheet1.xml')
        sheet = sheet_tree.getroot()

        groups = [
            ('Group A', 12, 34, 160),
            ('Group B', 13, 44, 170),
            ('Group C', 14, 58, 184),
            ('Group D-1', 15, 67, 193),
            ('Group D-2', 16, 76, 202),
            ('Group D-3', 17, 84, 211),
            ('Group D-4', 18, 91, 219),
            ('Group D-5', 19, 100, 228),
            ('Group D-6', 20, 108, 236),
            ('Group D-7', 21, 117, 245),
            ('Group D-8', 22, None, 258),
            ('Group D-9', 23, 126, 267),
            ('Group E-1', 24, 130, 271),
            ('Group E-2', 25, 134, 275),
        ]

        dv_internal = dv_outsource = pv_internal = pv_outsource = 0.0
        for _, summary_row_num, dv_total_row, pv_total_row in groups:
            row = sheet.find(f".//m:row[@r='{summary_row_num}']", NS)
            if row is None:
                raise RuntimeError(f'Missing summary row {summary_row_num}')

            if dv_total_row is None:
                set_text(cell(row, 'S'), na_idx)
                set_text(cell(row, 'T'), na_idx)
            else:
                k = numeric_value(get_cell(sheet, f'K{dv_total_row}'))
                l = numeric_value(get_cell(sheet, f'L{dv_total_row}'))
                set_formula(cell(row, 'S'), f'K{dv_total_row}', k)
                set_formula(cell(row, 'T'), f'L{dv_total_row}', l)
                dv_internal += k
                dv_outsource += l

            k = numeric_value(get_cell(sheet, f'K{pv_total_row}'))
            l = numeric_value(get_cell(sheet, f'L{pv_total_row}'))
            set_formula(cell(row, 'V'), f'K{pv_total_row}', k)
            set_formula(cell(row, 'W'), f'L{pv_total_row}', l)
            pv_internal += k
            pv_outsource += l

        total_row = sheet.find(".//m:row[@r='26']", NS)
        if total_row is None:
            raise RuntimeError('Missing blue table total row')
        set_formula(cell(total_row, 'S'), 'SUM(S12:S25)', dv_internal)
        set_formula(cell(total_row, 'T'), 'SUM(T12:T25)', dv_outsource)
        set_formula(cell(total_row, 'V'), 'SUM(V12:V25)', pv_internal)
        set_formula(cell(total_row, 'W'), 'SUM(W12:W25)', pv_outsource)

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
