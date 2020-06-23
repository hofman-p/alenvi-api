const get = require('lodash/get');
const Boom = require('@hapi/boom');
const Sector = require('../models/Sector');
const translate = require('../helpers/translate');

const { language } = translate;

exports.list = async (query, credentials) => {
  const formattedQuery = { ...query, company: get(credentials, 'company._id') };
  if (query.name) query.name = { $regex: new RegExp(`^${query.name}$`), $options: 'i' };

  return Sector.find(formattedQuery).lean();
};

exports.create = async (payload, credentials) => {
  const existingSector = await Sector.countDocuments({ name: payload.name });
  if (existingSector) throw Boom.conflict(translate[language].sectorAlreadyExists);

  const sector = await Sector.create({ ...payload, company: get(credentials, 'company._id') });

  return sector.toObject();
};

exports.update = async (sectorId, payload, credentials) => {
  const existingSector = await Sector.countDocuments({ name: payload.name, company: get(credentials, 'company._id') });
  if (existingSector) throw Boom.conflict(translate[language].sectorAlreadyExists);

  return Sector.findOneAndUpdate({ _id: sectorId }, { $set: payload }, { new: true }).lean();
};

exports.remove = async sectorId => Sector.deleteOne({ _id: sectorId });