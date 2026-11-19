const date = value => value ? new Date(value).toLocaleString('en-US', { dateStyle: 'medium', timeStyle: 'short' }) : 'Not provided';
const ascii = value => String(value ?? '').replace(/[–—]/g, '-').replace(/[‘’]/g, "'").replace(/[“”]/g, '"').replace(/[^\x20-\x7E]/g, '?');
function wrap(value, width = 88) {
  const output = []; let line = '';
  for (const word of ascii(value).split(/\s+/)) {
    if (line && (line + ' ' + word).length > width) { output.push(line); line = word; }
    else line = line ? line + ' ' + word : word;
  }
  if (line) output.push(line);
  return output.length ? output : [''];
}
function makeCaseSummaryPdf(report) {
  const lines = [];
  const add = (text, style = 'normal') => lines.push({ text: ascii(text), style });
  const section = title => { add(title.toUpperCase(), 'heading'); add(''); };
  const field = (label, value) => add(`${label}: ${value || 'Not provided'}`);
  const paragraph = (label, value) => wrap(`${label}: ${value || 'Not provided'}`).forEach(line => add(line));
  add('SCAM SAVER - CASE SUMMARY', 'title');
  field('Case ID', report.reportId);
  field('Generated', date(new Date()));
  field('Review status', report.status);
  add('');
  wrap('TRANSPARENCY: User-submitted information is an allegation. Admin review status records a moderation decision and is not independent proof of wrongdoing.').forEach(line => add(line, 'notice'));
  section('Business or person details');
  field('Name', report.businessName); field('Entity type', report.businessDetails?.entityType); field('Category', report.category);
  field('Owner/contact', report.businessDetails?.ownerContact); field('Contact no. 1', report.businessDetails?.phone); field('Contact no. 2', report.businessDetails?.phone2); field('Business email', report.businessDetails?.email);
  field('Website', report.businessDetails?.website); field('Address', report.businessDetails?.address); field('City / state / PIN', [report.businessDetails?.city, report.businessDetails?.state, report.businessDetails?.pinCode].filter(Boolean).join(' / '));
  field('GSTIN', report.businessDetails?.gstin);
  section('Incident details');
  field('Incident category', report.fraudType); field('Date and time', `${date(report.incidentDate)} ${report.incidentDetails?.time || ''}`.trim());
  field('Incident location', report.incidentDetails?.location || report.location); field('Amount reported', report.amount == null ? 'Not provided' : `${report.amountCurrency || 'INR'} ${Number(report.amount).toLocaleString('en-US')}`);
  field('Amount involved', report.incidentDetails?.amountInvolved ? 'Yes' : 'No'); field('Payment method', report.incidentDetails?.paymentMethod); field('Transaction reference', report.incidentDetails?.transactionReference); field('UPI ID', report.incidentDetails?.upiId);
  field('Current situation', report.incidentDetails?.currentSituation);
  section('Incident narrative');
  field('How contact began', report.incidentDetails?.howContacted); field('What was promised', report.incidentDetails?.whatPromised);
  field('What happened', report.incidentDetails?.whatHappened); field('Steps taken', report.incidentDetails?.stepsTaken); paragraph('Reporter description', report.description);
  section('Previous complaints');
  field('Complaint filed', report.previousComplaints?.hasComplaint ? 'Yes' : 'No'); field('Official complaint reference', report.previousComplaints?.officialReference); field('Cybercrime report status', report.previousComplaints?.cybercrimeStatus);
  field('FIR status', report.previousComplaints?.firStatus); paragraph('Resolution attempts', report.previousComplaints?.resolutionAttempts);
  section('Reporter and evidence');
  field('Reporter', report.reporter?.hideNameFromPublic ? 'Identity hidden from public' : report.reporter?.name);
  field('Reporter account email', report.reporter?.email || report.contactEmail); field('Reporter phone', report.reporter?.phone); field('Reporter address', report.reporter?.address);
  const evidence = report.evidenceAttachments || [];
  if (!evidence.length && report.evidence) add('1. Legacy evidence attachment stored securely.');
  else if (!evidence.length) add('No evidence files attached.');
  else evidence.forEach((item, index) => add(`${index + 1}. ${item.originalName} (${item.mimeType}, ${Math.ceil(item.size / 1024)} KB) - ${item.description || 'No description'}`));
  section('Moderation timeline');
  const history = report.moderationHistory || [];
  if (!history.length) add('No moderation events recorded.');
  history.forEach(entry => { add(`${date(entry.at)} - ${entry.action}`); if (entry.by?.name) add(`   Recorded by: ${entry.by.name}`); if (entry.note) wrap(`Reviewer note: ${entry.note}`).forEach(line => add(line)); });
  for (const response of report.reporterResponses || []) { paragraph(`Reporter follow-up (${date(response.at)})`, response.text); if (response.by?.name) add(`   Sent by: ${response.by.name}`); }
  if (report.adminNote) paragraph('Current reviewer note', report.adminNote);
  add('');
  wrap('This summary contains information supplied by a reporter and subsequent moderation actions. Verify details independently before relying on them.').forEach(line => add(line, 'notice'));

  const pageLines = 43; const pages = [];
  for (let index = 0; index < lines.length; index += pageLines) pages.push(lines.slice(index, index + pageLines));
  const objects = [];
  const setObject = (id, body) => { objects[id] = body; };
  setObject(1, '<< /Type /Catalog /Pages 2 0 R >>');
  setObject(3, '<< /Type /Font /Subtype /Type1 /BaseFont /Helvetica >>');
  setObject(4, '<< /Type /Font /Subtype /Type1 /BaseFont /Helvetica-Bold >>');
  const pageIds = [];
  pages.forEach((page, index) => {
    const pageId = 5 + index * 2; const streamId = pageId + 1; pageIds.push(`${pageId} 0 R`);
    const commands = ['BT']; let y = 748;
    page.forEach(({ text, style }) => {
      commands.push(style === 'title' ? '/F2 16 Tf' : style === 'heading' || style === 'notice' ? '/F2 9 Tf' : '/F1 9 Tf');
      const safe = text.replace(/\\/g, '\\\\').replace(/\(/g, '\\(').replace(/\)/g, '\\)');
      commands.push(`1 0 0 1 46 ${y} Tm (${safe}) Tj`); y -= style === 'title' || style === 'heading' ? 20 : 14;
    });
    commands.push('ET'); const stream = commands.join('\n');
    setObject(pageId, `<< /Type /Page /Parent 2 0 R /MediaBox [0 0 612 792] /Resources << /Font << /F1 3 0 R /F2 4 0 R >> >> /Contents ${streamId} 0 R >>`);
    setObject(streamId, `<< /Length ${Buffer.byteLength(stream)} >>\nstream\n${stream}\nendstream`);
  });
  setObject(2, `<< /Type /Pages /Kids [${pageIds.join(' ')}] /Count ${pageIds.length} >>`);
  let pdf = '%PDF-1.4\n'; const offsets = [0];
  for (let id = 1; id < objects.length; id++) { offsets[id] = Buffer.byteLength(pdf); pdf += `${id} 0 obj\n${objects[id]}\nendobj\n`; }
  const xref = Buffer.byteLength(pdf); pdf += `xref\n0 ${objects.length}\n0000000000 65535 f \n`;
  for (let id = 1; id < objects.length; id++) pdf += `${String(offsets[id]).padStart(10, '0')} 00000 n \n`;
  pdf += `trailer\n<< /Size ${objects.length} /Root 1 0 R >>\nstartxref\n${xref}\n%%EOF`;
  return Buffer.from(pdf, 'binary');
}
module.exports = makeCaseSummaryPdf;
