const moment = require('moment');
const get = require('lodash/get');
const { ObjectID } = require('mongodb');
const EventHistory = require('../models/EventHistory');
const User = require('../models/User');
const { EVENT_CREATION, EVENT_DELETION, EVENT_UPDATE, INTERNAL_HOUR, ABSENCE } = require('./constants');
const UtilsHelper = require('./utils');
const EventHistoryRepository = require('../repositories/EventHistoryRepository');

exports.getEventHistories = async (query, credentials) => {
  const { createdAt } = query;
  const listQuery = exports.getListQuery(query, credentials);

  return EventHistoryRepository.paginate(listQuery, createdAt);
};

exports.getListQuery = (query, credentials) => {
  const queryCompany = { company: new ObjectID(get(credentials, 'company._id', null)) };
  const andRules = [queryCompany];
  const orRules = [];
  const { sectors, auxiliaries, createdAt } = query;

  if (sectors) orRules.push(...UtilsHelper.formatArrayOrStringQueryParam(sectors, 'sectors'));
  if (auxiliaries) orRules.push(...UtilsHelper.formatArrayOrStringQueryParam(auxiliaries, 'auxiliaries'));
  if (createdAt) andRules.push({ createdAt: { $lte: createdAt } });

  return orRules.length > 0 ? { $and: andRules.concat([{ $or: orRules }]) } : { $and: andRules };
};

exports.createEventHistory = async (payload, credentials, action) => {
  const { _id: createdBy } = credentials;
  const {
    customer,
    startDate,
    endDate,
    type,
    absence,
    internalHour,
    address,
    misc,
    repetition,
  } = payload;

  const eventHistory = {
    company: get(credentials, 'company._id', null),
    createdBy,
    action,
    event: {
      type,
      startDate,
      endDate,
      customer,
      absence,
      internalHour,
      address,
      misc,
      repetition,
    },
  };

  if (payload.auxiliary) eventHistory.auxiliary = [payload.auxiliary];
  if (payload.sector) eventHistory.sector = [payload.sector];
  else {
    const aux = await User.findOne({ _id: payload.auxiliary }).lean();
    eventHistory.sector = [aux.sector];
  }

  await (new EventHistory(eventHistory)).save();
};

exports.createEventHistoryOnCreate = async (payload, credentials) =>
  exports.createEventHistory(payload, credentials, EVENT_CREATION);

exports.createEventHistoryOnDelete = async (payload, credentials) =>
  exports.createEventHistory(payload, credentials, EVENT_DELETION);

const areDaysChanged = (event, payload) => !moment(event.startDate).isSame(payload.startDate, 'day') ||
  !moment(event.endDate).isSame(payload.endDate, 'day');

const isAuxiliaryUpdated = (event, payload) => (!event.auxiliary && payload.auxiliary) ||
  (event.auxiliary && event.auxiliary.toHexString() !== payload.auxiliary);

const areHoursChanged = (event, payload) => {
  const eventStartHour = moment(event.startDate).format('HH:mm');
  const eventEndHour = moment(event.endDate).format('HH:mm');
  const payloadStartHour = moment(payload.startDate).format('HH:mm');
  const payloadEndHour = moment(payload.endDate).format('HH:mm');

  return eventStartHour !== payloadStartHour || eventEndHour !== payloadEndHour;
};

exports.createEventHistoryOnUpdate = async (payload, event, credentials) => {
  const { _id: createdBy } = credentials;
  const { customer, type, repetition } = event;
  const { startDate, endDate, misc } = payload;

  const eventHistory = {
    company: get(credentials, 'company._id', null),
    createdBy,
    action: EVENT_UPDATE,
    event: { type, startDate, endDate, customer, misc },
  };
  if (payload.shouldUpdateRepetition) eventHistory.event.repetition = repetition;
  if (event.type === INTERNAL_HOUR) eventHistory.event.internalHour = payload.internalHour || event.internalHour;
  if (event.type === ABSENCE) eventHistory.event.absence = payload.absence || event.absence;

  const promises = [];
  if (isAuxiliaryUpdated(event, payload)) {
    const auxiliaryUpdateHistory = await exports.formatEventHistoryForAuxiliaryUpdate(eventHistory, payload, event);
    promises.push(new EventHistory(auxiliaryUpdateHistory).save());
  }
  if (areDaysChanged(event, payload)) {
    const datesUpdateHistory = await exports.formatEventHistoryForDatesUpdate(eventHistory, payload, event);
    promises.push(new EventHistory(datesUpdateHistory).save());
  } else if (areHoursChanged(event, payload)) {
    const hoursUpdateHistory = await exports.formatEventHistoryForHoursUpdate(eventHistory, payload, event);
    promises.push(new EventHistory(hoursUpdateHistory).save());
  }
  if (payload.isCancelled && !event.isCancelled) {
    const cancelUpdateHistory = await exports.formatEventHistoryForCancelUpdate(eventHistory, payload, event);
    promises.push(new EventHistory(cancelUpdateHistory).save());
  }

  await Promise.all(promises);
};

exports.formatEventHistoryForAuxiliaryUpdate = async (mainInfo, payload, event) => {
  const auxiliaryUpdateHistory = { ...mainInfo };
  if (event.auxiliary && payload.auxiliary) {
    auxiliaryUpdateHistory.auxiliaries = [event.auxiliary.toHexString(), payload.auxiliary];
    auxiliaryUpdateHistory.update = {
      auxiliary: { from: event.auxiliary.toHexString(), to: payload.auxiliary },
    };
  } else if (event.auxiliary) {
    auxiliaryUpdateHistory.auxiliaries = [event.auxiliary.toHexString()];
    auxiliaryUpdateHistory.update = {
      auxiliary: { from: event.auxiliary.toHexString() },
    };
  } else if (payload.auxiliary) {
    auxiliaryUpdateHistory.auxiliaries = [payload.auxiliary];
    auxiliaryUpdateHistory.update = {
      auxiliary: { to: payload.auxiliary },
    };
  }

  const sectors = [];
  if (!payload.sector && !event.sector) {
    const auxiliaries = await User.find({ _id: { $in: [event.auxiliary, payload.auxiliary] }}).lean();
    for (const aux of auxiliaries) {
      if (!sectors.includes(aux.sector)) sectors.push([aux.sector]);
    }
  } else {
    if (payload.sector) sectors.push(payload.sector.toHexString());
    if (event.sector) sectors.push(event.sector.toHexString());
  }

  return auxiliaryUpdateHistory;
};

const isOneDayEvent = (event, payload) => moment(event.endDate).isSame(event.startDate, 'day') &&
  moment(payload.endDate).isSame(payload.startDate, 'day');

exports.formatEventHistoryForDatesUpdate = async (mainInfo, payload, event) => {
  const datesUpdateHistory = {
    ...mainInfo,
    update: { startDate: { from: event.startDate, to: payload.startDate } },
  };

  if (payload.sector) datesUpdateHistory.sectors = [payload.sector];
  else {
    const aux = await User.findOne({ _id: payload.auxiliary }).lean();
    datesUpdateHistory.sectors = [aux.sector];
    datesUpdateHistory.auxiliaries = [payload.auxiliary];
    datesUpdateHistory.event.auxiliary = payload.auxiliary;
  }

  if (!isOneDayEvent(event, payload)) datesUpdateHistory.update.endDate = { from: event.endDate, to: payload.endDate };

  return datesUpdateHistory;
};

exports.formatEventHistoryForHoursUpdate = async (mainInfo, payload, event) => {
  const hoursUpdateHistory = {
    ...mainInfo,
    update: {
      startHour: { from: event.startDate, to: payload.startDate },
      endHour: { from: event.endDate, to: payload.endDate },
    },
  };

  if (payload.sector) hoursUpdateHistory.sectors = [payload.sector];
  else {
    const aux = await User.findOne({ _id: payload.auxiliary }).lean();
    hoursUpdateHistory.sectors = [aux.sector];
    hoursUpdateHistory.auxiliaries = [payload.auxiliary];
    hoursUpdateHistory.event.auxiliary = payload.auxiliary;
  }

  return hoursUpdateHistory;
};

exports.formatEventHistoryForCancelUpdate = async (mainInfo, payload) => {
  const { cancel } = payload;
  const datesUpdateHistory = { ...mainInfo, update: { cancel } };

  if (payload.sector) datesUpdateHistory.sectors = [payload.sector];
  else {
    const aux = await User.findOne({ _id: payload.auxiliary }).lean();
    datesUpdateHistory.sectors = [aux.sector];
    datesUpdateHistory.auxiliaries = [payload.auxiliary];
    datesUpdateHistory.event.auxiliary = payload.auxiliary;
  }

  return datesUpdateHistory;
};
