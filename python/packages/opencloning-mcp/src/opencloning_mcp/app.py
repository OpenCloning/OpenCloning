"""The MCP server object and its settings.

Tools are registered on `mcp` in the tools_*.py modules, and server.py puts everything together.
"""

import asyncio
import logging
import os
from contextlib import asynccontextmanager

from mcp.server import MCPServer

from . import db, storage

PORT = int(os.environ.get('OPENCLONING_MCP_PORT', '8002'))
# Used to build the download links given to the user
BASE_URL = os.environ.get('OPENCLONING_MCP_BASE_URL', f'http://localhost:{PORT}').rstrip('/')
# Public URL of the OpenCloning web app, used to build links that open a strategy in it. The web app
# must have this server as its `mcpUrl` config, and it is the only origin allowed to fetch the strategies.
FRONTEND_URL = os.environ.get('OPENCLONING_MCP_FRONTEND_URL', 'http://localhost:3000').rstrip('/')

# How many plasmids a strategy can import from Addgene, to protect the API token of the server (there is no
# authentication, and a strategy is the closest thing to a session: the server is stateless)
MAX_ADDGENE_PER_STRATEGY = int(os.environ.get('OPENCLONING_MCP_MAX_ADDGENE_PER_STRATEGY', '20'))

logger = logging.getLogger(__name__)

# Returned by start_strategy for the model to pass on to the user
FILE_TIP = (
    "Tip: don't paste sequence files into the chat, it is slow and uses up your usage. Ask me for an upload link "
    'and upload the files there.'
)

# Sent to the model when it connects: how to use the tools together
INSTRUCTIONS = f"""
This server builds OpenCloning cloning strategies step by step. The strategy is stored on the server:
you never pass sequences around, you refer to sequences and primers by the integer ids the tools return.

Workflow:
1. Call start_strategy once and keep the returned strategy_id. Pass it to every other tool.
2. Add the starting sequences with the add_sequence_* tools, and the primers that the user gives you with
   add_primer. Each returns the id of the new sequence or primer.
   To take a gene or a region from a genome: find_genome_assembly (species -> reference assembly), find_gene,
   then add_genome_region_from_gene (with flanking bases); or add_genome_region_from_coordinates. Never
   guess an assembly or a gene when several match: ask the user.
3. Run cloning operations (restriction digest, PCR, ligation, assemblies...) on those ids.
   Each operation adds exactly one new sequence to the strategy and returns its id.
   Besides those, there are Gateway (BP/LR), Cre-lox, homologous recombination, CRISPR HDR, oligo
   hybridization, polymerase extension and reverse complement.
4. If a tool returns status "choose_product", nothing was added yet: pick the candidate that matches what
   the user wants (ask the user if it is not clear) and call the same tool again with product_index.
5. Call describe_strategy to see every sequence in the strategy and how it was made.
6. When the user is done, call get_strategy_json and give them the download link. The file opens in
   the OpenCloning web app.

Primers: design them, don't write them by hand. design_pcr_primers amplifies a region (with restriction
sites or other tails if wanted), and design_homology_primers makes primers with homology arms to replace a
region of a target, or insert at a point of it, by homologous recombination. They save the primers and return
their ids, to use in the pcr tool. Say where with a feature name, bases upstream or downstream of it, an amino
acid, or coordinates: list_features shows all the features of a sequence, and locate_region checks a region or
a point without changing anything. Tell the user what the region resolved to (the tools echo it), and check
with them when it is not obvious, e.g. which amino acid. After a pcr, call pcr_primer_details and show the
user the Tm of the part of each primer that binds the template, the tails, the Tm difference and the dimer.
primer_details does the same for whole primers that were not used in a PCR yet.
Spacers, linkers and tails: they change the construct, so they are the user's decision. If the user did not
ask for one and you think it is needed (e.g. a linker between a tag and a protein, a Kozak sequence), suggest it
and ask before using it, saying what it is for. The primer design tools enforce this: with a spacer or tail they
answer "needs_confirmation" and design nothing, until you call them again with spacer_approved_by_user=true,
which you only set once the user has agreed or asked for it. Never add one silently.

Annotations: add_feature, remove_features, resize_feature and remove_stop_codon change the features of a
sequence in place, without changing its bases. Use list_features first, and tell the user what was changed.
find_orfs lists the open reading frames of a sequence (read-only): use it to find or check a CDS to annotate.
Features lost by cutting through them: the cloning operations only keep a feature in the product if it is whole
in the part of the sequence that goes into it. If an operation cuts through a feature (a restriction site or a PCR
primer inside it, or a region replaced by homologous recombination that overlaps only part of it), the feature does
not appear in the product, even if most of its bases are there. Typical cases: replacing the stop codon of a CDS
with a tag leaves the CDS without annotation, and so do a gene amplified without its stop codon or a CDS cut by an
enzyme. This is different from a feature that is simply outside the amplified or replaced region, which is gone with
the rest of the sequence and needs nothing. When the user mentions a feature in their request (e.g. "tag the klp2
gene", "keep the GFP annotation") and it is missing from the product because it was cut through, compare
list_features of the inputs and of the product, and if the feature is still there (all or most of its bases,
possibly now fused to a tag or a linker), re-annotate it on the product with add_feature (use parts= for a fusion,
e.g. the CDS without its stop codon plus the tag), and tell the user what you added.

Files: users often drop or paste sequence files in the chat. Retyping a file as an argument is slow, uses up
the user's usage, and is impossible for binary files (SnapGene .dna). So:
- For a short text file (GenBank, FASTA, EMBL) use add_sequence_from_file.
- For binary files, or any long file you only have as text, call get_upload_link and tell the user plainly:
  "I can't read files dropped in the chat, please upload them here", then wait for them to say it is done.
- When you start a strategy, pass on the tip returned in `tell_the_user` to the user, in your own words.

Naming: every tool that creates a sequence takes an optional `name`, pass one so that the user can
recognise the sequences. The conventions are:
- An intermediate product: the name of the parent sequence plus what was done to it, e.g.
  "pFA6a-hphMX6_BamHI_SacI" for a restriction fragment, or "GFP_pcr" for a PCR product.
- A plasmid or construct that the user will keep: name it as a researcher would, e.g. "pFA6a-GFP".
- Names cannot contain whitespace (they go into a GenBank file): use underscores or hyphens, and keep
  them under 40 characters.
When you don't pass a name, one is derived from the parent sequence and the operation. Tell the user
which name you gave to a construct they will keep, and call rename_sequence if they prefer another one.

Only use ids returned by these tools. Strategies are deleted after {storage.INACTIVITY_MINUTES} minutes without
use, so offer the download link at the end of each task.
"""


async def delete_inactive_strategies_every_minute():
    while True:
        deleted = storage.delete_inactive_strategies()
        if deleted:
            logger.info('Deleted %d inactive strategies', deleted)
        await asyncio.sleep(60)


@asynccontextmanager
async def lifespan(server: MCPServer):
    """Runs once: the code before `yield` at startup, the code after it at shutdown."""
    db.init_db()
    cleanup_task = asyncio.create_task(delete_inactive_strategies_every_minute())
    yield
    cleanup_task.cancel()


mcp = MCPServer('OpenCloning', instructions=INSTRUCTIONS, lifespan=lifespan)
