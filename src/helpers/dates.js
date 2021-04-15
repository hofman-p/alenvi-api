const moment = require('moment');

exports.isBefore = (date1, date2, ref = '') => {
  let formattedDate1 = date1;
  let formattedDate2 = date2;
  if (ref === 'd') {
    formattedDate1 = moment(date1).startOf('d').toDate();
    formattedDate2 = moment(date2).startOf('d').toDate();
  }

  return new Date(formattedDate1) < new Date(formattedDate2);
};

exports.isSameOrBefore = (date1, date2, ref = '') => {
  let formattedDate1 = date1;
  let formattedDate2 = date2;
  if (ref === 'd') {
    formattedDate1 = moment(date1).startOf('d').toDate();
    formattedDate2 = moment(date2).startOf('d').toDate();
  }

  return new Date(formattedDate1) <= new Date(formattedDate2);
};

exports.isAfter = (date1, date2, ref = '') => {
  let formattedDate1 = date1;
  let formattedDate2 = date2;
  if (ref === 'd') {
    formattedDate1 = moment(date1).startOf('d').toDate();
    formattedDate2 = moment(date2).startOf('d').toDate();
  }

  return new Date(formattedDate1) > new Date(formattedDate2);
};

exports.isSameOrAfter = (date1, date2, ref = '') => {
  let formattedDate1 = date1;
  let formattedDate2 = date2;
  if (ref === 'd') {
    formattedDate1 = moment(date1).startOf('d').toDate();
    formattedDate2 = moment(date2).startOf('d').toDate();
  }

  return new Date(formattedDate1) >= new Date(formattedDate2);
};

exports.diff = (date1, date2) => new Date(date1) - new Date(date2);

exports.dayDiff = (date1, date2) => {
  const milliSecondsDiff = new Date(date1) - new Date(date2);

  const diff = milliSecondsDiff > 0
    ? Math.floor(milliSecondsDiff / 1000 / 60 / 60 / 24)
    : Math.ceil(milliSecondsDiff / 1000 / 60 / 60 / 24);

  return diff || 0;
};

exports.addDays = (date, days) => {
  const newDate = new Date(date);

  return new Date(newDate.setDate(newDate.getDate() + days));
};

const DATE_FORMATS = {
  D: { day: 'numeric' },
  DD: { day: '2-digit' },
  MM: { month: '2-digit' },
  MMM: { month: 'short' },
  MMMM: { month: 'long' },
  YY: { year: '2-digit' },
  YYYY: { year: 'numeric' },
  h: { hour: 'numeric' },
  hh: { hour: '2-digit' },
  m: { minute: 'numeric' },
  mm: { minute: '2-digit' },
  s: { second: 'numeric' },
  ss: { second: '2-digit' },
};

exports.toLocalISOString = (date) => {
  if (!date) return null;

  const dayOfMonth = new Date(date).getDate() < 10 ? `0${new Date(date).getDate()}` : new Date(date).getDate();
  const month = new Date(date).getMonth() + 1;
  const formattedMonth = month < 10 ? `0${month}` : month;
  const hours = new Date(date).getHours() < 10 ? `0${new Date(date).getHours()}` : new Date(date).getHours();
  const minutes = new Date(date).getMinutes() < 10 ? `0${new Date(date).getMinutes()}` : new Date(date).getMinutes();
  const seconds = new Date(date).getSeconds() < 10 ? `0${new Date(date).getSeconds()}` : new Date(date).getSeconds();

  return `${date.getFullYear()}-${formattedMonth}-${dayOfMonth}T${hours}:${minutes}:${seconds}`;
};

exports.format = (date, format = '') => {
  if (!date) return null;

  const options = format.split(' ').map(f => DATE_FORMATS[f]);

  return new Date(date).toLocaleDateString('fr-FR', { timeZone: 'Europe/Paris', ...Object.assign({}, ...options) });
};

exports.formatDateAndTime = (date, format = '') => {
  if (!date) return null;
  const options = format.split(' ').map(f => DATE_FORMATS[f]);

  return new Date(date).toLocaleString('fr-FR', { timeZone: 'Europe/Paris', ...Object.assign({}, ...options) })
    .replace('à ', '');
};

exports.descendingSort = key => (a, b) => new Date(b[key]) - new Date(a[key]);
