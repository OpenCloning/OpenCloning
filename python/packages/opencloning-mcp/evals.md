# Eval tasks for the MCP server

These are the tasks to try with a real model driving the tools, to find out where the tool
descriptions, the server instructions and the error messages are not good enough.

Run them with the server running (`uv run opencloning-mcp`) and the tools connected
(`claude mcp add --transport http opencloning http://localhost:8002/mcp`), in a **separate session**
from the one that wrote the code: a session that knows the implementation is not a fair test.

For each task, record what the model did, where it went wrong, and what was changed in response.
Fix **docstrings, the `INSTRUCTIONS` in `app.py` and error messages** on this evidence, not on
intuition. That, rather than new tools, is what makes the server drivable.

## What to watch for in every task

- Does it call `start_strategy` first and reuse the `strategy_id`?
- When a tool answers `"choose_product"`, does it pick on the evidence in the candidates (length,
  ends, topology), or does it guess, or does it ask the user?
- Does it invent sequence ids, or look them up with `describe_strategy`?
- Does it pass sensible `name` arguments, and tell the user the names it chose?
- Does it offer the download link at the end without being asked?

## 1. Digest and ligate

**Prompt:** paste the GenBank of `pFA6a-hphMX6.gb`, then:

> Cut out the hphMX6 cassette from this plasmid with BamHI and SacI and put this gene in its place:
> *(paste a few hundred bases of a gene)*. Design the primers you need.

**Expected:** `design_pcr_primers` with `left_enzyme="BamHI"` and `right_enzyme="SacI"`, a PCR of the gene, a digest of the plasmid keeping
the ~2.5 kb backbone, a digest of the PCR product, and a circular ligation of about 2.6 kb.

**Watch:** whether it chooses the backbone fragment rather than the cassette, and whether it digests
the PCR product before ligating.

## 2. PCR and Gibson

**Prompt:** two sequences, with the instruction to amplify each with primers carrying tails that
overlap the other fragment, and assemble them into a circular plasmid.

**Expected:** two PCRs, then `gibson_assembly` with `circular_only=True`.

**Watch:** whether it uses `circular_only`, and whether it understands that the order of
`sequence_ids` does not matter.

## 3. Golden Gate

**Prompt:** the four fragments of `test_endpoints_assembly.py::test_golden_gate` (three linear BsaI
parts and the circular backbone), asking for a Golden Gate assembly with BsaI.

**Expected:** one call to `restriction_and_ligation` with `enzymes=["BsaI"]` and
`circular_only=True`, giving a single 39 bp circular product.

**Watch:** whether it reaches for `restriction_digest` + `ligation` separately instead of the
one-pot tool.

## 4. Gateway BP then LR

The hardest task, and the most informative. Uses the SnapGene files in
`packages/opencloning/tests/test_files/gateway_manual_cloning/`. They are binary, so the model
cannot pass them as text: it should call `get_upload_link`, and you upload the three files together in
the browser (the form takes several).

**Prompt:** `pDONRtm221` and `pcr_product-attP1_1-attP2_1` for a BP reaction, then the entry clone
and `pET-53-DESTtm` for an LR reaction.

**Expected:** a 4790 bp circular entry clone (with `circular_only=True` the BP gives exactly one
product), then the 7423 bp expression clone chosen out of 4 LR candidates.

**Watch:** whether it picks BP and LR correctly (`list_gateway_sites` is there to check), whether it
uses `circular_only`, and above all **how it chooses among the 4 LR candidates** — this is the test
of whether the candidate summaries carry enough information. Also watch whether it asks you to
upload the files, waits for you, and then finds the new ids with `describe_strategy`.

## 5. Homologous recombination

**Prompt:** a linear locus and a cassette sharing homology arms with it, asking for an integration by
homologous recombination.

**Expected:** `homologous_recombination` with the template first and the insert second.

**Watch:** the argument order (it is `template_id`, `insert_id`, and getting it wrong changes the
result), and whether it lowers `minimal_homology` when the arms are short.

## 6. Recovery from a vague reference

**Prompt:** after any of the tasks above, refer to a sequence by name rather than by id, e.g.
*"digest the backbone again, this time with EcoRI"*.

**Expected:** a call to `describe_strategy` to find the id, then the digest.

**Watch:** whether it guesses an id. If it does, the error message from `storage.get_by_id` lists the
valid ids, so note whether it recovers from that on its own.

## 7. Gene from a genome

**Prompt:** *"Get the gene cdc2 from S. pombe with 1 kb on each side, and design primers to amplify just the
coding region."* (Then try *"now the gene cdc3"*, which is on the minus strand.)

**Expected:** `find_genome_assembly` (reference assembly `GCF_000002945.2`), `find_gene`, then
`add_genome_region_from_gene` with the default 1000 bp flanks, giving a 3888 bp sequence, then
`design_pcr_primers` with `region={"feature": "cdc2", "feature_type": "CDS"}` (see task 8).

**Watch:** whether it asks when the species or the gene is ambiguous instead of guessing; whether it passes
the locus tag; and whether it understands that the product of a minus-strand gene is already oriented as the
gene, so upstream flank comes first.

## 8. Primers for a region of a sequence

Use the genome region of task 7 (or any annotated GenBank file).

**Prompts**, each in a fresh strategy, checking the product after each `pcr`:

> a. Amplify the coding region of cdc2. *(then)* Now cdc3, which is on the minus strand.
> b. Amplify cdc2 with 500 bp of promoter, but without the stop codon, with BamHI and SacI sites.
> c. Amplify the N-terminal 120 amino acids of cdc2.
> d. Amplify the intergenic region between cdc2 and the gene next to it.
> e. Amplify bases 1500 to 2400 of the minus strand.

**Expected:** `list_features` or `locate_region` when the region is not a plain feature, then
`design_pcr_primers` with `{"feature": ..., "upstream": 500, "downstream": -3}`, `{"start": ..., "end": ...}`
and so on, then `pcr` and `pcr_primer_details`. For a minus-strand gene the forward primer is in the sense
of the gene and the product is the gene as it reads.

**Watch:** whether it gets the sign of `upstream` / `downstream` right on the minus strand (the server
does the strand arithmetic, the model must only say upstream or downstream); whether `feature_type` is
set when a gene and its CDS share a name; whether it checks "120 amino acids" with `locate_region`;
whether it shows the user the Tm of the binding part, not of the whole primer.

## 9. Primers for homologous recombination

**Prompts**, with a plasmid that has a resistance cassette and a genome region with annotated genes:

> a. Knock out cdc2 by replacing its coding region with the kanMX cassette, with 60 bp homology arms.
> b. Add a GFP tag after amino acid 120 of cdc2, in frame. *(the GFP typed or from a file)*
> c. Tag cdc2 at the C terminus: replace the stop codon with the GFP, with a GGSGG linker.

**Expected:** `design_homology_primers` with `replace=` the CDS / `insert_at={"feature": ..., "after_aa": 120}` /
`replace={"start": {"feature": ..., "after_aa": N-1}, "end": {"feature": ..., "edge": "end"}}`, then `pcr`,
`pcr_primer_details`, and `homologous_recombination` with `minimal_homology` equal to the homology length.

**Watch:** "after amino acid 120": does it check the amino acids on both sides with `locate_region`, and does it
ask whether the user counts the Met as 1? Does it put the linker in a spacer with the right side? Does it
understand `orientation`, or leave the default? Does it notice when the product is not the expected size
(`expected_size_after_recombination`)?

## 10. Questions about primers

**Prompts:** *"What are the Tm and the hairpin of GCGGATCCATGGCTAGCAAAGGAGAAGAAC?"* (no strategy at all), and, after
a PCR with tailed primers, *"Are these primers any good? Why is the annealing temperature not what I
expected?"*

**Expected:** `primer_details` with `sequences`, and `pcr_primer_details` on the PCR product.

**Watch:** whether it explains that the Tm of the whole primer is not the one that counts when there is a
tail, and says that the units of delta G are cal/mol.

## 11. Annotations

**Prompts**, on an annotated sequence (the genome region of task 7, or a plasmid):

> a. Remove the stop codon from the cdc2 CDS annotation, so that I can fuse a tag. *(then, on a minus-strand gene)*
> b. Remove all the misc_feature annotations. *(then)* Remove the annotation called "cdc2".
> c. Annotate the first 120 amino acids of cdc2 as "N-term".

**Expected:** `remove_stop_codon` (it refuses if the last codon is not a stop), `remove_features` with
`feature_type` for b, then a name that needs `feature_type` because the gene and the CDS share it,
`add_feature` with a `start` / `end` region for c.

**Watch:** whether it lists the features before removing a whole type, whether it handles the name shared by
a gene and its CDS, whether it notices that the gene and mRNA features still include the stop codon, and
whether it tells the user that the change is made on the sequence itself.

## 12. Spacers and linkers: ask first

**Prompt**, with a genome region (task 7) and a GFP sequence:

> Tag the cdc2 gene with GFP at its C-terminus, by homologous recombination. Design the primers.

(The prompt says nothing about a linker.)

**Expected:** the model either designs the primers without a spacer, or suggests a linker to the user and
waits for the answer. If it passes `left_spacer` / `right_spacer` straight away, the tool answers
`needs_confirmation` and designs nothing; the model must then ask the user, not just set
`spacer_approved_by_user=true`. Same for `left_tail` / `right_tail` in `design_pcr_primers`.

**Watch:** whether the model asks, whether it says what the linker is for, and whether it sets
`spacer_approved_by_user` only after the user agrees (or if the prompt asked for the linker in the first place).
Variant: *"... with a GGSG linker"* must go through without a question.

## 13. Features lost by cutting through them

**Prompt:** the same tagging task, then *"Show me the result."*

**Expected:** after the recombination the model compares `list_features` of the genome region and of the product,
sees that the cdc2 CDS (and the gene and mRNA if they include the stop codon) are gone, because the stop codon was
replaced, and re-annotates the CDS on the product with `add_feature` and `parts` (the CDS without its stop codon,
the linker if any, and the tag as one fusion CDS), and tells the user.

**Watch:** whether the model notices without being asked, whether it leaves alone the features that are simply
outside of the replaced region, whether it joins the parts in frame (the tool reports the number of amino acids),
and whether it tells the user what it added.

## Results

Fill in as the tasks are run: one short section per task with what the model did, what went wrong,
and the change made in response.
