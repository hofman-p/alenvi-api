const moment = require('moment');
const get = require('lodash/get');
const pick = require('lodash/pick');
const {
  NEVER,
  EVENT_TYPE_LIST,
  REPETITION_FREQUENCY_TYPE_LIST,
  CANCELLATION_CONDITION_LIST,
  CANCELLATION_REASON_LIST,
  ABSENCE_TYPE_LIST,
  ABSENCE_NATURE_LIST,
  HOURLY,
  CIVILITY_LIST,
  END_CONTRACT_REASONS,
  SURCHARGES,
  PAYMENT_NATURE_LIST,
  PAYMENT_TYPES_LIST,
} = require('./constants');
const UtilsHelper = require('./utils');
const Bill = require('../models/Bill');
const CreditNote = require('../models/CreditNote');
const Contract = require('../models/Contract');
const Pay = require('../models/Pay');
const Payment = require('../models/Payment');
const FinalPay = require('../models/FinalPay');
const EventRepository = require('../repositories/EventRepository');

const workingEventExportHeader = [
  'Type',
  'Heure interne',
  'Service',
  'Début',
  'Fin',
  'Durée',
  'Répétition',
  'Équipe',
  'Auxiliaire - Titre',
  'Auxiliaire - Prénom',
  'Auxiliaire - Nom',
  'A affecter',
  'Bénéficiaire - Titre',
  'Bénéficiaire - Nom',
  'Bénéficiaire - Prénom',
  'Divers',
  'Facturé',
  'Annulé',
  "Statut de l'annulation",
  "Raison de l'annulation",
];

const getServiceName = (service) => {
  if (!service) return;

  const lastVersion = UtilsHelper.getLastVersion(service.versions, 'startDate');

  return lastVersion.name;
};

exports.exportWorkingEventsHistory = async (startDate, endDate, credentials) => {
  const companyId = get(credentials, 'company._id');
  const events = await EventRepository.getWorkingEventsForExport(startDate, endDate, companyId);

  const rows = [workingEventExportHeader];
  for (const event of events) {
    let repetition = get(event.repetition, 'frequency');
    repetition = NEVER === repetition ? '' : REPETITION_FREQUENCY_TYPE_LIST[repetition];

    const cells = [
      EVENT_TYPE_LIST[event.type],
      get(event, 'internalHour.name', ''),
      event.subscription ? getServiceName(event.subscription.service) : '',
      moment(event.startDate).format('DD/MM/YYYY HH:mm'),
      moment(event.endDate).format('DD/MM/YYYY HH:mm'),
      UtilsHelper.formatFloatForExport(moment(event.endDate).diff(event.startDate, 'h', true)),
      repetition || '',
      get(event, 'sector.name') || get(event, 'auxiliary.sector.name') || '',
      CIVILITY_LIST[get(event, 'auxiliary.identity.title')] || '',
      get(event, 'auxiliary.identity.firstname', ''),
      get(event, 'auxiliary.identity.lastname', '').toUpperCase(),
      event.auxiliary ? 'Non' : 'Oui',
      CIVILITY_LIST[get(event, 'customer.identity.title')] || '',
      get(event, 'customer.identity.lastname', '').toUpperCase(),
      get(event, 'customer.identity.firstname', ''),
      event.misc || '',
      event.isBilled ? 'Oui' : 'Non',
      event.isCancelled ? 'Oui' : 'Non',
      CANCELLATION_CONDITION_LIST[get(event, 'cancel.condition')] || '',
      CANCELLATION_REASON_LIST[get(event, 'cancel.reason')] || '',
    ];

    rows.push(cells);
  }

  return rows;
};

const absenceExportHeader = [
  'Type',
  'Nature',
  'Début',
  'Fin',
  'Équipe',
  'Auxiliaire - Titre',
  'Auxiliaire - Prénom',
  'Auxiliaire - Nom',
  'Divers',
];

exports.exportAbsencesHistory = async (startDate, endDate, credentials) => {
  const events = await EventRepository.getAbsencesForExport(startDate, endDate, credentials);

  const rows = [absenceExportHeader];
  for (const event of events) {
    const datetimeFormat = event.absenceNature === HOURLY ? 'DD/MM/YYYY HH:mm' : 'DD/MM/YYYY';
    const cells = [
      ABSENCE_TYPE_LIST[event.absence],
      ABSENCE_NATURE_LIST[event.absenceNature],
      moment(event.startDate).format(datetimeFormat),
      moment(event.endDate).format(datetimeFormat),
      get(event, 'auxiliary.sector.name') || '',
      CIVILITY_LIST[get(event, 'auxiliary.identity.title')] || '',
      get(event, 'auxiliary.identity.firstname', ''),
      get(event, 'auxiliary.identity.lastname', '').toUpperCase(),
      event.misc || '',
    ];

    rows.push(cells);
  }

  return rows;
};

const billAndCreditNoteExportHeader = [
  'Nature',
  'Identifiant',
  'Date',
  'Id Bénéficiaire',
  'Titre',
  'Nom',
  'Prénom',
  'Id tiers payeur',
  'Tiers payeur',
  'Montant HT en €',
  'Montant TTC en €',
  'Nombre d\'heures',
  'Services',
  'Date de création',
];

const exportBillSubscriptions = (bill) => {
  if (!bill.subscriptions) return '';

  const subscriptions = bill.subscriptions.map(sub =>
    `${sub.service.name} - ${UtilsHelper.formatHour(sub.hours)} - ${UtilsHelper.formatPrice(sub.inclTaxes)} TTC`);

  return subscriptions.join('\r\n');
};

const formatRowCommonsForExport = (document) => {
  const customerId = get(document.customer, '_id');
  const customerIdentity = get(document, 'customer.identity') || {};

  const cells = [
    document.number || '',
    document.date ? moment(document.date).format('DD/MM/YYYY') : '',
    customerId ? customerId.toHexString() : '',
    CIVILITY_LIST[customerIdentity.title] || '',
    (customerIdentity.lastname || '').toUpperCase(),
    customerIdentity.firstname || '',
  ];

  return cells;
};

const formatBillsForExport = (bills) => {
  const rows = [];

  for (const bill of bills) {
    const tppId = get(bill.thirdPartyPayer, '_id');
    let totalExclTaxesFormatted = '';
    let hours = 0;

    if (bill.subscriptions) {
      let totalExclTaxes = 0;
      for (const sub of bill.subscriptions) {
        totalExclTaxes += sub.exclTaxes;
        hours += sub.hours;
      }
      totalExclTaxesFormatted = UtilsHelper.formatFloatForExport(totalExclTaxes);
    }

    const createdAt = get(bill, 'createdAt', null);
    const cells = [
      'Facture',
      ...formatRowCommonsForExport(bill),
      tppId ? tppId.toHexString() : '',
      get(bill.thirdPartyPayer, 'name') || '',
      totalExclTaxesFormatted,
      UtilsHelper.formatFloatForExport(bill.netInclTaxes),
      UtilsHelper.formatFloatForExport(hours),
      exportBillSubscriptions(bill),
      createdAt ? moment(createdAt).format('DD/MM/YYYY') : '',
    ];

    rows.push(cells);
  }

  return rows;
};

const formatCreditNotesForExport = (creditNotes) => {
  const rows = [];

  for (const creditNote of creditNotes) {
    const totalExclTaxes = (creditNote.exclTaxesCustomer || 0) + (creditNote.exclTaxesTpp || 0);
    const totalInclTaxes = (creditNote.inclTaxesCustomer || 0) + (creditNote.inclTaxesTpp || 0);
    const tppId = get(creditNote.thirdPartyPayer, '_id');

    const createdAt = get(creditNote, 'createdAt', null);
    const cells = [
      'Avoir',
      ...formatRowCommonsForExport(creditNote),
      tppId ? tppId.toHexString() : '',
      get(creditNote.thirdPartyPayer, 'name') || '',
      UtilsHelper.formatFloatForExport(totalExclTaxes),
      UtilsHelper.formatFloatForExport(totalInclTaxes),
      '',
      get(creditNote, 'subscription.service.name') || '',
      createdAt ? moment(createdAt).format('DD/MM/YYYY') : '',
    ];

    rows.push(cells);
  }

  return rows;
};

exports.exportBillsAndCreditNotesHistory = async (startDate, endDate, credentials) => {
  const query = {
    date: { $lte: endDate, $gte: startDate },
    company: get(credentials, 'company._id', null),
  };

  const bills = await Bill.find(query)
    .sort({ date: 'desc' })
    .populate({ path: 'customer', select: 'identity' })
    .populate('thirdPartyPayer')
    .lean();

  const creditNotes = await CreditNote.find(query)
    .sort({ date: 'desc' })
    .populate({ path: 'customer', select: 'identity' })
    .populate('thirdPartyPayer')
    .lean();

  const rows = [billAndCreditNoteExportHeader];

  rows.push(...formatBillsForExport(bills));
  rows.push(...formatCreditNotesForExport(creditNotes));

  return rows;
};

const contractExportHeader = [
  'Type',
  'Id de l\'auxiliaire',
  'Titre',
  'Prénom',
  'Nom',
  'Date de début',
  'Date de fin',
  'Taux horaire',
  'Volume horaire hebdomadaire',
];

exports.exportContractHistory = async (startDate, endDate, credentials) => {
  const query = {
    company: get(credentials, 'company._id', null),
    'versions.startDate': { $lte: endDate, $gte: startDate },
  };

  const contracts = await Contract.find(query).populate({ path: 'user', select: 'identity' }).lean();
  const rows = [contractExportHeader];
  for (const contract of contracts) {
    const identity = get(contract, 'user.identity') || {};
    for (let i = 0, l = contract.versions.length; i < l; i++) {
      const version = contract.versions[i];
      if (version.startDate && moment(version.startDate).isBetween(startDate, endDate, null, '[]')) {
        rows.push([
          i === 0 ? 'Contrat' : 'Avenant',
          get(contract, 'user._id', ''),
          CIVILITY_LIST[identity.title] || '',
          identity.firstname || '',
          identity.lastname || '',
          version.startDate ? moment(version.startDate).format('DD/MM/YYYY') : '',
          version.endDate ? moment(version.endDate).format('DD/MM/YYYY') : '',
          UtilsHelper.formatFloatForExport(version.grossHourlyRate),
          version.weeklyHours || '',
        ]);
      }
    }
  }

  return rows;
};

const payExportHeader = [
  'Titre',
  'Prénom',
  'Nom',
  'Equipe',
  'Date d\'embauche',
  'Début',
  'Date de notif',
  'Motif',
  'Fin',
  'Heures contrat',
  'Heures à travailler',
  'Heures travaillées',
  'Dont exo non majo',
  'Dont exo et majo',
  'Détails des majo exo',
  'Dont non exo et non majo',
  'Dont non exo et majo',
  'Détails des majo non exo',
  'Solde heures',
  'Dont diff mois précédent',
  'Compteur',
  'Heures sup à payer',
  'Heures comp à payer',
  'Mutuelle',
  'Transport',
  'Autres frais',
  'Prime',
  'Indemnité',
];

const getHiringDate = (contracts) => {
  if (!contracts || contracts.length === 0) return;
  if (contracts.length === 1) return contracts[0].startDate;

  return contracts.map(contract => contract.startDate).sort((a, b) => new Date(a) - new Date(b))[0];
};

const formatLines = (surchargedPlanDetails, planName) => {
  const surcharges = Object.entries(pick(surchargedPlanDetails, Object.keys(SURCHARGES)));
  if (surcharges.length === 0) return;

  const lines = [planName];
  for (const [surchageKey, surcharge] of surcharges) {
    lines.push(`${SURCHARGES[surchageKey]}, ${surcharge.percentage}%, ${UtilsHelper.formatFloatForExport(surcharge.hours)}h`);
  }

  return lines.join('\r\n');
};

exports.formatSurchargedDetailsForExport = (pay, key) => {
  if (!pay || (!pay[key] && (!pay.diff || !pay.diff[key]))) return '';

  const formattedPlans = [];
  if (pay[key]) {
    for (const surchargedPlanDetails of pay[key]) {
      const lines = formatLines(surchargedPlanDetails, surchargedPlanDetails.planName);
      if (lines) formattedPlans.push(lines);
    }
  }
  if (pay.diff && pay.diff[key]) {
    for (const surchargedPlanDetails of pay.diff[key]) {
      const lines = formatLines(surchargedPlanDetails, `${surchargedPlanDetails.planName} (M-1)`);
      if (lines) formattedPlans.push(lines);
    }
  }

  return formattedPlans.join('\r\n\r\n');
};

exports.formatHoursWithDiff = (pay, key) => {
  let hours = pay[key];
  if (pay.diff && pay.diff[key]) hours += pay.diff[key];

  return UtilsHelper.formatFloatForExport(hours);
};

exports.exportPayAndFinalPayHistory = async (startDate, endDate, credentials) => {
  const companyId = get(credentials, 'company._id', null);
  const query = {
    endDate: { $lte: moment(endDate).endOf('M').toDate() },
    startDate: { $gte: moment(startDate).startOf('M').toDate() },
    company: companyId,
  };

  const pays = await Pay.find(query)
    .sort({ startDate: 'desc' })
    .populate({
      path: 'auxiliary',
      select: 'identity sector contracts',
      populate: [
        { path: 'sector', select: '_id sector', match: { company: get(credentials, 'company._id', null) } },
        { path: 'contracts' },
      ],
    })
    .lean({ autopopulate: true, virtuals: true });

  const finalPays = await FinalPay.find(query)
    .sort({ startDate: 'desc' })
    .populate({
      path: 'auxiliary',
      select: 'identity sector contracts',
      populate: [
        { path: 'sector', select: '_id sector', match: { company: get(credentials, 'company._id', null) } },
        { path: 'contracts' },
      ],
    })
    .lean({ autopopulate: true, virtuals: true });

  const rows = [payExportHeader];
  const paysAndFinalPay = [...pays, ...finalPays];
  for (const pay of paysAndFinalPay) {
    const hiringDate = getHiringDate(pay.auxiliary.contracts);
    const cells = [
      CIVILITY_LIST[get(pay, 'auxiliary.identity.title')] || '',
      get(pay, 'auxiliary.identity.firstname') || '',
      get(pay, 'auxiliary.identity.lastname').toUpperCase() || '',
      get(pay.auxiliary, 'sector.name') || '',
      hiringDate ? moment(hiringDate).format('DD/MM/YYYY') : '',
      moment(pay.startDate).format('DD/MM/YYYY'),
      pay.endNotificationDate ? moment(pay.endNotificationDate).format('DD/MM/YYYY') : '',
      pay.endReason ? END_CONTRACT_REASONS[pay.endReason] : '',
      moment(pay.endDate).format('DD/MM/YYYY'),
      UtilsHelper.formatFloatForExport(pay.contractHours),
      exports.formatHoursWithDiff(pay, 'hoursToWork'),
      exports.formatHoursWithDiff(pay, 'workedHours'),
      exports.formatHoursWithDiff(pay, 'notSurchargedAndExempt'),
      exports.formatHoursWithDiff(pay, 'surchargedAndExempt'),
      exports.formatSurchargedDetailsForExport(pay, 'surchargedAndExemptDetails'),
      exports.formatHoursWithDiff(pay, 'notSurchargedAndNotExempt'),
      exports.formatHoursWithDiff(pay, 'surchargedAndNotExempt'),
      exports.formatSurchargedDetailsForExport(pay, 'surchargedAndNotExemptDetails'),
      exports.formatHoursWithDiff(pay, 'hoursBalance'),
      get(pay, 'diff.hoursBalance') ? UtilsHelper.formatFloatForExport(pay.diff.hoursBalance) : '0,00',
      UtilsHelper.formatFloatForExport(pay.hoursCounter),
      UtilsHelper.formatFloatForExport(pay.overtimeHours),
      UtilsHelper.formatFloatForExport(pay.additionalHours),
      pay.mutual ? 'Oui' : 'Non',
      UtilsHelper.formatFloatForExport(pay.transport),
      UtilsHelper.formatFloatForExport(pay.otherFees),
      UtilsHelper.formatFloatForExport(pay.bonus),
      pay.compensation ? UtilsHelper.formatFloatForExport(pay.compensation) : '0,00',
    ];

    rows.push(cells);
  }

  return rows;
};

const paymentExportHeader = [
  'Nature',
  'Identifiant',
  'Date',
  'Id Bénéficiaire',
  'Titre',
  'Nom',
  'Prénom',
  'Id tiers payeur',
  'Tiers payeur',
  'Moyen de paiement',
  'Montant TTC en €',
];

exports.exportPaymentsHistory = async (startDate, endDate, credentials) => {
  const query = {
    date: { $lte: endDate, $gte: startDate },
    company: get(credentials, 'company._id'),
  };

  const payments = await Payment.find(query)
    .sort({ date: 'desc' })
    .populate({ path: 'customer', select: 'identity' })
    .populate({ path: 'client' })
    .lean();

  const rows = [paymentExportHeader];

  for (const payment of payments) {
    const customerId = get(payment.customer, '_id');
    const clientId = get(payment.client, '_id');
    const cells = [
      PAYMENT_NATURE_LIST[payment.nature],
      payment.number || '',
      moment(payment.date).format('DD/MM/YYYY'),
      customerId ? customerId.toHexString() : '',
      CIVILITY_LIST[get(payment, 'customer.identity.title')] || '',
      get(payment, 'customer.identity.lastname', '').toUpperCase(),
      get(payment, 'customer.identity.firstname', ''),
      clientId ? clientId.toHexString() : '',
      get(payment.client, 'name') || '',
      PAYMENT_TYPES_LIST[payment.type] || '',
      UtilsHelper.formatFloatForExport(payment.netInclTaxes),
    ];

    rows.push(cells);
  }

  return rows;
};