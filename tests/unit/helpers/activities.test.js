const sinon = require('sinon');
const expect = require('expect');
const { ObjectID } = require('mongodb');
const Module = require('../../../src/models/Module');
const Activity = require('../../../src/models/Activity');
const ActivityHelper = require('../../../src/helpers/activities');
require('sinon-mongoose');

describe('updateActivity', () => {
  let ActivityMock;

  beforeEach(() => {
    ActivityMock = sinon.mock(Activity);
  });

  afterEach(() => {
    ActivityMock.restore();
  });

  it("should update an activity's title", async () => {
    const activity = { _id: new ObjectID(), title: 'faire du pedalo' };
    const payload = { title: 'faire dodo' };
    const updatedActivity = { ...activity, ...payload };

    ActivityMock.expects('findOneAndUpdate')
      .withExactArgs({ _id: activity._id }, { $set: payload }, { new: true })
      .chain('lean')
      .once()
      .returns(updatedActivity);

    const result = await ActivityHelper.updateActivity(activity._id, payload);

    expect(result).toMatchObject(updatedActivity);
    ActivityMock.verify();
  });
});

describe('addActivity', () => {
  let ModuleMock;
  let ActivityMock;

  beforeEach(() => {
    ModuleMock = sinon.mock(Module);
    ActivityMock = sinon.mock(Activity);
  });

  afterEach(() => {
    ModuleMock.restore();
    ActivityMock.restore();
  });

  const module = { _id: new ObjectID(), title: 'module' };
  const newActivity = { title: 'c\'est un module !' };
  it('should create an activity', async () => {
    const activityId = new ObjectID();
    ModuleMock.expects('countDocuments').withExactArgs({ _id: module._id }).returns(1);

    ActivityMock.expects('create').withExactArgs(newActivity).returns({ _id: activityId });

    const returnedModule = { ...module, modules: [activityId] };
    ModuleMock.expects('findOneAndUpdate')
      .withExactArgs({ _id: module._id }, { $push: { activities: activityId } }, { new: true })
      .chain('lean')
      .returns(returnedModule);

    const result = await ActivityHelper.addActivity(module._id, newActivity);

    expect(result).toMatchObject(returnedModule);
    ModuleMock.verify();
    ActivityMock.verify();
  });

  it('should return an error if module does not exist', async () => {
    try {
      ModuleMock.expects('countDocuments').withExactArgs({ _id: module._id }).returns(0);

      ActivityMock.expects('create').never();
      ModuleMock.expects('findOneAndUpdate').never();

      const result = await ActivityHelper.addActivity(module._id, newActivity);

      expect(result).toBeUndefined();
    } catch (e) {
      ModuleMock.verify();
      ActivityMock.verify();
    }
  });
});

