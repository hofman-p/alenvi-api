'use-strict';

const Joi = require('joi');
Joi.objectId = require('joi-objectid')(Joi);
const {
  update,
  remove,
  uploadMedia,
  updateAnswer,
  addAnswer,
  deleteAnswer,
  deleteMedia,
} = require('../controllers/cardController');
const { formDataPayload } = require('./validations/utils');
const {
  authorizeCardUpdate,
  authorizeCardAnswerUpdate,
  authorizeCardDeletion,
  authorizeCardAnswerCreation,
  authorizeCardAnswerDeletion,
  getCardMediaPublicId,
} = require('./preHandlers/cards');
const {
  FILL_THE_GAPS_MAX_ANSWERS_COUNT,
  ORDER_THE_SEQUENCE_MAX_ANSWERS_COUNT,
  SURVEY_LABEL_MAX_LENGTH,
  QC_ANSWER_MAX_LENGTH,
  QUESTION_MAX_LENGTH,
  GAP_ANSWER_MAX_LENGTH,
  FLASHCARD_TEXT_MAX_LENGTH,
} = require('../helpers/constants');

exports.plugin = {
  name: 'routes-cards',
  register: async (server) => {
    server.route({
      method: 'PUT',
      path: '/{_id}',
      options: {
        validate: {
          params: Joi.object({ _id: Joi.objectId().required() }),
          payload: Joi.object({
            title: Joi.string(),
            text: Joi.string(),
            backText: Joi.string().max(FLASHCARD_TEXT_MAX_LENGTH),
            media: Joi.object().keys({
              link: Joi.string().allow(null),
              publicId: Joi.string().allow(null),
              type: Joi.string(),
            }),
            gappedText: Joi.string(),
            question: Joi.string().max(QUESTION_MAX_LENGTH),
            qcuGoodAnswer: Joi.string().max(QC_ANSWER_MAX_LENGTH),
            orderedAnswers: Joi.array().items(Joi.string()).min(1).max(ORDER_THE_SEQUENCE_MAX_ANSWERS_COUNT),
            falsyGapAnswers: Joi.array().items(
              Joi.string().max(GAP_ANSWER_MAX_LENGTH)
            ).min(1).max(FILL_THE_GAPS_MAX_ANSWERS_COUNT),
            isQuestionAnswerMultipleChoiced: Joi.boolean(),
            explanation: Joi.string(),
            label: Joi.object().keys({
              right: Joi.string().allow('', null).max(SURVEY_LABEL_MAX_LENGTH),
              left: Joi.string().allow('', null).max(SURVEY_LABEL_MAX_LENGTH),
            }),
          }),
        },
        auth: { scope: ['programs:edit'] },
        pre: [{ method: authorizeCardUpdate }],
      },
      handler: update,
    });

    server.route({
      method: 'POST',
      path: '/{_id}/answers',
      options: {
        validate: { params: Joi.object({ _id: Joi.objectId().required() }) },
        auth: { scope: ['programs:edit'] },
        pre: [{ method: authorizeCardAnswerCreation, assign: 'card' }],
      },
      handler: addAnswer,
    });

    server.route({
      method: 'PUT',
      path: '/{_id}/answers/{answerId}',
      options: {
        validate: {
          params: Joi.object({
            _id: Joi.objectId().required(),
            answerId: Joi.objectId().required(),
          }),
          payload: Joi.object({
            text: Joi.string(),
            correct: Joi.boolean(),
          }).min(1),
        },
        auth: { scope: ['programs:edit'] },
        pre: [{ method: authorizeCardAnswerUpdate, assign: 'card' }],
      },
      handler: updateAnswer,
    });

    server.route({
      method: 'DELETE',
      path: '/{_id}/answers/{answerId}',
      options: {
        validate: { params: Joi.object({ _id: Joi.objectId().required(), answerId: Joi.objectId().required() }) },
        auth: { scope: ['programs:edit'] },
        pre: [{ method: authorizeCardAnswerDeletion, assign: 'card' }],
      },
      handler: deleteAnswer,
    });

    server.route({
      method: 'DELETE',
      path: '/{_id}',
      options: {
        validate: {
          params: Joi.object({ _id: Joi.objectId().required() }),
        },
        auth: { scope: ['programs:edit'] },
        pre: [{ method: authorizeCardDeletion }],
      },
      handler: remove,
    });

    server.route({
      method: 'POST',
      path: '/{_id}/upload',
      handler: uploadMedia,
      options: {
        payload: formDataPayload(25 * 1000 * 1000),
        validate: {
          payload: Joi.object({
            fileName: Joi.string().required(),
            file: Joi.any().required(),
            media: Joi.object().keys({
              link: Joi.string().allow(null),
              publicId: Joi.string().allow(null),
            }),
          }),
          params: Joi.object({
            _id: Joi.objectId().required(),
          }),
        },
        auth: { scope: ['programs:edit'] },
      },
    });

    server.route({
      method: 'DELETE',
      path: '/{_id}/upload',
      handler: deleteMedia,
      options: {
        validate: {
          params: Joi.object({ _id: Joi.objectId().required() }),
        },
        auth: { scope: ['programs:edit'] },
        pre: [{ method: getCardMediaPublicId, assign: 'publicId' }],
      },
    });
  },
};
