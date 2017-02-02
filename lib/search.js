import {search} from 'smart-table-core';
import {debounce} from './helpers';

export default function ({el, table, delay = 400}) {
  const component = search({table});

  const eventListener = debounce(ev => {
    component.search(el.value);
  }, delay);
  el.addEventListener('input', eventListener);
  return Object.assign(component, {
    clean(){
      el.removeEventListener('input',eventListener);
      component.off();
    }
  });
};
