import tempfile
import unittest
from pathlib import Path

from split_bookmarks import (
    PAGES_DIR,
    build_slug_map,
    normalize_group_key,
    parse_bookmarks,
    split_bookmarks,
)


SAMPLE_HTML = """<!DOCTYPE html>
<html lang="ru">
<body>
  <ul id="tabs-list">
    <li data-tab-item><a href="https://www.youtube.com/watch?v=abc" target="_blank" rel="noreferrer noopener">Video A</a><span>https://www.youtube.com/watch?v=abc</span></li>
    <li data-tab-item><a href="https://youtube.com/feed/trending" target="_blank" rel="noreferrer noopener">Trending</a><span>https://youtube.com/feed/trending</span></li>
    <li data-tab-item><a href="https://habr.com/ru/articles/1/" target="_blank" rel="noreferrer noopener">Habr 1</a><span>https://habr.com/ru/articles/1/</span></li>
    <li data-tab-item><a href="https://habr.com/ru/articles/2/" target="_blank" rel="noreferrer noopener">Habr 2</a><span>https://habr.com/ru/articles/2/</span></li>
    <li data-tab-item><a href="https://www.youtube.com/watch?v=abc" target="_blank" rel="noreferrer noopener">Duplicate</a><span>https://www.youtube.com/watch?v=abc</span></li>
  </ul>
</body>
</html>
"""


class SplitBookmarksTest(unittest.TestCase):
    def test_parse_bookmarks_deduplicates_urls(self):
        with tempfile.TemporaryDirectory() as tmp:
            source = Path(tmp) / "bookmarks.html"
            source.write_text(SAMPLE_HTML, encoding="utf-8")

            items = parse_bookmarks(source)

            self.assertEqual(len(items), 4)

    def test_normalize_group_key_strips_www(self):
        self.assertEqual(
            normalize_group_key("https://www.youtube.com/watch?v=1"),
            normalize_group_key("https://youtube.com/feed/trending"),
        )

    def test_split_bookmarks_creates_index_and_group_pages(self):
        with tempfile.TemporaryDirectory() as tmp:
            source = Path(tmp) / "bookmarks.html"
            output = Path(tmp) / "site"
            source.write_text(SAMPLE_HTML, encoding="utf-8")

            stats = split_bookmarks(source, output)

            self.assertEqual(stats["bookmarks"], 4)
            self.assertEqual(stats["groups"], 2)
            self.assertTrue((output / "index.html").is_file())
            self.assertTrue((output / PAGES_DIR / "all.html").is_file())
            self.assertTrue(any(path.suffix == ".html" for path in (output / PAGES_DIR).glob("*.html")))

            index_content = (output / "index.html").read_text(encoding="utf-8")
            self.assertIn("Все вкладки", index_content)
            self.assertIn(f"{PAGES_DIR}/", index_content)
            self.assertIn("habr.com", index_content)


if __name__ == "__main__":
    unittest.main()
