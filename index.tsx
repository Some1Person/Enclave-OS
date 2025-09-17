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

    let openWindows = {};
    let activeWindow = null;
    let highestZ = 10;
    
    const appConfig = {
        monitor: { title: "System Monitor", contentIds: ["system-home-view", "resource-tracker-view"], initFunc: initSystemMonitorApp },
        personnel: { title: "Personnel Database", contentIds: ["profiles-view", "rank-view"], initFunc: initPersonnelApp },
        rd: { title: "R&D Console", contentIds: ["rd-tools-view"], initFunc: initRDToolsApp },
        chimera: { title: "Project Chimera", contentIds: ["chimera-log-view"], initFunc: initChimeraApp },
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
        const app = e.target.dataset.app;
        if (app && appConfig[app]) {
            createAppWindow(app);
        }
    });

    // --- App Launching ---
    desktop.addEventListener('dblclick', (e) => {
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

        // Clone window structure
        const windowEl = windowTemplate.content.cloneNode(true).firstElementChild;
        windowEl.dataset.appId = appId;
        windowEl.style.top = `${50 + (Object.keys(openWindows).length % 10) * 30}px`;
        windowEl.style.left = `${100 + (Object.keys(openWindows).length % 10) * 30}px`;
        
        // Inject app-specific content
        const windowBody = windowEl.querySelector('.window-body');
        const mainAppContainer = enclaveContentTemplate.content.cloneNode(true).firstElementChild;
        const mainContentWrapper = mainAppContainer.querySelector('#main-content-wrapper');
        
        // Create a navigation bar for apps with multiple views
        if(config.contentIds.length > 1) {
            const nav = document.createElement('nav');
            nav.className = 'main-nav';
            config.contentIds.forEach((id, index) => {
                const viewName = id.replace(/-/g, ' ').replace('view', '').trim().toUpperCase();
                const link = document.createElement('a');
                link.href = '#';
                link.dataset.view = id;
                link.textContent = `> ${viewName}`;
                if (index === 0) link.classList.add('active');
                nav.appendChild(link);
            });
            mainContentWrapper.prepend(nav);
        }

        // Move only the required views into the window
        config.contentIds.forEach((id, index) => {
            const viewContent = mainAppContainer.querySelector(`#${id}`);
            if(index > 0) viewContent.classList.remove('active');
            mainContentWrapper.appendChild(viewContent);
        });
        
        windowBody.appendChild(mainAppContainer);
        desktop.appendChild(windowEl);
        
        // Finalize setup
        windowEl.querySelector('.title').textContent = config.title;
        windowEl.style.display = 'flex';
        openWindows[appId] = { el: windowEl, config };

        // Initialize app-specific JS logic
        config.initFunc(windowEl);

        // Make it interactive
        setupWindowInteractions(windowEl, appId, config.title);
        setActiveWindow(windowEl);
    }
    
    function setupWindowInteractions(win, appId, title) {
        // Dragging
        const titleBar = win.querySelector('.window-title-bar');
        let isDragging = false, offsetX, offsetY;
        titleBar.addEventListener('mousedown', (e) => {
            isDragging = true;
            offsetX = e.clientX - win.offsetLeft;
            offsetY = e.clientY - win.offsetTop;
            document.body.style.userSelect = 'none';
            setActiveWindow(win);
        });
        document.addEventListener('mousemove', (e) => {
            if (isDragging) {
                if (win.classList.contains('maximized')) {
                    win.classList.remove('maximized');
                }
                win.style.left = `${e.clientX - offsetX}px`;
                win.style.top = `${e.clientY - offsetY}px`;
            }
        });
        document.addEventListener('mouseup', () => {
            isDragging = false;
            document.body.style.userSelect = '';
        });
        
        win.addEventListener('mousedown', () => setActiveWindow(win));

        // Controls (min, max, close)
        win.querySelector('.window-controls').addEventListener('click', (e) => {
            const action = e.target.dataset.action;
            if (action === 'close') {
                delete openWindows[appId];
                win.remove();
                taskbarApps.querySelector(`[data-app-id="${appId}"]`)?.remove();
                if(activeWindow === win) setActiveWindow(null);
            } else if (action === 'minimize') {
                win.style.display = 'none';
                if(activeWindow === win) setActiveWindow(null);
                 taskbarApps.querySelector(`[data-app-id="${appId}"]`)?.classList.remove('active');
            } else if (action === 'maximize') {
                win.classList.toggle('maximized');
            }
        });
        
        // Taskbar
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
    
    // --- SHARED ENCLAVE LOGIC ---
    // (Audio Engine, DB Helpers, Settings, etc. - can be accessed by all app init functions)
    let audioCtx;
    let humOscillator;
    let humGain;
    
    let settings = {
        volume: 0.2, brightness: 100, zoom: 100, scrollSpeed: 35, autosaveInterval: 30000,
        muteTyping: false, muteUi: false, muteHum: false, theme: 'theme-green', cracked: false
    };

    const soundVariations = {
        tick: [{f:1500, d:0.05}, {f:1600, d:0.04}, {f:1450, d:0.06}],
        beep: [{f:440, d:0.1}, {f:523, d:0.1}, {f:600, d:0.1}],
        boot_tick: [{f:1200, d:0.05}, {f:1250, d:0.04}],
        error_beep: [{f:150, d:0.5}],
        success_beep: [{f:800, d:0.2}],
        alarm: [{f:1000, d:0.2}],
        save: [{f:300, d: 0.15}],
        whir: [{f: 100, d: 0.5 }]
    };
    
    const initAudio = () => { if (!audioCtx && (window.AudioContext || window.webkitAudioContext)) audioCtx = new (window.AudioContext || window.webkitAudioContext)(); };
    const playSound = (type, duration, freq) => { /* ... full function from previous script ... */ };
    
    const createGlobalDB = (db_key) => ({
        get: () => { try { const data = localStorage.getItem(db_key); return data ? JSON.parse(data) : []; } catch (e) { return []; } },
        save: (data) => { localStorage.setItem(db_key, JSON.stringify(data)); },
    });
    let activeProfileId = localStorage.getItem('enclaveActiveProfile') || 'default';
    const createDB = (base_key, onUpdate) => ({
        getKey: () => `${base_key}_${activeProfileId}`,
        get: function() { try { const data = localStorage.getItem(this.getKey()); return data ? JSON.parse(data) : []; } catch (e) { return []; } },
        save: function(data) { localStorage.setItem(this.getKey(), JSON.stringify(data)); if (onUpdate) onUpdate(); },
        purge: function() { localStorage.removeItem(this.getKey()); if (onUpdate) onUpdate(); },
        export: function() { /* ... full function ... */ },
        import: function(dataStr, onComplete) { /* ... full function ... */ }
    });

    // --- APP-SPECIFIC INITIALIZERS ---
    
    function initTerminalBase(appContainer) {
        // This function sets up the common terminal features for any window
        appContainer.querySelector('#power-button').addEventListener('click', () => {
             // Simplified power on for each app window - just start it up
             appContainer.querySelector('#crt-screen').classList.remove('screen-off');
             appContainer.querySelector('#main-content-wrapper').style.display = 'flex';
             appContainer.querySelector('#main-content-wrapper').classList.add('visible');
             // Hide other initial screens
             appContainer.querySelector('#boot-sequence').style.display = 'none';
             appContainer.querySelector('#login-screen').style.display = 'none';
        });
        
        // Auto "power on" when app opens
        appContainer.querySelector('#power-button').click();
        
        // Setup nav links if they exist
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
        
        // Resource tracking logic
        let resources = { manpower: 15000, ammo: 500000, fuel: 8000, energy: 850, steel: 12000, components: 1500 };
        let production = [
            { name: 'Vertibird Assault Craft', progress: 25, rate: 0.5 }, { name: 'X-01 Power Armor Suit', progress: 60, rate: 1 }, { name: 'Plasma Rifle Batch', progress: 90, rate: 2 },
        ];
        const logisticsLogEl = appContainer.querySelector('#logistics-log');

        function updateResources() {
            resources.fuel -= 1; resources.steel += 2; resources.components += 0.1;
            resources.energy += (Math.random() - 0.5) * 10;
            if (resources.energy < 800) resources.energy = 800; if (resources.energy > 1100) resources.energy = 1100;
            
            appContainer.querySelector('#res-manpower').textContent = `${Math.floor(resources.manpower)} / 20000`;
            appContainer.querySelector('#res-ammo').textContent = `${Math.floor(resources.ammo)}`;
            appContainer.querySelector('#res-fuel').textContent = `${Math.floor(resources.fuel)}`;
            appContainer.querySelector('#res-energy').textContent = `${Math.floor(resources.energy)} / 1200 MW`;
            appContainer.querySelector('#res-steel').textContent = `${Math.floor(resources.steel)}`;
            appContainer.querySelector('#res-components').textContent = `${Math.floor(resources.components)}`;
            
            const prodTable = appContainer.querySelector('#production-lines tbody');
            prodTable.innerHTML = '';
            production.forEach(p => {
                p.progress += p.rate;
                let status = "IN PROGRESS";
                if (p.progress >= 100) { p.progress = 0; status = "COMPLETE"; }
                prodTable.innerHTML += `<tr><td>${p.name}</td><td><div class="progress-bar-small"><div style="width: ${p.progress}%"></div></div></td><td>${status}</td></tr>`;
            });
        }
        setInterval(updateResources, 3000);
        updateResources();
    }
    
    function initPersonnelApp(win) {
        const appContainer = win.querySelector('#enclave-app-container');
        initTerminalBase(appContainer);
        
        // Personnel logic
        const profileDB = createGlobalDB('enclaveProfilesDB');
        let currentlyViewedProfileId = 'default';
        const defaultProfile = { id: 'default', name: 'root.user', title: 'System Administrator', clearance: 'Level 7', status: 'ACTIVE', assignment: 'Raven Rock Command', bio: 'Default system user. Full access privileges.', portrait: `\n   _________\n /         \\\n|  =======  |\n|           |\n|   > . <   |\n|     v     |\n|   '---'   |\n \\_________/\n                ` };
        
        function renderProfileList() { /* ... full function from previous script, scoped to appContainer ... */ }
        function loadProfileDetails(profileId) { /* ... full function from previous script, scoped to appContainer ... */ }
        
        loadProfileDetails('default');
        
        // Rank logic
        const rankData = [ { tier: "-- HIGH COMMAND --", ranks: [ /* ... data ... */ ] } ]; // shortened for brevity
        const rankListEl = appContainer.querySelector('#rank-list');
        function renderRankList() { /* ... full function ... */ }
        function displayRankDetails(rankId) { /* ... full function ... */ }
        renderRankList();
        if(rankData.length > 0) displayRankDetails(rankData[0].ranks[0].id);
    }
    
    function initRDToolsApp(win) {
         const appContainer = win.querySelector('#enclave-app-container');
         initTerminalBase(appContainer);
         // Setup all R&D tool event listeners, scoped to appContainer
         // e.g., appContainer.querySelector('#analyze-compound-btn').addEventListener(...)
    }

    function initChimeraApp(win) {
        const appContainer = win.querySelector('#enclave-app-container');
        initTerminalBase(appContainer);
        appContainer.querySelector('#chimera-date').value = new Date().toISOString().split('T')[0];
        // Add PDF download logic, scoped to appContainer
    }

    function initMapApp(win) {
        const appContainer = win.querySelector('#enclave-app-container');
        initTerminalBase(appContainer);
        
        const mapAscii = appContainer.querySelector('#map-ascii');
        const mapInfoText = appContainer.querySelector('#map-info-text');
        const mapSearch = appContainer.querySelector('#map-search');
        const mapData = { 'JT': { name: "Jacobstown", info: "..." }, /* ... all map data ... */ };
        const nevadaMap = `...`; // full map string
        mapAscii.innerHTML = nevadaMap.replace(/\[(.*?)\]/g, '<span class="map-marker" data-loc="$1">$1</span>');
        const mapMarkers = mapAscii.querySelectorAll('.map-marker');
        mapMarkers.forEach(marker => {
            marker.addEventListener('click', () => {
                mapMarkers.forEach(m => m.classList.remove('active'));
                marker.classList.add('active');
                const locId = marker.dataset.loc;
                mapInfoText.innerHTML = `<strong>LOCATION:</strong> ${mapData[locId].name}<br><br><strong>BRIEFING:</strong> ${mapData[locId].info}`;
            });
        });
    }

    function initNotesApp(win) {
        const appContainer = win.querySelector('#enclave-app-container');
        initTerminalBase(appContainer);
        
        const notesDB = createDB('enclaveNotesDB', renderNoteList);
        const noteListEl = appContainer.querySelector('#note-list');
        const noteTitleEl = appContainer.querySelector('#note-title');
        const noteContentEl = appContainer.querySelector('#note-content');
        let activeNoteId = null;

        function renderNoteList() { /* ... full function, scoped to appContainer ... */ }
        function loadNote(id) { /* ... full function, scoped to appContainer ... */ }
        function saveNote() { /* ... full function, scoped to appContainer ... */ }
        function newNote() { /* ... full function, scoped to appContainer ... */ }
        function deleteNote() { /* ... full function, scoped to appContainer ... */ }

        appContainer.querySelector('#new-note-btn').addEventListener('click', newNote);
        appContainer.querySelector('#save-note-btn').addEventListener('click', saveNote);
        appContainer.querySelector('#delete-note-btn').addEventListener('click', deleteNote);
        
        const notes = notesDB.get();
        if (notes.length > 0) { loadNote(notes.sort((a,b) => b.id - a.id)[0].id); }
        else { renderNoteList(); }
    }
});
