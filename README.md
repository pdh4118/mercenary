# Mercenary (머서너리)

용병을 고용해 주변에 배치하며 싸우는 뱀서류 멀티플레이(6인 이상) 게임.

## 구조

- `shared/` - 서버·클라이언트가 함께 쓰는 규칙과 프로토콜 (TypeScript)
- `server/` - 전투를 계산하는 권위 서버 (Node.js + ws, 초당 20틱)
- `client/` - 화면과 입력 (PixiJS + Vite). 입력만 보내고 서버 결과를 그린다

## 실행

```sh
npm install
npm run dev:server   # ws://localhost:8080
npm run dev:client   # http://localhost:5173
```

같은 서버에 여러 탭으로 접속하면 멀티플레이를 확인할 수 있다. 이름은 `?name=이름`, 서버 주소는 `?server=ws://호스트:포트`로 지정.
조작: WASD / 방향키.

## 검사

```sh
npm run typecheck
npm test
```

## 현재 상태

프로토타입 1단계: 최대 8명 접속, 이동 동기화. 다음: 적, 용병, 주인공 공격.
