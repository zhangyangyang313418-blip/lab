from __future__ import annotations

import math
import re
import struct
import sys
from pathlib import Path

END = 0xFFFFFFFE
FREE = 0xFFFFFFFF


def u16(data: bytes, offset: int) -> int:
    return struct.unpack_from("<H", data, offset)[0]


def u32(data: bytes, offset: int) -> int:
    return struct.unpack_from("<I", data, offset)[0]


def f64(data: bytes, offset: int) -> float:
    return struct.unpack_from("<d", data, offset)[0]


def workbook_stream(path: Path) -> bytes:
    data = path.read_bytes()
    sector_size = 1 << u16(data, 30)

    def sector(index: int) -> bytes:
        return data[(index + 1) * sector_size : (index + 2) * sector_size]

    fat_sector_count = u32(data, 44)
    first_dir_sector = u32(data, 48)
    first_difat_sector = u32(data, 68)
    difat_sector_count = u32(data, 72)
    difat = [u32(data, 76 + index * 4) for index in range(109) if u32(data, 76 + index * 4) != FREE]
    sector_index = first_difat_sector

    for _ in range(difat_sector_count):
        difat_sector = sector(sector_index)
        difat.extend(
            u32(difat_sector, index * 4)
            for index in range(sector_size // 4 - 1)
            if u32(difat_sector, index * 4) != FREE
        )
        sector_index = u32(difat_sector, sector_size - 4)

    fat: list[int] = []
    for fat_sector in difat[:fat_sector_count]:
        fat.extend(u32(sector(fat_sector), index * 4) for index in range(sector_size // 4))

    def read_chain(first_sector: int) -> bytes:
        output = bytearray()
        sector_index = first_sector
        seen: set[int] = set()
        while sector_index not in (END, FREE) and sector_index < len(fat) and sector_index not in seen:
            seen.add(sector_index)
            output += sector(sector_index)
            sector_index = fat[sector_index]
        return bytes(output)

    directory = read_chain(first_dir_sector)
    for offset in range(0, len(directory), 128):
        entry = directory[offset : offset + 128]
        if len(entry) < 128:
            break
        name_length = u16(entry, 64)
        if name_length < 2:
            continue
        name = entry[: name_length - 2].decode("utf-16le", "ignore")
        entry_type = entry[66]
        first_sector = u32(entry, 116)
        stream_size = u32(entry, 120)
        if entry_type == 2 and name in {"Workbook", "Book"}:
            return read_chain(first_sector)[:stream_size]

    raise RuntimeError("Workbook stream not found")


def rk_value(value: int) -> float:
    is_times_100 = value & 1
    is_integer = value & 2
    bits = value & 0xFFFFFFFC
    if is_integer:
        result = bits >> 2
        if result & (1 << 29):
            result -= 1 << 30
        numeric = float(result)
    else:
        numeric = struct.unpack("<d", struct.pack("<II", 0, bits))[0]
    return numeric / 100 if is_times_100 else numeric


def xl_string(data: bytes, offset: int, character_count: int | None = None) -> tuple[str, int]:
    if character_count is None:
        character_count = u16(data, offset)
        offset += 2
    flags = data[offset]
    offset += 1
    has_rich_text = flags & 0x08
    has_extended = flags & 0x04
    is_utf16 = flags & 0x01
    rich_text_runs = 0
    extended_size = 0
    if has_rich_text:
        rich_text_runs = u16(data, offset)
        offset += 2
    if has_extended:
        extended_size = u32(data, offset)
        offset += 4
    byte_count = character_count * (2 if is_utf16 else 1)
    raw = data[offset : offset + byte_count]
    offset += byte_count
    text = raw.decode("utf-16le" if is_utf16 else "latin1", "ignore")
    return text, offset + rich_text_runs * 4 + extended_size


def parse_workbook(data: bytes) -> list[tuple[str, dict[int, dict[int, object]]]]:
    records: list[tuple[int, bytes, int]] = []
    offset = 0
    while offset + 4 <= len(data):
        record_type = u16(data, offset)
        length = u16(data, offset + 2)
        records.append((record_type, data[offset + 4 : offset + 4 + length], offset))
        offset += 4 + length

    sheets: list[tuple[int, str]] = []
    for record_type, payload, _ in records:
        if record_type == 0x0085:
            sheet_offset = u32(payload, 0)
            name_length = payload[6]
            flags = payload[7]
            raw_name = payload[8 : 8 + name_length * (2 if flags & 1 else 1)]
            name = raw_name.decode("utf-16le" if flags & 1 else "latin1", "ignore")
            sheets.append((sheet_offset, name))

    shared_strings: list[str] = []
    index = 0
    while index < len(records):
        record_type, payload, _ = records[index]
        if record_type == 0x00FC:
            chunks = [payload]
            next_index = index + 1
            while next_index < len(records) and records[next_index][0] == 0x003C:
                chunks.append(records[next_index][1])
                next_index += 1
            blob = b"".join(chunks)
            offset = 8
            unique_count = u32(blob, 4)
            for _ in range(unique_count):
                if offset >= len(blob):
                    break
                try:
                    text, offset = xl_string(blob, offset)
                except Exception:
                    break
                shared_strings.append(text)
            index = next_index
            continue
        index += 1

    parsed_sheets: list[tuple[str, dict[int, dict[int, object]]]] = []
    sheet_offsets = [offset for offset, _ in sheets] + [len(data)]
    for sheet_index, (sheet_offset, name) in enumerate(sheets):
        rows: dict[int, dict[int, object]] = {}
        offset = sheet_offset
        end_offset = sheet_offsets[sheet_index + 1]

        def put(row: int, column: int, value: object) -> None:
            rows.setdefault(row, {})[column] = value

        while offset + 4 <= end_offset:
            record_type = u16(data, offset)
            length = u16(data, offset + 2)
            payload = data[offset + 4 : offset + 4 + length]
            offset += 4 + length
            if record_type == 0x000A:
                break
            if record_type == 0x00FD and len(payload) >= 10:
                string_index = u32(payload, 6)
                put(u16(payload, 0), u16(payload, 2), shared_strings[string_index] if string_index < len(shared_strings) else "")
            elif record_type == 0x0203 and len(payload) >= 14:
                put(u16(payload, 0), u16(payload, 2), f64(payload, 6))
            elif record_type == 0x027E and len(payload) >= 10:
                put(u16(payload, 0), u16(payload, 2), rk_value(u32(payload, 6)))
            elif record_type == 0x00BD and len(payload) >= 6:
                row = u16(payload, 0)
                first_column = u16(payload, 2)
                count = (len(payload) - 6) // 6
                for item_index in range(count):
                    put(row, first_column + item_index, rk_value(u32(payload, 6 + item_index * 6)))
            elif record_type == 0x0204 and len(payload) >= 8:
                row = u16(payload, 0)
                column = u16(payload, 2)
                text, _ = xl_string(payload, 6)
                put(row, column, text)
            elif record_type == 0x0006 and len(payload) >= 14:
                row = u16(payload, 0)
                column = u16(payload, 2)
                formula_value = f64(payload, 6)
                put(row, column, formula_value)
                pending_formula_cell = (row, column)
            elif record_type == 0x0207 and len(payload) >= 3:
                try:
                    text, _ = xl_string(payload, 0)
                except Exception:
                    text = ""
                if "pending_formula_cell" in locals():
                    put(pending_formula_cell[0], pending_formula_cell[1], text)

        parsed_sheets.append((name, rows))
    return parsed_sheets


def format_cell(value: object | None) -> str:
    if value is None:
        return ""
    if isinstance(value, float):
        if math.isnan(value):
            return ""
        if abs(value - round(value)) < 1e-9:
            return str(int(round(value)))
    return str(value)


def main() -> None:
    path = Path(sys.argv[1])
    pattern = re.compile(sys.argv[2], re.I) if len(sys.argv) > 2 else None
    workbook = workbook_stream(path)
    for sheet_name, rows in parse_workbook(workbook):
        printed_header = False
        for row_index, columns in sorted(rows.items()):
            max_column = max(columns) if columns else 0
            values = [format_cell(columns.get(column)) for column in range(max_column + 1)]
            line = "\t".join(values)
            if pattern is None or pattern.search(line):
                if not printed_header:
                    print(f"\\nSHEET {sheet_name}")
                    printed_header = True
                print(f"{row_index + 1}\\t{line}")


if __name__ == "__main__":
    main()
