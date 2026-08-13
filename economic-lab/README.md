# Economic Lab — Four-Country Deep Cognitive Agent Economy

경제에 집중한 4개국 Agent-Based Economy다. 거시지표를 직접 조작하지 않고 **가계·기업·은행·정부·중앙은행의 제한된 인지와 실제 생산·거래·계약·회계에서 국내경제와 국제경제가 파생**되도록 만든다.

현재 기준 버전은 **v0.9 — Deep Cognitive Economy**다.

## 최상위 원칙

1. GDP, CPI, 실업률, 임금, 통화량, 민간부채, 공공부채, 정책금리, 주가, 환율, 수출입, 경상수지와 대외부채는 실제 미시 상태·거래·계약에서 파생한다.
2. Agent는 세계 전체를 알지 못한다. 제한된 관찰, 개인 기억, 불확실한 믿음, 편향, 사회적 정보와 자기 내부모형만 사용한다.
3. **Objective Economy와 Agent Belief를 분리한다.** Agent가 믿는다고 현실이 직접 바뀌지 않는다.
4. AI는 소비·생산·가격·고용·신용·재정·통화·해외자금공급의 의도를 만든다. 실제 결과는 Market / Settlement / Accounting Engine이 판정한다.
5. Agent의 가설·인과계수·경기국면 판단은 정답이 아니다. 경험으로 형성된 내부 경제모형이며 틀릴 수 있다.
6. 사회적 학습은 지식을 퍼뜨릴 수도 있지만 잘못된 믿음, herding, information cascade와 과신도 만들 수 있다.
7. 예금·준비금·대출·국채·재고·고정자산·주식·대외채권·대외채무를 장부 없이 임의 증감시키지 않는다.
8. 같은 Seed는 경제, 기억, 인과학습, 국면판단, 사회적 정보망과 선택까지 동일하게 재현되어야 한다.

## 4개 국가

- **AST 아스테라** — 중상 인적자본, 중간 자본, 보통 개방도
- **BRN 브리노르** — 큰 노동공급, 낮은 초기 자본, 높은 내수 비중
- **CYR 사이렌** — 작은 인구, 높은 금융접근성과 개방도
- **DRN 데렌** — 높은 자원기반, 중간 인적자본, 낮은 금융심도

각 국가에는 독립된 가계·기업·상업은행·정부·중앙은행·통화가 있다.

## 전체 실행 구조

```text
제한된 관찰
→ 개인 Belief posterior
→ 동료 정보 / 사회적 학습
→ 경기국면 확률 추론
→ 과거 유사 경험 검색
→ 가설 생성 + 가설 적중률 보정
→ 학습된 인과그래프
→ 자기 World Model
→ 반사실적 시나리오 생성
→ 위험조정 계획 비교
→ 행동 / 정책 Intent
→ 실제 시장·결제·회계
→ 실제 결과
→ 예측오차 / 보상 / 가설채점
→ 기억·인과계수·World Model 수정
```

## C0 — 제한된 관찰과 불확실성

Agent마다 관찰하는 물가·실업·수요·소득·신용·대외환경은 완전한 세계상태가 아니다. Agent별 noise, bias, uncertainty가 존재한다.

Belief는 단일 숫자가 아니라 최소한 다음 상태를 가진다.

- mean
- uncertainty
- observation count
- last forecast error

새 정보가 기존 믿음과 충돌하면 confirmation bias 때문에 업데이트가 약해질 수도 있다.

## C1 — Persistent Memory

Agent마다 최대 48개의 최근 경제 episode를 유지한다. 각 episode에는 다음이 결합된다.

- 당시 관찰·믿음
- Attention 수준
- 당시 가장 강한 가설
- 실제 선택
- 한 달 뒤 실제 결과
- 실현 reward
- 가설 평가

따라서 단순히 “지난달 수요증가율” 하나를 저장하는 것이 아니라 **상황 → 판단 → 행동 → 결과**의 경험 단위를 보존한다.

## C2 — Analogical Reasoning

현재 상태와 과거 episode의 유사도를 계산한다.

예를 들어 기업은 현재의:

- 수요증가율
- 실업률
- 신용스트레스
- 대외스트레스
- 재고압력
- 현금스트레스

와 비슷했던 과거 국면을 검색하고, 그때 실제 수요가 어떻게 끝났는지를 현재 전망에 가중한다.

가계·은행·정부·중앙은행도 각자 과거 유사국면을 사용한다.

## C3 — Learned Causal Graph

Agent마다 내부 인과그래프가 있다. 이 그래프는 객관적 진실이 아니라 **Agent가 경험을 통해 추정한 경제 인과모형**이다.

현재 학습 가능한 대표 링크:

- 수요 → 실업
- 수요 → 임금
- 수요 → 물가
- 물가 → 수요
- 실업 → 수요
- 신용스트레스 → 수요
- 대외스트레스 → 수요
- 정책금리 → 수요
- 정책금리 → 물가
- 정책금리 → 신용스트레스
- 신용스트레스 → 부도율
- 실업 → 부도율
- 대외스트레스 → 부도율
- 실업 → 소득증가율
- 물가 → 소득증가율
- 대외스트레스 → 신용스트레스
- 환율변동 → 대외스트레스
- 경상수지 → 대외스트레스

각 링크는:

- coefficient
- confidence
- observation count
- mean absolute error
- last error

를 가진다. 실제 결과와 예측의 차이로 계수와 신뢰도가 수정된다.

## C4 — Hypothesis Competition

Agent는 현재 상황을 하나의 원인으로 즉시 단정하지 않는다. 여러 가설을 동시에 유지한다.

대표 가설:

- 수요 약화
- 비용·물가 압력
- 신용 경색
- 대외 충격
- 경기 회복
- 기업 유동성 스트레스
- 가계 소득불안

각 가설은 한 달 뒤 실제 결과로 채점된다. 반복적으로 맞은 가설은 learned reliability가 상승하고, 반복적으로 틀린 가설은 다음 판단에서 신뢰도가 낮아진다.

## C5 — Probabilistic Economic Regime Inference

Agent는 경제를 한 가지 상태로 고정 분류하지 않고 다음 국면의 확률분포를 유지한다.

- normal
- recession
- inflation
- overheating
- credit_crisis
- external_crisis

각 Agent는:

- regime probabilities
- current / previous regime
- confidence
- entropy uncertainty
- transition history

를 가진다.

사회적 정보가 belief posterior를 바꾸면 **객관적 경제가 그대로여도 Agent의 경기국면 판단은 달라질 수 있다.** 이것이 이후 소비·투자·대출·정책 선택에 영향을 준다.

## C6 — Hierarchical Attention L0–L4

모든 Agent가 매월 깊은 계산을 하는 것은 비현실적이고 비효율적이다.

- **L0 Habit** — 관성적·저비용 판단
- **L1 Routine Review** — 기본 반응
- **L2 Deliberative** — 복수 전략 비교
- **L3 Counterfactual** — 다중 미래 시나리오 비교
- **L4 Deep Strategic** — 국면전환·위기 등 고위험 상황의 심층판단

surprise, distress, regime shift, crisis probability가 커지면 자동으로 L3/L4로 승격된다.

## C7 — Counterfactual Planning

Agent는 실제 행동 전에 복수 후보를 자기 내부모형 안에서 가상 실행한다.

### Household

- 유동성 방어
- 강한 절약
- 소비 절제
- 소비 유지
- 소비 확대

비교 대상에는 실질소비, 실업위험, 미래유동성, 부채부담이 포함된다.

### Firm

- 확장
- 방어
- 가격 경쟁
- 현금 보존
- 유지

예상 수요, 가격탄력성, 매출, 인건비, 생산비, 재고, 미래현금, distress risk를 비교한다.

### Commercial Bank

- 대출 승인
- 대출 거절

예상 부도율, 이자수익, 기대손실, 자본비용, 유동성비용과 기회비용을 비교한다.

### Government

- 강한 확장
- 확장
- 중립
- 재정건전화
- 강한 건전화

중기 실업·물가·부채 경로를 비교한다.

### Central Bank

- 강한 완화
- 완화
- 중립
- 긴축
- 강한 긴축

중기 물가·실업·신용스트레스·자산가격압력과 정책변동비용을 비교한다.

### International Funding Bank

- 해외자금 공급
- 해외자금 거절

과거 외환·대외위기 경험과 차입국 외채·경상수지·환율·은행건전성을 함께 사용한다.

## C8 — Social Learning / Herding / Information Cascades

Agent는 소수의 peer network를 가진다.

- 가계 → 가계
- 기업 → 같은 업종 기업 중심
- 은행 → 기업·가계 표본
- 정부·중앙은행 → 은행·기업·가계 정보 표본

Agent마다:

- conformity
- sourceTrust
- independence
- peer list
- source weight

가 다르다.

동료들의 믿음이 비슷할수록 집단신호가 강해질 수 있으며 uncertainty가 감소한다. 그러나 집단합의가 현실적으로 맞는지는 보장되지 않는다. 따라서:

```text
틀린 믿음
→ peer consensus
→ 과신
→ 소비/가격/대출/정책 행동 변화
→ 실제 시장에 영향
```

같은 endogenous information cascade가 가능하다.

중요하게도 사회적 믿음은 **객관적 CPI·GDP·환율을 직접 변경하지 않는다.** 오직 Agent의 perceived state와 행동을 바꾸고, 실제 거래 결과만 현실을 변경한다.

## Forecast Error와 자기모형 수정

예:

```text
기업 예상 수요증가율 +8%
실제 수요증가율 -3%
forecast error = -11%p
```

이 오류는:

- forecast calibration
- demand persistence
- wage/inflation persistence
- 정책전달 계수
- 신용위험 calibration
- causal-link coefficient
- hypothesis reliability

등의 다음 판단에 반영된다.

## Domestic / Financial / Fiscal / Monetary Economy

기존 v0.1~v0.7 계층은 그대로 유지한다.

- 노동시장
- 소비재시장
- 기업간 투입재시장
- 자본재·설비투자
- 상업은행 신용
- 예금창조·대출상환·부도
- 정부 조세·이전·구매·공공투자
- 국채
- 중앙은행 정책금리·준비금·유동성
- 주식 1차·2차시장
- 산업 공급망

## International Economy

v0.8 국제경제도 그대로 유지한다.

- 독립 통화: ASTC / BRNC / CYRC / DRNC
- 공통 세계계산단위 WXU
- 변동환율
- 원재료·중간재·소비재·자본재 국제무역
- 관세
- FX Settlement
- 대외수취채권·지급채무
- 해외대출·해외차입
- 경상수지
- 순대외자산 NFA
- 대외금융 스트레스

개방경제 GDP:

```text
GDP = C + I_private + I_public + G + ΔInventory + X - M
```

## Accounting Invariants

AI가 아무리 복잡해져도 실제 세계층의 회계 규칙은 AI가 수정할 수 없다.

자동 검증:

- `Assets = Liabilities + Equity`
- 은행예금부채 = 고객예금
- 은행대출자산 = 차주부채
- 정부 국채부채 = 금융기관 정부증권
- 중앙은행 준비금부채 = 상업은행 준비금
- 세계 총수출 = 세계 총수입 (WXU)
- 4개국 경상수지 합 = 0
- 4개국 순대외자산 합 = 0
- 해외대출자산 합 = 해외차입부채 합

v0.9 심층 정책경로가 드러낸 미세 국채상환 경계조건도 수정했다. 원금·이자가 매우 작더라도 양수이면 버리지 않고 정확한 복식분개를 생성한다.

## Determinism

동일 Seed는 다음까지 동일해야 한다.

- 거시경제
- Agent memory
- belief state
- world-model coefficients
- learned causal graph
- regime probabilities
- hypothesis reliability
- counterfactual decisions
- peer network
- social influence

이 조건은 CI에서 별도 Gate로 검사한다.

## Validation

`npm test`는 두 개의 독립 검증을 연속 실행한다.

1. `smoke-v09.mjs` — Deep Cognitive Economy Gate
2. `smoke-v09-social.mjs` — Social Learning / Herding Gate

그리고 `npm run build`로 실제 브라우저 Observer UI를 빌드한다.

## Observer UI

v0.9 화면에서 국가별로 다음을 관찰할 수 있다.

- L0~L4 사고깊이 분포
- 경기국면 확률
- 가설과 경험적 신뢰도
- 과거 유사국면
- 학습된 인과계수
- 반사실적 후보와 위험조정 효용
- 예측 bias / MAE
- 가계·기업·은행·정부·중앙은행의 선택 이유
- 국제금융 판단
- 국내·국제 회계 불변식

## 현재 의도적으로 남겨 둔 단순화

- 사람 수준의 자유로운 일반지능이나 의식은 구현 대상이 아니다.
- 내부 인과학습은 온라인 적응형 causal hypothesis이며 엄밀한 실험적 인과추론기가 아니다.
- 국가당 상업은행은 현재 1개다.
- FX dealer / order-book microstructure는 아직 없다.
- 외환보유액·국제준비자산·자본통제·제재·무역협정은 후속 확장 대상이다.
- 기업 product space와 금융상품 종류는 아직 제한적이다.
- 대규모 neural/RL policy는 아직 사용하지 않는다. 설명가능한 memory + beliefs + causal model + planning을 우선한다.

## 실행

```bash
cd economic-lab
npm install
npm test
npm run build
npm run dev
```

## 다음 단계

v0.9를 통과한 뒤 10단계에서는 **대규모 실행·성능·실험 프레임워크·충격 실험·분포 검증·장기 안정성**에 집중한다. 새로운 거시결과를 강제로 설계하기보다 현재의 자율 경제주체 AI가 더 큰 규모에서도 일관된 회계와 재현성을 유지하는지를 검증하는 단계다.
