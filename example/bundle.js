(function () {
'use strict';

const swap = (f) => (a, b) => f(b, a);
const compose = (first, ...fns) => (...args) => fns.reduce((previous, current) => current(previous), first(...args));
const curry = (fn, arityLeft) => {
    const arity = arityLeft || fn.length;
    return (...args) => {
        const argLength = args.length || 1;
        if (arity === argLength) {
            return fn(...args);
        }
        const func = (...moreArgs) => fn(...args, ...moreArgs);
        return curry(func, arity - args.length);
    };
};
const tap = (fn) => arg => {
    fn(arg);
    return arg;
};

const pointer = (path) => {
    const parts = path.split('.');
    const partial = (obj = {}, parts = []) => {
        const p = parts.shift();
        const current = obj[p];
        return (current === undefined || current === null || parts.length === 0) ?
            current : partial(current, parts);
    };
    const set = (target, newTree) => {
        let current = target;
        const [leaf, ...intermediate] = parts.reverse();
        for (const key of intermediate.reverse()) {
            if (current[key] === undefined) {
                current[key] = {};
                current = current[key];
            }
        }
        current[leaf] = Object.assign(current[leaf] || {}, newTree);
        return target;
    };
    return {
        get(target) {
            return partial(target, [...parts]);
        },
        set
    };
};

const emitter = () => {
    const listenersLists = {};
    const instance = {
        on(event, ...listeners) {
            listenersLists[event] = (listenersLists[event] || []).concat(listeners);
            return instance;
        },
        dispatch(event, ...args) {
            const listeners = listenersLists[event] || [];
            for (const listener of listeners) {
                listener(...args);
            }
            return instance;
        },
        off(event, ...listeners) {
            if (event === undefined) {
                Object.keys(listenersLists).forEach(ev => instance.off(ev));
            }
            else {
                const list = listenersLists[event] || [];
                listenersLists[event] = listeners.length ? list.filter(listener => !listeners.includes(listener)) : [];
            }
            return instance;
        }
    };
    return instance;
};
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
const typeExpression = (type) => {
    switch (type) {
        case Type.BOOLEAN:
            return Boolean;
        case Type.NUMBER:
            return Number;
        case Type.DATE:
            return val => new Date(val);
        case Type.STRING:
            return compose(String, val => val.toLowerCase());
        default:
            return val => val;
    }
};
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
const not = fn => input => !fn(input);
const is = value => input => Object.is(value, input);
const lt = value => input => input < value;
const gt = value => input => input > value;
const equals = value => input => value === input;
const includes = value => input => input.includes(value);
const anyOf = value => input => value.includes(input);
const operators = {
    ["includes" /* INCLUDES */]: includes,
    ["is" /* IS */]: is,
    ["isNot" /* IS_NOT */]: compose(is, not),
    ["lt" /* LOWER_THAN */]: lt,
    ["gte" /* GREATER_THAN_OR_EQUAL */]: compose(lt, not),
    ["gt" /* GREATER_THAN */]: gt,
    ["lte" /* LOWER_THAN_OR_EQUAL */]: compose(gt, not),
    ["equals" /* EQUALS */]: equals,
    ["notEquals" /* NOT_EQUALS */]: compose(equals, not),
    ["anyOf" /* ANY_OF */]: anyOf
};
const every = fns => (...args) => fns.every(fn => fn(...args));
const predicate = ({ value = '', operator = "includes" /* INCLUDES */, type }) => {
    const typeIt = typeExpression(type);
    const operateOnTyped = compose(typeIt, operators[operator]);
    const predicateFunc = operateOnTyped(value);
    return compose(typeIt, predicateFunc);
};
// Avoid useless filter lookup (improve perf)
const normalizeClauses = (conf) => {
    const output = {};
    const validPath = Object.keys(conf).filter(path => Array.isArray(conf[path]));
    validPath.forEach(path => {
        const validClauses = conf[path].filter(c => c.value !== '');
        if (validClauses.length > 0) {
            output[path] = validClauses;
        }
    });
    return output;
};
const filter = (filter) => {
    const normalizedClauses = normalizeClauses(filter);
    const funcList = Object.keys(normalizedClauses).map(path => {
        const getter = pointer(path).get;
        const clauses = normalizedClauses[path].map(predicate);
        return compose(getter, every(clauses));
    });
    const filterPredicate = every(funcList);
    return array => array.filter(filterPredicate);
};

const defaultComparator = (a, b) => {
    if (a === b) {
        return 0;
    }
    if (a === undefined) {
        return 1;
    }
    if (b === undefined) {
        return -1;
    }
    return a < b ? -1 : 1;
};
var SortDirection;
(function (SortDirection) {
    SortDirection["ASC"] = "asc";
    SortDirection["DESC"] = "desc";
    SortDirection["NONE"] = "none";
})(SortDirection || (SortDirection = {}));
const sortByProperty = (prop, comparator) => {
    const propGetter = pointer(prop).get;
    return (a, b) => comparator(propGetter(a), propGetter(b));
};
const defaultSortFactory = (conf) => {
    const { pointer: pointer$$1, direction = "asc" /* ASC */, comparator = defaultComparator } = conf;
    if (!pointer$$1 || direction === "none" /* NONE */) {
        return (array) => [...array];
    }
    const orderFunc = sortByProperty(pointer$$1, comparator);
    const compareFunc = direction === "desc" /* DESC */ ? swap(orderFunc) : orderFunc;
    return (array) => [...array].sort(compareFunc);
};

function re(strs, ...substs) {
    let reStr = transformRaw(strs.raw[0]);
    for (const [i, subst] of substs.entries()) {
        if (subst instanceof RegExp) {
            reStr += subst.source;
        } else if (typeof subst === 'string') {
            reStr += quoteText(subst);
        } else {
            throw new Error('Illegal substitution: '+subst);
        }
        reStr += transformRaw(strs.raw[i+1]);
    }
    let flags = '';
    if (reStr.startsWith('/')) {
        const lastSlashIndex = reStr.lastIndexOf('/');
        if (lastSlashIndex === 0) {
            throw new Error('If the `re` string starts with a slash, it must end with a second slash and zero or more flags: '+reStr);
        }
        flags = reStr.slice(lastSlashIndex+1);
        reStr = reStr.slice(1, lastSlashIndex);
    }
    return new RegExp(reStr, flags);
}

function transformRaw(str) {
    return str.replace(/\\`/g, '`');
}

/**
 * All special characters are escaped, because you may want to quote several characters inside parentheses or square brackets.
 */
function quoteText(text) {
    return text.replace(/[\\^$.*+?()[\]{}|=!<>:-]/g, '\\$&');
}

const regexp = (input) => {
    const { value, scope = [], escape = false, flags = '' } = input;
    const searchPointers = scope.map(field => pointer(field).get);
    if (scope.length === 0 || !value) {
        return (array) => array;
    }
    const regex = escape === true ? re `/${value}/${flags}` : new RegExp(value, flags);
    return (array) => array.filter(item => searchPointers.some(p => regex.test(String(p(item)))));
};

const sliceFactory = ({ page = 1, size } = { page: 1 }) => (array = []) => {
    const actualSize = size || array.length;
    const offset = (page - 1) * actualSize;
    return array.slice(offset, offset + actualSize);
};

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
const curriedPointer = (path) => {
    const { get, set } = pointer(path);
    return { get, set: curry(set) };
};
const tableDirective = ({ sortFactory, tableState, data, filterFactory, searchFactory }) => {
    let filteredCount = data.length;
    let matchingItems = data;
    const table = emitter();
    const sortPointer = curriedPointer('sort');
    const slicePointer = curriedPointer('slice');
    const filterPointer = curriedPointer('filter');
    const searchPointer = curriedPointer('search');
    // We need to register in case the summary comes from outside (like server data)
    table.on("SUMMARY_CHANGED" /* SUMMARY_CHANGED */, ({ filteredCount: count }) => {
        filteredCount = count;
    });
    const safeAssign = curry((base, extension) => Object.assign({}, base, extension));
    const dispatch = curry(table.dispatch, 2);
    const dispatchSummary = (filtered) => {
        matchingItems = filtered;
        return dispatch("SUMMARY_CHANGED" /* SUMMARY_CHANGED */, {
            page: tableState.slice.page,
            size: tableState.slice.size,
            filteredCount: filtered.length
        });
    };
    const exec = ({ processingDelay = 20 } = { processingDelay: 20 }) => {
        table.dispatch("EXEC_CHANGED" /* EXEC_CHANGED */, { working: true });
        setTimeout(() => {
            try {
                const filterFunc = filterFactory(filterPointer.get(tableState));
                const searchFunc = searchFactory(searchPointer.get(tableState));
                const sortFunc = sortFactory(sortPointer.get(tableState));
                const sliceFunc = sliceFactory(slicePointer.get(tableState));
                const execFunc = compose(filterFunc, searchFunc, tap(dispatchSummary), sortFunc, sliceFunc);
                const displayed = execFunc(data);
                table.dispatch("DISPLAY_CHANGED" /* DISPLAY_CHANGED */, displayed.map(d => ({
                    index: data.indexOf(d),
                    value: d
                })));
            }
            catch (err) {
                table.dispatch("EXEC_ERROR" /* EXEC_ERROR */, err);
            }
            finally {
                table.dispatch("EXEC_CHANGED" /* EXEC_CHANGED */, { working: false });
            }
        }, processingDelay);
    };
    const updateTableState = curry((pter, ev, newPartialState) => compose(safeAssign(pter.get(tableState)), tap(dispatch(ev)), pter.set(tableState))(newPartialState));
    const resetToFirstPage = () => updateTableState(slicePointer, "CHANGE_PAGE" /* PAGE_CHANGED */, { page: 1 });
    const tableOperation = (pter, ev) => compose(updateTableState(pter, ev), resetToFirstPage, () => table.exec() // We wrap within a function so table.exec can be overwritten (when using with a server for example)
    );
    const api = {
        sort: tableOperation(sortPointer, "TOGGLE_SORT" /* TOGGLE_SORT */),
        filter: tableOperation(filterPointer, "FILTER_CHANGED" /* FILTER_CHANGED */),
        search: tableOperation(searchPointer, "SEARCH_CHANGED" /* SEARCH_CHANGED */),
        slice: compose(updateTableState(slicePointer, "CHANGE_PAGE" /* PAGE_CHANGED */), () => table.exec()),
        exec,
        async eval(state = tableState) {
            const sortFunc = sortFactory(sortPointer.get(state));
            const searchFunc = searchFactory(searchPointer.get(state));
            const filterFunc = filterFactory(filterPointer.get(state));
            const sliceFunc = sliceFactory(slicePointer.get(state));
            const execFunc = compose(filterFunc, searchFunc, sortFunc, sliceFunc);
            return execFunc(data).map(d => ({ index: data.indexOf(d), value: d }));
        },
        onDisplayChange(fn) {
            table.on("DISPLAY_CHANGED" /* DISPLAY_CHANGED */, fn);
        },
        getTableState() {
            const sort = Object.assign({}, tableState.sort);
            const search = Object.assign({}, tableState.search);
            const slice = Object.assign({}, tableState.slice);
            const filter$$1 = {};
            for (const prop of Object.getOwnPropertyNames(tableState.filter)) {
                filter$$1[prop] = tableState.filter[prop].map(v => Object.assign({}, v));
            }
            return { sort, search, slice, filter: filter$$1 };
        },
        getMatchingItems() {
            return [...matchingItems];
        }
    };
    const instance = Object.assign(table, api);
    Object.defineProperties(instance, {
        filteredCount: {
            get() {
                return filteredCount;
            }
        },
        length: {
            get() {
                return data.length;
            }
        }
    });
    return instance;
};

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

const sliceListener = proxyListener({
    ["CHANGE_PAGE" /* PAGE_CHANGED */]: 'onPageChange',
    ["SUMMARY_CHANGED" /* SUMMARY_CHANGED */]: 'onSummaryChange'
});
const paginationDirective = ({ table }) => {
    let { slice: { page: currentPage, size: currentSize } } = table.getTableState();
    let itemListLength = table.filteredCount;
    const proxy = sliceListener({ emitter: table });
    const api = {
        selectPage(p) {
            return table.slice({ page: p, size: currentSize });
        },
        selectNextPage() {
            return api.selectPage(currentPage + 1);
        },
        selectPreviousPage() {
            return api.selectPage(currentPage - 1);
        },
        changePageSize(size) {
            return table.slice({ page: 1, size });
        },
        isPreviousPageEnabled() {
            return currentPage > 1;
        },
        isNextPageEnabled() {
            return Math.ceil(itemListLength / currentSize) > currentPage;
        },
        state() {
            return Object.assign(table.getTableState().slice, { filteredCount: itemListLength });
        }
    };
    const directive = Object.assign(api, proxy);
    directive.onSummaryChange(({ page: p, size: s, filteredCount }) => {
        currentPage = p;
        currentSize = s;
        itemListLength = filteredCount;
    });
    return directive;
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

const summaryListener = proxyListener({ ["SUMMARY_CHANGED" /* SUMMARY_CHANGED */]: 'onSummaryChange' });
const summaryDirective = ({ table }) => summaryListener({ emitter: table });

const executionListener = proxyListener({ ["EXEC_CHANGED" /* EXEC_CHANGED */]: 'onExecutionChange' });
const workingIndicatorDirective = ({ table }) => executionListener({ emitter: table });

const defaultTableState = () => ({ sort: {}, slice: { page: 1 }, filter: {}, search: {} });
const smartTable = ({ sortFactory = defaultSortFactory, filterFactory = filter, searchFactory = regexp, tableState = defaultTableState(), data = [] } = {
    sortFactory: defaultSortFactory,
    filterFactory: filter,
    searchFactory: regexp,
    tableState: defaultTableState(),
    data: []
}, ...tableExtensions) => {
    const coreTable = tableDirective({ sortFactory, filterFactory, tableState, data, searchFactory });
    return tableExtensions.reduce((accumulator, newdir) => Object.assign(accumulator, newdir({
        sortFactory,
        filterFactory,
        searchFactory,
        tableState,
        data,
        table: coreTable
    })), coreTable);
};

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

var tableComponentFactory = function ({el, table}) {
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

var row = function ({name:{first:firstName, last:lastName}, gender, birthDate, size}) {
  const tr = document.createElement('tr');
  tr.innerHTML = `<td>${lastName}</td><td>${firstName}</td><td>${gender}</td><td>${birthDate.toLocaleDateString()}</td><td>${size}</td>`;
  return tr;
};

function summaryComponent ({table, el}) {
  const dir = summaryDirective({table});
  dir.onSummaryChange(({page, size, filteredCount}) => {
    el.innerHTML = `showing items <strong>${(page - 1) * size + (filteredCount > 0 ? 1 : 0)}</strong> - <strong>${Math.min(filteredCount, page * size)}</strong> of <strong>${filteredCount}</strong> matching items`;
  });
  return dir;
}

function paginationComponent ({table, el}) {
  const previousButton = document.createElement('button');
  previousButton.innerHTML = 'Previous';
  const nextButton = document.createElement('button');
  nextButton.innerHTML = 'Next';
  const pageSpan = document.createElement('span');
  pageSpan.innerHTML = '- page 1 -';
  const comp = paginationDirective({table});

  comp.onSummaryChange(({page}) => {
    previousButton.disabled = !comp.isPreviousPageEnabled();
    nextButton.disabled = !comp.isNextPageEnabled();
    pageSpan.innerHTML = `- ${page} -`;
  });

  previousButton.addEventListener('click', () => comp.selectPreviousPage());
  nextButton.addEventListener('click', () => comp.selectNextPage());

  el.appendChild(previousButton);
  el.appendChild(pageSpan);
  el.appendChild(nextButton);

  return comp;
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

  minEl.addEventListener('input', debounce$1((ev) => {
    gtValue = minEl.value;
    commit();
  }, 400));

  maxEl.addEventListener('input', debounce$1((ev) => {
    ltValue = maxEl.value;
    commit();
  }, 400));
}

const el = document.getElementById('table-container');
const tbody = el.querySelector('tbody');
const summaryEl = el.querySelector('[data-st-summary]');

const t = smartTable({data, tableState: {sort: {}, filter: {}, slice: {page: 1, size: 20}}});
const tableComponent = tableComponentFactory({el, table: t});

summaryComponent({table: t, el: summaryEl});
rangSizeInput({
  table: t,
  minEl: document.getElementById('min-size'),
  maxEl: document.getElementById('max-size')
});

const paginationContainer = el.querySelector('[data-st-pagination]');
paginationComponent({table: t, el: paginationContainer});

tableComponent.onDisplayChange(displayed => {
  tbody.innerHTML = '';
  for (let r of displayed) {
    const newChild = row((r.value), r.index, t);
    tbody.appendChild(newChild);
  }
});

}());
//# sourceMappingURL=data:application/json;charset=utf-8;base64,eyJ2ZXJzaW9uIjozLCJmaWxlIjoiYnVuZGxlLmpzIiwic291cmNlcyI6WyIuLi9ub2RlX21vZHVsZXMvc21hcnQtdGFibGUtb3BlcmF0b3JzL2Rpc3QvYnVuZGxlL21vZHVsZS5qcyIsIi4uL25vZGVfbW9kdWxlcy9zbWFydC10YWJsZS1qc29uLXBvaW50ZXIvZGlzdC9idW5kbGUvbW9kdWxlLmpzIiwiLi4vbm9kZV9tb2R1bGVzL3NtYXJ0LXRhYmxlLWV2ZW50cy9kaXN0L2J1bmRsZS9tb2R1bGUuanMiLCIuLi9ub2RlX21vZHVsZXMvc21hcnQtdGFibGUtZmlsdGVyL2Rpc3QvYnVuZGxlL21vZHVsZS5qcyIsIi4uL25vZGVfbW9kdWxlcy9zbWFydC10YWJsZS1zb3J0L2Rpc3QvYnVuZGxlL21vZHVsZS5qcyIsIi4uL25vZGVfbW9kdWxlcy9zbWFydC10YWJsZS1zZWFyY2gvZGlzdC9idW5kbGUvbW9kdWxlLmpzIiwiLi4vbm9kZV9tb2R1bGVzL3NtYXJ0LXRhYmxlLWNvcmUvZGlzdC9idW5kbGUvbW9kdWxlLmpzIiwiLi4vbGliL2xvYWRpbmdJbmRpY2F0b3IuanMiLCIuLi9saWIvc29ydC5qcyIsIi4uL2xpYi9oZWxwZXJzLmpzIiwiLi4vbGliL2ZpbHRlcnMuanMiLCIuLi9saWIvc2VhcmNoLmpzIiwiLi4vbGliL3RhYmxlLmpzIiwiY29tcG9uZW50cy9yb3cuanMiLCJjb21wb25lbnRzL3N1bW1hcnkuanMiLCJjb21wb25lbnRzL3BhZ2luYXRpb24uanMiLCJjb21wb25lbnRzL3JhbmdlU2l6ZUlucHV0LmpzIiwiaW5kZXguanMiXSwic291cmNlc0NvbnRlbnQiOlsiY29uc3Qgc3dhcCA9IChmKSA9PiAoYSwgYikgPT4gZihiLCBhKTtcbmNvbnN0IGNvbXBvc2UgPSAoZmlyc3QsIC4uLmZucykgPT4gKC4uLmFyZ3MpID0+IGZucy5yZWR1Y2UoKHByZXZpb3VzLCBjdXJyZW50KSA9PiBjdXJyZW50KHByZXZpb3VzKSwgZmlyc3QoLi4uYXJncykpO1xuY29uc3QgY3VycnkgPSAoZm4sIGFyaXR5TGVmdCkgPT4ge1xuICAgIGNvbnN0IGFyaXR5ID0gYXJpdHlMZWZ0IHx8IGZuLmxlbmd0aDtcbiAgICByZXR1cm4gKC4uLmFyZ3MpID0+IHtcbiAgICAgICAgY29uc3QgYXJnTGVuZ3RoID0gYXJncy5sZW5ndGggfHwgMTtcbiAgICAgICAgaWYgKGFyaXR5ID09PSBhcmdMZW5ndGgpIHtcbiAgICAgICAgICAgIHJldHVybiBmbiguLi5hcmdzKTtcbiAgICAgICAgfVxuICAgICAgICBjb25zdCBmdW5jID0gKC4uLm1vcmVBcmdzKSA9PiBmbiguLi5hcmdzLCAuLi5tb3JlQXJncyk7XG4gICAgICAgIHJldHVybiBjdXJyeShmdW5jLCBhcml0eSAtIGFyZ3MubGVuZ3RoKTtcbiAgICB9O1xufTtcbmNvbnN0IGFwcGx5ID0gKGZuKSA9PiAoLi4uYXJncykgPT4gZm4oLi4uYXJncyk7XG5jb25zdCB0YXAgPSAoZm4pID0+IGFyZyA9PiB7XG4gICAgZm4oYXJnKTtcbiAgICByZXR1cm4gYXJnO1xufTtcblxuZXhwb3J0IHsgc3dhcCwgY29tcG9zZSwgY3VycnksIGFwcGx5LCB0YXAgfTtcbiIsImNvbnN0IHBvaW50ZXIgPSAocGF0aCkgPT4ge1xuICAgIGNvbnN0IHBhcnRzID0gcGF0aC5zcGxpdCgnLicpO1xuICAgIGNvbnN0IHBhcnRpYWwgPSAob2JqID0ge30sIHBhcnRzID0gW10pID0+IHtcbiAgICAgICAgY29uc3QgcCA9IHBhcnRzLnNoaWZ0KCk7XG4gICAgICAgIGNvbnN0IGN1cnJlbnQgPSBvYmpbcF07XG4gICAgICAgIHJldHVybiAoY3VycmVudCA9PT0gdW5kZWZpbmVkIHx8IGN1cnJlbnQgPT09IG51bGwgfHwgcGFydHMubGVuZ3RoID09PSAwKSA/XG4gICAgICAgICAgICBjdXJyZW50IDogcGFydGlhbChjdXJyZW50LCBwYXJ0cyk7XG4gICAgfTtcbiAgICBjb25zdCBzZXQgPSAodGFyZ2V0LCBuZXdUcmVlKSA9PiB7XG4gICAgICAgIGxldCBjdXJyZW50ID0gdGFyZ2V0O1xuICAgICAgICBjb25zdCBbbGVhZiwgLi4uaW50ZXJtZWRpYXRlXSA9IHBhcnRzLnJldmVyc2UoKTtcbiAgICAgICAgZm9yIChjb25zdCBrZXkgb2YgaW50ZXJtZWRpYXRlLnJldmVyc2UoKSkge1xuICAgICAgICAgICAgaWYgKGN1cnJlbnRba2V5XSA9PT0gdW5kZWZpbmVkKSB7XG4gICAgICAgICAgICAgICAgY3VycmVudFtrZXldID0ge307XG4gICAgICAgICAgICAgICAgY3VycmVudCA9IGN1cnJlbnRba2V5XTtcbiAgICAgICAgICAgIH1cbiAgICAgICAgfVxuICAgICAgICBjdXJyZW50W2xlYWZdID0gT2JqZWN0LmFzc2lnbihjdXJyZW50W2xlYWZdIHx8IHt9LCBuZXdUcmVlKTtcbiAgICAgICAgcmV0dXJuIHRhcmdldDtcbiAgICB9O1xuICAgIHJldHVybiB7XG4gICAgICAgIGdldCh0YXJnZXQpIHtcbiAgICAgICAgICAgIHJldHVybiBwYXJ0aWFsKHRhcmdldCwgWy4uLnBhcnRzXSk7XG4gICAgICAgIH0sXG4gICAgICAgIHNldFxuICAgIH07XG59O1xuXG5leHBvcnQgeyBwb2ludGVyIH07XG4iLCJjb25zdCBlbWl0dGVyID0gKCkgPT4ge1xuICAgIGNvbnN0IGxpc3RlbmVyc0xpc3RzID0ge307XG4gICAgY29uc3QgaW5zdGFuY2UgPSB7XG4gICAgICAgIG9uKGV2ZW50LCAuLi5saXN0ZW5lcnMpIHtcbiAgICAgICAgICAgIGxpc3RlbmVyc0xpc3RzW2V2ZW50XSA9IChsaXN0ZW5lcnNMaXN0c1tldmVudF0gfHwgW10pLmNvbmNhdChsaXN0ZW5lcnMpO1xuICAgICAgICAgICAgcmV0dXJuIGluc3RhbmNlO1xuICAgICAgICB9LFxuICAgICAgICBkaXNwYXRjaChldmVudCwgLi4uYXJncykge1xuICAgICAgICAgICAgY29uc3QgbGlzdGVuZXJzID0gbGlzdGVuZXJzTGlzdHNbZXZlbnRdIHx8IFtdO1xuICAgICAgICAgICAgZm9yIChjb25zdCBsaXN0ZW5lciBvZiBsaXN0ZW5lcnMpIHtcbiAgICAgICAgICAgICAgICBsaXN0ZW5lciguLi5hcmdzKTtcbiAgICAgICAgICAgIH1cbiAgICAgICAgICAgIHJldHVybiBpbnN0YW5jZTtcbiAgICAgICAgfSxcbiAgICAgICAgb2ZmKGV2ZW50LCAuLi5saXN0ZW5lcnMpIHtcbiAgICAgICAgICAgIGlmIChldmVudCA9PT0gdW5kZWZpbmVkKSB7XG4gICAgICAgICAgICAgICAgT2JqZWN0LmtleXMobGlzdGVuZXJzTGlzdHMpLmZvckVhY2goZXYgPT4gaW5zdGFuY2Uub2ZmKGV2KSk7XG4gICAgICAgICAgICB9XG4gICAgICAgICAgICBlbHNlIHtcbiAgICAgICAgICAgICAgICBjb25zdCBsaXN0ID0gbGlzdGVuZXJzTGlzdHNbZXZlbnRdIHx8IFtdO1xuICAgICAgICAgICAgICAgIGxpc3RlbmVyc0xpc3RzW2V2ZW50XSA9IGxpc3RlbmVycy5sZW5ndGggPyBsaXN0LmZpbHRlcihsaXN0ZW5lciA9PiAhbGlzdGVuZXJzLmluY2x1ZGVzKGxpc3RlbmVyKSkgOiBbXTtcbiAgICAgICAgICAgIH1cbiAgICAgICAgICAgIHJldHVybiBpbnN0YW5jZTtcbiAgICAgICAgfVxuICAgIH07XG4gICAgcmV0dXJuIGluc3RhbmNlO1xufTtcbmNvbnN0IHByb3h5TGlzdGVuZXIgPSAoZXZlbnRNYXApID0+ICh7IGVtaXR0ZXIgfSkgPT4ge1xuICAgIGNvbnN0IGV2ZW50TGlzdGVuZXJzID0ge307XG4gICAgY29uc3QgcHJveHkgPSB7XG4gICAgICAgIG9mZihldikge1xuICAgICAgICAgICAgaWYgKCFldikge1xuICAgICAgICAgICAgICAgIE9iamVjdC5rZXlzKGV2ZW50TGlzdGVuZXJzKS5mb3JFYWNoKGV2ZW50TmFtZSA9PiBwcm94eS5vZmYoZXZlbnROYW1lKSk7XG4gICAgICAgICAgICB9XG4gICAgICAgICAgICBpZiAoZXZlbnRMaXN0ZW5lcnNbZXZdKSB7XG4gICAgICAgICAgICAgICAgZW1pdHRlci5vZmYoZXYsIC4uLmV2ZW50TGlzdGVuZXJzW2V2XSk7XG4gICAgICAgICAgICB9XG4gICAgICAgICAgICByZXR1cm4gcHJveHk7XG4gICAgICAgIH1cbiAgICB9O1xuICAgIGZvciAoY29uc3QgZXYgb2YgT2JqZWN0LmtleXMoZXZlbnRNYXApKSB7XG4gICAgICAgIGNvbnN0IG1ldGhvZCA9IGV2ZW50TWFwW2V2XTtcbiAgICAgICAgZXZlbnRMaXN0ZW5lcnNbZXZdID0gW107XG4gICAgICAgIHByb3h5W21ldGhvZF0gPSBmdW5jdGlvbiAoLi4ubGlzdGVuZXJzKSB7XG4gICAgICAgICAgICBldmVudExpc3RlbmVyc1tldl0gPSBldmVudExpc3RlbmVyc1tldl0uY29uY2F0KGxpc3RlbmVycyk7XG4gICAgICAgICAgICBlbWl0dGVyLm9uKGV2LCAuLi5saXN0ZW5lcnMpO1xuICAgICAgICAgICAgcmV0dXJuIHByb3h5O1xuICAgICAgICB9O1xuICAgIH1cbiAgICByZXR1cm4gcHJveHk7XG59O1xuXG5leHBvcnQgeyBlbWl0dGVyLCBwcm94eUxpc3RlbmVyIH07XG4iLCJpbXBvcnQgeyBjb21wb3NlIH0gZnJvbSAnc21hcnQtdGFibGUtb3BlcmF0b3JzJztcbmltcG9ydCB7IHBvaW50ZXIgfSBmcm9tICdzbWFydC10YWJsZS1qc29uLXBvaW50ZXInO1xuXG52YXIgVHlwZTtcbihmdW5jdGlvbiAoVHlwZSkge1xuICAgIFR5cGVbXCJCT09MRUFOXCJdID0gXCJib29sZWFuXCI7XG4gICAgVHlwZVtcIk5VTUJFUlwiXSA9IFwibnVtYmVyXCI7XG4gICAgVHlwZVtcIkRBVEVcIl0gPSBcImRhdGVcIjtcbiAgICBUeXBlW1wiU1RSSU5HXCJdID0gXCJzdHJpbmdcIjtcbn0pKFR5cGUgfHwgKFR5cGUgPSB7fSkpO1xuY29uc3QgdHlwZUV4cHJlc3Npb24gPSAodHlwZSkgPT4ge1xuICAgIHN3aXRjaCAodHlwZSkge1xuICAgICAgICBjYXNlIFR5cGUuQk9PTEVBTjpcbiAgICAgICAgICAgIHJldHVybiBCb29sZWFuO1xuICAgICAgICBjYXNlIFR5cGUuTlVNQkVSOlxuICAgICAgICAgICAgcmV0dXJuIE51bWJlcjtcbiAgICAgICAgY2FzZSBUeXBlLkRBVEU6XG4gICAgICAgICAgICByZXR1cm4gdmFsID0+IG5ldyBEYXRlKHZhbCk7XG4gICAgICAgIGNhc2UgVHlwZS5TVFJJTkc6XG4gICAgICAgICAgICByZXR1cm4gY29tcG9zZShTdHJpbmcsIHZhbCA9PiB2YWwudG9Mb3dlckNhc2UoKSk7XG4gICAgICAgIGRlZmF1bHQ6XG4gICAgICAgICAgICByZXR1cm4gdmFsID0+IHZhbDtcbiAgICB9XG59O1xudmFyIEZpbHRlck9wZXJhdG9yO1xuKGZ1bmN0aW9uIChGaWx0ZXJPcGVyYXRvcikge1xuICAgIEZpbHRlck9wZXJhdG9yW1wiSU5DTFVERVNcIl0gPSBcImluY2x1ZGVzXCI7XG4gICAgRmlsdGVyT3BlcmF0b3JbXCJJU1wiXSA9IFwiaXNcIjtcbiAgICBGaWx0ZXJPcGVyYXRvcltcIklTX05PVFwiXSA9IFwiaXNOb3RcIjtcbiAgICBGaWx0ZXJPcGVyYXRvcltcIkxPV0VSX1RIQU5cIl0gPSBcImx0XCI7XG4gICAgRmlsdGVyT3BlcmF0b3JbXCJHUkVBVEVSX1RIQU5cIl0gPSBcImd0XCI7XG4gICAgRmlsdGVyT3BlcmF0b3JbXCJHUkVBVEVSX1RIQU5fT1JfRVFVQUxcIl0gPSBcImd0ZVwiO1xuICAgIEZpbHRlck9wZXJhdG9yW1wiTE9XRVJfVEhBTl9PUl9FUVVBTFwiXSA9IFwibHRlXCI7XG4gICAgRmlsdGVyT3BlcmF0b3JbXCJFUVVBTFNcIl0gPSBcImVxdWFsc1wiO1xuICAgIEZpbHRlck9wZXJhdG9yW1wiTk9UX0VRVUFMU1wiXSA9IFwibm90RXF1YWxzXCI7XG4gICAgRmlsdGVyT3BlcmF0b3JbXCJBTllfT0ZcIl0gPSBcImFueU9mXCI7XG59KShGaWx0ZXJPcGVyYXRvciB8fCAoRmlsdGVyT3BlcmF0b3IgPSB7fSkpO1xuY29uc3Qgbm90ID0gZm4gPT4gaW5wdXQgPT4gIWZuKGlucHV0KTtcbmNvbnN0IGlzID0gdmFsdWUgPT4gaW5wdXQgPT4gT2JqZWN0LmlzKHZhbHVlLCBpbnB1dCk7XG5jb25zdCBsdCA9IHZhbHVlID0+IGlucHV0ID0+IGlucHV0IDwgdmFsdWU7XG5jb25zdCBndCA9IHZhbHVlID0+IGlucHV0ID0+IGlucHV0ID4gdmFsdWU7XG5jb25zdCBlcXVhbHMgPSB2YWx1ZSA9PiBpbnB1dCA9PiB2YWx1ZSA9PT0gaW5wdXQ7XG5jb25zdCBpbmNsdWRlcyA9IHZhbHVlID0+IGlucHV0ID0+IGlucHV0LmluY2x1ZGVzKHZhbHVlKTtcbmNvbnN0IGFueU9mID0gdmFsdWUgPT4gaW5wdXQgPT4gdmFsdWUuaW5jbHVkZXMoaW5wdXQpO1xuY29uc3Qgb3BlcmF0b3JzID0ge1xuICAgIFtcImluY2x1ZGVzXCIgLyogSU5DTFVERVMgKi9dOiBpbmNsdWRlcyxcbiAgICBbXCJpc1wiIC8qIElTICovXTogaXMsXG4gICAgW1wiaXNOb3RcIiAvKiBJU19OT1QgKi9dOiBjb21wb3NlKGlzLCBub3QpLFxuICAgIFtcImx0XCIgLyogTE9XRVJfVEhBTiAqL106IGx0LFxuICAgIFtcImd0ZVwiIC8qIEdSRUFURVJfVEhBTl9PUl9FUVVBTCAqL106IGNvbXBvc2UobHQsIG5vdCksXG4gICAgW1wiZ3RcIiAvKiBHUkVBVEVSX1RIQU4gKi9dOiBndCxcbiAgICBbXCJsdGVcIiAvKiBMT1dFUl9USEFOX09SX0VRVUFMICovXTogY29tcG9zZShndCwgbm90KSxcbiAgICBbXCJlcXVhbHNcIiAvKiBFUVVBTFMgKi9dOiBlcXVhbHMsXG4gICAgW1wibm90RXF1YWxzXCIgLyogTk9UX0VRVUFMUyAqL106IGNvbXBvc2UoZXF1YWxzLCBub3QpLFxuICAgIFtcImFueU9mXCIgLyogQU5ZX09GICovXTogYW55T2Zcbn07XG5jb25zdCBldmVyeSA9IGZucyA9PiAoLi4uYXJncykgPT4gZm5zLmV2ZXJ5KGZuID0+IGZuKC4uLmFyZ3MpKTtcbmNvbnN0IHByZWRpY2F0ZSA9ICh7IHZhbHVlID0gJycsIG9wZXJhdG9yID0gXCJpbmNsdWRlc1wiIC8qIElOQ0xVREVTICovLCB0eXBlIH0pID0+IHtcbiAgICBjb25zdCB0eXBlSXQgPSB0eXBlRXhwcmVzc2lvbih0eXBlKTtcbiAgICBjb25zdCBvcGVyYXRlT25UeXBlZCA9IGNvbXBvc2UodHlwZUl0LCBvcGVyYXRvcnNbb3BlcmF0b3JdKTtcbiAgICBjb25zdCBwcmVkaWNhdGVGdW5jID0gb3BlcmF0ZU9uVHlwZWQodmFsdWUpO1xuICAgIHJldHVybiBjb21wb3NlKHR5cGVJdCwgcHJlZGljYXRlRnVuYyk7XG59O1xuLy8gQXZvaWQgdXNlbGVzcyBmaWx0ZXIgbG9va3VwIChpbXByb3ZlIHBlcmYpXG5jb25zdCBub3JtYWxpemVDbGF1c2VzID0gKGNvbmYpID0+IHtcbiAgICBjb25zdCBvdXRwdXQgPSB7fTtcbiAgICBjb25zdCB2YWxpZFBhdGggPSBPYmplY3Qua2V5cyhjb25mKS5maWx0ZXIocGF0aCA9PiBBcnJheS5pc0FycmF5KGNvbmZbcGF0aF0pKTtcbiAgICB2YWxpZFBhdGguZm9yRWFjaChwYXRoID0+IHtcbiAgICAgICAgY29uc3QgdmFsaWRDbGF1c2VzID0gY29uZltwYXRoXS5maWx0ZXIoYyA9PiBjLnZhbHVlICE9PSAnJyk7XG4gICAgICAgIGlmICh2YWxpZENsYXVzZXMubGVuZ3RoID4gMCkge1xuICAgICAgICAgICAgb3V0cHV0W3BhdGhdID0gdmFsaWRDbGF1c2VzO1xuICAgICAgICB9XG4gICAgfSk7XG4gICAgcmV0dXJuIG91dHB1dDtcbn07XG5jb25zdCBmaWx0ZXIgPSAoZmlsdGVyKSA9PiB7XG4gICAgY29uc3Qgbm9ybWFsaXplZENsYXVzZXMgPSBub3JtYWxpemVDbGF1c2VzKGZpbHRlcik7XG4gICAgY29uc3QgZnVuY0xpc3QgPSBPYmplY3Qua2V5cyhub3JtYWxpemVkQ2xhdXNlcykubWFwKHBhdGggPT4ge1xuICAgICAgICBjb25zdCBnZXR0ZXIgPSBwb2ludGVyKHBhdGgpLmdldDtcbiAgICAgICAgY29uc3QgY2xhdXNlcyA9IG5vcm1hbGl6ZWRDbGF1c2VzW3BhdGhdLm1hcChwcmVkaWNhdGUpO1xuICAgICAgICByZXR1cm4gY29tcG9zZShnZXR0ZXIsIGV2ZXJ5KGNsYXVzZXMpKTtcbiAgICB9KTtcbiAgICBjb25zdCBmaWx0ZXJQcmVkaWNhdGUgPSBldmVyeShmdW5jTGlzdCk7XG4gICAgcmV0dXJuIGFycmF5ID0+IGFycmF5LmZpbHRlcihmaWx0ZXJQcmVkaWNhdGUpO1xufTtcblxuZXhwb3J0IHsgRmlsdGVyT3BlcmF0b3IsIHByZWRpY2F0ZSwgZmlsdGVyIH07XG4iLCJpbXBvcnQgeyBzd2FwIH0gZnJvbSAnc21hcnQtdGFibGUtb3BlcmF0b3JzJztcbmltcG9ydCB7IHBvaW50ZXIgfSBmcm9tICdzbWFydC10YWJsZS1qc29uLXBvaW50ZXInO1xuXG5jb25zdCBkZWZhdWx0Q29tcGFyYXRvciA9IChhLCBiKSA9PiB7XG4gICAgaWYgKGEgPT09IGIpIHtcbiAgICAgICAgcmV0dXJuIDA7XG4gICAgfVxuICAgIGlmIChhID09PSB1bmRlZmluZWQpIHtcbiAgICAgICAgcmV0dXJuIDE7XG4gICAgfVxuICAgIGlmIChiID09PSB1bmRlZmluZWQpIHtcbiAgICAgICAgcmV0dXJuIC0xO1xuICAgIH1cbiAgICByZXR1cm4gYSA8IGIgPyAtMSA6IDE7XG59O1xudmFyIFNvcnREaXJlY3Rpb247XG4oZnVuY3Rpb24gKFNvcnREaXJlY3Rpb24pIHtcbiAgICBTb3J0RGlyZWN0aW9uW1wiQVNDXCJdID0gXCJhc2NcIjtcbiAgICBTb3J0RGlyZWN0aW9uW1wiREVTQ1wiXSA9IFwiZGVzY1wiO1xuICAgIFNvcnREaXJlY3Rpb25bXCJOT05FXCJdID0gXCJub25lXCI7XG59KShTb3J0RGlyZWN0aW9uIHx8IChTb3J0RGlyZWN0aW9uID0ge30pKTtcbmNvbnN0IHNvcnRCeVByb3BlcnR5ID0gKHByb3AsIGNvbXBhcmF0b3IpID0+IHtcbiAgICBjb25zdCBwcm9wR2V0dGVyID0gcG9pbnRlcihwcm9wKS5nZXQ7XG4gICAgcmV0dXJuIChhLCBiKSA9PiBjb21wYXJhdG9yKHByb3BHZXR0ZXIoYSksIHByb3BHZXR0ZXIoYikpO1xufTtcbmNvbnN0IGRlZmF1bHRTb3J0RmFjdG9yeSA9IChjb25mKSA9PiB7XG4gICAgY29uc3QgeyBwb2ludGVyOiBwb2ludGVyJCQxLCBkaXJlY3Rpb24gPSBcImFzY1wiIC8qIEFTQyAqLywgY29tcGFyYXRvciA9IGRlZmF1bHRDb21wYXJhdG9yIH0gPSBjb25mO1xuICAgIGlmICghcG9pbnRlciQkMSB8fCBkaXJlY3Rpb24gPT09IFwibm9uZVwiIC8qIE5PTkUgKi8pIHtcbiAgICAgICAgcmV0dXJuIChhcnJheSkgPT4gWy4uLmFycmF5XTtcbiAgICB9XG4gICAgY29uc3Qgb3JkZXJGdW5jID0gc29ydEJ5UHJvcGVydHkocG9pbnRlciQkMSwgY29tcGFyYXRvcik7XG4gICAgY29uc3QgY29tcGFyZUZ1bmMgPSBkaXJlY3Rpb24gPT09IFwiZGVzY1wiIC8qIERFU0MgKi8gPyBzd2FwKG9yZGVyRnVuYykgOiBvcmRlckZ1bmM7XG4gICAgcmV0dXJuIChhcnJheSkgPT4gWy4uLmFycmF5XS5zb3J0KGNvbXBhcmVGdW5jKTtcbn07XG5cbmV4cG9ydCB7IFNvcnREaXJlY3Rpb24sIGRlZmF1bHRTb3J0RmFjdG9yeSB9O1xuIiwiaW1wb3J0IHsgcG9pbnRlciB9IGZyb20gJ3NtYXJ0LXRhYmxlLWpzb24tcG9pbnRlcic7XG5cbmNvbnN0IGJhc2ljID0gKGlucHV0KSA9PiB7XG4gICAgY29uc3QgeyB2YWx1ZSwgc2NvcGUgPSBbXSwgaXNDYXNlU2Vuc2l0aXZlID0gZmFsc2UgfSA9IGlucHV0O1xuICAgIGNvbnN0IHNlYXJjaFBvaW50ZXJzID0gc2NvcGUubWFwKGZpZWxkID0+IHBvaW50ZXIoZmllbGQpLmdldCk7XG4gICAgaWYgKHNjb3BlLmxlbmd0aCA9PT0gMCB8fCAhdmFsdWUpIHtcbiAgICAgICAgcmV0dXJuIChhcnJheSkgPT4gYXJyYXk7XG4gICAgfVxuICAgIGNvbnN0IHRlc3QgPSBpc0Nhc2VTZW5zaXRpdmUgPT09IHRydWUgPyBTdHJpbmcodmFsdWUpIDogU3RyaW5nKHZhbHVlKS50b0xvd2VyQ2FzZSgpO1xuICAgIHJldHVybiAoYXJyYXkpID0+IGFycmF5LmZpbHRlcihpdGVtID0+IHNlYXJjaFBvaW50ZXJzLnNvbWUocCA9PiB7XG4gICAgICAgIGNvbnN0IHYgPSBpc0Nhc2VTZW5zaXRpdmUgPT09IHRydWUgPyBTdHJpbmcocChpdGVtKSkgOiBTdHJpbmcocChpdGVtKSkudG9Mb3dlckNhc2UoKTtcbiAgICAgICAgcmV0dXJuIHYuaW5jbHVkZXModGVzdCk7XG4gICAgfSkpO1xufTtcblxuZnVuY3Rpb24gcmUoc3RycywgLi4uc3Vic3RzKSB7XG4gICAgbGV0IHJlU3RyID0gdHJhbnNmb3JtUmF3KHN0cnMucmF3WzBdKTtcbiAgICBmb3IgKGNvbnN0IFtpLCBzdWJzdF0gb2Ygc3Vic3RzLmVudHJpZXMoKSkge1xuICAgICAgICBpZiAoc3Vic3QgaW5zdGFuY2VvZiBSZWdFeHApIHtcbiAgICAgICAgICAgIHJlU3RyICs9IHN1YnN0LnNvdXJjZTtcbiAgICAgICAgfSBlbHNlIGlmICh0eXBlb2Ygc3Vic3QgPT09ICdzdHJpbmcnKSB7XG4gICAgICAgICAgICByZVN0ciArPSBxdW90ZVRleHQoc3Vic3QpO1xuICAgICAgICB9IGVsc2Uge1xuICAgICAgICAgICAgdGhyb3cgbmV3IEVycm9yKCdJbGxlZ2FsIHN1YnN0aXR1dGlvbjogJytzdWJzdCk7XG4gICAgICAgIH1cbiAgICAgICAgcmVTdHIgKz0gdHJhbnNmb3JtUmF3KHN0cnMucmF3W2krMV0pO1xuICAgIH1cbiAgICBsZXQgZmxhZ3MgPSAnJztcbiAgICBpZiAocmVTdHIuc3RhcnRzV2l0aCgnLycpKSB7XG4gICAgICAgIGNvbnN0IGxhc3RTbGFzaEluZGV4ID0gcmVTdHIubGFzdEluZGV4T2YoJy8nKTtcbiAgICAgICAgaWYgKGxhc3RTbGFzaEluZGV4ID09PSAwKSB7XG4gICAgICAgICAgICB0aHJvdyBuZXcgRXJyb3IoJ0lmIHRoZSBgcmVgIHN0cmluZyBzdGFydHMgd2l0aCBhIHNsYXNoLCBpdCBtdXN0IGVuZCB3aXRoIGEgc2Vjb25kIHNsYXNoIGFuZCB6ZXJvIG9yIG1vcmUgZmxhZ3M6ICcrcmVTdHIpO1xuICAgICAgICB9XG4gICAgICAgIGZsYWdzID0gcmVTdHIuc2xpY2UobGFzdFNsYXNoSW5kZXgrMSk7XG4gICAgICAgIHJlU3RyID0gcmVTdHIuc2xpY2UoMSwgbGFzdFNsYXNoSW5kZXgpO1xuICAgIH1cbiAgICByZXR1cm4gbmV3IFJlZ0V4cChyZVN0ciwgZmxhZ3MpO1xufVxuXG5mdW5jdGlvbiB0cmFuc2Zvcm1SYXcoc3RyKSB7XG4gICAgcmV0dXJuIHN0ci5yZXBsYWNlKC9cXFxcYC9nLCAnYCcpO1xufVxuXG4vKipcbiAqIEFsbCBzcGVjaWFsIGNoYXJhY3RlcnMgYXJlIGVzY2FwZWQsIGJlY2F1c2UgeW91IG1heSB3YW50IHRvIHF1b3RlIHNldmVyYWwgY2hhcmFjdGVycyBpbnNpZGUgcGFyZW50aGVzZXMgb3Igc3F1YXJlIGJyYWNrZXRzLlxuICovXG5mdW5jdGlvbiBxdW90ZVRleHQodGV4dCkge1xuICAgIHJldHVybiB0ZXh0LnJlcGxhY2UoL1tcXFxcXiQuKis/KClbXFxde318PSE8PjotXS9nLCAnXFxcXCQmJyk7XG59XG5cbmNvbnN0IHJlZ2V4cCA9IChpbnB1dCkgPT4ge1xuICAgIGNvbnN0IHsgdmFsdWUsIHNjb3BlID0gW10sIGVzY2FwZSA9IGZhbHNlLCBmbGFncyA9ICcnIH0gPSBpbnB1dDtcbiAgICBjb25zdCBzZWFyY2hQb2ludGVycyA9IHNjb3BlLm1hcChmaWVsZCA9PiBwb2ludGVyKGZpZWxkKS5nZXQpO1xuICAgIGlmIChzY29wZS5sZW5ndGggPT09IDAgfHwgIXZhbHVlKSB7XG4gICAgICAgIHJldHVybiAoYXJyYXkpID0+IGFycmF5O1xuICAgIH1cbiAgICBjb25zdCByZWdleCA9IGVzY2FwZSA9PT0gdHJ1ZSA/IHJlIGAvJHt2YWx1ZX0vJHtmbGFnc31gIDogbmV3IFJlZ0V4cCh2YWx1ZSwgZmxhZ3MpO1xuICAgIHJldHVybiAoYXJyYXkpID0+IGFycmF5LmZpbHRlcihpdGVtID0+IHNlYXJjaFBvaW50ZXJzLnNvbWUocCA9PiByZWdleC50ZXN0KFN0cmluZyhwKGl0ZW0pKSkpKTtcbn07XG5cbmV4cG9ydCB7IGJhc2ljLCByZWdleHAgfTtcbiIsImltcG9ydCB7IGN1cnJ5LCB0YXAsIGNvbXBvc2UgfSBmcm9tICdzbWFydC10YWJsZS1vcGVyYXRvcnMnO1xuaW1wb3J0IHsgcG9pbnRlciB9IGZyb20gJ3NtYXJ0LXRhYmxlLWpzb24tcG9pbnRlcic7XG5pbXBvcnQgeyBlbWl0dGVyLCBwcm94eUxpc3RlbmVyIH0gZnJvbSAnc21hcnQtdGFibGUtZXZlbnRzJztcbmltcG9ydCB7IGZpbHRlciB9IGZyb20gJ3NtYXJ0LXRhYmxlLWZpbHRlcic7XG5leHBvcnQgeyBGaWx0ZXJPcGVyYXRvciB9IGZyb20gJ3NtYXJ0LXRhYmxlLWZpbHRlcic7XG5pbXBvcnQgeyBkZWZhdWx0U29ydEZhY3RvcnkgfSBmcm9tICdzbWFydC10YWJsZS1zb3J0JztcbmV4cG9ydCB7IFNvcnREaXJlY3Rpb24gfSBmcm9tICdzbWFydC10YWJsZS1zb3J0JztcbmltcG9ydCB7IHJlZ2V4cCB9IGZyb20gJ3NtYXJ0LXRhYmxlLXNlYXJjaCc7XG5cbmNvbnN0IHNsaWNlRmFjdG9yeSA9ICh7IHBhZ2UgPSAxLCBzaXplIH0gPSB7IHBhZ2U6IDEgfSkgPT4gKGFycmF5ID0gW10pID0+IHtcbiAgICBjb25zdCBhY3R1YWxTaXplID0gc2l6ZSB8fCBhcnJheS5sZW5ndGg7XG4gICAgY29uc3Qgb2Zmc2V0ID0gKHBhZ2UgLSAxKSAqIGFjdHVhbFNpemU7XG4gICAgcmV0dXJuIGFycmF5LnNsaWNlKG9mZnNldCwgb2Zmc2V0ICsgYWN0dWFsU2l6ZSk7XG59O1xuXG52YXIgU21hcnRUYWJsZUV2ZW50cztcbihmdW5jdGlvbiAoU21hcnRUYWJsZUV2ZW50cykge1xuICAgIFNtYXJ0VGFibGVFdmVudHNbXCJUT0dHTEVfU09SVFwiXSA9IFwiVE9HR0xFX1NPUlRcIjtcbiAgICBTbWFydFRhYmxlRXZlbnRzW1wiRElTUExBWV9DSEFOR0VEXCJdID0gXCJESVNQTEFZX0NIQU5HRURcIjtcbiAgICBTbWFydFRhYmxlRXZlbnRzW1wiUEFHRV9DSEFOR0VEXCJdID0gXCJDSEFOR0VfUEFHRVwiO1xuICAgIFNtYXJ0VGFibGVFdmVudHNbXCJFWEVDX0NIQU5HRURcIl0gPSBcIkVYRUNfQ0hBTkdFRFwiO1xuICAgIFNtYXJ0VGFibGVFdmVudHNbXCJGSUxURVJfQ0hBTkdFRFwiXSA9IFwiRklMVEVSX0NIQU5HRURcIjtcbiAgICBTbWFydFRhYmxlRXZlbnRzW1wiU1VNTUFSWV9DSEFOR0VEXCJdID0gXCJTVU1NQVJZX0NIQU5HRURcIjtcbiAgICBTbWFydFRhYmxlRXZlbnRzW1wiU0VBUkNIX0NIQU5HRURcIl0gPSBcIlNFQVJDSF9DSEFOR0VEXCI7XG4gICAgU21hcnRUYWJsZUV2ZW50c1tcIkVYRUNfRVJST1JcIl0gPSBcIkVYRUNfRVJST1JcIjtcbn0pKFNtYXJ0VGFibGVFdmVudHMgfHwgKFNtYXJ0VGFibGVFdmVudHMgPSB7fSkpO1xuY29uc3QgY3VycmllZFBvaW50ZXIgPSAocGF0aCkgPT4ge1xuICAgIGNvbnN0IHsgZ2V0LCBzZXQgfSA9IHBvaW50ZXIocGF0aCk7XG4gICAgcmV0dXJuIHsgZ2V0LCBzZXQ6IGN1cnJ5KHNldCkgfTtcbn07XG5jb25zdCB0YWJsZURpcmVjdGl2ZSA9ICh7IHNvcnRGYWN0b3J5LCB0YWJsZVN0YXRlLCBkYXRhLCBmaWx0ZXJGYWN0b3J5LCBzZWFyY2hGYWN0b3J5IH0pID0+IHtcbiAgICBsZXQgZmlsdGVyZWRDb3VudCA9IGRhdGEubGVuZ3RoO1xuICAgIGxldCBtYXRjaGluZ0l0ZW1zID0gZGF0YTtcbiAgICBjb25zdCB0YWJsZSA9IGVtaXR0ZXIoKTtcbiAgICBjb25zdCBzb3J0UG9pbnRlciA9IGN1cnJpZWRQb2ludGVyKCdzb3J0Jyk7XG4gICAgY29uc3Qgc2xpY2VQb2ludGVyID0gY3VycmllZFBvaW50ZXIoJ3NsaWNlJyk7XG4gICAgY29uc3QgZmlsdGVyUG9pbnRlciA9IGN1cnJpZWRQb2ludGVyKCdmaWx0ZXInKTtcbiAgICBjb25zdCBzZWFyY2hQb2ludGVyID0gY3VycmllZFBvaW50ZXIoJ3NlYXJjaCcpO1xuICAgIC8vIFdlIG5lZWQgdG8gcmVnaXN0ZXIgaW4gY2FzZSB0aGUgc3VtbWFyeSBjb21lcyBmcm9tIG91dHNpZGUgKGxpa2Ugc2VydmVyIGRhdGEpXG4gICAgdGFibGUub24oXCJTVU1NQVJZX0NIQU5HRURcIiAvKiBTVU1NQVJZX0NIQU5HRUQgKi8sICh7IGZpbHRlcmVkQ291bnQ6IGNvdW50IH0pID0+IHtcbiAgICAgICAgZmlsdGVyZWRDb3VudCA9IGNvdW50O1xuICAgIH0pO1xuICAgIGNvbnN0IHNhZmVBc3NpZ24gPSBjdXJyeSgoYmFzZSwgZXh0ZW5zaW9uKSA9PiBPYmplY3QuYXNzaWduKHt9LCBiYXNlLCBleHRlbnNpb24pKTtcbiAgICBjb25zdCBkaXNwYXRjaCA9IGN1cnJ5KHRhYmxlLmRpc3BhdGNoLCAyKTtcbiAgICBjb25zdCBkaXNwYXRjaFN1bW1hcnkgPSAoZmlsdGVyZWQpID0+IHtcbiAgICAgICAgbWF0Y2hpbmdJdGVtcyA9IGZpbHRlcmVkO1xuICAgICAgICByZXR1cm4gZGlzcGF0Y2goXCJTVU1NQVJZX0NIQU5HRURcIiAvKiBTVU1NQVJZX0NIQU5HRUQgKi8sIHtcbiAgICAgICAgICAgIHBhZ2U6IHRhYmxlU3RhdGUuc2xpY2UucGFnZSxcbiAgICAgICAgICAgIHNpemU6IHRhYmxlU3RhdGUuc2xpY2Uuc2l6ZSxcbiAgICAgICAgICAgIGZpbHRlcmVkQ291bnQ6IGZpbHRlcmVkLmxlbmd0aFxuICAgICAgICB9KTtcbiAgICB9O1xuICAgIGNvbnN0IGV4ZWMgPSAoeyBwcm9jZXNzaW5nRGVsYXkgPSAyMCB9ID0geyBwcm9jZXNzaW5nRGVsYXk6IDIwIH0pID0+IHtcbiAgICAgICAgdGFibGUuZGlzcGF0Y2goXCJFWEVDX0NIQU5HRURcIiAvKiBFWEVDX0NIQU5HRUQgKi8sIHsgd29ya2luZzogdHJ1ZSB9KTtcbiAgICAgICAgc2V0VGltZW91dCgoKSA9PiB7XG4gICAgICAgICAgICB0cnkge1xuICAgICAgICAgICAgICAgIGNvbnN0IGZpbHRlckZ1bmMgPSBmaWx0ZXJGYWN0b3J5KGZpbHRlclBvaW50ZXIuZ2V0KHRhYmxlU3RhdGUpKTtcbiAgICAgICAgICAgICAgICBjb25zdCBzZWFyY2hGdW5jID0gc2VhcmNoRmFjdG9yeShzZWFyY2hQb2ludGVyLmdldCh0YWJsZVN0YXRlKSk7XG4gICAgICAgICAgICAgICAgY29uc3Qgc29ydEZ1bmMgPSBzb3J0RmFjdG9yeShzb3J0UG9pbnRlci5nZXQodGFibGVTdGF0ZSkpO1xuICAgICAgICAgICAgICAgIGNvbnN0IHNsaWNlRnVuYyA9IHNsaWNlRmFjdG9yeShzbGljZVBvaW50ZXIuZ2V0KHRhYmxlU3RhdGUpKTtcbiAgICAgICAgICAgICAgICBjb25zdCBleGVjRnVuYyA9IGNvbXBvc2UoZmlsdGVyRnVuYywgc2VhcmNoRnVuYywgdGFwKGRpc3BhdGNoU3VtbWFyeSksIHNvcnRGdW5jLCBzbGljZUZ1bmMpO1xuICAgICAgICAgICAgICAgIGNvbnN0IGRpc3BsYXllZCA9IGV4ZWNGdW5jKGRhdGEpO1xuICAgICAgICAgICAgICAgIHRhYmxlLmRpc3BhdGNoKFwiRElTUExBWV9DSEFOR0VEXCIgLyogRElTUExBWV9DSEFOR0VEICovLCBkaXNwbGF5ZWQubWFwKGQgPT4gKHtcbiAgICAgICAgICAgICAgICAgICAgaW5kZXg6IGRhdGEuaW5kZXhPZihkKSxcbiAgICAgICAgICAgICAgICAgICAgdmFsdWU6IGRcbiAgICAgICAgICAgICAgICB9KSkpO1xuICAgICAgICAgICAgfVxuICAgICAgICAgICAgY2F0Y2ggKGVycikge1xuICAgICAgICAgICAgICAgIHRhYmxlLmRpc3BhdGNoKFwiRVhFQ19FUlJPUlwiIC8qIEVYRUNfRVJST1IgKi8sIGVycik7XG4gICAgICAgICAgICB9XG4gICAgICAgICAgICBmaW5hbGx5IHtcbiAgICAgICAgICAgICAgICB0YWJsZS5kaXNwYXRjaChcIkVYRUNfQ0hBTkdFRFwiIC8qIEVYRUNfQ0hBTkdFRCAqLywgeyB3b3JraW5nOiBmYWxzZSB9KTtcbiAgICAgICAgICAgIH1cbiAgICAgICAgfSwgcHJvY2Vzc2luZ0RlbGF5KTtcbiAgICB9O1xuICAgIGNvbnN0IHVwZGF0ZVRhYmxlU3RhdGUgPSBjdXJyeSgocHRlciwgZXYsIG5ld1BhcnRpYWxTdGF0ZSkgPT4gY29tcG9zZShzYWZlQXNzaWduKHB0ZXIuZ2V0KHRhYmxlU3RhdGUpKSwgdGFwKGRpc3BhdGNoKGV2KSksIHB0ZXIuc2V0KHRhYmxlU3RhdGUpKShuZXdQYXJ0aWFsU3RhdGUpKTtcbiAgICBjb25zdCByZXNldFRvRmlyc3RQYWdlID0gKCkgPT4gdXBkYXRlVGFibGVTdGF0ZShzbGljZVBvaW50ZXIsIFwiQ0hBTkdFX1BBR0VcIiAvKiBQQUdFX0NIQU5HRUQgKi8sIHsgcGFnZTogMSB9KTtcbiAgICBjb25zdCB0YWJsZU9wZXJhdGlvbiA9IChwdGVyLCBldikgPT4gY29tcG9zZSh1cGRhdGVUYWJsZVN0YXRlKHB0ZXIsIGV2KSwgcmVzZXRUb0ZpcnN0UGFnZSwgKCkgPT4gdGFibGUuZXhlYygpIC8vIFdlIHdyYXAgd2l0aGluIGEgZnVuY3Rpb24gc28gdGFibGUuZXhlYyBjYW4gYmUgb3ZlcndyaXR0ZW4gKHdoZW4gdXNpbmcgd2l0aCBhIHNlcnZlciBmb3IgZXhhbXBsZSlcbiAgICApO1xuICAgIGNvbnN0IGFwaSA9IHtcbiAgICAgICAgc29ydDogdGFibGVPcGVyYXRpb24oc29ydFBvaW50ZXIsIFwiVE9HR0xFX1NPUlRcIiAvKiBUT0dHTEVfU09SVCAqLyksXG4gICAgICAgIGZpbHRlcjogdGFibGVPcGVyYXRpb24oZmlsdGVyUG9pbnRlciwgXCJGSUxURVJfQ0hBTkdFRFwiIC8qIEZJTFRFUl9DSEFOR0VEICovKSxcbiAgICAgICAgc2VhcmNoOiB0YWJsZU9wZXJhdGlvbihzZWFyY2hQb2ludGVyLCBcIlNFQVJDSF9DSEFOR0VEXCIgLyogU0VBUkNIX0NIQU5HRUQgKi8pLFxuICAgICAgICBzbGljZTogY29tcG9zZSh1cGRhdGVUYWJsZVN0YXRlKHNsaWNlUG9pbnRlciwgXCJDSEFOR0VfUEFHRVwiIC8qIFBBR0VfQ0hBTkdFRCAqLyksICgpID0+IHRhYmxlLmV4ZWMoKSksXG4gICAgICAgIGV4ZWMsXG4gICAgICAgIGFzeW5jIGV2YWwoc3RhdGUgPSB0YWJsZVN0YXRlKSB7XG4gICAgICAgICAgICBjb25zdCBzb3J0RnVuYyA9IHNvcnRGYWN0b3J5KHNvcnRQb2ludGVyLmdldChzdGF0ZSkpO1xuICAgICAgICAgICAgY29uc3Qgc2VhcmNoRnVuYyA9IHNlYXJjaEZhY3Rvcnkoc2VhcmNoUG9pbnRlci5nZXQoc3RhdGUpKTtcbiAgICAgICAgICAgIGNvbnN0IGZpbHRlckZ1bmMgPSBmaWx0ZXJGYWN0b3J5KGZpbHRlclBvaW50ZXIuZ2V0KHN0YXRlKSk7XG4gICAgICAgICAgICBjb25zdCBzbGljZUZ1bmMgPSBzbGljZUZhY3Rvcnkoc2xpY2VQb2ludGVyLmdldChzdGF0ZSkpO1xuICAgICAgICAgICAgY29uc3QgZXhlY0Z1bmMgPSBjb21wb3NlKGZpbHRlckZ1bmMsIHNlYXJjaEZ1bmMsIHNvcnRGdW5jLCBzbGljZUZ1bmMpO1xuICAgICAgICAgICAgcmV0dXJuIGV4ZWNGdW5jKGRhdGEpLm1hcChkID0+ICh7IGluZGV4OiBkYXRhLmluZGV4T2YoZCksIHZhbHVlOiBkIH0pKTtcbiAgICAgICAgfSxcbiAgICAgICAgb25EaXNwbGF5Q2hhbmdlKGZuKSB7XG4gICAgICAgICAgICB0YWJsZS5vbihcIkRJU1BMQVlfQ0hBTkdFRFwiIC8qIERJU1BMQVlfQ0hBTkdFRCAqLywgZm4pO1xuICAgICAgICB9LFxuICAgICAgICBnZXRUYWJsZVN0YXRlKCkge1xuICAgICAgICAgICAgY29uc3Qgc29ydCA9IE9iamVjdC5hc3NpZ24oe30sIHRhYmxlU3RhdGUuc29ydCk7XG4gICAgICAgICAgICBjb25zdCBzZWFyY2ggPSBPYmplY3QuYXNzaWduKHt9LCB0YWJsZVN0YXRlLnNlYXJjaCk7XG4gICAgICAgICAgICBjb25zdCBzbGljZSA9IE9iamVjdC5hc3NpZ24oe30sIHRhYmxlU3RhdGUuc2xpY2UpO1xuICAgICAgICAgICAgY29uc3QgZmlsdGVyJCQxID0ge307XG4gICAgICAgICAgICBmb3IgKGNvbnN0IHByb3Agb2YgT2JqZWN0LmdldE93blByb3BlcnR5TmFtZXModGFibGVTdGF0ZS5maWx0ZXIpKSB7XG4gICAgICAgICAgICAgICAgZmlsdGVyJCQxW3Byb3BdID0gdGFibGVTdGF0ZS5maWx0ZXJbcHJvcF0ubWFwKHYgPT4gT2JqZWN0LmFzc2lnbih7fSwgdikpO1xuICAgICAgICAgICAgfVxuICAgICAgICAgICAgcmV0dXJuIHsgc29ydCwgc2VhcmNoLCBzbGljZSwgZmlsdGVyOiBmaWx0ZXIkJDEgfTtcbiAgICAgICAgfSxcbiAgICAgICAgZ2V0TWF0Y2hpbmdJdGVtcygpIHtcbiAgICAgICAgICAgIHJldHVybiBbLi4ubWF0Y2hpbmdJdGVtc107XG4gICAgICAgIH1cbiAgICB9O1xuICAgIGNvbnN0IGluc3RhbmNlID0gT2JqZWN0LmFzc2lnbih0YWJsZSwgYXBpKTtcbiAgICBPYmplY3QuZGVmaW5lUHJvcGVydGllcyhpbnN0YW5jZSwge1xuICAgICAgICBmaWx0ZXJlZENvdW50OiB7XG4gICAgICAgICAgICBnZXQoKSB7XG4gICAgICAgICAgICAgICAgcmV0dXJuIGZpbHRlcmVkQ291bnQ7XG4gICAgICAgICAgICB9XG4gICAgICAgIH0sXG4gICAgICAgIGxlbmd0aDoge1xuICAgICAgICAgICAgZ2V0KCkge1xuICAgICAgICAgICAgICAgIHJldHVybiBkYXRhLmxlbmd0aDtcbiAgICAgICAgICAgIH1cbiAgICAgICAgfVxuICAgIH0pO1xuICAgIHJldHVybiBpbnN0YW5jZTtcbn07XG5cbmNvbnN0IGZpbHRlckxpc3RlbmVyID0gcHJveHlMaXN0ZW5lcih7IFtcIkZJTFRFUl9DSEFOR0VEXCIgLyogRklMVEVSX0NIQU5HRUQgKi9dOiAnb25GaWx0ZXJDaGFuZ2UnIH0pO1xuLy8gdG9kbyBleHBvc2UgYW5kIHJlLWV4cG9ydCBmcm9tIHNtYXJ0LXRhYmxlLWZpbHRlclxudmFyIEZpbHRlclR5cGU7XG4oZnVuY3Rpb24gKEZpbHRlclR5cGUpIHtcbiAgICBGaWx0ZXJUeXBlW1wiQk9PTEVBTlwiXSA9IFwiYm9vbGVhblwiO1xuICAgIEZpbHRlclR5cGVbXCJOVU1CRVJcIl0gPSBcIm51bWJlclwiO1xuICAgIEZpbHRlclR5cGVbXCJEQVRFXCJdID0gXCJkYXRlXCI7XG4gICAgRmlsdGVyVHlwZVtcIlNUUklOR1wiXSA9IFwic3RyaW5nXCI7XG59KShGaWx0ZXJUeXBlIHx8IChGaWx0ZXJUeXBlID0ge30pKTtcbmNvbnN0IGZpbHRlckRpcmVjdGl2ZSA9ICh7IHRhYmxlLCBwb2ludGVyOiBwb2ludGVyJCQxLCBvcGVyYXRvciA9IFwiaW5jbHVkZXNcIiAvKiBJTkNMVURFUyAqLywgdHlwZSA9IFwic3RyaW5nXCIgLyogU1RSSU5HICovIH0pID0+IHtcbiAgICBjb25zdCBwcm94eSA9IGZpbHRlckxpc3RlbmVyKHsgZW1pdHRlcjogdGFibGUgfSk7XG4gICAgcmV0dXJuIE9iamVjdC5hc3NpZ24oe1xuICAgICAgICBmaWx0ZXIoaW5wdXQpIHtcbiAgICAgICAgICAgIGNvbnN0IGZpbHRlckNvbmYgPSB7XG4gICAgICAgICAgICAgICAgW3BvaW50ZXIkJDFdOiBbXG4gICAgICAgICAgICAgICAgICAgIHtcbiAgICAgICAgICAgICAgICAgICAgICAgIHZhbHVlOiBpbnB1dCxcbiAgICAgICAgICAgICAgICAgICAgICAgIG9wZXJhdG9yLFxuICAgICAgICAgICAgICAgICAgICAgICAgdHlwZVxuICAgICAgICAgICAgICAgICAgICB9XG4gICAgICAgICAgICAgICAgXVxuICAgICAgICAgICAgfTtcbiAgICAgICAgICAgIHJldHVybiB0YWJsZS5maWx0ZXIoZmlsdGVyQ29uZik7XG4gICAgICAgIH0sXG4gICAgICAgIHN0YXRlKCkge1xuICAgICAgICAgICAgcmV0dXJuIHRhYmxlLmdldFRhYmxlU3RhdGUoKS5maWx0ZXI7XG4gICAgICAgIH1cbiAgICB9LCBwcm94eSk7XG59O1xuXG5jb25zdCBzZWFyY2hMaXN0ZW5lciA9IHByb3h5TGlzdGVuZXIoeyBbXCJTRUFSQ0hfQ0hBTkdFRFwiIC8qIFNFQVJDSF9DSEFOR0VEICovXTogJ29uU2VhcmNoQ2hhbmdlJyB9KTtcbmNvbnN0IHNlYXJjaERpcmVjdGl2ZSA9ICh7IHRhYmxlLCBzY29wZSA9IFtdIH0pID0+IHtcbiAgICBjb25zdCBwcm94eSA9IHNlYXJjaExpc3RlbmVyKHsgZW1pdHRlcjogdGFibGUgfSk7XG4gICAgcmV0dXJuIE9iamVjdC5hc3NpZ24ocHJveHksIHtcbiAgICAgICAgc2VhcmNoKGlucHV0LCBvcHRzID0ge30pIHtcbiAgICAgICAgICAgIHJldHVybiB0YWJsZS5zZWFyY2goT2JqZWN0LmFzc2lnbih7fSwgeyB2YWx1ZTogaW5wdXQsIHNjb3BlIH0sIG9wdHMpKTtcbiAgICAgICAgfSxcbiAgICAgICAgc3RhdGUoKSB7XG4gICAgICAgICAgICByZXR1cm4gdGFibGUuZ2V0VGFibGVTdGF0ZSgpLnNlYXJjaDtcbiAgICAgICAgfVxuICAgIH0sIHByb3h5KTtcbn07XG5cbmNvbnN0IHNsaWNlTGlzdGVuZXIgPSBwcm94eUxpc3RlbmVyKHtcbiAgICBbXCJDSEFOR0VfUEFHRVwiIC8qIFBBR0VfQ0hBTkdFRCAqL106ICdvblBhZ2VDaGFuZ2UnLFxuICAgIFtcIlNVTU1BUllfQ0hBTkdFRFwiIC8qIFNVTU1BUllfQ0hBTkdFRCAqL106ICdvblN1bW1hcnlDaGFuZ2UnXG59KTtcbmNvbnN0IHBhZ2luYXRpb25EaXJlY3RpdmUgPSAoeyB0YWJsZSB9KSA9PiB7XG4gICAgbGV0IHsgc2xpY2U6IHsgcGFnZTogY3VycmVudFBhZ2UsIHNpemU6IGN1cnJlbnRTaXplIH0gfSA9IHRhYmxlLmdldFRhYmxlU3RhdGUoKTtcbiAgICBsZXQgaXRlbUxpc3RMZW5ndGggPSB0YWJsZS5maWx0ZXJlZENvdW50O1xuICAgIGNvbnN0IHByb3h5ID0gc2xpY2VMaXN0ZW5lcih7IGVtaXR0ZXI6IHRhYmxlIH0pO1xuICAgIGNvbnN0IGFwaSA9IHtcbiAgICAgICAgc2VsZWN0UGFnZShwKSB7XG4gICAgICAgICAgICByZXR1cm4gdGFibGUuc2xpY2UoeyBwYWdlOiBwLCBzaXplOiBjdXJyZW50U2l6ZSB9KTtcbiAgICAgICAgfSxcbiAgICAgICAgc2VsZWN0TmV4dFBhZ2UoKSB7XG4gICAgICAgICAgICByZXR1cm4gYXBpLnNlbGVjdFBhZ2UoY3VycmVudFBhZ2UgKyAxKTtcbiAgICAgICAgfSxcbiAgICAgICAgc2VsZWN0UHJldmlvdXNQYWdlKCkge1xuICAgICAgICAgICAgcmV0dXJuIGFwaS5zZWxlY3RQYWdlKGN1cnJlbnRQYWdlIC0gMSk7XG4gICAgICAgIH0sXG4gICAgICAgIGNoYW5nZVBhZ2VTaXplKHNpemUpIHtcbiAgICAgICAgICAgIHJldHVybiB0YWJsZS5zbGljZSh7IHBhZ2U6IDEsIHNpemUgfSk7XG4gICAgICAgIH0sXG4gICAgICAgIGlzUHJldmlvdXNQYWdlRW5hYmxlZCgpIHtcbiAgICAgICAgICAgIHJldHVybiBjdXJyZW50UGFnZSA+IDE7XG4gICAgICAgIH0sXG4gICAgICAgIGlzTmV4dFBhZ2VFbmFibGVkKCkge1xuICAgICAgICAgICAgcmV0dXJuIE1hdGguY2VpbChpdGVtTGlzdExlbmd0aCAvIGN1cnJlbnRTaXplKSA+IGN1cnJlbnRQYWdlO1xuICAgICAgICB9LFxuICAgICAgICBzdGF0ZSgpIHtcbiAgICAgICAgICAgIHJldHVybiBPYmplY3QuYXNzaWduKHRhYmxlLmdldFRhYmxlU3RhdGUoKS5zbGljZSwgeyBmaWx0ZXJlZENvdW50OiBpdGVtTGlzdExlbmd0aCB9KTtcbiAgICAgICAgfVxuICAgIH07XG4gICAgY29uc3QgZGlyZWN0aXZlID0gT2JqZWN0LmFzc2lnbihhcGksIHByb3h5KTtcbiAgICBkaXJlY3RpdmUub25TdW1tYXJ5Q2hhbmdlKCh7IHBhZ2U6IHAsIHNpemU6IHMsIGZpbHRlcmVkQ291bnQgfSkgPT4ge1xuICAgICAgICBjdXJyZW50UGFnZSA9IHA7XG4gICAgICAgIGN1cnJlbnRTaXplID0gcztcbiAgICAgICAgaXRlbUxpc3RMZW5ndGggPSBmaWx0ZXJlZENvdW50O1xuICAgIH0pO1xuICAgIHJldHVybiBkaXJlY3RpdmU7XG59O1xuXG5jb25zdCBkZWJvdW5jZSA9IChmbiwgdGltZSkgPT4ge1xuICAgIGxldCB0aW1lciA9IG51bGw7XG4gICAgcmV0dXJuICguLi5hcmdzKSA9PiB7XG4gICAgICAgIGlmICh0aW1lciAhPT0gbnVsbCkge1xuICAgICAgICAgICAgY2xlYXJUaW1lb3V0KHRpbWVyKTtcbiAgICAgICAgfVxuICAgICAgICB0aW1lciA9IHNldFRpbWVvdXQoKCkgPT4gZm4oLi4uYXJncyksIHRpbWUpO1xuICAgIH07XG59O1xuY29uc3Qgc29ydExpc3RlbmVycyA9IHByb3h5TGlzdGVuZXIoeyBbXCJUT0dHTEVfU09SVFwiIC8qIFRPR0dMRV9TT1JUICovXTogJ29uU29ydFRvZ2dsZScgfSk7XG5jb25zdCBkaXJlY3Rpb25zID0gW1wiYXNjXCIgLyogQVNDICovLCBcImRlc2NcIiAvKiBERVNDICovXTtcbmNvbnN0IHNvcnREaXJlY3RpdmUgPSAoeyBwb2ludGVyOiBwb2ludGVyJCQxLCB0YWJsZSwgY3ljbGUgPSBmYWxzZSwgZGVib3VuY2VUaW1lID0gMCB9KSA9PiB7XG4gICAgY29uc3QgY3ljbGVEaXJlY3Rpb25zID0gY3ljbGUgPT09IHRydWUgPyBbXCJub25lXCIgLyogTk9ORSAqL10uY29uY2F0KGRpcmVjdGlvbnMpIDogWy4uLmRpcmVjdGlvbnNdLnJldmVyc2UoKTtcbiAgICBjb25zdCBjb21taXQgPSBkZWJvdW5jZSh0YWJsZS5zb3J0LCBkZWJvdW5jZVRpbWUpO1xuICAgIGxldCBoaXQgPSAwO1xuICAgIGNvbnN0IHByb3h5ID0gc29ydExpc3RlbmVycyh7IGVtaXR0ZXI6IHRhYmxlIH0pO1xuICAgIGNvbnN0IGRpcmVjdGl2ZSA9IE9iamVjdC5hc3NpZ24oe1xuICAgICAgICB0b2dnbGUoKSB7XG4gICAgICAgICAgICBoaXQrKztcbiAgICAgICAgICAgIGNvbnN0IGRpcmVjdGlvbiA9IGN5Y2xlRGlyZWN0aW9uc1toaXQgJSBjeWNsZURpcmVjdGlvbnMubGVuZ3RoXTtcbiAgICAgICAgICAgIHJldHVybiBjb21taXQoeyBwb2ludGVyOiBwb2ludGVyJCQxLCBkaXJlY3Rpb24gfSk7XG4gICAgICAgIH0sXG4gICAgICAgIHN0YXRlKCkge1xuICAgICAgICAgICAgcmV0dXJuIHRhYmxlLmdldFRhYmxlU3RhdGUoKS5zb3J0O1xuICAgICAgICB9XG4gICAgfSwgcHJveHkpO1xuICAgIGRpcmVjdGl2ZS5vblNvcnRUb2dnbGUoKHsgcG9pbnRlcjogcCB9KSA9PiB7XG4gICAgICAgIGhpdCA9IHBvaW50ZXIkJDEgIT09IHAgPyAwIDogaGl0O1xuICAgIH0pO1xuICAgIGNvbnN0IHsgcG9pbnRlcjogc3RhdGVQb2ludGVyLCBkaXJlY3Rpb24gPSBcImFzY1wiIC8qIEFTQyAqLyB9ID0gZGlyZWN0aXZlLnN0YXRlKCk7XG4gICAgaGl0ID0gc3RhdGVQb2ludGVyID09PSBwb2ludGVyJCQxID8gKGRpcmVjdGlvbiA9PT0gXCJhc2NcIiAvKiBBU0MgKi8gPyAxIDogMikgOiAwO1xuICAgIHJldHVybiBkaXJlY3RpdmU7XG59O1xuXG5jb25zdCBzdW1tYXJ5TGlzdGVuZXIgPSBwcm94eUxpc3RlbmVyKHsgW1wiU1VNTUFSWV9DSEFOR0VEXCIgLyogU1VNTUFSWV9DSEFOR0VEICovXTogJ29uU3VtbWFyeUNoYW5nZScgfSk7XG5jb25zdCBzdW1tYXJ5RGlyZWN0aXZlID0gKHsgdGFibGUgfSkgPT4gc3VtbWFyeUxpc3RlbmVyKHsgZW1pdHRlcjogdGFibGUgfSk7XG5cbmNvbnN0IGV4ZWN1dGlvbkxpc3RlbmVyID0gcHJveHlMaXN0ZW5lcih7IFtcIkVYRUNfQ0hBTkdFRFwiIC8qIEVYRUNfQ0hBTkdFRCAqL106ICdvbkV4ZWN1dGlvbkNoYW5nZScgfSk7XG5jb25zdCB3b3JraW5nSW5kaWNhdG9yRGlyZWN0aXZlID0gKHsgdGFibGUgfSkgPT4gZXhlY3V0aW9uTGlzdGVuZXIoeyBlbWl0dGVyOiB0YWJsZSB9KTtcblxuY29uc3QgZGVmYXVsdFRhYmxlU3RhdGUgPSAoKSA9PiAoeyBzb3J0OiB7fSwgc2xpY2U6IHsgcGFnZTogMSB9LCBmaWx0ZXI6IHt9LCBzZWFyY2g6IHt9IH0pO1xuY29uc3Qgc21hcnRUYWJsZSA9ICh7IHNvcnRGYWN0b3J5ID0gZGVmYXVsdFNvcnRGYWN0b3J5LCBmaWx0ZXJGYWN0b3J5ID0gZmlsdGVyLCBzZWFyY2hGYWN0b3J5ID0gcmVnZXhwLCB0YWJsZVN0YXRlID0gZGVmYXVsdFRhYmxlU3RhdGUoKSwgZGF0YSA9IFtdIH0gPSB7XG4gICAgc29ydEZhY3Rvcnk6IGRlZmF1bHRTb3J0RmFjdG9yeSxcbiAgICBmaWx0ZXJGYWN0b3J5OiBmaWx0ZXIsXG4gICAgc2VhcmNoRmFjdG9yeTogcmVnZXhwLFxuICAgIHRhYmxlU3RhdGU6IGRlZmF1bHRUYWJsZVN0YXRlKCksXG4gICAgZGF0YTogW11cbn0sIC4uLnRhYmxlRXh0ZW5zaW9ucykgPT4ge1xuICAgIGNvbnN0IGNvcmVUYWJsZSA9IHRhYmxlRGlyZWN0aXZlKHsgc29ydEZhY3RvcnksIGZpbHRlckZhY3RvcnksIHRhYmxlU3RhdGUsIGRhdGEsIHNlYXJjaEZhY3RvcnkgfSk7XG4gICAgcmV0dXJuIHRhYmxlRXh0ZW5zaW9ucy5yZWR1Y2UoKGFjY3VtdWxhdG9yLCBuZXdkaXIpID0+IE9iamVjdC5hc3NpZ24oYWNjdW11bGF0b3IsIG5ld2Rpcih7XG4gICAgICAgIHNvcnRGYWN0b3J5LFxuICAgICAgICBmaWx0ZXJGYWN0b3J5LFxuICAgICAgICBzZWFyY2hGYWN0b3J5LFxuICAgICAgICB0YWJsZVN0YXRlLFxuICAgICAgICBkYXRhLFxuICAgICAgICB0YWJsZTogY29yZVRhYmxlXG4gICAgfSkpLCBjb3JlVGFibGUpO1xufTtcblxuZXhwb3J0IHsgc21hcnRUYWJsZSwgRmlsdGVyVHlwZSwgZmlsdGVyRGlyZWN0aXZlLCBzZWFyY2hEaXJlY3RpdmUsIHBhZ2luYXRpb25EaXJlY3RpdmUsIHNvcnREaXJlY3RpdmUsIHN1bW1hcnlEaXJlY3RpdmUsIFNtYXJ0VGFibGVFdmVudHMsIHRhYmxlRGlyZWN0aXZlLCB3b3JraW5nSW5kaWNhdG9yRGlyZWN0aXZlLCBzbGljZUZhY3RvcnkgfTtcbiIsImltcG9ydCB7d29ya2luZ0luZGljYXRvckRpcmVjdGl2ZX0gZnJvbSAnc21hcnQtdGFibGUtY29yZSc7XG5cbmV4cG9ydCBkZWZhdWx0IGZ1bmN0aW9uICh7dGFibGUsIGVsfSkge1xuICBjb25zdCBjb21wb25lbnQgPSB3b3JraW5nSW5kaWNhdG9yRGlyZWN0aXZlKHt0YWJsZX0pO1xuICBjb21wb25lbnQub25FeGVjdXRpb25DaGFuZ2UoZnVuY3Rpb24gKHt3b3JraW5nfSkge1xuICAgIGVsLmNsYXNzTGlzdC5yZW1vdmUoJ3N0LXdvcmtpbmcnKTtcbiAgICBpZiAod29ya2luZyA9PT0gdHJ1ZSkge1xuICAgICAgZWwuY2xhc3NMaXN0LmFkZCgnc3Qtd29ya2luZycpO1xuICAgIH1cbiAgfSk7XG4gIHJldHVybiBjb21wb25lbnQ7XG59OyIsImltcG9ydCB7c29ydERpcmVjdGl2ZX0gZnJvbSAnc21hcnQtdGFibGUtY29yZSc7XG5cbmV4cG9ydCBkZWZhdWx0IGZ1bmN0aW9uICh7ZWwsIHRhYmxlLCBjb25mID0ge319KSB7XG4gIGNvbnN0IHBvaW50ZXIgPSBjb25mLnBvaW50ZXIgfHwgZWwuZ2V0QXR0cmlidXRlKCdkYXRhLXN0LXNvcnQnKTtcbiAgY29uc3QgY3ljbGUgPSBjb25mLmN5Y2xlIHx8IGVsLmhhc0F0dHJpYnV0ZSgnZGF0YS1zdC1zb3J0LWN5Y2xlJyk7XG4gIGNvbnN0IGNvbXBvbmVudCA9IHNvcnREaXJlY3RpdmUoe3BvaW50ZXIsIHRhYmxlLCBjeWNsZX0pO1xuICBjb21wb25lbnQub25Tb3J0VG9nZ2xlKCh7cG9pbnRlcjpjdXJyZW50UG9pbnRlciwgZGlyZWN0aW9ufSkgPT4ge1xuICAgIGVsLmNsYXNzTGlzdC5yZW1vdmUoJ3N0LXNvcnQtYXNjJywgJ3N0LXNvcnQtZGVzYycpO1xuICAgIGlmIChwb2ludGVyID09PSBjdXJyZW50UG9pbnRlciAmJiBkaXJlY3Rpb24gIT09ICdub25lJykge1xuICAgICAgY29uc3QgY2xhc3NOYW1lID0gZGlyZWN0aW9uID09PSAnYXNjJyA/ICdzdC1zb3J0LWFzYycgOiAnc3Qtc29ydC1kZXNjJztcbiAgICAgIGVsLmNsYXNzTGlzdC5hZGQoY2xhc3NOYW1lKTtcbiAgICB9XG4gIH0pO1xuICBjb25zdCBldmVudExpc3RlbmVyID0gZXYgPT4gY29tcG9uZW50LnRvZ2dsZSgpO1xuICBlbC5hZGRFdmVudExpc3RlbmVyKCdjbGljaycsIGV2ZW50TGlzdGVuZXIpO1xuICByZXR1cm4gY29tcG9uZW50O1xufSIsImV4cG9ydCBmdW5jdGlvbiBkZWJvdW5jZSAoZm4sIGRlbGF5KSB7XG4gIGxldCB0aW1lb3V0SWQ7XG4gIHJldHVybiAoZXYpID0+IHtcbiAgICBpZiAodGltZW91dElkKSB7XG4gICAgICB3aW5kb3cuY2xlYXJUaW1lb3V0KHRpbWVvdXRJZCk7XG4gICAgfVxuICAgIHRpbWVvdXRJZCA9IHdpbmRvdy5zZXRUaW1lb3V0KGZ1bmN0aW9uICgpIHtcbiAgICAgIGZuKGV2KTtcbiAgICB9LCBkZWxheSk7XG4gIH07XG59OyIsImltcG9ydCB7ZmlsdGVyRGlyZWN0aXZlfSBmcm9tICdzbWFydC10YWJsZS1jb3JlJztcbmltcG9ydCB7ZGVib3VuY2V9IGZyb20gJy4vaGVscGVycydcblxuZXhwb3J0IGRlZmF1bHQgZnVuY3Rpb24gZmlsdGVySW5wdXQgKHt0YWJsZSwgZWwsIGRlbGF5ID0gNDAwLCBjb25mID0ge319KSB7XG4gIGNvbnN0IHBvaW50ZXIgPSBjb25mLnBvaW50ZXIgfHwgZWwuZ2V0QXR0cmlidXRlKCdkYXRhLXN0LWZpbHRlcicpO1xuICBjb25zdCBvcGVyYXRvciA9IGNvbmYub3BlcmF0b3IgfHwgZWwuZ2V0QXR0cmlidXRlKCdkYXRhLXN0LWZpbHRlci1vcGVyYXRvcicpIHx8ICdpbmNsdWRlcyc7XG4gIGNvbnN0IGVsVHlwZSA9IGVsLmhhc0F0dHJpYnV0ZSgndHlwZScpID8gZWwuZ2V0QXR0cmlidXRlKCd0eXBlJykgOiAnc3RyaW5nJztcbiAgbGV0IHR5cGUgPSBjb25mLnR5cGUgfHwgZWwuZ2V0QXR0cmlidXRlKCdkYXRhLXN0LWZpbHRlci10eXBlJyk7XG4gIGlmICghdHlwZSkge1xuICAgIHR5cGUgPSBbJ2RhdGUnLCAnbnVtYmVyJ10uaW5jbHVkZXMoZWxUeXBlKSA/IGVsVHlwZSA6ICdzdHJpbmcnO1xuICB9XG4gIGNvbnN0IGNvbXBvbmVudCA9IGZpbHRlckRpcmVjdGl2ZSh7dGFibGUsIHBvaW50ZXIsIHR5cGUsIG9wZXJhdG9yfSk7XG4gIGNvbnN0IGV2ZW50TGlzdGVuZXIgPSBkZWJvdW5jZShldiA9PiBjb21wb25lbnQuZmlsdGVyKGVsLnZhbHVlKSwgZGVsYXkpO1xuICBlbC5hZGRFdmVudExpc3RlbmVyKCdpbnB1dCcsIGV2ZW50TGlzdGVuZXIpO1xuICBpZiAoZWwudGFnTmFtZSA9PT0gJ1NFTEVDVCcpIHtcbiAgICBlbC5hZGRFdmVudExpc3RlbmVyKCdjaGFuZ2UnLCBldmVudExpc3RlbmVyKTtcbiAgfVxuICByZXR1cm4gY29tcG9uZW50O1xufTsiLCJpbXBvcnQge3NlYXJjaERpcmVjdGl2ZX0gZnJvbSAnc21hcnQtdGFibGUtY29yZSc7XG5pbXBvcnQge2RlYm91bmNlfSBmcm9tICcuL2hlbHBlcnMnO1xuXG5leHBvcnQgZGVmYXVsdCBmdW5jdGlvbiAoe2VsLCB0YWJsZSwgZGVsYXkgPSA0MDAsIGNvbmYgPSB7fX0pIHtcbiAgY29uc3Qgc2NvcGUgPSBjb25mLnNjb3BlIHx8IChlbC5nZXRBdHRyaWJ1dGUoJ2RhdGEtc3Qtc2VhcmNoJykgfHwgJycpLnNwbGl0KCcsJykubWFwKHMgPT4gcy50cmltKCkpO1xuICBjb25zdCBjb21wb25lbnQgPSBzZWFyY2hEaXJlY3RpdmUoe3RhYmxlLCBzY29wZX0pO1xuICBjb25zdCBldmVudExpc3RlbmVyID0gZGVib3VuY2UoZXYgPT4ge1xuICAgIGNvbXBvbmVudC5zZWFyY2goZWwudmFsdWUpO1xuICB9LCBkZWxheSk7XG4gIGVsLmFkZEV2ZW50TGlzdGVuZXIoJ2lucHV0JywgZXZlbnRMaXN0ZW5lcik7XG59OyIsImltcG9ydCBsb2FkaW5nIGZyb20gJy4vbG9hZGluZ0luZGljYXRvcic7XG5pbXBvcnQgc29ydCBmcm9tICAnLi9zb3J0JztcbmltcG9ydCBmaWx0ZXIgZnJvbSAnLi9maWx0ZXJzJ1xuaW1wb3J0IHNlYXJjaElucHV0IGZyb20gJy4vc2VhcmNoJ1xuXG5leHBvcnQgZGVmYXVsdCBmdW5jdGlvbiAoe2VsLCB0YWJsZX0pIHtcbiAgLy8gYm9vdFxuICBbLi4uZWwucXVlcnlTZWxlY3RvckFsbCgnW2RhdGEtc3Qtc29ydF0nKV0uZm9yRWFjaChlbCA9PiBzb3J0KHtlbCwgdGFibGV9KSk7XG4gIFsuLi5lbC5xdWVyeVNlbGVjdG9yQWxsKCdbZGF0YS1zdC1sb2FkaW5nLWluZGljYXRvcl0nKV0uZm9yRWFjaChlbCA9PiBsb2FkaW5nKHtlbCwgdGFibGV9KSk7XG4gIFsuLi5lbC5xdWVyeVNlbGVjdG9yQWxsKCdbZGF0YS1zdC1zZWFyY2hdJyldLmZvckVhY2goZWwgPT4gc2VhcmNoSW5wdXQoe2VsLCB0YWJsZX0pKTtcbiAgWy4uLmVsLnF1ZXJ5U2VsZWN0b3JBbGwoJ1tkYXRhLXN0LWZpbHRlcl0nKV0uZm9yRWFjaChlbCA9PiBmaWx0ZXIoe2VsLCB0YWJsZX0pKTtcblxuICAvL2V4dGVuc2lvblxuICBjb25zdCB0YWJsZURpc3BsYXlDaGFuZ2UgPSB0YWJsZS5vbkRpc3BsYXlDaGFuZ2U7XG4gIHJldHVybiBPYmplY3QuYXNzaWduKHRhYmxlLCB7XG4gICAgb25EaXNwbGF5Q2hhbmdlOiAobGlzdGVuZXIpID0+IHtcbiAgICAgIHRhYmxlRGlzcGxheUNoYW5nZShsaXN0ZW5lcik7XG4gICAgICB0YWJsZS5leGVjKCk7XG4gICAgfVxuICB9KTtcbn07IiwiZXhwb3J0IGRlZmF1bHQgZnVuY3Rpb24gKHtuYW1lOntmaXJzdDpmaXJzdE5hbWUsIGxhc3Q6bGFzdE5hbWV9LCBnZW5kZXIsIGJpcnRoRGF0ZSwgc2l6ZX0pIHtcbiAgY29uc3QgdHIgPSBkb2N1bWVudC5jcmVhdGVFbGVtZW50KCd0cicpO1xuICB0ci5pbm5lckhUTUwgPSBgPHRkPiR7bGFzdE5hbWV9PC90ZD48dGQ+JHtmaXJzdE5hbWV9PC90ZD48dGQ+JHtnZW5kZXJ9PC90ZD48dGQ+JHtiaXJ0aERhdGUudG9Mb2NhbGVEYXRlU3RyaW5nKCl9PC90ZD48dGQ+JHtzaXplfTwvdGQ+YDtcbiAgcmV0dXJuIHRyO1xufSIsImltcG9ydCB7c3VtbWFyeURpcmVjdGl2ZX0gIGZyb20gJ3NtYXJ0LXRhYmxlLWNvcmUnXG5cbmV4cG9ydCBkZWZhdWx0IGZ1bmN0aW9uIHN1bW1hcnlDb21wb25lbnQgKHt0YWJsZSwgZWx9KSB7XG4gIGNvbnN0IGRpciA9IHN1bW1hcnlEaXJlY3RpdmUoe3RhYmxlfSk7XG4gIGRpci5vblN1bW1hcnlDaGFuZ2UoKHtwYWdlLCBzaXplLCBmaWx0ZXJlZENvdW50fSkgPT4ge1xuICAgIGVsLmlubmVySFRNTCA9IGBzaG93aW5nIGl0ZW1zIDxzdHJvbmc+JHsocGFnZSAtIDEpICogc2l6ZSArIChmaWx0ZXJlZENvdW50ID4gMCA/IDEgOiAwKX08L3N0cm9uZz4gLSA8c3Ryb25nPiR7TWF0aC5taW4oZmlsdGVyZWRDb3VudCwgcGFnZSAqIHNpemUpfTwvc3Ryb25nPiBvZiA8c3Ryb25nPiR7ZmlsdGVyZWRDb3VudH08L3N0cm9uZz4gbWF0Y2hpbmcgaXRlbXNgO1xuICB9KTtcbiAgcmV0dXJuIGRpcjtcbn0iLCJpbXBvcnQge3BhZ2luYXRpb25EaXJlY3RpdmV9IGZyb20gJ3NtYXJ0LXRhYmxlLWNvcmUnO1xuXG5leHBvcnQgZGVmYXVsdCBmdW5jdGlvbiBwYWdpbmF0aW9uQ29tcG9uZW50ICh7dGFibGUsIGVsfSkge1xuICBjb25zdCBwcmV2aW91c0J1dHRvbiA9IGRvY3VtZW50LmNyZWF0ZUVsZW1lbnQoJ2J1dHRvbicpO1xuICBwcmV2aW91c0J1dHRvbi5pbm5lckhUTUwgPSAnUHJldmlvdXMnO1xuICBjb25zdCBuZXh0QnV0dG9uID0gZG9jdW1lbnQuY3JlYXRlRWxlbWVudCgnYnV0dG9uJyk7XG4gIG5leHRCdXR0b24uaW5uZXJIVE1MID0gJ05leHQnO1xuICBjb25zdCBwYWdlU3BhbiA9IGRvY3VtZW50LmNyZWF0ZUVsZW1lbnQoJ3NwYW4nKTtcbiAgcGFnZVNwYW4uaW5uZXJIVE1MID0gJy0gcGFnZSAxIC0nO1xuICBjb25zdCBjb21wID0gcGFnaW5hdGlvbkRpcmVjdGl2ZSh7dGFibGV9KTtcblxuICBjb21wLm9uU3VtbWFyeUNoYW5nZSgoe3BhZ2V9KSA9PiB7XG4gICAgcHJldmlvdXNCdXR0b24uZGlzYWJsZWQgPSAhY29tcC5pc1ByZXZpb3VzUGFnZUVuYWJsZWQoKTtcbiAgICBuZXh0QnV0dG9uLmRpc2FibGVkID0gIWNvbXAuaXNOZXh0UGFnZUVuYWJsZWQoKTtcbiAgICBwYWdlU3Bhbi5pbm5lckhUTUwgPSBgLSAke3BhZ2V9IC1gO1xuICB9KTtcblxuICBwcmV2aW91c0J1dHRvbi5hZGRFdmVudExpc3RlbmVyKCdjbGljaycsICgpID0+IGNvbXAuc2VsZWN0UHJldmlvdXNQYWdlKCkpO1xuICBuZXh0QnV0dG9uLmFkZEV2ZW50TGlzdGVuZXIoJ2NsaWNrJywgKCkgPT4gY29tcC5zZWxlY3ROZXh0UGFnZSgpKTtcblxuICBlbC5hcHBlbmRDaGlsZChwcmV2aW91c0J1dHRvbik7XG4gIGVsLmFwcGVuZENoaWxkKHBhZ2VTcGFuKTtcbiAgZWwuYXBwZW5kQ2hpbGQobmV4dEJ1dHRvbik7XG5cbiAgcmV0dXJuIGNvbXA7XG59IiwiaW1wb3J0IHtkZWJvdW5jZX0gZnJvbSAnLi4vLi4vaW5kZXgnO1xuXG5leHBvcnQgZGVmYXVsdCBmdW5jdGlvbiByYW5nU2l6ZUlucHV0ICh7bWluRWwsIG1heEVsLCB0YWJsZX0pIHtcblxuICBsZXQgbHRWYWx1ZTtcbiAgbGV0IGd0VmFsdWU7XG5cbiAgY29uc3QgY29tbWl0ID0gKCkgPT4ge1xuICAgIGNvbnN0IGNsYXVzZXMgPSBbXTtcbiAgICBpZiAobHRWYWx1ZSkge1xuICAgICAgY2xhdXNlcy5wdXNoKHt2YWx1ZTogbHRWYWx1ZSwgb3BlcmF0b3I6ICdsdGUnLCB0eXBlOiAnbnVtYmVyJ30pO1xuICAgIH1cbiAgICBpZiAoZ3RWYWx1ZSkge1xuICAgICAgY2xhdXNlcy5wdXNoKHt2YWx1ZTogZ3RWYWx1ZSwgb3BlcmF0b3I6ICdndGUnLCB0eXBlOiAnbnVtYmVyJ30pO1xuICAgIH1cbiAgICB0YWJsZS5maWx0ZXIoe1xuICAgICAgc2l6ZTogY2xhdXNlc1xuICAgIH0pXG4gIH07XG5cbiAgbWluRWwuYWRkRXZlbnRMaXN0ZW5lcignaW5wdXQnLCBkZWJvdW5jZSgoZXYpID0+IHtcbiAgICBndFZhbHVlID0gbWluRWwudmFsdWU7XG4gICAgY29tbWl0KCk7XG4gIH0sIDQwMCkpO1xuXG4gIG1heEVsLmFkZEV2ZW50TGlzdGVuZXIoJ2lucHV0JywgZGVib3VuY2UoKGV2KSA9PiB7XG4gICAgbHRWYWx1ZSA9IG1heEVsLnZhbHVlO1xuICAgIGNvbW1pdCgpO1xuICB9LCA0MDApKTtcbn0iLCJpbXBvcnQge3RhYmxlIGFzIHRhYmxlQ29tcG9uZW50RmFjdG9yeX0gZnJvbSAnLi4vaW5kZXgnO1xuaW1wb3J0IHtzbWFydFRhYmxlIGFzIHRhYmxlfSBmcm9tICdzbWFydC10YWJsZS1jb3JlJztcbmltcG9ydCByb3cgZnJvbSAnLi9jb21wb25lbnRzL3Jvdyc7XG5pbXBvcnQgc3VtbWFyeSBmcm9tICcuL2NvbXBvbmVudHMvc3VtbWFyeSc7XG5pbXBvcnQgcGFnaW5hdGlvbiBmcm9tICcuL2NvbXBvbmVudHMvcGFnaW5hdGlvbic7XG5pbXBvcnQgcmFuZ2VTaXplSW5wdXQgZnJvbSAnLi9jb21wb25lbnRzL3JhbmdlU2l6ZUlucHV0JztcblxuXG5jb25zdCBlbCA9IGRvY3VtZW50LmdldEVsZW1lbnRCeUlkKCd0YWJsZS1jb250YWluZXInKTtcbmNvbnN0IHRib2R5ID0gZWwucXVlcnlTZWxlY3RvcigndGJvZHknKTtcbmNvbnN0IHN1bW1hcnlFbCA9IGVsLnF1ZXJ5U2VsZWN0b3IoJ1tkYXRhLXN0LXN1bW1hcnldJyk7XG5cbmNvbnN0IHQgPSB0YWJsZSh7ZGF0YSwgdGFibGVTdGF0ZToge3NvcnQ6IHt9LCBmaWx0ZXI6IHt9LCBzbGljZToge3BhZ2U6IDEsIHNpemU6IDIwfX19KTtcbmNvbnN0IHRhYmxlQ29tcG9uZW50ID0gdGFibGVDb21wb25lbnRGYWN0b3J5KHtlbCwgdGFibGU6IHR9KTtcblxuc3VtbWFyeSh7dGFibGU6IHQsIGVsOiBzdW1tYXJ5RWx9KTtcbnJhbmdlU2l6ZUlucHV0KHtcbiAgdGFibGU6IHQsXG4gIG1pbkVsOiBkb2N1bWVudC5nZXRFbGVtZW50QnlJZCgnbWluLXNpemUnKSxcbiAgbWF4RWw6IGRvY3VtZW50LmdldEVsZW1lbnRCeUlkKCdtYXgtc2l6ZScpXG59KTtcblxuY29uc3QgcGFnaW5hdGlvbkNvbnRhaW5lciA9IGVsLnF1ZXJ5U2VsZWN0b3IoJ1tkYXRhLXN0LXBhZ2luYXRpb25dJyk7XG5wYWdpbmF0aW9uKHt0YWJsZTogdCwgZWw6IHBhZ2luYXRpb25Db250YWluZXJ9KTtcblxudGFibGVDb21wb25lbnQub25EaXNwbGF5Q2hhbmdlKGRpc3BsYXllZCA9PiB7XG4gIHRib2R5LmlubmVySFRNTCA9ICcnO1xuICBmb3IgKGxldCByIG9mIGRpc3BsYXllZCkge1xuICAgIGNvbnN0IG5ld0NoaWxkID0gcm93KChyLnZhbHVlKSwgci5pbmRleCwgdCk7XG4gICAgdGJvZHkuYXBwZW5kQ2hpbGQobmV3Q2hpbGQpO1xuICB9XG59KTtcbiJdLCJuYW1lcyI6WyJkZWJvdW5jZSIsImZpbHRlciIsInRhYmxlIiwic3VtbWFyeSIsInJhbmdlU2l6ZUlucHV0IiwicGFnaW5hdGlvbiJdLCJtYXBwaW5ncyI6Ijs7O0FBQUEsTUFBTSxJQUFJLEdBQUcsQ0FBQyxDQUFDLEtBQUssQ0FBQyxDQUFDLEVBQUUsQ0FBQyxL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
