// ============================================
// PFMS FRONTEND JAVASCRIPT - COMPLETE FIXED
// ============================================

const API_URL = 'https://api.fairox.co.in/api/pfms';
const PFMS_API_URL = 'https://api.fairox.co.in/api/pfms';
const RECURRING_API_URL = 'https://api.fairox.co.in/api/recurring';
const BUDGET_API_URL = 'https://api.fairox.co.in/api/budget';

// ✅ Checks multiple keys like admin page does
function getAuthToken() {
    const token = localStorage.getItem('authToken') ||      // Check admin token
                 localStorage.getItem('token') ||            // Check user token
                 sessionStorage.getItem('token');             // Check session token
    
    if (!token || !token.startsWith('eyJ')) return null;
    return token;
}


let allTransactions = [];
let allAccounts = [];
let allCategories = [];
let currentPage = 1;
let privacyMode = localStorage.getItem('pfmsPrivacyMode') === 'true';
let statsData = {};

document.addEventListener('DOMContentLoaded', () => {
    const authToken = getAuthToken();
    if (!authToken) {
        alert('Please login first!');
        window.location.href = '/index.html';
        return;
    }


    initPrivacyMode();
    document.getElementById('transactionDate').valueAsDate = new Date();
    loadInitialData();
    
    document.getElementById('currency').addEventListener('change', () => {
        loadAccounts();
        updateAmountLabel();
    });
    document.getElementById('mode').addEventListener('change', loadCategories);
    document.getElementById('transactionForm').addEventListener('submit', addTransaction);
    
    setTimeout(() => {
        console.log('⏳ Initializing recurring transactions...');
        loadAccountsForRecurring();
        loadCategoriesForRecurring();
        loadRecurringTransactions();
        console.log('✅ Recurring transactions initialized!');
    }, 500);


    if (localStorage.getItem('pfmsTheme') === 'dark') {
        document.body.classList.add('dark-mode');
    }

    // ✅ Initialize Budget - COMBINED CALCULATION
    setTimeout(() => {
        console.log('⏳ Initializing budget...');
        loadBudgetCategories();      // Load unique categories (no duplicates, no undefined)
        loadBudgetStatus();          // Load combined budget status (all payment modes combined)
        console.log('✅ Budget initialized');
    }, 600);
});

// ✅ API CALL - FIXED
async function apiCall(url, options = {}) {
    try {
        const token = getAuthToken();
        if (!token) {
            console.error('❌ No token');
            showMessage('❌ Please login first', 'error');
            window.location.href = '/index.html';
            return null;
        }

        const headers = {
            'Authorization': `Bearer ${token}`,
            'Content-Type': 'application/json',
            ...options.headers
        };

        console.log('🔐 API Call:', url);

        const response = await fetch(`${API_URL}${url}`, {
            ...options,
            headers
        });

        const data = await response.json();

        if (response.status === 401) {
            console.error('❌ Token expired');
            localStorage.clear();
            window.location.href = '/index.html';
            return null;
        }

        if (!response.ok) {
            showMessage(`❌ ${data.message}`, 'error');
            return null;
        }

        console.log('✅ Success');
        return data;

    } catch (error) {
        console.error('❌ API Error:', error);
        showMessage('❌ Connection error', 'error');
        return null;
    }
}

// ============================================
// UI HELPER FUNCTIONS
// ============================================

function showMessage(message, type = 'success') {
    const msgEl = document.getElementById('message');
    msgEl.textContent = message;
    msgEl.className = `message active ${type}`;
    setTimeout(() => msgEl.classList.remove('active'), 3000);
}

function openModal(modalId) {
    document.getElementById(modalId).classList.add('active');
}

function closeModal(modalId) {
    document.getElementById(modalId).classList.remove('active');
}

// ============================================
// DATA LOADING FUNCTIONS
// ============================================

async function loadInitialData() {
    await loadStats();
    await loadAccounts();
    await loadCategories();
    await loadTransactions();
}

async function loadStats() {
    try {
        const data = await apiCall('/stats');
        if (data && data.success) {
            statsData = data.summary;
            updateStatsDisplay();
        }
    } catch (error) {
        console.error('Error loading stats:', error);
    }
}

// ============================================
// PRIVACY MODE - FIXED
// ============================================

function togglePrivacy() {
    try {
        privacyMode = !privacyMode;
        
        const btn = document.getElementById('privacyToggleBtn');
        if (privacyMode) {
            btn.textContent = '🔒 Hide';
            btn.style.background = '#FF6B6B';
        } else {
            btn.textContent = '👁️ Show';
            btn.style.background = '#4CAF50';
        }
        
        localStorage.setItem('pfmsPrivacyMode', privacyMode);
        
        document.querySelectorAll('[data-private]').forEach(el => {
            el.style.display = privacyMode ? 'block' : 'none';
        });
        
        updateStatsDisplay();
        console.log('✅ Privacy mode:', privacyMode ? 'VISIBLE' : 'HIDDEN');
    } catch (error) {
        console.error('❌ Privacy toggle error:', error);
        showMessage('❌ Privacy toggle failed: ' + error.message, 'error');
    }
}

function initPrivacyMode() {
    try {
        const btn = document.getElementById('privacyToggleBtn');
        if (!btn) return;
        
        if (privacyMode) {
            btn.textContent = '🔒 Hide';
            btn.style.background = '#FF6B6B';
            document.querySelectorAll('[data-private]').forEach(el => {
                el.style.display = 'block';
            });
        } else {
            btn.textContent = '👁️ Show';
            btn.style.background = '#4CAF50';
            document.querySelectorAll('[data-private]').forEach(el => {
                el.style.display = 'none';
            });
        }
        
        console.log('✅ Privacy mode initialized:', privacyMode ? 'VISIBLE' : 'HIDDEN');
    } catch (error) {
        console.error('❌ Privacy initialization error:', error);
    }
}

function updateStatsDisplay() {
    try {
        if (privacyMode) {
            let inrIncome = 0, inrExpense = 0, inrCreditCard = 0;
            if (statsData.inr) {
                inrIncome = statsData.inr.income || 0;
                inrExpense = statsData.inr.expense || 0;
                inrCreditCard = statsData.inr.creditCard || 0;
            }
            
            let sarIncome = 0, sarExpense = 0, sarCreditCard = 0;
            if (statsData.sar) {
                sarIncome = statsData.sar.income || 0;
                sarExpense = statsData.sar.expense || 0;
                sarCreditCard = statsData.sar.creditCard || 0;
            }
            
            document.getElementById('totalIncomeINR').textContent = '₹' + inrIncome.toFixed(2);
            document.getElementById('totalExpenseINR').textContent = '₹' + inrExpense.toFixed(2);
            document.getElementById('totalCreditCardINR').textContent = '₹' + inrCreditCard.toFixed(2);
            document.getElementById('totalBalanceINR').textContent = '₹' + (inrIncome - inrExpense).toFixed(2);
            
            document.getElementById('totalIncomeSAR').textContent = '﷼' + sarIncome.toFixed(2);
            document.getElementById('totalExpenseSAR').textContent = '﷼' + sarExpense.toFixed(2);
            document.getElementById('totalCreditCardSAR').textContent = '﷼' + sarCreditCard.toFixed(2);
            document.getElementById('totalBalanceSAR').textContent = '﷼' + (sarIncome - sarExpense).toFixed(2);
            
        } else {
            const lockedHTML = '<div style="text-align: center; padding: 20px; font-size: 14px; color: #999;">🔒 Click Show to reveal</div>';
            
            document.getElementById('totalIncomeINR').innerHTML = lockedHTML;
            document.getElementById('totalExpenseINR').innerHTML = lockedHTML;
            document.getElementById('totalCreditCardINR').innerHTML = lockedHTML;
            document.getElementById('totalBalanceINR').innerHTML = lockedHTML;
            
            document.getElementById('totalIncomeSAR').innerHTML = lockedHTML;
            document.getElementById('totalExpenseSAR').innerHTML = lockedHTML;
            document.getElementById('totalCreditCardSAR').innerHTML = lockedHTML;
            document.getElementById('totalBalanceSAR').innerHTML = lockedHTML;
        }
        
        console.log('✅ Stats display updated');
    } catch (error) {
        console.error('❌ Error updating stats display:', error);
    }
}

// ============================================
// ACCOUNTS & CATEGORIES LOADING
// ============================================

async function loadAccounts() {
    const currency = document.getElementById('currency').value;
    let url = '/accounts';
    if (currency) url += `?currency=${currency}`;

    const data = await apiCall(url);
    if (data && data.success) {
        allAccounts = data.accounts || [];
        
        const select = document.getElementById('accountSelect');
        select.innerHTML = '<option value="">Select Account</option>';
        allAccounts.forEach(a => {
            const option = document.createElement('option');
            option.value = a.id;
            option.textContent = `${a.name} (${a.currency})`;
            select.appendChild(option);
        });

        updateAccountsTable();
    }
}

async function loadCategories() {
    const mode = document.getElementById('mode').value;
    let url = '/categories';
    if (mode) url += `?mode=${mode}`;

    const data = await apiCall(url);
    if (data && data.success) {
        allCategories = data.categories || [];
        
        const select = document.getElementById('categorySelect');
        select.innerHTML = '<option value="">Select Category</option>';
        allCategories.forEach(c => {
            const option = document.createElement('option');
            option.value = c.id;
            option.textContent = c.name;
            select.appendChild(option);
        });

        updateCategoriesTable();
    }
}

async function loadTransactions(page = 1) {
    const currency = document.getElementById('filterCurrency').value;
    const mode = document.getElementById('filterMode').value;
    const fromDate = document.getElementById('filterFromDate').value;
    const toDate = document.getElementById('filterToDate').value;
    const search = document.getElementById('searchInput').value;

    let url = `/transactions?page=${page}&limit=10`;
    if (currency) url += `&currency=${currency}`;
    if (mode) url += `&mode=${mode}`;
    if (fromDate) url += `&from_date=${fromDate}`;
    if (toDate) url += `&to_date=${toDate}`;
    if (search) url += `&search=${search}`;

    const data = await apiCall(url);
    if (data && data.success) {
        allTransactions = data.transactions || [];
        displayTransactions();
        if (data.pagination) {
            displayPagination(data.pagination);
        }
    }
}

function displayTransactions() {
    const tbody = document.getElementById('transactionsBody');
    
    if (allTransactions.length === 0) {
        tbody.innerHTML = '<tr><td colspan="8" style="text-align: center; padding: 20px;">No transactions found</td></tr>';
        return;
    }

    tbody.innerHTML = allTransactions.map(t => `
        <tr>
            <td>${new Date(t.transaction_date).toLocaleDateString()}</td>
            <td>${t.account_name}</td>
            <td>${t.category_name}</td>
            <td>${t.description || '-'}</td>
            <td>${parseFloat(t.amount).toFixed(2)}</td>
            <td>${t.currency}</td>
            <td><span class="badge" style="background: ${t.mode === 'Income' ? '#4CAF50' : t.mode === 'Expense' ? '#FF9800' : '#2196F3'}; color: white; padding: 4px 8px; border-radius: 3px;">${t.mode}</span></td>
            <td>
                <button class="btn-icon" onclick="editTransaction(${t.id})" title="Edit">✎</button>
                <button class="btn-icon btn-danger" onclick="deleteTransaction(${t.id})" title="Delete">✕</button>
            </td>
        </tr>
    `).join('');
}

function displayPagination(pagination) {
    let html = `
        <div style="margin-top: 20px; display: flex; justify-content: center; gap: 10px; flex-wrap: wrap; align-items: center;">
    `;

    if (pagination.page > 1) {
        html += `<button class="btn" onclick="loadTransactions(${pagination.page - 1})">← Previous</button>`;
    }

    for (let i = Math.max(1, pagination.page - 2); i <= Math.min(pagination.pages, pagination.page + 2); i++) {
        if (i === pagination.page) {
            html += `<span style="padding: 8px 12px; background: #0f3460; color: white; border-radius: 5px; font-weight: bold;">${i}</span>`;
        } else {
            html += `<button class="btn" onclick="loadTransactions(${i})">${i}</button>`;
        }
    }

    if (pagination.page < pagination.pages) {
        html += `<button class="btn" onclick="loadTransactions(${pagination.page + 1})">Next →</button>`;
    }

    html += `<span style="color: #666; font-size: 0.9rem;">Page ${pagination.page} of ${pagination.pages} (${pagination.total} total)</span></div>`;

    let container = document.getElementById('paginationContainer');
    if (!container) {
        container = document.createElement('div');
        container.id = 'paginationContainer';
        document.querySelector('.transactions-section').appendChild(container);
    }
    container.innerHTML = html;
}

function updateAccountsTable() {
    const tbody = document.getElementById('accountsTableBody');
    if (!tbody) return;

    if (allAccounts.length === 0) {
        tbody.innerHTML = '<tr><td colspan="3" style="text-align: center;">No accounts</td></tr>';
        return;
    }

    tbody.innerHTML = allAccounts.map(a => `
        <tr>
            <td>${a.name}</td>
            <td>${a.currency}</td>
            <td>
                <button class="btn-icon" onclick="editAccount(${a.id})">✎</button>
                <button class="btn-icon btn-danger" onclick="deleteAccount(${a.id})">✕</button>
            </td>
        </tr>
    `).join('');
}

function updateCategoriesTable() {
    const tbody = document.getElementById('categoriesTableBody');
    if (!tbody) return;

    if (allCategories.length === 0) {
        tbody.innerHTML = '<tr><td colspan="3" style="text-align: center;">No categories</td></tr>';
        return;
    }

    tbody.innerHTML = allCategories.map(c => `
        <tr>
            <td>${c.name}</td>
            <td><span class="badge" style="background: ${c.mode === 'Income' ? '#4CAF50' : c.mode === 'Expense' ? '#FF9800' : '#2196F3'}; color: white; padding: 4px 8px;">${c.mode}</span></td>
            <td>
                <button class="btn-icon" onclick="editCategory(${c.id})">✎</button>
                <button class="btn-icon btn-danger" onclick="deleteCategory(${c.id})">✕</button>
            </td>
        </tr>
    `).join('');
}

// ============================================
// TRANSACTION FUNCTIONS
// ============================================

async function addTransaction(e) {
    e.preventDefault();

    const currency = document.getElementById('currency').value;
    const accountId = document.getElementById('accountSelect').value;
    const mode = document.getElementById('mode').value;
    const categoryId = document.getElementById('categorySelect').value;
    const date = document.getElementById('transactionDate').value;
    const description = document.getElementById('description').value;
    const amount = document.getElementById('amount').value;

    if (!currency || !accountId || !mode || !categoryId || !amount) {
        showMessage('❌ Please fill all required fields', 'error');
        return;
    }

    const data = await apiCall('/transactions', {
        method: 'POST',
        body: JSON.stringify({
            currency,
            account_id: parseInt(accountId),
            mode,
            category_id: parseInt(categoryId),
            transaction_date: date,
            description,
            amount: parseFloat(amount)
        })
    });

    if (data && data.success) {
        showMessage('✅ Transaction added successfully!', 'success');
        document.getElementById('transactionForm').reset();
        document.getElementById('transactionDate').valueAsDate = new Date();
        await loadTransactions();
        await loadStats();
    }
}

async function deleteTransaction(id) {
    if (!confirm('Delete this transaction?')) return;

    const data = await apiCall(`/transactions/${id}`, { method: 'DELETE' });
    if (data && data.success) {
        showMessage('✅ Transaction deleted!', 'success');
        await loadTransactions();
        await loadStats();
    }
}

function editTransaction(id) {
    const t = allTransactions.find(x => x.id === id);
    if (!t) {
        showMessage('❌ Transaction not found', 'error');
        return;
    }

    let modal = document.getElementById('editTransactionModal');
    if (!modal) {
        modal = document.createElement('div');
        modal.id = 'editTransactionModal';
        modal.className = 'modal';
        modal.innerHTML = `
            <div class="modal-content">
                <div style="display: flex; justify-content: space-between; align-items: center; margin-bottom: 20px; padding-bottom: 15px; border-bottom: 2px solid #eee;">
                    <h2 style="margin: 0; color: #2180A1;">✏️ Edit Transaction</h2>
                    <button onclick="closeModal('editTransactionModal')" style="background: #FF6B6B; color: white; border: none; padding: 8px 16px; border-radius: 6px; cursor: pointer; font-weight: bold;">✕ Close</button>
                </div>

                <form id="editTransactionForm" onsubmit="saveEditTransaction(event)" style="display: grid; gap: 15px;">
                    <input type="hidden" id="editTransactionId">

                    <div style="display: grid; grid-template-columns: 1fr 1fr; gap: 15px;">
                        <div class="form-group">
                            <label class="form-label">Currency *</label>
                            <select id="editCurrency" onchange="onEditCurrencyChange()" required style="width: 100%; padding: 10px; border: 1px solid #ddd; border-radius: 6px; font-size: 14px;">
                                <option value="INR">INR</option>
                                <option value="SAR">SAR</option>
                            </select>
                        </div>

                        <div class="form-group">
                            <label class="form-label">Mode *</label>
                            <select id="editMode" onchange="onEditModeChange()" required style="width: 100%; padding: 10px; border: 1px solid #ddd; border-radius: 6px; font-size: 14px;">
                                <option value="Income">Income</option>
                                <option value="Expense">Expense</option>
                                <option value="Credit Card">Credit Card</option>
                            </select>
                        </div>
                    </div>

                    <div style="display: grid; grid-template-columns: 1fr 1fr; gap: 15px;">
                        <div class="form-group">
                            <label class="form-label">Account *</label>
                            <select id="editAccountSelect" required style="width: 100%; padding: 10px; border: 1px solid #ddd; border-radius: 6px; font-size: 14px;">
                                <option value="">Loading...</option>
                            </select>
                        </div>

                        <div class="form-group">
                            <label class="form-label">Category *</label>
                            <select id="editCategorySelect" required style="width: 100%; padding: 10px; border: 1px solid #ddd; border-radius: 6px; font-size: 14px;">
                                <option value="">Loading...</option>
                            </select>
                        </div>
                    </div>

                    <div style="display: grid; grid-template-columns: 1fr 1fr; gap: 15px;">
                        <div class="form-group">
                            <label class="form-label">Date *</label>
                            <input type="date" id="editTransactionDate" required style="width: 100%; padding: 10px; border: 1px solid #ddd; border-radius: 6px; font-size: 14px;">
                        </div>

                        <div class="form-group">
                            <label class="form-label">Amount *</label>
                            <input type="number" id="editAmount" step="0.01" min="0" required style="width: 100%; padding: 10px; border: 1px solid #ddd; border-radius: 6px; font-size: 14px;">
                        </div>
                    </div>

                    <div class="form-group">
                        <label class="form-label">Description</label>
                        <input type="text" id="editDescription" placeholder="Enter description (optional)" style="width: 100%; padding: 10px; border: 1px solid #ddd; border-radius: 6px; font-size: 14px;">
                    </div>

                    <div style="display: grid; grid-template-columns: 1fr 1fr; gap: 10px; margin-top: 20px;">
                        <button type="submit" style="background: #4CAF50; color: white; border: none; padding: 12px 20px; border-radius: 6px; cursor: pointer; font-weight: bold; font-size: 14px;">
                            ✅ Save Changes
                        </button>
                        <button type="button" onclick="cancelEditTransaction()" style="background: #FF6B6B; color: white; border: none; padding: 12px 20px; border-radius: 6px; cursor: pointer; font-weight: bold; font-size: 14px;">
                            ❌ Cancel
                        </button>
                    </div>
                </form>
            </div>
        `;
        document.body.appendChild(modal);
    }

    document.getElementById('editTransactionId').value = t.id;
    document.getElementById('editCurrency').value = t.currency;
    document.getElementById('editMode').value = t.mode;
    document.getElementById('editTransactionDate').value = t.transaction_date;
    document.getElementById('editDescription').value = t.description || '';
    document.getElementById('editAmount').value = t.amount;

    loadEditAccounts(t.currency, t.account_id);
    loadEditCategories(t.mode, t.category_id);

    openModal('editTransactionModal');
}

async function loadEditAccounts(currency, selectedId) {
    try {
        const data = await apiCall(`/accounts?currency=${currency}`);
        if (data && data.success) {
            const select = document.getElementById('editAccountSelect');
            if (select) {
                select.innerHTML = '<option value="">Select Account</option>';
                data.accounts.forEach(a => {
                    const option = document.createElement('option');
                    option.value = a.id;
                    option.textContent = `${a.name} (${a.currency})`;
                    if (a.id === selectedId) option.selected = true;
                    select.appendChild(option);
                });
            }
        }
    } catch (error) {
        console.error('Error loading accounts:', error);
    }
}

async function loadEditCategories(mode, selectedId) {
    try {
        const data = await apiCall(`/categories?mode=${mode}`);
        if (data && data.success) {
            const select = document.getElementById('editCategorySelect');
            if (select) {
                select.innerHTML = '<option value="">Select Category</option>';
                data.categories.forEach(c => {
                    const option = document.createElement('option');
                    option.value = c.id;
                    option.textContent = c.name;
                    if (c.id === selectedId) option.selected = true;
                    select.appendChild(option);
                });
            }
        }
    } catch (error) {
        console.error('Error loading categories:', error);
    }
}

function onEditCurrencyChange() {
    const currency = document.getElementById('editCurrency').value;
    if (currency) {
        loadEditAccounts(currency, null);
    }
}

function onEditModeChange() {
    const mode = document.getElementById('editMode').value;
    if (mode) {
        loadEditCategories(mode, null);
    }
}

async function saveEditTransaction(e) {
    e.preventDefault();

    const id = parseInt(document.getElementById('editTransactionId').value);
    const currency = document.getElementById('editCurrency').value;
    const accountId = document.getElementById('editAccountSelect').value;
    const mode = document.getElementById('editMode').value;
    const categoryId = document.getElementById('editCategorySelect').value;
    const date = document.getElementById('editTransactionDate').value;
    const description = document.getElementById('editDescription').value;
    const amount = document.getElementById('editAmount').value;

    if (!currency || !accountId || !mode || !categoryId || !amount) {
        showMessage('❌ Please fill all required fields', 'error');
        return;
    }

    try {
        const data = await apiCall(`/transactions/${id}`, {
            method: 'PUT',
            body: JSON.stringify({
                currency,
                account_id: parseInt(accountId),
                mode,
                category_id: parseInt(categoryId),
                transaction_date: date,
                description,
                amount: parseFloat(amount)
            })
        });

        if (data && data.success) {
            showMessage('✅ Transaction updated successfully!', 'success');
            closeModal('editTransactionModal');
            await loadTransactions();
            await loadStats();
        } else {
            showMessage('❌ Failed to update transaction', 'error');
        }
    } catch (error) {
        console.error('Error saving transaction:', error);
        showMessage('❌ Error saving transaction: ' + error.message, 'error');
    }
}

function cancelEditTransaction() {
    closeModal('editTransactionModal');
    document.getElementById('editTransactionForm').reset();
}

// ============================================
// ACCOUNT FUNCTIONS
// ============================================

async function addAccount() {
    const name = prompt('Account Name:');
    if (!name) return;

    const currency = prompt('Currency (INR/SAR):');
    if (!currency || !['INR', 'SAR'].includes(currency)) {
        showMessage('❌ Invalid currency', 'error');
        return;
    }

    const data = await apiCall('/accounts', {
        method: 'POST',
        body: JSON.stringify({ name, currency })
    });

    if (data && data.success) {
        showMessage('✅ Account created!', 'success');
        await loadAccounts();
    }
}

async function editAccount(id) {
    const account = allAccounts.find(a => a.id === id);
    if (!account) return;

    const name = prompt('Account Name:', account.name);
    if (!name) return;

    const data = await apiCall(`/accounts/${id}`, {
        method: 'PUT',
        body: JSON.stringify({ name, currency: account.currency })
    });

    if (data && data.success) {
        showMessage('✅ Account updated!', 'success');
        await loadAccounts();
    }
}

async function deleteAccount(id) {
    if (!confirm('Delete this account?')) return;

    const data = await apiCall(`/accounts/${id}`, { method: 'DELETE' });
    if (data && data.success) {
        showMessage('✅ Account deleted!', 'success');
        await loadAccounts();
    }
}

// ============================================
// CATEGORY FUNCTIONS
// ============================================

async function addCategory() {
    const name = prompt('Category Name:');
    if (!name) return;

    const mode = prompt('Mode (Income/Expense/Credit Card):');
    if (!mode || !['Income', 'Expense', 'Credit Card'].includes(mode)) {
        showMessage('❌ Invalid mode', 'error');
        return;
    }

    const data = await apiCall('/categories', {
        method: 'POST',
        body: JSON.stringify({ name, mode })
    });

    if (data && data.success) {
        showMessage('✅ Category created!', 'success');
        await loadCategories();
    }
}

async function editCategory(id) {
    const category = allCategories.find(c => c.id === id);
    if (!category) return;

    const name = prompt('Category Name:', category.name);
    if (!name) return;

    const data = await apiCall(`/categories/${id}`, {
        method: 'PUT',
        body: JSON.stringify({ name, mode: category.mode })
    });

    if (data && data.success) {
        showMessage('✅ Category updated!', 'success');
        await loadCategories();
    }
}

async function deleteCategory(id) {
    if (!confirm('Delete this category?')) return;

    const data = await apiCall(`/categories/${id}`, { method: 'DELETE' });
    if (data && data.success) {
        showMessage('✅ Category deleted!', 'success');
        await loadCategories();
    }
}

// ============================================
// EXCEL IMPORT/EXPORT - FIXED authToken
// ============================================

async function exportToExcel() {
    try {
        const exportType = document.getElementById('exportType')?.value || 'excel';
        const endpoint = `/api/export/${exportType}`;
        console.log('📥 Exporting from:', endpoint);
        showMessage('⏳ Exporting data...', 'info');

        const token = getAuthToken();
        const response = await fetch(endpoint, {
            headers: {
                'Authorization': `Bearer ${token}`
            }
        });

        if (!response.ok) {
            throw new Error('Export failed: ' + response.statusText);
        }

        const contentDisposition = response.headers.get('Content-Disposition');
        let fileName = 'PFMS_Export.xlsx';
        if (contentDisposition) {
            const fileNameMatch = contentDisposition.match(/filename="(.+?)"/);
            if (fileNameMatch) fileName = fileNameMatch[1];
        }

        const blob = await response.blob();
        const url = window.URL.createObjectURL(blob);
        const link = document.createElement('a');
        link.href = url;
        link.download = fileName;
        document.body.appendChild(link);
        link.click();
        window.URL.revokeObjectURL(url);
        document.body.removeChild(link);

        showMessage('✅ Export successful: ' + fileName, 'success');
        console.log('✅ Downloaded:', fileName);
    } catch (error) {
        console.error('❌ Export error:', error);
        showMessage('❌ Export failed: ' + error.message, 'error');
    }
}

function downloadTemplate() {
    try {
        console.log('📥 Downloading template...');
        showMessage('⏳ Generating template...', 'info');

        const workbook = XLSX.utils.book_new();
        
        const templateData = [
            ['Date', 'Account', 'Category', 'Description', 'Amount', 'Currency', 'Mode'],
            ['2025-01-15', 'HDFC', 'Salary', 'Monthly Salary', '50000', 'INR', 'Income'],
            ['2025-01-16', 'Cash', 'Groceries', 'Supermarket', '2500', 'INR', 'Expense'],
            ['2025-01-17', 'ADCB', 'Bills', 'Electricity', '500', 'SAR', 'Expense']
        ];

        const templateSheet = XLSX.utils.aoa_to_sheet(templateData);
        templateSheet['!cols'] = [
            { wch: 12 },
            { wch: 15 },
            { wch: 15 },
            { wch: 20 },
            { wch: 12 },
            { wch: 12 },
            { wch: 15 }
        ];

        XLSX.utils.book_append_sheet(workbook, templateSheet, 'Template');
        XLSX.writeFile(workbook, 'PFMS_Import_Template.xlsx');

        showMessage('✅ Template downloaded successfully!', 'success');
        console.log('✅ Template downloaded');
    } catch (error) {
        console.error('❌ Template download error:', error);
        showMessage('❌ Template download failed: ' + error.message, 'error');
    }
}

// ✅ FIXED: handleImportFile - Use getAuthToken()
async function handleImportFile() {
    try {
        const file = document.getElementById('importFile').files[0];
        if (!file) {
            showMessage('❌ Please select a file', 'error');
            return;
        }

        showMessage('📤 Uploading file... Please wait', 'success');
        
        const formData = new FormData();
        formData.append('file', file);

        const token = getAuthToken(); // ✅ FIXED: Use getAuthToken()
        if (!token) {
            showMessage('❌ Not authenticated', 'error');
            return;
        }

        try {
            const previewResponse = await fetch(`${API_URL}/transactions/import-preview`, {
                method: 'POST',
                headers: {
                    'Authorization': `Bearer ${token}` // ✅ FIXED
                },
                body: formData
            });

            const previewData = await previewResponse.json();

            if (!previewData.success) {
                showMessage(`❌ ${previewData.message}`, 'error');
                return;
            }

            displayImportPreview(previewData);
        } catch (err) {
            console.error('Preview error:', err);
            showMessage('❌ Failed to read file. Ensure it\'s a valid Excel file.', 'error');
        }
    } catch (error) {
        console.error('❌ Import error:', error);
        showMessage('❌ Import failed: ' + error.message, 'error');
    }
}

function displayImportPreview(previewData) {
    let modal = document.getElementById('importPreviewModal');
    if (!modal) {
        modal = document.createElement('div');
        modal.id = 'importPreviewModal';
        modal.className = 'modal';
        document.body.appendChild(modal);
    }

    const html = `
        <div class="modal-content">
            <span class="modal-close" onclick="closeModal('importPreviewModal')">&times;</span>
            <h2>📊 Import Preview</h2>
            
            <div style="margin: 20px 0; padding: 15px; background: #f0f0f0; border-radius: 5px;">
                <p><strong>Total Rows:</strong> ${previewData.totalRows}</p>
                <p><strong>Columns Found:</strong> ${previewData.columns.join(', ')}</p>
            </div>

            <h3>Sample Data (First 10 rows):</h3>
            <div class="table-container" style="max-height: 300px; overflow-y: auto;">
                <table>
                    <thead>
                        <tr>
                            ${previewData.columns.map(col => `<th>${col}</th>`).join('')}
                        </tr>
                    </thead>
                    <tbody>
                        ${previewData.preview.map(row => `
                            <tr>
                                ${previewData.columns.map(col => `<td>${row[col] || '-'}</td>`).join('')}
                            </tr>
                        `).join('')}
                    </tbody>
                </table>
            </div>

            <div style="margin-top: 20px; display: flex; gap: 10px;">
                <button class="btn btn--primary" onclick="confirmImport('${previewData.totalRows}')" style="flex: 1;">
                    ✅ Confirm & Import
                </button>
                <button class="btn btn--secondary" onclick="closeModal('importPreviewModal')" style="flex: 1;">
                    ❌ Cancel
                </button>
            </div>
        </div>
    `;

    modal.innerHTML = html;
    openModal('importPreviewModal');
}

// ✅ FIXED: confirmImport - Use getAuthToken()
async function confirmImport(totalRows) {
    const file = document.getElementById('importFile').files[0];
    if (!file) return;

    closeModal('importPreviewModal');
    showMessage(`📤 Importing ${totalRows} rows... This may take a moment`, 'success');

    const formData = new FormData();
    formData.append('file', file);

    const token = getAuthToken(); // ✅ FIXED: Use getAuthToken()
    if (!token) {
        showMessage('❌ Not authenticated', 'error');
        return;
    }

    try {
        const response = await fetch(`${API_URL}/transactions/import`, {
            method: 'POST',
            headers: {
                'Authorization': `Bearer ${token}` // ✅ FIXED
            },
            body: formData
        });

        const data = await response.json();

        if (data.success) {
            showImportResults(data.results);
            setTimeout(() => {
                loadTransactions();
                loadStats();
                loadAccounts();
                loadCategories();
            }, 1500);
        } else {
            showMessage(`❌ ${data.message}`, 'error');
        }
    } catch (err) {
        console.error('Import error:', err);
        showMessage('❌ Import failed. Check console for details.', 'error');
    }

    document.getElementById('importFile').value = '';
}

function showImportResults(results) {
    let modal = document.getElementById('importResultsModal');
    if (!modal) {
        modal = document.createElement('div');
        modal.id = 'importResultsModal';
        modal.className = 'modal';
        document.body.appendChild(modal);
    }

    const errorsList = results.errors
        .slice(0, 20)
        .map(err => `<li style="color: #f44336; margin: 5px 0;">❌ ${err}</li>`)
        .join('');

    const hasMoreErrors = results.errors.length > 20;

    const html = `
        <div class="modal-content">
            <span class="modal-close" onclick="closeModal('importResultsModal')">&times;</span>
            <h2>📊 Import Results</h2>
            
            <div style="display: grid; grid-template-columns: 1fr 1fr; gap: 20px; margin: 20px 0;">
                <div style="padding: 15px; background: #e8f5e9; border-radius: 5px; border-left: 4px solid #4CAF50;">
                    <div style="font-size: 2rem; font-weight: bold; color: #4CAF50;">✅ ${results.success}</div>
                    <div style="color: #666; font-size: 0.9rem;">Transactions Imported</div>
                </div>
                <div style="padding: 15px; background: #ffebee; border-radius: 5px; border-left: 4px solid #f44336;">
                    <div style="font-size: 2rem; font-weight: bold; color: #f44336;">❌ ${results.failed}</div>
                    <div style="color: #666; font-size: 0.9rem;">Rows Failed</div>
                </div>
            </div>

            ${results.errors.length > 0 ? `
                <h3>Errors Found:</h3>
                <div style="background: #fff3cd; padding: 15px; border-radius: 5px; max-height: 250px; overflow-y: auto; border-left: 4px solid #ff9800;">
                    <ul style="margin: 0; padding-left: 20px;">
                        ${errorsList}
                        ${hasMoreErrors ? `<li style="color: #666; margin-top: 10px; font-style: italic;">... and ${results.errors.length - 20} more errors</li>` : ''}
                    </ul>
                </div>
            ` : ''}

            <div style="margin-top: 20px;">
                <button class="btn btn--primary" onclick="closeModal('importResultsModal')" style="width: 100%;">
                    ✅ Done
                </button>
            </div>
        </div>
    `;

    modal.innerHTML = html;
    openModal('importResultsModal');
}

// ============================================
// RECURRING TRANSACTIONS FUNCTIONS
// ============================================

async function loadAccountsForRecurring() {
    const data = await apiCall('/accounts');
    if (data && data.success) {
        const select = document.getElementById('recurringAccount');
        if (select) {
            select.innerHTML = '<option value="">Select Account</option>';
            data.accounts.forEach(a => {
                const option = document.createElement('option');
                option.value = a.id;
                option.textContent = `${a.name} (${a.currency})`;
                select.appendChild(option);
            });
        }
    }
}

async function loadCategoriesForRecurring() {
    const data = await apiCall('/categories');
    if (data && data.success) {
        const select = document.getElementById('recurringCategory');
        if (select) {
            select.innerHTML = '<option value="">Select Category</option>';
            data.categories.forEach(c => {
                const option = document.createElement('option');
                option.value = c.id;
                option.textContent = c.name;
                select.appendChild(option);
            });
        }
    }
}

async function loadRecurringTransactions() {
    const data = await apiCall('/recurring');
    if (data && data.success) {
        const container = document.getElementById('recurringTransactionsContainer');
        if (container) {
            if (data.recurring.length === 0) {
                container.innerHTML = '<p style="text-align: center; color: #999;">No recurring transactions yet</p>';
            } else {
                container.innerHTML = data.recurring.map(r => `
                    <div style="background: #f5f5f5; padding: 15px; border-radius: 8px; margin-bottom: 10px; display: flex; justify-content: space-between; align-items: center;">
                        <div>
                            <strong>${r.description}</strong> - ${r.amount} ${r.currency} (${r.frequency})
                            <br><small style="color: #666;">Next: ${new Date(r.next_date).toLocaleDateString()}</small>
                        </div>
                        <button class="btn-icon btn-danger" onclick="deleteRecurringTransaction(${r.id})">✕</button>
                    </div>
                `).join('');
            }
        }
    }
}

async function createRecurringTransaction(e) {
    e.preventDefault();

    const accountId = document.getElementById('recurringAccount').value;
    const categoryId = document.getElementById('recurringCategory').value;
    const description = document.getElementById('recurringDescription').value;
    const amount = document.getElementById('recurringAmount').value;
    const mode = document.getElementById('recurringMode').value;
    const currency = document.getElementById('recurringCurrency').value;
    const frequency = document.getElementById('recurringFrequency').value;
    const startDate = document.getElementById('recurringStartDate').value;
    const endDate = document.getElementById('recurringEndDate').value;

    if (!accountId || !categoryId || !amount || !startDate) {
        showMessage('❌ Please fill all required fields', 'error');
        return;
    }

    const data = await apiCall('/recurring', {
        method: 'POST',
        body: JSON.stringify({
            account_id: parseInt(accountId),
            category_id: parseInt(categoryId),
            description,
            amount: parseFloat(amount),
            mode,
            currency,
            frequency,
            start_date: startDate,
            end_date: endDate || null
        })
    });

    if (data && data.success) {
        showMessage('✅ Recurring transaction created!', 'success');
        document.getElementById('recurringForm').reset();
        await loadRecurringTransactions();
    }
}

async function deleteRecurringTransaction(id) {
    if (!confirm('Delete this recurring transaction?')) return;

    const data = await apiCall(`/recurring/${id}`, { method: 'DELETE' });
    if (data && data.success) {
        showMessage('✅ Recurring transaction deleted!', 'success');
        await loadRecurringTransactions();
    }
}

// ============================================
// BUDGET FUNCTIONS
// ============================================

async function setBudgetLimit() {
    const categoryId = document.getElementById('budgetCategory').value;
    const currency = document.getElementById('budgetCurrency').value;
    const limit = document.getElementById('budgetLimit').value;
    const threshold = document.getElementById('budgetThreshold').value;

    if (!categoryId || !currency || !limit) {
        showMessage('❌ Please fill all required fields', 'error');
        return;
    }

    const data = await apiCall('/budget', {
        method: 'POST',
        body: JSON.stringify({
            category_id: parseInt(categoryId),
            currency,
            limit: parseFloat(limit),
            threshold: parseFloat(threshold)
        })
    });

    if (data && data.success) {
        showMessage('✅ Budget limit set!', 'success');
        document.getElementById('budgetForm').reset();
        await loadBudgetStatus();
    }
}

async function loadBudgetStatus() {
    const data = await apiCall('/budget/status');
    if (data && data.success) {
        const container = document.getElementById('budgetStatusContainer');
        if (container) {
            container.innerHTML = data.status.map(b => `
                <div style="padding: 15px; background: #f5f5f5; border-radius: 8px; margin-bottom: 10px; border-left: 4px solid ${b.exceeded ? '#f44336' : '#4CAF50'};">
                    <div style="display: flex; justify-content: space-between; margin-bottom: 10px;">
                        <strong>${b.category_name}</strong>
                        <span style="color: ${b.exceeded ? '#f44336' : '#666'};">${b.spent} / ${b.limit} ${b.currency}</span>
                    </div>
                    <div style="background: #ddd; height: 8px; border-radius: 4px; overflow: hidden;">
                        <div style="background: ${b.percentage > b.threshold ? '#f44336' : '#4CAF50'}; width: ${Math.min(b.percentage, 100)}%; height: 100%;"></div>
                    </div>
                    <small style="color: #666;">${b.percentage.toFixed(1)}% of budget</small>
                </div>
            `).join('');
        }
    }
}

// ============================================
// ✅ MISSING FUNCTIONS - NOW ADDED
// ============================================

// FIX: updateAmountLabel() - ✅ Added
function updateAmountLabel() {
    const currency = document.getElementById('currency').value;
    const label = document.getElementById('currencySymbol');
    if (label) {
        label.textContent = currency === 'SAR' ? '(﷼)' : '(₹)';
    }
}

// ============================================
// UTILITY FUNCTIONS
// ============================================

function toggleTheme() {
    document.body.classList.toggle('dark-mode');
    localStorage.setItem('pfmsTheme', document.body.classList.contains('dark-mode') ? 'dark' : 'light');
}

function applyFilters() {
    loadTransactions(1);
}

function handleMonthChange() {
    console.log('Month changed');
}

function handleCurrencyChange() {
    console.log('Currency changed');
}

// ============================================
// RECURRING TRANSACTIONS - CORRECTED
// ============================================

async function createRecurringTransaction(event) {
    if (event) event.preventDefault();
    
    try {
        console.log('🔍 Form ID Check:');
        console.log('  #recurringAccount:', document.getElementById('recurringAccount'));
        console.log('  #recurringCategory:', document.getElementById('recurringCategory'));
        console.log('  #recurringAmount:', document.getElementById('recurringAmount'));
        
        // Get form values
        const accountSelect = document.getElementById('recurringAccount');
        const categorySelect = document.getElementById('recurringCategory');
        const descInput = document.getElementById('recurringDescription');
        const amountInput = document.getElementById('recurringAmount');
        const modeSelect = document.getElementById('recurringMode');
        const currencySelect = document.getElementById('recurringCurrency');
        const frequencySelect = document.getElementById('recurringFrequency');
        const startDateInput = document.getElementById('recurringStartDate');
        const endDateInput = document.getElementById('recurringEndDate');
        
        const accountId = accountSelect?.value;
        const categoryId = categorySelect?.value;
        const description = descInput?.value;
        const amount = amountInput?.value;
        const mode = modeSelect?.value || 'Income';
        const currency = currencySelect?.value || 'INR';
        const frequency = frequencySelect?.value || 'Monthly';
        const startDate = startDateInput?.value;
        const endDate = endDateInput?.value;
        
        console.log('📝 Form Values:', {accountId, categoryId, amount, startDate});
        
        // VALIDATION
        if (!accountId || accountId === '') {
            alert('❌ Please select an Account');
            return;
        }
        if (!categoryId || categoryId === '') {
            alert('❌ Please select a Category');
            return;
        }
        if (!amount || amount === '') {
            alert('❌ Please enter Amount');
            return;
        }
        if (!startDate || startDate === '') {
            alert('❌ Please select Start Date');
            return;
        }
        
        console.log('✅ Validation passed. Sending to API...');
        
        const response = await fetch(`${RECURRING_API_URL}`, {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
                'Authorization': `Bearer ${getAuthToken()}`
            },
            body: JSON.stringify({
                accountId: parseInt(accountId),
                categoryId: parseInt(categoryId),
                description: description || '',
                amount: parseFloat(amount),
                mode,
                currency,
                frequency,
                startDate,
                endDate: endDate || null
            })
        });
        
        const result = await response.json();
        
        if (!response.ok) {
            console.error('❌ Error:', result.message);
            alert('❌ Error: ' + result.message);
            return;
        }
        
        console.log('✅ Success:', result);
        alert('✅ Recurring transaction created successfully!');
        document.getElementById('recurringForm').reset();
        loadRecurringTransactions();
        
    } catch (error) {
        console.error('❌ Error:', error);
        alert('❌ Error: ' + error.message);
    }
}

// ✅ FIXED - Load accounts into recurring dropdown
function loadAccountsForRecurring() {
    console.log('📋 loadAccountsForRecurring() called');
    const accountSelect = document.getElementById('recurringAccount');
    
    if (!accountSelect) {
        console.error('❌ Cannot find #recurringAccount element');
        return;
    }
    
    console.log('✅ Found #recurringAccount element');
    console.log('📊 allAccounts length:', allAccounts ? allAccounts.length : 0);
    
    accountSelect.innerHTML = '<option value="">Select Account</option>';
    
    if (allAccounts && allAccounts.length > 0) {
        allAccounts.forEach(account => {
            const option = document.createElement('option');
            option.value = account.id;
            option.textContent = `${account.name} (${account.currency})`;
            accountSelect.appendChild(option);
        });
        console.log(`✅ Loaded ${allAccounts.length} accounts!`);
    } else {
        console.warn('⚠️ No accounts available');
    }
}

// ✅ FIXED - Load categories into recurring dropdown
function loadCategoriesForRecurring() {
    console.log('📋 loadCategoriesForRecurring() called');
    const categorySelect = document.getElementById('recurringCategory');
    
    if (!categorySelect) {
        console.error('❌ Cannot find #recurringCategory element');
        return;
    }
    
    console.log('✅ Found #recurringCategory element');
    console.log('📊 allCategories length:', allCategories ? allCategories.length : 0);
    
    categorySelect.innerHTML = '<option value="">Select Category</option>';
    
    if (allCategories && allCategories.length > 0) {
        allCategories.forEach(category => {
            const option = document.createElement('option');
            option.value = category.id;
            option.textContent = category.name;
            categorySelect.appendChild(option);
        });
        console.log(`✅ Loaded ${allCategories.length} categories!`);
    } else {
        console.warn('⚠️ No categories available');
    }
}

// ✅ UNIFIED - Load all recurring transactions
async function loadRecurringTransactions() {
    try {
        console.log('🔄 Loading recurring transactions...');
        const response = await fetch(`${RECURRING_API_URL}`, {
            headers: {
                'Authorization': `Bearer ${getAuthToken()}`
            }
        });
        
        const data = await response.json();
        console.log('📥 Response:', data);
        
        if (data.success) {
            displayRecurringTransactions(data.recurringtransactions || data.recurring_transactions || []);
        }
    } catch (error) {
        console.error('❌ Error loading recurring transactions:', error);
    }
}

// ✅ UNIFIED - Display recurring transactions
function displayRecurringTransactions(transactions) {
    const container = document.getElementById('recurringTransactionsContainer');
    if (!container) {
        console.error('❌ Cannot find #recurringTransactionsContainer');
        return;
    }
    
    if (!transactions || transactions.length === 0) {
        container.innerHTML = '<p style="color: #999; text-align: center;">No recurring transactions set yet</p>';
        return;
    }
    
    const html = transactions.map(txn => `
        <div style="background: white; padding: 15px; border-radius: 8px; margin-bottom: 10px; box-shadow: 0 2px 5px rgba(0,0,0,0.1);">
            <div style="display: flex; justify-content: space-between; align-items: start;">
                <div>
                    <h4 style="margin: 0;">${txn.description || 'N/A'}</h4>
                    <p style="margin: 5px 0; color: #666;">${txn.categoryname || txn.category_name} - ${txn.accountname || txn.account_name}</p>
                    <p style="margin: 5px 0;">${txn.currency} ${txn.amount} - ${txn.frequency}</p>
                </div>
                <div style="text-align: right;">
                    <p style="color: #666; font-size: 12px;">Next: ${new Date(txn.nextduedate || txn.next_due_date).toLocaleDateString()}</p>
                    <button onclick="deleteRecurringTransaction(${txn.id})" style="color: #ff5252; background: none; border: none; cursor: pointer;">Delete</button>
                </div>
            </div>
        </div>
    `).join('');
    
    container.innerHTML = html;
}

// ✅ Delete recurring transaction
async function deleteRecurringTransaction(id) {
    if (!confirm('Delete this recurring transaction?')) return;
    
    try {
        const response = await fetch(`${RECURRING_API_URL}/${id}`, {
            method: 'DELETE',
            headers: {
                'Authorization': `Bearer ${getAuthToken()}`
            }
        });
        
        if (response.ok) {
            alert('✅ Recurring transaction deleted!');
            loadRecurringTransactions();
        }
    } catch (error) {
        console.error('❌ Error:', error);
    }
}

// ============================================
// ✅ BUDGET MANAGEMENT FUNCTIONS - FIXED
// Combined Calculation with Proper Frontend
// ============================================


// ============================================
// 1️⃣ LOAD BUDGET CATEGORIES (FIXED)
// ============================================

async function loadBudgetCategories() {
    try {
        console.log('📥 Fetching budget categories from backend...');
        
        const token = getAuthToken();
        if (!token) {
            console.error('❌ No auth token found');
            return;
        }

        const response = await fetch(`${BUDGET_API_URL}/categories`, {
            headers: {
                'Authorization': `Bearer ${token}`,
                'Content-Type': 'application/json'
            }
        });

        if (!response.ok) {
            console.error('❌ Failed to fetch categories:', response.status);
            return;
        }

        const data = await response.json();
        console.log('📊 Categories Response:', data);
        
        if (!data.success || !data.categories) {
            console.warn('⚠️ No categories returned from API');
            return;
        }

        console.log('✅ Categories fetched:', data.categories.length);
        console.log('💡 Each category tracks all payment modes combined');

        const budgetCategorySelect = document.getElementById('budgetCategory');
        if (!budgetCategorySelect) {
            console.error('❌ budgetCategory select element not found');
            return;
        }

        budgetCategorySelect.innerHTML = '<option value="">Select Category</option>';

        // ✅ FIXED: DON'T show mode - just category name
        data.categories.forEach(category => {
            const option = document.createElement('option');
            option.value = category.id;
            option.textContent = category.name; // ✅ NO mode suffix!
            budgetCategorySelect.appendChild(option);
        });

        console.log('✅ Budget categories dropdown populated:', data.categories.length);

    } catch (error) {
        console.error('❌ Error loading budget categories:', error);
        showMessage('Error loading categories', 'error');
    }
}


// ============================================
// 2️⃣ SET BUDGET LIMIT (FIXED)
// ============================================

async function setBudgetLimit() {
    try {
        console.log('📥 Setting budget limit...');
        
        const categorySelect = document.getElementById('budgetCategory');
        const currencySelect = document.getElementById('budgetCurrency');
        const limitInput = document.getElementById('budgetLimit');
        const thresholdInput = document.getElementById('budgetThreshold');
        
        const categoryId = categorySelect?.value;
        const currency = currencySelect?.value;
        const monthlyLimit = limitInput?.value;
        const alertThreshold = thresholdInput?.value;
        
        console.log('Budget Form Values:', { categoryId, currency, monthlyLimit, alertThreshold });
        
        if (!categoryId || !currency || !monthlyLimit || !alertThreshold) {
            showMessage('❌ Please fill all required fields', 'error');
            console.warn('⚠️ Missing required fields');
            return;
        }
        
        // ✅ Validate threshold
        const thresholdNum = parseInt(alertThreshold);
        if (isNaN(thresholdNum) || thresholdNum < 0 || thresholdNum > 100) {
            showMessage('❌ Alert threshold must be between 0-100', 'error');
            return;
        }
        
        console.log('📝 Budget Data:', { categoryId, currency, monthlyLimit, alertThreshold });
        
        const response = await fetch(`${BUDGET_API_URL}/limits`, {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
                'Authorization': `Bearer ${getAuthToken()}`
            },
            body: JSON.stringify({
                categoryId: parseInt(categoryId),
                currency,
                monthlyLimit: parseFloat(monthlyLimit),
                alertThreshold: parseInt(alertThreshold)
            })
        });
        
        const data = await response.json();
        console.log('📤 Response:', data);
        
        if (data.success) {
            showMessage('✅ Budget limit set successfully!', 'success');
            document.getElementById('budgetForm')?.reset();
            
            // ✅ Reload budget info
            setTimeout(() => {
                loadBudgetStatus();
            }, 500);
        } else {
            showMessage('❌ Error: ' + data.message, 'error');
        }
    } catch (error) {
        console.error('❌ Error setting budget:', error);
        showMessage('❌ Error: ' + error.message, 'error');
    }
}


// ============================================
// 3️⃣ LOAD BUDGET STATUS (FIXED)
// ============================================

async function loadBudgetStatus() {
    try {
        console.log('📤 Loading budget status...');
        
        const response = await fetch(`${BUDGET_API_URL}/status`, {
            headers: {
                'Authorization': `Bearer ${getAuthToken()}`
            }
        });
        
        const data = await response.json();
        console.log('📈 Budget Status Response:', data);
        
        if (data.success) {
            displayBudgetStatus(
                data.budget_status || data.budgetstatus || [],
                data.alerts || []
            );
        }
    } catch (error) {
        console.error('❌ Error loading budget status:', error);
    }
}


// ============================================
// 4️⃣ DISPLAY BUDGET STATUS (FIXED FOR COMBINED)
// ============================================

function displayBudgetStatus(budgets, alerts) {
    console.log('📊 Displaying budgets:', budgets);
    console.log('🚨 Alerts:', alerts);
    
    const statusContainer = document.getElementById('budgetStatusContainer');
    const alertContainer = document.getElementById('budgetAlertsContainer');
    
    if (!statusContainer || !alertContainer) {
        console.error('❌ Cannot find budget containers');
        return;
    }
    
    // ============================================
    // DISPLAY BUDGET STATUS CARDS
    // ============================================
    
    if (!budgets || budgets.length === 0) {
        statusContainer.innerHTML = '<p style="color: #999; text-align: center; padding: 20px;">No budget limits set up yet</p>';
    } else {
        const html = budgets.map(budget => {
            // ✅ Get category name with fallback for both formats
            const categoryName = budget.categoryname || budget.category_name || 'Unknown';
            
            // ✅ Get spending with fallback for both formats
            const currentSpending = parseFloat(budget.currentspending || budget.current_spending || 0);
            
            // ✅ Get limit with fallback for both formats
            const monthlyLimit = parseFloat(budget.monthlylimit || budget.monthly_limit || 0);
            
            // ✅ Get percentage used
            const percentUsed = parseFloat(budget.percentageused || budget.percentage_used || 0);
            
            // ✅ Get alert threshold
            const alertThreshold = parseFloat(budget.alertthreshold || budget.alert_threshold || 80);
            
            // ✅ Get currency
            const currency = budget.currency || 'INR';
            
            // ✅ Calculate remaining
            const remaining = Math.max(0, monthlyLimit - currentSpending);
            
            // ✅ Determine color based on usage
            let barColor = '#66bb6a'; // Green - OK
            if (percentUsed >= 100) {
                barColor = '#ff5252'; // Red - Over budget
            } else if (percentUsed >= alertThreshold) {
                barColor = '#ffa726'; // Orange - Warning
            }
            
            // ✅ Determine status
            const status = percentUsed >= 100 ? 'OVER BUDGET' : percentUsed >= alertThreshold ? 'WARNING' : 'OK';
            
            return `
                <div style="background: #2a2a2a; padding: 15px; border-radius: 8px; margin-bottom: 12px; border-left: 4px solid ${barColor};">
                    <div style="display: flex; justify-content: space-between; align-items: start;">
                        <div style="flex: 1;">
                            <!-- Category Name -->
                            <h4 style="margin: 0; color: white; font-size: 16px;">
                                ${categoryName}
                            </h4>
                            
                            <!-- Spending Info -->
                            <p style="margin: 8px 0; color: #aaa; font-size: 14px;">
                                ${currency} ${currentSpending.toFixed(2)} / ${monthlyLimit.toFixed(2)}
                            </p>
                            
                            <!-- Progress Bar -->
                            <div style="background: #444; height: 8px; border-radius: 4px; margin: 8px 0; overflow: hidden;">
                                <div style="background: ${barColor}; height: 100%; width: ${Math.min(percentUsed, 100)}%; border-radius: 4px; transition: width 0.3s;"></div>
                            </div>
                            
                            <!-- Percentage & Remaining -->
                            <p style="font-size: 12px; color: #999; margin: 5px 0;">
                                ${percentUsed.toFixed(1)}% used - Remaining: ${currency} ${remaining.toFixed(2)}
                            </p>
                            
                            <!-- Combined Note ✅ -->
                            <p style="font-size: 11px; color: #00d9ff; margin: 5px 0; font-style: italic;">
                                💡 Combined: Expense + Credit Card + Debit Card + Cash Payment
                            </p>
                            
                            <!-- Status Badge -->
                            <span style="
                                display: inline-block;
                                padding: 4px 12px;
                                border-radius: 4px;
                                font-size: 12px;
                                font-weight: bold;
                                margin-top: 8px;
                                background: ${status === 'OVER BUDGET' ? '#ffebee' : status === 'WARNING' ? '#fff3e0' : '#e8f5e9'};
                                color: ${status === 'OVER BUDGET' ? '#ff5252' : status === 'WARNING' ? '#ffa726' : '#66bb6a'};
                            ">
                                ${status}
                            </span>
                        </div>
                        
                        <!-- Delete Button -->
                        <button onclick="deleteBudgetLimit(${budget.id})" style="color: #ff5252; background: none; border: none; cursor: pointer; font-weight: bold; font-size: 18px; margin-left: 10px;" title="Delete budget">
                            🗑️
                        </button>
                    </div>
                </div>
            `;
        }).join('');
        
        statusContainer.innerHTML = html;
    }
    
    // ============================================
    // DISPLAY BUDGET ALERTS
    // ============================================
    
    if (!alerts || alerts.length === 0) {
        alertContainer.innerHTML = '<p style="color: #66bb6a; text-align: center; padding: 20px;">✅ All budgets are within limits! Great job! 🎉</p>';
    } else {
        const alertHtml = alerts.map(alert => {
            const alertType = alert.alertType || 'Warning';
            const bgColor = alertType === 'Critical' ? '#ffebee' : '#fff3e0';
            const borderColor = alertType === 'Critical' ? '#ff5252' : '#ffa726';
            const icon = alertType === 'Critical' ? '🚨' : '⚠️';
            
            return `
                <div style="
                    background: ${bgColor}; 
                    border-left: 4px solid ${borderColor}; 
                    padding: 12px; 
                    margin: 8px 0; 
                    border-radius: 4px; 
                    color: #333;
                ">
                    <strong style="color: ${borderColor};">
                        ${icon} ${alertType === 'Critical' ? 'CRITICAL' : 'WARNING'}
                    </strong>
                    <p style="margin: 8px 0; font-size: 14px;">
                        ${alert.message}
                    </p>
                </div>
            `;
        }).join('');
        
        alertContainer.innerHTML = alertHtml;
    }
    
    console.log('✅ Budget display completed');
}


// ============================================
// 5️⃣ DELETE BUDGET LIMIT (FIXED)
// ============================================

async function deleteBudgetLimit(id) {
    if (!confirm('Delete this budget limit?')) return;
    
    try {
        console.log('🗑️ Deleting budget:', id);
        
        const response = await fetch(`${BUDGET_API_URL}/${id}`, {
            method: 'DELETE',
            headers: {
                'Authorization': `Bearer ${getAuthToken()}`
            }
        });
        
        const data = await response.json();
        console.log('Delete Response:', data);
        
        if (response.ok && data.success) {
            showMessage('✅ Budget limit deleted!', 'success');
            console.log('✅ Budget deleted successfully');
            
            // ✅ Reload budget status
            setTimeout(() => {
                loadBudgetStatus();
            }, 500);
        } else {
            showMessage('❌ Error deleting budget', 'error');
        }
    } catch (error) {
        console.error('❌ Error:', error);
        showMessage('Error deleting budget: ' + error.message, 'error');
    }
}


// ============================================
// EXPORT TO EXCEL
// ============================================

async function exportToExcel() {
    try {
        console.log('📥 Exporting data to Excel...');
        
        const response = await fetch('https://api.fairox.co.in/api/export/excel', {
            headers: {
                'Authorization': `Bearer ${getAuthToken()}`
            }
        });
        
        if (!response.ok) {
            throw new Error('Export failed');
        }
        
        // Get filename from response header
        const contentDisposition = response.headers.get('content-disposition');
        let fileName = 'PFMS_Export.xlsx';
        if (contentDisposition) {
            const fileNameMatch = contentDisposition.match(/filename="(.+)"/);
            if (fileNameMatch) fileName = fileNameMatch;
        }
        
        // Get blob and create download link
        const blob = await response.blob();
        const url = window.URL.createObjectURL(blob);
        const link = document.createElement('a');
        link.href = url;
        link.download = fileName;
        document.body.appendChild(link);
        link.click();
        document.body.removeChild(link);
        window.URL.revokeObjectURL(url);
        
        console.log('✅ Export successful:', fileName);
        alert('✅ Data exported successfully!\nFile: ' + fileName);
        
    } catch (error) {
        console.error('❌ Export error:', error);
        alert('❌ Error exporting data: ' + error.message);
    }
}

// ============================================
// OVERVIEW - CHART WITH MONTH & CURRENCY FILTERS
// ============================================

let overviewChart = null;
let allCategoriesData = {};
let selectedMonth = new Date().getMonth() + 1;  // 1-12
let selectedYear = new Date().getFullYear();

async function initializeMonthFilter() {
    const monthDropdown = document.getElementById('overviewMonthFilter');
    const now = new Date();
    
    // Generate last 3 months + current month (4 total)
    const months = [];
    for (let i = 0; i < 4; i++) {
        const d = new Date(now.getFullYear(), now.getMonth() - i, 1);
        const month = d.getMonth() + 1;
        const year = d.getFullYear();
        const monthName = d.toLocaleString('default', { month: 'long', year: 'numeric' });
        
        months.push({
            value: `${year}-${month}`,
            label: monthName,
            month: month,
            year: year
        });
    }
    
    // Add options
    monthDropdown.innerHTML = '';
    months.forEach(m => {
        const option = document.createElement('option');
        option.value = m.value;
        option.textContent = m.label;
        monthDropdown.appendChild(option);
    });
    
    // Set to current month
    monthDropdown.value = `${selectedYear}-${selectedMonth}`;
}

async function loadOverviewSummary() {
    try {
        console.log('📊 Loading overview summary...');
        
        // Initialize month filter first
        initializeMonthFilter();
        
        const categoryResponse = await fetch(
            `https://api.fairox.co.in/api/overview/category-breakdown?month=${selectedMonth}&year=${selectedYear}`,
            {
                headers: { 'Authorization': `Bearer ${getAuthToken()}` }
            }
        );
        
        const categoryData = await categoryResponse.json();
        
        console.log('📊 Response from backend:', categoryData);
        
        if (categoryData.success) {
            if (categoryData.allCurrencies && Object.keys(categoryData.allCurrencies).length > 0) {
                allCategoriesData = categoryData.allCurrencies;
                console.log('✅ Using new format (grouped by currency):', Object.keys(categoryData.allCurrencies));
            } else if (categoryData.categories && Array.isArray(categoryData.categories)) {
                console.log('⚠️ Using old format (will be grouped)');
                allCategoriesData = groupCategoriesByCurrency(categoryData.categories);
            } else {
                console.error('❌ Unknown API response format');
                return;
            }
            
            console.log('📊 Available currencies:', Object.keys(allCategoriesData));
            
            // Initialize with first available currency
            const firstCurrency = Object.keys(allCategoriesData);
            if (firstCurrency) {
                const dropdown = document.getElementById('overviewCurrencyFilter');
                dropdown.value = firstCurrency;
                displayOverviewCategoryChart(allCategoriesData[firstCurrency], firstCurrency);
            }
        }
        
    } catch (error) {
        console.error('❌ Error loading overview:', error);
    }
}

function handleMonthChange() {
    const monthDropdown = document.getElementById('overviewMonthFilter');
    const [year, month] = monthDropdown.value.split('-');
    
    selectedMonth = parseInt(month);
    selectedYear = parseInt(year);
    
    console.log(`📅 Month changed to: ${selectedYear}-${selectedMonth}`);
    loadOverviewSummary();
}

function groupCategoriesByCurrency(categories) {
    const grouped = {};
    
    if (!Array.isArray(categories)) {
        console.error('❌ Categories is not an array:', categories);
        return {};
    }
    
    categories.forEach(cat => {
        const currency = cat.currency || 'INR';
        
        if (!grouped[currency]) {
            grouped[currency] = [];
        }
        
        grouped[currency].push({
            category_name: cat.category_name,
            total_amount: cat.total_amount,
            modes: cat.modes || cat.mode || 'Expense',
            transaction_count: cat.transaction_count || 0
        });
    });
    
    return grouped;
}

function handleCurrencyChange() {
    const dropdown = document.getElementById('overviewCurrencyFilter');
    const selectedCurrency = dropdown.value;
    
    if (!selectedCurrency || !allCategoriesData[selectedCurrency]) {
        console.error('❌ No data for selected currency:', selectedCurrency);
        return;
    }
    
    console.log(`💱 Currency changed to: ${selectedCurrency}`);
    displayOverviewCategoryChart(allCategoriesData[selectedCurrency], selectedCurrency);
}

function displayOverviewCategoryChart(categories, currency = 'INR') {
    console.log(`📊 Displaying chart for ${currency}:`, categories);
    
    const container = document.getElementById('overviewCategoryChartContainer');
    if (!container) {
        console.error('❌ overviewCategoryChartContainer not found');
        return;
    }
    
    if (!Array.isArray(categories)) {
        console.error('❌ Categories is not an array:', categories);
        container.innerHTML = '<p style="color: #999; text-align: center; padding: 20px;">Invalid data format</p>';
        return;
    }
    
    const filteredCategories = categories.filter(cat => cat && cat.category_name);
    
    if (filteredCategories.length === 0) {
        container.innerHTML = '<p style="color: #999; text-align: center; padding: 20px;">No expense data for this month</p>';
        document.getElementById('totalSpendingAmount').textContent = currency === 'INR' ? '₹0.00' : '﷼0.00';
        document.getElementById('topCategoryName').textContent = '--';
        document.getElementById('totalCategoriesCount').textContent = '0';
        document.getElementById('totalTransactionsCount').textContent = '0';
        return;
    }
    
    const sortedCategories = [...filteredCategories].sort((a, b) => 
        parseFloat(b.total_amount) - parseFloat(a.total_amount)
    );
    
    const labels = sortedCategories.map(c => c.category_name || 'Uncategorized');
    const data = sortedCategories.map(c => parseFloat(c.total_amount) || 0);
    const colors = [
        '#FF6384', '#36A2EB', '#FFCE56', '#4BC0C0', '#9966FF',
        '#FF9F40', '#FF6384', '#C9CBCF', '#4BC0C0', '#FF6384',
        '#FF0000', '#00FF00', '#0000FF', '#FFFF00', '#FF00FF'
    ];
    
    const total = data.reduce((a, b) => a + b, 0);
    const currencySymbol = currency === 'INR' ? '₹' : '﷼';
    
    // Update stats
    document.getElementById('totalSpendingAmount').textContent = `${currencySymbol}${total.toFixed(2)}`;
    document.getElementById('topCategoryName').textContent = labels || '--';
    document.getElementById('totalCategoriesCount').textContent = sortedCategories.length;
    document.getElementById('totalTransactionsCount').textContent = sortedCategories.reduce((sum, c) => sum + (c.transaction_count || 0), 0);
    
    // Update month display
    const monthDisplay = new Date(selectedYear, selectedMonth - 1).toLocaleString('default', { month: 'long', year: 'numeric' });
    document.getElementById('monthYearDisplay').textContent = `(${monthDisplay})`;
    
    updateCategoryDetailsTable(sortedCategories, total, currency);
    
    let canvas = document.getElementById('overviewChart');
    if (!canvas) {
        const canvasHtml = '<canvas id="overviewChart" style="width: 100%; height: 100%;"></canvas>';
        container.innerHTML = canvasHtml;
        canvas = document.getElementById('overviewChart');
    }
    
    if (overviewChart) {
        overviewChart.destroy();
    }
    
    const ctx = canvas.getContext('2d');
    overviewChart = new Chart(ctx, {
        type: 'doughnut',
        data: {
            labels: labels,
            datasets: [{
                data: data,
                backgroundColor: colors.slice(0, data.length),
                borderColor: '#1a1a1a',
                borderWidth: 2,
                hoverBorderWidth: 3,
                hoverBorderColor: '#00d9ff'
            }]
        },
        options: {
            responsive: true,
            maintainAspectRatio: false,
            layout: {
                padding: 0
            },
            animation: {
                animateRotate: true,
                animateScale: false
            },
            plugins: {
                legend: {
                    position: 'right',
                    labels: {
                        color: '#aaa',
                        font: {
                            size: 10,
                            weight: '500'
                        },
                        padding: 10,
                        boxWidth: 12,
                        boxHeight: 12,
                        usePointStyle: true
                    }
                },
                tooltip: {
                    backgroundColor: 'rgba(0, 0, 0, 0.9)',
                    titleColor: '#00d9ff',
                    bodyColor: '#fff',
                    borderColor: '#00d9ff',
                    borderWidth: 1,
                    padding: 12,
                    cornerRadius: 8,
                    titleFont: { size: 13, weight: 'bold' },
                    bodyFont: { size: 12 },
                    callbacks: {
                        title: function(context) {
                            return context.label;
                        },
                        label: function(context) {
                            const value = context.raw || 0;
                            const percentage = ((value / total) * 100).toFixed(1);
                            return [
                                `Amount: ${currencySymbol}${value.toFixed(2)}`,
                                `Percentage: ${percentage}%`
                            ];
                        },
                        afterLabel: function(context) {
                            const index = context.dataIndex;
                            const transCount = sortedCategories[index].transaction_count || 0;
                            const modes = sortedCategories[index].modes || 'Expense';
                            return [
                                `Transactions: ${transCount}`,
                                `Types: ${modes}`
                            ];
                        }
                    }
                }
            }
        }
    });
}

function updateCategoryDetailsTable(categories, total, currency) {
    const tbody = document.getElementById('categoryDetailsTable');
    if (!tbody) return;
    
    const currencySymbol = currency === 'INR' ? '₹' : '﷼';
    
    let html = '';
    categories.forEach((cat, index) => {
        const amount = parseFloat(cat.total_amount) || 0;
        const percentage = total > 0 ? ((amount / total) * 100).toFixed(1) : 0;
        
        const colors = [
            '#FF6384', '#36A2EB', '#FFCE56', '#4BC0C0', '#9966FF',
            '#FF9F40', '#FF6384', '#C9CBCF', '#4BC0C0', '#FF6384',
            '#FF0000', '#00FF00', '#0000FF', '#FFFF00', '#FF00FF'
        ];
        const bgColor = colors[index % colors.length];
        
        html += `
            <tr style="border-bottom: 1px solid #333; transition: background 0.2s; cursor: pointer;" 
                onmouseover="this.style.background='rgba(0,217,255,0.05)'" 
                onmouseout="this.style.background='transparent'">
                <td style="padding: 10px; color: #aaa; display: flex; align-items: center; gap: 8px;">
                    <div style="width: 12px; height: 12px; background: ${bgColor}; border-radius: 3px;"></div>
                    <span style="flex: 1;" title="${cat.modes || 'Expense'}">${cat.category_name || 'Uncategorized'}</span>
                </td>
                <td style="padding: 10px; text-align: right; color: #00d9ff; font-weight: 500;">${currencySymbol}${amount.toFixed(2)}</td>
                <td style="padding: 10px; text-align: right; color: #66bb6a; font-weight: 500;">${percentage}%</td>
            </tr>
        `;
    });
    
    tbody.innerHTML = html;
}

// Load overview on page initialization
setTimeout(() => {
    console.log('⏳ Initializing overview with month & currency filters...');
    loadOverviewSummary();
}, 800);



