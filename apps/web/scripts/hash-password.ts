// Genera el hash de una contraseña para la columna «Hash contraseña» de la tabla Usuarios.
// Uso: npm run hash-password -w @hatoscan/web   (pide la contraseña; no queda en el historial)
import { createInterface } from 'node:readline/promises';
import { hashPassword } from '../src/infrastructure/auth/scrypt-password-hasher.ts';

const rl = createInterface({ input: process.stdin, output: process.stdout });
const password = await rl.question('Contraseña (mínimo 8 caracteres): ');
rl.close();
if (password.length < 8) {
  console.error('La contraseña debe tener al menos 8 caracteres.');
  process.exit(1);
}
console.log(`\nCopia esto en «Hash contraseña»:\n${await hashPassword(password)}`);
