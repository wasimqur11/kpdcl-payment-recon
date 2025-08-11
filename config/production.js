module.exports = {
  server: {
    port: process.env.PORT || 3001,
    host: '0.0.0.0'
  },
  cors: {
    origin: ['http://localhost:3000', 'http://localhost:3001'],
    credentials: true
  },
  database: {
    corportal: {
      host: process.env.CORPORTAL_DB_HOST,
      port: process.env.CORPORTAL_DB_PORT,
      service: process.env.CORPORTAL_DB_SERVICE,
      user: process.env.CORPORTAL_DB_USER,
      password: process.env.CORPORTAL_DB_PASSWORD
    },
    ccb: {
      host: process.env.CCB_DB_HOST,
      port: process.env.CCB_DB_PORT,
      service: process.env.CCB_DB_SERVICE,
      user: process.env.CCB_DB_USER,
      password: process.env.CCB_DB_PASSWORD
    }
  }
};