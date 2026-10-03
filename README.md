<div align="center">

# PERPDEX · Funding Dashboard

**거래소별 펀딩비와 선물 가격 차이를 한눈에.**

공개 시장 데이터를 비교하고, 내 컴퓨터에서 실행하는 펀딩 대시보드입니다.

**5개 거래소·마켓 지원 · 펀딩비 비교 · 가격 갭 · 관측 차트 · CSV 내보내기**

[빠른 시작](#빠른-시작) · [주요 기능](#주요-기능) · [지원 거래소](#지원-거래소) · [데이터 안내](#데이터-안내)

</div>

---

## 주요 기능

| 기능 | 설명 |
| --- | --- |
| 펀딩비 비교 | 거래소별 비율과 펀딩비 차이를 비교하고 롱·숏 조합 확인 |
| 선물 가격 갭 | 같은 기초자산의 마크 가격 차이를 금액·비율로 비교 |
| 기간별 환산 | 1시간부터 연간까지 펀딩비 환산, %·BPS 표시 전환 |
| 예상 수익 계산 | 포지션 금액·보유 기간·진입 및 청산 비용을 입력해 추정값 계산 |
| 검색과 필터 | 종목 검색, 거래소 선택, Crypto·RWA 분류, 공통 상장 종목 필터 |
| 관심 마켓 | 즐겨찾는 종목을 브라우저에 저장 |
| 관측 차트 | 프로그램 실행 중 수집한 최근 24시간 펀딩비 확인 |
| CSV 내보내기 | 화면에서 필터링한 비교 데이터를 파일로 저장 |

## 지원 거래소

| 거래소·마켓 | 조회 범위 |
| --- | --- |
| NADO | 활성 무기한 선물 마켓 |
| Variational | 공개 시장 데이터 |
| Hyperliquid | 기본 무기한 선물 마켓 |
| XYZ | Hyperliquid의 `xyz:` 마켓, 별도 열로 비교 |
| Lighter RH | Robinhood Chain 전용 마켓 |

Hyperliquid와 XYZ는 각각 선택할 수 있습니다. Lighter RH는 Lighter 메인넷과 구분됩니다.

## 빠른 시작

**준비물: Node.js 22 이상과 인터넷 연결.** API 키, 로그인, 지갑 연결은 필요하지 않습니다.

### Windows

1. [Node.js](https://nodejs.org/) 22 이상을 설치합니다.
2. 이 저장소의 **Code → Download ZIP**으로 다운로드하고 압축을 풉니다.
3. 폴더 안의 **`start_funding_dashboard.cmd`**를 더블클릭합니다.
4. 브라우저에서 **http://127.0.0.1:4180** 을 엽니다.

별도의 `npm install`이나 빌드 없이 실행됩니다. 실행 창을 유지한 상태로 사용하고, 종료할 때는 실행 창에서 **Ctrl+C**를 누르세요.

### 터미널에서 실행

압축을 푼 폴더에서 터미널을 열고 실행합니다. Windows·macOS·Linux에서 같은 명령을 사용할 수 있습니다.

```sh
node server.mjs
```

서버는 내 컴퓨터의 `127.0.0.1`에서 실행됩니다. `public/index.html` 파일을 직접 여는 대신 위 주소로 접속하세요.

<details>
<summary>다른 포트로 실행하기</summary>

Windows PowerShell:

```powershell
$env:PORT = '4181'
node server.mjs
```

macOS·Linux:

```sh
PORT=4181 node server.mjs
```

실행 후 http://127.0.0.1:4181 에 접속합니다.

</details>

## 데이터 안내

- **공개 API 조회:** 서버가 거래소의 공개 데이터에 직접 요청합니다. 기본 갱신 주기는 5초이며, 거래소별 조회·캐시 주기와 원본 갱신 시각은 다를 수 있습니다.
- **누락과 지연 표시:** 미상장·누락 값은 `-`로 표시합니다. 조회 실패나 지연 데이터는 비교 조합 계산에서 제외하며, 예시 데이터로 대체하지 않습니다.
- **로컬 이력:** 실행 중 수집한 관측값은 `data/history.json`에 자동 저장됩니다. 약 1분 단위로 최근 24시간을 보관하며, 처음 실행하기 전의 이력은 제공하지 않습니다.
- **브라우저 설정:** 관심 종목 등 화면 설정은 사용하는 브라우저에 저장됩니다.
- **이미지 포함:** 거래소·종목 로고와 화면용 폰트가 저장소에 포함되어 있습니다. `public/assets/`의 폴더 구조를 유지하세요.

### 비교값을 읽는 방법

펀딩비는 시간당 비율을 기준으로 기간별 환산값을 표시합니다. 연간 값은 현재 비율을 365일로 단순 환산한 APR이며, 실제 수익을 보장하지 않습니다.

가격 갭은 **`(고가 − 저가) ÷ 저가`**로 계산합니다. 비교 가격은 마크 가격이므로 실제 주문이 체결되는 가격과 다를 수 있습니다. 계산에서는 지원 결제 통화 USDT0·USDC·USDe·USDH·USDG를 각각 1 USD로 가정합니다.

이 프로그램은 시장 조회와 비교용이며 주문을 실행하지 않습니다. 예상 수익에는 사용자가 입력한 비용을 반영하지만 실제 슬리피지·담보 가치 변화·청산 위험을 모두 모델링하지는 않습니다.

## 자주 묻는 질문

**화면에 데이터가 안 나와요.**  
인터넷 연결과 화면의 거래소 연결 상태를 확인하세요. 거래소 API의 응답 지연·접근 제한·점검에 따라 일부 데이터가 표시되지 않을 수 있습니다.

**차트가 비어 있어요.**  
처음 실행하면 관측 이력이 없습니다. 서버를 켜 두면 수집한 데이터로 차트가 쌓입니다.

**컴퓨터를 끄면 계속 수집되나요?**  
프로그램이 실행되는 동안 수집합니다. 컴퓨터를 끄거나 서버를 종료하면 수집도 멈춥니다.

<details>
<summary>개발 및 검증</summary>

### 프로젝트 구조

```text
public/                      화면, 스타일, 로고, 폰트
server/                      거래소 조회 및 비교 로직
server.mjs                   로컬 서버 진입점
tests/                       단위 테스트
scripts/                     브라우저 검사 및 로고 수집 도구
research/                    데이터 출처와 단위 확인 기록
start_funding_dashboard.cmd  Windows 실행 파일
```

단위 테스트와 개발 모드:

```sh
npm test
npm run dev
```

PowerShell에서 npm 실행이 차단되면 `npm.cmd test`, `npm.cmd run dev`를 사용하세요.

브라우저 검사는 Microsoft Edge와 실행 중인 대시보드가 필요합니다. Windows PowerShell에서 검사 도구와 결과 폴더를 준비한 뒤 실행합니다.

```powershell
npm.cmd install --no-save --package-lock=false @playwright/test
New-Item -ItemType Directory -Force screenshots
node scripts/check-browser.mjs
```

일반 프로그램 실행과 단위 테스트에는 이 추가 설치가 필요하지 않습니다.

데이터 조사 기록: [펀딩비 데이터](research/NOTES.md) · [Lighter RH](research/LIGHTER_RH.md)

</details>

## 이미지 출처

거래소·종목 로고의 권리는 각 브랜드 소유자에게 있습니다. 종목별 이미지 출처는 [sources.json](public/assets/markets/sources.json), 포함된 폰트의 라이선스는 [OFL.txt](public/assets/fonts/OFL.txt)에서 확인할 수 있습니다.
