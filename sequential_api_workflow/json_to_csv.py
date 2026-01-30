import csv
import json
import os

def convert_json_to_csv(data, output_file):
    """
    Converts a list of dictionaries (JSON data) to a CSV file.
    
    Args:
        data (list): List of dictionaries.
        output_file (str): Path to the output CSV file.
    """
    if not data:
        print(f"No data to write to {output_file}")
        return

    # Collect all unique keys for headers
    headers = set()
    for item in data:
        headers.update(item.keys())
    
    headers = sorted(list(headers))
    
    try:
        with open(output_file, 'w', newline='', encoding='utf-8') as f:
            writer = csv.DictWriter(f, fieldnames=headers)
            writer.writeheader()
            writer.writerows(data)
        print(f"Successfully converted to {output_file}")
    except Exception as e:
        print(f"Error converting to CSV: {e}")
