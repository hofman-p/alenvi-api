const { ObjectID } = require('mongodb');
const Program = require('../../../src/models/Program');
const Module = require('../../../src/models/Module');
const Activity = require('../../../src/models/Activity');
const { populateDBForAuthentication } = require('./authenticationSeed');

const activitiesList = [
  { _id: new ObjectID(), title: 'c\'est une activité' },
  { _id: new ObjectID(), title: 'toujours une activité' },
];

const modulesList = [
  { _id: new ObjectID(), title: 'c\'est un module', activities: [activitiesList[0]._id, activitiesList[1]._id] },
  { _id: new ObjectID(), title: 'toujours un module' },
  { _id: new ObjectID(), title: 'encore un module' },
];

const programsList = [
  { _id: new ObjectID(), name: 'program', modules: [modulesList[0]._id, modulesList[1]._id] },
  { _id: new ObjectID(), name: 'training program', modules: [modulesList[2]._id] },
];

const populateDB = async () => {
  await Program.deleteMany({});
  await Module.deleteMany({});
  await Activity.deleteMany({});

  await populateDBForAuthentication();

  await Program.insertMany(programsList);
  await Module.insertMany(modulesList);
  await Activity.insertMany(activitiesList);
};

module.exports = {
  populateDB,
  programsList,
};
