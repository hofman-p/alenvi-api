const { ObjectID } = require('mongodb');
const Card = require('../../../src/models/Card');
const Activity = require('../../../src/models/Activity');
const { populateDBForAuthentication } = require('./authenticationSeed');
const {
  TRANSITION,
  TITLE_TEXT_MEDIA,
  TITLE_TEXT,
  TEXT_MEDIA,
  FLASHCARD,
  FILL_THE_GAPS,
  MULTIPLE_CHOICE_QUESTION,
  SINGLE_CHOICE_QUESTION,
  ORDER_THE_SEQUENCE,
} = require('../../../src/helpers/constants');

const cardsList = [
  { _id: new ObjectID(), template: TRANSITION, title: 'Lala' },
  { _id: new ObjectID(), template: TITLE_TEXT_MEDIA },
  { _id: new ObjectID(), template: TITLE_TEXT },
  { _id: new ObjectID(), template: TEXT_MEDIA },
  { _id: new ObjectID(), template: FLASHCARD },
  { _id: new ObjectID(), template: FILL_THE_GAPS, falsyAnswers: ['le papa', 'la maman'] },
  { _id: new ObjectID(), template: MULTIPLE_CHOICE_QUESTION },
  { _id: new ObjectID(), template: SINGLE_CHOICE_QUESTION, falsyAnswers: ['le papa', 'la maman'] },
  { _id: new ObjectID(), template: ORDER_THE_SEQUENCE, orderedAnswers: ['rien', 'des trucs'] },
];

const cardActivity = {
  _id: new ObjectID(),
  name: 'Coucou toi',
  cards: [cardsList[0]._id, cardsList[1]._id],
  type: 'video',
};

const populateDB = async () => {
  await Card.deleteMany({});
  await Activity.deleteMany({});

  await populateDBForAuthentication();

  await Card.insertMany(cardsList);
  await Activity.create(cardActivity);
};

module.exports = {
  populateDB,
  cardsList,
  cardActivity,
};
