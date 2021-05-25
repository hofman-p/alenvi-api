const get = require('lodash/get');
const moment = require('../extensions/moment');
const Surcharge = require('../models/Surcharge');

exports.list = async credentials => Surcharge.find({ company: get(credentials, 'company._id') }).lean();

exports.create = async (payload, credentials) =>
  Surcharge.create({ ...payload, company: get(credentials, 'company._id') });

exports.update = async (surcharge, payload) => Surcharge.updateOne({ _id: surcharge._id }, { $set: payload });

exports.delete = async surcharge => Surcharge.deleteOne({ _id: surcharge._id });

exports.getCustomSurcharge = (eventStart, eventEnd, surchargeStart, surchargeEnd, percentage) => {
  if (!percentage || percentage <= 0) return null;

  const formattedStart = moment(eventStart)
    .hour(surchargeStart.substring(0, 2))
    .minute(surchargeStart.substring(3))
    .toISOString();
  let formattedEnd = moment(eventStart)
    .hour(surchargeEnd.substring(0, 2))
    .minute(surchargeEnd.substring(3))
    .toISOString();

  if (moment(formattedStart).isAfter(formattedEnd)) formattedEnd = moment(formattedEnd).add(1, 'd').toISOString();

  const eventRange = moment.range(eventStart, eventEnd);
  const surchargeRange = moment.range(formattedStart, formattedEnd);

  const intersection = eventRange.intersect(surchargeRange);
  if (!intersection) return null;

  return {
    percentage,
    startHour: intersection.start.toDate(),
    endHour: intersection.end.toDate(),
  };
};

const surchargeConditions = [
  { key: 'twentyFifthOfDecember', condition: start => start.format('DD/MM') === '25/12', name: '25 Décembre' },
  { key: 'firstOfMay', condition: start => start.format('DD/MM') === '01/05', name: '1er Mai' },
  { key: 'firstOfJanuary', condition: start => start.format('DD/MM') === '01/01', name: '1er Janvier' },
  { key: 'publicHoliday', condition: start => moment(start).startOf('d').isHoliday(), name: 'Jour férié' },
  { key: 'saturday', condition: start => start.isoWeekday() === 6, name: 'Samedi' },
  { key: 'sunday', condition: start => start.isoWeekday() === 7, name: 'Dimanche' },
];

exports.getEventSurcharges = (event, surcharge) => {
  const start = moment(event.startDate);

  for (const surchargeCondition of surchargeConditions) {
    const percentage = surcharge[surchargeCondition.key];
    if (percentage && percentage > 0 && surchargeCondition.condition(start)) {
      return [{ percentage, name: surchargeCondition.name }];
    }
  }

  const { evening, eveningEndTime, eveningStartTime, custom, customStartTime, customEndTime } = surcharge;
  const end = moment(event.endDate);
  const surcharges = [];
  const eveningSurcharge = exports.getCustomSurcharge(start, end, eveningStartTime, eveningEndTime, evening);
  if (eveningSurcharge) surcharges.push({ ...eveningSurcharge, name: 'Soirée' });
  const customSurcharge = exports.getCustomSurcharge(start, end, customStartTime, customEndTime, custom);
  if (customSurcharge) surcharges.push({ ...customSurcharge, name: 'Personalisée' });

  return surcharges;
};
