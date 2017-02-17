import table from '../index';
import row from './components/row';
import summary from './components/summary';
import rangeSizeInput from './components/rangeSizeInput';
import crud from 'smart-table-crud';
import pagination from './components/pagination';


const el = document.getElementById('table-container');
const tbody = el.querySelector('tbody');
const summaryEl = el.querySelector('[data-st-summary]');

const t = table({el, data}, crud);

t.onDisplayChange(displayed => {
  tbody.innerHTML = '';
  for (let r of displayed) {
    const newChild = row((r.value), r.index, t);
    tbody.appendChild(newChild);
  }
});

document.querySelector('button').addEventListener('click', () => {
  t.insert({
    id: 66666,
    name: {first: 'Laurent', last: 'Renard'},
    size: 176,
    birthDate: new Date(1987, 4, 21),
    gender: 'male'
  });
});

summary({table: t, el: summaryEl});
rangeSizeInput({
  table: t,
  minEl: document.getElementById('min-size'),
  maxEl: document.getElementById('max-size')
});

const paginationContainer = el.querySelector('[data-st-pagination]');
paginationContainer.appendChild(pagination({table: t}));

t.exec();