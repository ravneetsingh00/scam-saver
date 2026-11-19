(() => {
  const form = document.getElementById('reportForm');
  if (!form) return;
  const panels = [...form.querySelectorAll('.case-panel')];
  const files = [];
  const maxFiles = 5;
  const maxSize = 20 * 1024 * 1024;
  let step = 0;
  let submitting = false;
  const $ = selector => form.querySelector(selector);
  const errorBox = document.getElementById('caseSuccess');
  const preview = document.getElementById('evidencePreview');
  const inputs = [...form.querySelectorAll('input[type="file"]')];
  let previewUrls = [];
  const token = () => localStorage.getItem('ss_token');
  const escape = value => String(value ?? '').replace(/[&<>"']/g, char => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[char]));
  const imageFile = file => file.type.startsWith('image/');
  const isApk = file => file.name.toLowerCase().endsWith('.apk');
  const showMessage = message => {
    if (!errorBox) return;
    errorBox.textContent = message;
    errorBox.classList.remove('hide');
    errorBox.classList.add('notice', 'warn');
  };
  function renderFiles() {
    if (!preview) return;
    previewUrls.forEach(url => URL.revokeObjectURL(url));
    previewUrls = [];
    preview.replaceChildren();
    files.forEach((entry, index) => {
      const item = document.createElement('article');
      item.className = 'evidence-item';
      if (imageFile(entry.file)) {
        const image = document.createElement('img');
        image.className = 'evidence-thumb';
        image.alt = `Preview of ${entry.file.name}`;
        image.src = URL.createObjectURL(entry.file);
        previewUrls.push(image.src);
        item.append(image);
      } else {
        const tile = document.createElement('div');
        tile.className = `evidence-file-tile${isApk(entry.file) ? ' evidence-apk-tile' : ''}`;
        tile.textContent = isApk(entry.file) ? 'APK · QUARANTINE' : (entry.file.type.split('/')[1] || 'FILE').toUpperCase();
        item.append(tile);
      }
      const meta = document.createElement('div');
      meta.className = 'evidence-item-meta';
      const name = document.createElement('strong');
      name.textContent = entry.file.name;
      const size = document.createElement('small');
      size.textContent = `${(entry.file.size / (1024 * 1024)).toFixed(2)} MB${isApk(entry.file) ? ' · Stored in secure quarantine' : ''}`;
      const remove = document.createElement('button');
      remove.type = 'button';
      remove.className = 'ghost evidence-remove';
      remove.textContent = 'Remove';
      remove.setAttribute('aria-label', `Remove ${entry.file.name}`);
      remove.addEventListener('click', () => { files.splice(index, 1); renderFiles(); updateCount(); });
      meta.append(name, size, remove);
      item.append(meta);
      preview.append(item);
    });
    updateCount();
  }
  function updateCount() {
    const count = document.getElementById('selectedEvidenceCount');
    if (count) count.textContent = files.length ? `${files.length} of ${maxFiles} files selected. Each file can be up to 20 MB.` : 'No files selected yet. You can attach up to five files across both file steps.';
  }
  function addFiles(list, source) {
    const incoming = [...list];
    for (const file of incoming) {
      if (files.length >= maxFiles) { showMessage('You can attach up to five files to a report.'); break; }
      if (file.size > maxSize) { showMessage(`${file.name} is larger than the 20 MB per-file limit.`); continue; }
      const allowed = imageFile(file) || file.type === 'application/pdf' || file.type.startsWith('audio/') || file.type.startsWith('video/') || isApk(file);
      if (!allowed) { showMessage(`${file.name} is not a supported evidence type.`); continue; }
      if (!files.some(entry => entry.file.name === file.name && entry.file.size === file.size && entry.file.lastModified === file.lastModified)) files.push({ file, source });
    }
    renderFiles();
  }
  inputs.forEach(input => {
    input.addEventListener('change', () => { addFiles(input.files, input.id); input.value = ''; });
    const drop = input.closest('.file-drop');
    drop?.querySelector('[data-browse-file]')?.addEventListener('click', () => input.click());
    drop?.addEventListener('dragover', event => { event.preventDefault(); drop.classList.add('drag-over'); });
    drop?.addEventListener('dragleave', () => drop.classList.remove('drag-over'));
    drop?.addEventListener('drop', event => { event.preventDefault(); drop.classList.remove('drag-over'); addFiles(event.dataTransfer.files, input.id); });
  });
  function setStep(next) {
    step = Math.max(0, Math.min(panels.length - 1, next));
    panels.forEach((panel, index) => { panel.hidden = index !== step; });
    document.querySelectorAll('[data-step-indicator]').forEach((indicator, index) => indicator.classList.toggle('active', index === step));
    const status = document.getElementById('stepStatus');
    if (status) status.textContent = `Step ${step + 1} of ${panels.length}`;
    const previous = document.getElementById('previousStep');
    const nextButton = document.getElementById('nextStep');
    const submit = document.getElementById('submitBtn');
    if (previous) previous.disabled = step === 0;
    nextButton?.classList.toggle('hide', step === panels.length - 1);
    submit?.classList.toggle('hide', step !== panels.length - 1);
    document.getElementById('saveDraft')?.classList.toggle('hide', submitting);
  }
  function validatePanel(index) {
    const controls = [...panels[index].querySelectorAll('input,select,textarea')].filter(control => control.required && !control.disabled);
    for (const control of controls) {
      if (!control.checkValidity()) { control.reportValidity(); control.focus(); return false; }
    }
    return true;
  }
  function payload(draft = false) {
    const values = Object.fromEntries(new FormData(form).entries());
    const get = name => values[name] || '';
    return {
      draft,
      businessDetails: { name: get('businessDetails.name'), entityType: get('businessDetails.entityType'), category: get('businessDetails.category'), address: get('businessDetails.address'), phone: get('businessDetails.phone'), phone2: get('businessDetails.phone2'), email: get('businessDetails.email'), gstin: get('businessDetails.gstin'), website: get('businessDetails.website') },
      incidentDetails: { date: get('incidentDetails.date'), time: get('incidentDetails.time'), location: get('incidentDetails.location'), fraudType: get('incidentDetails.fraudType'), amountInvolved: get('incidentDetails.amountInvolved') === 'true', amount: get('incidentDetails.amount'), amountCurrency: get('incidentDetails.amountCurrency'), paymentMethod: get('incidentDetails.paymentMethod') },
      description: get('description'), reporterPhone: get('reporterPhone'), reporterAddress: get('reporterAddress'),
      hideNameFromPublic: form.elements.hideNameFromPublic.checked,
      shareContactWithModerators: form.elements.shareContactWithModerators.checked,
      previousComplaints: { hasComplaint: form.elements['previousComplaints.hasComplaint'].checked, officialReference: get('previousComplaints.officialReference') },
      evidenceDescriptions: files.map(() => ''),
    };
  }
  async function save(draft) {
    if (submitting) return;
    submitting = true;
    const button = document.getElementById(draft ? 'saveDraft' : 'submitBtn');
    if (button) { button.disabled = true; button.setAttribute('aria-busy', 'true'); button.textContent = draft ? 'Saving…' : 'Submitting…'; }
    const progress = document.getElementById('uploadProgress');
    progress?.classList.remove('hide');
    try {
      const body = new FormData();
      body.append('payload', JSON.stringify(payload(draft)));
      files.forEach(entry => body.append('evidence', entry.file, entry.file.name));
      const controller = new AbortController();
      const timeout = setTimeout(() => controller.abort(), 120000);
      let response;
      try {
        response = await fetch('/api/reports', { method: 'POST', headers: { Authorization: `Bearer ${token()}` }, body, signal: controller.signal });
      } finally { clearTimeout(timeout); }
      const data = await response.json().catch(() => ({}));
      if (!response.ok) throw new Error(data.message || `Report could not be saved (${response.status}).`);
      form.classList.add('hide');
      const success = document.getElementById('caseSuccess');
      success?.classList.remove('hide');
      if (success) success.innerHTML = `<div class="eyebrow">${draft ? 'DRAFT SAVED' : 'REPORT SUBMITTED'}</div><h2>${draft ? 'Your draft is saved' : 'Your report is in review'}</h2><p>Report ID: <strong>${escape(data.report?.reportId || 'Created')}</strong></p><p>${files.length} evidence file(s) were attached. Evidence is private; APK files are held in quarantine and cannot be opened here.</p><a class="btn" href="my-reports.html">View my reports</a>`;
    } catch (error) {
      showMessage(error.name === 'AbortError' ? 'Upload timed out. Check your connection and try again.' : error.message || 'Report could not be submitted.');
      submitting = false;
      if (button) { button.disabled = false; button.removeAttribute('aria-busy'); button.textContent = draft ? 'Keep draft' : 'Submit report'; }
      progress?.classList.add('hide');
    }
  }
  document.getElementById('nextStep')?.addEventListener('click', () => { if (validatePanel(step)) setStep(step + 1); });
  document.getElementById('previousStep')?.addEventListener('click', () => setStep(step - 1));
  document.getElementById('saveDraft')?.addEventListener('click', () => save(true));
  form.addEventListener('submit', event => {
    event.preventDefault();
    if (panels.some((_, index) => !validatePanel(index))) {
      const firstInvalidStep = panels.findIndex(panel => [...panel.querySelectorAll('input,select,textarea')].some(control => control.required && !control.disabled && !control.checkValidity()));
      if (firstInvalidStep >= 0) setStep(firstInvalidStep);
      return;
    }
    save(false);
  });
  setStep(0);
})();
