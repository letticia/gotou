import os
import xml.etree.ElementTree as ET

from build_apple_dict import generate_xml_and_files
from generate_fixtures import TOTAL

NS = {"d": "http://www.apple.com/DTDs/DictionaryService-1.0.dtd"}


def test_generate_xml_and_files(articles, tmp_path):
    build_dir = tmp_path / "build"
    image_dir = tmp_path / "no_such_images"  # 実在しないディレクトリでも動くことを確認

    xml_path, css_path, plist_path = generate_xml_and_files(
        articles, str(build_dir), str(image_dir)
    )

    assert os.path.exists(xml_path)
    assert os.path.exists(css_path)
    assert os.path.exists(plist_path)
    assert os.path.isdir(build_dir / "OtherResources")

    tree = ET.parse(xml_path)
    entries = tree.getroot().findall("d:entry", NS)
    assert len(entries) == TOTAL
