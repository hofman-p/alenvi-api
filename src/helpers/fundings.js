const Boom = require('@hapi/boom');
const moment = require('moment');
const has = require('lodash/has');
const omit = require('lodash/omit');
const Customer = require('../models/Customer');
const { populateService } = require('./subscriptions');
const UtilsHelper = require('./utils');
const translate = require('./translate');

const { language } = translate;

exports.checkSubscriptionFunding = async (customerId, checkedFunding) => {
  const customer = await Customer.findOne({ _id: customerId }).lean();
  if (!customer) throw Boom.notFound('Error while checking subscription funding: customer not found.');

  if (!customer.fundings || customer.fundings.length === 0) return true;

  /* We allow two fundings to have the same subscription only if :
  *     - the 2 fundings are not on the same period
  *     - or the 2 fundings are on the same period but not the same days
  */
  return customer.fundings
    .filter(fund => UtilsHelper.areObjectIdsEquals(checkedFunding.subscription, fund.subscription) &&
      !UtilsHelper.areObjectIdsEquals(checkedFunding._id, fund._id))
    .every((fund) => {
      const lastVersion = UtilsHelper.getLastVersion(fund.versions, 'createdAt');

      const checkedFundingIsAfter = !!lastVersion.endDate &&
        moment(checkedFunding.versions[0].startDate).isAfter(lastVersion.endDate, 'day');
      const noCareDaysInCommon = checkedFunding.versions[0].careDays.every(day => !lastVersion.careDays.includes(day));
      const checkedFundingIsBefore = !!checkedFunding.versions[0].endDate &&
        moment(checkedFunding.versions[0].endDate).isBefore(lastVersion.startDate, 'day');

      return checkedFundingIsAfter || checkedFundingIsBefore || noCareDaysInCommon;
    });
};

exports.populateFundingsList = (customer) => {
  if (!customer.fundings) return customer;

  return {
    ...customer,
    fundings: customer.fundings.map(fund => exports.populateFunding(fund, customer.subscriptions)),
  };
};

exports.populateFunding = (funding, subscriptions) => {
  if (!funding) return false;

  const sub = subscriptions.find(sb => UtilsHelper.areObjectIdsEquals(sb._id, funding.subscription));
  if (has(sub, 'service.versions')) {
    return { ...funding, subscription: { ...sub, service: populateService(sub.service) } };
  }

  return { ...funding, subscription: { ...sub } };
};

exports.createFunding = async (customerId, payload) => {
  const check = await exports.checkSubscriptionFunding(customerId, payload);
  if (!check) throw Boom.conflict(translate[language].customerFundingConflict);

  const customer = await Customer.findOneAndUpdate(
    { _id: customerId },
    { $push: { fundings: payload } },
    { new: true, select: { identity: 1, fundings: 1, subscriptions: 1 }, autopopulate: false }
  )
    .populate({ path: 'subscriptions.service' })
    .populate({ path: 'fundings.thirdPartyPayer' })
    .lean();

  return exports.populateFundingsList(customer);
};

exports.updateFunding = async (customerId, fundingId, payload) => {
  const checkFundingPayload = {
    _id: fundingId,
    subscription: payload.subscription,
    versions: [omit(payload, 'fundingPlanId')],
  };
  const check = await exports.checkSubscriptionFunding(customerId, checkFundingPayload);
  if (!check) return Boom.conflict(translate[language].customerFundingConflict);

  const query = payload.fundingPlanId
    ? {
      $set: { 'fundings.$.fundingPlanId': payload.fundingPlanId },
      $push: { 'fundings.$.versions': omit(payload, 'fundingPlanId') },
    }
    : { $push: { 'fundings.$.versions': payload } };
  const customer = await Customer.findOneAndUpdate(
    { _id: customerId, 'fundings._id': fundingId },
    query,
    { new: true, select: { identity: 1, fundings: 1, subscriptions: 1 }, autopopulate: false }
  )
    .populate({ path: 'subscriptions.service' })
    .populate({ path: 'fundings.thirdPartyPayer' })
    .lean();

  return exports.populateFundingsList(customer);
};

exports.deleteFunding = async (customerId, fundingId) => Customer.updateOne(
  { _id: customerId },
  { $pull: { fundings: { _id: fundingId } } }
);

exports.getFundingEvents = (funding, events) => events.filter(ev =>
  UtilsHelper.areObjectIdsEquals(ev.subscription, funding.subscription) &&
    funding.careDays.includes(new Date(ev.startDate).getDay()));

exports.getMatchingFunding = (eventDate, fundings) => {
  const filteredByDateFundings = fundings.filter(fund => moment(fund.startDate).isSameOrBefore(eventDate) &&
    (!fund.endDate || moment(fund.endDate).isAfter(eventDate)));

  if (moment(eventDate).startOf('d').isHoliday()) {
    return filteredByDateFundings.find(funding => funding.careDays.includes(7)) || null;
  }

  return filteredByDateFundings.find(funding => funding.careDays.includes(moment(eventDate).isoWeekday() - 1)) || null;
};
