import { exchanges, exchangeIds } from './exchanges.js';
import { compareMarkets } from './comparison.js';
import { priceIsStale } from './price-gap.js';
import { marketLogos } from './market-logos.js';
import { initNavigation } from './navigation.js';
import { classifyMarket } from './asset-classes.js';
const $ = selector => document.querySelector(selector);
const names = Object.fromEntries(exchanges.map(e => [e.id, e.name]));
const metadata = Object.fromEntries(exchanges.map(e => [e.id, e]));
const exchangeLabel = key => `<span class="exchange-name"><img class="mini-logo ${key}" src="${metadata[key].logo}" alt="" width="22" height="22">${names[key]}</span>`;
const esc = value => String(value ?? '').replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
const failedLogos = new Set();
function marketIcon(symbol, eager = false) {
  const source = Object.hasOwn(marketLogos, symbol) && !failedLogos.has(symbol) ? marketLogos[symbol] : null;
  return `<span class="coin market-icon${source ? ' has-logo' : ''}" aria-hidden="true"><span class="market-initials">${esc(symbol.slice(0, 3))}</span>${source ? `<img class="market-logo" data-symbol="${esc(symbol)}" src="${esc(source)}" alt="" width="32" height="32" loading="${eager ? 'eager' : 'lazy'}" decoding="async">` : ''}</span>`;
}
// Capture image failures without inline handlers, including dynamically rendered rows.
document.addEventListener('error', event => {
  const image = event.target;
  if (!(image instanceof HTMLImageElement) || !image.classList.contains('market-logo')) return;
  failedLogos.add(image.dataset.symbol);
  image.parentElement.classList.remove('has-logo');
  image.remove();
}, true);
let savedFavorites = [];
try { const saved = JSON.parse(localStorage.getItem('funding-favorites') ?? '[]'); if (Array.isArray(saved)) savedFavorites = saved.filter(s => typeof s === 'string'); } catch {}
const state = { data: null, mode: 'funding', assetClass: 'crypto', hours: 8, unit: 'percent', exchanges: new Set(exchangeIds), favorites: new Set(savedFavorites), sort: 'spread', direction: -1, busy: false, error: null, selected: null };
const nf = (n, digits = 2) => Number(n).toLocaleString('en-US', { minimumFractionDigits: digits, maximumFractionDigits: digits });
const usd = n => n === null || !Number.isFinite(n) ? '—' : `${n < 0 ? '−' : ''}$${nf(Math.abs(n))}`;
const priceUsd = n => !Number.isFinite(n) ? '—' : '$' + Number(n).toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: Math.abs(n) >= 1 ? 4 : 10 });
const isGap = () => state.mode === 'gap';
const spreadValue = row => isGap() ? row.priceGapRatio : row.spreadHourly;
const spreadText = row => isGap() ? rate(row.priceGapRatio, 1) : rate(row.spreadHourly);
const compactUsd = n => n === null || !Number.isFinite(n) ? '—' : '$' + Intl.NumberFormat('en-US', { notation: 'compact', maximumFractionDigits: 1 }).format(n);
function rate(hourly, hours = state.hours, unit = state.unit) {
  if (hourly === null || !Number.isFinite(hourly)) return '—';
  const value = hourly * hours * (unit === 'bps' ? 10000 : 100);
  return `${value > 0 ? '+' : ''}${nf(value, unit === 'bps' || hours === 8760 ? 2 : 4)}${unit === 'bps' ? '' : '%'}`;
}
function time(at) { return at ? new Date(at).toLocaleTimeString('ko-KR', { hour12: false }) : '—'; }
function rowsNow() {
  return (state.data?.rows ?? []).map(original => {
    const row = { ...original };
    for (const key of Object.keys(names)) if (row[key]) row[key] = { ...row[key], stale: row[key].stale || Date.now() - row[key].fetchedAt > 120000 || (row[key].sourceAt !== null && Date.now() - row[key].sourceAt > 120000) || !!state.error };
    for (const key of exchangeIds) if (row[key]) {
      row[key].stale ||= !!state.data.sources[key]?.error || !!row[key].sourceError;
      row[key].priceStale = priceIsStale(row[key]) || !!state.error || !!state.data.sources[key]?.error || !!row[key].sourceError;
    }
    return { ...row, ...compareMarkets(row, [...state.exchanges]) };
  });
}
function minVolume(row) {
  const values = [...state.exchanges].filter(k => row[k]).map(k => row[k].volume);
  return values.length && values.every(v => v !== null && Number.isFinite(v)) ? Math.min(...values) : null;
}
function categoryRows(assetClass) {
  return rowsNow().filter(row => !assetClass || (row.assetClass ?? classifyMarket(row)) === assetClass);
}
function filteredRows(assetClass = state.assetClass) {
  const query = $('#search').value.trim().toLowerCase();
  return categoryRows(assetClass).filter(row => {
    if (![...state.exchanges].some(key => row[key])) return false;
    if ($('#common-only').checked && [...state.exchanges].filter(key => row[key]).length < 2) return false;
    if ($('#favorites-only').checked && !state.favorites.has(row.symbol)) return false;
    return !query || row.symbol.toLowerCase().includes(query) || row.name.toLowerCase().includes(query);
  }).sort((a,b) => {
    if (state.sort === 'symbol') return a.symbol.localeCompare(b.symbol) * state.direction;
    const va = state.sort === 'volume' ? minVolume(a) : state.exchanges.size >= 2 ? spreadValue(a) : null;
    const vb = state.sort === 'volume' ? minVolume(b) : state.exchanges.size >= 2 ? spreadValue(b) : null;
    if (va === null) return vb === null ? a.symbol.localeCompare(b.symbol) : 1;
    if (vb === null) return -1;
    return (va-vb) * state.direction || a.symbol.localeCompare(b.symbol);
  });
}
function position(original, card = false, gap = isGap()) {
  const row = gap ? { ...original, long: original.priceLong, short: original.priceShort } : original;
  if (!row.long || state.exchanges.size < 2) return '<span class="subtle">조합 없음</span>';
  if (card) return `<span class="side-long">↗ LONG</span><b>${names[row.long]}</b><span class="path-arrow">→</span><span class="side-short">↘ SHORT</span><b>${names[row.short]}</b>`;
  return `<div class="positions"><div><span class="positive">↗</span><em>LONG</em><b>${names[row.long]}</b></div><div><span class="negative">↘</span><em>SHORT</em><b>${names[row.short]}</b></div></div>`;
}
function renderSummary() {
  const rows = state.exchanges.size >= 2 ? rowsNow().filter(r => isGap() ? r.priceComparable : r.comparable) : [];
  const spreads = rows.map(spreadValue);
  $('#common-count').textContent = state.data ? `${rows.length}` : '—';
  $('#max-spread').textContent = spreads.length ? rate(Math.max(...spreads),isGap()?1:24,'percent') : '—';
  $('#avg-spread').textContent = spreads.length ? rate(spreads.reduce((a,b)=>a+b,0)/spreads.length,isGap()?1:24,'percent') : '—';
  const warnings = [];
  if (state.error) warnings.push(state.error);
  let healthy = 0;
  if (state.data) {
    $('#health').innerHTML = Object.entries(state.data.sources).map(([key,s]) => {
      const ok = !s.error && s.fetchedAt && Date.now()-s.fetchedAt <= 120000 && !state.error;
      if (ok) healthy++;
      if (s.warning) warnings.push(`${names[key]}: ${s.warning}`);
      if (s.error) warnings.push(`${names[key]}: ${s.error}. 마지막 정상 데이터는 참고용이며 조합 계산에서 제외합니다.`);
      return `${names[key]} <b class="${ok ? 'positive' : 'negative'}">${ok ? '● 연결' : '○ 지연'}</b>`;
    }).join(' ');
    const staleCount = rowsNow().filter(r => [...state.exchanges].some(key => isGap() ? r[key]?.priceStale : r[key]?.stale)).length;
    if (staleCount && !warnings.length) warnings.push(`갱신이 지연된 ${staleCount}개 마켓은 조합 계산에서 제외했습니다.`);
    if (state.data.storageError) warnings.push(state.data.storageError);
    $('#updated').textContent = `마지막 수신 ${time(state.data.at)} · 로컬 시간`;
  }
  $('#connection').textContent = state.busy && !state.data ? 'CONNECTING' : healthy === exchangeIds.length ? '● LIVE DATA' : state.data ? '○ DATA DELAYED' : '○ OFFLINE';
  $('#notice').hidden = warnings.length === 0;
  $('#notice').textContent = warnings.join(' ');
  const top = state.exchanges.size >= 2 ? filteredRows(null).filter(r => isGap() ? r.priceComparable && r.priceLong : r.comparable && r.long).sort((a,b)=>spreadValue(b)-spreadValue(a)).slice(0,3) : [];
  $('#top-cards').innerHTML = top.length ? top.map((r,i) => `<button class="card" data-detail="${esc(r.symbol)}" aria-label="${esc(r.symbol)} ${isGap()?'가격 갭 상세':'예상 수익'} 보기"><div class="card-top">${marketIcon(r.symbol,true)}<h3>${esc(r.symbol)}<small>${esc(r.name)}</small></h3><span class="rank">0${i+1} ${i===0?'↗':''}</span></div><div class="card-rate"><strong>${rate(isGap()?r.priceGapRatio:r.spreadHourly,isGap()?1:24,'percent')}</strong><span>${isGap()?'현재 갭':'/ day'}</span></div><div class="card-apr">${isGap()?`가격 차이 <b>${priceUsd(r.priceGap)}</b>`:`단순 연환산 APR <b>${rate(r.spreadHourly,8760,'percent')}</b>`}</div><div class="position-path">${position(r,true)}</div></button>`).join('') : `<div class="empty-card">${!state.data && state.busy ? '실시간 기회를 찾고 있습니다…' : state.exchanges.size < 2 ? '거래소를 두 곳 이상 선택하면 차이를 비교할 수 있습니다.' : '현재 필터에서 비교 가능한 기회가 없습니다. 검색 조건과 연결 상태를 확인하세요.'}</div>`;
}
function rateCell(m, key, row) {
  if (!m) return `<td data-column="${key}" class="rate-cell missing-cell" title="미상장 / 데이터 없음" aria-label="${names[key]} 미상장 / 데이터 없음">-</td>`;
  if (isGap()) {
    const side = row.priceLong === key ? 'gap-long' : row.priceShort === key ? 'gap-short' : '';
    return `<td data-column="${key}" class="rate-cell price-cell ${side} ${m.priceStale?'rate-stale':''}">${m.price > 0 ? priceUsd(m.price) : '—'}<small>${m.priceStale?'가격 수신 지연 · 참고용':!(m.price>0)?'가격 미제공':`${side === 'gap-long' ? '롱 · 저가' : side === 'gap-short' ? '숏 · 고가' : '마크'} · 수신 ${time(m.priceFetchedAt)}`}</small></td>`;
  }
  const cls = m.hourlyRate > 1e-14 ? 'rate-pos' : m.hourlyRate < -1e-14 ? 'rate-neg' : 'rate-zero';
  const remaining = m.nextFundingAt && m.nextFundingAt > Date.now() ? ` · ${Math.ceil((m.nextFundingAt-Date.now())/60000)}분 후` : '';
  const title = `${m.nativeSymbol} · ${m.sourceAt ? '원본 갱신' : '수신'} ${time(m.sourceAt ?? m.fetchedAt)} · 원본 ${m.rawRate} (${m.rateBasis})`;
  return `<td data-column="${key}" class="rate-cell ${cls} ${m.stale?'rate-stale':''}" title="${esc(title)}">${rate(m.hourlyRate)}<small>${m.stale?'지연 · 참고용':m.hourlyRate===null?'펀딩비 미제공':`${m.intervalHours??'—'}h 정산${remaining}`}</small></td>`;
}
function renderTable() {
  const rows = filteredRows();
  const table = $('.table-wrap table');
  table.style.setProperty('--exchange-count', Math.max(1, state.exchanges.size));
  table.querySelector('colgroup').innerHTML = `<col style="width:18%"><col style="width:12%">${[...state.exchanges].map(() => `<col style="width:${39 / state.exchanges.size}%">`).join('')}<col style="width:${state.exchanges.size ? 16 : 55}%"><col style="width:12%"><col style="width:3%">`;
  $('#result-count').textContent = `${rows.length}개 마켓${$('#favorites-only').checked ? ' · 즐겨찾기' : ''}`;
  const labels = {1:'1시간',4:'4시간',8:'8시간',24:'1일',168:'1주',720:'30일',8760:'연환산 APR'};
  $('#basis').textContent = `${isGap()?'마크 가격 · 저가 기준':labels[state.hours]} · ${state.unit === 'bps' ? 'BPS' : '%'}`;
  $('#rows').innerHTML = rows.length ? rows.map(r => `<tr tabindex="0" data-detail="${esc(r.symbol)}" aria-label="${esc(r.symbol)} 상세 보기"><td><div class="symbol-content"><button class="favorite ${state.favorites.has(r.symbol)?'active':''}" data-favorite="${esc(r.symbol)}" aria-label="${esc(r.symbol)} 즐겨찾기" aria-pressed="${state.favorites.has(r.symbol)}">${state.favorites.has(r.symbol)?'★':'☆'}</button>${marketIcon(r.symbol)}<span class="symbol-name">${esc(r.symbol)}<small>${esc(r.name)}</small></span></div></td><td><strong class="spread-number">${state.exchanges.size>=2?spreadText(r):'—'}</strong>${isGap()?`<small class="gap-difference">${state.exchanges.size>=2?priceUsd(r.priceGap):'—'} 차이</small>`:''}</td>${exchangeIds.map(key => rateCell(r[key],key,r)).join('')}<td>${position(r)}</td><td class="volume">${compactUsd(minVolume(r))}<small>${state.exchanges.size>=2?'상장 거래소 중 최소':'선택 거래소 거래량'}</small></td><td class="detail-col"><span class="row-open">↗</span></td></tr>`).join('') : `<tr><td colspan="${5 + state.exchanges.size}" class="empty">${state.exchanges.size===0?'거래소를 선택해주세요.':state.error?'데이터를 가져오지 못했습니다. 잠시 후 새로고침해주세요.':'조건에 맞는 마켓이 없습니다. 검색어나 필터를 변경해보세요.'}</td></tr>`;
  for (const key of Object.keys(names)) document.querySelectorAll(`[data-column="${key}"]`).forEach(el => {el.hidden=!state.exchanges.has(key);});
  document.querySelectorAll('[data-sort]').forEach(el => {
    el.querySelector('span').textContent = el.dataset.sort===state.sort ? state.direction===1?'↑':'↓' : '↕';
    el.closest('th').setAttribute('aria-sort', el.dataset.sort===state.sort ? state.direction===1?'ascending':'descending' : 'none');
  });
}
function renderMode() {
  const gap = isGap();
  document.querySelectorAll('[data-asset-class]').forEach(button => {
    const selected = button.dataset.assetClass === state.assetClass;
    button.classList.toggle('selected', selected);
    button.setAttribute('aria-pressed', String(selected));
  });
  $('#asset-class-note').textContent = state.assetClass === 'crypto' ? '암호화폐 마켓' : '주식 · ETF · 지수 · 원자재 · 외환';
  $('.intro h1').innerHTML = gap ? '선물 가격의 차이,<br class="mobile-break"> 갭을 한눈에<span>.</span>' : '펀딩비의 차이,<br class="mobile-break"> 기회를 한눈에<span>.</span>';
  $('.markets .eyebrow').textContent = gap ? 'THE PRICE GAP MATRIX' : 'THE FUNDING MATRIX';
  $('#max-label').textContent = gap ? '최대 선물 가격 갭' : '최대 펀딩비 차이';
  $('#avg-label').textContent = gap ? '평균 선물 가격 갭' : '평균 펀딩비 차이';
  document.querySelectorAll('.summary-basis').forEach(el => { el.textContent = gap ? 'MARK' : '24H'; });
  $('#summary-note').textContent = gap ? '(고가 − 저가) ÷ 저가 기준' : '한쪽 포지션 명목금액 기준';
  $('#top-title').textContent = gap ? '가장 큰 선물 가격 갭' : '가장 큰 펀딩비 차이';
  $('#top-note').textContent = gap ? '마크 가격 기준 · 실제 체결 호가와 다를 수 있습니다' : '현재 비율 유지 가정 · 비용 차감 전';
  $('#matrix-title').textContent = gap ? '선물 · 선물 가격 갭' : '펀딩비 대시보드';
  $('#matrix-note').textContent = gap ? '기초자산 1개 기준 가격 차이와 갭 축소 방향을 비교하세요.' : '같은 시간 기준으로 환산한 펀딩비와 롱·숏 조합을 확인하세요.';
  $('#spread-label').textContent = gap ? '가격 갭' : '펀딩비 차이';
  $('#position-label').textContent = gap ? '갭 축소 방향' : '펀딩비 기준 포지션';
  $('#periods').hidden = gap;
  $('.legend.positive').textContent = gap ? '● 롱: 저가 거래소' : '● 양수: 롱 지불';
  $('.legend.negative').textContent = gap ? '● 숏: 고가 거래소' : '● 음수: 숏 지불';
  $('#table-note').textContent = gap ? 'ⓘ 갭 = (고가 − 저가) ÷ 저가. 마크 가격 비교이며, 실제 체결 수익이 아닙니다.' : 'ⓘ 양수이면 롱이 숏에게, 음수이면 숏이 롱에게 지불합니다.';
}
function renderGapDetail(row) {
  const area = $('#detail-gap');
  if (!area) return;
  const usable = row?.priceComparable && state.exchanges.size >= 2;
  area.innerHTML = `<h3>선물 가격 갭 <span>MARK PRICE</span></h3><div class="gap-metrics"><div><small>저가 기준 최대 갭</small><strong>${usable?rate(row.priceGapRatio,1,'percent'):'—'}</strong></div><div><small>기초자산 1개당 차이</small><strong>${usable?priceUsd(row.priceGap):'—'}</strong></div>${state.exchanges.has('nado')&&state.exchanges.has('variational')&&Number.isFinite(row?.nadoPremium)?`<div><small>NADO 프리미엄 · Variational 대비</small><strong>${rate(row.nadoPremium,1,'percent')}</strong></div>`:''}</div><div class="position-path">${usable?position(row,true,true):'<span class="subtle">가격 비교 불가 · 최신 가격과 수신 시차를 확인하세요.</span>'}</div><p class="calc-explain">${usable&&row.priceLong?`위 갭 축소 방향의 8시간 펀딩비 차이: <b class="${row.gapFundingHourly<0?'negative':'positive'}">${rate(row.gapFundingHourly,8,'percent')}</b> · 양수는 수취, 음수는 지불 추정.<br>`:''}마크 가격 기준이며 실제 체결 호가와 다릅니다.<br>가격 수신: ${[...state.exchanges].map(key => `${names[key]} ${time(row?.[key]?.priceFetchedAt)}`).join(' / ')}. 원본 갱신 시각은 확인할 수 없습니다.</p>`;
}
function render() { renderMode(); renderSummary(); renderTable(); if ($('#detail').open) updateCalculator(); }
async function refresh() {
  if (state.busy) return;
  state.busy = true; $('#refresh').disabled = true;
  try {
    const response = await fetch('/api/funding', { signal: AbortSignal.timeout(28000) });
    if (!response.ok) throw new Error(`HTTP ${response.status}`);
    const data = await response.json();
    if (!Array.isArray(data.rows) || !data.sources) throw new Error('응답 형식 오류');
    state.data = data; state.error = null;
  } catch { state.error = '서버와 연결할 수 없습니다. 실행 파일과 네트워크 연결을 확인해주세요.'; }
  finally { state.busy = false; $('#refresh').disabled = false; render(); }
}
function openDetail(symbol) {
  const row = rowsNow().find(r => r.symbol === symbol);
  if (!row) return;
  state.selected = symbol;
  $('#detail-title').textContent = `${symbol} · 포지션 살펴보기`;
  $('#detail-body').innerHTML = `<div class="detail-rates">${exchangeIds.filter(key => state.exchanges.has(key)).map(key=>{
    const m = row[key];
    return `<div class="detail-rate">${exchangeLabel(key)}<strong class="${m?.hourlyRate>=0?'positive':'negative'}">${m ? rate(m.hourlyRate,8,'percent') : '-'}</strong><small>8시간 환산 · ${m?.stale?'지연 데이터':m?'현재 관측값':'데이터 없음'}<br>마크 가격 ${m ? priceUsd(m.price) : '-'}<br>${m?`${m.intervalHours??'—'}h 정산 · ${m.settlement}<br>${esc(m.nativeSymbol)}`:'-'}<br>${m?`${m.sourceAt?'원본 갱신':'수신'} ${time(m.sourceAt??m.fetchedAt)}`:''}</small></div>`;
  }).join('')}</div><section id="detail-gap" class="gap-detail"></section><section class="calc"><h3>예상 펀딩 수익 계산</h3><div id="calc-position" class="position-path">${position(row,true,false)}</div><div class="calc-inputs"><label>한쪽 포지션 명목금액 (USD)<input id="notional" type="number" min="0" max="1000000000" step="100" value="10000"></label><label>보유 기간 (일)<input id="days" type="number" min="0" max="365" step="0.5" value="1"></label><label>양쪽 진입·청산 총비용 (BPS)<input id="cost" type="number" min="0" max="10000" step="0.1" value="10"></label></div><div id="calc-output" class="calc-output"></div><p class="calc-explain">양쪽에 동일 명목금액으로 진입하며, 펀딩비가 보유 기간 내 유지된다고 가정합니다. 총비용 기본값 10 BPS는 예시입니다. 양쪽 거래소의 진입·청산 수수료와 스프레드·슬리피지를 합산하여 직접 입력하세요. 증거금 수익률·청산 위험·가격 손익은 계산하지 않습니다.</p></section><section class="history"><h3>펀딩비 관측 이력 <span class="subtle">8시간 환산 · 최근 24시간</span></h3><div id="chart-area" class="history-empty">로컬 수집 이력을 불러오고 있습니다…</div><p class="history-meta">서버 실행 중 약 1분마다 저장합니다. 실제 정산된 펀딩 내역이 아닙니다. Hyperliquid·XYZ 이력은 분리 적용 후 관측부터 표시합니다. ${exchanges.filter(e => state.exchanges.has(e.id)).map(e => `<span style="color:${e.color}">${e.dash ? '┄' : '━'} ${e.name}</span>`).join(' ')}</p></section><div class="trade-links">${exchanges.filter(e => state.exchanges.has(e.id)).map(e => `<a class="button" href="${['hyperliquid', 'xyz', 'lighter_rh'].includes(e.id) && row[e.id] ? `${e.url}/${encodeURIComponent(row[e.id].nativeSymbol)}` : e.url}" target="_blank" rel="noreferrer">${e.name} 거래소 열기 ↗</a>`).join('')}</div>`;
  for (const input of document.querySelectorAll('.calc-inputs input')) input.step = 'any';
  updateCalculator();
  $('#detail').showModal();
  loadHistory(symbol);
}
function updateCalculator() {
  if (!$('#notional')) return;
  const row = rowsNow().find(r=>r.symbol===state.selected);
  if (row) document.querySelectorAll('.detail-rate').forEach((el,i)=>{
    const key=exchangeIds.filter(key => state.exchanges.has(key))[i],m=row[key];
    el.innerHTML=`${exchangeLabel(key)}<strong class="${m?.hourlyRate>=0?'positive':'negative'}">${m ? rate(m.hourlyRate,8,'percent') : '-'}</strong><small>8시간 환산 · ${m?.stale?'지연 데이터':m?'현재 관측값':'데이터 없음'}<br>마크 가격 ${m ? priceUsd(m.price) : '-'}<br>${m?`${m.intervalHours??'—'}h 정산 · ${m.settlement}<br>${esc(m.nativeSymbol)}`:'-'}<br>${m?`${m.sourceAt?'원본 갱신':'수신'} ${time(m.sourceAt??m.fetchedAt)}`:''}</small>`;
  });
  renderGapDetail(row);
  const inputs = ['notional','days','cost'].map(id => $(`#${id}`));
  const valid = inputs.every(el => el.value !== '' && el.checkValidity());
  const [notional,days,cost] = inputs.map(el=>Number(el.value));
  const usable = row?.comparable && state.exchanges.size>=2 && valid;
  const gross = usable ? notional * row.spreadHourly * 24 * days : null;
  const fees = usable ? notional * cost / 10000 : null;
  const net = usable ? gross - fees : null;
  $('#calc-position').innerHTML = row ? position(row,true,false) : '—';
  $('#calc-output').innerHTML = `<div><span>예상 펀딩 수입</span><strong>${usd(gross)}</strong></div><div><span>입력 총비용</span><strong>${usd(fees)}</strong></div><div><span>비용 차감 후 추정</span><strong class="${net!==null&&net>=0?'positive':'negative'}">${usd(net)}</strong></div>${!usable?`<small style="grid-column:1/-1;color:#d5bc83">${valid?'양쪽의 최신 펀딩비가 필요합니다.':'금액·기간·비용에 유효한 양수를 입력해주세요.'}</small>`:''}`;
}
let historyRequest = 0;
async function loadHistory(symbol) {
  const requestId = ++historyRequest;
  try {
    const response = await fetch(`/api/history?symbol=${encodeURIComponent(symbol)}`,{signal:AbortSignal.timeout(10000)});
    if (!response.ok) throw new Error();
    const data = await response.json();
    if (requestId!==historyRequest || symbol!==state.selected) return;
    const active = exchanges.filter(e => state.exchanges.has(e.id));
    const points = data.filter(p=>active.some(e => Number.isFinite(p[e.id])));
    if (points.length<2) { $('#chart-area').className='history-empty'; $('#chart-area').textContent=`수집된 관측값 ${points.length}개 · 두 개 이상 모이면 차트가 표시됩니다. 약 1분 후 상세 화면을 다시 열어주세요.`; return; }
    const minT = points[0].at, maxT = points.at(-1).at;
    const values = points.flatMap(p=>active.map(e=>p[e.id]).filter(Number.isFinite)).map(v=>v*800);
    const low = Math.min(...values), high = Math.max(...values), pad = Math.max((high-low)*.15,.0005);
    const min=low-pad, max=high+pad;
    const x = t => 70+(t-minT)/(maxT-minT)*535;
    const y = v => 155-(v*800-min)/(max-min)*130;
    let svg = `<svg class="chart" viewBox="0 0 630 190" role="img" aria-label="${esc(symbol)} ${active.map(e=>e.name).join(' · ')}의 8시간 환산 펀딩비 이력">`;
    for(let i=0;i<4;i++) { const v=min+(max-min)*i/3, yy=155-i/3*130; svg+=`<line x1="70" x2="605" y1="${yy}" y2="${yy}" stroke="#2a3821"/><text x="8" y="${yy+4}">${nf(v,3)}%</text>`; }
    for(const {id:key,color,dash} of active) {
      let lastAt = null;
      const path = data.filter(p=>p.at>=minT&&p.at<=maxT).map(p=>{
        if (!Number.isFinite(p[key])) {lastAt=null;return '';}
        const command=lastAt!==null&&p.at-lastAt<180000?'L':'M'; lastAt=p.at;
        return `${command}${x(p.at).toFixed(1)},${y(p[key]).toFixed(1)}`;
      }).join(' ');
      svg+=`<path d="${path}" fill="none" stroke="${color}" stroke-width="2"${dash ? ` stroke-dasharray="${dash}"` : ''}/>`;
    }
    svg+=`<text x="70" y="178">${esc(time(minT))}</text><text x="546" y="178">${esc(time(maxT))}</text></svg><div class="history-meta">${points.length}개 관측 · ${new Date(minT).toLocaleDateString('ko-KR')} ${time(minT)} — ${time(maxT)}</div>`;
    $('#chart-area').className=''; $('#chart-area').innerHTML=svg;
  } catch { if(requestId===historyRequest) { $('#chart-area').className='history-empty'; $('#chart-area').textContent='수집 이력을 불러오지 못했습니다. 상세 화면을 다시 열어 재시도해주세요.'; } }
}
$('.exchange-filters').innerHTML = exchanges.map(e => `<button data-exchange="${e.id}" class="exchange selected" aria-pressed="true"><img class="exchange-logo" src="${e.logo}" alt="" width="30" height="30"><span>${e.name}<small>${e.description}</small></span><span class="check">✓</span></button>`).join('');
const heading = $('.table-wrap thead tr');
heading.querySelectorAll('th[data-column]').forEach(el => el.remove());
$('#position-label').insertAdjacentHTML('beforebegin', exchanges.map(e => `<th data-column="${e.id}"><span class="exchange-heading"><img class="mini-logo" src="${e.logo}" alt="" width="22" height="22">${e.name.toUpperCase()}</span></th>`).join(''));
$('.sidebar-exchanges').innerHTML = `<div class="connected-logos">${exchanges.map(e => `<img src="${e.logo}" alt="${e.name}" title="${e.name}" width="22" height="22">`).join('')}</div><span>${exchanges.length}개 거래소<small>연결된 마켓 데이터</small></span>`;
$('footer > div').innerHTML = exchanges.map(e => `<a href="${e.url}" target="_blank" rel="noreferrer">${e.name} ↗</a>`).join('');
$('#units').addEventListener('click',e=>{const b=e.target.closest('[data-unit]');if(!b)return;state.unit=b.dataset.unit;for(const el of $('#units').children){el.classList.toggle('selected',el===b);el.setAttribute('aria-pressed',String(el===b));}render();});
$('#periods').addEventListener('click',e=>{const b=e.target.closest('[data-hours]');if(!b)return;state.hours=Number(b.dataset.hours);for(const el of $('#periods').children){el.classList.toggle('selected',el===b);el.setAttribute('aria-pressed',String(el===b));}render();});
document.querySelectorAll('[data-hours]').forEach(el=>el.setAttribute('aria-pressed',String(Number(el.dataset.hours)===state.hours)));
document.querySelectorAll('[data-exchange]').forEach(el=>el.addEventListener('click',()=>{const k=el.dataset.exchange;state.exchanges.has(k)?state.exchanges.delete(k):state.exchanges.add(k);el.classList.toggle('selected',state.exchanges.has(k));el.setAttribute('aria-pressed',String(state.exchanges.has(k)));render();}));
$('#search').addEventListener('input',render);
for(const id of ['common-only','favorites-only']) $(`#${id}`).addEventListener('change',render);
document.querySelectorAll('[data-sort]').forEach(el=>el.addEventListener('click',()=>{if(state.sort===el.dataset.sort)state.direction*=-1;else{state.sort=el.dataset.sort;state.direction=state.sort==='symbol'?1:-1;}renderTable();}));
document.addEventListener('click',e=>{
  const fav=e.target.closest('[data-favorite]');
  if(fav){const s=fav.dataset.favorite;state.favorites.has(s)?state.favorites.delete(s):state.favorites.add(s);try{localStorage.setItem('funding-favorites',JSON.stringify([...state.favorites]));}catch{}render();return;}
  const target=e.target.closest('[data-detail]');if(target)openDetail(target.dataset.detail);
});
$('#rows').addEventListener('keydown',e=>{if(e.target.matches('tr')&&(e.key==='Enter'||e.key===' ')){e.preventDefault();openDetail(e.target.dataset.detail);}});
$('#detail-body').addEventListener('input',updateCalculator);
$('#refresh').addEventListener('click',refresh);
$('#asset-classes').addEventListener('click', event => {
  const button = event.target.closest('[data-asset-class]');
  if (!button || button.dataset.assetClass === state.assetClass) return;
  state.assetClass = button.dataset.assetClass;
  render();
});
for(const id of ['guide-open','guide-inline']) $(`#${id}`).addEventListener('click',()=>$('#guide').showModal());
for(const dialog of document.querySelectorAll('dialog')){dialog.querySelector('.close').addEventListener('click',()=>dialog.close());dialog.addEventListener('click',e=>{if(e.target===dialog){const r=dialog.getBoundingClientRect();if(e.clientX<r.left||e.clientX>r.right||e.clientY<r.top||e.clientY>r.bottom)dialog.close();}});}
$('#export').addEventListener('click',()=>{
  const ids = exchangeIds.filter(id => state.exchanges.has(id));
  const fields = ['symbol', ...ids.map(id => `${id}_hourly_decimal`), 'spread_hourly_decimal', 'long', 'short', ...ids.flatMap(id => [`${id}_fetched_at`, `${id}_stale`, `${id}_contract`])];
  const gapFields = ['symbol', ...ids.map(id => `${id}_mark_price`), 'gap_usd_per_unit', 'gap_decimal_low_basis', 'gap_long', 'gap_short', 'gap_direction_funding_hourly_decimal', ...ids.flatMap(id => [`${id}_price_received_at`, `${id}_price_stale`, `${id}_contract`])];
  const csvCell=value=>{let s=String(value??'');if(/^[=+@-]/.test(s.trimStart())&&!Number.isFinite(Number(s)))s="'"+s;return '"'+s.replaceAll('"','""')+'"';};
  const fundingRows=filteredRows().map(r=>[r.symbol,...ids.map(id=>r[id]?.hourlyRate),r.spreadHourly,r.long,r.short,...ids.flatMap(id=>[r[id]?.fetchedAt?new Date(r[id].fetchedAt).toISOString():null,r[id]?.stale,r[id]?.nativeSymbol])]);
  const gapRows=filteredRows().map(r=>[r.symbol,...ids.map(id=>r[id]?.price),r.priceGap,r.priceGapRatio,r.priceLong,r.priceShort,r.gapFundingHourly,...ids.flatMap(id=>[r[id]?.priceFetchedAt?new Date(r[id].priceFetchedAt).toISOString():null,r[id]?.priceStale,r[id]?.nativeSymbol])]);
  const csv=[isGap()?gapFields:fields,...(isGap()?gapRows:fundingRows)].map(row=>row.map(csvCell).join(',')).join('\r\n');
  const url=URL.createObjectURL(new Blob(['\uFEFF'+csv],{type:'text/csv;charset=utf-8'}));const link=document.createElement('a');link.href=url;link.download=`${isGap()?'price-gap':'funding'}-${new Date().toISOString().slice(0,10)}.csv`;link.click();setTimeout(()=>URL.revokeObjectURL(url),1000);
});
const autoRefreshEnabled = () => $('#auto').checked;
setInterval(()=>{if(autoRefreshEnabled()&&!document.hidden)void refresh();},5000);
setInterval(()=>{if(state.data&&!document.hidden)render();},15000);
document.addEventListener('visibilitychange',()=>{if(!document.hidden&&autoRefreshEnabled())void refresh();});
$('.intro h1').id = 'page-title';
$('.intro h1').tabIndex = -1;
initNavigation({
  onNavigate(page, scroll) {
    state.mode = page === 'gap' ? 'gap' : 'funding';
    state.sort = 'spread'; state.direction = -1;
    $('#favorites-only').checked = page === 'favorites';
    $('#search').value = '';
    render();
    if (scroll) {
      const target = page === 'favorites' ? $('#markets') : page === 'overview' ? $('.overview') : $('#workspace-main');
      target.scrollIntoView({ block: 'start' });
    }
    return $('#page-title');
  },
  onGuide: () => $('#guide').showModal(),
});
void refresh();
