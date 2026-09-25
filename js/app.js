const STORAGE_KEY = 'ebarangay_system_v23';

// Default document types with fees and certificate body templates
// Placeholders: {fullName}, {civilStatus}, {address}, {purok}, {barangay}, {purpose}, {date}, {captain}
// Default physical PDF templates used by offered barangay documents.
// Paths are relative to index.html (inside /assets). Must be quoted strings.
const DEFAULT_PDF_TEMPLATE = 'assets/Barangay Certificate of Residency.pdf';
const INDIGENCY_PDF_TEMPLATE = 'assets/Barangay Certificate of Indigency.pdf';
const CLEARANCE_PDF_TEMPLATE = 'assets/Barangay Clearance.pdf';
const BUSINESS_PDF_TEMPLATE = 'assets/Business Permit.pdf';
const NO_PENDING_CASE_PDF_TEMPLATE = 'assets/Certificate of No Pending Case.pdf';
const ENDORSEMENT_PDF_TEMPLATE = 'assets/Barangay Endorsement.pdf';
const BLOTTER_PDF_TEMPLATE = 'assets/Blotter&Incident Report.pdf';
const SOLO_PARENT_PDF_TEMPLATE = 'assets/Barangay Certificate of Solo Parent.pdf';
const CERTIFICATION_PDF_TEMPLATE = 'assets/Barangay Certification.pdf';
const CERTIFICATE_OF_LOW_INCOME_PDF_TEMPLATE = 'assets/Certificate of Low Income.pdf';

const DOCUMENT_ASSETS = {
  'Barangay Clearance': CLEARANCE_PDF_TEMPLATE,
  'Certificate of Indigency': INDIGENCY_PDF_TEMPLATE,
  'Certificate of Residency': DEFAULT_PDF_TEMPLATE,
  'Barangay Certification': CERTIFICATION_PDF_TEMPLATE,
  'Business Permit': BUSINESS_PDF_TEMPLATE,
  'Blotter / Incident Report': BLOTTER_PDF_TEMPLATE,
  'Certificate of Good Moral Character': DEFAULT_PDF_TEMPLATE,
  'Certificate of Solo Parent': SOLO_PARENT_PDF_TEMPLATE,
  'Certificate of Low Income': CERTIFICATE_OF_LOW_INCOME_PDF_TEMPLATE,
  'Barangay Endorsement': ENDORSEMENT_PDF_TEMPLATE,
  'Certificate of No Pending Case': NO_PENDING_CASE_PDF_TEMPLATE
};

/* BLUEPRINT: A. PDF / DOCUMENT FILE ASSETS */
function getDocumentAsset(type){
  // Prefer per-type pdfAsset stored on docTypes, then static map, then default template
  try {
    var t = getDocTypes().find(function(x){ return x.name === type; });
    if(t && t.pdfAsset) return t.pdfAsset;
  } catch(e){}
  return DOCUMENT_ASSETS[type] || DEFAULT_PDF_TEMPLATE || '';
}
function hasDocumentAsset(type){
  return !!getDocumentAsset(type);
}
/* PDF.js custom viewer state*/
var _pdfjsDoc = null;
var _pdfjsPage = 1;
var _pdfjsScale = 1.15;
var _pdfjsPath = '';
var _pdfjsRendering = false;

function openPDFFile(path, title, requestType){
  if(!path){ showToast('PDF file is not available','error'); return; }
  _pdfjsPath = path;
  _pdfjsPage = 1;
  _pdfjsScale = 1.15;

  $('#pdfViewerTitle').textContent = title || 'PDF Document';

  var isPortalReview = !!requestType; // resident portal sample template review
  var isResident = data.currentUser && data.currentUser.role === 'Resident';
  // Resident / portal: only Request + Close (no open/save, minimal chrome)
  var hideFileActions = isPortalReview || isResident;

  var modal = $('#pdfViewerModal');
  if(modal){
    var modalBox = modal.querySelector('.pdf-viewer-modal') || modal.querySelector('.modal');
    if(modalBox){
      if(hideFileActions) modalBox.classList.add('portal-mode');
      else modalBox.classList.remove('portal-mode');
    }
  }

  // Footer actions
  var requestBtn = $('#pdfViewerRequestButton');
  if(requestBtn){
    requestBtn.dataset.requestType = requestType || '';
    requestBtn.style.display = requestType ? 'inline-flex' : 'none';
  }
  var staffOpen = $('#pdfViewerStaffOpen');
  var staffSave = $('#pdfViewerStaffSave');
  if(staffOpen) staffOpen.style.display = hideFileActions ? 'none' : 'inline-flex';
  if(staffSave) staffSave.style.display = hideFileActions ? 'none' : 'inline-flex';

  // Minimal page toolbar: hide for portal/resident, show for staff multi-page nav
  var toolbar = $('#pdfjsToolbar');
  if(toolbar) toolbar.style.display = hideFileActions ? 'none' : 'flex';

  // Hidden links kept for staff helpers
  var openLink = $('#pdfViewerOpenLink');
  var downloadLink = $('#pdfViewerDownloadLink');
  if(openLink){ openLink.href = encodeURI(path); }
  if(downloadLink){
    downloadLink.href = encodeURI(path);
    downloadLink.download = (path.split('/').pop() || 'document.pdf');
  }

  $('#pdfViewerModal').classList.add('active');
  pdfjsLoadAndRender(path);
}

function pdfjsLoadAndRender(path){
  var pagesEl = $('#pdfjsPages');
  var loadingEl = $('#pdfjsLoading');
  if(pagesEl) pagesEl.innerHTML = '';
  if(loadingEl){ loadingEl.style.display = 'flex'; loadingEl.textContent = 'Loading PDF…'; }

  if(!window.pdfjsLib){
    if(loadingEl) loadingEl.textContent = 'PDF viewer library not loaded';
    showToast('PDF.js failed to load','error');
    return;
  }

  // Destroy previous document
  if(_pdfjsDoc){
    try { _pdfjsDoc.destroy(); } catch(e){}
    _pdfjsDoc = null;
  }

  var url = encodeURI(path);
  pdfjsLib.getDocument({ url: url, withCredentials: false }).promise.then(function(pdf){
    _pdfjsDoc = pdf;
    if($('#pdfjsPageCount')) $('#pdfjsPageCount').textContent = String(pdf.numPages);
    if($('#pdfjsPageNum')) $('#pdfjsPageNum').textContent = '1';
    _pdfjsPage = 1;
    // Render all pages for simple scroll view (templates are usually 1 page)
    return pdfjsRenderAllPages();
  }).then(function(){
    if(loadingEl) loadingEl.style.display = 'none';
  }).catch(function(err){
    console.error('PDF.js error', err);
    if(loadingEl) loadingEl.textContent = 'Could not load PDF template';
    showToast('Could not open PDF template','error');
  });
}

function pdfjsRenderAllPages(){
  if(!_pdfjsDoc || !_pdfjsDoc.numPages) return Promise.resolve();
  var pagesEl = $('#pdfjsPages');
  if(!pagesEl) return Promise.resolve();
  pagesEl.innerHTML = '';
  var chain = Promise.resolve();
  for(var i = 1; i <= _pdfjsDoc.numPages; i++){
    (function(pageNum){
      chain = chain.then(function(){
        return _pdfjsDoc.getPage(pageNum).then(function(page){
          var viewport = page.getViewport({ scale: _pdfjsScale });
          var canvas = document.createElement('canvas');
          canvas.width = viewport.width;
          canvas.height = viewport.height;
          canvas.setAttribute('data-page', String(pageNum));
          pagesEl.appendChild(canvas);
          var ctx = canvas.getContext('2d');
          return page.render({ canvasContext: ctx, viewport: viewport }).promise;
        });
      });
    })(i);
  }
  return chain;
}

function pdfjsChangePage(delta){
  if(!_pdfjsDoc) return;
  var next = _pdfjsPage + delta;
  if(next < 1 || next > _pdfjsDoc.numPages) return;
  _pdfjsPage = next;
  if($('#pdfjsPageNum')) $('#pdfjsPageNum').textContent = String(_pdfjsPage);
  var canvas = document.querySelector('#pdfjsPages canvas[data-page="'+_pdfjsPage+'"]');
  if(canvas) canvas.scrollIntoView({ behavior: 'smooth', block: 'start' });
}

function pdfjsZoom(delta){
  _pdfjsScale = Math.min(2.5, Math.max(0.6, _pdfjsScale + delta));
  var loadingEl = $('#pdfjsLoading');
  if(loadingEl){ loadingEl.style.display = 'flex'; loadingEl.textContent = 'Updating…'; }
  pdfjsRenderAllPages().then(function(){
    if(loadingEl) loadingEl.style.display = 'none';
  });
}

function pdfjsOpenInNewTab(){
  if(!_pdfjsPath) return;
  window.open(encodeURI(_pdfjsPath), '_blank', 'noopener');
}

function pdfjsSaveFile(){
  if(!_pdfjsPath) return;
  var a = document.createElement('a');
  a.href = encodeURI(_pdfjsPath);
  a.download = (_pdfjsPath.split('/').pop() || 'document.pdf');
  document.body.appendChild(a);
  a.click();
  document.body.removeChild(a);
}
function reviewDocumentAsset(type){
  var path = getDocumentAsset(type);
  if(!path){ showToast('No PDF template is linked for '+type,'error'); return; }
  openPDFFile(path, type+' — Official PDF Template', type);
}
function requestFromPDFReview(){
  var btn = $('#pdfViewerRequestButton');
  var type = btn ? btn.dataset.requestType : '';
  if(!type){ showToast('Document type is not available','error'); return; }
  closeModal('pdfViewerModal');
  portalRequestType(type);
}
function sendDocumentPDF(id){
  var d = data.documents.find(function(x){ return x.id === id; });
  if(!d){ showToast('Document not found','error'); return; }
  if(d.status !== 'Released'){ showToast('Only released documents can be sent','error'); return; }
  var path = getDocumentAsset(d.type);
  if(!path){ showToast('No PDF template is linked for '+d.type,'error'); return; }
  d.pdfAsset = path;
  d.pdfSent = true;
  d.pdfSentDate = today();
  addNotif('PDF Sent to Resident','Your '+d.type+' PDF is now available in My Requests.','success','Resident',d.residentId,'document');
  saveData();
  showToast('PDF template sent to resident');
  if($('#module-secretary') && $('#module-secretary').classList.contains('active')) renderSecretary();
  if($('#module-documents') && $('#module-documents').classList.contains('active')) renderDocuments();
  if($('#module-treasurer') && $('#module-treasurer').classList.contains('active')) renderTreasurer();
  updateNotifBadge();
}
function attachPdfAssetToDocument(d){
  if(!d) return;
  var path = getDocumentAsset(d.type);
  if(path){
    d.pdfAsset = path;
    d.pdfSent = true;
    d.pdfSentDate = today();
  }
}

const DEFAULT_DOC_TYPES = [
  { name: 'Barangay Clearance', fee: 50, pdfAsset: CLEARANCE_PDF_TEMPLATE, template: '' },
  { name: 'Certificate of Indigency', fee: 0, pdfAsset: INDIGENCY_PDF_TEMPLATE, template: '' },
  { name: 'Certificate of Residency', fee: 30, pdfAsset: DEFAULT_PDF_TEMPLATE, template: '' },
  { name: 'Barangay Certification', fee: 30, pdfAsset: CERTIFICATION_PDF_TEMPLATE, template: '' },
  { name: 'Business Permit', fee: 200, pdfAsset: BUSINESS_PDF_TEMPLATE, template: '' },
  { name: 'Blotter / Incident Report', fee: 0, pdfAsset: BLOTTER_PDF_TEMPLATE, template: '' },
  { name: 'Certificate of Good Moral Character', fee: 30, pdfAsset: DEFAULT_PDF_TEMPLATE, template: '' },
  { name: 'Certificate of Solo Parent', fee: 0, pdfAsset: SOLO_PARENT_PDF_TEMPLATE, template: '' },
  { name: 'Certificate of Low Income', fee: 0, pdfAsset: CERTIFICATE_OF_LOW_INCOME_PDF_TEMPLATE, template: '' },
  { name: 'Barangay Endorsement', fee: 30, pdfAsset: ENDORSEMENT_PDF_TEMPLATE, template: '' },
  { name: 'Certificate of No Pending Case', fee: 30, pdfAsset: NO_PENDING_CASE_PDF_TEMPLATE, template: '' }
];

// Extra form fields required per official document wording template.
// Profile fields (name, civil status, address, purok, gender, birthdate) are always auto-filled.
const DOC_FORM_FIELDS = {
  'Barangay Clearance': ['purpose'],
  'Certificate of Indigency': ['purpose', 'monthlyIncome', 'employmentStatus', 'beneficiaryName'],
  'Certificate of Residency': ['purpose', 'yearsResiding', 'completeAddress'],
  'Barangay Certification': ['purpose', 'completeAddress'],
  'Business Permit': ['businessName', 'ownerName', 'businessAddress', 'businessPurpose'],
  'Blotter / Incident Report': ['incidentDetails'],
  'Certificate of Solo Parent': ['soloCircumstance', 'childrenCount'],
  'Certificate of Low Income': ['purpose', 'monthlyIncome'],
  'Barangay Endorsement': ['Date','receivingOffice','Officeaddress','Full Name','civilStatus','endorsementReason'],
  'Certificate of No Pending Case': ['Full Name','civilStatus','purpose']
};

const defaultData = {
  residents: [],
  documents: [],
  payments: [],
  services: [],
  notifications: [],
  pendingRegistrations: [],
  docTypes: JSON.parse(JSON.stringify(DEFAULT_DOC_TYPES)),
  profiling: {
    name: 'Barangay Dumanguena',
    city: 'Narra',
    Municipality: 'Narra',
    province: 'Palawan',
    population: 0,
    households: 0,
    puroks: 8,
    captain: 'Hon. Amy A. Diwara',
    contact: '0985-180-2847',
    email: 'barangay.dumanguena@email.com',
    address: 'Barangay Hall, Dumanguena, Narra, Palawan',
    landArea: '2.5 sq. km',
    established: '1975'
  },
  users: [
    { username: 'admin', password: 'admin123', role: 'Admin', name: 'Hon. Amy A. Diwara' },
    { username: 'captain', password: 'cap123', role: 'Admin', name: 'Hon. Amy A. Diwara' },
    { username: 'secretary', password: 'sec123', role: 'Secretary', name: 'Barangay Secretary' },
    { username: 'treasurer', password: 'treas123', role: 'Treasurer', name: 'Barangay Treasurer' }
  ],
  currentUser: null,
  gcashAccount: { number: '0985-180-2847', name: 'Barangay Dumanguena — Treasurer' },
  captainSignature: null
};

/* ===== BLUEPRINT: B. DOCUMENT TYPES, FEES & TEMPLATES ===== */
function ensureDocTypes(d){
  if(!d.docTypes || !Array.isArray(d.docTypes) || d.docTypes.length===0){
    d.docTypes = JSON.parse(JSON.stringify(DEFAULT_DOC_TYPES));
  }
  // Migrate old entries and ensure every type has a valid PDF template path (quoted string)
  d.docTypes.forEach(function(t){
    if(typeof t === 'string'){ return; }
    if(t.fee === undefined) t.fee = 0;
    if(t.template === undefined) t.template = '';
    // Prefer mapped asset for this document name; fall back to default clearance PDF
    var mapped = DOCUMENT_ASSETS[t.name] || DEFAULT_PDF_TEMPLATE;
    if(!t.pdfAsset || typeof t.pdfAsset !== 'string'){
      t.pdfAsset = mapped;
    }
    // Fix common broken paths from older edits (unquoted / wrong file)
    if(t.name === 'Certificate of Indigency'){
      t.pdfAsset = INDIGENCY_PDF_TEMPLATE;
    }
  });
  return d;
}

function getDocTypes(){ ensureDocTypes(data); return data.docTypes; }
function getDocTypeNames(){ return getDocTypes().map(function(t){ return t.name; }); }
function getDocFee(typeName){
  var t = getDocTypes().find(function(x){ return x.name === typeName; });
  return t ? (t.fee||0) : 0;
}
function getDocTemplate(typeName){
  var t = getDocTypes().find(function(x){ return x.name === typeName; });
  return t && t.template ? t.template : 'This is to certify that {fullName}, of legal age, {civilStatus}, resident of {address}, {purok}, {barangay}, is a bona fide resident of this barangay.\n\nPurpose: {purpose}.';
}
function fillTemplate(tpl, d, r, p){
  var fullName = r ? (r.firstName+' '+(r.middleName||'')+' '+r.lastName).replace(/\s+/g,' ').trim() : 'N/A';
  return (tpl||'')
    .replace(/\{fullName\}/g, fullName)
    .replace(/\{civilStatus\}/g, r ? (r.civilStatus||'') : '')
    .replace(/\{address\}/g, r ? (r.address||'') : '')
    .replace(/\{purok\}/g, r ? (r.purok||'') : '')
    .replace(/\{barangay\}/g, p ? (p.name||'this barangay') : 'this barangay')
    .replace(/\{purpose\}/g, d.purpose || 'whatever legal purpose it may serve')
    .replace(/\{date\}/g, formatDate(d.releaseDate||d.approvedDate||d.requestDate))
    .replace(/\{captain\}/g, (p && p.captain) || 'Barangay Captain');
}

/* ===== BLUEPRINT: C. DATA STORAGE & INITIALIZATION ===== */
function ensureDefaultUsers(d){
  if(!d) return d;
  if(!Array.isArray(d.users)) d.users = [];
  var defaults = [
    { username: 'admin', password: 'admin123', role: 'Admin', name: 'Administrator' },
    { username: 'captain', password: 'cap123', role: 'Admin', name: 'Hon. Amy A. Diwara' },
    { username: 'secretary', password: 'sec123', role: 'Secretary', name: 'Barangay Secretary' },
    { username: 'treasurer', password: 'treas123', role: 'Treasurer', name: 'Barangay Treasurer' }
  ];
  defaults.forEach(function(du){
    if(!d.users.find(function(u){ return u && u.username === du.username; })){
      d.users.push(JSON.parse(JSON.stringify(du)));
    }
  });
  if(!Array.isArray(d.residents)) d.residents = [];
  if(!Array.isArray(d.documents)) d.documents = [];
  if(!Array.isArray(d.payments)) d.payments = [];
  if(!Array.isArray(d.services)) d.services = [];
  if(!Array.isArray(d.notifications)) d.notifications = [];
  if(!Array.isArray(d.pendingRegistrations)) d.pendingRegistrations = [];
  if(!d.profiling) d.profiling = JSON.parse(JSON.stringify(defaultData.profiling));
  if(!d.gcashAccount) d.gcashAccount = JSON.parse(JSON.stringify(defaultData.gcashAccount));
  return d;
}

function loadData(){
  var s = null;
  try { s = localStorage.getItem(STORAGE_KEY); } catch(e){ s = null; }
  if(s){
    try{
      var d = JSON.parse(s);
      if(d && d.residents && Array.isArray(d.residents)){
        d.residents.forEach(function(r){
          if(r.ocrText===undefined) r.ocrText=null;
          if(r.ocrName===undefined) r.ocrName=null;
          if(r.idImage===undefined) r.idImage=null;
          if(r.profilePic===undefined) r.profilePic=null;
        });
      }
      try { ensureDocTypes(d); } catch(e){}
      return ensureDefaultUsers(d);
    }catch(e){ console.warn('loadData parse failed', e); }
  }
  return ensureDefaultUsers(JSON.parse(JSON.stringify(defaultData)));
}
function saveData(){
  try { localStorage.setItem(STORAGE_KEY, JSON.stringify(data)); }
  catch(e){ console.warn('saveData failed', e); }
}
var data = loadData();
try { renumberResidents(); } catch(e){ console.warn(e); }


/* ===== BLUEPRINT: C. SHARED UI / DATA UTILITIES ===== */
function $(s){return document.querySelector(s);}
function $$(s){return document.querySelectorAll(s);}
function showToast(msg,type){ var t=$('#toast'); if(!t){ console.log(msg); return; } t.textContent=msg; t.className='toast show '+(type||'success'); setTimeout(function(){t.classList.remove('show');},3200); }
function getResidentName(id){ var r=data.residents.find(function(x){return x.id===id;}); return r?r.firstName+' '+r.lastName:'Unknown'; }
function formatDate(d){ if(!d)return '—'; return new Date(d).toLocaleDateString('en-PH',{year:'numeric',month:'short',day:'numeric'}); }
function nextId(arr){ return arr.length?Math.max.apply(null,arr.map(function(x){return x.id;}))+1:1; }
function role(){ return data.currentUser?data.currentUser.role:''; }

/** Compute age in years from YYYY-MM-DD birth date. Returns null if invalid. */
function calcAge(birthDate){
  if(!birthDate) return null;
  var d = new Date(birthDate);
  if(isNaN(d.getTime())) return null;
  var today = new Date();
  var age = today.getFullYear() - d.getFullYear();
  var m = today.getMonth() - d.getMonth();
  if(m < 0 || (m === 0 && today.getDate() < d.getDate())) age--;
  return age < 0 ? null : age;
}
function formatAge(birthDate){
  var a = calcAge(birthDate);
  return a === null ? '—' : (a + ' yrs');
}
/** Ensure resident has householdMembers array */
function ensureHousehold(r){
  if(!r) return [];
  if(!Array.isArray(r.householdMembers)) r.householdMembers = [];
  return r.householdMembers;
}
try { window.calcAge = calcAge; window.formatAge = formatAge; window.ensureHousehold = ensureHousehold; } catch(e){}

function displayRole(r){
  r = r || role();
  if(r === 'Admin') return 'Captain';
  return r || '';
}
function today(){ return new Date().toISOString().slice(0,10); }
function statusBadge(st){
  var map={'Pending':'warning','Under Review':'info','Endorsed':'info','Payment Pending':'warning','For Captain Approval':'info','Approved':'success','Released':'success','Rejected':'danger','Paid':'success'};
  return '<span class="badge badge-'+(map[st]||'secondary')+'">'+st+'</span>';
}
function addNotif(title,message,type,forRole,residentId,category){
  data.notifications.unshift({id:nextId(data.notifications),title:title,message:message,time:'Just now',type:type||'info',read:false,forRole:forRole||null,residentId:residentId||null,category:category||'general'});
}

/* ===== RENUMBER RESIDENTS (sequential 1..N) ===== */
/* ===== BLUEPRINT: C. RESIDENT ID MAINTENANCE ===== */
function renumberResidents(){
  var idMap={};
  data.residents.forEach(function(r,i){ idMap[r.id]=i+1; });
  data.residents.forEach(function(r,i){ r.id=i+1; });
  data.documents.forEach(function(d){ if(idMap[d.residentId]) d.residentId=idMap[d.residentId]; });
  data.payments.forEach(function(p){ if(idMap[p.residentId]) p.residentId=idMap[p.residentId]; });
  data.notifications.forEach(function(n){ if(n.residentId&&idMap[n.residentId]) n.residentId=idMap[n.residentId]; });
  data.users.forEach(function(u){ if(u.residentId&&idMap[u.residentId]) u.residentId=idMap[u.residentId]; });
}


/* >>> TITLE: FORMAL CONFIRM CARD (replaces browser confirm) <<< */
var _confirmCallback = null;

function closeConfirmModal(){
  _confirmCallback = null;
  var m = document.getElementById('confirmModal');
  if(m) m.classList.remove('active');
}

function openConfirmModal(opts){
  opts = opts || {};
  var title = opts.title || 'Confirm';
  var message = opts.message || 'Are you sure?';
  var okLabel = opts.okLabel || 'Confirm';
  var cancelLabel = opts.cancelLabel || 'Cancel';
  var variant = opts.variant || 'danger'; // danger | warn | info
  _confirmCallback = typeof opts.onConfirm === 'function' ? opts.onConfirm : null;

  var modal = document.getElementById('confirmModal');
  var titleEl = document.getElementById('confirmModalTitle');
  var msgEl = document.getElementById('confirmModalMessage');
  var okBtn = document.getElementById('confirmModalOk');
  var cancelBtn = document.getElementById('confirmModalCancel');
  var iconWrap = document.getElementById('confirmModalIcon');
  var box = modal ? modal.querySelector('.eb-confirm-modal') : null;

  if(titleEl) titleEl.innerHTML = (variant === 'danger'
    ? '<i class="fas fa-trash-can"></i> '
    : variant === 'warn'
      ? '<i class="fas fa-triangle-exclamation"></i> '
      : '<i class="fas fa-circle-question"></i> ') + title;
  if(msgEl) msgEl.textContent = message;
  if(okBtn){
    okBtn.textContent = okLabel;
    okBtn.className = 'btn ' + (variant === 'danger' ? 'btn-danger' : (variant === 'warn' ? 'btn-primary' : 'btn-primary'));
  }
  if(cancelBtn) cancelBtn.textContent = cancelLabel;
  if(box){
    box.classList.remove('is-warn','is-info');
    if(variant === 'warn') box.classList.add('is-warn');
    if(variant === 'info') box.classList.add('is-info');
  }
  if(iconWrap){
    iconWrap.innerHTML = variant === 'danger'
      ? '<i class="fas fa-trash-can"></i>'
      : variant === 'warn'
        ? '<i class="fas fa-triangle-exclamation"></i>'
        : '<i class="fas fa-circle-question"></i>';
  }
  if(okBtn){
    okBtn.onclick = function(){
      var cb = _confirmCallback;
      closeConfirmModal();
      if(cb) cb();
    };
  }
  if(modal) modal.classList.add('active');
}

try {
  window.openConfirmModal = openConfirmModal;
  window.closeConfirmModal = closeConfirmModal;
} catch(e){}


/* ===== AUTH + REGISTER ===== */
/* ===== BLUEPRINT: D. AUTHENTICATION & REGISTRATION ===== */
function showRegisterForm(){
  var lf = $('#loginForm'), rf = $('#registerForm'), ff = $('#forgotForm');
  if(lf){ lf.style.display = 'none'; lf.style.visibility = 'hidden'; }
  if(ff){ ff.style.display = 'none'; ff.style.visibility = 'hidden'; }
  if(rf){ rf.style.display = 'block'; rf.style.visibility = 'visible'; rf.style.opacity = '1'; }
  var first = $('#regFirstName'); if(first) try{ first.focus(); }catch(e){}
}
function showLoginForm(){
  var lf = $('#loginForm'), rf = $('#registerForm'), ff = $('#forgotForm');
  if(rf){ rf.style.display = 'none'; rf.style.visibility = 'hidden'; }
  if(ff){ ff.style.display = 'none'; ff.style.visibility = 'hidden'; }
  if(lf){ lf.style.display = 'block'; lf.style.visibility = 'visible'; lf.style.opacity = '1'; }
  var user = $('#loginUsername'); if(user) try{ user.focus(); }catch(e){}
}
function showForgotForm(){
  var lf = $('#loginForm'), rf = $('#registerForm'), ff = $('#forgotForm');
  if(lf){ lf.style.display = 'none'; lf.style.visibility = 'hidden'; }
  if(rf){ rf.style.display = 'none'; rf.style.visibility = 'hidden'; }
  if(ff){
    ff.style.display = 'block';
    ff.style.visibility = 'visible';
    ff.style.opacity = '1';
  }
  // reset steps
  _forgotUser = null;
  var s1 = $('#forgotStep1'), s2 = $('#forgotStep2'), s3 = $('#forgotStep3');
  if(s1) s1.style.display = 'block';
  if(s2) s2.style.display = 'none';
  if(s3) s3.style.display = 'none';
  var hint = $('#forgotStepHint');
  if(hint) hint.textContent = 'Enter your username to reset your password.';
  var u = $('#forgotUsername'); if(u){ u.value = ($('#loginUsername') && $('#loginUsername').value) || ''; try{ u.focus(); }catch(e){} }
  var v = $('#forgotVerifyValue'); if(v) v.value = '';
  var p1 = $('#forgotNewPass'); if(p1) p1.value = '';
  var p2 = $('#forgotNewPass2'); if(p2) p2.value = '';
}

/* >>> TITLE: FORGOT PASSWORD FLOW <<< */
var _forgotUser = null;

function forgotFindAccount(){
  try {
    if(typeof data === 'undefined' || !data) data = loadData();
    ensureDefaultUsers(data);
  } catch(e){}
  var username = ($('#forgotUsername') && $('#forgotUsername').value || '').trim();
  if(!username){ showToast('Enter your username','error'); return; }
  var user = (data.users || []).find(function(u){
    return u && String(u.username).toLowerCase() === username.toLowerCase();
  });
  if(!user){
    showToast('Account not found. Check your username or register.','error');
    return;
  }
  _forgotUser = user;
  var s1 = $('#forgotStep1'), s2 = $('#forgotStep2'), s3 = $('#forgotStep3');
  if(s1) s1.style.display = 'none';
  if(s2) s2.style.display = 'block';
  if(s3) s3.style.display = 'none';

  var label = $('#forgotVerifyLabel');
  var input = $('#forgotVerifyValue');
  var hint = $('#forgotStepHint');
  var res = null;
  if(user.residentId){
    res = (data.residents || []).find(function(r){ return r.id === user.residentId; });
  }
  // Resident: verify with registered contact number
  if(res && res.contact){
    if(label) label.textContent = 'Enter your registered contact number';
    if(input){ input.placeholder = '09XXXXXXXXX'; input.value = ''; }
    if(hint) hint.textContent = "Verify your identity for account \""+user.username+"\".";
  } else {
    // Staff / no contact: verify with full registered name
    if(label) label.textContent = 'Enter your full registered name';
    if(input){ input.placeholder = user.name ? ('e.g. '+user.name) : 'Full name'; input.value = ''; }
    if(hint) hint.textContent = "Verify identity for \""+user.username+"\" ("+(user.role||"User")+").";
  }
  if(input) try{ input.focus(); }catch(e){}
}

function forgotVerifyIdentity(){
  if(!_forgotUser){ showForgotForm(); return; }
  var val = ($('#forgotVerifyValue') && $('#forgotVerifyValue').value || '').trim();
  if(!val){ showToast('Enter verification details','error'); return; }

  var user = _forgotUser;
  var res = null;
  if(user.residentId){
    res = (data.residents || []).find(function(r){ return r.id === user.residentId; });
  }

  var ok = false;
  if(res && res.contact){
    // normalize digits only
    var a = String(res.contact).replace(/\D/g,'');
    var b = String(val).replace(/\D/g,'');
    ok = a && b && (a === b || a.slice(-10) === b.slice(-10));
  } else {
    // compare name loosely
    var registered = String(user.name || '').toLowerCase().replace(/\s+/g,' ').trim();
    var typed = String(val).toLowerCase().replace(/\s+/g,' ').trim();
    ok = registered && typed && (registered === typed || registered.indexOf(typed) >= 0 || typed.indexOf(registered) >= 0);
  }

  if(!ok){
    showToast('Verification failed. Please try again or visit the barangay hall.','error');
    return;
  }

  var s1 = $('#forgotStep1'), s2 = $('#forgotStep2'), s3 = $('#forgotStep3');
  if(s1) s1.style.display = 'none';
  if(s2) s2.style.display = 'none';
  if(s3) s3.style.display = 'block';
  var hint = $('#forgotStepHint');
  if(hint) hint.textContent = "Create a new password for \""+user.username+"\".";
  var p1 = $('#forgotNewPass'); if(p1) try{ p1.focus(); }catch(e){}
  showToast('Identity verified. Set your new password.','success');
}

function forgotResetPassword(){
  if(!_forgotUser){ showForgotForm(); return; }
  var p1 = ($('#forgotNewPass') && $('#forgotNewPass').value) || '';
  var p2 = ($('#forgotNewPass2') && $('#forgotNewPass2').value) || '';
  if(p1.length < 6){ showToast('Password must be at least 6 characters','error'); return; }
  if(p1 !== p2){ showToast('Passwords do not match','error'); return; }

  var user = (data.users || []).find(function(u){
    return u && u.username === _forgotUser.username;
  });
  if(!user){ showToast('Account not found','error'); return; }
  user.password = p1;
  try { saveData(); } catch(e){}
  showToast('Password updated. You can log in now.','success');

  // Prefill login
  var lu = $('#loginUsername'); if(lu) lu.value = user.username;
  var lp = $('#loginPassword'); if(lp) lp.value = '';
  _forgotUser = null;
  showLoginForm();
  if(lp) try{ lp.focus(); }catch(e){}
}

try {
  window.showForgotForm = showForgotForm;
  window.forgotFindAccount = forgotFindAccount;
  window.forgotVerifyIdentity = forgotVerifyIdentity;
  window.forgotResetPassword = forgotResetPassword;
} catch(e){}

function submitRegistration(){
  try {
  var fnEl=$('#regFirstName'), lnEl=$('#regLastName');
  if(!fnEl||!lnEl){ showToast('Registration form not ready','error'); return; }
  var fn=fnEl.value.trim(), ln=lnEl.value.trim();
  var un=$('#regUsername').value.trim(), pw=$('#regPassword').value;
  var addr=$('#regAddress').value.trim(), purok=$('#regPurok').value.trim(), contact=$('#regContact').value.trim();
  var mid=$('#regMiddleName').value.trim(), proof=$('#regProof').value.trim();
  var gender=($('#regGender')&&$('#regGender').value)||'Male';
  var civil=($('#regCivilStatus')&&$('#regCivilStatus').value)||'Single';
  var birth=($('#regBirthDate')&&$('#regBirthDate').value)||'';
  var occupation=($('#regOccupation')&&$('#regOccupation').value.trim())||'';
  if(!fn||!ln||!un||!pw||!addr){ showToast('Fill required fields','error'); return; }
  if(data.users.find(function(u){return u.username===un;})){ showToast('Username already taken','error'); return; }
  // Create resident record (unverified until ID scan + Secretary)
  var rid = nextId(data.residents);
  // Ensure sequential after append
  data.residents.push({
    id: rid, firstName:fn, lastName:ln, middleName:mid, birthDate:birth, gender:gender, civilStatus:civil,
    address:addr, purok:purok||'', contact:contact||'', occupation:occupation, voter:false, senior:false, pwd:false,
    status:'Active', verified:false, verifiedBy:null, verifiedDate:null, registered:today(),
    proof:proof||null, nationality:'Filipino', birthplace:'', email:'',
    nationalId:null, idVerified:false, idVerifiedDate:null, idImage:null, ocrText:null, ocrName:null, profilePic:null
  });
  renumberResidents();
  // Find the new resident id after renumber (last one matching name)
  var newRes = data.residents.find(function(r){ return r.firstName===fn && r.lastName===ln && r.address===addr; });
  var newId = newRes ? newRes.id : data.residents.length;
  // Create user account linked to resident
  var user = { username:un, password:pw, role:'Resident', name:fn+' '+ln, residentId:newId };
  data.users.push(user);
  addNotif('New Resident Registered', fn+' '+ln+' registered and needs residency verification','warning','Secretary',null,'account');
  addNotif('Welcome','Your account is ready. Scan your National ID in My Profile, then wait for Secretary verification before requesting documents.','info','Resident',newId,'account');
  // Auto-login
  data.currentUser = user;
  saveData();
  ['regFirstName','regLastName','regMiddleName','regUsername','regPassword','regAddress','regPurok','regContact','regProof','regBirthDate','regOccupation'].forEach(function(i){ if($('#'+i))$('#'+i).value=''; });
  showApp();
  showToast('Account created! You are now logged in. Scan your National ID in Profile.');
  navigate('profile');
  } catch(err){ console.error('register error', err); showToast('Registration failed — please try again','error'); }
}

/* Staff role → default account username (password-only login) */
var LOGIN_ROLE_USER = {
  Secretary: 'secretary',
  Treasurer: 'treasurer',
  Admin: 'admin'
};

function onLoginRoleChange(){
  var roleEl = document.getElementById('loginRole');
  var userGroup = document.getElementById('loginUsernameGroup');
  var passGroup = document.getElementById('loginPasswordGroup');
  var userEl = document.getElementById('loginUsername');
  var passEl = document.getElementById('loginPassword');
  var role = roleEl ? String(roleEl.value || '') : '';

  if(!role){
    if(userGroup) userGroup.style.display = 'none';
    if(passGroup) passGroup.style.display = 'none';
    return;
  }

  if(role === 'Resident'){
    if(userGroup) userGroup.style.display = 'block';
    if(passGroup) passGroup.style.display = 'block';
    if(userEl){ userEl.value = ''; userEl.placeholder = 'Enter your username'; }
    if(passEl){ passEl.value = ''; passEl.placeholder = 'Enter your password'; }
    if(userEl) try{ userEl.focus(); }catch(e){}
  } else {
    // Staff: password only — username auto-filled from role
    if(userGroup) userGroup.style.display = 'none';
    if(passGroup) passGroup.style.display = 'block';
    if(userEl) userEl.value = LOGIN_ROLE_USER[role] || '';
    if(passEl){ passEl.value = ''; passEl.placeholder = 'Enter your password'; try{ passEl.focus(); }catch(e){} }
  }
}
try { window.onLoginRoleChange = onLoginRoleChange; } catch(e){}

function login(){
  try {
    var roleEl = document.getElementById('loginRole');
    var userEl = document.getElementById('loginUsername');
    var passEl = document.getElementById('loginPassword');
    if(!passEl){
      alert('Login form not found. Please refresh the page.');
      return;
    }
    var selectedRole = roleEl ? String(roleEl.value || '').trim() : '';
    var pass = String(passEl.value || '');
    if(!selectedRole){
      showToast('Please select your user role','error');
      return;
    }
    if(!pass){
      showToast('Enter your password','error');
      return;
    }

    // Resident needs username; staff username comes from role
    var user = '';
    if(selectedRole === 'Resident'){
      user = userEl ? String(userEl.value || '').trim() : '';
      if(!user){
        showToast('Enter your username','error');
        return;
      }
    } else {
      user = LOGIN_ROLE_USER[selectedRole] || '';
      // Also accept captain username for Admin role
      if(selectedRole === 'Admin') user = 'admin';
    }

    if(typeof data === 'undefined' || !data) data = loadData();
    ensureDefaultUsers(data);

    var found = data.users.find(function(u){
      return u && String(u.username).toLowerCase() === String(user).toLowerCase() && String(u.password) === pass;
    });
    // Admin role: try captain account as alternate
    if(!found && selectedRole === 'Admin'){
      found = data.users.find(function(u){
        return u && String(u.username).toLowerCase() === 'captain' && String(u.password) === pass;
      });
    }
    if(!found){
      showToast(selectedRole === 'Resident' ? 'Invalid username or password' : 'Invalid password for this role','error');
      return;
    }

    var accountRole = String(found.role || '');
    if(accountRole === 'Captain') accountRole = 'Admin';
    if(accountRole !== selectedRole){
      showToast('Selected role does not match this account.','error');
      return;
    }

    data.currentUser = found;
    saveData();
    showApp();
    var roleLabel = selectedRole === 'Admin' ? 'Captain / Administrator' : selectedRole;
    showToast('Welcome, ' + (found.name || found.username) + ' (' + roleLabel + ')!');
  } catch(err){
    console.error('login error', err);
    alert('Sign in error: ' + (err && err.message ? err.message : err));
  }
}
try {
  window.login = login;
  window.showRegisterForm = showRegisterForm;
  window.showLoginForm = showLoginForm;
  window.submitRegistration = submitRegistration;
} catch(e){}

function logout(){
  try {
    // Instant UI switch first (avoid long freeze from large localStorage writes)
    if(data) data.currentUser = null;

    var appEl = document.getElementById('app');
    if(appEl){
      appEl.classList.remove('active');
      appEl.style.display = 'none';
    }
    try {
      if(document.body){
        document.body.classList.remove('in-app');
        document.body.classList.remove('login-open');
      }
    } catch(e){}

    // Show public site / home login immediately
    var ps = document.getElementById('publicSite');
    if(ps) ps.style.display = 'block';
    var ls = document.getElementById('loginScreen');
    if(ls){
      ls.style.display = 'flex';
      ls.style.visibility = 'visible';
    }
    try {
      if(typeof showPublicRoom === 'function') showPublicRoom('home');
      else if(typeof showPublicSite === 'function') showPublicSite();
    } catch(e){}

    var u = document.getElementById('loginUsername'); if(u) u.value = '';
    var p = document.getElementById('loginPassword'); if(p) p.value = '';
    var roleEl = document.getElementById('loginRole'); if(roleEl) roleEl.selectedIndex = 0;
    try { if(typeof onLoginRoleChange === 'function') onLoginRoleChange(); } catch(e){}
    try { showLoginForm(); } catch(e){}

    // Persist session clear in background (non-blocking)
    setTimeout(function(){
      try { saveData(); } catch(e){}
      try {
        if(typeof applyLoginTheme === 'function'){
          applyLoginTheme(localStorage.getItem('ebarangay_login_theme') || 'light');
        }
      } catch(e){}
    }, 0);
  } catch(err){ console.error(err); }
}
try { window.logout = logout; } catch(e){}
/* ===== BLUEPRINT: D. APPLICATION SHELL & ROLE VISIBILITY ===== */

function updateUserAvatar(){
  var elAv = document.getElementById('userAvatar');
  if(!elAv) return;
  var u = data && data.currentUser;
  if(!u){
    elAv.classList.remove('has-photo');
    elAv.style.backgroundImage = '';
    elAv.innerHTML = 'U';
    return;
  }
  var name = u.name || u.username || 'User';
  var pic = null;
  // Prefer resident profile picture
  if(u.residentId){
    var r = (data.residents || []).find(function(x){ return x.id === u.residentId; });
    if(r && r.profilePic) pic = r.profilePic;
  }
  if(!pic && u.avatar) pic = u.avatar;
  if(!pic && u.profilePic) pic = u.profilePic;

  if(pic){
    elAv.classList.add('has-photo');
    elAv.style.backgroundImage = '';
    elAv.innerHTML = '<img src="'+pic+'" alt="Avatar" class="user-avatar-img">';
  } else {
    elAv.classList.remove('has-photo');
    elAv.style.backgroundImage = '';
    elAv.innerHTML = String(name).charAt(0).toUpperCase();
  }
}
try { window.updateUserAvatar = updateUserAvatar; } catch(e){}

function showApp(){
  try { forcePortalLightTheme(); } catch(e){}

  try {
    var ls = document.getElementById('loginScreen');
    var appEl = document.getElementById('app');
    if(ls){
      ls.style.display = 'none';
      ls.style.visibility = 'hidden';
    }
    if(appEl){
      appEl.classList.add('active');
      appEl.style.display = 'flex';
    }
    // Portals always light — strip any dark mode from document
    try {
      document.documentElement.removeAttribute('data-theme');
      if(document.body){
        document.body.removeAttribute('data-theme');
        document.body.classList.add('in-app', 'theme-light');
        var _ps=document.getElementById('publicSite'); if(_ps) _ps.style.display='none';
        document.body.classList.remove('theme-dark');
      }
    } catch(e){}
    var u = data && data.currentUser;
    if(!u){
      alert('No user session. Please sign in again.');
      return;
    }
    var name = u.name || u.username || 'User';
    var elName = document.getElementById('userName');
    var elRole = document.getElementById('userRole');
    var elAv = document.getElementById('userAvatar');
    if(elName) elName.textContent = name;
    if(elRole) elRole.textContent = displayRole(u.role);
    try { updateUserAvatar(); } catch(e){ if(elAv) elAv.textContent = String(name).charAt(0).toUpperCase(); }
    try { updateNotifBadge(); } catch(e){ console.warn(e); }
    try {
      applyRoleVisibility();
    } catch(e){
      console.warn('applyRoleVisibility', e);
    }
    // Guarantee a module is visible (blank content fix)
    try {
      var anyActive = document.querySelector('.module.active');
      if(!anyActive){
        var r = (data.currentUser && data.currentUser.role) || '';
        if(r === 'Resident') navigate('portal');
        else if(r === 'Secretary') navigate('secretary');
        else if(r === 'Treasurer') navigate('treasurer');
        else navigate('dashboard');
      }
    } catch(e3){
      try { navigate('dashboard'); } catch(e4){}
    }
  } catch(err){
    console.error('showApp error', err);
    alert('Could not open app: ' + (err && err.message ? err.message : err));
  }
}
try { window.showApp = showApp; } catch(e){}
function applyRoleVisibility(){
  var r=role();
  // Hide all role-specific nav first
  $$('.nav-admin-only, .nav-secretary-only, .nav-treasurer-only, .nav-captain-only, .nav-resident-only').forEach(function(el){ el.style.display='none'; });
  if(r==='Resident'){
    // Residents only: Portal, My Profile, My Requests, Notifications
    $$('.nav-resident-only').forEach(function(el){ el.style.display=''; });
    $$('.nav-link[data-module="notifications"]').forEach(function(l){
      if(l.closest('.nav-item')) l.closest('.nav-item').style.display='';
    });
    navigate('portal'); return;
  }
  // Officials never see Portal / My Profile
  if(r==='Admin'){
    $$('.nav-admin-only, .nav-secretary-only, .nav-treasurer-only').forEach(function(el){ el.style.display=''; });
    navigate('dashboard');
  } else if(r==='Secretary'){
    $$('.nav-secretary-only').forEach(function(el){ el.style.display=''; });
    $$('.nav-secretary-residents').forEach(function(el){ el.style.display=''; });
    // Separate dashboard: Secretary Module is their home (not shared Admin dashboard)
    showNav(['residents','documents','notifications','secretary']);
    // Hide generic dashboard nav for secretary
    $$('.nav-link[data-module="dashboard"]').forEach(function(l){ if(l.closest('.nav-item')) l.closest('.nav-item').style.display='none'; });
    navigate('secretary');
  } else if(r==='Treasurer'){
    $$('.nav-treasurer-only').forEach(function(el){ el.style.display=''; });
    // Separate dashboard: Treasurer Module is their home
    showNav(['payments','notifications','treasurer']);
    $$('.nav-link[data-module="dashboard"]').forEach(function(l){ if(l.closest('.nav-item')) l.closest('.nav-item').style.display='none'; });
    navigate('treasurer');
  }
  // Legacy: if any account still has role Captain, treat as Admin powers
  if(r==='Captain'){
    $$('.nav-admin-only, .nav-secretary-only, .nav-treasurer-only').forEach(function(el){ el.style.display=''; });
    navigate('dashboard');
  }
}
function showNav(mods){ mods.forEach(function(m){ var l=$('.nav-link[data-module="'+m+'"]'); if(l&&l.closest('.nav-item')) l.closest('.nav-item').style.display=''; }); }

/* ===== BLUEPRINT: D. NAVIGATION ===== */
function navigate(module){
  $$('.module').forEach(function(m){ m.classList.remove('active'); });
  $$('.nav-link').forEach(function(l){ l.classList.remove('active'); });
  var mod=$('#module-'+module); if(mod) mod.classList.add('active');
  var link=$('.nav-link[data-module="'+module+'"]'); if(link) link.classList.add('active');
  var titles={dashboard:'Captain Dashboard',residents:'Resident Information',profiling:'Barangay Profiling',documents:'Document Management',services:'Barangay Services',payments:'Payment Management',portal:'Resident Portal',profile:'My Profile',myrequests:'My Requests',reports:'Reports & Analytics',admin:'Captain Administration',notifications:'Notifications',secretary:'Secretary Dashboard',treasurer:'Treasurer Dashboard'};
  var pt=document.getElementById('pageTitle'); if(pt) pt.textContent=titles[module]||module;
  if(module==='dashboard') renderDashboard();
  if(module==='residents') renderResidents();
  if(module==='profiling') renderProfiling();
  if(module==='documents') renderDocuments();
  if(module==='services') renderServices();
  if(module==='payments') renderPayments();
  if(module==='portal') renderPortal();
  if(module==='profile') renderProfile();
  if(module==='myrequests') renderMyRequests();
  if(module==='reports') renderReports();
  if(module==='admin'){ renderAdmin(); renderDocTypesTable(); }
  if(module==='notifications') renderNotifications();
  if(module==='secretary'){ renderSecretary(); renderDocTypesTable(); }
  if(module==='treasurer') renderTreasurer();
  $('#sidebar').classList.remove('open');
}

/* ===== DASHBOARD ===== */
/* ===== BLUEPRINT: E. DASHBOARD ===== */
function renderDashboard(){
  function setText(id, val){ var el=document.getElementById(id); if(el) el.textContent = val; }
  var residents = data.residents || [];
  var docs = data.documents || [];
  var pays = data.payments || [];
  var services = data.services || [];

  setText('statResidents', residents.length);
  setText('statSeniors', residents.filter(function(r){return r.senior;}).length);
  setText('statVoters', residents.filter(function(r){return r.voter;}).length);
  setText('statPendingDocs', docs.filter(function(d){return ['Pending','Under Review','Payment Pending','For Captain Approval'].indexOf(d.status)>=0;}).length);
  setText('statPendingPay', pays.filter(function(p){return p.status==='Pending';}).length);
  if($('#statServices')) $('#statServices').textContent=services.filter(function(s){return s.status==='Upcoming';}).length;
  if($('#statUnverifiedRes')) $('#statUnverifiedRes').textContent=residents.filter(function(r){return !r.verified;}).length;

  // Quick analytics numbers
  var verified = residents.filter(function(r){return r.verified;}).length;
  var released = docs.filter(function(d){return d.status==='Released';}).length;
  var paidAmt = pays.filter(function(p){return p.status==='Paid';}).reduce(function(s,p){return s+(p.amount||0);},0);
  var qs = document.getElementById('dashQuickStats');
  if(qs){
    qs.innerHTML =
      '<div class="dash-q"><span class="lbl">Verified residents</span><strong>'+verified+'</strong></div>'+
      '<div class="dash-q"><span class="lbl">Unverified</span><strong>'+(residents.length-verified)+'</strong></div>'+
      '<div class="dash-q"><span class="lbl">Released documents</span><strong>'+released+'</strong></div>'+
      '<div class="dash-q"><span class="lbl">Total collected</span><strong>₱'+paidAmt.toFixed(2)+'</strong></div>'+
      '<div class="dash-q"><span class="lbl">Active services</span><strong>'+services.filter(function(s){return s.status==='Upcoming';}).length+'</strong></div>'+
      '<div class="dash-q"><span class="lbl">ID uploaded</span><strong>'+residents.filter(function(r){return r.idVerified;}).length+'</strong></div>';
  }

  // Document status chart
  var docMap = {};
  docs.forEach(function(d){ var k=d.status||'Unknown'; docMap[k]=(docMap[k]||0)+1; });
  drawBarChart('dashChartDocs', docMap, '');
  var leg = document.getElementById('dashDocStatusLegend');
  if(leg){
    leg.innerHTML = Object.keys(docMap).map(function(k){ return '<span><i></i> '+k+': <strong>'+docMap[k]+'</strong></span>'; }).join('') || '<span class="muted">No documents yet</span>';
  }

  // Purok chart
  var purokMap = {};
  residents.forEach(function(r){
    var pk = (typeof normalizePurok==='function' ? normalizePurok(r.purok) : (r.purok||'Unassigned'));
    purokMap[pk]=(purokMap[pk]||0)+1;
  });
  drawBarChart('dashChartPurok', purokMap, '');
  var pl = document.getElementById('dashPurokLegend');
  if(pl){
    pl.innerHTML = Object.keys(purokMap).map(function(k){ return '<span>'+k+': <strong>'+purokMap[k]+'</strong></span>'; }).join('') || '<span class="muted">No residents yet</span>';
  }

  // Payments chart
  var payMap = {
    'Pending': pays.filter(function(p){return p.status==='Pending';}).length,
    'Paid': pays.filter(function(p){return p.status==='Paid';}).length
  };
  drawBarChart('dashChartPay', payMap, '');
  var payLeg = document.getElementById('dashPayLegend');
  if(payLeg){
    payLeg.innerHTML = '<span>Pending: <strong>'+payMap.Pending+'</strong></span><span>Paid: <strong>'+payMap.Paid+'</strong></span><span>Collected: <strong>₱'+paidAmt.toFixed(2)+'</strong></span>';
  }

  var tbody=$('#dashRecentDocs');
  if(tbody) tbody.innerHTML=docs.slice().sort(function(a,b){return String(b.requestDate||'').localeCompare(String(a.requestDate||''));}).slice(0,8).map(function(d){ return '<tr><td>'+d.type+'</td><td>'+getResidentName(d.residentId)+'</td><td>'+statusBadge(d.status)+'</td><td>'+formatDate(d.requestDate)+'</td></tr>'; }).join('')||'<tr><td colspan="4">No documents</td></tr>';

  // Captain/Admin: show full Secretary + Treasurer transaction tables
  var capBox = document.getElementById('captainTxnOverview');
  var r = role();
  if(capBox){
    if(r === 'Admin' || r === 'Captain'){
      capBox.style.display = 'block';
      try { renderCaptain(); } catch(e){ console.warn(e); }
    } else {
      capBox.style.display = 'none';
    }
  }
}

/* ===== RESIDENTS (sequential numbering) ===== */
/* ===== BLUEPRINT: E. RESIDENT MANAGEMENT ===== */
function residentPhotoHtml(r, sizeClass){
  sizeClass = sizeClass || '';
  var full = (((r && r.firstName)||'')+' '+((r && r.lastName)||'')).replace(/\s+/g,' ').trim() || '?';
  var initial = full.charAt(0).toUpperCase();
  if(r && r.profilePic){
    return '<div class="res-photo '+sizeClass+' has-photo"><img src="'+r.profilePic+'" alt="'+full+'"></div>';
  }
  return '<div class="res-photo '+sizeClass+'">'+initial+'</div>';
}
try { window.residentPhotoHtml = residentPhotoHtml; } catch(e){}

function renderResidents(){
  var search=($('#resSearch')&&$('#resSearch').value||'').toLowerCase();
  var list=data.residents;
  if(search) list=list.filter(function(r){ return (r.firstName+' '+r.lastName+' '+r.address+' '+(r.purok||'')+' '+r.contact).toLowerCase().indexOf(search)>=0; });
  $('#residentsTable').innerHTML=list.map(function(r,idx){
    var tags=(r.voter?'<span class="badge badge-info">Voter</span> ':'')+(r.senior?'<span class="badge badge-warning">Senior</span> ':'')+(r.pwd?'<span class="badge badge-danger">PWD</span> ':'')+(r.verified?'<span class="badge badge-success">Verified</span>':'<span class="badge badge-warning">Unverified</span>')+(r.idVerified?' <span class="badge badge-info">ID ✓</span>':'');
    var del=(role()==='Admin')?' <button class="btn btn-sm btn-danger" onclick="deleteResident('+r.id+')">Delete</button>':'';
    return '<tr><td>'+(idx+1)+'</td><td class="td-photo">'+residentPhotoHtml(r,'sm')+'</td><td><strong>'+r.lastName+', '+r.firstName+'</strong></td><td>'+(r.purok||'—')+'</td><td>'+r.address+'</td><td>'+r.contact+'</td><td>'+tags+'</td><td><button class="btn btn-sm btn-outline" onclick="viewResidentDetail('+r.id+')">View</button> <button class="btn btn-sm btn-outline" onclick="editResident('+r.id+')">Edit</button>'+del+'</td></tr>';
  }).join('')||'<tr><td colspan="8">No residents</td></tr>';

  try { renderPurokResidentRecords(); } catch(e){ console.warn(e); }
}
function openResidentModal(id){
  $('#resModalTitle').textContent=id?'Edit Resident':'Add New Resident';
  $('#resId').value=id||'';
  if(id){
    var r=data.residents.find(function(x){return x.id===id;});
    if(r){
      $('#resFirstName').value=r.firstName; $('#resLastName').value=r.lastName; $('#resMiddleName').value=r.middleName||'';
      $('#resBirthDate').value=r.birthDate||''; $('#resGender').value=r.gender; $('#resCivilStatus').value=r.civilStatus;
      $('#resAddress').value=r.address; $('#resPurok').value=r.purok||''; $('#resContact').value=r.contact;
      $('#resOccupation').value=r.occupation||''; $('#resProof').value=r.proof||'';
      $('#resVoter').checked=r.voter; $('#resSenior').checked=r.senior; $('#resPwd').checked=r.pwd;
      var ageEl=$('#resAgeDisplay'); if(ageEl) ageEl.textContent=formatAge(r.birthDate);
      renderHouseholdEditor(ensureHousehold(r));
    }
  } else {
    ['resFirstName','resLastName','resMiddleName','resBirthDate','resAddress','resPurok','resContact','resOccupation','resProof'].forEach(function(i){$('#'+i).value='';});
    $('#resGender').value='Male'; $('#resCivilStatus').value='Single';
    $('#resVoter').checked=false; $('#resSenior').checked=false; $('#resPwd').checked=false;
    var ageEl2=$('#resAgeDisplay'); if(ageEl2) ageEl2.textContent='—';
    renderHouseholdEditor([]);
  }
  $('#residentModal').classList.add('active');
}
function renderHouseholdEditor(members){
  var box=$('#resHouseholdList'); if(!box) return;
  members = members || [];
  if(!members.length){
    box.innerHTML='<p style="font-size:12px;color:#6b7280;margin:0;">Walang household member. Click "+ Add Member".</p>';
    return;
  }
  box.innerHTML=members.map(function(m,i){
    return '<div class="hh-row" data-idx="'+i+'" style="display:grid;grid-template-columns:1.4fr 1fr 1fr auto;gap:8px;margin-bottom:8px;align-items:end;">'+
      '<div class="form-group" style="margin:0;"><label style="font-size:11px;">Name</label><input type="text" class="hh-name" value="'+(m.name||'').replace(/"/g,'&quot;')+'"></div>'+
      '<div class="form-group" style="margin:0;"><label style="font-size:11px;">Relation</label><select class="hh-relation">'+
        ['Spouse','Child','Parent','Sibling','Relative','Other'].map(function(rel){ return '<option'+(m.relation===rel?' selected':'')+'>'+rel+'</option>'; }).join('')+
      '</select></div>'+
      '<div class="form-group" style="margin:0;"><label style="font-size:11px;">Birth Date</label><input type="date" class="hh-birth" value="'+(m.birthDate||'')+'" onchange="var a=calcAge(this.value);var s=this.parentNode.querySelector(\'.hh-age\');if(s)s.textContent=a===null?\'—\':(a+\' yrs\');"></div>'+
      '<div style="display:flex;flex-direction:column;align-items:flex-end;gap:4px;"><span class="hh-age" style="font-size:11px;font-weight:600;">'+formatAge(m.birthDate)+'</span><button type="button" class="btn btn-sm btn-danger" onclick="removeHouseholdMemberRow('+i+')" style="width:auto;padding:4px 8px;">×</button></div>'+
    '</div>';
  }).join('');
}
function addHouseholdMemberRow(){
  var members=collectHouseholdFromEditor();
  members.push({name:'',relation:'Child',birthDate:''});
  renderHouseholdEditor(members);
}
function removeHouseholdMemberRow(idx){
  var members=collectHouseholdFromEditor();
  members.splice(idx,1);
  renderHouseholdEditor(members);
}
function collectHouseholdFromEditor(){
  var box=$('#resHouseholdList'); if(!box) return [];
  var rows=box.querySelectorAll('.hh-row');
  var out=[];
  rows.forEach(function(row){
    var name=(row.querySelector('.hh-name')&&row.querySelector('.hh-name').value.trim())||'';
    var relation=(row.querySelector('.hh-relation')&&row.querySelector('.hh-relation').value)||'';
    var birthDate=(row.querySelector('.hh-birth')&&row.querySelector('.hh-birth').value)||'';
    if(name) out.push({name:name,relation:relation,birthDate:birthDate});
  });
  return out;
}
try {
  window.renderHouseholdEditor = renderHouseholdEditor;
  window.addHouseholdMemberRow = addHouseholdMemberRow;
  window.removeHouseholdMemberRow = removeHouseholdMemberRow;
  window.collectHouseholdFromEditor = collectHouseholdFromEditor;
} catch(e){}
function saveResident(){
  var id=$('#resId').value?parseInt($('#resId').value):null;
  var obj={ firstName:$('#resFirstName').value.trim(), lastName:$('#resLastName').value.trim(), middleName:$('#resMiddleName').value.trim(), birthDate:$('#resBirthDate').value, gender:$('#resGender').value, civilStatus:$('#resCivilStatus').value, address:$('#resAddress').value.trim(), purok:$('#resPurok').value.trim(), contact:$('#resContact').value.trim(), occupation:$('#resOccupation').value.trim(), proof:$('#resProof').value.trim(), voter:$('#resVoter').checked, senior:$('#resSenior').checked, pwd:$('#resPwd').checked, status:'Active', householdMembers:collectHouseholdFromEditor() };
  if(!obj.firstName||!obj.lastName||!obj.address){ showToast('Fill required fields','error'); return; }
  // Auto-set senior if age >= 60
  var age = calcAge(obj.birthDate);
  if(age !== null && age >= 60) obj.senior = true;
  if(id){
    var idx=data.residents.findIndex(function(r){return r.id===id;});
    data.residents[idx]=Object.assign({},data.residents[idx],obj);
    showToast('Resident updated');
  } else {
    obj.id=nextId(data.residents); obj.registered=today();
    obj.verified=false; obj.verifiedBy=null; obj.verifiedDate=null;
    obj.nationalId=null; obj.idVerified=false; obj.idVerifiedDate=null; obj.idImage=null;
    data.residents.push(obj);
    renumberResidents();
    addNotif('New Resident',obj.firstName+' '+obj.lastName+' needs residency verification','warning','Secretary');
    showToast('Resident added');
  }
  saveData(); closeModal('residentModal'); renderResidents();
}
function editResident(id){ openResidentModal(id); }
function deleteResident(id){
  openConfirmModal({
    title: 'Delete Resident',
    message: 'Delete this resident and related records? This cannot be undone.',
    okLabel: 'Delete',
    variant: 'danger',
    onConfirm: function(){
      data.residents=data.residents.filter(function(r){return r.id!==id;});
      data.documents=data.documents.filter(function(d){return d.residentId!==id;});
      data.payments=data.payments.filter(function(p){return p.residentId!==id;});
      data.users=data.users.filter(function(u){return u.residentId!==id;});
      data.notifications=data.notifications.filter(function(n){return n.residentId!==id;});
      var idMap={};
      data.residents.forEach(function(r,i){ idMap[r.id]=i+1; r.id=i+1; });
      data.documents.forEach(function(d){ if(idMap[d.residentId]) d.residentId=idMap[d.residentId]; });
      data.payments.forEach(function(p){ if(idMap[p.residentId]) p.residentId=idMap[p.residentId]; });
      data.notifications.forEach(function(n){ if(n.residentId&&idMap[n.residentId]) n.residentId=idMap[n.residentId]; });
      data.users.forEach(function(u){ if(u.residentId&&idMap[u.residentId]) u.residentId=idMap[u.residentId]; });
      saveData(); syncProfilingStats(); showToast('Resident deleted — numbering updated'); renderResidents();
    }
  });
}

/* ===== SECRETARY ===== */
/* ===== BLUEPRINT: F. SECRETARY REVIEW & ENDORSEMENT ===== */
function renderSecretary(){
  var unverified=data.residents.filter(function(r){return !r.verified;});
  var pendingDocs=data.documents.filter(function(d){return d.status==='Pending'||d.status==='Under Review';});
  $('#secStatPendingRes').textContent=unverified.length;
  $('#secStatPendingDocs').textContent=pendingDocs.length;
  $('#secStatVerified').textContent=data.residents.filter(function(r){return r.verified;}).length;
  $('#secPendingResTable').innerHTML=unverified.map(function(r,idx){
    return '<tr><td>'+(idx+1)+'</td><td class="td-photo">'+residentPhotoHtml(r,'sm')+'</td><td><strong>'+r.lastName+', '+r.firstName+'</strong></td><td>'+(r.purok||'—')+'</td><td>'+r.address+'</td><td>'+(r.proof||'None')+'</td><td>'+(r.idVerified?'<span class="badge badge-success">ID ✓ '+(r.nationalId||'')+'</span>':'<span class="badge badge-warning">No ID</span>')+'</td><td><button class="btn btn-sm btn-outline" onclick="viewResidentDetail('+r.id+')">Review</button> '+(r.idVerified?'<button class="btn btn-sm btn-success" onclick="verifyResident('+r.id+')">✓ Verify</button>':'<button class="btn btn-sm btn-secondary" disabled title="Resident must scan National ID first">Verify</button>')+'</td></tr>';
  }).join('')||'<tr><td colspan="8" class="empty-state">No pending residents</td></tr>';
  $('#secPendingDocsTable').innerHTML=pendingDocs.map(function(d){
    var res=data.residents.find(function(x){return x.id===d.residentId;});
    var canEndorse=res&&res.verified;
    var requesterCell=getResidentName(d.residentId)+(res&&!res.verified?' <span class="badge badge-danger">Unverified</span>':'')+(d.onBehalfOf?'<br><span style="font-size:11px;color:#c2410c;">on behalf of: '+(d.applicantName||'')+'</span>':'');
    return '<tr><td>'+d.id+'</td><td>'+d.type+'</td><td>'+requesterCell+'</td><td>'+d.purpose+'</td><td>'+statusBadge(d.status)+'</td><td>'+formatDate(d.requestDate)+'</td><td>'+(d.status==='Pending'?'<button class="btn btn-sm btn-info" onclick="startReview('+d.id+')">Start Review</button> ':'')+(d.status==='Under Review'&&canEndorse?'<button class="btn btn-sm btn-success" onclick="endorseDocument('+d.id+')">✓ Endorse</button> ':'')+(d.status==='Under Review'&&!canEndorse?'<span class="badge badge-warning">Resident not verified</span> ':'')+'<button class="btn btn-sm btn-outline" onclick="viewDocument('+d.id+')">View</button> <button class="btn btn-sm btn-danger" onclick="deleteDocument('+d.id+')">Delete</button></td></tr>';
  }).join('')||'<tr><td colspan="7" class="empty-state">No pending requests</td></tr>';
  renderPendingRegistrations();
  try { renderSecReport(); } catch(e){ console.warn(e); }
}

/* ===== PROFILE STATS (auto from verified residents) ===== */
function syncProfilingStats(){
  if(!data.profiling) data.profiling = {};
  var verified = data.residents.filter(function(r){ return r.verified; });
  data.profiling.population = verified.length;
  var homes = {};
  verified.forEach(function(r){
    var key = String(r.address || '').toLowerCase().trim() + '|' + String(r.purok || '').toLowerCase().trim();
    if(key !== '|') homes[key] = true;
  });
  data.profiling.households = Object.keys(homes).length;
  // Keep form fields in sync if profiling module is open
  if($('#profPopulation')) $('#profPopulation').value = data.profiling.population;
  if($('#profHouseholds')) $('#profHouseholds').value = data.profiling.households;
}

function verifyResident(id){
  var r=data.residents.find(function(x){return x.id===id;}); if(!r)return;
  if(!r.idVerified){
    openConfirmModal({
      title: 'Verify Without National ID',
      message: 'This resident has not scanned a National ID yet. Verify residency anyway?',
      okLabel: 'Verify Anyway',
      variant: 'warn',
      onConfirm: function(){ _verifyResidentContinue(id); }
    });
    return;
  }
  _verifyResidentContinue(id);
  return;
}
function _verifyResidentContinue(id){
  var r=data.residents.find(function(x){return x.id===id;}); if(!r)return;
  var wasVerified = !!r.verified;
  r.verified=true; r.verifiedBy=data.currentUser.name; r.verifiedDate=today();
  if(!r.proof) r.proof='Verified by Secretary';
  // Auto-place into a Purok section (normalize / ask if missing)
  var pk = normalizePurok(r.purok);
  if(!pk || pk === 'Unassigned' || PUROK_LIST.indexOf(pk) < 0){
    var choices = PUROK_LIST.map(function(p,i){ return (i+1)+' = '+p; }).join('\n');
    var input = prompt('Select purok for this resident:\n'+choices, '1');
    var n = parseInt(String(input||'').replace(/\D/g,''), 10);
    if(!(n >= 1 && n <= 7)) n = 1;
    pk = PUROK_LIST[n-1];
  }
  r.purok = pk;
  syncProfilingStats();
  addNotif('Residency Verified','Your residency was verified. You can now request barangay documents.','success','Resident',r.id,'account');
  saveData();
  showToast(wasVerified
    ? 'Already verified — filed under '+r.purok+' (Population: '+data.profiling.population+')'
    : 'Verified and added to '+r.purok+' — Population: '+data.profiling.population+', Households: '+data.profiling.households);
  renderSecretary(); updateNotifBadge();
  try { renderPurokResidentRecords(); } catch(e){}
  if($('#module-residents')&&$('#module-residents').classList.contains('active')){
    try { renderResidents(); } catch(e){}
  }
  if($('#module-profiling')&&$('#module-profiling').classList.contains('active')) renderProfiling();
}
function startReview(id){
  var d=data.documents.find(function(x){return x.id===id;}); if(!d)return;
  d.status='Under Review';
  addNotif('Under Review','Your '+d.type+' is under review','info','Resident',d.residentId,'document');
  saveData(); showToast('Under Review'); renderSecretary(); updateNotifBadge();
}
function endorseDocument(id){
  var d=data.documents.find(function(x){return x.id===id;}); if(!d)return;
  var res=data.residents.find(function(x){return x.id===d.residentId;});
  if(!res||!res.verified){ showToast('Resident not verified','error'); return; }
  d.endorsedBy=data.currentUser.name; d.endorsedDate=today();
  d.fee=getDocFee(d.type);
  if(d.fee>0){
    d.status='Payment Pending'; d.paid=false;
    data.payments.push({id:nextId(data.payments),documentId:d.id,residentId:d.residentId,type:d.type+' Fee',amount:d.fee,orNumber:null,date:today(),status:'Pending',verified:false,verifiedBy:null,verifiedDate:null,paymentMethod:null,gcashRef:null});
    addNotif('Payment Required','Pay ₱'+d.fee+' for '+d.type+' via GCash to '+data.gcashAccount.number,'warning','Resident',d.residentId,'payment');
    addNotif('Payment Pending',d.type+' fee ₱'+d.fee+' — verify after resident pays','warning','Treasurer',null,'payment');
    addNotif('Endorsed — Awaiting Payment','Your '+d.type+' was endorsed. Please pay ₱'+d.fee+'.','info','Resident',d.residentId,'document');
  } else {
    // Free document: auto-release after Secretary endorsement (no Captain verify)
    d.status='Released'; d.paid=true; d.releaseDate=today();
    d.orNumber=d.orNumber||('OR-'+new Date().getFullYear()+'-'+String(d.id).padStart(4,'0'));
    d.approvedBy=data.currentUser.name; d.approvedDate=today();
    attachPdfAssetToDocument(d);
    addNotif('Document Ready','Your '+d.type+' was released. The linked PDF is available in My Requests.','success','Resident',d.residentId,'document');
    addNotif('Document Auto-Released',d.type+' for '+getResidentName(d.residentId)+' released (free document)','info','Captain',null,'document');
  }
  saveData(); showToast(d.fee>0?'Endorsed — awaiting resident payment & Treasurer verification':'Endorsed & released (free) — resident can open PDF'); renderSecretary(); updateNotifBadge();
}
function viewResidentDetail(id){
  var r=data.residents.find(function(x){return x.id===id;}); if(!r)return;
  var ver=r.verified?'<span class="badge badge-success">Verified</span> by '+(r.verifiedBy||'')+(r.verifiedDate?' on '+formatDate(r.verifiedDate):''):'<span class="badge badge-warning">Pending Verification</span>';
  var idv=r.idVerified?'<span class="badge badge-success">ID Scanned ✓</span>':'<span class="badge badge-warning">No ID uploaded</span>';
  var idImg=r.idImage
    ? '<div class="id-preview-box"><p style="font-size:12px;font-weight:600;margin-bottom:8px;">📷 Scanned / Uploaded National ID</p><img src="'+r.idImage+'" alt="National ID"></div>'
    : '<p style="font-size:13px;color:#6b7280;margin-top:8px;">No ID image on file. Resident must scan or upload National ID in My Profile.</p>';
  var ocrBlock='';
  if(r.idVerified||r.nationalId||r.ocrName||r.idImage){
    ocrBlock='<div style="margin-top:14px;padding:12px;background:#F0FDFA;border:1px solid #99F6E4;border-radius:10px;">'+
      '<p style="font-size:13px;font-weight:700;color:#115E59;margin-bottom:8px;">🪪 ID Information — verify using the uploaded ID image above</p>'+
      '<div class="form-row">'+
      '<div class="form-group"><label>National ID Number</label><p><strong>'+(r.nationalId||'—')+'</strong></p></div>'+
      '<div class="form-group"><label>Name on ID</label><p><strong>'+(r.ocrName||'—')+'</strong></p></div>'+
      '<div class="form-group"><label>ID Submitted</label><p>'+formatDate(r.idVerifiedDate)+'</p></div>'+
      '</div></div>';
  }
  var actions='';
  if(!r.verified){
    actions='<div style="margin-top:16px;"><button class="btn btn-success" style="width:auto;" onclick="closeModal(\'secDetailModal\');verifyResident('+r.id+')">✓ Verify Residency (after reviewing ID)</button></div>';
  }
  var fullName = (r.firstName+' '+(r.middleName||'')+' '+r.lastName).replace(/\s+/g,' ').trim();
  var photoBlock = '<div class="res-detail-hero">'+residentPhotoHtml(r,'lg')+
    '<div class="res-detail-meta"><h3 style="margin:0 0 6px;">'+fullName+'</h3>'+
    '<p style="margin:0 0 6px;color:#5A7B76;font-size:13px;">'+(r.purok||'Unassigned')+(r.address?(' · '+r.address):'')+'</p>'+
    '<div style="display:flex;flex-wrap:wrap;gap:6px;">'+ver+' '+idv+'</div></div></div>';
  var members = ensureHousehold(r);
  var hhHtml = members.length
    ? '<div style="margin-top:12px;"><label style="font-weight:600;font-size:13px;">Household Members ('+members.length+')</label>'+
      '<div class="table-responsive" style="margin-top:6px;"><table style="font-size:13px;"><thead><tr><th>Name</th><th>Relation</th><th>Birth Date</th><th>Age</th></tr></thead><tbody>'+
      members.map(function(m){
        return '<tr><td>'+(m.name||'—')+'</td><td>'+(m.relation||'—')+'</td><td>'+(m.birthDate?formatDate(m.birthDate):'—')+'</td><td>'+formatAge(m.birthDate)+'</td></tr>';
      }).join('')+
      '</tbody></table></div></div>'
    : '<p style="margin-top:10px;font-size:13px;color:#6b7280;">No household members recorded.</p>';
  var editBtn = (role()==='Admin'||role()==='Secretary')
    ? '<button class="btn btn-sm btn-outline" style="width:auto;margin-left:8px;" onclick="closeModal(\'secDetailModal\');editResident('+r.id+')">✎ Edit Info</button>'
    : '';
  $('#secDetailBody').innerHTML=
    photoBlock+
    '<div class="form-row"><div class="form-group"><label>Gender</label><p>'+(r.gender||'—')+'</p></div>'+
    '<div class="form-group"><label>Civil Status</label><p>'+(r.civilStatus||'—')+'</p></div>'+
    '<div class="form-group"><label>Birth Date</label><p>'+(r.birthDate?formatDate(r.birthDate):'—')+'</p></div>'+
    '<div class="form-group"><label>Age</label><p><strong>'+formatAge(r.birthDate)+'</strong></p></div></div>'+
    '<div class="form-row"><div class="form-group"><label>Contact</label><p>'+(r.contact||'—')+'</p></div>'+
    '<div class="form-group"><label>Occupation</label><p>'+(r.occupation||'—')+'</p></div>'+
    '<div class="form-group"><label>National ID</label><p>'+(r.nationalId||'—')+'</p></div></div>'+
    '<div class="form-group"><label>Address</label><p>'+(r.address||'—')+'</p></div>'+
    '<div class="form-row"><div class="form-group"><label>Proof of Residency</label><p>'+(r.proof||'None')+'</p></div>'+
    '<div class="form-group"><label>Residency Status</label><p>'+ver+'</p></div>'+
    '<div class="form-group"><label>ID Status</label><p>'+idv+'</p></div></div>'+
    hhHtml+
    idImg+ocrBlock+
    '<div style="margin-top:12px;display:flex;flex-wrap:wrap;gap:8px;align-items:center;">'+
      (r.verified?'':'<button class="btn btn-success" style="width:auto;" onclick="closeModal(\'secDetailModal\');verifyResident('+r.id+')">✓ Verify Residency (after reviewing ID)</button>')+
      editBtn+
    '</div>';
  $('#secDetailModal').classList.add('active');
}

/* ===== TREASURER + GCASH ===== */
/* ===== BLUEPRINT: G. TREASURER / PAYMENTS ===== */
function renderTreasurer(){
  var pending=data.payments.filter(function(p){return p.status==='Pending';});
  var collected=data.payments.filter(function(p){return p.status==='Paid'&&p.verified;}).reduce(function(s,p){return s+p.amount;},0);
  $('#treasStatPending').textContent=pending.length;
  $('#treasStatCollected').textContent='₱'+collected.toFixed(2);
  if($('#gcashNumber')) $('#gcashNumber').textContent=data.gcashAccount.number;
  if($('#gcashName')) $('#gcashName').textContent=data.gcashAccount.name;
  $('#treasPendingTable').innerHTML=pending.map(function(p){
    var proofNote = p.gcashRef
      ? '<div style="margin-top:4px;font-size:11px;color:#1d4ed8;"><strong>GCash Ref:</strong> '+p.gcashRef+' <span class="badge badge-warning">Proof submitted — review in GCash</span></div>'
      : '<div style="margin-top:4px;font-size:11px;color:#6b7280;">No proof yet (cash or awaiting resident)</div>';
    var btnLabel = p.gcashRef ? 'Verify GCash Payment' : 'Collect (Cash/GCash)';
    return '<tr><td>'+p.id+'</td><td>'+getResidentName(p.residentId)+'</td><td>'+p.type+proofNote+'</td><td><strong>₱'+p.amount.toFixed(2)+'</strong></td><td>'+formatDate(p.date)+'</td><td><button class="btn btn-sm btn-success" onclick="openCollectModal('+p.id+')">'+btnLabel+'</button> <button class="btn btn-sm btn-danger" onclick="deletePayment('+p.id+')">Delete</button></td></tr>';
  }).join('')||'<tr><td colspan="6" class="empty-state">No pending payments</td></tr>';
  $('#treasAllTable').innerHTML=data.payments.map(function(p,idx){
    var method=p.paymentMethod?' <span class="badge badge-info">'+p.paymentMethod+'</span>':'';
    if(p.gcashRef) method+=' <small>'+p.gcashRef+'</small>';
    var btn=p.status==='Pending'?(p.gcashRef?'<button class="btn btn-sm btn-success" onclick="openCollectModal('+p.id+')">Verify GCash</button> ':'<button class="btn btn-sm btn-success" onclick="openCollectModal('+p.id+')">Collect</button> '):'';
    var rcpt=(p.status==='Paid')?(' <button class="btn btn-sm btn-outline" onclick="openPaymentReceipt('+p.id+')"><i class="fas fa-receipt"></i> Receipt</button>'):'';
    return '<tr><td>'+(idx+1)+'</td><td>'+getResidentName(p.residentId)+'</td><td>'+p.type+'</td><td>₱'+p.amount.toFixed(2)+'</td><td>'+(p.orNumber||'—')+'</td><td>'+formatDate(p.date)+'</td><td>'+statusBadge(p.status)+method+'</td><td>'+btn+rcpt+'<button class="btn btn-sm btn-danger" onclick="deletePayment('+p.id+')">Delete</button></td></tr>';
  }).join('')||'<tr><td colspan="8">No payments</td></tr>';
  renderTreasReport();
}
function getFilteredTreasPayments(){
  var from=$('#treasReportFrom')&&$('#treasReportFrom').value||'';
  var to=$('#treasReportTo')&&$('#treasReportTo').value||'';
  var st=$('#treasReportStatus')&&$('#treasReportStatus').value||'all';
  var meth=$('#treasReportMethod')&&$('#treasReportMethod').value||'all';
  return data.payments.filter(function(p){
    if(from && p.date < from) return false;
    if(to && p.date > to) return false;
    if(st!=='all' && p.status!==st) return false;
    if(meth!=='all'){
      var m=p.paymentMethod||'';
      if(meth==='GCash' && m!=='GCash') return false;
      if(meth==='Cash' && m!=='Cash') return false;
    }
    return true;
  });
}
function renderTreasReport(){
  if(!$('#treasReportTable')) return;
  var list=getFilteredTreasPayments();
  var total=0, gcash=0, cash=0, paid=0, pending=0, paidAmt=0;
  var byType={}, byMonth={};
  list.forEach(function(p){
    var amt=p.amount||0;
    total+=amt;
    if(p.paymentMethod==='GCash') gcash+=amt;
    if(p.paymentMethod==='Cash') cash+=amt;
    if(p.status==='Paid'){ paid++; paidAmt+=amt; }
    if(p.status==='Pending') pending++;
    var t=p.type||'Other';
    byType[t]=(byType[t]||0)+amt;
    var m=(p.date||'').slice(0,7) || 'Unknown';
    if(!byMonth[m]) byMonth[m]={count:0,amount:0};
    byMonth[m].count++;
    byMonth[m].amount+=amt;
  });
  if($('#trStatTotal')) $('#trStatTotal').textContent='₱'+total.toFixed(2);
  if($('#trStatCount')) $('#trStatCount').textContent=list.length;
  if($('#trStatGcash')) $('#trStatGcash').textContent='₱'+gcash.toFixed(2);
  if($('#trStatCash')) $('#trStatCash').textContent='₱'+cash.toFixed(2);
  if($('#trStatPaid')) $('#trStatPaid').textContent='₱'+paidAmt.toFixed(2);
  if($('#trStatPending')) $('#trStatPending').textContent=pending;
  if($('#trStatAvg')) $('#trStatAvg').textContent=list.length?('₱'+(total/list.length).toFixed(2)):'₱0.00';
  if($('#trStatPaidCount')) $('#trStatPaidCount').textContent=paid;

  // Analytics: by type
  var typeKeys=Object.keys(byType).sort(function(a,b){return byType[b]-byType[a];});
  var maxType=typeKeys.length?byType[typeKeys[0]]:1;
  if($('#treasByType')){
    $('#treasByType').innerHTML=typeKeys.length?typeKeys.map(function(k){
      var pct=Math.round((byType[k]/maxType)*100);
      return '<div class="analytic-row"><div class="analytic-label">'+k+'</div><div class="analytic-bar-wrap"><div class="analytic-bar" style="width:'+pct+'%"></div></div><div class="analytic-val">₱'+byType[k].toFixed(2)+'</div></div>';
    }).join(''):'<p class="notif-empty">No type data yet</p>';
  }
  // Analytics: by month
  var monthKeys=Object.keys(byMonth).sort();
  var maxMonth=1;
  monthKeys.forEach(function(k){ if(byMonth[k].amount>maxMonth) maxMonth=byMonth[k].amount; });
  if($('#treasByMonth')){
    $('#treasByMonth').innerHTML=monthKeys.length?monthKeys.map(function(k){
      var pct=Math.round((byMonth[k].amount/maxMonth)*100);
      return '<div class="analytic-row"><div class="analytic-label">'+k+'</div><div class="analytic-bar-wrap"><div class="analytic-bar" style="width:'+pct+'%"></div></div><div class="analytic-val">₱'+byMonth[k].amount.toFixed(2)+' <small>('+byMonth[k].count+')</small></div></div>';
    }).join(''):'<p class="notif-empty">No monthly history yet</p>';
  }

  $('#treasReportTable').innerHTML=list.map(function(p,idx){
    var ref=(p.orNumber||'')+(p.gcashRef?(' / '+p.gcashRef):'') || '—';
    if(ref==='') ref='—';
    return '<tr><td>'+(idx+1)+'</td><td>'+formatDate(p.date)+'</td><td>'+getResidentName(p.residentId)+'</td><td>'+p.type+'</td><td>'+(p.paymentMethod||'—')+'</td><td>'+ref+'</td><td><strong>₱'+(p.amount||0).toFixed(2)+'</strong></td><td>'+statusBadge(p.status)+'</td></tr>';
  }).join('')||'<tr><td colspan="8" class="empty-state">No transactions match the filters — history will appear as payments are collected</td></tr>';
  drawTreasCharts(byType, byMonth);
}


function drawTreasCharts(byType, byMonth){
  drawBarChart('treasChartType', byType, '₱');
  drawBarChart('treasChartMonth', Object.keys(byMonth).sort().reduce(function(o,k){ o[k]=byMonth[k].amount; return o; }, {}), '₱');
}
function drawBarChart(canvasId, dataMap, prefix){
  var canvas = document.getElementById(canvasId);
  if(!canvas || !canvas.getContext) return;
  var keys = Object.keys(dataMap||{});
  var ctx = canvas.getContext('2d');
  var w = canvas.width = canvas.clientWidth || 400;
  var h = canvas.height = 180;
  var dark = document.documentElement.getAttribute('data-theme')==='dark';
  ctx.clearRect(0,0,w,h);
  ctx.fillStyle = dark ? '#111827' : '#f8fafc';
  ctx.fillRect(0,0,w,h);
  if(!keys.length){
    ctx.fillStyle = dark ? '#94a3b8' : '#64748b';
    ctx.font = '13px Segoe UI,sans-serif';
    ctx.textAlign = 'center';
    ctx.fillText('No data yet — collect payments to see charts', w/2, h/2);
    return;
  }
  var vals = keys.map(function(k){ return dataMap[k]||0; });
  var max = Math.max.apply(null, vals.concat([1]));
  var padL = 40, padR = 12, padT = 16, padB = 40;
  var chartW = w - padL - padR, chartH = h - padT - padB;
  var barW = Math.min(48, chartW / keys.length * 0.6);
  var gap = chartW / keys.length;
  // axes
  ctx.strokeStyle = dark ? '#334155' : '#cbd5e1';
  ctx.beginPath(); ctx.moveTo(padL, padT); ctx.lineTo(padL, padT+chartH); ctx.lineTo(padL+chartW, padT+chartH); ctx.stroke();
  keys.forEach(function(k,i){
    var v = dataMap[k]||0;
    var bh = (v/max) * chartH;
    var x = padL + gap*i + (gap-barW)/2;
    var y = padT + chartH - bh;
    var grd = ctx.createLinearGradient(0,y,0,y+bh);
    grd.addColorStop(0, '#38bdf8'); grd.addColorStop(1, '#1d4ed8');
    ctx.fillStyle = grd;
    ctx.fillRect(x, y, barW, bh);
    ctx.fillStyle = dark ? '#e2e8f0' : '#334155';
    ctx.font = '10px Segoe UI,sans-serif';
    ctx.textAlign = 'center';
    var label = k.length > 10 ? k.slice(0,9)+'…' : k;
    ctx.fillText(label, x+barW/2, padT+chartH+14);
    ctx.fillStyle = dark ? '#93c5fd' : '#1d4ed8';
    ctx.fillText((prefix||'')+Number(v).toFixed(0), x+barW/2, y-4);
  });
}

function printTreasReport(){
  var list=getFilteredTreasPayments();
  var total=list.reduce(function(s,p){return s+(p.amount||0);},0);
  var rows=list.map(function(p,i){
    return '<tr><td>'+(i+1)+'</td><td>'+formatDate(p.date)+'</td><td>'+getResidentName(p.residentId)+'</td><td>'+p.type+'</td><td>'+(p.paymentMethod||'—')+'</td><td>'+(p.orNumber||p.gcashRef||'—')+'</td><td>₱'+(p.amount||0).toFixed(2)+'</td><td>'+p.status+'</td></tr>';
  }).join('');
  var w=window.open('','_blank');
  w.document.write('<html><head><title>Payment Transaction Report</title><style>body{font-family:Segoe UI,sans-serif;padding:24px;} table{width:100%;border-collapse:collapse;margin-top:16px;} th,td{border:1px solid #cbd5e1;padding:8px;font-size:12px;text-align:left;} th{background:#1e3a8a;color:#fff;} h1{color:#1e3a8a;font-size:18px;} .meta{color:#64748b;font-size:13px;}</style></head><body>');
  w.document.write('<h1>E-Barangay Dumanguena — Payment Transaction Report</h1>');
  w.document.write('<p class="meta">Generated: '+new Date().toLocaleString()+' · Transactions: '+list.length+' · Total: ₱'+total.toFixed(2)+'</p>');
  w.document.write('<table><thead><tr><th>#</th><th>Date</th><th>Resident</th><th>Type</th><th>Method</th><th>OR/Ref</th><th>Amount</th><th>Status</th></tr></thead><tbody>'+rows+'</tbody></table>');
  w.document.write('<script>window.onload=function(){window.print();}</script></body></html>');
  w.document.close();
}
/* ===== SECRETARY DOCUMENT TRANSACTION REPORT ===== */
function getFilteredSecDocuments(){
  var from = ($('#secReportFrom') && $('#secReportFrom').value) || '';
  var to = ($('#secReportTo') && $('#secReportTo').value) || '';
  var st = ($('#secReportStatus') && $('#secReportStatus').value) || 'all';
  var typ = ($('#secReportType') && $('#secReportType').value) || 'all';
  return (data.documents || []).filter(function(d){
    var dt = d.requestDate || '';
    if(from && dt < from) return false;
    if(to && dt > to) return false;
    if(st !== 'all' && d.status !== st) return false;
    if(typ !== 'all' && d.type !== typ) return false;
    return true;
  }).slice().sort(function(a,b){ return String(b.requestDate||'').localeCompare(String(a.requestDate||'')); });
}
function renderSecReport(){
  if(!$('#secReportTable')) return;
  // Populate type filter options once
  var typeSel = $('#secReportType');
  if(typeSel && typeSel.options.length <= 1){
    var types = {};
    (data.documents || []).forEach(function(d){ if(d.type) types[d.type] = true; });
    getDocTypes().forEach(function(t){ types[t.name] = true; });
    Object.keys(types).sort().forEach(function(name){
      var opt = document.createElement('option');
      opt.value = name; opt.textContent = name;
      typeSel.appendChild(opt);
    });
  }
  var list = getFilteredSecDocuments();
  var pending = list.filter(function(d){ return d.status === 'Pending' || d.status === 'Under Review'; }).length;
  var payPend = list.filter(function(d){ return d.status === 'Payment Pending'; }).length;
  var released = list.filter(function(d){ return d.status === 'Released'; }).length;
  var rejected = list.filter(function(d){ return d.status === 'Rejected'; }).length;
  var totalFee = list.reduce(function(s,d){ return s + (Number(d.fee) || 0); }, 0);
  var stats = $('#secReportStats');
  if(stats){
    stats.innerHTML =
      '<div class="stat-card" style="padding:12px;"><div class="stat-info"><h3 style="margin:0;">'+list.length+'</h3><p style="margin:0;">Total Requests</p></div></div>'+
      '<div class="stat-card" style="padding:12px;"><div class="stat-info"><h3 style="margin:0;">'+pending+'</h3><p style="margin:0;">Pending / Review</p></div></div>'+
      '<div class="stat-card" style="padding:12px;"><div class="stat-info"><h3 style="margin:0;">'+payPend+'</h3><p style="margin:0;">Payment Pending</p></div></div>'+
      '<div class="stat-card" style="padding:12px;"><div class="stat-info"><h3 style="margin:0;">'+released+'</h3><p style="margin:0;">Released</p></div></div>'+
      '<div class="stat-card" style="padding:12px;"><div class="stat-info"><h3 style="margin:0;">'+rejected+'</h3><p style="margin:0;">Rejected</p></div></div>'+
      '<div class="stat-card" style="padding:12px;"><div class="stat-info"><h3 style="margin:0;">₱'+totalFee.toFixed(2)+'</h3><p style="margin:0;">Total Fees</p></div></div>';
  }
  $('#secReportTable').innerHTML = list.map(function(d, idx){
    return '<tr><td>'+(idx+1)+'</td><td>'+formatDate(d.requestDate)+'</td><td>'+d.type+'</td><td>'+getResidentName(d.residentId)+'</td><td>'+(d.purpose||'—')+'</td><td>₱'+(Number(d.fee)||0).toFixed(2)+'</td><td>'+statusBadge(d.status)+'</td><td>'+(d.endorsedBy||'—')+'</td></tr>';
  }).join('') || '<tr><td colspan="8" class="empty-state">No document transactions match the filters</td></tr>';
}
function printSecReport(){
  var list = getFilteredSecDocuments();
  var from = ($('#secReportFrom') && $('#secReportFrom').value) || '—';
  var to = ($('#secReportTo') && $('#secReportTo').value) || '—';
  var w = window.open('', '_blank');
  if(!w){ showToast('Allow pop-ups to print report','error'); return; }
  w.document.write('<html><head><title>Document Transaction Report</title><style>body{font-family:Segoe UI,sans-serif;padding:24px;} table{width:100%;border-collapse:collapse;margin-top:16px;} th,td{border:1px solid #cbd5e1;padding:8px;font-size:12px;text-align:left;} th{background:#0f766e;color:#fff;} h1{color:#0f766e;font-size:18px;} .meta{color:#64748b;font-size:13px;}</style></head><body>');
  w.document.write('<h1>E-Barangay Dumanguena — Secretary Document Transaction Report</h1>');
  w.document.write('<p class="meta">Period: '+from+' to '+to+' · Generated: '+new Date().toLocaleString()+' · Total: '+list.length+'</p>');
  w.document.write('<table><thead><tr><th>#</th><th>Date</th><th>Type</th><th>Resident</th><th>Purpose</th><th>Fee</th><th>Status</th><th>Endorsed By</th></tr></thead><tbody>');
  list.forEach(function(d, idx){
    w.document.write('<tr><td>'+(idx+1)+'</td><td>'+(d.requestDate||'')+'</td><td>'+d.type+'</td><td>'+getResidentName(d.residentId)+'</td><td>'+(d.purpose||'')+'</td><td>PHP '+(Number(d.fee)||0).toFixed(2)+'</td><td>'+(d.status||'')+'</td><td>'+(d.endorsedBy||'')+'</td></tr>');
  });
  w.document.write('</tbody></table></body></html>');
  w.document.close();
  setTimeout(function(){ try{ w.print(); }catch(e){} }, 400);
}
try { window.renderSecReport = renderSecReport; window.printSecReport = printSecReport; } catch(e){}


function openCollectModal(id){
  var p=data.payments.find(function(x){return x.id===id;}); if(!p)return;
  $('#collectPayId').value=id;
  $('#collectAmount').textContent='₱'+p.amount.toFixed(2);
  $('#collectResident').textContent=getResidentName(p.residentId);
  $('#collectType').textContent=p.type;
  // Prefer GCash if resident already submitted proof
  $('#payMethod').value=p.paymentMethod||'GCash';
  $('#gcashRef').value=p.gcashRef||'';
  $('#gcashRefGroup').style.display=($('#payMethod').value==='GCash')?'block':'none';
  if($('#gcashDisplayNum')) $('#gcashDisplayNum').textContent=data.gcashAccount.number;
  if($('#gcashDisplayName')) $('#gcashDisplayName').textContent=data.gcashAccount.name;
  var guide = $('#collectGuide');
  if(guide){
    if(p.gcashRef){
      guide.innerHTML='<strong style="color:#1d4ed8;">Resident submitted proof of payment (GCash ref):</strong> <code>'+p.gcashRef+'</code><br><strong>Review muna</strong> this transaction in your GCash account. Kapag match na, click <strong>Verify &amp; Collect</strong>.';
      guide.style.display='block';
    } else {
      guide.innerHTML='Walang GCash proof pa mula sa resident. For <strong>Cash</strong>, select Cash then collect. For <strong>GCash</strong>, wait for the resident to submit their reference number first.';
      guide.style.display='block';
    }
  }
  $('#payCollectModal').classList.add('active');
}
function onPayMethodChange(){
  var m=$('#payMethod').value;
  $('#gcashRefGroup').style.display=m==='GCash'?'block':'none';
}
function confirmCollectPayment(){
  var id=parseInt($('#collectPayId').value);
  var p=data.payments.find(function(x){return x.id===id;}); if(!p)return;
  var method=$('#payMethod').value;
  var ref=$('#gcashRef').value.trim();
  if(method==='GCash'&&!ref){ showToast('Enter GCash reference number from the resident proof','error'); return; }
  // For GCash: Treasurer must review the ref in their GCash account before verifying
  if(method==='GCash'){
    if(!p.gcashRef && !ref){
      showToast('No GCash proof from resident yet. Wait for resident to submit reference number.','error');
      return;
    }
    if(p.gcashRef && !ref) ref = p.gcashRef;
  }
  p.status='Paid'; p.orNumber=p.orNumber||'OR-2026-'+String(id).padStart(3,'0');
  p.date=today(); p.verified=true; p.verifiedBy=data.currentUser.name; p.verifiedDate=today();
  p.paymentMethod=method; p.gcashRef=method==='GCash'?ref:null;
  if(p.documentId){
    var d=data.documents.find(function(x){return x.id===p.documentId;});
    if(d){
      d.paid=true;
      d.orNumber=p.orNumber;
      // Auto-release after Treasurer verifies payment (no Captain approval step)
      if(d.status==='Payment Pending' || d.status==='For Captain Approval' || d.status==='Approved'){
        d.status='Released';
        d.releaseDate=today();
        d.approvedBy=d.approvedBy||data.currentUser.name;
        d.approvedDate=d.approvedDate||today();
        attachPdfAssetToDocument(d);
        addNotif('Payment Received','Payment for '+d.type+' verified via '+method+'. Document released.','success','Resident',d.residentId,'payment');
        addNotif('Document Ready for Download','Your '+d.type+' is released. The linked PDF is available in My Requests.','success','Resident',d.residentId,'document');
        addNotif('Payment Verified & Released',d.type+' for '+getResidentName(d.residentId)+' — payment verified, document auto-released','info','Captain',null,'document');
        addNotif('Payment Verified',d.type+' fee collected ('+method+')','info','Secretary',null,'payment');
      }
    }
  }
  // Send official receipt to resident after Treasurer review
  p.receiptSent = true;
  p.receiptSentDate = today();
  var resName = getResidentName(p.residentId);
  var orNo = p.orNumber || ('OR-'+new Date().getFullYear()+'-'+String(p.id).padStart(4,'0'));
  addNotif(
    'Payment Receipt Issued',
    'Your payment was verified by the Treasurer. OR No. '+orNo+' · ₱'+Number(p.amount||0).toFixed(2)+' ('+method+'). Open Portal → Payments to view/print your receipt.',
    'success',
    'Resident',
    p.residentId,
    'payment'
  );

  saveData(); closeModal('payCollectModal');
  showToast('Payment verified — receipt sent to resident');
  renderTreasurer(); updateNotifBadge();
  try { openPaymentReceipt(id); } catch(e){ console.warn(e); }
}
function deletePayment(id){
  openConfirmModal({
    title: 'Delete Payment',
    message: 'Delete this payment transaction? Linked document will revert to Payment Pending if needed.',
    okLabel: 'Delete',
    variant: 'danger',
    onConfirm: function(){
  var p=data.payments.find(function(x){return x.id===id;});
  if(p&&p.documentId){
    var d=data.documents.find(function(x){return x.id===p.documentId;});
    if(d&&(d.status==='For Captain Approval'||d.status==='Approved'||d.status==='Released')&&d.paid){
      d.paid=false; d.status='Payment Pending'; d.orNumber=null;
    }
  }
  data.payments=data.payments.filter(function(x){return x.id!==id;});
  // Auto-renumber payment IDs sequentially 1..N and fix document links
  var pmap={};
  data.payments.forEach(function(pay,i){ pmap[pay.id]=i+1; pay.id=i+1; });
  data.documents.forEach(function(d){ if(d.id && false){} }); // docs keep own ids
  // Fix documentId refs on payments already updated via pmap on self
  data.payments.forEach(function(pay){ /* ids already sequential */ });
  saveData(); showToast('Payment deleted — list renumbered');
  if($('#module-treasurer')&&$('#module-treasurer').classList.contains('active')) renderTreasurer();
  if($('#module-payments')&&$('#module-payments').classList.contains('active')) renderPayments();

    }
  });
}

/* ===== CAPTAIN ===== */
/* ===== BLUEPRINT: H. CAPTAIN APPROVAL / RELEASE ===== */
function renderCaptain(){
  var docs = data.documents.slice().sort(function(a,b){ return (b.requestDate||'').localeCompare(a.requestDate||''); });
  var pays = data.payments.slice().sort(function(a,b){ return (b.date||'').localeCompare(a.date||''); });
  var pending = docs.filter(function(d){ return ['Pending','Under Review','Payment Pending'].indexOf(d.status)>=0; });
  var released = docs.filter(function(d){ return d.status==='Released'; });
  var rejected = docs.filter(function(d){ return d.status==='Rejected'; });
  var paidAmt = pays.filter(function(p){ return p.status==='Paid'&&p.verified; }).reduce(function(s,p){ return s+(p.amount||0); },0);
  var pendingPay = pays.filter(function(p){ return p.status==='Pending'; }).length;
  var verifiedRes = data.residents.filter(function(r){ return r.verified; }).length;

  if($('#capStatPending')) $('#capStatPending').textContent = pending.length;
  if($('#capStatReleased')) $('#capStatReleased').textContent = released.length;
  if($('#capStatPayments')) $('#capStatPayments').textContent = '₱'+paidAmt.toFixed(2);
  if($('#capStatResidents')) $('#capStatResidents').textContent = verifiedRes;
  if($('#capStatRejected')) $('#capStatRejected').textContent = rejected.length;
  if($('#capStatPayPending')) $('#capStatPayPending').textContent = pendingPay;

  // All document transactions (review only)
  if($('#capDocsTable')){
    $('#capDocsTable').innerHTML = docs.map(function(d,idx){
      return '<tr><td>'+(idx+1)+'</td><td>'+d.type+'</td><td>'+getResidentName(d.residentId)+'</td><td>'+d.purpose+'</td><td>₱'+(d.fee||0).toFixed(2)+'</td><td>'+statusBadge(d.status)+'</td><td>'+formatDate(d.requestDate)+'</td><td>'+(d.endorsedBy||'—')+'</td><td>'+(d.orNumber||'—')+'</td><td><button class="btn btn-sm btn-outline" onclick="viewDocument('+d.id+')">View</button></td></tr>';
    }).join('') || '<tr><td colspan="10" class="empty-state">No document transactions yet</td></tr>';
  }

  // Payment transactions from Treasurer
  if($('#capPaysTable')){
    $('#capPaysTable').innerHTML = pays.map(function(p,idx){
      var m = p.paymentMethod ? '<span class="badge badge-info">'+p.paymentMethod+'</span>' : '—';
      return '<tr><td>'+(idx+1)+'</td><td>'+formatDate(p.date)+'</td><td>'+getResidentName(p.residentId)+'</td><td>'+p.type+'</td><td>₱'+(p.amount||0).toFixed(2)+'</td><td>'+m+'</td><td>'+(p.orNumber||p.gcashRef||'—')+'</td><td>'+statusBadge(p.status)+'</td><td>'+(p.verifiedBy||'—')+'</td></tr>';
    }).join('') || '<tr><td colspan="9" class="empty-state">No payment transactions yet</td></tr>';
  }

  // Recent activity feed (from notifications for officials)
  if($('#capActivityList')){
    var acts = (data.notifications||[]).filter(function(n){
      return n.forRole==='Captain' || n.forRole==='Secretary' || n.forRole==='Treasurer' || n.forRole==='Admin';
    }).slice(0,15);
    $('#capActivityList').innerHTML = acts.length ? acts.map(function(n){
      var cat = n.category==='payment'?'💰':n.category==='document'?'📄':'🔔';
      return '<li class="notif-item is-read"><div class="notif-icon" style="background:var(--primary-soft);color:var(--primary)">'+cat+'</div><div class="notif-content"><h4>'+escapeHtml(n.title)+'</h4><p>'+escapeHtml(n.message)+'</p><div class="notif-time">'+(n.time||'')+' · '+(n.forRole||'')+'</div></div></li>';
    }).join('') : '<div class="empty-state">No recent official activity</div>';
  }
}
function approveDocument(id){
  showToast('Captain approval step removed. Documents auto-release after Treasurer verifies payment (or free docs after Secretary endorse).','error');
}
function confirmApproveWithSig(){
  var id=parseInt($('#capApproveDocId').value);
  var d=data.documents.find(function(x){return x.id===id;}); if(!d)return;
  var sig = data.captainSignature;
  var canvas=$('#capApproveSigCanvas');
  if(canvas){
    // If user drew something (non-blank), use it
    var ctx=canvas.getContext('2d');
    var blank=true;
    try {
      var pixels=ctx.getImageData(0,0,canvas.width,canvas.height).data;
      for(var i=0;i<pixels.length;i+=4){ if(pixels[i+3]>10){ blank=false; break; } }
    } catch(e){}
    if(!blank) sig = canvas.toDataURL('image/png');
  }
  if(!sig){ showToast('Please draw or save an electronic signature first','error'); return; }
  d.status='Approved'; d.approvedBy=data.currentUser.name; d.approvedDate=today();
  d.signature=sig;
  addNotif('Document Approved','Your '+d.type+' was approved by the Captain and is ready for release.','success','Resident',d.residentId,'document');
  saveData(); closeModal('capApproveModal'); showToast('Approved with electronic signature');
  renderCaptain(); updateNotifBadge();
}
function rejectDocument(id){
  openConfirmModal({
    title: 'Reject Request',
    message: 'Reject this request?',
    okLabel: 'Reject',
    variant: 'warn',
    onConfirm: function(){
  var d=data.documents.find(function(x){return x.id===id;}); if(!d)return;
  d.status='Rejected';
  addNotif('Request Rejected','Your '+d.type+' was rejected','warning','Resident',d.residentId,'document');
  saveData(); showToast('Rejected'); renderCaptain(); updateNotifBadge();

    }
  });
}
function releaseDocument(id){
  showToast('Manual release removed. Documents are auto-released after Treasurer payment verification.','error');
}

/* ===== DOCUMENTS ===== */

/* ===== BLUEPRINT: H. DOCUMENT REQUEST MANAGEMENT ===== */
function renderDocuments(){
  var search=($('#docSearch')&&$('#docSearch').value||'').toLowerCase();
  var list=data.documents;
  if(search) list=list.filter(function(d){return d.type.toLowerCase().indexOf(search)>=0||getResidentName(d.residentId).toLowerCase().indexOf(search)>=0;});
  $('#documentsTable').innerHTML=list.map(function(d,idx){
    var actions='<button class="btn btn-sm btn-outline" onclick="viewDocument('+d.id+')">View PDF</button> ';
    if(d.status==='Released') actions+='<button class="btn btn-sm btn-success" onclick="sendDocumentPDF('+d.id+')">Send PDF</button> ';
    actions+='<button class="btn btn-sm btn-danger" onclick="deleteDocument('+d.id+')">Delete</button>';
    var requesterCell=getResidentName(d.residentId)+(d.onBehalfOf?'<br><span style="font-size:11px;color:#c2410c;">on behalf of: '+(d.applicantName||'')+'</span>':'');
    return '<tr><td>'+(idx+1)+'</td><td>'+d.type+'</td><td>'+requesterCell+'</td><td>'+d.purpose+'</td><td>'+statusBadge(d.status)+'</td><td>'+formatDate(d.requestDate)+'</td><td>'+(d.orNumber||'—')+'</td><td>'+actions+'</td></tr>';
  }).join('')||'<tr><td colspan="8">No documents</td></tr>';
}
function deleteDocument(id){
  openConfirmModal({
    title: 'Delete Document',
    message: 'Delete this document transaction? Related payments will also be removed.',
    okLabel: 'Delete',
    variant: 'danger',
    onConfirm: function(){
  data.payments=data.payments.filter(function(p){return p.documentId!==id;});
  data.documents=data.documents.filter(function(d){return d.id!==id;});
  // Auto-renumber documents 1..N and fix payment.documentId links
  var dmap={};
  data.documents.forEach(function(d,i){ dmap[d.id]=i+1; d.id=i+1; });
  data.payments.forEach(function(p){ if(p.documentId&&dmap[p.documentId]) p.documentId=dmap[p.documentId]; });
  // Renumber payments too
  data.payments.forEach(function(p,i){ p.id=i+1; });
  saveData(); showToast('Document deleted — lists renumbered');
  if($('#module-documents')&&$('#module-documents').classList.contains('active')) renderDocuments();
  if($('#module-secretary')&&$('#module-secretary').classList.contains('active')) renderSecretary();
  if($('#module-captain')&&$('#module-captain').classList.contains('active')) renderCaptain();
  if($('#module-treasurer')&&$('#module-treasurer').classList.contains('active')) renderTreasurer();

    }
  });
}

function fillResidentDocAutoFields(res){
  if(!res) return;
  var fullName = (res.firstName+' '+(res.middleName||'')+' '+res.lastName).replace(/\s+/g,' ').trim();
  if($('#docAutoName')) $('#docAutoName').textContent = fullName || '—';
  if($('#docAutoCivil')) $('#docAutoCivil').textContent = res.civilStatus || '—';
  if($('#docAutoAddress')) $('#docAutoAddress').textContent = res.address || '—';
  if($('#docAutoPurok')) $('#docAutoPurok').textContent = res.purok || '—';
  if($('#docAutoContact')) $('#docAutoContact').textContent = res.contact || '—';
  if($('#docAutoStatus')) $('#docAutoStatus').innerHTML = res.verified
    ? '<span class="badge badge-success">Verified Resident</span>'
    : '<span class="badge badge-warning">Pending Verification</span>';
  if($('#docResidentIdFixed')) $('#docResidentIdFixed').value = String(res.id);

  // Pre-fill address-related dynamic fields from profile
  var fullAddr = [res.address, res.purok ? ('Purok '+res.purok) : '', 'Barangay Dumanguena'].filter(Boolean).join(', ');
  if($('#docCompleteAddress') && !$('#docCompleteAddress').value) $('#docCompleteAddress').value = fullAddr;
  if($('#docBeneficiaryName') && !$('#docBeneficiaryName').value) $('#docBeneficiaryName').value = fullName;
  if($('#docBusinessAddress') && !$('#docBusinessAddress').value && res.address) $('#docBusinessAddress').value = res.address;
}

function getDocFormFieldsForType(typeName){
  return DOC_FORM_FIELDS[typeName] || ['purpose'];
}

function clearDocDynamicInputs(){
  ['docPurpose','docYearsResiding','docCompleteAddress','docMonthlyIncome','docBeneficiaryName',
   'docBusinessName','docBusinessAddress','docChildrenCount','docReceivingOffice',
   'docEndorsementReason','docBirthplace','docIncidentDetails'].forEach(function(id){
    var el = $('#'+id); if(el) el.value = '';
  });
  if($('#docEmploymentStatus')) $('#docEmploymentStatus').selectedIndex = 0;
  if($('#docBusinessPurpose')) $('#docBusinessPurpose').selectedIndex = 0;
  if($('#docSoloCircumstance')) $('#docSoloCircumstance').selectedIndex = 0;
}

function updateDocDynamicFields(){
  var type = $('#docType') ? $('#docType').value : '';
  var fields = getDocFormFieldsForType(type);
  var nodes = document.querySelectorAll('#docDynamicFields .doc-field');
  for(var i=0;i<nodes.length;i++){
    var key = nodes[i].getAttribute('data-field');
    nodes[i].style.display = fields.indexOf(key) >= 0 ? 'block' : 'none';
  }
  // Soft hint text per document
  var hints = {
    'Certificate of Indigency': 'Based on official indigency wording: purpose, income, and employment status are required.',
    'Certificate of Residency': 'Based on official residency wording: years of residency and complete address are required.',
    'Business Permit': 'Based on official business clearance wording: business name and address are required.',
    'Certificate of Solo Parent': 'Based on solo parent endorsement wording: circumstance and number of children are required.',
    'Barangay Endorsement': 'Based on endorsement letter wording: receiving office and reason are required.',
    'Blotter / Incident Report': 'Provide incident details for the blotter / incident certification.',
    'Barangay ID': 'Birthplace is used on the Barangay ID certification (optional if already on profile).'
  };
  if($('#docFormHint')){
    $('#docFormHint').textContent = hints[type] ||
      'Personal details are taken from your profile. Fill only the fields required for this document wording.';
  }
}

function onDocTypeFormChange(){
  updateDocFeeDisplay();
  updateDocDynamicFields();
  // Re-apply profile defaults into newly visible fields
  var isResidentUser = data.currentUser && data.currentUser.role === 'Resident' && data.currentUser.residentId;
  if(isResidentUser){
    var res = data.residents.find(function(r){ return r.id === data.currentUser.residentId; });
    if(res) fillResidentDocAutoFields(res);
  }
}

function onDocApplicantModeChange(){
  var checked = document.querySelector('input[name="docApplicantMode"]:checked');
  var isOther = !!checked && checked.value === 'other';
  if($('#docOtherApplicantFields')) $('#docOtherApplicantFields').style.display = isOther ? 'block' : 'none';
}
function resetDocApplicantMode(){
  var selfRadio = document.querySelector('input[name="docApplicantMode"][value="self"]');
  if(selfRadio) selfRadio.checked = true;
  if($('#docOtherApplicantFields')) $('#docOtherApplicantFields').style.display = 'none';
  ['docOtherName','docOtherAddress','docOtherPurok','docOtherContact','docOtherRelation'].forEach(function(id){
    var el = $('#'+id); if(el) el.value = '';
  });
  if($('#docOtherCivil')) $('#docOtherCivil').selectedIndex = 0;
  if($('#docOtherGender')) $('#docOtherGender').selectedIndex = 0;
}
function openDocumentModal(opts){
  opts = opts || {};
  var preselectType = opts.type || '';
  var lockType = !!opts.lockType;
  var isResidentUser = data.currentUser && data.currentUser.role === 'Resident';

  var types = getDocTypes();
  $('#docType').innerHTML = types.map(function(t){
    return '<option value="'+t.name+'">'+t.name+(t.fee?' — ₱'+t.fee:' — Free')+'</option>';
  }).join('');
  clearDocDynamicInputs();
  if(preselectType) $('#docType').value = preselectType;

  var typeSel = $('#docType');
  if(typeSel){
    typeSel.onchange = onDocTypeFormChange;
    typeSel.disabled = lockType && !!preselectType;
  }
  if($('#docTypeLockedNote')) $('#docTypeLockedNote').style.display = (lockType && preselectType) ? 'block' : 'none';
  if($('#docFeeGcash')) $('#docFeeGcash').textContent = data.gcashAccount.number;
  updateDocFeeDisplay();
  updateDocDynamicFields();

  if(isResidentUser && data.currentUser.residentId){
    var res = data.residents.find(function(r){ return r.id === data.currentUser.residentId; });
    if(!res){ showToast('Resident profile not found','error'); return; }
    if(!res.verified){ showToast('ACCESS DENIED — Not a verified resident. Wait for Secretary verification.','error'); return; }

    if($('#docResidentGroup')) $('#docResidentGroup').style.display = 'none';
    if($('#docResidentAutoFill')) $('#docResidentAutoFill').style.display = 'block';
    fillResidentDocAutoFields(res);
    if($('#docApplicantModeGroup')) $('#docApplicantModeGroup').style.display = 'block';
    resetDocApplicantMode();
    if($('#docModalTitle')) $('#docModalTitle').textContent = 'Request Document';
  } else {
    var verified = data.residents.filter(function(r){ return r.verified; });
    var list = verified.length ? verified : data.residents;
    $('#docResident').innerHTML = list.map(function(r){
      return '<option value="'+r.id+'">'+r.lastName+', '+r.firstName+(r.verified?'':' — Unverified')+'</option>';
    }).join('');
    if($('#docResidentGroup')) $('#docResidentGroup').style.display = 'block';
    if($('#docResidentAutoFill')) $('#docResidentAutoFill').style.display = 'none';
    if($('#docResidentIdFixed')) $('#docResidentIdFixed').value = '';
    if($('#docApplicantModeGroup')) $('#docApplicantModeGroup').style.display = 'none';
    resetDocApplicantMode();
    if($('#docModalTitle')) $('#docModalTitle').textContent = 'New Document Request';
    // When staff picks a resident, refresh address defaults
    if($('#docResident')){
      $('#docResident').onchange = function(){
        var rid = parseInt($('#docResident').value, 10);
        var r = data.residents.find(function(x){ return x.id === rid; });
        if(r) fillResidentDocAutoFields(r);
      };
    }
  }

  $('#documentModal').classList.add('active');
  setTimeout(function(){
    var first = document.querySelector('#docDynamicFields .doc-field[style*="block"] input, #docDynamicFields .doc-field[style*="block"] select, #docDynamicFields .doc-field[style*="block"] textarea');
    if(first) first.focus();
    else if($('#docPurpose')) $('#docPurpose').focus();
  }, 80);
}
function updateDocFeeDisplay(){
  var t=$('#docType')?$('#docType').value:'';
  var fee=getDocFee(t);
  if($('#docFeeAmount')) $('#docFeeAmount').textContent=fee?('₱'+fee):'Free';
  if($('#docFeeGcash')) $('#docFeeGcash').textContent=data.gcashAccount.number;
}

function collectDocFormDetails(type, res){
  var fields = getDocFormFieldsForType(type);
  var details = {};
  var requiredMap = {
    purpose: { id: 'docPurpose', label: 'Purpose' },
    yearsResiding: { id: 'docYearsResiding', label: 'Years of residency' },
    completeAddress: { id: 'docCompleteAddress', label: 'Complete address' },
    monthlyIncome: { id: 'docMonthlyIncome', label: 'Monthly income' },
    employmentStatus: { id: 'docEmploymentStatus', label: 'Employment status' },
    beneficiaryName: { id: 'docBeneficiaryName', label: 'Beneficiary name', optional: true },
    businessName: { id: 'docBusinessName', label: 'Business name' },
    businessAddress: { id: 'docBusinessAddress', label: 'Business address' },
    businessPurpose: { id: 'docBusinessPurpose', label: 'Business purpose' },
    soloCircumstance: { id: 'docSoloCircumstance', label: 'Solo parent circumstance' },
    childrenCount: { id: 'docChildrenCount', label: 'Number of children' },
    receivingOffice: { id: 'docReceivingOffice', label: 'Receiving office' },
    endorsementReason: { id: 'docEndorsementReason', label: 'Reason for endorsement' },
    birthplace: { id: 'docBirthplace', label: 'Birthplace', optional: true },
    incidentDetails: { id: 'docIncidentDetails', label: 'Incident details' }
  };
  for(var i=0;i<fields.length;i++){
    var key = fields[i];
    var meta = requiredMap[key];
    if(!meta) continue;
    var el = $('#'+meta.id);
    var val = el ? String(el.value || '').trim() : '';
    if(!val && !meta.optional){
      return { error: 'Please fill in: '+meta.label };
    }
    details[key] = val;
  }
  // Always include template-ready profile snapshot
  var fullName = res ? (res.firstName+' '+(res.middleName||'')+' '+res.lastName).replace(/\s+/g,' ').trim() : '';
  var gender = res ? (res.gender || '') : '';
  var pronoun = /female/i.test(gender) ? 'she' : (/male/i.test(gender) ? 'he' : 'he/she');
  var possessive = pronoun === 'she' ? 'her' : (pronoun === 'he' ? 'his' : 'his/her');
  details.fullName = fullName;
  details.civilStatus = res ? (res.civilStatus || '') : '';
  details.gender = gender;
  details.pronoun = pronoun;
  details.possessive = possessive;
  details.address = res ? (res.address || '') : '';
  details.purok = res ? (res.purok || '') : '';
  details.contact = res ? (res.contact || '') : '';
  details.birthDate = res ? (res.birthDate || '') : '';
  details.barangay = (data.profiling && data.profiling.name) || 'Barangay Dumanguena';
  details.municipality = (data.profiling && (data.profiling.city || data.profiling.Municipality)) || 'Narra';
  details.province = (data.profiling && data.profiling.province) || 'Palawan';
  details.captain = (data.profiling && data.profiling.captain) || 'Punong Barangay';
  // Purpose fallback for types that use businessPurpose / endorsementReason / incidentDetails
  if(!details.purpose){
    details.purpose = details.businessPurpose || details.endorsementReason || details.incidentDetails || 'whatever legal purpose it may serve';
  }
  return { details: details };
}

function saveDocument(){
  var isResidentUser = data.currentUser && data.currentUser.role === 'Resident';
  var residentId;
  if(isResidentUser && data.currentUser.residentId){
    residentId = parseInt(data.currentUser.residentId, 10);
  } else if($('#docResidentIdFixed') && $('#docResidentIdFixed').value){
    residentId = parseInt($('#docResidentIdFixed').value, 10);
  } else {
    residentId = parseInt($('#docResident').value, 10);
  }

  var type = $('#docType').value;
  if(!type){ showToast('Please select a document type','error'); return; }

  var res = data.residents.find(function(r){ return r.id === residentId; });
  if(!res || !res.verified){ showToast('ACCESS DENIED — Resident not verified','error'); return; }

  if(isResidentUser && data.currentUser.residentId !== residentId){
    showToast('You can only request documents for your own account','error');
    return;
  }

  var collected = collectDocFormDetails(type, res);
  if(collected.error){ showToast(collected.error,'error'); return; }
  var formDetails = collected.details;

  // Requesting on behalf of another person (resident portal only)
  var onBehalf = false, applicantRelation = '';
  if(isResidentUser){
    var modeChecked = document.querySelector('input[name="docApplicantMode"]:checked');
    onBehalf = !!modeChecked && modeChecked.value === 'other';
  }
  if(onBehalf){
    var oName = ($('#docOtherName') && $('#docOtherName').value || '').trim();
    var oAddress = ($('#docOtherAddress') && $('#docOtherAddress').value || '').trim();
    if(!oName){ showToast('Please enter the applicant\'s full name','error'); return; }
    if(!oAddress){ showToast('Please enter the applicant\'s complete address','error'); return; }
    var oCivil = $('#docOtherCivil') ? $('#docOtherCivil').value : '';
    var oGender = $('#docOtherGender') ? $('#docOtherGender').value : '';
    var oPurok = ($('#docOtherPurok') && $('#docOtherPurok').value || '').trim();
    var oContact = ($('#docOtherContact') && $('#docOtherContact').value || '').trim();
    applicantRelation = ($('#docOtherRelation') && $('#docOtherRelation').value || '').trim();
    var oPronoun = /female/i.test(oGender) ? 'she' : (/male/i.test(oGender) ? 'he' : 'he/she');
    var oPossessive = oPronoun === 'she' ? 'her' : (oPronoun === 'he' ? 'his' : 'his/her');
    formDetails.fullName = oName;
    formDetails.civilStatus = oCivil;
    formDetails.gender = oGender;
    formDetails.pronoun = oPronoun;
    formDetails.possessive = oPossessive;
    formDetails.address = oAddress;
    formDetails.purok = oPurok;
    formDetails.contact = oContact;
    if(formDetails.completeAddress !== undefined) formDetails.completeAddress = oAddress;
    if(formDetails.beneficiaryName !== undefined && !formDetails.beneficiaryName) formDetails.beneficiaryName = oName;
  }
  var purpose = formDetails.purpose || '';

  var fee = getDocFee(type);
  var newDoc = {
    id: nextId(data.documents),
    type: type,
    residentId: residentId,
    purpose: purpose,
    status: 'Pending',
    requestDate: today(),
    releaseDate: null,
    orNumber: null,
    fee: fee,
    paid: false,
    endorsedBy: null,
    endorsedDate: null,
    approvedBy: null,
    approvedDate: null,
    onBehalfOf: onBehalf,
    applicantRelation: onBehalf ? applicantRelation : '',
    // Snapshot + template field values from official wording forms
    applicantName: formDetails.fullName,
    applicantAddress: formDetails.address,
    applicantPurok: formDetails.purok,
    applicantContact: formDetails.contact,
    applicantCivilStatus: formDetails.civilStatus,
    formDetails: formDetails
  };
  data.documents.push(newDoc);
  addNotif('New Request', getResidentName(residentId)+' requested '+type+(onBehalf?' (on behalf of '+formDetails.fullName+')':''), 'info', 'Secretary', null, 'document');
  addNotif('Request Submitted', 'Your '+type+' request was submitted. Fee: ₱'+fee+'. Pay via GCash to '+data.gcashAccount.number, 'info', 'Resident', residentId, 'document');
  saveData();
  closeModal('documentModal');
  // Do NOT show filled official document to resident until Released (after payment + Treasurer verify)
  if(isResidentUser){
    showToast('Request submitted. Hintayin ang review ng Secretary. Official document makikita lang pagkatapos magbayad at ma-verify ng Treasurer.');
  } else {
    showToast('Request submitted');
  }
  if($('#module-documents') && $('#module-documents').classList.contains('active')) renderDocuments();
  if($('#module-portal') && $('#module-portal').classList.contains('active')) renderPortal();
  if($('#module-myrequests') && $('#module-myrequests').classList.contains('active')) renderMyRequests();
  if($('#module-secretary') && $('#module-secretary').classList.contains('active')) renderSecretary();
  updateNotifBadge();
}
function viewDocument(id){
  var d=data.documents.find(function(x){return x.id===id;}); if(!d)return;
  var r=data.residents.find(function(x){return x.id===d.residentId;});
  var asset = d.pdfAsset || getDocumentAsset(d.type);
  var canManage = data.currentUser && (data.currentUser.role==='Admin' || data.currentUser.role==='Secretary' || data.currentUser.role==='Treasurer');
  var roleName = data.currentUser ? data.currentUser.role : '';
  var isResident = data.currentUser && data.currentUser.role === 'Resident';

  // RESIDENT: cannot see official filled document until Released (after payment verified / free endorse)
  if(isResident){
    if(d.status !== 'Released'){
      showToast('Bayad muna bago makita ang official document. Status: '+(d.status||'Pending')+(d.fee>0?' — Magbayad ng ₱'+Number(d.fee).toFixed(2):''),'error');
      // Show only request summary (no filled official PDF)
      var pay = (data.payments||[]).find(function(p){ return p.documentId===d.id; });
      var payNote = '';
      if(d.status==='Payment Pending' && pay){
        payNote = pay.gcashRef
          ? '<p style="margin-top:8px;"><span class="badge badge-warning">Proof submitted</span> Awaiting Treasurer verification.</p>'
          : '<p style="margin-top:8px;"><button class="btn btn-sm btn-success" onclick="closeModal(\'docPreviewModal\');openResidentGcashPay('+pay.id+')">Pay ₱'+(d.fee||0)+' via GCash</button></p>';
      }
      if($('#docPreviewBody')){
        $('#docPreviewBody').innerHTML =
          '<div class="doc-preview">'+
            '<p style="font-size:14px;margin-bottom:8px;"><strong>'+d.type+'</strong></p>'+
            '<p style="font-size:13px;color:var(--text-muted);">Status: '+statusBadge(d.status)+' · Fee: ₱'+(Number(d.fee)||0).toFixed(2)+'</p>'+
            '<p style="font-size:13px;margin-top:10px;color:#b45309;background:#fffbeb;border:1px solid #fcd34d;border-radius:8px;padding:12px;">'+
              '<strong>🔒 Official document locked</strong><br>Kailangan muna magbayad at ma-verify ng Treasurer bago mo makita o ma-download ang official document na may personal information mo.'+
            '</p>'+
            '<p style="font-size:12px;margin-top:8px;">Purpose: '+(d.purpose||'—')+' · Requested: '+formatDate(d.requestDate)+'</p>'+
            payNote+
          '</div>';
        $('#docPreviewModal').classList.add('active');
      }
      return;
    }
    // Released: allow filled view
    openFilledDocumentViewer(d, d.type+' — '+getResidentName(d.residentId)+' (Auto-filled)');
    return;
  }

  // Staff: always show auto-filled document for review
  openFilledDocumentViewer(d, d.type+' — '+getResidentName(d.residentId)+' (Auto-filled)');

  if(canManage){
    // Summary only — no action buttons (Close is on the modal footer)
    $('#docPreviewBody').innerHTML=
      '<div class="doc-preview">'+
        '<p style="font-size:13px;margin-bottom:8px;"><strong>'+d.type+'</strong> for <strong>'+getResidentName(d.residentId)+'</strong></p>'+
        '<p style="font-size:12px;color:var(--text-muted);margin-bottom:8px;">Purpose: '+(d.purpose||'—')+' · Status: '+statusBadge(d.status)+' · Fee: ₱'+(Number(d.fee)||0).toFixed(2)+' · OR: '+(d.orNumber||'N/A')+'</p>'+
        (r ? '<p style="font-size:12px;margin-bottom:8px;">Resident: '+(r.firstName+' '+(r.middleName||'')+' '+r.lastName).replace(/\s+/g,' ').trim()+' · '+(r.civilStatus||'')+' · '+(r.address||'')+'</p>' : '')+
        '<p style="font-size:12px;color:var(--text-muted);">Document details only. Use Close to exit.</p>'+
      '</div>';
    $('#docPreviewModal').classList.add('active');
  }
}

/* ===== PROFILE + NATIONAL ID SCANNER ===== */
/* ===== BLUEPRINT: I. RESIDENT PROFILE & NATIONAL ID ===== */
function renderProfile(){
  var u=data.currentUser;
  if(u.role!=='Resident'||!u.residentId){ $('#profileBody').innerHTML='<div class="empty-state">Profile available for Resident accounts only.</div>'; return; }
  var r=data.residents.find(function(x){return x.id===u.residentId;});
  if(!r){ $('#profileBody').innerHTML='<div class="empty-state">Resident record not found.</div>'; return; }
  // Normalize missing fields for older records
  if(r.gender===undefined) r.gender='';
  if(r.civilStatus===undefined) r.civilStatus='';
  if(r.birthDate===undefined) r.birthDate='';
  if(r.occupation===undefined) r.occupation='';
  if(r.nationality===undefined) r.nationality='Filipino';
  if(r.birthplace===undefined) r.birthplace='';
  if(r.email===undefined) r.email='';
  var idStatus=r.idVerified
    ? '<span class="badge badge-success">National ID Verified</span> on '+formatDate(r.idVerifiedDate)+' · <code>'+(r.nationalId||'')+'</code>'
    : '<span class="badge badge-warning">National ID Not Verified</span>';
  var imgHtml=r.idImage?'<img src="'+r.idImage+'" alt="National ID" class="id-preview-img">':'<p class="muted-note">No ID image on file</p>';
  var ocrNote='';
  var avatar=r.profilePic
    ? '<img src="'+r.profilePic+'" alt="Profile" class="profile-avatar-img">'
    : '<div class="profile-avatar-fallback">'+(r.firstName?r.firstName.charAt(0):'?')+'</div>';
  var yesNo=function(v){ return v?'<span class="badge badge-info">Yes</span>':'<span class="badge badge-secondary">No</span>'; };

  $('#profileBody').innerHTML=
    '<div class="profile-hero card">'+
      '<div class="card-body profile-hero-body">'+
        '<div class="profile-avatar-wrap">'+avatar+
          '<button class="btn btn-sm btn-outline" onclick="uploadProfilePic()"><i class="fas fa-camera"></i> Photo</button>'+
          '<input type="file" id="profilePicInput" accept="image/*" style="display:none;" onchange="handleProfilePic(event)">'+
        '</div>'+
        '<div class="profile-hero-info">'+
          '<h2 class="profile-name">'+escapeHtml(r.firstName+' '+(r.middleName||'')+' '+r.lastName).replace(/\s+/g,' ').trim()+'</h2>'+
          '<p class="profile-meta">'+(r.purok?('Purok '+escapeHtml(r.purok)+' · '):'')+escapeHtml(r.address||'')+'</p>'+
          '<div class="profile-badges">'+
            (r.verified?'<span class="badge badge-success">Verified Resident</span>':'<span class="badge badge-warning">Pending Residency</span>')+' '+
            idStatus+
          '</div>'+
        '</div>'+
      '</div>'+
    '</div>'+

    '<div class="card"><div class="card-header"><h3><i class="fas fa-id-card"></i> Resident Information</h3>'+
      '<button class="btn btn-sm btn-primary" onclick="toggleProfileEdit()">Edit Profile</button></div>'+
    '<div class="card-body" id="profileViewPanel">'+
      '<div class="info-grid">'+
        '<div class="info-item"><span class="info-label">First Name</span><span class="info-value">'+escapeHtml(r.firstName||'—')+'</span></div>'+
        '<div class="info-item"><span class="info-label">Middle Name</span><span class="info-value">'+escapeHtml(r.middleName||'—')+'</span></div>'+
        '<div class="info-item"><span class="info-label">Last Name</span><span class="info-value">'+escapeHtml(r.lastName||'—')+'</span></div>'+
        '<div class="info-item"><span class="info-label">Gender</span><span class="info-value">'+escapeHtml(r.gender||'—')+'</span></div>'+
        '<div class="info-item"><span class="info-label">Civil Status</span><span class="info-value">'+escapeHtml(r.civilStatus||'—')+'</span></div>'+
        '<div class="info-item"><span class="info-label">Birth Date</span><span class="info-value">'+escapeHtml(r.birthDate?formatDate(r.birthDate):'—')+'</span></div>'+
        '<div class="info-item"><span class="info-label">Age</span><span class="info-value"><strong>'+formatAge(r.birthDate)+'</strong></span></div>'+
        '<div class="info-item"><span class="info-label">Birthplace</span><span class="info-value">'+escapeHtml(r.birthplace||'—')+'</span></div>'+
        '<div class="info-item"><span class="info-label">Nationality</span><span class="info-value">'+escapeHtml(r.nationality||'Filipino')+'</span></div>'+
        '<div class="info-item"><span class="info-label">Contact</span><span class="info-value">'+escapeHtml(r.contact||'—')+'</span></div>'+
        '<div class="info-item"><span class="info-label">Email</span><span class="info-value">'+escapeHtml(r.email||'—')+'</span></div>'+
        '<div class="info-item"><span class="info-label">Occupation</span><span class="info-value">'+escapeHtml(r.occupation||'—')+'</span></div>'+
        '<div class="info-item"><span class="info-label">Purok</span><span class="info-value">'+escapeHtml(r.purok||'—')+'</span></div>'+
        '<div class="info-item info-item-wide"><span class="info-label">Address</span><span class="info-value">'+escapeHtml(r.address||'—')+'</span></div>'+
        '<div class="info-item"><span class="info-label">Registered Voter</span><span class="info-value">'+yesNo(!!r.voter)+'</span></div>'+
        '<div class="info-item"><span class="info-label">Senior Citizen</span><span class="info-value">'+yesNo(!!r.senior)+'</span></div>'+
        '<div class="info-item"><span class="info-label">PWD</span><span class="info-value">'+yesNo(!!r.pwd)+'</span></div>'+
        '<div class="info-item"><span class="info-label">Date Registered</span><span class="info-value">'+formatDate(r.registered)+'</span></div>'+
      '</div>'+
    '</div>'+
    '<div class="card-body" id="profileEditPanel" style="display:none;">'+
      '<div class="form-row">'+
        '<div class="form-group"><label>First Name *</label><input type="text" id="profFirstName" value="'+escapeHtml(r.firstName||'')+'"></div>'+
        '<div class="form-group"><label>Middle Name</label><input type="text" id="profMiddleName" value="'+escapeHtml(r.middleName||'')+'"></div>'+
        '<div class="form-group"><label>Last Name *</label><input type="text" id="profLastName" value="'+escapeHtml(r.lastName||'')+'"></div>'+
      '</div>'+
      '<div class="form-row">'+
        '<div class="form-group"><label>Gender *</label><select id="profGender">'+
          ['Male','Female','Other'].map(function(g){return '<option value="'+g+'"'+(r.gender===g?' selected':'')+'>'+g+'</option>';}).join('')+
        '</select></div>'+
        '<div class="form-group"><label>Civil Status *</label><select id="profCivilStatus">'+
          ['Single','Married','Widowed','Separated','Divorced'].map(function(c){return '<option value="'+c+'"'+(r.civilStatus===c?' selected':'')+'>'+c+'</option>';}).join('')+
        '</select></div>'+
        '<div class="form-group"><label>Birth Date</label><input type="date" id="profBirthDate" value="'+(r.birthDate||'')+'" onchange="var a=calcAge(this.value);var el=document.getElementById(\'profAgeDisplay\');if(el)el.textContent=a===null?\'—\':(a+\' years old\');"></div>'+
        '<div class="form-group"><label>Age (auto)</label><p id="profAgeDisplay" style="padding:10px 12px;background:#f3f4f6;border-radius:8px;margin:0;font-weight:600;">'+formatAge(r.birthDate)+'</p></div>'+
      '</div>'+
      '<div class="form-row">'+
        '<div class="form-group"><label>Birthplace</label><input type="text" id="profBirthplace" value="'+escapeHtml(r.birthplace||'')+'"></div>'+
        '<div class="form-group"><label>Nationality</label><input type="text" id="profNationality" value="'+escapeHtml(r.nationality||'Filipino')+'"></div>'+
        '<div class="form-group"><label>Occupation</label><input type="text" id="profOccupation" value="'+escapeHtml(r.occupation||'')+'"></div>'+
      '</div>'+
      '<div class="form-row">'+
        '<div class="form-group"><label>Contact</label><input type="text" id="profContact" value="'+escapeHtml(r.contact||'')+'"></div>'+
        '<div class="form-group"><label>Email</label><input type="email" id="profEmail" value="'+escapeHtml(r.email||'')+'"></div>'+
        '<div class="form-group"><label>Purok</label><input type="text" id="profPurok" value="'+escapeHtml(r.purok||'')+'"></div>'+
      '</div>'+
      '<div class="form-group"><label>Address *</label><input type="text" id="profAddress" value="'+escapeHtml(r.address||'')+'"></div>'+
      '<div class="form-row profile-check-row">'+
        '<label class="check-pill"><input type="checkbox" id="profVoter"'+(r.voter?' checked':'')+'> Registered Voter</label>'+
        '<label class="check-pill"><input type="checkbox" id="profSenior"'+(r.senior?' checked':'')+'> Senior Citizen</label>'+
        '<label class="check-pill"><input type="checkbox" id="profPwd"'+(r.pwd?' checked':'')+'> PWD</label>'+
      '</div>'+
      '<div style="display:flex;gap:10px;flex-wrap:wrap;margin-top:12px;">'+
        '<button class="btn btn-primary" onclick="saveProfileEdits()">Save Changes</button>'+
        '<button class="btn btn-secondary" onclick="toggleProfileEdit(false)">Cancel</button>'+
      '</div>'+
    '</div></div>'+

    '<div class="card"><div class="card-header"><h3><i class="fas fa-home"></i> Household Members</h3>'+'<button class="btn btn-sm btn-outline" onclick="toggleProfileHouseholdEdit()">Edit Members</button></div>'+'<div class="card-body" id="profileHouseholdPanel">'+buildProfileHouseholdHtml(r)+'</div></div>'+
    '<div class="card"><div class="card-header"><h3><i class="fas fa-address-card"></i> National ID Verification</h3></div><div class="card-body">'+
    '<p class="muted-note" style="margin-bottom:14px;">Scan or upload your Philippine National ID (PhilSys). The system reads the card and requires a <strong>name match</strong> with your resident profile before verification.</p>'+
    '<div style="display:flex;gap:12px;flex-wrap:wrap;margin-bottom:16px;">'+
    '<button class="btn btn-primary" style="width:auto;" onclick="scanNationalId()"><i class="fas fa-camera"></i> Scan ID (Camera)</button>'+
    '<button class="btn btn-outline" style="width:auto;" onclick="uploadNationalId()"><i class="fas fa-upload"></i> Upload Image</button>'+
    (r.idVerified?'<button class="btn btn-danger" style="width:auto;" onclick="clearNationalId()">Remove ID</button>':'')+
    '</div>'+
    '<input type="file" id="idFileInput" accept="image/*" capture="environment" style="display:none;" onchange="handleIdUpload(event)">'+
    '<div id="idPreviewArea">'+imgHtml+ocrNote+'</div>'+
    '</div></div>';
}
function toggleProfileEdit(force){
  var view=$('#profileViewPanel'), edit=$('#profileEditPanel');
  if(!view||!edit) return;
  var show = force===false ? false : (edit.style.display==='none' || !edit.style.display);
  if(force===true) show=true;
  if(force===false) show=false;
  // toggle if force undefined
  if(force===undefined){
    show = edit.style.display==='none' || edit.style.display==='';
  }
  edit.style.display = show ? 'block' : 'none';
  view.style.display = show ? 'none' : 'block';
}
function buildProfileHouseholdHtml(r){
  var members = ensureHousehold(r);
  if(!members.length) return '<p class="muted-note">Walang household member recorded. Click Edit Members to add.</p>';
  return '<div class="table-responsive"><table style="font-size:13px;"><thead><tr><th>Name</th><th>Relation</th><th>Birth Date</th><th>Age</th></tr></thead><tbody>'+
    members.map(function(m){
      return '<tr><td>'+escapeHtml(m.name||'—')+'</td><td>'+escapeHtml(m.relation||'—')+'</td><td>'+(m.birthDate?formatDate(m.birthDate):'—')+'</td><td>'+formatAge(m.birthDate)+'</td></tr>';
    }).join('')+'</tbody></table></div>';
}
function toggleProfileHouseholdEdit(){
  var u=data.currentUser; if(!u||!u.residentId) return;
  var r=data.residents.find(function(x){return x.id===u.residentId;}); if(!r) return;
  var panel=$('#profileHouseholdPanel'); if(!panel) return;
  var members=ensureHousehold(r).slice();
  panel.innerHTML=
    '<div id="profHhEditor"></div>'+
    '<div style="display:flex;gap:8px;flex-wrap:wrap;margin-top:10px;">'+
      '<button class="btn btn-sm btn-outline" onclick="profAddHhMember()" style="width:auto;">+ Add Member</button>'+
      '<button class="btn btn-sm btn-primary" onclick="saveProfileHousehold()" style="width:auto;">Save Members</button>'+
      '<button class="btn btn-sm btn-secondary" onclick="renderProfile()" style="width:auto;">Cancel</button>'+
    '</div>';
  window._profHhMembers = members;
  renderProfHhEditor();
}
function renderProfHhEditor(){
  var box=$('#profHhEditor'); if(!box) return;
  var members=window._profHhMembers||[];
  if(!members.length){ box.innerHTML='<p class="muted-note">No members yet.</p>'; return; }
  box.innerHTML=members.map(function(m,i){
    return '<div class="hh-row" style="display:grid;grid-template-columns:1.4fr 1fr 1fr auto;gap:8px;margin-bottom:8px;align-items:end;">'+
      '<div class="form-group" style="margin:0;"><label style="font-size:11px;">Name</label><input type="text" class="phh-name" value="'+(m.name||'').replace(/"/g,'&quot;')+'"></div>'+
      '<div class="form-group" style="margin:0;"><label style="font-size:11px;">Relation</label><select class="phh-relation">'+
        ['Spouse','Child','Parent','Sibling','Relative','Other'].map(function(rel){ return '<option'+(m.relation===rel?' selected':'')+'>'+rel+'</option>'; }).join('')+
      '</select></div>'+
      '<div class="form-group" style="margin:0;"><label style="font-size:11px;">Birth Date</label><input type="date" class="phh-birth" value="'+(m.birthDate||'')+'"></div>'+
      '<button type="button" class="btn btn-sm btn-danger" onclick="profRemoveHhMember('+i+')" style="width:auto;padding:4px 8px;">×</button>'+
    '</div>';
  }).join('');
}
function profAddHhMember(){
  window._profHhMembers = window._profHhMembers || [];
  window._profHhMembers.push({name:'',relation:'Child',birthDate:''});
  renderProfHhEditor();
}
function profRemoveHhMember(idx){
  window._profHhMembers = window._profHhMembers || [];
  window._profHhMembers.splice(idx,1);
  renderProfHhEditor();
}
function collectProfHhFromEditor(){
  var box=$('#profHhEditor'); if(!box) return [];
  var rows=box.querySelectorAll('.hh-row');
  var out=[];
  rows.forEach(function(row){
    var name=(row.querySelector('.phh-name')&&row.querySelector('.phh-name').value.trim())||'';
    var relation=(row.querySelector('.phh-relation')&&row.querySelector('.phh-relation').value)||'';
    var birthDate=(row.querySelector('.phh-birth')&&row.querySelector('.phh-birth').value)||'';
    if(name) out.push({name:name,relation:relation,birthDate:birthDate});
  });
  return out;
}
function saveProfileHousehold(){
  var u=data.currentUser; if(!u||!u.residentId) return;
  var r=data.residents.find(function(x){return x.id===u.residentId;}); if(!r) return;
  r.householdMembers = collectProfHhFromEditor();
  saveData();
  showToast('Household members updated');
  renderProfile();
}
function saveProfileEdits(){
  var u=data.currentUser;
  if(!u||!u.residentId) return;
  var r=data.residents.find(function(x){return x.id===u.residentId;});
  if(!r) return;
  var fn=($('#profFirstName')&&$('#profFirstName').value.trim())||'';
  var ln=($('#profLastName')&&$('#profLastName').value.trim())||'';
  var addr=($('#profAddress')&&$('#profAddress').value.trim())||'';
  if(!fn||!ln||!addr){ showToast('First name, last name, and address are required','error'); return; }
  r.firstName=fn;
  r.middleName=($('#profMiddleName')&&$('#profMiddleName').value.trim())||'';
  r.lastName=ln;
  r.gender=($('#profGender')&&$('#profGender').value)||r.gender||'Male';
  r.civilStatus=($('#profCivilStatus')&&$('#profCivilStatus').value)||r.civilStatus||'Single';
  r.birthDate=($('#profBirthDate')&&$('#profBirthDate').value)||'';
  r.birthplace=($('#profBirthplace')&&$('#profBirthplace').value.trim())||'';
  r.nationality=($('#profNationality')&&$('#profNationality').value.trim())||'Filipino';
  r.occupation=($('#profOccupation')&&$('#profOccupation').value.trim())||'';
  r.contact=($('#profContact')&&$('#profContact').value.trim())||'';
  r.email=($('#profEmail')&&$('#profEmail').value.trim())||'';
  r.purok=($('#profPurok')&&$('#profPurok').value.trim())||'';
  r.address=addr;
  r.voter=!!($('#profVoter')&&$('#profVoter').checked);
  r.senior=!!($('#profSenior')&&$('#profSenior').checked);
  r.pwd=!!($('#profPwd')&&$('#profPwd').checked);
  // Auto age-based senior flag
  var age = calcAge(r.birthDate);
  if(age !== null && age >= 60) r.senior = true;
  // Keep account display name in sync
  if(data.currentUser) data.currentUser.name = fn+' '+ln;
  var el=$('#userName'); if(el) el.textContent=data.currentUser.name;
  saveData();
  showToast('Profile updated');
  renderProfile();
}
function uploadProfilePic(){ var i=$('#profilePicInput'); if(i) i.click(); }
function compressImageDataUrl(dataUrl, maxSize, quality, cb){
  try {
    var img = new Image();
    img.onload = function(){
      var w = img.width, h = img.height;
      var scale = 1;
      if(w > maxSize || h > maxSize){
        scale = maxSize / Math.max(w, h);
      }
      var canvas = document.createElement('canvas');
      canvas.width = Math.max(1, Math.round(w * scale));
      canvas.height = Math.max(1, Math.round(h * scale));
      var ctx = canvas.getContext('2d');
      ctx.drawImage(img, 0, 0, canvas.width, canvas.height);
      var out = canvas.toDataURL('image/jpeg', quality || 0.82);
      cb(out);
    };
    img.onerror = function(){ cb(dataUrl); };
    img.src = dataUrl;
  } catch(e){ cb(dataUrl); }
}

function handleProfilePic(e){
  var file=e.target.files&&e.target.files[0]; if(!file) return;
  if(!file.type.match(/^image\//)){ showToast('Select an image','error'); return; }
  e.target.value='';
  var reader=new FileReader();
  reader.onload=function(ev){
    var u=data.currentUser; if(!u||!u.residentId) return;
    var r=data.residents.find(function(x){return x.id===u.residentId;});
    if(!r) return;
    compressImageDataUrl(ev.target.result, 400, 0.8, function(compressed){
      r.profilePic = compressed;
      if(data.currentUser){
        data.currentUser.avatar = compressed;
        data.currentUser.profilePic = compressed;
      }
      // Update avatar immediately (before save)
      try { updateUserAvatar(); } catch(err){}
      try { saveData(); } catch(err){}
      showToast('Profile picture updated');
      try { renderProfile(); } catch(err){}
      try { updateUserAvatar(); } catch(err){}
    });
  };
  reader.readAsDataURL(file);
}

function escapeHtml(s){
  if(!s) return '';
  return String(s).replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;');
}

var _ocrPendingImage = null;
var _ocrPendingText = null;

var _webcamStream = null;

function scanNationalId(){
  // Live webcam scanner modal
  $('#webcamModal').classList.add('active');
  $('#webcamStatus').textContent = 'Starting camera…';
  var video = $('#webcamVideo');
  if(!navigator.mediaDevices || !navigator.mediaDevices.getUserMedia){
    $('#webcamStatus').textContent = 'Camera not supported. Use Upload an Image instead.';
    showToast('Camera not available on this device','error');
    return;
  }
  navigator.mediaDevices.getUserMedia({ video: { facingMode: 'environment' }, audio: false })
    .then(function(stream){
      _webcamStream = stream;
      video.srcObject = stream;
      video.play();
      $('#webcamStatus').textContent = 'Align your National ID in the frame, then tap Capture';
    })
    .catch(function(err){
      console.error(err);
      $('#webcamStatus').textContent = 'Could not access camera. Try Upload an Image.';
      showToast('Camera permission denied or unavailable','error');
    });
}

function stopWebcam(){
  if(_webcamStream){
    _webcamStream.getTracks().forEach(function(t){ t.stop(); });
    _webcamStream = null;
  }
  var video = $('#webcamVideo');
  if(video){ video.srcObject = null; }
}

function closeWebcamModal(){
  stopWebcam();
  closeModal('webcamModal');
}

function captureWebcamId(){
  var video = $('#webcamVideo');
  if(!video || !video.videoWidth){ showToast('Camera not ready','error'); return; }
  var canvas = document.createElement('canvas');
  canvas.width = video.videoWidth;
  canvas.height = video.videoHeight;
  var ctx = canvas.getContext('2d');
  ctx.drawImage(video, 0, 0);
  var dataUrl = canvas.toDataURL('image/jpeg', 0.92);
  stopWebcam();
  closeModal('webcamModal');
  runOcrOnImage(dataUrl);
}

function uploadNationalId(){
  var input = $('#idFileInput');
  if(input){
    input.removeAttribute('capture');
    input.click();
  }
}

function handleIdUpload(e){
  var file = e.target.files && e.target.files[0];
  if(!file) return;
  if(!file.type.match(/^image\//)){ showToast('Please select an image file','error'); return; }
  // Reset input so same file can be re-selected
  e.target.value = '';

  var reader = new FileReader();
  reader.onload = function(ev){
    runOcrOnImage(ev.target.result);
  };
  reader.readAsDataURL(file);
}

function preprocessIdImage(dataUrl){
  return new Promise(function(resolve){
    var img = new Image();
    img.onload = function(){
      try {
        var maxW = 1600;
        var scale = img.width > maxW ? maxW / img.width : 1;
        var w = Math.round(img.width * scale);
        var h = Math.round(img.height * scale);
        var canvas = document.createElement('canvas');
        canvas.width = w; canvas.height = h;
        var ctx = canvas.getContext('2d');
        ctx.drawImage(img, 0, 0, w, h);
        var imageData = ctx.getImageData(0, 0, w, h);
        var d = imageData.data;
        // Grayscale + mild contrast stretch for clearer OCR
        for(var i=0;i<d.length;i+=4){
          var g = 0.299*d[i] + 0.587*d[i+1] + 0.114*d[i+2];
          g = (g - 128) * 1.35 + 128;
          if(g < 0) g = 0; if(g > 255) g = 255;
          d[i]=d[i+1]=d[i+2]=g;
        }
        ctx.putImageData(imageData, 0, 0);
        resolve(canvas.toDataURL('image/png'));
      } catch(e){
        console.warn('preprocess failed', e);
        resolve(dataUrl);
      }
    };
    img.onerror = function(){ resolve(dataUrl); };
    img.src = dataUrl;
  });
}

function runOcrOnImage(dataUrl){
  if(typeof Tesseract === 'undefined'){
    showToast('OCR library failed to load. Check internet connection.','error');
    return;
  }
  _ocrPendingImage = dataUrl;
  _ocrPendingText = null;
  _ocrMatchScore = 0;

  $('#ocrProgress').style.display = 'block';
  $('#ocrResult').style.display = 'none';
  $('#ocrConfirmBtn').style.display = 'none';
  $('#ocrBar').style.width = '0%';
  $('#ocrPercent').textContent = '0%';
  $('#ocrStatusText').textContent = 'Enhancing ID image…';
  $('#ocrModal').classList.add('active');

  preprocessIdImage(dataUrl).then(function(enhanced){
    $('#ocrStatusText').textContent = 'Loading OCR engine…';
    return Tesseract.recognize(enhanced, 'eng', {
      logger: function(m){
        if(m.status === 'recognizing text' && m.progress != null){
          var pct = Math.round(m.progress * 100);
          $('#ocrBar').style.width = pct + '%';
          $('#ocrPercent').textContent = pct + '%';
          $('#ocrStatusText').textContent = 'Reading National ID… ' + pct + '%';
        } else if(m.status){
          $('#ocrStatusText').textContent = m.status.replace(/_/g,' ') + '…';
        }
      },
      tessedit_pageseg_mode: '4',
      preserve_interword_spaces: '1'
    });
  }).then(function(result){
    var text = (result && result.data && result.data.text) ? result.data.text : '';
    _ocrPendingText = text;
    showOcrResults(dataUrl, text);
  }).catch(function(err){
    console.error(err);
    $('#ocrProgress').style.display = 'none';
    showToast('OCR failed: ' + (err.message || 'unknown error'), 'error');
    closeModal('ocrModal');
  });
}

function normalizePersonName(s){
  return String(s||'')
    .toUpperCase()
    .replace(/Ñ/g,'N')
    .replace(/[^A-Z\s]/g,' ')
    .replace(/\s+/g,' ')
    .trim();
}

function fixOcrDigits(s){
  return String(s||'')
    .replace(/[Oo]/g,'0')
    .replace(/[Il|]/g,'1')
    .replace(/[Ss]/g,'5')
    .replace(/[Bb]/g,'8')
    .replace(/[Zz]/g,'2')
    .replace(/[Gg]/g,'6');
}

function levenshtein(a, b){
  a = String(a||''); b = String(b||'');
  if(a === b) return 0;
  if(!a.length) return b.length;
  if(!b.length) return a.length;
  var i, j, prev = [], cur = [];
  for(j = 0; j <= b.length; j++) prev[j] = j;
  for(i = 1; i <= a.length; i++){
    cur[0] = i;
    for(j = 1; j <= b.length; j++){
      var cost = a.charAt(i-1) === b.charAt(j-1) ? 0 : 1;
      cur[j] = Math.min(cur[j-1] + 1, prev[j] + 1, prev[j-1] + cost);
    }
    prev = cur.slice();
  }
  return prev[b.length];
}

function fuzzyIncludes(hay, needle){
  hay = normalizePersonName(hay);
  needle = normalizePersonName(needle);
  if(!needle || needle.length < 2) return false;
  if(hay.indexOf(needle) >= 0) return true;
  // token-level fuzzy (allow 1-2 char OCR errors)
  var tokens = hay.split(' ').filter(Boolean);
  var maxDist = needle.length <= 4 ? 1 : (needle.length <= 8 ? 2 : 3);
  for(var i=0;i<tokens.length;i++){
    if(levenshtein(tokens[i], needle) <= maxDist) return true;
  }
  // multi-word needle (e.g. LEA JEAN)
  var ntoks = needle.split(' ').filter(Boolean);
  if(ntoks.length > 1){
    var ok = 0;
    ntoks.forEach(function(t){ if(fuzzyIncludes(hay, t)) ok++; });
    return ok >= Math.ceil(ntoks.length * 0.7);
  }
  return false;
}

function cleanNameToken(s){
  return normalizePersonName(s)
    .replace(/\b(LAST|NAME|APELYIDO|GIVEN|NAMES|MGA|PANGALAN|MIDDLE|GITNANG|FIRST|SEX|DATE|BIRTH|ADDRESS|TIRAHAN|REPUBLIC|PHILIPPINES|NATIONAL|ID|PHILSYS|PAMBANSANG|PAGKAKAKILANLAN)\b/g,' ')
    .replace(/\s+/g,' ')
    .trim();
}

function parsePhilId(text){
  var cleaned = String(text || '').replace(/\r/g, '\n');
  // Fix common OCR joins
  cleaned = cleaned
    .replace(/APELYIDO\.?\s*LAST\s*NAME/gi, 'LAST NAME')
    .replace(/MGA\s*PANGALAN\.?\s*GIVEN\s*NAMES?/gi, 'GIVEN NAMES')
    .replace(/GITNANG\s*APELYIDO\.?\s*MIDDLE\s*NAME/gi, 'MIDDLE NAME')
    .replace(/PETSA\s*NG\s*KAPANGANAKAN\.?\s*DATE\s*OF\s*BIRTH/gi, 'DATE OF BIRTH')
    .replace(/TIRAHAN\.?\s*ADDRESS/gi, 'ADDRESS');

  var upper = cleaned.toUpperCase();
  var lines = cleaned.split(/\n/).map(function(l){ return l.trim(); }).filter(Boolean);

  // ---- PhilSys ID number (16 digits, ####-####-####-####) ----
  var idNum = null;
  // Prefer digit-corrected scan of whole text
  var digitBlob = fixOcrDigits(cleaned.replace(/[^\dOIl|SsBbZzGg\-\s]/g,' '));
  var idPatterns = [
    /\b(\d{4}[-\s]\d{4}[-\s]\d{4}[-\s]\d{4})\b/,
    /\b(\d{16})\b/,
    /\b(\d{4}[-\s]?\d{4}[-\s]?\d{4}[-\s]?\d{4})\b/
  ];
  for(var i=0;i<idPatterns.length;i++){
    var m = digitBlob.match(idPatterns[i]) || cleaned.match(idPatterns[i]);
    if(m){
      var digits = fixOcrDigits(m[1]).replace(/\D/g,'');
      if(digits.length === 16){
        idNum = digits.replace(/(\d{4})(\d{4})(\d{4})(\d{4})/,'$1-$2-$3-$4');
        break;
      }
    }
  }
  // Fallback: longest 16-digit run anywhere
  if(!idNum){
    var onlyDigits = fixOcrDigits(cleaned).replace(/\D/g,'');
    var run = onlyDigits.match(/\d{16}/);
    if(run) idNum = run[0].replace(/(\d{4})(\d{4})(\d{4})(\d{4})/,'$1-$2-$3-$4');
  }

  // ---- Names (PhilSys field order: Last, Given, Middle) ----
  var lastN='', givenN='', midN='';

  function valueAfterLabel(src, labelRe){
    var mm = src.match(labelRe);
    if(!mm) return '';
    var val = cleanNameToken(mm[1] || '');
    // stop at next field labels if OCR glued them
    val = val.split(/\b(?:LAST|GIVEN|MIDDLE|SEX|DATE|ADDRESS|TIRAHAN|PHILSYS)\b/)[0].trim();
    // keep at most 3 tokens for last/middle, 4 for given
    return val;
  }

  lastN = valueAfterLabel(cleaned, /(?:LAST\s*NAME|APELYIDO|APLYIDO|APEL[\sYIDO]*)\s*[:\-]?\s*([A-Za-zÑñ.'\-]{2,}(?:\s+[A-Za-zÑñ.'\-]{2,}){0,2})/i);
  givenN = valueAfterLabel(cleaned, /(?:GIVEN\s*NAMES?|FIRST\s*NAME|MGA\s*PANGALAN|PANGALAN)\s*[:\-]?\s*([A-Za-zÑñ.'\-]{2,}(?:\s+[A-Za-zÑñ.'\-]{2,}){0,3})/i);
  midN = valueAfterLabel(cleaned, /(?:MIDDLE\s*NAME|GITNANG\s*(?:APELYIDO|PANGALAN)|GITNANG)\s*[:\-]?\s*([A-Za-zÑñ.'\-]{2,}(?:\s+[A-Za-zÑñ.'\-]{2,}){0,2})/i);

  // Line-based recovery: values often sit on their own line near labels
  function lineValueNear(labelRe){
    for(var li=0; li<lines.length; li++){
      if(labelRe.test(lines[li])){
        // same line after label
        var same = lines[li].replace(labelRe,'').replace(/[:\-]/g,' ').trim();
        same = cleanNameToken(same);
        if(same && same.length >= 2) return same;
        // next non-label line
        for(var k=li+1; k<Math.min(li+3, lines.length); k++){
          var cand = cleanNameToken(lines[k]);
          if(cand && cand.length >= 2 && cand.length <= 40 &&
             !/REPUBLIC|PHILIPPINE|NATIONAL|PAMBANSANG|IDENTIFICATION|SEX|DATE|ADDRESS|TIRAHAN|PHILSYS|QR|CODE/i.test(cand)){
            return cand;
          }
        }
      }
    }
    return '';
  }
  if(!lastN) lastN = lineValueNear(/LAST\s*NAME|APELYIDO/i);
  if(!givenN) givenN = lineValueNear(/GIVEN\s*NAMES?|MGA\s*PANGALAN|PANGALAN/i);
  if(!midN) midN = lineValueNear(/MIDDLE\s*NAME|GITNANG/i);

  // Absolute fallback: collect strongest name-like lines
  var name = null;
  if(lastN || givenN){
    name = [givenN, midN, lastN].filter(Boolean).join(' ').replace(/\s+/g,' ').trim();
  }
  if(!name){
    var candidates = lines.map(cleanNameToken).filter(function(l){
      return l.length >= 5 && l.split(/\s+/).length >= 2 &&
        !/REPUBLIC|PHILIPPINE|IDENTIFICATION|NATIONAL|PHILSYS|DATE|BIRTH|SEX|ADDRESS|CITIZEN|CARD|GOVERNMENT|PAMBANSANG|PAGKAKAKILANLAN|DIGITAL|NUMBER/i.test(l);
    });
    if(candidates.length){
      candidates.sort(function(a,b){ return b.length - a.length; });
      name = candidates[0];
    }
  }

  // ---- Sex / Gender ----
  var gender = null;
  var sexM = cleaned.match(/\b(?:SEX|KASARIAN)\s*[:\-]?\s*(MALE|FEMALE|M|F)\b/i) ||
             cleaned.match(/\b(MALE|FEMALE)\b/i);
  if(sexM){
    var sx = sexM[1].toUpperCase();
    gender = (sx==='M' || sx==='MALE') ? 'Male' : ((sx==='F'||sx==='FEMALE')?'Female':sx);
  }

  // ---- Birth date (e.g. September 28, 2007) ----
  var birthDate = null;
  var bd = cleaned.match(/(?:DATE\s*OF\s*BIRTH|BIRTH\s*DATE|KAPANGANAKAN|PETSA\s*NG\s*KAPANGANAKAN)\s*[:\-]?\s*([A-Za-z]{3,9}\s+\d{1,2},?\s+\d{4}|\d{1,2}[\-\/.\s][A-Za-z]{3,9}[\-\/.\s]\d{2,4}|\d{4}[\-\/]\d{1,2}[\-\/]\d{1,2}|\d{1,2}[\-\/]\d{1,2}[\-\/]\d{2,4})/i);
  if(bd){
    birthDate = bd[1].replace(/\s+/g,' ').trim();
  } else {
    var bd2 = cleaned.match(/\b((?:January|February|March|April|May|June|July|August|September|October|November|December)\s+\d{1,2},?\s+\d{4})\b/i);
    if(bd2) birthDate = bd2[1].replace(/\s+/g,' ').trim();
  }
  // Normalize month name dates to YYYY-MM-DD when possible
  if(birthDate){
    var md = birthDate.match(/([A-Za-z]+)\s+(\d{1,2}),?\s+(\d{4})/);
    if(md){
      var months = {JANUARY:1,FEBRUARY:2,MARCH:3,APRIL:4,MAY:5,JUNE:6,JULY:7,AUGUST:8,SEPTEMBER:9,OCTOBER:10,NOVEMBER:11,DECEMBER:12};
      var mi = months[md[1].toUpperCase()];
      if(mi){
        birthDate = md[3] + '-' + String(mi).padStart(2,'0') + '-' + String(md[2]).padStart(2,'0');
      }
    }
  }

  // ---- Address ----
  var address = null;
  var ad = cleaned.match(/(?:ADDRESS|TIRAHAN)\s*[:\-]?\s*([A-Za-z0-9Ññ#.,'\-\/\s]{8,160})/i);
  if(ad){
    address = ad[1].replace(/\s+/g,' ').trim();
  } else {
    // Heuristic: line with PUROK / barangay / province
    for(var ai=0; ai<lines.length; ai++){
      if(/PUROK|BARANGAY|DUMAGUENA|DUMANGUENA|NARRA|PALAWAN|PHILIPPINES|\b\d{4}\b/i.test(lines[ai]) &&
         !/REPUBLIC|PAMBANSANG|IDENTIFICATION|PHILSYS/i.test(lines[ai])){
        address = lines[ai].replace(/\s+/g,' ').trim();
        // append following line if continues
        if(ai+1 < lines.length && /PALAWAN|PHILIPPINE|\d{4}/i.test(lines[ai+1])){
          address += ', ' + lines[ai+1].replace(/\s+/g,' ').trim();
        }
        break;
      }
    }
  }
  if(address){
    address = address
      .replace(/\bPHL\b/gi,'')
      .replace(/\bPHILIPPINES?\b/gi,'Philippines')
      .replace(/\s+/g,' ')
      .replace(/\s+,/g,',')
      .trim();
  }

  return {
    idNumber: idNum,
    name: name,
    lastName: lastN || '',
    firstName: givenN || '',
    middleName: midN || '',
    gender: gender,
    birthDate: birthDate,
    address: address,
    raw: cleaned
  };
}

function scoreNameMatch(profileResident, ocrName, parsed){
  var pFirst = normalizePersonName(profileResident.firstName||'');
  var pMid = normalizePersonName(profileResident.middleName||'');
  var pLast = normalizePersonName(profileResident.lastName||'');
  var o = normalizePersonName(ocrName||'');
  // Also search structured OCR fields + raw text
  var searchBlob = o;
  if(parsed){
    searchBlob = [o, parsed.firstName, parsed.middleName, parsed.lastName, parsed.raw].filter(Boolean).join(' ');
    searchBlob = normalizePersonName(searchBlob);
  }
  if(!searchBlob || !pLast || !pFirst) return { score: 0, detail: 'Missing name data for comparison', hasLast:false, hasFirst:false };

  var hasLast = fuzzyIncludes(searchBlob, pLast);
  // first name may be multi-token (LEA JEAN)
  var hasFirst = fuzzyIncludes(searchBlob, pFirst);
  if(!hasFirst && pFirst.indexOf(' ') >= 0){
    // require majority of given-name tokens
    var ft = pFirst.split(' ').filter(Boolean);
    var okf = 0;
    ft.forEach(function(t){ if(fuzzyIncludes(searchBlob, t)) okf++; });
    hasFirst = okf >= Math.ceil(ft.length * 0.7);
  }
  var hasMid = !pMid || fuzzyIncludes(searchBlob, pMid);

  var score = 0;
  var parts = [];
  if(hasLast){ score += 45; parts.push('Last name matched'); } else { parts.push('Last name NOT found on ID'); }
  if(hasFirst){ score += 45; parts.push('First name matched'); } else { parts.push('First name NOT found on ID'); }
  if(pMid){
    if(hasMid){ score += 10; parts.push('Middle name matched'); }
    else { parts.push('Middle name not found (optional)'); }
  } else {
    score += 10;
  }

  var profileFull = [pFirst, pMid, pLast].filter(Boolean).join(' ');
  if(normalizePersonName(o) === profileFull){ score = 100; parts = ['Exact full name match']; }

  return { score: Math.min(100, score), detail: parts.join(' · '), hasLast: hasLast, hasFirst: hasFirst };
}

var _ocrMatchScore = 0;

function showOcrResults(dataUrl, text){
  $('#ocrProgress').style.display = 'none';
  $('#ocrResult').style.display = 'block';
  $('#ocrConfirmBtn').style.display = 'inline-flex';

  $('#ocrPreviewImg').src = dataUrl;
  if($('#ocrRawText')) $('#ocrRawText').textContent = '';

  var parsed = parsePhilId(text);
  // Prefer structured full name
  var displayName = parsed.name || '';
  if(!displayName && (parsed.firstName || parsed.lastName)){
    displayName = [parsed.firstName, parsed.middleName, parsed.lastName].filter(Boolean).join(' ');
  }
  if($('#ocrIdNumber')) $('#ocrIdNumber').value = parsed.idNumber || '';
  if($('#ocrName')) $('#ocrName').value = displayName || '';
  if($('#ocrGender')) $('#ocrGender').value = parsed.gender || '';
  if($('#ocrBirthDate')) $('#ocrBirthDate').value = parsed.birthDate || '';
  if($('#ocrAddress')) $('#ocrAddress').value = parsed.address || '';

  var u = data.currentUser;
  var r = u ? data.residents.find(function(x){ return x.id === u.residentId; }) : null;
  var matchHtml = '';
  var detail = '';
  var score = 0;

  if(r){
    var nameScore = scoreNameMatch(r, displayName || ($('#ocrName')&&$('#ocrName').value) || '', parsed);
    score = nameScore.score;
    if(parsed.idNumber) score = Math.min(100, score); else score = Math.min(score, 85);
    if(parsed.idNumber && nameScore.hasLast && nameScore.hasFirst) score = Math.max(score, 95);
    if(parsed.idNumber && nameScore.score >= 100) score = 100;

    _ocrMatchScore = score;
    var bar = $('#ocrMatchBar');
    if(bar){
      bar.style.width = score + '%';
      bar.style.background = score >= 95 ? '#059669' : (score >= 70 ? '#d97706' : '#dc2626');
    }

    if(score >= 95 && parsed.idNumber){
      matchHtml = '<span class="badge badge-success">'+score+'% match</span> — ID number found; first & last name match your profile';
      detail = nameScore.detail + ' · PhilSys number detected';
    } else if(score >= 70){
      matchHtml = '<span class="badge badge-warning">'+score+'% match</span> — Review fields; verification requires first + last name match and ID number';
      detail = nameScore.detail + (parsed.idNumber ? '' : ' · ID number missing');
    } else {
      matchHtml = '<span class="badge badge-danger">'+score+'% match</span> — Name on ID does not sufficiently match your resident profile';
      detail = nameScore.detail + ' · Update your profile name or use a clearer ID photo';
    }
  }
  if($('#ocrMatchStatus')) $('#ocrMatchStatus').innerHTML = matchHtml || '—';
  if($('#ocrMatchDetail')) $('#ocrMatchDetail').textContent = detail || '';
}

function confirmOcrVerification(){
  var idNum = ($('#ocrIdNumber') && $('#ocrIdNumber').value.trim()) || '';
  var name = ($('#ocrName') && $('#ocrName').value.trim()) || '';
  // Image is required; fields are helpful but Secretary verifies via photo
  if(!_ocrPendingImage){ showToast('Please upload or scan your National ID image first','error'); return; }
  if(!idNum && !name){
    // still allow submit with image only — secretary reviews photo
    if(!confirm('No ID number or name detected. Submit the ID image for Secretary review anyway?')) return;
  }

  var u = data.currentUser;
  var r = data.residents.find(function(x){ return x.id === u.residentId; });
  if(!r) return;

  r.nationalId = idNum || r.nationalId || '';
  r.idVerified = true; // means: ID image submitted for review
  r.idVerifiedDate = today();
  r.idImage = _ocrPendingImage;
  r.ocrText = null; // do not store raw OCR text
  r.ocrName = name || '';

  var g = ($('#ocrGender')&&$('#ocrGender').value.trim())||'';
  if(g && !r.gender) r.gender = /f/i.test(g) ? 'Female' : (/m/i.test(g) ? 'Male' : g);
  var bd = ($('#ocrBirthDate')&&$('#ocrBirthDate').value.trim())||'';
  if(bd && !r.birthDate) r.birthDate = bd;
  var addr = ($('#ocrAddress')&&$('#ocrAddress').value.trim())||'';
  // do not overwrite address automatically

  addNotif('National ID Uploaded', r.firstName + ' ' + r.lastName + ' uploaded National ID for Secretary review' + (idNum ? (' · '+idNum) : ''), 'info', 'Secretary', null, 'account');
  addNotif('National ID Uploaded', r.firstName + ' ' + r.lastName + ' uploaded National ID for review', 'info', 'Admin', null, 'account');
  saveData();
  closeModal('ocrModal');
  showToast('National ID submitted — waiting for Secretary verification');
  renderProfile();
  updateNotifBadge();
}

function clearNationalId(){
  openConfirmModal({
    title: 'Remove ID Verification',
    message: 'Remove National ID verification?',
    okLabel: 'Remove',
    variant: 'warn',
    onConfirm: function(){
  var u=data.currentUser;
  var r=data.residents.find(function(x){return x.id===u.residentId;});
  if(!r) return;
  r.idVerified=false; r.nationalId=null; r.idVerifiedDate=null; r.idImage=null; r.ocrText=null; r.ocrName=null;
  saveData(); showToast('National ID removed'); renderProfile();

    }
  });
}

/* ===== PORTAL ===== */
/* ===== BLUEPRINT: J. RESIDENT PORTAL / OFFERED DOCUMENTS ===== */

function getDocTypeIcon(name){
  var n = String(name || '').toLowerCase();
  if(/clearance/.test(n)) return 'fa-id-card';
  if(/indigency|low income/.test(n)) return 'fa-hand-holding-heart';
  if(/residency/.test(n)) return 'fa-house-user';
  if(/certification/.test(n) && !/good moral/.test(n)) return 'fa-stamp';
  if(/business|permit/.test(n)) return 'fa-store';
  if(/blotter|incident/.test(n)) return 'fa-file-circle-exclamation';
  if(/good moral/.test(n)) return 'fa-award';
  if(/solo parent/.test(n)) return 'fa-people-roof';
  if(/endorsement/.test(n)) return 'fa-file-signature';
  if(/pending case|no pending/.test(n)) return 'fa-scale-balanced';
  if(/service/.test(n)) return 'fa-screwdriver-wrench';
  return 'fa-file-lines';
}
try { window.getDocTypeIcon = getDocTypeIcon; } catch(e){}

function renderPortal(){
  var u=data.currentUser; var resident=null;
  if(u.role==='Resident'&&u.residentId) resident=data.residents.find(function(r){return r.id===u.residentId;});
  var welcome='Welcome to the Resident Portal';
  if(resident){
    welcome='Welcome, <strong>'+resident.firstName+' '+resident.lastName+'</strong>!';
    welcome+=resident.verified?' <span class="badge badge-success">Verified Resident</span>':' <span class="badge badge-warning">Pending Residency Verification</span>';
    if(resident.idVerified) welcome+=' <span class="badge badge-info">ID ✓</span>';
  }
  $('#portalWelcome').innerHTML=welcome;
  $('#portalServices').innerHTML=getDocTypes().map(function(t){
    var safe=t.name.replace(/'/g,"\\'");
    var icon=getDocTypeIcon(t.name);
    var feeLabel = (t.fee && Number(t.fee) > 0) ? ('Fee: ₱'+Number(t.fee).toFixed(2)) : 'Free';
    return '<div class="service-card">'
      +'<div style="display:flex;align-items:center;justify-content:space-between;gap:8px;margin-bottom:6px;">'
      +'<span class="badge badge-success" style="font-size:11px;letter-spacing:0.02em;">Available Document</span>'
      +'</div>'
      +'<div class="icon service-type-icon"><i class="fas '+icon+'"></i></div>'
      +'<h4>'+t.name+'</h4>'
      +'<p style="font-weight:600;color:#1d4ed8;">'+feeLabel+'</p>'
      +'<button type="button" class="btn btn-sm btn-primary service-request-btn" style="margin-top:10px;width:100%;" onclick="event.stopPropagation();portalRequestType(\''+safe+'\')">Request Document</button>'
      +'</div>';
  }).join('');
  var myDocs=resident?data.documents.filter(function(d){return d.residentId===resident.id;}):[];
  $('#portalDocs').innerHTML=myDocs.map(function(d){
    var actions='';
    if(d.status==='Payment Pending'){
      var pay=data.payments.find(function(p){return p.documentId===d.id&&p.status==='Pending';});
      if(pay){
        if(pay.gcashRef){
          actions='<span class="badge badge-warning">Proof submitted — awaiting Treasurer verification</span> <button class="btn btn-sm btn-outline" onclick="openResidentGcashPay('+pay.id+')">Update Ref</button>';
        } else {
          actions='<button class="btn btn-sm btn-success" onclick="openResidentGcashPay('+pay.id+')">Pay ₱'+d.fee+' GCash</button>';
        }
      }
    }
    if(d.status==='Released') {
      actions+='<button class="btn btn-sm btn-primary" onclick="downloadDocumentPDF('+d.id+')"><i class="fas fa-download"></i> Download File</button> ';
      actions+='<button class="btn btn-sm btn-outline" onclick="viewFilledDocument('+d.id+')">View Filled</button> ';
      actions+='<button class="btn btn-sm btn-danger" onclick="deleteDocument('+d.id+');renderPortal();">Delete</button>';
    }
    return '<tr><td>'+d.type+'</td><td>'+d.purpose+'</td><td>₱'+(d.fee||0)+'</td><td>'+statusBadge(d.status)+'</td><td>'+formatDate(d.requestDate)+'</td><td>'+actions+'</td></tr>';
  }).join('')||'<tr><td colspan="6">No requests yet — use services above or My Requests</td></tr>';
  var myPays=resident?data.payments.filter(function(p){return p.residentId===resident.id;}):[];
  $('#portalPays').innerHTML=myPays.map(function(p){
    var m=p.paymentMethod?' <span class="badge badge-info">'+p.paymentMethod+'</span>':'';
    if(p.gcashRef && p.status==='Pending') m+=' <span class="badge badge-warning">Proof submitted</span> <small>'+p.gcashRef+'</small>';
    var payBtn='';
    if(p.status==='Pending'){
      if(p.gcashRef){
        payBtn=' <button class="btn btn-sm btn-outline" onclick="openResidentGcashPay('+p.id+')">Update Ref</button>';
      } else {
        payBtn=' <button class="btn btn-sm btn-success" onclick="openResidentGcashPay('+p.id+')">Pay via GCash</button>';
      }
    }
    var stDisplay = (p.status==='Pending' && p.gcashRef) ? '<span class="badge badge-warning">Awaiting Verification</span>' : statusBadge(p.status);
    var rcptBtn=(p.status==='Paid'&&p.verified)?(' <button class="btn btn-sm btn-outline" onclick="openPaymentReceipt('+p.id+')"><i class="fas fa-receipt"></i> View Receipt</button>'):'';
    return '<tr><td>'+p.type+'</td><td>₱'+p.amount.toFixed(2)+'</td><td>'+stDisplay+m+payBtn+rcptBtn+'</td><td>'+formatDate(p.date)+'</td><td><button class="btn btn-sm btn-danger" onclick="deletePayment('+p.id+');renderPortal();">Delete</button></td></tr>';
  }).join('')||'<tr><td colspan="5">No payments</td></tr>';
}
/* ===== BLUEPRINT: J. RESIDENT PAYMENTS ===== */
function openResidentGcashPay(paymentId){
  var p=data.payments.find(function(x){return x.id===paymentId;});
  if(!p||p.status!=='Pending'){ showToast('Payment not available','error'); return; }
  $('#resGcashPayId').value=paymentId;
  $('#resGcashAmount').textContent='₱'+p.amount.toFixed(2);
  $('#resGcashType').textContent=p.type;
  if($('#resGcashNum')) $('#resGcashNum').textContent=data.gcashAccount.number;
  if($('#resGcashAccName')) $('#resGcashAccName').textContent=data.gcashAccount.name;
  $('#resGcashRef').value=p.gcashRef||'';
  $('#resGcashModal').classList.add('active');
}
function submitResidentGcashPay(){
  var id=parseInt($('#resGcashPayId').value);
  var ref=$('#resGcashRef').value.trim();
  if(!ref){ showToast('Enter GCash reference number','error'); return; }
  var p=data.payments.find(function(x){return x.id===id;});
  if(!p) return;
  if(p.status!=='Pending'){ showToast('Payment not available','error'); return; }
  // Resident only submits proof of payment — stays Pending until Treasurer reviews GCash and verifies
  p.paymentMethod='GCash';
  p.gcashRef=ref;
  p.proofSubmittedDate=today();
  p.verified=false; p.verifiedBy=null; p.verifiedDate=null;
  // Do NOT mark Paid / do NOT set document.paid — Treasurer must verify first
  if(p.documentId){
    var d=data.documents.find(function(x){return x.id===p.documentId;});
    if(d&&d.status==='Payment Pending'){
      addNotif('GCash Proof Submitted','Resident submitted GCash ref for '+p.type+' (Ref: '+ref+'). Please review in your GCash account before verifying.','warning','Treasurer',null,'payment');
      addNotif('Payment Proof Submitted','Your GCash reference for '+p.type+' was submitted. Awaiting Treasurer review and verification.','info','Resident',p.residentId,'payment');
    }
  } else {
    addNotif('GCash Proof Submitted','Resident submitted GCash ref for '+p.type+' (Ref: '+ref+'). Please review in your GCash account before verifying.','warning','Treasurer',null,'payment');
  }
  saveData(); closeModal('resGcashModal'); showToast('Proof of payment submitted — Treasurer will review GCash then verify');
  renderPortal();
  if(typeof renderMyRequests==='function') try{ renderMyRequests(); }catch(e){}
  updateNotifBadge();
}
function portalRequestType(type){
  if(role()!=='Resident'){ showToast('Login as Resident','error'); return; }
  var res=data.residents.find(function(r){return r.id===data.currentUser.residentId;});
  if(!res||!res.verified){ showToast('ACCESS DENIED — Not a verified resident. Wait for Secretary verification.','error'); return; }
  // Auto-fill resident profile; lock document type from the card/PDF they chose
  openDocumentModal({ type: type || '', lockType: !!type });
}

/* ===== NOTIFICATIONS (with delete) ===== */
/* ===== BLUEPRINT: J. NOTIFICATIONS ===== */
function getVisibleNotifications(){
  var list = data.notifications || [];
  var r = role();
  var u = data.currentUser;
  if(!u) return [];

  /* RESIDENT: ONLY own transaction process (document + payment).
     Never see official/admin queue items or other residents' alerts. */
  if(r === 'Resident'){
    var rid = u.residentId;
    if(!rid) return [];
    return list.filter(function(n){
      // Must be addressed to this resident
      if(n.residentId !== rid) return false;
      if(n.forRole && n.forRole !== 'Resident') return false;
      var cat = (n.category || '').toLowerCase();
      // Transaction process only
      if(cat === 'document' || cat === 'payment') return true;
      // Allow account-status tied to transacting (verification / registration)
      if(cat === 'account') return true;
      // Legacy items without category: infer from title for this resident only
      var t = ((n.title || '') + ' ' + (n.message || '')).toLowerCase();
      if(/document|request|clearance|residency|indigency|permit|barangay id|approved|released|rejected|under review|payment|gcash|fee|paid|or[- ]?no/.test(t)) return true;
      return false;
    });
  }

  /* OFFICIALS & ADMIN: role queues only. Never resident-personal transaction alerts. */
  return list.filter(function(n){
    // Exclude anything explicitly for residents
    if(n.forRole === 'Resident') return false;
    // Exclude personal resident-targeted items even if forRole missing
    if(n.residentId != null && n.residentId !== '' && !n.forRole) return false;
    if(r === 'Admin'){
      // Captain (Admin role) sees system + all official queues (not resident personal)
      return n.forRole === 'Admin' || n.forRole === 'Secretary' || n.forRole === 'Treasurer' || n.forRole === 'Captain' || !n.forRole;
    }
    // Specific official role: only their queue (and optional Admin broadcast)
    return n.forRole === r;
  });
}

function renderNotifications(){
  var list = getVisibleNotifications();
  var r = role();
  var unread = list.filter(function(n){ return !n.read; }).length;

  function notifItem(n){
    var dark = document.documentElement.getAttribute('data-theme') === 'dark';
    var bg = n.type === 'success' ? (dark ? '#1e3a5f' : '#dbeafe') : n.type === 'warning' ? (dark ? '#422006' : '#fef3c7') : (dark ? '#0c4a6e' : '#e0f2fe');
    var col = n.type === 'success' ? (dark ? '#93c5fd' : '#1d4ed8') : n.type === 'warning' ? (dark ? '#fcd34d' : '#d97706') : (dark ? '#7dd3fc' : '#0284c7');
    var ic = n.type === 'success' ? '✓' : n.type === 'warning' ? '!' : 'i';
    var cat = n.category === 'document' ? '📄' : n.category === 'payment' ? '💰' : n.category === 'account' ? '👤' : '🔔';
    return '<li class="notif-item'+(n.read ? ' is-read' : ' is-new')+'">'+
      '<div class="notif-icon" style="background:'+bg+';color:'+col+'">'+ic+'</div>'+
      '<div class="notif-content" style="flex:1">'+
      '<h4>'+cat+' '+escapeHtml(n.title)+(n.read ? '' : ' <span class="badge badge-danger" style="font-size:9px">NEW</span>')+'</h4>'+
      '<p>'+escapeHtml(n.message)+'</p>'+
      '<div class="notif-time">'+(n.time || '')+'</div></div>'+
      (n.read ? '' : '<button class="btn btn-sm btn-outline" onclick="markNotifRead('+n.id+')" style="margin-right:4px;">Mark Read</button>')+
      '<button class="btn btn-sm btn-danger" onclick="deleteNotification('+n.id+')">Delete</button></li>';
  }

  // Header summary
  var titleEl = $('#notifModuleTitle') || document.querySelector('#module-notifications .card-header h3');
  if(titleEl){
    if(r === 'Resident') titleEl.textContent = 'My Transaction Notifications';
    else if(r === 'Admin') titleEl.textContent = 'Captain — Official & System Notifications';
    else titleEl.textContent = r + ' Notifications';
  }

  if(r === 'Resident'){
    var docs = list.filter(function(n){
      var cat = (n.category || '').toLowerCase();
      if(cat === 'document') return true;
      if(cat === 'payment' || cat === 'account') return false;
      return /document|request|clearance|residency|indigency|permit|approved|released|rejected|under review/i.test((n.title||'')+' '+(n.message||''));
    });
    var pays = list.filter(function(n){
      var cat = (n.category || '').toLowerCase();
      if(cat === 'payment') return true;
      if(cat === 'document' || cat === 'account') return false;
      return /payment|gcash|fee|paid|collect/i.test((n.title||'')+' '+(n.message||''));
    });
    var seen = {};
    docs.forEach(function(n){ seen[n.id] = true; });
    pays = pays.filter(function(n){ return !seen[n.id]; });
    pays.forEach(function(n){ seen[n.id] = true; });
    var acct = list.filter(function(n){ return !seen[n.id]; });

    var html = '';
    html += '<div class="notif-summary"><span class="badge badge-info">'+list.length+' total</span> <span class="badge badge-danger">'+unread+' unread</span> <span style="font-size:12px;color:var(--text-muted);margin-left:8px;">Only your document &amp; payment transactions appear here. Official queues are hidden.</span></div>';
    html += '<h4 class="notif-section-title">📄 Document Transactions</h4>';
    html += docs.length ? docs.map(notifItem).join('') : '<div class="notif-empty">No document transaction alerts yet. Request a document from the Resident Portal.</div>';
    html += '<h4 class="notif-section-title">💰 Payment Transactions</h4>';
    html += pays.length ? pays.map(notifItem).join('') : '<div class="notif-empty">No payment alerts yet.</div>';
    html += '<h4 class="notif-section-title">👤 Account Status</h4>';
    html += acct.length ? acct.map(notifItem).join('') : '<div class="notif-empty">No account status updates.</div>';
    $('#notifList').innerHTML = html;
  } else {
    var roleLabel = r === 'Admin'
      ? 'Showing official and system alerts only. Resident personal transaction notifications are delivered solely to that resident.'
      : ('Showing <strong>'+r+'</strong> queue only. Resident transaction updates go to the resident — not here.');
    var html = '<div class="notif-summary"><span class="badge badge-info">'+list.length+' total</span> <span class="badge badge-danger">'+unread+' unread</span> <span style="font-size:12px;color:var(--text-muted);margin-left:8px;">'+roleLabel+'</span></div>';
    if(!list.length){
      html += '<div class="empty-state" style="padding:28px;">No notifications for your role</div>';
    } else {
      // Group official notifs by category for cleaner view
      var byCat = { document:[], payment:[], account:[], other:[] };
      list.forEach(function(n){
        var c = (n.category || 'other').toLowerCase();
        if(c === 'document') byCat.document.push(n);
        else if(c === 'payment') byCat.payment.push(n);
        else if(c === 'account') byCat.account.push(n);
        else byCat.other.push(n);
      });
      if(byCat.document.length){ html += '<h4 class="notif-section-title">📄 Document Queue</h4>' + byCat.document.map(notifItem).join(''); }
      if(byCat.payment.length){ html += '<h4 class="notif-section-title">💰 Payment Queue</h4>' + byCat.payment.map(notifItem).join(''); }
      if(byCat.account.length){ html += '<h4 class="notif-section-title">👤 Account / Registration</h4>' + byCat.account.map(notifItem).join(''); }
      if(byCat.other.length){ html += '<h4 class="notif-section-title">🔔 Other</h4>' + byCat.other.map(notifItem).join(''); }
    }
    $('#notifList').innerHTML = html;
  }
}
function markNotifRead(id){
  var n = data.notifications.find(function(x){ return x.id === id; });
  if(n){ n.read = true; saveData(); renderNotifications(); updateNotifBadge(); }
}
function deleteNotification(id){
  var visible = getVisibleNotifications().some(function(n){ return n.id === id; });
  if(!visible){ showToast('Cannot delete this notification','error'); return; }
  data.notifications = data.notifications.filter(function(n){ return n.id !== id; });
  saveData(); showToast('Notification deleted'); renderNotifications(); updateNotifBadge();
}
function markAllRead(){
  var ids = {};
  getVisibleNotifications().forEach(function(n){ ids[n.id] = true; });
  data.notifications.forEach(function(n){ if(ids[n.id]) n.read = true; });
  saveData(); renderNotifications(); updateNotifBadge(); showToast('All marked as read');
}
function clearReadNotifications(){
  openConfirmModal({
    title: 'Clear Read Notifications',
    message: 'Remove '+keys.length+' read notification(s)?',
    okLabel: 'Remove',
    variant: 'danger',
    onConfirm: function(){
  data.notifications = data.notifications.filter(function(n){ return !ids[n.id]; });
  saveData(); renderNotifications(); updateNotifBadge(); showToast('Read notifications cleared');

    }
  });
}
function updateNotifBadge(){
  var unread = getVisibleNotifications().filter(function(n){ return !n.read; }).length;
  var b = $('#notifBadge');
  if(!b) return;
  b.textContent = unread;
  b.style.display = unread > 0 ? 'flex' : 'none';
}

function renderPendingRegistrations(){
  var pending=data.pendingRegistrations.filter(function(r){return r.status==='Pending';});
  var html=pending.map(function(r,idx){
    return '<tr><td>'+(idx+1)+'</td><td>'+r.username+'</td><td>'+r.firstName+' '+r.lastName+'</td><td>'+r.address+'</td><td>'+(r.purok||'—')+'</td><td>'+r.contact+'</td><td>'+formatDate(r.submitted)+'</td><td><button class="btn btn-sm btn-success" onclick="approveRegistration('+r.id+')">✓ Approve</button> <button class="btn btn-sm btn-danger" onclick="rejectRegistration('+r.id+')">Reject</button></td></tr>';
  }).join('')||'<tr><td colspan="8" class="empty-state">No pending registrations</td></tr>';
  if($('#pendingRegTable')) $('#pendingRegTable').innerHTML=html;
  if($('#pendingRegTableSec')) $('#pendingRegTableSec').innerHTML=html;
  if($('#regStatPending')) $('#regStatPending').textContent=pending.length;
}
function approveRegistration(id){
  var reg=data.pendingRegistrations.find(function(r){return r.id===id;}); if(!reg)return;
  var residentId=nextId(data.residents);
  data.residents.push({id:residentId,firstName:reg.firstName,lastName:reg.lastName,middleName:reg.middleName||'',birthDate:'',gender:'Male',civilStatus:'Single',address:reg.address,purok:reg.purok||'',contact:reg.contact||'',occupation:'',voter:false,senior:false,pwd:false,status:'Active',verified:false,verifiedBy:null,verifiedDate:null,registered:today(),proof:reg.proof||null,nationalId:null,idVerified:false,idVerifiedDate:null,idImage:null,ocrText:null,ocrName:null,profilePic:null});
  renumberResidents();
  // Find new id after renumber
  var newRes=data.residents.find(function(r){return r.firstName===reg.firstName&&r.lastName===reg.lastName&&r.registered===today();});
  var rid=newRes?newRes.id:residentId;
  data.users.push({username:reg.username,password:reg.password,role:'Resident',name:reg.firstName+' '+reg.lastName,residentId:rid});
  reg.status='Approved';
  addNotif('Registration Approved','Your account was approved. You may now log in.','success','Resident',rid,'account');
  addNotif('New Resident',reg.firstName+' '+reg.lastName+' approved — needs residency verification','warning','Secretary',null,'account');
  saveData(); showToast('Approved — account created'); renderPendingRegistrations(); updateNotifBadge();
}
function rejectRegistration(id){
  openConfirmModal({
    title: 'Reject Registration',
    message: 'Reject this registration?',
    okLabel: 'Reject',
    variant: 'warn',
    onConfirm: function(){
  var reg=data.pendingRegistrations.find(function(r){return r.id===id;}); if(!reg)return;
  reg.status='Rejected'; saveData(); showToast('Rejected'); renderPendingRegistrations();

    }
  });
}
/* ===== BLUEPRINT: K. CAPTAIN ADMIN / USER MANAGEMENT ===== */
function renderAdmin(){
  // User Management: barangay officials only (Admin / Secretary / Treasurer) — not Residents
  var officials = (data.users || []).filter(function(u){
    var r = u.role || '';
    return r === 'Admin' || r === 'Secretary' || r === 'Treasurer' || r === 'Captain';
  });
  $('#usersTable').innerHTML = officials.map(function(u,i){
    var roleLabel = (u.role === 'Admin' || u.role === 'Captain') ? 'Captain / Admin' : u.role;
    var editBtn='<button class="btn btn-sm btn-outline" onclick="editUser(\''+u.username+'\')">Edit</button> ';
    var delBtn=(u.username!=='admin')?'<button class="btn btn-sm btn-danger" onclick="deleteUser(\''+u.username+'\')">Delete</button>':'';
    return '<tr><td>'+(i+1)+'</td><td>'+u.username+'</td><td>'+(u.name||'')+'</td><td><span class="badge badge-info">'+roleLabel+'</span></td><td>'+editBtn+delBtn+'</td></tr>';
  }).join('') || '<tr><td colspan="5" class="empty-state">No barangay officials yet</td></tr>';
  renderPendingRegistrations();
}
function openUserModal(){
  $('#userModalTitle').textContent='Add User';
  $('#userEditMode').value='0';
  $('#userOriginalUsername').value='';
  $('#umUsername').value=''; $('#umUsername').disabled=false;
  $('#umPassword').value=''; $('#umPassword').placeholder='Required for new user';
  $('#userPassHint').textContent='*';
  $('#umFullName').value='';
  $('#umRole').value='Admin'; $('#umRole').disabled=false;
  $('#userModal').classList.add('active');
}
function editUser(username){
  var u=data.users.find(function(x){return x.username===username;});
  if(!u){ showToast('User not found','error'); return; }
  $('#userModalTitle').textContent='Edit User';
  $('#userEditMode').value='1';
  $('#userOriginalUsername').value=u.username;
  $('#umUsername').value=u.username; $('#umUsername').disabled=true;
  $('#umPassword').value=''; $('#umPassword').placeholder='Leave blank to keep current password';
  $('#userPassHint').textContent='(optional)';
  $('#umFullName').value=u.name||'';
  $('#umRole').value=u.role||'Secretary';
  $('#umRole').disabled=(u.username==='admin');
  $('#userModal').classList.add('active');
}
function saveUser(){
  var mode=$('#userEditMode').value;
  var u=$('#umUsername').value.trim();
  var p=$('#umPassword').value;
  var n=$('#umFullName').value.trim();
  var r=$('#umRole').value;
  // Keep internal role as Admin (UI may say Captain)
  if(r==='Captain' || r==='Captain (System Admin)' || r==='Captain (Admin)') r='Admin';
  // User Management is for barangay officials only — Residents are managed under Resident Information
  if(r!=='Admin' && r!=='Secretary' && r!=='Treasurer'){
    showToast('User Management is for barangay officials only (Captain/Admin, Secretary, Treasurer)','error');
    return;
  }
  if(!u||!n){ showToast('Username and full name are required','error'); return; }
  if(mode==='1'){
    var orig=$('#userOriginalUsername').value;
    var idx=data.users.findIndex(function(x){return x.username===orig;});
    if(idx<0){ showToast('User not found','error'); return; }
    data.users[idx].name=n;
    if(p) data.users[idx].password=p;
    if(orig!=='admin') data.users[idx].role=r;
    if(data.currentUser && data.currentUser.username===orig){
      data.currentUser.name=n;
      if(p) data.currentUser.password=p;
      if(orig!=='admin') data.currentUser.role=data.users[idx].role;
      if($('#userName')) $('#userName').textContent=n;
      if($('#userRole')) $('#userRole').textContent=data.users[idx].role;
    }
    saveData(); closeModal('userModal'); showToast('User updated'); renderAdmin();
  } else {
    if(!p){ showToast('Password is required for new users','error'); return; }
    if(data.users.find(function(x){return x.username===u;})){ showToast('Username already exists','error'); return; }
    data.users.push({username:u,password:p,role:r,name:n});
    saveData(); closeModal('userModal'); showToast('User added'); renderAdmin();
  }
}
function openAccountModal(){
  if(!data.currentUser) return;
  $('#accUsername').value=data.currentUser.username||'';
  $('#accName').value=data.currentUser.name||'';
  $('#accPassword').value='';
  $('#accPassword2').value='';
  $('#accountModal').classList.add('active');
}
function saveMyAccount(){
  if(!data.currentUser) return;
  var n=$('#accName').value.trim();
  var p=$('#accPassword').value;
  var p2=$('#accPassword2').value;
  if(!n){ showToast('Name is required','error'); return; }
  if(p && p!==p2){ showToast('Passwords do not match','error'); return; }
  var idx=data.users.findIndex(function(x){return x.username===data.currentUser.username;});
  if(idx<0){ showToast('Account not found','error'); return; }
  data.users[idx].name=n;
  data.currentUser.name=n;
  if(p){
    data.users[idx].password=p;
    data.currentUser.password=p;
  }
  saveData();
  if($('#userName')) $('#userName').textContent=n;
  closeModal('accountModal');
  showToast('Account updated');
}

function deleteUser(username){
  openConfirmModal({
    title: 'Delete User',
    message: 'Delete user?',
    okLabel: 'Delete',
    variant: 'danger',
    onConfirm: function(){ data.users=data.users.filter(function(u){return u.username!==username;}); saveData(); showToast('Deleted'); renderAdmin(); 
    }
  });
}
function resetData(){
  openConfirmModal({
    title: 'Reset All Data',
    message: 'Reset ALL data?',
    okLabel: 'Reset Everything',
    variant: 'danger',
    onConfirm: function(){ localStorage.removeItem(STORAGE_KEY); data=loadData(); syncProfilingStats(); showToast('Data reset — clean empty database'); navigate('dashboard'); 
    }
  });
}

/* ===== OTHER ===== */
/* ===== BLUEPRINT: K. PROFILING ===== */
function renderProfiling(){
  syncProfilingStats();
  var p=data.profiling;
  $('#profName').value=p.name; $('#profCity').value=p.city; $('#profProvince').value=p.province;
  $('#profPopulation').value=p.population; $('#profHouseholds').value=p.households; $('#profPuroks').value=p.puroks;
  $('#profCaptain').value=p.captain; $('#profContact').value=p.contact; $('#profEmail').value=p.email;
  $('#profAddress').value=p.address; $('#profLandArea').value=p.landArea; $('#profEstablished').value=p.established;
  // Stats based on verified population where relevant
  var verified=data.residents.filter(function(r){return r.verified;});
  $('#profStatPop').textContent=p.population;
  $('#profStatMale').textContent=verified.filter(function(r){return r.gender==='Male';}).length;
  $('#profStatFemale').textContent=verified.filter(function(r){return r.gender==='Female';}).length;
  $('#profStatSenior').textContent=verified.filter(function(r){return r.senior;}).length;
  $('#profStatPwd').textContent=verified.filter(function(r){return r.pwd;}).length;
  $('#profStatVoter').textContent=verified.filter(function(r){return r.voter;}).length;
  if($('#profAutoNote')){
    $('#profAutoNote').textContent='Population and Households Update.';
  }
}
function saveProfiling(){
  data.profiling={name:$('#profName').value,city:$('#profCity').value,province:$('#profProvince').value,population:parseInt($('#profPopulation').value)||0,households:parseInt($('#profHouseholds').value)||0,puroks:parseInt($('#profPuroks').value)||0,captain:$('#profCaptain').value,contact:$('#profContact').value,email:$('#profEmail').value,address:$('#profAddress').value,landArea:$('#profLandArea').value,established:$('#profEstablished').value};
  // Keep population/households tied to verified residents
  syncProfilingStats();
  saveData(); showToast('Profile updated');
}
/* ===== BLUEPRINT: L. SERVICES ===== */
function renderServices(){
  $('#servicesTable').innerHTML=data.services.map(function(s,idx){
    return '<tr><td>'+(idx+1)+'</td><td><strong>'+s.name+'</strong></td><td>'+s.description+'</td><td>'+formatDate(s.date)+'</td><td>'+statusBadge(s.status)+'</td><td>'+s.beneficiaries+'</td><td>'+(s.status!=='Completed'?'<button class="btn btn-sm btn-success" onclick="completeService('+s.id+')">Complete</button> ':'')+'<button class="btn btn-sm btn-danger" onclick="deleteService('+s.id+')">Delete</button></td></tr>';
  }).join('')||'<tr><td colspan="7">No services</td></tr>';
}
function openServiceModal(){ $('#svcName').value='';$('#svcDesc').value='';$('#svcDate').value=''; $('#serviceModal').classList.add('active'); }
function saveService(){ var name=$('#svcName').value.trim(),date=$('#svcDate').value; if(!name||!date){showToast('Required','error');return;} data.services.push({id:nextId(data.services),name:name,description:$('#svcDesc').value.trim(),date:date,status:'Upcoming',beneficiaries:0}); saveData(); closeModal('serviceModal'); showToast('Added'); renderServices(); }
function completeService(id){ var s=data.services.find(function(x){return x.id===id;}); if(s){s.status='Completed';s.beneficiaries=Math.floor(Math.random()*50)+10;saveData();showToast('Completed');renderServices();} }
function deleteService(id){
  openConfirmModal({
    title: 'Delete Service',
    message: 'Delete service?',
    okLabel: 'Delete',
    variant: 'danger',
    onConfirm: function(){ data.services=data.services.filter(function(s){return s.id!==id;}); saveData(); showToast('Deleted'); renderServices(); 
    }
  });
}
/* ===== BLUEPRINT: L. PAYMENT VIEWS ===== */
function renderPayments(){
  $('#paymentsTable').innerHTML=data.payments.map(function(p,idx){
    var method=p.paymentMethod?' <span class="badge badge-info">'+p.paymentMethod+'</span>':'';
    if(p.gcashRef) method+=' <small>'+p.gcashRef+'</small>';
    return '<tr><td>'+(idx+1)+'</td><td>'+getResidentName(p.residentId)+'</td><td>'+p.type+'</td><td>₱'+p.amount.toFixed(2)+'</td><td>'+(p.orNumber||'—')+'</td><td>'+formatDate(p.date)+'</td><td>'+statusBadge(p.status)+method+'</td><td><button class="btn btn-sm btn-danger" onclick="deletePayment('+p.id+')">Delete</button></td></tr>';
  }).join('')||'<tr><td colspan="8">No payments</td></tr>';
  var paid=data.payments.filter(function(p){return p.status==='Paid';}).reduce(function(s,p){return s+p.amount;},0);
  var pend=data.payments.filter(function(p){return p.status==='Pending';}).reduce(function(s,p){return s+p.amount;},0);
  $('#payTotalPaid').textContent='₱'+paid.toFixed(2); $('#payTotalPending').textContent='₱'+pend.toFixed(2);
}
/* ===== BLUEPRINT: L. REPORTS ===== */
function renderReports(){
  var total=data.residents.length, verified=data.residents.filter(function(r){return r.verified;}).length;
  $('#reportStats').innerHTML='<div class="stats-grid"><div class="stat-card"><div class="stat-icon green">👥</div><div class="stat-info"><h3>'+total+'</h3><p>Total Residents</p></div></div><div class="stat-card"><div class="stat-icon green">✓</div><div class="stat-info"><h3>'+verified+'</h3><p>Verified</p></div></div><div class="stat-card"><div class="stat-icon blue">📄</div><div class="stat-info"><h3>'+data.documents.length+'</h3><p>Documents</p></div></div><div class="stat-card"><div class="stat-icon purple">💰</div><div class="stat-info"><h3>₱'+data.payments.filter(function(p){return p.verified;}).reduce(function(s,p){return s+p.amount;},0).toFixed(2)+'</h3><p>Verified Revenue</p></div></div></div>';
  var dt={}; data.documents.forEach(function(d){dt[d.type]=(dt[d.type]||0)+1;});
  $('#reportDocs').innerHTML=Object.keys(dt).map(function(k){return '<tr><td>'+k+'</td><td>'+dt[k]+'</td></tr>';}).join('')||'<tr><td colspan="2">No data</td></tr>';
  var st={}; data.documents.forEach(function(d){st[d.status]=(st[d.status]||0)+1;});
  $('#reportStatus').innerHTML=Object.keys(st).map(function(k){return '<tr><td>'+k+'</td><td>'+st[k]+'</td></tr>';}).join('')||'<tr><td colspan="2">No data</td></tr>';
}
/* ===== BLUEPRINT: L. MODAL / UI HELPERS ===== */
function closeModal(id){
  $('#'+id).classList.remove('active');
  if(id === 'pdfViewerModal'){
    if(_pdfjsDoc){ try { _pdfjsDoc.destroy(); } catch(e){} _pdfjsDoc = null; }
    var pagesEl = $('#pdfjsPages');
    if(pagesEl) pagesEl.innerHTML = '';
    var loadingEl = $('#pdfjsLoading');
    if(loadingEl){ loadingEl.style.display = 'flex'; loadingEl.textContent = 'Loading PDF…'; }
    _pdfjsPath = '';
  }
}



/* ===== MY REQUESTS (Resident) ===== */
/* ===== BLUEPRINT: J. MY REQUESTS / RELEASED FILES ===== */
function renderMyRequests(){
  var u=data.currentUser;
  if(!u||u.role!=='Resident'||!u.residentId){
    if($('#myRequestsTable')) $('#myRequestsTable').innerHTML='<tr><td colspan="8" class="empty-state">Login as Resident</td></tr>';
    return;
  }
  var rid=u.residentId;
  var docs=data.documents.filter(function(d){return d.residentId===rid;});
  $('#reqStatTotal').textContent=docs.length;
  $('#reqStatPending').textContent=docs.filter(function(d){return ['Pending','Under Review','Payment Pending','For Captain Approval','Approved'].indexOf(d.status)>=0;}).length;
  $('#reqStatReleased').textContent=docs.filter(function(d){return d.status==='Released';}).length;
  $('#reqStatPay').textContent=docs.filter(function(d){return d.status==='Payment Pending';}).length;

  $('#myRequestsTable').innerHTML=docs.map(function(d,idx){
    var actions='';
    if(d.status==='Payment Pending'){
      var pay=data.payments.find(function(p){return p.documentId===d.id&&p.status==='Pending';});
      if(pay){
        if(pay.gcashRef){
          actions+='<span class="badge badge-warning">Proof submitted — awaiting verification</span> <button class="btn btn-sm btn-outline" onclick="openResidentGcashPay('+pay.id+')">Update Ref</button> ';
        } else {
          actions+='<button class="btn btn-sm btn-success" onclick="openResidentGcashPay('+pay.id+')">Pay ₱'+(d.fee||0)+' via GCash</button> ';
        }
      }
    }
    if(d.status==='Released'){
      actions+='<button class="btn btn-sm btn-primary" onclick="downloadDocumentPDF('+d.id+')"><i class="fas fa-download"></i> Download File</button> ';
      actions+='<button class="btn btn-sm btn-outline" onclick="viewFilledDocument('+d.id+')">View Official</button> ';
    } else if(d.status==='Payment Pending'){
      actions+='<button class="btn btn-sm btn-outline" onclick="viewDocument('+d.id+')">Status / Pay</button> ';
    } else {
      actions+='<button class="btn btn-sm btn-outline" onclick="viewDocument('+d.id+')">Status</button> ';
    }
    var paidRec = data.payments.find(function(p){ return p.documentId===d.id && p.status==='Paid' && p.verified; });
    if(paidRec){
      actions+='<button class="btn btn-sm btn-outline" onclick="openPaymentReceipt('+paidRec.id+')"><i class="fas fa-receipt"></i> Receipt</button> ';
    }
    actions+='<button class="btn btn-sm btn-danger" onclick="deleteDocument('+d.id+');renderMyRequests();">Delete</button>';
    return '<tr><td>'+(idx+1)+'</td><td><strong>'+d.type+'</strong></td><td>'+d.purpose+'</td><td>₱'+(d.fee||0).toFixed(2)+'</td><td>'+statusBadge(d.status)+'</td><td>'+formatDate(d.requestDate)+'</td><td>'+formatDate(d.releaseDate)+'</td><td>'+actions+'</td></tr>';
  }).join('')||'<tr><td colspan="8" class="empty-state">No requests yet. Go to Resident Portal to request a document.</td></tr>';

  // Document-only notifs for this resident
  var notifs=data.notifications.filter(function(n){
    return n.residentId===rid && (n.category==='document' || (n.title&&n.title.toLowerCase().indexOf('document')>=0) || (n.title&&n.title.toLowerCase().indexOf('request')>=0) || (n.title&&n.title.toLowerCase().indexOf('released')>=0) || (n.title&&n.title.toLowerCase().indexOf('approved')>=0));
  }).slice(0,10);
  if($('#myReqNotifs')){
    $('#myReqNotifs').innerHTML=notifs.map(function(n){
      var bg=n.type==='success'?'#d1fae5':n.type==='warning'?'#fef3c7':'#dbeafe';
      var col=n.type==='success'?'#059669':n.type==='warning'?'#d97706':'#2563eb';
      return '<li class="notif-item"><div class="notif-icon" style="background:'+bg+';color:'+col+'">📄</div><div class="notif-content"><h4>'+n.title+'</h4><p>'+n.message+'</p><div class="notif-time">'+n.time+'</div></div><button class="btn btn-sm btn-danger" onclick="deleteNotification('+n.id+');renderMyRequests();">Delete</button></li>';
    }).join('')||'<div class="empty-state">No document notifications yet</div>';
  }
}

/* ===== FILLED DOCUMENT PDF (auto-fill official wording + download) ===== */
/* ===== BLUEPRINT: H. GENERATED CERTIFICATE FROM REQUEST DATA ===== */
function getApplicantDetails(d, r){
  var fd = d.formDetails || {};
  var fullName = fd.fullName || d.applicantName || (r ? (r.firstName+' '+(r.middleName||'')+' '+r.lastName).replace(/\s+/g,' ').trim() : 'N/A');
  var civil = fd.civilStatus || d.applicantCivilStatus || (r ? r.civilStatus : '') || '';
  var address = fd.completeAddress || fd.address || d.applicantAddress || (r ? r.address : '') || '';
  var purok = fd.purok || d.applicantPurok || (r ? r.purok : '') || '';
  var gender = fd.gender || (r ? r.gender : '') || '';
  var pronoun = fd.pronoun || (/female/i.test(gender) ? 'she' : (/male/i.test(gender) ? 'he' : 'he/she'));
  var possessive = fd.possessive || (pronoun === 'she' ? 'her' : (pronoun === 'he' ? 'his' : 'his/her'));
  var p = data.profiling || {};
  return {
    fullName: fullName,
    civilStatus: civil,
    address: address,
    purok: purok,
    contact: fd.contact || d.applicantContact || (r ? r.contact : '') || '',
    gender: gender,
    pronoun: pronoun,
    possessive: possessive,
    birthDate: fd.birthDate || (r ? r.birthDate : '') || '',
    birthplace: fd.birthplace || '',
    purpose: fd.purpose || d.purpose || 'whatever legal purpose it may serve',
    yearsResiding: fd.yearsResiding || '',
    monthlyIncome: fd.monthlyIncome || '',
    employmentStatus: fd.employmentStatus || 'not a government employee',
    beneficiaryName: fd.beneficiaryName || fullName,
    businessName: fd.businessName || '',
    businessAddress: fd.businessAddress || address,
    businessPurpose: fd.businessPurpose || 'Business Permit Application',
    soloCircumstance: fd.soloCircumstance || '',
    childrenCount: fd.childrenCount || '',
    receivingOffice: fd.receivingOffice || '',
    endorsementReason: fd.endorsementReason || d.purpose || '',
    incidentDetails: fd.incidentDetails || d.purpose || '',
    barangay: fd.barangay || p.name || 'Barangay Dumanguena',
    municipality: fd.municipality || p.city || p.Municipality || 'Narra',
    province: fd.province || p.province || 'Palawan',
    captain: fd.captain || p.captain || 'Punong Barangay',
    hallAddress: p.address || '',
    hallContact: p.contact || '',
    issueDate: d.releaseDate || d.approvedDate || d.requestDate || today(),
    orNumber: d.orNumber || 'N/A'
  };
}

function formatLongDate(dateStr){
  try {
    var dt = new Date(dateStr);
    if(isNaN(dt.getTime())) return String(dateStr || '');
    var months = ['January','February','March','April','May','June','July','August','September','October','November','December'];
    return dt.getDate() + ' Day of ' + months[dt.getMonth()] + ', ' + dt.getFullYear();
  } catch(e){ return String(dateStr || ''); }
}

function buildOfficialDocumentBody(d, a){
  var type = d.type || '';
  var issueLong = formatLongDate(a.issueDate);
  var loc = a.barangay + ', ' + a.municipality + ', ' + a.province;

  if(type === 'Certificate of Indigency'){
    return [
      'TO WHOM IT MAY CONCERN:',
      '',
      'This is to certify that '+a.fullName+' of legal age, '+a.civilStatus+', Filipino citizen, and residing at '+loc+', is a bonafide resident of this barangay and is known to be indigent.',
      '',
      'Further certify that '+a.pronoun+' is '+a.employmentStatus+' and has a monthly income of Php. '+(a.monthlyIncome||'0')+', which is insufficient to support the basic needs of '+a.possessive+' family.',
      '',
      'This certification is being issued to support '+a.beneficiaryName+'\'s application for '+a.purpose+'.',
      '',
      'Issued this '+issueLong+', at '+loc+'.'
    ];
  }
  if(type === 'Certificate of Residency'){
    return [
      'TO WHOM IT MAY CONCERN:',
      '',
      'This is to certify that '+a.fullName+', of legal age, '+a.civilStatus+', Filipino citizen, is a Bonafide resident of '+loc+', and has been residing at '+(a.address||loc)+(a.yearsResiding ? (' for '+a.yearsResiding+' years') : '')+'.',
      '',
      'This certification is being issued upon the request of the above-named person for '+a.purpose+' purposes.',
      '',
      'Issued this '+issueLong+', at '+loc+'.'
    ];
  }
  if(type === 'Barangay Clearance'){
    var obj = a.possessive.replace('his/her','him/her').replace('his','him').replace('her','her');
    return [
      'TO WHOM IT MAY CONCERN:',
      '',
      'This is to certify that '+a.fullName+', of legal age, '+a.civilStatus+', Filipino citizen, and a resident of Barangay '+a.barangay+', '+a.municipality+', '+a.province+', is known to be of good moral character and a law-abiding citizen in this barangay.',
      '',
      'Further certify that '+a.pronoun+' has no derogatory record and no pending case filed against '+obj+' in this barangay as of this date.',
      '',
      'This clearance is being issued upon the request of the above-named person for '+a.purpose+' purposes.',
      '',
      'Issued this '+issueLong+', at Barangay '+a.barangay+', '+a.municipality+', '+a.province+'.'
    ];
  }
  if(type === 'Certificate of Good Moral Character'){
    return [
      'TO WHOM IT MAY CONCERN:',
      '',
      'This is to certify that '+a.fullName+', of legal age, '+a.civilStatus+', Filipino citizen, and a bonafide resident of '+loc+', is personally known to this office to be of good moral character, law-abiding, and of good standing in the community.',
      '',
      'This certification is being issued upon the request of the above-named person for '+a.purpose+' purposes.',
      '',
      'Issued this '+issueLong+', at '+loc+'.'
    ];
  }
  if(type === 'Business Permit'){
    return [
      'TO WHOM IT MAY CONCERN:',
      '',
      'This is to certify that the business establishment named '+(a.businessName||'N/A')+', owned and operated by '+a.fullName+', located at '+(a.businessAddress||a.address)+', '+loc+', is granted clearance to operate within the jurisdiction of this barangay.',
      '',
      'This clearance is issued for the purpose of '+(a.businessPurpose||a.purpose)+' and is subject to the barangay ordinances and local regulations.',
      '',
      'Issued this '+issueLong+', at '+loc+'.'
    ];
  }
  if(type === 'Certificate of First Time Job Seeker'){
    return [
      'TO WHOM IT MAY CONCERN:',
      '',
      'This is to certify that '+a.fullName+', of legal age, and a bonafide resident of '+loc+', is a first-time jobseeker as defined under Republic Act No. 11261, otherwise known as the "Jobstart Philippines Act," and has not been previously employed.',
      '',
      'This certification is issued for the purpose of availing the benefits under the Republic Act No. 11261'+(a.purpose ? (', and for '+a.purpose) : '')+', and for whatever legal purpose it may serve.',
      '',
      'Issued this '+issueLong+', at '+loc+'.'
    ];
  }
  if(type === 'Certificate of No Pending Case'){
    return [
      'TO WHOM IT MAY CONCERN:',
      '',
      'This is to certify that '+a.fullName+', of legal age, '+a.civilStatus+', Filipino citizen, and a resident of '+loc+', has no pending case filed against '+a.possessive.replace('his/her','him/her').replace('his','him').replace('her','her')+' in this barangay, and has no derogatory record on file as of the date of this certification.',
      '',
      'This certification is being issued upon the request of the above-named person for '+a.purpose+' purposes.',
      '',
      'Issued this '+issueLong+', at '+loc+'.'
    ];
  }
  if(type === 'Certificate of Solo Parent'){
    return [
      'TO WHOM IT MAY CONCERN:',
      '',
      'This is to certify that '+a.fullName+', of legal age, and a bonafide resident of '+loc+', is known to this office to be a solo parent under '+(a.soloCircumstance||'applicable circumstances')+', with '+(a.childrenCount||'1')+' child/children under '+a.possessive+' care and support.',
      '',
      'This certification is being issued to support '+a.possessive+' application for a Solo Parent ID / benefits under Republic Act No. 11861 (Expanded Solo Parents Welfare Act), and for whatever legal purpose it may serve.',
      '',
      'Issued this '+issueLong+', at '+loc+'.'
    ];
  }
  if(type === 'Barangay Endorsement'){
    return [
      formatDate(a.issueDate),
      '',
      (a.receivingOffice || 'Concerned Office'),
      '',
      'Sir/Madam:',
      '',
      'This barangay is respectfully endorsing '+a.fullName+', of legal age, '+a.civilStatus+', and a resident of '+loc+', in connection with '+(a.endorsementReason||a.purpose)+'.',
      '',
      'This endorsement is issued for appropriate action and disposition by your good office, and for whatever legal purpose it may serve.',
      '',
      'Thank you for your usual courtesy and cooperation.',
      '',
      'Respectfully yours,'
    ];
  }
  if(type === 'Certificate of Low Income'){
    return [
      'TO WHOM IT MAY CONCERN:',
      '',
      'This is to certify that '+a.fullName+', of legal age, '+a.civilStatus+', Filipino citizen, and residing at '+loc+', belongs to a low-income household with an estimated combined family monthly income of Php. '+(a.monthlyIncome||'0')+'.',
      '',
      'This certification is being issued upon the request of the above-named person for '+a.purpose+' purposes.',
      '',
      'Issued this '+issueLong+', at '+loc+'.'
    ];
  }
  if(type === 'Barangay ID'){
    return [
      'TO WHOM IT MAY CONCERN:',
      '',
      'This is to certify that '+a.fullName+(a.birthDate ? (', born on '+formatDate(a.birthDate)) : '')+(a.birthplace ? (' at '+a.birthplace) : '')+', and residing at '+(a.address||loc)+', is a bonafide resident of this barangay and is entitled to a Barangay Identification Card.',
      '',
      'This certification is issued for identification and for whatever legal purpose it may serve.',
      '',
      'Issued this '+issueLong+', at '+loc+'.'
    ];
  }
  if(type === 'Blotter / Incident Report'){
    return [
      'TO WHOM IT MAY CONCERN:',
      '',
      'This is to certify that an incident was recorded involving '+a.fullName+', resident of '+(a.address||loc)+'.',
      '',
      'Details: '+(a.incidentDetails||a.purpose)+'.',
      '',
      'Issued this '+issueLong+', at '+loc+'.'
    ];
  }
  // Default / Barangay Certification (General Purpose)
  return [
    'TO WHOM IT MAY CONCERN:',
    '',
    'This is to certify that '+a.fullName+', of legal age, '+a.civilStatus+', Filipino citizen, and residing at '+(a.address||loc)+', is personally known to this office and is a bonafide resident of this barangay.',
    '',
    'This certification is being issued upon the request of the above-named person for '+a.purpose+', and for whatever legal purpose it may serve.',
    '',
    'Issued this '+issueLong+', at '+loc+'.'
  ];
}

/* Cached barangay logo (PNG data URL) for certificate headers */
var _barangayLogoDataUrl = null;
var _barangayLogoLoading = null;

function loadBarangayLogoDataUrl(){
  if(_barangayLogoDataUrl) return Promise.resolve(_barangayLogoDataUrl);
  if(_barangayLogoLoading) return _barangayLogoLoading;
  _barangayLogoLoading = new Promise(function(resolve){
    var img = new Image();
    img.crossOrigin = 'anonymous';
    img.onload = function(){
      try {
        var size = 256;
        var canvas = document.createElement('canvas');
        canvas.width = size;
        canvas.height = size;
        var ctx = canvas.getContext('2d');
        ctx.clearRect(0, 0, size, size);
        ctx.drawImage(img, 0, 0, size, size);
        _barangayLogoDataUrl = canvas.toDataURL('image/png');
        resolve(_barangayLogoDataUrl);
      } catch(e){
        console.warn('Logo rasterize failed', e);
        resolve(null);
      }
    };
    img.onerror = function(){ resolve(null); };
    img.src = 'assets/barangay-seal.png';
  });
  return _barangayLogoLoading;
}

function drawCertificateHeader(doc, a, logoDataUrl){
  var pageWidth = 210;
  var marginL = 22;
  var marginR = 22;
  var center = pageWidth / 2;
  var y = 14;
  var logoSize = 28; // mm — official Barangay Dumanguena seal

  // Single centered logo (matches official clearance template)
  if(logoDataUrl){
    try {
      doc.addImage(logoDataUrl, 'PNG', center - logoSize/2, y, logoSize, logoSize);
    } catch(e){ console.warn('addImage logo failed', e); }
    y += logoSize + 4;
  } else {
    y += 4;
  }

  doc.setFont('times', 'bold');
  doc.setFontSize(12);
  doc.text('Republic of the Philippines', center, y, { align: 'center' }); y += 5;
  doc.setFont('times', 'bold');
  doc.setFontSize(11);
  doc.text('Province of ' + String(a.province || 'PALAWAN').toUpperCase(), center, y, { align: 'center' }); y += 5;
  doc.text('Municipality of ' + String(a.municipality || 'NARRA').toUpperCase(), center, y, { align: 'center' }); y += 5;
  doc.text(String(a.barangay || 'Barangay Dumanguena'), center, y, { align: 'center' }); y += 5.5;
  doc.setFontSize(11);
  doc.text('OFFICE OF THE PUNONG BARANGAY', center, y, { align: 'center' }); y += 5;
  doc.setFont('times', 'normal');
  doc.setFontSize(9);
  // Address style from official template: "Dumangueña || Tel No. ..."
  var shortPlace = String(a.barangay || 'Dumanguena').replace(/^Barangay\s+/i, '');
  var tel = a.hallContact || '';
  var hallLine = shortPlace + (tel ? (' || Tel No. ' + tel) : '');
  if(a.hallAddress && a.hallAddress.toLowerCase().indexOf(shortPlace.toLowerCase()) < 0){
    hallLine = (a.hallAddress || shortPlace) + (tel ? (' || Tel No. ' + tel) : '');
  }
  if(hallLine){
    doc.text(hallLine, center, y, { align: 'center' });
    y += 4;
  }

  doc.setDrawColor(0, 0, 0);
  doc.setLineWidth(0.7);
  doc.line(marginL, y, pageWidth - marginR, y);
  return y + 9;
}

function generateFilledDocumentPDF(d, options){
  options = options || {};
  var doDownload = options.download !== false;
  var r = data.residents.find(function(x){ return x.id === d.residentId; });
  var a = getApplicantDetails(d, r);
  var bodyLines = buildOfficialDocumentBody(d, a);

  if(!(window.jspdf && window.jspdf.jsPDF) && typeof window.jsPDF === 'undefined'){
    return printFilledDocumentFallback(d, a, bodyLines, doDownload);
  }

  function buildDoc(logoDataUrl){
    var JsPDF = window.jspdf ? window.jspdf.jsPDF : window.jsPDF;
    var doc = new JsPDF({ unit: 'mm', format: 'a4' });
    var pageWidth = 210;
    var marginL = 25;
    var marginR = 25;
    var maxWidth = pageWidth - marginL - marginR;
    var center = pageWidth / 2;

    var y = drawCertificateHeader(doc, a, logoDataUrl);

    // Title
    doc.setFont('times', 'bold');
    doc.setFontSize(14);
    doc.text(String(d.type || 'BARANGAY CERTIFICATION').toUpperCase(), center, y, { align: 'center' });
    y += 12;

    // Body
    doc.setFont('times', 'normal');
    doc.setFontSize(11);
    bodyLines.forEach(function(line){
      if(line === ''){ y += 5; return; }
      var wrapped = doc.splitTextToSize(line, maxWidth);
      if(y + wrapped.length * 6.2 > 250){ doc.addPage(); y = 28; }
      doc.text(wrapped, marginL, y, { align: 'left', lineHeightFactor: 1.35 });
      y += wrapped.length * 6.2 + 1.5;
    });

    // Signature block (right-aligned, underlined name — matches official template)
    y += 22;
    if(y > 245){ doc.addPage(); y = 40; }
    var signX = 145;
    var signName = String(d.approvedBy || a.captain || 'Punong Barangay').toUpperCase();
    if(signName.indexOf('HON') !== 0 && a.captain && String(a.captain).toUpperCase().indexOf('HON') === 0){
      signName = String(a.captain).toUpperCase();
    } else if(signName.indexOf('HON') !== 0){
      signName = 'HON. ' + signName.replace(/^HON\.?\s*/i, '');
    }
    doc.setFont('times', 'bold');
    doc.setFontSize(11);
    doc.text(signName, signX, y, { align: 'center' });
    // Underline under name
    var nameWidth = doc.getTextWidth(signName);
    doc.setLineWidth(0.4);
    doc.line(signX - nameWidth/2, y + 1.2, signX + nameWidth/2, y + 1.2);
    y += 6;
    doc.setFont('times', 'italic');
    doc.setFontSize(10);
    doc.text('Punong Barangay', signX, y, { align: 'center' });

    doc.setFont('times', 'normal');
    doc.setFontSize(8);
    doc.text('OR No: ' + a.orNumber + '  |  Status: ' + d.status + '  |  Fee: PHP ' + (d.fee || 0), marginL, 285);

    var fileName = (String(d.type || 'Document').replace(/\s+/g, '_')) + '_' +
      (a.fullName || 'Resident').replace(/\s+/g, '_') + '.pdf';
    if(options.returnBlob){
      return URL.createObjectURL(doc.output('blob'));
    }
    if(doDownload){
      doc.save(fileName);
    }
    return doc;
  }

  // Prefer async logo load when returnBlob / download so logo is included
  if(options.returnBlob || doDownload || options.async){
    return loadBarangayLogoDataUrl().then(function(logo){
      return buildDoc(logo);
    });
  }
  if(!_barangayLogoDataUrl) loadBarangayLogoDataUrl();
  return buildDoc(_barangayLogoDataUrl);
}

/** Open clean auto-filled certificate with barangay logo in header */
function openFilledDocumentViewer(d, titleOverride){
  if(!d){ showToast('Document not found','error'); return; }
  var u = data.currentUser;
  var isResident = u && u.role === 'Resident';
  // Hard block: residents must not see filled official document until Released (paid + Treasurer verified)
  if(isResident && d.status !== 'Released'){
    showToast('Hindi pa available ang official document. Magbayad muna at hintayin ang verification ng Treasurer.','error');
    return;
  }
  var title = titleOverride || (d.type + ' — ' + getResidentName(d.residentId) + ' (Auto-filled)');
  Promise.resolve(generateFilledDocumentPDF(d, { download: false, returnBlob: true, async: true }))
    .then(function(url){
      if(url) openPDFFile(url, title, null);
      else {
        var r = data.residents.find(function(x){ return x.id === d.residentId; });
        var a = getApplicantDetails(d, r);
        printFilledDocumentFallback(d, a, buildOfficialDocumentBody(d, a), false);
      }
    })
    .catch(function(err){
      console.error(err);
      var r = data.residents.find(function(x){ return x.id === d.residentId; });
      var a = getApplicantDetails(d, r);
      printFilledDocumentFallback(d, a, buildOfficialDocumentBody(d, a), false);
    });
}

function printFilledDocumentFallback(d, a, bodyLines, doDownload){
  var w = window.open('', '_blank');
  if(!w){ showToast('Please allow pop-ups to view/download the document','error'); return null; }
  var html = '<html><head><title>'+d.type+'</title><style>'+
    'body{font-family:Times New Roman,serif;padding:40px;max-width:700px;margin:0 auto;line-height:1.45;}'+
    '.c{text-align:center;} h2{margin:6px 0;} .sig{text-align:right;margin-top:40px;}'+
    '@media print{button{display:none;}}'+
    '</style></head><body>';
  html += '<div class="c">';
  html += '<img src="assets/barangay-seal.png" alt="Barangay Logo" style="width:72px;height:72px;margin-bottom:8px;"/>';
  html += '<p style="margin:2px 0;font-weight:700;">Republic of the Philippines</p>';
  html += '<p style="margin:2px 0;font-weight:700;">Province of '+(a.province||'').toUpperCase()+'</p>';
  html += '<p style="margin:2px 0;font-weight:700;">Municipality of '+(a.municipality||'').toUpperCase()+'</p>';
  html += '<p style="margin:2px 0;font-weight:700;">'+(a.barangay||'')+'</p>';
  html += '<p style="margin:4px 0;font-weight:700;">OFFICE OF THE PUNONG BARANGAY</p>';
  html += '<p style="margin:2px 0;font-size:13px;">'+String(a.barangay||'Dumanguena').replace(/^Barangay\s+/i,'')+(a.hallContact?(' || Tel No. '+a.hallContact):'')+'</p>';
  html += '<hr style="margin:12px 0;border:none;border-top:2px solid #111;"/>';
  html += '<h3 style="margin-top:14px;letter-spacing:0.5px;">'+String(d.type||'').toUpperCase()+'</h3></div>';
  bodyLines.forEach(function(line){
    html += line ? ('<p>'+line+'</p>') : '<br>';
  });
  html += '<div class="sig"><p><strong>'+String(d.approvedBy||a.captain||'Punong Barangay').toUpperCase()+'</strong><br><em>Punong Barangay</em></p></div>';
  html += '<p style="font-size:12px;margin-top:24px;">OR No: '+a.orNumber+' | Status: '+d.status+' | Fee: ₱'+(d.fee||0)+'</p>';
  html += '<p style="margin-top:20px;"><button onclick="window.print()">Print / Save as PDF</button></p>';
  html += '</body></html>';
  w.document.write(html);
  w.document.close();
  if(doDownload){
    setTimeout(function(){ try{ w.print(); }catch(e){} }, 400);
  }
  return null;
}

/* ===== Fill official PDF asset with resident data (pdf-lib overlays) ===== */
function pdfLibAvailable(){
  return !!(window.PDFLib && window.PDFLib.PDFDocument);
}

// pdftotext -bbox uses top-left origin; pdf-lib uses bottom-left.
function topYToPdfLib(pageHeight, yTopMax){
  return pageHeight - yTopMax;
}

async function fillIndigencyPdfAsset(pdfDoc, page, a){
  var rgb = window.PDFLib.rgb;
  var StandardFonts = window.PDFLib.StandardFonts;
  var font = await pdfDoc.embedFont(StandardFonts.TimesRoman);
  var fontBold = await pdfDoc.embedFont(StandardFonts.TimesRomanBold);
  var h = page.getHeight();
  var white = rgb(1, 1, 1);
  var black = rgb(0, 0, 0);

  function cover(x, yTopMin, w, hBox){
    var y = topYToPdfLib(h, yTopMin + hBox);
    page.drawRectangle({ x: x, y: y, width: w, height: hBox + 2, color: white });
  }
  function write(text, x, yTopMax, size, bold){
    var y = topYToPdfLib(h, yTopMax) + 2;
    page.drawText(String(text || ''), {
      x: x,
      y: y,
      size: size || 11,
      font: bold ? fontBold : font,
      color: black,
      maxWidth: 480
    });
  }

  // Hall address / contact
  cover(197, 166.8, 210, 14);
  write([a.hallAddress || a.barangay, a.hallContact || ''].filter(Boolean).join(' | '), 197, 180.5, 10);

  // Name blank
  cover(188, 258, 175, 16);
  write(a.fullName, 188, 273, 11, true);

  // Civil status
  cover(429, 258, 100, 16);
  write((a.civilStatus || '') + ',', 429, 273, 11);

  // Barangay / municipality / province
  cover(299, 278, 230, 16);
  write(a.barangay + ', ' + a.municipality + ',', 299, 293.4, 11);
  cover(72, 298, 80, 16);
  write(a.province + ',', 72, 313.8, 11);

  // Pronoun + employment
  cover(175, 331, 50, 16);
  write(a.pronoun, 175, 346.3, 11);
  cover(250, 331, 210, 16);
  write('is ' + (a.employmentStatus || 'not a government employee'), 250, 346.3, 11);

  // Monthly income amount
  cover(235, 351, 80, 16);
  write(String(a.monthlyIncome || '0') + ',', 235, 366.7, 11);

  // Beneficiary + purpose
  cover(350, 404, 160, 16);
  write(a.beneficiaryName || a.fullName, 350, 419.7, 10, true);
  cover(269, 424, 200, 16);
  write(a.purpose || '', 269, 440.2, 10);

  // Issue date + location
  cover(130, 477, 160, 16);
  write(formatLongDate(a.issueDate), 130, 493.1, 11);
  cover(300, 477, 220, 16);
  write('at ' + a.barangay + ', ' + a.municipality + ', ' + a.province + '.', 300, 493.1, 10);

  // Captain name
  cover(295, 570, 200, 18);
  write(String(a.captain || 'Punong Barangay').toUpperCase(), 295, 587.8, 11, true);
}

async function fillPdfAssetWithResidentData(d){
  if(!pdfLibAvailable()) return null;
  var path = d.pdfAsset || getDocumentAsset(d.type);
  if(!path) return null;

  var r = data.residents.find(function(x){ return x.id === d.residentId; });
  var a = getApplicantDetails(d, r);

  var res = await fetch(encodeURI(path));
  if(!res.ok) throw new Error('Could not load PDF asset: ' + path);
  var bytes = await res.arrayBuffer();

  var pdfDoc = await window.PDFLib.PDFDocument.load(bytes);
  var pages = pdfDoc.getPages();
  if(!pages.length) throw new Error('PDF has no pages');
  var page = pages[0];

  if(d.type === 'Certificate of Indigency' || /indigency/i.test(path)){
    await fillIndigencyPdfAsset(pdfDoc, page, a);
  } else {
    // Generic stamp for other assets (e.g. sample clearance PDF)
    var rgb = window.PDFLib.rgb;
    var StandardFonts = window.PDFLib.StandardFonts;
    var font = await pdfDoc.embedFont(StandardFonts.TimesRoman);
    var fontBold = await pdfDoc.embedFont(StandardFonts.TimesRomanBold);
    var boxY = 36;
    page.drawRectangle({
      x: 40, y: boxY, width: 515, height: 88,
      color: rgb(1, 1, 1),
      borderColor: rgb(0.75, 0.75, 0.75),
      borderWidth: 0.5
    });
    var lines = [
      'AUTO-FILLED FROM RESIDENT RECORD',
      'Name: ' + a.fullName + '  |  Civil Status: ' + a.civilStatus,
      'Address: ' + (a.address || '') + (a.purok ? (', Purok ' + a.purok) : ''),
      'Purpose: ' + a.purpose,
      'Issued: ' + formatDate(a.issueDate) + '  |  OR: ' + a.orNumber + '  |  Fee: PHP ' + (d.fee || 0)
    ];
    var y = boxY + 72;
    lines.forEach(function(line, idx){
      page.drawText(line, {
        x: 48, y: y - idx * 12,
        size: idx === 0 ? 9 : 10,
        font: idx === 0 ? fontBold : font,
        color: rgb(0, 0, 0),
        maxWidth: 500
      });
    });
  }

  return await pdfDoc.save();
}

function triggerPdfBytesDownload(uint8, fileName){
  var blob = new Blob([uint8], { type: 'application/pdf' });
  var url = URL.createObjectURL(blob);
  var a = document.createElement('a');
  a.href = url;
  a.download = fileName || 'document.pdf';
  document.body.appendChild(a);
  a.click();
  document.body.removeChild(a);
  setTimeout(function(){ URL.revokeObjectURL(url); }, 2000);
}

function downloadDocumentPDF(id){
  var d = data.documents.find(function(x){ return x.id === id; });
  if(!d){ showToast('Document not found','error'); return; }
  var u = data.currentUser;
  var isOwner = u && u.role === 'Resident' && u.residentId === d.residentId;
  var isStaff = u && (u.role === 'Admin' || u.role === 'Secretary' || u.role === 'Treasurer');
  if(!isOwner && !isStaff){
    showToast('You do not have access to this document','error');
    return;
  }
  if(isOwner && d.status !== 'Released'){
    showToast('Document is not yet released','error');
    return;
  }

  showToast('Preparing document with barangay logo…');
  Promise.resolve(generateFilledDocumentPDF(d, { download: true, async: true }))
    .then(function(){
      showToast('Download started — filled document ready');
      if(isOwner){
        d.received = true;
        d.downloadedAt = today();
        saveData();
        if($('#module-myrequests') && $('#module-myrequests').classList.contains('active')) renderMyRequests();
        if($('#module-portal') && $('#module-portal').classList.contains('active')) renderPortal();
      }
    })
    .catch(function(err){
      console.error(err);
      showToast('Could not generate document','error');
    });
}

function viewFilledDocument(id){
  var d = data.documents.find(function(x){ return x.id === id; });
  if(!d){ showToast('Document not found','error'); return; }
  var u = data.currentUser;
  var isOwner = u && u.role === 'Resident' && u.residentId === d.residentId;
  var isStaff = u && (u.role === 'Admin' || u.role === 'Secretary' || u.role === 'Treasurer');
  if(!isOwner && !isStaff){ showToast('Access denied','error'); return; }
  if(isOwner && d.status !== 'Released'){ showToast('Document is not yet released','error'); return; }
  // Same auto-filled template secretary/treasurer see during review
  openFilledDocumentViewer(d, d.type+' — '+getResidentName(d.residentId)+' (Auto-filled)');
}

function printDocumentFallback(d,r,p){
  var a = getApplicantDetails(d, r);
  var bodyLines = buildOfficialDocumentBody(d, a);
  printFilledDocumentFallback(d, a, bodyLines, true);
}

/* ===== CAPTAIN E-SIGNATURE ===== */
var _sigDrawing=false;
/* ===== BLUEPRINT: H. CAPTAIN SIGNATURE ===== */
function initSigCanvas(canvasId){
  var canvas=$(canvasId); if(!canvas) return null;
  var ctx=canvas.getContext('2d');
  ctx.strokeStyle='#0a5530'; ctx.lineWidth=2; ctx.lineCap='round';
  function pos(e){
    var rect=canvas.getBoundingClientRect();
    var clientX=e.touches?e.touches[0].clientX:e.clientX;
    var clientY=e.touches?e.touches[0].clientY:e.clientY;
    return { x:(clientX-rect.left)*(canvas.width/rect.width), y:(clientY-rect.top)*(canvas.height/rect.height) };
  }
  function start(e){ e.preventDefault(); _sigDrawing=true; var p=pos(e); ctx.beginPath(); ctx.moveTo(p.x,p.y); }
  function move(e){ if(!_sigDrawing)return; e.preventDefault(); var p=pos(e); ctx.lineTo(p.x,p.y); ctx.stroke(); }
  function end(e){ _sigDrawing=false; }
  canvas.onmousedown=start; canvas.onmousemove=move; canvas.onmouseup=end; canvas.onmouseleave=end;
  canvas.ontouchstart=start; canvas.ontouchmove=move; canvas.ontouchend=end;
  return ctx;
}
function clearCaptainSig(){
  var c=$('#captainSigCanvas'); if(!c)return;
  var ctx=c.getContext('2d'); ctx.clearRect(0,0,c.width,c.height);
}
function saveCaptainSig(){
  var c=$('#captainSigCanvas'); if(!c)return;
  data.captainSignature=c.toDataURL('image/png');
  saveData();
  $('#captainSigPreview').innerHTML='<p style="font-size:13px;color:#059669;">Signature saved ✓</p><img src="'+data.captainSignature+'" style="max-height:70px;border:1px solid #e5e7eb;border-radius:6px;background:#fff;">';
  showToast('Electronic signature saved');
}
function initApproveSigCanvas(){
  var c=$('#capApproveSigCanvas'); if(!c)return;
  var ctx=c.getContext('2d'); ctx.clearRect(0,0,c.width,c.height);
  initSigCanvas('#capApproveSigCanvas');
}
function clearApproveSigCanvas(){
  var c=$('#capApproveSigCanvas'); if(!c)return;
  c.getContext('2d').clearRect(0,0,c.width,c.height);
}

// Init captain sig canvas when navigating to captain
var _oldRenderCaptain = typeof renderCaptain==='function' ? renderCaptain : null;


/* ===== DARK MODE ===== */
/* ===== BLUEPRINT: L. THEME MANAGEMENT ===== */
function getPreferredTheme(){
  try {
    var saved = localStorage.getItem('ebarangay_theme');
    if(saved === 'dark' || saved === 'light') return saved;
  } catch(e){}
  if(window.matchMedia && window.matchMedia('(prefers-color-scheme: dark)').matches) return 'dark';
  return 'light';
}



/* >>> TITLE: RESIDENT RECORDS BY PUROK (Secretary + Captain) <<< */
var PUROK_LIST = [
  'Purok Bagong Lipunan',
  'Purok Pag-asa',
  'Purok Maligaya',
  'Purok Silangan',
  'Purok Masagana',
  'Purok Magsasaka',
  'Purok Tagbisay'
];

var PUROK_LEGACY_MAP = {
  '1': 'Purok Bagong Lipunan',
  '2': 'Purok Pag-asa',
  '3': 'Purok Maligaya',
  '4': 'Purok Silangan',
  '5': 'Purok Masagana',
  '6': 'Purok Magsasaka',
  '7': 'Purok Tagbisay',
  'purok 1': 'Purok Bagong Lipunan',
  'purok 2': 'Purok Pag-asa',
  'purok 3': 'Purok Maligaya',
  'purok 4': 'Purok Silangan',
  'purok 5': 'Purok Masagana',
  'purok 6': 'Purok Magsasaka',
  'purok 7': 'Purok Tagbisay'
};

function normalizePurok(p){
  var s = String(p || '').trim();
  if(!s) return 'Unassigned';
  var low = s.toLowerCase();
  if(PUROK_LEGACY_MAP[low]) return PUROK_LEGACY_MAP[low];
  var m = low.match(/purok\s*(\d+)/) || low.match(/^(\d+)$/);
  if(m && PUROK_LEGACY_MAP[m[1]]) return PUROK_LEGACY_MAP[m[1]];
  for(var i=0;i<PUROK_LIST.length;i++){
    if(low === PUROK_LIST[i].toLowerCase()) return PUROK_LIST[i];
    // partial match e.g. "Maligaya"
    if(PUROK_LIST[i].toLowerCase().indexOf(low) >= 0 || low.indexOf(PUROK_LIST[i].toLowerCase().replace('purok ','')) >= 0){
      return PUROK_LIST[i];
    }
  }
  return s;
}

function migratePurokNames(){
  try {
    var changed = false;
    (data.residents || []).forEach(function(r){
      var n = normalizePurok(r.purok);
      if(r.purok !== n && n !== 'Unassigned'){ r.purok = n; changed = true; }
    });
    if(changed) saveData();
  } catch(e){}
}

function selectPurokFilter(pk){
  var filterEl = document.getElementById('purokFilterSelect');
  if(filterEl){
    filterEl.value = (pk === 'all' || pk === null || pk === undefined) ? 'all' : String(pk);
  }
  renderPurokResidentRecords();
  var body = document.getElementById('purokRecordsBody');
  if(body) try{ body.scrollIntoView({ behavior: 'smooth', block: 'start' }); }catch(e){}
}
try { window.selectPurokFilter = selectPurokFilter; } catch(e){}

function renderPurokResidentRecords(scope){
  try { migratePurokNames(); } catch(e){}
  var filterEl = document.getElementById('purokFilterSelect');
  var searchEl = document.getElementById('purokSearchInput');
  var statsEl = document.getElementById('purokRecordsStats');
  var bodyEl = document.getElementById('purokRecordsBody');
  if(!bodyEl) return;

  var filter = filterEl ? filterEl.value : 'all';
  var q = (searchEl && searchEl.value ? searchEl.value : '').toLowerCase().trim();

  var allVerified = (data.residents || []).filter(function(r){ return !!r.verified; });
  var list = allVerified.slice();
  if(q){
    list = list.filter(function(r){
      var blob = [r.firstName,r.middleName,r.lastName,r.address,r.purok,r.contact,r.occupation,r.gender,r.civilStatus,r.nationalId].join(' ').toLowerCase();
      return blob.indexOf(q) >= 0;
    });
  }

  if(statsEl){
    statsEl.innerHTML = PUROK_LIST.map(function(pk){
      var c = allVerified.filter(function(r){ return normalizePurok(r.purok) === pk; }).length;
      var active = filter === pk;
      return '<button type="button" class="stat-card purok-stat-btn'+(active?' is-active':'')+'" onclick="selectPurokFilter(\''+pk.replace(/'/g,"\\'")+'\')" title="View '+pk+'">'
        +'<div class="stat-icon blue"><i class="fas fa-home"></i></div>'
        +'<div class="stat-info"><h3>'+c+'</h3><p>'+pk.replace('Purok ','')+'</p></div>'
        +'</button>';
    }).join('') +
    '<button type="button" class="stat-card purok-stat-btn'+(filter==='all'?' is-active':'')+'" onclick="selectPurokFilter(\'all\')" title="All puroks">'
      +'<div class="stat-icon green"><i class="fas fa-layer-group"></i></div>'
      +'<div class="stat-info"><h3>'+allVerified.length+'</h3><p>All Puroks</p></div>'
      +'</button>';
  }

  var groups = {};
  PUROK_LIST.forEach(function(pk){ groups[pk] = []; });
  groups['Unassigned'] = [];
  list.forEach(function(r){
    var pk = normalizePurok(r.purok);
    if(!groups[pk]) groups[pk] = [];
    groups[pk].push(r);
  });

  var keys = filter === 'all'
    ? PUROK_LIST.concat(groups['Unassigned'].length ? ['Unassigned'] : [])
    : [filter];

  bodyEl.innerHTML = keys.map(function(pk){
    var rows = (groups[pk] || []).slice().sort(function(a,b){
      return String(a.lastName||'').localeCompare(String(b.lastName||''));
    });

    if(!rows.length){
      return '<div class="purok-group card" style="margin-bottom:14px;box-shadow:none;">'
        +'<div class="card-header" style="background:var(--primary-soft,#EAFBF6);">'
        +'<h3 style="font-size:14px;"><i class="fas fa-map-pin"></i> '+pk+' <span class="badge badge-info">0</span></h3>'
        +'</div><div class="card-body"><p class="empty-state" style="padding:12px 0;">No verified residents in '+pk+' yet.</p></div></div>';
    }

    // Profile-style cards (like resident profile)
    var cards = rows.map(function(r){
      var full = ((r.firstName||'')+' '+(r.middleName||'')+' '+(r.lastName||'')).replace(/\s+/g,' ').trim();
      var initial = full ? full.charAt(0).toUpperCase() : '?';
      var avatar = r.profilePic
        ? '<div class="purok-profile-avatar has-photo" style="background-image:url('+JSON.stringify(r.profilePic)+')"></div>'
        : '<div class="purok-profile-avatar">'+initial+'</div>';
      var tags = [];
      if(r.voter) tags.push('<span class="badge badge-info">Voter</span>');
      if(r.senior) tags.push('<span class="badge badge-warning">Senior</span>');
      if(r.pwd) tags.push('<span class="badge badge-danger">PWD</span>');
      if(r.idVerified) tags.push('<span class="badge badge-success">ID Uploaded</span>');
      tags.push('<span class="badge badge-success">Verified</span>');

      return '<div class="purok-profile-card">'
        +'<div class="purok-profile-head">'
        + avatar
        +'<div class="purok-profile-title">'
        +'<h4>'+full+'</h4>'
        +'<p>'+pk+(r.address ? ' · '+r.address : '')+'</p>'
        +'<div class="purok-profile-tags">'+tags.join(' ')+'</div>'
        +'</div>'
        +'<button type="button" class="btn btn-sm btn-outline" onclick="viewResidentDetail('+r.id+')">View Profile</button>'
        +'</div>'
        +'<div class="purok-profile-grid">'
        +'<div><span class="lbl">Gender</span><span>'+(r.gender||'—')+'</span></div>'
        +'<div><span class="lbl">Civil Status</span><span>'+(r.civilStatus||'—')+'</span></div>'
        +'<div><span class="lbl">Birth Date</span><span>'+(r.birthDate?formatDate(r.birthDate):'—')+'</span></div>'
        +'<div><span class="lbl">Contact</span><span>'+(r.contact||'—')+'</span></div>'
        +'<div><span class="lbl">Occupation</span><span>'+(r.occupation||'—')+'</span></div>'
        +'<div><span class="lbl">National ID</span><span>'+(r.nationalId||'—')+'</span></div>'
        +'<div><span class="lbl">Address</span><span>'+(r.address||'—')+'</span></div>'
        +'<div><span class="lbl">Purok</span><span>'+pk+'</span></div>'
        +'</div></div>';
    }).join('');

    return '<div class="purok-group card" style="margin-bottom:14px;box-shadow:none;">'
      +'<div class="card-header" style="background:var(--primary-soft,#EAFBF6);">'
      +'<h3 style="font-size:14px;"><i class="fas fa-map-pin"></i> '+pk+' <span class="badge badge-info">'+rows.length+' residents</span></h3>'
      +'</div><div class="card-body"><div class="purok-profile-list">'+cards+'</div></div></div>';
  }).join('');
}

/* >>> TITLE: PAYMENT RECEIPT (Treasurer) <<< */
var _lastReceiptPaymentId = null;

function openPaymentReceipt(paymentId){
  var p = data.payments.find(function(x){ return x.id === paymentId; });
  if(!p){ showToast('Payment not found','error'); return; }
  var u = data.currentUser;
  var isStaff = u && (u.role === 'Admin' || u.role === 'Secretary' || u.role === 'Treasurer');
  var isOwner = u && u.role === 'Resident' && u.residentId === p.residentId;
  if(!isStaff && !isOwner){ showToast('You do not have access to this receipt','error'); return; }
  if(isOwner && !(p.status === 'Paid' && p.verified)){
    showToast('Receipt is available after Treasurer verifies your payment','error'); return;
  }
  _lastReceiptPaymentId = paymentId;
  var r = data.residents.find(function(x){ return x.id === p.residentId; });
  var d = p.documentId ? data.documents.find(function(x){ return x.id === p.documentId; }) : null;
  var resName = r ? ((r.firstName||'')+' '+(r.middleName||'')+' '+(r.lastName||'')).replace(/\s+/g,' ').trim() : getResidentName(p.residentId);
  var orNo = p.orNumber || ('OR-'+new Date().getFullYear()+'-'+String(p.id).padStart(4,'0'));
  var html =
    '<div class="eb-receipt" id="ebReceiptPrintArea">'+
      '<div style="text-align:center;margin-bottom:12px;">'+
        '<div style="font-weight:800;font-size:16px;color:#0B7468;">E-BARANGAY DUMANGUENA</div>'+
        '<div style="font-size:12px;color:#5A7B76;">Narra, Palawan · Office of the Treasurer</div>'+
        '<div style="font-weight:700;margin-top:10px;font-size:15px;letter-spacing:.06em;">OFFICIAL PAYMENT RECEIPT</div>'+
      '</div>'+
      '<div style="border-top:1px dashed #DCEFEA;border-bottom:1px dashed #DCEFEA;padding:12px 0;margin:10px 0;font-size:13px;">'+
        '<div class="form-row"><div class="form-group"><label>OR Number</label><p><strong>'+orNo+'</strong></p></div>'+
        '<div class="form-group"><label>Date</label><p>'+formatDate(p.verifiedDate||p.date||today())+'</p></div></div>'+
        '<div class="form-row"><div class="form-group"><label>Received From</label><p><strong>'+resName+'</strong></p></div>'+
        '<div class="form-group"><label>Purok</label><p>'+(r?(r.purok||'—'):'—')+'</p></div></div>'+
        '<div class="form-group"><label>Payment For</label><p>'+(p.type|| (d?d.type:'Document Fee'))+'</p></div>'+
        '<div class="form-row"><div class="form-group"><label>Method</label><p>'+(p.paymentMethod||'—')+'</p></div>'+
        '<div class="form-group"><label>Reference</label><p>'+(p.gcashRef||p.orNumber||'—')+'</p></div></div>'+
        '<div class="form-group"><label>Amount Paid</label><p style="font-size:20px;font-weight:800;color:#0B7468;">₱'+Number(p.amount||0).toFixed(2)+'</p></div>'+
        '<div class="form-group"><label>Received / Verified By</label><p>'+(p.verifiedBy|| (data.currentUser&&data.currentUser.name) || 'Treasurer')+'</p></div>'+
      '</div>'+
      '<p style="font-size:11px;color:#5A7B76;text-align:center;margin-top:8px;">This receipt confirms payment was received and verified by the Barangay Treasurer before document release.</p>'+
    '</div>';
  var body = document.getElementById('paymentReceiptBody');
  if(body) body.innerHTML = html;
  var modal = document.getElementById('paymentReceiptModal');
  if(modal) modal.classList.add('active');
}

function printPaymentReceiptWindow(){
  var area = document.getElementById('ebReceiptPrintArea');
  if(!area){ showToast('Nothing to print','error'); return; }
  var w = window.open('', '_blank', 'noopener,width=520,height=720');
  if(!w){ showToast('Pop-up blocked — allow pop-ups to print','error'); return; }
  w.document.write('<html><head><title>Payment Receipt</title><style>body{font-family:Inter,system-ui,sans-serif;padding:24px;color:#10322E;} label{font-size:11px;color:#5A7B76;display:block;} p{margin:2px 0 10px;} .form-row{display:flex;gap:16px;} .form-group{flex:1;}</style></head><body>'+area.innerHTML+'<script>window.onload=function(){window.print();}</script></body></html>');
  w.document.close();
}


/* Dark mode is LOGIN SCREEN ONLY. User portals always stay light teal. */
var _loginTheme = 'light';

function applyLoginTheme(){
  // Login stays light — dark mode removed
  try {
    document.documentElement.removeAttribute('data-theme');
    if(document.body){
      document.body.removeAttribute('data-theme');
      document.body.classList.remove('theme-dark','login-dark');
      document.body.classList.add('theme-light');
    }
    var icon = document.getElementById('loginThemeIcon');
    if(icon) icon.innerHTML = '<i class="fas fa-moon"></i>';
    var btn = document.getElementById('loginThemeToggle');
    if(btn) btn.style.display = 'none';
  } catch(e){}
}

function hideInAppThemeToggle(){
  try {
    var nodes = document.querySelectorAll('#app .theme-toggle, #app #themeToggle, .header-right .theme-toggle, .header #themeToggle');
    nodes.forEach(function(el){
      if(el && !el.classList.contains('login-theme-toggle')){
        el.style.display = 'none';
        el.setAttribute('hidden', 'true');
        el.setAttribute('aria-hidden', 'true');
      }
    });
  } catch(e){}
}

function forcePortalLightTheme(){
  try {
    document.documentElement.removeAttribute('data-theme');
    if(document.body){
      document.body.removeAttribute('data-theme');
      document.body.classList.remove('theme-dark');
      document.body.classList.add('theme-light','in-app');
    }
  } catch(e){}
}

function applyTheme(theme){
  // Backward-compatible name: only affects login cosmetics
  applyLoginTheme(theme);
  // Always keep document-level theme light for portals
  try {
    document.documentElement.removeAttribute('data-theme');
    if(document.body){
      document.body.removeAttribute('data-theme');
      document.body.classList.remove('theme-dark');
      document.body.classList.add('theme-light');
    }
  } catch(e){}
}

function toggleTheme(){
  // Dark mode removed — system is light-only
  try {
    document.documentElement.removeAttribute('data-theme');
    if(document.body){
      document.body.removeAttribute('data-theme');
      document.body.classList.remove('theme-dark');
      document.body.classList.add('theme-light');
    }
    localStorage.setItem('ebarangay_theme', 'light');
    localStorage.setItem('ebarangay_login_theme', 'light');
  } catch(e){}
}

function initTheme(){
  // Light theme only
  try {
    document.documentElement.removeAttribute('data-theme');
    if(document.body){
      document.body.removeAttribute('data-theme');
      document.body.classList.remove('theme-dark');
      document.body.classList.add('theme-light');
    }
    localStorage.setItem('ebarangay_theme', 'light');
  } catch(e){}
}

/* ===== DOCUMENT TYPES MANAGEMENT (Captain / Admin + Secretary) ===== */
/* ===== BLUEPRINT: K. OFFERED DOCUMENT TYPE ADMINISTRATION ===== */
function renderDocTypesTable(){
  var types = getDocTypes();
  var html = types.map(function(t, i){
    var pdf = t.pdfAsset || DOCUMENT_ASSETS[t.name] || DEFAULT_PDF_TEMPLATE || '';
    var pdfLabel = pdf ? ('<code style="font-size:11px;">'+pdf+'</code>') : '<span class="badge badge-warning">No PDF</span>';
    return '<tr>'+
      '<td>'+(i+1)+'</td>'+
      '<td><strong>'+t.name+'</strong></td>'+
      '<td>'+(t.fee ? '₱'+t.fee : '<span class="badge badge-success">Free</span>')+'</td>'+
      '<td style="max-width:320px;font-size:12px;">'+pdfLabel+
        (pdf ? ' <button class="btn btn-sm btn-outline" onclick="openPDFFile(\''+pdf.replace(/'/g,"\\'")+'\', \''+t.name.replace(/'/g,"\\'")+'\')">View</button>' : '')+
      '</td>'+
      '<td>'+
        '<button class="btn btn-sm btn-info" onclick="openEditDocType('+i+')">Edit</button> '+
        '<button class="btn btn-sm btn-danger" onclick="deleteDocType('+i+')">Delete</button>'+
      '</td></tr>';
  }).join('') || '<tr><td colspan="5" class="empty-state">No document types configured</td></tr>';
  var tbody = $('#docTypesTable');
  if(tbody) tbody.innerHTML = html;
  var tbodySec = $('#docTypesTableSec');
  if(tbodySec) tbodySec.innerHTML = html;
}

function openAddDocType(){
  $('#docTypeEditIndex').value = '-1';
  $('#docTypeModalTitle').textContent = 'Add Document Type';
  $('#dtName').value = '';
  $('#dtFee').value = '0';
  if($('#dtPdfAsset')) $('#dtPdfAsset').value = DEFAULT_PDF_TEMPLATE;
  if($('#dtTemplate')) $('#dtTemplate').value = '';
  $('#docTypeModal').classList.add('active');
}

function openEditDocType(index){
  var types = getDocTypes();
  var t = types[index];
  if(!t) return;
  $('#docTypeEditIndex').value = String(index);
  $('#docTypeModalTitle').textContent = 'Edit Document Type';
  $('#dtName').value = t.name;
  $('#dtFee').value = t.fee || 0;
  if($('#dtPdfAsset')) $('#dtPdfAsset').value = t.pdfAsset || DOCUMENT_ASSETS[t.name] || DEFAULT_PDF_TEMPLATE || '';
  if($('#dtTemplate')) $('#dtTemplate').value = t.template || '';
  $('#docTypeModal').classList.add('active');
}

function openEditDocFormat(typeName){
  var types = getDocTypes();
  var idx = types.findIndex(function(x){ return x.name === typeName; });
  if(idx < 0){ showToast('Document type not found','error'); return; }
  openEditDocType(idx);
  setTimeout(function(){ if($('#dtPdfAsset')) $('#dtPdfAsset').focus(); }, 100);
}

function saveDocType(){
  var idx = parseInt($('#docTypeEditIndex').value);
  var name = ($('#dtName').value || '').trim();
  var fee = parseFloat($('#dtFee').value) || 0;
  var pdfAsset = (($('#dtPdfAsset') && $('#dtPdfAsset').value) || '').trim() || DEFAULT_PDF_TEMPLATE;
  var template = (($('#dtTemplate') && $('#dtTemplate').value) || '').trim();
  if(!name){ showToast('Document name is required','error'); return; }
  if(!pdfAsset){ showToast('PDF template path is required','error'); return; }
  ensureDocTypes(data);
  var types = data.docTypes;
  var dup = types.findIndex(function(t,i){ return t.name.toLowerCase()===name.toLowerCase() && i!==idx; });
  if(dup >= 0){ showToast('A document type with this name already exists','error'); return; }
  if(idx >= 0 && types[idx]){
    var oldName = types[idx].name;
    types[idx].name = name;
    types[idx].fee = fee;
    types[idx].pdfAsset = pdfAsset;
    types[idx].template = template;
    if(oldName !== name){
      data.documents.forEach(function(d){ if(d.type === oldName) d.type = name; });
    }
    showToast('Document type updated');
  } else {
    types.push({ name: name, fee: fee, pdfAsset: pdfAsset, template: template });
    showToast('Document type added');
  }
  saveData();
  closeModal('docTypeModal');
  renderDocTypesTable();
  if($('#module-documents') && $('#module-documents').classList.contains('active')) renderDocuments();
  if($('#module-secretary') && $('#module-secretary').classList.contains('active')) renderSecretary();
}

function deleteDocType(index){
  openConfirmModal({
    title: 'Delete Document Type',
    message: 'Delete document type "'+t.name+'"?\nExisting requests of this type will keep their current type name.',
    okLabel: 'Delete',
    variant: 'danger',
    onConfirm: function(){
  types.splice(index, 1);
  saveData();
  showToast('Document type deleted');
  renderDocTypesTable();

    }
  });
}

// Hook into navigate / module renders
var _origNavigate = typeof navigate === 'function' ? navigate : null;

document.addEventListener('DOMContentLoaded',function(){
  try{ hideInAppThemeToggle(); }catch(e){}
  try{ initTheme(); }catch(e){ console.warn(e); }
  try{ syncProfilingStats(); }catch(e){}
  try{ ensureDocTypes(data); }catch(e){}

  if(data && data.currentUser) showApp();

  // Login / register keyboard + click reliability
  if($('#loginPassword')) $('#loginPassword').addEventListener('keypress',function(e){ if(e.key==='Enter'){ e.preventDefault(); login(); } });
  if($('#loginUsername')) $('#loginUsername').addEventListener('keypress',function(e){ if(e.key==='Enter'){ e.preventDefault(); var p=$('#loginPassword'); if(p) p.focus(); } });
  var loginBtn = document.querySelector('#loginForm .btn.btn-primary, #loginForm button');
  if(loginBtn){
    loginBtn.setAttribute('type','button');
    loginBtn.addEventListener('click', function(e){ e.preventDefault(); login(); });
  }
  var regBtn = document.querySelector('#registerForm .btn.btn-primary, #registerForm button');
  if(regBtn){
    regBtn.setAttribute('type','button');
    regBtn.addEventListener('click', function(e){ e.preventDefault(); submitRegistration(); });
  }

  // Mobile sidebar: toggle + close on nav / overlay
  if($('#menuToggle')) $('#menuToggle').addEventListener('click',function(e){
    e.preventDefault();
    var sb = $('#sidebar');
    if(!sb) return;
    sb.classList.toggle('open');
    var ov = $('#sidebarOverlay');
    if(ov) ov.classList.toggle('open', sb.classList.contains('open'));
    document.body.classList.toggle('sidebar-open', sb.classList.contains('open'));
  });
  document.querySelectorAll('.nav-link').forEach(function(link){
    link.addEventListener('click', function(){
      if(window.innerWidth <= 900){
        var sb = $('#sidebar');
        if(sb) sb.classList.remove('open');
        var ov = $('#sidebarOverlay');
        if(ov) ov.classList.remove('open');
        document.body.classList.remove('sidebar-open');
      }
    });
  });
  var ov = $('#sidebarOverlay');
  if(ov){
    ov.addEventListener('click', function(){
      var sb = $('#sidebar');
      if(sb) sb.classList.remove('open');
      ov.classList.remove('open');
      document.body.classList.remove('sidebar-open');
    });
  }
});
