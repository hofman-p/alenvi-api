const Boom = require('@hapi/boom');

const versionHelper = require('../helpers/version');
const translate = require('../helpers/translate');

const { language } = translate;

const shouldUpdate = async (req) => {
  try {
    const mustUpdate = await versionHelper.shouldUpdate(req.query);

    return {
      message: mustUpdate ? translate[language].apiVersionUpToDate : translate[language].apiVersionToUpdate,
      data: { mustUpdate },
    };
  } catch (e) {
    req.log('error', e);
    return Boom.isBoom(e) ? e : Boom.badImplementation(e);
  }
};

module.exports = { shouldUpdate };
