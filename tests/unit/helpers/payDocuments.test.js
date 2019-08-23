const Boom = require('boom');
const expect = require('expect');
const sinon = require('sinon');
const { ObjectID } = require('mongodb');

const PayDocument = require('../../../models/PayDocument');
const PayDocumentHelper = require('../../../helpers/payDocuments');
const GdriveStorageHelper = require('../../../helpers/gdriveStorage');
const translate = require('../../../helpers/translate');

const { language } = translate;

describe('createAndSave', () => {
  let addFileStub;
  let saveStub;
  const params = [
    '1234567890',
    'test',
    'stream',
    'application/pdf',
    new Date().toISOString(),
    'test',
    new ObjectID(),
  ];
  beforeEach(() => {
    addFileStub = sinon.stub(GdriveStorageHelper, 'addFile');
    saveStub = sinon.stub(PayDocument.prototype, 'save');
  });

  afterEach(() => {
    addFileStub.restore();
    saveStub.restore();
  });

  it('should throw a 424 error if file is not uploaded to Google Drive', async () => {
    addFileStub.returns(null);
    try {
      await PayDocumentHelper.createAndSave(...params);
    } catch (e) {
      expect(e).toEqual(Boom.failedDependency('Google drive: File not uploaded'));
    }
    sinon.assert.calledWith(addFileStub, {
      driveFolderId: '1234567890',
      name: 'test',
      type: 'application/pdf',
      body: 'stream',
    });
  });

  it('should save document to drive and db', async () => {
    addFileStub.returns({ id: '0987654321', webViewLink: 'http://test.com/test.pdf' });
    await PayDocumentHelper.createAndSave(...params);
    sinon.assert.calledWith(addFileStub, {
      driveFolderId: '1234567890',
      name: 'test',
      type: 'application/pdf',
      body: 'stream',
    });
    sinon.assert.calledOnce(saveStub);
  });
});

describe('removeFromDriveAndDb', () => {
  let findByIdAndRemoveStub;
  beforeEach(() => {
    findByIdAndRemoveStub = sinon.stub(PayDocument, 'findByIdAndRemove');
  });
  afterEach(() => {
    findByIdAndRemoveStub.restore();
  });

  it('should return a 404 error if document does not exists', async () => {
    findByIdAndRemoveStub.returns(null);
    const id = new ObjectID();
    try {
      await PayDocumentHelper.removeFromDriveAndDb(id);
    } catch (e) {
      expect(e).toEqual(Boom.notFound(translate[language].payDocumentNotFound));
    }
    sinon.assert.calledWith(findByIdAndRemoveStub, id);
  });

  it('should remove document from db and drive', async () => {
    const deleteFileStub = sinon.stub(GdriveStorageHelper, 'deleteFile');
    const id = new ObjectID();
    const doc = { file: { driveId: '1234567890', link: 'http://test.com/test.pdf' } };
    findByIdAndRemoveStub.returns(doc);
    await PayDocumentHelper.removeFromDriveAndDb(id);
    sinon.assert.calledWith(findByIdAndRemoveStub, id);
    sinon.assert.calledWith(deleteFileStub, doc.file.driveId);
    deleteFileStub.restore();
  });
});
