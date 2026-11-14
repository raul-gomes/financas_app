"""The Alembic revision graph must be a single, linear chain with unique revision ids."""

import warnings
from pathlib import Path

from alembic.config import Config as AlembicConfig
from alembic.script import ScriptDirectory

BACKEND_DIR = Path(__file__).resolve().parent.parent


def load_script_directory() -> ScriptDirectory:
    """Load the project's migration scripts, turning Alembic warnings into errors."""
    config = AlembicConfig(str(BACKEND_DIR / "alembic.ini"))
    config.set_main_option("script_location", str(BACKEND_DIR / "app/db/migrations"))
    with warnings.catch_warnings():
        warnings.simplefilter("error")
        return ScriptDirectory.from_config(config)


def test_revision_ids_are_unique_and_there_is_a_single_head():
    scripts = load_script_directory()

    assert len(scripts.get_heads()) == 1


def test_whole_chain_walks_from_head_to_base():
    scripts = load_script_directory()

    revisions = list(scripts.walk_revisions())

    assert revisions[-1].down_revision is None
    assert len({rev.revision for rev in revisions}) == len(revisions)
