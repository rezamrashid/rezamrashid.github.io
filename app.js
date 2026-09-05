const _supabaseUrl = "https://supabase.co";
const _supabaseKey = "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Imh2emlzcGltY2NxdGpydXJhanlmIiwicm9sZSI6ImFub24iLCJpYXQiOjE3ODg1NDEyMzYsImV4cCI6MjEwNDExNzIzNn0.xp_4SwRzM1yaYIp9hY0VHagOx4nSqE57k2_2W3NLlcc";
const supabase = supabase.createClient(_supabaseUrl, _supabaseKey);

let sessionUser = null;
let crmCompaniesList = [];
let crmContactsList = [];
let globalDocumentsHistory = [];
let currentActiveView = 'dashboard';

window.addEventListener('DOMContentLoaded', async () => {
    const { data: { session } } = await supabase.auth.getSession();
    if (session) appAuthenticatedInit(session.user);
    document.getElementById('formDate').valueAsDate = new Date();
});

document.getElementById('loginForm').addEventListener('submit', async (e) => {
    e.preventDefault();
    const errBox = document.getElementById('authError');
    errBox.classList.add('hidden');
    
    const { data, error } = await supabase.auth.signInWithPassword({
        email: document.getElementById('authEmail').value,
        password: document.getElementById('authPassword').value
    });

    if (error) {
        errBox.innerText = error.message;
        errBox.classList.remove('hidden');
    } else {
        appAuthenticatedInit(data.user);
    }
});

async function handleLogout() {
    await supabase.auth.signOut();
    window.location.reload();
}

function appAuthenticatedInit(user) {
    sessionUser = user;
    document.getElementById('authScreen').classList.add('opacity-0');
    setTimeout(() => {
        document.getElementById('authScreen').classList.add('hidden');
        document.getElementById('appInterface').classList.remove('hidden');
    }, 300);
    syncCoreData();
}

async function syncCoreData() {
    await loadCRMData();
    await fetchDocuments();
    handleFormTypeChange();
}

async function loadCRMData() {
    const resComp = await supabase.from('companies').select('*').order('company_name', { ascending: true });
    const resCont = await supabase.from('contacts').select('*').order('contact_name', { ascending: true });
    crmCompaniesList = resComp.data || [];
    crmContactsList = resCont.data || [];
    populateCRMUI();
    populateFormDropdowns();
}

function populateCRMUI() {
    const container = document.getElementById('crmGridContainer');
    const compFilter = document.getElementById('filterCompany');
    container.innerHTML = '';
    compFilter.innerHTML = '<option value="All">All companies</option>';

    crmCompaniesList.forEach(comp => {
        const opt = document.createElement('option');
        opt.value = comp.id;
        opt.innerText = comp.company_name;
        compFilter.appendChild(opt);

        const subStaff = crmContactsList.filter(c => c.company_id === comp.id);
        let staffHtml = '';
        
        if (subStaff.length === 0) {
            staffHtml = `<p class="text-xs text-slate-400 italic">No associated personnel profile logged.</p>`;
        } else {
            subStaff.forEach(staff => {
                staffHtml += `
                    <div class="bg-slate-50 p-2.5 rounded-lg border border-slate-100 text-xs">
                        <p class="font-bold text-slate-700">${staff.contact_name}</p>
                        \${staff.phone ? `<p class="text-slate-500 pt-0.5">📱 \${staff.phone}</p>` : ''}
                        \${staff.email ? `<p class="text-slate-500">✉️ \${staff.email}</p>` : ''}
                    </div>
                `;
            });
        }

        const card = document.createElement('div');
        card.className = "bg-white p-5 rounded-2xl border border-slate-200 shadow-xs flex flex-col justify-between gap-4";
        card.innerHTML = `
            <div class="space-y-2">
                <div class="border-b border-slate-100 pb-2">
                    <h3 class="font-bold text-slate-800 text-sm tracking-tight">\${comp.company_name}</h3>
                    <p class="text-xs text-slate-400 leading-relaxed pt-0.5">\${comp.company_address || 'No billing address specified.'}</p>
                </div>
                <div class="space-y-1.5 pt-1">
                    <span class="text-[9px] uppercase tracking-wider font-bold text-slate-400 block">Personnel roster</span>
                    <div class="space-y-1.5 max-h-[160px] overflow-y-auto pr-1">\${staffHtml}</div>
                </div>
            </div>
            <button onclick="openContactModal('\${comp.id}', '\${escapeHtml(comp.company_name)}')" class="w-full text-center text-xs py-2 bg-slate-50 hover:bg-slate-100 border border-slate-200 text-slate-600 font-semibold rounded-lg transition cursor-pointer">➕ Add Personnel</button>
        `;
        container.appendChild(card);
    });
}

function populateFormDropdowns() {
    const selectComp = document.getElementById('formCompanySelect');
    selectComp.innerHTML = '<option value="">-- Choose Corporate Anchor --</option>';
    crmCompaniesList.forEach(comp => {
        const opt = document.createElement('option');
        opt.value = comp.id;
        opt.innerText = comp.company_name;
        selectComp.appendChild(opt);
    });
    handleFormCompanySelectChange();
}

function handleFormCompanySelectChange() {
    const compId = document.getElementById('formCompanySelect').value;
    const selectCont = document.getElementById('formContactSelect');
    selectCont.innerHTML = '<option value="">-- No Direct Personnel Linked --</option>';
    
    const filtered = crmContactsList.filter(c => c.company_id === compId);
    filtered.forEach(c => {
        const opt = document.createElement('option');
        opt.value = c.id;
        opt.innerText = c.contact_name;
        selectCont.appendChild(opt);
    });
    updateLivePreview();
}

async function fetchDocuments() {
    const typeFilter = document.getElementById('filterType').value;
    const compFilter = document.getElementById('filterCompany').value;
    let query = supabase.from('documents').select('*, companies(*), contacts(*)').order('created_at', { ascending: false });
    
    if (typeFilter !== 'All') query = query.eq('type', typeFilter);
    if (compFilter !== 'All') query = query.eq('company_id', compFilter);

    const { data } = await query;
    globalDocumentsHistory = data || [];
    renderHistoryTable();
}

function renderHistoryTable() {
    const tbody = document.getElementById('historyTableBody');
    tbody.innerHTML = '';

    if (globalDocumentsHistory.length === 0) {
        tbody.innerHTML = `<tr><td colspan="6" class="px-6 py-12 text-center text-xs text-slate-400 italic">No matching records tracked.</td></tr>`;
        return;
    }

    globalDocumentsHistory.forEach(doc => {
        const tr = document.createElement('tr');
        tr.className = "hover:bg-slate-50/60 transition";
        
        let crossGenBtn = '';
        if (doc.type === 'Quotation' || doc.type === 'Invoice') {
            crossGenBtn = `<button onclick="crossGenerateDO('\${doc.id}')" class="text-blue-600 hover:text-blue-700 bg-blue-50 px-2 py-1 rounded text-xs font-semibold cursor-pointer">Generate DO</button>`;
        }

        tr.innerHTML = `
            <td class="px-6 py-4">
                <span class="text-xs font-bold text-slate-400 tracking-wider block uppercase">\${doc.type}</span>
                <span class="font-bold text-slate-800 text-sm">\${doc.doc_number}</span>
            </td>
            <td class="px-6 py-4">
                <p class="font-semibold text-slate-700 text-xs">\${doc.companies ? doc.companies.company_name : 'Manual Entry'}</p>
                <p class="text-[10px] text-slate-400">Attn: \${doc.contacts ? doc.contacts.contact_name : '-'}</p>
            </td>
            <td class="px-6 py-4 text-xs">
                <p><span class="text-slate-400">Issued:</span> \${doc.date}</p>
                \${doc.due_date ? `<p><span class="text-slate-400">Due:</span> \${doc.due_date}</p>` : ''}
                \${doc.validity ? `<p><span class="text-slate-400">Valid:</span> \${doc.validity}</p>` : ''}
            </td>
            <td class="px-6 py-4 text-right font-bold text-slate-800 text-xs">
                \${doc.type === 'Delivery Order' ? '-' : `RM \${parseFloat(doc.total_amount).toFixed(2)}`}
            </td>
            <td class="px-6 py-4 text-center">
                <span class="px-2.5 py-0.5 rounded-full text-[10px] font-bold border \${getStatusBadgeClass(doc.status)}">\${doc.status}</span>
            </td>
            <td class="px-6 py-4 text-right space-x-1 space-y-1">
                <button onclick="viewHistoryDoc('\${doc.id}')" class="text-slate-600 hover:text-slate-900 border border-slate-200 px-2 py-1 rounded text-xs font-semibold bg-white shadow-2xs cursor-pointer">View</button>
                <button onclick="regenerateDoc('\${doc.id}')" class="text-slate-600 hover:text-slate-900 border border-slate-200 px-2 py-1 rounded text-xs font-semibold bg-white shadow-2xs cursor-pointer">Regenerate</button>
                \${crossGenBtn}
            </td>
        `;
        tbody.appendChild(tr);
    });
}

function viewHistoryDoc(docId) {
    const doc = globalDocumentsHistory.find(d => d.id === docId);
    if (!doc) return;

    switchView('creator');
    document.getElementById('formTypeSelector').value = doc.type;
    handleFormTypeChange();

    document.getElementById('formDocNumber').value = doc.doc_number;
    document.getElementById('formDate').value = doc.date;
    if (doc.validity) document.getElementById('formValidity').value = doc.validity;
    if (doc.due_date) document.getElementById('formDueDate').value = doc.due_date;
    if (doc.reference_number) document.getElementById('formReferenceNumber').value = doc.reference_number;
    if (doc.payment_method) document.getElementById('formPaymentMethod').value = doc.payment_method;
    
    document.getElementById('formCompanySelect').value = doc.company_id || '';
