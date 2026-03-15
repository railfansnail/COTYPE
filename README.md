# COTYPE - 코타입 | 코드로 하는 타자연습
- IDE 환경과 유사하게 디자인되어, 직관적이고 깔끔한 UI를 제공합니다.
- WPM, 정확도, 시간, 진행률을 표시하여 자신의 타자 실력을 알아보기 편리합니다.
- **COTYPE은 Claude를 이용해 개발되었습니다.**

**사용 도중 발생하는 문제는 Issues에 보고해주시면 감사하겠습니다.**

## 기본 제공 언어
- HTML
- CSS
- JavaScript
- Python
- C
- C++
- C#
- Java

## 포함된 기능
- 코드 타자 연습: 미리 주어진 예제 코드를 이용해 타자 연습을 할 수 있습니다. (미리 지정된 코드가 제시됩니다. 같은 언어 내에서 제공된 다른 코드로도 변경할 수 있습니다.)
- 단어 타자 연습: 각 언어에서 주로 사용되는 단어를 이용해 타자 연습을 할 수 있습니다. (랜덤으로 단어가 제시됩니다. 제시 단어 분량은 조절할 수 있습니다.)
- 스니펫 추가: 사용자 지정 타자 연습이 가능합니다. (직접 입력하거나, 파일을 업로드 할 수 있습니다.)

## 설치 및 실행

```bash
npm install
npm start          # 실서비스
npm run dev        # 개발모드 (nodemon)
```

서버 기본 주소: http://localhost:3000

---

## config.json 설정

### HTTP (기본)
```json
"http": { "enabled": true, "port": 3000 }
```

### HTTPS 활성화
```json
"https": {
  "enabled": true,
  "port": 443,
  "certPath": "./certs/server.crt",
  "keyPath":  "./certs/server.key",
  "redirectHttp": true   // HTTP → HTTPS 자동 리디렉션
}
```

### CA 인증서 활성화
```json
"ca": {
  "enabled": true,
  "caPath": "./certs/ca.crt",
  "requestClientCert": false,   // true = 클라이언트 인증서 요구
  "rejectUnauthorized": false
}
```

---

## API

| 메서드 | 경로 | 설명 |
|--------|------|------|
| GET | `/api/rankings?lang=&mode=&limit=` | 랭킹 조회 |
| POST | `/api/rankings` | 랭킹 등록 |
| GET | `/api/health` | 서버 상태 확인 |

### POST /api/rankings body
```json
{
  "nickname": "철수",
  "wpm": 85,
  "accuracy": 97,
  "lang": "html",
  "mode": "code",
  "snippet": "포트폴리오 사이트"
}
```

---

## 키보드 단축키

| 키 | 동작 |
|----|------|
| Tab | 들여쓰기 (다음 공백 개수만큼 삽입) |
| Ctrl+R | 재시작 |
| Ctrl+N | 다음 스니펫 |
| Esc | 리셋 |
| Backspace | 한 글자 수정 |

---

## 디렉토리 구조

```
code-typing-server/
├── server.js          # 메인 서버
├── config.json        # HTTP/HTTPS/CA 설정
├── package.json
├── db/
│   ├── database.js    # SQLite 헬퍼
│   └── rankings.db    # DB 파일 (자동 생성)
├── public/
│   └── index.html     # 앱 메인 페이지
├── certs/             # 인증서 파일 위치
└── README.md
```
