import os
import yaml


def get_seva_catalog():
    seva_catalog_path = os.path.join(os.path.dirname(__file__), 'seva.tsv')
    seva_catalog = dict()
    with open(seva_catalog_path, 'r') as f:
        for line in f:
            name, genbank_link = line.strip().split('\t')
            seva_catalog[name] = genbank_link
    return seva_catalog


def get_snapgene_catalog():
    snapgene_catalog_path = os.path.join(os.path.dirname(__file__), 'snapgene.yaml')
    with open(snapgene_catalog_path, 'r') as f:
        return yaml.safe_load(f)


def get_openDNA_collections_catalog():
    catalog_path = os.path.join(os.path.dirname(__file__), 'openDNA_collections.yaml')
    with open(catalog_path, 'r') as f:
        return yaml.safe_load(f)


def get_iGEM2024_catalog():
    catalog_path = os.path.join(os.path.dirname(__file__), 'igem2024.yaml')
    with open(catalog_path, 'r') as f:
        return yaml.safe_load(f)


seva_catalog = get_seva_catalog()
snapgene_catalog = get_snapgene_catalog()
openDNA_collections_catalog = get_openDNA_collections_catalog()
iGEM2024_catalog = get_iGEM2024_catalog()
