from fastapi import HTTPException
from opencloning_linkml.migrations import migrate
from opencloning.bug_fixing.backend_v0_3 import fix_backend_v0_3
from opencloning.pydantic_models import BaseCloningStrategy
from pydantic import ValidationError


def validate_cloning_strategy_format_and_migrate(data: dict, warnings: list) -> BaseCloningStrategy:
    if any(key not in data for key in ['primers', 'sources', 'sequences']):
        raise HTTPException(status_code=422, detail='The cloning strategy is invalid')

    try:
        migrated_data = migrate(data)
        if migrated_data is None:
            return BaseCloningStrategy.model_validate(data)

        data = migrated_data
        warnings.append(
            'The cloning strategy is in a previous version of the model and has been migrated to the latest version.'
        )

        fixed_data = fix_backend_v0_3(data)
        if fixed_data is not None:
            data = fixed_data
            warnings.append('The cloning strategy contained an error and has been turned into a template.')
        return BaseCloningStrategy.model_validate(data)
    except ValidationError:
        raise HTTPException(status_code=422, detail='The cloning strategy is invalid')
