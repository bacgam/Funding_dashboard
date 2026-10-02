# PERPDEX · Funding Desk

NADO·Variational·Hyperliquid·XYZ의 공개 펀딩비를 비교하는 로컬 대시보드입니다. 기존 `StonkDashboard`와 별도로 실행됩니다. API 키, 지갑 연결, npm 패키지 설치가 필요하지 않습니다. 주문 실행 기능은 없습니다.

## Hyperliquid 및 거래소 확장

기본 코인 마켓과 `perpDexs`에서 xyz만 허용한 XYZ 마켓을 수집하며, **Hyperliquid**와 **XYZ**를 별도 열·필터·연결 상태로 표시합니다. 같은 기초자산도 양쪽에 있으면 각각 표시하고 서로 비교할 수 있습니다. 기본 마켓은 5초, XYZ는 30초 간격으로 갱신하며 목록은 1시간마다 확인합니다. XYZ 일부 조회가 실패하면 해당 마켓만 지연 처리하며 나머지 거래소의 정상 비교는 유지합니다. 화면의 5초 갱신과 개별 마켓의 수신 시각은 별개입니다.

기본값은 선택 거래소의 **전체 상장 종목**입니다. 미상장 칸은 `-`이며 0%와 구분합니다. **2곳 이상 상장** 필터는 선택 거래소 중 적어도 두 곳에 상장된 티커를 표시합니다. 세 곳을 모두 선택해도 두 곳에만 상장된 종목의 비교는 가능합니다. 펀딩비는 유효한 비율 중 최저 롱·최고 숏, 가격 갭은 유효한 거래소 쌍 중 최대 갭을 표시합니다. 필터 변경 시 요약·순위·계산기·CSV 모두 다시 계산합니다.

`public/exchanges.js`에 거래소 표시 정보를 등록하면 필터·표 헤더·상세·차트·CSV가 함께 확장됩니다. 데이터 어댑터는 `server/feed.mjs`의 fetchers에 연결합니다. 선택 거래소 열은 남은 표 너비를 균등 분배하며, 좁은 화면에서는 표 내부 가로 스크롤을 사용합니다.

Hyperliquid 기본 마켓과 XYZ는 분리합니다. XYZ는 xyz: 계약만 수집합니다. para·io·mkts 등 다른 HIP-3 DEX는 수집·표시하지 않습니다. 비율이나 거래량에 따라 계약을 자동 교체하지 않습니다. 명시적으로 확인한 주식과 코인·단위 변환만 통합하며 `para:STX`(주식)와 `STX`(코인), `xyz:QNT`와 `QNT` 등은 구분합니다. 미확인 상품은 접두사를 유지해 별도 행에 표시합니다. 선택된 원본 계약은 셀 도움말·상세·CSV에서 확인할 수 있습니다. 결제 통화는 USDC·USDT0·USDe·USDH를 지원하고 각각 1 USD로 가정하며, 알 수 없는 담보 통화는 임의 환산하지 않습니다.

기존 NADO·Variational 배열 형식 이력은 그대로 읽으며, 새 관측값은 거래소 ID별로 저장합니다. 새 관측에는 `hyperliquidSplit: true`를 기록하고 `hyperliquid`와 `xyz` 비율을 별도로 저장합니다. 분리 전 Hyperliquid 이력은 계약 식별자가 없으므로 원본 파일에 보존하되 두 그룹의 새 차트에 연결하지 않습니다. 차트는 NADO 녹색 실선, Variational 분홍색 실선, Hyperliquid 녹색 점선, XYZ 분홍색 점선으로 구분합니다. 이전 hip3 통합 이력은 XYZ 이력으로 재사용하지 않습니다. XYZ 로고는 사용자가 첨부한 원본 PNG입니다.

공식 근거: [Hyperliquid 마켓 API](https://hyperliquid.gitbook.io/hyperliquid-docs/for-developers/api/info-endpoint/perpetuals), [펀딩비 및 1시간 정산](https://hyperliquid.gitbook.io/hyperliquid-docs/trading/funding), [API 호출 한도](https://hyperliquid.gitbook.io/hyperliquid-docs/for-developers/api/rate-limits-and-user-limits). 로고는 [공식 웹앱 아이콘](https://app.hyperliquid.xyz/apple-touch-icon.png)을 로컬에 저장했습니다.

`node scripts/check-hyperliquid-browser.mjs`로 0~5개 거래소의 자동 열 조정·미상장·선택 쌍·XYZ 주식·차트·CSV·부분 오류·모바일을 검증합니다.

## 선물 · 선물 가격 갭

화면 상단의 **선물 가격 갭**을 선택하면 선택한 거래소들의 마크 가격을 비교합니다. 가격 갭 TOP 3, 갭 비율과 USD 차이, 거래소별 가격, 갭 축소 방향을 표시하며 검색·정렬·즐겨찾기·거래소 필터·%/BPS·CSV를 지원합니다.

- 가격은 기초자산 1개 단위이며 kPEPE/kBONK/kSHIB는 1,000으로 나눕니다.
- 갭 비율 = `(고가 − 저가) ÷ 저가`. %는 ×100, BPS는 ×10,000입니다. 기간 환산은 하지 않습니다.
- 갭 축소 방향은 저가 롱·고가 숏입니다. 상세 화면에서 NADO의 Variational 대비 프리미엄과 이 방향의 8시간 펀딩비 차이도 볼 수 있습니다. 펀딩비 차이의 양수는 수취, 음수는 지불 추정입니다. 기존 펀딩 수익 계산기는 펀딩비 기준 방향을 유지합니다.
- 누락·0 이하 가격, API 실패, 가격 수신 후 2분 초과, 양쪽 수신 시차 30초 초과는 갭 계산에서 제외합니다. 가격 수신 시각과 펀딩비 갱신 시각은 별개입니다.
- 마크 가격은 체결 호가가 아닙니다. 원본 가격 갱신 시각은 보장할 수 없으며, USDT0·USDC·USDe·USDH를 각각 1 USD로 가정합니다. 표시 갭은 체결 수익을 의미하지 않습니다.

가격 갭 계산은 `public/price-gap.js`를 서버와 브라우저가 공유합니다. `node scripts/check-gap-browser.mjs`로 UI 검증을 실행합니다. 별도 포트 사용 시 `DASHBOARD_URL` 환경변수로 대상 URL을 지정할 수 있습니다.

## 실행

Node.js 22 이상에서 `start_funding_dashboard.cmd`를 더블클릭하고 **http://127.0.0.1:4180** 에 접속합니다.

```powershell
# 압축을 푼 폴더에서 터미널을 열고 실행합니다.
npm.cmd start
```

서버는 `127.0.0.1`에만 바인딩합니다. 실행 콘솔에서 Ctrl+C로 종료합니다. 다른 포트를 쓰려면 `$env:PORT = '4181'` 설정 후 실행하세요. 개발 시 `npm.cmd run dev`를 사용할 수 있습니다. 프런트엔드는 빌드 없이 제공됩니다.

## 기능

왼쪽 카테고리 메뉴는 대시보드(마켓 개요·관심 마켓), 펀딩비(실시간 펀딩비), 아비트라지(선물 가격 갭)로 구성됩니다. 그룹을 클릭하면 하위 메뉴를 접거나 펼칠 수 있으며 펼침 상태는 브라우저에 저장합니다. 선택 메뉴는 URL 해시로 연결되어 새로고침·뒤로가기·직접 링크를 지원합니다. 1180px 미만에서는 상단 메뉴 버튼으로 사이드바를 열 수 있으며, 배경 클릭·닫기 버튼·Escape로 닫습니다.

그룹과 하위 메뉴는 `public/navigation.js`의 `navigationGroups`에서 관리합니다. 새 화면은 메뉴 항목을 추가하고 `public/app.js`의 `initNavigation` 콜백에 연결합니다. `node scripts/check-navigation.mjs`로 그룹 토글·상태 저장·메뉴 이동·모바일·키보드 조작을 검증합니다.

종목 로고는 표의 티커 왼쪽과 TOP 3 카드에 표시되며 모바일에서도 유지됩니다. 2026-09-10 기준 562개 마켓의 로고를 `public/assets/markets/`에 저장했습니다. 코인은 CoinGecko 자산 ID, 주식·ETF·원자재는 Variational의 공개 에셋 및 Financial Modeling Prep의 종목 로고를 사용합니다. 개별 원본 주소와 자산 ID는 `public/assets/markets/sources.json`에 기록되어 있습니다. 로고의 권리는 각 브랜드 소유자에게 있습니다.

새 종목은 `sources.json`에 확인한 이미지 주소를 추가하고 `node scripts/collect-market-logos.mjs`를 실행한 뒤 서버를 재시작합니다. 기존 항목의 이미지를 다시 받으려면 해당 항목의 `file`과 `source`를 지운 후 실행합니다. 미등록 종목이나 이미지 로드 실패 시 이니셜을 표시합니다. `node scripts/check-market-logos.mjs`는 전체 이미지 디코딩, 표·카드 표시, 모바일, 실패 시 대체 표시를 검증합니다.

- 공통 마켓의 펀딩비 차이 TOP 3, 거래소별 비율과 롱·숏 조합
- 1H / 4H / 8H / Day / Week / 30D / Year 환산, % / BPS 전환
- 검색, 정렬, 거래소 선택, 공통 마켓 필터, 브라우저에 저장하는 즐겨찾기
- 한쪽 명목금액·보유 기간·양쪽 진입/청산 총비용을 입력하는 예상 수익 계산
- 화면에 필터링된 데이터의 CSV 다운로드 (시간당 소수 비율, 수신 시각, 지연 여부 포함)
- 서버 실행 중 약 1분마다 거래소별 마켓 관측값 저장, 최근 24시간 차트
- 5초 수집·화면 갱신, API 실패·지연 표시, 지연 데이터의 기회 계산 제외, 모바일 화면

조회는 약 5초 간격입니다. 여러 탭과 수동 새로고침은 서버의 수집 요청을 공유하며, 마지막 조회 시작 후 4.5초 이내에는 캐시를 반환합니다. 응답이 느리면 진행 중인 조회를 기다려 중복 호출하지 않습니다. 거래소 원본 데이터의 갱신 속도는 별개이며, 관측 이력 저장은 기존처럼 약 1분 간격입니다.

상세 화면은 카드 또는 표의 행을 클릭해서 엽니다. 데이터가 없는 종목을 0%로 대체하지 않습니다. API 접근이 실패해도 예시 데이터로 바꾸지 않습니다. 브라우저의 자동 새로고침을 끄더라도 서버의 이력 수집은 계속됩니다.

## 계산과 데이터 단위

| 항목 | 원본 | 시간당 환산 |
| --- | --- | --- |
| NADO | indexer `funding_rate_x18`, 24시간 비율 × 10¹⁸ | 원본 ÷ 10¹⁸ ÷ 24 |
| Variational | stats `funding_rate`, 연율 소수 비율 | 원본 ÷ 8,760 |
| Hyperliquid | `metaAndAssetCtxs`의 `funding`, 시간당 소수 비율 | 원본 그대로 (1시간 정산) |
| 기간별 표시 | 시간당 소수 비율 | × 기간(시간) × 100 (%) 또는 × 10,000 (BPS) |
| 펀딩 수입 추정 | 같은 USD 명목금액의 양쪽 포지션 | 한쪽 명목금액 × (숏 비율 − 롱 비율) × 보유 시간 |
| 비용 추정 | 사용자가 입력한 양쪽 진입·청산 총비용 | 한쪽 명목금액 × 총비용 BPS ÷ 10,000 |

펀딩비가 낮은 거래소에 롱, 높은 거래소에 숏을 배치합니다. 양수는 롱이 숏에게 지불하는 비율입니다. 두 비율이 같으면 방향을 제안하지 않습니다. Year는 365일 단순 APR이며 APY나 총 증거금 수익률이 아닙니다. 기본 총비용 10 BPS는 예시 입력값이며 실제 거래소 수수료를 의미하지 않습니다.

Variational의 공개 API 문서는 소수 비율이라고만 설명하며 기간을 명시하지 않습니다. 공식 웹앱의 `Ann. Funding` 표시와 `intervalSeconds / (365 * 24 * 3600) * annualRate` 환산식을 확인하여 연율로 처리했습니다. 정산 간격은 별도 정보이며 연율을 정산 간격으로 다시 나누지 않습니다. 확인 근거는 [research/NOTES.md](research/NOTES.md)에 있습니다.

NADO는 원본 펀딩비 갱신 시각, Variational은 수신 시각을 사용합니다. Variational API는 펀딩비 원본 갱신 시각과 다음 정산 시각을 제공하지 않습니다. `quotes.updated_at`은 호가 시각이므로 펀딩비 시각으로 대체하지 않습니다. 이 거래소의 API 내부 캐시 지연까지 탐지할 수는 없습니다.

원본/수신 데이터가 2분 이상 지연되거나 조회에 실패하면 마지막 정상값은 참고용으로 표시하고 조합 계산에서 제외합니다. NADO `trading_status=live`인 무기한 마켓만 포함합니다. 명시한 kPEPE/kBONK/kSHIB에 한해서 1,000단위 토큰을 매칭하고 가격을 환산합니다. 이름이 비슷한 다른 심볼을 임의로 합치지 않습니다.

결제 통화 USDT0·USDC·USDe·USDH는 각각 1 USD로 가정합니다. 거래소 간 가격 차이, 담보 가치 변화, 청산, 실제 체결 가능 수량은 계산하지 않습니다. RWA 마켓은 휴장이나 특별 펀딩 규칙이 있을 수 있으며 현재 비율의 기간 환산은 실제 지급액을 보장하지 않습니다.

## 구조 및 로컬 파일

```text
server.mjs                 로컬 HTTP 서버, 정적 파일, API
server/feed.mjs            거래소 조회, 캐시, 중복 요청 방지, 이력 저장
server/markets.mjs         원본 파싱, 단위 환산, 심볼 매칭, 조합 계산
public/                    화면, 스타일, 브라우저 동작
data/history.json          최근 24시간 관측값 (최대 1,440개 스냅샷)
tests/markets.test.mjs      계산·누락·지연·심볼 매칭 검증
scripts/check-browser.mjs  실제 Edge 브라우저 검증
```

`data/history.json`은 실행 시 자동 생성되며 서버 재시작 후에도 읽습니다. 수집 이전 과거 데이터는 제공하지 않으며, 차트는 정산 이력이 아닌 관측 이력입니다. 3분 이상 관측이 비면 선을 연결하지 않습니다. 저장 실패는 화면에 표시하고 현재 데이터 조회는 계속합니다.

## 검증

```powershell
npm.cmd test
node --check public/app.js
node scripts/check-browser.mjs
```

브라우저 검증은 실행 중인 4180 서버와 Microsoft Edge가 필요합니다. 검사할 때만 프로젝트 폴더에서 `npm.cmd install --no-save --package-lock=false @playwright/test`로 검사 도구를 설치하고 `New-Item -ItemType Directory -Force screenshots`로 결과 폴더를 만든 뒤 위 명령을 실행하세요. 앱 실행과 `npm.cmd test`에는 이 설치가 필요 없습니다. 브라우저 검증 결과 화면은 `screenshots/`에 저장됩니다.

2026-09-07 검증: NADO 71개, Variational 549개, 비교 가능한 공통 마켓 60개. 숫자는 상장 상태에 따라 달라집니다. 환산·방향·누락·지연 처리 단위 테스트와 실제 API를 사용하는 데스크톱/모바일 브라우저 동작을 확인했습니다.

공식 자료: [NADO Funding Rate API](https://docs.nado.xyz/developer-resources/api/archive-indexer/funding-rate), [Variational API](https://docs.variational.io/technical-documentation/api), [Variational 공식 마켓](https://omni.variational.io/markets).

## Crypto / RWA 필터

두 비교 페이지는 Crypto를 기본 표시하며 Crypto / RWA 버튼으로 전환합니다. 선택 분류는 표·CSV에만 적용되며 상단 요약과 TOP 3는 전체 분류 기준을 유지합니다. 선택은 페이지 간 이동 시 유지됩니다. 새로 열거나 새로고침하면 Crypto로 시작합니다. 분류 변경 시 검색어·거래소·공통 상장·즐겨찾기 필터를 유지합니다.

`public/asset-classes.js`의 검토된 기초자산 목록으로 분류합니다. RWA는 주식·ETF·지수·원자재·외환 및 PAXG·XAUT를 포함하며 ONDO 등 프로젝트 토큰은 Crypto입니다. QNT와 xyz:QNT, SPX와 xyz:SP500처럼 티커 충돌을 구분합니다. 신규 RWA 상장 시 이 목록을 갱신해야 합니다.

## Lighter RH · Robinhood Chain

Lighter RH를 다섯 번째 거래소로 연결합니다. 전용 ID는 `lighter_rh`이며 API·거래 링크·관측 이력은 기존 Lighter 메인넷과 분리합니다. 기존 메인넷은 아직 연결하지 않습니다.

- 공개 API: `https://api.rh.lighter.xyz/api/v1/orderBookDetails` (활성 무기한 마켓, 60초 캐시)
- 공개 스트림: `wss://api.rh.lighter.xyz/stream`의 `market_stats/all` 전체 스냅샷을 5초마다 수집하고 연결을 닫습니다.
- `current_funding_rate`는 다음 1시간 예상 퍼센트입니다. 시간당 소수 비율 = 원본 ÷ 100. 직전 정산값인 `funding_rate`로 대체하지 않습니다.
- 마크 가격·거래량·USDG 명목 미결제약정은 동일 스트림을 사용합니다. USDG는 1 USD로 가정합니다. 원본 패킷 시각으로 지연을 판정합니다.
- AI(Artificial Inu)는 `lighter_rh:AI`로 구분하여 다른 AI 자산과 합치지 않습니다. SLV·USO 등 ETF는 은·원유 현물과 별개입니다.
- API 실패 시 마지막 값을 지연 표시하고 비교에서 제외합니다. 과거 메인넷 이력은 가져오지 않습니다.

검증: `npm.cmd test`, `node scripts/check-lighter-rh-browser.mjs`. 공식 근거와 단위 확인은 [research/LIGHTER_RH.md](research/LIGHTER_RH.md)를 참고하세요.
