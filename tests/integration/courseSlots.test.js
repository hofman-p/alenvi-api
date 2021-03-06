const expect = require('expect');
const omit = require('lodash/omit');
const { ObjectID } = require('mongodb');
const app = require('../../server');
const { populateDB, coursesList, courseSlotsList, trainer, stepsList } = require('./seed/courseSlotsSeed');
const { getToken, getTokenByCredentials } = require('./seed/authenticationSeed');
const CourseHistory = require('../../src/models/CourseHistory');
const { SLOT_CREATION, SLOT_DELETION, SLOT_EDITION } = require('../../src/helpers/constants');

describe('NODE ENV', () => {
  it('should be \'test\'', () => {
    expect(process.env.NODE_ENV).toBe('test');
  });
});

describe('COURSE SLOTS ROUTES - POST /courseslots', () => {
  let authToken;
  beforeEach(populateDB);

  describe('VENDOR_ADMIN', () => {
    beforeEach(async () => {
      authToken = await getToken('vendor_admin');
    });

    it('should create course slot', async () => {
      const payload = {
        startDate: '2020-01-04T17:00:00',
        endDate: '2020-01-04T20:00:00',
        course: courseSlotsList[0].course,
        step: stepsList[0]._id,
        address: {
          street: '37 rue de Ponthieu',
          zipCode: '75008',
          city: 'Paris',
          fullAddress: '37 rue de Ponthieu 75008 Paris',
          location: { type: 'Point', coordinates: [2.0987, 1.2345] },
        },
      };
      const response = await app.inject({
        method: 'POST',
        url: '/courseslots',
        headers: { Cookie: `alenvi_token=${authToken}` },
        payload,
      });

      expect(response.statusCode).toBe(200);

      const courseHistory = await CourseHistory.countDocuments({
        course: payload.course,
        'slot.startDate': payload.startDate,
        action: SLOT_CREATION,
      });

      expect(courseHistory).toEqual(1);
    });

    it('should create slot to plan', async () => {
      const payload = {
        course: coursesList[0]._id,
        address: {
          street: '37 rue de Ponthieu',
          zipCode: '75008',
          city: 'Paris',
          fullAddress: '37 rue de Ponthieu 75008 Paris',
          location: { type: 'Point', coordinates: [2.0987, 1.2345] },
        },
      };
      const response = await app.inject({
        method: 'POST',
        url: '/courseslots',
        headers: { Cookie: `alenvi_token=${authToken}` },
        payload,
      });

      expect(response.statusCode).toBe(200);
    });

    it('should return 409 if slots conflict', async () => {
      const payload = {
        startDate: courseSlotsList[0].startDate,
        endDate: courseSlotsList[0].endDate,
        course: coursesList[0]._id,
        step: stepsList[0]._id,
      };
      const response = await app.inject({
        method: 'POST',
        url: '/courseslots',
        headers: { Cookie: `alenvi_token=${authToken}` },
        payload,
      });

      expect(response.statusCode).toBe(409);
    });

    it('should return 400 if slots endDate without startDate', async () => {
      const payload = {
        endDate: '2020-03-04T17:00:00',
        course: coursesList[0]._id,
        step: stepsList[0]._id,
        address: {
          street: '37 rue de Ponthieu',
          zipCode: '75008',
          city: 'Paris',
          fullAddress: '37 rue de Ponthieu 75008 Paris',
          location: { type: 'Point', coordinates: [2.0987, 1.2345] },
        },
      };
      const response = await app.inject({
        method: 'POST',
        url: '/courseslots',
        headers: { Cookie: `alenvi_token=${authToken}` },
        payload,
      });

      expect(response.statusCode).toBe(400);
    });

    it('should return 400 if slots startDate without endDate', async () => {
      const payload = {
        startDate: '2020-03-04T17:00:00',
        course: coursesList[0]._id,
        step: stepsList[0]._id,
        address: {
          street: '37 rue de Ponthieu',
          zipCode: '75008',
          city: 'Paris',
          fullAddress: '37 rue de Ponthieu 75008 Paris',
          location: { type: 'Point', coordinates: [2.0987, 1.2345] },
        },
      };
      const response = await app.inject({
        method: 'POST',
        url: '/courseslots',
        headers: { Cookie: `alenvi_token=${authToken}` },
        payload,
      });

      expect(response.statusCode).toBe(400);
    });

    it('should return 400 if slots startDate is not on same day as endDate', async () => {
      const payload = {
        startDate: '2020-03-04T17:00:00',
        endDate: '2020-03-05T19:00:00',
        course: coursesList[0]._id,
        step: stepsList[0]._id,
        address: {
          street: '37 rue de Ponthieu',
          zipCode: '75008',
          city: 'Paris',
          fullAddress: '37 rue de Ponthieu 75008 Paris',
          location: { type: 'Point', coordinates: [2.0987, 1.2345] },
        },
      };
      const response = await app.inject({
        method: 'POST',
        url: '/courseslots',
        headers: { Cookie: `alenvi_token=${authToken}` },
        payload,
      });

      expect(response.statusCode).toBe(400);
    });

    it('should return 400 if slots startDate is after endDate', async () => {
      const payload = {
        startDate: '2020-03-04T20:00:00',
        endDate: '2020-03-04T19:00:00',
        course: coursesList[0]._id,
        step: stepsList[0]._id,
        address: {
          street: '37 rue de Ponthieu',
          zipCode: '75008',
          city: 'Paris',
          fullAddress: '37 rue de Ponthieu 75008 Paris',
          location: { type: 'Point', coordinates: [2.0987, 1.2345] },
        },
      };
      const response = await app.inject({
        method: 'POST',
        url: '/courseslots',
        headers: { Cookie: `alenvi_token=${authToken}` },
        payload,
      });

      expect(response.statusCode).toBe(400);
    });

    it('should return 400 if step is eLearning', async () => {
      const payload = {
        startDate: '2020-03-04T17:00:00',
        endDate: '2020-03-04T19:00:00',
        course: coursesList[0]._id,
        step: stepsList[1]._id,
        address: {
          street: '37 rue de Ponthieu',
          zipCode: '75008',
          city: 'Paris',
          fullAddress: '37 rue de Ponthieu 75008 Paris',
          location: { type: 'Point', coordinates: [2.0987, 1.2345] },
        },
      };
      const response = await app.inject({
        method: 'POST',
        url: '/courseslots',
        headers: { Cookie: `alenvi_token=${authToken}` },
        payload,
      });

      expect(response.statusCode).toBe(400);
    });

    it('should return 400 if step is not from program', async () => {
      const payload = {
        startDate: '2020-03-04T17:00:00',
        endDate: '2020-03-04T19:00:00',
        course: coursesList[0]._id,
        step: stepsList[3]._id,
        address: {
          street: '37 rue de Ponthieu',
          zipCode: '75008',
          city: 'Paris',
          fullAddress: '37 rue de Ponthieu 75008 Paris',
          location: { type: 'Point', coordinates: [2.0987, 1.2345] },
        },
      };
      const response = await app.inject({
        method: 'POST',
        url: '/courseslots',
        headers: { Cookie: `alenvi_token=${authToken}` },
        payload,
      });

      expect(response.statusCode).toBe(400);
    });

    const missingParams = ['course', 'step', 'endDate', 'address.fullAddress'];
    missingParams.forEach((param) => {
      it(`should return a 400 error if missing '${param}' parameter`, async () => {
        const payload = {
          startDate: '2020-03-04T09:00:00',
          endDate: '2020-03-04T11:00:00',
          step: stepsList[0]._id,
          course: coursesList[0]._id,
          address: {
            street: '37 rue de Ponthieu',
            zipCode: '75008',
            city: 'Paris',
            fullAddress: '37 rue de Ponthieu 75008 Paris',
            location: { type: 'Point', coordinates: [2.0987, 1.2345] },
          },
        };
        const response = await app.inject({
          method: 'POST',
          url: '/courseslots',
          payload: omit({ ...payload }, param),
          headers: { Cookie: `alenvi_token=${authToken}` },
        });

        expect(response.statusCode).toBe(400);
      });
    });
  });

  describe('Other roles', () => {
    it('should return 200 as user is course trainer', async () => {
      const payload = {
        startDate: '2020-03-04T09:00:00',
        endDate: '2020-03-04T11:00:00',
        course: coursesList[1]._id,
        step: stepsList[0]._id,
      };
      authToken = await getTokenByCredentials(trainer.local);
      const response = await app.inject({
        method: 'POST',
        url: '/courseslots',
        headers: { Cookie: `alenvi_token=${authToken}` },
        payload,
      });

      expect(response.statusCode).toBe(200);
    });

    it('should return 200 as user is client admin from course company', async () => {
      const payload = {
        startDate: '2020-03-04T09:00:00',
        endDate: '2020-03-04T11:00:00',
        course: coursesList[0]._id,
        step: stepsList[0]._id,
      };
      authToken = await getToken('client_admin');
      const response = await app.inject({
        method: 'POST',
        url: '/courseslots',
        headers: { Cookie: `alenvi_token=${authToken}` },
        payload,
      });

      expect(response.statusCode).toBe(200);
    });

    it('should return 200 as user is coach from course company', async () => {
      const payload = {
        startDate: '2020-03-04T09:00:00',
        endDate: '2020-03-04T11:00:00',
        course: coursesList[0]._id,
        step: stepsList[0]._id,
      };
      authToken = await getToken('coach');
      const response = await app.inject({
        method: 'POST',
        url: '/courseslots',
        headers: { Cookie: `alenvi_token=${authToken}` },
        payload,
      });

      expect(response.statusCode).toBe(200);
    });

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
        const payload = {
          startDate: '2020-03-04T09:00:00',
          endDate: '2020-03-04T11:00:00',
          course: coursesList[1]._id,
          step: stepsList[0]._id,
        };
        authToken = await getToken(role.name);
        const response = await app.inject({
          method: 'POST',
          url: '/courseslots',
          headers: { Cookie: `alenvi_token=${authToken}` },
          payload,
        });

        expect(response.statusCode).toBe(role.expectedCode);
      });
    });
  });
});

describe('COURSE SLOTS ROUTES - PUT /courseslots/{_id}', () => {
  let authToken;
  beforeEach(populateDB);

  describe('VENDOR_ADMIN', () => {
    beforeEach(async () => {
      authToken = await getToken('vendor_admin');
    });

    it('should update course slot', async () => {
      const payload = {
        startDate: '2020-03-04T09:00:00',
        endDate: '2020-03-04T11:00:00',
        step: stepsList[0]._id,
      };
      const response = await app.inject({
        method: 'PUT',
        url: `/courseslots/${courseSlotsList[0]._id}`,
        headers: { Cookie: `alenvi_token=${authToken}` },
        payload,
      });

      expect(response.statusCode).toBe(200);

      const courseHistory = await CourseHistory.countDocuments({
        course: courseSlotsList[0].course,
        'update.startDate.to': payload.startDate,
        action: SLOT_EDITION,
      });

      expect(courseHistory).toEqual(1);
    });

    it('should return 400 if endDate without startDate', async () => {
      const payload = {
        endDate: '2020-03-04T09:00:00',
        step: stepsList[0]._id,
      };
      const response = await app.inject({
        method: 'PUT',
        url: `/courseslots/${courseSlotsList[0]._id}`,
        headers: { Cookie: `alenvi_token=${authToken}` },
        payload,
      });

      expect(response.statusCode).toBe(400);
    });

    it('should return 400 if startDate without endDate', async () => {
      const payload = {
        startDate: '2020-03-04T09:00:00',
        step: stepsList[0]._id,
      };
      const response = await app.inject({
        method: 'PUT',
        url: `/courseslots/${courseSlotsList[0]._id}`,
        headers: { Cookie: `alenvi_token=${authToken}` },
        payload,
      });

      expect(response.statusCode).toBe(400);
    });

    it('should return 400 if startDate is not on same day as endDate', async () => {
      const payload = {
        startDate: '2020-03-04T09:00:00',
        endDate: '2020-03-05T12:00:00',
        step: stepsList[0]._id,
      };
      const response = await app.inject({
        method: 'PUT',
        url: `/courseslots/${courseSlotsList[0]._id}`,
        headers: { Cookie: `alenvi_token=${authToken}` },
        payload,
      });

      expect(response.statusCode).toBe(400);
    });

    it('should return 400 if startDate after endDate', async () => {
      const payload = {
        startDate: '2020-03-04T15:00:00',
        endDate: '2020-03-04T12:00:00',
        step: stepsList[0]._id,
      };
      const response = await app.inject({
        method: 'PUT',
        url: `/courseslots/${courseSlotsList[0]._id}`,
        headers: { Cookie: `alenvi_token=${authToken}` },
        payload,
      });

      expect(response.statusCode).toBe(400);
    });

    it('should return 404 if slot not found', async () => {
      const payload = {
        startDate: '2020-03-04T09:00:00',
        endDate: '2020-03-04T11:00:00',
        step: stepsList[0]._id,
      };
      const response = await app.inject({
        method: 'PUT',
        url: `/courseslots/${new ObjectID()}`,
        headers: { Cookie: `alenvi_token=${authToken}` },
        payload,
      });

      expect(response.statusCode).toBe(404);
    });

    it('should return 400 if step is eLearning', async () => {
      const payload = {
        startDate: '2020-03-04T17:00:00',
        endDate: '2020-03-04T19:00:00',
        course: coursesList[0]._id,
        step: stepsList[1]._id,
        address: {
          street: '37 rue de Ponthieu',
          zipCode: '75008',
          city: 'Paris',
          fullAddress: '37 rue de Ponthieu 75008 Paris',
          location: { type: 'Point', coordinates: [2.0987, 1.2345] },
        },
      };
      const response = await app.inject({
        method: 'PUT',
        url: `/courseslots/${courseSlotsList[0]._id}`,
        headers: { Cookie: `alenvi_token=${authToken}` },
        payload,
      });
      expect(response.statusCode).toBe(400);
    });

    it('should return 400 if step is not from program', async () => {
      const payload = {
        startDate: '2020-03-04T17:00:00',
        endDate: '2020-03-04T19:00:00',
        course: coursesList[0]._id,
        step: stepsList[1]._id,
        address: {
          street: '37 rue de Ponthieu',
          zipCode: '75008',
          city: 'Paris',
          fullAddress: '37 rue de Ponthieu 75008 Paris',
          location: { type: 'Point', coordinates: [2.0987, 1.2345] },
        },
      };
      const response = await app.inject({
        method: 'PUT',
        url: `/courseslots/${courseSlotsList[0]._id}`,
        headers: { Cookie: `alenvi_token=${authToken}` },
        payload,
      });

      expect(response.statusCode).toBe(400);
    });

    const missingParams = ['startDate', 'step', 'endDate'];
    missingParams.forEach((param) => {
      it(`should return a 400 error if missing '${param}' parameter`, async () => {
        const payload = {
          startDate: '2020-03-04T09:00:00',
          endDate: '2020-03-04T11:00:00',
          step: stepsList[0]._id,
        };
        const response = await app.inject({
          method: 'PUT',
          url: `/courseslots/${courseSlotsList[0]._id}`,
          headers: { Cookie: `alenvi_token=${authToken}` },
          payload: omit({ ...payload }, param),
        });

        expect(response.statusCode).toBe(400);
      });
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

    it('should a 200 as user is course trainer', async () => {
      authToken = await getTokenByCredentials(trainer.local);
      const payload = { startDate: '2020-03-04T09:00:00', endDate: '2020-03-04T11:00:00', step: stepsList[0]._id };
      const response = await app.inject({
        method: 'PUT',
        url: `/courseslots/${courseSlotsList[2]._id}`,
        headers: { Cookie: `alenvi_token=${authToken}` },
        payload,
      });

      expect(response.statusCode).toBe(200);
    });

    it('should return 200 as user is client admin from course company', async () => {
      authToken = await getToken('client_admin');
      const payload = { startDate: '2020-03-04T09:00:00', endDate: '2020-03-04T11:00:00', step: stepsList[0]._id };
      const response = await app.inject({
        method: 'PUT',
        url: `/courseslots/${courseSlotsList[0]._id}`,
        headers: { Cookie: `alenvi_token=${authToken}` },
        payload,
      });

      expect(response.statusCode).toBe(200);
    });

    roles.forEach((role) => {
      it(`should return ${role.expectedCode} as user is ${role.name}`, async () => {
        const payload = { startDate: '2020-03-04T09:00:00', endDate: '2020-03-04T11:00:00', step: stepsList[0]._id };
        authToken = await getToken(role.name);
        const response = await app.inject({
          method: 'PUT',
          url: `/courseslots/${courseSlotsList[3]._id}`,
          headers: { Cookie: `alenvi_token=${authToken}` },
          payload,
        });

        expect(response.statusCode).toBe(role.expectedCode);
      });
    });
  });
});

describe('COURSES SLOTS ROUTES - DELETE /courseslots/{_id}', () => {
  let authToken;
  beforeEach(populateDB);

  describe('VENDOR_ADMIN', () => {
    beforeEach(async () => {
      authToken = await getToken('vendor_admin');
    });

    it('should delete course slot and create courseHistory', async () => {
      const response = await app.inject({
        method: 'DELETE',
        url: `/courseslots/${courseSlotsList[0]._id}`,
        headers: { Cookie: `alenvi_token=${authToken}` },
      });

      expect(response.statusCode).toBe(200);

      const courseHistory = await CourseHistory.countDocuments({
        course: courseSlotsList[0].course,
        'slot.startDate': courseSlotsList[0].startDate,
        action: SLOT_DELETION,
      });

      expect(courseHistory).toEqual(1);
    });

    it('should return 404 if slot not found', async () => {
      const response = await app.inject({
        method: 'DELETE',
        url: `/courseslots/${new ObjectID()}`,
        headers: { Cookie: `alenvi_token=${authToken}` },
      });

      expect(response.statusCode).toBe(404);
    });

    it('should return 409 if slot has an attendance', async () => {
      const response = await app.inject({
        method: 'DELETE',
        url: `/courseslots/${courseSlotsList[4]._id}`,
        headers: { Cookie: `alenvi_token=${authToken}` },
      });

      expect(response.statusCode).toBe(409);
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

    it('should return a 200 as user is course trainer', async () => {
      authToken = await getTokenByCredentials(trainer.local);
      const response = await app.inject({
        method: 'DELETE',
        url: `/courseslots/${courseSlotsList[2]._id}`,
        headers: { Cookie: `alenvi_token=${authToken}` },
      });

      expect(response.statusCode).toBe(200);
    });

    it('should return 200 as user is client admin from course company', async () => {
      authToken = await getToken('client_admin');
      const response = await app.inject({
        method: 'DELETE',
        url: `/courseslots/${courseSlotsList[0]._id}`,
        headers: { Cookie: `alenvi_token=${authToken}` },
      });

      expect(response.statusCode).toBe(200);
    });

    roles.forEach((role) => {
      it(`should return ${role.expectedCode} as user is ${role.name}`, async () => {
        authToken = await getToken(role.name);
        const response = await app.inject({
          method: 'DELETE',
          url: `/courseslots/${courseSlotsList[3]._id}`,
          headers: { Cookie: `alenvi_token=${authToken}` },
        });

        expect(response.statusCode).toBe(role.expectedCode);
      });
    });
  });
});
