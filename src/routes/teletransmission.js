'use-strict';

const Joi = require('joi');
Joi.objectId = require('joi-objectid')(Joi);

const { generateDeliveryXml } = require('../controllers/teletransmissionController');

exports.plugin = {
  name: 'routes-teletransmission',
  register: async (server) => {
    server.route({
      method: 'GET',
      path: '/',
      handler: generateDeliveryXml,
    });
  },
};
