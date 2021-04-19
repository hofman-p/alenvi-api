const sinon = require('sinon');
const expect = require('expect');
const { ObjectID } = require('mongodb');
const Questionnaire = require('../../../src/models/Questionnaire');
const QuestionnaireHelper = require('../../../src/helpers/questionnaires');
const CardHelper = require('../../../src/helpers/cards');
const { EXPECTATIONS, PUBLISHED } = require('../../../src/helpers/constants');
const SinonMongoose = require('../sinonMongoose');

describe('create', () => {
  let create;
  beforeEach(() => {
    create = sinon.stub(Questionnaire, 'create');
  });
  afterEach(() => {
    create.restore();
  });

  it('should create questionnaire', async () => {
    const newQuestionnaire = { name: 'test', type: 'expectations' };
    await QuestionnaireHelper.create(newQuestionnaire);

    sinon.assert.calledOnceWithExactly(create, newQuestionnaire);
  });
});

describe('list', () => {
  let find;
  beforeEach(() => {
    find = sinon.stub(Questionnaire, 'find');
  });
  afterEach(() => {
    find.restore();
  });

  it('should return questionnaires', async () => {
    const questionnairesList = [{ name: 'test' }, { name: 'test2' }];

    find.returns(SinonMongoose.stubChainedQueries([questionnairesList], ['lean']));

    const result = await QuestionnaireHelper.list();

    expect(result).toMatchObject(questionnairesList);
    SinonMongoose.calledWithExactly(find, [{ query: 'find' }, { query: 'lean' }]);
  });
});

describe('getQuestionnaire', () => {
  let findOne;
  beforeEach(() => {
    findOne = sinon.stub(Questionnaire, 'findOne');
  });
  afterEach(() => {
    findOne.restore();
  });

  it('should return questionnaire', async () => {
    const questionnaireId = new ObjectID();
    const questionnaire = { _id: questionnaireId, name: 'test' };

    findOne.returns(SinonMongoose.stubChainedQueries([questionnaire]));

    const result = await QuestionnaireHelper.getQuestionnaire(questionnaireId);

    expect(result).toMatchObject(questionnaire);
    SinonMongoose.calledWithExactly(
      findOne,
      [
        { query: 'findOne', args: [{ _id: questionnaireId }] },
        { query: 'populate', args: [{ path: 'cards', select: '-__v -createdAt -updatedAt' }] },
        { query: 'lean', args: [{ virtuals: true }] },
      ]
    );
  });
});

describe('editQuestionnaire', () => {
  let findOneAndUpdate;
  beforeEach(() => {
    findOneAndUpdate = sinon.stub(Questionnaire, 'findOneAndUpdate');
  });
  afterEach(() => {
    findOneAndUpdate.restore();
  });

  it('should update questionnaire', async () => {
    const questionnaireId = new ObjectID();
    const cards = [new ObjectID(), new ObjectID()];
    const questionnaire = { _id: questionnaireId, name: 'test2', cards };

    findOneAndUpdate.returns(SinonMongoose.stubChainedQueries([questionnaire], ['lean']));

    const result = await QuestionnaireHelper.update(questionnaireId, { name: 'test2', cards });

    expect(result).toMatchObject(questionnaire);
    SinonMongoose.calledWithExactly(
      findOneAndUpdate,
      [
        { query: 'findOneAndUpdate', args: [{ _id: questionnaireId }, { $set: { name: 'test2', cards } }] },
        { query: 'lean' },
      ]
    );
  });
});

describe('addCard', () => {
  let createCard;
  let updateOne;
  beforeEach(() => {
    createCard = sinon.stub(CardHelper, 'createCard');
    updateOne = sinon.stub(Questionnaire, 'updateOne');
  });
  afterEach(() => {
    createCard.restore();
    updateOne.restore();
  });

  it('should add card to questionnaire', async () => {
    const cardId = new ObjectID();
    const payload = { template: 'transition' };
    const questionnaire = { _id: new ObjectID(), name: 'faire du jetski' };

    createCard.returns({ _id: cardId });

    await QuestionnaireHelper.addCard(questionnaire._id, payload);

    sinon.assert.calledOnceWithExactly(createCard, payload);
    sinon.assert.calledOnceWithExactly(updateOne, { _id: questionnaire._id }, { $push: { cards: cardId } });
  });
});

describe('removeCard', () => {
  let removeCard;
  let updateOne;
  beforeEach(() => {
    removeCard = sinon.stub(CardHelper, 'removeCard');
    updateOne = sinon.stub(Questionnaire, 'updateOne');
  });
  afterEach(() => {
    removeCard.restore();
    updateOne.restore();
  });

  it('should remove card from questionnaire', async () => {
    const cardId = new ObjectID();

    await QuestionnaireHelper.removeCard(cardId);

    sinon.assert.calledOnceWithExactly(updateOne, { cards: cardId }, { $pull: { cards: cardId } });
    sinon.assert.calledOnceWithExactly(removeCard, cardId);
  });
});

describe('getUserQuestionnaires', () => {
  let findOne;
  let nowStub;
  beforeEach(() => {
    findOne = sinon.stub(Questionnaire, 'findOne');
    nowStub = sinon.stub(Date, 'now');
  });
  afterEach(() => {
    findOne.restore();
    nowStub.restore();
  });

  it('should return questionnaire', async () => {
    const course = {
      _id: new ObjectID(),
      slots: [{ startDate: new Date('2021-04-20T09:00:00'), endDate: new Date('2021-04-20T11:00:00') }],
    };
    const questionnaire = { _id: new ObjectID(), name: 'test', questionnaireHistories: [] };

    nowStub.returns(new Date('2021-04-13T15:00:00'));
    findOne.returns(SinonMongoose.stubChainedQueries([questionnaire]));

    const result = await QuestionnaireHelper.getUserQuestionnaires(course);

    expect(result).toMatchObject([questionnaire]);
    SinonMongoose.calledWithExactly(
      findOne,
      [
        { query: 'findOne', args: [{ type: EXPECTATIONS, status: PUBLISHED }, { type: 1, name: 1 }] },
        { query: 'populate', args: [{ path: 'questionnaireHistories' }] },
        { query: 'lean', args: [{ virtuals: true }] },
      ]
    );
  });

  it('should return questionnaire if no slots', async () => {
    const course = { _id: new ObjectID(), slots: [] };
    const questionnaire = { _id: new ObjectID(), name: 'test', questionnaireHistories: [] };

    nowStub.returns(new Date('2021-04-13T15:00:00'));
    findOne.returns(SinonMongoose.stubChainedQueries([questionnaire]));

    const result = await QuestionnaireHelper.getUserQuestionnaires(course);

    expect(result).toMatchObject([questionnaire]);
    SinonMongoose.calledWithExactly(
      findOne,
      [
        { query: 'findOne', args: [{ type: EXPECTATIONS, status: PUBLISHED }, { type: 1, name: 1 }] },
        { query: 'populate', args: [{ path: 'questionnaireHistories' }] },
        { query: 'lean', args: [{ virtuals: true }] },
      ]
    );
  });

  it('should return an empty array if questionnaire is already answered', async () => {
    const course = {
      _id: new ObjectID(),
      slots: [{ startDate: new Date('2021-04-20T09:00:00'), endDate: new Date('2021-04-20T11:00:00') }],
    };
    const questionnaire = { _id: new ObjectID(), name: 'test', questionnaireHistories: [{ _id: new ObjectID() }] };

    nowStub.returns(new Date('2021-04-13T15:00:00'));
    findOne.returns(SinonMongoose.stubChainedQueries([questionnaire]));

    const result = await QuestionnaireHelper.getUserQuestionnaires(course);

    expect(result).toMatchObject([]);
    SinonMongoose.calledWithExactly(
      findOne,
      [
        { query: 'findOne', args: [{ type: EXPECTATIONS, status: PUBLISHED }, { type: 1, name: 1 }] },
        { query: 'populate', args: [{ path: 'questionnaireHistories' }] },
        { query: 'lean', args: [{ virtuals: true }] },
      ]
    );
  });

  it('should return an empty array if no questionnaire', async () => {
    const course = {
      _id: new ObjectID(),
      slots: [{ startDate: new Date('2021-04-20T09:00:00'), endDate: new Date('2021-04-20T11:00:00') }],
    };

    nowStub.returns(new Date('2021-04-13T15:00:00'));
    findOne.returns(SinonMongoose.stubChainedQueries([null]));

    const result = await QuestionnaireHelper.getUserQuestionnaires(course);

    expect(result).toMatchObject([]);
    SinonMongoose.calledWithExactly(
      findOne,
      [
        { query: 'findOne', args: [{ type: EXPECTATIONS, status: PUBLISHED }, { type: 1, name: 1 }] },
        { query: 'populate', args: [{ path: 'questionnaireHistories' }] },
        { query: 'lean', args: [{ virtuals: true }] },
      ]
    );
  });

  it('should return an empty array if first slot is passed', async () => {
    const course = {
      _id: new ObjectID(),
      format: 'blended',
      slots: [{ startDate: new Date('2021-04-20T09:00:00'), endDate: new Date('2021-04-20T11:00:00') }],
    };

    nowStub.returns(new Date('2021-04-23T15:00:00'));

    const result = await QuestionnaireHelper.getUserQuestionnaires(course);

    expect(result).toMatchObject([]);
    sinon.assert.notCalled(findOne);
  });

  it('should return an empty array if course is strictly e-learning', async () => {
    const course = { _id: new ObjectID(), format: 'strictly_e_learning' };

    nowStub.returns(new Date('2021-04-23T15:00:00'));

    const result = await QuestionnaireHelper.getUserQuestionnaires(course);

    expect(result).toMatchObject([]);
    sinon.assert.notCalled(findOne);
  });
});
