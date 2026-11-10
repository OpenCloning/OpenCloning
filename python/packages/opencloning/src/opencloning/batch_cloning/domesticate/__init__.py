import re
import io
import os
from enum import Enum

from Bio.SeqFeature import CompoundLocation, Location
from Bio.Restriction.Restriction import RestrictionBatch
from bs4 import BeautifulSoup
from fastapi import HTTPException
from opencloning.dna_utils import compound_location_to_capitalized_str
from pydantic import BaseModel, Field, field_validator
from pydna.assembly2 import pcr_assembly, restriction_ligation_assembly
from pydna.dseqrecord import Dseqrecord
from pydna.parsers import parse as pydna_parse
from pydna.opencloning_models import CloningStrategy as PydnaCloningStrategy, Source, SourceInput
from pydna.opencloning_models import AddgeneIdSource
from pydna.opencloning_models import SequenceLocationStr
from pydna.primer import Primer

from opencloning_linkml.datamodel import TextFileSequence, SequenceFileFormat

from ...dna_functions import read_dsrecord_from_json, custom_file_parser
from ...get_router import get_router
from ...http_client import get_http_client
from ...pydantic_models import BaseCloningStrategy

router = get_router()


class EnzymeToRemove(str, Enum):
    BsmBI = 'BsmBI'
    BsaI = 'BsaI'
    BtgZI = 'BtgZI'
    BpiI = 'BpiI'


class AllowedCategory(str, Enum):
    PROM_5UTR_A1_A2_A3_B1_B2 = 'PROM+5UTR (A1-A2-A3-B1-B2)'
    PROM_5UTR_F_A1_A2_A3_B1 = 'PROM+5UTR(f) (A1-A2-A3-B1)'
    DIST_PROX_A1_A2 = 'DIST+PROX (A1-A2)'
    CORE_5UTR_A3_B1_B2 = 'CORE+5UTR (A3-B1-B2)'
    DIST_A1 = 'DIST(A1)'
    PROX_A2 = 'PROX (A2)'
    INTERACTION_ADAPTOR_A1_A2_A3_B1_B2B = 'INTERACTION ADAPTOR (A1-A2-A3-B1-B2b)'
    PROM_5UTR_MIR173_A1_A2_A3_B1B = 'PROM+5UTR+mir173 (A1-A2-A3-B1b)'
    NTAG_B2 = 'NTAG (B2)'
    CDS_B3_B4_B5 = 'CDS (B3-B4-B5)'
    CDS1_B3 = 'CDS1 (B3)'
    CDS2_B4 = 'CDS2 (B4)'
    CDS2_CTAG_B4_B5 = 'CDS2+CTAG (B4-B5)'
    CDS1_CDS2_B3_B4 = 'CDS1+CDS2 (B3-B4)'
    CTAG_B5 = 'CTAG (B5)'
    FS_5_B2_B3B = "5'FS (B2-B3b)"
    TARGET_B4B = 'Target (B4b)'
    FS_3_B5B = "'3FS (B5b)"
    GOI_B2_B3 = 'goi (B2-B3)'
    INT_B4 = 'int (B4)'
    IOG_B5 = 'iog (B5)'
    FGOI_B2_B3_B4_B5 = 'fgoi (B2-B3-B4-B5)'
    UTR3_TERM_B6_C1 = '3UTR+TERM (B6-C1)'
    PROM_DPOLIII_DRCAS12_A1_A2_A3_B1_B2E = 'PROM DPolIII+DRCas12 (A1-A2-A3-B1-B2e)'
    PROCESSING_3PRIME_B6C_C1 = '3_prime processing (B6c-C1)'
    PROM_DPOLIII_A1_A2_A3_B1_B2C = 'PROM DPolIII (A1-A2-A3-B1-B2c)'
    PROM_MPOLIII_A1_A2_A3_B1_B2D = 'PROM MPolIII (A1-A2-A3-B1-B2d)'
    SGRNA_B6B_C1 = 'sgRNA (B6b-C1)'


class CloningType(str, Enum):
    DOMESTICATION = 'domestication'
    SYNTHESIS = 'synthesis'


class BatchDomesticateRequest(BaseModel):
    model_config = {'arbitrary_types_allowed': True}
    sequence: TextFileSequence
    location: SequenceLocationStr
    cloning_type: CloningType
    part_name: str
    prefix: str = Field(default='')
    suffix: str = Field(default='')
    category: AllowedCategory | None = Field(default=None)
    enzymes: list[EnzymeToRemove] = Field(min_length=1)

    @field_validator('location', mode='before')
    @classmethod
    def parse_location(cls, v):
        return SequenceLocationStr.field_validator(v)


def _extract_csrf_token(html: str) -> str | None:
    match = re.search(r'name="csrfmiddlewaretoken"\s+value="([^"]+)"', html)
    return match.group(1) if match else None


def _extract_unique_error_messages(soup: BeautifulSoup) -> list[str]:
    unique_errors: list[str] = []
    seen: set[str] = set()
    for error_list in soup.find_all('ul', class_='errorlist'):
        for li in error_list.find_all('li'):
            message = li.get_text(strip=True)
            if message and message not in seen:
                seen.add(message)
                unique_errors.append(message)
    return unique_errors


def _validate_request(req: BatchDomesticateRequest) -> tuple[str, str, str | None]:
    prefix = req.prefix.upper()
    suffix = req.suffix.upper()
    category = req.category if req.category not in (None, '') else None

    if len(req.enzymes) == 0:
        raise ValueError('At least one enzyme must be provided')

    if category is None:
        if not re.fullmatch(r'[ACGT]{4}', prefix) or not re.fullmatch(r'[ACGT]{4}', suffix):
            raise ValueError('If category is empty, prefix and suffix must be exactly 4 bp and contain only A/T/C/G')
    else:
        if not prefix == suffix == '':
            raise ValueError('If category is provided, prefix and suffix must be empty')

    return prefix, suffix, category


def _get_pupd2() -> Dseqrecord:
    p_upd2 = pydna_parse(os.path.join(os.path.dirname(__file__), 'pUPD2.gb'))[0]
    p_upd2.source = AddgeneIdSource(
        repository_id='68161',
        addgene_sequence_type='depositor-full',
        sequence_file_url='https://media.addgene.org/snapgene-media/v3.38.0/sequences/119013/5a5f4064-22b9-4374-aa25-8d4d8867b261/addgene-plasmid-68161-sequence-119013.gbk',
    )
    return p_upd2


async def _run_cloning_workflow(
    sequence: TextFileSequence,
    location: Location,
    cloning_type: CloningType,
    category: AllowedCategory | None,
    prefix: str,
    suffix: str,
    enzymes: list[EnzymeToRemove],
    part_name: str,
) -> BaseCloningStrategy:
    template = read_dsrecord_from_json(sequence)
    is_compound_location = isinstance(location, CompoundLocation)
    if is_compound_location and cloning_type == CloningType.DOMESTICATION:
        part = Dseqrecord(compound_location_to_capitalized_str(template, location))
    else:
        part = location.extract(template)

    seq_bytes = part.format('fasta').encode('utf-8')
    gb_action = cloning_type.value
    gb_url = f'https://goldenbraidpro.com/do/{gb_action}/'
    gb_protocol_url = f'https://goldenbraidpro.com/do/{gb_action}/protocol/'

    async with get_http_client() as client:
        first_get = await client.get(gb_url, follow_redirects=True)
        csrf_token = _extract_csrf_token(first_get.text)
        if csrf_token is None:
            raise ValueError(f'Could not extract csrf token from GoldenBraid {gb_action} page')

        request_data = {
            'csrfmiddlewaretoken': csrf_token,
            'category': category.value if category is not None else '',
            'prefix': prefix,
            'suffix': suffix,
            'enzymes': [enzyme.value for enzyme in enzymes],
        }
        if is_compound_location and cloning_type == CloningType.DOMESTICATION:
            request_data['with_intron'] = 'on'

        response = await client.post(
            gb_url,
            data=request_data,
            files={'seq': ('sequence.fasta', seq_bytes, 'application/octet-stream')},
            headers={'Referer': gb_url},
            follow_redirects=True,
        )
        soup = BeautifulSoup(response.text, 'html.parser')
        response_errors = _extract_unique_error_messages(soup)
        if response_errors:
            raise ValueError('; '.join(response_errors))

        record_input = soup.find('input', attrs={'name': 'record'})
        if record_input is None or record_input.get('value') is None:
            raise ValueError('Could not find GenBank record input in response HTML')
        expected_product = custom_file_parser(io.StringIO(record_input['value']), SequenceFileFormat('genbank'))[0]
        expected_product.seq.circular = True

        assembly_inputs = []
        if cloning_type == CloningType.DOMESTICATION:
            protocol_form = soup.find('form', attrs={'action': f'/do/{gb_action}/protocol/'})
            if protocol_form is None:
                raise ValueError(f'Could not find {gb_action} protocol form in response HTML')

            protocol_payload: dict[str, str] = {}
            for input_tag in protocol_form.find_all('input'):
                tag_name = input_tag.get('name')
                value = input_tag.get('value')
                if tag_name is not None and value is not None:
                    protocol_payload[tag_name] = value

            protocol_response = await client.post(
                gb_protocol_url,
                data=protocol_payload,
                headers={'Referer': gb_url},
                follow_redirects=True,
            )

            pair_pattern = re.compile(
                r'Oligo forward:\s*([ACGTacgt]+)\s*\n\s*Oligo reverse:\s*([ACGTacgt]+)',
                flags=re.MULTILINE,
            )
            oligo_pairs: list[tuple[Primer, Primer]] = [
                (
                    Primer(match.group(1), name=f'{part_name}_fwd_{i}'),
                    Primer(match.group(2), name=f'{part_name}_rev_{i}'),
                )
                for i, match in enumerate(pair_pattern.finditer(protocol_response.text), start=1)
            ]
            if not oligo_pairs:
                raise ValueError('No oligo pairs found in domestication protocol response')

            for i, (fwd, rev) in enumerate(oligo_pairs, start=1):
                try:
                    product = pcr_assembly(template, fwd, rev, limit=14, mismatches=0)[0]
                except IndexError as exc:
                    raise ValueError(f'No PCR product found for oligo pair {i}') from exc
                product.name = f'pcr_product_{i}'
                assembly_inputs.append(product)
        else:
            main_div = soup.find('div', attrs={'id': 'main'})
            if main_div is None:
                raise ValueError('Could not find div#main in synthesis response HTML')
            sequence_pre = main_div.find('pre')
            if sequence_pre is None:
                raise ValueError('Could not find synthesis sequence <pre> in div#main')
            synthesis_sequence = re.sub(r'\s+', '', sequence_pre.get_text())
            if not synthesis_sequence or not re.fullmatch(r'[ACGTacgt]+', synthesis_sequence):
                raise ValueError('Synthesis sequence <pre> is empty or contains invalid characters')
            synthesized_sequence = Dseqrecord(synthesis_sequence, circular=False)
            synthesized_sequence.source = Source(input=[SourceInput(sequence=template)])
            synthesized_sequence.name = f'{part_name}_synthesized'
            assembly_inputs.append(synthesized_sequence)

    p_upd2 = _get_pupd2()
    enzymes_batch = RestrictionBatch(first=[req_enzyme.value for req_enzyme in enzymes])
    assemblies = restriction_ligation_assembly(assembly_inputs + [p_upd2], enzymes_batch, circular_only=True)
    if len(assemblies) != 1:
        raise ValueError(f'Expected exactly one assembly, got {len(assemblies)}')

    assembly = assemblies[0]
    if expected_product.seguid() != assembly.seguid():
        raise ValueError(f'Expected product {expected_product.seguid()} != assembly {assembly.seguid()}')
    assembly.name = 'domesticated_part'
    # Add the annotations from the expected product to the assembly
    shifted_expected = expected_product.synced(assembly)
    if len(shifted_expected.features) > 0 and cloning_type == CloningType.SYNTHESIS:
        feat1 = shifted_expected.features[0]
        if 'label' in feat1.qualifiers and 'CDS' in feat1.qualifiers['label'][0]:
            feat1.type = 'CDS'

    for feat in shifted_expected.features:
        if 'label' not in feat.qualifiers or not feat.qualifiers['label']:
            feat.qualifiers['label'] = [part_name]

    assembly.features.extend(shifted_expected.features)
    pydna_strategy = PydnaCloningStrategy.from_dseqrecords([assembly])
    return BaseCloningStrategy.model_validate(pydna_strategy.model_dump())


@router.post('/batch_cloning/domesticate', response_model=BaseCloningStrategy)
async def domesticate(request: BatchDomesticateRequest):
    try:
        prefix, suffix, category = _validate_request(request)
        location = request.location.to_biopython_location()  # Parse-only for now, not applied yet.
        return await _run_cloning_workflow(
            request.sequence,
            location,
            request.cloning_type,
            category,
            prefix,
            suffix,
            request.enzymes,
            request.part_name,
        )
    except Exception as e:
        raise HTTPException(400, str(e)) from e
