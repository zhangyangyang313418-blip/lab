from __future__ import annotations

import sys
import tempfile
import unittest
from pathlib import Path

from openpyxl import Workbook

ROOT = Path(__file__).resolve().parents[1]
sys.path.insert(0, str(ROOT))

from scripts.build_jlr_standards_html import build_html_from_excel


class BuildJlrStandardsHtmlTest(unittest.TestCase):
    def test_builds_searchable_html_from_summary_sheet(self) -> None:
        with tempfile.TemporaryDirectory() as temp_dir:
            temp_path = Path(temp_dir)
            xlsx_path = temp_path / "standards.xlsx"
            html_path = temp_path / "standards.html"

            workbook = Workbook()
            sheet = workbook.active
            sheet.title = "JLR标准整理"
            sheet.append(["JLR 标准名称与版本号整理"])
            sheet.append(["来源：sample"])
            sheet.append([])
            sheet.append(["序号", "类别", "标准编号", "标准名称（中文）", "Standard Name (English)", "版本号", "日期", "来源数量", "来源文件"])
            sheet.append([
                1,
                "环境可靠性测试",
                "TPJLR.18.125",
                "电气和电子部件环境兼容性试验",
                "Electrical and Electronic Component Environmental Compatibility Test",
                "Issue 5",
                "24/01/2022",
                2,
                "TPJLR 18.125.pdf; TPJLR 18.125.docx",
            ])
            sheet.append([
                2,
                "光学/HUD/显示性能",
                "STJLR.13.5009",
                "抬头显示光学性能标准",
                "Head-Up Display Optical Performance Standard <HUD>",
                "Issue 6",
                "02 March 2021",
                1,
                "STJLR.13.5009.pdf",
            ])
            workbook.save(xlsx_path)

            build_html_from_excel(xlsx_path, html_path)

            html = html_path.read_text(encoding="utf-8")
            self.assertIn("const standardsData =", html)
            self.assertIn("searchInput", html)
            self.assertIn("categoryFilter", html)
            self.assertIn('sortKey: "index"', html)
            self.assertIn("rowNumber", html)
            self.assertIn("环境可靠性测试", html)
            self.assertIn("光学/HUD/显示性能", html)
            self.assertIn("TPJLR.18.125", html)
            self.assertIn("电气和电子部件环境兼容性试验", html)
            self.assertIn("Electrical and Electronic Component Environmental Compatibility Test", html)
            self.assertIn("抬头显示光学性能标准", html)
            self.assertIn("STJLR.13.5009", html)
            self.assertIn("thead th.col-code", html)
            self.assertIn("thead th.col-version", html)
            self.assertIn("color: #f7fbff", html)
            self.assertNotIn("Performance Standard <HUD>", html)
            self.assertNotIn("来源文件", html)
            self.assertNotIn("source_files", html)
            self.assertNotIn("TPJLR 18.125.pdf", html)


if __name__ == "__main__":
    unittest.main()
