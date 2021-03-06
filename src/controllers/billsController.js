const Boom = require('@hapi/boom');
const translate = require('../helpers/translate');
const { getDraftBillsList } = require('../helpers/draftBills');
const BillHelper = require('../helpers/bills');

const { language } = translate;

const draftBillsList = async (req) => {
  try {
    const { startDate, endDate, billingStartDate, customer } = req.query;
    const dates = { endDate };
    if (startDate) dates.startDate = startDate;
    const { credentials } = req.auth;
    const draftBills = await getDraftBillsList(dates, billingStartDate, credentials, customer);

    return {
      message: translate[language].draftBills,
      data: { draftBills },
    };
  } catch (e) {
    req.log('error', e);
    return Boom.isBoom(e) ? e : Boom.badImplementation(e);
  }
};

const createBills = async (req) => {
  try {
    await BillHelper.formatAndCreateBills(req.payload.bills, req.auth.credentials);

    return { message: translate[language].billsCreated };
  } catch (e) {
    req.log('error', e);
    return Boom.isBoom(e) ? e : Boom.badImplementation(e);
  }
};

const generateBillPdf = async (req, h) => {
  try {
    const { pdf, billNumber } = await BillHelper.generateBillPdf(req.params, req.auth.credentials);

    return h.response(pdf)
      .header('content-disposition', `inline; filename=${billNumber}.pdf`)
      .type('application/pdf');
  } catch (e) {
    req.log('error', e);
    return Boom.isBoom(e) ? e : Boom.badImplementation(e);
  }
};

module.exports = { draftBillsList, createBills, generateBillPdf };
