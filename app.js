// Trading Pro - Sistema com Firebase
// Sincroniza dados entre localStorage e Firebase

// ===== IMPORTAR FIREBASE =====
import { initFirebase, saveToFirebase, loadFromFirebase, syncData } from './firebase-config.js';

// ===== ESTADO GLOBAL =====
let userData = {
    setup: {
        initialBank: 0,
        metaPercent: 0,
        stopPercent: 0,
        configured: false
    },
    days: [],
    financial: {
        deposits: [],
        withdrawals: []
    },
    operations: [],
    personalBills: []
};

let selectedPeriod = null;
let selectedResult = null;
let currentDayId = null;
let currentFilter = 'all';
let charts = {};
let currentCalendarDate = new Date();

// ===== INICIALIZAÇÃO =====
document.addEventListener('DOMContentLoaded', async () => {
    createParticles();
    updateCurrentDate();
    setInterval(updateCurrentDate, 60000);
    
    // Inicializar Firebase primeiro
    await initFirebase();
    
    // Carregar dados (já sincronizado pelo Firebase)
    loadUserData();
    initializeApp();
});

// ===== INICIALIZAR APP =====
function initializeApp() {
    if (userData.setup.configured) {
        navigateTo('dashboard');
        updateDashboard();
    } else {
        navigateTo('setup');
    }
}

// ===== PARTÍCULAS DE FUNDO =====
function createParticles() {
    const container = document.getElementById('particles');
    for (let i = 0; i < 50; i++) {
        const particle = document.createElement('div');
        particle.className = 'particle';
        particle.style.left = Math.random() * 100 + '%';
        particle.style.animationDelay = Math.random() * 10 + 's';
        particle.style.animationDuration = (10 + Math.random() * 10) + 's';
        container.appendChild(particle);
    }
}

// ===== DATA E HORA =====
function updateCurrentDate() {
    const now = new Date();
    const options = { 
        weekday: 'long', 
        year: 'numeric', 
        month: 'long', 
        day: 'numeric',
        hour: '2-digit',
        minute: '2-digit'
    };
    document.getElementById('currentDate').textContent = now.toLocaleDateString('pt-BR', options);
}

// ===== NAVEGAÇÃO =====
function navigateTo(screen) {
    // Atualizar menu
    document.querySelectorAll('.nav-item').forEach(item => {
        item.classList.remove('active');
    });
    if (event && event.target) {
        event.target.closest('.nav-item')?.classList.add('active');
    }
    
    // Atualizar tela
    document.querySelectorAll('.screen').forEach(s => {
        s.classList.remove('active');
    });
    document.getElementById(screen).classList.add('active');
    
    // Atualizar título
    const titles = {
        'setup': '⚙️ Configuração',
        'dashboard': '📊 Dashboard',
        'financeiro': '💰 Financeiro',
        'graficos': '📈 Gráficos'
    };
    document.getElementById('pageTitle').textContent = titles[screen] || screen;
    
    // Carregar conteúdo específico
    if (screen === 'dashboard') {
        updateDashboard();
    } else if (screen === 'financeiro') {
        loadFinancial();
    } else if (screen === 'graficos') {
        loadCharts();
    }
}

// ===== TOGGLE SIDEBAR =====
function toggleSidebar() {
    const sidebar = document.getElementById('sidebar');
    const mainContent = document.getElementById('mainContent');
    sidebar.classList.toggle('collapsed');
    mainContent.classList.toggle('expanded');
}

// ===== NOTIFICAÇÕES =====
function showNotification(title, message, type = 'success') {
    const notification = document.getElementById('notification');
    document.getElementById('notificationTitle').textContent = title;
    document.getElementById('notificationMessage').textContent = message;
    notification.className = `notification ${type} show`;
    
    setTimeout(() => {
        notification.classList.remove('show');
    }, 3000);
}

// ===== SALVAR/CARREGAR DADOS =====
function saveUserData() {
    // Salvar no localStorage
    localStorage.setItem('tradingProData', JSON.stringify(userData));
    
    // Sincronizar com Firebase (assíncrono, não bloqueia a aplicação)
    saveToFirebase(userData).catch(err => {
        console.warn('⚠️ Erro ao sincronizar com Firebase:', err);
    });
}

function loadUserData() {
    const saved = localStorage.getItem('tradingProData');
    if (saved) {
        userData = JSON.parse(saved);
    }
}

// ===== SETUP =====
function setPercentage(field, value) {
    document.getElementById(field).value = value;
}

function saveSetup(event) {
    event.preventDefault();
    
    const initialBank = parseFloat(document.getElementById('initialBank').value);
    const metaPercent = parseFloat(document.getElementById('metaPercent').value);
    const stopPercent = parseFloat(document.getElementById('stopPercent').value);
    
    userData.setup = {
        initialBank,
        metaPercent,
        stopPercent,
        configured: true
    };
    
    saveUserData();
    showNotification('✅ Sucesso', 'Configuração salva com sucesso!');
    navigateTo('dashboard');
}

// ===== DASHBOARD =====
function updateDashboard() {
    const currentBank = calculateCurrentBank();
    const meta = userData.setup.initialBank * (1 + userData.setup.metaPercent / 100);
    const stop = userData.setup.initialBank * (1 - userData.setup.stopPercent / 100);
    const profit = currentBank - userData.setup.initialBank;
    const profitability = ((currentBank / userData.setup.initialBank - 1) * 100).toFixed(2);
    
    document.getElementById('currentBank').textContent = formatCurrency(currentBank);
    document.getElementById('bankVariation').textContent = `${profit >= 0 ? '+' : ''}${formatCurrency(profit)}`;
    document.getElementById('metaValue').textContent = formatCurrency(meta);
    document.getElementById('metaPercent').textContent = `${userData.setup.metaPercent}%`;
    document.getElementById('stopValue').textContent = formatCurrency(stop);
    document.getElementById('stopPercent').textContent = `${userData.setup.stopPercent}%`;
    document.getElementById('profitability').textContent = `${profitability >= 0 ? '+' : ''}${profitability}%`;
    document.getElementById('profitValue').textContent = `${profit >= 0 ? '+' : ''}${formatCurrency(profit)}`;
    
    renderDaysList();
}

function calculateCurrentBank() {
    let total = userData.setup.initialBank;
    
    // Adicionar depósitos
    userData.financial.deposits.forEach(d => {
        total += d.value;
    });
    
    // Subtrair saques
    userData.financial.withdrawals.forEach(w => {
        total -= w.value;
    });
    
    // Calcular resultado das operações
    userData.days.forEach(day => {
        day.entries.forEach(entry => {
            if (entry.result === 'win') {
                total += entry.value;
            } else {
                total -= entry.value;
            }
        });
    });
    
    return total;
}

function renderDaysList() {
    const container = document.getElementById('daysList');
    
    if (userData.days.length === 0) {
        container.innerHTML = `
            <div class="empty-state">
                <div class="empty-state-icon">📅</div>
                <div class="empty-state-title">Nenhum dia cadastrado</div>
                <div class="empty-state-text">Crie seu primeiro dia de trading para começar</div>
                <button class="btn btn-primary" onclick="openNewDayModal()">+ Criar Primeiro Dia</button>
            </div>
        `;
        return;
    }
    
    // Ordenar dias por data (mais recente primeiro)
    const sortedDays = [...userData.days].sort((a, b) => 
        new Date(b.date) - new Date(a.date)
    );
    
    container.innerHTML = sortedDays.map(day => {
        const stats = calculateDayStats(day);
        return `
            <div class="day-card" id="day-${day.id}">
                <div class="day-header" onclick="toggleDayDetails('${day.id}')">
                    <div class="day-date-info">
                        <div class="day-date">📅 ${formatDate(day.date)}</div>
                        <div class="day-quick-stats">
                            <span class="quick-stat">${stats.total} entradas</span>
                            <span class="quick-stat ${stats.wins > stats.losses ? 'positive' : 'negative'}">${stats.winRate}% win</span>
                            <span class="quick-stat ${stats.result >= 0 ? 'positive' : 'negative'}">${formatCurrency(stats.result)}</span>
                        </div>
                    </div>
                    <div class="day-toggle-icon" id="toggle-${day.id}">▼</div>
                </div>
                
                <div class="day-details" id="details-${day.id}" style="display: none;">
                    <div class="day-actions">
                        <button class="action-btn" onclick="event.stopPropagation(); openEntryModal('${day.id}')">+ Entrada</button>
                        <button class="action-btn" onclick="event.stopPropagation(); openChangeDateModal('${day.id}')">📅 Data</button>
                        <button class="action-btn" onclick="event.stopPropagation(); deleteDay('${day.id}')">🗑️</button>
                    </div>
                    
                    <div class="day-stats">
                        <div class="day-stat">
                            <div class="day-stat-label">Entradas</div>
                            <div class="day-stat-value">${stats.total}</div>
                        </div>
                        <div class="day-stat">
                            <div class="day-stat-label">Wins</div>
                            <div class="day-stat-value positive">${stats.wins}</div>
                        </div>
                        <div class="day-stat">
                            <div class="day-stat-label">Losses</div>
                            <div class="day-stat-value negative">${stats.losses}</div>
                        </div>
                        <div class="day-stat">
                            <div class="day-stat-label">Win Rate</div>
                            <div class="day-stat-value ${stats.wins > stats.losses ? 'positive' : 'negative'}">${stats.winRate}%</div>
                        </div>
                        <div class="day-stat">
                            <div class="day-stat-label">Resultado</div>
                            <div class="day-stat-value ${stats.result >= 0 ? 'positive' : 'negative'}">${formatCurrency(stats.result)}</div>
                        </div>
                    </div>
                    
                    <div class="entries-grid">
                        ${renderEntries(day)}
                    </div>
                </div>
            </div>
        `;
    }).join('');
}

function toggleDayDetails(dayId) {
    const details = document.getElementById(`details-${dayId}`);
    const toggle = document.getElementById(`toggle-${dayId}`);
    
    if (details.style.display === 'none') {
        details.style.display = 'block';
        toggle.textContent = '▲';
        toggle.style.transform = 'rotate(180deg)';
    } else {
        details.style.display = 'none';
        toggle.textContent = '▼';
        toggle.style.transform = 'rotate(0deg)';
    }
}

function calculateDayStats(day) {
    const wins = day.entries.filter(e => e.result === 'win').length;
    const losses = day.entries.filter(e => e.result === 'loss').length;
    const total = wins + losses;
    const winRate = total > 0 ? ((wins / total) * 100).toFixed(0) : 0;
    
    let result = 0;
    day.entries.forEach(entry => {
        if (entry.result === 'win') {
            result += entry.value;
        } else {
            result -= entry.value;
        }
    });
    
    return { wins, losses, total, winRate, result };
}

function renderEntries(day) {
    const periods = ['morning', 'afternoon', 'night'];
    const periodNames = {
        morning: '🌅 Manhã',
        afternoon: '☀️ Tarde',
        night: '🌙 Noite'
    };
    
    return periods.map(period => {
        const entry = day.entries.find(e => e.period === period);
        
        if (entry) {
            return `
                <div class="entry-slot has-entry ${entry.result}" onclick="deleteEntry('${day.id}', '${entry.id}')">
                    <div class="entry-period">${periodNames[period]}</div>
                    <div class="entry-result">${entry.result === 'win' ? 'WIN' : 'LOSS'}</div>
                    <div class="entry-value">${formatCurrency(entry.value)}</div>
                </div>
            `;
        } else {
            return `
                <div class="entry-slot" onclick="openEntryModal('${day.id}', '${period}')">
                    <div class="entry-period">${periodNames[period]}</div>
                    <div style="color: var(--text-secondary); font-size: 2rem;">+</div>
                </div>
            `;
        }
    }).join('');
}

// ===== DIAS =====
function openNewDayModal() {
    document.getElementById('newDayDate').value = new Date().toISOString().split('T')[0];
    document.getElementById('newDayModal').classList.add('active');
}

function closeNewDayModal() {
    document.getElementById('newDayModal').classList.remove('active');
}

function createDay(event) {
    event.preventDefault();
    
    const date = document.getElementById('newDayDate').value;
    
    // Verificar se já existe dia com essa data
    if (userData.days.some(d => d.date === date)) {
        showNotification('⚠️ Atenção', 'Já existe um dia com esta data!', 'error');
        return;
    }
    
    const newDay = {
        id: generateId(),
        date,
        entries: []
    };
    
    userData.days.push(newDay);
    saveUserData();
    
    closeNewDayModal();
    showNotification('✅ Sucesso', 'Novo dia criado!');
    updateDashboard();
}

function openChangeDateModal(dayId) {
    currentDayId = dayId;
    const day = userData.days.find(d => d.id === dayId);
    document.getElementById('changeDate').value = day.date;
    document.getElementById('changeDateModal').classList.add('active');
}

function closeChangeDateModal() {
    document.getElementById('changeDateModal').classList.remove('active');
    currentDayId = null;
}

function changeDate(event) {
    event.preventDefault();
    
    const newDate = document.getElementById('changeDate').value;
    const day = userData.days.find(d => d.id === currentDayId);
    
    // Verificar se já existe outro dia com essa data
    if (userData.days.some(d => d.date === newDate && d.id !== currentDayId)) {
        showNotification('⚠️ Atenção', 'Já existe um dia com esta data!', 'error');
        return;
    }
    
    day.date = newDate;
    saveUserData();
    
    closeChangeDateModal();
    showNotification('✅ Sucesso', 'Data alterada!');
    updateDashboard();
}

function deleteDay(dayId) {
    if (!confirm('Tem certeza que deseja excluir este dia e todas as suas entradas?')) {
        return;
    }
    
    userData.days = userData.days.filter(d => d.id !== dayId);
    saveUserData();
    
    showNotification('✅ Sucesso', 'Dia excluído!');
    updateDashboard();
}

// ===== ENTRADAS =====
function openEntryModal(dayId, period = null) {
    currentDayId = dayId;
    selectedPeriod = period;
    selectedResult = null;
    
    // Resetar formulário
    document.getElementById('entryValue').value = '';
    document.querySelectorAll('.period-btn').forEach(btn => btn.classList.remove('selected'));
    document.querySelectorAll('.result-btn').forEach(btn => btn.classList.remove('selected'));
    
    // Pré-selecionar período se fornecido
    if (period) {
        document.querySelector(`.period-btn[onclick="selectPeriod('${period}')"]`)?.classList.add('selected');
    }
    
    document.getElementById('entryModal').classList.add('active');
}

function closeEntryModal() {
    document.getElementById('entryModal').classList.remove('active');
    currentDayId = null;
    selectedPeriod = null;
    selectedResult = null;
}

function selectPeriod(period) {
    selectedPeriod = period;
    document.querySelectorAll('.period-btn').forEach(btn => btn.classList.remove('selected'));
    event.target.closest('.period-btn').classList.add('selected');
}

function selectResult(result) {
    selectedResult = result;
    document.querySelectorAll('.result-btn').forEach(btn => btn.classList.remove('selected'));
    event.target.closest('.result-btn').classList.add('selected');
}

function addEntry(event) {
    event.preventDefault();
    
    if (!selectedPeriod || !selectedResult) {
        showNotification('⚠️ Atenção', 'Selecione período e resultado!', 'error');
        return;
    }
    
    const value = parseFloat(document.getElementById('entryValue').value);
    const day = userData.days.find(d => d.id === currentDayId);
    
    // Verificar se já existe entrada nesse período
    if (day.entries.some(e => e.period === selectedPeriod)) {
        showNotification('⚠️ Atenção', 'Já existe uma entrada neste período!', 'error');
        return;
    }
    
    const newEntry = {
        id: generateId(),
        period: selectedPeriod,
        result: selectedResult,
        value,
        createdAt: new Date().toISOString()
    };
    
    day.entries.push(newEntry);
    
    // Adicionar às operações globais
    userData.operations.push({
        id: generateId(),
        type: selectedResult === 'win' ? 'WIN' : 'LOSS',
        color: selectedResult === 'win' ? '#00FF88' : '#FF0055',
        value,
        date: day.date,
        category: 'Trading',
        notes: `${getPeriodName(selectedPeriod)} - ${day.date}`,
        timestamp: new Date().toISOString()
    });
    
    saveUserData();
    
    closeEntryModal();
    showNotification('✅ Sucesso', 'Entrada adicionada!');
    updateDashboard();
}

function deleteEntry(dayId, entryId) {
    if (!confirm('Deseja excluir esta entrada?')) {
        return;
    }
    
    const day = userData.days.find(d => d.id === dayId);
    day.entries = day.entries.filter(e => e.id !== entryId);
    
    saveUserData();
    showNotification('✅ Sucesso', 'Entrada excluída!');
    updateDashboard();
}

// ===== OPERAÇÕES =====
function loadOperations() {
    renderOperations();
}

function filterOperations(filter) {
    currentFilter = filter;
    
    // Atualizar botões
    document.querySelectorAll('.operations-filter .filter-btn').forEach(btn => {
        btn.classList.remove('active');
    });
    event.target.classList.add('active');
    
    renderOperations();
}

function renderOperations() {
    const container = document.getElementById('operationsList');
    
    let operations = [...userData.operations];
    
    if (currentFilter !== 'all') {
        operations = operations.filter(op => op.type === currentFilter);
    }
    
    // Ordenar por data (mais recente primeiro)
    operations.sort((a, b) => new Date(b.timestamp) - new Date(a.timestamp));
    
    if (operations.length === 0) {
        container.innerHTML = `
            <div class="empty-state">
                <div class="empty-state-icon">📋</div>
                <div class="empty-state-title">Nenhuma operação encontrada</div>
                <div class="empty-state-text">As operações aparecerão aqui</div>
            </div>
        `;
        return;
    }
    
    container.innerHTML = operations.map(op => `
        <div class="operation-card ${op.type}">
            <div class="operation-info">
                <div class="operation-type">${op.type}</div>
                <div class="operation-date">${formatDate(op.date)} - ${op.notes}</div>
            </div>
            <div class="operation-value">${op.type === 'WIN' ? '+' : '-'}${formatCurrency(op.value)}</div>
        </div>
    `).join('');
}

function openOperationsPanel() {
    let operations = [...userData.operations];
    operations.sort((a, b) => new Date(b.timestamp) - new Date(a.timestamp));
    
    let content = `
        <div class="filter-tabs">
            <button class="filter-tab active" onclick="filterOperationsPanel('all')">Todas</button>
            <button class="filter-tab" onclick="filterOperationsPanel('WIN')">Wins</button>
            <button class="filter-tab" onclick="filterOperationsPanel('LOSS')">Losses</button>
        </div>
        <div class="history-list" id="operationsPanelList">
    `;
    
    if (operations.length === 0) {
        content += `
            <div class="empty-state">
                <div class="empty-state-icon">📋</div>
                <div class="empty-state-title">Nenhuma operação encontrada</div>
                <div class="empty-state-text">As operações aparecerão aqui</div>
            </div>
        `;
    } else {
        content += operations.map(op => `
            <div class="history-item">
                <div class="history-item-icon">${op.type === 'WIN' ? '✅' : '❌'}</div>
                <div class="history-item-info">
                    <div class="history-item-type" style="color: ${op.color}">${op.type}</div>
                    <div class="history-item-date">${formatDate(op.date)} - ${op.notes}</div>
                </div>
                <div class="history-item-value" style="color: ${op.color}">${op.type === 'WIN' ? '+' : '-'}${formatCurrency(op.value)}</div>
            </div>
        `).join('');
    }
    
    content += `</div>`;
    
    openBottomPanel('📋 Operações', content);
}

function filterOperationsPanel(filter) {
    // Atualizar botões
    document.querySelectorAll('.bottom-panel .filter-tab').forEach(btn => {
        btn.classList.remove('active');
    });
    event.target.classList.add('active');
    
    let operations = [...userData.operations];
    
    if (filter !== 'all') {
        operations = operations.filter(op => op.type === filter);
    }
    
    operations.sort((a, b) => new Date(b.timestamp) - new Date(a.timestamp));
    
    const container = document.getElementById('operationsPanelList');
    
    if (operations.length === 0) {
        container.innerHTML = `
            <div class="empty-state">
                <div class="empty-state-icon">📋</div>
                <div class="empty-state-title">Nenhuma operação encontrada</div>
                <div class="empty-state-text">As operações aparecerão aqui</div>
            </div>
        `;
    } else {
        container.innerHTML = operations.map(op => `
            <div class="history-item">
                <div class="history-item-icon">${op.type === 'WIN' ? '✅' : '❌'}</div>
                <div class="history-item-info">
                    <div class="history-item-type" style="color: ${op.color}">${op.type}</div>
                    <div class="history-item-date">${formatDate(op.date)} - ${op.notes}</div>
                </div>
                <div class="history-item-value" style="color: ${op.color}">${op.type === 'WIN' ? '+' : '-'}${formatCurrency(op.value)}</div>
            </div>
        `).join('');
    }
}

// ===== FINANCEIRO =====
function loadFinancial() {
    updateFinancialSummary();
    renderFinancialHistory();
    updateFinancialChart();
}

function updateFinancialSummary() {
    const totalDeposits = userData.financial.deposits.reduce((sum, d) => sum + d.value, 0);
    const totalWithdrawals = userData.financial.withdrawals.reduce((sum, w) => sum + w.value, 0);
    const tradingProfit = calculateTradingProfit();
    const availableBalance = totalDeposits - totalWithdrawals + tradingProfit;
    
    document.getElementById('totalDeposits').textContent = formatCurrency(totalDeposits);
    document.getElementById('depositsCount').textContent = `${userData.financial.deposits.length} depósitos`;
    document.getElementById('totalWithdrawals').textContent = formatCurrency(totalWithdrawals);
    document.getElementById('withdrawalsCount').textContent = `${userData.financial.withdrawals.length} saques`;
    document.getElementById('availableBalance').textContent = formatCurrency(availableBalance);
    document.getElementById('balanceStatus').textContent = availableBalance >= 0 ? 'Positivo' : 'Negativo';
    document.getElementById('bettingProfit').textContent = formatCurrency(tradingProfit);
    document.getElementById('bettingInfo').textContent = tradingProfit >= 0 ? 'Lucro' : 'Prejuízo';
}

function calculateTradingProfit() {
    let profit = 0;
    userData.days.forEach(day => {
        day.entries.forEach(entry => {
            if (entry.result === 'win') {
                profit += entry.value;
            } else {
                profit -= entry.value;
            }
        });
    });
    return profit;
}

function openDepositPanel() {
    openBottomPanel('💰 Registrar Depósito', `
        <form onsubmit="addDeposit(event)">
            <div class="form-group">
                <label>💵 Valor (R$)</label>
                <input type="number" id="depositValue" step="0.01" min="0" placeholder="0.00" required>
            </div>
            <div class="form-group">
                <label>📅 Data</label>
                <input type="date" id="depositDate" required>
            </div>
            <div class="form-group">
                <label>💳 Método</label>
                <select id="depositMethod" required>
                    <option value="Pix">Pix</option>
                    <option value="TED">TED</option>
                    <option value="Boleto">Boleto</option>
                    <option value="Cartão">Cartão</option>
                    <option value="Dinheiro">Dinheiro</option>
                </select>
            </div>
            <div class="form-group">
                <label>📝 Observações</label>
                <textarea id="depositNotes" rows="3" placeholder="Opcional"></textarea>
            </div>
            <button type="submit" class="btn btn-success btn-large">Registrar Depósito</button>
        </form>
    `);
    
    document.getElementById('depositDate').value = new Date().toISOString().split('T')[0];
}

function addDeposit(event) {
    event.preventDefault();
    
    const deposit = {
        id: Date.now(),
        type: 'DEPOSIT',
        value: parseFloat(document.getElementById('depositValue').value),
        date: document.getElementById('depositDate').value,
        method: document.getElementById('depositMethod').value,
        notes: document.getElementById('depositNotes').value,
        timestamp: new Date().toISOString()
    };
    
    userData.financial.deposits.push(deposit);
    saveUserData();
    
    closeBottomPanel();
    showNotification('✅ Sucesso', 'Depósito registrado!');
    loadFinancial();
}

function openWithdrawalPanel() {
    openBottomPanel('💸 Registrar Saque', `
        <form onsubmit="addWithdrawal(event)">
            <div class="form-group">
                <label>💵 Valor (R$)</label>
                <input type="number" id="withdrawalValue" step="0.01" min="0" placeholder="0.00" required>
            </div>
            <div class="form-group">
                <label>📅 Data</label>
                <input type="date" id="withdrawalDate" required>
            </div>
            <div class="form-group">
                <label>💳 Método</label>
                <select id="withdrawalMethod" required>
                    <option value="Pix">Pix</option>
                    <option value="TED">TED</option>
                    <option value="Boleto">Boleto</option>
                    <option value="Dinheiro">Dinheiro</option>
                </select>
            </div>
            <div class="form-group">
                <label>📝 Observações</label>
                <textarea id="withdrawalNotes" rows="3" placeholder="Opcional"></textarea>
            </div>
            <button type="submit" class="btn btn-danger btn-large">Registrar Saque</button>
        </form>
    `);
    
    document.getElementById('withdrawalDate').value = new Date().toISOString().split('T')[0];
}

function addWithdrawal(event) {
    event.preventDefault();
    
    const withdrawal = {
        id: Date.now(),
        type: 'WITHDRAWAL',
        value: parseFloat(document.getElementById('withdrawalValue').value),
        date: document.getElementById('withdrawalDate').value,
        method: document.getElementById('withdrawalMethod').value,
        notes: document.getElementById('withdrawalNotes').value,
        timestamp: new Date().toISOString()
    };
    
    userData.financial.withdrawals.push(withdrawal);
    saveUserData();
    
    closeBottomPanel();
    showNotification('✅ Sucesso', 'Saque registrado!');
    loadFinancial();
}

function filterFinancialHistory(filter) {
    // Atualizar botões
    document.querySelectorAll('#financeiro .chart-filters .filter-btn').forEach(btn => {
        btn.classList.remove('active');
    });
    event.target.classList.add('active');
    
    renderFinancialHistory(filter);
}

function renderFinancialHistory(filter = 'all') {
    const container = document.getElementById('financialHistoryList');
    
    let transactions = [
        ...userData.financial.deposits.map(d => ({ ...d, type: 'DEPOSIT' })),
        ...userData.financial.withdrawals.map(w => ({ ...w, type: 'WITHDRAWAL' }))
    ];
    
    if (filter !== 'all') {
        transactions = transactions.filter(t => t.type === filter);
    }
    
    // Ordenar por data (mais recente primeiro)
    transactions.sort((a, b) => new Date(b.timestamp) - new Date(a.timestamp));
    
    if (transactions.length === 0) {
        container.innerHTML = `
            <div class="empty-state">
                <div class="empty-state-icon">📜</div>
                <div class="empty-state-title">Nenhuma movimentação</div>
                <div class="empty-state-text">Registre depósitos e saques</div>
            </div>
        `;
        return;
    }
    
    container.innerHTML = transactions.map(t => `
        <div class="history-item ${t.type}">
            <div class="history-item-info">
                <div class="history-item-type">${t.type === 'DEPOSIT' ? '💰 Depósito' : '💸 Saque'}</div>
                <div class="history-item-date">${formatDate(t.date)} - ${t.method}</div>
            </div>
            <div class="history-item-value">${t.type === 'DEPOSIT' ? '+' : '-'}${formatCurrency(t.value)}</div>
        </div>
    `).join('');
}

function filterFinancialChart(days) {
    // Atualizar botões
    document.querySelectorAll('#financeiro .chart-card:first-of-type .filter-btn').forEach(btn => {
        btn.classList.remove('active');
    });
    event.target.classList.add('active');
    
    updateFinancialChart(days);
}

function updateFinancialChart(days = 'all') {
    const ctx = document.getElementById('financialChart');
    
    if (charts.financial) {
        charts.financial.destroy();
    }
    
    let transactions = [
        ...userData.financial.deposits.map(d => ({ ...d, type: 'DEPOSIT' })),
        ...userData.financial.withdrawals.map(w => ({ ...w, type: 'WITHDRAWAL' }))
    ];
    
    // Filtrar por período
    if (days !== 'all') {
        const daysAgo = new Date();
        daysAgo.setDate(daysAgo.getDate() - parseInt(days));
        transactions = transactions.filter(t => new Date(t.date) >= daysAgo);
    }
    
    // Agrupar por data
    const grouped = {};
    transactions.forEach(t => {
        if (!grouped[t.date]) {
            grouped[t.date] = { deposits: 0, withdrawals: 0 };
        }
        if (t.type === 'DEPOSIT') {
            grouped[t.date].deposits += t.value;
        } else {
            grouped[t.date].withdrawals += t.value;
        }
    });
    
    const dates = Object.keys(grouped).sort();
    const deposits = dates.map(d => grouped[d].deposits);
    const withdrawals = dates.map(d => grouped[d].withdrawals);
    
    charts.financial = new Chart(ctx, {
        type: 'bar',
        data: {
            labels: dates.map(d => formatDate(d)),
            datasets: [
                {
                    label: 'Depósitos',
                    data: deposits,
                    backgroundColor: 'rgba(0, 255, 136, 0.5)',
                    borderColor: 'rgba(0, 255, 136, 1)',
                    borderWidth: 2
                },
                {
                    label: 'Saques',
                    data: withdrawals,
                    backgroundColor: 'rgba(255, 0, 85, 0.5)',
                    borderColor: 'rgba(255, 0, 85, 1)',
                    borderWidth: 2
                }
            ]
        },
        options: {
            responsive: true,
            maintainAspectRatio: false,
            plugins: {
                legend: {
                    labels: { color: '#FFFFFF' }
                }
            },
            scales: {
                y: {
                    beginAtZero: true,
                    ticks: { color: '#A0A0B8' },
                    grid: { color: 'rgba(255, 255, 255, 0.1)' }
                },
                x: {
                    ticks: { color: '#A0A0B8' },
                    grid: { color: 'rgba(255, 255, 255, 0.1)' }
                }
            }
        }
    });
}

// ===== GRÁFICOS =====
function loadCharts() {
    updateBankEvolutionChart();
    updateWinRateChart();
    updatePeriodChart();
}

function updateBankEvolutionChart() {
    const ctx = document.getElementById('bankEvolutionChart');
    
    if (charts.bankEvolution) {
        charts.bankEvolution.destroy();
    }
    
    // Calcular evolução da banca por dia
    const sortedDays = [...userData.days].sort((a, b) => new Date(a.date) - new Date(b.date));
    
    let runningTotal = userData.setup.initialBank;
    const evolution = [{ date: 'Inicial', value: runningTotal }];
    
    sortedDays.forEach(day => {
        day.entries.forEach(entry => {
            if (entry.result === 'win') {
                runningTotal += entry.value;
            } else {
                runningTotal -= entry.value;
            }
        });
        evolution.push({ date: day.date, value: runningTotal });
    });
    
    charts.bankEvolution = new Chart(ctx, {
        type: 'line',
        data: {
            labels: evolution.map(e => e.date === 'Inicial' ? e.date : formatDate(e.date)),
            datasets: [{
                label: 'Banca',
                data: evolution.map(e => e.value),
                borderColor: 'rgba(0, 224, 255, 1)',
                backgroundColor: 'rgba(0, 224, 255, 0.1)',
                borderWidth: 3,
                tension: 0.4,
                fill: true
            }]
        },
        options: {
            responsive: true,
            maintainAspectRatio: false,
            plugins: {
                legend: {
                    labels: { color: '#FFFFFF' }
                }
            },
            scales: {
                y: {
                    beginAtZero: false,
                    ticks: { color: '#A0A0B8' },
                    grid: { color: 'rgba(255, 255, 255, 0.1)' }
                },
                x: {
                    ticks: { color: '#A0A0B8' },
                    grid: { color: 'rgba(255, 255, 255, 0.1)' }
                }
            }
        }
    });
}

function updateWinRateChart() {
    const ctx = document.getElementById('winRateChart');
    
    if (charts.winRate) {
        charts.winRate.destroy();
    }
    
    let wins = 0;
    let losses = 0;
    
    userData.days.forEach(day => {
        day.entries.forEach(entry => {
            if (entry.result === 'win') {
                wins++;
            } else {
                losses++;
            }
        });
    });
    
    charts.winRate = new Chart(ctx, {
        type: 'doughnut',
        data: {
            labels: ['Wins', 'Losses'],
            datasets: [{
                data: [wins, losses],
                backgroundColor: [
                    'rgba(0, 255, 136, 0.8)',
                    'rgba(255, 0, 85, 0.8)'
                ],
                borderColor: [
                    'rgba(0, 255, 136, 1)',
                    'rgba(255, 0, 85, 1)'
                ],
                borderWidth: 2
            }]
        },
        options: {
            responsive: true,
            maintainAspectRatio: false,
            plugins: {
                legend: {
                    position: 'bottom',
                    labels: { color: '#FFFFFF' }
                }
            }
        }
    });
}

function updatePeriodChart() {
    const ctx = document.getElementById('periodChart');
    
    if (charts.period) {
        charts.period.destroy();
    }
    
    const periods = { morning: 0, afternoon: 0, night: 0 };
    const periodWins = { morning: 0, afternoon: 0, night: 0 };
    
    userData.days.forEach(day => {
        day.entries.forEach(entry => {
            periods[entry.period]++;
            if (entry.result === 'win') {
                periodWins[entry.period]++;
            }
        });
    });
    
    const periodLabels = ['Manhã', 'Tarde', 'Noite'];
    const winRates = ['morning', 'afternoon', 'night'].map(p => 
        periods[p] > 0 ? ((periodWins[p] / periods[p]) * 100).toFixed(1) : 0
    );
    
    charts.period = new Chart(ctx, {
        type: 'bar',
        data: {
            labels: periodLabels,
            datasets: [{
                label: 'Win Rate (%)',
                data: winRates,
                backgroundColor: 'rgba(157, 0, 255, 0.5)',
                borderColor: 'rgba(157, 0, 255, 1)',
                borderWidth: 2
            }]
        },
        options: {
            responsive: true,
            maintainAspectRatio: false,
            plugins: {
                legend: {
                    labels: { color: '#FFFFFF' }
                }
            },
            scales: {
                y: {
                    beginAtZero: true,
                    max: 100,
                    ticks: { color: '#A0A0B8' },
                    grid: { color: 'rgba(255, 255, 255, 0.1)' }
                },
                x: {
                    ticks: { color: '#A0A0B8' },
                    grid: { color: 'rgba(255, 255, 255, 0.1)' }
                }
            }
        }
    });
}

// ===== BOTTOM PANEL =====
function openBottomPanel(title, content) {
    document.getElementById('bottomPanelTitle').textContent = title;
    document.getElementById('bottomPanelContent').innerHTML = content;
    document.getElementById('bottomPanelOverlay').classList.add('active');
    document.getElementById('bottomPanel').classList.add('active');
}

function closeBottomPanel() {
    document.getElementById('bottomPanelOverlay').classList.remove('active');
    document.getElementById('bottomPanel').classList.remove('active');
}

// ===== EXPORTAR EXCEL =====
function exportToExcel() {
    // Criar workbook
    const wb = XLSX.utils.book_new();
    
    // Aba 1: Resumo
    const summary = [
        ['TRADING PRO - RESUMO GERAL'],
        [],
        ['Banca Inicial', formatCurrency(userData.setup.initialBank)],
        ['Banca Atual', formatCurrency(calculateCurrentBank())],
        ['Meta (%)', userData.setup.metaPercent + '%'],
        ['Stop Loss (%)', userData.setup.stopPercent + '%'],
        [],
        ['Total de Dias', userData.days.length],
        ['Total de Operações', userData.operations.length],
        ['Total de Wins', userData.operations.filter(o => o.type === 'WIN').length],
        ['Total de Losses', userData.operations.filter(o => o.type === 'LOSS').length],
        []
    ];
    
    const ws1 = XLSX.utils.aoa_to_sheet(summary);
    XLSX.utils.book_append_sheet(wb, ws1, 'Resumo');
    
    // Aba 2: Operações
    const operationsData = [
        ['Tipo', 'Data', 'Valor', 'Categoria', 'Observações']
    ];
    
    userData.operations.forEach(op => {
        operationsData.push([
            op.type,
            formatDate(op.date),
            formatCurrency(op.value),
            op.category,
            op.notes
        ]);
    });
    
    const ws2 = XLSX.utils.aoa_to_sheet(operationsData);
    XLSX.utils.book_append_sheet(wb, ws2, 'Operações');
    
    // Aba 3: Dias
    const daysData = [
        ['Data', 'Entradas', 'Wins', 'Losses', 'Win Rate', 'Resultado']
    ];
    
    userData.days.forEach(day => {
        const stats = calculateDayStats(day);
        daysData.push([
            formatDate(day.date),
            stats.total,
            stats.wins,
            stats.losses,
            stats.winRate + '%',
            formatCurrency(stats.result)
        ]);
    });
    
    const ws3 = XLSX.utils.aoa_to_sheet(daysData);
    XLSX.utils.book_append_sheet(wb, ws3, 'Dias');
    
    // Salvar arquivo
    XLSX.writeFile(wb, `trading-pro-${new Date().toISOString().split('T')[0]}.xlsx`);
    
    showNotification('✅ Sucesso', 'Excel exportado com sucesso!');
}

// ===== UTILIDADES =====
function generateId() {
    return Date.now().toString(36) + Math.random().toString(36).substr(2);
}

function formatCurrency(value) {
    return new Intl.NumberFormat('pt-BR', {
        style: 'currency',
        currency: 'BRL'
    }).format(value);
}

function formatDate(dateString) {
    const date = new Date(dateString + 'T00:00:00');
    return date.toLocaleDateString('pt-BR', { 
        day: '2-digit', 
        month: '2-digit', 
        year: 'numeric' 
    });
}

function getPeriodName(period) {
    const names = {
        morning: 'Manhã',
        afternoon: 'Tarde',
        night: 'Noite'
    };
    return names[period] || period;
}

// ===== PERSONAL BILLS MANAGEMENT =====

// Categorias de contas com ícones
const billCategories = {
    'agua': { name: 'Água', icon: '💧', color: '#00E0FF' },
    'luz': { name: 'Luz', icon: '💡', color: '#FFD700' },
    'aluguel': { name: 'Aluguel', icon: '🏠', color: '#FF6B6B' },
    'internet': { name: 'Internet', icon: '📡', color: '#9D00FF' },
    'telefone': { name: 'Telefone', icon: '📱', color: '#00FF88' },
    'mercado': { name: 'Mercado', icon: '🛒', color: '#FF9500' },
    'gasolina': { name: 'Gasolina', icon: '⛽', color: '#D4AF37' },
    'academia': { name: 'Academia', icon: '🏋️', color: '#FF0055' },
    'saude': { name: 'Saúde', icon: '🏥', color: '#00FFB8' },
    'educacao': { name: 'Educação', icon: '📚', color: '#7B68EE' },
    'transporte': { name: 'Transporte', icon: '🚗', color: '#4169E1' },
    'lazer': { name: 'Lazer', icon: '🎮', color: '#FF1493' },
    'outro': { name: 'Outro', icon: '📝', color: '#A0A0B8' }
};

// Alternar entre abas de Trading e Pessoal
function switchFinancialTab(tab) {
    // Atualizar botões das abas
    document.querySelectorAll('.tab-btn').forEach(btn => {
        btn.classList.remove('active');
    });
    event.target.classList.add('active');
    
    // Atualizar conteúdo
    document.querySelectorAll('.tab-content').forEach(content => {
        content.classList.remove('active');
    });
    
    if (tab === 'trading') {
        document.getElementById('tradingTab').classList.add('active');
    } else if (tab === 'personal') {
        document.getElementById('personalTab').classList.add('active');
        loadPersonalBills();
    }
}

// Carregar e exibir contas pessoais
function loadPersonalBills() {
    updatePersonalBillsSummary();
    renderPersonalBills();
    renderCalendar();
    checkBillReminders();
}

// Atualizar resumo das contas
function updatePersonalBillsSummary() {
    if (!userData.personalBills) {
        userData.personalBills = [];
    }
    
    const currentMonth = new Date().getMonth();
    const currentYear = new Date().getFullYear();
    
    const totalBills = userData.personalBills.length;
    const overdueBills = userData.personalBills.filter(bill => 
        bill.status === 'pending' && new Date(bill.dueDate) < new Date()
    );
    const upcomingBills = userData.personalBills.filter(bill => {
        const dueDate = new Date(bill.dueDate);
        const today = new Date();
        const diffDays = Math.ceil((dueDate - today) / (1000 * 60 * 60 * 24));
        return bill.status === 'pending' && diffDays >= 0 && diffDays <= 7;
    });
    const paidBills = userData.personalBills.filter(bill => {
        const billDate = new Date(bill.dueDate);
        return bill.status === 'paid' && 
               billDate.getMonth() === currentMonth && 
               billDate.getFullYear() === currentYear;
    });
    
    const pendingBills = userData.personalBills.filter(b => b.status === 'pending').length;
    
    // Calcular totais
    const overdueAmount = overdueBills.reduce((sum, bill) => sum + bill.value, 0);
    const upcomingAmount = upcomingBills.reduce((sum, bill) => sum + bill.value, 0);
    const paidAmount = paidBills.reduce((sum, bill) => sum + bill.value, 0);
    
    // Atualizar elementos
    document.getElementById('totalBillsCount').textContent = totalBills;
    document.getElementById('billsBreakdown').textContent = 
        `${pendingBills} pendente${pendingBills !== 1 ? 's' : ''}, ${paidBills.length} paga${paidBills.length !== 1 ? 's' : ''}`;
    
    document.getElementById('overdueBillsCount').textContent = overdueBills.length;
    document.getElementById('overdueAmount').textContent = formatCurrency(overdueAmount);
    
    document.getElementById('upcomingBillsCount').textContent = upcomingBills.length;
    document.getElementById('upcomingAmount').textContent = formatCurrency(upcomingAmount);
    
    document.getElementById('paidBillsCount').textContent = paidBills.length;
    document.getElementById('paidAmount').textContent = formatCurrency(paidAmount);
}

// Renderizar lista de contas
let currentBillFilter = 'all';

function renderPersonalBills(filter = currentBillFilter) {
    currentBillFilter = filter;
    const container = document.getElementById('billsList');
    
    if (!userData.personalBills || userData.personalBills.length === 0) {
        container.innerHTML = `
            <div class="empty-state">
                <div class="empty-state-icon">📝</div>
                <h3>Nenhuma conta cadastrada</h3>
                <p>Adicione suas contas pessoais para gerenciar seus pagamentos</p>
            </div>
        `;
        return;
    }
    
    // Filtrar contas
    let filteredBills = userData.personalBills;
    
    if (filter === 'pending') {
        filteredBills = userData.personalBills.filter(b => 
            b.status === 'pending' && new Date(b.dueDate) >= new Date()
        );
    } else if (filter === 'overdue') {
        filteredBills = userData.personalBills.filter(b => 
            b.status === 'pending' && new Date(b.dueDate) < new Date()
        );
    } else if (filter === 'paid') {
        filteredBills = userData.personalBills.filter(b => b.status === 'paid');
    }
    
    // Ordenar por data de vencimento
    filteredBills.sort((a, b) => new Date(a.dueDate) - new Date(b.dueDate));
    
    if (filteredBills.length === 0) {
        container.innerHTML = `
            <div class="empty-state">
                <div class="empty-state-icon">✓</div>
                <h3>Nenhuma conta ${filter === 'paid' ? 'paga' : filter === 'overdue' ? 'vencida' : 'pendente'}</h3>
            </div>
        `;
        return;
    }
    
    container.innerHTML = filteredBills.map(bill => {
        const category = billCategories[bill.category] || billCategories['outro'];
        const dueDate = new Date(bill.dueDate);
        const today = new Date();
        const diffDays = Math.ceil((dueDate - today) / (1000 * 60 * 60 * 24));
        
        let statusClass = 'pending';
        let statusText = 'Pendente';
        let cardClass = '';
        
        if (bill.status === 'paid') {
            statusClass = 'paid';
            statusText = 'Paga';
            cardClass = 'paid';
        } else if (diffDays < 0) {
            statusClass = 'overdue';
            statusText = 'Vencida';
            cardClass = 'overdue';
        } else if (diffDays <= 3) {
            statusClass = 'due-soon';
            statusText = `Vence em ${diffDays} dia${diffDays !== 1 ? 's' : ''}`;
            cardClass = 'due-soon';
        }
        
        return `
            <div class="bill-card ${cardClass}">
                ${diffDays >= 0 && diffDays <= 3 && bill.status === 'pending' ? '<div class="reminder-badge">!</div>' : ''}
                <div class="bill-header">
                    <div class="bill-info">
                        <div class="bill-category">
                            <span>${category.icon}</span>
                            <span>${category.name}</span>
                        </div>
                        <div class="bill-name">${bill.name}</div>
                        <div class="bill-value">${formatCurrency(bill.value)}</div>
                    </div>
                </div>
                
                ${bill.notes ? `<div style="color: var(--text-secondary); font-size: 0.9rem; margin: 0.75rem 0;">💬 ${bill.notes}</div>` : ''}
                
                <div class="bill-footer">
                    <div class="bill-due-date">
                        📅 Vencimento: ${formatDate(bill.dueDate)}
                    </div>
                    <div class="bill-status ${statusClass}">${statusText}</div>
                </div>
                
                <div class="bill-actions">
                    ${bill.status === 'pending' ? 
                        `<button class="bill-action-btn" onclick="markBillAsPaid('${bill.id}')">✓ Pagar</button>` : 
                        `<button class="bill-action-btn" onclick="markBillAsPending('${bill.id}')">↩ Desfazer</button>`
                    }
                    <button class="bill-action-btn" onclick="editBill('${bill.id}')">✏️ Editar</button>
                    <button class="bill-action-btn danger" onclick="deleteBill('${bill.id}')">🗑️ Excluir</button>
                </div>
            </div>
        `;
    }).join('');
}

// Filtrar contas
function filterBills(filter) {
    // Atualizar botões
    document.querySelectorAll('#personalTab .filter-btn').forEach(btn => {
        btn.classList.remove('active');
    });
    event.target.classList.add('active');
    
    renderPersonalBills(filter);
}

// Abrir painel para adicionar conta
function openAddBillPanel() {
    const categoriesHTML = Object.keys(billCategories).map(key => {
        const cat = billCategories[key];
        return `<option value="${key}">${cat.icon} ${cat.name}</option>`;
    }).join('');
    
    const content = `
        <form onsubmit="addBill(event)" style="max-width: 600px; margin: 0 auto;">
            <div class="form-group">
                <label>📝 Nome da Conta</label>
                <input type="text" id="billName" placeholder="Ex: Conta de Luz - Dezembro" required>
            </div>
            
            <div class="form-group">
                <label>📂 Categoria</label>
                <select id="billCategory" required>
                    ${categoriesHTML}
                </select>
            </div>
            
            <div class="form-group">
                <label>💵 Valor (R$)</label>
                <input type="number" id="billValue" step="0.01" min="0" placeholder="0.00" required>
            </div>
            
            <div class="form-group">
                <label>📅 Data de Vencimento</label>
                <input type="date" id="billDueDate" required>
            </div>
            
            <div class="form-group">
                <label>📝 Observações (Opcional)</label>
                <textarea id="billNotes" rows="3" placeholder="Adicione detalhes sobre a conta..."></textarea>
            </div>
            
            <div class="form-group">
                <label style="display: flex; align-items: center; gap: 0.5rem; cursor: pointer;">
                    <input type="checkbox" id="billRecurring" style="width: auto;">
                    <span>🔄 Conta Recorrente (todo mês)</span>
                </label>
            </div>
            
            <button type="submit" class="btn btn-success btn-large">Adicionar Conta</button>
        </form>
    `;
    
    openBottomPanel('📝 Adicionar Conta Pessoal', content);
    
    // Definir data padrão como hoje
    document.getElementById('billDueDate').valueAsDate = new Date();
}

// Adicionar conta
function addBill(event) {
    event.preventDefault();
    
    const name = document.getElementById('billName').value;
    const category = document.getElementById('billCategory').value;
    const value = parseFloat(document.getElementById('billValue').value);
    const dueDate = document.getElementById('billDueDate').value;
    const notes = document.getElementById('billNotes').value;
    const recurring = document.getElementById('billRecurring').checked;
    
    const bill = {
        id: generateId(),
        name,
        category,
        value,
        dueDate,
        notes,
        recurring,
        status: 'pending',
        createdAt: new Date().toISOString()
    };
    
    if (!userData.personalBills) {
        userData.personalBills = [];
    }
    
    userData.personalBills.push(bill);
    saveUserData();
    
    closeBottomPanel();
    loadPersonalBills();
    showNotification('✅ Sucesso', 'Conta adicionada com sucesso!');
}

// Marcar conta como paga
function markBillAsPaid(billId) {
    const bill = userData.personalBills.find(b => b.id === billId);
    if (!bill) return;
    
    bill.status = 'paid';
    bill.paidAt = new Date().toISOString();
    
    // Se for recorrente, criar próxima conta
    if (bill.recurring) {
        const nextDueDate = new Date(bill.dueDate);
        nextDueDate.setMonth(nextDueDate.getMonth() + 1);
        
        const nextBill = {
            ...bill,
            id: generateId(),
            dueDate: nextDueDate.toISOString().split('T')[0],
            status: 'pending',
            createdAt: new Date().toISOString(),
            paidAt: null
        };
        
        userData.personalBills.push(nextBill);
        showNotification('🔄 Conta Recorrente', 'Próxima conta criada automaticamente!', 'info');
    }
    
    saveUserData();
    loadPersonalBills();
    showNotification('✅ Pago', 'Conta marcada como paga!');
}

// Marcar conta como pendente
function markBillAsPending(billId) {
    const bill = userData.personalBills.find(b => b.id === billId);
    if (!bill) return;
    
    bill.status = 'pending';
    bill.paidAt = null;
    
    saveUserData();
    loadPersonalBills();
    showNotification('↩ Desfeito', 'Conta marcada como pendente novamente!', 'info');
}

// Editar conta
function editBill(billId) {
    const bill = userData.personalBills.find(b => b.id === billId);
    if (!bill) return;
    
    const categoriesHTML = Object.keys(billCategories).map(key => {
        const cat = billCategories[key];
        const selected = key === bill.category ? 'selected' : '';
        return `<option value="${key}" ${selected}>${cat.icon} ${cat.name}</option>`;
    }).join('');
    
    const content = `
        <form onsubmit="updateBill(event, '${billId}')" style="max-width: 600px; margin: 0 auto;">
            <div class="form-group">
                <label>📝 Nome da Conta</label>
                <input type="text" id="editBillName" value="${bill.name}" required>
            </div>
            
            <div class="form-group">
                <label>📂 Categoria</label>
                <select id="editBillCategory" required>
                    ${categoriesHTML}
                </select>
            </div>
            
            <div class="form-group">
                <label>💵 Valor (R$)</label>
                <input type="number" id="editBillValue" step="0.01" min="0" value="${bill.value}" required>
            </div>
            
            <div class="form-group">
                <label>📅 Data de Vencimento</label>
                <input type="date" id="editBillDueDate" value="${bill.dueDate}" required>
            </div>
            
            <div class="form-group">
                <label>📝 Observações (Opcional)</label>
                <textarea id="editBillNotes" rows="3">${bill.notes || ''}</textarea>
            </div>
            
            <div class="form-group">
                <label style="display: flex; align-items: center; gap: 0.5rem; cursor: pointer;">
                    <input type="checkbox" id="editBillRecurring" ${bill.recurring ? 'checked' : ''} style="width: auto;">
                    <span>🔄 Conta Recorrente (todo mês)</span>
                </label>
            </div>
            
            <button type="submit" class="btn btn-success btn-large">Salvar Alterações</button>
        </form>
    `;
    
    openBottomPanel('✏️ Editar Conta', content);
}

// Atualizar conta
function updateBill(event, billId) {
    event.preventDefault();
    
    const bill = userData.personalBills.find(b => b.id === billId);
    if (!bill) return;
    
    bill.name = document.getElementById('editBillName').value;
    bill.category = document.getElementById('editBillCategory').value;
    bill.value = parseFloat(document.getElementById('editBillValue').value);
    bill.dueDate = document.getElementById('editBillDueDate').value;
    bill.notes = document.getElementById('editBillNotes').value;
    bill.recurring = document.getElementById('editBillRecurring').checked;
    
    saveUserData();
    closeBottomPanel();
    loadPersonalBills();
    showNotification('✅ Atualizado', 'Conta atualizada com sucesso!');
}

// Excluir conta
function deleteBill(billId) {
    if (!confirm('Tem certeza que deseja excluir esta conta?')) return;
    
    userData.personalBills = userData.personalBills.filter(b => b.id !== billId);
    saveUserData();
    loadPersonalBills();
    showNotification('🗑️ Excluído', 'Conta removida com sucesso!');
}

// Verificar lembretes de contas próximas ao vencimento
function checkBillReminders() {
    if (!userData.personalBills) return;
    
    const today = new Date();
    const upcomingBills = userData.personalBills.filter(bill => {
        if (bill.status !== 'pending') return false;
        
        const dueDate = new Date(bill.dueDate);
        const diffDays = Math.ceil((dueDate - today) / (1000 * 60 * 60 * 24));
        
        return diffDays >= 0 && diffDays <= 3;
    });
    
    if (upcomingBills.length > 0) {
        const billsText = upcomingBills.length === 1 
            ? upcomingBills[0].name 
            : `${upcomingBills.length} contas`;
        
        showNotification(
            '⚠️ Lembrete de Pagamento', 
            `Você tem ${billsText} vencendo nos próximos 3 dias!`,
            'info'
        );
    }
}

// ===== CALENDAR FUNCTIONS =====

// Renderizar calendário
function renderCalendar() {
    const year = currentCalendarDate.getFullYear();
    const month = currentCalendarDate.getMonth();
    
    // Atualizar título
    const monthNames = [
        'Janeiro', 'Fevereiro', 'Março', 'Abril', 'Maio', 'Junho',
        'Julho', 'Agosto', 'Setembro', 'Outubro', 'Novembro', 'Dezembro'
    ];
    document.getElementById('calendarMonthYear').textContent = `${monthNames[month]} ${year}`;
    
    // Obter primeiro e último dia do mês
    const firstDay = new Date(year, month, 1);
    const lastDay = new Date(year, month + 1, 0);
    
    // Obter dia da semana do primeiro dia (0 = domingo, ajustar para segunda = 0)
    let startingDayOfWeek = firstDay.getDay() - 1;
    if (startingDayOfWeek === -1) startingDayOfWeek = 6; // Domingo vira 6
    
    // Calcular dias do mês anterior a mostrar
    const prevMonthLastDay = new Date(year, month, 0).getDate();
    
    const grid = document.getElementById('calendarGrid');
    grid.innerHTML = '';
    
    // Adicionar cabeçalhos dos dias da semana
    const weekdays = ['Seg', 'Ter', 'Qua', 'Qui', 'Sex', 'Sáb', 'Dom'];
    weekdays.forEach(day => {
        const weekdayEl = document.createElement('div');
        weekdayEl.className = 'calendar-weekday';
        weekdayEl.textContent = day;
        grid.appendChild(weekdayEl);
    });
    
    // Adicionar dias do mês anterior
    for (let i = startingDayOfWeek - 1; i >= 0; i--) {
        const dayNum = prevMonthLastDay - i;
        const dayEl = createCalendarDay(dayNum, year, month - 1, true);
        grid.appendChild(dayEl);
    }
    
    // Adicionar dias do mês atual
    const today = new Date();
    for (let day = 1; day <= lastDay.getDate(); day++) {
        const isToday = 
            day === today.getDate() && 
            month === today.getMonth() && 
            year === today.getFullYear();
        
        const dayEl = createCalendarDay(day, year, month, false, isToday);
        grid.appendChild(dayEl);
    }
    
    // Adicionar dias do próximo mês para completar a grade
    const remainingDays = 42 - grid.children.length + 7; // 42 = 6 semanas * 7 dias, +7 pelos headers
    for (let day = 1; day <= remainingDays; day++) {
        const dayEl = createCalendarDay(day, year, month + 1, true);
        grid.appendChild(dayEl);
    }
}

// Criar elemento de dia do calendário
function createCalendarDay(dayNum, year, month, isOtherMonth, isToday = false) {
    const dayEl = document.createElement('div');
    dayEl.className = 'calendar-day';
    
    if (isOtherMonth) {
        dayEl.classList.add('other-month');
    }
    
    if (isToday) {
        dayEl.classList.add('today');
    }
    
    // Criar data para este dia
    const date = new Date(year, month, dayNum);
    const dateString = date.toISOString().split('T')[0];
    
    // Número do dia
    const numberEl = document.createElement('div');
    numberEl.className = 'calendar-day-number';
    numberEl.textContent = dayNum;
    dayEl.appendChild(numberEl);
    
    // Contas do dia
    const billsContainer = document.createElement('div');
    billsContainer.className = 'calendar-day-bills';
    
    if (!isOtherMonth && userData.personalBills) {
        const dayBills = userData.personalBills.filter(bill => bill.dueDate === dateString);
        
        if (dayBills.length > 0) {
            // Mostrar até 3 barrinhas
            const billsToShow = dayBills.slice(0, 3);
            const today = new Date();
            
            billsToShow.forEach(bill => {
                const billDot = document.createElement('div');
                billDot.className = 'calendar-bill-dot';
                
                if (bill.status === 'paid') {
                    billDot.classList.add('paid');
                } else {
                    const dueDate = new Date(bill.dueDate);
                    const diffDays = Math.ceil((dueDate - today) / (1000 * 60 * 60 * 24));
                    
                    if (diffDays < 0) {
                        billDot.classList.add('overdue');
                    } else if (diffDays <= 3) {
                        billDot.classList.add('due-soon');
                    } else {
                        billDot.classList.add('pending');
                    }
                }
                
                billsContainer.appendChild(billDot);
            });
            
            // Se tiver mais de 3, mostrar contador
            if (dayBills.length > 3) {
                const countEl = document.createElement('div');
                countEl.className = 'calendar-bill-count';
                countEl.textContent = dayBills.length;
                dayEl.appendChild(countEl);
            }
        }
    }
    
    dayEl.appendChild(billsContainer);
    
    // Click handler
    if (!isOtherMonth) {
        dayEl.onclick = () => showDayBills(dateString, dayNum, month, year);
    }
    
    return dayEl;
}

// Mostrar contas do dia
function showDayBills(dateString, day, month, year) {
    const popup = document.getElementById('calendarPopup');
    const dayBills = userData.personalBills ? 
        userData.personalBills.filter(bill => bill.dueDate === dateString) : [];
    
    if (dayBills.length === 0) {
        showNotification('📅 Sem contas', `Nenhuma conta cadastrada para ${day}/${month + 1}/${year}`, 'info');
        return;
    }
    
    // Atualizar data do popup
    const monthNames = [
        'Janeiro', 'Fevereiro', 'Março', 'Abril', 'Maio', 'Junho',
        'Julho', 'Agosto', 'Setembro', 'Outubro', 'Novembro', 'Dezembro'
    ];
    document.getElementById('popupDate').textContent = 
        `📅 ${day} de ${monthNames[month]} de ${year}`;
    
    // Renderizar lista de contas
    const billsList = document.getElementById('popupBillsList');
    const today = new Date();
    
    billsList.innerHTML = dayBills.map(bill => {
        const category = billCategories[bill.category] || billCategories['outro'];
        const dueDate = new Date(bill.dueDate);
        const diffDays = Math.ceil((dueDate - today) / (1000 * 60 * 60 * 24));
        
        let billColor = 'var(--primary-cyan)';
        let statusText = 'Pendente';
        
        if (bill.status === 'paid') {
            billColor = 'var(--primary-green)';
            statusText = 'Paga ✓';
        } else if (diffDays < 0) {
            billColor = 'var(--primary-red)';
            statusText = 'Vencida!';
        } else if (diffDays <= 3) {
            billColor = 'var(--primary-orange)';
            statusText = `Vence em ${diffDays} dia${diffDays !== 1 ? 's' : ''}`;
        }
        
        return `
            <div class="popup-bill-item" style="--bill-color: ${billColor};">
                <div class="popup-bill-info">
                    <div class="popup-bill-name">
                        ${category.icon} ${bill.name}
                    </div>
                    <div class="popup-bill-category">${statusText}</div>
                    ${bill.notes ? `<div style="font-size: 0.8rem; color: var(--text-secondary); margin-top: 0.25rem;">💬 ${bill.notes}</div>` : ''}
                </div>
                <div class="popup-bill-value" style="color: ${billColor};">
                    ${formatCurrency(bill.value)}
                </div>
            </div>
        `;
    }).join('');
    
    // Posicionar popup no centro da tela
    popup.style.display = 'block';
    popup.style.position = 'fixed';
    popup.style.top = '50%';
    popup.style.left = '50%';
    popup.style.transform = 'translate(-50%, -50%)';
    popup.classList.add('show');
}

// Fechar popup
function closeCalendarPopup() {
    const popup = document.getElementById('calendarPopup');
    popup.classList.remove('show');
    setTimeout(() => {
        popup.style.display = 'none';
    }, 300);
}

// Navegar para mês anterior
function previousMonth() {
    currentCalendarDate.setMonth(currentCalendarDate.getMonth() - 1);
    renderCalendar();
}

// Navegar para próximo mês
function nextMonth() {
    currentCalendarDate.setMonth(currentCalendarDate.getMonth() + 1);
    renderCalendar();
}

// Voltar para hoje
function goToToday() {
    currentCalendarDate = new Date();
    renderCalendar();
}
