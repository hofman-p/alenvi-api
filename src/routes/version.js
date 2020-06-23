'use-strict';

const Joi = require('@hapi/joi');
const { checkUpdate } = require('../controllers/versionController');

exports.plugin = {
  name: 'routes-version',
  register: async (server) => {
    server.route({
      method: 'GET',
      path: '/check-update',
      options: { auth: false, validate: { query: Joi.object({ apiVersion: Joi.string().required() }) } },
      handler: checkUpdate,
    });
  },
};