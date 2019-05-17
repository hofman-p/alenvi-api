const expect = require('expect');
const sinon = require('sinon');
const { ObjectID } = require('mongodb');
const moment = require('moment');

const User = require('../../../models/User');
const Customer = require('../../../models/Customer');
const Contract = require('../../../models/Contract');
const Surcharge = require('../../../models/Surcharge');
const Event = require('../../../models/Event');
const EventHelper = require('../../../helpers/events');
const {
  INTERVENTION,
  CUSTOMER_CONTRACT,
  COMPANY_CONTRACT,
  INTERNAL_HOUR,
  ABSENCE,
  UNAVAILABILITY,
  NEVER,
  EVERY_WEEK,
  INVOICED_AND_NOT_PAYED,
  CUSTOMER_INITIATIVE,
} = require('../../../helpers/constants');

require('sinon-mongoose');


describe('updateEvent', () => {
  let populateEventSubscription;
  let updateRepetitions;
  let EventModel;
  beforeEach(() => {
    populateEventSubscription = sinon.stub(EventHelper, 'populateEventSubscription');
    updateRepetitions = sinon.stub(EventHelper, 'updateRepetitions');
    EventModel = sinon.mock(Event);
  });

  afterEach(() => {
    populateEventSubscription.restore();
    updateRepetitions.restore();
    EventModel.restore();
  });

  it('1. should update absence without unset repetition property', async () => {
    const eventId = new ObjectID();
    const event = { _id: eventId, type: ABSENCE };
    const payload = { startDate: '2019-01-21T09:38:18.653Z' };

    EventModel.expects('findOneAndUpdate')
      .withExactArgs({ _id: eventId }, { $set: payload }, { autopopulate: false, new: true })
      .chain('populate')
      .chain('populate')
      .chain('lean')
      .once()
      .resolves(event);

    await EventHelper.updateEvent(event, payload);
    EventModel.verify();
    sinon.assert.notCalled(updateRepetitions);
  });

  it('2. should update event without repetition without unset repetition property', async () => {
    const eventId = new ObjectID();
    const event = { _id: eventId };
    const payload = { startDate: '2019-01-21T09:38:18.653Z' };

    EventModel.expects('findOneAndUpdate')
      .withExactArgs({ _id: eventId }, { $set: payload }, { autopopulate: false, new: true })
      .chain('populate')
      .chain('populate')
      .chain('lean')
      .once()
      .returns(event);
    await EventHelper.updateEvent(event, payload);
    EventModel.verify();
    sinon.assert.notCalled(updateRepetitions);
  });

  it('3. should update event with NEVER frequency without unset repetition property', async () => {
    const eventId = new ObjectID();
    const event = { _id: eventId, repetition: { frequency: NEVER } };
    const payload = { startDate: '2019-01-21T09:38:18.653Z' };

    EventModel.expects('findOneAndUpdate')
      .once()
      .withExactArgs({ _id: eventId }, { $set: payload }, { autopopulate: false, new: true })
      .chain('populate')
      .chain('populate')
      .chain('lean')
      .once()
      .returns(event);
    await EventHelper.updateEvent(event, payload);
    EventModel.verify();
    sinon.assert.notCalled(updateRepetitions);
  });

  it('4. should update event and repeated events without unset repetition property', async () => {
    const eventId = new ObjectID();
    const event = { _id: eventId, repetition: { frequency: EVERY_WEEK } };
    const payload = { startDate: '2019-01-21T09:38:18.653Z', shouldUpdateRepetition: true };

    EventModel.expects('findOneAndUpdate')
      .once()
      .withExactArgs({ _id: eventId }, { $set: payload }, { autopopulate: false, new: true })
      .chain('populate')
      .chain('populate')
      .chain('lean')
      .once()
      .returns(event);
    await EventHelper.updateEvent(event, payload);
    EventModel.verify();
    sinon.assert.callCount(updateRepetitions, 1);
  });

  it('5. should update event when only misc is updated without unset repetition property', async () => {
    const eventId = new ObjectID();
    const event = { _id: eventId, startDate: '2019-01-21T09:38:18.653Z', repetition: { frequency: NEVER } };
    const payload = { startDate: '2019-01-21T09:38:18.653Z', misc: 'Zoro est là' };

    EventModel.expects('findOneAndUpdate')
      .once()
      .withExactArgs({ _id: eventId }, { $set: payload }, { autopopulate: false, new: true })
      .chain('populate')
      .chain('populate')
      .chain('lean')
      .once()
      .returns(event);
    await EventHelper.updateEvent(event, payload);
    EventModel.verify();
    sinon.assert.notCalled(updateRepetitions);
  });

  it('6. should update event and unset repetition property if event in repetition and repetition not updated', async () => {
    const eventId = new ObjectID();
    const event = { _id: eventId, repetition: { frequency: EVERY_WEEK } };
    const payload = { startDate: '2019-01-21T09:38:18.653Z', shouldUpdateRepetition: false };

    EventModel.expects('findOneAndUpdate')
      .once()
      .withExactArgs(
        { _id: eventId },
        { $set: { ...payload, 'repetition.frequency': NEVER }, $unset: { 'repetition.parentId': '' } },
        { autopopulate: false, new: true }
      )
      .chain('populate')
      .chain('populate')
      .chain('lean')
      .once()
      .returns(event);
    await EventHelper.updateEvent(event, payload);
    EventModel.verify();
    sinon.assert.notCalled(updateRepetitions);
  });

  it('7. should update event and unset cancel property when cancellation cancelled', async () => {
    const eventId = new ObjectID();
    const event = { _id: eventId, repetition: { frequency: NEVER }, isCancelled: true, cancel: { condition: INVOICED_AND_NOT_PAYED, reason: CUSTOMER_INITIATIVE } };
    const payload = { startDate: '2019-01-21T09:38:18.653Z', shouldUpdateRepetition: false };

    EventModel.expects('findOneAndUpdate')
      .once()
      .withExactArgs({ _id: eventId }, { $set: { ...payload, isCancelled: false }, $unset: { cancel: '' } }, { autopopulate: false, new: true })
      .chain('populate')
      .chain('populate')
      .chain('lean')
      .once()
      .returns(event);
    await EventHelper.updateEvent(event, payload);
    EventModel.verify();
    sinon.assert.notCalled(updateRepetitions);
  });

  it('8. should update event and unset cancel adn repetition property when cancellation cancelled and repetition not updated', async () => {
    const eventId = new ObjectID();
    const event = { _id: eventId, repetition: { frequency: EVERY_WEEK }, isCancelled: true, cancel: { condition: INVOICED_AND_NOT_PAYED, reason: CUSTOMER_INITIATIVE } };
    const payload = { startDate: '2019-01-21T09:38:18.653Z', shouldUpdateRepetition: false };

    EventModel.expects('findOneAndUpdate')
      .once()
      .withExactArgs(
        { _id: eventId },
        { $set: { ...payload, isCancelled: false, 'repetition.frequency': NEVER }, $unset: { cancel: '', 'repetition.parentId': '' } },
        { autopopulate: false, new: true }
      )
      .chain('populate')
      .chain('populate')
      .chain('lean')
      .once()
      .returns(event);
    await EventHelper.updateEvent(event, payload);
    EventModel.verify();
    sinon.assert.notCalled(updateRepetitions);
  });
});

describe('populateEvent', () => {
  it('should populate subscription as event is an intervention', async () => {
    const event = {
      type: 'intervention',
      customer: {
        subscriptions: [
          {
            createdAt: '2019-01-11T08:38:18.653Z',
            _id: new ObjectID('5c3855fa12d1370abdda0b8f'),
            service: '5c35cdc2bd5e3e7360b853fa',
            unitTTCRate: 25,
            estimatedWeeklyVolume: 12,
            sundays: 2,
          },
          {
            createdAt: '2019-01-21T09:38:18.653Z',
            _id: new ObjectID('5c35b5eb1a6fb00997363eeb'),
            service: '5c35cdc2bd5e3e7360b853fa',
            unitTTCRate: 25,
            estimatedWeeklyVolume: 12,
            sundays: 2,
          }
        ],
      },
      subscription: new ObjectID('5c3855fa12d1370abdda0b8f'),
    };

    const result = await EventHelper.populateEventSubscription(event);
    expect(result.subscription).toBeDefined();
    expect(result.subscription._id).toEqual(event.subscription);
  });

  it('should not modify the input as event is not an intervention', async () => {
    const event = {
      type: 'absence',
    };

    const result = await EventHelper.populateEventSubscription(event);
    expect(result.subscription).not.toBeDefined();
    expect(result).toEqual(event);
  });

  it('should return an error as event is intervention but customer is undefined', async () => {
    const event = {
      type: 'intervention',
    };

    try {
      await EventHelper.populateEventSubscription(event);
    } catch (e) {
      expect(e.output.statusCode).toEqual(500);
    }
  });

  it('should throw an error as no corresopnding subscription is found in the customer', async () => {
    const event = {
      type: 'intervention',
      customer: {
        subscriptions: [
          {
            createdAt: '2019-01-21T09:38:18.653Z',
            _id: new ObjectID('5c35b5eb1a6fb00997363eeb'),
            service: '5c35cdc2bd5e3e7360b853fa',
            unitTTCRate: 25,
            estimatedWeeklyVolume: 12,
            sundays: 2,
          }
        ],
      },
      subscription: new ObjectID('5c3855fa12d1370abdda0b8f'),
    };

    try {
      await EventHelper.populateEventSubscription(event);
    } catch (e) {
      expect(e.output.statusCode).toEqual(500);
    }
  });
});

describe('populateEvents', () => {
  it('should populate subscription as event is an intervention', async () => {
    const events = [
      {
        type: 'intervention',
        customer: {
          subscriptions: [
            {
              createdAt: '2019-01-11T08:38:18.653Z',
              _id: new ObjectID('5c3855fa12d1370abdda0b8f'),
              service: '5c35cdc2bd5e3e7360b853fa',
              unitTTCRate: 25,
              estimatedWeeklyVolume: 12,
              sundays: 2,
            },
            {
              createdAt: '2019-01-21T09:38:18.653Z',
              _id: new ObjectID('5c35b5eb1a6fb00997363eeb'),
              service: '5c35cdc2bd5e3e7360b853fa',
              unitTTCRate: 25,
              estimatedWeeklyVolume: 12,
              sundays: 2,
            }
          ],
        },
        subscription: new ObjectID('5c3855fa12d1370abdda0b8f'),
      },
      {
        type: 'intervention',
        customer: {
          subscriptions: [
            {
              createdAt: '2019-01-12T08:38:18.653Z',
              _id: new ObjectID('5a3bc0315e421400147d5ecd'),
              service: '5ad8c41659769000142589f7',
              unitTTCRate: 25,
              estimatedWeeklyVolume: 12,
              sundays: 2,
            },
            {
              createdAt: '2019-01-22T09:38:18.653Z',
              _id: new ObjectID('5a3bc0005e421400147d5ec4'),
              service: '5a5735cb1f2a1f0014d48e14',
              unitTTCRate: 25,
              estimatedWeeklyVolume: 12,
              sundays: 2,
            }
          ],
        },
        subscription: new ObjectID('5a3bc0315e421400147d5ecd'),
      }
    ];

    const result = await EventHelper.populateEvents(events);
    expect(result[0].subscription).toBeDefined();
    expect(result[1].subscription).toBeDefined();
    expect(result[0].subscription._id).toEqual(events[0].subscription);
    expect(result[1].subscription._id).toEqual(events[1].subscription);
  });
});

describe('hasConflicts', () => {
  it('should return true if event has conflicts', async () => {
    const event = {
      _id: new ObjectID(),
      startDate: '2019-10-02T09:00:00.000Z',
      endDate: '2019-10-02T11:00:00.000Z',
      auxiliary: new ObjectID(),
    };

    const findEvents = sinon.stub(Event, 'find').returns([
      { _id: new ObjectID(), startDate: '2019-10-02T08:00:00.000Z', endDate: '2019-10-02T12:00:00.000Z' },
    ]);
    const result = await EventHelper.hasConflicts(event);
    findEvents.restore();

    expect(result).toBeTruthy();
  });

  it('should return false if event does not have conflicts', async () => {
    const event = {
      _id: new ObjectID(),
      startDate: '2019-10-02T15:00:00.000Z',
      endDate: '2019-10-02T16:00:00.000Z',
      auxiliary: new ObjectID(),
    };

    const findEvents = sinon.stub(Event, 'find').returns([
      { _id: new ObjectID(), startDate: '2019-10-02T08:00:00.000Z', endDate: '2019-10-02T12:00:00.000Z' },
    ]);
    const result = await EventHelper.hasConflicts(event);
    findEvents.restore();

    expect(result).toBeFalsy();
  });

  it('should return false if event has conflicts only with cancelled events', async () => {
    const event = {
      _id: new ObjectID(),
      startDate: '2019-10-02T09:00:00.000Z',
      endDate: '2019-10-02T11:00:00.000Z',
      auxiliary: new ObjectID(),
    };

    const findEvents = sinon.stub(Event, 'find').returns([
      { _id: new ObjectID(), startDate: '2019-10-02T08:00:00.000Z', endDate: '2019-10-02T12:00:00.000Z', isCancelled: true },
    ]);
    const result = await EventHelper.hasConflicts(event);
    findEvents.restore();

    expect(result).toBeFalsy();
  });
});

describe('isCreationAllowed', () => {
  it('should return false as event has conflicts', async () => {
    const payload = {
      auxiliary: new ObjectID(),
      startDate: '2019-10-02T08:00:00.000Z',
      endDate: '2019-10-02T10:00:00.000Z',
    };

    const findEvents = sinon.stub(Event, 'find').returns([
      { startDate: '2019-10-02T08:00:00.000Z', endDate: '2019-10-02T10:00:00.000Z' },
    ]);
    const result = await EventHelper.isCreationAllowed(payload);
    findEvents.restore();

    expect(result).toBeFalsy();
  });

  it('should return false as user has no contract', async () => {
    const payload = { auxiliary: new ObjectID() };

    const user = { _id: payload.auxiliary };
    User.findOne = () => user;
    user.populate = () => user;
    user.toObject = () => user;

    const findEvents = sinon.stub(Event, 'find').returns([]);
    const result = await EventHelper.isCreationAllowed(payload);
    findEvents.restore();

    expect(result).toBeFalsy();
  });

  it('should return false if service event is customer contract and auxiliary does not have contract with customer', async () => {
    const subscriptionId = new ObjectID();
    const payload = {
      auxiliary: new ObjectID(),
      customer: new ObjectID(),
      type: INTERVENTION,
      subscription: subscriptionId.toHexString(),
      startDate: '2019-10-02T08:00:00.000Z',
      endDate: '2019-10-02T10:00:00.000Z',
    };
    const customer = {
      _id: payload.customer,
      subscriptions: [{
        _id: subscriptionId,
        service: { type: CUSTOMER_CONTRACT, versions: [{ startDate: '2019-10-02T00:00:00.000Z' }, { startDate: '2018-10-02T00:00:00.000Z' }] },
        versions: [{ startDate: moment(payload.startDate).subtract(1, 'd') }],
      }]
    };
    Customer.findOne = () => customer;
    customer.populate = () => customer;
    customer.toObject = () => customer;

    const contract = new Contract({
      user: payload.auxiliary,
      customer: payload.customer,
      versions: [{}],
      startDate: moment(payload.startDate).add(1, 'd'),
    });
    const findOneContract = sinon.stub(Contract, 'findOne').returns(contract);

    const user = { _id: payload.auxiliary, contracts: [contract] };
    User.findOne = () => user;
    user.populate = () => user;
    user.toObject = () => user;

    const findOneSurcharge = sinon.stub(Surcharge, 'findOne');
    const findEvents = sinon.stub(Event, 'find').returns([]);

    const result = await EventHelper.isCreationAllowed(payload);
    findOneSurcharge.restore();
    findOneContract.restore();
    findEvents.restore();
    expect(result).toBeFalsy();
  });

  it('should return true if service event is customer contract and auxiliary has contract with customer', async () => {
    const subscriptionId = new ObjectID();
    const payload = {
      auxiliary: new ObjectID(),
      customer: new ObjectID(),
      type: INTERVENTION,
      subscription: subscriptionId.toHexString(),
      startDate: '2019-10-03T00:00:00.000Z',
    };

    const customer = {
      _id: payload.customer,
      subscriptions: [{
        _id: subscriptionId,
        service: { type: CUSTOMER_CONTRACT, versions: [{ startDate: '2019-10-02T00:00:00.000Z' }, { startDate: '2018-10-02T00:00:00.000Z' }] },
        versions: [{ startDate: moment(payload.startDate).subtract(1, 'd') }],
      }]
    };
    Customer.findOne = () => customer;
    customer.populate = () => customer;
    customer.toObject = () => customer;

    const contract = {
      user: payload.auxiliary,
      customer: payload.customer,
      versions: [{ isActive: true }],
      startDate: moment(payload.startDate).subtract(1, 'd'),
    };
    const findOneContract = sinon.stub(Contract, 'findOne').returns(contract);

    const user = { _id: payload.auxiliary, contracts: [contract] };
    User.findOne = () => user;
    user.populate = () => user;
    user.toObject = () => user;

    const findOneSurcharge = sinon.stub(Surcharge, 'findOne');
    const findEvents = sinon.stub(Event, 'find').returns([]);

    const result = await EventHelper.isCreationAllowed(payload);
    findOneSurcharge.restore();
    findOneContract.restore();
    findEvents.restore();

    expect(result).toBeTruthy();
  });

  it('should return false if company contract and no active contract on day', async () => {
    const subscriptionId = new ObjectID();
    const payload = {
      auxiliary: new ObjectID(),
      customer: new ObjectID(),
      type: INTERVENTION,
      subscription: subscriptionId.toHexString(),
      startDate: '2019-10-03T00:00:00.000Z',
    };

    const customer = {
      _id: payload.customer,
      subscriptions: [{
        _id: subscriptionId,
        service: { type: COMPANY_CONTRACT, versions: [{ startDate: '2019-10-02T00:00:00.000Z' }, { startDate: '2018-10-02T00:00:00.000Z' }] },
        versions: [{ startDate: moment(payload.startDate).subtract(1, 'd') }],
      }],
    };
    Customer.findOne = () => customer;
    customer.populate = () => customer;
    customer.toObject = () => customer;

    const contract = {
      user: payload.auxiliary,
      customer: payload.customer,
      versions: [{}],
      status: COMPANY_CONTRACT,
      startDate: moment(payload.startDate).add(1, 'd'),
    };
    const findOneContract = sinon.stub(Contract, 'findOne').returns(contract);

    const user = { _id: payload.auxiliary, contracts: [contract] };
    User.findOne = () => user;
    user.populate = () => user;
    user.toObject = () => user;

    const findOneSurcharge = sinon.stub(Surcharge, 'findOne');
    const findEvents = sinon.stub(Event, 'find').returns([]);

    const result = await EventHelper.isCreationAllowed(payload);
    findOneSurcharge.restore();
    findOneContract.restore();
    findEvents.restore();

    expect(result).toBeFalsy();
  });

  it('should return true if company contract and active contract on day', async () => {
    const subscriptionId = new ObjectID();
    const payload = {
      auxiliary: new ObjectID(),
      customer: new ObjectID(),
      type: INTERVENTION,
      subscription: subscriptionId.toHexString(),
      startDate: '2019-10-03T00:00:00.000Z',
    };

    const customer = {
      _id: payload.customer,
      subscriptions: [{
        _id: subscriptionId,
        service: { type: COMPANY_CONTRACT, versions: [{ startDate: '2019-10-02T00:00:00.000Z' }, { startDate: '2018-10-02T00:00:00.000Z' }] },
        versions: [{ startDate: moment(payload.startDate).subtract(1, 'd') }],
      }]
    };
    Customer.findOne = () => customer;
    customer.populate = () => customer;
    customer.toObject = () => customer;

    const contract = {
      user: payload.auxiliary,
      customer: payload.customer,
      versions: [{ isActive: true }],
      status: COMPANY_CONTRACT,
      startDate: moment(payload.startDate).subtract(1, 'd'),
    };
    const findOneContract = sinon.stub(Contract, 'findOne').returns(contract);

    const user = { _id: payload.auxiliary, contracts: [contract] };
    User.findOne = () => user;
    user.populate = () => user;
    user.toObject = () => user;

    const findOneSurcharge = sinon.stub(Surcharge, 'findOne');
    const findEvents = sinon.stub(Event, 'find').returns([]);

    const result = await EventHelper.isCreationAllowed(payload);
    findOneSurcharge.restore();
    findOneContract.restore();
    findEvents.restore();

    expect(result).toBeTruthy();
  });

  it('should return false if company contract and customer has no subscription', async () => {
    const payload = {
      auxiliary: new ObjectID(),
      customer: new ObjectID(),
      type: INTERVENTION,
      subscription: (new ObjectID()).toHexString(),
      startDate: '2019-10-03T00:00:00.000Z',
    };

    const customer = {
      _id: payload.customer,
      subscriptions: [{
        _id: new ObjectID(),
        service: { type: COMPANY_CONTRACT, versions: [{ startDate: '2019-10-02T00:00:00.000Z' }, { startDate: '2018-10-02T00:00:00.000Z' }] },
        versions: [{ startDate: moment(payload.startDate).add(1, 'd') }],
      }]
    };
    Customer.findOne = () => customer;
    customer.populate = () => customer;
    customer.toObject = () => customer;

    const contract = {
      user: payload.auxiliary,
      customer: payload.customer,
      versions: [{ isActive: true }],
      status: COMPANY_CONTRACT,
      startDate: moment(payload.startDate).subtract(1, 'd'),
    };
    const findOneContract = sinon.stub(Contract, 'findOne').returns(contract);

    const user = { _id: payload.auxiliary, contracts: [contract] };
    User.findOne = () => user;
    user.populate = () => user;
    user.toObject = () => user;

    const findOneSurcharge = sinon.stub(Surcharge, 'findOne');
    const findEvents = sinon.stub(Event, 'find').returns([]);

    const result = await EventHelper.isCreationAllowed(payload);
    findOneSurcharge.restore();
    findOneContract.restore();
    findEvents.restore();

    expect(result).toBeFalsy();
  });

  it('should return false if event is internal hour and auxiliary does not have contract with company', async () => {
    const payload = {
      auxiliary: new ObjectID(),
      type: INTERNAL_HOUR,
      startDate: '2019-10-03T00:00:00.000Z',
    };

    const customer = {
      _id: payload.customer,
      subscriptions: [{
        _id: payload.subscription,
        service: { type: '', versions: [{ startDate: '2019-10-02T00:00:00.000Z' }, { startDate: '2018-10-02T00:00:00.000Z' }] }
      }]
    };
    Customer.findOne = () => customer;
    customer.populate = () => customer;
    customer.toObject = () => customer;

    const contract = {
      user: payload.auxiliary,
      customer: payload.customer,
      versions: [{}],
      status: CUSTOMER_CONTRACT,
    };
    const findOneContract = sinon.stub(Contract, 'findOne').returns(contract);

    const user = { _id: payload.auxiliary, contracts: [contract] };
    User.findOne = () => user;
    user.populate = () => user;
    user.toObject = () => user;

    const findOneSurcharge = sinon.stub(Surcharge, 'findOne');
    const findEvents = sinon.stub(Event, 'find').returns([]);

    const result = await EventHelper.isCreationAllowed(payload);
    findOneSurcharge.restore();
    findOneContract.restore();
    findEvents.restore();

    expect(result).toBeFalsy();
  });
});

describe('isEditionAllowed', () => {
  it('should return false as eevnt is billed', async () => {
    const eventFromDb = {
      isBilled: true,
      type: INTERVENTION,
    };
    const payload = {};

    expect(await EventHelper.isEditionAllowed(eventFromDb, payload)).toBeFalsy();
  });

  it('should return false as event is absence and auxiliary is updated', async () => {
    const eventFromDb = {
      type: ABSENCE,
      auxiliary: new ObjectID(),
    };
    const payload = { auxiliary: '1234567890' };

    expect(await EventHelper.isEditionAllowed(eventFromDb, payload)).toBeFalsy();
  });

  it('should return false as event is unavailability and auxiliary is updated', async () => {
    const eventFromDb = {
      type: UNAVAILABILITY,
      auxiliary: new ObjectID(),
    };
    const payload = { auxiliary: '1234567890' };

    expect(await EventHelper.isEditionAllowed(eventFromDb, payload)).toBeFalsy();
  });
});
