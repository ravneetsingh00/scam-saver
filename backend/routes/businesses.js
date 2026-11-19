const router = require('express').Router();
const mongoose = require('mongoose');
const Business = require('../models/Business');
const Report = require('../models/Report');
const asyncHandler = require('../utils/asyncHandler');
const { protect, adminOnly } = require('../middleware/auth');

function risk(total, inReview) {
  return total >= 5 ? 'High Number of Reports' : inReview > 0 ? 'Under Review' : 'Low Risk';
}
function escapeRegex(value) {
  return String(value).replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
}
async function withCounts(list) {
  if (!list.length) return [];
  const ids = list.map(business => business._id);
  const rows = await Report.aggregate([
    { $match: { business: { $in: ids }, status: { $ne: 'Draft' } } },
    { $group: {
      _id: '$business',
      reportCount: { $sum: 1 },
      verifiedCount: { $sum: { $cond: [{ $eq: ['$status', 'Verified'] }, 1, 0] } },
      inReviewCount: { $sum: { $cond: [{ $in: ['$status', ['Pending', 'Needs Information', 'Under Review']] }, 1, 0] } },
    } },
  ]);
  const counts = new Map(rows.map(row => [String(row._id), row]));
  return list.map(business => {
    const data = counts.get(String(business._id)) || {};
    const reportCount = data.reportCount || 0;
    const verifiedCount = data.verifiedCount || 0;
    const inReviewCount = data.inReviewCount || 0;
    return {
      ...business.toObject(),
      reportCount,
      activeReportCount: inReviewCount,
      verifiedCount,
      inReviewCount,
      risk: risk(reportCount, inReviewCount),
    };
  });
}

router.get('/', asyncHandler(async (req, res) => {
  const query = typeof req.query.q === 'string' ? req.query.q.trim().slice(0, 120) : '';
  const requestedPage = Number.parseInt(req.query.page, 10);
  const pageSize = 24;
  const requested = Number.isSafeInteger(requestedPage) && requestedPage > 0 ? Math.min(requestedPage, 1000000) : 1;
  let filter = {};
  if (query) {
    const pattern = { $regex: escapeRegex(query), $options: 'i' };
    const reportMatches = await Report.find({
      status: { $ne: 'Draft' }, isDemo: { $ne: true },
      $or: [
        { businessName: pattern },
        { 'businessDetails.phone': pattern },
        { 'businessDetails.phone2': pattern },
        { 'businessDetails.website': pattern },
      ],
    }).select('business').limit(1000).lean();
    const linkedBusinessIds = [...new Set(reportMatches.map(report => report.business).filter(Boolean).map(String))];
    filter = { $or: [
      ...['name', 'ownerName', 'category', 'location', 'description'].map(field => ({ [field]: pattern })),
      ...(linkedBusinessIds.length ? [{ _id: { $in: linkedBusinessIds } }] : []),
    ] };
  }
  const total = await Business.countDocuments(filter);
  const pages = Math.ceil(total / pageSize);
  const page = Math.min(requested, Math.max(pages, 1));
  const businesses = await Business.find(filter)
    .sort({ name: 1, _id: 1 })
    .skip((page - 1) * pageSize)
    .limit(pageSize);
  res.set('Cache-Control', 'private, no-store').json({
    businesses: await withCounts(businesses),
    pagination: { page, pageSize, total, pages },
  });
}));

router.get('/:id', asyncHandler(async (req, res) => {
  if (!mongoose.isValidObjectId(req.params.id)) return res.status(400).json({ message: 'The business ID is invalid.' });
  const businessRecord = await Business.findById(req.params.id);
  if (!businessRecord) return res.status(404).json({ message: 'Business not found.' });
  const [business] = await withCounts([businessRecord]);
  // Public visitors only receive moderator-verified summary fields. Reporter data,
  // evidence, and unreviewed case details stay private.
  const reports = await Report.find({ business: businessRecord._id, status: 'Verified' })
    .select('reportId fraudType incidentDate status createdAt isDemo')
    .sort({ createdAt: -1 })
    .lean();
  res.set('Cache-Control', 'private, no-store').json({ business, reports });
}));

router.post('/', protect, adminOnly, asyncHandler(async (req, res) => {
  const name = typeof req.body.name === 'string' ? req.body.name.trim() : '';
  const category = typeof req.body.category === 'string' ? req.body.category.trim() : '';
  const location = typeof req.body.location === 'string' ? req.body.location.trim() : '';
  const ownerName = typeof req.body.ownerName === 'string' ? req.body.ownerName.trim() : '';
  const description = typeof req.body.description === 'string' ? req.body.description.trim() : '';
  if (!name || !category || !location) return res.status(400).json({ message: 'Name, category and location are required.' });
  res.status(201).json({ business: await Business.create({ name, ownerName, category, location, description }) });
}));

router.put('/:id', protect, adminOnly, asyncHandler(async (req, res) => {
  if (!mongoose.isValidObjectId(req.params.id)) return res.status(400).json({ message: 'The business ID is invalid.' });
  const allowed = ['name', 'ownerName', 'category', 'location', 'description'];
  const updates = Object.fromEntries(allowed.filter(key => typeof req.body[key] === 'string').map(key => [key, req.body[key].trim()]));
  const business = await Business.findByIdAndUpdate(req.params.id, updates, { new: true, runValidators: true });
  if (!business) return res.status(404).json({ message: 'Business not found.' });
  res.json({ business });
}));

router.delete('/:id', protect, adminOnly, asyncHandler(async (req, res) => {
  if (!mongoose.isValidObjectId(req.params.id)) return res.status(400).json({ message: 'The business ID is invalid.' });
  const business = await Business.findByIdAndDelete(req.params.id);
  if (!business) return res.status(404).json({ message: 'Business not found.' });
  await Report.updateMany({ business: business._id }, { $set: { business: null } });
  res.json({ message: 'Business removed.' });
}));

module.exports = router;
