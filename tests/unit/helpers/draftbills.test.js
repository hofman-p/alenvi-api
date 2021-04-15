const sinon = require('sinon');
const expect = require('expect');
const moment = require('moment');
const { ObjectID } = require('mongodb');
const omit = require('lodash/omit');
const SinonMongoose = require('../sinonMongoose');
const Surcharge = require('../../../src/models/Surcharge');
const ThirdPartyPayer = require('../../../src/models/ThirdPartyPayer');
const FundingHistory = require('../../../src/models/FundingHistory');
const DraftBillsHelper = require('../../../src/helpers/draftBills');
const UtilsHelper = require('../../../src/helpers/utils');
const SurchargesHelper = require('../../../src/helpers/surcharges');
const FundingsHelper = require('../../../src/helpers/fundings');
const EventRepository = require('../../../src/repositories/EventRepository');
const { BILLING_DIRECT, BILLING_INDIRECT } = require('../../../src/helpers/constants');

describe('populateSurcharge', () => {
  let findSurcharge;
  beforeEach(() => {
    findSurcharge = sinon.stub(Surcharge, 'find');
  });
  afterEach(() => {
    findSurcharge.restore();
  });

  it('should populate surcharge and order versions', async () => {
    const surchargeId = new ObjectID();
    const companyId = new ObjectID();
    const returnedSurcharge = { _id: surchargeId, sundaySurcharge: 10 };
    const subscription = {
      _id: 'abc',
      versions: [
        { unitTTCRate: 13, startDate: new Date('2019-01-20'), _id: 5 },
        { unitTTCRate: 15, startDate: new Date('2019-02-24'), _id: 4 },
      ],
      service: {
        versions: [
          { startDate: new Date('2019-02-24'), _id: 1 },
          { surcharge: surchargeId, startDate: new Date('2019-03-20'), _id: 2 },
          { surcharge: surchargeId, startDate: new Date('2019-02-29'), _id: 3 },
        ],
      },
    };
    findSurcharge.returns(SinonMongoose.stubChainedQueries([[returnedSurcharge]], ['lean']));

    const result = await DraftBillsHelper.populateSurcharge(subscription, companyId);

    expect(result._id).toEqual('abc');
    expect(result.versions.length).toEqual(2);
    expect(result.versions[0]._id).toEqual(4);
    expect(result.service.versions.length).toEqual(3);
    expect(result.service.versions[0]._id).toEqual(2);
    expect(result.service.versions[0]).toEqual(expect.objectContaining({
      ...subscription.service.versions[1],
      surcharge: returnedSurcharge,
    }));
    SinonMongoose.calledWithExactly(findSurcharge, [
      { query: 'find', args: [{ company: companyId }] },
      { query: 'lean' },
    ]);
  });
});

describe('populateFundings', () => {
  let findOneFundingHistory;
  let findFundingHistory;
  let mergeLastVersionWithBaseObjectStub;

  beforeEach(() => {
    findOneFundingHistory = sinon.stub(FundingHistory, 'findOne');
    findFundingHistory = sinon.stub(FundingHistory, 'find');
    mergeLastVersionWithBaseObjectStub = sinon.stub(UtilsHelper, 'mergeLastVersionWithBaseObject');
  });
  afterEach(() => {
    findOneFundingHistory.restore();
    findFundingHistory.restore();
    mergeLastVersionWithBaseObjectStub.restore();
  });

  it('should return empty array if input empty', async () => {
    const companyId = new ObjectID();
    const result = await DraftBillsHelper.populateFundings([], new Date(), null, companyId);
    expect(result).toEqual([]);
  });

  it('should populate third party payer funding', async () => {
    const companyId = new ObjectID();
    const tppId = new ObjectID();
    const fundings = [{ thirdPartyPayer: tppId, _id: new ObjectID(), versions: [] }];
    const tpps = [{ _id: tppId, billingMode: BILLING_DIRECT }];
    const funding = { ...omit(fundings[0], ['versions']) };
    mergeLastVersionWithBaseObjectStub.returns(funding);
    findOneFundingHistory.returns(SinonMongoose.stubChainedQueries([null], ['lean']));

    const result = await DraftBillsHelper.populateFundings(fundings, new Date(), tpps, companyId);

    expect(result[0].thirdPartyPayer._id).toEqual(tppId);
    sinon.assert.called(mergeLastVersionWithBaseObjectStub);
    SinonMongoose.calledWithExactly(findOneFundingHistory, [
      { query: 'findOne', args: [{ fundingId: fundings[0]._id }] },
      { query: 'lean' },
    ]);
  });

  it('should populate funding history with once frequency and history', async () => {
    const companyId = new ObjectID();
    const fundingId = new ObjectID();
    const tppId = new ObjectID();
    const fundings = [{
      _id: new ObjectID(),
      thirdPartyPayer: tppId,
      frequency: 'once',
      versions: [{ _id: fundingId }],
    }];
    const tpps = [{ _id: tppId, billingMode: BILLING_DIRECT }];
    const funding = { ...fundings[0].versions[0], ...omit(fundings[0], ['versions']) };
    const returnedHistory = { careHours: 4, fundingId };
    mergeLastVersionWithBaseObjectStub.returns(funding);
    findOneFundingHistory.returns(SinonMongoose.stubChainedQueries([returnedHistory], ['lean']));

    const result = await DraftBillsHelper.populateFundings(fundings, new Date(), tpps, companyId);

    expect(result[0].history).toMatchObject([{ careHours: 4, fundingId }]);
    sinon.assert.called(mergeLastVersionWithBaseObjectStub);
    SinonMongoose.calledWithExactly(findOneFundingHistory, [
      { query: 'findOne', args: [{ fundingId: fundings[0]._id }] },
      { query: 'lean' },
    ]);
  });

  it('should populate funding history with once frequency and without history', async () => {
    const companyId = new ObjectID();
    const fundingId = new ObjectID();
    const tppId = new ObjectID();
    const fundings = [{
      _id: fundingId,
      thirdPartyPayer: tppId,
      frequency: 'once',
      versions: [{ _id: fundingId }],
    }];
    const tpps = [{ _id: tppId, billingMode: BILLING_DIRECT }];
    const funding = { ...fundings[0].versions[0], ...omit(fundings[0], ['versions']) };
    mergeLastVersionWithBaseObjectStub.returns(funding);
    findOneFundingHistory.returns(SinonMongoose.stubChainedQueries([null], ['lean']));

    const result = await DraftBillsHelper.populateFundings(fundings, new Date(), tpps, companyId);

    expect(result[0].history).toMatchObject([{ careHours: 0, amountTTC: 0, fundingId }]);
    sinon.assert.called(mergeLastVersionWithBaseObjectStub);
    SinonMongoose.calledWithExactly(findOneFundingHistory, [
      { query: 'findOne', args: [{ fundingId: fundings[0]._id }] },
      { query: 'lean' },
    ]);
  });

  it('should populate funding history with monthly frequency', async () => {
    const companyId = new ObjectID();
    const fundingId = new ObjectID();
    const tppId = new ObjectID();
    const fundings = [{
      _id: fundingId,
      thirdPartyPayer: tppId,
      frequency: 'monthly',
      versions: [{ _id: fundingId }],
    }];
    const tpps = [{ _id: tppId, billingMode: BILLING_DIRECT }];
    const returnedHistories = [
      { careHours: 3, fundingId, month: '01/2019' },
      { careHours: 5, fundingId, month: '02/2019' },
    ];
    const funding = { ...fundings[0].versions[0], ...omit(fundings[0], ['versions']) };
    mergeLastVersionWithBaseObjectStub.returns(funding);
    findFundingHistory.returns(SinonMongoose.stubChainedQueries([returnedHistories], ['lean']));

    const result = await DraftBillsHelper.populateFundings(fundings, new Date('2019/03/10'), tpps, companyId);

    expect(result[0].history.length).toEqual(3);
    const addedHistory = result[0].history.find(hist => hist.month === '03/2019');
    expect(addedHistory).toMatchObject({ careHours: 0, amountTTC: 0, fundingId, month: '03/2019' });
    sinon.assert.called(mergeLastVersionWithBaseObjectStub);
    SinonMongoose.calledWithExactly(findFundingHistory, [
      { query: 'find', args: [{ fundingId: fundings[0]._id, company: companyId }] },
      { query: 'lean' },
    ]);
  });

  it('shouldn\'t populate third party payer funding if billing mode is indirect', async () => {
    const companyId = new ObjectID();
    const tppIndirectId = new ObjectID();
    const fundings = [
      { thirdPartyPayer: tppIndirectId, _id: new ObjectID(), versions: [] },
    ];
    const tpps = [{ _id: tppIndirectId, billingMode: BILLING_INDIRECT }];
    const funding = { ...omit(fundings[0], ['versions']) };
    mergeLastVersionWithBaseObjectStub.returns(funding);

    const result = await DraftBillsHelper.populateFundings(fundings, new Date(), tpps, companyId);

    expect(result).toEqual([]);
    sinon.assert.called(mergeLastVersionWithBaseObjectStub);
  });
});

describe('getMatchingFunding', () => {
  it('should return null if fundings is empty', () => {
    expect(FundingsHelper.getMatchingFunding(new Date(), [])).toBeNull();
  });

  it('should return null is funding not started on date', () => {
    const fundings = [
      { _id: 1, careDays: [0, 2, 3], startDate: '2019-03-23T09:00:00', createdAt: '2019-03-23T09:00:00' },
      { _id: 3, careDays: [0, 3], startDate: '2019-02-23T09:00:00', createdAt: '2019-02-23T09:00:00' },
      { _id: 2, careDays: [1, 5, 6], startDate: '2019-04-23T09:00:00', createdAt: '2019-04-23T09:00:00' },
    ];
    const result = FundingsHelper.getMatchingFunding('2019-01-23T09:00:00', fundings);
    expect(result).toBeNull();
  });

  it('should return null if funding ended on date', () => {
    const fundings = [
      {
        _id: 2,
        careDays: [1, 5, 6],
        startDate: '2019-01-01T09:00:00',
        endDate: '2019-01-10T09:00:00',
        createdAt: '2019-04-23T09:00:00',
      },
    ];
    const result = FundingsHelper.getMatchingFunding('2019-01-23T09:00:00', fundings);
    expect(result).toBeNull();
  });

  it('should return matching version with random day', () => {
    const fundings = [
      { _id: 1, careDays: [0, 2, 3], startDate: '2019-03-23T09:00:00', createdAt: '2019-03-23T09:00:00' },
      { _id: 3, careDays: [0, 3], startDate: '2019-02-23T09:00:00', createdAt: '2019-02-23T09:00:00' },
      { _id: 2, careDays: [1, 5, 6], startDate: '2019-04-23T09:00:00', createdAt: '2019-04-23T09:00:00' },
    ];
    const result = FundingsHelper.getMatchingFunding('2019-04-23T09:00:00', fundings);

    expect(result._id).toEqual(2);
  });

  it('should return matching version with holidays', () => {
    const fundings = [
      { _id: 1, careDays: [0, 2, 3], startDate: '2019-03-23T09:00:00' },
      { _id: 3, careDays: [4, 7], startDate: '2019-04-23T09:00:00' },
    ];
    const result = FundingsHelper.getMatchingFunding('2022-05-01T09:00:00', fundings);

    expect(result._id).toEqual(3);
  });

  it('should return null if no matching version', () => {
    const fundings = [
      { _id: 1, careDays: [0, 2, 3], startDate: '2019-03-23T09:00:00' },
      { _id: 2, careDays: [5, 6], startDate: '2019-04-23T09:00:00' },
    ];
    const result = FundingsHelper.getMatchingFunding('2019-04-23T09:00:00', fundings);
    expect(result).toBeNull();
  });
});

describe('getExclTaxes', () => {
  it('should return excluded taxes price', () => {
    expect(Number.parseFloat(DraftBillsHelper.getExclTaxes(20, 2).toFixed(2))).toEqual(19.61);
  });
});

describe('getInclTaxes', () => {
  it('should return excluded taxes price', () => {
    expect(DraftBillsHelper.getInclTaxes(20, 2)).toEqual(20.4);
  });
});

describe('getThirdPartyPayerPrice', () => {
  it('should compute tpp price', () => {
    expect(DraftBillsHelper.getThirdPartyPayerPrice(180, 10, 20)).toEqual(24);
  });
});

describe('getMatchingHistory', () => {
  it('should return history for once frequency', () => {
    const fundingId = new ObjectID();
    const funding = { _id: fundingId, frequency: 'once', history: [{ fundingId, careHours: 2 }] };

    const result = DraftBillsHelper.getMatchingHistory({}, funding);

    expect(result.fundingId).toEqual(fundingId);
  });

  it('should return existing history for monthly frequency', () => {
    const fundingId = new ObjectID();
    const funding = {
      _id: fundingId,
      frequency: 'monthly',
      history: [{ fundingId, careHours: 2, month: '03/2019' }, { fundingId, careHours: 4, month: '02/2019' }],
    };
    const event = { startDate: new Date('2019/03/12') };

    const result = DraftBillsHelper.getMatchingHistory(event, funding);

    expect(result).toMatchObject({ fundingId, careHours: 2, month: '03/2019' });
  });

  it('should create history and add to list when missing for monthly frequency', () => {
    const fundingId = new ObjectID();
    const funding = {
      _id: fundingId,
      frequency: 'monthly',
      history: [{ fundingId, careHours: 2, month: '01/2019' }, { fundingId, careHours: 4, month: '02/2019' }],
    };
    const event = { startDate: new Date('2019/03/12') };

    const result = DraftBillsHelper.getMatchingHistory(event, funding);

    expect(result).toMatchObject({ careHours: 0, amountTTC: 0, fundingId, month: '03/2019' });
  });
});

describe('getHourlyFundingSplit', () => {
  const price = 50;
  const event = {
    startDate: (new Date('2019/03/12')).setHours(8),
    endDate: (new Date('2019/03/12')).setHours(10),
  };
  const service = { vat: 20 };
  let getExclTaxes;
  let getMatchingHistory;
  let getThirdPartyPayerPrice;
  beforeEach(() => {
    getExclTaxes = sinon.stub(DraftBillsHelper, 'getExclTaxes');
    getMatchingHistory = sinon.stub(DraftBillsHelper, 'getMatchingHistory');
    getThirdPartyPayerPrice = sinon.stub(DraftBillsHelper, 'getThirdPartyPayerPrice');
  });
  afterEach(() => {
    getExclTaxes.restore();
    getMatchingHistory.restore();
    getThirdPartyPayerPrice.restore();
  });

  it('case 1. Event fully invoiced to TPP', () => {
    const funding = {
      unitTTCRate: 21,
      careHours: 4,
      frequency: 'once',
      customerParticipationRate: 20,
      history: { careHours: 1 },
      thirdPartyPayer: { _id: new ObjectID() },
    };

    getExclTaxes.returns(17.5);
    getMatchingHistory.returns({ careHours: 1 });
    getThirdPartyPayerPrice.returns(28);

    const result = DraftBillsHelper.getHourlyFundingSplit(event, funding, service, price);

    expect(result.customerPrice).toEqual(22);
    expect(result.thirdPartyPayerPrice).toEqual(28);
    expect(result.history.careHours).toEqual(2);
    sinon.assert.calledWithExactly(
      getThirdPartyPayerPrice,
      120,
      17.5,
      20
    );
  });

  it('case 2. Event partially invoiced to TPP', () => {
    const funding = {
      unitTTCRate: 21,
      careHours: 4,
      frequency: 'once',
      customerParticipationRate: 20,
      history: { careHours: 3 },
      thirdPartyPayer: { _id: new ObjectID() },
    };

    getExclTaxes.returns(17.5);
    getMatchingHistory.returns({ careHours: 3 });
    getThirdPartyPayerPrice.returns(14);

    const result = DraftBillsHelper.getHourlyFundingSplit(event, funding, service, price);

    expect(result.customerPrice).toEqual(36);
    expect(result.thirdPartyPayerPrice).toEqual(14);
    expect(result.history.careHours).toEqual(1);
    sinon.assert.calledWithExactly(getThirdPartyPayerPrice, 60, 17.5, 20);
  });
});

describe('getFixedFundingSplit', () => {
  const price = 50;
  const event = {
    startDate: (new Date('2019/03/12')).setHours(8),
    endDate: (new Date('2019/03/12')).setHours(10),
  };
  const service = { vat: 20 };
  let getExclTaxes;
  beforeEach(() => {
    getExclTaxes = sinon.stub(DraftBillsHelper, 'getExclTaxes');
  });
  afterEach(() => {
    getExclTaxes.restore();
  });

  it('Case 1. Event fully invoiced to TPP', () => {
    const funding = {
      history: [{ amountTTC: 10 }],
      amountTTC: 100,
      thirdPartyPayer: { _id: new ObjectID() },
    };
    getExclTaxes.returns(50);

    const result = DraftBillsHelper.getFixedFundingSplit(event, funding, service, price);

    expect(result.customerPrice).toEqual(0);
    expect(result.thirdPartyPayerPrice).toEqual(50);
    expect(result.history.amountTTC).toEqual(60);
    sinon.assert.notCalled(getExclTaxes);
  });

  it('Case 2. Event partially invoiced to TPP', () => {
    const funding = {
      history: [{ amountTTC: 79 }],
      amountTTC: 100,
      thirdPartyPayer: { _id: new ObjectID() },
    };
    getExclTaxes.returns(17.5);

    const result = DraftBillsHelper.getFixedFundingSplit(event, funding, service, price);

    expect(result.customerPrice).toEqual(32.5);
    expect(result.thirdPartyPayerPrice).toEqual(17.5);
    expect(result.history.amountTTC).toEqual(21);
    sinon.assert.calledWithExactly(getExclTaxes, 21, 20);
  });
});

describe('getEventBilling', () => {
  const unitTTCRate = 21;
  const event = {
    startDate: (new Date('2019/05/08')).setHours(8),
    endDate: (new Date('2019/05/08')).setHours(10),
  };
  let getExclTaxes;
  let getEventSurcharges;
  let getSurchargedPrice;
  let getHourlyFundingSplit;
  let getFixedFundingSplit;
  beforeEach(() => {
    getExclTaxes = sinon.stub(DraftBillsHelper, 'getExclTaxes');
    getEventSurcharges = sinon.stub(SurchargesHelper, 'getEventSurcharges');
    getSurchargedPrice = sinon.stub(DraftBillsHelper, 'getSurchargedPrice');
    getHourlyFundingSplit = sinon.stub(DraftBillsHelper, 'getHourlyFundingSplit');
    getFixedFundingSplit = sinon.stub(DraftBillsHelper, 'getFixedFundingSplit');
  });
  afterEach(() => {
    getExclTaxes.restore();
    getEventSurcharges.restore();
    getSurchargedPrice.restore();
    getHourlyFundingSplit.restore();
    getFixedFundingSplit.restore();
  });

  it('should return event prices wihtout funding and without surcharge', () => {
    const service = { vat: 20 };
    getExclTaxes.returns(17.5);

    const result = DraftBillsHelper.getEventBilling(event, unitTTCRate, service);

    expect(result).toEqual({ customerPrice: 35, thirdPartyPayerPrice: 0 });
    sinon.assert.notCalled(getHourlyFundingSplit);
    sinon.assert.notCalled(getFixedFundingSplit);
    sinon.assert.notCalled(getEventSurcharges);
    sinon.assert.notCalled(getSurchargedPrice);
  });

  it('should return event prices with surcharge', () => {
    const service = { vat: 20, nature: 'hourly', surcharge: { publicHoliday: 10 } };
    getExclTaxes.returns(17.5);
    getSurchargedPrice.returns(38.5);
    getEventSurcharges.returns([{ percentage: 10 }]);

    const result = DraftBillsHelper.getEventBilling(event, unitTTCRate, service);

    expect(result).toEqual({ customerPrice: 38.5, thirdPartyPayerPrice: 0, surcharges: [{ percentage: 10 }] });
    sinon.assert.calledOnce(getEventSurcharges);
    sinon.assert.calledWithExactly(getSurchargedPrice, event, [{ percentage: 10 }], 35);
    sinon.assert.notCalled(getHourlyFundingSplit);
    sinon.assert.notCalled(getFixedFundingSplit);
  });

  it('should return event prices with hourly funding', () => {
    const service = { vat: 20 };
    const funding = {
      nature: 'hourly',
      unitTTCRate: 15,
      careHours: 4,
      frequency: 'once',
      customerParticipationRate: 0,
      history: { careHours: 1 },
      thirdPartyPayer: { _id: new ObjectID() },
    };
    getExclTaxes.returns(17.5);
    getHourlyFundingSplit.returns({ customerPrice: 10, thirdPartyPayerPrice: 25 });

    const result = DraftBillsHelper.getEventBilling(event, unitTTCRate, service, funding);

    expect(result).toEqual({ customerPrice: 10, thirdPartyPayerPrice: 25 });
    sinon.assert.calledWithExactly(getHourlyFundingSplit, event, funding, service, 35);
    sinon.assert.notCalled(getFixedFundingSplit);
    sinon.assert.notCalled(getEventSurcharges);
    sinon.assert.notCalled(getSurchargedPrice);
  });

  it('should return event prices with fixed funding', () => {
    const service = { vat: 20 };
    const funding = {
      nature: 'fixed',
      history: { amountTTC: 50 },
      amountTTC: 100,
      thirdPartyPayer: { _id: new ObjectID() },
    };
    getExclTaxes.returns(17.5);
    getFixedFundingSplit.returns({ customerPrice: 0, thirdPartyPayerPrice: 35 });

    const result = DraftBillsHelper.getEventBilling(event, unitTTCRate, service, funding);

    expect(result).toEqual({ customerPrice: 0, thirdPartyPayerPrice: 35 });
    sinon.assert.calledWithExactly(getFixedFundingSplit, event, funding, service, 35);
    sinon.assert.notCalled(getHourlyFundingSplit);
    sinon.assert.notCalled(getEventSurcharges);
    sinon.assert.notCalled(getSurchargedPrice);
  });

  it('should return event prices with hourly funding and surcharge', () => {
    const service = { vat: 20, nature: 'hourly', surcharge: { publicHoliday: 10 } };
    const funding = {
      nature: 'hourly',
      unitTTCRate: 15,
      careHours: 4,
      frequency: 'once',
      customerParticipationRate: 0,
      history: { careHours: 1 },
      thirdPartyPayer: { _id: new ObjectID() },
    };
    getExclTaxes.returns(17.5);
    getHourlyFundingSplit.returns({ customerPrice: 10, thirdPartyPayerPrice: 25 });
    getSurchargedPrice.returns(38.5);
    getEventSurcharges.returns([{ percentage: 10 }]);

    const result = DraftBillsHelper.getEventBilling(event, unitTTCRate, service, funding);

    expect(result).toEqual({ customerPrice: 10, thirdPartyPayerPrice: 25, surcharges: [{ percentage: 10 }] });
    sinon.assert.calledWithExactly(getHourlyFundingSplit, event, funding, service, 38.5);
    sinon.assert.notCalled(getFixedFundingSplit);
    sinon.assert.calledOnce(getEventSurcharges);
    sinon.assert.calledOnce(getSurchargedPrice);
  });

  it('should return event prices with fixed funding and surcharge', () => {
    const service = { vat: 20, nature: 'hourly', surcharge: { publicHoliday: 10 } };
    const funding = {
      nature: 'fixed',
      history: { amountTTC: 50 },
      amountTTC: 100,
      thirdPartyPayer: { _id: new ObjectID() },
    };
    getExclTaxes.returns(17.5);
    getFixedFundingSplit.returns({ customerPrice: 0, thirdPartyPayerPrice: 35 });
    getSurchargedPrice.returns(38.5);
    getEventSurcharges.returns([{ percentage: 10 }]);

    const result = DraftBillsHelper.getEventBilling(event, unitTTCRate, service, funding);

    expect(result).toEqual({ customerPrice: 0, thirdPartyPayerPrice: 35, surcharges: [{ percentage: 10 }] });
    sinon.assert.calledWithExactly(getFixedFundingSplit, event, funding, service, 38.5);
    sinon.assert.notCalled(getHourlyFundingSplit);
    sinon.assert.calledOnce(getEventSurcharges);
    sinon.assert.calledOnce(getSurchargedPrice);
  });

  it('should return event prices with fixed service', () => {
    const service = { vat: 20, nature: 'fixed' };
    getExclTaxes.returns(17.5);

    const result = DraftBillsHelper.getEventBilling(event, unitTTCRate, service);

    result.customerPrice = Number.parseFloat(result.customerPrice.toFixed(2));
    expect(result).toEqual({ customerPrice: 17.5, thirdPartyPayerPrice: 0 });
    sinon.assert.notCalled(getHourlyFundingSplit);
    sinon.assert.notCalled(getFixedFundingSplit);
    sinon.assert.notCalled(getEventSurcharges);
    sinon.assert.notCalled(getSurchargedPrice);
  });
});

describe('formatDraftBillsForCustomer', () => {
  let getInclTaxes;

  beforeEach(() => {
    getInclTaxes = sinon.stub(DraftBillsHelper, 'getInclTaxes');
  });

  afterEach(() => {
    getInclTaxes.restore();
  });

  it('should format bill for customer', () => {
    const customerPrices = { exclTaxes: 20, inclTaxes: 25, hours: 3, eventsList: [{ event: '123456' }] };
    const event = {
      _id: 'abc',
      startDate: (new Date('2019/05/08')).setHours(8),
      endDate: (new Date('2019/05/08')).setHours(10),
    };
    const service = { vat: 20 };
    const eventPrice = { customerPrice: 17.5 };

    getInclTaxes.returns(21);

    const result = DraftBillsHelper.formatDraftBillsForCustomer(customerPrices, event, eventPrice, service);

    expect(result).toMatchObject({
      eventsList: [
        { event: '123456' },
        { event: 'abc', inclTaxesCustomer: 21, exclTaxesCustomer: 17.5 },
      ],
      hours: 5,
      exclTaxes: 37.5,
      inclTaxes: 46,
    });
    sinon.assert.calledOnceWithExactly(getInclTaxes, 17.5, 20);
  });

  it('should format bill for customer with surcharge', () => {
    const customerPrices = { exclTaxes: 20, inclTaxes: 25, hours: 3, eventsList: [{ event: '123456' }] };
    const event = {
      _id: 'abc',
      startDate: (new Date('2019/05/08')).setHours(8),
      endDate: (new Date('2019/05/08')).setHours(10),
    };
    const service = { vat: 20 };
    const eventPrice = { customerPrice: 17.5, surcharges: [{ name: 'test' }] };

    getInclTaxes.returns(21);

    const result = DraftBillsHelper.formatDraftBillsForCustomer(customerPrices, event, eventPrice, service);

    expect(result).toMatchObject({
      eventsList: [
        { event: '123456' },
        { event: 'abc', inclTaxesCustomer: 21, exclTaxesCustomer: 17.5, surcharges: [{ name: 'test' }] },
      ],
      hours: 5,
      exclTaxes: 37.5,
      inclTaxes: 46,
    });
    sinon.assert.calledOnceWithExactly(getInclTaxes, 17.5, 20);
  });

  it('should format bill for customer with tpp info', () => {
    const customerPrices = { exclTaxes: 20, inclTaxes: 25, hours: 3, eventsList: [{ event: '123456' }] };
    const event = {
      _id: 'abc',
      startDate: (new Date('2019/05/08')).setHours(8),
      endDate: (new Date('2019/05/08')).setHours(10),
    };
    const service = { vat: 20 };
    const eventPrice = { customerPrice: 17.5, thirdPartyPayerPrice: 12.5, thirdPartyPayer: 'tpp' };
    getInclTaxes.onCall(0).returns(21);
    getInclTaxes.onCall(1).returns(15);

    const result = DraftBillsHelper.formatDraftBillsForCustomer(customerPrices, event, eventPrice, service);

    expect(result).toMatchObject({
      eventsList: [
        { event: '123456' },
        {
          event: 'abc',
          inclTaxesCustomer: 21,
          exclTaxesCustomer: 17.5,
          exclTaxesTpp: 12.5,
          inclTaxesTpp: 15,
          thirdPartyPayer: 'tpp',
        },
      ],
      hours: 5,
      exclTaxes: 37.5,
      inclTaxes: 46,
    });
    sinon.assert.calledWithExactly(getInclTaxes.getCall(0), 17.5, 20);
    sinon.assert.calledWithExactly(getInclTaxes.getCall(1), 12.5, 20);
  });
});

describe('computeBillingInfoForEvents', () => {
  let getMatchingVersion;
  let getMatchingFunding;
  let getEventBilling;
  let formatDraftBillsForCustomer;
  let formatDraftBillsForTPP;

  beforeEach(() => {
    getMatchingVersion = sinon.stub(UtilsHelper, 'getMatchingVersion');
    getMatchingFunding = sinon.stub(FundingsHelper, 'getMatchingFunding');
    getEventBilling = sinon.stub(DraftBillsHelper, 'getEventBilling');
    formatDraftBillsForCustomer = sinon.stub(DraftBillsHelper, 'formatDraftBillsForCustomer');
    formatDraftBillsForTPP = sinon.stub(DraftBillsHelper, 'formatDraftBillsForTPP');
  });

  afterEach(() => {
    getMatchingVersion.restore();
    getMatchingFunding.restore();
    getEventBilling.restore();
    formatDraftBillsForCustomer.restore();
    formatDraftBillsForTPP.restore();
  });

  it('should compute info for each event', () => {
    const events = [{ startDate: '2021-02-04T12:00:00.000Z' }, { startDate: '2021-03-05T10:00:00.000Z' }];
    const service = { _id: new ObjectID() };
    const fundings = [];
    const startDate = moment('2021/03/01', 'YYYY/MM/DD');

    const matchingService = { ...service, name: 'test' };
    getMatchingVersion.returns(matchingService);
    getEventBilling.onCall(0).returns({ customerPrice: 20 });
    getEventBilling.onCall(1).returns({ customerPrice: 15 });
    formatDraftBillsForCustomer.onCall(0).returns({ exclTaxes: 12, inclTaxes: 15, hours: 2, eventsList: [events[0]] });
    formatDraftBillsForCustomer.onCall(1).returns({ exclTaxes: 45, inclTaxes: 50, hours: 6, eventsList: events });

    const result = DraftBillsHelper.computeBillingInfoForEvents(events, service, fundings, startDate, 12);

    expect(result).toEqual({
      customerPrices: { exclTaxes: 45, inclTaxes: 50, hours: 6, eventsList: events },
      thirdPartyPayerPrices: {},
      startDate: moment('2021-02-04T12:00:00.000Z'),
    });
    sinon.assert.calledWithExactly(getMatchingVersion.getCall(0), events[0].startDate, service, 'startDate');
    sinon.assert.calledWithExactly(getMatchingVersion.getCall(1), events[1].startDate, service, 'startDate');
    sinon.assert.calledWithExactly(getEventBilling.getCall(0), events[0], 12, matchingService, null);
    sinon.assert.calledWithExactly(getEventBilling.getCall(1), events[1], 12, matchingService, null);
    sinon.assert.calledWithExactly(
      formatDraftBillsForCustomer.getCall(0),
      { exclTaxes: 0, inclTaxes: 0, hours: 0, eventsList: [] },
      events[0],
      { customerPrice: 20 },
      matchingService
    );
    sinon.assert.calledWithExactly(
      formatDraftBillsForCustomer.getCall(1),
      { exclTaxes: 12, inclTaxes: 15, hours: 2, eventsList: [events[0]] },
      events[1],
      { customerPrice: 15 },
      matchingService
    );
    sinon.assert.notCalled(getMatchingFunding);
    sinon.assert.notCalled(formatDraftBillsForTPP);
  });

  it('should compute info with fundings', () => {
    const events = [
      { startDate: '2021-03-04T12:00:00.000Z' },
      { startDate: '2021-03-05T10:00:00.000Z' },
      { startDate: '2021-03-06T10:00:00.000Z' },
    ];
    const service = { _id: new ObjectID() };
    const fundings = [{ _id: new ObjectID() }];
    const startDate = moment('2021/03/01', 'YYYY/MM/DD');

    const matchingService = { ...service, name: 'test' };
    getMatchingVersion.returns(matchingService);
    const matchingFunding = { ...fundings[0], thirdPartyPayer: 'tpp' };
    getMatchingFunding.onCall(0).returns(null);
    getMatchingFunding.onCall(1).returns(matchingFunding);
    getMatchingFunding.onCall(2).returns(matchingFunding);
    getEventBilling.onCall(0).returns({ customerPrice: 20 });
    getEventBilling.onCall(1).returns({ customerPrice: 15, thirdPartyPayerPrice: 12 });
    getEventBilling.onCall(2).returns({ customerPrice: 17, thirdPartyPayerPrice: 15 });
    formatDraftBillsForCustomer.onCall(0).returns({ exclTaxes: 12, inclTaxes: 15, hours: 2, eventsList: [events[0]] });
    formatDraftBillsForCustomer.onCall(1).returns({
      exclTaxes: 45,
      inclTaxes: 50,
      hours: 6,
      eventsList: [events[0], events[1]],
    });
    formatDraftBillsForCustomer.onCall(2).returns({ exclTaxes: 60, inclTaxes: 75, hours: 8, eventsList: events });
    formatDraftBillsForTPP.onCall(0).returns({
      [fundings[0]._id]: { exclTaxes: 21, inclTaxes: 23, hours: 2, eventsList: [events[1]] },
    });
    formatDraftBillsForTPP.onCall(1).returns({
      [fundings[0]._id]: { exclTaxes: 42, inclTaxes: 46, hours: 4, eventsList: [events[1], events[2]] },
    });

    const result = DraftBillsHelper.computeBillingInfoForEvents(events, service, fundings, startDate, 12);

    expect(result).toEqual({
      customerPrices: { exclTaxes: 60, inclTaxes: 75, hours: 8, eventsList: events },
      thirdPartyPayerPrices: {
        [fundings[0]._id]: { exclTaxes: 42, inclTaxes: 46, hours: 4, eventsList: [events[1], events[2]] },
      },
      startDate,
    });
    sinon.assert.calledWithExactly(getMatchingVersion.getCall(0), events[0].startDate, service, 'startDate');
    sinon.assert.calledWithExactly(getMatchingVersion.getCall(1), events[1].startDate, service, 'startDate');
    sinon.assert.calledWithExactly(getMatchingVersion.getCall(2), events[2].startDate, service, 'startDate');
    sinon.assert.calledWithExactly(getMatchingFunding.getCall(0), events[0].startDate, fundings);
    sinon.assert.calledWithExactly(getMatchingFunding.getCall(1), events[1].startDate, fundings);
    sinon.assert.calledWithExactly(getMatchingFunding.getCall(2), events[2].startDate, fundings);
    sinon.assert.calledWithExactly(getEventBilling.getCall(0), events[0], 12, matchingService, null);
    sinon.assert.calledWithExactly(getEventBilling.getCall(1), events[1], 12, matchingService, matchingFunding);
    sinon.assert.calledWithExactly(getEventBilling.getCall(2), events[2], 12, matchingService, matchingFunding);
    sinon.assert.calledWithExactly(
      formatDraftBillsForCustomer.getCall(0),
      { exclTaxes: 0, inclTaxes: 0, hours: 0, eventsList: [] },
      events[0],
      { customerPrice: 20 },
      matchingService
    );
    sinon.assert.calledWithExactly(
      formatDraftBillsForCustomer.getCall(1),
      { exclTaxes: 12, inclTaxes: 15, hours: 2, eventsList: [events[0]] },
      events[1],
      { customerPrice: 15, thirdPartyPayerPrice: 12 },
      matchingService
    );
    sinon.assert.calledWithExactly(
      formatDraftBillsForCustomer.getCall(2),
      { exclTaxes: 45, inclTaxes: 50, hours: 6, eventsList: [events[0], events[1]] },
      events[2],
      { customerPrice: 17, thirdPartyPayerPrice: 15 },
      matchingService
    );
    sinon.assert.calledWithExactly(
      formatDraftBillsForTPP.getCall(0),
      {},
      'tpp',
      events[1],
      { customerPrice: 15, thirdPartyPayerPrice: 12 },
      matchingService
    );
    sinon.assert.calledWithExactly(
      formatDraftBillsForTPP.getCall(1),
      { [fundings[0]._id]: { exclTaxes: 21, inclTaxes: 23, hours: 2, eventsList: [events[1]] } },
      'tpp',
      events[2],
      { customerPrice: 17, thirdPartyPayerPrice: 15 },
      matchingService
    );
  });

  it('should return empty infos if no event', () => {
    const startDate = moment('2021/01/01', 'YYYY/MM/DD');
    const result = DraftBillsHelper.computeBillingInfoForEvents([], { _id: new ObjectID() }, [], startDate, 0);

    expect(result).toEqual({
      customerPrices: { exclTaxes: 0, inclTaxes: 0, hours: 0, eventsList: [] },
      thirdPartyPayerPrices: {},
      startDate,
    });
    sinon.assert.notCalled(getMatchingVersion);
    sinon.assert.notCalled(getMatchingFunding);
    sinon.assert.notCalled(getEventBilling);
    sinon.assert.notCalled(formatDraftBillsForCustomer);
    sinon.assert.notCalled(formatDraftBillsForTPP);
  });
});

describe('formatDraftBillsForTPP', () => {
  let getInclTaxes;
  beforeEach(() => {
    getInclTaxes = sinon.stub(DraftBillsHelper, 'getInclTaxes');
  });
  afterEach(() => {
    getInclTaxes.restore();
  });

  it('should format bill for tpp', () => {
    const tppId = new ObjectID();
    const tpp = { _id: tppId };
    const tppPrices = {
      [tppId]: { exclTaxes: 20, inclTaxes: 25, hours: 3, eventsList: [{ event: '123456' }] },
    };
    const event = {
      _id: 'abc',
      startDate: (new Date('2019/05/08')).setHours(8),
      endDate: (new Date('2019/05/08')).setHours(10),
    };
    const eventPrice = {
      customerPrice: 17.5,
      thirdPartyPayerPrice: 12.5,
      thirdPartyPayer: tppId,
      history: {},
      chargedTime: 120,
    };
    const service = { vat: 20 };
    getInclTaxes.callsFake((exclTaxes, vat) => exclTaxes * (1 + (vat / 100)));

    const result = DraftBillsHelper.formatDraftBillsForTPP(tppPrices, tpp, event, eventPrice, service);

    expect(result[tppId].exclTaxes).toEqual(32.5);
    expect(result[tppId].inclTaxes).toEqual(40);
    expect(result[tppId].hours).toEqual(5);
    expect(result[tppId].eventsList).toMatchObject([
      { event: '123456' },
      {
        event: 'abc',
        inclTaxesTpp: 15,
        exclTaxesTpp: 12.5,
        thirdPartyPayer: tppId,
        inclTaxesCustomer: 21,
        exclTaxesCustomer: 17.5,
      },
    ]);
  });
});

describe('getDraftBillsPerSubscription', () => {
  let getLastVersion;
  let getMatchingVersion;
  let getExclTaxes;
  let computeBillingInfoForEvents;
  beforeEach(() => {
    getLastVersion = sinon.stub(UtilsHelper, 'getLastVersion');
    getMatchingVersion = sinon.stub(UtilsHelper, 'getMatchingVersion');
    getExclTaxes = sinon.stub(DraftBillsHelper, 'getExclTaxes');
    computeBillingInfoForEvents = sinon.stub(DraftBillsHelper, 'computeBillingInfoForEvents');
  });
  afterEach(() => {
    getLastVersion.restore();
    getMatchingVersion.restore();
    getExclTaxes.restore();
    computeBillingInfoForEvents.restore();
  });

  it('should return draft bill', () => {
    const tppId = new ObjectID();
    const fundings = [{ thirdPartyPayer: { _id: tppId } }];
    const events = [
      { _id: 1, startDate: new Date('2019/02/15').setHours(8), endDate: new Date('2019/02/15').setHours(10) },
    ];
    const subscription = {
      versions: [{ startDate: new Date('2019/01/01'), unitTTCRate: 21 }],
      service: { versions: [{ startDate: new Date('2019/01/01'), vat: 20 }] },
    };

    getLastVersion.returns({ startDate: new Date('2019/01/01'), unitTTCRate: 21 });
    getMatchingVersion.returns({ startDate: new Date('2019/01/01'), vat: 20 });
    getExclTaxes.returns(70);
    computeBillingInfoForEvents.returns({
      customerPrices: { exclTaxes: 35 },
      thirdPartyPayerPrices: { [tppId]: { hours: 3 } },
      startDate: moment('2019/02/01', 'YY/MM/DD'),
    });

    const result =
      DraftBillsHelper.getDraftBillsPerSubscription(events, subscription, fundings, '2019/02/01', '2019/03/01');

    expect(result.customer.exclTaxes).toEqual(35);
    expect(result.customer.unitExclTaxes).toEqual(70);
    expect(result.customer.unitInclTaxes).toEqual(21);
    expect(result.thirdPartyPayer[tppId].hours).toEqual(3);
    sinon.assert.calledOnceWithExactly(
      getLastVersion,
      [{ startDate: new Date('2019/01/01'), unitTTCRate: 21 }],
      'createdAt'
    );
    sinon.assert.calledOnceWithExactly(getMatchingVersion, '2019/03/01', subscription.service, 'startDate');
    sinon.assert.calledOnceWithExactly(getExclTaxes, 21, 20);
    sinon.assert.calledOnceWithExactly(
      computeBillingInfoForEvents,
      events,
      subscription.service,
      fundings,
      '2019/02/01',
      21
    );
  });

  it('should return draft bill for customer only', () => {
    const events = [
      { _id: 1, startDate: new Date('2019/02/15').setHours(8), endDate: new Date('2019/02/15').setHours(10) },
    ];
    const subscription = {
      versions: [{ startDate: new Date('2019/01/01'), unitTTCRate: 21 }],
      service: { versions: [{ startDate: new Date('2019/01/01'), vat: 20 }] },
    };

    getLastVersion.returns({ startDate: new Date('2019/01/01'), unitTTCRate: 21 });
    getMatchingVersion.returns({ startDate: new Date('2019/01/01'), vat: 20 });
    getExclTaxes.returns(70);
    computeBillingInfoForEvents.returns({
      customerPrices: { exclTaxes: 35 },
      startDate: moment('2019/02/01', 'YY/MM/DD'),
    });

    const result =
      DraftBillsHelper.getDraftBillsPerSubscription(events, subscription, null, '2019/02/01', '2019/03/01');

    expect(result.customer.exclTaxes).toEqual(35);
    expect(result.customer.unitExclTaxes).toEqual(70);
    expect(result.customer.unitInclTaxes).toEqual(21);
    sinon.assert.calledOnceWithExactly(
      getLastVersion,
      [{ startDate: new Date('2019/01/01'), unitTTCRate: 21 }],
      'createdAt'
    );
    sinon.assert.calledOnceWithExactly(getMatchingVersion, '2019/03/01', subscription.service, 'startDate');
    sinon.assert.calledOnceWithExactly(getExclTaxes, 21, 20);
    sinon.assert.calledOnceWithExactly(
      computeBillingInfoForEvents,
      events,
      subscription.service,
      null,
      '2019/02/01',
      21
    );
  });

  it('should return draft bill for tpp only', () => {
    const tppId = new ObjectID();
    const fundings = [{ thirdPartyPayer: { _id: tppId } }];
    const events = [
      { _id: 1, startDate: new Date('2019/02/15').setHours(8), endDate: new Date('2019/02/15').setHours(10) },
    ];
    const subscription = {
      versions: [{ startDate: new Date('2019/01/01'), unitTTCRate: 21 }],
      service: { versions: [{ startDate: new Date('2019/01/01'), vat: 20 }] },
    };

    getLastVersion.returns({ startDate: new Date('2019/01/01'), unitTTCRate: 21 });
    getMatchingVersion.returns({ startDate: new Date('2019/01/01'), vat: 20 });
    getExclTaxes.returns(70);
    computeBillingInfoForEvents.returns({
      customerPrices: { exclTaxes: 0 },
      thirdPartyPayerPrices: { [tppId]: { hours: 3 } },
      startDate: moment('2019/02/01', 'YY/MM/DD'),
    });

    const result =
      DraftBillsHelper.getDraftBillsPerSubscription(events, subscription, fundings, '2019/02/01', '2019/03/01');

    expect(result.customer).toBeUndefined();
    expect(result.thirdPartyPayer[tppId].hours).toEqual(3);
    sinon.assert.calledOnceWithExactly(
      getLastVersion,
      [{ startDate: new Date('2019/01/01'), unitTTCRate: 21 }],
      'createdAt'
    );
    sinon.assert.calledOnceWithExactly(getMatchingVersion, '2019/03/01', subscription.service, 'startDate');
    sinon.assert.calledOnceWithExactly(getExclTaxes, 21, 20);
    sinon.assert.calledOnceWithExactly(
      computeBillingInfoForEvents,
      events,
      subscription.service,
      fundings,
      '2019/02/01',
      21
    );
  });
});

describe('getDraftBillsList', () => {
  const dates = { endDate: '2019-12-25T07:00:00' };
  const billingStartDate = '2019-12-31T07:00:00';
  let findThirdPartyPayer;
  let getEventsToBill;
  let populateSurcharge;
  let populateFundings;
  let getDraftBillsPerSubscription;
  beforeEach(() => {
    findThirdPartyPayer = sinon.stub(ThirdPartyPayer, 'find');
    getEventsToBill = sinon.stub(EventRepository, 'getEventsToBill');
    populateSurcharge = sinon.stub(DraftBillsHelper, 'populateSurcharge');
    populateFundings = sinon.stub(DraftBillsHelper, 'populateFundings');
    getDraftBillsPerSubscription = sinon.stub(DraftBillsHelper, 'getDraftBillsPerSubscription');
  });
  afterEach(() => {
    findThirdPartyPayer.restore();
    getEventsToBill.restore();
    populateSurcharge.restore();
    populateFundings.restore();
    getDraftBillsPerSubscription.restore();
  });

  it('should return empty array if not event to bill', async () => {
    getEventsToBill.returns([]);

    const companyId = new ObjectID();
    findThirdPartyPayer.returns(SinonMongoose.stubChainedQueries([null], ['lean']));

    const credentials = { company: { _id: companyId } };
    const result = await DraftBillsHelper.getDraftBillsList(dates, billingStartDate, credentials, null);

    expect(result).toEqual([]);
    SinonMongoose.calledWithExactly(findThirdPartyPayer, [
      { query: 'find', args: [{ company: companyId }] },
      { query: 'lean' },
    ]);
    sinon.assert.calledWithExactly(getEventsToBill, dates, null, credentials.company._id);
    sinon.assert.notCalled(populateSurcharge);
    sinon.assert.notCalled(populateFundings);
    sinon.assert.notCalled(getDraftBillsPerSubscription);
  });

  it('should return customer and tpp draft bills', async () => {
    getEventsToBill.returns([
      {
        customer: { _id: 'ghjk', identity: { firstname: 'Toto' } },
        eventsBySubscriptions: [
          {
            subscription: { _id: '1234567890' },
            events: [{ type: 'intervention', _id: '1234' }],
            fundings: [{ nature: 'hourly' }],
          },
          {
            subscription: { _id: '0987654321' },
            events: [{ type: 'intervention', _id: '5678' }],
            fundings: [{ nature: 'fixed' }],
          },
        ],
      },
    ]);
    populateSurcharge.returnsArg(0);
    populateFundings.returnsArg(0);
    getDraftBillsPerSubscription.onCall(0).returns({
      customer: { identity: { firstname: 'Toto' }, inclTaxes: 20 },
      thirdPartyPayer: {
        tpp: { inclTaxes: 13 },
      },
    });
    getDraftBillsPerSubscription.onCall(1).returns({
      customer: { identity: { firstname: 'Toto' }, inclTaxes: 21 },
      thirdPartyPayer: {
        tpp: { inclTaxes: 24 },
      },
    });

    const companyId = new ObjectID();
    const thirdPartyPayersList = [{ id: new ObjectID() }];
    findThirdPartyPayer.returns(SinonMongoose.stubChainedQueries([thirdPartyPayersList], ['lean']));

    const credentials = { company: { _id: companyId } };
    const result = await DraftBillsHelper.getDraftBillsList(dates, billingStartDate, credentials, null);

    expect(result).toEqual([
      {
        customer: { _id: 'ghjk', identity: { firstname: 'Toto' } },
        endDate: '2019-12-25T07:00:00',
        customerBills: {
          bills: [
            { identity: { firstname: 'Toto' }, inclTaxes: 20 },
            { identity: { firstname: 'Toto' }, inclTaxes: 21 },
          ],
          total: 41,
        },
        thirdPartyPayerBills: [{
          bills: [
            { inclTaxes: 13 },
            { inclTaxes: 24 },
          ],
          total: 37,
        }],
      },
    ]);
    sinon.assert.calledWithExactly(getEventsToBill, dates, null, credentials.company._id);
    sinon.assert.calledWithExactly(populateSurcharge.firstCall, { _id: '1234567890' }, companyId);
    sinon.assert.calledWithExactly(populateSurcharge.secondCall, { _id: '0987654321' }, companyId);
    sinon.assert.calledWithExactly(
      populateFundings.firstCall,
      [{ nature: 'hourly' }],
      '2019-12-25T07:00:00',
      thirdPartyPayersList,
      companyId
    );
    sinon.assert.calledWithExactly(
      populateFundings.secondCall,
      [{ nature: 'fixed' }],
      '2019-12-25T07:00:00',
      thirdPartyPayersList,
      companyId
    );
    sinon.assert.calledWithExactly(
      getDraftBillsPerSubscription.firstCall,
      [{ type: 'intervention', _id: '1234' }],
      { _id: '1234567890' },
      [{ nature: 'hourly' }],
      billingStartDate,
      '2019-12-25T07:00:00'
    );
    sinon.assert.calledWithExactly(
      getDraftBillsPerSubscription.secondCall,
      [{ type: 'intervention', _id: '5678' }],
      { _id: '0987654321' },
      [{ nature: 'fixed' }],
      billingStartDate,
      '2019-12-25T07:00:00'
    );
    SinonMongoose.calledWithExactly(findThirdPartyPayer, [
      { query: 'find', args: [{ company: companyId }] },
      { query: 'lean' },
    ]);
  });

  it('should return customer draft bills', async () => {
    getEventsToBill.returns([
      {
        customer: { _id: 'ghjk', identity: { firstname: 'Toto' } },
        eventsBySubscriptions: [
          { subscription: { _id: '1234567890' }, events: [{ type: 'intervention', _id: '1234' }] },
          { subscription: { _id: '0987654321' }, events: [{ type: 'intervention', _id: '5678' }] },
        ],
      },
      {
        customer: { _id: 'asdf', identity: { firstname: 'Tata' } },
        eventsBySubscriptions: [
          { subscription: { _id: 'qwertyuiop' }, events: [{ type: 'intervention', _id: '9876' }] },
        ],
      },
    ]);
    populateSurcharge.returnsArg(0);
    getDraftBillsPerSubscription.onCall(0).returns({ customer: { identity: { firstname: 'Toto' }, inclTaxes: 20 } });
    getDraftBillsPerSubscription.onCall(1).returns({ customer: { identity: { firstname: 'Toto' }, inclTaxes: 21 } });
    getDraftBillsPerSubscription.onCall(2).returns({ customer: { identity: { firstname: 'Tata' }, inclTaxes: 23 } });

    const companyId = new ObjectID();
    findThirdPartyPayer.returns(SinonMongoose.stubChainedQueries([null], ['lean']));

    const credentials = { company: { _id: companyId } };
    const result = await DraftBillsHelper.getDraftBillsList(dates, billingStartDate, credentials, null);

    expect(result).toEqual([
      {
        customer: { _id: 'ghjk', identity: { firstname: 'Toto' } },
        endDate: '2019-12-25T07:00:00',
        customerBills: {
          bills: [
            { identity: { firstname: 'Toto' }, inclTaxes: 20 },
            { identity: { firstname: 'Toto' }, inclTaxes: 21 },
          ],
          total: 41,
        },
      },
      {
        endDate: '2019-12-25T07:00:00',
        customer: { _id: 'asdf', identity: { firstname: 'Tata' } },
        customerBills: {
          bills: [
            { identity: { firstname: 'Tata' }, inclTaxes: 23 },
          ],
          total: 23,
        },
      },
    ]);
    sinon.assert.calledWithExactly(getEventsToBill, dates, null, credentials.company._id);
    sinon.assert.calledWithExactly(populateSurcharge.firstCall, { _id: '1234567890' }, companyId);
    sinon.assert.calledWithExactly(populateSurcharge.secondCall, { _id: '0987654321' }, companyId);
    sinon.assert.calledWithExactly(populateSurcharge.thirdCall, { _id: 'qwertyuiop' }, companyId);
    sinon.assert.notCalled(populateFundings);
    sinon.assert.calledWithExactly(
      getDraftBillsPerSubscription.firstCall,
      [{ type: 'intervention', _id: '1234' }],
      { _id: '1234567890' },
      null,
      billingStartDate,
      '2019-12-25T07:00:00'
    );
    sinon.assert.calledWithExactly(
      getDraftBillsPerSubscription.secondCall,
      [{ type: 'intervention', _id: '5678' }],
      { _id: '0987654321' },
      null,
      billingStartDate,
      '2019-12-25T07:00:00'
    );
    sinon.assert.calledWithExactly(
      getDraftBillsPerSubscription.thirdCall,
      [{ type: 'intervention', _id: '9876' }],
      { _id: 'qwertyuiop' },
      null,
      billingStartDate,
      '2019-12-25T07:00:00'
    );
    SinonMongoose.calledWithExactly(findThirdPartyPayer, [
      { query: 'find', args: [{ company: companyId }] },
      { query: 'lean' },
    ]);
  });
});

describe('getSurchargedPrice', () => {
  const event = {
    startDate: '2019-06-29T10:00:00.000+02:00',
    endDate: '2019-06-29T16:00:00.000+02:00',
  };

  it('should return the price if there is no surcharge', () => {
    expect(DraftBillsHelper.getSurchargedPrice(event, [], 11)).toBe(11);
  });

  it('should return the price surcharged globally', () => {
    const surcharges = [{ percentage: 25 }];
    expect(DraftBillsHelper.getSurchargedPrice(event, surcharges, 10)).toBe(12.5);
  });

  it('should return the price surcharged once', () => {
    const surcharges = [{
      percentage: 25,
      startHour: moment(event.startDate).add(1, 'h'),
      endHour: moment(event.startDate).add(2, 'h'),
    }];
    expect(DraftBillsHelper.getSurchargedPrice(event, surcharges, 24)).toBe(25);
  });

  it('should return the price surcharged twice', () => {
    const surcharges = [{
      percentage: 25,
      startHour: moment(event.startDate).add(1, 'h'),
      endHour: moment(event.startDate).add(2, 'h'),
    }, {
      percentage: 20,
      startHour: moment(event.startDate).add(2, 'h'),
      endHour: moment(event.startDate).add(4, 'h'),
    }];
    expect(DraftBillsHelper.getSurchargedPrice(event, surcharges, 24)).toBe(26.6);
  });
});
