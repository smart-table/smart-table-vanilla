import {slice} from 'smart-table-core';

export default function paginationComponent ({table}) {
  const element = document.createElement('div');
  const previousButton = document.createElement('button');
  previousButton.innerHTML = 'Previous';
  const nextButton = document.createElement('button');
  nextButton.innerHTML = 'Next';
  const comp = Object.assign({}, slice({table}));

  comp.onSummaryChange(({page}) => {
    previousButton.disabled = page === 1;
    //todo disabled if in the last page
  });

  previousButton.addEventListener('click', () => comp.selectPreviousPage());
  nextButton.addEventListener('click', () => comp.selectNextPage());

  element.appendChild(previousButton);
  element.appendChild(nextButton);

  return element;
}