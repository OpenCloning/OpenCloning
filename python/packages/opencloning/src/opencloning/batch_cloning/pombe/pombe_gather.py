import yaml
import os
import pandas as pd
import argparse
import json
from collections import OrderedDict


def represent_ordereddict(dumper, data):
    return dumper.represent_mapping('tag:yaml.org,2002:map', data.items())


yaml.add_representer(OrderedDict, represent_ordereddict)


def main(input_dir: str):
    rows = []
    out_dict = OrderedDict()
    for folder in os.listdir(input_dir):
        working_dir = os.path.join(input_dir, folder)
        if not os.path.isdir(working_dir):
            continue
        if not os.path.exists(os.path.join(working_dir, 'summary.json')):
            print(f"Skipping {folder}: no summary.json found")
            continue
        with open(os.path.join(working_dir, 'summary.json'), 'r') as f:
            summary = json.load(f, object_pairs_hook=OrderedDict)
        out_dict[folder] = summary
        rows.append(summary)

    df = pd.DataFrame(rows)

    # Primer summary table:
    primer_summary = list()
    primer_names = ['primer_fwd', 'primer_rvs', 'primer_fwd_check', 'primer_rvs_check']

    for _, row in df.iterrows():
        for primer_name in primer_names:
            if primer_name not in row or row[primer_name] is None:
                continue
            primer_row = OrderedDict()
            primer_row['name'] = row[primer_name + '_name']
            primer_row['sequence'] = row[primer_name]
            primer_row['bound'] = row[primer_name + '_bound']
            primer_row['tm'] = row[primer_name + '_tm']
            primer_summary.append(primer_row)
    primer_df = pd.DataFrame(primer_summary)
    primer_df['tm'] = primer_df['tm'].round(1)

    df.to_csv(os.path.join(input_dir, 'summary.tsv'), index=False, sep='\t')
    primer_df.to_csv(os.path.join(input_dir, 'primer_summary.tsv'), index=False, sep='\t')
    # also as excel
    with pd.ExcelWriter(os.path.join(input_dir, 'summary.xlsx')) as writer:
        df.to_excel(writer, sheet_name='summary', index=False)
        primer_df.to_excel(writer, sheet_name='primer_summary', index=False)

    # Write out_dict to yaml
    with open(os.path.join(input_dir, 'summary.yaml'), 'w') as f:
        yaml.dump(out_dict, f, default_flow_style=False, sort_keys=False)


if __name__ == '__main__':
    parser = argparse.ArgumentParser(description='Process cloning strategies and generate summaries')
    parser.add_argument(
        '--input_dir', type=str, default='batch_cloning_output', help='Input directory containing gene folders'
    )
    args = parser.parse_args()

    main(args.input_dir)
