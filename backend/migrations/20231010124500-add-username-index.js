module.exports = {
  async up(db, client) {
    await db.collection('users').createIndex({ username: 1 }, { unique: true });
  },

  async down(db, client) {
    await db.collection('users').dropIndex('username_1');
  },
};
