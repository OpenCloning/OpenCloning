"""Tools to create a strategy, look at it, and export it."""

from . import cloning_api, names, storage
from .app import BASE_URL, FILE_TIP, FRONTEND_URL, mcp
from .summaries import summarize_sequence


@mcp.tool()
def start_strategy(description: str = '') -> dict:
    """Start a new, empty cloning strategy. Call this before any other tool.

    Returns a strategy_id: pass it to every other tool. To build several independent strategies,
    call this once per strategy. Pass on `tell_the_user` to the user.
    """
    strategy_id = storage.create_strategy(description)
    return {'strategy_id': strategy_id, 'tell_the_user': FILE_TIP}


@mcp.prompt(title='Start a cloning strategy')
def start() -> str:
    """Opening message that explains how to work with this server."""
    return (
        'I want to build a cloning strategy with the OpenCloning tools. Start a strategy, then briefly tell me '
        'what you can do (import sequences, digest, PCR, ligation, Gibson, Golden Gate, Gateway, homologous '
        'recombination...) and how to give you my files, and ask me what I want to clone.'
    )


@mcp.tool()
def describe_strategy(strategy_id: str) -> dict:
    """List the sequences and primers in the strategy, and how each sequence was made.

    For each sequence, `made_by` gives the type of step that produced it and the ids of its inputs
    (sequences or primers). Use this to find ids, or to check the state of the strategy before the next step.
    """
    strategy = storage.load_strategy(strategy_id)
    sources_by_id = {source['id']: source for source in strategy['sources']}
    sequences = []
    for sequence in strategy['sequences']:
        # A source and the sequence it produced share the same id
        source = sources_by_id[sequence['id']]
        sequences.append(
            {
                'id': sequence['id'],
                **summarize_sequence(sequence),
                'made_by': {'type': source['type'], 'input_ids': [i['sequence'] for i in source['input']]},
            }
        )
    primers = [{'id': p['id'], 'name': p['name'], 'sequence': p['sequence']} for p in strategy['primers']]
    return {'description': strategy['description'], 'sequences': sequences, 'primers': primers}


@mcp.tool()
def rename_sequence(strategy_id: str, sequence_id: int, name: str) -> dict:
    """Rename a sequence of the strategy, e.g. when the user would rather call it something else.

    Names cannot contain whitespace, spaces are replaced by underscores.
    """
    strategy = storage.load_strategy(strategy_id)
    sequence = storage.get_by_id(strategy, 'sequences', [sequence_id])[0]
    new_name = names.clean(name)
    renamed_sequence = cloning_api.post('/rename_sequence', json=sequence, params={'name': new_name})
    storage.rename_sequence(strategy_id, sequence_id, new_name, renamed_sequence)
    return {'id': sequence_id, 'name': new_name}


@mcp.tool()
def get_strategy_json(strategy_id: str) -> dict:
    """Get the links to open the strategy in OpenCloning, and to download it as a JSON file.

    Give the user `open_url` if present: it opens the strategy directly in the OpenCloning web app, where
    every step can be inspected and edited. Otherwise (or as a fallback), give `download_url`: the file can
    be loaded in the web app.
    """
    strategy = storage.load_strategy(strategy_id)
    links = {}
    if FRONTEND_URL:
        links['open_url'] = f'{FRONTEND_URL}/?source=mcp&strategy={strategy_id}'
    return {
        **links,
        'download_url': f'{BASE_URL}/strategies/{strategy_id}.json',
        'number_of_sequences': len(strategy['sequences']),
        'number_of_primers': len(strategy['primers']),
    }


@mcp.tool()
def get_upload_link(strategy_id: str) -> dict:
    """Get a link where the user can upload sequence files (GenBank, FASTA, SnapGene .dna...) in their browser.

    Use it for files you cannot pass as text: binary files like SnapGene .dna, or long files. The first
    sequence of each file is added to the strategy, and the form accepts several files at once. The upload
    happens outside this conversation, so ask the user to tell you when it is done, then call
    describe_strategy to get the ids of the new sequences.
    """
    storage.load_strategy(strategy_id)
    return {'upload_url': f'{BASE_URL}/strategies/{strategy_id}/upload'}
