/**
 * Test datasets for benchmarking ZON vs TOON vs JSON
 * These datasets cover various data structures to test different scenarios
 */

// 1. E-commerce orders (nested structure) - similar to TOON benchmark
const ecommerceOrders = [
  {
    id: 1,
    customer: { name: 'Alice Johnson', email: 'alice@example.com', tier: 'gold' },
    items: [
      { productId: 101, name: 'Laptop', price: 999, quantity: 1 },
      { productId: 102, name: 'Mouse', price: 29, quantity: 2 }
    ],
    total: 1057,
    status: 'shipped',
    date: '2025-01-15'
  },
  {
    id: 2,
    customer: { name: 'Bob Smith', email: 'bob@example.com', tier: 'silver' },
    items: [
      { productId: 103, name: 'Keyboard', price: 79, quantity: 1 },
      { productId: 104, name: 'Monitor', price: 299, quantity: 1 }
    ],
    total: 378,
    status: 'processing',
    date: '2025-01-16'
  },
  {
    id: 3,
    customer: { name: 'Carol White', email: 'carol@example.com', tier: 'platinum' },
    items: [
      { productId: 105, name: 'Desk', price: 449, quantity: 1 },
      { productId: 106, name: 'Chair', price: 299, quantity: 1 },
      { productId: 107, name: 'Lamp', price: 59, quantity: 2 }
    ],
    total: 866,
    status: 'delivered',
    date: '2025-01-14'
  }
];

// 2. Employee records (uniform tabular) - perfect for both ZON and TOON
const employees = [
  { id: 1, name: 'John Doe', department: 'Engineering', salary: 95000, age: 32, active: true },
  { id: 2, name: 'Jane Smith', department: 'Marketing', salary: 82000, age: 28, active: true },
  { id: 3, name: 'Mike Johnson', department: 'Sales', salary: 78000, age: 35, active: true },
  { id: 4, name: 'Sarah Williams', department: 'Engineering', salary: 105000, age: 29, active: true },
  { id: 5, name: 'David Brown', department: 'HR', salary: 72000, age: 42, active: false },
  { id: 6, name: 'Emily Davis', department: 'Engineering', salary: 98000, age: 31, active: true },
  { id: 7, name: 'Chris Wilson', department: 'Marketing', salary: 85000, age: 27, active: true },
  { id: 8, name: 'Amanda Taylor', department: 'Sales', salary: 81000, age: 33, active: true },
  { id: 9, name: 'Tom Anderson', department: 'Engineering', salary: 110000, age: 38, active: true },
  { id: 10, name: 'Lisa Martinez', department: 'HR', salary: 75000, age: 30, active: true }
];

// 3. Time-series analytics (uniform numerical) - TOON benchmark example
const timeSeries = {
  metrics: [
    { date: '2025-01-01', views: 5715, clicks: 211, conversions: 28, revenue: 7976.46, bounceRate: 0.47 },
    { date: '2025-01-02', views: 7103, clicks: 393, conversions: 28, revenue: 8360.53, bounceRate: 0.32 },
    { date: '2025-01-03', views: 7248, clicks: 378, conversions: 24, revenue: 3212.57, bounceRate: 0.50 },
    { date: '2025-01-04', views: 2927, clicks: 77, conversions: 11, revenue: 1211.69, bounceRate: 0.62 },
    { date: '2025-01-05', views: 3530, clicks: 82, conversions: 8, revenue: 462.77, bounceRate: 0.56 },
    { date: '2025-01-06', views: 6421, clicks: 289, conversions: 35, revenue: 9845.32, bounceRate: 0.38 },
    { date: '2025-01-07', views: 5892, clicks: 245, conversions: 31, revenue: 8234.19, bounceRate: 0.42 },
    { date: '2025-01-08', views: 4156, clicks: 156, conversions: 18, revenue: 4567.88, bounceRate: 0.51 },
    { date: '2025-01-09', views: 6789, clicks: 312, conversions: 29, revenue: 7654.21, bounceRate: 0.35 },
    { date: '2025-01-10', views: 5234, clicks: 198, conversions: 22, revenue: 5432.10, bounceRate: 0.45 }
  ]
};

// 4. Mixed structure (context + arrays) - ZON's sweet spot
const hikeData = {
  context: {
    task: 'Our favorite hikes together',
    location: 'Boulder',
    season: 'spring_2025'
  },
  friends: ['ana', 'luis', 'sam'],
  hikes: [
    { id: 1, name: 'Blue Lake Trail', distanceKm: 7.5, elevationGain: 320, companion: 'ana', wasSunny: true },
    { id: 2, name: 'Ridge Overlook', distanceKm: 9.2, elevationGain: 540, companion: 'luis', wasSunny: false },
    { id: 3, name: 'Wildflower Loop', distanceKm: 5.1, elevationGain: 180, companion: 'sam', wasSunny: true },
    { id: 4, name: 'Mountain Peak', distanceKm: 12.3, elevationGain: 890, companion: 'ana', wasSunny: true },
    { id: 5, name: 'Forest Path', distanceKm: 6.8, elevationGain: 210, companion: 'luis', wasSunny: false }
  ]
};

// 5. Top GitHub repositories (tabular with strings and numbers)
const githubRepos = [
  { rank: 1, name: 'freeCodeCamp', stars: 403000, forks: 37000, language: 'JavaScript', openIssues: 245 },
  { rank: 2, name: 'react', stars: 228000, forks: 46000, language: 'JavaScript', openIssues: 1234 },
  { rank: 3, name: 'tensorflow', stars: 186000, forks: 88000, language: 'Python', openIssues: 2156 },
  { rank: 4, name: 'bootstrap', stars: 170000, forks: 78000, language: 'CSS', openIssues: 432 },
  { rank: 5, name: 'vue', stars: 208000, forks: 34000, language: 'JavaScript', openIssues: 567 },
  { rank: 6, name: 'ohmyzsh', stars: 173000, forks: 25000, language: 'Shell', openIssues: 123 },
  { rank: 7, name: 'flutter', stars: 165000, forks: 27000, language: 'Dart', openIssues: 12000 },
  { rank: 8, name: 'kubernetes', stars: 110000, forks: 39000, language: 'Go', openIssues: 2345 },
  { rank: 9, name: 'awesome', stars: 318000, forks: 27000, language: 'Markdown', openIssues: 89 },
  { rank: 10, name: 'Python', stars: 61000, forks: 30000, language: 'Python', openIssues: 1567 }
];

// 6. Deeply nested configuration (challenging for tabular formats)
const deepConfig = {
  app: {
    name: 'MyApp',
    version: '2.1.0',
    environment: 'production',
    features: {
      auth: {
        enabled: true,
        providers: ['google', 'github', 'email'],
        sessionTimeout: 3600
      },
      database: {
        host: 'db.example.com',
        port: 5432,
        credentials: {
          username: 'app_user',
          encrypted: true
        },
        poolSize: 20
      },
      cache: {
        enabled: true,
        type: 'redis',
        ttl: 300
      }
    }
  },
  monitoring: {
    enabled: true,
    endpoints: ['metrics', 'health', 'logs'],
    alerting: {
      email: ['ops@example.com', 'dev@example.com'],
      slack: true
    }
  }
};

// 7. Semi-uniform event logs (some missing fields)
const eventLogs = [
  { id: 1, timestamp: '2025-01-15T10:00:00Z', event: 'user.login', userId: 'u123', ip: '192.168.1.1', success: true },
  { id: 2, timestamp: '2025-01-15T10:05:00Z', event: 'user.logout', userId: 'u123', success: true },
  { id: 3, timestamp: '2025-01-15T10:10:00Z', event: 'user.login', userId: 'u456', ip: '192.168.1.2', success: false, error: 'invalid_password' },
  { id: 4, timestamp: '2025-01-15T10:15:00Z', event: 'purchase', userId: 'u789', amount: 99.99, currency: 'USD', success: true },
  { id: 5, timestamp: '2025-01-15T10:20:00Z', event: 'user.login', userId: 'u456', ip: '192.168.1.2', success: true },
  { id: 6, timestamp: '2025-01-15T10:25:00Z', event: 'purchase', userId: 'u456', amount: 149.99, currency: 'USD', success: false, error: 'insufficient_funds' },
  { id: 7, timestamp: '2025-01-15T10:30:00Z', event: 'user.settings', userId: 'u123', settings: { theme: 'dark', notifications: true }, success: true }
];

module.exports = {
  ecommerceOrders,
  employees,
  timeSeries,
  hikeData,
  githubRepos,
  deepConfig,
  eventLogs
};
