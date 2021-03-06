const sinon = require('sinon');
const expect = require('expect');
const { ObjectID } = require('mongodb');
const FileHelper = require('../../../src/helpers/file');
const CourseConvocation = require('../../../src/data/pdf/courseConvocation');

describe('getPdfContent', () => {
  let downloadImages;

  beforeEach(() => {
    downloadImages = sinon.stub(FileHelper, 'downloadImages');
  });

  afterEach(() => {
    downloadImages.restore();
  });

  it('it should format and return pdf content', async () => {
    const paths = [
      'src/data/pdf/tmp/aux-pouce.png',
      'src/data/pdf/tmp/doct-explication.png',
      'src/data/pdf/tmp/doct-explication.png',
      'src/data/pdf/tmp/aux-perplexite.png',
    ];
    downloadImages.returns(paths);

    const data = {
      misc: 'groupe 3',
      subProgram: { program: { name: 'test', description: 'on va apprendre' } },
      slots: [
        { date: '23/12/2020', hours: '12h - 14h', address: '' },
        { date: '14/01/2020', hours: '12h - 14h', address: '24 avenue du test' },
      ],
      slotsToPlan: [{ _id: new ObjectID() }],
      trainer: { formattedIdentity: 'test OK', biography: 'Voici ma bio' },
      contact: { formattedPhone: '09 87 65 43 21', email: 'test@test.fr' },
    };

    const result = await CourseConvocation.getPdfContent(data);

    const header = [
      {
        columns: [
          { image: 'src/data/pdf/tmp/aux-pouce.png', width: 64, style: 'img' },
          [
            { text: 'Vous êtes convoqué(e) à la formation', style: 'surtitle' },
            { text: 'test - groupe 3', style: 'title' },
            { canvas: [{ type: 'line', x1: 20, y1: 10, x2: 450, y2: 10, lineWidth: 1.5, lineColor: '#E2ECF0' }] },
          ],
        ],
      },
    ];
    const table = [
      {
        table: {
          body: [
            [
              { text: 'Dates', style: 'tableHeader' },
              { text: 'Heures', style: 'tableHeader' },
              { text: 'Lieux', style: 'tableHeader' },
            ],
            [
              { text: '23/12/2020', style: 'tableContent' },
              { text: '12h - 14h', style: 'tableContent' },
              { text: '', style: 'tableContent' },
            ],
            [
              { text: '14/01/2020', style: 'tableContent' },
              { text: '12h - 14h', style: 'tableContent' },
              { text: '24 avenue du test', style: 'tableContent' },
            ],
          ],
          height: 24,
          widths: ['auto', '*', '*'],
        },
        layout: { vLineWidth: () => 0, hLineWidth: () => 1, hLineColor: () => '#E2ECF0' },
        marginTop: 24,
      },
      { text: 'Il reste 1 créneau(x) à planifier.', style: 'notes' },
    ];
    const programInfo = {
      columns: [
        { image: 'src/data/pdf/tmp/doct-explication.png', width: 64, style: 'img' },
        [{ text: 'Programme de la formation', style: 'infoTitle' }, { text: 'on va apprendre', style: 'infoContent' }],
      ],
      marginTop: 24,
      columnGap: 12,
    };
    const trainerAndContactInfo = {
      columns: [
        {
          columns: [
            { image: 'src/data/pdf/tmp/doct-explication.png', width: 64, style: 'img' },
            [
              { text: 'Intervenant(e)', style: 'infoTitle' },
              { text: 'test OK', style: 'infoSubTitle' },
              { text: 'Voici ma bio', style: 'infoContent' },
            ],
          ],
          width: 'auto',
        },
        {
          columns: [
            { image: 'src/data/pdf/tmp/aux-perplexite.png', width: 64, style: 'img' },
            [
              { text: 'Votre contact pour la formation', style: 'infoTitle' },
              { text: '09 87 65 43 21', style: 'infoSubTitle' },
              { text: 'test@test.fr', style: 'infoSubTitle' },
            ],
          ],
          width: 'auto',
        },
      ],
      marginTop: 24,
      columnGap: 12,
    };
    const pdf = {
      content: [header, table, programInfo, trainerAndContactInfo].flat(),
      defaultStyle: { font: 'SourceSans', fontSize: 10 },
      styles: {
        title: { fontSize: 20, bold: true, color: '#1D7C8F', marginLeft: 24 },
        surtitle: { fontSize: 12, bold: true, marginTop: 24, marginLeft: 24 },
        tableHeader: { fontSize: 12, bold: true, alignment: 'center', marginTop: 4, marginBottom: 4 },
        tableContent: { fontSize: 12, alignment: 'center', marginTop: 4, marginBottom: 4 },
        notes: { italics: true, marginTop: 4 },
        infoTitle: { fontSize: 14, bold: true },
        infoSubTitle: { fontSize: 12 },
        infoContent: { italics: true },
      },
    };
    expect(JSON.stringify(result)).toEqual(JSON.stringify(pdf));

    const imageList = [
      { url: 'https://storage.googleapis.com/compani-main/aux-pouce.png', name: 'aux-pouce.png' },
      { url: 'https://storage.googleapis.com/compani-main/doct-explication.png', name: 'doct-explication.png' },
      { url: 'https://storage.googleapis.com/compani-main/doct-quizz.png', name: 'doct-quizz.png' },
      { url: 'https://storage.googleapis.com/compani-main/aux-perplexite.png', name: 'aux-perplexite.png' },
    ];
    sinon.assert.calledOnceWithExactly(downloadImages, imageList);
  });

  it('it should format and return pdf content with less infos', async () => {
    const paths = [
      'src/data/pdf/tmp/aux-pouce.png',
      'src/data/pdf/tmp/doct-explication.png',
      'src/data/pdf/tmp/doct-explication.png',
      'src/data/pdf/tmp/aux-perplexite.png',
    ];
    downloadImages.returns(paths);

    const data = {
      subProgram: { program: { name: 'test' } },
      slots: [
        { date: '23/12/2020', hours: '12h - 14h', address: '' },
        { date: '14/01/2020', hours: '12h - 14h', address: '24 avenue du test' },
      ],
      contact: { formattedPhone: '09 87 65 43 21' },
    };

    const result = await CourseConvocation.getPdfContent(data);

    const header = [
      {
        columns: [
          { image: 'src/data/pdf/tmp/aux-pouce.png', width: 64, style: 'img' },
          [
            { text: 'Vous êtes convoqué(e) à la formation', style: 'surtitle' },
            { text: 'test', style: 'title' },
            { canvas: [{ type: 'line', x1: 20, y1: 10, x2: 450, y2: 10, lineWidth: 1.5, lineColor: '#E2ECF0' }] },
          ],
        ],
      },
    ];
    const table = [
      {
        table: {
          body: [
            [
              { text: 'Dates', style: 'tableHeader' },
              { text: 'Heures', style: 'tableHeader' },
              { text: 'Lieux', style: 'tableHeader' },
            ],
            [
              { text: '23/12/2020', style: 'tableContent' },
              { text: '12h - 14h', style: 'tableContent' },
              { text: '', style: 'tableContent' },
            ],
            [
              { text: '14/01/2020', style: 'tableContent' },
              { text: '12h - 14h', style: 'tableContent' },
              { text: '24 avenue du test', style: 'tableContent' },
            ],
          ],
          height: 24,
          widths: ['auto', '*', '*'],
        },
        layout: { vLineWidth: () => 0, hLineWidth: () => 1, hLineColor: () => '#E2ECF0' },
        marginTop: 24,
      },
    ];
    const programInfo = {
      columns: [
        { image: 'src/data/pdf/tmp/doct-explication.png', width: 64, style: 'img' },
        [{ text: 'Programme de la formation', style: 'infoTitle' }, { text: '', style: 'infoContent' }],
      ],
      marginTop: 24,
      columnGap: 12,
    };
    const trainerAndContactInfo = {
      columns: [
        {
          columns: [
            { image: 'src/data/pdf/tmp/doct-explication.png', width: 64, style: 'img' },
            [
              { text: 'Intervenant(e)', style: 'infoTitle' },
              { text: '', style: 'infoSubTitle' },
              { text: '', style: 'infoContent' },
            ],
          ],
          width: 'auto',
        },
        {
          columns: [
            { image: 'src/data/pdf/tmp/aux-perplexite.png', width: 64, style: 'img' },
            [
              { text: 'Votre contact pour la formation', style: 'infoTitle' },
              { text: '09 87 65 43 21', style: 'infoSubTitle' },
              { text: '', style: 'infoSubTitle' },
            ],
          ],
          width: 'auto',
        },
      ],
      marginTop: 24,
      columnGap: 12,
    };
    const pdf = {
      content: [header, table, programInfo, trainerAndContactInfo].flat(),
      defaultStyle: { font: 'SourceSans', fontSize: 10 },
      styles: {
        title: { fontSize: 20, bold: true, color: '#1D7C8F', marginLeft: 24 },
        surtitle: { fontSize: 12, bold: true, marginTop: 24, marginLeft: 24 },
        tableHeader: { fontSize: 12, bold: true, alignment: 'center', marginTop: 4, marginBottom: 4 },
        tableContent: { fontSize: 12, alignment: 'center', marginTop: 4, marginBottom: 4 },
        notes: { italics: true, marginTop: 4 },
        infoTitle: { fontSize: 14, bold: true },
        infoSubTitle: { fontSize: 12 },
        infoContent: { italics: true },
      },
    };
    expect(JSON.stringify(result)).toEqual(JSON.stringify(pdf));

    const imageList = [
      { url: 'https://storage.googleapis.com/compani-main/aux-pouce.png', name: 'aux-pouce.png' },
      { url: 'https://storage.googleapis.com/compani-main/doct-explication.png', name: 'doct-explication.png' },
      { url: 'https://storage.googleapis.com/compani-main/doct-quizz.png', name: 'doct-quizz.png' },
      { url: 'https://storage.googleapis.com/compani-main/aux-perplexite.png', name: 'aux-perplexite.png' },
    ];
    sinon.assert.calledOnceWithExactly(downloadImages, imageList);
  });
});
