const omit = require('lodash/omit');
const get = require('lodash/get');
const moment = require('moment');
const AttendanceSheet = require('../models/AttendanceSheet');
const User = require('../models/User');
const GCloudStorageHelper = require('./gCloudStorage');
const UtilsHelper = require('./utils');

exports.create = async (payload) => {
  let fileName = moment(payload.date).format('DD-MMMM-YYYY');
  if (payload.trainee) {
    const { identity } = await User.findOne({ _id: payload.trainee }).lean();

    fileName = UtilsHelper.formatIdentity(identity, 'FL');
  }
  const fileUploaded = await GCloudStorageHelper.uploadCourseFile({
    fileName: `emargement_${fileName}`,
    file: payload.file,
  });

  return AttendanceSheet.create({ ...omit(payload, 'file'), file: fileUploaded });
};

exports.list = async (course, company) => {
  const attendanceSheets = await AttendanceSheet.find({ course })
    .populate({ path: 'trainee', select: 'company' })
    .lean();

  return company
    ? attendanceSheets.filter(a => UtilsHelper.areObjectIdsEquals(get(a, 'trainee.company'), company))
    : attendanceSheets;
};

exports.delete = async (attendanceSheet) => {
  await GCloudStorageHelper.deleteCourseFile(attendanceSheet.file.publicId);

  return AttendanceSheet.deleteOne({ _id: attendanceSheet._id });
};
