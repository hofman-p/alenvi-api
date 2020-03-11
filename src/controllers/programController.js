const Boom = require('@hapi/boom');
const ProgramHelper = require('../helpers/programs');
const translate = require('../helpers/translate');

const { language } = translate;

const list = async (req) => {
  try {
    const programs = await ProgramHelper.list(req.query);

    return {
      message: programs.length ? translate[language].programsFound : translate[language].programsNotFound,
      data: { programs },
    };
  } catch (e) {
    req.log('error', e);
    return Boom.isBoom(e) ? e : Boom.badImplementation(e);
  }
};

const create = async (req) => {
  try {
    const program = await ProgramHelper.createProgram(req.payload);

    return {
      message: translate[language].programCreated,
      data: { program },
    };
  } catch (e) {
    req.log('error', e);
    return Boom.isBoom(e) ? e : Boom.badImplementation(e);
  }
};

const getById = async (req) => {
  try {
    const program = await ProgramHelper.getProgram(req.params._id);

    return {
      message: translate[language].programFound,
      data: { program },
    };
  } catch (e) {
    req.log('error', e);
    return Boom.isBoom(e) ? e : Boom.badImplementation(e);
  }
};

const update = async (req) => {
  try {
    const program = await ProgramHelper.updateProgram(req.params._id, req.payload);

    return {
      message: translate[language].programUpdated,
      data: { program },
    };
  } catch (e) {
    req.log('error', e);
    return Boom.isBoom(e) ? e : Boom.badImplementation(e);
  }
};

module.exports = {
  list,
  create,
  getById,
  update,
};