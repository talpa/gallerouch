import bcrypt from 'bcrypt';

const password = 'admin123';
const saltRounds = 10;

bcrypt.hash(password, saltRounds, (err, hash) => {
  if (err) {
    console.error('Error generating hash:', err);
    process.exit(1);
  }
  console.log('Bcrypt hash for "admin123":');
  console.log(hash);
  console.log('\nUse this hash in your migration file.');
});
