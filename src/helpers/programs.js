const flat = require('flat');
const moment = require('moment');
const Program = require('../models/Program');
const CloudinaryHelper = require('./cloudinary');

exports.createProgram = payload => (new Program(payload)).save();

exports.list = async query => Program.find(query)
  .populate({ path: 'subPrograms', select: 'name' })
  .lean();

exports.getProgram = async (programId) => {
  const program = await Program.findOne({ _id: programId })
    .populate({ path: 'subPrograms', populate: { path: 'steps', populate: { path: 'activities', populate: 'cards' } } })
    .lean({ virtuals: true });

  return {
    ...program,
    subPrograms: program.subPrograms.map(sp => ({
      ...sp,
      steps: sp.steps.map(st => ({
        ...st,
        activities: st.activities.map(act => ({ ...act, cards: act.cards.map(c => c._id) })),
      })),
    })),
  };
};

exports.updateProgram = async (programId, payload) => Program.updateOne({ _id: programId }, { $set: payload });

exports.uploadImage = async (programId, payload) => {
  const imageUploaded = await CloudinaryHelper.addImage({
    file: payload.file,
    folder: 'images/business/Compani/programs',
    public_id: `${payload.fileName}-${moment().format('YYYY_MM_DD_HH_mm_ss')}`,
  });

  const updatePayload = {
    image: {
      publicId: imageUploaded.public_id,
      link: imageUploaded.secure_url,
    },
  };
  await Program.updateOne({ _id: programId }, { $set: flat(updatePayload) });
};
