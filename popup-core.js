(function attachCore(root, factory) {
  const core = factory();

  if (typeof module !== 'undefined' && module.exports) {
    module.exports = core;
  }

  if (root) {
    root.BookmarkExporterCore = core;
  }
}(typeof globalThis !== 'undefined' ? globalThis : undefined, function createCore() {
  const DEFAULT_FILENAME = 'open-tabs';
  const EXPORTABLE_PROTOCOLS = new Set(['http:', 'https:', 'file:']);
  const FORMAT_CONFIG = {
    html: {
      extension: '.html',
      mimeType: 'text/html',
    },
    md: {
      extension: '.md',
      mimeType: 'text/markdown',
    },
    txt: {
      extension: '.txt',
      mimeType: 'text/plain',
    },
  };

  function isExportableUrl(url) {
    if (typeof url !== 'string' || url.trim() === '') {
      return false;
    }

    try {
      return EXPORTABLE_PROTOCOLS.has(new URL(url).protocol);
    } catch (_) {
      return false;
    }
  }

  function normalizeOpenTabs(tabs) {
    if (!Array.isArray(tabs)) {
      return [];
    }

    return tabs
      .filter((tab) => tab.pinned !== true && isExportableUrl(tab.url))
      .map((tab) => {
        const title = typeof tab.title === 'string' && tab.title.trim() !== ''
          ? tab.title.trim()
          : tab.url;

        return {
          id: tab.id,
          title,
          url: tab.url,
        };
      });
  }

  async function fetchOpenTabs(tabsApi) {
    if (!tabsApi || typeof tabsApi.query !== 'function') {
      throw new Error('Нет доступа к открытым вкладкам браузера.');
    }

    const tabs = await tabsApi.query({ currentWindow: true });

    return normalizeOpenTabs(tabs);
  }

  function sanitizeFilename(filename) {
    const sanitized = String(filename || DEFAULT_FILENAME)
      .replace(/[<>:"/\\|?*]/g, '')
      .replace(/\s+/g, ' ')
      .trim();

    return sanitized || DEFAULT_FILENAME;
  }

  function escapeHtml(value) {
    return String(value)
      .replace(/&/g, '&amp;')
      .replace(/</g, '&lt;')
      .replace(/>/g, '&gt;')
      .replace(/"/g, '&quot;')
      .replace(/'/g, '&#39;');
  }

  function escapeMarkdown(value) {
    return String(value).replace(/([\\[\]()`*_{}#+\-.!|>])/g, '\\$1');
  }

  function buildMarkdown(links) {
    const items = links
      .map((link) => `- [${escapeMarkdown(link.title)}](${link.url})`)
      .join('\n');

    return `# Открытые вкладки\n\n${items}\n`;
  }

  function buildText(links) {
    const items = links
      .map((link) => `${link.title}\n${link.url}`)
      .join('\n\n');

    return `${items}\n`;
  }

  function buildHtml(links) {
    const items = links
      .map((link) => {
        const title = escapeHtml(link.title);
        const url = escapeHtml(link.url);

        return `      <li data-tab-item><a href="${url}" target="_blank" rel="noreferrer noopener">${title}</a><span>${url}</span></li>`;
      })
      .join('\n');

    return `<!DOCTYPE html>
<html lang="ru">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>Открытые вкладки</title>
  <style>
    body { margin: 0; padding: 32px; color: #18212f; background: #f6f7f9; font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", sans-serif; }
    main { max-width: 860px; margin: 0 auto; }
    h1 { margin: 0 0 20px; font-size: 28px; }
    .toolbar { display: grid; gap: 8px; margin: 0 0 18px; }
    label { color: #18212f; font-size: 14px; font-weight: 700; }
    input { width: 100%; min-height: 44px; padding: 10px 12px; border: 1px solid #cfd7e1; border-radius: 8px; color: #18212f; background: #fff; font: inherit; }
    input:focus-visible { outline: 3px solid rgba(23, 107, 87, 0.24); border-color: #176b57; }
    #search-summary { margin: 0; color: #5f6b7a; font-size: 13px; }
    #empty-search { margin: 16px 0 0; padding: 16px; border: 1px solid #d9dee7; border-radius: 8px; color: #5f6b7a; background: #fff; text-align: center; }
    ul { display: grid; gap: 10px; margin: 0; padding: 0; list-style: none; }
    li { display: grid; gap: 4px; padding: 14px 16px; border: 1px solid #d9dee7; border-radius: 8px; background: #fff; }
    a { color: #176b57; font-weight: 700; text-decoration: none; }
    a:hover { text-decoration: underline; }
    span { color: #5f6b7a; font-size: 13px; word-break: break-all; }
  </style>
</head>
<body>
  <main>
    <h1>Открытые вкладки</h1>
    <div class="toolbar">
      <label for="tabs-search">Поиск по вкладкам</label>
      <input id="tabs-search" type="search" placeholder="Введите название или адрес" autocomplete="off">
      <p id="search-summary" aria-live="polite">Найдено: ${links.length}</p>
    </div>
    <ul id="tabs-list">
${items}
    </ul>
    <p id="empty-search" hidden>Ничего не найдено</p>
  </main>
  <script>
    (function initSearch() {
      const searchInput = document.getElementById('tabs-search');
      const summary = document.getElementById('search-summary');
      const emptySearch = document.getElementById('empty-search');
      const items = Array.from(document.querySelectorAll('[data-tab-item]'));

      function updateSearch() {
        const query = searchInput.value.trim().toLowerCase();
        let visibleCount = 0;

        items.forEach((item) => {
          const isVisible = query === '' || item.textContent.toLowerCase().includes(query);
          item.hidden = !isVisible;

          if (isVisible) {
            visibleCount += 1;
          }
        });

        summary.textContent = \`Найдено: \${visibleCount}\`;
        emptySearch.hidden = visibleCount > 0;
      }

      searchInput.addEventListener('input', updateSearch);
      updateSearch();
    }());
  </script>
</body>
</html>`;
  }

  function buildExportFile({ filename = DEFAULT_FILENAME, format = 'md', links = [] }) {
    const config = FORMAT_CONFIG[format];

    if (!config) {
      throw new Error(`Неподдерживаемый формат экспорта: ${format}`);
    }

    const baseFilename = sanitizeFilename(filename);
    const contentBuilders = {
      html: buildHtml,
      md: buildMarkdown,
      txt: buildText,
    };

    return {
      content: contentBuilders[format](links),
      extension: config.extension,
      fullFilename: `${baseFilename}${config.extension}`,
      mimeType: config.mimeType,
    };
  }

  return {
    buildExportFile,
    fetchOpenTabs,
    normalizeOpenTabs,
  };
}));
