import { describe, expect, it } from 'vitest';
import {
  toPersonId,
  type PasswordHasher,
  type UserAccount,
  type UserDirectory,
} from '@/domain/index';
import { InvalidCredentialsError } from '../errors';
import { AuthenticateUser } from './authenticate-user';

const ACCOUNT: UserAccount = {
  id: toPersonId('SIRIUS-PER-0001'),
  name: 'Ana Revisora',
  nationalId: '1234567890',
  role: 'revisor',
  active: true,
  passwordHash: 'hash:secreto',
};

function setup(account: UserAccount | undefined = ACCOUNT) {
  const users: UserDirectory = {
    findByNationalId: async (id) => (account && id === account.nationalId ? account : undefined),
  };
  const passwords: PasswordHasher = {
    verify: async (password, hash) => hash === `hash:${password}`,
  };
  return new AuthenticateUser({ users, passwords });
}

describe('AuthenticateUser', () => {
  it('returns the user without the password hash', async () => {
    const user = await setup().execute({ nationalId: ' 1.234.567.890 ', password: 'secreto' });
    expect(user).toEqual({
      id: 'SIRIUS-PER-0001',
      name: 'Ana Revisora',
      nationalId: '1234567890',
      role: 'revisor',
    });
  });

  it('rejects a wrong password', async () => {
    await expect(setup().execute({ nationalId: '1234567890', password: 'otra' })).rejects.toThrow(
      InvalidCredentialsError,
    );
  });

  it('rejects an unknown or empty ID number', async () => {
    await expect(setup().execute({ nationalId: 'abc', password: 'x' })).rejects.toThrow(
      InvalidCredentialsError,
    );
  });

  it('rejects an inactive account even with the right password', async () => {
    const inactive = { ...ACCOUNT, active: false };
    await expect(
      setup(inactive).execute({ nationalId: '1234567890', password: 'secreto' }),
    ).rejects.toThrow(InvalidCredentialsError);
  });
});
