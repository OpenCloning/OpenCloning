from pydna.primer import Primer
from pydna.dseqrecord import Dseqrecord
from pydna.assembly2 import pcr_assembly, gateway_assembly
from Bio.Seq import reverse_complement
from pydna.opencloning_models import CloningStrategy

primer1 = Primer('ACGTACGT')
primer2 = Primer(reverse_complement('GCGCGCGC'))

pcr_template = Dseqrecord('ccccACGTACGTAAAAAAGCGCGCGCcccc', circular=True)

pcr_product, *_ = pcr_assembly(pcr_template, primer1, primer2, limit=8)

primer1.name = 'primer1'
primer2.name = 'primer2'
pcr_template.name = 'template'
pcr_product.name = 'pcr_product'


attB1 = 'ACAACTTTGTACAAAAAAGCAGAAG'
attP1 = 'AAAATAATGATTTTATTTGACTGATAGTGACCTGTTCGTTGCAACAAATTGATGAGCAATGCTTTTTTATAATGCCAACTTTGTACAAAAAAGCTGAACGAGAAGCGTAAAATGATATAAATATCAATATATTAAATTAGATTTTGCATAAAAAACAGACTACATAATACTGTAAAACACAACATATCCAGTCACTATGAATCAACTACTTAGATGGTATTAGTGACCTGTA'

seq1 = Dseqrecord('aaa' + attB1 + 'ccc', name='attB_input')
seq2 = Dseqrecord('aaa' + attP1 + 'ccc', name='attP_input')

product_gateway_BP, *_ = gateway_assembly([seq1, seq2], 'BP')
product_gateway_BP.name = 'product_gateway_BP'

cs_pcr = CloningStrategy.from_dseqrecords([pcr_product])
cs_gateway_BP = CloningStrategy.from_dseqrecords([product_gateway_BP])
