import {filter} from 'smart-table-core';
import {debounce} from './helpers'


function input (selector, type = 'string') {
  return function ({el, table, delay = 400}) {
    const pointer = el.getAttribute(selector);
    const operator = el.getAttribute('data-st-filter-operator') || 'includes';
    const component = filter({table, pointer, type, operator});

    let eventListener = debounce(ev => component.filter(el.value)
      , delay);

    el.addEventListener('input', eventListener);

    return Object.assign(component, {
      clean(){
        el.removeEventListener('input',eventListener);
        component.off();
      }
    });
  }
}

export const textInput = input('data-st-text-filter');
export const numberInput = input('data-st-number-filter', 'number');
export const dateInput = input('data-st-date-filter', 'date');