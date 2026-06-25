# ENG

## A browser extension that allows you to quickly save necessary tabs, close them within the browser itself, and reopen exported links later.

### Available extensions for export: txt, markdown, html (as a separate page), json

## Installation steps:

1. Download the extension to a convenient location

- git clone https://github.com/IndyukovAnton/Bookmark-Exporter.git
- https://github.com/IndyukovAnton/Bookmark-Exporter/archive/refs/heads/master.zip

1. Enter 'chrome://extensions/' in the address bar
2. Activate "Developer Mode" on the right
3. Click "Load unpacked extension" in the top left and select the extension folder
4. Click "Details" and enable "Pin to toolbar" to make the extension visible in the toolbar next to the address bar
5. Click the extension icon and use the "Export" tab to select the file extension, enter a name, and toggle closing exported tabs on/off.
6. Use the "Import" tab to select an exported file or paste exported content, then open the links again.
7. Use the "Settings" tab to select a save folder and adjust the import limit. If no folder is selected, the browser downloads the file to Downloads.

---

# RU

# BBE - Browser Bookmarks Exporter

## Расширение для браузера, которое позволит быстро сохранить необходимые вкладки, закрыть их в самом браузере и позже заново открыть экспортированные ссылки.

### Доступные расширения для экспорта: txt, markdown, html (В виде отдельной страницы), json

## Безопасность и изоляция

- Расширение работает только через popup и не добавляет `content_scripts`, `host_permissions`, `background`, `scripting` или `activeTab`.
- Код не внедряется в открытые сайты и не изменяет DOM страниц пользователя.
- Доступ к вкладкам ограничен чтением открытых вкладок текущей группы, если браузер отдаёт `groupId`. Для Яндекс.Браузера дополнительно используется активный видимый контекст вкладок; если контекст недоступен, остаётся fallback на текущее окно. Закрытие экспортированных вкладок выполняется только после явного включения опции.
- Если браузер отдаёт стандартные группы через `tabGroups`, группу можно выбрать вручную в экспорте. Если Яндекс.Браузер не показывает свои группы через этот API, расширение не может прочитать их названия штатными средствами.
- Импорт открывает только поддерживаемые ссылки из JSON, MD, TXT и HTML экспорта; дубли по URL пропускаются, количество открываемых вкладок ограничивается настройкой импорта.
- Выбор папки использует File System Access API только по нажатию пользователя. Если API недоступен, файл скачивается стандартным способом в загрузки браузера.
- HTML-экспорт открывает ссылки с `rel="noreferrer noopener"`, чтобы сохранённый файл не передавал доступ к `window.opener`.

## Шаги по установки:

1. Скачайте расширение в удобное место

- git clone https://github.com/IndyukovAnton/Bookmark-Exporter.git
- https://github.com/IndyukovAnton/Bookmark-Exporter/archive/refs/heads/master.zip

2. В адресной строке введите 'chrome://extensions/'
3. Справа активируйте "Режим разработчика"
4. Слева сверху нажмите "Загрузить распакованное расширение" и выбери папку расширения
5. Нажмите сведения и включите "Закрепить на панели инструментов", чтобы расширение было видно на панели рядом с адресной строкой
6. Нажмите на иконку расширения и используйте вкладку "Экспорт": выберите формат файла, имя и опцию закрытия вкладок.
7. Используйте вкладку "Импорт": выберите экспортированный файл или вставьте его содержимое, затем откройте ссылки заново.
8. Используйте вкладку "Настройки": выберите папку сохранения и лимит импорта. Если папка не выбрана, файл скачивается в Загрузки.

## Диагностика Яндекс.Браузера

Если Яндекс.Браузер показывает некорректное количество вкладок активной группы, откройте вкладку "Настройки" и нажмите "Скопировать диагностику". Отчёт не содержит полных URL и заголовков страниц, но показывает технические поля вкладок, по которым можно понять, отдаёт ли браузер признак активной группы расширению.
