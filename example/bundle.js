(function () {
'use strict';

function swap (f) {
  return (a, b) => f(b, a);
}

function compose (first, ...fns) {
  return (...args) => fns.reduce((previous, current) => current(previous), first(...args));
}

function curry (fn, arityLeft) {
  const arity = arityLeft || fn.length;
  return (...args) => {
    if (arity === args.length) {
      return fn(...args);
    } else {
      const func = (...moreArgs) => fn(...args, ...moreArgs);
      return curry(func, arity - args.length);
    }
  };
}

function apply (fn) {
  return (...args) => fn(...args);
}

function tap (fn) {
  return arg => {
    fn(arg);
    return arg;
  }
}

function pointer (path) {

  const parts = path.split('.');

  function partial (obj = {}, parts = []) {
    const p = parts.shift();
    const current = obj[p];
    return (current === undefined || parts.length === 0) ?
      current : partial(current, parts);
  }

  function set (target, newTree) {
    let current = target;
    const [leaf, ...intermediate] = parts.reverse();
    for (let key of intermediate.reverse()) {
      if (current[key] === undefined) {
        current[key] = {};
        current = current[key];
      }
    }
    current[leaf] = Object.assign(current[leaf] || {}, newTree);
    return target;
  }

  return {
    get(target){
      return partial(target, [...parts])
    },
    set
  }
}

function sortByProperty (prop) {
  const propGetter = pointer(prop).get;
  return (a, b) => {
    const aVal = propGetter(a);
    const bVal = propGetter(b);

    if (aVal === bVal) {
      return 0;
    }

    if (bVal === undefined) {
      return -1;
    }

    if (aVal === undefined) {
      return 1;
    }

    return aVal < bVal ? -1 : 1;
  }
}

function sortFactory ({pointer: pointer$$1, direction} = {}) {
  if (!pointer$$1 || direction === 'none') {
    return array => [...array];
  }

  const orderFunc = sortByProperty(pointer$$1);
  const compareFunc = direction === 'desc' ? swap(orderFunc) : orderFunc;

  return (array) => [...array].sort(compareFunc);
}

function typeExpression (type) {
  switch (type) {
    case 'boolean':
      return Boolean;
    case 'number':
      return Number;
    case 'date':
      return (val) => new Date(val);
    default:
      return compose(String, (val) => val.toLowerCase());
  }
}

const operators = {
  includes(value){
    return (input) => input.includes(value);
  },
  is(value){
    return (input) => Object.is(value, input);
  },
  isNot(value){
    return (input) => !Object.is(value, input);
  },
  lt(value){
    return (input) => input < value;
  },
  gt(value){
    return (input) => input > value;
  },
  lte(value){
    return (input) => input <= value;
  },
  gte(value){
    return (input) => input >= value;
  },
  equals(value){
    return (input) => value == input;
  },
  notEquals(value){
    return (input) => value != input;
  }
};

const every = fns => (...args) => fns.every(fn => fn(...args));

function predicate ({value = '', operator = 'includes', type = 'string'}) {
  const typeIt = typeExpression(type);
  const operateOnTyped = compose(typeIt, operators[operator]);
  const predicateFunc = operateOnTyped(value);
  return compose(typeIt, predicateFunc);
}

//avoid useless filter lookup (improve perf)
function normalizeClauses (conf) {
  const output = {};
  const validPath = Object.keys(conf).filter(path => Array.isArray(conf[path]));
  validPath.forEach(path => {
    const validClauses = conf[path].filter(c => c.value !== '');
    if (validClauses.length) {
      output[path] = validClauses;
    }
  });
  return output;
}

function filter$1 (filter) {
  const normalizedClauses = normalizeClauses(filter);
  const funcList = Object.keys(normalizedClauses).map(path => {
    const getter = pointer(path).get;
    const clauses = normalizedClauses[path].map(predicate);
    return compose(getter, every(clauses));
  });
  const filterPredicate = every(funcList);

  return (array) => array.filter(filterPredicate);
}

var search$1 = function (searchConf = {}) {
  const {value} = searchConf;
  return (array) => {
    return value ? array.filter(item => JSON.stringify(item).toLowerCase().includes(value)) : array
  };
};

function sliceFactory ({page = 1, size} = {}) {
  return function sliceFunction (array = []) {
    const actualSize = size || array.length;
    const offset = (page - 1) * actualSize;
    return array.slice(offset, offset + actualSize);
  };
}

const TOGGLE_SORT = 'TOGGLE_SORT';
const DISPLAY_CHANGED = 'DISPLAY_CHANGED';
const PAGE_CHANGED = 'CHANGE_PAGE';
const EXEC_CHANGED = 'EXEC_STARTED';
const FILTER_CHANGED = 'FILTER_CHANGED';
const SUMMARY_CHANGED = 'SUMMARY_CHANGED';
const SEARCH_CHANGED = 'SEARCH_CHANGED';
const EXEC_ERROR = 'EXEC_ERROR';

function emitter () {

  const listenersLists = {};

  return {
    on(event, ...listeners){
      listenersLists[event] = (listenersLists[event] || []).concat(listeners);
      return this;
    },
    dispatch(event, ...args){
      const listeners = listenersLists[event] || [];
      for (let listener of listeners) {
        listener(...args);
      }
      return this;
    },
    off(event, ...listeners){
      const list = listenersLists[event] || [];
      listenersLists[event] = listeners.length ? list.filter(listener => !listeners.includes(listener)) : [];
      return this;
    }
  }
}

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
        return this;
      };
    }

    return Object.assign(proxy, {
      off(ev){
        if (!ev) {
          Object.keys(eventListeners).forEach(eventName => this.off(eventName));
        }

        if (eventListeners[ev]) {
          emitter.off(ev, ...eventListeners[ev]);
        }

        return this;
      }
    });
  }
}

function curriedPointer (path) {
  const {get, set} = pointer(path);
  return {get, set: curry(set)};
}

var table$3 = function ({
  sortFactory,
  tableState,
  data,
  filterFactory,
  searchFactory
}) {
  const table = emitter();
  const sortPointer = curriedPointer('sort');
  const slicePointer = curriedPointer('slice');
  const filterPointer = curriedPointer('filter');
  const searchPointer = curriedPointer('search');

  const safeAssign = curry((base, extension) => Object.assign({}, base, extension));
  const dispatch = curry(table.dispatch.bind(table), 2);

  const createSummary = (filtered) => {
    dispatch(SUMMARY_CHANGED, {
      page: tableState.slice.page,
      size: tableState.slice.size,
      filteredCount: filtered.length
    });
  };

  const exec = ({processingDelay = 20} = {}) => {
    table.dispatch(EXEC_CHANGED, {working: true});
    setTimeout(function () {
      try {
        const filterFunc = filterFactory(filterPointer.get(tableState));
        const searchFunc = searchFactory(searchPointer.get(tableState));
        const sortFunc = sortFactory(sortPointer.get(tableState));
        const sliceFunc = sliceFactory(slicePointer.get(tableState));
        const execFunc = compose(filterFunc, searchFunc, tap(createSummary), sortFunc, sliceFunc);
        const displayed = execFunc(data);
        table.dispatch(DISPLAY_CHANGED, displayed.map(d => {
          return {index: data.indexOf(d), value: d};
        }));
      } catch (e) {
        table.dispatch(EXEC_ERROR, e);
      } finally {
        table.dispatch(EXEC_CHANGED, {working: false});
      }
    }, processingDelay);
  };

  const tableOperation = (pter, ev) => apply(compose(
    safeAssign(pter.get(tableState)),
    tap(dispatch(ev)),
    pter.set(tableState),
    () => table.exec()
  ));

  const api = {
    sort: tableOperation(sortPointer, TOGGLE_SORT),
    slice: tableOperation(slicePointer, PAGE_CHANGED),
    filter: tableOperation(filterPointer, FILTER_CHANGED),
    search: tableOperation(searchPointer, SEARCH_CHANGED),
    exec,
    eval(state = tableState){
      return Promise.resolve()
        .then(function () {
          const sortFunc = sortFactory(sortPointer.get(state));
          const searchFunc = searchFactory(searchPointer.get(state));
          const filterFunc = filterFactory(filterPointer.get(state));
          const sliceFunc = sliceFactory(slicePointer.get(state));
          const execFunc = compose(filterFunc, searchFunc, sortFunc, sliceFunc);
          return execFunc(data).map(d => {
            return {index: data.indexOf(d), value: d}
          });
        });
    },
    onDisplayChange(fn){
      table.on(DISPLAY_CHANGED, fn);
    }
  };

  return Object.assign(table, api);
};

var table$2 = function ({
  sortFactory: sortFactory$$1 = sortFactory,
  filterFactory = filter$1,
  searchFactory = search$1,
  tableState = {sort: {}, slice: {page: 1}, filter: {}, search: {}},
  data = []
}, ...tableDirectives) {
  return tableDirectives.reduce((accumulator, newdir) => {
    return Object.assign(accumulator, newdir({
      sortFactory: sortFactory$$1,
      filterFactory,
      searchFactory,
      tableState,
      data
    }));
  }, table$3({sortFactory: sortFactory$$1, filterFactory, tableState, data, searchFactory}));
};

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

var searchDirective = function ({table}) {
  return Object.assign(
    searchListener({emitter: table}),
    {
      search(input){
        return table.search({value: input});
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

const executionListener = proxyListener({[SUMMARY_CHANGED]: 'onSummaryChange'});

var summaryDirective$1 = function ({table}) {
  return executionListener({emitter: table});
};

const executionListener$1 = proxyListener({[EXEC_CHANGED]: 'onExecutionChange'});

var workingIndicatorDirective = function ({table}) {
  return executionListener$1({emitter: table});
};

const search = searchDirective;

const summary = summaryDirective$1;
const sort = sortDirective;
const filter = filterDirective;
const workingIndicator = workingIndicatorDirective;

var loading = function ({table, el}) {
  const component = workingIndicator({table});
  component.onExecutionChange(function ({working}) {
    el.classList.remove('st-working');
    if (working === true) {
      el.classList.add('st-working');
    }
  });

  return Object.assign(component, {clean: component.off});
};

var sort$1 = function ({el, table}) {
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
      el.removeEventListener('click',eventListener);
      component.off();
    }
  });
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

function input (selector, type = 'string') {
  return function ({el, table, delay = 400}) {
    const pointer = el.getAttribute(selector);
    const operator = el.getAttribute('data-st-filter-operator') || 'includes';
    const component = filter({table, pointer, type, operator});

    let eventListener = debounce$1(ev => component.filter(el.value)
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

const textInput$1 = input('data-st-text-filter');
const numberInput$1 = input('data-st-number-filter', 'number');
const dateInput$1 = input('data-st-date-filter', 'date');

var searchInput$1 = function ({el, table, delay = 400}) {
  const component = search({table});

  const eventListener = debounce$1(ev => {
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

var tableDirective$1 = function ({el, data}, ...tableDirectives) {
  const table = table$2({
    data,
    tableState: {sort: {}, filter: {}, slice: {page: 1, size: 25}}
  }, ...tableDirectives);

  const sortableHeader = [...el.querySelectorAll('[data-st-sort]')].map(el => sort$1({el, table}));
  const loadingIndicator = [...el.querySelectorAll('[data-st-loading-indicator]')].map(el => loading({el, table}));
  const textFilters = [...el.querySelectorAll('[data-st-text-filter]')].map(el => textInput$1({el, table}));
  const dateFilters = [...el.querySelectorAll('[data-st-date-filter]')].map(el => dateInput$1({el, table}));
  const numberFilters = [...el.querySelectorAll('[data-st-number-filter]')].map(el => numberInput$1({el, table}));
  const searchFilters = [...el.querySelectorAll('[data-st-search]')].map(el => searchInput$1({el, table}));

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
};

const debounce$$1 = debounce$1;

var row = function ({name, firstName, gender, birthDate, size}) {
  const tr = document.createElement('tr');
  tr.innerHTML = `<td>${name}</td><td>${firstName}</td><td>${gender}</td><td>${birthDate.toLocaleDateString()}</td><td>${size}</td>`;
  return tr;
};

function summaryComponent ({table, el}) {
  const dir = summary({table});
  dir.onSummaryChange(({page, size, filteredCount}) => {
    el.innerHTML = `showing items <strong>${(page - 1) * size + (filteredCount > 0 ? 1 : 0)}</strong> - <strong>${Math.min(filteredCount, page * size)}</strong> of <strong>${filteredCount}</strong> matching items`;
  });
  return dir;
}

function rangSizeInput ({minEl, maxEl, table: table$$1}) {

  let ltValue;
  let gtValue;

  const commit = () => {
    const clauses = [];
    if (ltValue) {
      clauses.push({value: ltValue, operator: 'lte', type: 'number'});
    }
    if (gtValue) {
      clauses.push({value: gtValue, operator: 'gte', type: 'number'});
    }
    table$$1.filter({
      size: clauses
    });
  };

  minEl.addEventListener('input', debounce$$1((ev) => {
    gtValue = minEl.value;
    commit();
  }, 400));

  maxEl.addEventListener('input', debounce$$1((ev) => {
    ltValue = maxEl.value;
    commit();
  }, 400));
}

const data = [{
  name: 'Renard',
  firstName: 'Laurent',
  gender: 'male',
  birthDate: new Date(1987, 4, 21),
  size: 176
}, {
  name: 'Faivre',
  firstName: 'Blandine',
  gender: 'female',
  birthDate: new Date(1987, 3, 25),
  size: 158
}, {
  name: 'Frere',
  firstName: 'Francoise',
  gender: 'Female',
  birthDate: new Date(1955, 7, 27),
  size: 165
}, {
  name: 'Nicaise',
  firstName: 'Fernande',
  gender: 'Female',
  birthDate: new Date(1930, 7, 29),
  size: 163
}];

const el = document.getElementById('table-container');
const tbody = el.querySelector('tbody');

const summaryEl = el.querySelector('[data-st-summary]');

const t = tableDirective$1({el, data});

t.onDisplayChange(displayed => {
  tbody.innerHTML = '';
  for (let r of displayed) {
    tbody.appendChild(row((r.value)));
  }
});


summaryComponent({table: t, el: summaryEl});
rangSizeInput({
  table:t,
  minEl:document.getElementById('min-size'),
  maxEl:document.getElementById('max-size')
});


t.exec();

// setTimeout(t.clean,200);

}());
//# sourceMappingURL=bundle.js.map
