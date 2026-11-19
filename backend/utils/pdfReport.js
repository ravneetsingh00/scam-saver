const formatDate = value => value ? new Date(value).toLocaleDateString('en-US', { year: 'numeric', month: 'short', day: '2-digit' }) : '—';

function ascii(value) {
  return String(value ?? '')
    .replace(/[–—]/g, '-')
    .replace(/[‘’]/g, "'")
    .replace(/[“”]/g, '"')
    .replace(/[^\x20-\x7E]/g, '?');
}

function wrap(value, width = 86) {
  const words = ascii(value).split(/\s+/);
  const lines = [];
  let line = '';
  for (const word of words) {
    if (line && `${line} ${word}`.length > width) {
      lines.push(line);
      line = word;
    } else line = line ? `${line} ${word}` : word;
  }
  if (line) lines.push(line);
  return lines.length ? lines : [''];
}

function makeFraudReportPdf({ stats, reports }) {
  const lines = [];
  const add = (text, style = 'normal') => lines.push({ text: ascii(text), style });
  add('SCAM SAVER - FRAUD REPORT SUMMARY', 'title');
  add(`Generated: ${formatDate(new Date())}`);
  add('');
  add('PLATFORM STATISTICS', 'heading');
  add(`Registered users: ${stats.users}    Businesses: ${stats.businesses}    Total reports: ${stats.reports}`);
  add(`Pending: ${stats.pending}    Verified: ${stats.verified}    Rejected: ${stats.rejected}    Cancelled: ${stats.cancelled}`);
  add('');
  add('REPORT DETAILS', 'heading');
  add('This document summarizes community submissions and moderation status. A report is not proof of wrongdoing.');
  add('');

  if (!reports.length) add('No reports are currently recorded.');
  reports.forEach((report, index) => {
    add(`${index + 1}. ${report.reportId} - ${report.businessName}`, 'record');
    add(`   Status: ${report.status} | Type: ${report.fraudType} | Business category: ${report.category}`);
    add(`   Location: ${report.location} | Incident: ${formatDate(report.incidentDate)} | Submitted: ${formatDate(report.createdAt)}`);
    if (report.amount != null) add(`   Amount reported (currency unspecified): ${Number(report.amount).toLocaleString('en-US')}`);
    wrap(`Description: ${report.description}`, 82).forEach(line => add(`   ${line}`));
    if (report.adminNote) wrap(`Moderator note: ${report.adminNote}`, 82).forEach(line => add(`   ${line}`));
    add('');
  });

  const pageLines = 42;
  const pages = [];
  for (let index = 0; index < lines.length; index += pageLines) pages.push(lines.slice(index, index + pageLines));
  const objects = [];
  const setObject = (id, body) => { objects[id] = body; };
  setObject(1, '<< /Type /Catalog /Pages 2 0 R >>');
  setObject(3, '<< /Type /Font /Subtype /Type1 /BaseFont /Helvetica >>');
  setObject(4, '<< /Type /Font /Subtype /Type1 /BaseFont /Helvetica-Bold >>');

  const pageIds = [];
  pages.forEach((page, pageIndex) => {
    const pageId = 5 + pageIndex * 2;
    const streamId = pageId + 1;
    pageIds.push(`${pageId} 0 R`);
    const commands = ['BT'];
    let y = 748;
    page.forEach(({ text, style }) => {
      if (style === 'title') commands.push('/F2 16 Tf');
      else if (style === 'heading' || style === 'record') commands.push('/F2 10 Tf');
      else commands.push('/F1 9 Tf');
      const safe = text.replace(/\\/g, '\\\\').replace(/\(/g, '\\(').replace(/\)/g, '\\)');
      commands.push(`1 0 0 1 48 ${y} Tm (${safe}) Tj`);
      y -= style === 'title' || style === 'heading' ? 20 : 14;
    });
    commands.push('ET');
    const stream = commands.join('\n');
    setObject(pageId, `<< /Type /Page /Parent 2 0 R /MediaBox [0 0 612 792] /Resources << /Font << /F1 3 0 R /F2 4 0 R >> >> /Contents ${streamId} 0 R >>`);
    setObject(streamId, `<< /Length ${Buffer.byteLength(stream, 'ascii')} >>\nstream\n${stream}\nendstream`);
  });
  setObject(2, `<< /Type /Pages /Kids [${pageIds.join(' ')}] /Count ${pages.length} >>`);

  let pdf = '%PDF-1.4\n';
  const offsets = [0];
  for (let id = 1; id < objects.length; id += 1) {
    offsets[id] = Buffer.byteLength(pdf, 'ascii');
    pdf += `${id} 0 obj\n${objects[id]}\nendobj\n`;
  }
  const xrefOffset = Buffer.byteLength(pdf, 'ascii');
  pdf += `xref\n0 ${objects.length}\n0000000000 65535 f \n`;
  for (let id = 1; id < objects.length; id += 1) pdf += `${String(offsets[id]).padStart(10, '0')} 00000 n \n`;
  pdf += `trailer\n<< /Size ${objects.length} /Root 1 0 R >>\nstartxref\n${xrefOffset}\n%%EOF`;
  return Buffer.from(pdf, 'ascii');
}

module.exports = makeFraudReportPdf;
