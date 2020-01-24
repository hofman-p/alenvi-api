const moment = require('moment');
const SectorHistory = require('../models/SectorHistory');
const Contract = require('../models/Contract');
const { COMPANY_CONTRACT } = require('./constants');

exports.updateHistoryOnSectorUpdate = async (auxiliaryId, sector, companyId) => {
  const lastSectorHistory = await SectorHistory.findOne({ auxiliary: auxiliaryId, $or: [{ endDate: { $exists: false } }, { endDate: null }] }).lean();
  if (lastSectorHistory.sector.toHexString() === sector) return;

  const contracts = await Contract
    .find({ user: auxiliaryId, status: COMPANY_CONTRACT, company: companyId, $or: [{ endDate: { $exists: false } }, { endDate: null }] })
    .sort({ startDate: -1 })
    .lean();
  const doesNotHaveContract = !contracts.length;
  const contractNotStarted = contracts.length && moment().isBefore(contracts[0].startDate);
  const alreadyChangedToday = moment().isSame(lastSectorHistory.startDate, 'day');
  if (doesNotHaveContract || contractNotStarted || alreadyChangedToday) {
    return SectorHistory.updateOne({ auxiliary: auxiliaryId, $or: [{ endDate: { $exists: false } }, { endDate: null }] }, { $set: { sector } });
  }

  await SectorHistory.updateOne(
    { auxiliary: auxiliaryId, $or: [{ endDate: { $exists: false } }, { endDate: null }] },
    { $set: { endDate: moment().subtract(1, 'day').endOf('day').toDate() } }
  );

  return exports.createHistory({ _id: auxiliaryId, sector }, companyId, moment().startOf('day').toDate());
};

exports.createHistoryOnContractCreation = async (user, newContract, companyId) => {
  const contractsCount = await Contract.countDocuments({
    user: user._id,
    status: COMPANY_CONTRACT,
    company: companyId,
  }).lean();
  if (contractsCount > 1) {
    return exports.createHistory(user, companyId, moment(newContract.startDate).startOf('day').toDate());
  }

  return SectorHistory.updateOne(
    { auxiliary: user._id, $or: [{ endDate: { $exists: false } }, { endDate: null }] },
    { $set: { startDate: moment(newContract.startDate).startOf('day').toDate() } }
  );
};

exports.updateHistoryOnContractUpdate = async (contractId, versionToUpdate, companyId) => {
  const contract = await Contract.findOne({ _id: contractId, company: companyId }).lean();
  if (moment(versionToUpdate.startDate).isSameOrBefore(contract.startDate, 'day')) {
    return SectorHistory.updateOne(
      { auxiliary: contract.user, $or: [{ endDate: { $exists: false } }, { endDate: null }] },
      { $set: { startDate: moment(versionToUpdate.startDate).startOf('day').toDate() } }
    );
  }

  await SectorHistory.remove({
    auxiliary: contract.user,
    endDate: { $gte: contract.startDate, $lte: versionToUpdate.startDate },
  });
  const sectorHistory = await SectorHistory
    .find({ company: companyId, auxiliary: contract.user, startDate: { $gte: moment(contract.startDate).toDate() } })
    .sort({ startDate: 1 })
    .limit(1)
    .lean();

  return SectorHistory.updateOne(
    { _id: sectorHistory[0]._id },
    { $set: { startDate: moment(versionToUpdate.startDate).startOf('day').toDate() } }
  );
};

exports.updateHistoryOnContractDeletion = async (contract, companyId) => {
  const sectorHistory = await SectorHistory.findOne({ auxiliary: contract.user, $or: [{ endDate: { $exists: false } }, { endDate: null }] }).lean();
  await SectorHistory.remove({
    auxiliary: contract.user,
    company: companyId,
    startDate: { $gte: contract.startDate, $lt: sectorHistory.startDate },
  });

  return SectorHistory.updateOne(
    { auxiliary: contract.user, $or: [{ endDate: { $exists: false } }, { endDate: null }] },
    { $unset: { startDate: '' } }
  );
};

exports.createHistory = async (user, companyId, startDate = null) => {
  const payload = { auxiliary: user._id, sector: user.sector, company: companyId };
  if (startDate) payload.startDate = startDate;

  return (await SectorHistory.create(payload)).toObject();
};

exports.updateEndDate = async (auxiliaryId, endDate) =>
  SectorHistory.updateOne(
    { auxiliary: auxiliaryId, $or: [{ endDate: { $exists: false } }, { endDate: null }] },
    { $set: { endDate: moment(endDate).endOf('day').toDate() } }
  );
