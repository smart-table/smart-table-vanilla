(function (global, factory) {
	typeof exports === 'object' && typeof module !== 'undefined' ? factory(exports) :
	typeof define === 'function' && define.amd ? define(['exports'], factory) :
	(factory((global['smart-table-vanilla'] = global['smart-table-vanilla'] || {})));
}(this, (function (exports) { 'use strict';

function proxyListener (eventMap) {
  return function ({emitter}) {

    const proxy = {};
    let eventListeners = {};

    for (let ev of Object.keys(eventMap)) {
      const method = eventMap[ev];
      eventListeners[ev] = [];
      proxy[method] = function (...listeners) {
        eventListeners[ev] = eventListeners[ev].concat(listeners);
        emitter.on(ev, ...listeners);
        return proxy;
      };
    }

    return Object.assign(proxy, {
      off(ev){
        if (!ev) {
          Object.keys(eventListeners).forEach(eventName => proxy.off(eventName));
        }
        if (eventListeners[ev]) {
          emitter.off(ev, ...eventListeners[ev]);
        }
        return proxy;
      }
    });
  }
}

const TOGGLE_SORT = 'TOGGLE_SORT';


const EXEC_CHANGED = 'EXEC_CHANGED';
const FILTER_CHANGED = 'FILTER_CHANGED';

const SEARCH_CHANGED = 'SEARCH_CHANGED';

const filterListener = proxyListener({[FILTER_CHANGED]: 'onFilterChange'});

var filterDirective = function ({table, pointer, operator = 'includes', type = 'string'}) {
  return Object.assign({
      filter(input){
        const filterConf = {
          [pointer]: [
            {
              value: input,
              operator,
              type
            }
          ]

        };
        return table.filter(filterConf);
      }
    },
    filterListener({emitter: table}));
};

const searchListener = proxyListener({[SEARCH_CHANGED]: 'onSearchChange'});

var searchDirective = function ({table, scope = []}) {
  return Object.assign(
    searchListener({emitter: table}), {
      search(input){
        return table.search({value: input, scope});
      }
    });
};

const sortListeners = proxyListener({[TOGGLE_SORT]: 'onSortToggle'});
const directions = ['asc', 'desc'];

var sortDirective = function ({pointer, table, cycle = false}) {

  const cycleDirections = cycle === true ? ['none'].concat(directions) : [...directions].reverse();

  let hit = 0;

  const directive = Object.assign({
    toggle(){
      hit++;
      const direction = cycleDirections[hit % cycleDirections.length];
      return table.sort({pointer, direction});
    }

  }, sortListeners({emitter: table}));

  directive.onSortToggle(({pointer:p}) => {
    if (pointer !== p) {
      hit = 0;
    }
  });

  return directive;
};

const executionListener$1 = proxyListener({[EXEC_CHANGED]: 'onExecutionChange'});

var workingIndicatorDirective = function ({table}) {
  return executionListener$1({emitter: table});
};

const search = searchDirective;


const sort = sortDirective;
const filter = filterDirective;
const workingIndicator = workingIndicatorDirective;

var loading = function ({table: table$$1, el}) {
  const component = workingIndicator({table: table$$1});
  component.onExecutionChange(function ({working}) {
    el.classList.remove('st-working');
    if (working === true) {
      el.classList.add('st-working');
    }
  });
  return component;
};

var sort$1 = function ({el, table: table$$1, conf = {}}) {
  const pointer = conf.pointer || el.getAttribute('data-st-sort');
  const cycle = conf.cycle || el.hasAttribute('data-st-sort-cycle');
  const component = sort({pointer, table: table$$1, cycle});
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
};

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

function filterInput ({table: table$$1, el, delay = 400, conf = {}}) {
  const pointer = conf.pointer || el.getAttribute('data-st-filter');
  const operator = conf.operator || el.getAttribute('data-st-filter-operator') || 'includes';
  const elType = el.hasAttribute('type') ? el.getAttribute('type') : 'string';
  let type = conf.type || el.getAttribute('data-st-filter-type');
  if (!type) {
    type = ['date', 'number'].includes(elType) ? elType : 'string';
  }
  const component = filter({table: table$$1, pointer, type, operator});
  const eventListener = debounce(ev => component.filter(el.value), delay);
  el.addEventListener('input', eventListener);
  if (el.tagName === 'SELECT') {
    el.addEventListener('change', eventListener);
  }
  return component;
}

var searchInput = function ({el, table: table$$1, delay = 400, conf = {}}) {
  const scope = conf.scope || (el.getAttribute('data-st-search') || '').split(',').map(s => s.trim());
  const component = search({table: table$$1, scope});
  const eventListener = debounce(ev => {
    component.search(el.value);
  }, delay);
  el.addEventListener('input', eventListener);
};

var table = function ({el, table}) {
  // boot
  [...el.querySelectorAll('[data-st-sort]')].forEach(el => sort$1({el, table}));
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
};

exports.table = table;
exports.filter = filterInput;
exports.loadindIndicator = loading;
exports.search = searchInput;
exports.sort = sort$1;
exports.debounce = debounce;

Object.defineProperty(exports, '__esModule', { value: true });

})));
//# sourceMappingURL=smart-table-vanilla.js.map
