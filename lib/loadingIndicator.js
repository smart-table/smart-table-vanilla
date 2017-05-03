import {workingIndicator} from 'smart-table-core';

export default function ({table, el}) {
  const component = workingIndicator({table});
  component.onExecutionChange(function ({working}) {
    el.classList.remove('st-working');
    if (working === true) {
      el.classList.add('st-working');
    }
  });
  return component;
};