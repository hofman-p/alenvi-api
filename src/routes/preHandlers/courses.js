const Boom = require('@hapi/boom');
const get = require('lodash/get');
const Course = require('../../models/Course');
const User = require('../../models/User');
const UserCompany = require('../../models/UserCompany');
const {
  TRAINER,
  INTRA,
  INTER_B2B,
  VENDOR_ADMIN,
  CLIENT_ADMIN,
  COACH,
  TRAINING_ORGANISATION_MANAGER,
  STRICTLY_E_LEARNING,
  BLENDED,
} = require('../../helpers/constants');
const translate = require('../../helpers/translate');
const UtilsHelper = require('../../helpers/utils');

const { language } = translate;

exports.checkAuthorization = (credentials, courseTrainerId, courseCompanyId, traineeCompanyId = null) => {
  const userVendorRole = get(credentials, 'role.vendor.name');
  const userClientRole = get(credentials, 'role.client.name');
  const userCompanyId = credentials.company ? credentials.company._id.toHexString() : null;
  const userId = get(credentials, '_id');
  const areCompaniesEqual = UtilsHelper.areObjectIdsEquals(userCompanyId, courseCompanyId) ||
    UtilsHelper.areObjectIdsEquals(userCompanyId, traineeCompanyId);

  const isAdminVendor = userVendorRole === VENDOR_ADMIN;
  const isTOM = userVendorRole === TRAINING_ORGANISATION_MANAGER;
  const isTrainerAndAuthorized = userVendorRole === TRAINER && UtilsHelper.areObjectIdsEquals(userId, courseTrainerId);
  const isClientAndAuthorized = [CLIENT_ADMIN, COACH].includes(userClientRole) && userCompanyId && areCompaniesEqual;

  if (!isAdminVendor && !isTOM && !isTrainerAndAuthorized && !isClientAndAuthorized) throw Boom.forbidden();
};

exports.checkSalesRepresentativeExists = async (req) => {
  const salesRepresentative = await User.findOne({ _id: req.payload.salesRepresentative }, { role: 1 })
    .lean({ autopopulate: true });

  if (![VENDOR_ADMIN, TRAINING_ORGANISATION_MANAGER].includes(get(salesRepresentative, 'role.vendor.name'))) {
    throw Boom.forbidden();
  }

  return null;
};

exports.authorizeCourseEdit = async (req) => {
  try {
    const { credentials } = req.auth;
    const course = await Course.findOne({ _id: req.params._id }).lean();
    if (!course) throw Boom.notFound();

    const courseTrainerId = course.trainer ? course.trainer.toHexString() : null;
    const courseCompanyId = course.company ? course.company.toHexString() : null;
    this.checkAuthorization(credentials, courseTrainerId, courseCompanyId);

    if (get(req, 'payload.salesRepresentative')) await this.checkSalesRepresentativeExists(req);

    return null;
  } catch (e) {
    req.log('error', e);
    return Boom.isBoom(e) ? e : Boom.badImplementation(e);
  }
};

exports.authorizeGetCourseList = async (req) => {
  const { credentials } = req.auth;

  const courseTrainerId = get(req, 'query.trainer');
  const courseCompanyId = get(req, 'query.company');

  this.checkAuthorization(credentials, courseTrainerId, courseCompanyId);

  return null;
};

exports.authorizeCourseGetByTrainee = async (req) => {
  try {
    const userId = get(req, 'auth.credentials._id');
    const companyId = get(req, 'auth.credentials.company._id');
    const course = await Course.findOne({
      _id: req.params._id,
      trainees: userId,
      $expr: {
        $cond: {
          if: { $eq: ['$format', STRICTLY_E_LEARNING] },
          then: { $or: [{ $eq: ['$accessRules', []] }, { $in: [companyId, '$accessRules'] }] },
          else: true,
        },
      },
    }).lean();
    if (!course) throw Boom.forbidden();

    return null;
  } catch (e) {
    req.log('error', e);
    return Boom.isBoom(e) ? e : Boom.badImplementation(e);
  }
};

exports.getCourseTrainee = async (req) => {
  try {
    const { payload } = req;
    const course = await Course.findOne({ _id: req.params._id }, { type: 1, trainees: 1, company: 1 }).lean();
    if (!course) throw Boom.notFound();

    const trainee = await User.findOne({ 'local.email': payload.local.email }).lean();
    if (trainee) {
      if (course.type === INTRA) {
        const conflictBetweenCompanies = !UtilsHelper.areObjectIdsEquals(course.company._id, trainee.company);
        if (trainee.company && conflictBetweenCompanies) {
          throw Boom.conflict(translate[language].courseTraineeNotFromCourseCompany);
        }
      } else if (course.type === INTER_B2B) {
        const missingPayloadCompany = !trainee.company && !payload.company;
        if (missingPayloadCompany) throw Boom.badRequest();
      }

      const traineeAlreadyRegistered = course.trainees.some(t => UtilsHelper.areObjectIdsEquals(t, trainee._id));
      if (traineeAlreadyRegistered) throw Boom.conflict(translate[language].courseTraineeAlreadyExists);
    } else {
      const missingFields = ['company', 'local.email', 'identity.lastname', 'contact.phone']
        .some(key => !get(payload, key));
      if (missingFields) throw Boom.badRequest();
    }

    return trainee;
  } catch (e) {
    req.log('error', e);
    return Boom.isBoom(e) ? e : Boom.badImplementation(e);
  }
};

exports.authorizeCourseDeletion = async (req) => {
  const userVendorRole = get(req, 'auth.credentials.role.vendor.name');
  if (![TRAINING_ORGANISATION_MANAGER, VENDOR_ADMIN].includes(userVendorRole)) return Boom.forbidden();

  const course = await Course.findOne({ _id: req.params._id })
    .populate({ path: 'slots' })
    .populate({ path: 'slotsToPlan' })
    .lean();
  if (!course) return Boom.notFound();

  if (course.trainees.length) return Boom.forbidden('stagiaire');
  if (course.slots.length) return Boom.forbidden('creneaux');
  if (course.slotsToPlan.length) return Boom.forbidden('a planifier');

  return null;
};

exports.authorizeRegisterToELearning = async (req) => {
  const course = await Course.findById(req.params._id).lean();

  if (!course) throw Boom.notFound();
  if (course.format !== STRICTLY_E_LEARNING) throw Boom.forbidden();

  const credentials = get(req, 'auth.credentials');
  if (course.trainees.some(trainee =>
    UtilsHelper.areObjectIdsEquals(trainee, get(credentials, '_id')))) throw Boom.forbidden();

  const { accessRules } = course;
  const companyId = get(credentials, 'company._id');
  if (accessRules.length &&
    (!companyId || !accessRules.some(id => UtilsHelper.areObjectIdsEquals(id, companyId)))) throw Boom.forbidden();

  return null;
};

exports.authorizeGetCourse = async (req) => {
  try {
    const { course } = req.pre;
    const credentials = get(req, 'auth.credentials');
    const userCompany = get(credentials, 'company._id');
    const userVendorRole = get(credentials, 'role.vendor.name');
    const userClientRole = get(credentials, 'role.client.name');

    const isTrainee = course.trainees.includes(credentials._id);
    const isAdminVendor = userVendorRole === VENDOR_ADMIN;
    const isTOM = userVendorRole === TRAINING_ORGANISATION_MANAGER;
    if (isTrainee || isTOM || isAdminVendor) return null;

    const isTrainerAndAuthorized = userVendorRole === TRAINER &&
      UtilsHelper.areObjectIdsEquals(course.trainer, credentials._id);
    if (isTrainerAndAuthorized) return null;

    if (!userClientRole || ![COACH, CLIENT_ADMIN].includes(userClientRole)) throw Boom.forbidden();

    const companyHasAccess = !course.accessRules.length || course.accessRules.includes(userCompany);
    if (course.format === STRICTLY_E_LEARNING && !companyHasAccess) throw Boom.forbidden();

    if (course.type === INTRA) {
      if (!UtilsHelper.areObjectIdsEquals(course.company, userCompany)) throw Boom.forbidden();

      return null;
    }

    const courseWithTrainees = await Course.findById(req.params._id)
      .populate({ path: 'trainees', select: 'company' })
      .lean();
    const someTraineesAreInCompany = courseWithTrainees.trainees
      .some(trainee => UtilsHelper.areObjectIdsEquals(trainee.company, userCompany));
    if (!someTraineesAreInCompany) throw Boom.forbidden();

    return null;
  } catch (e) {
    req.log('error', e);
    return Boom.isBoom(e) ? e : Boom.badImplementation(e);
  }
};

exports.getCourse = async (req) => {
  const course = await Course.findById(req.params._id).lean();
  if (!course) throw Boom.notFound();

  return course;
};

exports.authorizeAndGetTrainee = async (req) => {
  const credentials = get(req, 'auth.credentials');
  const traineeId = get(req, 'query.traineeId');
  if (!traineeId) return { _id: get(credentials, '_id'), company: get(credentials, 'company._id') };

  const user = await User.countDocuments({ _id: traineeId });
  if (!user) return Boom.notFound(translate[language].userNotFound);

  const loggedUserVendorRole = get(credentials, 'role.vendor.name');
  const loggedUserClientRole = get(credentials, 'role.client.name');

  const userCompany = await UserCompany.findOne({ user: traineeId }, { company: 1 }).lean();
  if (!userCompany) {
    if (![VENDOR_ADMIN, TRAINING_ORGANISATION_MANAGER].includes(loggedUserVendorRole)) return Boom.notFound();
    return { _id: traineeId };
  }

  const trainee = { _id: traineeId, company: userCompany.company };
  if ([VENDOR_ADMIN, TRAINING_ORGANISATION_MANAGER].includes(loggedUserVendorRole)) return trainee;

  if (loggedUserClientRole) {
    if (![COACH, CLIENT_ADMIN].includes(loggedUserClientRole)) return Boom.notFound();

    const isSameCompany = UtilsHelper.areObjectIdsEquals(userCompany.company, get(credentials, 'company._id'));
    if (!isSameCompany) return Boom.notFound();

    return trainee;
  }

  return Boom.notFound();
};

exports.authorizeAccessRuleAddition = async (req) => {
  const course = await Course.findById(req.params._id, 'accessRules').lean();

  if (!course) throw Boom.notFound();

  const accessRuleAlreadyExist = course.accessRules.map(c => c.toHexString())
    .includes(req.payload.company);

  if (accessRuleAlreadyExist) throw Boom.conflict();

  return null;
};

exports.authorizeAccessRuleDeletion = async (req) => {
  const course = await Course.countDocuments({ _id: req.params._id, accessRules: req.params.accessRuleId });

  if (!course) throw Boom.notFound();

  return null;
};

exports.authorizeGetFollowUp = async (req) => {
  const credentials = get(req, 'auth.credentials');
  const loggedUserVendorRole = get(credentials, 'role.vendor.name');
  const companyQueryIsValid = !!req.query.company &&
    UtilsHelper.areObjectIdsEquals(get(credentials, 'company._id'), req.query.company);

  if (!loggedUserVendorRole && !companyQueryIsValid) throw Boom.forbidden();

  return null;
};

exports.authorizeGetQuestionnaires = async (req) => {
  const credentials = get(req, 'auth.credentials');
  const countQuery = get(credentials, 'role.vendor.name') === TRAINER
    ? { _id: req.params._id, format: BLENDED, trainer: credentials._id }
    : { _id: req.params._id, format: BLENDED };
  const course = await Course.countDocuments(countQuery);
  if (!course) throw Boom.notFound();

  return null;
};
