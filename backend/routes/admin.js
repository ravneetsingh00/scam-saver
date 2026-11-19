const router = require('express').Router();
const { protect, adminOnly } = require('../middleware/auth');
const User = require('../models/User');
const Business = require('../models/Business');
const Report = require('../models/Report');
const asyncHandler = require('../utils/asyncHandler');
const makeFraudReportPdf = require('../utils/pdfReport');

router.use(protect, adminOnly);

async function getStats() {
  const submittedFilter = { status: { $ne: 'Draft' }, isDemo: { $ne: true } };
  const [users, businesses, reports, pending, verified, rejected, cancelled, needsInformation, underReview] = await Promise.all([
    User.countDocuments(), Business.countDocuments(), Report.countDocuments(submittedFilter),
    Report.countDocuments({ ...submittedFilter, status: 'Pending' }), Report.countDocuments({ ...submittedFilter, status: 'Verified' }),
    Report.countDocuments({ ...submittedFilter, status: 'Rejected' }), Report.countDocuments({ ...submittedFilter, status: 'Cancelled' }),
    Report.countDocuments({ ...submittedFilter, status: 'Needs Information' }), Report.countDocuments({ ...submittedFilter, status: 'Under Review' }),
  ]);
  const now = new Date();
  const start = new Date(now.getFullYear(), now.getMonth() - 5, 1);
  const [monthlyRows, typeRows] = await Promise.all([
    Report.aggregate([
      { $match: { ...submittedFilter, createdAt: { $gte: start } } },
      { $group: { _id: { year: { $year: '$createdAt' }, month: { $month: '$createdAt' } }, count: { $sum: 1 } } },
      { $sort: { '_id.year': 1, '_id.month': 1 } },
    ]),
    Report.aggregate([{ $match: submittedFilter }, { $group: { _id: '$fraudType', count: { $sum: 1 } } }, { $sort: { count: -1, _id: 1 } }]),
  ]);
  const monthly = Array.from({ length: 6 }, (_, offset) => {
    const date = new Date(now.getFullYear(), now.getMonth() - 5 + offset, 1);
    const row = monthlyRows.find(item => item._id.year === date.getFullYear() && item._id.month === date.getMonth() + 1);
    return { label: date.toLocaleDateString('en-US', { month: 'short' }), count: row?.count || 0 };
  });
  return { users, businesses, reports, pending, verified, rejected, cancelled, needsInformation, underReview, monthly, byType: typeRows.filter(row => row._id).map(row => ({ label: row._id, count: row.count })) };
}

router.get('/stats', asyncHandler(async (req, res) => res.json(await getStats())));

router.get('/users', asyncHandler(async (req, res) => {
  const users = await User.find().select('name email role createdAt').sort({ createdAt: -1 }).limit(500);
  res.json({ users });
}));

router.get('/reports.pdf', asyncHandler(async (req, res) => {
  const [stats, reports] = await Promise.all([
    getStats(),
    Report.find({ status: { $ne: 'Draft' }, isDemo: { $ne: true } }).sort({ createdAt: -1 }).select('reportId businessName category location incidentDate fraudType amount description status adminNote createdAt'),
  ]);
  const pdf = makeFraudReportPdf({ stats, reports });
  res.status(200).type('application/pdf').set({
    'Content-Disposition': 'attachment; filename="scam-saver-fraud-report.pdf"',
    'Cache-Control': 'private, no-store',
  }).send(pdf);
}));

module.exports = router;
