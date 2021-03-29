const good = require('./good');
const hapiSentry = require('./hapiSentry');
const hapiAuthJwt2 = require('./hapiAuthJwt2');
const cron = require('./cron');
const billDispatch = require('../jobs/billDispatch');
const eventRepetitions = require('../jobs/eventRepetitions');
const updateRole = require('../jobs/updateRole');
const eventConsistency = require('../jobs/eventConsistency');
const identityVerificationDeletion = require('../jobs/identityVerificationDeletion');

const plugins = [
  {
    plugin: require('@hapi/good'),
    options: { reporters: good.reporters },
  },
  { plugin: hapiAuthJwt2 },
  { plugin: require('@hapi/inert') },
  {
    plugin: cron,
    options: {
      jobs: [
        {
          name: 'billDispatch',
          time: '0 0 5 * * *',
          request: {
            method: 'GET',
            url: '/scripts/bill-dispatch',
            auth: { credentials: { scope: ['scripts:run'] }, strategy: 'jwt' },
          },
          onComplete: billDispatch.onComplete,
          env: 'production',
        },
        {
          name: 'eventRepetitions',
          time: '0 0 4 * * *',
          request: {
            method: 'GET',
            url: '/scripts/events-repetitions',
            auth: { credentials: { scope: ['scripts:run'] }, strategy: 'jwt' },
          },
          onComplete: eventRepetitions.onComplete,
        },
        {
          name: 'roleUpdate',
          time: '0 0 6 1 * *',
          request: {
            method: 'GET',
            url: '/scripts/update-role',
            auth: { credentials: { scope: ['scripts:run'] }, strategy: 'jwt' },
          },
          onComplete: updateRole.onComplete,
        },
        {
          name: 'eventConsistency',
          time: '0 0 3 * * 1',
          request: {
            method: 'GET',
            url: '/scripts/event-consistency',
            auth: { credentials: { scope: ['scripts:run'] }, strategy: 'jwt' },
          },
          onComplete: eventConsistency.onComplete,
        },
        {
          name: 'identityVerificationDeletion',
          time: '0 0 2 * * *',
          request: {
            method: 'GET',
            url: '/scripts/identity-verification-deletion',
            auth: { credentials: { scope: ['scripts:run'] }, strategy: 'jwt' },
          },
          onComplete: identityVerificationDeletion.onComplete,
        },
      ],
    },
  },
];

if (['production', 'staging'].includes(process.env.NODE_ENV)) {
  plugins.push({
    plugin: require('hapi-sentry'),
    options: hapiSentry.options,
  });
}

exports.plugins = plugins;
