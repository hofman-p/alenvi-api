const { ObjectID } = require('mongodb');

const customerId = new ObjectID();
const companyId = new ObjectID();
const auxiliaryId = new ObjectID();
const tppId = new ObjectID();
const subscriptionId = new ObjectID();
const serviceId = new ObjectID();
const serviceVersionId = new ObjectID();
const eventId1 = new ObjectID();
const eventId2 = new ObjectID();
const fundingId = new ObjectID();
const surchargeId = new ObjectID();

const bills = [
  {
    customerId,
    customer: {
      _id: customerId,
      identity: {
        title: 'mrs',
        lastname: 'Test',
        firstname: 'Mauricette',
      },
    },
    endDate: '2019-11-30T22:59:59.999Z',
    customerBills: {
      total: 44.705720000000014,
      shouldBeSent: true,
      bills: [
        {
          _id: new ObjectID(),
          subscription: {
            _id: subscriptionId,
            service: {
              _id: serviceId,
              nature: 'hourly',
              createdAt: '2019-01-09 09:36:06.169',
              company: companyId,
              type: 'contract_with_company',
              versions: [
                {
                  exemptFromCharges: true,
                  _id: serviceVersionId,
                  name: 'Temps de qualité - autonomie',
                  startDate: '2019-06-29T22:00:00.000Z',
                  defaultUnitAmount: 20,
                  vat: 5.5,
                  surcharge: {
                    _id: surchargeId,
                    name: 'Majoration - Test',
                    saturday: null,
                    sunday: 25,
                    publicHoliday: 25,
                    twentyFifthOfDecember: 100,
                    firstOfMay: 100,
                    evening: 25,
                    eveningStartTime: '20:00',
                    eveningEndTime: '06:00',
                    custom: null,
                    customStartTime: null,
                    customEndTime: null,
                    company: companyId,
                  },
                  createdAt: '2019-07-01T19:03:39.220Z',
                },
              ],
            },
          },
          discount: 0,
          startDate: '2019-11-14T23:00:00.000Z',
          endDate: '2019-11-30T22:59:59.999Z',
          unitExclTaxes: 21.59241706161138,
          unitInclTaxes: 22.78,
          vat: 5.5,
          eventsList: [
            {
              event: eventId1,
              startDate: '2019-11-22T14:00:00.000Z',
              endDate: '2019-11-22T16:00:00.000Z',
              auxiliary: auxiliaryId,
              inclTaxesCustomer: 22.352860000000007,
              exclTaxesCustomer: 21.18754502369669,
              inclTaxesTpp: 23.20714,
              exclTaxesTpp: 21.997289099526068,
              thirdPartyPayer: tppId,
            },
            {
              event: eventId2,
              startDate: '2019-11-29T14:00:00.000Z',
              endDate: '2019-11-29T16:00:00.000Z',
              auxiliary: auxiliaryId,
              inclTaxesCustomer: 22.352860000000007,
              exclTaxesCustomer: 21.18754502369669,
              inclTaxesTpp: 23.20714,
              exclTaxesTpp: 21.997289099526068,
              thirdPartyPayer: tppId,
            },
          ],
          hours: 4,
          exclTaxes: 42.37509004739338,
          inclTaxes: 44.705720000000014,
          discountEdition: false,
        },
      ],
    },
    thirdPartyPayerBills: [
      {
        bills: [
          {
            _id: new ObjectID(),
            subscription: {
              _id: subscriptionId,
              service: {
                _id: serviceId,
                nature: 'hourly',
                createdAt: '2019-01-09 09:36:06.169',
                company: '5c35c086119849001438a38d',
                type: 'contract_with_company',
                versions: [
                  {
                    exemptFromCharges: true,
                    _id: serviceVersionId,
                    name: 'Temps de qualité - autonomie',
                    startDate: '2019-06-29T22:00:00.000Z',
                    defaultUnitAmount: 20,
                    vat: 5.5,
                    surcharge: {
                      _id: surchargeId,
                      name: 'Majoration - Test',
                      saturday: null,
                      sunday: 25,
                      publicHoliday: 25,
                      twentyFifthOfDecember: 100,
                      firstOfMay: 100,
                      evening: 25,
                      eveningStartTime: '20:00',
                      eveningEndTime: '06:00',
                      custom: null,
                      customStartTime: null,
                      customEndTime: null,
                      company: companyId,
                    },
                    createdAt: '2019-07-01T19:03:39.220Z',
                  },
                ],
              },
            },
            discount: 0,
            startDate: '2019-11-14T23:00:00.000Z',
            endDate: '2019-11-30T22:59:59.999Z',
            unitExclTaxes: 21.59241706161138,
            unitInclTaxes: 22.78,
            vat: 5.5,
            exclTaxes: 43.994578199052135,
            inclTaxes: 46.41428,
            hours: 4,
            eventsList: [
              {
                event: eventId1,
                startDate: '2019-11-22T14:00:00.000Z',
                endDate: '2019-11-22T16:00:00.000Z',
                auxiliary: auxiliaryId,
                inclTaxesTpp: 23.20714,
                exclTaxesTpp: 21.997289099526068,
                thirdPartyPayer: tppId,
                inclTaxesCustomer: 22.352860000000007,
                exclTaxesCustomer: 21.18754502369669,
                history: {
                  careHours: 2,
                  fundingId,
                  nature: 'hourly',
                },
                fundingId,
                nature: 'hourly',
              },
              {
                event: eventId2,
                startDate: '2019-11-29T14:00:00.000Z',
                endDate: '2019-11-29T16:00:00.000Z',
                auxiliary: auxiliaryId,
                inclTaxesTpp: 23.20714,
                exclTaxesTpp: 21.997289099526068,
                thirdPartyPayer: tppId,
                inclTaxesCustomer: 22.352860000000007,
                exclTaxesCustomer: 21.18754502369669,
                history: {
                  careHours: 2,
                  fundingId,
                  nature: 'hourly',
                },
                fundingId,
                nature: 'hourly',
              },
            ],
            externalBilling: false,
            thirdPartyPayer: {
              _id: tppId,
              name: 'Tiers-payeur',
              unitTTCRate: 20.25,
              billingMode: 'direct',
              company: companyId,
            },
            discountEdition: false,
          },
        ],
        total: 46.41428,
      },
    ],
  },
];

module.exports = {
  customerId,
  tppId,
  companyId,
  bills,
};
