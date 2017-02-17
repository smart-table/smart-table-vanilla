import Chance from 'chance';

const chance = new Chance();
const source = [];

for (let i = 0; i < 25000; i++) {
  const person = {
    id: i + 1,
    name: {
      last: chance.last(),
      first: chance.first(),
    },
    size: chance.integer({min: 150, max: 200}),
    birthDate: chance.birthday(),
    gender: (Math.random()) <= 0.5 ? 'female' : 'male'
  };
  source.push(person);
}

export default source;