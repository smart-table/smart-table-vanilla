import {searchDirective} from 'smart-table-core';
import {debounce} from './helpers';

export default function ({el, table, delay = 400, conf = {}}) {
  const scope = conf.scope || (el.getAttribute('data-st-search') || '').split(',').map(s => s.trim());
  const component = searchDirective({table, scope});
  const eventListener = debounce(ev => {
    component.search(el.value);
  }, delay);
  el.addEventListener('input', eventListener);
};