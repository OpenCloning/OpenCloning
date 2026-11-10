"""Names for the sequences that the tools create.

The model is asked to name every sequence it creates (see the naming conventions in the server
instructions). When it does not, a name is derived from the parent sequence and the operation, so
that the products are not all called "name", which is what the cloning API calls an unnamed sequence.
"""

from opencloning.dna_functions import read_dsrecord_from_json
from opencloning_linkml.datamodel import TextFileSequence

# Long names make the GenBank LOCUS line awkward, and are unreadable in the web app
MAX_LENGTH = 40


def clean(name: str) -> str:
    """Make a name usable in a GenBank file, where names cannot contain whitespace."""
    return '_'.join(name.split())[:MAX_LENGTH]


def sequence_name(sequence: dict) -> str:
    """The name of a sequence of the strategy (it is stored inside its GenBank file)."""
    return read_dsrecord_from_json(TextFileSequence.model_validate(sequence)).name


def primer_name(prefix: str, suffix: str) -> str:
    """The name of a designed primer, e.g. "cdc2_fwd". A long prefix is shortened, never the suffix."""
    return clean(prefix)[: MAX_LENGTH - len(suffix) - 1] + '_' + suffix


def derived_name(parent_name: str, operation: str) -> str:
    """The name of a product when the model did not give one.

    For example, the BamHI + SacI digest of pFA6a-hphMX6 gives "pFA6a-hphMX6_BamHI_SacI".
    """
    return clean(f'{parent_name}_{operation}')
