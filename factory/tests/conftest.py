import json
import os

import pytest

FIXTURES_DIR = os.path.join(os.path.dirname(os.path.abspath(__file__)), "fixtures")
ARTICLES_FILE = os.path.join(FIXTURES_DIR, "articles.json")


@pytest.fixture
def articles():
    if not os.path.exists(ARTICLES_FILE):
        pytest.fail(
            f"{ARTICLES_FILE} が見つかりません。"
            "先に `python3 factory/tests/generate_fixtures.py` を実行してください。"
        )
    with open(ARTICLES_FILE, "r", encoding="utf-8") as f:
        return json.load(f)
