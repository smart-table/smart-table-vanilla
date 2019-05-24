(function (global, factory) {
  typeof exports === 'object' && typeof module !== 'undefined' ? factory(exports, require('smart-table-core')) :
  typeof define === 'function' && define.amd ? define(['exports', 'smart-table-core'], factory) :
  (global = global || self, factory(global['smart-table-vanilla'] = {}, global.smartTableCore));
}(this, function (exports, smartTableCore) { 'use strict';

  function loading ({table, el}) {
    const component = smartTableCore.workingIndicatorDirective({table});
    component.onExecutionChange(function ({working}) {
      el.classList.remove('st-working');
      if (working === true) {
        el.classList.add('st-working');
      }
    });
    return component;
  }

  function sort ({el, table, conf = {}}) {
    const pointer = conf.pointer || el.getAttribute('data-st-sort');
    const cycle = conf.cycle || el.hasAttribute('data-st-sort-cycle');
    const component = smartTableCore.sortDirective({pointer, table, cycle});
    component.onSortToggle(({pointer:currentPointer, direction}) => {
      el.classList.remove('st-sort-asc', 'st-sort-desc');
      if (pointer === currentPointer && direction !== 'none') {
        const className = direction === 'asc' ? 'st-sort-asc' : 'st-sort-desc';
        el.classList.add(className);
      }
    });
    const eventListener = ev => component.toggle();
    el.addEventListener('click', eventListener);
    return component;
  }

  function debounce (fn, delay) {
    let timeoutId;
    return (ev) => {
      if (timeoutId) {
        window.clearTimeout(timeoutId);
      }
      timeoutId = window.setTimeout(function () {
        fn(ev);
      }, delay);
    };
  }

  function filterInput ({table, el, delay = 400, conf = {}}) {
    const pointer = conf.pointer || el.getAttribute('data-st-filter');
    const operator = conf.operator || el.getAttribute('data-st-filter-operator') || 'includes';
    const elType = el.hasAttribute('type') ? el.getAttribute('type') : 'string';
    let type = conf.type || el.getAttribute('data-st-filter-type');
    if (!type) {
      type = ['date', 'number'].includes(elType) ? elType : 'string';
    }
    const component = smartTableCore.filterDirective({table, pointer, type, operator});
    const eventListener = debounce(ev => component.filter(el.value), delay);
    el.addEventListener('input', eventListener);
    if (el.tagName === 'SELECT') {
      el.addEventListener('change', eventListener);
    }
    return component;
  }

  function searchInput ({el, table, delay = 400, conf = {}}) {
    const scope = conf.scope || (el.getAttribute('data-st-search') || '').split(',').map(s => s.trim());
    const component = smartTableCore.searchDirective({table, scope});
    const eventListener = debounce(ev => {
      component.search(el.value);
    }, delay);
    el.addEventListener('input', eventListener);
  }

  function table ({el, table}) {
    // boot
    [...el.querySelectorAll('[data-st-sort]')].forEach(el => sort({el, table}));
    [...el.querySelectorAll('[data-st-loading-indicator]')].forEach(el => loading({el, table}));
    [...el.querySelectorAll('[data-st-search]')].forEach(el => searchInput({el, table}));
    [...el.querySelectorAll('[data-st-filter]')].forEach(el => filterInput({el, table}));

    //extension
    const tableDisplayChange = table.onDisplayChange;
    return Object.assign(table, {
      onDisplayChange: (listener) => {
        tableDisplayChange(listener);
        table.exec();
      }
    });
  }

  exports.debounce = debounce;
  exports.filter = filterInput;
  exports.loadindIndicator = loading;
  exports.search = searchInput;
  exports.sort = sort;
  exports.table = table;

  Object.defineProperty(exports, '__esModule', { value: true });

}));
//# sourceMappingURL=smart-table-vanilla.js.map
