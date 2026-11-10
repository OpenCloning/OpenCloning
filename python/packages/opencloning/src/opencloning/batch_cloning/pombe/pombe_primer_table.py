from collections import OrderedDict

import pandas as pd
from pydna import tm
from pydna.primer import Primer

from .pombe_naming import CloningType

PRIMER_KEYS = ['primer_fwd', 'primer_rvs', 'primer_fwd_check', 'primer_rvs_check']

PRIMERS_BY_KEY = {
    'primer_fwd': 0,
    'primer_rvs': 1,
    'primer_fwd_check': 2,
    'primer_rvs_check': 3,
}


def _primer_tm_region(primer: Primer) -> str:
    seq = str(primer.seq)
    uppercase = ''.join(c for c in seq if c.isupper())
    return uppercase if uppercase else seq.upper()


def build_primer_summary_df(
    gene_results: list[tuple[str, CloningType, tuple[Primer, Primer, Primer, Primer]]],
) -> pd.DataFrame:
    primer_summary = []
    for _, _, primers in gene_results:
        for primer_key in PRIMER_KEYS:
            primer = primers[PRIMERS_BY_KEY[primer_key]]
            tm_region = _primer_tm_region(primer)
            primer_summary.append(
                OrderedDict(
                    {
                        'name': primer.name,
                        'sequence': str(primer.seq),
                        'tm': tm.tm_default(tm_region),
                    }
                )
            )

    primer_df = pd.DataFrame(primer_summary)
    primer_df['tm'] = primer_df['tm'].round(1)
    return primer_df


def primer_summary_to_html(primer_df: pd.DataFrame) -> str:
    return primer_df.to_html(
        index=False,
        border=0,
        classes='primer-summary-table',
        float_format='%.1f',
    )
