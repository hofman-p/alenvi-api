const mongoose = require('mongoose');
const Boom = require('@hapi/boom');
const mongooseLeanVirtuals = require('mongoose-lean-virtuals');
const autopopulate = require('mongoose-autopopulate');
const bcrypt = require('bcrypt');
const Joi = require('joi');
const moment = require('moment');
const get = require('lodash/get');
const { PHONE_VALIDATION } = require('./utils');
const addressSchemaDefinition = require('./schemaDefinitions/address');
const { identitySchemaDefinition } = require('./schemaDefinitions/identity');
const driveResourceSchemaDefinition = require('./schemaDefinitions/driveResource');
const {
  AUXILIARY,
  PLANNING_REFERENT,
  AUXILIARY_WITHOUT_COMPANY,
  BLENDED,
  STRICTLY_E_LEARNING,
  MOBILE,
  WEBAPP,
} = require('../helpers/constants');
const { validateQuery, validateAggregation } = require('./preHooks/validate');

const SALT_WORK_FACTOR = 10;
const TOKEN_EXPIRE_TIME = 86400;

const roleSchemaDefinition = {
  type: mongoose.Schema.Types.ObjectId,
  ref: 'Role',
  autopopulate: { select: '-__v -createdAt -updatedAt', maxDepth: 3 },
};

const ORIGIN_OPTIONS = [WEBAPP, MOBILE];

// User schema
const UserSchema = mongoose.Schema({
  refreshToken: { type: String, select: false },
  serialNumber: { type: String, immutable: true, required: true, unique: true },
  passwordToken: {
    type: mongoose.Schema({
      token: { type: String },
      expiresIn: { type: Date },
    }),
    select: false,
  },
  local: {
    email: {
      type: String,
      lowercase: true,
      trim: true,
      unique: true,
      required: true,
      dropDups: true,
    },
    password: { type: String, minLength: 6, select: false },
  },
  role: {
    client: roleSchemaDefinition,
    vendor: roleSchemaDefinition,
  },
  youtube: {
    link: { type: String, trim: true },
    location: { type: [String], trim: true },
  },
  picture: {
    publicId: String,
    link: { type: String, trim: true },
  },
  identity: {
    type: mongoose.Schema({
      ...identitySchemaDefinition,
      nationality: { type: String },
      birthCountry: { type: String },
      birthState: { type: String },
      birthCity: { type: String },
      socialSecurityNumber: { type: Number },
    }, { _id: false, id: false }),
    required: true,
  },
  contact: {
    address: { type: mongoose.Schema(addressSchemaDefinition, { id: false, _id: false }) },
    phone: { type: String, validate: PHONE_VALIDATION },
  },
  emergencyPhone: { type: String },
  mentor: { type: String },
  contracts: [{ type: mongoose.Schema.Types.ObjectId, ref: 'Contract' }],
  administrative: {
    driveFolder: driveResourceSchemaDefinition,
    signup: {
      firstSmsDate: { type: Date },
      secondSmsDate: { type: Date },
      step: { type: String, default: 'first' },
      complete: { type: Boolean, default: false },
    },
    payment: {
      rib: {
        iban: { type: String },
        bic: { type: String },
      },
    },
    idCardRecto: driveResourceSchemaDefinition,
    idCardVerso: driveResourceSchemaDefinition,
    passport: driveResourceSchemaDefinition,
    residencePermitRecto: driveResourceSchemaDefinition,
    residencePermitVerso: driveResourceSchemaDefinition,
    healthAttest: driveResourceSchemaDefinition,
    vitalCard: driveResourceSchemaDefinition,
    identityDocs: { type: String },
    certificates: [driveResourceSchemaDefinition],
    phoneInvoice: driveResourceSchemaDefinition,
    navigoInvoice: driveResourceSchemaDefinition,
    transportInvoice: {
      ...driveResourceSchemaDefinition,
      transportType: { type: String },
    },
    mutualFund: {
      ...driveResourceSchemaDefinition,
      has: Boolean,
    },
    medicalCertificate: driveResourceSchemaDefinition,
    emergencyContact: {
      name: { type: String },
      phoneNumber: { type: String },
    },
  },
  isConfirmed: { type: Boolean, default: false },
  company: { type: mongoose.Schema.Types.ObjectId, ref: 'Company' },
  establishment: { type: mongoose.Schema.Types.ObjectId, ref: 'Establishment' },
  inactivityDate: { type: Date, default: null },
  biography: { type: String },
  firstMobileConnection: { type: Date },
  origin: { type: String, enum: ORIGIN_OPTIONS, required: true, immutable: true },
  formationExpoTokenList: [{ type: String }],
}, {
  timestamps: true,
  toObject: { virtuals: true },
  toJSON: { virtuals: true },
  id: false,
});

const validateEmail = (email) => {
  const emailSchema = Joi.object().keys({ email: Joi.string().email() });
  return emailSchema.validate({ email });
};

const setSerialNumber = (user) => {
  const createdAt = moment(user.createdAt).format('YYMMDD');
  const timestamp = moment(user.createdAt).valueOf().toString();
  const lastname = user.identity.lastname.replace(/[^a-zA-Z]/g, '').charAt(0).toUpperCase();
  const firstname = user.identity.firstname
    ? user.identity.firstname.replace(/[^a-zA-Z]/g, '').charAt(0).toUpperCase()
    : '';

  return `${lastname}${firstname}${createdAt}${timestamp.slice(-8)}`;
};

async function validate(next) {
  try {
    if (this.isNew) this.serialNumber = setSerialNumber(this);

    return next();
  } catch (e) {
    return next(e);
  }
}

async function save(next) {
  try {
    const user = this;

    if (user.isModified('local.email')) {
      const validation = validateEmail(user.local.email);
      if (validation.error) return next(Boom.badRequest(validation.error));
    }

    if (!get(user, 'local.password') || !user.isModified('local.password')) return next();
    const salt = await bcrypt.genSalt(SALT_WORK_FACTOR);
    const hash = await bcrypt.hash(user.local.password, salt);
    user.local.password = hash;

    return next();
  } catch (e) {
    return next(e);
  }
}

async function findOneAndUpdate(next) {
  try {
    const password = this.getUpdate().$set['local.password'];
    const email = this.getUpdate().$set['local.email'];
    if (!password && !email) return next();

    if (email) {
      const validation = validateEmail(email);
      if (validation.error) return next(Boom.badRequest(validation.error));
    }

    if (password) {
      const salt = await bcrypt.genSalt(SALT_WORK_FACTOR);
      const hash = await bcrypt.hash(password, salt);
      this.getUpdate().$set['local.password'] = hash;
    }

    return next();
  } catch (e) {
    return next(e);
  }
}

// eslint-disable-next-line consistent-return
const isActive = (auxiliary) => {
  const auxiliaryRoleName = get(auxiliary, 'role.client.name');
  if (auxiliaryRoleName && [AUXILIARY, PLANNING_REFERENT].includes(auxiliaryRoleName)) {
    const { contracts, inactivityDate, createdAt } = auxiliary;
    const hasContracts = contracts && contracts.length;
    const isNew = moment().diff(createdAt, 'd') < 45;
    const isInactive = inactivityDate && moment().isAfter(inactivityDate);

    return Boolean(!isInactive && (hasContracts || isNew));
  }
};

function setIsActive() {
  return isActive(this);
}

// eslint-disable-next-line consistent-return
function setContractCreationMissingInfo() {
  const clientRole = get(this, 'role.client.name');
  if (clientRole && [AUXILIARY, PLANNING_REFERENT, AUXILIARY_WITHOUT_COMPANY].includes(clientRole)) {
    const mandatoryInfo = [
      'identity.lastname',
      'identity.firstname',
      'identity.birthDate',
      'identity.birthCity',
      'identity.birthState',
      'identity.nationality',
      'identity.socialSecurityNumber',
      'contact.address.fullAddress',
      'establishment',
    ];

    const contractCreationMissingInfo = [];
    for (const info of mandatoryInfo) {
      if (!get(this, info)) contractCreationMissingInfo.push(info);
    }

    return contractCreationMissingInfo;
  }
}

function populateSector(doc, next) {
  // eslint-disable-next-line no-param-reassign
  if (get(doc, 'sector.sector._id')) doc.sector = doc.sector.sector._id;

  return next();
}

function populateSectors(docs, next) {
  for (const doc of docs) {
    if (doc && doc.sector) {
      doc.sector = doc.sector.sector;
    }
  }

  return next();
}

function populateCustomers(doc, next) {
  // eslint-disable-next-line no-param-reassign
  if (get(doc, 'customers.customer')) doc.customers = [doc.customers.customer];

  return next();
}

async function formatPayload(doc, next) {
  const payload = doc.toObject();

  if (get(doc, 'refreshToken')) delete payload.refreshToken;
  if (get(doc, 'passwordToken')) delete payload.passwordToken;
  if (get(doc, 'local.password')) delete payload.local.password;

  doc.overwrite(payload);

  return next();
}

UserSchema.virtual('customers', {
  ref: 'Helper',
  localField: '_id',
  foreignField: 'user',
  justOne: true,
});

UserSchema.virtual('sector', {
  ref: 'SectorHistory',
  localField: '_id',
  foreignField: 'auxiliary',
  justOne: true,
  options: { sort: { startDate: -1 } },
});

UserSchema.virtual('sectorHistories', {
  ref: 'SectorHistory',
  localField: '_id',
  foreignField: 'auxiliary',
  options: { sort: { startDate: -1 } },
});

UserSchema.virtual('blendedCoursesCount', {
  ref: 'Course',
  localField: '_id',
  foreignField: 'trainees',
  count: true,
  options: { match: { format: BLENDED } },
});

UserSchema.virtual('eLearningCoursesCount', {
  ref: 'Course',
  localField: '_id',
  foreignField: 'trainees',
  count: true,
  options: { match: { format: STRICTLY_E_LEARNING } },
});

UserSchema.virtual('activityHistories', {
  ref: 'ActivityHistory',
  localField: '_id',
  foreignField: 'user',
});

UserSchema.virtual('questionnaireHistories', {
  ref: 'QuestionnaireHistory',
  localField: '_id',
  foreignField: 'user',
});

UserSchema.virtual('attendances', {
  ref: 'Attendance',
  localField: '_id',
  foreignField: 'trainee',
});

UserSchema.statics.isActive = isActive;

UserSchema.virtual('isActive').get(setIsActive);
UserSchema.virtual('contractCreationMissingInfo').get(setContractCreationMissingInfo);

UserSchema.pre('validate', validate);
UserSchema.pre('save', save);
UserSchema.pre('findOneAndUpdate', findOneAndUpdate);
UserSchema.pre('updateOne', findOneAndUpdate);
UserSchema.pre('find', validateQuery);
UserSchema.pre('aggregate', validateAggregation);

UserSchema.post('findOne', populateSector);
UserSchema.post('findOneAndUpdate', populateSector);
UserSchema.post('find', populateSectors);
UserSchema.post('findOne', populateCustomers);
UserSchema.post('findOneAndUpdate', populateCustomers);
UserSchema.post('save', formatPayload);

UserSchema.plugin(mongooseLeanVirtuals);
UserSchema.plugin(autopopulate);

module.exports = mongoose.model('User', UserSchema);
module.exports.TOKEN_EXPIRE_TIME = TOKEN_EXPIRE_TIME;
module.exports.ORIGIN_OPTIONS = ORIGIN_OPTIONS;
