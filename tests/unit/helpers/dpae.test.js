/* eslint-disable max-len */
const expect = require('expect');
const sinon = require('sinon');
const moment = require('moment');
const { ObjectID } = require('mongodb');
const User = require('../../../src/models/User');
const Event = require('../../../src/models/Event');
const Pay = require('../../../src/models/Pay');
const Contract = require('../../../src/models/Contract');
const DpaeHelper = require('../../../src/helpers/dpae');
const FileHelper = require('../../../src/helpers/file');
const ContractHelper = require('../../../src/helpers/contracts');
const HistoryExportHelper = require('../../../src/helpers/historyExport');
const {
  PAID_LEAVE,
  UNPAID_LEAVE,
  MATERNITY_LEAVE,
  PATERNITY_LEAVE,
  PARENTAL_LEAVE,
  ILLNESS,
  UNJUSTIFIED,
  WORK_ACCIDENT,
  TRANSPORT_ACCIDENT,
  SERIOUS_MISCONDUCT_LAYOFF,
  CONTRACTUAL_TERMINATION,
} = require('../../../src/helpers/constants');
const SinonMongoose = require('../sinonMongoose');

describe('formatBirthDate', () => {
  it('should format date', () => {
    expect(DpaeHelper.formatBirthDate('2020-09-10T09:12:00')).toEqual('10/09/2020');
  });
  it('should return empty string if date is null', () => {
    expect(DpaeHelper.formatBirthDate(null)).toEqual('');
  });
});

describe('shortenAddress', () => {
  it('should return address as already short', () => {
    expect(DpaeHelper.shortenAddress('12 rue de la paix')).toEqual('12 rue de la paix');
  });

  it('should shorten address if too long', () => {
    expect(DpaeHelper.shortenAddress('12 avenue du maréchal de lattre de tassigny'))
      .toEqual('12 avenue du maréchal de');
  });
});

describe('formatAddress', () => {
  let shortenAddress;
  beforeEach(() => {
    shortenAddress = sinon.stub(DpaeHelper, 'shortenAddress');
  });
  afterEach(() => {
    shortenAddress.restore();
  });

  it('should format address', () => {
    const address = '12 avenue du maréchal de lattre de tassigny';
    shortenAddress.onCall(0).returns('12 avenue du maréchal de');
    shortenAddress.onCall(1).returns('lattre de tassigny');

    const result = DpaeHelper.formatAddress(address);

    expect(result).toEqual({ start: '12 avenue du maréchal de', end: 'lattre de tassigny' });
    sinon.assert.calledWithExactly(shortenAddress.getCall(0), address);
    sinon.assert.calledWithExactly(shortenAddress.getCall(1), 'lattre de tassigny');
  });
});

describe('formatIdentificationInfo', () => {
  let formatAddress;
  beforeEach(() => {
    formatAddress = sinon.stub(DpaeHelper, 'formatAddress');
    process.env.AP_SOC = 'ap_soc';
  });
  afterEach(() => {
    formatAddress.restore();
    process.env.AP_SOC = '';
  });

  it('should format identification info', async () => {
    const auxiliary = {
      identity: {
        title: 'mr',
        lastname: 'Sandbox',
        firstname: 'Olivier',
        birthDate: '1991-10-01T00:00:00',
        birthState: 'DJ',
        birthCountry: 'Djibouti',
        birthCity: 'Djibouti',
        socialSecurityNumber: '21991102309878624',
        nationality: 'AZ',
      },
      establishment: { siret: '1234567890' },
      serialNumber: 'serialNumber',
      contact: { address: { zipCode: '75', city: 'Paris', street: 'tamalou' } },
    };
    formatAddress.returns({ start: 'start', end: 'end' });

    const result = await DpaeHelper.formatIdentificationInfo(auxiliary);

    expect(result).toEqual({
      ap_soc: 'ap_soc',
      ap_etab: '67890',
      ap_matr: 'serialNumber',
      fs_titre: 1,
      fs_nom: 'Sandbox',
      fs_prenom: 'Olivier',
      fs_secu: '21991102309878624',
      fs_date_nai: '01/10/1991',
      fs_dept_nai: 'DJ',
      fs_pays_nai: 'Djibouti',
      fs_lieu_nai: 'Djibouti',
      fs_nat: 'AZ',
      fs_adr1: 'start',
      fs_adr2: 'end',
      fs_cp: '75',
      fs_ville: 'Paris',
      fs_pays: 'FR',
    });
  });
});

describe('formatBankingInfo', () => {
  it('should format banking info', async () => {
    const auxiliary = {
      administrative: { payment: { rib: { bic: 'BATIFRP1', iban: 'raboul le fric' } } },
    };

    const result = await DpaeHelper.formatBankingInfo(auxiliary);

    expect(result).toEqual({
      fs_bq_dom: 'BANQUE DU BAT ET DES TRAV',
      fs_bq_iban: 'raboul le fric',
      fs_bq_bic: 'BATIFRP1',
      fs_bq_mode: 'V',
    });
  });
});

describe('formatContractInfo', () => {
  it('should format contract info', async () => {
    const contract = {
      startDate: '2020-10-03T00:00:00',
      user: 'mon auxiliaire',
      serialNumber: '1234567890',
      versions: [{ weeklyHours: 24, grossHourlyRate: 10 }],
    };

    const result = await DpaeHelper.formatContractInfo(contract);

    expect(result).toEqual({
      ap_contrat: '1234567890',
      fs_regime: '50',
      fs_natc: '00201:0:0:0:0:0',
      fs_categ: '015',
      fs_typec: '005',
      fs_emploi: 'Auxiliaire d\'envie',
      fs_emploi_insee: '563b',
      fs_anc: '03/10/2020',
      fs_mv_entree: '03/10/2020',
      fs_date_avenant: '03/10/2020',
      fs_horaire: 104,
      fs_sal_forfait_montant: 1040,
    });
  });
});

describe('exportDpae', () => {
  let findOneUser;
  let formatIdentificationInfo;
  let formatBankingInfo;
  let formatContractInfo;
  let exportToTxt;
  beforeEach(() => {
    findOneUser = sinon.stub(User, 'findOne');
    formatIdentificationInfo = sinon.stub(DpaeHelper, 'formatIdentificationInfo');
    formatBankingInfo = sinon.stub(DpaeHelper, 'formatBankingInfo');
    formatContractInfo = sinon.stub(DpaeHelper, 'formatContractInfo');
    exportToTxt = sinon.stub(FileHelper, 'exportToTxt');
  });
  afterEach(() => {
    findOneUser.restore();
    formatIdentificationInfo.restore();
    formatBankingInfo.restore();
    formatContractInfo.restore();
    exportToTxt.restore();
  });

  it('should export dpae', async () => {
    const contract = {
      startDate: '2020-10-03T00:00:00',
      user: 'mon auxiliaire',
      serialNumber: '1234567890',
      versions: [{ weeklyHours: 24 }],
    };
    const auxiliary = { serialNumber: 'serialNumber' };

    findOneUser.returns(SinonMongoose.stubChainedQueries([auxiliary]));
    formatIdentificationInfo.returns({ ap_matr: 'serialNumber' });
    formatBankingInfo.returns({ fs_bq_dom: 'BANK AUDI FRANCE' });
    formatContractInfo.returns({ ap_contrat: '1234567890' });
    exportToTxt.returns('file');

    const result = await DpaeHelper.exportDpae(contract);

    expect(result).toEqual('file');
    sinon.assert.calledOnceWithExactly(formatIdentificationInfo, auxiliary);
    sinon.assert.calledOnceWithExactly(formatBankingInfo, auxiliary);
    sinon.assert.calledOnceWithExactly(formatContractInfo, contract);
    sinon.assert.calledOnceWithExactly(
      exportToTxt,
      [['ap_matr', 'fs_bq_dom', 'ap_contrat'], ['serialNumber', 'BANK AUDI FRANCE', '1234567890']]
    );
    SinonMongoose.calledWithExactly(
      findOneUser,
      [
        {
          query: 'findOne',
          args: [{ _id: 'mon auxiliaire' }, 'identity serialNumber contact administrative.payment establishment'],
        },
        { query: 'populate', args: [{ path: 'establishment', select: 'siret' }] },
        { query: 'lean' },
      ]
    );
  });
});

describe('exportIdentification', () => {
  let findContract;
  let formatIdentificationInfo;
  let formatBankingInfo;
  let exportToTxt;
  beforeEach(() => {
    findContract = sinon.stub(Contract, 'find');
    formatIdentificationInfo = sinon.stub(DpaeHelper, 'formatIdentificationInfo');
    formatBankingInfo = sinon.stub(DpaeHelper, 'formatBankingInfo');
    exportToTxt = sinon.stub(FileHelper, 'exportToTxt');
  });
  afterEach(() => {
    findContract.restore();
    formatIdentificationInfo.restore();
    formatBankingInfo.restore();
    exportToTxt.restore();
  });

  it('should export contracts', async () => {
    const endDate = moment('2020-01-11T14:00:00').toDate();
    const companyId = new ObjectID();

    findContract.returns(SinonMongoose.stubChainedQueries([[{ user: 'first user' }, { user: 'second user' }]]));
    formatIdentificationInfo.onFirstCall().returns({ identity: 1 }).onSecondCall().returns({ identity: 2 });
    formatBankingInfo.onFirstCall().returns({ bank: 1 }).onSecondCall().returns({ bank: 2 });
    exportToTxt.returns('file');

    const result = await DpaeHelper.exportIdentification({ endDate }, { company: { _id: companyId } });
    expect(result).toEqual('file');
    sinon.assert.calledTwice(formatIdentificationInfo);
    sinon.assert.calledWithExactly(formatIdentificationInfo.getCall(0), 'first user');
    sinon.assert.calledWithExactly(formatIdentificationInfo.getCall(1), 'second user');
    sinon.assert.calledTwice(formatBankingInfo);
    sinon.assert.calledWithExactly(formatBankingInfo.getCall(0), 'first user');
    sinon.assert.calledWithExactly(formatBankingInfo.getCall(1), 'second user');
    sinon.assert.calledOnceWithExactly(exportToTxt, [['identity', 'bank'], [1, 1], [2, 2]]);
    SinonMongoose.calledWithExactly(
      findContract,
      [
        {
          query: 'find',
          args: [{
            startDate: { $lte: moment(endDate).endOf('d').toDate() },
            $or: [
              { endDate: null },
              { endDate: { $exists: false } },
              { endDate: { $gt: moment(endDate).endOf('d').toDate() } },
            ],
            company: companyId,
          }],
        },
        {
          query: 'populate',
          args: [{ path: 'user', select: 'serialNumber identity contact.address administrative.payment' }],
        },
        { query: 'lean' },
      ]
    );
  });
});

describe('exportsContractVersions', () => {
  let findContract;
  let exportToTxt;
  let getQuery;
  beforeEach(() => {
    findContract = sinon.stub(Contract, 'find');
    exportToTxt = sinon.stub(FileHelper, 'exportToTxt');
    getQuery = sinon.stub(ContractHelper, 'getQuery');
    process.env.AP_SOC = 'ap_soc';
  });
  afterEach(() => {
    findContract.restore();
    exportToTxt.restore();
    getQuery.restore();
    process.env.AP_SOC = '';
  });

  it('should export contract version', async () => {
    const query = { startDate: '2020-10-31T22:00:00', endDate: '2020-11-30T22:00:00' };
    const companyId = '1234567890';
    const versions = [{
      user: { serialNumber: 'serialNumber', identity: { lastname: 'Rougé' } },
      serialNumber: 'contractNumber',
      versions: [
        { weeklyHours: 18, grossHourlyRate: 10, startDate: '2020-09-01T22:00:00', endDate: '2020-10-01T21:59:59' },
        { weeklyHours: 24, grossHourlyRate: 10, startDate: '2020-10-01T22:00:00', endDate: '2020-11-09T21:59:59' },
        { weeklyHours: 18, grossHourlyRate: 10, startDate: '2020-11-10T22:00:00' },
      ],
    }, {
      user: { serialNumber: 'userNumber', identity: { lastname: 'Gallier' } },
      serialNumber: 'titotu',
      versions: [
        { weeklyHours: 12, grossHourlyRate: 10, startDate: '2020-07-01T22:00:00', endDate: '2020-11-02T21:59:59' },
        { weeklyHours: 6, grossHourlyRate: 10, startDate: '2020-11-02T22:00:00' },
      ],
    }];
    getQuery.returns([{ endDate: null }, { endDate: { $exists: false } }]);
    findContract.returns(SinonMongoose.stubChainedQueries([versions]));
    exportToTxt.returns('file');

    const result = await DpaeHelper.exportContractVersions(query, { company: { _id: companyId } });

    expect(result).toEqual('file');
    sinon.assert.calledOnceWithExactly(getQuery, query, companyId);
    sinon.assert.calledOnceWithExactly(
      exportToTxt,
      [
        ['ap_soc', 'ap_matr', 'fs_nom', 'ap_contrat', 'fs_date_avenant', 'fs_horaire', 'fs_sal_forfait_montant'],
        ['ap_soc', 'serialNumber', 'Rougé', 'contractNumber', '10/11/2020', 78, 780],
        ['ap_soc', 'userNumber', 'Gallier', 'titotu', '02/11/2020', 26, 260],
      ]
    );
    SinonMongoose.calledWithExactly(
      findContract,
      [
        { query: 'find', args: [{ $and: [{ endDate: null }, { endDate: { $exists: false } }] }] },
        { query: 'populate', args: [{ path: 'user', select: 'serialNumber identity' }] },
        { query: 'lean' },
      ]
    );
  });
});

describe('exportContractEnds', () => {
  let findContract;
  let exportToTxt;
  beforeEach(() => {
    findContract = sinon.stub(Contract, 'find');
    exportToTxt = sinon.stub(FileHelper, 'exportToTxt');
    process.env.AP_SOC = 'ap_soc';
  });
  afterEach(() => {
    findContract.restore();
    exportToTxt.restore();
    process.env.AP_SOC = '';
  });

  it('should export contract end', async () => {
    const query = { startDate: '2020-10-31T22:00:00', endDate: '2020-11-30T22:00:00' };
    const companyId = '1234567890';
    const contracts = [{
      user: { serialNumber: 'serialNumber', identity: { lastname: 'Rougé' } },
      serialNumber: 'contractNumber',
      endDate: '2020-11-04T00:00:00',
      endReason: CONTRACTUAL_TERMINATION,
    }, {
      user: { serialNumber: 'userNumber', identity: { lastname: 'Gallier' } },
      serialNumber: 'titotu',
      endDate: '2020-11-07T00:00:00',
      endReason: SERIOUS_MISCONDUCT_LAYOFF,
    }];
    findContract.returns(SinonMongoose.stubChainedQueries([contracts]));
    exportToTxt.returns('file');

    const result = await DpaeHelper.exportContractEnds(query, { company: { _id: companyId } });

    expect(result).toEqual('file');
    sinon.assert.calledOnceWithExactly(
      exportToTxt,
      [
        ['ap_soc', 'ap_matr', 'fs_nom', 'ap_contrat', 'fs_mv_sortie', 'fs_mv_motif_s'],
        ['ap_soc', 'serialNumber', 'Rougé', 'contractNumber', '04/11/2020', 8],
        ['ap_soc', 'userNumber', 'Gallier', 'titotu', '07/11/2020', 16],
      ]
    );
    SinonMongoose.calledWithExactly(
      findContract,
      [
        {
          query: 'find',
          args: [{
            endDate: {
              $lte: moment(query.endDate).endOf('d').toDate(),
              $gte: moment(query.startDate).startOf('d').toDate(),
            },
            company: '1234567890',
          }],
        },
        { query: 'populate', args: [{ path: 'user', select: 'serialNumber identity' }] },
        { query: 'lean' },
      ]
    );
  });
});

describe('getAbsences', () => {
  let findEvent;
  let findPay;
  beforeEach(() => {
    findEvent = sinon.stub(Event, 'find');
    findPay = sinon.stub(Pay, 'find');
  });
  afterEach(() => {
    findEvent.restore();
    findPay.restore();
  });

  it('should return absence from previous month pay date', async () => {
    const companyId = new ObjectID();
    const absences = [{ _id: new ObjectID() }];
    const query = { startDate: '2020-11-01T00:00:00', endDate: '2020-11-30T22:00:00' };
    findPay.returns(
      SinonMongoose.stubChainedQueries([[{ createdAt: '2020-10-29T10:31:00' }]], ['sort', 'limit', 'lean'])
    );
    findEvent.returns(SinonMongoose.stubChainedQueries([absences], ['populate', 'sort', 'lean']));

    const result = await DpaeHelper.getAbsences(query, { company: { _id: companyId } });

    expect(result).toEqual(absences);
    SinonMongoose.calledWithExactly(
      findPay,
      [
        { query: 'find', args: [{ date: { $gte: moment('2020-10-01T00:00:00').toDate() }, company: companyId }] },
        { query: 'sort', args: [{ createdAt: -1 }] },
        { query: 'limit', args: [1] },
        { query: 'lean' },
      ]
    );
    SinonMongoose.calledWithExactly(
      findEvent,
      [
        {
          query: 'find',
          args: [{
            type: 'absence',
            absence: { $in: [PAID_LEAVE, UNPAID_LEAVE, MATERNITY_LEAVE, PATERNITY_LEAVE, PARENTAL_LEAVE, ILLNESS, UNJUSTIFIED, WORK_ACCIDENT, TRANSPORT_ACCIDENT] },
            startDate: { $lt: moment(query.endDate).endOf('day').toDate() },
            endDate: { $gt: moment('2020-10-29T10:31:00').toDate() },
            company: companyId,
          }],
        },
        {
          query: 'populate',
          args: [{
            path: 'auxiliary',
            select: 'serialNumber identity',
            populate: [{ path: 'contracts' }, { path: 'establishment' }],
          }],
        },
        { query: 'populate', args: [{ path: 'extension', select: 'startDate' }] },
        { query: 'sort', args: [{ startDate: 1 }] },
        { query: 'lean' },
      ]
    );
  });

  it('should return absence from query start date', async () => {
    const companyId = new ObjectID();
    const absences = [{ _id: new ObjectID() }];
    const query = { startDate: '2020-11-01T00:00:00', endDate: '2020-11-30T22:00:00' };
    findPay.returns(SinonMongoose.stubChainedQueries([[]], ['sort', 'limit', 'lean']));
    findEvent.returns(SinonMongoose.stubChainedQueries([absences], ['populate', 'sort', 'lean']));

    const result = await DpaeHelper.getAbsences(query, { company: { _id: companyId } });

    expect(result).toEqual(absences);
    SinonMongoose.calledWithExactly(
      findPay,
      [
        { query: 'find', args: [{ date: { $gte: moment('2020-10-01T00:00:00').toDate() }, company: companyId }] },
        { query: 'sort', args: [{ createdAt: -1 }] },
        { query: 'limit', args: [1] },
        { query: 'lean' },
      ]
    );
    SinonMongoose.calledWithExactly(
      findEvent,
      [
        { query: 'find',
          args: [{
            type: 'absence',
            absence: { $in: [PAID_LEAVE, UNPAID_LEAVE, MATERNITY_LEAVE, PATERNITY_LEAVE, PARENTAL_LEAVE, ILLNESS, UNJUSTIFIED, WORK_ACCIDENT, TRANSPORT_ACCIDENT] },
            startDate: { $lt: moment(query.endDate).endOf('day').toDate() },
            endDate: { $gt: moment(query.startDate).startOf('day').toDate() },
            company: companyId,
          },
          ] },
        {
          query: 'populate',
          args: [{
            path: 'auxiliary',
            select: 'serialNumber identity',
            populate: [{ path: 'contracts' }, { path: 'establishment' }],
          }],
        },
        { query: 'populate', args: [{ path: 'extension', select: 'startDate' }] },
        { query: 'sort', args: [{ startDate: 1 }] },
        { query: 'lean' },
      ]
    );
  });
});

describe('exportsAbsence', () => {
  let getAbsences;
  let getAbsenceHours;
  let exportToTxt;
  beforeEach(() => {
    getAbsences = sinon.stub(DpaeHelper, 'getAbsences');
    getAbsenceHours = sinon.stub(HistoryExportHelper, 'getAbsenceHours');
    exportToTxt = sinon.stub(FileHelper, 'exportToTxt');
    process.env.AP_SOC = 'ap_soc';
  });
  afterEach(() => {
    getAbsences.restore();
    getAbsenceHours.restore();
    exportToTxt.restore();
    process.env.AP_SOC = '';
  });

  it('should export daily absence for auxiliary with contract', async () => {
    const companyId = new ObjectID();
    const query = { startDate: '2020-11-01T00:00:00', endDate: '2020-11-30T22:00:00' };
    const absences = [{
      absenceNature: 'daily',
      absence: 'leave',
      startDate: '2020-11-21T00:00:00',
      endDate: '2020-11-23T23:00:00',
      auxiliary: {
        contracts: [
          { endDate: '2019-11-01T00:00:00', startDate: '2018-02-01T00:00:00', serialNumber: 'contract' },
          { startDate: '2020-09-21T00:00:00', serialNumber: 'contract' }],
        establishment: { siret: '100009876' },
        serialNumber: '0987654321',
        identity: { lastname: 'Compani' },
      },
      extension: { _id: new ObjectID(), startDate: '2020-11-19T00:00:00' },
    }];
    getAbsences.returns(absences);
    getAbsenceHours.onCall(0).returns(5);
    getAbsenceHours.onCall(1).returns(0);
    getAbsenceHours.onCall(2).returns(4);
    exportToTxt.returns('file');
    const result = await DpaeHelper.exportAbsences(query, { company: { _id: companyId } });

    expect(result).toEqual('file');
    sinon.assert.calledOnceWithExactly(getAbsences, query, { company: { _id: companyId } });
    sinon.assert.calledOnceWithExactly(
      exportToTxt,
      [
        ['ap_soc', 'ap_etab', 'ap_matr', 'fs_nom', 'ap_contrat', 'va_abs_code', 'va_abs_deb', 'va_abs_fin', 'va_abs_premier_arret', 'va_abs_prolongation', 'va_abs_date', 'va_abs_nb22', 'va_abs_nb26', 'va_abs_nb30', 'va_abs_nbh'],
        ['ap_soc', '09876', '0987654321', 'Compani', 'contract', 'CPL', '21/11/2020', '23/11/2020', '0', '19/11/2020', '21/11/2020', 0, 1, 1, 5],
        ['ap_soc', '09876', '0987654321', 'Compani', 'contract', 'CPL', '21/11/2020', '23/11/2020', '0', '19/11/2020', '22/11/2020', 0, 0, 1, 0],
        ['ap_soc', '09876', '0987654321', 'Compani', 'contract', 'CPL', '21/11/2020', '23/11/2020', '0', '19/11/2020', '23/11/2020', 1, 1, 1, 4],
      ]
    );
    sinon.assert.calledWithExactly(
      getAbsenceHours.getCall(0),
      { absenceNature: 'daily', startDate: '2020-11-20T23:00:00.000Z', endDate: '2020-11-21T22:59:59.999Z' },
      [{ startDate: '2020-09-21T00:00:00', serialNumber: 'contract' }]
    );
    sinon.assert.calledWithExactly(
      getAbsenceHours.getCall(1),
      { absenceNature: 'daily', startDate: '2020-11-21T23:00:00.000Z', endDate: '2020-11-22T22:59:59.999Z' },
      [{ startDate: '2020-09-21T00:00:00', serialNumber: 'contract' }]
    );
    sinon.assert.calledWithExactly(
      getAbsenceHours.getCall(2),
      { absenceNature: 'daily', startDate: '2020-11-22T23:00:00.000Z', endDate: '2020-11-23T22:59:59.999Z' },
      [{ startDate: '2020-09-21T00:00:00', serialNumber: 'contract' }]
    );
    sinon.assert.callCount(getAbsenceHours, 3);
  });

  it('should export hourly absence for auxiliary with contract', async () => {
    const companyId = new ObjectID();
    const query = { startDate: '2020-11-01T00:00:00', endDate: '2020-11-30T22:00:00' };
    const absences = [{
      absenceNature: 'hourly',
      absence: 'leave',
      startDate: '2020-11-21T10:00:00',
      endDate: '2020-11-21T12:00:00',
      auxiliary: {
        contracts: [
          { endDate: '2019-11-01T00:00:00', startDate: '2018-02-01T00:00:00', serialNumber: 'contract' },
          { startDate: '2020-09-21T00:00:00', serialNumber: 'contract' }],
        establishment: { siret: '100009876' },
        serialNumber: '0987654321',
        identity: { lastname: 'Toto' },
      },
    }];
    getAbsences.returns(absences);
    getAbsenceHours.returns(2);
    exportToTxt.returns('file');
    const result = await DpaeHelper.exportAbsences(query, { company: { _id: companyId } });

    expect(result).toEqual('file');
    sinon.assert.calledOnceWithExactly(getAbsences, query, { company: { _id: companyId } });
    sinon.assert.calledOnceWithExactly(
      exportToTxt,
      [
        ['ap_soc', 'ap_etab', 'ap_matr', 'fs_nom', 'ap_contrat', 'va_abs_code', 'va_abs_deb', 'va_abs_fin', 'va_abs_premier_arret', 'va_abs_prolongation', 'va_abs_date', 'va_abs_nb22', 'va_abs_nb26', 'va_abs_nb30', 'va_abs_nbh'],
        ['ap_soc', '09876', '0987654321', 'Toto', 'contract', 'CPL', '21/11/2020', '21/11/2020', '1', '21/11/2020', '21/11/2020', 0, 1, 1, 2],
      ]
    );
    sinon.assert.calledOnceWithExactly(
      getAbsenceHours,
      absences[0],
      [{ startDate: '2020-09-21T00:00:00', serialNumber: 'contract' }]
    );
  });
});
