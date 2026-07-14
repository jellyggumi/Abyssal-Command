// Abyssal-Surge Dashboard Application

// 1. Database Configuration & Initialization
const DB_NAME = 'AbyssalSurgeDB';
const DB_VERSION = 1;
let db = null;

// Agent Metadata Definition
const AGENTS_DATA = [
    {
        name: 'game-production-director',
        model: 'opus',
        description: 'Abyssal Surge의 유일한 BMAD-GDS 프로듀서이자 마일스톤·의사결정 로그 조정자. 각 단계의 입력 완결성, 소유권 충돌, 게이트 통과 여부를 판정하고 다음 작업만 배정합니다.',
        tools: ['Read', 'Write', 'Bash', 'Grep', 'Glob', 'SendMessage', 'TaskUpdate']
    },
    {
        name: 'game-trend-researcher',
        model: 'sonnet',
        description: '글로벌 게임 트렌드, 플레이어 선호도, 경쟁작 분석을 담당합니다. 시장 조사 데이터와 트렌드 분석 보고서를 작성하여 기획 방향성을 지원합니다.',
        tools: ['Read', 'Search', 'WebScrape', 'SendMessage']
    },
    {
        name: 'player-experience-narrative-director',
        model: 'opus',
        description: '게임의 세계관, 스토리라인, 퀘스트 구조 및 플레이어 경험(UX) 흐름을 설계합니다. 내러티브 일관성과 감정적 몰입도를 검증합니다.',
        tools: ['Read', 'Write', 'SendMessage', 'TaskUpdate']
    },
    {
        name: 'product-monetization-pm',
        model: 'sonnet',
        description: '비즈니스 모델(BM), 유료화 정책, 인게임 경제 밸런스 및 상품 구성을 설계합니다. 지속 가능한 매출 모델과 플레이어 만족도의 균형을 맞춥니다.',
        tools: ['Read', 'Write', 'Calculate', 'SendMessage']
    },
    {
        name: 'systems-economy-designer',
        model: 'sonnet',
        description: '게임 시스템 규칙, 수치 밸런싱, 재화 흐름 및 인게임 이코노미 시뮬레이션을 담당합니다. 수학적 모델링을 통해 시스템 안정성을 검증합니다.',
        tools: ['Read', 'Write', 'Calculate', 'SendMessage', 'TaskUpdate']
    },
    {
        name: 'game-engineering-lead',
        model: 'sonnet',
        description: '기술 아키텍처 설계, 성능 최적화, 플랫폼 이식성 및 기술적 위험 요소를 평가합니다. 코드 품질 게이트와 빌드 파이프라인을 관리합니다.',
        tools: ['Read', 'Write', 'Bash', 'Lint', 'Test', 'SendMessage']
    },
    {
        name: 'adversarial-qa-lead',
        model: 'sonnet',
        description: '취약점 분석, 경계값 테스트, 밸런스 붕괴 요소 탐지 및 회귀 테스트를 수행합니다. 엄격한 QA Verdict를 통해 릴리즈 승인 여부를 결정합니다.',
        tools: ['Read', 'Write', 'Bash', 'Test', 'SendMessage', 'TaskUpdate']
    },
    {
        name: 'live-operations-lead',
        model: 'sonnet',
        description: '라이브 서비스 안정성, 업데이트 배포 계획, 유저 피드백 모니터링 및 긴급 핫픽스 프로세스를 관리합니다. 릴리즈 준비 상태를 최종 점검합니다.',
        tools: ['Read', 'Write', 'Bash', 'Monitor', 'SendMessage']
    }
];

function initDB() {
    return new Promise((resolve, reject) => {
        const request = indexedDB.open(DB_NAME, DB_VERSION);

        request.onerror = (event) => {
            console.error('Database error:', event.target.error);
            reject(event.target.error);
        };

        request.onsuccess = (event) => {
            db = event.target.result;
            console.log('Database initialized successfully');
            resolve(db);
        };

        request.onupgradeneeded = (event) => {
            const dbInstance = event.target.result;
            
            // Create object stores
            if (!dbInstance.objectStoreNames.contains('runs')) {
                dbInstance.createObjectStore('runs', { keyPath: 'runId' });
            }
            if (!dbInstance.objectStoreNames.contains('logs')) {
                dbInstance.createObjectStore('logs', { keyPath: 'id', autoIncrement: true });
            }
            if (!dbInstance.objectStoreNames.contains('agents')) {
                dbInstance.createObjectStore('agents', { keyPath: 'name' });
            }
        };
    });
}

// 2. Database Operations Helpers
function addData(storeName, data) {
    return new Promise((resolve, reject) => {
        const transaction = db.transaction([storeName], 'readwrite');
        const store = transaction.objectStore(storeName);
        const request = store.put(data);

        request.onsuccess = () => resolve(request.result);
        request.onerror = (e) => reject(e.target.error);
    });
}

function getAllData(storeName) {
    return new Promise((resolve, reject) => {
        const transaction = db.transaction([storeName], 'readonly');
        const store = transaction.objectStore(storeName);
        const request = store.getAll();

        request.onsuccess = () => resolve(request.result);
        request.onerror = (e) => reject(e.target.error);
    });
}

function clearStore(storeName) {
    return new Promise((resolve, reject) => {
        const transaction = db.transaction([storeName], 'readwrite');
        const store = transaction.objectStore(storeName);
        const request = store.clear();

        request.onsuccess = () => resolve();
        request.onerror = (e) => reject(e.target.error);
    });
}

// 3. UI Navigation & View Management
const views = {
    dashboard: document.getElementById('view-dashboard'),
    agents: document.getElementById('view-agents'),
    simulations: document.getElementById('view-simulations'),
    database: document.getElementById('view-database')
};

const navButtons = {
    dashboard: document.getElementById('btn-dashboard'),
    agents: document.getElementById('btn-agents'),
    simulations: document.getElementById('btn-simulations'),
    database: document.getElementById('btn-database')
};

function switchView(viewName) {
    Object.keys(views).forEach(key => {
        if (key === viewName) {
            views[key].classList.add('active');
            navButtons[key].classList.add('active');
        } else {
            views[key].classList.remove('active');
            navButtons[key].classList.remove('active');
        }
    });

    if (viewName === 'dashboard') {
        updateDashboardStats();
    } else if (viewName === 'database') {
        loadDatabaseView();
    }
}

// Bind Navigation Events
Object.keys(navButtons).forEach(key => {
    navButtons[key].addEventListener('click', () => switchView(key));
});

// 4. Populate Agents View
function renderAgents() {
    const container = document.getElementById('agents-container');
    container.innerHTML = '';

    AGENTS_DATA.forEach(agent => {
        const card = document.createElement('div');
        card.className = 'agent-card';
        
        const toolsHTML = agent.tools.map(tool => `<span class="tool-badge">${tool}</span>`).join('');
        
        card.innerHTML = `
            <div class="agent-header">
                <span class="agent-name">${agent.name}</span>
                <span class="agent-model">${agent.model}</span>
            </div>
            <p class="agent-desc">${agent.description}</p>
            <div class="agent-tools">
                ${toolsHTML}
            </div>
        `;
        container.appendChild(card);
    });
}

// 5. Simulation Logic
function generateRunId() {
    const timestamp = Date.now();
    const random = Math.floor(Math.random() * 10000).toString().padStart(4, '0');
    return `run-${timestamp}-${random}`;
}

function appendConsole(message, type = 'system') {
    const consoleEl = document.getElementById('sim-console');
    const line = document.createElement('div');
    line.className = `console-line ${type}`;
    line.textContent = `[${new Date().toLocaleTimeString()}] ${message}`;
    consoleEl.appendChild(line);
    consoleEl.scrollTop = consoleEl.scrollHeight;
}

let activeSimulation = null;

async function runSimulation(runId, title, startPhase) {
    const consoleEl = document.getElementById('sim-console');
    consoleEl.innerHTML = '';
    
    const statusBar = document.getElementById('sim-status-text');
    statusBar.className = 'status-badge status-running';
    statusBar.textContent = '실행 중';
    document.getElementById('sim-active-id').textContent = runId;

    appendConsole(`새 시뮬레이션 시작: ${title} (${runId})`, 'system');
    appendConsole(`시작 단계: ${startPhase}`, 'system');

    const runRecord = {
        runId,
        title,
        startPhase,
        currentPhase: startPhase,
        status: 'Running',
        startTime: new Date().toLocaleString(),
        endTime: null
    };
    await addData('runs', runRecord);

    const phases = [
        'Phase 0: Intake & Constraints',
        'Phase 1: Production Brief',
        'Phase 2: Research & Survey',
        'Phase 3: Monetization & Rules',
        'Phase 4: Engineering & Risk',
        'Phase 5: QA & Verdict'
    ];

    const startIndex = phases.findIndex(p => p.startsWith(startPhase));
    const activePhases = phases.slice(startIndex >= 0 ? startIndex : 0);

    // Simulate sequential agent execution
    for (let i = 0; i < activePhases.length; i++) {
        const phase = activePhases[i];
        runRecord.currentPhase = phase.split(':')[0];
        await addData('runs', runRecord);

        appendConsole(`--- ${phase} 진입 ---`, 'system');
        await sleep(1500);

        if (phase.includes('Phase 0')) {
            appendConsole('[game-production-director] 원시 intake 및 제약 조건 검증 완료.', 'agent');
            await logDecision(runId, 'game-production-director', 'Phase 0 승인', 'intake/raw-intake.md 및 constraints.md 검증 완료. Phase 1 개시 가능.');
        } else if (phase.includes('Phase 1')) {
            appendConsole('[game-production-director] Production Brief 및 Task Manifest 생성 완료.', 'agent');
            await logDecision(runId, 'game-production-director', 'Phase 1 완료', 'production-brief.md 및 task-manifest.md 불변 상태 확인.');
        } else if (phase.includes('Phase 2')) {
            appendConsole('[game-trend-researcher] 글로벌 트렌드 및 경쟁작 분석 진행.', 'agent');
            await sleep(1000);
            appendConsole('[player-experience-narrative-director] 내러티브 일관성 및 UX 흐름 설계.', 'agent');
            await logDecision(runId, 'game-trend-researcher', '트렌드 분석 완료', 'survey-decision-packet.md 작성 완료.');
        } else if (phase.includes('Phase 3')) {
            appendConsole('[product-monetization-pm] 비즈니스 모델(BM) 및 유료화 정책 설계.', 'agent');
            await sleep(1000);
            appendConsole('[systems-economy-designer] 게임 시스템 규칙 및 재화 밸런싱 시뮬레이션.', 'agent');
            await logDecision(runId, 'systems-economy-designer', '밸런싱 모델 확정', 'systems/rule-contract.md 및 monetization-policy.md 고정.');
        } else if (phase.includes('Phase 4')) {
            appendConsole('[game-engineering-lead] 기술 아키텍처 설계 및 성능 최적화 검토.', 'agent');
            await logDecision(runId, 'game-engineering-lead', '기술 검증 완료', '성능 및 위험 기술 증거 확보.');
        } else if (phase.includes('Phase 5')) {
            appendConsole('[adversarial-qa-lead] 20회 반복 회귀 테스트 및 취약점 분석 수행.', 'agent');
            await sleep(1200);
            appendConsole('[adversarial-qa-lead] QA Verdict: PASS', 'success');
            appendConsole('[live-operations-lead] 라이브 서비스 배포 준비 상태 최종 승인.', 'agent');
            await logDecision(runId, 'adversarial-qa-lead', 'QA PASS 판정', 'qa-verdict.md 생성 및 20회 반복 회귀 매트릭스 완결.');
        }
    }

    runRecord.status = 'Success';
    runRecord.endTime = new Date().toLocaleString();
    await addData('runs', runRecord);

    statusBar.className = 'status-badge status-success';
    statusBar.textContent = '완료';
    appendConsole('시뮬레이션이 성공적으로 완료되었습니다!', 'success');
    updateDashboardStats();
}

function sleep(ms) {
    return new Promise(resolve => setTimeout(resolve, ms));
}

async function logDecision(runId, agent, decision, rationale) {
    const logEntry = {
        runId,
        agent,
        decision,
        rationale,
        timestamp: new Date().toLocaleString()
    };
    await addData('logs', logEntry);
    appendConsole(`[의사결정 기록] ${agent}: ${decision} - ${rationale}`, 'system');
}

// 6. Dashboard Stats & Recent Runs
async function updateDashboardStats() {
    if (!db) return;
    
    const runs = await getAllData('runs');
    const logs = await getAllData('logs');
    const agents = await getAllData('agents');

    document.getElementById('stat-runs-count').textContent = runs.length;
    document.getElementById('stat-logs-count').textContent = logs.length;
    document.getElementById('stat-agents-count').textContent = agents.length || AGENTS_DATA.length;

    // Render recent runs table
    const tbody = document.querySelector('#table-recent-runs tbody');
    tbody.innerHTML = '';

    if (runs.length === 0) {
        tbody.innerHTML = `<tr><td colspan="5" class="text-center">기록이 없습니다. 새 시뮬레이션을 시작해보세요.</td></tr>`;
        return;
    }

    // Sort by startTime descending
    const sortedRuns = [...runs].reverse().slice(0, 5);
    sortedRuns.forEach(run => {
        const tr = document.createElement('tr');
        const statusClass = run.status === 'Success' ? 'status-success' : (run.status === 'Running' ? 'status-running' : 'status-failed');
        tr.innerHTML = `
            <td><span class="sim-current-run-id">${run.runId}</span></td>
            <td>${run.startTime}</td>
            <td>${run.currentPhase}</td>
            <td><span class="status-badge ${statusClass}">${run.status}</span></td>
            <td><button class="btn btn-secondary btn-sm btn-view-run" data-id="${run.runId}">상세</button></td>
        `;
        tbody.appendChild(tr);
    });

    // Bind detail buttons
    document.querySelectorAll('.btn-view-run').forEach(btn => {
        btn.addEventListener('click', () => {
            const runId = btn.getAttribute('data-id');
            switchView('simulations');
            loadRunToMonitor(runId);
        });
    });
}

async function loadRunToMonitor(runId) {
    const runs = await getAllData('runs');
    const run = runs.find(r => r.runId === runId);
    if (!run) return;

    document.getElementById('input-run-id').value = run.runId;
    document.getElementById('input-title').value = run.title;
    document.getElementById('select-phase').value = run.startPhase;
    document.getElementById('sim-active-id').textContent = run.runId;
    
    const statusBar = document.getElementById('sim-status-text');
    const statusClass = run.status === 'Success' ? 'status-success' : (run.status === 'Running' ? 'status-running' : 'status-failed');
    statusBar.className = `status-badge ${statusClass}`;
    statusBar.textContent = run.status === 'Success' ? '완료' : (run.status === 'Running' ? '실행 중' : '실패');

    // Load logs for this run
    const logs = await getAllData('logs');
    const runLogs = logs.filter(l => l.runId === runId);
    
    const consoleEl = document.getElementById('sim-console');
    consoleEl.innerHTML = '';
    appendConsole(`시뮬레이션 기록 로드 완료: ${run.title} (${run.runId})`, 'system');
    
    runLogs.forEach(log => {
        appendConsole(`[의사결정 기록] ${log.agent}: ${log.decision} - ${log.rationale}`, 'system');
    });
}

// 7. Database View & Management
let currentStore = 'runs';

async function loadDatabaseView() {
    const tabs = document.querySelectorAll('.db-tab-btn');
    tabs.forEach(tab => {
        if (tab.getAttribute('data-store') === currentStore) {
            tab.classList.add('active');
        } else {
            tab.classList.remove('active');
        }
    });

    const data = await getAllData(currentStore);
    const thead = document.querySelector('#table-db-data thead');
    const tbody = document.querySelector('#table-db-data tbody');
    thead.innerHTML = '';
    tbody.innerHTML = '';

    if (data.length === 0) {
        tbody.innerHTML = `<tr><td class="text-center">데이터가 없습니다.</td></tr>`;
        return;
    }

    // Generate headers from keys
    const headers = Object.keys(data[0]);
    const trHead = document.createElement('tr');
    headers.forEach(h => {
        const th = document.createElement('th');
        th.textContent = h;
        trHead.appendChild(th);
    });
    thead.appendChild(trHead);

    // Populate rows
    data.forEach(row => {
        const tr = document.createElement('tr');
        headers.forEach(h => {
            const td = document.createElement('td');
            if (typeof row[h] === 'object') {
                td.textContent = JSON.stringify(row[h]);
            } else {
                td.textContent = row[h];
            }
            tr.appendChild(td);
        });
        tbody.appendChild(tr);
    });
}

// Bind DB Tab Events
document.querySelectorAll('.db-tab-btn').forEach(btn => {
    btn.addEventListener('click', (e) => {
        currentStore = e.target.getAttribute('data-store');
        loadDatabaseView();
    });
});

// Export DB as JSON
document.getElementById('btn-export-db').addEventListener('click', async () => {
    const runs = await getAllData('runs');
    const logs = await getAllData('logs');
    const agents = await getAllData('agents');
    
    const dbBackup = { runs, logs, agents };
    const dataStr = "data:text/json;charset=utf-8," + encodeURIComponent(JSON.stringify(dbBackup, null, 2));
    const downloadAnchor = document.createElement('a');
    downloadAnchor.setAttribute("href",     dataStr);
    downloadAnchor.setAttribute("download", `abyssal_surge_db_backup_${Date.now()}.json`);
    document.body.appendChild(downloadAnchor);
    downloadAnchor.click();
    downloadAnchor.remove();
});

// Clear DB
document.getElementById('btn-clear-db').addEventListener('click', async () => {
    if (confirm('정말로 로컬 데이터베이스를 초기화하시겠습니까? 모든 시뮬레이션 기록이 삭제됩니다.')) {
        await clearStore('runs');
        await clearStore('logs');
        await updateDashboardStats();
        alert('로컬 데이터베이스가 초기화되었습니다.');
        if (views.database.classList.contains('active')) {
            loadDatabaseView();
        }
    }
});

// Refresh DB
document.getElementById('btn-refresh-db').addEventListener('click', () => {
    loadDatabaseView();
});

// 8. Initialization on Load
window.addEventListener('DOMContentLoaded', async () => {
    await initDB();
    
    // Cache agents metadata in DB if empty
    const cachedAgents = await getAllData('agents');
    if (cachedAgents.length === 0) {
        for (const agent of AGENTS_DATA) {
            await addData('agents', agent);
        }
    }

    // Set initial Run ID
    document.getElementById('input-run-id').value = generateRunId();

    // Render agents list
    renderAgents();

    // Update stats
    updateDashboardStats();

    // Regen ID button
    document.getElementById('btn-regen-id').addEventListener('click', () => {
        document.getElementById('input-run-id').value = generateRunId();
    });

    // Quick start button
    document.getElementById('btn-quick-start').addEventListener('click', () => {
        switchView('simulations');
    });

    // Form submit for simulation
    document.getElementById('form-new-run').addEventListener('submit', async (e) => {
        e.preventDefault();
        const runId = document.getElementById('input-run-id').value;
        const title = document.getElementById('input-title').value;
        const phase = document.getElementById('select-phase').value;
        
        await runSimulation(runId, title, phase);
        
        // Generate next run ID
        document.getElementById('input-run-id').value = generateRunId();
    });
});
