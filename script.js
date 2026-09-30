document.addEventListener('DOMContentLoaded', () => {

    // --- ТЕМЫ И ФОНОВЫЕ ГИФКИ ---
    const themeGifs = {
        green: './bg-green.gif',
        yellow: './bg-yellow.gif',
        pink: './bg-pink.gif'
    };

    const themeBtns = document.querySelectorAll('.theme-btn');
    const bgGifEl = document.querySelector('.bg-gif');

    function setTheme(themeName) {
        document.documentElement.setAttribute('data-theme', themeName);
        localStorage.setItem('apiary_site_theme', themeName);

        if (bgGifEl && themeGifs[themeName]) {
            bgGifEl.style.backgroundImage = `url('${themeGifs[themeName]}')`;
        }

        themeBtns.forEach(btn => {
            btn.classList.toggle('active', btn.dataset.theme === themeName);
        });
    }

    themeBtns.forEach(btn => {
        btn.addEventListener('click', () => {
            setTheme(btn.dataset.theme);
        });
    });

    const savedTheme = localStorage.getItem('apiary_site_theme') || 'green';
    setTheme(savedTheme);


    // --- ИНТЕРАКТИВНЫЙ МАКЕТ ЛАУНЧЕРА ---
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

    // Кнопка "ИГРАТЬ" в макете
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
            mockupLaunchStatus.textContent = `[1/3] Проверка целостности сборки...`;

            setTimeout(() => {
                mockupLaunchStatus.textContent = `[2/3] Инициализация Java 21 для ${playerNick}...`;
            }, 1000);

            setTimeout(() => {
                mockupLaunchStatus.textContent = `[3/3] Подключение к Apiary Main SMP...`;
            }, 2000);

            setTimeout(() => {
                mockupLaunchStatus.style.color = '#34d399';
                mockupLaunchStatus.textContent = `🚀 Игра успешно запущена! Приятной игры, ${playerNick}!`;
                mockupPlayBtn.disabled = false;
                isLaunching = false;
            }, 3200);
        });
    }

    // Ползунок ОЗУ в макете
    const ramSlider = document.getElementById('ramSlider');
    const ramVal = document.getElementById('ramVal');
    if (ramSlider && ramVal) {
        ramSlider.addEventListener('input', (e) => {
            ramVal.textContent = `${e.target.value} GB`;
        });
    }

    // Переключение темы внутри макета
    const mockupThemeBtns = document.querySelectorAll('.mockup-theme-option');
    mockupThemeBtns.forEach(btn => {
        btn.addEventListener('click', () => {
            mockupThemeBtns.forEach(b => b.classList.remove('active'));
            btn.classList.add('active');
            setTheme(btn.dataset.mockTheme);
        });
    });

    // Кнопки управления окном макета
    const dotClose = document.getElementById('mockupDotClose');
    const dotMin = document.getElementById('mockupDotMin');
    const dotMax = document.getElementById('mockupDotMax');
    const interactiveMockup = document.getElementById('interactiveMockup');

    if (dotClose && interactiveMockup) {
        dotClose.addEventListener('click', () => {
            interactiveMockup.style.transition = 'all 0.3s ease';
            interactiveMockup.style.opacity = '0';
            interactiveMockup.style.transform = 'scale(0.9)';
            setTimeout(() => {
                interactiveMockup.style.opacity = '1';
                interactiveMockup.style.transform = 'scale(1)';
            }, 2000);
        });
    }

    if (dotMin && interactiveMockup) {
        dotMin.addEventListener('click', () => {
            interactiveMockup.classList.toggle('minimized');
        });
    }

    if (dotMax && interactiveMockup) {
        dotMax.addEventListener('click', () => {
            interactiveMockup.classList.toggle('maximized');
        });
    }


    // --- ИНТЕРАКТИВНЫЙ ТЕРМИНАЛ APIARY OS ---
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

        appendTermLine(`<span class="term-prompt">apiary@smp:~$</span> ${rawCmd}`, 'user');

        switch (cmd) {
            case 'help':
                appendTermLine(`Доступные команды:<br>
                • <span class="term-highlight">status</span> — Состояние сервера Apiary SMP<br>
                • <span class="term-highlight">ping</span> — Проверить задержку до сервера<br>
                • <span class="term-highlight">mods</span> — Список предустановленных модов<br>
                • <span class="term-highlight">secret</span> — Активировать секретную фичу<br>
                • <span class="term-highlight">clear</span> — Очистить консоль`);
                break;

            case 'status':
                // Генерация случайного количества игроков от 10 до 30
                const randomPlayers = Math.floor(Math.random() * 21) + 10;
                appendTermLine(`[ONLINE] Apiary Main SMP: ${randomPlayers}/100 игроков | TPS: 20.0 | Uptime: 99.9%`, 'success');
                break;

            case 'ping':
                const randomPing = Math.floor(Math.random() * 15) + 8;
                appendTermLine(`Пинг до mc.apiary.smp: <span class="term-highlight">${randomPing} ms</span> (Идеально)`);
                break;

            case 'mods':
                appendTermLine(`Модпак v1.5.0: Sodium, Iris Shaders, Simple Voice Chat, Lithium, FerriteCore, Apiary-Utils.`);
                break;

            case 'secret':
                appendTermLine(`Скинь мне на пиво https://www.donationalerts.com/r/memasssssssss`, 'success');
                break;

            case 'clear':
                termOutput.innerHTML = '';
                break;

            default:
                appendTermLine(`Команда "${cmd}" не найдена. Введи <span class="term-highlight">help</span> для справки.`, 'error');
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

    if (termClearBtn) {
        termClearBtn.addEventListener('click', () => {
            if (termOutput) termOutput.innerHTML = '';
        });
    }

    termChips.forEach(chip => {
        chip.addEventListener('click', () => {
            const cmd = chip.dataset.cmd;
            processCommand(cmd);
        });
    });


    // --- СЧЁТЧИК СКАЧИВАНИЙ НА БАЗЕ GITHUB RELEASES API ---
    const GITHUB_USER = "memassssssss";
    const GITHUB_REPO = "Apiary-launcher";
    const countEl = document.getElementById('downloadCount');

    function updateCounterUI(val) {
        if (countEl) {
            countEl.textContent = Number(val).toLocaleString('ru-RU') + " РАЗ";
        }
    }

    async function loadRealGitHubDownloads() {
        try {
            const response = await fetch(`https://api.github.com/repos/${GITHUB_USER}/${GITHUB_REPO}/releases`);
            
            if (!response.ok) {
                throw new Error(`GitHub API Error: ${response.status}`);
            }

            const releases = await response.json();
            let totalDownloads = 0;

            releases.forEach(release => {
                if (release.assets && Array.isArray(release.assets)) {
                    release.assets.forEach(asset => {
                        totalDownloads += asset.download_count || 0;
                    });
                }
            });

            if (totalDownloads > 0) {
                updateCounterUI(totalDownloads);
            } else {
                updateCounterUI(15);
            }

        } catch (err) {
            console.warn("Не удалось получить статистику с GitHub API:", err);
            updateCounterUI(24);
        }
    }

    loadRealGitHubDownloads();


    // --- ВСПЛЫВАЮЩЕЕ ОКНО (SmartScreen Modal) ---
    const modal = document.getElementById('smartscreenModal');
    const openModalBtn = document.getElementById('openSmartscreenModal');
    const closeModalBtn = document.getElementById('closeSmartscreenModal');

    if (openModalBtn && modal) {
        openModalBtn.addEventListener('click', () => modal.classList.add('active'));
    }

    if (closeModalBtn && modal) {
        closeModalBtn.addEventListener('click', () => modal.classList.remove('active'));
    }

    if (modal) {
        modal.addEventListener('click', (e) => {
            if (e.target === modal) modal.classList.remove('active');
        });
    }

    document.addEventListener('keydown', (e) => {
        if (e.key === 'Escape' && modal && modal.classList.contains('active')) {
            modal.classList.remove('active');
        }
    });
});