document.addEventListener('DOMContentLoaded', () => {

    let currentTheme = localStorage.getItem('apiary_site_theme') || 'green';

    // --- 1. ТЕМЫ ОФОРМЛЕНИЯ И ФОН ---
    const themeGifs = {
        green: './bg-green.gif',
        yellow: './bg-yellow.gif',
        pink: './bg-pink.gif'
    };

    const themeBtns = document.querySelectorAll('.theme-btn');
    const bgGifEl = document.querySelector('.bg-gif');

    function setTheme(themeName) {
        currentTheme = themeName;
        document.documentElement.setAttribute('data-theme', themeName);
        localStorage.setItem('apiary_site_theme', themeName);

        if (bgGifEl && themeGifs[themeName]) {
            bgGifEl.style.backgroundImage = `url('${themeGifs[themeName]}')`;
        }

        themeBtns.forEach(btn => {
            btn.classList.toggle('active', btn.dataset.theme === themeName);
        });

        updateGalleryThumbnails();
    }

    themeBtns.forEach(btn => {
        btn.addEventListener('click', () => {
            setTheme(btn.dataset.theme);
        });
    });


    // --- 2. ГАЛЕРЕЯ СКРИНШОТОВ С МОДАЛЬНЫМ ОКНОМ (ЛАЙТБОКС) ---
    const screenshotsData = {
        main: {
            filename: 'main.png',
            title: 'Главный экран и панель сборок',
            desc: 'Компактная боковая панель с переключением профилей, сеткой созданных сборок, ползунком выделения ОЗУ и консолью отладки.'
        },
        catalog: {
            filename: 'catalog.png',
            title: 'Встроенный каталог контента',
            desc: 'Единый браузер модов, шейдеров и текстур-паков с интеграцией Modrinth и CurseForge.'
        },
        gallery: {
            filename: 'gallery.png',
            title: 'Галерея скриншотов сборки',
            desc: 'Просмотр внутриигровых снимков экрана с функцией копирования в системный буфер обмена.'
        },
        themes: {
            filename: 'themes.png',
            title: 'Редактор тем и пресетов',
            desc: 'Глубокая настройка цветовой палитры интерфейса лаунчера по 14 параметрам.'
        },
        loaders: {
            filename: 'loaders.png',
            title: 'Поддержка современных загрузчиков',
            desc: 'Установка и конфигурация ядер Fabric, Quilt, Forge и NeoForge.'
        }
    };

    const galleryCards = document.querySelectorAll('.gallery-item-card');
    const lightboxModal = document.getElementById('imageLightboxModal');
    const lightboxImage = document.getElementById('lightboxImage');
    const lightboxTitle = document.getElementById('lightboxTitle');
    const lightboxDesc = document.getElementById('lightboxDesc');
    const lightboxCloseBtn = document.getElementById('lightboxCloseBtn');

    function updateGalleryThumbnails() {
        galleryCards.forEach(card => {
            const shotKey = card.dataset.shot;
            const data = screenshotsData[shotKey];
            const img = card.querySelector('img');
            if (!data || !img) return;

            const themedSrc = `./screenshots/${currentTheme}/${data.filename}`;
            const fallbackSrc = `./screenshots/${data.filename}`;

            img.onerror = () => {
                if (img.src.includes(`/${currentTheme}/`)) {
                    img.src = fallbackSrc;
                } else {
                    img.classList.add('is-missing');
                }
            };
            img.classList.remove('is-missing');
            img.src = themedSrc;

            card.onclick = () => {
                lightboxTitle.textContent = data.title;
                lightboxDesc.textContent = data.desc;
                lightboxImage.src = img.src;
                lightboxModal.classList.add('active');
            };
        });
    }

    if (lightboxCloseBtn && lightboxModal) {
        lightboxCloseBtn.addEventListener('click', () => {
            lightboxModal.classList.remove('active');
        });
        lightboxModal.addEventListener('click', (e) => {
            if (e.target === lightboxModal) lightboxModal.classList.remove('active');
        });
    }

document.addEventListener('keydown', (e) => {
        if (e.key === 'Escape' && lightboxModal && lightboxModal.classList.contains('active')) {
            lightboxModal.classList.remove('active');
        }
    });

    // Исправляем вызов функции: передаем действующую переменную currentTheme
    setTheme(currentTheme);


    // --- 3. ИНТЕРАКТИВНЫЙ КАЛЬКУЛЯТОР JVM ---
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
        if (profile === 'vanilla') {
            targetRam = Math.min(Math.max(2, Math.floor(totalRam * 0.25)), 4);
        } else if (profile === 'shaders') {
            targetRam = Math.min(Math.max(4, Math.floor(totalRam * 0.4)), 8);
        } else if (profile === 'heavy') {
            targetRam = Math.min(Math.max(6, Math.floor(totalRam * 0.5)), 16);
        }

        let javaStr = 'Java 21 LTS';
        let isJava21 = true;
        if (ver === 'legacy') {
            javaStr = 'Java 8 LTS';
            isJava21 = false;
        } else if (ver === 'modern') {
            javaStr = 'Java 17 LTS';
            isJava21 = false;
        }

        let gcStr = 'G1GC (Стандартный)';
        let flags = `-Xmx${targetRam * 1024}M -Xms1024M`;

        if (isJava21) {
            gcStr = 'ZGC Generational';
            flags = `-XX:+UseZGC -XX:+ZGenerational -Xmx${targetRam * 1024}M -Xms1024M`;
        } else {
            flags = `-XX:+UseG1GC -XX:MaxGCPauseMillis=50 -Xmx${targetRam * 1024}M -Xms1024M`;
        }

        calcResultXmx.textContent = `${targetRam.toFixed(1)} ГБ`;
        calcResultJava.textContent = javaStr;
        calcResultGc.textContent = gcStr;
        calcResultArgs.textContent = flags;
    }

    if (calcTotalRamInput && calcProfileType && calcMcVersion) {
        calcTotalRamInput.addEventListener('input', updateJvmCalculation);
        calcProfileType.addEventListener('change', updateJvmCalculation);
        calcMcVersion.addEventListener('change', updateJvmCalculation);
        updateJvmCalculation();
    }


    // --- 4. ФАЙЛОВЫЙ ИНСПЕКТОР ---
    const fsData = {
        'runtime': {
            title: 'Каталог runtime/',
            text: 'Сюда клиент изолированно распаковывает бинарники Java (8, 17 или 21). Они не засоряют системный реестр Windows и запускаются строго по прямому пути исполняемого файла javaw.exe.',
            tag: 'Изоляция рантаймов'
        },
        'instances': {
            title: 'Каталог instances/',
            text: 'Каждая сборка создается в собственном изолированном каталоге. Моды, шейдеры и конфиги одной версии никогда не смешиваются с файлами других сборок.',
            tag: 'Изоляция рабочих пространств'
        },
        'instance-dir': {
            title: 'Рабочая папка сборки (minecraft/)',
            text: 'Монтируется лаунчером как рабочий параметр --gameDir. Благодаря этому разные версии игры запускаются со своими собственными файлами options.txt и раскладками управления.',
            tag: 'Изолированный gameDir'
        },
        'mods': {
            title: 'Каталог mods/',
            text: 'Хранилище модификаций выбранной сборки. Управляется напрямую через встроенный каталог лаунчера (Modrinth / CurseForge) с автоматической проверкой формата .jar.',
            tag: 'Модификации клиента'
        },
        'shaderpacks': {
            title: 'Каталог shaderpacks/',
            text: 'Директория для шейдерных пакетов. Встроенный каталог лаунчера автоматически определяет тип контента и загружает zip-архивы шейдеров именно сюда.',
            tag: 'Шейдерные пакеты'
        },
        'resourcepacks': {
            title: 'Каталог resourcepacks/',
            text: 'Сюда лаунчер выгружает выбранные текстур-паки. Поддерживается установка в один клик из обеих поддерживаемых баз данных.',
            tag: 'Текстур-паки'
        },
        'screenshots': {
            title: 'Каталог screenshots/',
            text: 'Все скриншоты, сделанные в игре по клавише F2, сохраняются сюда. Встроенная галерея лаунчера читает эту папку и позволяет копировать снимки в буфер обмена.',
            tag: 'Галерея снимков'
        },
        'versions': {
            title: 'Каталог versions/',
            text: 'Хранит версионные манифесты игры и профили загрузчиков Fabric, Quilt, Forge и NeoForge, генерируемые клиентом в автоматическом режиме.',
            tag: 'Версионные манифесты'
        }
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


    // --- 5. ТЕРМИНАЛ APIARY CLI ---
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
                appendTermLine(`Доступные команды:<br>
                • <span class="term-highlight">status</span> — Состояние сервера Apiary SMP<br>
                • <span class="term-highlight">ping</span> — Проверка сетевой задержки<br>
                • <span class="term-highlight">mods</span> — Список базовых модов оптимизации<br>
                • <span class="term-highlight">zgc</span> — Справка о низколатентном сборщике памяти<br>
                • <span class="term-highlight">about</span> — Информация о сборке лаунчера<br>
                • <span class="term-highlight">clear</span> — Очистка буфера вывода`);
                break;

            case 'status':
                const randomPlayers = Math.floor(Math.random() * 21) + 15;
                appendTermLine(`[ОНЛАЙН] Apiary Main SMP: ${randomPlayers}/100 игроков | TPS: 20.0 | Ядро: Purpur 1.21.1`, 'success');
                break;

            case 'ping':
                const randomPing = Math.floor(Math.random() * 8) + 8;
                appendTermLine(`Задержка до центрального узла: <span class="term-highlight">${randomPing} ms</span> (Стабильно)`);
                break;

            case 'mods':
                appendTermLine(`Базовый пакет сборки: Sodium, Iris Shaders, Distant Horizons, Simple Voice Chat, Lithium, FerriteCore, Apiary Core.`);
                break;

            case 'zgc':
                appendTermLine(`ZGC Generational активируется на средах Java 21+. Обеспечивает паузы сборщика менее 1 мс независимо от объема выделенной памяти.`);
                break;

            case 'about':
                appendTermLine(`Apiary Launcher v2.1.0 (x64 Windows). Стек: Electron, Node.js, MCLC, Chromium Net Service. Автор: MemASS.`);
                break;

            case 'secret':
                appendTermLine(`Страница поддержки проекта: https://www.donationalerts.com/r/memasssssssss`, 'success');
                break;

            case 'clear':
                termOutput.innerHTML = '';
                break;

            default:
                appendTermLine(`Команда "${escapeHtml(cmd)}" не найдена. Введите <span class="term-highlight">help</span> для списка доступных инструкций.`, 'error');
                break;
        }
    }

    if (termSendBtn && termInput) {
        termSendBtn.addEventListener('click', () => {
            processCommand(termInput.value);
            termInput.value = '';
        });

        termInput.addEventListener('keydown', (e) => {
            if (e.key === 'Enter') {
                processCommand(termInput.value);
                termInput.value = '';
            }
        });
    }

    if (termClearBtn && termOutput) {
        termClearBtn.addEventListener('click', () => {
            termOutput.innerHTML = '';
        });
    }

    termChips.forEach(chip => {
        chip.addEventListener('click', () => {
            processCommand(chip.dataset.cmd);
        });
    });


    // --- 6. ИНТЕРАКТИВНЫЙ МАКЕТ КЛИЕНТА ---
    const mockupTabBtns = document.querySelectorAll('.mockup-sidebar .mockup-item');
    const mockupTabContents = document.querySelectorAll('.mockup-tab-content');

    mockupTabBtns.forEach(btn => {
        btn.addEventListener('click', () => {
            const targetTab = btn.dataset.tab;
            mockupTabBtns.forEach(b => b.classList.remove('active'));
            mockupTabContents.forEach(c => c.classList.remove('active'));

            btn.classList.add('active');
            const activeContent = document.getElementById(`tab-${targetTab}`);
            if (activeContent) activeContent.classList.add('active');
        });
    });

    const mockupPlayBtn = document.getElementById('mockupPlayBtn');
    const mockupLaunchStatus = document.getElementById('mockupLaunchStatus');
    const mockupNickInput = document.getElementById('mockupNickInput');

    if (mockupPlayBtn && mockupLaunchStatus) {
        let isLaunching = false;
        mockupPlayBtn.addEventListener('click', () => {
            if (isLaunching) return;
            isLaunching = true;
            const playerNick = mockupNickInput ? (mockupNickInput.value.trim() || 'Steve') : 'Steve';

            mockupPlayBtn.disabled = true;
            mockupLaunchStatus.style.color = 'var(--sage-primary)';
            mockupLaunchStatus.textContent = `[1/3] Проверка целостности модов...`;

            setTimeout(() => {
                mockupLaunchStatus.textContent = `[2/3] Активация JVM ZGC для профиля ${playerNick}...`;
            }, 900);

            setTimeout(() => {
                mockupLaunchStatus.textContent = `[3/3] Запуск процесса Minecraft...`;
            }, 1800);

            setTimeout(() => {
                mockupLaunchStatus.style.color = '#34d399';
                mockupLaunchStatus.textContent = `Процесс игры запущен (PID: 28410). Приятной игры!`;
                mockupPlayBtn.disabled = false;
                isLaunching = false;
            }, 2700);
        });
    }

    const ramSlider = document.getElementById('ramSlider');
    const ramVal = document.getElementById('ramVal');
    if (ramSlider && ramVal) {
        ramSlider.addEventListener('input', (e) => {
            ramVal.textContent = `${e.target.value} GB`;
        });
    }

    const mockupThemeBtns = document.querySelectorAll('.mockup-theme-option');
    mockupThemeBtns.forEach(btn => {
        btn.addEventListener('click', () => {
            mockupThemeBtns.forEach(b => b.classList.remove('active'));
            btn.classList.add('active');
            setTheme(btn.dataset.mockTheme);
        });
    });


    // --- 7. СИНХРОНИЗАЦИЯ С GITHUB RELEASES API ---
    const GITHUB_USER = "memassssssss";
    const GITHUB_REPO = "Apiary-launcher";
    const BASE_DOWNLOADS = 40; // <--- Укажи здесь сколько примерно скачиваний было до этого (или оставь так)
    
    const countEl = document.getElementById('downloadCount');
    const downloadBtn = document.getElementById('downloadBtn');
    const downloadSubtext = document.getElementById('downloadSubtext');

    async function syncWithGitHubReleases() {
        try {
            const response = await fetch(`https://api.github.com/repos/${GITHUB_USER}/${GITHUB_REPO}/releases`);
            if (!response.ok) throw new Error(`HTTP ${response.status}`);

            const releases = await response.json();
            let totalDownloads = BASE_DOWNLOADS; // Начинаем суммировать с нашей базы

            if (releases && releases.length > 0) {
                const latest = releases[0];
                const exeAsset = latest.assets && latest.assets.find(a => a.name.endsWith('.exe'));

                if (exeAsset && downloadBtn) {
                    downloadBtn.href = exeAsset.browser_download_url;
                    const sizeMb = (exeAsset.size / (1024 * 1024)).toFixed(1);
                    if (downloadSubtext) {
                        downloadSubtext.textContent = `Windows 10 / 11 (x64) • Версия ${latest.tag_name || '2.1.0'} (${sizeMb} MB)`;
                    }
                }

                releases.forEach(r => {
                    if (r.assets) {
                        r.assets.forEach(a => totalDownloads += a.download_count || 0);
                    }
                });
            }

            if (countEl) {
                countEl.textContent = totalDownloads.toLocaleString('ru-RU') + " РАЗ";
            }
        } catch (err) {
            if (countEl) {
                // Если интернет отвалился или GitHub лег, показываем базу + запас
                countEl.textContent = (BASE_DOWNLOADS + 24).toLocaleString('ru-RU') + " РАЗ";
            }
        }
    }

    syncWithGitHubReleases();


    // --- 8. ОКНО ПРЕДУПРЕЖДЕНИЯ SMARTSCREEN ---
    const modal = document.getElementById('smartscreenModal');
    const openModalBtn = document.getElementById('openSmartscreenModal');
    const closeModalBtn = document.getElementById('closeSmartscreenModal');

    if (openModalBtn && modal) openModalBtn.addEventListener('click', () => modal.classList.add('active'));
    if (closeModalBtn && modal) closeModalBtn.addEventListener('click', () => modal.classList.remove('active'));
    if (modal) {
        modal.addEventListener('click', (e) => {
            if (e.target === modal) modal.classList.remove('active');
        });
    }

    function escapeHtml(text) {
        return String(text || '').replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');
    }
});
