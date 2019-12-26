const mongoose = require('mongoose');
const autopopulate = require('mongoose-autopopulate');
const { validateQuery, validatePayload, validateAggregation } = require('./preHooks/validate');

const SectorHistorySchema = mongoose.Schema({
  sector: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'Sector',
    autopopulate: { select: '_id name' },
    required: true,
  },
  auxiliary: { type: mongoose.Schema.Types.ObjectId, required: true },
  company: { type: mongoose.Schema.Types.ObjectId, required: true },
  endDate: Date,
}, { timestamps: true });

SectorHistorySchema.pre('aggregate', validateAggregation);
SectorHistorySchema.pre('find', validateQuery);
SectorHistorySchema.pre('validate', validatePayload);

SectorHistorySchema.plugin(autopopulate);

module.exports = mongoose.model('SectorHistory', SectorHistorySchema);
