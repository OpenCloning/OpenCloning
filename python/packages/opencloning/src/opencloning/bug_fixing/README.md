# Bug Fixing

## backend_v0_3.py

PR fixing this is here: https://github.com/OpenCloning/OpenCloning_backend/pull/305

### Bug in assemblies with locations spanning the origin

Before version 0.3, there was a bug for assembly fields that included locations spanning the origin. For example, let's take the following two circular sequences from [this test file](../../../tests/test_files/bug_fixing/digestion_spanning_origin.json):

```
ttcaaaagaa

ttcccccccgaa
```

In both of them, the EcoRI site `GAATTC` is splitted by the origin. The assembly field in the current format should be:

```json
{
"assembly": [
        {
          "sequence": 2,
          "left_location": "join(9..10,1..2)",
          "right_location": "join(9..10,1..2)",
          "reverse_complemented": false
        },
        {
          "sequence": 4,
          "left_location": "join(11..12,1..2)",
          "right_location": "join(11..12,1..2)",
          "reverse_complemented": false
        }
      ],
      "restriction_enzymes": [
        "EcoRI"
      ]
}
```

However, the old code was not handling this use-case correctly, and produced something like this (`left_location` and `right_location` span the entire sequence rather than the common part):

```json
{
"assembly": [
        {
          "sequence": 2,
          "left_location": "1..10",
          "right_location": "1..10",
          "reverse_complemented": false
        },
        {
          "sequence": 4,
          "left_location": "1..12",
          "right_location": "1..12",
          "reverse_complemented": false
        }
      ],
      "restriction_enzymes": [
        "EcoRI"
      ]
}
```

This was being used in `generate_assemblies` and producing wrong assembly products.

### Bug in gateway assemblies (rare, but could happen)

`gateway_overlap` was returning the entire overlap, which matched regex like `twtGTACAAAaaa` (for attB1). That created assemblies in which
the overlapping part may have mismatches on the w (might be rare). Now, instead of returning the whole `twtGTACAAAaaa` as overlap, it returns only the common part `GTACAAA`. For example in the [test file](../../../tests/test_files/bug_fixing/gateway_13bp_overlap.json)

Wrong (before fix):

```json
{
    "assembly": [
        {
          "sequence": 4,
          "left_location": "2893..2905", # < Length 13 (applies to all locations)
          "right_location": "649..661",
          "reverse_complemented": false
        },
        {
          "sequence": 8,
          "left_location": "10..22",
          "right_location": "3112..3124",
          "reverse_complemented": false
        }
      ],
      "reaction_type": "BP",
}
```

Right (after fix):

```json
{
    "assembly": [
        {
            "sequence": 4,
            "left_location": "2896..2902", # < Length 7 (common part, all locations)
            "right_location": "652..658",
            "reverse_complemented": false
        },
        {
            "sequence": 8,
            "left_location": "13..19",
            "right_location": "3115..3121",
            "reverse_complemented": false
        }
        ],
        "reaction_type": "BP",
}
```
### Fixing these bugs

If you load a json file into the web application, it will automatically apply the fix.

If you want to fix several bugs from the command line, you can use the `backend_v0_3.py` script as below.

Before running this script, you need to migrate the data to the latest version of the schema. See [full documentation](https://github.com/OpenCloning/OpenCloning_LinkML?tab=readme-ov-file#migration-from-previous-versions-of-the-schema), but basically:

```bash
python -m opencloning_linkl.migrations.migrate --target-version='0.3.0' file1.json file2.json ...
```

Then, you can run the script:

```bash
python -m opencloning.bug_fixing.backend_v0_3 file1.json file2.json ...
```

For each file:
* If the file does not need fixing, it will be skipped. Migrate it to the latest version of the schema by removing the `--target-version` flag.
  ```bash
  python -m opencloning_linkl.migrations.migrate file1.json file2.json ...
  ```
* If the file needs fixing, it will create a new file `file_1_needs_fixing.json` at the same location where the original file is, with the problematic sources replaced by templates.
* You can then load these files into the web application and run the correct steps manually.

Unless you are using gateway a lot, most files should not need fixing.
