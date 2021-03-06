const Boom = require('@hapi/boom');
const pickBy = require('lodash/pickBy');
const pick = require('lodash/pick');
const translate = require('./translate');
const CourseSlot = require('../models/CourseSlot');
const CourseHistoriesHelper = require('./courseHistories');

const { language } = translate;

exports.hasConflicts = async (slot) => {
  const query = {
    course: slot.course,
    startDate: { $lt: slot.endDate },
    endDate: { $gt: slot.startDate },
  };
  if (slot._id) query._id = { $ne: slot._id };
  const slotsInConflict = await CourseSlot.countDocuments(query);

  return !!slotsInConflict;
};

exports.createCourseSlot = async (payload, user) => {
  const hasConflicts = await exports.hasConflicts(payload);
  if (hasConflicts) throw Boom.conflict(translate[language].courseSlotConflict);

  if (payload.startDate) await CourseHistoriesHelper.createHistoryOnSlotCreation(payload, user._id);

  return (new CourseSlot(payload)).save();
};

exports.updateCourseSlot = async (slotFromDb, payload, user) => {
  const hasConflicts = await exports.hasConflicts({ ...slotFromDb, ...payload });
  if (hasConflicts) throw Boom.conflict(translate[language].courseSlotConflict);

  const updatePayload = { $set: pickBy(payload) };

  if (!payload.step) updatePayload.$unset = { step: '' };

  await Promise.all([
    CourseHistoriesHelper.createHistoryOnSlotEdition(slotFromDb, payload, user._id),
    CourseSlot.updateOne({ _id: slotFromDb._id }, updatePayload),
  ]);
};

exports.removeCourseSlot = async (courseSlot, user) => {
  const payload = pick(courseSlot, ['course', 'startDate', 'endDate', 'address']);

  await Promise.all([
    CourseHistoriesHelper.createHistoryOnSlotDeletion(payload, user._id),
    CourseSlot.deleteOne({ _id: courseSlot._id }),
  ]);
};
