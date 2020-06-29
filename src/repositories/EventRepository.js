const { ObjectID } = require('mongodb');
const moment = require('moment');
const omit = require('lodash/omit');
const get = require('lodash/get');
const Event = require('../models/Event');
const UtilsHelper = require('../helpers/utils');
const SectorHistory = require('../models/SectorHistory');
const {
  INTERNAL_HOUR,
  INTERVENTION,
  ABSENCE,
  INVOICED_AND_PAID,
  COMPANY_CONTRACT,
  NOT_INVOICED_AND_NOT_PAID,
  INVOICED_AND_NOT_PAID,
} = require('../helpers/constants');
const { populateReferentHistories } = require('./utils');

const getEventsGroupedBy = async (rules, groupById, companyId) => Event.aggregate([
  { $match: rules },
  {
    $lookup: {
      from: 'users',
      as: 'auxiliary',
      let: { auxiliaryId: '$auxiliary', eventStartDate: '$startDate' },
      pipeline: [
        { $match: { $expr: { $and: [{ $eq: ['$_id', '$$auxiliaryId'] }] } } },
        {
          $lookup: {
            from: 'sectorhistories',
            as: 'sector',
            let: { auxiliaryId: '$_id', companyId: '$company', eventStartDate: '$$eventStartDate' },
            pipeline: [
              {
                $match: {
                  $or: [
                    {
                      endDate: { $exists: true },
                      $expr: {
                        $and: [
                          { $eq: ['$auxiliary', '$$auxiliaryId'] },
                          { $eq: ['$company', '$$companyId'] },
                          { $lte: ['$startDate', '$$eventStartDate'] },
                          { $gte: ['$endDate', '$$eventStartDate'] },
                        ],
                      },
                    },
                    {
                      endDate: { $exists: false },
                      $expr: {
                        $and: [
                          { $eq: ['$auxiliary', '$$auxiliaryId'] },
                          { $eq: ['$company', '$$companyId'] },
                          { $lte: ['$startDate', '$$eventStartDate'] },
                        ],
                      },
                    },
                  ],
                },
              },
              { $limit: 1 },
              { $lookup: { from: 'sectors', as: 'lastSector', foreignField: '_id', localField: 'sector' } },
              { $unwind: { path: '$lastSector' } },
              { $replaceRoot: { newRoot: '$lastSector' } },
            ],
          },
        },
        { $unwind: { path: '$sector' } },
      ],
    },
  },
  { $unwind: { path: '$auxiliary', preserveNullAndEmptyArrays: true } },
  {
    $lookup: {
      from: 'customers',
      localField: 'customer',
      foreignField: '_id',
      as: 'customer',
    },
  },
  { $unwind: { path: '$customer', preserveNullAndEmptyArrays: true } },
  {
    $addFields: {
      subscription: {
        $filter: { input: '$customer.subscriptions', as: 'sub', cond: { $eq: ['$$sub._id', '$subscription'] } },
      },
    },
  },
  { $unwind: { path: '$subscription', preserveNullAndEmptyArrays: true } },
  {
    $lookup: {
      from: 'services',
      localField: 'subscription.service',
      foreignField: '_id',
      as: 'subscription.service',
    },
  },
  { $unwind: { path: '$subscription.service', preserveNullAndEmptyArrays: true } },
  {
    $lookup: {
      from: 'internalhours',
      localField: 'internalHour',
      foreignField: '_id',
      as: 'internalHour',
    },
  },
  { $unwind: { path: '$internalHour', preserveNullAndEmptyArrays: true } },
  {
    $project: {
      _id: 1,
      customer: { _id: 1, identity: 1, contact: 1 },
      auxiliary: {
        _id: 1,
        identity: 1,
        administrative: { driveFolder: 1, transportInvoice: 1 },
        company: 1,
        picture: 1,
        sector: 1,
      },
      type: 1,
      startDate: 1,
      endDate: 1,
      subscription: 1,
      internalHour: 1,
      absence: 1,
      absenceNature: 1,
      address: 1,
      misc: 1,
      attachment: 1,
      repetition: 1,
      isCancelled: 1,
      cancel: 1,
      isBilled: 1,
      bills: 1,
      status: 1,
      sector: 1,
    },
  },
  {
    $group: { _id: groupById, events: { $push: '$$ROOT' } },
  },
]).option({ company: companyId });

exports.getEventsGroupedByAuxiliaries = async (rules, companyId) =>
  getEventsGroupedBy(rules, { $ifNull: ['$auxiliary._id', '$sector'] }, companyId);

exports.getEventsGroupedByCustomers = async (rules, companyId) => getEventsGroupedBy(rules, '$customer._id', companyId);

exports.getEventList = (rules, companyId) => Event.find(rules)
  .populate({
    path: 'auxiliary',
    select: 'identity administrative.driveFolder administrative.transportInvoice company picture sector',
    populate: { path: 'sector', select: '_id sector', match: { company: companyId } },
  })
  .populate({
    path: 'customer',
    select: 'identity subscriptions contact',
    populate: { path: 'subscriptions.service' },
  })
  .populate({ path: 'internalHour' })
  .lean({ autopopulate: true, viruals: true });

exports.getEventsInConflicts = async (dates, auxiliary, types, companyId, eventId = null) => {
  const rules = {
    startDate: { $lt: dates.endDate },
    endDate: { $gt: dates.startDate },
    auxiliary,
    type: { $in: types },
    company: companyId,
  };

  if (eventId) rules._id = { $ne: eventId };

  return Event.find(rules).lean();
};

exports.countAuxiliaryEventsBetweenDates = (filters) => {
  const dateQuery = {};
  if (filters.endDate) dateQuery.startDate = { $lt: filters.endDate };
  if (filters.startDate) dateQuery.endDate = { $gt: filters.startDate };

  const query = { ...dateQuery, ...omit(filters, ['startDate', 'endDate']) };

  return Event.countDocuments(query);
};

exports.getAuxiliaryEventsBetweenDates = async (auxiliary, startDate, endDate, companyId, type = null) => {
  const query = {
    auxiliary,
    startDate: { $lt: endDate },
    endDate: { $gt: startDate },
    company: companyId,
  };
  if (type) query.type = type;
  return Event.find(query);
};

exports.getEvent = async (eventId, credentials) => Event.findOne({ _id: eventId })
  .populate({
    path: 'auxiliary',
    select: 'identity administrative.driveFolder administrative.transportInvoice company',
  })
  .populate({ path: 'customer', select: 'identity subscriptions contact' })
  .populate({ path: 'internalHour', match: { company: get(credentials, 'company._id', null) } })
  .lean();

exports.getWorkingEventsForExport = async (startDate, endDate, companyId) => {
  const rules = [
    { type: { $in: [INTERVENTION, INTERNAL_HOUR] } },
    {
      $or: [
        { startDate: { $lte: endDate, $gte: startDate } },
        { endDate: { $lte: endDate, $gte: startDate } },
        { endDate: { $gte: endDate }, startDate: { $lte: startDate } },
      ],
    },
  ];

  return Event.aggregate([
    { $match: { $and: rules } },
    { $sort: { startDate: -1 } },
    { $lookup: { from: 'customers', localField: 'customer', foreignField: '_id', as: 'customer' } },
    { $unwind: { path: '$customer', preserveNullAndEmptyArrays: true } },
    {
      $addFields: {
        subscription: {
          $filter: { input: '$customer.subscriptions', as: 'sub', cond: { $eq: ['$$sub._id', '$subscription'] } },
        },
      },
    },
    { $unwind: { path: '$subscription', preserveNullAndEmptyArrays: true } },
    {
      $lookup: {
        from: 'services',
        localField: 'subscription.service',
        foreignField: '_id',
        as: 'subscription.service',
      },
    },
    { $unwind: { path: '$subscription.service', preserveNullAndEmptyArrays: true } },
    { $lookup: { from: 'internalhours', localField: 'internalHour', foreignField: '_id', as: 'internalHour' } },
    { $unwind: { path: '$internalHour', preserveNullAndEmptyArrays: true } },
    { $lookup: { from: 'sectors', localField: 'sector', foreignField: '_id', as: 'sector' } },
    { $unwind: { path: '$sector', preserveNullAndEmptyArrays: true } },
    {
      $project: {
        customer: { identity: 1 },
        auxiliary: 1,
        startDate: 1,
        endDate: 1,
        internalHour: 1,
        subscription: 1,
        isCancelled: 1,
        isBilled: 1,
        cancel: 1,
        repetition: 1,
        misc: 1,
        type: 1,
        sector: 1,
      },
    },
  ]).option({ company: companyId });
};

exports.getAbsencesForExport = async (start, end, credentials) => {
  const companyId = get(credentials, 'company._id', null);
  const query = {
    type: ABSENCE,
    startDate: { $lt: end },
    endDate: { $gt: start },
    company: companyId,
  };

  return Event.find(query)
    .sort({ startDate: 'desc' })
    .populate({
      path: 'auxiliary',
      select: 'identity sector',
      populate: { path: 'sector', match: { company: companyId } },
    })
    .lean({ autopopulate: true, virtuals: true });
};

exports.getCustomerSubscriptions = (contract, companyId) => Event.aggregate([
  {
    $match: {
      $and: [
        { startDate: { $gt: new Date(contract.endDate) } },
        { auxiliary: new ObjectID(contract.user._id) },
        { $or: [{ isBilled: false }, { isBilled: { $exists: false } }] },
      ],
    },
  },
  {
    $group: {
      _id: { SUBS: '$subscription', CUSTOMER: '$customer' },
    },
  },
  {
    $lookup: {
      from: 'customers',
      localField: '_id.CUSTOMER',
      foreignField: '_id',
      as: 'customer',
    },
  },
  { $unwind: { path: '$customer' } },
  {
    $addFields: {
      sub: {
        $filter: { input: '$customer.subscriptions', as: 'sub', cond: { $eq: ['$$sub._id', '$_id.SUBS'] } },
      },
    },
  },
  { $unwind: { path: '$sub' } },
  {
    $lookup: {
      from: 'services',
      localField: 'sub.service',
      foreignField: '_id',
      as: 'sub.service',
    },
  },
  { $unwind: { path: '$sub.service' } },
  {
    $project: {
      _id: 0,
      customer: { _id: 1 },
      sub: 1,
    },
  },
]).option({ company: companyId });

exports.getEventsGroupedByParentId = async (rules, companyId) => Event.aggregate([
  { $match: rules },
  {
    $group: {
      _id: { $ifNull: ['$repetition.parentId', null] },
      events: { $addToSet: '$$ROOT' },
    },
  },
  { $unwind: { path: '$events' } },
  { $sort: { 'events.startDate': 1 } },
  {
    $group: { _id: '$_id', events: { $push: '$events' } },
  },
]).option({ company: companyId });

exports.getUnassignedInterventions = async (maxDate, auxiliary, subIds, companyId) =>
  exports.getEventsGroupedByParentId({
    startDate: { $gt: maxDate },
    auxiliary,
    subscription: { $in: subIds },
    $or: [{ isBilled: false }, { isBilled: { $exists: false } }],
  }, companyId);

exports.getEventsExceptInterventions = async (startDate, auxiliary, companyId) => exports.getEventsGroupedByParentId({
  startDate: { $gt: startDate },
  auxiliary,
  subscription: { $exists: false },
}, companyId);

exports.getAbsences = async (auxiliaryId, maxEndDate, companyId) => Event.find({
  type: ABSENCE,
  auxiliary: auxiliaryId,
  startDate: { $lte: maxEndDate },
  endDate: { $gt: maxEndDate },
  company: companyId,
});

exports.getEventsToPay = async (start, end, auxiliaries, companyId) => {
  const rules = [
    { startDate: { $lt: end } },
    { endDate: { $gt: start } },
    {
      $or: [
        {
          status: COMPANY_CONTRACT,
          type: INTERVENTION,
          $or: [{ isCancelled: false }, { 'cancel.condition': INVOICED_AND_PAID }],
        },
        { type: { $in: [INTERNAL_HOUR, ABSENCE] } },
      ],
    },
    { auxiliary: { $in: auxiliaries } },
  ];

  const match = [
    { $match: { $and: rules } },
    { $lookup: { from: 'customers', localField: 'customer', foreignField: '_id', as: 'customer' } },
    { $unwind: { path: '$customer', preserveNullAndEmptyArrays: true } },
    {
      $addFields: {
        subscription: {
          $filter: { input: '$customer.subscriptions', as: 'sub', cond: { $eq: ['$$sub._id', '$$ROOT.subscription'] } },
        },
      },
    },
    { $unwind: { path: '$subscription', preserveNullAndEmptyArrays: true } },
    {
      $lookup: {
        from: 'services',
        localField: 'subscription.service',
        foreignField: '_id',
        as: 'subscription.service',
      },
    },
    { $unwind: { path: '$subscription.service', preserveNullAndEmptyArrays: true } },
    {
      $addFields: {
        hasFixedService: {
          $cond: {
            if: { $and: [{ $eq: ['$type', 'intervention'] }, { $eq: ['$subscription.service.nature', 'fixed'] }] },
            then: true,
            else: false,
          },
        },
      },
    },
  ];

  const group = [
    {
      $group: {
        _id: {
          aux: '$auxiliary',
          year: { $year: '$startDate' },
          month: { $month: '$startDate' },
          week: { $week: '$startDate' },
          day: { $dayOfWeek: '$startDate' },
        },
        eventsPerDay: { $push: { $cond: [{ $in: ['$type', ['internalHour', 'intervention']] }, '$$ROOT', null] } },
        absences: { $push: { $cond: [{ $eq: ['$type', 'absence'] }, '$$ROOT', null] } },
        auxiliary: { $first: '$auxiliary' },
      },
    },
    {
      $project: {
        auxiliary: 1,
        absences: { $filter: { input: '$absences', as: 'event', cond: { $ne: ['$$event', null] } } },
        eventsPerDay: { $filter: { input: '$eventsPerDay', as: 'event', cond: { $ne: ['$$event', null] } } },
      },
    },
    {
      $group: {
        _id: { auxiliary: '$auxiliary' },
        auxiliary: { $first: '$auxiliary' },
        events: { $push: '$eventsPerDay' },
        absences: { $push: '$absences' },
      },
    },
    {
      $project: {
        auxiliary: 1,
        events: 1,
        absences: { $reduce: { input: '$absences', initialValue: [], in: { $setUnion: ['$$value', '$$this'] } } },
      },
    },
  ];

  return Event.aggregate([
    ...match,
    ...group,
  ]).option({ company: companyId });
};

exports.getEventsToBill = async (dates, customerId, companyId) => {
  const rules = [
    { endDate: { $lt: dates.endDate } },
    { $or: [{ isBilled: false }, { isBilled: { $exists: false } }] },
    { auxiliary: { $exists: true, $ne: '' } },
    { type: INTERVENTION },
    { status: COMPANY_CONTRACT },
    { 'cancel.condition': { $not: { $eq: NOT_INVOICED_AND_NOT_PAID } } },
  ];
  if (dates.startDate) rules.push({ startDate: { $gte: dates.startDate } });
  if (customerId) rules.push({ customer: new ObjectID(customerId) });

  return Event.aggregate([
    { $match: { $and: rules } },
    { $lookup: { from: 'contracts', as: 'contracts', localField: 'auxiliary', foreignField: 'user' } },
    {
      $addFields: {
        contract: {
          $filter: {
            input: '$contracts',
            as: 'c',
            cond: {
              $and: [
                { $lte: ['$$c.startDate', '$startDate'] },
                { $gte: [{ $ifNull: ['$$c.endDate', dates.endDate] }, '$startDate'] },
                { $eq: ['$$c.status', COMPANY_CONTRACT] },
              ],
            },
          },
        },
      },
    },
    { $unwind: { path: '$contract' } },
    {
      $group: {
        _id: { SUBS: '$subscription', CUSTOMER: '$customer' },
        count: { $sum: 1 },
        events: { $push: '$$ROOT' },
      },
    },
    { $lookup: { from: 'customers', localField: '_id.CUSTOMER', foreignField: '_id', as: 'customer' } },
    { $unwind: { path: '$customer' } },
    {
      $addFields: {
        sub: {
          $filter: { input: '$customer.subscriptions', as: 'sub', cond: { $eq: ['$$sub._id', '$_id.SUBS'] } },
        },
      },
    },
    { $unwind: { path: '$sub' } },
    { $lookup: { from: 'services', localField: 'sub.service', foreignField: '_id', as: 'sub.service' } },
    { $unwind: { path: '$sub.service' } },
    {
      $addFields: {
        fund: {
          $filter: { input: '$customer.fundings', as: 'fund', cond: { $eq: ['$$fund.subscription', '$_id.SUBS'] } },
        },
      },
    },
    {
      $project: {
        idCustomer: '$_id.CUSTOMER',
        subId: '$_id.SUBS',
        events: { startDate: 1, subscription: 1, endDate: 1, auxiliary: 1, _id: 1 },
        customer: 1,
        sub: 1,
        fund: 1,
      },
    },
    {
      $group: {
        _id: '$idCustomer',
        customer: { $addToSet: '$customer' },
        eventsBySubscriptions: {
          $push: { subscription: '$sub', eventsNumber: { $size: '$events' }, events: '$events', fundings: '$fund' },
        },
      },
    },
    { $unwind: { path: '$customer' } },
    {
      $project: {
        _id: 0,
        customer: { _id: 1, identity: 1, driveFolder: 1 },
        eventsBySubscriptions: 1,
      },
    },
    { $sort: { 'customer.identity.lastname': 1 } },
  ]).option({ company: companyId });
};

exports.getCustomersFromEvent = async (query, companyId) => SectorHistory.aggregate([
  {
    $match: {
      sector: { $in: UtilsHelper.formatObjectIdsArray(query.sector) },
      startDate: { $lte: query.endDate },
      $or: [{ endDate: { $exists: false } }, { endDate: { $gte: query.startDate } }],
    },
  },
  { $lookup: { from: 'users', as: 'auxiliary', localField: 'auxiliary', foreignField: '_id' } },
  { $unwind: { path: '$auxiliary' } },
  {
    $lookup: {
      from: 'events',
      as: 'event',
      let: {
        auxiliaryId: '$auxiliary._id',
        startDate: { $max: ['$startDate', query.startDate] },
        endDate: { $max: ['$endDate', { $ifNull: ['$endDate', query.endDate] }] },
      },
      pipeline: [
        {
          $match: {
            type: INTERVENTION,
            $expr: {
              $and: [
                { $eq: ['$auxiliary', '$$auxiliaryId'] },
                { $gt: ['$endDate', '$$startDate'] },
                { $lt: ['$startDate', '$$endDate'] },
              ],
            },
          },
        },
      ],
    },
  },
  { $unwind: '$event' },
  { $replaceRoot: { newRoot: '$event' } },
  { $lookup: { from: 'customers', as: 'customer', foreignField: '_id', localField: 'customer' } },
  { $unwind: { path: '$customer', preserveNullAndEmptyArrays: true } },
  { $group: { _id: '$customer._id', customer: { $first: '$customer' } } },
  { $replaceRoot: { newRoot: '$customer' } },
  ...populateReferentHistories,
  { $project: { subscriptions: 1, identity: 1, contact: 1, referentHistories: 1 } },
  { $unwind: '$subscriptions' },
  {
    $lookup: {
      from: 'services',
      localField: 'subscriptions.service',
      foreignField: '_id',
      as: 'subscriptions.service',
    },
  },
  { $unwind: { path: '$subscriptions.service', preserveNullAndEmptyArrays: true } },
  {
    $addFields: {
      'subscriptions.service.version': {
        $arrayElemAt: [
          '$subscriptions.service.versions',
          {
            $indexOfArray: [
              '$subscriptions.service.versions.startDate',
              { $max: '$subscriptions.service.versions.startDate' },
            ],
          },
        ],
      },
    },
  },
  {
    $lookup: {
      from: 'surcharges',
      localField: 'subscriptions.service.version.surcharge',
      foreignField: '_id',
      as: 'subscriptions.service.version.surcharge',
    },
  },
  { $unwind: { path: '$subscriptions.service.version.surcharge', preserveNullAndEmptyArrays: true } },
  { $addFields: { 'subscriptions.service.exemptFromCharges': '$subscriptions.service.version.exemptFromCharges' } },
  { $addFields: { 'subscriptions.service.name': '$subscriptions.service.version.name' } },
  { $addFields: { 'subscriptions.service.startDate': '$subscriptions.service.version.startDate' } },
  { $addFields: { 'subscriptions.service.defaultUnitAmount': '$subscriptions.service.version.defaultUnitAmount' } },
  { $addFields: { 'subscriptions.service.vat': '$subscriptions.service.version.vat' } },
  { $addFields: { 'subscriptions.service.surcharge': '$subscriptions.service.version.surcharge' } },
  { $project: { 'subscriptions.service.versions': 0, 'subscriptions.service.version': 0 } },
  { $group: { _id: '$_id', customer: { $first: '$$ROOT' }, subscriptions: { $push: '$subscriptions' } } },
  { $addFields: { 'customer.subscriptions': '$subscriptions' } },
  { $replaceRoot: { newRoot: '$customer' } },
]).option({ company: companyId });

exports.getCustomersWithBilledEvents = async (query, companyId) => Event.aggregate([
  { $match: query },
  { $group: { _id: { SUBS: '$subscription', CUSTOMER: '$customer', TPP: '$bills.thirdPartyPayer' } } },
  {
    $lookup: {
      from: 'customers',
      as: 'customer',
      let: { customerId: '$_id.CUSTOMER' },
      pipeline: [{
        $match: {
          $expr: { $and: [{ $eq: ['$_id', '$$customerId'] }] },
        },
      }],
    },
  },
  { $unwind: { path: '$customer' } },
  { $lookup: { from: 'thirdpartypayers', localField: '_id.TPP', foreignField: '_id', as: 'thirdPartyPayer' } },
  { $unwind: { path: '$thirdPartyPayer', preserveNullAndEmptyArrays: true } },
  {
    $addFields: {
      sub: { $filter: { input: '$customer.subscriptions', as: 'sub', cond: { $eq: ['$$sub._id', '$_id.SUBS'] } } },
    },
  },
  { $unwind: { path: '$sub' } },
  { $lookup: { from: 'services', localField: 'sub.service', foreignField: '_id', as: 'sub.service' } },
  { $unwind: { path: '$sub.service' } },
  {
    $addFields: {
      'sub.service.version': {
        $arrayElemAt: [
          '$sub.service.versions',
          { $indexOfArray: ['$sub.service.versions.startDate', { $max: '$sub.service.versions.startDate' }] },
        ],
      },
    },
  },
  {
    $lookup: {
      from: 'surcharges',
      localField: 'sub.service.version.surcharge',
      foreignField: '_id',
      as: 'sub.service.version.surcharge',
    },
  },
  { $unwind: { path: '$sub.service.version.surcharge', preserveNullAndEmptyArrays: true } },
  { $addFields: { 'sub.service.exemptFromCharges': '$sub.service.version.exemptFromCharges' } },
  { $addFields: { 'sub.service.name': '$sub.service.version.name' } },
  { $addFields: { 'sub.service.startDate': '$sub.service.version.startDate' } },
  { $addFields: { 'sub.service.defaultUnitAmount': '$sub.service.version.defaultUnitAmount' } },
  { $addFields: { 'sub.service.vat': '$sub.service.version.vat' } },
  { $addFields: { 'sub.service.surcharge': '$sub.service.version.surcharge' } },
  { $project: { 'sub.service.versions': 0, 'sub.service.version': 0 } },
  {
    $group: {
      _id: { CUS: '$customer' },
      subscriptions: { $addToSet: '$sub' },
      thirdPartyPayers: { $addToSet: '$thirdPartyPayer' },
    },
  },
  {
    $project: {
      _id: '$_id.CUS._id',
      subscriptions: 1,
      identity: '$_id.CUS.identity',
      thirdPartyPayers: 1,
    },
  },
]).option({ company: companyId });

exports.getCustomersWithIntervention = async companyId => Event.aggregate([
  { $match: { type: INTERVENTION, $or: [{ isBilled: false }, { isBilled: { $exists: false } }] } },
  { $group: { _id: { customer: '$customer' } } },
  { $lookup: { from: 'customers', localField: '_id.customer', foreignField: '_id', as: 'customer' } },
  { $unwind: { path: '$customer' } },
  { $replaceRoot: { newRoot: '$customer' } },
  { $project: { _id: 1, identity: { firstname: 1, lastname: 1 } } },
]).option({ company: companyId });

exports.getTaxCertificateInterventions = async (taxCertificate, companyId) => {
  const startDate = moment(taxCertificate.year, 'YYYY').startOf('year').toDate();
  const endDate = moment(taxCertificate.year, 'YYYY').endOf('year').toDate();
  const { _id: customerId, subscriptions } = taxCertificate.customer;

  return Event.aggregate([
    {
      $match: {
        customer: customerId,
        startDate: { $lt: endDate },
        endDate: { $gte: startDate },
        $or: [{ isCancelled: false }, { 'cancel.condition': { $in: [INVOICED_AND_PAID, INVOICED_AND_NOT_PAID] } }],
      },
    },
    { $addFields: { duration: { $divide: [{ $subtract: ['$endDate', '$startDate'] }, 1000 * 60 * 60] } } },
    {
      $group: {
        _id: {
          auxiliary: '$auxiliary',
          month: { $month: '$startDate' },
          sub: '$subscription',
        },
        duration: { $sum: '$duration' },
      },
    },
    { $lookup: { from: 'users', as: 'auxiliary', localField: '_id.auxiliary', foreignField: '_id' } },
    { $unwind: '$auxiliary' },
    {
      $addFields: {
        subscription: { $filter: { input: subscriptions, as: 'sub', cond: { $eq: ['$$sub._id', '$_id.sub'] } } },
      },
    },
    { $unwind: '$subscription' },
    {
      $project: {
        auxiliary: { _id: 1, identity: 1, createdAt: 1 },
        month: '$_id.month',
        subscription: 1,
        duration: 1,
      },
    },
    { $sort: { month: 1 } },
  ]).option({ company: companyId });
};

exports.getPaidTransportStatsBySector = async (sectors, month, companyId) => {
  const minStartDate = moment(month, 'MMYYYY').startOf('month').toDate();
  const maxStartDate = moment(month, 'MMYYYY').endOf('month').toDate();

  const sectorAuxiliaries = [
    {
      $match: {
        sector: { $in: sectors },
        startDate: { $lte: maxStartDate },
        $or: [{ endDate: { $gte: minStartDate } }, { endDate: { $exists: false } }],
      },
    },
    { $lookup: { from: 'users', localField: 'auxiliary', foreignField: '_id', as: 'auxiliary' } },
    { $unwind: { path: '$auxiliary' } },
    { $addFields: { 'auxiliary.sector': { _id: '$sector', startDate: '$startDate', endDate: '$endDate' } } },
    { $replaceRoot: { newRoot: '$auxiliary' } },
  ];

  const auxiliariesEvents = [
    {
      $lookup: {
        from: 'events',
        as: 'events',
        let: {
          auxiliaryId: '$_id',
          startDate: { $max: ['$sector.startDate', minStartDate] },
          endDate: { $min: [{ $ifNull: ['$sector.endDate', maxStartDate] }, maxStartDate] },
        },
        pipeline: [
          {
            $match: {
              type: { $in: [INTERVENTION, INTERNAL_HOUR] },
              $or: [{ isCancelled: false }, { 'cancel.condition': INVOICED_AND_PAID }],
              $expr: {
                $and: [
                  { $eq: ['$auxiliary', '$$auxiliaryId'] },
                  { $gt: ['$endDate', '$$startDate'] },
                  { $lt: ['$startDate', '$$endDate'] },
                ],
              },
            },
          },
        ],
      },
    },
    { $unwind: { path: '$events' } },
  ];

  const formatAndGroup = [
    { $addFields: { 'events.auxiliary.administrative.transportInvoice': '$administrative.transportInvoice' } },
    {
      $group: {
        _id: {
          date: { $dateToString: { format: '%Y-%m-%d', date: '$events.startDate' } },
          auxiliary: '$_id',
          sector: '$sector._id',
        },
        events: { $push: '$events' },
      },
    },
    {
      $group: {
        _id: { sector: '$_id.sector', auxiliary: '$_id.auxiliary' },
        days: { $push: '$$ROOT' },
      },
    },
    { $group: { _id: '$_id.sector', auxiliaries: { $push: '$$ROOT' } } },
  ];

  return SectorHistory.aggregate([
    ...sectorAuxiliaries,
    ...auxiliariesEvents,
    ...formatAndGroup,
  ]).option({ company: companyId });
};

exports.getUnassignedHoursBySector = async (sectors, month, companyId) => {
  const minStartDate = moment(month, 'MMYYYY').startOf('month').toDate();
  const maxStartDate = moment(month, 'MMYYYY').endOf('month').toDate();

  return Event.aggregate([
    {
      $match: {
        sector: { $in: sectors },
        startDate: { $gte: minStartDate, $lt: maxStartDate },
        auxiliary: { $exists: false },
        isCancelled: false,
        type: INTERVENTION,
      },
    },
    { $addFields: { duration: { $divide: [{ $subtract: ['$endDate', '$startDate'] }, 60 * 60 * 1000] } } },
    { $group: { _id: { sector: '$sector' }, duration: { $sum: '$duration' } } },
    { $project: { sector: '$_id.sector', duration: 1, _id: 0 } },
  ]).option({ company: companyId });
};
