const Boom = require('@hapi/boom');
const moment = require('moment');
const pickBy = require('lodash/pickBy');
const get = require('lodash/get');
const has = require('lodash/has');
const pick = require('lodash/pick');
const omit = require('lodash/omit');
const flat = require('flat');
const { v4: uuidv4 } = require('uuid');
const Role = require('../models/Role');
const User = require('../models/User');
const Company = require('../models/Company');
const Contract = require('../models/Contract');
const translate = require('./translate');
const GCloudStorageHelper = require('./gCloudStorage');
const { TRAINER, AUXILIARY_ROLES, HELPER, AUXILIARY_WITHOUT_COMPANY } = require('./constants');
const SectorHistoriesHelper = require('./sectorHistories');
const GDriveStorageHelper = require('./gDriveStorage');
const UtilsHelper = require('./utils');
const HelpersHelper = require('./helpers');
const UserCompaniesHelper = require('./userCompanies');

const { language } = translate;

exports.formatQueryForUsersList = async (query) => {
  const params = { ...pickBy(omit(query, ['role'])) };

  if (query.role) {
    const roleNames = Array.isArray(query.role) ? query.role : [query.role];
    const roles = await Role.find({ name: { $in: roleNames } }, { _id: 1, interface: 1 }).lean();
    if (!roles.length) throw Boom.notFound(translate[language].roleNotFound);

    params[`role.${roles[0].interface}`] = { $in: roles.map(role => role._id) };
  }

  return params;
};

exports.getUsersList = async (query, credentials) => {
  const params = await exports.formatQueryForUsersList(query);

  return User.find(params, {}, { autopopulate: false })
    .populate({ path: 'role.client', select: '-__v -createdAt -updatedAt' })
    .populate({ path: 'company', select: '-__v -createdAt -updatedAt' })
    .populate({
      path: 'sector',
      select: '_id sector',
      match: { company: get(credentials, 'company._id', null) },
      options: { isVendorUser: has(credentials, 'role.vendor') },
    })
    .populate({ path: 'contracts', select: 'startDate endDate' })
    .setOptions({ isVendorUser: has(credentials, 'role.vendor') })
    .lean({ virtuals: true, autopopulate: true });
};

exports.getUsersListWithSectorHistories = async (query, credentials) => {
  const params = await exports.formatQueryForUsersList({ ...query, role: AUXILIARY_ROLES });

  return User.find(params, {}, { autopopulate: false })
    .populate({ path: 'role.client', select: '-__v -createdAt -updatedAt' })
    .populate({ path: 'company', select: '-__v -createdAt -updatedAt' })
    .populate({
      path: 'sectorHistories',
      select: '_id sector startDate endDate',
      match: { company: get(credentials, 'company._id', null) },
      options: { isVendorUser: has(credentials, 'role.vendor') },
    })
    .populate({ path: 'contracts', select: 'startDate endDate' })
    .setOptions({ isVendorUser: has(credentials, 'role.vendor') })
    .lean({ virtuals: true, autopopulate: true });
};

exports.getLearnerList = async (query, credentials) => {
  let userQuery = { ...query };
  if (query.company) {
    const rolesToExclude = await Role.find({ name: { $in: [HELPER, AUXILIARY_WITHOUT_COMPANY] } });
    userQuery = { ...userQuery, 'role.client': { $not: { $in: rolesToExclude.map(r => r._id) } } };
  }

  if (query.hasCompany) userQuery = { ...omit(userQuery, 'hasCompany'), company: { $exists: true } };

  const learnerList = await User
    .find(userQuery, 'identity.firstname identity.lastname picture local contact', { autopopulate: false })
    .populate({ path: 'company', select: 'name' })
    .populate({ path: 'role.client', select: 'name' })
    .populate({ path: 'role.vendor', select: 'name' })
    .populate({ path: 'blendedCoursesCount' })
    .populate({ path: 'eLearningCoursesCount' })
    .populate({ path: 'activityHistories', select: 'updatedAt', options: { sort: { updatedAt: -1 } } })
    .populate({ path: 'attendances' })
    .populate({ path: 'questionnaireHistories' })
    .setOptions({ isVendorUser: !!get(credentials, 'role.vendor') })
    .lean();

  return learnerList.map(learner => ({
    ...omit(learner, 'activityHistories questionnaireHistories attendances'),
    attendancesCount: learner.attendances.length,
    questionnaireHistoryCount: learner.questionnaireHistories.length,
    activityHistoryCount: learner.activityHistories.length,
    lastActivityHistory: learner.activityHistories[0],
  }));
};

exports.getUser = async (userId, credentials) => {
  const companyId = get(credentials, 'company._id') || null;

  const user = await User.findOne({ _id: userId })
    .populate({ path: 'contracts', select: '-__v -createdAt -updatedAt' })
    .populate({ path: 'company', select: '-__v -createdAt -updatedAt' })
    .populate({
      path: 'sector',
      select: '_id sector',
      match: { company: companyId },
      options: {
        isVendorUser: has(credentials, 'role.vendor'),
        requestingOwnInfos: UtilsHelper.areObjectIdsEquals(userId, credentials._id),
      },
    })
    .populate({
      path: 'customers',
      select: '-__v -createdAt -updatedAt',
      match: { company: companyId },
      options: {
        isVendorUser: has(credentials, 'role.vendor'),
        requestingOwnInfos: UtilsHelper.areObjectIdsEquals(userId, credentials._id),
      },
    })
    .lean({ autopopulate: true, virtuals: true });

  if (!user) throw Boom.notFound(translate[language].userNotFound);

  return user;
};

exports.userExists = async (email, credentials) => {
  const targetUser = await User.findOne({ 'local.email': email }, { role: 1, company: 1 }).lean();
  if (!targetUser) return { exists: false, user: {} };
  if (!credentials) return { exists: true, user: {} };

  const loggedUserhasVendorRole = has(credentials, 'role.vendor');
  const sameCompany = !!targetUser.company &&
    UtilsHelper.areObjectIdsEquals(get(credentials, 'company._id'), targetUser.company);

  return loggedUserhasVendorRole || sameCompany || !targetUser.company
    ? { exists: !!targetUser, user: pick(targetUser, ['role', '_id', 'company']) }
    : { exists: !!targetUser, user: {} };
};

exports.saveCertificateDriveId = async (userId, fileInfo) =>
  User.updateOne({ _id: userId }, { $push: { 'administrative.certificates': fileInfo } });

exports.saveFile = async (userId, administrativeKey, fileInfo) =>
  User.updateOne({ _id: userId }, { $set: flat({ administrative: { [administrativeKey]: fileInfo } }) });

exports.createAndSaveFile = async (params, payload) => {
  const uploadedFile = await GDriveStorageHelper.addFile({
    driveFolderId: params.driveId,
    name: payload.fileName || payload.type.hapi.filename,
    type: payload['Content-Type'],
    body: payload.file,
  });

  const file = { driveId: uploadedFile.id, link: uploadedFile.webViewLink };
  switch (payload.type) {
    case 'certificates':
      await exports.saveCertificateDriveId(params._id, file);
      break;
    default:
      await exports.saveFile(params._id, payload.type, file);
      break;
  }

  return uploadedFile;
};

const createUserCompany = async (payload, company) => {
  const user = await User.create({ ...payload, company });
  await UserCompaniesHelper.create(user._id, company);

  return user;
};

/**
 * 1st case : No role / no company => handle payload as given
 *  - User creates his account
 *  - Vendor admin creates program tester
 * 2nd case : Client role creates user for his organization => set company with the one in credentials
 * + role (if needed)
 *  - if sector is given => add sector history (for auxiliary and planning referent)
 * 3rd case : Vendor role creates user for one organization => set company with the one in payload + role (if needed)
 * 4th case : Vendor role creates trainer => do no set company
 */
exports.createUser = async (userPayload, credentials) => {
  const payload = { ...omit(userPayload, ['role', 'sector', 'customer']), refreshToken: uuidv4() };

  if (!credentials) return User.create(payload);

  const companyId = payload.company || get(credentials, 'company._id');
  if (!userPayload.role) return createUserCompany(payload, companyId);

  const role = await Role.findById(userPayload.role, { name: 1, interface: 1 }).lean();
  if (!role) throw Boom.badRequest(translate[language].unknownRole);

  if (role.name === TRAINER) return User.create({ ...payload, role: { [role.interface]: role._id } });

  const user = await createUserCompany({ ...payload, role: { [role.interface]: role._id } }, companyId);

  if (userPayload.customer) await HelpersHelper.create(user._id, userPayload.customer, companyId);

  if (userPayload.sector) {
    await SectorHistoriesHelper.createHistory({ _id: user._id, sector: userPayload.sector }, companyId);
  }

  return User.findOne({ _id: user._id })
    .populate({ path: 'sector', select: '_id sector', match: { company: companyId } })
    .populate({ path: 'company', select: '-__v -createdAt -updatedAt' })
    .lean({ virtuals: true, autopopulate: true });
};

const formatUpdatePayload = async (updatedUser) => {
  const payload = omit(updatedUser, ['role', 'customer']);

  if (updatedUser.role) {
    const role = await Role.findById(updatedUser.role, { name: 1, interface: 1 }).lean();
    if (!role) throw Boom.badRequest(translate[language].unknownRole);

    payload.role = { [role.interface]: role._id.toHexString() };
  }

  return payload;
};

exports.updateUser = async (userId, userPayload, credentials, canEditWithoutCompany = false) => {
  const companyId = get(credentials, 'company._id', null);

  const filterQuery = { _id: userId };
  if (!canEditWithoutCompany) filterQuery.company = companyId;

  const payload = await formatUpdatePayload(userPayload);

  if (userPayload.customer) await HelpersHelper.create(userId, userPayload.customer, companyId);
  if (userPayload.company) await UserCompaniesHelper.create(userId, userPayload.company);

  if (userPayload.sector) {
    await SectorHistoriesHelper.updateHistoryOnSectorUpdate(userId, payload.sector, companyId);
  }

  await User.updateOne(filterQuery, { $set: flat(payload) });
};

exports.updateUserCertificates = async (userId, userPayload, credentials) => {
  const companyId = get(credentials, 'company._id', null);

  await User.updateOne(
    { _id: userId, company: companyId },
    { $pull: { 'administrative.certificates': userPayload.certificates } }
  );
};

exports.updateUserInactivityDate = async (user, contractEndDate, credentials) => {
  const notEndedContractCount = await Contract.countDocuments({
    user,
    company: get(credentials, 'company._id', null),
    $or: [{ endDate: { $exists: false } }, { endDate: null }],
  });

  if (!notEndedContractCount) {
    await User.updateOne(
      { _id: user },
      { $set: { inactivityDate: moment(contractEndDate).add('1', 'month').startOf('M').toDate() } }
    );
  }
};

exports.removeHelper = async (user) => {
  await HelpersHelper.remove(user._id);
  await User.updateOne({ _id: user._id }, { $unset: { 'role.client': '', company: '' } });
};

exports.uploadPicture = async (userId, payload) => {
  const picture = await GCloudStorageHelper.uploadUserMedia(payload);

  await User.updateOne({ _id: userId }, { $set: flat({ picture }) });
};

exports.deletePicture = async (userId, publicId) => {
  if (!publicId) return;

  await User.updateOne({ _id: userId }, { $unset: { 'picture.publicId': '', 'picture.link': '' } });
  await GCloudStorageHelper.deleteUserMedia(publicId);
};

exports.createDriveFolder = async (user) => {
  const userCompany = await Company.findOne({ _id: user.company }, { auxiliariesFolderId: 1 }).lean();
  if (!userCompany || !userCompany.auxiliariesFolderId) throw Boom.badData();

  const folder = await GDriveStorageHelper.createFolder(user.identity, userCompany.auxiliariesFolderId);

  const administrative = { driveFolder: { link: folder.webViewLink, driveId: folder.id } };

  await User.updateOne({ _id: user._id }, { $set: flat({ administrative }) });
};

exports.addExpoToken = async (payload, credentials) => User.updateOne(
  { _id: credentials._id },
  { $addToSet: { formationExpoTokenList: payload.formationExpoToken } }
);

exports.removeExpoToken = async (expoToken, credentials) => User.updateOne(
  { _id: credentials._id },
  { $pull: { formationExpoTokenList: expoToken } }
);
