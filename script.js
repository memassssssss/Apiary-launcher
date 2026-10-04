document.addEventListener('DOMContentLoaded', () => {

    let currentTheme = localStorage.getItem('apiary_site_theme') || 'green';

    // --- 1. ТЕМЫ ОФОРМЛЕНИЯ И ФОН ---
    const themeGifs = { green: './bg-green.gif', yellow: './bg-yellow.gif', pink: './bg-pink.gif' };
    const themeBtns = document.querySelectorAll('.theme-btn');
    const bgGifEl = document.querySelector('.bg-gif');

    function setTheme(themeName) {
        currentTheme = themeName;
        document.documentElement.setAttribute('data-theme', themeName);
        localStorage.setItem('apiary_site_theme', themeName);

        if (bgGifEl && themeGifs[themeName]) bgGifEl.style.backgroundImage = `url('${themeGifs[themeName]}')`;

        themeBtns.forEach(btn => btn.classList.toggle('active', btn.dataset.theme === themeName));
        updateGalleryMonitor();
    }

    themeBtns.forEach(btn => btn.addEventListener('click', () => setTheme(btn.dataset.theme)));


    // --- 2. ГАЛЕРЕЯ СКРИНШОТОВ (ЧИСТАЯ ВЕРСИЯ БЕЗ ЗАТЕМНЕНИЙ) ---
    const monitorData = {
        main: { 
            file: 'main.png', 
            sysTitle: 'МОДУЛЬ: ГЛАВНЫЙ ЭКРАН', 
            text: 'Компактная боковая панель с быстрым переключением профилей, сеткой созданных инстансов, удобным ползунком выделения ОЗУ и выводом логов запуска.' 
        },
        catalog: { 
            file: 'catalog.png', 
            sysTitle: 'МОДУЛЬ: КАТАЛОГ КОНТЕНТА (MODRINTH)', 
            text: 'Встроенный браузер модов, шейдеров и текстур-паков. Загрузка напрямую через Modrinth API с фильтрацией по версии ядра и совместимости в 1 клик.' 
        },
        gallery: { 
            file: 'gallery.png', 
            sysTitle: 'МОДУЛЬ: МЕНЕДЖЕР СКРИНШОТОВ', 
            text: 'Локальная галерея скриншотов, сделанных по F2. Позволяет мгновенно открывать снимки в полном размере или копировать их в системный буфер Windows.' 
        },
        themes: { 
            file: 'themes.png', 
            sysTitle: 'МОДУЛЬ: РЕДАКТОР ОФОРМЛЕНИЯ', 
            text: 'Глубокая настройка внешнего вида лаунчера: палитра из 14 настраиваемых цветов, выбор фоновых анимаций и сохранение пользовательских пресетов.' 
        },
        loaders: { 
            file: 'loaders.png', 
            sysTitle: 'МОДУЛЬ: МЕНЕДЖЕР ЯДЕР И ВЕРСИЙ', 
            text: 'Установка и конфигурация загрузчиков Fabric, Quilt, Forge и NeoForge. Автоматическая загрузка официальных манифестов и библиотек Mojang.' 
        }
    };

    let activeShot = 'main';
    const monitorImg = document.getElementById('monitorMainImage');
    const hudTitle = document.getElementById('monitorHudTitle');
    const descText = document.getElementById('monitorDescText');
    const navBtns = document.querySelectorAll('.nav-module-btn');
    const monitorScanlines = document.getElementById('monitorScanlines');
    const btnToggleCrt = document.getElementById('btnToggleCrt');
    
    // Элементы лайтбокса
    const lightboxModal = document.getElementById('imageLightboxModal');
    const lightboxImage = document.getElementById('lightboxImage');
    const lightboxTitle = document.getElementById('lightboxTitle');
    const lightboxDesc = document.getElementById('lightboxDesc');
    const lightboxCloseBtn = document.getElementById('lightboxCloseBtn');
    const btnEnlarge = document.getElementById('btnEnlargeScreenshot');
    const monitorViewport = document.getElementById('monitorViewport');

    function updateGalleryMonitor() {
        if (!monitorImg || !monitorData[activeShot]) return;
        const data = monitorData[activeShot];
        const themedSrc = `./screenshots/${currentTheme}/${data.file}`;
        const fallbackSrc = `./screenshots/${data.file}`;

        monitorImg.onerror = () => {
            if (monitorImg.src.includes(`/${currentTheme}/`)) {
                monitorImg.src = fallbackSrc;
            } else {
                monitorImg.classList.add('is-missing');
            }
        };
        
        monitorImg.classList.remove('is-missing');
        monitorImg.src = themedSrc;
        if (hudTitle) hudTitle.textContent = data.sysTitle;
        if (descText) descText.textContent = data.text;
    }

    navBtns.forEach(btn => {
        btn.addEventListener('click', () => {
            if (activeShot === btn.dataset.shot) return;
            navBtns.forEach(b => b.classList.remove('active'));
            btn.classList.add('active');
            activeShot = btn.dataset.shot;
            updateGalleryMonitor();
        });
    });

    // Опциональный CRT-режим
    if (btnToggleCrt && monitorScanlines) {
        let crtEnabled = false;
        btnToggleCrt.addEventListener('click', () => {
            crtEnabled = !crtEnabled;
            monitorScanlines.classList.toggle('active', crtEnabled);
            btnToggleCrt.textContent = crtEnabled ? 'CRT: ВКЛ' : 'CRT: ВЫКЛ';
            btnToggleCrt.classList.toggle('primary', crtEnabled);
        });
    }

    // Открытие зума
    function openLightbox() {
        const data = monitorData[activeShot];
        lightboxTitle.textContent = data.sysTitle;
        lightboxDesc.textContent = data.text;
        lightboxImage.src = monitorImg.src;
        lightboxModal.classList.add('active');
    }

    if (btnEnlarge) btnEnlarge.addEventListener('click', openLightbox);
    if (monitorViewport) monitorViewport.addEventListener('click', openLightbox);

    if (lightboxCloseBtn) lightboxCloseBtn.addEventListener('click', () => lightboxModal.classList.remove('active'));
    if (lightboxModal) lightboxModal.addEventListener('click', (e) => { if (e.target === lightboxModal) lightboxModal.classList.remove('active'); });
    document.addEventListener('keydown', (e) => { if (e.key === 'Escape' && lightboxModal && lightboxModal.classList.contains('active')) lightboxModal.classList.remove('active'); });

    setTheme(currentTheme);


    // --- 3. АРХИТЕКТУРНЫЙ ДАШБОРД (МАКСИМУМ ИНФЫ) ---
    const archData = {
        isolation: {
            path: '/sys/core/isolation.spec.ts',
            title: 'Изоляция сред выполнения (--gameDir)',
            desc: 'Стандартные клиенты хранят моды, конфиги и миры в общей папке %appdata%/.minecraft. Если вы запустите 1.12.2 с модами, а затем 1.21.1, ваши options.txt повредятся, а моды вызовут конфликт. Apiary Launcher физически изолирует каждую сборку.',
            points: [
                'Монтирование персонального пути: флаг --gameDir C:/Apiary/instances/[ID]/minecraft передается напрямую процессу javaw.exe',
                'Полная независимость: разные назначения клавиш, шейдеры и моды для каждой сборки',
                'Безопасное удаление: удаление инстанса физически стирает только его каталог, не затрагивая остальные профили'
            ],
            specs: ['NODE.JS FS', 'PATH ISOLATION', 'CUSTOM GAMEDIR', 'SANDBOX'],
            code: `<span class="syntax-comment">// Генерация аргументов запуска сборки</span>
const instancePath = path.join(appData, 'instances', profile.id, 'minecraft');

const launchArgs = [
  <span class="syntax-str">'-Djava.library.path='</span> + nativesDir,
  <span class="syntax-str">'--gameDir'</span>, instancePath,
  <span class="syntax-str">'--assetsDir'</span>, assetsDir,
  <span class="syntax-str">'--version'</span>, profile.version
];
<span class="syntax-comment">// Процессы не пересекаются с системным .minecraft</span>`
        },
        auth: {
            path: '/sys/security/dpapi_auth.ts',
            title: 'Аппаратное шифрование токенов (Windows DPAPI)',
            desc: 'Большинство пиратских и кастомных лаунчеров хранят токены авторизации Microsoft/Xbox в незашифрованном json-файле или передают их на сторонние прокси-серверы. В Apiary Launcher токены шифруются криптографическим хранилищем Windows Data Protection API.',
            points: [
                'Использование Electron safeStorage: токен шифруется мастер-ключом текущей учетной записи Windows',
                'Защита от кражи: даже если вирус скопирует файл конфига лаунчера, расшифровать его на другом ПК невозможно',
                'Прямой OAuth 2.0: лаунчер общается напрямую с серверами Microsoft и Xbox Live, минуя любые промежуточные сервера'
            ],
            specs: ['ELECTRON SAFESTORAGE', 'WINDOWS DPAPI', 'AES-256', 'OAUTH 2.0'],
            code: `<span class="syntax-comment">// Шифрование токена перед сохранением в config.json</span>
import { safeStorage } from <span class="syntax-str">'electron'</span>;

export function saveUserToken(rawToken: string): void {
  if (!safeStorage.isEncryptionAvailable()) throw new Error(<span class="syntax-str">'DPAPI unavailable'</span>);
  
  const encryptedBuffer = safeStorage.encryptString(rawToken);
  fs.writeFileSync(authFilePath, encryptedBuffer.toString(<span class="syntax-str">'base64'</span>));
}`
        },
        modrinth: {
            path: '/sys/net/modrinth_service.ts',
            title: 'Интеграция с Modrinth API v2 и Chromium Net',
            desc: 'В обновлении v2.1.0 реализован нативный клиент к открытой базе Modrinth API. Каталог позволяет в реальном времени искать модификации, оптимизаторы и шейдеры без открывания браузера.',
            points: [
                'Chromium Network Service: использование модуля net.fetch обеспечивает аппаратное сжатие Brotli и корректный обход системных прокси',
                'Умное разрешение зависимостей: лаунчер автоматически проверяет наличие Fabric API или Cloth Config для выбранного мода',
                'Прямая выгрузка в инстанс: jar-файл загружается напрямую в папку mods/ конкретной активной сборки'
            ],
            specs: ['MODRINTH REST v2', 'CHROMIUM NET', 'BROTLI STREAM', 'AUTO-DEPENDENCIES'],
            code: `<span class="syntax-comment">// Поиск оптимизационных модов для сборки 1.21.1</span>
const url = <span class="syntax-str">'https://api.modrinth.com/v2/search'</span> + 
  <span class="syntax-str">'?query=sodium&facets=[["versions:1.21.1"],["project_type:mod"]]'</span>;

const response = await net.fetch(url, { headers: { <span class="syntax-str">'User-Agent'</span>: <span class="syntax-str">'ApiaryLauncher/2.1.0'</span> } });
const { hits } = await response.json();
<span class="syntax-comment">// hits[0].project_id -> прямая установка файла в instance/mods/</span>`
        },
        jvm: {
            path: '/sys/runtime/jvm_tuning.sh',
            title: 'Низколатентный сборщик мусора ZGC Generational',
            desc: 'Стандартный сборщик G1GC при больших объемах модов (150+) и шейдеров неизбежно приводит к микрофризам (stop-the-world паузы до 50–150 мс). Apiary Launcher автоматически активирует ZGC Generational на Java 21+.',
            points: [
                'Паузы менее 1 миллисекунды: сборка мусора происходит параллельно в фоновых потоках без заморозки кадров игры',
                'Флаг AlwaysPreTouch: предварительное выделение всей запрошенной памяти во избежание задержек при подгрузке тяжелых чанков',
                'Оптимизация под частоту процессора: умный расчет аргументов -Xmx и -Xms на основе реальной конфигурации ПК'
            ],
            specs: ['JAVA 21 LTS', 'ZGC GENERATIONAL', 'SUB-MILLISECOND PAUSE', 'NO GC LAG'],
            code: `<span class="syntax-comment"># Аргументы запуска для сборок 1.20.5 - 1.21+</span>
-XX:+UseZGC
-XX:+ZGenerational
-Xmx6144M
-Xms1024M
-XX:+AlwaysPreTouch
-XX:+DisableExplicitGC
<span class="syntax-comment"># Результат: стабильные 144 FPS без фризов при рендере чанков</span>`
        },
        crash: {
            path: '/sys/diagnostics/crash_analyzer.ts',
            title: 'Crash Analytics & Mixin Debugging',
            desc: 'При падении игры лаунчер не просто закрывается, а перехватывает код выхода JVM и парсит буфер вывода (stderr / hs_err_pid.log).',
            points: [
                'Определение нехватки памяти (OOM): мгновенная подсказка о необходимости поднять ползунок выделения ОЗУ',
                'Поиск конфликтующих модов: детекция сбоев Mixin-трансформеров и указание конкретного .jar файла, сломавшего игру',
                'Диагностика драйверов видеокарты: проверка сбоев OpenGL драйверов NVIDIA/AMD с понятными инструкциями на русском языке'
            ],
            specs: ['STDERR PARSER', 'MIXIN TRACER', 'JVM EXIT CODE', 'SMART DIAGNOSTICS'],
            code: `<span class="syntax-comment">// Анализ буфера при аварийном завершении игры</span>
childProcess.stderr.on(<span class="syntax-str">'data'</span>, (data) => {
  const line = data.toString();
  if (line.includes(<span class="syntax-str">'java.lang.OutOfMemoryError'</span>)) {
    ui.showDiagnosticModal(<span class="syntax-str">'ОШИБКА ОЗУ'</span>, <span class="syntax-str">'Увеличьте память в настройках сборки'</span>);
  } else if (line.includes(<span class="syntax-str">'org.spongepowered.asm.mixin'</span>)) {
    ui.showDiagnosticModal(<span class="syntax-str">'КОНФЛИКТ МОДОВ'</span>, parseMixinCulprit(line));
  }
});`
        }
    };

    const archNodes = document.querySelectorAll('.tree-node');
    const archDisplayTitle = document.getElementById('archDisplayTitle');
    const archDisplayContent = document.getElementById('archDisplayContent');

    function renderArchNode(nodeKey) {
        const data = archData[nodeKey];
        if (!data || !archDisplayContent) return;

        archDisplayTitle.textContent = data.path;
        
        const specsHtml = data.specs.map(s => `<span class="spec-badge">${s}</span>`).join('');
        const pointsHtml = data.points.map(p => `<div class="arch-point-item">${p}</div>`).join('');
        
        archDisplayContent.innerHTML = `
            <div class="arch-header">
                <h3>${data.title}</h3>
                <p>${data.desc}</p>
                <div class="arch-points-list">${pointsHtml}</div>
                <div class="arch-specs">${specsHtml}</div>
            </div>
            <div class="arch-code-block">
                <pre>${data.code}</pre>
            </div>
        `;
    }

    archNodes.forEach(node => {
        node.addEventListener('click', () => {
            archNodes.forEach(n => n.classList.remove('active'));
            node.classList.add('active');
            renderArchNode(node.dataset.node);
        });
    });

    renderArchNode('isolation');


    // --- 4. ИНТЕРАКТИВНЫЙ КАЛЬКУЛЯТОР JVM ---
    const calcTotalRamInput = document.getElementById('calcTotalRamInput');
    const calcTotalRamVal = document.getElementById('calcTotalRamVal');
    const calcProfileType = document.getElementById('calcProfileType');
    const calcMcVersion = document.getElementById('calcMcVersion');
    const calcResultXmx = document.getElementById('calcResultXmx');
    const calcResultJava = document.getElementById('calcResultJava');
    const calcResultGc = document.getElementById('calcResultGc');
    const calcResultArgs = document.getElementById('calcResultArgs');

    function updateJvmCalculation() {
        const totalRam = parseInt(calcTotalRamInput.value, 10);
        calcTotalRamVal.textContent = `${totalRam} ГБ`;
        const profile = calcProfileType.value;
        const ver = calcMcVersion.value;

        let targetRam = 4;
        if (profile === 'vanilla') targetRam = Math.min(Math.max(2, Math.floor(totalRam * 0.25)), 4);
        else if (profile === 'shaders') targetRam = Math.min(Math.max(4, Math.floor(totalRam * 0.4)), 8);
        else if (profile === 'heavy') targetRam = Math.min(Math.max(6, Math.floor(totalRam * 0.5)), 16);

        let javaStr = 'Java 21 LTS', isJava21 = true;
        if (ver === 'legacy') { javaStr = 'Java 8 LTS'; isJava21 = false; }
        else if (ver === 'modern') { javaStr = 'Java 17 LTS'; isJava21 = false; }

        let gcStr = 'G1GC (Стандартный)';
        let flags = `-Xmx${targetRam * 1024}M -Xms1024M`;

        if (isJava21) {
            gcStr = 'ZGC Generational';
            flags = `-XX:+UseZGC -XX:+ZGenerational -Xmx${targetRam * 1024}M -Xms1024M -XX:+AlwaysPreTouch`;
        } else {
            flags = `-XX:+UseG1GC -XX:MaxGCPauseMillis=50 -Xmx${targetRam * 1024}M -Xms1024M`;
        }

        calcResultXmx.textContent = `${targetRam.toFixed(1)} ГБ`;
        calcResultJava.textContent = javaStr;
        calcResultGc.textContent = gcStr;
        calcResultArgs.textContent = flags;
    }

    if (calcTotalRamInput) {
        calcTotalRamInput.addEventListener('input', updateJvmCalculation);
        calcProfileType.addEventListener('change', updateJvmCalculation);
        calcMcVersion.addEventListener('change', updateJvmCalculation);
        updateJvmCalculation();
    }


    // --- 5. ФАЙЛОВЫЙ ИНСПЕКТОР ---
    const fsData = {
        'runtime': { title: 'Каталог runtime/', text: 'Сюда клиент изолированно распаковывает бинарники Java (8, 17 или 21). Они не засоряют системный реестр Windows и запускаются строго по прямому пути исполняемого файла javaw.exe.', tag: 'Изоляция рантаймов' },
        'instances': { title: 'Каталог instances/', text: 'Каждая сборка создается в собственном изолированном каталоге. Моды, шейдеры и конфиги одной версии никогда не смешиваются с файлами других сборок.', tag: 'Изоляция рабочих пространств' },
        'instance-dir': { title: 'Рабочая папка сборки (minecraft/)', text: 'Монтируется лаунчером как рабочий параметр --gameDir. Благодаря этому разные версии игры запускаются со своими собственными файлами options.txt и раскладками управления.', tag: 'Изолированный gameDir' },
        'mods': { title: 'Каталог mods/', text: 'Хранилище модификаций выбранной сборки. Управляется напрямую через встроенный каталог лаунчера с автоматической проверкой формата .jar.', tag: 'Модификации клиента' },
        'shaderpacks': { title: 'Каталог shaderpacks/', text: 'Директория для шейдерных пакетов. Встроенный каталог лаунчера автоматически определяет тип контента и загружает zip-архивы шейдеров именно сюда.', tag: 'Шейдерные пакеты' },
        'resourcepacks': { title: 'Каталог resourcepacks/', text: 'Сюда лаунчер выгружает выбранные текстур-паки. Поддерживается установка в один клик из обеих поддерживаемых баз данных.', tag: 'Текстур-паки' },
        'screenshots': { title: 'Каталог screenshots/', text: 'Все скриншоты, сделанные в игре по клавише F2, сохраняются сюда. Встроенная галерея лаунчера читает эту папку и позволяет копировать снимки в буфер обмена.', tag: 'Галерея снимков' },
        'versions': { title: 'Каталог versions/', text: 'Хранит версионные манифесты игры и профили загрузчиков Fabric, Quilt, Forge и NeoForge, генерируемые клиентом в автоматическом режиме.', tag: 'Версионные манифесты' }
    };

    const fsNodes = document.querySelectorAll('.fs-node.item, .fs-node.sub-item, .fs-node.sub-sub-item');
    const fsInfoTitle = document.getElementById('fsInfoTitle');
    const fsInfoText = document.getElementById('fsInfoText');
    const fsInfoTag = document.getElementById('fsInfoTag');

    fsNodes.forEach(node => {
        node.addEventListener('click', () => {
            fsNodes.forEach(n => n.classList.remove('active'));
            node.classList.add('active');
            const info = fsData[node.dataset.info];
            if (info) {
                fsInfoTitle.textContent = info.title;
                fsInfoText.textContent = info.text;
                fsInfoTag.textContent = info.tag;
            }
        });
    });


    // --- 6. ТЕРМИНАЛ APIARY CLI ---
    const termInput = document.getElementById('terminalInput');
    const termOutput = document.getElementById('terminalOutput');
    const termSendBtn = document.getElementById('terminalSendBtn');
    const termClearBtn = document.getElementById('termClearBtn');
    const termChips = document.querySelectorAll('.term-chip');

    function appendTermLine(text, type = 'normal') {
        if (!termOutput) return;
        const line = document.createElement('div');
        line.className = `term-line ${type}`;
        line.innerHTML = text;
        termOutput.appendChild(line);
        termOutput.scrollTop = termOutput.scrollHeight;
    }

    function processCommand(rawCmd) {
        const cmd = rawCmd.trim().toLowerCase().replace(/^\//, '');
        if (!cmd) return;
        appendTermLine(`<span class="term-prompt">apiary@smp:~$</span> ${escapeHtml(rawCmd)}`, 'user');

        switch (cmd) {
            case 'help':
                appendTermLine(`Доступные команды:<br>• <span class="term-highlight">status</span> — Состояние серверов Apiary Network<br>• <span class="term-highlight">ping</span> — Задержка до игровых кластеров<br>• <span class="term-highlight">mods</span> — Список базового пакета оптимизации<br>• <span class="term-highlight">zgc</span> — Справка о сборщике памяти Java 21<br>• <span class="term-highlight">arch</span> — Архитектурные метрики лаунчера<br>• <span class="term-highlight">about</span> — Информация о сборке v2.1.0<br>• <span class="term-highlight">clear</span> — Очистить консоль`);
                break;
            case 'status':
                appendTermLine(`[КЛАСТЕР] Apiary Main SMP: ${Math.floor(Math.random() * 15) + 25}/100 игроков | TPS: 20.0<br>[КЛАСТЕР] Apiary Mini: 14/40 игроков | TPS: 20.0<br>[КЛАСТЕР] Apiary Sky: 8/30 игроков | TPS: 20.0`, 'success');
                break;
            case 'ping':
                appendTermLine(`Задержка до центрального хаба (Владивосток/ДВ узел): <span class="term-highlight">${Math.floor(Math.random() * 5) + 4} ms</span> (Идеально)`);
                break;
            case 'mods':
                appendTermLine(`Базовый пакет сборки: Sodium, Iris, Distant Horizons, Simple Voice Chat, Lithium, FerriteCore, EntityCulling, Cloth Config, Apiary Core.`);
                break;
            case 'zgc':
                appendTermLine(`ZGC Generational активируется на средах Java 21+. Обеспечивает задержки GC менее 1 мс независимо от объема выделенной памяти (-Xmx).`);
                break;
            case 'arch':
                appendTermLine(`Стек: Electron 31+, Node.js 20, Modrinth REST API v2, Chromium Net, Windows DPAPI Crypto, MCLC Engine.`);
                break;
            case 'about':
                appendTermLine(`Apiary Launcher v2.1.0 (Windows x64). Разработчик: MemASS. Репозиторий: github.com/memassssssss/Apiary-launcher.`);
                break;
            case 'clear':
                termOutput.innerHTML = '';
                break;
            default:
                appendTermLine(`Команда "${escapeHtml(cmd)}" не найдена. Введите <span class="term-highlight">help</span> для справки.`, 'error');
                break;
        }
    }

    if (termSendBtn) {
        termSendBtn.addEventListener('click', () => { processCommand(termInput.value); termInput.value = ''; });
        termInput.addEventListener('keydown', (e) => { if (e.key === 'Enter') { processCommand(termInput.value); termInput.value = ''; } });
    }
    if (termClearBtn) termClearBtn.addEventListener('click', () => termOutput.innerHTML = '');
    termChips.forEach(chip => chip.addEventListener('click', () => processCommand(chip.dataset.cmd)));


    // --- 7. GITHUB RELEASES API ---
    const GITHUB_USER = "memassssssss";
    const GITHUB_REPO = "Apiary-launcher";
    const countEl = document.getElementById('downloadCount');
    const downloadBtn = document.getElementById('downloadBtn');
    const downloadSubtext = document.getElementById('downloadSubtext');

    async function syncWithGitHubReleases() {
        let totalDownloads = 40;
        try {
            const response = await fetch(`https://api.github.com/repos/${GITHUB_USER}/${GITHUB_REPO}/releases`);
            if (!response.ok) throw new Error(`HTTP ${response.status}`);
            const releases = await response.json();

            if (releases && releases.length > 0) {
                const latest = releases[0];
                const exeAsset = latest.assets && latest.assets.find(a => a.name.endsWith('.exe'));
                if (exeAsset && downloadBtn) {
                    downloadBtn.href = exeAsset.browser_download_url;
                    downloadSubtext.textContent = `Windows 10 / 11 (x64) • Версия ${latest.tag_name || '2.1.0'} (${(exeAsset.size / (1024 * 1024)).toFixed(1)} MB)`;
                }
                releases.forEach(r => r.assets && r.assets.forEach(a => totalDownloads += a.download_count || 0));
            }
            if (countEl) countEl.textContent = totalDownloads.toLocaleString('ru-RU') + " РАЗ";
        } catch (err) {
            if (countEl) countEl.textContent = totalDownloads.toLocaleString('ru-RU') + "+ РАЗ";
        }
    }
    syncWithGitHubReleases();


    // --- 8. SMARTSCREEN MODAL ---
    const modal = document.getElementById('smartscreenModal');
    const openModalBtn = document.getElementById('openSmartscreenModal');
    const closeModalBtn = document.getElementById('closeSmartscreenModal');

    if (openModalBtn) openModalBtn.addEventListener('click', () => modal.classList.add('active'));
    if (closeModalBtn) closeModalBtn.addEventListener('click', () => modal.classList.remove('active'));
    if (modal) modal.addEventListener('click', (e) => { if (e.target === modal) modal.classList.remove('active'); });

    function escapeHtml(text) { return String(text || '').replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;'); }
});