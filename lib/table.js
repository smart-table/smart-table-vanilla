import tableDirective from 'smart-table-core';
import loading from './loadingIndicator';
import sort from  './sort';
import {textInput, dateInput, numberInput} from './filters'
import searchInput from './search'

export default function ({el, data}, ...tableDirectives) {
  const table = tableDirective({
    data,
    tableState: {sort: {}, filter: {}, slice: {page: 1, size: 25}}
  }, ...tableDirectives);

  const sortableHeader = [...el.querySelectorAll('[data-st-sort]')].map(el => sort({el, table}));
  const loadingIndicator = [...el.querySelectorAll('[data-st-loading-indicator]')].map(el => loading({el, table}));
  const textFilters = [...el.querySelectorAll('[data-st-text-filter]')].map(el => textInput({el, table}));
  const dateFilters = [...el.querySelectorAll('[data-st-date-filter]')].map(el => dateInput({el, table}));
  const numberFilters = [...el.querySelectorAll('[data-st-number-filter]')].map(el => numberInput({el, table}));
  const searchFilters = [...el.querySelectorAll('[data-st-search]')].map(el => searchInput({el, table}));

  return Object.assign(table, {
    clean(){
      [
        ...sortableHeader,
        ...loadingIndicator,
        ...textFilters,
        ...dateFilters,
        ...numberFilters,
        ...searchFilters
      ].forEach(c => c.clean());
      table.off('DISPLAY_CHANGED');
    }
  });
}