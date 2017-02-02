export default function ({name, firstName, gender, birthDate, size}) {
  const tr = document.createElement('tr');
  tr.innerHTML = `<td>${name}</td><td>${firstName}</td><td>${gender}</td><td>${birthDate.toLocaleDateString()}</td><td>${size}</td>`;
  return tr;
}