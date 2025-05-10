module.exports = {
  async up(db, client) {
    // Create the 'users' collection
    await db.createCollection('users');
  },

  async down(db, client) {
    // Drop the 'users' collection
    await db.collection('users').drop();
  },
};
