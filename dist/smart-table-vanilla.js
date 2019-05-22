(function (global, factory) {
	typeof exports === 'object' && typeof module !== 'undefined' ? factory(exports) :
	typeof define === 'function' && define.amd ? define(['exports'], factory) :
	(factory((global['smart-table-vanilla'] = global['smart-table-vanilla'] || {})));
}(this, (function (exports) { 'use strict';

const proxyListener = (eventMap) => ({ emitter }) => {
    const eventListeners = {};
    const proxy = {
        off(ev) {
            if (!ev) {
                Object.keys(eventListeners).forEach(eventName => proxy.off(eventName));
            }
            if (eventListeners[ev]) {
                emitter.off(ev, ...eventListeners[ev]);
            }
            return proxy;
        }
    };
    for (const ev of Object.keys(eventMap)) {
        const method = eventMap[ev];
        eventListeners[ev] = [];
        proxy[method] = function (...listeners) {
            eventListeners[ev] = eventListeners[ev].concat(listeners);
            emitter.on(ev, ...listeners);
            return proxy;
        };
    }
    return proxy;
};

var Type;
(function (Type) {
    Type["BOOLEAN"] = "boolean";
    Type["NUMBER"] = "number";
    Type["DATE"] = "date";
    Type["STRING"] = "string";
})(Type || (Type = {}));
var FilterOperator;
(function (FilterOperator) {
    FilterOperator["INCLUDES"] = "includes";
    FilterOperator["IS"] = "is";
    FilterOperator["IS_NOT"] = "isNot";
    FilterOperator["LOWER_THAN"] = "lt";
    FilterOperator["GREATER_THAN"] = "gt";
    FilterOperator["GREATER_THAN_OR_EQUAL"] = "gte";
    FilterOperator["LOWER_THAN_OR_EQUAL"] = "lte";
    FilterOperator["EQUALS"] = "equals";
    FilterOperator["NOT_EQUALS"] = "notEquals";
    FilterOperator["ANY_OF"] = "anyOf";
})(FilterOperator || (FilterOperator = {}));

var SortDirection;
(function (SortDirection) {
    SortDirection["ASC"] = "asc";
    SortDirection["DESC"] = "desc";
    SortDirection["NONE"] = "none";
})(SortDirection || (SortDirection = {}));

var SmartTableEvents;
(function (SmartTableEvents) {
    SmartTableEvents["TOGGLE_SORT"] = "TOGGLE_SORT";
    SmartTableEvents["DISPLAY_CHANGED"] = "DISPLAY_CHANGED";
    SmartTableEvents["PAGE_CHANGED"] = "CHANGE_PAGE";
    SmartTableEvents["EXEC_CHANGED"] = "EXEC_CHANGED";
    SmartTableEvents["FILTER_CHANGED"] = "FILTER_CHANGED";
    SmartTableEvents["SUMMARY_CHANGED"] = "SUMMARY_CHANGED";
    SmartTableEvents["SEARCH_CHANGED"] = "SEARCH_CHANGED";
    SmartTableEvents["EXEC_ERROR"] = "EXEC_ERROR";
})(SmartTableEvents || (SmartTableEvents = {}));
const filterListener = proxyListener({ ["FILTER_CHANGED" /* FILTER_CHANGED */]: 'onFilterChange' });
// todo expose and re-export from smart-table-filter
var FilterType;
(function (FilterType) {
    FilterType["BOOLEAN"] = "boolean";
    FilterType["NUMBER"] = "number";
    FilterType["DATE"] = "date";
    FilterType["STRING"] = "string";
})(FilterType || (FilterType = {}));
const filterDirective = ({ table, pointer: pointer$$1, operator = "includes" /* INCLUDES */, type = "string" /* STRING */ }) => {
    const proxy = filterListener({ emitter: table });
    return Object.assign({
        filter(input) {
            const filterConf = {
                [pointer$$1]: [
                    {
                        value: input,
                        operator,
                        type
                    }
                ]
            };
            return table.filter(filterConf);
        },
        state() {
            return table.getTableState().filter;
        }
    }, proxy);
};

const searchListener = proxyListener({ ["SEARCH_CHANGED" /* SEARCH_CHANGED */]: 'onSearchChange' });
const searchDirective = ({ table, scope = [] }) => {
    const proxy = searchListener({ emitter: table });
    return Object.assign(proxy, {
        search(input, opts = {}) {
            return table.search(Object.assign({}, { value: input, scope }, opts));
        },
        state() {
            return table.getTableState().search;
        }
    }, proxy);
};

const debounce = (fn, time) => {
    let timer = null;
    return (...args) => {
        if (timer !== null) {
            clearTimeout(timer);
        }
        timer = setTimeout(() => fn(...args), time);
    };
};
const sortListeners = proxyListener({ ["TOGGLE_SORT" /* TOGGLE_SORT */]: 'onSortToggle' });
const directions = ["asc" /* ASC */, "desc" /* DESC */];
const sortDirective = ({ pointer: pointer$$1, table, cycle = false, debounceTime = 0 }) => {
    const cycleDirections = cycle === true ? ["none" /* NONE */].concat(directions) : [...directions].reverse();
    const commit = debounce(table.sort, debounceTime);
    let hit = 0;
    const proxy = sortListeners({ emitter: table });
    const directive = Object.assign({
        toggle() {
            hit++;
            const direction = cycleDirections[hit % cycleDirections.length];
            return commit({ pointer: pointer$$1, direction });
        },
        state() {
            return table.getTableState().sort;
        }
    }, proxy);
    directive.onSortToggle(({ pointer: p }) => {
        hit = pointer$$1 !== p ? 0 : hit;
    });
    const { pointer: statePointer, direction = "asc" /* ASC */ } = directive.state();
    hit = statePointer === pointer$$1 ? (direction === "asc" /* ASC */ ? 1 : 2) : 0;
    return directive;
};

const executionListener = proxyListener({ ["EXEC_CHANGED" /* EXEC_CHANGED */]: 'onExecutionChange' });
const workingIndicatorDirective = ({ table }) => executionListener({ emitter: table });

var loading = function ({table, el}) {
  const component = workingIndicatorDirective({table});
  component.onExecutionChange(function ({working}) {
    el.classList.remove('st-working');
    if (working === true) {
      el.classList.add('st-working');
    }
  });
  return component;
};

var sort = function ({el, table, conf = {}}) {
  const pointer = conf.pointer || el.getAttribute('data-st-sort');
  const cycle = conf.cycle || el.hasAttribute('data-st-sort-cycle');
  const component = sortDirective({pointer, table, cycle});
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

function debounce$1 (fn, delay) {
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
  const component = filterDirective({table, pointer, type, operator});
  const eventListener = debounce$1(ev => component.filter(el.value), delay);
  el.addEventListener('input', eventListener);
  if (el.tagName === 'SELECT') {
    el.addEventListener('change', eventListener);
  }
  return component;
}

var searchInput = function ({el, table, delay = 400, conf = {}}) {
  const scope = conf.scope || (el.getAttribute('data-st-search') || '').split(',').map(s => s.trim());
  const component = searchDirective({table, scope});
  const eventListener = debounce$1(ev => {
    component.search(el.value);
  }, delay);
  el.addEventListener('input', eventListener);
};

var table = function ({el, table}) {
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
};

exports.table = table;
exports.filter = filterInput;
exports.loadindIndicator = loading;
exports.search = searchInput;
exports.sort = sort;
exports.debounce = debounce$1;

Object.defineProperty(exports, '__esModule', { value: true });

})));
//# sourceMappingURL=smart-table-vanilla.js.map
