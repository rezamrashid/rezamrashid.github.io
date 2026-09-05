async function fetchDocuments() {
    const t = document.getElementById('filterType').value; 
    const c = document.getElementById('filterCompany').value;
    let q = supabase.from('documents').select('*, companies(*), contacts(*)').order('created_at', { ascending: false });
    if (t !== 'All') q = q.eq('type', t); if (c !== 'All') q = q.eq('company_id', c);
    const { data } = await q; globalDocumentsHistory = data || []; renderHistoryTable();
}

function renderHistoryTable() {
    const tbody = document.getElementById('historyTableBody'); tbody.innerHTML = '';
    if (globalDocumentsHistory.length === 0) { tbody.innerHTML = '<tr><td colspan="6" class="px-6 py-4 text-center text-xs text-slate-400 italic">No records found.</td></tr>'; return; }
    globalDocumentsHistory.forEach(doc => {
        let btn = (doc.type === 'Quotation' || doc.type === 'Invoice') ? `<button onclick="crossGenerateDO('${doc.id}')" class="text-blue-600 font-semibold text-xs bg-blue-50 px-2 py-0.5 rounded cursor-pointer">Gen DO</button>` : '';
        const tr = document.createElement('tr'); tr.className = "border-b hover:bg-slate-50 text-xs text-slate-600";
        tr.innerHTML = `<td class="px-6 py-4 font-bold text-slate-800">${doc.type}<br><span class="text-[10px] text-slate-400">${doc.doc_number}</span></td><td class="px-6 py-4 font-semibold">${doc.companies?.company_name || 'Manual'}<br><span class="text-[10px] text-slate-400">Attn: ${doc.contacts?.contact_name || '-'}</span></td><td class="px-6 py-4">${doc.date}</td><td class="px-6 py-4 text-right font-bold">${doc.type==='Delivery Order'?'-':'RM '+parseFloat(doc.total_amount).toFixed(2)}</td><td class="px-6 py-4 text-center"><span class="px-2 py-0.5 rounded-full border text-[10px] font-bold">${doc.status}</span></td><td class="px-6 py-4 text-right space-x-1"><button onclick="viewHistoryDoc('${doc.id}')" class="border px-2 py-0.5 rounded bg-white shadow-2xs font-semibold cursor-pointer">View</button><button onclick="regenerateDoc('${doc.id}')" class="border px-2 py-0.5 rounded bg-white shadow-2xs font-semibold cursor-pointer">Regen</button>${btn}</td>`;
        tbody.appendChild(tr);
    });
}
function viewHistoryDoc(id) {
    const d = globalDocumentsHistory.find(x => x.id === id); if (!d) return;
    switchView('creator'); document.getElementById('formTypeSelector').value = d.type; handleFormTypeChange();
    document.getElementById('formDocNumber').value = d.doc_number; document.getElementById('formDate').value = d.date;
    if (d.validity) document.getElementById('formValidity').value = d.validity; if (d.due_date) document.getElementById('formDueDate').value = d.due_date;
    if (d.reference_number) document.getElementById('formReferenceNumber').value = d.reference_number; if (d.payment_method) document.getElementById('formPaymentMethod').value = d.payment_method;
    document.getElementById('formCompanySelect').value = d.company_id || ''; handleFormCompanySelectChange(); document.getElementById('formContactSelect').value = d.contact_id || '';
    const container = document.getElementById('formItemsContainer'); container.innerHTML = '';
    d.items.forEach(i => { addFormLineItem(i.description, i.qty, i.price); });
    document.getElementById('formFooterNotes').value = d.footer_notes || '';
    const sb = document.getElementById('saveBtn'); sb.disabled = true; sb.innerText = "Locked"; sb.className = "w-full bg-slate-300 text-slate-500 font-semibold py-3 rounded-xl text-sm cursor-not-allowed";
    updateLivePreview();
}

async function regenerateDoc(id) {
    const d = globalDocumentsHistory.find(x => x.id === id); if (!d) return; viewHistoryDoc(id);
    const sb = document.getElementById('saveBtn'); sb.disabled = false; sb.innerText = "Save and Authorize Document"; sb.className = "w-full bg-slate-900 text-white font-semibold py-3 rounded-xl shadow-xs text-sm cursor-pointer";
    document.getElementById('formDocNumber').value = await calculateNextRunningNumber(d.type); document.getElementById('formDate').valueAsDate = new Date();
    updateLivePreview();
}

function crossGenerateDO(id) {
    const d = globalDocumentsHistory.find(x => x.id === id); if (!d) return;
    switchView('creator'); document.getElementById('formTypeSelector').value = 'Delivery Order'; handleFormTypeChange();
    document.getElementById('formDate').valueAsDate = new Date(); document.getElementById('formReferenceNumber').value = `Ref: ${d.type} ${d.doc_number}`;
    document.getElementById('formCompanySelect').value = d.company_id || ''; handleFormCompanySelectChange(); document.getElementById('formContactSelect').value = d.contact_id || '';
    const container = document.getElementById('formItemsContainer'); container.innerHTML = '';
    d.items.forEach(i => { addFormLineItem(i.description, i.qty, 0); }); updateLivePreview();
}
function addFormLineItem(desc = '', qty = 1, price = 0) {
    const container = document.getElementById('formItemsContainer'); const show = document.getElementById('formTypeSelector').value !== 'Delivery Order';
    const div = document.createElement('div'); div.className = "item-row grid grid-cols-12 gap-2 items-center bg-slate-50 p-2 rounded border mb-2";
    div.innerHTML = `<div class="${show ? 'col-span-6' : 'col-span-10'}"><input type="text" placeholder="Item description" value="${escapeHtml(desc)}" required class="item-desc w-full px-2 py-1 border rounded text-xs bg-white"></div><div class="col-span-2"><input type="number" min="1" value="${qty}" required class="item-qty w-full px-2 py-1 border rounded text-xs text-center bg-white"></div><div class="col-span-3 ${show ? '' : 'hidden'}"><input type="number" step="0.01" min="0" value="${price}" required class="item-price w-full px-2 py-1 border rounded text-xs text-right bg-white"></div><div class="col-span-1 text-center"><button type="button" onclick="this.parentElement.parentElement.remove(); updateLivePreview();" class="text-xs text-red-400 font-bold cursor-pointer">✕</button></div>`;
    container.appendChild(div); updateLivePreview();
}

async function handleFormTypeChange() {
    const t = document.getElementById('formTypeSelector').value;
    document.getElementById('fieldValidityGroup').classList.add('hidden'); document.getElementById('fieldDueDateGroup').classList.add('hidden');
    document.getElementById('fieldSourceRefGroup').classList.add('hidden'); document.getElementById('fieldPaymentMethodGroup').classList.add('hidden');
    let f = '';
    if (t === 'Quotation') { document.getElementById('fieldValidityGroup').classList.remove('hidden'); document.getElementById('labelDocNum').innerText = "Quotation number"; f = "Terms and conditions:\n1. Quotation is valid for [Same as validity entered in field].\n2. Prices are negotiable and subject to change without notice.\n3. 50% deposit are required upon confirmation to proceed.\n4. No work will be processed and no goods will be delivered until confirmation is received or a Purchase Order (PO) is issued.\n5. Please do not hesitate to contact me for any further details."; }
    else if (t === 'Invoice') { document.getElementById('fieldDueDateGroup').classList.remove('hidden'); document.getElementById('fieldSourceRefGroup').classList.remove('hidden'); document.getElementById('labelDocNum').innerText = "Invoice number"; f = "Terms and conditions:\n1. Payment can be made to Reza bin Mohd Rashid CIMB Bank 7007834282.\n2. Please send the transfer slip after payment made.\n3. Your business is highly appreciated and look forward to serve you again."; }
    else if (t === 'Receipt') { document.getElementById('fieldPaymentMethodGroup').classList.remove('hidden'); document.getElementById('fieldSourceRefGroup').classList.remove('hidden'); document.getElementById('labelDocNum').innerText = "Receipt number"; f = "Thank you for your business!"; }
    else if (t === 'Payment Voucher') { document.getElementById('fieldPaymentMethodGroup').classList.remove('hidden'); document.getElementById('labelDocNum').innerText = "Voucher number"; f = "Compliance/Accounting verification verification audit notes."; }
    else if (t === 'Delivery Order') { document.getElementById('fieldSourceRefGroup').classList.remove('hidden'); document.getElementById('labelDocNum').innerText = "Delivery order number"; f = "Please inspect all goods upon arrival."; }
    document.getElementById('formFooterNotes').value = f; document.getElementById('formDocNumber').value = await calculateNextRunningNumber(t);
    const c = document.getElementById('formItemsContainer'); c.innerHTML = ''; addFormLineItem(); updateLivePreview();
}

async function calculateNextRunningNumber(t) {
    let p = t==='Quotation'?'QT-':t==='Invoice'?'INV-':t==='Receipt'?'REC-':t==='Payment Voucher'?'PV-':'DO-';
    const { data } = await supabase.from('documents').select('doc_number').eq('type', t);
    if (!data || data.length === 0) return `${p}1001`;
    let m = 1000; data.forEach(d => { const parts = d.doc_number.split('-'); if (parts.length > 1) { const v = parseInt(parts[1]); if (!isNaN(v) && v > m) m = v; } });
    return `${p}${m + 1}`;
}
function updateLivePreview() {
    const t = document.getElementById('formTypeSelector').value; const n = document.getElementById('formDocNumber').value || '-';
    const dt = document.getElementById('formDate').value || '-'; const fn = document.getElementById('formFooterNotes').value;
    document.getElementById('prevDocTypeTitle').innerText = t; document.getElementById('prevDocNumber').innerText = n; document.getElementById('prevDate').innerText = dt;
    const pa = document.getElementById('printArea'); const fc = document.getElementById('faintCutLine');
    if (t === 'Receipt' || t === 'Payment Voucher') { pa.className = "bg-white p-12 a5-half-landscape flex flex-col justify-between text-slate-800 relative"; fc.classList.remove('hidden'); }
    else { pa.className = "bg-white p-12 print-preview-container flex flex-col justify-between text-slate-800 relative"; fc.classList.add('hidden'); }
    const cid = document.getElementById('formCompanySelect').value;
    if (cid) { const c = crmCompaniesList.find(x => x.id === cid); document.getElementById('prevCompanyName').innerText = c.company_name; document.getElementById('prevCompanyAddress').innerText = c.company_address || ''; }
    else { document.getElementById('prevCompanyName').innerText = "Company Name Placeholder"; document.getElementById('prevCompanyAddress').innerText = "Address loaded automatically."; }
    const ctid = document.getElementById('formContactSelect').value;
    if (ctid) { const cn = crmContactsList.find(x => x.id === ctid); document.getElementById('prevAttn').innerText = `Attn. to: ${cn.contact_name}`; document.getElementById('prevAttn').classList.remove('hidden'); }
    else { document.getElementById('prevAttn').innerText = ''; document.getElementById('prevAttn').classList.add('hidden'); }
    const l1 = document.getElementById('prevMetaLabel1'); const v1 = document.getElementById('prevMetaVal1');
    const l2 = document.getElementById('prevMetaLabel2'); const v2 = document.getElementById('prevMetaVal2');
    l1.classList.add('hidden'); v1.classList.add('hidden'); l2.classList.add('hidden'); v2.classList.add('hidden');
    if (t === 'Quotation') { l1.innerText = "Validity:"; v1.innerText = document.getElementById('formValidity').value; l1.classList.remove('hidden'); v1.classList.remove('hidden'); document.getElementById('prevFooterNotes').innerText = fn.replace("[Same as validity entered in field]", document.getElementById('formValidity').value || "30 days"); }
    else if (t === 'Invoice') { l1.innerText = "Ref Number:"; v1.innerText = document.getElementById('formReferenceNumber').value || '-'; l2.innerText = "Due Date:"; v2.innerText = document.getElementById('formDueDate').value || '-'; l1.classList.remove('hidden'); v1.classList.remove('hidden'); l2.classList.remove('hidden'); v2.mathbfReset += 1; v2.classList.remove('hidden'); document.getElementById('prevFooterNotes').innerText = fn; }
    else { l1.innerText = "Reference:"; v1.innerText = document.getElementById('formReferenceNumber').value || '-'; l1.classList.remove('hidden'); v1.classList.remove('hidden'); document.getElementById('prevFooterNotes').innerText = fn; }
    const rows = document.querySelectorAll('.item-row'); const body = document.getElementById('prevItemsBody'); body.innerHTML = '';
    let total = 0;
    if (t === 'Delivery Order') { document.getElementById('thPrice').classList.add('hidden'); document.getElementById('thTotal').classList.add('hidden'); document.getElementById('prevTotalRow').classList.add('hidden'); }
    else { document.getElementById('thPrice').classList.remove('hidden'); document.getElementById('thTotal').classList.remove('hidden'); document.getElementById('prevTotalRow').classList.remove('hidden'); }
    rows.forEach(r => {
        const desc = r.querySelector('.item-desc').value || ''; const q = parseInt(r.querySelector('.item-qty').value) || 0; const p = parseFloat(r.querySelector('.item-price').value) || 0;
        const sum = q * p; total += sum; const tr = document.createElement('tr'); tr.className = "border-b text-xs";
        if (t === 'Delivery Order') { tr.innerHTML = `<td class="py-2 text-slate-800 font-medium">${escapeHtml(desc)}</td><td class="py-2 text-center text-slate-600">${q}</td>`; }
        else { tr.innerHTML = `<td class="py-2 text-slate-800 font-medium">${escapeHtml(desc)}</td><td class="py-2 text-center text-slate-600">${q}</td><td class="py-2 text-right text-slate-600">RM ${p.toFixed(2)}</td><td class="py-2 text-right font-semibold text-slate-900">RM ${sum.toFixed(2)}</td>`; }
        body.appendChild(tr);
    });
    document.getElementById('prevGrandTotal').innerText = `RM ${total.toFixed(2)}`;
    const rb = document.getElementById('rightSignBlock'); const rf = document.getElementById('rightSignFields'); const ro = document.getElementById('rightSignLineOnly');
    const sl = document.getElementById('labelSignLeft'); const sr = document.getElementById('labelSignRight'); sl.innerText = "Issued by:";
    if (t === 'Quotation') { rb.className = "space-y-2 text-left"; rf.classList.remove('hidden'); ro.classList.add('hidden'); sr.classList.remove('hidden'); sr.innerText = "Customer's confirmation:"; }
    else if (t === 'Payment Voucher') { rb.className = "space-y-12 text-left"; rf.classList.add('hidden'); ro.classList.remove('hidden'); ro.innerText = "Received by:"; sl.innerText = "Authorized by:"; sr.classList.add('hidden'); }
    else if (t === 'Delivery Order') { rb.className = "space-y-12 text-left"; rf.classList.add('hidden'); ro.classList.remove('hidden'); ro.innerText = "Received in good condition by:"; sl.innerText = "Delivered by:"; sr.classList.add('hidden'); }
    else { rb.className = "hidden"; }
}

document.getElementById('documentForm').addEventListener('submit', async (e) => {
    e.preventDefault(); const t = document.getElementById('formTypeSelector').value;
    const payload = {
        user_id: sessionUser.id, type: t, doc_number: document.getElementById('formDocNumber').value, date: document.getElementById('formDate').value,
        due_date: t==='Invoice'?document.getElementById('formDueDate').value:null, validity: t==='Quotation'? document.getElementById('formValidity').value:null,
        reference_number: (t==='Invoice'||t==='Receipt'||t==='Delivery Order')? document.getElementById('formReferenceNumber').value:null,
        payment_method: (t==='Receipt'||t==='Payment Voucher')? document.getElementById('formPaymentMethod').value:null,
        company_id: document.getElementById('formCompanySelect').value || null, contact_id: document.getElementById('formContactSelect').value || null,
        footer_notes: document.getElementById('formFooterNotes').value, items: [], total_amount: 0
    };
    document.querySelectorAll('.item-row').forEach(r => {
        const desc = r.querySelector('.item-desc').value; const qty = parseInt(r.querySelector('.item-qty').value); const price = parseFloat(r.querySelector('.item-price').value) || 0;
        payload.total_amount += (qty * price); payload.items.push({ description: desc, qty, price });
    });
    const { error } = await supabase.from('documents').insert([payload]);
    if (error) { alert("Error: Document sequence collision. This number is locked or already exists."); }
    else { alert("Document successfully authorized."); syncCoreData(); switchView('dashboard'); }
});

function downloadPDF() {
    const e = document.getElementById('printArea'); const t = document.getElementById('formTypeSelector').value; const n = document.getElementById('formDocNumber').value || "DOC";
    const opt = { margin: 0, filename: `${t}_${n}.pdf`, image: { type: 'jpeg', quality: 0.98 }, html2canvas: { scale: 2, useCORS: true }, jsPDF: { unit: 'mm', format: 'a4', orientation: 'portrait' } };
    html2pdf().set(opt).from(e).save();
}

function openCompanyModal() { document.getElementById('companyModal').style.display = 'flex'; }
function closeCompanyModal() { document.getElementById('companyModal').style.display = 'none'; }
function openContactModal(id, name) { document.getElementById('modalTargetCompId').value = id; document.getElementById('modalTargetCompName').innerText = name; document.getElementById('contactModal').style.display = 'flex'; }
function closeContactModal() { document.getElementById('contactModal').style.display = 'none'; }

async function saveCompanyCRM() {
    const n = document.getElementById('modalCompName').value; const a = document.getElementById('modalCompAddress').value; if (!n) return;
    await supabase.from('companies').insert([{ user_id: sessionUser.id, company_name: n, company_address: a }]); closeCompanyModal(); loadCRMData();
}

async function saveContactCRM() {
    const id = document.getElementById('modalTargetCompId').value; const n = document.getElementById('modalContName').value;
    const p = document.getElementById('modalContPhone').value; const e = document.getElementById('modalContEmail').value; if (!n) return;
    await supabase.from('contacts').insert([{ user_id: sessionUser.id, company_id: id, contact_name: n, phone: p, email: e }]); closeContactModal(); loadCRMData();
}

function switchView(name) {
    document.querySelectorAll('main > section').forEach(s => s.classList.add('hidden')); document.getElementById(`view-${name}`).classList.remove('hidden');
    document.querySelectorAll('.nav-btn').forEach(b => { b.className = "nav-btn px-4 py-2 rounded-lg text-sm font-medium transition cursor-pointer text-slate-600 hover:text-slate-800"; });
    document.getElementById(`nav-${name}`).className = "nav-btn px-4 py-2 rounded-lg text-sm font-medium transition cursor-pointer bg-white text-slate-800 shadow-xs";
    if (name === 'creator') { const sb = document.getElementById('saveBtn'); sb.disabled = false; sb.innerText = "Save and Authorize Document"; sb.className = "w-full bg-slate-900 text-white font-semibold py-3 rounded-xl shadow-xs text-sm cursor-pointer"; }
}

function escapeHtml(s) { 
    if (!s) return ''; return s.replace(/&/g, "&").replace(/</g, "<").replace(/>/g, ">").replace(/"/g, """).replace(/'/g, "'"); 
}

function getStatusBadgeClass(s) { 
    return s === 'Paid' ? 'bg-emerald-50 text-emerald-700' : s === 'Sent' ? 'bg-blue-50 text-blue-700' : s === 'Cancelled' ? 'bg-rose-50 text-rose-700' : 'bg-amber-50 text-amber-700'; 
}
