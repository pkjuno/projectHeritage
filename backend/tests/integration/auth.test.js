const { request, app, resetDatabase, createUserAndLogin, authHeader } = require('../helpers');

/**
 * 회원가입 / 로그인 / 토큰 재발급 / 로그아웃 / 회원탈퇴 흐름.
 */
describe('인증(Auth) API', () => {
  beforeEach(async () => {
    await resetDatabase();
  });

  describe('회원가입', () => {
    it('가입에 성공하면 비밀번호가 응답에 포함되지 않는다', async () => {
      const response = await request(app)
        .post('/api/auth/signup')
        .send({ email: 'new@example.com', password: 'pass1234', name: '홍길동' })
        .expect(201);

      expect(response.body.data.email).toBe('new@example.com');
      expect(response.body.data.password).toBeUndefined();
      expect(response.body.data.refreshToken).toBeUndefined();
    });

    it('같은 이메일로 중복 가입할 수 없다', async () => {
      const payload = { email: 'dup@example.com', password: 'pass1234', name: '홍길동' };
      await request(app).post('/api/auth/signup').send(payload).expect(201);
      await request(app).post('/api/auth/signup').send(payload).expect(409);
    });

    it('필수값이 빠지면 400', async () => {
      await request(app).post('/api/auth/signup').send({ email: 'a@b.com' }).expect(400);
    });
  });

  describe('로그인', () => {
    beforeEach(async () => {
      await request(app)
        .post('/api/auth/signup')
        .send({ email: 'login@example.com', password: 'pass1234', name: '홍길동' });
    });

    it('올바른 정보로 로그인하면 토큰이 발급된다', async () => {
      const response = await request(app)
        .post('/api/auth/login')
        .send({ email: 'login@example.com', password: 'pass1234' })
        .expect(200);

      expect(response.body.data.accessToken).toBeTruthy();
      expect(response.body.data.refreshToken).toBeTruthy();
    });

    it('비밀번호가 틀리면 401', async () => {
      await request(app)
        .post('/api/auth/login')
        .send({ email: 'login@example.com', password: 'wrong' })
        .expect(401);
    });

    it('없는 계정도 같은 메시지로 401을 반환한다 (계정 존재 여부 노출 방지)', async () => {
      const wrongPassword = await request(app)
        .post('/api/auth/login')
        .send({ email: 'login@example.com', password: 'wrong' })
        .expect(401);

      const noSuchUser = await request(app)
        .post('/api/auth/login')
        .send({ email: 'nobody@example.com', password: 'pass1234' })
        .expect(401);

      expect(noSuchUser.body.message).toBe(wrongPassword.body.message);
    });
  });

  describe('토큰 재발급 / 로그아웃', () => {
    it('refreshToken으로 accessToken을 재발급받는다', async () => {
      const { email, password } = await createUserAndLogin();
      const login = await request(app).post('/api/auth/login').send({ email, password });

      const response = await request(app)
        .post('/api/auth/refresh')
        .send({ refreshToken: login.body.data.refreshToken })
        .expect(200);

      expect(response.body.data.accessToken).toBeTruthy();
    });

    it('로그아웃하면 기존 refreshToken을 더 이상 쓸 수 없다', async () => {
      const { email, password } = await createUserAndLogin();
      const login = await request(app).post('/api/auth/login').send({ email, password });
      const { accessToken, refreshToken } = login.body.data;

      await request(app).post('/api/auth/logout').set(authHeader(accessToken)).expect(200);

      await request(app).post('/api/auth/refresh').send({ refreshToken }).expect(401);
    });

    it('위조된 refreshToken은 거부된다', async () => {
      await request(app).post('/api/auth/refresh').send({ refreshToken: 'garbage' }).expect(401);
    });
  });

  describe('회원 탈퇴', () => {
    it('탈퇴하면 같은 계정으로 다시 로그인할 수 없다', async () => {
      const { token, email, password } = await createUserAndLogin();

      await request(app).delete('/api/auth/withdraw').set(authHeader(token)).expect(200);

      await request(app).post('/api/auth/login').send({ email, password }).expect(401);
    });
  });

  describe('인증이 필요한 API 보호', () => {
    it('토큰 없이 내 정보를 조회할 수 없다', async () => {
      await request(app).get('/api/users/me').expect(401);
    });

    it('위조된 토큰은 거부된다', async () => {
      await request(app).get('/api/users/me').set(authHeader('garbage.token.value')).expect(401);
    });
  });
});
