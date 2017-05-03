import loading from './loadingIndicator';
import sort from  './sort';
import filter from './filters'
import searchInput from './search'

export default function ({el, table}) {
  // boot
  [...el.querySelectorAll('[data-st-sort]')].forEach(el => sort({el, table}));
  [...el.querySelectorAll('[data-st-loading-indicator]')].forEach(el => loading({el, table}));
  [...el.querySelectorAll('[data-st-search]')].forEach(el => searchInput({el, table}));
  [...el.querySelectorAll('[data-st-filter]')].forEach(el => filter({el, table}));

  //extension
  const tableDisplayChange = table.onDisplayChange;
  return Object.assign(table, {
    onDisplayChange: (listener) => {
      tableDisplayChange(listener);
      table.exec();
    }
  });
};