const expect = require('expect');
const moment = require('moment');

const app = require('../../server');
const { getToken } = require('./seed/usersSeed');
const { customersList, populateCustomers } = require('./seed/customersSeed');
const { thirdPartyPayersList, populateThirdPartyPayers } = require('./seed/thirdPartyPayersSeed');
const { paymentsList, populatePayments } = require('./seed/paymentsSeed');
const { PAYMENT, REFUND, PAYMENT_TYPES } = require('../../helpers/constants');
const translate = require('../../helpers/translate');
const Payment = require('../../models/Payment');

const { language } = translate;

describe('NODE ENV', () => {
  it("should be 'test'", () => {
    expect(process.env.NODE_ENV).toBe('test');
  });
});

describe('PAYMENTS ROUTES', () => {
  let token = null;
  before(populateCustomers);
  before(populateThirdPartyPayers);
  beforeEach(populatePayments);
  beforeEach(async () => {
    token = await getToken();
  });

  describe('GET /payments', () => {
    it('should get all payments', async () => {
      const res = await app.inject({
        method: 'GET',
        url: '/payments',
        headers: { 'x-access-token': token }
      });
      expect(res.statusCode).toBe(200);
      expect(res.result.data.payments.length).toBe(paymentsList.length);
    });
  });

  describe('POST /payments', () => {
    const origPayload = {
      date: moment().toDate(),
      customer: customersList[0]._id,
      client: thirdPartyPayersList[0]._id,
      netInclTaxes: 400,
      nature: PAYMENT,
      type: PAYMENT_TYPES[0]
    };
    const creationAssertions = [{ ...origPayload }, { ...origPayload, nature: REFUND }];

    creationAssertions.forEach((payload) => {
      it(`should create a ${payload.nature}`, async () => {
        const res = await app.inject({
          method: 'POST',
          url: '/payments',
          payload,
          headers: { 'x-access-token': token }
        });
        expect(res.statusCode).toBe(200);
        expect(res.result.message).toBe(translate[language].paymentCreated);
        expect(res.result.data.payment).toMatchObject(payload);
        expect(res.result.data.payment.number).toBe(payload.nature === PAYMENT ? `REG-${moment().format('YYMM')}001` : `REMB-${moment().format('YYMM')}001`);
        const payments = await Payment.find().lean();
        expect(payments.length).toBe(paymentsList.length + 1);
      });
    });

    const falsyAssertions = [
      {
        param: 'date',
        payload: { ...origPayload },
        update() {
          delete this.payload[this.param];
        },
      },
      {
        param: 'customer',
        payload: { ...origPayload },
        update() {
          delete this.payload[this.param];
        },
      },
      {
        param: 'netInclTaxes',
        payload: { ...origPayload },
        update() {
          delete this.payload[this.param];
        },
      },
      {
        param: 'nature',
        payload: { ...origPayload },
        update() {
          delete this.payload[this.param];
        },
      },
      {
        param: 'type',
        payload: { ...origPayload },
        update() {
          delete this.payload[this.param];
        },
      }
    ];

    falsyAssertions.forEach((test) => {
      it(`should return a 400 error if '${test.param}' param is missing`, async () => {
        test.update();
        const res = await app.inject({
          method: 'POST',
          url: '/payments',
          payload: test.payload,
          headers: { 'x-access-token': token }
        });
        expect(res.statusCode).toBe(400);
      });
    });
  });
});
