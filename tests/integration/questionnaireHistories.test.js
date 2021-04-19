const expect = require('expect');
const { ObjectID } = require('mongodb');
const omit = require('lodash/omit');
const app = require('../../server');
const {
  populateDB,
  questionnairesList,
  questionnaireHistoriesUsersList,
  cardsList,
  coursesList,
} = require('./seed/questionnaireHistoriesSeed');
const { getTokenByCredentials } = require('./seed/authenticationSeed');
const { noRoleNoCompany } = require('../seed/userSeed');
const QuestionnaireHistory = require('../../src/models/QuestionnaireHistory');

describe('NODE ENV', () => {
  it('should be \'test\'', () => {
    expect(process.env.NODE_ENV).toBe('test');
  });
});

describe('QUESTIONNAIRE HISTORIES ROUTES - POST /questionnairehistories', () => {
  let authToken = null;
  const payload = {
    course: coursesList[0]._id,
    user: questionnaireHistoriesUsersList[0],
    questionnaire: questionnairesList[0]._id,
    questionnaireAnswersList: [
      { card: cardsList[0]._id, answerList: ['blabla'] },
      { card: cardsList[3]._id, answerList: ['blebleble'] },
      { card: cardsList[4]._id, answerList: [new ObjectID(), new ObjectID()] },
      { card: cardsList[5]._id, answerList: [new ObjectID()] },
    ],
  };

  beforeEach(populateDB);

  it('should return a 401 if user is not connected', async () => {
    const response = await app.inject({ method: 'POST', url: '/questionnairehistories', payload });

    expect(response.statusCode).toBe(401);
  });

  describe('Logged user', () => {
    beforeEach(async () => {
      authToken = await getTokenByCredentials(noRoleNoCompany.local);
    });

    it('should create questionnaireHistory', async () => {
      const response = await app.inject({
        method: 'POST',
        url: '/questionnairehistories',
        payload,
        headers: { 'x-access-token': authToken },
      });

      expect(response.statusCode).toBe(200);
    });

    it('should create questionnaireHistory without questionnaireAnswersList', async () => {
      await QuestionnaireHistory.deleteMany({});

      const response = await app.inject({
        method: 'POST',
        url: '/questionnairehistories',
        payload: omit(payload, 'questionnaireAnswersList'),
        headers: { 'x-access-token': authToken },
      });

      expect(response.statusCode).toBe(200);
    });

    it('should return a 404 if user doesn\'t exist', async () => {
      const response = await app.inject({
        method: 'POST',
        url: '/questionnairehistories',
        payload: { ...payload, user: new ObjectID() },
        headers: { 'x-access-token': authToken },
      });

      expect(response.statusCode).toBe(404);
    });

    it('should return a 404 if questionnaire doesn\'t exist', async () => {
      const response = await app.inject({
        method: 'POST',
        url: '/questionnairehistories',
        payload: { ...payload, questionnaire: new ObjectID() },
        headers: { 'x-access-token': authToken },
      });

      expect(response.statusCode).toBe(404);
    });

    it('should return a 404 if course doesn\'t exist ', async () => {
      const response = await app.inject({
        method: 'POST',
        url: '/questionnairehistories',
        payload: { ...payload, course: new ObjectID() },
        headers: { 'x-access-token': authToken },
      });

      expect(response.statusCode).toBe(404);
    });

    it('should return 400 if questionnaire answer without card', async () => {
      const response = await app.inject({
        method: 'POST',
        url: '/questionnairehistories',
        payload: { ...payload, questionnaireAnswersList: [{ answerList: [new ObjectID(), new ObjectID()] }] },
        headers: { 'x-access-token': authToken },
      });

      expect(response.statusCode).toBe(400);
    });

    it('should return 400 if questionnaire answer without answer', async () => {
      const response = await app.inject({
        method: 'POST',
        url: '/questionnairehistories',
        payload: { ...payload, questionnaireAnswersList: [{ card: cardsList[0]._id }] },
        headers: { 'x-access-token': authToken },
      });

      expect(response.statusCode).toBe(400);
    });

    it('should return 404 if card does not exist', async () => {
      await QuestionnaireHistory.deleteMany({});

      const response = await app.inject({
        method: 'POST',
        url: '/questionnairehistories',
        payload: { ...payload, questionnaireAnswersList: [{ card: new ObjectID(), answerList: ['blabla'] }] },
        headers: { 'x-access-token': authToken },
      });

      expect(response.statusCode).toBe(404);
    });

    it('should return 404 if card not in questionnaire', async () => {
      const response = await app.inject({
        method: 'POST',
        url: '/questionnairehistories',
        payload: { ...payload, questionnaireAnswersList: [{ card: cardsList[1]._id, answerList: ['blabla'] }] },
        headers: { 'x-access-token': authToken },
      });

      expect(response.statusCode).toBe(404);
    });

    it('should return 422 if card not a survey, an open question or a question/answer', async () => {
      const response = await app.inject({
        method: 'POST',
        url: '/questionnairehistories',
        payload: { ...payload, questionnaireAnswersList: [{ card: cardsList[2]._id, answerList: ['blabla'] }] },
        headers: { 'x-access-token': authToken },
      });

      expect(response.statusCode).toBe(422);
    });

    it('should return 422 if card is a survey and has more than one item in answerList', async () => {
      const response = await app.inject({
        method: 'POST',
        url: '/questionnairehistories',
        payload: { ...payload, questionnaireAnswersList: [{ card: cardsList[0]._id, answerList: ['bla', 'ble'] }] },
        headers: { 'x-access-token': authToken },
      });

      expect(response.statusCode).toBe(422);
    });

    it('should return 422 if card is a open question and has more than one item in answerList', async () => {
      const response = await app.inject({
        method: 'POST',
        url: '/questionnairehistories',
        payload: { ...payload, questionnaireAnswersList: [{ card: cardsList[3]._id, answerList: ['bla', 'ble'] }] },
        headers: { 'x-access-token': authToken },
      });

      expect(response.statusCode).toBe(422);
    });

    it('should return 422 if is a q/a and is not multiplechoice and has more than one item in answerList', async () => {
      const response = await app.inject({
        method: 'POST',
        url: '/questionnairehistories',
        payload: {
          ...payload,
          questionnaireAnswersList: [{ card: cardsList[5]._id, answerList: [new ObjectID(), new ObjectID()] }],
        },
        headers: { 'x-access-token': authToken },
      });

      expect(response.statusCode).toBe(422);
    });

    it('should return 422 if is a q/a and items in answerList are not ObjectID', async () => {
      const response = await app.inject({
        method: 'POST',
        url: '/questionnairehistories',
        payload: {
          ...payload,
          questionnaireAnswersList: [{ card: cardsList[4]._id, answerList: ['blabla'] }],
        },
        headers: { 'x-access-token': authToken },
      });

      expect(response.statusCode).toBe(422);
    });

    const missingParams = ['questionnaire', 'user'];
    missingParams.forEach((param) => {
      it(`should return 400 as ${param} is missing`, async () => {
        const response = await app.inject({
          method: 'POST',
          url: '/questionnairehistories',
          payload: omit(payload, param),
          headers: { 'x-access-token': authToken },
        });

        expect(response.statusCode).toBe(400);
      });
    });
  });
});
