"""
Functions to calculate primer melting temperature using primer3.
primer3 should not be imported anywhere else.
"""

import threading
from pydantic import BaseModel, Field
from itertools import product
from primer3.bindings import (
    calc_tm as _calc_tm,
    design_primers as _design_primers,
    calc_homodimer as _calc_homodimer,
    calc_hairpin as _calc_hairpin,
    calc_heterodimer as _calc_heterodimer,
)

# primer3-py is not thread-safe: thal() keeps its buffers in static globals and releases
# the GIL, and the bindings share a single global ThermoAnalysis object. FastAPI runs sync
# endpoints in a threadpool, so concurrent calls crash the process or return wrong values.
# Every call into primer3 must hold this lock.
_PRIMER3_LOCK = threading.Lock()


class PrimerDesignSettings(BaseModel):
    primer_dna_conc: float = Field(50, description='The DNA concentration in the primer solution (nM).')
    primer_salt_monovalent: float = Field(
        50, description='The monovalent salt concentration in the primer solution (mM).'
    )
    primer_salt_divalent: float = Field(
        1.5, description='The divalent salt concentration in the primer solution (mM).'
    )

    def to_primer3_args(self) -> dict:
        """Convert the settings to primer3 arguments."""
        return {
            'dna_conc': self.primer_dna_conc,
            'mv_conc': self.primer_salt_monovalent,
            'dv_conc': self.primer_salt_divalent,
        }


def primer3_calc_tm(seq: str, settings: PrimerDesignSettings) -> float:
    with _PRIMER3_LOCK:
        return _calc_tm(seq.upper(), **settings.to_primer3_args())


def primer3_design_primers(seq: str, seq_args: dict, global_args: dict):
    with _PRIMER3_LOCK:
        report = _design_primers(
            seq_args={
                'SEQUENCE_ID': 'MH1000',
                'SEQUENCE_TEMPLATE': seq,
                **seq_args,
            },
            global_args=global_args,
        )
    return report


class ThermodynamicResult(BaseModel):
    melting_temperature: float
    deltaG: float
    figure: str | None

    @classmethod
    def from_binding(cls, result):
        return cls(
            melting_temperature=result.tm,
            deltaG=result.dg,
            figure='\n'.join(result.ascii_structure_lines),
        )


def get_sequence_thermodynamic_result(sequence: str, method: callable):
    """Get the thermodynamic result for a sequence, if the sequence is longer than primer3 60bp limit, it will be split into two
    and the result with the lowest deltaG will be returned."""
    sequence = sequence.upper()
    if len(sequence) <= 60:
        sequences = [sequence]
    else:
        sequences = [sequence[:60], sequence[-60:]]

    with _PRIMER3_LOCK:
        results = [method(seq) for seq in sequences]
    results = [r for r in results if r.structure_found]
    if len(results) == 0:
        return None

    result = min(results, key=lambda r: r.dg)
    return ThermodynamicResult.from_binding(result)


def primer3_calc_homodimer(seq: str, settings: PrimerDesignSettings):
    return get_sequence_thermodynamic_result(
        seq, lambda x: _calc_homodimer(x, output_structure=True, **settings.to_primer3_args())
    )


def primer3_calc_hairpin(seq: str, settings: PrimerDesignSettings):
    return get_sequence_thermodynamic_result(
        seq, lambda x: _calc_hairpin(x, output_structure=True, **settings.to_primer3_args())
    )


def primer3_calc_heterodimer(seq1: str, seq2: str, settings: PrimerDesignSettings) -> ThermodynamicResult:
    if len(seq1) <= 60 or len(seq2) <= 60:
        sequence_pairs = [(seq1, seq2)]
    else:
        sequence_pairs = list(product((seq1[:60], seq1[-60:]), (seq2[:60], seq2[-60:])))

    with _PRIMER3_LOCK:
        results = [
            _calc_heterodimer(s1, s2, output_structure=True, **settings.to_primer3_args()) for s1, s2 in sequence_pairs
        ]
    results = [r for r in results if r.structure_found]
    if len(results) == 0:
        return None

    result = min(results, key=lambda r: r.dg)
    return ThermodynamicResult.from_binding(result)
