const ActivityHistory = require('../models/ActivityHistory');
const User = require('../models/User');
const { STRICTLY_E_LEARNING } = require('./constants');
const UtilsHelper = require('./utils');

exports.addActivityHistory = async payload => ActivityHistory.create(payload);

exports.list = async (query, credentials) => {
  const users = await User.find({ company: credentials.company._id }, { _id: 1 }).lean();

  const activitiesHistories = await ActivityHistory
    .find({
      date: { $lte: new Date(query.endDate), $gte: new Date(query.startDate) },
      user: { $in: users.map(u => u._id) },
    })
    .populate({
      path: 'activity',
      select: '_id',
      populate: { path: 'steps',
        select: '_id',
        populate: { path: 'subProgram',
          select: '_id',
          populate: { path: 'courses program',
            select: 'name misc format trainees',
            match: { format: STRICTLY_E_LEARNING } } } },
    })
    .lean();

  const historiesWithFilteredTrainees = activitiesHistories.map(activityHistory => ({
    ...activityHistory,
    activity: { ...activityHistory.activity,
      steps: activityHistory.activity.steps.map(step => ({
        ...step,
        subProgram: { ...step.subProgram,
          courses: step.subProgram.courses.map(course => ({
            ...course,
            trainees: course.trainees.filter(trainee =>
              UtilsHelper.areObjectIdsEquals(trainee, activityHistory.user)),
          })) },
      })) },
  }));

  const filteredActivitiesHistories = historiesWithFilteredTrainees.map(activityHistory => ({
    ...activityHistory,
    activity: { ...activityHistory.activity,
      steps: activityHistory.activity.steps.filter(step => step.subProgram.courses.length) },
  }));

  return filteredActivitiesHistories.map(activityHistory => ({
    ...activityHistory,
    activity: { ...activityHistory.activity,
      steps: activityHistory.activity.steps.filter(step => step.length) },
  }));
};
