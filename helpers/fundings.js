const Boom = require('boom');
const moment = require('moment');

const Customer = require('../models/Customer');
const { getLastVersion } = require('./utils');
const { populateServices } = require('./subscriptions');

const checkSubscriptionFunding = async (customerId, checkedFunding) => {
  const customer = await Customer.findById(customerId).lean();
  if (!customer) return Boom.notFound('Error while checking subscription funding: customer not found.');

  if (!customer.fundings || customer.fundings.length === 0) return true;

  return customer.fundings
    .filter(fund => fund.services.some(ser => checkedFunding.services.includes(ser._id.toHexString())) &&
      checkedFunding._id !== fund._id.toHexString())
    .every((fund) => {
      const lastVersion = getLastVersion(fund.versions, 'createdAt');
      /** We allow two fundings to have the same subscription only if :
       * - the 2 fundings are not on the same period
       * - or the 2 fundings are on the same period but not the same days
       */
      return (!!lastVersion.endDate && moment(lastVersion.endDate).isBefore(checkedFunding.versions[0].startDate, 'day')) ||
        checkedFunding.versions[0].careDays.every(day => !lastVersion.careDays.includes(day));
    });
};

const populateFundings = async (funding) => {
  if (!funding) return false;

  for (let i = 0, l = funding.services.length; i < l; i++) {
    funding.services[i] = await populateServices(funding.services[i]);
  }
  return funding;
};

module.exports = {
  checkSubscriptionFunding,
  populateFundings
};
