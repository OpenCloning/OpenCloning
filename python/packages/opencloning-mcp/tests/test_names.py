from opencloning_mcp import names


def test_clean_removes_whitespace_and_shortens():
    assert names.clean('my plasmid') == 'my_plasmid'
    assert names.clean('pFA6a-GFP') == 'pFA6a-GFP'
    assert len(names.clean('a' * 80)) == names.MAX_LENGTH


def test_primer_name_keeps_the_suffix_when_it_shortens_the_prefix():
    assert names.primer_name('cdc2', 'fwd') == 'cdc2_fwd'
    assert names.primer_name('my gene', 'EcoRI_rvs') == 'my_gene_EcoRI_rvs'
    long_name = names.primer_name('a' * 80, 'BamHI_fwd')
    assert len(long_name) == names.MAX_LENGTH
    assert long_name.endswith('_BamHI_fwd')


def test_derived_name():
    assert names.derived_name('pFA6a-hphMX6', 'BamHI_SacI') == 'pFA6a-hphMX6_BamHI_SacI'
    assert names.derived_name('GFP', 'pcr') == 'GFP_pcr'
