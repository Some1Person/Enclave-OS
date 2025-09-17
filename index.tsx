// @ts-nocheck

document.addEventListener('DOMContentLoaded', () => {
    // --- DESKTOP OS LOGIC ---
    const desktop = document.getElementById('desktop');
    const taskbarApps = document.getElementById('taskbar-apps');
    const clock = document.getElementById('clock');
    const startButton = document.getElementById('start-button');
    const startMenu = document.getElementById('start-menu');
    const windowTemplate = document.getElementById('window-template');
    const enclaveContentTemplate = document.getElementById('enclave-app-template');
    const snapPreview = document.getElementById('snap-preview');

    let openWindows = {};
    let activeWindow = null;
    let highestZ = 10;
    
    const appConfig = {
        monitor: { title: "System Monitor", contentIds: ["system-home-view", "resource-tracker-view"], initFunc: initSystemMonitorApp },
        personnel: { title: "Personnel Database", contentIds: ["profiles-view", "rank-view"], initFunc: initPersonnelApp },
        rd: { title: "R&D Console", contentIds: ["rd-tools-view"], initFunc: initRDToolsApp },
        chimera: { title: "Project Chimera", contentIds: ["chimera-log-view", "specimen-database-view"], initFunc: initChimeraApp },
        map: { title: "Tactical Map", contentIds: ["map-view"], initFunc: initMapApp },
        notes: { title: "Secure Notes", contentIds: ["notes-view"], initFunc: initNotesApp },
    };

    // --- Clock ---
    function updateClock() {
        clock.textContent = new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
    }
    setInterval(updateClock, 1000);
    updateClock();

    // --- Start Menu ---
    startButton.addEventListener('click', (e) => {
        e.stopPropagation();
        startMenu.style.display = startMenu.style.display === 'block' ? 'none' : 'block';
    });
    document.addEventListener('click', () => {
        startMenu.style.display = 'none';
    });
    startMenu.addEventListener('click', (e) => {
        e.stopPropagation();
        const app = e.target.dataset.app;
        if (app && appConfig[app]) {
            createAppWindow(app);
            startMenu.style.display = 'none';
        }
        if (e.target.id === 'start-menu-settings') {
            document.getElementById('hw-settings-btn').click();
            startMenu.style.display = 'none';
        }
        if (e.target.id === 'start-menu-logoff') {
            document.getElementById('power-button').click();
            startMenu.style.display = 'none';
        }
    });

    // --- App Launching ---
    desktop.addEventListener('click', (e) => {
        const icon = e.target.closest('.desktop-icon');
        if (icon) {
            const app = icon.dataset.app;
            if (app && appConfig[app]) {
                createAppWindow(app);
            }
        }
    });

    // --- Window Management ---
    function setActiveWindow(win) {
        if (activeWindow) {
            activeWindow.classList.remove('active');
            const activeTaskbarItem = taskbarApps.querySelector(`[data-app-id="${activeWindow.dataset.appId}"]`);
            if (activeTaskbarItem) activeTaskbarItem.classList.remove('active');
        }
        activeWindow = win;
        if(win) {
            win.style.zIndex = ++highestZ;
            win.classList.add('active');
            const taskbarItem = taskbarApps.querySelector(`[data-app-id="${win.dataset.appId}"]`);
            if (taskbarItem) taskbarItem.classList.add('active');
        }
    }

    function createAppWindow(appKey) {
        const config = appConfig[appKey];
        const appId = `${appKey}-${Date.now()}`;
        
        const existingWindow = Object.values(openWindows).find(w => w.key === appKey);
        if(existingWindow) {
            setActiveWindow(existingWindow.el);
            if (existingWindow.el.style.display === 'none') {
                 existingWindow.el.style.display = 'flex';
            }
            return;
        }

        const windowEl = windowTemplate.content.cloneNode(true).firstElementChild;
        windowEl.dataset.appId = appId;
        windowEl.style.top = `${50 + (Object.keys(openWindows).length % 10) * 30}px`;
        windowEl.style.left = `${100 + (Object.keys(openWindows).length % 10) * 30}px`;
        
        const windowBody = windowEl.querySelector('.window-body');
        const mainAppContainer = enclaveContentTemplate.content.cloneNode(true).firstElementChild;
        const mainContentWrapper = mainAppContainer.querySelector('#main-content-wrapper');
        
        // **BUG FIX:** Remove all views from the clone, then add back only the ones needed for this app.
        mainAppContainer.querySelectorAll('.content-view').forEach(view => view.remove());
        config.contentIds.forEach(id => {
            const viewTemplate = enclaveContentTemplate.content.querySelector(`#${id}`);
            if (viewTemplate) {
                mainContentWrapper.appendChild(viewTemplate.cloneNode(true));
            }
        });

        mainContentWrapper.querySelector('.content-view')?.classList.add('active');
        
        if(config.contentIds.length > 1) {
            const nav = document.createElement('nav');
            nav.className = 'main-nav';
            config.contentIds.forEach((id, index) => {
                const viewName = id.replace(/-/g, ' ').replace('view', '').trim().toUpperCase();
                const link = document.createElement('a');
                link.dataset.view = id;
                link.textContent = `> ${viewName}`;
                if (index === 0) link.classList.add('active');
                nav.appendChild(link);
            });
            mainContentWrapper.prepend(nav);
        }
        
        windowBody.appendChild(mainAppContainer);
        desktop.appendChild(windowEl);
        
        windowEl.querySelector('.title').textContent = config.title;
        windowEl.style.display = 'flex';
        openWindows[appId] = { el: windowEl, config, key: appKey };

        config.initFunc(windowEl);

        setupWindowInteractions(windowEl, appId, config.title);
        setActiveWindow(windowEl);
    }
    
    function setupWindowInteractions(win, appId, title) {
        const titleBar = win.querySelector('.window-title-bar');
        const snapThreshold = 20;
        let isDragging = false, offsetX, offsetY, snapTarget = null;
    
        titleBar.addEventListener('mousedown', (e) => {
            if (e.target.closest('.window-controls')) return;
            isDragging = true;
            offsetX = e.clientX - win.offsetLeft;
            offsetY = e.clientY - win.offsetTop;
            document.body.style.userSelect = 'none';
            setActiveWindow(win);
            win.style.transition = 'none';
        });
    
        document.addEventListener('mousemove', (e) => {
            if (!isDragging) return;
    
            let x = e.clientX - offsetX;
            let y = e.clientY - offsetY;
            
            snapTarget = null;
            snapPreview.style.display = 'none';

            if (win.classList.contains('maximized')) {
                const originalWidth = win.dataset.originalWidth || '80vw';
                win.classList.remove('maximized');
                win.style.width = originalWidth;
                offsetX = win.offsetWidth / 2;
            }
    
            if (e.clientX < snapThreshold) {
                snapTarget = { left: 0, top: 0, width: '50%', height: '100%' };
            } else if (e.clientX > window.innerWidth - snapThreshold) {
                snapTarget = { left: '50%', top: 0, width: '50%', height: '100%' };
            } else if (e.clientY < snapThreshold) {
                snapTarget = { left: 0, top: 0, width: '100%', height: '100%' };
            }

            Object.values(openWindows).forEach(other => {
                if (other.el === win || other.el.style.display === 'none') return;
                const otherRect = other.el.getBoundingClientRect();
                if (Math.abs(e.clientX - otherRect.left) < snapThreshold) x = otherRect.left - win.offsetWidth;
                if (Math.abs(e.clientX - (otherRect.left + otherRect.width)) < snapThreshold) x = otherRect.left + otherRect.width;
                if (Math.abs(e.clientY - otherRect.top) < snapThreshold) y = otherRect.top - win.offsetHeight;
                if (Math.abs(e.clientY - (otherRect.top + otherRect.height)) < snapThreshold) y = otherRect.top + otherRect.height;
            });
    
            if (snapTarget) {
                snapPreview.style.left = snapTarget.left;
                snapPreview.style.top = snapTarget.top;
                snapPreview.style.width = snapTarget.width;
                snapPreview.style.height = `calc(${snapTarget.height} - var(--taskbar-height))`;
                snapPreview.style.display = 'block';
            } else {
                win.style.left = `${Math.max(0, x)}px`;
                win.style.top = `${Math.max(0, y)}px`;
            }
        });
    
        document.addEventListener('mouseup', () => {
            if (isDragging) {
                win.style.transition = '';
                if (snapTarget) {
                    win.style.left = snapTarget.left;
                    win.style.top = snapTarget.top;
                    win.style.width = snapTarget.width;
                    win.style.height = `calc(${snapTarget.height} - var(--taskbar-height))`;
                }
            }
            isDragging = false;
            document.body.style.userSelect = '';
            snapPreview.style.display = 'none';
        });

        win.addEventListener('mousedown', () => setActiveWindow(win));
    
        win.querySelector('.window-controls').addEventListener('click', (e) => {
            const action = e.target.dataset.action;
            if (action === 'close') {
                delete openWindows[appId];
                win.remove();
                taskbarApps.querySelector(`[data-app-id="${appId}"]`)?.remove();
                if (activeWindow === win) setActiveWindow(null);
            } else if (action === 'minimize') {
                win.style.display = 'none';
                taskbarApps.querySelector(`[data-app-id="${appId}"]`)?.classList.remove('active');
                if (activeWindow === win) setActiveWindow(null);
            } else if (action === 'maximize') {
                if (!win.classList.contains('maximized')) {
                     win.dataset.originalWidth = win.style.width;
                     win.dataset.originalHeight = win.style.height;
                     win.dataset.originalTop = win.style.top;
                     win.dataset.originalLeft = win.style.left;
                }
                win.classList.toggle('maximized');
                if (!win.classList.contains('maximized')) {
                    win.style.width = win.dataset.originalWidth;
                    win.style.height = win.dataset.originalHeight;
                    win.style.top = win.dataset.originalTop;
                    win.style.left = win.dataset.originalLeft;
                }
            }
        });
    
        const taskbarItem = document.createElement('div');
        taskbarItem.className = 'taskbar-item';
        taskbarItem.textContent = title;
        taskbarItem.dataset.appId = appId;
        taskbarItem.addEventListener('click', () => {
            if (win.style.display === 'none') {
                win.style.display = 'flex';
            }
            setActiveWindow(win);
        });
        taskbarApps.appendChild(taskbarItem);
    }
    
    // --- GLOBAL SYSTEM CONTROLS & SHARED LOGIC ---
    let audioCtx;
    const settingsModal = document.getElementById('settings-modal');
    
    let settings = {
        volume: 0.2, brightness: 100, zoom: 100, scrollSpeed: 35, autosaveInterval: 30000,
        muteTyping: false, muteUi: false, muteHum: false, theme: 'theme-green', cracked: false
    };

    const soundVariations = { tick: [{f:1500, d:0.05}], beep: [{f:440, d:0.1}], error_beep: [{f:150, d:0.5}], success_beep: [{f:800, d:0.2}] };
    const initAudio = () => { if (!audioCtx && (window.AudioContext || window.webkitAudioContext)) audioCtx = new (window.AudioContext || window.webkitAudioContext)(); };
    
    const playSound = (type) => {
        if (!audioCtx) return;
    
        if ((type.includes('tick') && settings.muteTyping) || (type.includes('beep') && settings.muteUi)) {
            return;
        }
        
        const variations = soundVariations[type] || soundVariations['beep'];
        const sound = variations[Math.floor(Math.random() * variations.length)];

        const oscillator = audioCtx.createOscillator();
        const gainNode = audioCtx.createGain();
        oscillator.connect(gainNode);
        gainNode.connect(audioCtx.destination);

        let vol = settings.volume;
        
        if (type.includes('tick')) {
            oscillator.type = 'square';
            vol *= 0.5;
        } else {
            oscillator.type = 'sine';
        }

        oscillator.frequency.setValueAtTime(sound.f, audioCtx.currentTime);
        
        gainNode.gain.setValueAtTime(vol, audioCtx.currentTime);
        gainNode.gain.exponentialRampToValueAtTime(0.00001, audioCtx.currentTime + sound.d);
        oscillator.start(audioCtx.currentTime);
        oscillator.stop(audioCtx.currentTime + sound.d);
    };

    document.body.addEventListener('click', initAudio, { once: true });
    
    const createGlobalDB = (db_key) => ({
        get: () => { try { const data = localStorage.getItem(db_key); return data ? JSON.parse(data) : []; } catch (e) { return []; } },
        save: (data) => localStorage.setItem(db_key, JSON.stringify(data)),
    });
    let activeProfileId = localStorage.getItem('enclaveActiveProfile') || 'default';
    const createDB = (base_key, onUpdate) => ({
        getKey: () => `${base_key}_${activeProfileId}`,
        get: function() { try { const data = localStorage.getItem(this.getKey()); return data ? JSON.parse(data) : []; } catch (e) { return []; } },
        save: function(data) { localStorage.setItem(this.getKey(), JSON.stringify(data)); if (onUpdate) onUpdate(); }
    });
    
    // --- Global Controls Setup ---
    document.getElementById('hw-settings-btn').addEventListener('click', () => {
        settingsModal.style.display = 'flex';
        settingsModal.querySelector('.modal-box').className = `modal-box`;
    });
    document.getElementById('settings-close-btn').addEventListener('click', () => {
        settingsModal.style.display = 'none';
    });
    document.getElementById('power-button').addEventListener('click', () => {
        showConfirmation("Log off and close all applications?", () => {
            Object.keys(openWindows).forEach(appId => {
                openWindows[appId].el.remove();
                delete openWindows[appId];
            });
            taskbarApps.innerHTML = '';
            activeWindow = null;
        });
    });

    const volumeOsd = document.getElementById('volume-osd');
    const volumeOsdLevel = document.getElementById('volume-osd-level');
    let osdTimeout;
    function showVolumeOsd() {
        volumeOsdLevel.style.width = `${settings.volume * 100}%`;
        volumeOsd.classList.add('visible');
        clearTimeout(osdTimeout);
        osdTimeout = setTimeout(() => { volumeOsd.classList.remove('visible'); }, 2000);
    }
    function changeVolume(amount) {
        let newVolume = settings.volume + amount;
        settings.volume = Math.max(0, Math.min(1, newVolume));
        document.getElementById('volume-slider').value = settings.volume;
        document.getElementById('volume-value').textContent = `${Math.round(settings.volume * 100)}%`;
        showVolumeOsd();
        saveSettings();
    }
    document.getElementById('hw-vol-down-btn').addEventListener('click', () => changeVolume(-0.1));
    document.getElementById('hw-vol-up-btn').addEventListener('click', () => changeVolume(0.1));

    document.getElementById('hw-cycle-btn').addEventListener('click', () => {
        const windows = Object.values(openWindows).map(w => w.el);
        if (windows.length < 2) return;
        const currentIndex = activeWindow ? windows.indexOf(activeWindow) : -1;
        const nextIndex = (currentIndex + 1) % windows.length;
        setActiveWindow(windows[nextIndex]);
    });
    
    // --- Settings Modal Logic ---
    function saveSettings() { localStorage.setItem('enclaveTerminalSettings', JSON.stringify(settings)); }
    
    function loadSettings() {
        const saved = localStorage.getItem('enclaveTerminalSettings');
        if (saved) settings = {...settings, ...JSON.parse(saved)};
        
        document.getElementById('volume-slider').value = settings.volume;
        document.getElementById('theme-select').value = settings.theme;
        document.body.className = settings.theme;
    }
    
    document.getElementById('theme-select').addEventListener('change', (e) => {
        settings.theme = e.target.value;
        document.body.className = settings.theme;
        saveSettings();
    });
     document.getElementById('volume-slider').addEventListener('input', (e) => {
        settings.volume = parseFloat(e.target.value);
        document.getElementById('volume-value').textContent = `${Math.round(settings.volume * 100)}%`;
        showVolumeOsd();
    });
    document.getElementById('volume-slider').addEventListener('change', saveSettings);
    
    // --- Global Modal Functions ---
    const alertModal = document.getElementById('alert-modal');
    let confirmCallback = null;
    function showConfirmation(message, onConfirm) { 
        alertModal.querySelector('#alert-message').textContent = message; 
        confirmCallback = onConfirm; 
        alertModal.style.display = 'flex';
        alertModal.querySelector('.modal-box').className = `modal-box`;
    }
    document.getElementById('alert-confirm-btn').addEventListener('click', () => { if (confirmCallback) confirmCallback(); alertModal.style.display = 'none'; });
    document.getElementById('alert-cancel-btn').addEventListener('click', () => { alertModal.style.display = 'none'; });

    // --- APP-SPECIFIC INITIALIZERS ---
    
    function initTerminalBase(appContainer) {
        appContainer.querySelector('#crt-screen').classList.remove('screen-off');
        appContainer.querySelector('#main-content-wrapper').style.display = 'flex';
        appContainer.querySelector('#main-content-wrapper').classList.add('visible');
        appContainer.querySelector('#boot-sequence').style.display = 'none';
        appContainer.querySelector('#login-screen').style.display = 'none';
        
        const navLinks = appContainer.querySelectorAll('.main-nav a');
        if (navLinks.length > 0) {
            navLinks.forEach(link => {
                link.addEventListener('click', (e) => {
                    e.preventDefault();
                    const viewId = link.dataset.view;
                    appContainer.querySelectorAll('.content-view').forEach(v => v.classList.remove('active'));
                    appContainer.querySelector(`#${viewId}`).classList.add('active');
                    navLinks.forEach(l => l.classList.remove('active'));
                    link.classList.add('active');
                });
            });
        }
    }
    
    function initSystemMonitorApp(win) {
        const appContainer = win.querySelector('#enclave-app-container');
        initTerminalBase(appContainer);
        appContainer.querySelector('#ascii-logo-home').innerHTML = `<svg class="boot-logo" viewBox="0 0 200 200" xmlns="http://www.w3.org/2000/svg" style="width: 100%; height: 100%; filter: drop-shadow(0 0 4px var(--header-glow));"><text x="100" y="105" font-family="Orbitron, sans-serif" font-size="120" font-weight="bold" fill="var(--header-color)" text-anchor="middle" dominant-baseline="middle">E</text></svg>`;
        let resources = { manpower: 15000, ammo: 500000, fuel: 8000, energy: 850, steel: 12000, components: 1500 };
        let production = [ { name: 'Vertibird', progress: 25, rate: 0.5 }, { name: 'Power Armor', progress: 60, rate: 1 } ];
        function updateResources() {
            resources.fuel -= 1; resources.steel += 2;
            appContainer.querySelector('#res-fuel').textContent = `${Math.floor(resources.fuel)}`;
            appContainer.querySelector('#res-steel').textContent = `${Math.floor(resources.steel)}`;
        }
        setInterval(updateResources, 3000);
        updateResources();
    }
    
    function initPersonnelApp(win) {
        const appContainer = win.querySelector('#enclave-app-container');
        initTerminalBase(appContainer);
        const defaultProfile = { id: 'default', name: 'root.user', title: 'System Administrator', portrait: `...` };
        function loadProfileDetails(profileId) { 
             const profile = defaultProfile; // simplified
             appContainer.querySelector('#profile-detail-name').textContent = profile.name;
             appContainer.querySelector('#profile-detail-title').textContent = profile.title;
        }
        loadProfileDetails('default');
    }
    
    function initRDToolsApp(win) {
         const appContainer = win.querySelector('#enclave-app-container');
         initTerminalBase(appContainer);
    }

    function initChimeraApp(win) {
        const appContainer = win.querySelector('#enclave-app-container');
        initTerminalBase(appContainer);
        appContainer.querySelector('#chimera-date').value = new Date().toISOString().split('T')[0];
    }

    function initMapApp(win) {
        const appContainer = win.querySelector('#enclave-app-container');
        initTerminalBase(appContainer);
        const mapAscii = appContainer.querySelector('#map-ascii');
        const mapData = { 'JT': { name: "Jacobstown", info: "..." } };
        const nevadaMap = `[JT] Jacobstown`;
        mapAscii.innerHTML = nevadaMap.replace(/\[(.*?)\]/g, '<span class="map-marker" data-loc="$1">$1</span>');
    }

    function initNotesApp(win) {
        const appContainer = win.querySelector('#enclave-app-container');
        initTerminalBase(appContainer);
        const notesDB = createDB('enclaveNotesDB', () => {});
        appContainer.querySelector('#new-note-btn').addEventListener('click', () => {});
    }
    
    // --- Initial Load ---
    loadSettings();
});