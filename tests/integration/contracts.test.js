const { ObjectID } = require('mongodb');
const expect = require('expect');
const moment = require('moment');
const sinon = require('sinon');
const get = require('lodash/get');
const fs = require('fs');
const GetStream = require('get-stream');
const path = require('path');
const cloneDeep = require('lodash/cloneDeep');
const omit = require('lodash/omit');
const app = require('../../server');
const Contract = require('../../src/models/Contract');
const User = require('../../src/models/User');
const Event = require('../../src/models/Event');
const SectorHistory = require('../../src/models/SectorHistory');
const Drive = require('../../src/models/Google/Drive');
const {
  populateDB,
  contractsList,
  contractUsers,
  contractEvents,
  otherContract,
  otherContractUser,
  userFromOtherCompany,
} = require('./seed/contractsSeed');
const { generateFormData } = require('./utils');
const { getToken, getUser, authCompany } = require('./seed/authenticationSeed');
const EsignHelper = require('../../src/helpers/eSign');

describe('NODE ENV', () => {
  it('should be \'test\'', () => {
    expect(process.env.NODE_ENV).toBe('test');
  });
});

describe('GET /contracts', () => {
  let authToken = null;
  beforeEach(populateDB);
  beforeEach(async () => {
    authToken = await getToken('client_admin');
  });

  it('should return list of contracts', async () => {
    const userId = contractsList[0].user;
    const response = await app.inject({
      method: 'GET',
      url: `/contracts?user=${userId}`,
      headers: { 'x-access-token': authToken },
    });

    expect(response.statusCode).toBe(200);
    expect(response.result.data.contracts).toBeDefined();
    expect(response.result.data.contracts.length)
      .toEqual(contractsList.filter(contract => contract.user === userId).length);
  });

  it('should get contracts of an auxiliary', async () => {
    const user = getUser('auxiliary');
    authToken = await getToken('auxiliary');
    const response = await app.inject({
      method: 'GET',
      url: `/contracts?user=${user._id}`,
      headers: { 'x-access-token': authToken },
    });

    expect(response.statusCode).toBe(200);
    expect(response.result.data.contracts).toBeDefined();
    expect(response.result.data.contracts.length)
      .toBe(contractsList.filter(contract => contract.user === user._id).length);
  });

  it('should get my contracts if I am an auxiliary without company', async () => {
    const user = getUser('auxiliary_without_company');
    authToken = await getToken('auxiliary_without_company');
    const response = await app.inject({
      method: 'GET',
      url: `/contracts?user=${user._id}`,
      headers: { 'x-access-token': authToken },
    });

    expect(response.statusCode).toBe(200);
    expect(response.result.data.contracts).toBeDefined();
    expect(response.result.data.contracts.length)
      .toBe(contractsList.filter(contract => contract.user === user._id).length);
  });

  it('should not return the contracts if user is not from the company', async () => {
    authToken = await getToken('coach');
    const response = await app.inject({
      method: 'GET',
      url: `/contracts?user=${userFromOtherCompany._id}`,
      headers: { 'x-access-token': authToken },
    });

    expect(response.statusCode).toBe(404);
  });

  const roles = [
    { name: 'coach', expectedCode: 200 },
    { name: 'auxiliary', expectedCode: 403 },
    { name: 'auxiliary_without_company', expectedCode: 403 },
    { name: 'helper', expectedCode: 403 },
  ];

  roles.forEach((role) => {
    it(`should return ${role.expectedCode} as user is ${role.name}`, async () => {
      const userId = contractsList[0].user;
      authToken = await getToken(role.name);
      const response = await app.inject({
        method: 'GET',
        url: `/contracts?user=${userId}`,
        headers: { 'x-access-token': authToken },
      });

      expect(response.statusCode).toBe(role.expectedCode);
    });
  });
});

describe('POST /contracts', () => {
  let authToken = null;
  let generateSignatureRequestStub;
  beforeEach(populateDB);
  beforeEach(async () => {
    authToken = await getToken('client_admin');
    generateSignatureRequestStub = sinon.stub(EsignHelper, 'generateSignatureRequest')
      .returns({ data: { document_hash: '1234567890' } });
  });
  afterEach(() => {
    generateSignatureRequestStub.restore();
  });

  it('should create contract', async () => {
    const payload = {
      startDate: '2019-09-01T00:00:00',
      versions: [{
        weeklyHours: 24,
        grossHourlyRate: 10.43,
        startDate: '2019-09-01T00:00:00',
      }],
      user: contractUsers[1]._id,
    };

    const response = await app.inject({
      method: 'POST',
      url: '/contracts',
      headers: { 'x-access-token': authToken },
      payload,
    });

    expect(response.statusCode).toBe(200);
    expect(response.result.data.contract).toBeDefined();

    const contracts = await Contract.find({ company: get(response, 'result.data.contract.company') });
    expect(contracts.length).toEqual(contractsList.length + 1);

    const user = await User.findOne({ _id: contractUsers[1]._id });
    expect(user).toBeDefined();
    expect(user.contracts).toContainEqual(new ObjectID(response.result.data.contract._id));
    expect(user.inactivityDate).toBeNull();

    const sectorHistoriesLength = await SectorHistory
      .countDocuments({
        auxiliary: contractUsers[1]._id,
        company: authCompany._id,
        startDate: moment(payload.startDate).startOf('day').toDate(),
      })
      .lean();
    expect(sectorHistoriesLength).toBe(1);
  });

  it('should create new sectorhistory if auxiliary does not have sectorhistory without a startDate', async () => {
    const payload = {
      startDate: '2019-09-01T00:00:00',
      versions: [{
        weeklyHours: 24,
        grossHourlyRate: 10.43,
        startDate: '2019-09-01T00:00:00',
      }],
      user: contractUsers[2]._id,
    };
    const response = await app.inject({
      method: 'POST',
      url: '/contracts',
      headers: { 'x-access-token': authToken },
      payload,
    });

    expect(response.statusCode).toBe(200);
    expect(response.result.data.contract).toBeDefined();

    const sectorHistories = await SectorHistory
      .find({ auxiliary: contractUsers[2]._id, company: authCompany._id })
      .lean();
    expect(sectorHistories.length).toBe(3);
    expect(sectorHistories[2].startDate).toEqual(moment(payload.startDate).startOf('day').toDate());
  });

  it('should not create a contract if user is not from the same company', async () => {
    const payload = {
      startDate: '2019-09-01T00:00:00',
      versions: [{
        weeklyHours: 24,
        grossHourlyRate: 10.43,
        startDate: '2019-09-01T00:00:00',
      }],
      user: otherContractUser._id,
    };
    const response = await app.inject({
      method: 'POST',
      url: '/contracts',
      payload: { ...payload, user: otherContractUser._id },
      headers: { 'x-access-token': authToken },
    });

    expect(response.statusCode).toBe(403);
  });

  const missingParams = [
    { path: 'startDate' },
    { path: 'versions.0.grossHourlyRate' },
    { path: 'versions.0.weeklyHours' },
    { path: 'versions.0.startDate' },
    { path: 'user' },
  ];
  missingParams.forEach((test) => {
    it(`should return a 400 error if missing '${test.path}' parameter`, async () => {
      const payload = {
        startDate: '2019-09-01T00:00:00',
        versions: [{
          weeklyHours: 24,
          grossHourlyRate: 10.43,
          startDate: '2019-09-01T00:00:00',
        }],
        user: contractUsers[1]._id,
      };
      const response = await app.inject({
        method: 'POST',
        url: '/contracts',
        payload: omit(cloneDeep(payload), test.path),
        headers: { 'x-access-token': authToken },
      });
      expect(response.statusCode).toBe(400);
    });
  });

  const roles = [
    { name: 'client_admin', expectedCode: 200 },
    { name: 'auxiliary', expectedCode: 403 },
    { name: 'helper', expectedCode: 403 },
    { name: 'auxiliary_without_company', expectedCode: 403 },
    { name: 'client_admin', expectedCode: 403, erp: false },
  ];

  roles.forEach((role) => {
    it(`should return ${role.expectedCode} as user is ${role.name}${role.erp ? '' : ' without erp'}`, async () => {
      const payload = {
        startDate: '2019-09-01T00:00:00',
        versions: [{
          weeklyHours: 24,
          grossHourlyRate: 10.43,
          startDate: '2019-09-01T00:00:00',
        }],
        user: contractUsers[1]._id,
      };
      authToken = await getToken(role.name, role.erp);
      const response = await app.inject({
        method: 'POST',
        url: '/contracts',
        payload,
        headers: { 'x-access-token': authToken },
      });

      expect(response.statusCode).toBe(role.expectedCode);
    });
  });
});

describe('PUT contract/:id', () => {
  let authToken = null;
  beforeEach(populateDB);
  beforeEach(async () => {
    authToken = await getToken('client_admin');
  });

  it('should end the contract, unassign future interventions and remove other future events', async () => {
    const endDate = '2019-07-08T14:00:00';
    const payload = { endDate, endReason: 'mutation', endNotificationDate: '2019-07-01T14:00:00' };
    const response = await app.inject({
      method: 'PUT',
      url: `/contracts/${contractsList[0]._id}`,
      headers: { 'x-access-token': authToken },
      payload,
    });

    expect(response.statusCode).toBe(200);
    expect(response.result.data.contract).toBeDefined();
    expect(moment(response.result.data.contract.endDate).format('YYYY/MM/DD'))
      .toEqual(moment(endDate).format('YYYY/MM/DD'));

    const user = await User.findOne({ _id: contractsList[0].user });
    expect(user.inactivityDate).not.toBeNull();
    expect(moment(user.inactivityDate).format('YYYY-MM-DD'))
      .toEqual(moment(endDate).add('1', 'months').startOf('M').format('YYYY-MM-DD'));

    const events = await Event.find({ company: authCompany._id }).lean();
    expect(events.length).toBe(contractEvents.length - 1);
    const absence = events.find(event =>
      event.type === 'absence' && moment(event.startDate).isSame('2019-07-06', 'day'));
    expect(moment(absence.endDate).isSame('2019-07-08', 'day')).toBeTruthy();

    const sectorHistories = await SectorHistory.find({ company: authCompany._id, auxiliary: user._id }).lean();
    expect(sectorHistories[0].endDate).toEqual(moment(response.result.data.contract.endDate).endOf('day').toDate());
  });

  it('should return 403 as user and contract are not in the same company', async () => {
    const payload = {
      endDate: '2019-07-08T14:00:00',
      endReason: 'mutation',
      endNotificationDate: '2019-07-01T14:00:00',
    };
    const response = await app.inject({
      method: 'PUT',
      url: `/contracts/${otherContract._id}`,
      headers: { 'x-access-token': authToken },
      payload,
    });

    expect(response.statusCode).toBe(403);
  });

  it('should return 404 error if no contract', async () => {
    const invalidId = new ObjectID().toHexString();
    const payload = {
      endDate: '2019-07-08T14:00:00',
      endReason: 'mutation',
      endNotificationDate: '2019-07-01T14:00:00',
    };
    const response = await app.inject({
      method: 'PUT',
      url: `/contracts/${invalidId}`,
      headers: { 'x-access-token': authToken },
      payload,
    });

    expect(response.statusCode).toBe(404);
  });

  const missingFields = ['endDate', 'endReason', 'endNotificationDate'];
  missingFields.forEach((param) => {
    it(`should return a 400 error if missing '${param}' parameter`, async () => {
      const payload = {
        endDate: '2019-07-08T14:00:00',
        endReason: 'mutation',
        endNotificationDate: '2019-07-01T14:00:00',
      };
      const invalidPayload = omit(payload, param);
      const response = await app.inject({
        method: 'PUT',
        url: `/contracts/${contractsList[0]._id}`,
        headers: { 'x-access-token': authToken },
        payload: invalidPayload,
      });

      expect(response.statusCode).toBe(400);
    });
  });

  it('should return a 403 error if contract already has an end date', async () => {
    const payload = {
      endDate: '2019-07-08T14:00:00',
      endReason: 'mutation',
      endNotificationDate: '2019-07-01T14:00:00',
    };
    const response = await app.inject({
      method: 'PUT',
      url: `/contracts/${contractsList[4]._id}`,
      headers: { 'x-access-token': authToken },
      payload,
    });

    expect(response.statusCode).toBe(403);
  });

  const roles = [
    { name: 'client_admin', expectedCode: 200 },
    { name: 'auxiliary', expectedCode: 403 },
    { name: 'helper', expectedCode: 403 },
    { name: 'auxiliary_without_company', expectedCode: 403 },
  ];

  roles.forEach((role) => {
    it(`should return ${role.expectedCode} as user is ${role.name}`, async () => {
      const payload = {
        endDate: '2019-07-08T14:00:00',
        endReason: 'mutation',
        endNotificationDate: '2019-07-01T14:00:00',
      };
      const response = await app.inject({
        method: 'PUT',
        url: `/contracts/${contractsList[0]._id}`,
        payload,
        headers: { 'x-access-token': await getToken(role.name) },
      });

      expect(response.statusCode).toBe(role.expectedCode);
    });
  });
});

describe('PUT contract/:id/versions/:versionId', () => {
  let authToken = null;
  beforeEach(populateDB);
  beforeEach(async () => {
    authToken = await getToken('client_admin');
  });

  it('should update a contract', async () => {
    const payload = { grossHourlyRate: 8 };
    const response = await app.inject({
      method: 'PUT',
      url: `/contracts/${contractsList[5]._id}/versions/${contractsList[5].versions[0]._id}`,
      headers: { 'x-access-token': authToken },
      payload,
    });

    expect(response.statusCode).toBe(200);
    const contract = await Contract.findById(contractsList[5]._id).lean();
    expect(contract.versions[0].grossHourlyRate).toEqual(8);
  });

  it('should update a contract startDate and update corresponding sectorhistory', async () => {
    const payload = { startDate: '2018-11-28' };
    const response = await app.inject({
      method: 'PUT',
      url: `/contracts/${contractsList[2]._id}/versions/${contractsList[2].versions[0]._id}`,
      headers: { 'x-access-token': authToken },
      payload,
    });

    expect(response.statusCode).toBe(200);
    const contract = await Contract.findById(contractsList[2]._id).lean();
    expect(moment(payload.startDate).isSame(contract.startDate, 'day')).toBeTruthy();

    const sectorHistory = await SectorHistory.findOne({ auxiliary: contract.user }).lean();
    expect(moment(payload.startDate).isSame(sectorHistory.startDate, 'day')).toBeTruthy();
  });

  it('should update startDate, corresponding sectorhistory and delete unrelevant ones', async () => {
    const payload = { startDate: '2020-02-01' };
    const response = await app.inject({
      method: 'PUT',
      url: `/contracts/${contractsList[5]._id}/versions/${contractsList[5].versions[0]._id}`,
      headers: { 'x-access-token': authToken },
      payload,
    });

    expect(response.statusCode).toBe(200);
    const contract = await Contract.findById(contractsList[5]._id).lean();
    expect(moment(payload.startDate).isSame(contract.startDate, 'day')).toBeTruthy();

    const sectorHistories = await SectorHistory.find({ auxiliary: contract.user, company: authCompany._id }).lean();
    expect(sectorHistories.length).toBe(1);
    expect(moment(payload.startDate).isSame(sectorHistories[0].startDate, 'day')).toBeTruthy();
  });

  it('should return a 403 if contract is not from the same company', async () => {
    const payload = { startDate: '2020-02-01' };
    const response = await app.inject({
      method: 'PUT',
      url: `/contracts/${otherContract._id}/versions/${otherContract.versions[0]._id}`,
      headers: { 'x-access-token': authToken },
      payload,
    });

    expect(response.statusCode).toBe(403);
  });

  it('should return a 403 if contract has an endDate', async () => {
    const payload = { startDate: '2020-02-01' };
    const response = await app.inject({
      method: 'PUT',
      url: `/contracts/${contractsList[3]._id}/versions/${contractsList[3].versions[0]._id}`,
      headers: { 'x-access-token': authToken },
      payload,
    });

    expect(response.statusCode).toBe(403);
  });

  const roles = [
    { name: 'client_admin', expectedCode: 200 },
    { name: 'auxiliary', expectedCode: 403 },
    { name: 'helper', expectedCode: 403 },
    { name: 'auxiliary_without_company', expectedCode: 403 },
  ];
  roles.forEach((role) => {
    it(`should return ${role.expectedCode} as user is ${role.name}`, async () => {
      const response = await app.inject({
        method: 'PUT',
        url: `/contracts/${contractsList[5]._id}/versions/${contractsList[5].versions[0]._id}`,
        payload: { grossHourlyRate: 8 },
        headers: { 'x-access-token': await getToken(role.name) },
      });

      expect(response.statusCode).toBe(role.expectedCode);
    });
  });
});

describe('DELETE contracts/:id/versions/:versionId', () => {
  let authToken = null;
  beforeEach(populateDB);
  beforeEach(async () => {
    authToken = await getToken('client_admin');
  });

  it('should delete a contract version by id', async () => {
    const response = await app.inject({
      method: 'DELETE',
      url: `/contracts/${contractsList[5]._id}/versions/${contractsList[5].versions[0]._id}`,
      headers: { 'x-access-token': authToken },
    });

    expect(response.statusCode).toBe(200);
    const sectorHistories = await SectorHistory
      .find({ company: authCompany._id, auxiliary: contractsList[5].user })
      .lean();

    expect(sectorHistories.length).toEqual(1);
    expect(sectorHistories.startDate).toBeUndefined();
  });

  it('should return a 404 error if contract not found', async () => {
    const invalidId = new ObjectID().toHexString();
    const response = await app.inject({
      method: 'DELETE',
      url: `/contracts/${invalidId}`,
      headers: { 'x-access-token': authToken },
    });

    expect(response.statusCode).toBe(404);
  });

  it('should return a 403 error if versionId is not the last version', async () => {
    const invalidId = new ObjectID().toHexString();
    const response = await app.inject({
      method: 'DELETE',
      url: `/contracts/${contractsList[0]._id}/versions/${invalidId}`,
      headers: { 'x-access-token': authToken },
    });

    expect(response.statusCode).toBe(403);
  });

  const roles = [
    { name: 'client_admin', expectedCode: 200 },
    { name: 'auxiliary', expectedCode: 403 },
    { name: 'helper', expectedCode: 403 },
    { name: 'auxiliary_without_company', expectedCode: 403 },
  ];

  roles.forEach((role) => {
    it(`should return ${role.expectedCode} as user is ${role.name}`, async () => {
      authToken = await getToken(role.name);
      const response = await app.inject({
        method: 'DELETE',
        url: `/contracts/${contractsList[5]._id}/versions/${contractsList[5].versions[0]._id}`,
        headers: { 'x-access-token': authToken },
      });

      expect(response.statusCode).toBe(role.expectedCode);
    });
  });
});

describe('GET contracts/staff-register', () => {
  let authToken = null;
  beforeEach(populateDB);
  beforeEach(async () => {
    authToken = await getToken('client_admin');
  });

  it('should return staff-register list', async () => {
    const response = await app.inject({
      method: 'GET',
      url: '/contracts/staff-register',
      headers: { 'x-access-token': authToken },
    });

    expect(response.statusCode).toBe(200);
    expect(response.result.data.staffRegister).toBeDefined();
    expect(response.result.data.staffRegister.length).toEqual(contractsList.length);
  });

  const roles = [
    { name: 'client_admin', expectedCode: 200 },
    { name: 'auxiliary', expectedCode: 403 },
    { name: 'helper', expectedCode: 403 },
  ];

  roles.forEach((role) => {
    it(`should return ${role.expectedCode} as user is ${role.name}`, async () => {
      authToken = await getToken(role.name);
      const response = await app.inject({
        method: 'GET',
        url: '/contracts/staff-register',
        headers: { 'x-access-token': authToken },
      });

      expect(response.statusCode).toBe(role.expectedCode);
    });
  });
});

describe('GET /{_id}/gdrive/{driveId}/upload', () => {
  const fakeDriveId = 'fakeDriveId';
  let addStub;
  let getFileByIdStub;
  let authToken = null;
  beforeEach(populateDB);
  beforeEach(async () => {
    authToken = await getToken('client_admin');
    addStub = sinon.stub(Drive, 'add');
    getFileByIdStub = sinon.stub(Drive, 'getFileById');
  });
  afterEach(() => {
    addStub.restore();
    getFileByIdStub.restore();
  });

  it('should upload a contract', async () => {
    addStub.returns({ id: 'fakeFileDriveId' });
    getFileByIdStub.returns({ webViewLink: 'fakeWebViewLink' });
    const payload = {
      fileName: 'contrat_signe',
      file: fs.createReadStream(path.join(__dirname, 'assets/test_upload.png')),
      type: 'signedContract',
      contractId: contractsList[0]._id.toHexString(),
      versionId: contractsList[0].versions[0]._id.toHexString(),
    };
    const form = generateFormData(payload);
    const response = await app.inject({
      method: 'POST',
      url: `/contracts/${contractsList[0]._id}/gdrive/${fakeDriveId}/upload`,
      payload: await GetStream(form),
      headers: { ...form.getHeaders(), 'x-access-token': authToken },
    });

    expect(response.statusCode).toEqual(200);
    sinon.assert.calledOnce(addStub);
    sinon.assert.calledOnce(getFileByIdStub);
  });

  const roles = [
    { name: 'helper', expectedCode: 403 },
    { name: 'auxiliary', expectedCode: 403 },
    { name: 'coach', expectedCode: 200 },
    { name: 'auxiliary_without_company', expectedCode: 403 },
  ];

  roles.forEach((role) => {
    it(`should return ${role.expectedCode} as user is ${role.name}`, async () => {
      const roleToken = await getToken(role.name);
      addStub.returns({ id: 'fakeFileDriveId' });
      getFileByIdStub.returns({ webViewLink: 'fakeWebViewLink' });
      const payload = {
        fileName: 'contrat_signe',
        file: fs.createReadStream(path.join(__dirname, 'assets/test_upload.png')),
        type: 'signedContract',
        contractId: contractsList[0]._id.toHexString(),
        versionId: contractsList[0].versions[0]._id.toHexString(),
      };
      const form = generateFormData(payload);
      const response = await app.inject({
        method: 'POST',
        url: `/contracts/${contractsList[0]._id}/gdrive/${fakeDriveId}/upload`,
        payload: await GetStream(form),
        headers: { ...form.getHeaders(), 'x-access-token': roleToken },
      });

      expect(response.statusCode).toEqual(role.expectedCode);
    });
  });
});
