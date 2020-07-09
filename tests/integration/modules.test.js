const expect = require('expect');
const { ObjectID } = require('mongodb');
const app = require('../../server');
const Module = require('../../src/models/Module');
const { populateDB, modulesList } = require('./seed/modulesSeed');
const { getToken } = require('./seed/authenticationSeed');

describe('NODE ENV', () => {
  it("should be 'test'", () => {
    expect(process.env.NODE_ENV).toBe('test');
  });
});

describe('MODULES ROUTES - PUT /modules/{_id}', () => {
  let authToken = null;
  beforeEach(populateDB);
  const moduleId = modulesList[0]._id;
  const payload = { title: 'un nouveau module super innovant' };

  describe('VENDOR_ADMIN', () => {
    beforeEach(async () => {
      authToken = await getToken('vendor_admin');
    });

    it('should update module', async () => {
      const response = await app.inject({
        method: 'PUT',
        url: `/modules/${moduleId.toHexString()}`,
        payload,
        headers: { 'x-access-token': authToken },
      });

      const moduleUpdated = await Module.findById(moduleId);

      expect(response.statusCode).toBe(200);
      expect(moduleUpdated).toEqual(expect.objectContaining({ _id: moduleId, title: payload.title }));
    });

    it("should return a 400 if title is equal to '' ", async () => {
      const response = await app.inject({
        method: 'PUT',
        url: `/modules/${moduleId.toHexString()}`,
        payload: { title: '' },
        headers: { 'x-access-token': authToken },
      });

      expect(response.statusCode).toBe(400);
    });
  });

  describe('Other roles', () => {
    const roles = [
      { name: 'helper', expectedCode: 403 },
      { name: 'auxiliary', expectedCode: 403 },
      { name: 'auxiliary_without_company', expectedCode: 403 },
      { name: 'coach', expectedCode: 403 },
      { name: 'client_admin', expectedCode: 403 },
      { name: 'training_organisation_manager', expectedCode: 200 },
      { name: 'trainer', expectedCode: 403 },
    ];

    roles.forEach((role) => {
      it(`should return ${role.expectedCode} as user is ${role.name}`, async () => {
        authToken = await getToken(role.name);
        const response = await app.inject({
          method: 'PUT',
          payload,
          url: `/modules/${moduleId.toHexString()}`,
          headers: { 'x-access-token': authToken },
        });

        expect(response.statusCode).toBe(role.expectedCode);
      });
    });
  });
});

describe('MODULES ROUTES - POST /modules/{_id}/activity', () => {
  let authToken = null;
  beforeEach(populateDB);
  const payload = { title: 'new activity' };

  describe('VENDOR_ADMIN', () => {
    beforeEach(async () => {
      authToken = await getToken('vendor_admin');
    });

    it('should create activity', async () => {
      const moduleId = modulesList[0]._id;
      const response = await app.inject({
        method: 'POST',
        url: `/modules/${moduleId.toHexString()}/activity`,
        payload,
        headers: { 'x-access-token': authToken },
      });

      const moduleUpdated = await Module.findById(moduleId);

      expect(response.statusCode).toBe(200);
      expect(moduleUpdated._id).toEqual(moduleId);
      expect(moduleUpdated.activities.length).toEqual(1);
    });

    it('should return a 400 if missing title', async () => {
      const moduleId = modulesList[0]._id;
      const response = await app.inject({
        method: 'POST',
        url: `/modules/${moduleId.toHexString()}/activity`,
        payload: { },
        headers: { 'x-access-token': authToken },
      });

      expect(response.statusCode).toBe(400);
    });

    it('should return a 400 if module does not exist', async () => {
      const wrongId = new ObjectID();
      const response = await app.inject({
        method: 'POST',
        url: `/modules/${wrongId}/activity`,
        payload,
        headers: { 'x-access-token': authToken },
      });

      expect(response.statusCode).toBe(400);
    });
  });

  describe('Other roles', () => {
    const roles = [
      { name: 'helper', expectedCode: 403 },
      { name: 'auxiliary', expectedCode: 403 },
      { name: 'auxiliary_without_company', expectedCode: 403 },
      { name: 'coach', expectedCode: 403 },
      { name: 'client_admin', expectedCode: 403 },
      { name: 'training_organisation_manager', expectedCode: 200 },
      { name: 'trainer', expectedCode: 403 },
    ];

    roles.forEach((role) => {
      it(`should return ${role.expectedCode} as user is ${role.name}`, async () => {
        authToken = await getToken(role.name);
        const moduleId = modulesList[0]._id;
        const response = await app.inject({
          method: 'POST',
          payload: { title: 'new name' },
          url: `/modules/${moduleId.toHexString()}/activity`,
          headers: { 'x-access-token': authToken },
        });

        expect(response.statusCode).toBe(role.expectedCode);
      });
    });
  });
});