import tableDirective from './lib/table';
import * as filters from './lib/filters';
import load from './lib/loadingIndicator';
import searchDirective from './lib/search';
import sortDirective from './lib/sort';
import {debounce as d} from './lib/helpers';

export const textInput = filters.textInput;
export const numberInput = filters.numberInput;
export const dateInput = filters.dateInput;
export const loadingIndicator = load;
export const table = tableDirective;
export const searchInput = searchDirective;
export const sortToggle = sortDirective;
export const debounce = d;
export default tableDirective;
