export default function ({name:{first:firstName, last:lastName}, gender, birthDate, size}, index, table) {
  const tr = document.createElement('tr');
  tr.innerHTML = `<td>${lastName}</td><td>${firstName}</td><td>${gender}</td><td>${birthDate.toLocaleDateString()}</td><td>${size}</td>`;
  tr.addEventListener('click', () => table.remove(index));
  return tr;
}