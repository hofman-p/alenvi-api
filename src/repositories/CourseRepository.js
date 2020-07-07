const Course = require('../models/Course');

exports.findCourseAndPopulate = (query, populateVirtual = false) => Course.find(query)
  .populate({ path: 'company', select: 'name' })
  .populate({ path: 'program', select: 'name' })
  .populate({ path: 'slots', select: 'startDate endDate' })
  .populate({ path: 'trainer', select: 'identity.firstname identity.lastname' })
  .populate({ path: 'trainees', select: 'company', populate: { path: 'company', select: 'name' } })
  .lean({ virtuals: populateVirtual });