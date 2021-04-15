const { get } = require('lodash');
const builder = require('xmlbuilder');
const Customer = require('../models/Customer');
const Event = require('../models/Event');
const UtilsHelper = require('./utils');
const FundingsHelper = require('./fundings');
const DatesHelper = require('./dates');
const { TIME_STAMPING_ACTIONS } = require('../models/EventHistory');

const CADRE_PRESTATAIRE = 'PRE';
const APA = 'APA';
const MISSING_START_TIME_STAMP = 'COA';
const MISSING_END_TIME_STAMP = 'COD';
const MISSING_BOTH_TIME_STAMP = 'CO2';
const AUXILIARY_CONTACT = 'INT';

// Gestion documentaire
const getCIDDHExchangedDocumentContext = transactionId => ({ VersionID: '1.4', SpecifiedTransactionID: transactionId });

// Gestion documentaire - description dématérialisée de l’entête de télégestion
const getCIDDHExchangedDocument = (transactionId, issueDateTime) => ({
  ID: transactionId,
  IssueDateTime: issueDateTime,
});

// Opérateurs (prestataire et tiers payeur)
const getApplicableCIDDHSupplyChainTradeAgreement = tpp => ({
  BuyerOrderReferencedCIReferencedDocument: {
    IssuerCITradeParty: {
      'pie:ID': { '#text': tpp.teletransmissionId, '@schemeAgencyName': 'token', '@schemeID': 'token' },
      'pie:Name': tpp.name,
    },
  },
  ContractReferencedCIReferencedDocument: {
    'qdt:GlobalID': { '#text': 'P', '@schemeAgencyName': 'token', '@schemeID': 'token' },
  },
});

const getShipToCITradeParty = (customer) => {
  const shipToCITradeParty = {
    'pie:ID': { '@schemeAgencyName': 'token', '@schemeID': 'token' },
    'pie:Name': UtilsHelper.formatIdentity(customer.identity, 'FL'),
    'pie:LastName': get(customer, 'identity.lastname') || '',
    'pie:PostalCITradeAddress': {
      'pie:LineOne': get(customer, 'contact.primaryAddress.street') || '',
      'pie:PostcodeCode': get(customer, 'contact.primaryAddress.zipCode') || '',
      'pie:CityName': get(customer, 'contact.primaryAddress.city') || '',
      'pie:CountryID': 'FR',
    },
  };

  const firstname = get(customer, 'identity.firstname');
  if (firstname) shipToCITradeParty['pie:FirstName'] = firstname;

  const birthDate = get(customer, 'identity.birthDate');
  if (birthDate) shipToCITradeParty['pie:BirthDate'] = DatesHelper.toLocalISOString(birthDate);

  return shipToCITradeParty;
};

const getShipFromCITradeParty = auxiliary => ({
  // Mettre ici l'id de télétransmission de la structure
  'pie:ID': { '#text': 449, '@schemeAgencyName': 'token', '@schemeID': 'token' },
  'pie:Name': `${get(auxiliary, 'company.name')} - ${get(auxiliary, 'establishment.name')}`,
  'pie:SIRET': get(auxiliary, 'establishment.siret'),
  'pie:DefinedCITradeContact': {
    'pie:ID': { '#text': auxiliary.serialNumber, '@schemeAgencyName': 'token', '@schemeID': 'token' },
    'pie:PersonName': UtilsHelper.formatIdentity(auxiliary.identity, 'FL'),
    'pie:TypeCode': {
      '#text': AUXILIARY_CONTACT,
      '@listAgencyName': 'EDESS',
      '@listID': 'ESPPADOM_CONTACT_PRESTATAIRE',
    },
  },
  'pie:PostalCITradeAddress': {
    'pie:LineOne': get(auxiliary, 'company.address.street') || '',
    'pie:PostcodeCode': get(auxiliary, 'company.address.zipCode') || '',
    'pie:CityName': get(auxiliary, 'company.address.city') || '',
  },
});

// Délivrance retenue : les horaires validés de début et de fin  d’intervention
const getActualDespatchCISupplyChainEvent = (event, isStartTimeStamped, isEndTimeStamped) => {
  let typeCode = '';
  if (!isStartTimeStamped || !isEndTimeStamped) {
    if (isStartTimeStamped) typeCode = MISSING_END_TIME_STAMP;
    else if (isEndTimeStamped) typeCode = MISSING_START_TIME_STAMP;
    else typeCode = MISSING_BOTH_TIME_STAMP;
  }

  const actualDespatchCISupplyChainEvent = {
    TypeCode: { '#text': typeCode, '@listAgencyName': 'EDESS', '@listID': 'ESPPADOM_EFFECTIVITY_AJUST' },
    OccurrenceCISpecifiedPeriod: {
      'qdt:StartDateTime': DatesHelper.toLocalISOString(event.startDate),
      'qdt:EndDateTime': DatesHelper.toLocalISOString(event.endDate),
    },
  };

  return actualDespatchCISupplyChainEvent;
};

// Précisions de délivrance (bénéficiaire et contexte)
const getApplicableCIDDHSupplyChainTradeDelivery = (event, customer) => {
  const isStartTimeStamped = event.histories.some(h => !!h.update.startHour);
  const isEndTimeStamped = event.histories.some(h => !!h.update.endHour);

  const applicableCIDDHSupplyChainTradeDelivery = {
    ShipToCITradeParty: getShipToCITradeParty(customer),
    ShipFromCITradeParty: getShipFromCITradeParty(event.auxiliary),
    ActualDespatchCISupplyChainEvent:
      getActualDespatchCISupplyChainEvent(event, isStartTimeStamped, isEndTimeStamped),
  };

  if (isStartTimeStamped && isEndTimeStamped) {
    applicableCIDDHSupplyChainTradeDelivery.AdditionalReferencedCIReferencedDocument = {
      EffectiveCISpecifiedPeriod: {
        StartDateTime: { CertifiedDateTime: DatesHelper.toLocalISOString(event.startDate) },
        EndDateTime: { CertifiedDateTime: DatesHelper.toLocalISOString(event.endDate) },
      },
    };
  }

  return applicableCIDDHSupplyChainTradeDelivery;
};

// Prestation à effectuer
const getIncludedCIDDLSupplyChainTradeLineItem = (event, funding, transactionId) => ({
  AssociatedCIDDLDocumentLineDocument: {
    LineID: transactionId,
    OrderLineID: funding.fundingPlanId,
  },
  SpecifiedCIDDLSupplyChainTradeDelivery: {
    BilledQuantity: (event.endDate - event.startDate) / (60 * 60 * 1000),
  },
  SpecifiedCIDDLSupplyChainTradeSettlement: {
    CadreIntervention: { '@listID': 'ESPPADOM_CADRE', '@listAgencyName': 'EDESS', '#text': CADRE_PRESTATAIRE },
  },
  SpecifiedCITradeProduct: {
    'qdt:ID': { '@listID': 'ESPPADOM_TYPE_AIDE', '@listAgencyName': 'EDESS', '#text': APA },
    'qdt:Name': 'Aide aux personnes âgées',
  },
});

// Contenu du document
const getCIDDHSupplyChainTradeTransaction = (event, funding, transactionId) => ({
  ApplicableCIDDHSupplyChainTradeAgreement: getApplicableCIDDHSupplyChainTradeAgreement(funding.thirdPartyPayer),
  ApplicableCIDDHSupplyChainTradeDelivery: getApplicableCIDDHSupplyChainTradeDelivery(event, event.customer),
  ApplicableCIDDHSupplyChainTradeSettlement: {},
  IncludedCIDDLSupplyChainTradeLineItem: getIncludedCIDDLSupplyChainTradeLineItem(event, funding, transactionId),
});

const formatCrossIndustryDespatchAdvice = (event, customersWithFunding, transactionId, issueDateTime) => {
  const customer = customersWithFunding.find(c => UtilsHelper.areObjectIdsEquals(c._id, event.customer));
  const fundingsWithLastVersion = customer.fundings.map(f => ({ ...f, ...f.versions[f.versions.length - 1] }));
  const funding = FundingsHelper.getMatchingFunding(event.startDate, fundingsWithLastVersion);
  if (!funding) return null;

  return {
    'ns:CIDDHExchangedDocumentContext': getCIDDHExchangedDocumentContext(transactionId),
    'ns:CIDDHExchangedDocument': getCIDDHExchangedDocument(transactionId, issueDateTime),
    'ns:CIDDHSupplyChainTradeTransaction':
      getCIDDHSupplyChainTradeTransaction({ ...event, customer }, funding, transactionId),
  };
};

/**
 * Un fichier = une liste d'interventions pour un tiers payeur donné
 * => pour un tiers payeur, on récupere la liste des inteventions qui sont reliées à un plan d'aide
 */
exports.getCrossIndustryDespatchAdvice = async (credentials) => {
  const companyId = get(credentials, 'company._id');

  const customersWithFunding = await Customer
    .find(
      {
        fundings: { $exists: true },
        // company: companyId,
        _id: { $in: ['6046231b4fb51b00152fc647', '604623194fb51b00152fc644'] },
      },
      { 'contact.primaryAddress': 1, identity: 1, fundings: 1 }
    )
    .populate({ path: 'fundings.thirdPartyPayer', select: 'teletransmissionId name' })
    .lean();

  const subscriptionIds = customersWithFunding.map(c => c.fundings.map(f => f.subscription)).flat();
  const events = await Event
    .find({
      company: companyId,
      subscription: { $in: subscriptionIds },
      startDate: { $gte: '2021-05-01T00:00:00' },
      endDate: { $lte: '2021-06-01T00:00:00' },
      auxiliary: { $exists: true },
    })
    .populate({
      path: 'auxiliary',
      populate: [{ path: 'establishment' }, { path: 'company' }],
      select: 'company establishment identity serialNumber',
    })
    .populate({ path: 'histories', match: { action: { $in: TIME_STAMPING_ACTIONS }, company: companyId } })
    .lean();

  const issueDateTime = DatesHelper.toLocalISOString(new Date());
  const transactionId = issueDateTime.replace(/T/g, '').replace(/-/g, '').replace(/:/g, '');

  return events
    .map(ev => formatCrossIndustryDespatchAdvice(ev, customersWithFunding, transactionId, issueDateTime))
    .filter(c => !!c);
};

exports.generateDeliveryXml = async (credentials) => {
  const data = {
    'ns:delivery': {
      '@versionID': '1.4',
      '@xmlns': 'urn:un:unece:uncefact:data:standard:ReusableAggregateBusinessInformationEntity:8',
      '@xmlns:pie': 'urn:un:unece:uncefact:data:standard:PersonInformationEntity:1',
      '@xmlns:qdt': 'urn:un:unece:uncefact:data:standard:QualifiedDataType:8',
      '@xmlns:ns': 'urn:un:unece:uncefact:data:standard:CrossIndustryDespatchAdvice:2',
      'ns:CrossIndustryDespatchAdvice': await exports.getCrossIndustryDespatchAdvice(credentials),
    },
  };
  const xml = builder.create(data, { encoding: 'utf-8' }).end({ pretty: true });
  // // eslint-disable-next-line no-console
  // console.log(xml);

  return xml;
};
