// 외부 SNS API 호출만 가짜로 대체한다. 나머지(라우터-컨트롤러-서비스-DB)는 실제로 실행된다.
jest.mock('../../src/services/oauth.service');

const oauthService = require('../../src/services/oauth.service');
const AppError = require('../../src/utils/AppError');
const { request, app, resetDatabase, createUserAndLogin, authHeader } = require('../helpers');

/**
 * SNS 프로필 조회 가짜 구현.
 * accessToken 문자열을 그대로 계정 식별자로 사용해, 같은 토큰이면 같은 SNS 계정으로 취급한다.
 */
function stubSocialProfile() {
  oauthService.getSocialProfile.mockImplementation(async (provider, accessToken) => {
    if (accessToken === 'invalid') {
      throw new AppError(401, `${provider} 인증에 실패했습니다.`);
    }
    return {
      providerId: `${provider}-${accessToken}`,
      email: `${accessToken}@${provider}.test`,
      name: `${provider}사용자`,
    };
  });
}

describe('마이페이지 API', () => {
  let member;

  beforeEach(async () => {
    await resetDatabase();
    jest.clearAllMocks();
    stubSocialProfile();
    member = await createUserAndLogin({ email: 'my@example.com', name: '홍길동' });
  });

  describe('회원정보 조회/수정', () => {
    it('내 정보와 연결된 간편로그인 목록을 함께 조회한다', async () => {
      const response = await request(app)
        .get('/api/users/me')
        .set(authHeader(member.token))
        .expect(200);

      expect(response.body.data.email).toBe('my@example.com');
      expect(response.body.data.socialAccounts).toEqual([]);
      expect(response.body.data.hasPassword).toBe(true);
      expect(response.body.data.password).toBeUndefined();
    });

    it('닉네임을 수정할 수 있다', async () => {
      const response = await request(app)
        .patch('/api/users/me')
        .set(authHeader(member.token))
        .send({ nickname: '길동이' })
        .expect(200);

      expect(response.body.data.nickname).toBe('길동이');
    });

    it('닉네임이 너무 짧으면 400', async () => {
      await request(app)
        .patch('/api/users/me')
        .set(authHeader(member.token))
        .send({ nickname: 'a' })
        .expect(400);
    });

    it('수정할 항목이 없으면 400', async () => {
      await request(app).patch('/api/users/me').set(authHeader(member.token)).send({}).expect(400);
    });
  });

  describe('간편로그인 연결', () => {
    it('카카오와 네이버를 함께 연결할 수 있다', async () => {
      await request(app)
        .post('/api/users/me/social-accounts/kakao')
        .set(authHeader(member.token))
        .send({ accessToken: 'aaa' })
        .expect(201);

      await request(app)
        .post('/api/users/me/social-accounts/naver')
        .set(authHeader(member.token))
        .send({ accessToken: 'aaa' })
        .expect(201);

      const response = await request(app).get('/api/users/me').set(authHeader(member.token));
      const providers = response.body.data.socialAccounts.map((account) => account.provider).sort();

      expect(providers).toEqual(['kakao', 'naver']);
    });

    it('같은 제공자를 중복으로 연결할 수 없다', async () => {
      const link = () =>
        request(app)
          .post('/api/users/me/social-accounts/kakao')
          .set(authHeader(member.token))
          .send({ accessToken: 'aaa' });

      await link().expect(201);
      await link().expect(409);
    });

    it('다른 회원이 이미 연결한 SNS 계정은 연결할 수 없다', async () => {
      const other = await createUserAndLogin({ email: 'other@example.com' });

      await request(app)
        .post('/api/users/me/social-accounts/kakao')
        .set(authHeader(member.token))
        .send({ accessToken: 'shared' })
        .expect(201);

      await request(app)
        .post('/api/users/me/social-accounts/kakao')
        .set(authHeader(other.token))
        .send({ accessToken: 'shared' })
        .expect(409);
    });

    it('지원하지 않는 제공자는 400', async () => {
      await request(app)
        .post('/api/users/me/social-accounts/facebook')
        .set(authHeader(member.token))
        .send({ accessToken: 'aaa' })
        .expect(400);
    });

    it('SNS 인증에 실패하면 401', async () => {
      await request(app)
        .post('/api/users/me/social-accounts/kakao')
        .set(authHeader(member.token))
        .send({ accessToken: 'invalid' })
        .expect(401);
    });
  });

  describe('간편로그인 해지', () => {
    it('연결된 계정을 해지할 수 있다', async () => {
      await request(app)
        .post('/api/users/me/social-accounts/kakao')
        .set(authHeader(member.token))
        .send({ accessToken: 'aaa' })
        .expect(201);

      await request(app)
        .delete('/api/users/me/social-accounts/kakao')
        .set(authHeader(member.token))
        .expect(200);
    });

    it('연결되어 있지 않으면 404', async () => {
      await request(app)
        .delete('/api/users/me/social-accounts/kakao')
        .set(authHeader(member.token))
        .expect(404);
    });

    it('로그인 수단이 사라지는 해지는 거부된다', async () => {
      // 비밀번호 없이 간편로그인으로만 가입한 회원을 만든다.
      const socialLogin = await request(app)
        .post('/api/auth/social/kakao')
        .send({ accessToken: 'social-only' })
        .expect(200);

      const token = socialLogin.body.data.accessToken;

      const me = await request(app).get('/api/users/me').set(authHeader(token));
      expect(me.body.data.hasPassword).toBe(false);

      // 유일한 로그인 수단이므로 해지할 수 없다.
      const rejected = await request(app)
        .delete('/api/users/me/social-accounts/kakao')
        .set(authHeader(token))
        .expect(400);
      expect(rejected.body.message).toContain('마지막 로그인 수단');

      // 다른 수단을 연결하면 해지할 수 있다.
      await request(app)
        .post('/api/users/me/social-accounts/google')
        .set(authHeader(token))
        .send({ accessToken: 'social-only' })
        .expect(201);

      await request(app)
        .delete('/api/users/me/social-accounts/kakao')
        .set(authHeader(token))
        .expect(200);
    });
  });

  describe('간편로그인으로 로그인', () => {
    it('연결한 회원으로 로그인된다', async () => {
      await request(app)
        .post('/api/users/me/social-accounts/kakao')
        .set(authHeader(member.token))
        .send({ accessToken: 'aaa' })
        .expect(201);

      const response = await request(app)
        .post('/api/auth/social/kakao')
        .send({ accessToken: 'aaa' })
        .expect(200);

      expect(response.body.data.user.email).toBe('my@example.com');
    });

    it('이미 가입된 이메일과 겹치면 자동 병합하지 않고 409로 안내한다', async () => {
      // 'my@example.com'으로 이미 가입되어 있는 상태에서,
      // 같은 이메일을 주는 SNS 계정으로 최초 로그인을 시도한다.
      oauthService.getSocialProfile.mockResolvedValueOnce({
        providerId: 'kakao-collision',
        email: 'my@example.com',
        name: '카카오사용자',
      });

      const response = await request(app)
        .post('/api/auth/social/kakao')
        .send({ accessToken: 'collision' })
        .expect(409);

      expect(response.body.message).toContain('마이페이지');
    });
  });
});
