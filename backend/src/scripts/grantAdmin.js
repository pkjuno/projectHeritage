const { connectDatabase } = require('../config/database');
const User = require('../models/user.model');

/**
 * 특정 회원에게 운영자(admin) 권한을 부여하거나 회수하는 CLI 스크립트.
 *
 * 운영자 승격을 API로 열어두면 권한 상승 통로가 되므로,
 * 서버에 직접 접근할 수 있는 사람만 실행할 수 있는 스크립트로만 제공한다.
 *
 * 사용법:
 *   npm run admin:grant -- admin@example.com          운영자로 승격
 *   npm run admin:grant -- admin@example.com --revoke  권한 회수
 */
async function main() {
  const args = process.argv.slice(2);
  const email = args.find((arg) => !arg.startsWith('--'));
  const shouldRevoke = args.includes('--revoke');

  if (!email) {
    console.error('사용법: npm run admin:grant -- <email> [--revoke]');
    process.exitCode = 1;
    return;
  }

  await connectDatabase();

  const user = await User.findOne({ where: { email } });

  if (!user) {
    console.error(`[Admin] 해당 이메일의 회원을 찾을 수 없습니다: ${email}`);
    process.exitCode = 1;
    return;
  }

  if (user.status === 'withdrawn') {
    console.error(`[Admin] 탈퇴한 계정에는 권한을 부여할 수 없습니다: ${email}`);
    process.exitCode = 1;
    return;
  }

  const nextRole = shouldRevoke ? 'user' : 'admin';

  if (user.role === nextRole) {
    console.log(`[Admin] 이미 "${nextRole}" 권한입니다: ${email}`);
    return;
  }

  user.role = nextRole;
  await user.save();

  console.log(`[Admin] ${email} 의 권한을 "${nextRole}" 로 변경했습니다.`);
}

main()
  .then(() => process.exit(process.exitCode ?? 0))
  .catch((error) => {
    console.error('[Admin] 실행 중 오류가 발생했습니다:', error.message);
    process.exit(1);
  });
