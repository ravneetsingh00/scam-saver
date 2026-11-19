function safeText(value) {
  return String(value ?? '').replace(/[–—]/g, '-').replace(/[‘’]/g, "'").replace(/[“”]/g, '"').replace(/[^\x20-\x7E]/g, '?');
}

function wrap(value, width = 88) {
  const words = safeText(value).split(/\s+/);
  const result = [];
  let line = '';
  for (let word of words) {
    while (word.length > width) {
      if (line) { result.push(line); line = ''; }
      result.push(word.slice(0, width));
      word = word.slice(width);
    }
    if (line && `${line} ${word}`.length > width) { result.push(line); line = word; }
    else line = line ? `${line} ${word}` : word;
  }
  if (line) result.push(line);
  return result.length ? result : [''];
}

function makeInvestigationPdf(investigation) {
  const lines = [];
  const add = (value, style = 'normal') => wrap(value).forEach(text => lines.push({ text, style }));
  add('SCAM SAVER - BUSINESS INVESTIGATION SUMMARY', 'title');
  add(`Generated ${new Date().toLocaleString('en-US')}`);
  add('');
  add('BUSINESS DETAILS', 'heading');
  add(`Business: ${investigation.businessName}`);
  add(`Category: ${investigation.category} | Location: ${investigation.location}`);
  add(`Website: ${investigation.website || 'Not supplied'}`);
  add('');
  add('AI-GENERATED SUMMARY', 'heading');
  add(investigation.summary);
  add('');
  add('CONFIDENCE AND LIMITATIONS', 'heading');
  add(`Research confidence: ${investigation.confidenceLevel} (not a probability of fraud or wrongdoing).`);
  add(investigation.confidenceRationale);
  add(investigation.identityCaveat);
  add('');
  const sections = [
    ['SOURCE-SUPPORTED FACTS', investigation.facts],
    ['PUBLICLY REPORTED CLAIMS (UNVERIFIED)', investigation.publicClaims],
    ['POTENTIAL WARNING SIGNS (REQUIRE HUMAN CHECKING)', investigation.warningSigns],
    ['INCONSISTENCIES TO REVIEW', investigation.inconsistencies],
  ];
  for (const [title, entries] of sections) {
    add(title, 'heading');
    if (!entries?.length) add('No sourced items returned.');
    for (const entry of entries || []) {
      add(`- ${entry.text}`);
      if (entry.sourceUrls?.length) add(`  Sources: ${entry.sourceUrls.join(' | ')}`);
    }
    add('');
  }
  const comparison = investigation.localReportComparison || {};
  add('SCAM SAVER COMMUNITY REPORT COMPARISON', 'heading');
  add(comparison.exactMatch
    ? `Exact business-name and location match: ${comparison.total} reports (${comparison.pending} pending, ${comparison.verified} moderator-verified, ${comparison.rejected} rejected, ${comparison.cancelled} cancelled).`
    : 'No exact business-name and location match was found in the SCAM SAVER report database. This does not establish that no concerns exist.');
  for (const entry of comparison.byType || []) add(`${entry.fraudType}: ${entry.count}`);
  add('SCAM SAVER reports are community submissions. Pending reports are allegations; moderator status is not proof of wrongdoing.');
  add('');
  add('WEB SOURCES', 'heading');
  if (!investigation.sources?.length) add('No source links were returned.');
  for (const source of investigation.sources || []) {
    add(`${source.title} (checked ${new Date(source.checkedAt).toLocaleDateString('en-US')})`);
    add(source.url);
  }
  add('');
  add('This AI-generated research can be incomplete or inaccurate and may match the wrong business. Confirm identities and facts independently. Human review is required before any report is verified.');

  const pages = [];
  for (let i = 0; i < lines.length; i += 42) pages.push(lines.slice(i, i + 42));
  const objects = [];
  const put = (id, value) => { objects[id] = value; };
  put(1, '<< /Type /Catalog /Pages 2 0 R >>');
  put(3, '<< /Type /Font /Subtype /Type1 /BaseFont /Helvetica >>');
  put(4, '<< /Type /Font /Subtype /Type1 /BaseFont /Helvetica-Bold >>');
  const kids = [];
  pages.forEach((page, index) => {
    const pageId = 5 + index * 2;
    const streamId = pageId + 1;
    kids.push(`${pageId} 0 R`);
    const commands = ['BT'];
    let y = 748;
    for (const line of page) {
      commands.push(line.style === 'title' ? '/F2 15 Tf' : line.style === 'heading' ? '/F2 10 Tf' : '/F1 9 Tf');
      const escaped = line.text.replace(/\\/g, '\\\\').replace(/\(/g, '\\(').replace(/\)/g, '\\)');
      commands.push(`1 0 0 1 48 ${y} Tm (${escaped}) Tj`);
      y -= line.style === 'title' || line.style === 'heading' ? 20 : 14;
    }
    commands.push('ET');
    const stream = commands.join('\n');
    put(pageId, `<< /Type /Page /Parent 2 0 R /MediaBox [0 0 612 792] /Resources << /Font << /F1 3 0 R /F2 4 0 R >> >> /Contents ${streamId} 0 R >>`);
    put(streamId, `<< /Length ${Buffer.byteLength(stream, 'ascii')} >>\nstream\n${stream}\nendstream`);
  });
  put(2, `<< /Type /Pages /Kids [${kids.join(' ')}] /Count ${pages.length} >>`);
  let pdf = '%PDF-1.4\n';
  const offsets = [0];
  for (let id = 1; id < objects.length; id += 1) {
    offsets[id] = Buffer.byteLength(pdf, 'ascii');
    pdf += `${id} 0 obj\n${objects[id]}\nendobj\n`;
  }
  const xref = Buffer.byteLength(pdf, 'ascii');
  pdf += `xref\n0 ${objects.length}\n0000000000 65535 f \n`;
  for (let id = 1; id < objects.length; id += 1) pdf += `${String(offsets[id]).padStart(10, '0')} 00000 n \n`;
  pdf += `trailer\n<< /Size ${objects.length} /Root 1 0 R >>\nstartxref\n${xref}\n%%EOF`;
  return Buffer.from(pdf, 'ascii');
}

module.exports = makeInvestigationPdf;
