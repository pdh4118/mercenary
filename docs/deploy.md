# 배포 가이드 (친구들과 인터넷으로 접속하기)

게임 서버 하나가 **화면(정적 파일)과 게임 접속(`/ws`)을 같은 포트에서 함께** 제공한다. 그래서 서버 하나만 올리고 주소 하나만 알려 주면 된다. HTTPS로 올리면 접속도 자동으로 `wss`가 된다.

```sh
npm ci
npm run build   # client/dist 생성
npm start       # http://0.0.0.0:8080
```

환경 변수

| 이름 | 기본값 | 설명 |
|---|---|---|
| `PORT` | 8080 | 서버 포트 |
| `HOST` | 0.0.0.0 | 바인딩 주소. 리버스 프록시 뒤에 둘 때는 `127.0.0.1`을 권장 |
| `ALLOWED_ORIGINS` | (모두 허용) | 허용할 접속 출처. 예: `https://game.example.com`. 쉼표로 여러 개 |
| `MAX_CONNECTIONS` | 300 | 동시 접속 상한 |
| `TRUST_PROXY` | (꺼짐) | `1`이면 `cf-connecting-ip`/`x-forwarded-for` 헤더를 접속자 주소로 쓴다. **Cloudflare Tunnel이나 리버스 프록시 뒤에서는 켜야** 비공개 방 코드 무작위 대입 차단이 접속자별로 동작한다(안 켜면 모두가 프록시 주소 하나로 보인다). 서버를 인터넷에 직접 열었다면 켜지 말 것 |
| `STATIC_DIR` | `client/dist` | 빌드된 클라이언트 위치 |

상태 확인: `GET /healthz` → `{"ok":true,"rooms":N,"connections":N}`

## 필요한 자원 (실측)

- **CPU**: 방 1개를 돌리는 데 1틱(50ms 중) 약 1ms. 1코어로 방 수십 개도 여유 있다.
- **업로드 대역폭**(제일 중요): 서버가 매 틱 모든 접속자에게 현재 상태를 보낸다.
  - 6명 방, 적 200여 마리 기준 메시지 평균 약 3.6KB(압축 없이) → 초당 20회 × 6명 ≈ **5~8Mbps**.
  - 서버는 압축을 켜 두었고 실제로 **약 1/3(1.2KB)** 로 줄어 6명 방이 대략 **2~3Mbps**. 적이 상한(400)에 가까운 후반에는 더 늘어난다.
  - 방이 여러 개면 그만큼 곱해진다. 집 인터넷 업로드가 10Mbps 이상이면 친구들끼리 한두 방은 충분하다.
- **지연**: 실시간 게임이라 가까울수록 좋다. 한국 친구들이면 한국(또는 일본) 쪽에 두는 것을 권장.

## 어디에 올릴까

### A. 개인 서버(집 PC / NAS / 라즈베리파이) + Cloudflare Tunnel (추천 시작점)

- 장점: 무료, 공유기 설정(포트포워딩) 불필요, 집 IP가 노출되지 않음, HTTPS 자동.
- 단점: 그 컴퓨터가 켜져 있어야 하고, 집 인터넷 업로드에 의존한다.

가장 빠른 테스트(계정·도메인 없이, 임시 주소):

```sh
npm ci && npm run build && npm start
cloudflared tunnel --url http://localhost:8080   # 출력되는 https://무작위.trycloudflare.com 주소를 친구에게 전달
```

`cloudflared` 설치는 Cloudflare 공식 문서를 따른다. 임시 주소는 실행할 때마다 바뀐다. 고정 주소를 쓰려면 Cloudflare에 도메인을 등록하고 이름 있는 터널을 만든다(터널 서비스는 무료, 도메인은 별도 비용).

### B. 개인 서버 + 포트포워딩

공유기에서 외부 포트를 서버 PC의 8080으로 넘기고 DDNS로 주소를 고정한다. **HTTPS를 직접 붙여야 한다**(예: Caddy가 인증서를 자동으로 받아 준다). 통신사가 공인 IP를 주지 않는 환경(CGNAT)에서는 불가능하고, 집 IP가 그대로 노출된다. A가 되면 굳이 쓸 이유가 없다.

### C. 클라우드 VPS (안정적으로 오래 운영할 때)

- 월 몇 달러 수준(업체·사양에 따라 다름)의 1코어 / 1GB 정도면 충분하다. 서울·도쿄 리전을 고른다.
- 24시간 켜져 있고 고정 IP가 있으며 집 인터넷에 의존하지 않는다.
- Docker가 있으면:

```sh
docker build -t mercenary .
docker run -d --name mercenary --restart unless-stopped -p 127.0.0.1:8080:8080 \
  -e ALLOWED_ORIGINS=https://game.example.com mercenary
```

앞단에 Caddy를 두면 HTTPS가 자동이다(`Caddyfile`):

```
game.example.com {
    reverse_proxy 127.0.0.1:8080
}
```

> Dockerfile은 이 환경에서 직접 빌드해 보지 못했다. 처음 올릴 때 한 번 확인이 필요하다.

### 프로세스 유지(Docker 없이)

systemd 예시(`/etc/systemd/system/mercenary.service`):

```ini
[Unit]
Description=Mercenary game server
After=network.target

[Service]
WorkingDirectory=/opt/mercenary
Environment=PORT=8080 HOST=127.0.0.1
ExecStart=/usr/bin/npm start
Restart=always
User=mercenary

[Install]
WantedBy=multi-user.target
```

## 점검 목록

- [ ] `npm test`와 `npm run typecheck` 통과
- [ ] `npm run build` 후 `npm start`, 브라우저에서 `http://서버:8080` 접속해 방 만들기·참가 확인
- [ ] 두 번째 기기(폰 데이터망 등 다른 네트워크)에서 공개 주소로 접속 확인
- [ ] 공개한다면 `ALLOWED_ORIGINS`로 출처를 제한하고, 서버 포트는 프록시/터널에서만 접근되게 닫아 둔다
- [ ] 업로드 대역폭 확인(방 수 × 6명 기준 위 표)
- [ ] 서버를 다시 시작하면 진행 중이던 방과 재접속 토큰은 사라진다(저장소 없음). 점검 전에 친구들에게 알린다.

## 아직 없는 것

- 서버 재시작 시 방 복구, 계정/로그인, 접속 기록 저장
- 방 비밀번호(비공개 방은 4글자 코드만으로 입장한다. 같은 주소에서 8번 연속 틀리면 60초 차단)
- 같은 IP 접속 수 제한, 신고·차단 같은 운영 도구
