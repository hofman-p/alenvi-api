const { ObjectID } = require('mongodb');
const moment = require('moment');
const { authCompany } = require('./companySeed');
const { customerList } = require('./customerSeed');
const { thirdPartyPayerList } = require('./thirdPartyPayerSeed');
const { PAYMENT, REFUND } = require('../../src/helpers/constants');

const previousYear = moment().subtract(1, 'y').date(3);
const previousMonth = moment().subtract(1, 'M').date(5);
const paymentList = [
  {
    _id: new ObjectID(),
    company: authCompany._id,
    number: `REG-101${previousYear.format('MMYY')}00101`,
    date: previousYear.startOf('d').toDate(),
    customer: customerList[0]._id,
    netInclTaxes: 10,
    nature: PAYMENT,
    type: 'direct_debit',
  },
  {
    _id: new ObjectID(),
    company: authCompany._id,
    number: `REG-101${previousMonth.format('MMYY')}00201`,
    date: previousMonth.startOf('d').toDate(),
    customer: customerList[0]._id,
    netInclTaxes: 10,
    nature: PAYMENT,
    type: 'direct_debit',
  },
  {
    _id: new ObjectID(),
    company: authCompany._id,
    number: `REMB-101${previousMonth.format('MMYY')}00201`,
    date: previousMonth.startOf('d').toDate(),
    customer: customerList[0]._id,
    netInclTaxes: 5,
    nature: REFUND,
    type: 'bank_transfer',
  },
  {
    _id: new ObjectID(),
    company: authCompany._id,
    number: `REG-101${previousMonth.format('MMYY')}00202`,
    date: previousMonth.startOf('d').toDate(),
    customer: customerList[0]._id,
    thirdPartyPayer: thirdPartyPayerList[0]._id,
    netInclTaxes: 20,
    nature: PAYMENT,
    type: 'direct_debit',
  },
];

module.exports = { paymentList };
