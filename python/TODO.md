# TODO

## Backend

- [ ] `/manually_typed` returns a 500 when `source.output_name` contains whitespace. GenBank LOCUS names
  can't contain spaces, so `format_sequence_genbank` fails with `ValueError: Invalid whitespace in ...`.
  It should validate the name and answer 422, like `/rename_sequence` does with `pattern=r'^[^\s]+$'`.
  Other endpoints that take `output_name` probably behave the same way. The MCP server works around it by
  replacing spaces with underscores in `add_typed_sequence`.

## MCP server (`packages/opencloning-mcp`)

- [x] Pass the cloning API warnings on to the model. Some endpoints return warnings in the `x-warning` response
  header, e.g. `/read_from_file` (file not in the expected format, sequences skipped) and
  `/restriction_and_ligation` (partially digested products removed). `cloning_api.post` ignores them; they
  could be added to the tool result as a `warnings` field.
