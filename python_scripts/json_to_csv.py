#!/usr/bin/env python3
"""
JSON to CSV Converter
---------------------
Converts JSON data (file or stdin) to CSV file(s).

Handles:
- Flat JSON objects/arrays → single CSV
- Nested objects → flattened with dot notation (e.g., address.city)
- Multiple top-level keys containing arrays → separate CSV per key

Usage:
    python json_to_csv.py input.json
    python json_to_csv.py input.json --output output.csv
    python json_to_csv.py input.json --output-dir ./output_folder
    echo '{"name":"Alice","age":30}' | python json_to_csv.py -
"""

import json
import csv
import sys
import os
import argparse
from pathlib import Path


def flatten(obj, parent_key="", sep="."):
    """Recursively flatten a nested dict using dot notation for keys."""
    items = {}
    if isinstance(obj, dict):
        for k, v in obj.items():
            new_key = f"{parent_key}{sep}{k}" if parent_key else k
            if isinstance(v, (dict, list)):
                items.update(flatten(v, new_key, sep))
            else:
                items[new_key] = v
    elif isinstance(obj, list):
        for i, v in enumerate(obj):
            new_key = f"{parent_key}{sep}{i}" if parent_key else str(i)
            if isinstance(v, (dict, list)):
                items.update(flatten(v, new_key, sep))
            else:
                items[new_key] = v
    else:
        items[parent_key] = obj
    return items


def rows_to_csv(rows, output_path):
    """Write a list of dicts to a CSV file."""
    if not rows:
        print(f"  [warning] No rows to write for {output_path}")
        return

    # Flatten each row
    flat_rows = [flatten(row) if isinstance(row, dict) else {"value": row} for row in rows]

    # Collect all fieldnames preserving order
    fieldnames = list(dict.fromkeys(k for row in flat_rows for k in row.keys()))

    os.makedirs(os.path.dirname(output_path) if os.path.dirname(output_path) else ".", exist_ok=True)

    with open(output_path, "w", newline="", encoding="utf-8") as f:
        writer = csv.DictWriter(f, fieldnames=fieldnames, extrasaction="ignore")
        writer.writeheader()
        writer.writerows(flat_rows)

    print(f"  ✓ Written {len(flat_rows)} rows → {output_path}")


def convert(data, output_path=None, output_dir=None, base_name="output"):
    """Main conversion logic."""

    # Case 1: Top-level is a list → single CSV
    if isinstance(data, list):
        path = output_path or os.path.join(output_dir or ".", f"{base_name}.csv")
        rows_to_csv(data, path)

    # Case 2: Top-level is a dict
    elif isinstance(data, dict):
        # Check if any values are lists (multiple tables)
        list_keys = {k: v for k, v in data.items() if isinstance(v, list)}
        non_list_keys = {k: v for k, v in data.items() if not isinstance(v, list)}

        if list_keys:
            # Write each list to its own CSV
            for key, rows in list_keys.items():
                if output_dir:
                    path = os.path.join(output_dir, f"{key}.csv")
                elif output_path and len(list_keys) == 1:
                    path = output_path
                else:
                    path = f"{key}.csv"
                rows_to_csv(rows, path)

            # Write remaining flat fields as a single metadata CSV if any
            if non_list_keys:
                path = os.path.join(output_dir or ".", f"{base_name}_meta.csv")
                rows_to_csv([non_list_keys], path)
        else:
            # Treat the whole dict as a single row
            path = output_path or os.path.join(output_dir or ".", f"{base_name}.csv")
            rows_to_csv([data], path)

    else:
        print(f"[error] Unsupported JSON root type: {type(data)}")
        sys.exit(1)


def main():
    parser = argparse.ArgumentParser(description="Convert JSON to CSV.")
    parser.add_argument("input", help="Path to JSON file, or '-' to read from stdin")
    parser.add_argument("--output", "-o", help="Output CSV file path (for single-file output)")
    parser.add_argument("--output-dir", "-d", help="Output directory (for multi-file output)")
    args = parser.parse_args()

    # Read input
    if args.input == "-":
        raw = sys.stdin.read()
        base_name = "output"
    else:
        path = Path(args.input)
        if not path.exists():
            print(f"[error] File not found: {args.input}")
            sys.exit(1)
        raw = path.read_text(encoding="utf-8")
        base_name = path.stem

    # Parse JSON
    try:
        data = json.loads(raw)
    except json.JSONDecodeError as e:
        print(f"[error] Invalid JSON: {e}")
        sys.exit(1)

    print(f"Converting JSON → CSV...")
    convert(data, output_path=args.output, output_dir=args.output_dir, base_name=base_name)
    print("Done!")


if __name__ == "__main__":
    main()
