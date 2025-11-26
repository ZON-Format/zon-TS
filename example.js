/**
 * ZON Format Example
 * Simple demonstration of encoding and decoding
 */

const { encode, decode } = require('./dist/index');

// Example 1: Simple object
console.log('=== Example 1: Simple Object ===');
const user = { name: 'Alice', age: 30, active: true };
const encodedUser = encode(user);
console.log('Original:', user);
console.log('Encoded:\n', encodedUser);
console.log('Decoded:', decode(encodedUser));
console.log();

// Example 2: Array of objects (table)
console.log('=== Example 2: Array of Objects ===');
const products = [
  { id: 1, name: 'Laptop', price: 999, inStock: true },
  { id: 2, name: 'Mouse', price: 29, inStock: true },
  { id: 3, name: 'Keyboard', price: 79, inStock: false }
];
const encodedProducts = encode(products);
console.log('Original:', products);
console.log('Encoded:\n', encodedProducts);
console.log('Decoded:', decode(encodedProducts));
console.log();

// Example 3: Hikes example from README
console.log('=== Example 3: Hikes (Mixed Data) ===');
const hikes = {
  context: {
    task: 'Our favorite hikes together',
    location: 'Boulder',
    season: 'spring_2025'
  },
  friends: ['ana', 'luis', 'sam'],
  hikes: [
    {
      id: 1,
      name: 'Blue Lake Trail',
      distanceKm: 7.5,
      elevationGain: 320,
      companion: 'ana',
      wasSunny: true
    },
    {
      id: 2,
      name: 'Ridge Overlook',
      distanceKm: 9.2,
      elevationGain: 540,
      companion: 'luis',
      wasSunny: false
    },
    {
      id: 3,
      name: 'Wildflower Loop',
      distanceKm: 5.1,
      elevationGain: 180,
      companion: 'sam',
      wasSunny: true
    }
  ]
};
const encodedHikes = encode(hikes);
console.log('Encoded:\n', encodedHikes);
console.log();
console.log('Decoded:', JSON.stringify(decode(encodedHikes), null, 2));
console.log();

// Example 4: Compression comparison
console.log('=== Example 4: Compression Stats ===');
const jsonStr = JSON.stringify(hikes);
const zonStr = encodedHikes;
console.log(`JSON size: ${jsonStr.length} bytes`);
console.log(`ZON size: ${zonStr.length} bytes`);
console.log(`Compression: ${((1 - zonStr.length / jsonStr.length) * 100).toFixed(1)}%`);
