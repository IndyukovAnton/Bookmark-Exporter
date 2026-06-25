#!/usr/bin/env python3
"""Split a bookmarks HTML export into grouped pages by URL origin."""

from __future__ import annotations

import argparse
import html
import re
import shutil
import sys
from collections import defaultdict
from pathlib import Path
from urllib.parse import urlparse


PAGES_DIR = "pages"


ITEM_PATTERN = re.compile(
    r'<li data-tab-item>\s*'
    r'<a href="([^"]+)"[^>]*>(.*?)</a>\s*'
    r'<span>.*?</span>\s*'
    r'</li>',
    re.DOTALL,
)


def parse_bookmarks(source: Path) -> list[tuple[str, str]]:
    content = source.read_text(encoding="utf-8")
    items: list[tuple[str, str]] = []
    seen_urls: set[str] = set()

    for href, raw_title in ITEM_PATTERN.findall(content):
        url = html.unescape(href).strip()
        title = html.unescape(re.sub(r"\s+", " ", raw_title)).strip()

        if not url or url in seen_urls:
            continue

        seen_urls.add(url)
        items.append((title, url))

    if not items:
        raise ValueError(f"No bookmarks found in {source}")

    return items


def normalize_group_key(url: str) -> str:
    parsed = urlparse(url)
    scheme = parsed.scheme.lower() if parsed.scheme else "https"
    host = parsed.netloc.lower()

    if host.startswith("www."):
        host = host[4:]

    if not host:
        return "other"

    return f"{scheme}://{host}"


def group_label(group_key: str) -> str:
    if group_key == "other":
        return "Прочее"

    parsed = urlparse(group_key if "://" in group_key else f"https://{group_key}")
    return parsed.netloc or group_key


def slugify(value: str) -> str:
    slug = re.sub(r"[^a-z0-9]+", "-", value.lower()).strip("-")
    return slug or "group"


def build_slug_map(groups: dict[str, list[tuple[str, str]]]) -> dict[str, str]:
    slug_map: dict[str, str] = {"__all__": "all"}
    used_slugs: set[str] = {"all"}

    for group_key in sorted(groups, key=lambda key: group_label(key).lower()):
        base = slugify(group_label(group_key))
        slug = base
        suffix = 2

        while slug in used_slugs:
            slug = f"{base}-{suffix}"
            suffix += 1

        used_slugs.add(slug)
        slug_map[group_key] = slug

    return slug_map


CSS = """\
body { margin: 0; padding: 32px; color: #18212f; background: #f6f7f9; font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", sans-serif; }
main { max-width: 960px; margin: 0 auto; }
h1 { margin: 0 0 8px; font-size: 28px; }
.page-meta { margin: 0 0 20px; color: #5f6b7a; font-size: 14px; }
.toolbar { display: grid; gap: 8px; margin: 0 0 18px; }
label { color: #18212f; font-size: 14px; font-weight: 700; }
input { width: 100%; min-height: 44px; padding: 10px 12px; border: 1px solid #cfd7e1; border-radius: 8px; color: #18212f; background: #fff; font: inherit; box-sizing: border-box; }
input:focus-visible { outline: 3px solid rgba(23, 107, 87, 0.24); border-color: #176b57; }
#search-summary { margin: 0; color: #5f6b7a; font-size: 13px; }
#empty-search { margin: 16px 0 0; padding: 16px; border: 1px solid #d9dee7; border-radius: 8px; color: #5f6b7a; background: #fff; text-align: center; }
.hidden { display: none !important; }
.tabs { display: flex; flex-wrap: wrap; gap: 8px; margin: 0 0 24px; padding: 0; list-style: none; }
.tabs a { display: inline-block; padding: 8px 14px; border: 1px solid #cfd7e1; border-radius: 999px; color: #18212f; background: #fff; text-decoration: none; font-size: 14px; font-weight: 600; }
.tabs a:hover { border-color: #176b57; color: #176b57; }
.tabs a.is-active { border-color: #176b57; background: #176b57; color: #fff; }
.tabs a .count { opacity: 0.75; font-weight: 500; }
.group-grid { display: grid; gap: 10px; margin: 0; padding: 0; list-style: none; }
.group-grid a { display: grid; gap: 4px; padding: 14px 16px; border: 1px solid #d9dee7; border-radius: 8px; background: #fff; color: #176b57; font-weight: 700; text-decoration: none; }
.group-grid a:hover { border-color: #176b57; }
.group-grid span { color: #5f6b7a; font-size: 13px; font-weight: 500; }
ul.bookmarks { display: grid; gap: 10px; margin: 0; padding: 0; list-style: none; }
ul.bookmarks li { display: grid; gap: 4px; padding: 14px 16px; border: 1px solid #d9dee7; border-radius: 8px; background: #fff; }
ul.bookmarks a { color: #176b57; font-weight: 700; text-decoration: none; }
ul.bookmarks a:hover { text-decoration: underline; }
ul.bookmarks span { color: #5f6b7a; font-size: 13px; word-break: break-all; }
.back-link { display: inline-block; margin-bottom: 16px; color: #176b57; text-decoration: none; font-weight: 600; }
.back-link:hover { text-decoration: underline; }
"""


SEARCH_SCRIPT = """\
(function initSearch() {
  const searchInput = document.getElementById('tabs-search');
  const summary = document.getElementById('search-summary');
  const emptySearch = document.getElementById('empty-search');
  const items = Array.from(document.querySelectorAll('[data-tab-item]'));

  function updateSearch() {
    const query = searchInput.value.trim().toLowerCase();
    const hasQuery = query !== '';
    let visibleCount = 0;

    items.forEach((item) => {
      const isVisible = !hasQuery || item.textContent.toLowerCase().includes(query);
      item.classList.toggle('hidden', !isVisible);

      if (isVisible) {
        visibleCount += 1;
      }
    });

    summary.textContent = `Найдено: ${visibleCount}`;
    emptySearch.classList.toggle('hidden', !hasQuery || visibleCount > 0);
  }

  searchInput.addEventListener('input', updateSearch);
  updateSearch();
}());
"""


def render_bookmark_items(items: list[tuple[str, str]]) -> str:
    lines: list[str] = []

    for title, url in items:
        lines.append(
            "      "
            f'<li data-tab-item><a href="{html.escape(url, quote=True)}" '
            f'target="_blank" rel="noreferrer noopener">'
            f"{html.escape(title)}</a>"
            f"<span>{html.escape(url)}</span></li>"
        )

    return "\n".join(lines)


def page_href(slug: str) -> str:
    return f"{PAGES_DIR}/{slug}.html"


def render_tabs(
    groups: dict[str, list[tuple[str, str]]],
    slug_map: dict[str, str],
    active_slug: str,
    max_visible: int = 20,
) -> str:
    tabs: list[str] = [
        '      <li><a class="tabs-link" href="../index.html">Группы</a></li>',
        '      <li><a class="tabs-link{active}" href="all.html">Все<span class="count"> ({count})</span></a></li>'.format(
            active=" is-active" if active_slug == "all" else "",
            count=sum(len(items) for items in groups.values()),
        ),
    ]

    ordered_groups = sorted(
        groups.items(),
        key=lambda pair: (-len(pair[1]), group_label(pair[0]).lower()),
    )

    visible_groups: list[tuple[str, list[tuple[str, str]]]] = []
    active_group: tuple[str, list[tuple[str, str]]] | None = None

    for group_key, items in ordered_groups:
        slug = slug_map[group_key]
        if slug == active_slug:
            active_group = (group_key, items)
            continue
        visible_groups.append((group_key, items))

    if active_group is not None:
        visible_groups.insert(0, active_group)

    shown_groups = visible_groups[:max_visible]
    hidden_count = len(ordered_groups) - len(shown_groups)

    for group_key, items in shown_groups:
        slug = slug_map[group_key]
        label = html.escape(group_label(group_key))
        active_class = " is-active" if slug == active_slug else ""
        tabs.append(
            f'      <li><a class="tabs-link{active_class}" href="{slug}.html">'
            f"{label}<span class=\"count\"> ({len(items)})</span></a></li>"
        )

    if hidden_count > 0:
        tabs.append(
            f'      <li><a class="tabs-link" href="../index.html">'
            f"Ещё группы<span class=\"count\"> (+{hidden_count})</span></a></li>"
        )

    return "\n".join(tabs)


def render_page(
    *,
    title: str,
    subtitle: str,
    body: str,
    active_slug: str,
    groups: dict[str, list[tuple[str, str]]],
    slug_map: dict[str, str],
    include_search: bool,
    include_tab_nav: bool = True,
) -> str:
    tabs_html = ""
    if include_tab_nav:
        tabs_html = f"""    <ul class="tabs">
{render_tabs(groups, slug_map, active_slug)}
    </ul>
"""
    search_block = ""

    if include_search:
        search_block = """
    <div class="toolbar">
      <label for="tabs-search">Поиск</label>
      <input id="tabs-search" type="search" placeholder="Введите название или адрес" autocomplete="off">
      <p id="search-summary" aria-live="polite"></p>
    </div>"""

    search_script = f"\n  <script>\n{SEARCH_SCRIPT}\n  </script>" if include_search else ""

    return f"""<!DOCTYPE html>
<html lang="ru">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>{html.escape(title)}</title>
  <style>
{CSS}
  </style>
</head>
<body>
  <main>
    <h1>{html.escape(title)}</h1>
    <p class="page-meta">{html.escape(subtitle)}</p>
{tabs_html}{search_block}
{body}
  </main>{search_script}
</body>
</html>
"""


def write_group_pages(
    pages_dir: Path,
    groups: dict[str, list[tuple[str, str]]],
    slug_map: dict[str, str],
) -> None:
    pages_dir.mkdir(parents=True, exist_ok=True)

    all_items = sorted(
        (item for items in groups.values() for item in items),
        key=lambda pair: pair[0].lower(),
    )

    all_body = f"""    <ul class="bookmarks">
{render_bookmark_items(all_items)}
    </ul>
    <p id="empty-search" class="hidden">Ничего не найдено</p>"""

    (pages_dir / "all.html").write_text(
        render_page(
            title="Все вкладки",
            subtitle=f"Всего ссылок: {len(all_items)}",
            body=all_body,
            active_slug="all",
            groups=groups,
            slug_map=slug_map,
            include_search=True,
        ),
        encoding="utf-8",
    )

    for group_key, items in groups.items():
        slug = slug_map[group_key]
        label = group_label(group_key)
        sorted_items = sorted(items, key=lambda pair: pair[0].lower())
        body = f"""    <ul class="bookmarks">
{render_bookmark_items(sorted_items)}
    </ul>
    <p id="empty-search" class="hidden">Ничего не найдено</p>"""

        (pages_dir / f"{slug}.html").write_text(
            render_page(
                title=label,
                subtitle=f"Группа: {group_key} · Ссылок: {len(sorted_items)}",
                body=body,
                active_slug=slug,
                groups=groups,
                slug_map=slug_map,
                include_search=True,
            ),
            encoding="utf-8",
        )


def write_index(
    output_dir: Path,
    groups: dict[str, list[tuple[str, str]]],
    slug_map: dict[str, str],
) -> None:
    total = sum(len(items) for items in groups.values())
    group_count = len(groups)

    cards: list[str] = [
        f'      <li data-tab-item><a href="{page_href("all")}">Все вкладки<span>'
        f"Все {total} ссылок в одном списке</span></a></li>"
    ]

    ordered_groups = sorted(
        groups.items(),
        key=lambda pair: (-len(pair[1]), group_label(pair[0]).lower()),
    )

    for group_key, items in ordered_groups:
        slug = slug_map[group_key]
        label = html.escape(group_label(group_key))
        origin = html.escape(group_key)
        cards.append(
            f'      <li data-tab-item><a href="{page_href(slug)}">{label}<span>'
            f"{origin} · {len(items)} ссылок</span></a></li>"
        )

    body = f"""    <div class="toolbar">
      <label for="tabs-search">Поиск по группам</label>
      <input id="tabs-search" type="search" placeholder="Введите домен или название группы" autocomplete="off">
      <p id="search-summary" aria-live="polite"></p>
    </div>
    <ul class="group-grid">
{chr(10).join(cards)}
    </ul>
    <p id="empty-search" class="hidden">Ничего не найдено</p>
  <script>
{SEARCH_SCRIPT}
  </script>"""

    (output_dir / "index.html").write_text(
        render_page(
            title="Закладки",
            subtitle=f"Групп: {group_count} · Ссылок: {total}",
            body=body,
            active_slug="",
            groups=groups,
            slug_map=slug_map,
            include_search=False,
            include_tab_nav=False,
        ),
        encoding="utf-8",
    )


def split_bookmarks(source: Path, output_dir: Path) -> dict[str, int]:
    items = parse_bookmarks(source)
    groups: dict[str, list[tuple[str, str]]] = defaultdict(list)

    for title, url in items:
        groups[normalize_group_key(url)].append((title, url))

    slug_map = build_slug_map(groups)

    if output_dir.exists():
        shutil.rmtree(output_dir)

    output_dir.mkdir(parents=True)

    write_index(output_dir, groups, slug_map)
    write_group_pages(output_dir / PAGES_DIR, groups, slug_map)

    return {
        "bookmarks": len(items),
        "groups": len(groups),
        "pages": len(groups) + 1,
    }


def main() -> int:
    parser = argparse.ArgumentParser(
        description="Split bookmarks HTML into grouped pages by URL origin.",
    )
    parser.add_argument(
        "input",
        type=Path,
        help="Path to bookmarks HTML file (e.g. bookmarks.html)",
    )
    parser.add_argument(
        "-o",
        "--output",
        type=Path,
        default=Path("output"),
        help="Output directory (default: output)",
    )

    args = parser.parse_args()

    if not args.input.is_file():
        print(f"Input file not found: {args.input}", file=sys.stderr)
        return 1

    try:
        stats = split_bookmarks(args.input, args.output)
    except ValueError as error:
        print(error, file=sys.stderr)
        return 1

    print(f"Created: {args.output.resolve() / 'index.html'}")
    print(f"Pages dir: {args.output.resolve() / PAGES_DIR}")
    print(f"Bookmarks: {stats['bookmarks']}")
    print(f"Groups: {stats['groups']}")
    print(f"Pages: {stats['pages']} in {PAGES_DIR}/ (+ index.html)")

    return 0


if __name__ == "__main__":
    raise SystemExit(main())
