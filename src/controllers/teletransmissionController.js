const DeliveryHelper = require('../helpers/delivery');

const generateDeliveryXml = async (req) => {
  try {
    const xml = await DeliveryHelper.generateDeliveryXml(req.auth.credentials);
    return { message: 'tutto bene', data: { xml } };
  } catch (e) {
    req.log('error', e);
    return e;
  }
};

module.exports = { generateDeliveryXml };
