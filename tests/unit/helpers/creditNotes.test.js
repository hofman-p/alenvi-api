const { ObjectID } = require('mongodb');
const expect = require('expect');
const sinon = require('sinon');
const FundingHistory = require('../../../src/models/FundingHistory');
const CreditNoteNumber = require('../../../src/models/CreditNoteNumber');
const CreditNote = require('../../../src/models/CreditNote');
const Event = require('../../../src/models/Event');
const CreditNoteHelper = require('../../../src/helpers/creditNotes');
const UtilsHelper = require('../../../src/helpers/utils');
const PdfHelper = require('../../../src/helpers/pdf');
const moment = require('moment');

describe('updateEventAndFundingHistory', () => {
  let findOneAndUpdate = null;
  let find = null;
  let save = null;
  beforeEach(() => {
    findOneAndUpdate = sinon.stub(FundingHistory, 'findOneAndUpdate');
    find = sinon.stub(Event, 'find');
    save = sinon.stub(Event.prototype, 'save');
  });
  afterEach(() => {
    findOneAndUpdate.restore();
    find.restore();
    save.restore();
  });

  it('should increment history for hourly and once funding', async () => {
    const fundingId = new ObjectID();
    const events = [
      new Event({
        bills: { nature: 'hourly', fundingId, thirdPartyPayer: new ObjectID(), careHours: 3 },
        startDate: new Date('2019/01/19'),
      }),
    ];

    find.returns(events);
    findOneAndUpdate.returns(null);

    await CreditNoteHelper.updateEventAndFundingHistory([], false);
    sinon.assert.callCount(findOneAndUpdate, 2);
    sinon.assert.calledWith(
      findOneAndUpdate.firstCall,
      { fundingId, month: '01/2019' },
      { $inc: { careHours: -3 } }
    );
    sinon.assert.calledWith(
      findOneAndUpdate.secondCall,
      { fundingId },
      { $inc: { careHours: -3 } }
    );
  });

  it('should increment history for hourly and monthly funding', async () => {
    const fundingId = new ObjectID();
    const events = [
      new Event({
        bills: { nature: 'hourly', fundingId, thirdPartyPayer: new ObjectID(), careHours: 3 },
        startDate: new Date('2019/01/19'),
      }),
    ];

    find.returns(events);
    findOneAndUpdate.returns(new FundingHistory());

    await CreditNoteHelper.updateEventAndFundingHistory([], false);
    sinon.assert.callCount(findOneAndUpdate, 1);
    sinon.assert.calledWith(
      findOneAndUpdate,
      { fundingId, month: '01/2019' },
      { $inc: { careHours: -3 } }
    );
  });

  it('should decrement history for hourly and monthly funding', async () => {
    const fundingId = new ObjectID();
    const events = [
      new Event({
        bills: { nature: 'hourly', fundingId, thirdPartyPayer: new ObjectID(), careHours: 3 },
        startDate: new Date('2019/01/19'),
      }),
    ];

    find.returns(events);
    findOneAndUpdate.returns(null);

    await CreditNoteHelper.updateEventAndFundingHistory([], true);
    sinon.assert.callCount(findOneAndUpdate, 2);
    sinon.assert.calledWith(
      findOneAndUpdate.firstCall,
      { fundingId, month: '01/2019' },
      { $inc: { careHours: 3 } }
    );
  });

  it('should increment history for fixed and once funding', async () => {
    const fundingId = new ObjectID();
    const events = [
      new Event({
        bills: { nature: 'fixed', fundingId, thirdPartyPayer: new ObjectID(), inclTaxesTpp: 666 },
        startDate: new Date('2019/01/19'),
      }),
    ];

    find.returns(events);
    findOneAndUpdate.returns(new FundingHistory());

    await CreditNoteHelper.updateEventAndFundingHistory([], false);
    sinon.assert.callCount(findOneAndUpdate, 1);
    sinon.assert.calledWith(
      findOneAndUpdate,
      { fundingId },
      { $inc: { amountTTC: -666 } }
    );
  });
});

describe('formatPDF', () => {
  let getMatchingVersion;
  let formatPrice;
  let formatEventSurchargesForPdf;
  beforeEach(() => {
    getMatchingVersion = sinon.stub(UtilsHelper, 'getMatchingVersion').returns({ name: 'Toto' });
    formatPrice = sinon.stub(UtilsHelper, 'formatPrice');
    formatEventSurchargesForPdf = sinon.stub(PdfHelper, 'formatEventSurchargesForPdf');
  });

  afterEach(() => {
    getMatchingVersion.restore();
    formatPrice.restore();
    formatEventSurchargesForPdf.restore();
  });

  it('should format correct credit note PDF with events for customer', () => {
    const subId = new ObjectID();
    const creditNote = {
      number: 1,
      events: [{
        auxiliary: {
          identity: { firstname: 'Nathanaelle', lastname: 'Tata' },
        },
        startDate: '2019-04-29T06:00:00.000Z',
        endDate: '2019-04-29T15:00:00.000Z',
        serviceName: 'Toto',
        bills: { inclTaxesCustomer: 234, exclTaxesCustomer: 221, surcharges: [{ percentage: 30 }] },
      }],
      customer: {
        identity: { firstname: 'Toto', lastname: 'Bobo', title: 'Lolo' },
        contact: { primaryAddress: { fullAddress: 'La ruche' } },
        subscriptions: [{ _id: subId, service: { versions: [{ name: 'Toto' }] } }],
      },
      date: '2019-04-29T22:00:00.000Z',
      exclTaxesCustomer: 221,
      inclTaxesCustomer: 234,
      exclTaxesTpp: 21,
      inclTaxesTpp: 34,
    };

    const expectedResult = {
      creditNote: {
        number: 1,
        customer: {
          identity: { firstname: 'Toto', lastname: 'Bobo', title: 'Lolo' },
          contact: { primaryAddress: { fullAddress: 'La ruche' } },
        },
        forTpp: false,
        date: moment('2019-04-29T22:00:00.000Z').format('DD/MM/YYYY'),
        exclTaxes: '221,00 €',
        inclTaxes: '234,00 €',
        totalVAT: '13,00 €',
        formattedEvents: [{
          identity: 'N. Tata',
          date: moment('2019-04-29T06:00:00.000Z').format('DD/MM'),
          startTime: moment('2019-04-29T06:00:00.000Z').format('HH:mm'),
          endTime: moment('2019-04-29T15:00:00.000Z').format('HH:mm'),
          service: 'Toto',
          surcharges: [{ percentage: 30, startHour: '19h' }],
        }],
        recipient: {
          name: 'Lolo Toto Bobo',
          address: { fullAddress: 'La ruche' },
        },
        company: {},
        logo: 'https://res.cloudinary.com/alenvi/image/upload/v1507019444/images/business/alenvi_logo_complet_183x50.png',
      },
    };

    formatPrice.onCall(0).returns('13,00 €');
    formatPrice.onCall(1).returns('221,00 €');
    formatPrice.onCall(2).returns('234,00 €');
    formatEventSurchargesForPdf.returns([{ percentage: 30, startHour: '19h' }]);

    const result = CreditNoteHelper.formatPDF(creditNote, {});

    expect(result).toEqual(expectedResult);
    sinon.assert.calledWith(formatEventSurchargesForPdf, [{ percentage: 30 }]);
  });

  it('should format correct credit note PDF with events for tpp', () => {
    const subId = new ObjectID();
    const creditNote = {
      number: 1,
      events: [{
        auxiliary: {
          identity: { firstname: 'Nathanaelle', lastname: 'Tata' },
        },
        startDate: '2019-04-29T06:00:00.000Z',
        endDate: '2019-04-29T15:00:00.000Z',
        serviceName: 'Toto',
        bills: { inclTaxesTpp: 234, exclTaxesTpp: 221 },
      }],
      customer: {
        identity: { firstname: 'Toto', lastname: 'Bobo', title: 'Lolo' },
        contact: { primaryAddress: { fullAddress: 'La ruche' } },
        subscriptions: [{ _id: subId, service: { versions: [{ name: 'Toto' }] } }],
      },
      date: '2019-04-29T22:00:00.000Z',
      exclTaxesTpp: 21,
      inclTaxesTpp: 34,
      exclTaxesCustomer: 221,
      inclTaxesCustomer: 234,
      thirdPartyPayer: { name: 'tpp', address: { fullAddress: 'j\'habite ici' } },
    };

    const expectedResult = {
      creditNote: {
        number: 1,
        customer: {
          identity: { firstname: 'Toto', lastname: 'Bobo', title: 'Lolo' },
          contact: { primaryAddress: { fullAddress: 'La ruche' } },
        },
        forTpp: true,
        date: moment('2019-04-29T22:00:00.000Z').format('DD/MM/YYYY'),
        exclTaxes: '21,00 €',
        inclTaxes: '34,00 €',
        totalVAT: '13,00 €',
        formattedEvents: [{
          identity: 'N. Tata',
          date: moment('2019-04-29T06:00:00.000Z').format('DD/MM'),
          startTime: moment('2019-04-29T06:00:00.000Z').format('HH:mm'),
          endTime: moment('2019-04-29T15:00:00.000Z').format('HH:mm'),
          service: 'Toto',
        }],
        recipient: {
          name: 'tpp',
          address: { fullAddress: 'j\'habite ici' },
        },
        company: {},
        logo: 'https://res.cloudinary.com/alenvi/image/upload/v1507019444/images/business/alenvi_logo_complet_183x50.png',
      },
    };

    formatPrice.onCall(0).returns('13,00 €');
    formatPrice.onCall(1).returns('21,00 €');
    formatPrice.onCall(2).returns('34,00 €');

    const result = CreditNoteHelper.formatPDF(creditNote, {});

    expect(result).toBeDefined();
    expect(result).toEqual(expectedResult);
    sinon.assert.notCalled(formatEventSurchargesForPdf);
  });

  it('should format correct credit note PDF with subscription', () => {
    const creditNote = {
      number: 1,
      subscription: {
        service: {
          name: 'service',
        },
        unitInclTaxes: 12,
      },
      customer: {
        identity: { firstname: 'Toto', lastname: 'Bobo', title: 'Lolo' },
        contact: { primaryAddress: { fullAddress: 'La ruche' } },
      },
      date: '2019-04-29T22:00:00.000Z',
      exclTaxesTpp: 21,
      inclTaxesTpp: 34,
      exclTaxesCustomer: 221,
      inclTaxesCustomer: 234,
      thirdPartyPayer: { name: 'tpp', address: { fullAddress: 'j\'habite ici' } },
    };

    formatPrice.onCall(0).returns('12,00 €');

    const result = CreditNoteHelper.formatPDF(creditNote, {});

    expect(result).toBeDefined();
    expect(result.creditNote.subscription).toBeDefined();
    expect(result.creditNote.subscription.service).toBe('service');
    expect(result.creditNote.subscription.unitInclTaxes).toBe('12,00 €');
  });
});

describe('createCreditNotes', () => {
  let findOneAndUpdateNumber;
  let formatCreditNote;
  let insertManyCreditNote;
  let updateEventAndFundingHistory;
  beforeEach(() => {
    findOneAndUpdateNumber = sinon.stub(CreditNoteNumber, 'findOneAndUpdate');
    formatCreditNote = sinon.stub(CreditNoteHelper, 'formatCreditNote');
    insertManyCreditNote = sinon.stub(CreditNote, 'insertMany');
    updateEventAndFundingHistory = sinon.stub(CreditNoteHelper, 'updateEventAndFundingHistory');
  });
  afterEach(() => {
    findOneAndUpdateNumber.restore();
    formatCreditNote.restore();
    insertManyCreditNote.restore();
    updateEventAndFundingHistory.restore();
  });

  it('should create one credit note (for customer)', async () => {
    const payload = {
      date: '2019-07-30T00:00:00',
      inclTaxesCustomer: 123,
      thirdPartyPayer: 'qwertyuiop',
    };
    findOneAndUpdateNumber.returns({ seq: 1, prefix: 'Toto' });
    formatCreditNote.returns({ inclTaxesCustomer: 1234 });

    await CreditNoteHelper.createCreditNotes(payload);
    sinon.assert.calledWith(
      formatCreditNote,
      { date: '2019-07-30T00:00:00', inclTaxesCustomer: 123, exclTaxesTpp: 0, inclTaxesTpp: 0 },
      'Toto',
      1
    );
    sinon.assert.calledWith(insertManyCreditNote, [{ inclTaxesCustomer: 1234 }]);
    sinon.assert.notCalled(updateEventAndFundingHistory);
    sinon.assert.callCount(findOneAndUpdateNumber, 2);
  });

  it('should create one credit note (for tpp)', async () => {
    const payload = {
      date: '2019-07-30T00:00:00',
      inclTaxesTpp: 123,
      thirdPartyPayer: 'qwertyuiop',
      events: [{ _id: 'asdfghjkl' }],
    };
    findOneAndUpdateNumber.returns({ seq: 1, prefix: 'Toto' });
    formatCreditNote.returns({ inclTaxesTpp: 1234 });

    await CreditNoteHelper.createCreditNotes(payload);
    sinon.assert.calledWith(
      formatCreditNote,
      {
        date: '2019-07-30T00:00:00',
        events: [{ _id: 'asdfghjkl' }],
        inclTaxesTpp: 123,
        thirdPartyPayer: 'qwertyuiop',
        exclTaxesCustomer: 0,
        inclTaxesCustomer: 0,
      },
      'Toto',
      1
    );
    sinon.assert.calledWith(insertManyCreditNote, [{ inclTaxesTpp: 1234 }]);
    sinon.assert.calledWith(updateEventAndFundingHistory, [{ _id: 'asdfghjkl' }], false);
    sinon.assert.callCount(findOneAndUpdateNumber, 2);
  });

  it('should create two credit notes (for customer and tpp)', async () => {
    const payload = {
      date: '2019-07-30T00:00:00',
      inclTaxesTpp: 123,
      inclTaxesCustomer: 654,
      thirdPartyPayer: 'qwertyuiop',
    };
    findOneAndUpdateNumber.returns({ seq: 1, prefix: 'Toto' });
    formatCreditNote.onCall(0).returns({ _id: '1234', inclTaxesCustomer: 32 });
    formatCreditNote.onCall(1).returns({ _id: '0987', inclTaxesTpp: 1234 });

    await CreditNoteHelper.createCreditNotes(payload);
    sinon.assert.callCount(formatCreditNote, 2);
    sinon.assert.calledWith(
      insertManyCreditNote,
      [
        { _id: '0987', linkedCreditNote: '1234', inclTaxesTpp: 1234 },
        { _id: '1234', linkedCreditNote: '0987', inclTaxesCustomer: 32 },
      ]
    );
    sinon.assert.notCalled(updateEventAndFundingHistory);
    sinon.assert.callCount(findOneAndUpdateNumber, 2);
  });
});
