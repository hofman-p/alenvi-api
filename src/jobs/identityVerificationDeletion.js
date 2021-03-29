const EmailHelper = require('../helpers/email');
const IdentityVerification = require('../models/IdentityVerification');

const identityVerificationDeletion = {
  async method() {
    let error;
    let entitiesToDelete = [];
    try {
      const dateAnHourAgo = new Date(new Date().setHours(new Date().getHours() - 1));
      entitiesToDelete = await IdentityVerification.find({ createdAt: { $lte: dateAnHourAgo } });
      await IdentityVerification.remove({ createdAt: { $lte: dateAnHourAgo } });
    } catch (e) {
      console.error(e);
      error = e.message;
    }
    return { entitiesToDelete, error };
  },
  async onComplete(server, { entitiesToDelete, error }) {
    try {
      server.log(['cron'], 'identity verification deletion OK');
      if (error) server.log(['error', 'cron', 'oncomplete'], error);
      server.log(['cron', 'oncomplete'], `Identity Verification : ${entitiesToDelete.length} entity deleted.`);
      EmailHelper.completeEventConsistencyScriptEmail(entitiesToDelete);
    } catch (e) {
      server.log(['error', 'cron', 'oncomplete'], e);
    }
  },
};

module.exports = identityVerificationDeletion;
