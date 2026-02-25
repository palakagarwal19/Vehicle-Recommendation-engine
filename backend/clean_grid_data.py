#!/usr/bin/env python3
"""
Clean grid data file by replacing NaN values with null
"""

import json
import math
import os

def clean_nan(obj):
    """Recursively clean NaN values from nested structures"""
    if isinstance(obj, dict):
        return {k: clean_nan(v) for k, v in obj.items()}
    elif isinstance(obj, list):
        return [clean_nan(item) for item in obj]
    elif isinstance(obj, float) and math.isnan(obj):
        return None
    return obj

def main():
    # Get paths
    base_dir = os.path.dirname(os.path.abspath(__file__))
    input_file = os.path.join(base_dir, "..", "data", "grid_master_v2_2026.json")
    output_file = os.path.join(base_dir, "..", "data", "grid_master_v2_2026_clean.json")
    
    print(f"Reading from: {input_file}")
    
    # Read and clean
    with open(input_file, 'r', encoding='utf-8') as f:
        content = f.read()
        
    # Count NaN occurrences
    nan_count = content.count('NaN')
    print(f"Found {nan_count} NaN values")
    
    if nan_count == 0:
        print("No NaN values found - file is already clean!")
        return
    
    # Replace NaN with null
    content = content.replace(': NaN', ': null')
    content = content.replace(':NaN', ':null')
    content = content.replace(', NaN', ', null')
    content = content.replace(',NaN', ',null')
    
    # Parse JSON
    try:
        grid_data = json.loads(content)
    except json.JSONDecodeError as e:
        print(f"Error parsing JSON: {e}")
        return
    
    # Clean any remaining NaN (in case they're actual float NaN)
    grid_data = clean_nan(grid_data)
    
    # Count countries and years
    country_count = len(grid_data)
    year_counts = {}
    null_counts = {}
    
    for country, years in grid_data.items():
        year_counts[country] = len(years)
        null_count = 0
        for year, data in years.items():
            if data.get('raw') is None or data.get('corrected') is None:
                null_count += 1
        if null_count > 0:
            null_counts[country] = null_count
    
    print(f"\nStatistics:")
    print(f"  Countries: {country_count}")
    print(f"  Countries with null values: {len(null_counts)}")
    
    if null_counts:
        print(f"\nCountries with most null values:")
        for country, count in sorted(null_counts.items(), key=lambda x: x[1], reverse=True)[:10]:
            print(f"    {country}: {count} years with null")
    
    # Save cleaned data
    with open(output_file, 'w', encoding='utf-8') as f:
        json.dump(grid_data, f, indent=2)
    
    print(f"\nCleaned data saved to: {output_file}")
    print(f"File size: {os.path.getsize(output_file) / 1024:.1f} KB")
    
    # Verify it's valid JSON
    with open(output_file, 'r', encoding='utf-8') as f:
        test = json.load(f)
    print("✓ Verified: Output file is valid JSON")
    
    print("\nTo use the cleaned file, update engine.py:")
    print('  Change: grid = load_json("grid_master_v2_2026.json")')
    print('  To:     grid = load_json("grid_master_v2_2026_clean.json")')

if __name__ == "__main__":
    main()
