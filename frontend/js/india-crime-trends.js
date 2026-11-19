(() => {
  'use strict';

  // All-India registered cybercrime cases from NCRB's Crime in India series.
  // NCRB's latest published edition is 2024; no 2025 figure is available yet.
  const sourceUrl = 'https://www.pib.gov.in/PressReleasePage.aspx?PRID=2287039&lang=1&reg=48';
  const series = [
    { year: 2020, count: 50035 },
    { year: 2021, count: 52974 },
    { year: 2022, count: 65893 },
    { year: 2023, count: 86420 },
    { year: 2024, count: 101928 },
  ].map((row, index, rows) => ({
    ...row,
    change: index ? (row.count - rows[index - 1].count) / rows[index - 1].count * 100 : null,
  }));
  const latestYear = series.at(-1).year;
  const fmt = value => Number(value).toLocaleString('en-IN');
  const percent = value => value == null ? 'No prior year' : `${value >= 0 ? '+' : ''}${value.toFixed(1)}%`;
  const esc = value => String(value).replace(/[&<>"']/g, char => ({ '&':'&amp;', '<':'&lt;', '>':'&gt;', '"':'&quot;', "'":'&#39;' }[char]));

  function renderChart() {
    const width = 760, height = 270, left = 66, right = 20, top = 25, bottom = 49;
    const plotWidth = width - left - right, plotHeight = height - top - bottom;
    const max = 120000, step = 30000;
    const slot = plotWidth / series.length, barWidth = Math.min(74, slot * .54);
    const grid = Array.from({ length: 5 }, (_, index) => {
      const value = max - index * step, y = top + plotHeight * index / 4;
      return `<line class="ict-grid" x1="${left}" y1="${y}" x2="${width-right}" y2="${y}"/><text class="ict-axis-label" x="${left-10}" y="${y+4}" text-anchor="end">${fmt(value)}</text>`;
    }).join('');
    const bars = series.map((item, index) => {
      const barHeight = item.count / max * plotHeight;
      const x = left + slot * index + (slot - barWidth) / 2;
      const y = top + plotHeight - barHeight;
      const current = item.year === latestYear;
      const change = item.change == null ? 'No previous-year comparison' : `${percent(item.change)} compared with ${item.year - 1}`;
      const label = `${item.year}: ${fmt(item.count)} registered cybercrime cases. ${change}.`;
      return `<g class="ict-bar-group"><rect class="ict-bar${current ? ' is-latest' : ''}" x="${x}" y="${y}" width="${barWidth}" height="${barHeight}" rx="7" tabindex="0" role="img" aria-label="${esc(label)}"><title>${esc(label)}</title></rect><text class="ict-value" x="${x+barWidth/2}" y="${Math.max(top+13,y-9)}" text-anchor="middle">${fmt(item.count)}</text><text class="ict-year${current ? ' is-latest' : ''}" x="${left+slot*(index+.5)}" y="${height-19}" text-anchor="middle">${item.year}</text>${current ? `<text class="ict-latest-tag" x="${left+slot*(index+.5)}" y="${height-4}" text-anchor="middle">LATEST</text>` : ''}</g>`;
    }).join('');

    return `<div class="ict-module"><header class="ict-heading"><div><div class="eyebrow">OFFICIAL NCRB DATA · ALL INDIA</div><h2>India Crime Trends Over the Years</h2><p class="muted">Cybercrime cases registered nationally, latest published year: ${latestYear}.</p></div><span class="ict-latest-badge">Latest · ${latestYear}</span></header><div class="ict-chart-card"><div class="ict-chart-title"><strong>Registered cybercrime cases</strong><span class="muted">Year-over-year change shown below</span></div><div class="ict-chart-scroll"><svg class="ict-chart" viewBox="0 0 ${width} ${height}" role="img" aria-label="Interactive bar chart of NCRB registered cybercrime cases in India from 2020 to 2024">${grid}<line class="ict-axis" x1="${left}" y1="${top+plotHeight}" x2="${width-right}" y2="${top+plotHeight}"/>${bars}</svg></div><div class="ict-summary">${series.map(item => `<article class="ict-summary-item${item.year===latestYear?' is-latest':''}"><strong>${item.year}${item.year===latestYear?'<span>Latest</span>':''}</strong><b>${fmt(item.count)}</b><small>registered cases</small><em>${percent(item.change)}${item.change==null?'':' vs previous year'}</em></article>`).join('')}</div><p class="ict-note">This series counts registered cybercrime cases involving communication devices as a medium or target. It is not a measure of all crime, all fraud, unreported incidents, or community reports.</p><p class="ict-source">Source: NCRB, <cite>Crime in India</cite> 2020–2024, published by India’s Ministry of Home Affairs. Latest report year available: 2024. <a href="${sourceUrl}" target="_blank" rel="noopener noreferrer">Official MHA / PIB data and annexures ↗</a></p></div></div>`;
  }

  function init() {
    document.querySelectorAll('[data-india-crime-trends]').forEach(target => { target.innerHTML = renderChart(); });
  }
  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', init, { once:true }); else init();
})();
