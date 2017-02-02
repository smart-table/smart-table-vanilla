import table from '../index';
import row from './components/row';
import summary from './components/summary';
import rangeSizeInput from './components/rangeSizeInput';

const data = [{
  name: 'Renard',
  firstName: 'Laurent',
  gender: 'male',
  birthDate: new Date(1987, 4, 21),
  size: 176
}, {
  name: 'Faivre',
  firstName: 'Blandine',
  gender: 'female',
  birthDate: new Date(1987, 3, 25),
  size: 158
}, {
  name: 'Frere',
  firstName: 'Francoise',
  gender: 'Female',
  birthDate: new Date(1955, 7, 27),
  size: 165
}, {
  name: 'Nicaise',
  firstName: 'Fernande',
  gender: 'Female',
  birthDate: new Date(1930, 7, 29),
  size: 163
}];

const el = document.getElementById('table-container');
const tbody = el.querySelector('tbody');

const summaryEl = el.querySelector('[data-st-summary]');

const t = table({el, data});

t.onDisplayChange(displayed => {
  tbody.innerHTML = '';
  for (let r of displayed) {
    tbody.appendChild(row((r.value)));
  }
});


summary({table: t, el: summaryEl});
rangeSizeInput({
  table:t,
  minEl:document.getElementById('min-size'),
  maxEl:document.getElementById('max-size')
});


t.exec();

// setTimeout(t.clean,200);

