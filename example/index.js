import table from '../index';
import row from './components/row';
import summary from './components/summary';
import rangeSizeInput from './components/rangeSizeInput';
import pagination from './components/pagination';


const el = document.getElementById('table-container');
const tbody = el.querySelector('tbody');
const summaryEl = el.querySelector('[data-st-summary]');

const t = table({el, data, tableState: {sort: {}, filter: {}, slice: {page: 1, size: 20}}});

t.onDisplayChange(displayed => {
  tbody.innerHTML = '';
  for (let r of displayed) {
    const newChild = row((r.value), r.index, t);
    tbody.appendChild(newChild);
  }
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