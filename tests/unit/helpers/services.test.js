const sinon = require('sinon');
const expect = require('expect');
const { ObjectID } = require('mongodb');
const Service = require('../../../src/models/Service');
const ServiceHelper = require('../../../src/helpers/services');
const SinonMongoose = require('../sinonMongoose');

describe('list', () => {
  const companyId = new ObjectID();
  let find;

  beforeEach(() => {
    find = sinon.stub(Service, 'find');
  });

  afterEach(() => {
    find.restore();
  });

  it('should find services', async () => {
    find.returns(SinonMongoose.stubChainedQueries([[{ name: 'test' }]]));

    const result = await ServiceHelper.list({ company: { _id: companyId } }, { isArchived: true });

    expect(result).toStrictEqual([{ name: 'test' }]);

    SinonMongoose.calledWithExactly(find, [
      { query: 'find', args: [{ company: companyId, isArchived: true }] },
      { query: 'populate', args: [{ path: 'versions.surcharge', match: { company: companyId } }] },
      { query: 'lean' },
    ]);
  });
});

describe('create', () => {
  const companyId = new ObjectID();
  let save;

  beforeEach(() => {
    save = sinon.stub(Service.prototype, 'save').returnsThis();
  });

  afterEach(() => {
    save.restore();
  });

  it('should create a service', async () => {
    const result = await ServiceHelper.create(companyId, { nature: 'hourly' });

    expect(result.nature).toBe('hourly');
    expect(result.company).toBe(companyId);
    sinon.assert.calledOnce(save);
  });
});

describe('update', () => {
  let updateOne;

  beforeEach(() => {
    updateOne = sinon.stub(Service, 'updateOne');
  });

  afterEach(() => {
    updateOne.restore();
  });

  it('should update a service', async () => {
    const serviceId = new ObjectID();

    await ServiceHelper.update(serviceId, { vat: 2 });

    sinon.assert.calledOnceWithExactly(updateOne, { _id: serviceId }, { $push: { versions: { vat: 2 } } });
  });

  it('should archive a service', async () => {
    const serviceId = new ObjectID();

    await ServiceHelper.update(serviceId, { isArchived: true });

    sinon.assert.calledOnceWithExactly(updateOne, { _id: serviceId }, { isArchived: true });
  });
});

describe('remove', () => {
  const serviceId = new ObjectID();
  let deleteOne;

  beforeEach(() => {
    deleteOne = sinon.stub(Service, 'deleteOne');
  });

  afterEach(() => {
    deleteOne.restore();
  });

  it('should remove services', async () => {
    await ServiceHelper.remove(serviceId);

    sinon.assert.calledWithExactly(deleteOne, { _id: serviceId });
  });
});
