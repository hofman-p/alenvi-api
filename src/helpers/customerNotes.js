const CustomerNote = require('../models/CustomerNote');
const CustomerNoteHistory = require('../models/CustomerNoteHistory');
const { NOTE_CREATION, NOTE_UPDATE } = require('./constants');

exports.create = async (payload, credentials) => {
  const customerNote = await CustomerNote.create({ ...payload, company: credentials.company._id });
  const query = { title: payload.title, description: payload.description, action: NOTE_CREATION };

  createHistory(query, credentials, customerNote._id);
};

exports.list = async (customer, credentials) => CustomerNote.find({ customer, company: credentials.company._id })
  .populate({
    path: 'histories',
    select: 'title description createdBy action createdAt',
    populate: { path: 'createdBy', select: 'identity picture' },
  })
  .sort({ updatedAt: -1 })
  .lean();

const createHistory = async (query, credentials, customerNoteId) => {
  await CustomerNoteHistory.create({
    ...query,
    customerNote: customerNoteId,
    company: credentials.company._id,
    createdBy: credentials._id,
  });
};

exports.update = async (customerNoteId, payload, credentials) => {
  const promises = [];
  const initialCustomerNote = await CustomerNote.findOne({ _id: customerNoteId, company: credentials.company._id })
    .lean();

  if (payload.description.trim() !== initialCustomerNote.description) {
    promises.push(
      createHistory({ description: payload.description, action: NOTE_UPDATE }, credentials, customerNoteId)
    );
  }

  if (promises.length) {
    await CustomerNote.updateOne({ _id: customerNoteId, company: credentials.company._id }, { $set: payload });
  }

  await Promise.all(promises);
};
