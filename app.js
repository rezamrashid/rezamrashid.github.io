const _supabaseUrl = "https://supabase.co";
const _supabaseKey = "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Imh2emlzcGltY2NxdGpydXJhanlmIiwicm9sZSI6ImFub24iLCJpYXQiOjE3ODg1NDEyMzYsImV4cCI6MjEwNDExNzIzNn0.xp_4SwRzM1yaYIp9hY0VHagOx4nSqE57k2_2W3NLlcc";
const supabase = supabase.createClient(_supabaseUrl, _supabaseKey);
let sessionUser = null;
let crmCompaniesList = [];
let crmContactsList = [];
let globalDocumentsHistory = [];
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
    if (error) { errBox.innerText = error.message; errBox.classList.remove('hidden'); }
    else { appAuthenticatedInit(data.user); }
});
function handleLogout() { supabase.auth.signOut(); window.location.reload(); }
function appAuthenticatedInit(user) {
    sessionUser = user;
    document.getElementById('authScreen').classList.add('opacity-0');
    setTimeout(() => {
        document.getElementById('authScreen').classList.add('hidden');
        document.getElementById('appInterface').classList.remove('hidden');
    }, 300);
    syncCoreData();
}
async function syncCoreData() { await loadCRMData(); await fetchDocuments(); handleFormTypeChange(); }
async function loadCRMData() {
    const resComp = await supabase.from('companies').select('*').order('company_name', { ascending: true });
    const resCont = await supabase.from('contacts').select('*').order('contact_name', { ascending: true });
    crmCompaniesList = resComp.data || []; crmContactsList = resCont.data || [];
    populateCRMUI(); populateFormDropdowns();
}
function populateCRMUI() {
    const container = document.getElementById('crmGridContainer');
    const compFilter = document.getElementById('filterCompany');
    container.innerHTML = ''; compFilter.innerHTML = '<option value="All">All companies</option>';
    crmCompaniesList.forEach(comp => {
        const opt = document.createElement('option'); opt.value = comp.id; opt.innerText = comp.company_name; compFilter.appendChild(opt);
        const subStaff = crmContactsList.filter(c => c.company_id === comp.id);
        let staffHtml = '';
        if (subStaff.length === 0) { staffHtml = `<p class="text-xs text-slate-400 italic">No personnel profiles.</p>`; }
        else { subStaff.forEach(s => { staffHtml += `<div class="bg-slate-50 p-2 rounded border border-slate-100 mb-1 font-medium text-slate-700 text-xs">${s.contact_name}</div>`; }); }
        const card = document.createElement('div'); card.className = "bg-white p-5 rounded-2xl border border-slate-200 shadow-xs flex flex-col justify-between gap-4";
        card.innerHTML = `<div class="border-b pb-2"><h3 class="font-bold text-slate-800 text-sm">${comp.company_name}</h3><p class="text-xs text-slate-400 pt-0.5">${comp.company_address || ''}</p></div><div class="space-y-1">${staffHtml}</div><button onclick="openContactModal('${comp.id}', '${escapeHtml(comp.company_name)}')" class="w-full text-center text-xs py-2 bg-slate-50 border rounded-lg font-semibold text-slate-600">➕ Add Personnel</button>`;
        container.appendChild(card);
    });
}
function populateFormDropdowns() {
    const s = document.getElementById('formCompanySelect'); s.innerHTML = '<option value="">-- Choose Company --</option>';
    crmCompaniesList.forEach(c => { const o = document.createElement('option'); o.value = c.id; o.innerText = c.company_name; s.appendChild(o); });
    handleFormCompanySelectChange();
}
function handleFormCompanySelectChange() {
    const id = document.getElementById('formCompanySelect').value; const s = document.getElementById('formContactSelect'); s.innerHTML = '<option value="">-- No Contact Linked --</option>';
    crmContactsList.filter(c => c.company_id === id).forEach(c => { const o = document.createElement('option'); o.value = c.id; o.innerText = c.contact_name; s.appendChild(o); });
    updateLivePreview();
}
