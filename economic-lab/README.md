# Economic Lab — Four-Country Agent Economy

경제에 집중한 별도 실험 프로젝트다. 목표는 거시지표를 직접 갱신하는 모델이 아니라, **개별 경제주체의 추론·계약·거래·회계에서 거시경제가 파생되는 4개국 Agent-Based Economy**를 만드는 것이다.

## 핵심 원칙

1. GDP, CPI, 실업률, 평균임금, 기업이익은 원인이 아니라 파생 관측치다.
2. 가계·기업·은행·정부·중앙은행은 서로 다른 정보와 목표를 가진다.
3. Agent의 추론은 틀릴 수 있다. Objective Economy와 Agent Belief를 분리한다.
4. Agent는 관찰 → 믿음/기대 → 가설 → 계획 후보 → 반사실적 비교 → 행동 → 학습 순환을 가진다.
5. AI는 Action Intent를 만든다. 실제 거래와 지급은 Market/Settlement/Accounting Engine이 판정한다.
6. 화폐·재고·채권·채무는 장부 없이 직접 증감시키지 않는 방향으로 확장한다.
7. 국가의 초기 차이는 결과를 고정하지 않는다. 4개국은 초기조건만 다르고 장기 역할은 시뮬레이션 결과다.

## 4개 국가

| ID | 국가명 | 초기 특징 | 의미 |
|---|---|---|---|
| AST | 아스테라 | 중상 인적자본, 중간 자본, 보통 개방도 | 균형형 초기조건 |
| BRN | 브리노르 | 큰 노동공급, 낮은 초기 자본, 높은 내수 비중 | 규모가 크지만 생산성 격차 존재 |
| CYR | 사이렌 | 작은 인구, 높은 금융접근성·개방도 | 대외충격에 민감할 수 있음 |
| DRN | 데렌 | 높은 자원기반, 중간 인적자본, 낮은 금융심도 | 자원·투자 배분에 따라 경로가 달라짐 |

이 설명은 국가의 고정 역할이 아니다. 실제 산업구조, 임금, 성장, 위기, 무역구조는 미시행동의 결과로 형성한다.

## 미시 → 거시 구조

### L0. Settlement + Accounting Reality

v0.3부터 회계를 두 층으로 분리한다.

**Settlement Ledger**
- 실제 현금 계정
- 기업 → 가계 임금 지급
- 가계 → 기업 상품대금 지급
- 동일 국가 내부 0합 posting
- 화폐량 보존·음수 계정 검증

**General Ledger**
- Entity별 복식부기
- 자산 / 부채 / 자본 / 수익 / 비용
- 가계: 현금, 미수임금, 임금수익, 소비비용, 자본
- 기업: 현금, 재고자산, 미지급임금, 매출, 매출원가, 자본
- 매월 수익·비용을 Retained Earnings로 마감
- `Assets = Liabilities + Equity` 자동 검증
- Settlement 현금과 General Ledger 현금 자동 대사(reconciliation)

현재 재고 원가는 **초기 표준원가 + 실제 발생 노동원가**를 기준으로 이동평균에 가깝게 추적한다. 중간재·에너지·원자재의 실제 기업간 거래 원가는 L3 산업/공급망 단계에서 추가한다.

### L1. Individual / Household / Firm / Bank Agent
- 현재: 가계 Agent, 기업 Agent
- 다음: 은행 Agent
- 후속: 정부·중앙은행 Agent

### L2. Markets
- 현재: 상품시장, 노동시장
- 다음: 신용시장
- 후속: 자산시장, 주택시장

### L3. Sector / Supply Chain
- 산업별 생산
- 중간재 연결
- 기업간 거래
- 생산성·투자·진입·퇴출

### L4. National Macro
- GDP
- CPI/PPI
- 실업률
- 임금
- 소비·투자
- 기업이익
- 민간부채
- 정부재정
- 통화·신용

가능한 한 L0~L3의 실제 상태와 거래를 집계해서 계산한다.

### L5. International Economy
- 4개국 상품무역
- 환율
- 국제금융
- 자본이동
- 공급망
- 정책·금융 충격의 전파

## Agent Reasoning

각 Agent는 세계의 정답을 직접 보지 않는다.

Objective Economy
→ Agent Perception
→ Belief / Expectations
→ Hypothesis
→ Candidate Plans
→ Counterfactual Evaluation
→ Action Intent
→ Market / Settlement / Accounting Resolution
→ Real Outcome
→ Forecast Error
→ Learning

잘못된 정보, 오래된 정보, 작은 표본, 과도한 낙관/비관, 잘못된 인과추론이 허용된다.

## 현재 v0.3 범위

- 4개 국가 Seed
- 가계 Agent / 기업 Agent
- Agent별 Belief/Expectation과 Reasoning Trace
- 기업의 확장·방어·가격경쟁·유지 전략 비교
- 월 단위 노동시장: 해고, 탐색마찰, 채용, 미충원, 임금압력
- 실제 임금 Settlement
- 제한 정보 상품 탐색과 실제 구매 Settlement
- 기업 생산·재고·판매
- Settlement Ledger의 화폐량 보존
- General Ledger 복식부기
- 가계 대차대조표 / 손익
- 기업 대차대조표 / 손익
- 임금 발생주의: Wage Receivable / Wages Payable
- 생산 노동원가의 재고자산 계상
- 판매 시 매출 및 COGS 인식
- 월말 수익·비용 마감과 Retained Earnings 반영
- Entity별 `A = L + E` 검증
- Settlement Cash ↔ Accounting Cash 대사
- 국가별 총자산·총부채·총자본·기업이익 파생
- UI에서 재무제표와 General Ledger 분개 확인
- CI에서 4개국·시장거래·화폐보존·복식부기·현금대사·빌드 자동 검사

## 아직 구현하지 않은 핵심

v0.3은 **비은행 민간경제의 회계 기반**이다. 아직 은행이 없으므로 예금·대출·신용창조·이자·부실채권·은행 자기자본은 존재하지 않는다. 따라서 현재 Settlement 화폐량은 국가 내부에서 보존된다.

또한 기업 재고원가에는 아직 기업간 중간재·원자재·에너지 구매가 없다. 이는 산업·공급망 단계에서 실제 거래로 대체한다.

다음 단계는 **은행·예금·대출·신용평가 AI·이자·연체/부도·은행 대차대조표·내생적 예금창조**다.

## 실행

```bash
cd economic-lab
npm install
npm test
npm run dev
```
