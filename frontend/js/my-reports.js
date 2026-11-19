(() => {
  const root = document.getElementById('myReports');
  if (!root) return;
  const token = localStorage.getItem('ss_token');
  const escape = value => String(value ?? '').replace(/[&<>"']/g, char => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[char]));
  const date = value => value ? new Date(value).toLocaleDateString(undefined, { year: 'numeric', month: 'short', day: 'numeric' }) : '—';
  const size = value => `${(Number(value || 0) / (1024 * 1024)).toFixed(2)} MB`;
  function attachment(report, file, index) {
    const url = `/api/reports/${encodeURIComponent(report._id)}/evidence/${index}`;
    const apk = file.quarantined || file.mimeType === 'application/vnd.android.package-archive';
    const image = file.mimeType?.startsWith('image/');
    const visual = image ? `<a href="${url}" data-evidence data-filename="${escape(file.originalName)}"><span class="case-attachment-icon">IMAGE · PREVIEW</span></a>` : `<span class="case-attachment-icon${apk ? ' evidence-apk-tile' : ''}">${apk ? 'APK · QUARANTINED' : escape((file.mimeType?.split('/')[1] || 'FILE').toUpperCase())}</span>`;
    return `<article class="case-attachment">${visual}<div><strong>${escape(file.originalName || 'Evidence file')}</strong><small>${escape(file.mimeType || 'File')} · ${size(file.size)}${apk ? ' · Quarantined' : ''}</small>${file.description ? `<p>${escape(file.description)}</p>` : ''}<a href="${url}" ${apk ? 'data-evidence-download' : 'data-evidence'} data-filename="${escape(file.originalName)}">${apk ? 'Secure download ↓' : 'View / download ↗'}</a></div></article>`;
  }
  function render(report) {
    const files = Array.isArray(report.evidenceAttachments) ? report.evidenceAttachments : [];
    return `<article class="card my-report-card"><div class="business-case-head"><div><div class="eyebrow">REPORT ${escape(report.reportId || '')}</div><h2>${escape(report.businessName || 'Saved report')}</h2><p class="muted">${escape(report.fraudType || 'Category not set')} · ${escape(report.location || 'Location not set')}</p></div><span class="pill ${report.status === 'Verified' ? 'green' : report.status === 'Rejected' ? 'red' : 'amber'}">${escape(report.status)}</span></div><p class="form-note">Submitted ${date(report.createdAt)} · Incident date ${date(report.incidentDate)}</p><details class="my-report-details"><summary>View report details${files.length ? ` and ${files.length} evidence file${files.length === 1 ? '' : 's'}` : ''}</summary><div class="my-report-detail-body"><h3>Incident description</h3><p class="case-narrative">${escape(report.description || 'No description provided.')}</p><h3>Evidence attachments</h3>${files.length ? `<div class="case-attachment-grid">${files.map((file, index) => attachment(report, file, index)).join('')}</div>` : '<p class="muted">No evidence files were attached.</p>'}</div></details></article>`;
  }
  fetch('/api/reports/my', { headers: { Authorization: `Bearer ${token}` }, cache: 'no-store' })
    .then(async response => { const data = await response.json().catch(() => ({})); if (!response.ok) throw new Error(data.message || 'Your reports could not be loaded.'); return data; })
    .then(data => {
      const reports = Array.isArray(data.reports) ? data.reports : [];
      root.innerHTML = reports.length ? `<div class="my-report-list">${reports.map(render).join('')}</div>` : '<div class="empty card">You have not submitted any reports yet. <a href="report.html">Submit a report →</a></div>';
    })
    .catch(error => { root.innerHTML = `<div class="notice">${escape(error.message)} <button type="button" class="secondary" id="retryMyReports">Try again</button></div>`; document.getElementById('retryMyReports')?.addEventListener('click', () => location.reload()); });

  root.addEventListener('click', async event => {
    const link = event.target.closest('a[data-evidence-download]');
    if (!link) return;
    event.preventDefault();
    try {
      const response = await fetch(link.href, { headers: { Authorization: `Bearer ${token}` }, cache: 'no-store' });
      if (!response.ok) throw new Error('This private evidence could not be downloaded.');
      const objectUrl = URL.createObjectURL(await response.blob());
      const download = document.createElement('a'); download.href = objectUrl; download.download = link.dataset.filename || 'quarantined-evidence.apk'; document.body.append(download); download.click(); download.remove(); setTimeout(() => URL.revokeObjectURL(objectUrl), 60000);
    } catch (error) { window.alert(error.message); }
  });
})();
