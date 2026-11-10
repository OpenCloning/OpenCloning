import opencloning_db.db as db_module
from opencloning_db.init_db import load_seed_data
from sqlalchemy import select, func
from sqlalchemy.orm import Session

from opencloning_db.models import Sequence, SequencingFile
from opencloning_db.migrations import reset_database


def test_init_db(postgres_test_config_write):
    """Load seed fixtures into the Postgres test DB using the shared test config."""
    postgres_test_config = postgres_test_config_write
    engine = db_module.get_engine(postgres_test_config)
    reset_database(engine)
    load_seed_data(engine)
    with Session(engine) as session:
        assert session.scalar(select(func.count()).select_from(Sequence)) == 56
        assert session.scalar(select(func.count()).select_from(SequencingFile)) == 3
