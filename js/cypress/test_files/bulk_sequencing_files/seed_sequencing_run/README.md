# Fake sequencing run for linking sequencing files

A whole-plasmid sequencing run laid out like the zips from the sequencing provider: one folder per sample, with a
`<sample>.final.fastq` file (the one that is linked) and a `.stats` file (ignored). The reads match sequences of
the seed database (`python/packages/opencloning-db/src/opencloning_db/init_db.py`).

It is not stored zipped. To try it in the app, zip the folder:

```bash
cd js/cypress/test_files/bulk_sequencing_files
zip -r /tmp/seed_sequencing_run.zip seed_sequencing_run -x '*.py' -x '*.md'
```

The Cypress tests zip it on the fly. To regenerate the files, run `generate.py` (instructions inside it).

| Sample | Existing sample with that UID | Read | "Find exact matches" |
| --- | --- | --- | --- |
| `seqcheck_circular_1-sample` | yes | exact (reverse complement, rotated) | - |
| `SEQCHECK_CIRCULAR_3-SAMPLE` | yes (UIDs are case-insensitive) | exact (rotated) | - |
| `seqcheck_circular_2-sample` | yes | substitutions | - |
| `colony_L2` | no (it is `seqcheck_linear_2-sample`) | insertion | no match (linear) |
| `TN9W63_1` | no (it is `example_sequencing-sample`) | exact pREX0008 | none: pREX0008 already has a sample |
| `TN9W63_2` | no (it is `example_sequencing-sample`) | pREX0008 with mutations | no match |
| `GB_105355_c1` | no | exact pJOG684 (rotated) | pJOG684 (no samples) |
| `GB_105355_c2` | no | exact pJOG684 (reverse complement) | pJOG684, a second colony |
| `GB_105417_c1` | no | pJOG173 with substitutions | no match |
| `empty_well` | no | random | no match |
