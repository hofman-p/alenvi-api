const Boom = require('@hapi/boom');
const AdministrativeDocumentHelper = require('../helpers/administrativeDocument');
const translate = require('../helpers/translate');

const { language } = translate;

const create = async (req) => {
  try {
    const administrativeDocument = await AdministrativeDocumentHelper.createAdministrativeDocument(
      req.payload,
      req.auth.credentials
    );

    return {
      message: translate[language].administrativeDocumentCreated,
      data: { administrativeDocument },
    };
  } catch (e) {
    req.log('error', e);
    return Boom.isBoom(e) ? e : Boom.badImplementation(e);
  }
};

const list = async (req) => {
  try {
    const administrativeDocuments = await AdministrativeDocumentHelper
      .listAdministrativeDocuments(req.auth.credentials);
    return {
      message: translate[language].administrativeDocumentFound,
      data: { administrativeDocuments },
    };
  } catch (e) {
    req.log('error', e);
    return Boom.isBoom(e) ? e : Boom.badImplementation(e);
  }
};

const remove = async (req) => {
  try {
    const administrativeDocument = await AdministrativeDocumentHelper.removeAdministrativeDocument(req.params._id);

    return {
      message: translate[language].administrativeDocumentRemoved,
      data: { administrativeDocument },
    };
  } catch (e) {
    req.log('error', e);
    return Boom.isBoom(e) ? e : Boom.badImplementation(e);
  }
};

module.exports = {
  create,
  list,
  remove,
};
