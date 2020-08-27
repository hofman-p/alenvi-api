const Boom = require('@hapi/boom');
const CardHelper = require('../helpers/cards');
const translate = require('../helpers/translate');

const { language } = translate;

const update = async (req) => {
  try {
    await CardHelper.updateCard(req.params._id, req.payload);

    return {
      message: translate[language].cardUpdated,
    };
  } catch (e) {
    req.log('error', e);
    return Boom.isBoom(e) ? e : Boom.badImplementation(e);
  }
};

const remove = async (req) => {
  try {
    await CardHelper.removeCard(req.params._id);

    return {
      message: translate[language].cardDeleted,
    };
  } catch (e) {
    req.log('error', e);
    return Boom.isBoom(e) ? e : Boom.badImplementation(e);
  }
};

const uploadMedia = async (req) => {
  try {
    await CardHelper.uploadMedia(req.params._id, req.payload);

    return {
      message: translate[language].cardUpdated,
    };
  } catch (e) {
    req.log('error', e);
    return Boom.isBoom(e) ? e : Boom.badImplementation(e);
  }
};

module.exports = {
  update,
  remove,
  uploadMedia,
};
