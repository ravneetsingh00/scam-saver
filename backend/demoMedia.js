require('dotenv').config();
const mongoose = require('mongoose');
const fs = require('fs/promises');
const path = require('path');
const crypto = require('crypto');
const Report = require('./models/Report');

const assetsDir = path.join(__dirname, 'demo-assets');
const uploadDir = path.join(__dirname, 'uploads');
const sampleAssets = [
  { file: 'demo-second-payment-request.png', type: 'image/png', description: 'DEMO ONLY: synthetic illustration of a fictional second-payment request. Not real case evidence.' },
  { file: 'demo-payment-chat.png', type: 'image/png', description: 'DEMO ONLY: synthetic fictional message conversation. No real people or business.' },
  { file: 'demo-fraud-alert.wav', type: 'audio/wav', description: 'DEMO ONLY: generated alert tones for the evidence player. Not a real call recording.' },
];

async function main() {
  if (!process.env.MONGODB_URI) throw new Error('Set MONGODB_URI in .env first.');
  await mongoose.connect(process.env.MONGODB_URI, { serverSelectionTimeoutMS: 5000 });
  await fs.mkdir(uploadDir, { recursive: true, mode: 0o700 });
  await fs.chmod(uploadDir, 0o700);

  const existing = await Report.find({ isDemo: true, status: { $ne: 'Draft' } }).sort({ createdAt: 1 }).select('reportId businessName evidence evidenceAttachments moderationHistory');
  const freeSlots = report => 5 - report.evidenceAttachments.length - (report.evidence && report.evidenceAttachments.length === 0 ? 1 : 0);
  let attached = 0;
  let eligibleCases = 0;
  for (const report of existing) {
    const alreadyAttached = new Set(report.evidenceAttachments.map(file => file.originalName));
    const pendingAssets = sampleAssets.filter(sample => !alreadyAttached.has(sample.file));
    if (!pendingAssets.length) continue;
    if (freeSlots(report) < pendingAssets.length) {
      console.log(`Skipped demo case ${report.reportId}: not enough attachment slots.`);
      continue;
    }
    eligibleCases += 1;
    for (const sample of pendingAssets) {
      const source = path.join(assetsDir, sample.file);
      const data = await fs.readFile(source);
      const valid = sample.type === 'image/png'
        ? data.subarray(0, 8).equals(Buffer.from([137, 80, 78, 71, 13, 10, 26, 10]))
        : data.subarray(0, 4).toString() === 'RIFF' && data.subarray(8, 12).toString() === 'WAVE';
      if (!valid) throw new Error(`Demo asset failed its file signature check: ${sample.file}`);
      const ext = path.extname(sample.file);
      const filename = `${crypto.randomUUID()}${ext}`;
      const destination = path.join(uploadDir, filename);
      await fs.copyFile(source, destination, fs.constants.COPYFILE_EXCL);
      await fs.chmod(destination, 0o600);
      try {
        report.evidenceAttachments.push({ filename, originalName: sample.file, mimeType: sample.type, size: data.length, description: sample.description });
        if (!report.evidence) report.evidence = filename;
        report.moderationHistory.push({ action: 'Synthetic demo attachment added', note: sample.description, by: null });
        await report.save();
        console.log(`Attached ${sample.file} to demo case ${report.reportId} (${report.businessName}).`);
        attached += 1;
      } catch (error) {
        await fs.unlink(destination).catch(() => {});
        throw error;
      }
    }
  }
  if (!attached) console.log('The labeled demo media is already attached to eligible demo cases. Real user reports were not changed.');
  else console.log(`Done: added ${attached} clearly labeled synthetic attachment(s) across ${eligibleCases} demo case(s) only.`);
}

main().catch(error => {
  console.error(`Demo media setup failed: ${error.message}`);
  process.exitCode = 1;
}).finally(async () => {
  if (mongoose.connection.readyState) await mongoose.disconnect();
});
