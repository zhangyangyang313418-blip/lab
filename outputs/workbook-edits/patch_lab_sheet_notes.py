from __future__ import annotations

import subprocess
import tempfile
import zipfile
from pathlib import Path
import xml.etree.ElementTree as ET


INPUT = Path('/Users/clytia/Desktop/Codex/产品测试流程自动化/outputs/workbook-edits/final/MLA测试项目及费用预估_全部特殊项目标识_费用汇总补全_蓝色费用表格已填写.xlsx')
OUTPUT = Path('/Users/clytia/Desktop/Codex/产品测试流程自动化/outputs/workbook-edits/final/MLA测试项目及费用预估_全部特殊项目标识_费用汇总补全_蓝色费用表格已填写_实验室页备注修正.xlsx')

NS = {'m': 'http://schemas.openxmlformats.org/spreadsheetml/2006/main'}
MAIN_NS = NS['m']
ET.register_namespace('', MAIN_NS)

REPLACEMENTS = {
    'K26 Mechanical Wear-Out 按 334h 常温 + 83h 低温 + 83h 高温分别计费后取实验室总价中值':
        'K26 Mechanical Wear-Out 按 334h 常温 + 83h 低温 + 83h 高温分别计费，采用当前实验室总价',
    'L6-SEM&SECTION 委外组合报价：SEM & Sectioning 按 33 个测试点位取实验室总价中值':
        'L6-SEM&SECTION 委外组合报价：SEM & Sectioning 按 33 个测试点位采用当前实验室总价',
}


def patch() -> None:
    with tempfile.TemporaryDirectory() as td:
        workdir = Path(td) / 'xlsx'
        with zipfile.ZipFile(INPUT) as zf:
            zf.extractall(workdir)

        shared_path = workdir / 'xl/sharedStrings.xml'
        tree = ET.parse(shared_path)
        root = tree.getroot()
        changed = 0
        for si in root.findall('m:si', NS):
            # The workbook may contain duplicate shared strings for the same visible note.
            text_nodes = si.findall('.//m:t', NS)
            if not text_nodes:
                continue
            if len(text_nodes) > 1:
                rich_changed = False
                for node in text_nodes:
                    if not node.text:
                        continue
                    updated = node.text.replace('个测试点位取实验室总价中值', '个测试点位采用当前实验室总价')
                    if updated != node.text:
                        node.text = updated
                        rich_changed = True
                if rich_changed:
                    changed += 1
                continue
            node = text_nodes[0]
            if not node.text:
                continue
            original = node.text
            updated = original
            for old, new in REPLACEMENTS.items():
                updated = updated.replace(old, new)
            if updated != original:
                node.text = updated
                changed += 1

        if changed < len(REPLACEMENTS):
            raise RuntimeError(f'Expected at least {len(REPLACEMENTS)} shared strings changed, got {changed}')

        tree.write(shared_path, encoding='UTF-8', xml_declaration=True)

        if OUTPUT.exists():
            OUTPUT.unlink()
        subprocess.run(['zip', '-qr', str(OUTPUT), '.'], cwd=workdir, check=True)


if __name__ == '__main__':
    patch()
    print(OUTPUT)
