const expect = require('expect');
const app = require('../../server');
const omit = require('lodash/omit');
const { ObjectID } = require('mongodb');
const {
  populateDB,
  establishmentsList,
  establishmentFromOtherCompany,
  userFromOtherCompany,
} = require('./seed/establishmentsSeed');
const { getToken, getTokenByCredentials, authCompany } = require('./seed/authenticationSeed');
const Establishment = require('../../src/models/Establishment');

describe('NODE ENV', () => {
  it('should be "test"', () => {
    expect(process.env.NODE_ENV).toBe('test');
  });
});

describe('ESTABLISHMENTS ROUTES', () => {
  let authToken = null;
  describe('POST /estblishments', () => {
    const payload = {
      name: 'Titi',
      siret: '13605658901234',
      address: {
        street: '42, avenue des Colibris',
        fullAddress: '42, avenue des Colibris 75020 Paris',
        zipCode: '75020',
        city: 'Paris',
        location: {
          type: 'Point',
          coordinates: [4.849302, 2.90887],
        },
      },
      phone: '0113956789',
      workHealthService: 'MT01',
      urssafCode: '117',
    };

    describe('Admin', () => {
      beforeEach(populateDB);
      beforeEach(async () => {
        authToken = await getToken('admin');
      });

      it('should create a new establishment', async () => {
        const response = await app.inject({
          method: 'POST',
          url: '/establishments',
          payload,
          headers: { 'x-access-token': authToken },
        });

        expect(response.statusCode).toBe(200);
        expect(response.result.data.establishment).toMatchObject({ ...payload, company: authCompany._id });
        const establishmentsCount = await Establishment.countDocuments({ company: authCompany });
        expect(establishmentsCount).toBe(establishmentsList.length + 1);
      });

      const falsyPaths = [
        'name',
        'siret',
        'address.street',
        'address.fullAddress',
        'address.zipCode',
        'address.city',
        'address.location.type',
        'address.location.coordinates',
        'phone',
        'workHealthService',
        'urssafCode',
      ];

      falsyPaths.forEach((path) => {
        it(`should return a 400 error if param ${path} is missing`, async () => {
          const response = await app.inject({
            method: 'POST',
            url: '/establishments',
            payload: omit({ ...payload }, path),
            headers: { 'x-access-token': authToken },
          });

          expect(response.statusCode).toBe(400);
        });
      });

      it('should return a 400 error if name contains invalid character', async () => {
        const response = await app.inject({
          method: 'POST',
          url: '/establishments',
          payload: { ...payload, name: 'Terre\\Lune' },
          headers: { 'x-access-token': authToken },
        });

        expect(response.statusCode).toBe(400);
      });

      it('should return a 400 error if name length is greater than 32 caracters', async () => {
        const response = await app.inject({
          method: 'POST',
          url: '/establishments',
          payload: { ...payload, name: 'qwertyuioplkjhgfdsamnbvcxzpoiuytrewq' },
          headers: { 'x-access-token': authToken },
        });

        expect(response.statusCode).toBe(400);
      });

      it('should return a 400 error if siret length is greater than 14 caracters', async () => {
        const response = await app.inject({
          method: 'POST',
          url: '/establishments',
          payload: { ...payload, siret: '12345678900987654321' },
          headers: { 'x-access-token': authToken },
        });

        expect(response.statusCode).toBe(400);
      });

      it('should return a 400 error if siret contains letters', async () => {
        const response = await app.inject({
          method: 'POST',
          url: '/establishments',
          payload: { ...payload, siret: '1234567890098B' },
          headers: { 'x-access-token': authToken },
        });

        expect(response.statusCode).toBe(400);
      });

      it('should return a 400 error if phone number is invalid', async () => {
        const response = await app.inject({
          method: 'POST',
          url: '/establishments',
          payload: { ...payload, phone: '+33789345690' },
          headers: { 'x-access-token': authToken },
        });

        expect(response.statusCode).toBe(400);
      });

      it('should return a 400 error if work health service code is invalid', async () => {
        const response = await app.inject({
          method: 'POST',
          url: '/establishments',
          payload: { ...payload, workHealthService: 'MT500' },
          headers: { 'x-access-token': authToken },
        });

        expect(response.statusCode).toBe(400);
      });

      it('should return a 400 error if urssaf code is invalid', async () => {
        const response = await app.inject({
          method: 'POST',
          url: '/establishments',
          payload: { ...payload, urssafCode: '207' },
          headers: { 'x-access-token': authToken },
        });

        expect(response.statusCode).toBe(400);
      });
    });

    describe('Other roles', () => {
      const roles = [
        { name: 'helper', expectedCode: 403 },
        { name: 'auxiliary', expectedCode: 403 },
        { name: 'coach', expectedCode: 403 },
      ];

      roles.forEach((role) => {
        it(`should return ${role.expectedCode} as user is ${role.name}`, async () => {
          authToken = await getToken(role.name);
          const response = await app.inject({
            method: 'POST',
            url: '/establishments',
            payload,
            headers: { 'x-access-token': authToken },
          });

          expect(response.statusCode).toBe(role.expectedCode);
        });
      });
    });
  });

  describe('PUT /establishments/:id', () => {
    describe('Admin', () => {
      beforeEach(populateDB);
      beforeEach(async () => {
        authToken = await getToken('admin');
      });

      it('should create a new establishment', async () => {
        const payload = { name: 'Tutu', siret: '98765432109876' };
        const response = await app.inject({
          method: 'PUT',
          url: `/establishments/${establishmentsList[0]._id}`,
          payload,
          headers: { 'x-access-token': authToken },
        });

        expect(response.statusCode).toBe(200);
        expect(response.result.data.establishment).toMatchObject(payload);
      });

      it('should return a 400 error if name contains invalid character', async () => {
        const response = await app.inject({
          method: 'PUT',
          url: `/establishments/${establishmentsList[0]._id}`,
          payload: { name: 'Terre\\Lune' },
          headers: { 'x-access-token': authToken },
        });

        expect(response.statusCode).toBe(400);
      });

      it('should return a 400 error if name length is greater than 32 caracters', async () => {
        const response = await app.inject({
          method: 'PUT',
          url: `/establishments/${establishmentsList[0]._id}`,
          payload: { name: 'qwertyuioplkjhgfdsamnbvcxzpoiuytrewq' },
          headers: { 'x-access-token': authToken },
        });

        expect(response.statusCode).toBe(400);
      });

      it('should return a 400 error if siret length is greater than 14 caracters', async () => {
        const response = await app.inject({
          method: 'PUT',
          url: `/establishments/${establishmentsList[0]._id}`,
          payload: { siret: '12345678900987654321' },
          headers: { 'x-access-token': authToken },
        });

        expect(response.statusCode).toBe(400);
      });

      it('should return a 400 error if siret contains letters', async () => {
        const response = await app.inject({
          method: 'PUT',
          url: `/establishments/${establishmentsList[0]._id}`,
          payload: { siret: '1234567890098B' },
          headers: { 'x-access-token': authToken },
        });

        expect(response.statusCode).toBe(400);
      });

      it('should return a 400 error if phone number is invalid', async () => {
        const response = await app.inject({
          method: 'PUT',
          url: `/establishments/${establishmentsList[0]._id}`,
          payload: { phone: '+33789345690' },
          headers: { 'x-access-token': authToken },
        });

        expect(response.statusCode).toBe(400);
      });

      it('should return a 400 error if work health service code is invalid', async () => {
        const response = await app.inject({
          method: 'PUT',
          url: `/establishments/${establishmentsList[0]._id}`,
          payload: { workHealthService: 'MT500' },
          headers: { 'x-access-token': authToken },
        });

        expect(response.statusCode).toBe(400);
      });

      it('should return a 400 error if urssaf code is invalid', async () => {
        const response = await app.inject({
          method: 'PUT',
          url: `/establishments/${establishmentsList[0]._id}`,
          payload: { urssafCode: '207' },
          headers: { 'x-access-token': authToken },
        });

        expect(response.statusCode).toBe(400);
      });

      it('should return a 403 error if user is not from same company', async () => {
        const response = await app.inject({
          method: 'PUT',
          url: `/establishments/${establishmentFromOtherCompany._id}`,
          payload: { urssafCode: '117' },
          headers: { 'x-access-token': authToken },
        });

        expect(response.statusCode).toBe(403);
      });

      it('should return a 404 error if establishment does not exist', async () => {
        const response = await app.inject({
          method: 'PUT',
          url: `/establishments/${new ObjectID()}`,
          payload: { urssafCode: '117' },
          headers: { 'x-access-token': authToken },
        });

        expect(response.statusCode).toBe(404);
      });
    });

    describe('Other roles', () => {
      const roles = [
        { name: 'helper', expectedCode: 403 },
        { name: 'auxiliary', expectedCode: 403 },
        { name: 'coach', expectedCode: 403 },
      ];

      roles.forEach((role) => {
        it(`should return ${role.expectedCode} as user is ${role.name}`, async () => {
          authToken = await getToken(role.name);
          const response = await app.inject({
            method: 'PUT',
            url: `/establishments/${establishmentsList[0]._id}`,
            payload: { name: 'Tutu' },
            headers: { 'x-access-token': authToken },
          });

          expect(response.statusCode).toBe(role.expectedCode);
        });
      });
    });
  });

  describe('GET /etablishments', () => {
    describe('Admin', () => {
      beforeEach(populateDB);
      beforeEach(async () => {
        authToken = await getToken('admin');
      });

      it('should return establishments (company A)', async () => {
        const response = await app.inject({
          method: 'GET',
          url: '/establishments',
          headers: { 'x-access-token': authToken },
        });

        expect(response.statusCode).toBe(200);
        const { establishments } = response.result.data;
        expect(establishments).toHaveLength(establishmentsList.length);
        expect(establishments).toEqual(expect.arrayContaining([
          expect.objectContaining({ users: 0 }),
        ]));
      });

      it('should return establishments (company B)', async () => {
        authToken = await getTokenByCredentials(userFromOtherCompany.local);
        const response = await app.inject({
          method: 'GET',
          url: '/establishments',
          headers: { 'x-access-token': authToken },
        });

        expect(response.statusCode).toBe(200);
        expect(response.result.data.establishments).toHaveLength(1);
      });
    });
  });
});
