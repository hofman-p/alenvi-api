const expect = require('expect');
const GetStream = require('get-stream');
const sinon = require('sinon');
const pick = require('lodash/pick');
const omit = require('lodash/omit');
const { ObjectID } = require('mongodb');
const app = require('../../server');
const Card = require('../../src/models/Card');
const CloudinaryHelper = require('../../src/helpers/cloudinary');
const { populateDB, cardsList, activitiesList } = require('./seed/cardsSeed');
const { getToken } = require('./seed/authenticationSeed');
const { generateFormData } = require('./utils');
const Activity = require('../../src/models/Activity');

describe('NODE ENV', () => {
  it('should be \'test\'', () => {
    expect(process.env.NODE_ENV).toBe('test');
  });
});

describe('CARDS ROUTES - PUT /cards/{_id}', () => {
  let authToken = null;
  beforeEach(populateDB);
  const transitionId = cardsList[0]._id;
  const fillTheGapId = cardsList[5]._id;
  const orderTheSequenceId = cardsList[8]._id;
  const singleChoiceQuestionId = cardsList[7]._id;
  const multipleChoiceQuestionId = cardsList[6]._id;
  const surveyId = cardsList[9]._id;
  const openQuestionId = cardsList[10]._id;
  const questionAnswerId = cardsList[11]._id;
  const payload = {
    title: 'rigoler',
    text: 'c\'est bien',
    media: { publicId: '12345', link: '0987654' },
    backText: 'text verso',
  };

  describe('VENDOR_ADMIN', () => {
    beforeEach(async () => {
      authToken = await getToken('vendor_admin');
    });

    const cards = [
      { template: 'transition', payload: { title: 'transition' }, id: cardsList[0]._id },
      {
        template: 'title_text_media',
        payload: { title: 'TTM', text: 'test', media: { link: 'lien', publicId: 'id' } },
        id: cardsList[1]._id,
      },
      { template: 'title_text', payload: { title: 'titre', text: 'this is a text' }, id: cardsList[2]._id },
      {
        template: 'text_media',
        payload: { text: 'still a text', media: { link: '123', publicId: '456' } },
        id: cardsList[3]._id,
      },
      { template: 'flashcard', payload: { backText: 'verso', text: 'this is a text' }, id: cardsList[4]._id },
      {
        template: 'fill_the_gaps',
        payload: {
          gappedText: 'Un texte à remplir par <trou>l\'apprenant -e</trou>.',
          falsyGapAnswers: ['le papa', 'la maman', 'le papi'],
          explanation: 'c\'est evidement la mamie qui remplit le texte',
        },
        id: fillTheGapId,
      },
      {
        template: 'order_the_sequence',
        payload: {
          question: 'Que faire dans cette situation ?',
          orderedAnswers: ['rien', 'des trucs', 'ou pas'],
          explanation: 'en fait on doit faire ça',
        },
        id: orderTheSequenceId,
      },
      {
        template: 'single_choice_question',
        payload: {
          question: 'Que faire dans cette situation ?',
          qcuGoodAnswer: 'plein de trucs',
          qcuFalsyAnswers: ['rien', 'des trucs', 'ou pas'],
          explanation: 'en fait on doit faire ça',
        },
        id: singleChoiceQuestionId,
      },
      {
        template: 'multiple_choice_question',
        payload: {
          question: 'Que faire dans cette situation ?',
          qcmAnswers: [{ label: 'un truc', correct: true }, { label: 'rien', correct: false }],
          explanation: 'en fait on doit faire ça',
        },
        id: multipleChoiceQuestionId,
      },
      {
        template: 'survey',
        payload: {
          question: 'Sur une échelle de 1 à 10 ?',
          label: { left: '1', right: '10' },
        },
        id: surveyId,
      },
      { template: 'open_question', payload: { question: 'Quelque chose à ajouter ?' }, id: openQuestionId },
      {
        template: 'question_answer',
        payload: {
          isQuestionAnswerMultipleChoiced: true,
          question: 'Que faire dans cette situation ?',
        },
        id: questionAnswerId,
      },
    ];

    cards.forEach((card) => {
      it(`should update a ${card.template} card`, async () => {
        const response = await app.inject({
          method: 'PUT',
          url: `/cards/${card.id.toHexString()}`,
          payload: card.payload,
          headers: { 'x-access-token': authToken },
        });

        expect(response.statusCode).toBe(200);

        const cardUpdated = await Card.findById(card.id).lean({ virtuals: true });
        expect(cardUpdated).toEqual(expect.objectContaining({ isValid: true }));

        const expectedObject = omit(card.payload, ['media']);
        if (card.payload.media) expectedObject.media = expect.objectContaining(card.payload.media);
        expect(cardUpdated).toEqual(expect.objectContaining(expectedObject));
      });
    });

    it('should return a 400 if title is equal to \'\' on transition card', async () => {
      const response = await app.inject({
        method: 'PUT',
        url: `/cards/${transitionId.toHexString()}`,
        payload: { name: '' },
        headers: { 'x-access-token': authToken },
      });

      expect(response.statusCode).toBe(400);
    });

    describe('Fill the gaps', () => {
      const requests = [
        { msg: 'valid gappedText', payload: { gappedText: 'on truc <trou>b\'ien -èï</trou>propre' }, passing: true },
        { msg: 'no tagging', payload: { gappedText: 'du text sans balise' } },
        { msg: 'single open tag', payload: { gappedText: 'lalalalal <trou>lili</trou> djsfbjdsfbdjsf<trou>' } },
        { msg: 'single closing tag', payload: { gappedText: 'lalalalal <trou>lili</trou> djsfbjdsfbdjsf</trou>' } },
        { msg: 'conflicting tags', payload: { gappedText: 'lalaal <trou>l<trou>ili</trou> djsfbjdsfbd</trou>' } },
        { msg: 'long content', payload: { gappedText: 'lalalalal <trou> rgtrgtghtgtrgtrgtrgtili</trou> djsfbjdsfbd' } },
        { msg: 'wrong character in content', payload: { gappedText: 'lalalalal <trou>?</trou> djsfbjdsfbd' } },
        { msg: 'line break in content', payload: { gappedText: 'lalalalal <trou>bfh\nee</trou> djsfbjdsfbd' } },
        { msg: 'valid answers', payload: { falsyGapAnswers: ['la maman', 'le tonton'] }, passing: true },
        { msg: 'remove one of the 2 existing answers', payload: { falsyGapAnswers: ['la maman'] } },
        { msg: 'long answer', payload: { falsyGapAnswers: ['la maman', 'more then 15 characters'] } },
        { msg: 'wrong character in answer', payload: { falsyGapAnswers: ['la maman', 'c\'est tout.'] } },
        { msg: 'spaces around answer', payload: { gappedText: 'on truc <trou> test</trou>propre' } },
        { msg: 'too many falsy answers', payload: { falsyGapAnswers: ['a', 'b', 'c', 'd', 'e', 'f', 'g'] } },
      ];

      requests.forEach((request) => {
        it(`should return a ${request.passing ? '200' : '400'} if ${request.msg}`, async () => {
          const response = await app.inject({
            method: 'PUT',
            url: `/cards/${fillTheGapId.toHexString()}`,
            payload: request.payload,
            headers: { 'x-access-token': authToken },
          });

          const cardUpdated = await Card.findById(fillTheGapId).lean({ virtuals: true });

          expect(response.statusCode).toBe(request.passing ? 200 : 400);
          expect(cardUpdated).toEqual(expect.objectContaining({ isValid: false }));
        });
      });
    });

    describe('Order the sequence', () => {
      const requests = [
        {
          msg: 'valid ordered answers',
          payload: { orderedAnswers: ['en fait si', 'a ouai, non'], question: 'ya quoi ???' },
          passing: true,
        },
        { msg: 'remove one of the 2 existing ordered answers', payload: { orderedAnswers: ['en fait si'] } },
        {
          msg: 'too many chars in question',
          payload: {
            question: 'asdfghjklzasdfghjklzasdfghjklzasdfghjklzasdvdvdvfghjklzasdfghjklzbtrbtrbtrhtrhthtvfdbbfbggbfdb'
              + 'frehuvbierhigvobreipvberuipvbejripvbehriovbehrovhreuogvregcfhergjvrebgjoiprebgjirepbghjrieghroegvroe',
          },
          code: 400,
        },
      ];

      requests.forEach((request) => {
        it(`should return a ${request.passing ? '200' : '400'} if ${request.msg}`, async () => {
          const response = await app.inject({
            method: 'PUT',
            url: `/cards/${orderTheSequenceId.toHexString()}`,
            payload: request.payload,
            headers: { 'x-access-token': authToken },
          });

          const cardUpdated = await Card.findById(orderTheSequenceId).lean({ virtuals: true });

          expect(response.statusCode).toBe(request.passing ? 200 : 400);
          expect(cardUpdated).toEqual(expect.objectContaining({ isValid: false }));
        });
      });
    });

    describe('Single choice question', () => {
      const requests = [
        { msg: 'valid answers', payload: { qcuFalsyAnswers: ['toto'], qcuGoodAnswer: 'c\'est le S' }, code: 200 },
        { msg: 'missing falsyAnswer', payload: { qcuFalsyAnswers: [] }, code: 400 },
        { msg: 'too many answer', payload: { qcuFalsyAnswers: ['toto', 'toto', 'toto', 'toto'] }, code: 400 },
        {
          msg: 'too many chars in falsy answers',
          payload: {
            qcuFalsyAnswers: ['eeeeeyuiolkjhgfdasdfghjklzasdfghjklzasdfghjklzasdfghjklzasdvdvdvfghjklzasdfghjklz'],
          },
          code: 400,
        },
        {
          msg: 'too many chars in good answer',
          payload: {
            qcuGoodAnswer: 'eeeeeyuiolkjhgfdasdfghjklzasdfghjklzasdfghjklzasdfghjklzasdvdvdvfghjklzasdfghjklz',
          },
          code: 400,
        },
      ];

      requests.forEach((request) => {
        it(`should return a ${request.code} if ${request.msg}`, async () => {
          const response = await app.inject({
            method: 'PUT',
            url: `/cards/${singleChoiceQuestionId.toHexString()}`,
            payload: request.payload,
            headers: { 'x-access-token': authToken },
          });

          const cardUpdated = await Card.findById(singleChoiceQuestionId).lean({ virtuals: true });

          expect(response.statusCode).toBe(request.code);
          expect(cardUpdated).toEqual(expect.objectContaining({ isValid: false }));
        });
      });
    });

    describe('Multiple choice question', () => {
      const requests = [
        {
          msg: 'valid answers',
          payload: { qcmAnswers: [{ label: 'vie', correct: true }, { label: 'gique', correct: false }] },
          code: 200,
        },
        { msg: 'missing label', payload: { qcmAnswers: [{ correct: true }] }, code: 400 },
        { msg: 'missing correct', payload: { qcmAnswers: [{ label: 'et la bête' }] }, code: 400 },
        {
          msg: 'missing correct answer',
          payload: { qcmAnswers: [{ label: 'époque', correct: false }, { label: 'et le clochard', correct: false }] },
          code: 400,
        },
        {
          msg: 'too many chars in answer',
          payload: {
            qcmAnswers: [
              {
                label: 'eeeeeyuiolkjhgfdasdfghjklzasdfghjklzasdfghjklzasdfghjklzasdvdvdvfghjklzasdfghjklz',
                correct: true,
              },
              { label: 'bleue', correct: false },
            ],
          },
          code: 400,
        },
      ];

      requests.forEach((request) => {
        it(`should return a ${request.code} if ${request.msg}`, async () => {
          const response = await app.inject({
            method: 'PUT',
            url: `/cards/${multipleChoiceQuestionId.toHexString()}`,
            payload: request.payload,
            headers: { 'x-access-token': authToken },
          });

          const cardUpdated = await Card.findById(multipleChoiceQuestionId).lean({ virtuals: true });

          expect(response.statusCode).toBe(request.code);
          expect(cardUpdated).toEqual(expect.objectContaining({ isValid: false }));
        });
      });
    });

    describe('Survey', () => {
      const requests = [
        { msg: 'Left label is too long', payload: { label: { left: 'Je suis un très long message' } }, code: 400 },
        { msg: 'Right label is too long', payload: { label: { right: 'Je suis un très long message' } }, code: 400 },
        { msg: 'Unset left label', payload: { label: { left: '' } }, code: 200 },
        { msg: 'Unset right label', payload: { label: { right: '' } }, code: 200 },
      ];

      requests.forEach((request) => {
        it(`should return a ${request.code} if ${request.msg}`, async () => {
          const response = await app.inject({
            method: 'PUT',
            url: `/cards/${surveyId.toHexString()}`,
            payload: request.payload,
            headers: { 'x-access-token': authToken },
          });

          const cardUpdated = await Card.findById(surveyId).lean({ virtuals: true });

          expect(response.statusCode).toBe(request.code);
          expect(cardUpdated).toEqual(expect.objectContaining({ isValid: false }));
        });
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

    roles.forEach((role) => {
      it(`should return ${role.expectedCode} as user is ${role.name}`, async () => {
        authToken = await getToken(role.name);
        const response = await app.inject({
          method: 'PUT',
          payload,
          url: `/cards/${transitionId.toHexString()}`,
          headers: { 'x-access-token': authToken },
        });

        expect(response.statusCode).toBe(role.expectedCode);
      });
    });
  });
});

describe('CARDS ROUTES - PUT /cards/{_id}/answer/{answerId}', () => {
  let authToken = null;
  beforeEach(populateDB);
  const card = cardsList[11];
  const answer = card.questionAnswers[0];

  describe('VENDOR_ADMIN', () => {
    beforeEach(async () => {
      authToken = await getToken('vendor_admin');
    });

    it('should update an answer', async () => {
      const response = await app.inject({
        method: 'PUT',
        url: `/cards/${card._id.toHexString()}/answers/${answer._id.toHexString()}`,
        payload: { text: 'je suis un texte' },
        headers: { 'x-access-token': authToken },
      });

      expect(response.statusCode).toBe(200);

      const cardUpdated = await Card.findById(card._id).lean();
      expect(cardUpdated).toEqual(expect.objectContaining({
        ...card,
        questionAnswers: [
          { _id: card.questionAnswers[0]._id, text: 'je suis un texte' },
          card.questionAnswers[1],
        ],
      }));
    });

    it('should return 400 if text is missing', async () => {
      const response = await app.inject({
        method: 'PUT',
        url: `/cards/${card._id.toHexString()}/answers/${answer._id.toHexString()}`,
        payload: { text: '' },
        headers: { 'x-access-token': authToken },
      });

      expect(response.statusCode).toBe(400);
    });

    it('should return 403 if invalid card id', async () => {
      const response = await app.inject({
        method: 'PUT',
        url: `/cards/${(new ObjectID()).toHexString()}/answers/${answer._id.toHexString()}`,
        payload: { text: 'je suis un texte' },
        headers: { 'x-access-token': authToken },
      });

      expect(response.statusCode).toBe(404);
    });

    it('should return 403 if answer is not in card', async () => {
      const otherQACard = cardsList[12];
      const response = await app.inject({
        method: 'PUT',
        url: `/cards/${card._id.toHexString()}/answers/${otherQACard.questionAnswers[0]._id.toHexString()}`,
        payload: { text: 'je suis un texte' },
        headers: { 'x-access-token': authToken },
      });

      expect(response.statusCode).toBe(404);
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
          payload: { text: 'je suis un texte' },
          url: `/cards/${card._id.toHexString()}/answers/${answer._id.toHexString()}`,
          headers: { 'x-access-token': authToken },
        });

        expect(response.statusCode).toBe(role.expectedCode);
      });
    });
  });
});

describe('CARDS ROUTES - DELETE /cards/{_id}', () => {
  let authToken = null;
  beforeEach(populateDB);
  const draftActivity = activitiesList.find(activity => activity.status === 'draft');
  const publishedActivity = activitiesList.find(activity => activity.status === 'published');

  describe('VENDOR_ADMIN', () => {
    beforeEach(async () => {
      authToken = await getToken('vendor_admin');
    });

    it('should delete card', async () => {
      const response = await app.inject({
        method: 'DELETE',
        url: `/cards/${draftActivity.cards[0].toHexString()}`,
        headers: { 'x-access-token': authToken },
      });

      expect(response.statusCode).toBe(200);

      const cardDeleted = await Card.findById(cardsList[0]._id).lean();
      expect(cardDeleted).toBeNull();

      const activity = await Activity.findById(draftActivity._id).lean();
      expect(activity.cards.length).toEqual(draftActivity.cards.length - 1);
      expect(activity.cards.includes(draftActivity.cards[0])).toBeFalsy();
    });

    it('should return 404 if card not found', async () => {
      const response = await app.inject({
        method: 'DELETE',
        url: `/cards/${(new ObjectID()).toHexString()}`,
        headers: { 'x-access-token': authToken },
      });

      expect(response.statusCode).toBe(404);
    });

    it('should return 400 if activity is published', async () => {
      const response = await app.inject({
        method: 'DELETE',
        url: `/cards/${publishedActivity.cards[0].toHexString()}`,
        headers: { 'x-access-token': authToken },
      });

      expect(response.statusCode).toBe(403);
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
          method: 'DELETE',
          url: `/cards/${draftActivity.cards[0].toHexString()}`,
          headers: { 'x-access-token': authToken },
        });

        expect(response.statusCode).toBe(role.expectedCode);
      });
    });
  });
});

describe('POST /cards/:id/cloudinary/upload', () => {
  let authToken;
  let form;
  let addImageStub;
  const card = cardsList[0];
  const docPayload = { fileName: 'title_text_media', file: 'true' };
  beforeEach(() => {
    form = generateFormData(docPayload);
    addImageStub = sinon.stub(CloudinaryHelper, 'addImage')
      .returns({ public_id: 'abcdefgh', secure_url: 'https://alenvi.io' });
  });
  afterEach(() => {
    addImageStub.restore();
  });

  describe('VENDOR_ADMIN', () => {
    beforeEach(populateDB);
    beforeEach(async () => {
      authToken = await getToken('vendor_admin');
    });

    it('should add a card media', async () => {
      const response = await app.inject({
        method: 'POST',
        url: `/cards/${card._id}/cloudinary/upload`,
        payload: await GetStream(form),
        headers: { ...form.getHeaders(), 'x-access-token': authToken },
      });

      const cardWithMedia = { ...card, media: { publicId: 'abcdefgh', link: 'https://alenvi.io' } };
      const cardUpdated = await Card.findById(card._id, { name: 1, media: 1 }).lean();

      expect(response.statusCode).toBe(200);
      expect(cardUpdated).toMatchObject(pick(cardWithMedia, ['_id', 'name', 'media']));
      sinon.assert.calledOnce(addImageStub);
    });

    const wrongParams = ['file', 'fileName'];
    wrongParams.forEach((param) => {
      it(`should return a 400 error if missing '${param}' parameter`, async () => {
        const invalidForm = generateFormData(omit(docPayload, param));
        const response = await app.inject({
          method: 'POST',
          url: `/cards/${card._id}/cloudinary/upload`,
          payload: await GetStream(invalidForm),
          headers: { ...invalidForm.getHeaders(), 'x-access-token': authToken },
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
    roles.forEach((role) => {
      it(`should return ${role.expectedCode} as user is ${role.name}`, async () => {
        authToken = await getToken(role.name);
        const response = await app.inject({
          method: 'POST',
          url: `/cards/${card._id}/cloudinary/upload`,
          payload: await GetStream(form),
          headers: { ...form.getHeaders(), 'x-access-token': authToken },
        });

        expect(response.statusCode).toBe(role.expectedCode);
      });
    });
  });
});
