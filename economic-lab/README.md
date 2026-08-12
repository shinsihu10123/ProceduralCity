# Economic Lab — Four-Country Agent Economy

경제에 집중한 별도 실험 프로젝트다. 목표는 거시지표를 직접 갱신하는 모델이 아니라, **개별 경제주체의 행동과 거래에서 거시경제가 파생되는 4개국 Agent-Based Economy**를 만드는 것이다.

## 핵심 원칙

1. GDP, CPI, 실업률, 평균임금, 기업이익률은 원인이 아니라 파생 관측치다.
2. 가계·기업·은행·정부·중앙은행은 서로 다른 정보와 목표를 가진다.
3. Agent의 추론은 틀릴 수 있다. Objective Economy와 Agent Belief를 분리한다.
4. Agent는 관찰 → 기억 → 믿음/기대 → 가설 → 계획 후보 → 반사실적 비교 → 행동 → 학습 순환을 가진다.
5. 거래는 Market/Accounting Engine이 판정한다. AI가 거래 결과를 직접 선언하지 않는다.
6. 향후 회계는 Stock-Flow Consistent 구조와 복식부기 원장을 기준으로 확장한다.
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

### L0. Accounting / Reality
- 현금·예금·대출·자산·부채
- 재고·생산물·노동시간
- 거래·계약·지급
- 향후 복식부기 원장

### L1. Individual / Household / Firm / Bank Agent
- 개인·가계: 노동공급, 소비, 저축, 구직, 대출, 투자
- 기업: 생산, 가격, 임금, 채용, 해고, 재고, 투자, 차입
- 은행: 신용평가, 대출승인, 금리, 유동성, 자기자본
- 정부·중앙은행: 후속 단계에서 별도 Agent로 구현

### L2. Markets
- 상품시장
- 노동시장
- 신용시장
- 자산시장
- 주택시장

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

모든 값은 가능한 한 L0~L3에서 집계한다.

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
→ Memory
→ Belief / Expectations
→ Hypothesis
→ Candidate Plans
→ Counterfactual Evaluation
→ Action Intent
→ Market / Accounting Resolution
→ Real Outcome
→ Forecast Error
→ Learning

잘못된 정보, 오래된 정보, 작은 표본, 과도한 낙관/비관, 잘못된 인과추론이 허용된다.

## 현재 v0.1 범위

- 4개 국가 Seed
- 가계 Agent
- 기업 Agent
- Agent별 Belief/Expectation
- 제한된 경제 추론과 선택 이유 기록
- 월 단위 진행
- 기업 생산·가격·고용 결정
- 가계 소비·저축 결정
- 미시 상태에서 국가별 GDP·CPI·실업률·평균임금 파생
- 브라우저 대시보드

은행·복식부기·정부·중앙은행·국제무역은 다음 계층에서 확장한다.

## 실행

```bash
cd economic-lab
npm install
npm run dev
```
