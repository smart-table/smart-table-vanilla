import {sort} from 'smart-table-core';

export default function ({el, table}) {
  const path = el.getAttribute('data-st-sort');
  const component = sort({pointer: path, table, cycle: el.getAttribute('data-st-sort-cycle') !== null});
  component.onSortToggle(({pointer, direction}) => {
    el.classList.remove('st-sort-asc', 'st-sort-desc');
    if (pointer === path && direction !== 'none') {
      const className = direction === 'asc' ? 'st-sort-asc' : 'st-sort-desc';
      el.classList.add(className);
    }
  });

  const eventListener = ev => component.toggle();
  el.addEventListener('click', eventListener);
  return Object.assign(component, {
    clean(){
      el.removeEventListener('click', eventListener);
      component.off();
    }
  });
}