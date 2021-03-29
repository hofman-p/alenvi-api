const { ObjectID } = require('mongodb');
const expect = require('expect');
const { fn: momentProto } = require('moment');
const sinon = require('sinon');
const Boom = require('@hapi/boom');
const flat = require('flat');
const bcrypt = require('bcrypt');
const SinonMongoose = require('../sinonMongoose');
const AuthenticationHelper = require('../../../src/helpers/authentication');
const EmailHelper = require('../../../src/helpers/email');
const SmsHelper = require('../../../src/helpers/sms');
const translate = require('../../../src/helpers/translate');
const { TOKEN_EXPIRE_TIME } = require('../../../src/models/User');
const User = require('../../../src/models/User');
const { MOBILE, EMAIL, PHONE } = require('../../../src/helpers/constants');
const IdentityVerification = require('../../../src/models/IdentityVerification');

const { language } = translate;

describe('authenticate', () => {
  let findOne;
  let updateOne;
  let compare;
  let encode;
  let momentToDate;
  let momentAdd;
  beforeEach(() => {
    findOne = sinon.stub(User, 'findOne');
    updateOne = sinon.stub(User, 'updateOne');
    compare = sinon.stub(bcrypt, 'compare');
    encode = sinon.stub(AuthenticationHelper, 'encode');
    momentToDate = sinon.stub(momentProto, 'toDate');
    momentAdd = sinon.stub(momentProto, 'add').returns({ toDate: sinon.stub().returns('2020-12-09T13:45:25.437Z') });
  });
  afterEach(() => {
    findOne.restore();
    updateOne.restore();
    compare.restore();
    encode.restore();
    momentToDate.restore();
    momentAdd.restore();
  });

  it('should authenticate user and set firstMobileConnection', async () => {
    const payload = { email: 'toto@email.com', password: 'toto', origin: 'mobile' };
    const user = {
      _id: new ObjectID(),
      refreshToken: 'refreshToken',
      local: { password: 'toto' },
    };
    momentToDate.onCall(0).returns('2020-12-08T13:45:25.437Z');
    findOne.returns(SinonMongoose.stubChainedQueries([user], ['select', 'lean']));
    compare.returns(true);
    encode.returns('token');

    const result = await AuthenticationHelper.authenticate(payload);

    expect(result).toEqual({
      token: 'token',
      tokenExpireDate: '2020-12-09T13:45:25.437Z',
      refreshToken: 'refreshToken',
      user: { _id: user._id.toHexString() },
    });
    SinonMongoose.calledWithExactly(
      findOne,
      [
        { query: 'findOne', args: [{ 'local.email': 'toto@email.com' }] },
        { query: 'select', args: ['local refreshToken'] },
        { query: 'lean' },
      ]
    );
    sinon.assert.calledOnceWithExactly(
      updateOne,
      { _id: user._id, firstMobileConnection: { $exists: false } },
      { $set: { firstMobileConnection: '2020-12-08T13:45:25.437Z' } }
    );
    sinon.assert.calledOnceWithExactly(compare, payload.password, 'toto');
    sinon.assert.calledOnceWithExactly(encode, { _id: user._id.toHexString() }, TOKEN_EXPIRE_TIME);
    sinon.assert.calledOnceWithExactly(momentAdd, TOKEN_EXPIRE_TIME, 'seconds');
  });

  it('should authenticate user but not set firstMobileConnection (authentication from webapp)', async () => {
    const payload = { email: 'toto@email.com', password: 'toto', origin: 'webapp' };
    const user = { _id: new ObjectID(), refreshToken: 'refreshToken', local: { password: 'toto' } };

    findOne.returns(SinonMongoose.stubChainedQueries([user], ['select', 'lean']));
    compare.returns(true);
    encode.returns('token');

    const result = await AuthenticationHelper.authenticate(payload);

    expect(result).toEqual({
      token: 'token',
      tokenExpireDate: '2020-12-09T13:45:25.437Z',
      refreshToken: 'refreshToken',
      user: { _id: user._id.toHexString() },
    });
    SinonMongoose.calledWithExactly(
      findOne,
      [
        { query: 'findOne', args: [{ 'local.email': payload.email.toLowerCase() }] },
        { query: 'select', args: ['local refreshToken'] },
        { query: 'lean' },
      ]
    );
    sinon.assert.notCalled(updateOne);
    sinon.assert.notCalled(momentToDate);
    sinon.assert.calledOnceWithExactly(compare, payload.password, 'toto');
    sinon.assert.calledOnceWithExactly(encode, { _id: user._id.toHexString() }, TOKEN_EXPIRE_TIME);
    sinon.assert.calledOnceWithExactly(momentAdd, TOKEN_EXPIRE_TIME, 'seconds');
  });

  it('should authenticate user but not set firstMobileConnection (firstMobileConnection already set)', async () => {
    const payload = { email: 'toto@email.com', password: 'toto', origin: 'mobile' };
    const user = {
      _id: new ObjectID(),
      refreshToken: 'refreshToken',
      local: { password: 'toto' },
      firstMobileConnection: '2020-12-08T13:45:25.437Z',
    };

    findOne.returns(SinonMongoose.stubChainedQueries([user], ['select', 'lean']));
    compare.returns(true);
    encode.returns('token');

    const result = await AuthenticationHelper.authenticate(payload);

    expect(result).toEqual({
      token: 'token',
      tokenExpireDate: '2020-12-09T13:45:25.437Z',
      refreshToken: 'refreshToken',
      user: { _id: user._id.toHexString() },
    });
    SinonMongoose.calledWithExactly(
      findOne,
      [
        { query: 'findOne', args: [{ 'local.email': payload.email.toLowerCase() }] },
        { query: 'select', args: ['local refreshToken'] },
        { query: 'lean' },
      ]
    );
    sinon.assert.notCalled(updateOne);
    sinon.assert.notCalled(momentToDate);
    sinon.assert.calledOnceWithExactly(compare, payload.password, 'toto');
    sinon.assert.calledOnceWithExactly(encode, { _id: user._id.toHexString() }, TOKEN_EXPIRE_TIME);
    sinon.assert.calledOnceWithExactly(momentAdd, TOKEN_EXPIRE_TIME, 'seconds');
  });

  it('should throw an error if user does not exist', async () => {
    const payload = { email: 'toto@email.com', password: '123456!eR' };

    try {
      findOne.returns(SinonMongoose.stubChainedQueries([], ['select', 'lean']));

      await AuthenticationHelper.authenticate(payload);
    } catch (e) {
      expect(e.output.statusCode).toEqual(401);
    } finally {
      SinonMongoose.calledWithExactly(
        findOne,
        [
          { query: 'findOne', args: [{ 'local.email': payload.email.toLowerCase() }] },
          { query: 'select', args: ['local refreshToken'] },
          { query: 'lean' },
        ]
      );
      sinon.assert.notCalled(updateOne);
      sinon.assert.calledOnceWithExactly(compare, '123456!eR', '');
      sinon.assert.notCalled(encode);
      sinon.assert.notCalled(momentToDate);
      sinon.assert.notCalled(momentAdd);
    }
  });

  it('should throw an error if refresh token does not exist', async () => {
    const payload = { email: 'toto@email.com', password: '123456!eR' };
    try {
      findOne.returns(SinonMongoose.stubChainedQueries([{ _id: new ObjectID() }], ['select', 'lean']));

      await AuthenticationHelper.authenticate(payload);
    } catch (e) {
      expect(e.output.statusCode).toEqual(401);
    } finally {
      SinonMongoose.calledWithExactly(
        findOne,
        [
          { query: 'findOne', args: [{ 'local.email': payload.email.toLowerCase() }] },
          { query: 'select', args: ['local refreshToken'] },
          { query: 'lean' },
        ]
      );
      sinon.assert.notCalled(updateOne);
      sinon.assert.calledOnceWithExactly(compare, '123456!eR', '');
      sinon.assert.notCalled(encode);
      sinon.assert.notCalled(momentToDate);
      sinon.assert.notCalled(momentAdd);
    }
  });

  it('should throw an error if wrong password', async () => {
    try {
      const payload = { email: 'toto@email.com', password: '123456!eR' };

      findOne.returns(SinonMongoose.stubChainedQueries(
        [{ _id: new ObjectID(), refreshToken: 'refreshToken', local: { password: 'password_hash' } }],
        ['select', 'lean']
      ));
      compare.returns(false);

      await AuthenticationHelper.authenticate(payload);
    } catch (e) {
      expect(e.output.statusCode).toEqual(401);
    } finally {
      SinonMongoose.calledWithExactly(
        findOne,
        [
          { query: 'findOne', args: [{ 'local.email': 'toto@email.com' }] },
          { query: 'select', args: ['local refreshToken'] },
          { query: 'lean' },
        ]
      );
      sinon.assert.notCalled(updateOne);
      sinon.assert.calledOnceWithExactly(compare, '123456!eR', 'password_hash');
      sinon.assert.notCalled(encode);
      sinon.assert.notCalled(momentToDate);
      sinon.assert.notCalled(momentAdd);
    }
  });
});

describe('refreshToken', () => {
  let findOne;
  let encode;
  let momentAdd;
  beforeEach(() => {
    findOne = sinon.stub(User, 'findOne');
    encode = sinon.stub(AuthenticationHelper, 'encode');
    momentAdd = sinon.stub(momentProto, 'add').returns({ toDate: sinon.stub().returns('2020-12-09T13:45:25.437Z') });
  });
  afterEach(() => {
    findOne.restore();
    encode.restore();
    momentAdd.restore();
  });

  it('should throw an error if user does not exist', async () => {
    try {
      findOne.returns(SinonMongoose.stubChainedQueries([], ['lean']));

      await AuthenticationHelper.refreshToken('refreshToken');
    } catch (e) {
      expect(e).toEqual(Boom.unauthorized());
    } finally {
      SinonMongoose.calledWithExactly(
        findOne,
        [{ query: 'findOne', args: [{ refreshToken: 'refreshToken' }] }, { query: 'lean' }]
      );
      sinon.assert.notCalled(encode);
      sinon.assert.notCalled(momentAdd);
    }
  });

  it('should return refresh token', async () => {
    const user = { _id: new ObjectID(), refreshToken: 'refreshToken', local: { password: 'toto' } };

    findOne.returns(SinonMongoose.stubChainedQueries([user], ['lean']));
    encode.returns('token');

    const result = await AuthenticationHelper.refreshToken('refreshToken');

    expect(result).toEqual({
      token: 'token',
      tokenExpireDate: '2020-12-09T13:45:25.437Z',
      refreshToken: 'refreshToken',
      user: { _id: user._id.toHexString() },
    });
    SinonMongoose.calledWithExactly(
      findOne,
      [{ query: 'findOne', args: [{ refreshToken: 'refreshToken' }] }, { query: 'lean' }]
    );
    sinon.assert.calledWithExactly(encode, { _id: user._id.toHexString() }, TOKEN_EXPIRE_TIME);
    sinon.assert.calledOnceWithExactly(momentAdd, TOKEN_EXPIRE_TIME, 'seconds');
  });
});

describe('updatePassword', () => {
  let findOneAndUpdate;
  beforeEach(() => {
    findOneAndUpdate = sinon.stub(User, 'findOneAndUpdate');
  });
  afterEach(() => {
    findOneAndUpdate.restore();
  });

  it('should update a user password', async () => {
    const userId = new ObjectID();
    const payload = { local: { password: '123456!eR' } };

    findOneAndUpdate.returns(SinonMongoose.stubChainedQueries(
      [{ _id: userId, local: { password: '123456!eR' } }],
      ['lean']
    ));

    const result = await AuthenticationHelper.updatePassword(userId, payload);

    expect(result).toEqual({ _id: userId, local: { password: '123456!eR' } });
    SinonMongoose.calledWithExactly(
      findOneAndUpdate,
      [
        {
          query: 'findOneAndUpdate',
          args: [
            { _id: userId },
            { $set: { 'local.password': '123456!eR' }, $unset: { passwordToken: '' } },
            { new: true },
          ],
        },
        { query: 'lean' },
      ]
    );
  });
});

describe('sendToken', () => {
  let encode;
  beforeEach(() => {
    encode = sinon.stub(AuthenticationHelper, 'encode');
  });
  afterEach(() => {
    encode.restore();
  });

  it('should return token with user', async () => {
    const email = 'carolyn@alenvi.io';
    const user = { _id: new ObjectID(), local: { email } };
    const userPayload = { _id: user._id, email };

    encode.returns('1234567890');

    const result = await AuthenticationHelper.sendToken(user);
    expect(result).toEqual({ token: '1234567890', user: userPayload });
    sinon.assert.calledWithExactly(encode, userPayload, TOKEN_EXPIRE_TIME);
  });
});

describe('checkPasswordToken', () => {
  let userFindOne;
  let identityVerificationFindOne;
  let identityVerificationRemove;
  let sendToken;
  let fakeDate;
  const date = new Date('2020-01-13');
  beforeEach(() => {
    userFindOne = sinon.stub(User, 'findOne');
    identityVerificationFindOne = sinon.stub(IdentityVerification, 'findOne');
    identityVerificationRemove = sinon.stub(IdentityVerification, 'remove');
    sendToken = sinon.stub(AuthenticationHelper, 'sendToken');
    fakeDate = sinon.stub(Date, 'now');
  });
  afterEach(() => {
    userFindOne.restore();
    identityVerificationFindOne.restore();
    identityVerificationRemove.restore();
    sendToken.restore();
    fakeDate.restore();
  });

  it('should throw an error if user does not exist (webapp)', async () => {
    fakeDate.returns(date);
    const filter = { passwordToken: { token: '1234567890', expiresIn: { $gt: date } } };

    try {
      userFindOne.returns(SinonMongoose.stubChainedQueries([], ['select', 'lean']));

      await AuthenticationHelper.checkPasswordToken('1234567890');
    } catch (e) {
      expect(e).toEqual(Boom.notFound(translate[language].userNotFound));
    } finally {
      sinon.assert.notCalled(identityVerificationRemove);
      sinon.assert.notCalled(sendToken);
      SinonMongoose.calledWithExactly(
        userFindOne,
        [
          { query: 'findOne', args: [flat(filter, { maxDepth: 2 })] },
          { query: 'select', args: ['local'] },
          { query: 'lean' },
        ]
      );
    }
  });

  it('(should return a token if code match (mobile)', async () => {
    const token = '3310';
    const email = 'carolyn@alenvi.io';
    const user = { _id: new ObjectID(), local: { email } };
    const userPayload = { _id: user._id, email };

    userFindOne.returns(SinonMongoose.stubChainedQueries([user], ['select', 'lean']));
    identityVerificationFindOne.returns(SinonMongoose.stubChainedQueries([
      { code: '3310', email, updatedAt: new Date('2021-01-25T10:05:32.582Z') },
    ], ['lean']));
    fakeDate.returns(new Date('2021-01-25T10:08:32.582Z'));
    sendToken.returns({ token: '1234567890', user: userPayload });

    const result = await AuthenticationHelper.checkPasswordToken(token, email);
    expect(result).toEqual({ token: '1234567890', user: userPayload });
    sinon.assert.calledWithExactly(identityVerificationRemove, { email, code: token });
    sinon.assert.calledWithExactly(sendToken, user);
    SinonMongoose.calledWithExactly(
      identityVerificationFindOne,
      [{ query: 'findOne', args: [{ email, code: token }] }, { query: 'lean' }]
    );
    SinonMongoose.calledWithExactly(
      userFindOne,
      [
        { query: 'findOne', args: [{ 'local.email': email }] },
        { query: 'select', args: ['local.email'] },
        { query: 'lean' },
      ]
    );
  });

  it('should throw an error if code does not match (mobile)', async () => {
    fakeDate.returns(new Date('2021-01-25T10:08:32.582Z'));
    const email = 'carolyn@alenvi.io';
    const token = '3311';

    try {
      identityVerificationFindOne.returns(SinonMongoose.stubChainedQueries([], ['lean']));

      await AuthenticationHelper.checkPasswordToken(token, email);
    } catch (e) {
      expect(e).toEqual(Boom.notFound());
    } finally {
      sinon.assert.notCalled(userFindOne);
      sinon.assert.notCalled(identityVerificationRemove);
      sinon.assert.notCalled(sendToken);
      SinonMongoose.calledWithExactly(
        identityVerificationFindOne,
        [{ query: 'findOne', args: [{ email, code: token }] }, { query: 'lean' }]
      );
    }
  });

  it('should throw an error if code too old (mobile)', async () => {
    fakeDate.returns(new Date('2021-01-25T10:08:32.582Z'));
    const email = 'carolyn@alenvi.io';
    const token = '3310';
    identityVerificationFindOne.returns(SinonMongoose.stubChainedQueries([
      { code: '3310', email, updatedAt: new Date('2021-01-25T09:05:32.582Z') },
    ], ['lean']));
    try {
      await AuthenticationHelper.checkPasswordToken(token, email);
    } catch (e) {
      expect(e).toEqual(Boom.unauthorized());
    } finally {
      sinon.assert.notCalled(userFindOne);
      sinon.assert.notCalled(identityVerificationRemove);
      sinon.assert.notCalled(sendToken);
      SinonMongoose.calledWithExactly(
        identityVerificationFindOne,
        [{ query: 'findOne', args: [{ email, code: token }] }, { query: 'lean' }]
      );
    }
  });

  it('should return a new access token after checking reset password token (webapp)', async () => {
    fakeDate.returns(date);
    const filter = { passwordToken: { token: '1234567890', expiresIn: { $gt: date } } };
    const user = { _id: new ObjectID(), local: { email: 'toto@toto.com' } };
    const userPayload = { _id: user._id, email: user.local.email };

    userFindOne.returns(SinonMongoose.stubChainedQueries([user], ['select', 'lean']));
    sendToken.returns({ token: '1234567890', user: userPayload });

    const result = await AuthenticationHelper.checkPasswordToken('1234567890');

    expect(result).toEqual({ token: '1234567890', user: userPayload });
    sinon.assert.notCalled(identityVerificationRemove);
    sinon.assert.calledWithExactly(sendToken, user);
    SinonMongoose.calledWithExactly(
      userFindOne,
      [
        { query: 'findOne', args: [flat(filter, { maxDepth: 2 })] },
        { query: 'select', args: ['local'] },
        { query: 'lean' },
      ]
    );
  });
});

describe('createPasswordToken', () => {
  let generatePasswordTokenStub;

  beforeEach(() => {
    generatePasswordTokenStub = sinon.stub(AuthenticationHelper, 'generatePasswordToken');
  });
  afterEach(() => {
    generatePasswordTokenStub.restore();
  });

  it('should return a new password token', async () => {
    const email = 'toto@toto.com';
    generatePasswordTokenStub.returns({ token: '123456789' });

    const passwordToken = await AuthenticationHelper.createPasswordToken(email);

    sinon.assert.calledOnceWithExactly(generatePasswordTokenStub, email, 24 * 3600 * 1000);
    expect(passwordToken).toEqual({ token: '123456789' });
  });
});

describe('forgotPassword', () => {
  let forgotPasswordEmail;
  let sendVerificationCodeEmail;
  let sendVerificationCodeSms;
  let generatePasswordTokenStub;
  let identityVerificationFindOneAndUpdate;
  let identityVerificationCreate;
  let codeVerification;
  let userFindOne;

  beforeEach(() => {
    forgotPasswordEmail = sinon.stub(EmailHelper, 'forgotPasswordEmail');
    sendVerificationCodeEmail = sinon.stub(EmailHelper, 'sendVerificationCodeEmail');
    sendVerificationCodeSms = sinon.stub(SmsHelper, 'sendVerificationCodeSms');
    generatePasswordTokenStub = sinon.stub(AuthenticationHelper, 'generatePasswordToken');
    identityVerificationFindOneAndUpdate = sinon.stub(IdentityVerification, 'findOneAndUpdate');
    identityVerificationCreate = sinon.stub(IdentityVerification, 'create');
    codeVerification = sinon.stub(Math, 'random');
    userFindOne = sinon.stub(User, 'findOne');
  });
  afterEach(() => {
    forgotPasswordEmail.restore();
    sendVerificationCodeEmail.restore();
    sendVerificationCodeSms.restore();
    generatePasswordTokenStub.restore();
    identityVerificationFindOneAndUpdate.restore();
    identityVerificationCreate.restore();
    codeVerification.restore();
    userFindOne.restore();
  });

  it('should return a new access token after checking reset password token', async () => {
    const email = 'toto@toto.com';
    generatePasswordTokenStub.returns({ token: '123456789' });
    forgotPasswordEmail.returns({ sent: true });

    const result = await AuthenticationHelper.forgotPassword({ email });

    expect(result).toEqual({ sent: true });
    sinon.assert.calledOnceWithExactly(generatePasswordTokenStub, email, 3600000);
    sinon.assert.calledWithExactly(forgotPasswordEmail, email, { token: '123456789' });
    sinon.assert.notCalled(sendVerificationCodeEmail);
    sinon.assert.notCalled(identityVerificationFindOneAndUpdate);
    sinon.assert.notCalled(identityVerificationCreate);
    sinon.assert.notCalled(codeVerification);
    sinon.assert.notCalled(userFindOne);
    sinon.assert.notCalled(sendVerificationCodeSms);
  });

  it('should create and send a verification code if origin mobile and type email', async () => {
    const email = 'toto@toto.com';
    codeVerification.returns(0.1111);
    identityVerificationFindOneAndUpdate.returns(null);
    identityVerificationCreate.returns({ email, code: '1999' });
    sendVerificationCodeEmail.returns({ sent: true });

    const result = await AuthenticationHelper.forgotPassword({ email, origin: MOBILE, type: EMAIL });

    expect(result).toEqual({ sent: true });
    sinon.assert.calledWithExactly(sendVerificationCodeEmail, email, '1999');
    sinon.assert.notCalled(forgotPasswordEmail);
    sinon.assert.notCalled(generatePasswordTokenStub);
    sinon.assert.notCalled(sendVerificationCodeSms);
    sinon.assert.calledOnceWithExactly(identityVerificationCreate, { email, code: '1999' });
    SinonMongoose.calledWithExactly(
      identityVerificationFindOneAndUpdate,
      [{ query: 'findOneAndUpdate', args: [{ email }, { $set: { code: '1999' } }, { new: true }] }]
    );
  });

  it('should update and send new verification code if already exists one', async () => {
    const email = 'toto@toto.com';
    codeVerification.returns(0.1111);
    identityVerificationFindOneAndUpdate.returns({ email, code: '1999' });
    identityVerificationCreate.returns(null);
    sendVerificationCodeEmail.returns({ sent: true });

    const result = await AuthenticationHelper.forgotPassword({ email, origin: MOBILE, type: EMAIL });

    expect(result).toEqual({ sent: true });
    sinon.assert.calledWithExactly(sendVerificationCodeEmail, email, '1999');
    sinon.assert.notCalled(forgotPasswordEmail);
    sinon.assert.notCalled(generatePasswordTokenStub);
    sinon.assert.notCalled(identityVerificationCreate);
    sinon.assert.notCalled(userFindOne);
    sinon.assert.notCalled(sendVerificationCodeSms);
    SinonMongoose.calledWithExactly(
      identityVerificationFindOneAndUpdate,
      [{ query: 'findOneAndUpdate', args: [{ email }, { $set: { code: '1999' } }, { new: true }] }]
    );
  });

  it('should send a code verification if origin mobile and type phone', async () => {
    const email = 'toto@toto.com';
    const user = { local: { email: 'toto@toto.com' }, contact: { phone: '0687654321' } };
    codeVerification.returns(0.1111);
    identityVerificationFindOneAndUpdate.returns({ email, code: '1999' });
    identityVerificationCreate.returns(null);
    userFindOne.returns(SinonMongoose.stubChainedQueries([user], ['lean']));
    sendVerificationCodeSms.returns({ phone: '0687654321' });

    const result = await AuthenticationHelper.forgotPassword({ email, origin: MOBILE, type: PHONE });

    expect(result).toEqual({ phone: '0687654321' });
    sinon.assert.notCalled(sendVerificationCodeEmail);
    sinon.assert.notCalled(forgotPasswordEmail);
    sinon.assert.notCalled(generatePasswordTokenStub);
    sinon.assert.notCalled(identityVerificationCreate);
    sinon.assert.calledOnceWithExactly(sendVerificationCodeSms, '0687654321', '1999');
    SinonMongoose.calledWithExactly(
      identityVerificationFindOneAndUpdate,
      [{ query: 'findOneAndUpdate', args: [{ email }, { $set: { code: '1999' } }, { new: true }] }]
    );
    SinonMongoose.calledWithExactly(
      userFindOne,
      [{ query: 'findOne', args: [{ 'local.email': 'toto@toto.com' }, { 'contact.phone': 1 }] }, { query: 'lean' }]
    );
  });

  it('should throw 409 if no phone in user', async () => {
    try {
      const email = 'toto@toto.com';
      const user = { local: { email: 'toto@toto.com' } };
      codeVerification.returns(0.1111);
      identityVerificationFindOneAndUpdate.returns({ email, code: '1999' });
      identityVerificationCreate.returns(null);
      userFindOne.returns(SinonMongoose.stubChainedQueries([user], ['lean']));
      sendVerificationCodeSms.returns({ phone: '06P87654321' });

      await AuthenticationHelper.forgotPassword({ email, origin: MOBILE, type: PHONE });
    } catch (e) {
      expect(e.output.statusCode).toEqual(409);
    } finally {
      SinonMongoose.calledWithExactly(
        userFindOne,
        [{ query: 'findOne', args: [{ 'local.email': 'toto@toto.com' }, { 'contact.phone': 1 }] }, { query: 'lean' }]
      );
      sinon.assert.notCalled(sendVerificationCodeSms);
    }
  });
});

describe('generatePasswordToken', () => {
  let findOneAndUpdate;
  let fakeDate;
  const date = new Date('2020-01-13');
  beforeEach(() => {
    findOneAndUpdate = sinon.stub(User, 'findOneAndUpdate');
    fakeDate = sinon.useFakeTimers(date);
  });
  afterEach(() => {
    findOneAndUpdate.restore();
    fakeDate.restore();
  });

  it('should throw an error if user does not exist', async () => {
    try {
      findOneAndUpdate.returns(SinonMongoose.stubChainedQueries([], ['lean']));

      await AuthenticationHelper.generatePasswordToken('toto@toto.com', 3600000);
    } catch (e) {
      expect(e).toEqual(Boom.notFound(translate[language].userNotFound));
    } finally {
      SinonMongoose.calledWithExactly(
        findOneAndUpdate,
        [
          {
            query: 'findOneAndUpdate',
            args: [
              { 'local.email': 'toto@toto.com' },
              { $set: { passwordToken: { token: sinon.match.string, expiresIn: date.getTime() + 3600000 } } },
              { new: true },
            ],
          },
          { query: 'lean' },
        ]
      );
    }
  });

  it('should return a new access token after checking reset password token', async () => {
    const user = {
      _id: new ObjectID(),
      local: { email: 'toto@toto.com' },
      passwordToken: { token: sinon.match.string, expiresIn: date.getTime() + 3600000 },
    };

    findOneAndUpdate.returns(SinonMongoose.stubChainedQueries([user], ['lean']));

    const result = await AuthenticationHelper.generatePasswordToken('toto@toto.com', 3600000);

    expect(result).toEqual({ token: expect.any(String), expiresIn: date.getTime() + 3600000 });
    SinonMongoose.calledWithExactly(
      findOneAndUpdate,
      [
        {
          query: 'findOneAndUpdate',
          args: [
            { 'local.email': 'toto@toto.com' },
            { $set: { passwordToken: { token: sinon.match.string, expiresIn: date.getTime() + 3600000 } } },
            { new: true },
          ],
        },
        { query: 'lean' },
      ]
    );
  });
});
