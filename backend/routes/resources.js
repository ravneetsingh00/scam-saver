const express = require('express');

const router = express.Router();
const feeds = [
  { topic: 'India fraud scam consumer protection', category: 'Fraud and consumer protection' },
  { topic: 'India dealer vehicle purchase fraud', category: 'Dealer and vehicle fraud' },
  { topic: 'India property rental real estate fraud', category: 'Property and rental fraud' },
  { topic: 'India fake job recruitment fraud', category: 'Job and recruitment fraud' },
  { topic: 'India online shopping payment banking UPI fraud', category: 'Shopping and payment fraud' },
  { topic: 'India investment loan identity impersonation fraud', category: 'Investment and identity fraud' },
];
function decodeXml(value = '') {
  return value.replace(/<!\[CDATA\[([\s\S]*?)\]\]>/g, '$1').replace(/&amp;/g, '&').replace(/&lt;/g, '<').replace(/&gt;/g, '>').replace(/&quot;/g, '"').replace(/&#39;|&apos;/g, "'").trim();
}
function tag(xml, name) {
  const match = xml.match(new RegExp(`<${name}[^>]*>([\\s\\S]*?)</${name}>`, 'i'));
  return match ? decodeXml(match[1]) : '';
}
router.get('/news', async (req, res) => {
  const results = await Promise.all(feeds.map(async feed => {
    const url = `https://news.google.com/rss/search?q=${encodeURIComponent(feed.topic)}&hl=en-IN&gl=IN&ceid=IN:en`;
    try {
      const response = await fetch(url, { signal: AbortSignal.timeout(7000), headers: { 'User-Agent': 'SCAM-SAVER/1.0 (public news RSS reader)' } });
      if (!response.ok) return [];
      const xml = await response.text();
      return [...xml.matchAll(/<item>([\s\S]*?)<\/item>/gi)].slice(0, 10).map(match => {
        const item = match[1], link = tag(item, 'link'), title = tag(item, 'title'), source = tag(item, 'source');
        const published = new Date(tag(item, 'pubDate'));
        return { title, url: /^https:\/\//i.test(link) ? link : '', source: source || 'Publisher via Google News RSS', publishedAt: Number.isNaN(published.getTime()) ? '' : published.toISOString(), category: feed.category };
      }).filter(item => item.title && item.url);
    } catch { return []; }
  }));
  const articles = [...new Map(results.flat().sort((a, b) => new Date(b.publishedAt) - new Date(a.publishedAt)).map(item => [item.url, item])).values()].slice(0, 12);
  res.set('Cache-Control', 'public, max-age=900').json({ articles, updatedAt: new Date().toISOString(), source: 'Google News RSS; article links and publisher names are supplied by the feed.' });
});

module.exports = router;
