from fastapi import HTTPException, UploadFile
from pydna.dseqrecord import Dseqrecord
from opencloning_linkml.datamodel import Source, TextFileSequence
from typing import Literal
from opencloning.dna_functions import format_sequence_genbank
from pydna.opencloning_models import id_mode
from opencloning.dna_functions import get_invalid_enzyme_names
from Bio.Restriction.Restriction import RestrictionBatch


def format_products(
    source_id: int,
    products: list[Dseqrecord],
    completed_source: Source | None,
    output_name: str,
    no_products_error_message: str = 'No products were found.',
    wrong_completed_source_error_message: str = 'The provided assembly is not valid.',
) -> dict[Literal['sources', 'sequences'], list[Source] | list[TextFileSequence]]:

    formatted_products = [format_sequence_genbank(p, output_name) for p in products]
    for p in formatted_products:
        p.id = source_id

    with id_mode(use_python_internal_id=False):
        formatted_sources = [p.source.to_pydantic_model(source_id).model_dump() for p in products]
        for source in formatted_sources:
            source['output_name'] = output_name

    if completed_source is not None:
        this_source_dict = completed_source.model_dump()
        for prod, source in zip(formatted_products, formatted_sources):
            if source == this_source_dict:
                return {
                    'sources': [source],
                    'sequences': [prod],
                }
        raise HTTPException(400, wrong_completed_source_error_message)

    if len(products) == 0:
        raise HTTPException(400, no_products_error_message)

    return {
        'sources': formatted_sources,
        'sequences': formatted_products,
    }


def parse_restriction_enzymes(enzymes: list[str]) -> RestrictionBatch:
    invalid_enzymes = get_invalid_enzyme_names(enzymes)
    if len(invalid_enzymes):
        raise HTTPException(404, 'These enzymes do not exist: ' + ', '.join(invalid_enzymes))
    return RestrictionBatch(first=[e for e in enzymes if e is not None])


def read_upload_with_limit(file: UploadFile, max_size_mb: int) -> bytes:
    """Read an uploaded file, raising a 413 error if it exceeds ``max_size_mb`` megabytes."""
    max_bytes = max_size_mb * 1024 * 1024
    error = HTTPException(413, f'File {file.filename} exceeds the maximum size of {max_size_mb} MB')
    if file.size is not None and file.size > max_bytes:
        raise error
    # In case size is not known, read at most one byte over the limit
    content = file.file.read(max_bytes + 1)
    if len(content) > max_bytes:
        raise error
    return content


def check_unambiguous_overhangs(fragments: list[Dseqrecord], enzymes: RestrictionBatch) -> None:
    """Raise a 400 error if any of the enzymes would leave an overhang containing ambiguous bases (e.g. N).

    pydna cannot represent ambiguous bases in single-stranded regions, so these overhangs cannot be ligated.
    """
    errors = []
    for fragment in fragments:
        for (watson, ovhg), enzyme in fragment.seq.get_cutsites(*enzymes):
            start = watson if ovhg < 0 else watson - ovhg
            overhang = ''.join(str(fragment.seq[(start + i)]) for i in range(abs(ovhg)))
            if set(overhang.upper()) - set('ACGTU'):
                errors.append(f'{enzyme} overhang {overhang} in sequence {fragment.id}')
    if errors:
        raise HTTPException(
            400, 'Overhangs containing ambiguous bases (e.g. N) cannot be ligated: ' + ', '.join(errors) + '.'
        )
