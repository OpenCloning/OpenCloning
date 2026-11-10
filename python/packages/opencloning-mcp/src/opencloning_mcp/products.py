"""Turn the response of the cloning API into a new step of the strategy.

The cloning API answers {"sources": [...], "sequences": [...]}: one source + sequence pair per possible
product (e.g. each fragment of a restriction digest). Like the user in the web app, the model has to
pick one when there are several.
"""

from mcp.server.mcpserver.exceptions import ToolError

from . import storage
from .summaries import summarize_sequence


def add_product_to_strategy(strategy_id: str, api_response: dict, product_index: int | None = None) -> dict:
    """Add one of the products to the strategy and return its summary.

    If there are several products and no product_index, nothing is added: the candidates are
    returned, and the model calls the tool again with the product_index it wants.
    """
    sources, sequences = api_response['sources'], api_response['sequences']
    warnings = {'warnings': api_response['warnings']} if 'warnings' in api_response else {}

    if len(sequences) > 1 and product_index is None:
        # Nothing is added, but check the strategy exists (and mark it as used) before answering
        storage.load_strategy(strategy_id)
        return {
            'status': 'choose_product',
            'message': (
                f'There are {len(sequences)} possible products, nothing was added. Call the same tool again with '
                'the same arguments and product_index set to the product you want.'
            ),
            'candidates': [{'product_index': i, **summarize_sequence(s)} for i, s in enumerate(sequences)],
            **warnings,
        }

    index = product_index or 0
    if not 0 <= index < len(sequences):
        raise ToolError(f'product_index must be between 0 and {len(sequences) - 1}')

    new_id = storage.append_step(strategy_id, sources[index], sequences[index])
    return {'status': 'added', 'sequence': {'id': new_id, **summarize_sequence(sequences[index])}, **warnings}
