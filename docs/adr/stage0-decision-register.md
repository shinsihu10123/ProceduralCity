# Stage 0 Architecture Decision Register

문서 버전: 1.0.0  
상태: Accepted  
기준 문서: Stage 0.3 전체 아키텍처 명세

## ADR-001 — 고정 틱 시뮬레이션

**상태:** Accepted  
**배경:** 렌더링 프레임 시간에 따라 세계 결과가 달라지면 재현성, 저장 일관성, 장기 실험 비교가 불가능하다.  
**결정:** 권위 시뮬레이션은 고정 틱으로 진행한다. 렌더링은 별도 프레임에서 Snapshot을 소비한다.  
**검토한 대안:** 가변 delta-time 기반 업데이트, 렌더 프레임 결합.  
**결과:** 결정론과 틱 경계 저장이 단순해지는 대신 overrun을 건너뛰지 않고 지연으로 처리해야 한다.  
**구현 상태:** 최소 `Tick`과 `SimulationHost::step` 구현·CI 검증 완료.  
**재검토 조건:** 공식 시간 단위 또는 micro-step 정책 변경.

## ADR-002 — Command → Resolution → Commit

**상태:** Accepted  
**배경:** AI·UI·상위 도메인이 결과를 직접 쓰면 실패, 비용, 충돌, 인과 기록을 우회한다.  
**결정:** 외부 요청은 Intent/Command로 제출하고, Resolution이 StateDelta를 생성하며, Commit이 권위 상태를 원자 적용한다.  
**검토한 대안:** 모듈 간 직접 메서드 호출, 상태 객체 공유.  
**결과:** 계약과 중간 데이터가 증가하지만 원인 추적과 테스트가 가능해진다.  
**구현 상태:** 아키텍처·스키마 방향 확정. 최소 실제 pipeline은 Stage 0 종료 직후 수직 슬라이스에서 구현.  
**재검토 조건:** 원자성 범위 또는 cross-module transaction 방식 변경.

## ADR-003 — 단일 권위 상태 소유자

**상태:** Accepted  
**배경:** 동일 사실을 여러 모듈이 가변 상태로 보유하면 충돌과 복원 불일치가 발생한다.  
**결정:** 모든 권위 상태에는 단 하나의 소유 모듈을 지정한다. 다른 모듈은 Query, Command, Event, Snapshot만 사용한다.  
**검토한 대안:** 공유 WorldState, 다중 writer, 전역 mutable singleton.  
**결과:** 모듈 경계가 엄격해지고 공개 계약 설계가 필수화된다.  
**구현 상태:** 현재 Kernel·Persistence·Viewer 경계에서 적용. 전체 도메인은 후속 Stage에서 확장.  
**재검토 조건:** 새로운 권위 상태 또는 소유권 이동.

## ADR-004 — Event Ledger

**상태:** Accepted  
**배경:** 장기 세계에서 결과만 저장하면 발생 원인, 리플레이, 연구 분석과 오류 추적이 불가능하다.  
**결정:** 주요 사건을 버전된 불변 Event로 추가 기록하고 원인·결과 연결을 유지한다.  
**검토한 대안:** 문자열 로그, 현재 상태만 저장, 전체 상태 diff 영구 보존.  
**결과:** 저장량 관리와 retention/압축 정책이 필요하다.  
**구현 상태:** 계약·데이터 구조 확정. 실제 EventLedger와 segment append는 첫 수직 슬라이스 대상.  
**재검토 조건:** Event retention, correction, causal index 정책 변경.

## ADR-005 — Snapshot + Event Log 영속화

**상태:** Accepted  
**배경:** 무한 장기 세계를 전체 사건 재생만으로 복원하거나 매 틱 전체 상태로 저장하는 방식은 각각 복원 시간과 저장량이 과도하다.  
**결정:** 주기적 World Snapshot과 이후 Event Segment를 결합한다. Manifest, schema version, checksum, random state를 함께 저장한다.  
**검토한 대안:** 전체 snapshot 전용, event sourcing 전용.  
**결과:** snapshot cadence, segment rotation, migration과 손상 복구 정책이 필요하다.  
**구현 상태:** `world-save.v1` 최소 manifest와 transactional write, load validation, deterministic resume 구현 완료. Event Segment는 후속 구현.  
**재검토 조건:** 저장 포맷·압축·분산 저장 방식 변경.

## ADR-006 — 다중 해상도 시뮬레이션

**상태:** Accepted  
**배경:** 하나의 연속 세계에서 모든 개체를 영구적으로 최고 정밀도로 계산하는 것은 장기 목표 규모에서 불가능하다.  
**결정:** LOD-A 상세, LOD-B 지역 집계, LOD-C 광역 집계, LOD-D 휴면 기록을 사용한다. 전환 시 인구·자원·중요 개체·지식·관계·인과 링크를 보존한다.  
**검토한 대안:** 화면 밖 정지, 단일 정밀도, 카메라 거리 전용 LOD.  
**결과:** aggregation/deaggregation 모델과 오차 검증이 핵심 연구 과제가 된다.  
**구현 상태:** 계약·성능 목표만 확정. 실제 LOD는 후속 Stage 대상.  
**재검토 조건:** LOD 수준 수, 보존량, reconstruction 정책 변경.

## ADR-007 — 읽기 전용 Observation API

**상태:** Accepted  
**배경:** Viewer·분석기·UI가 권위 상태에 쓰기 접근하면 시각화와 분류가 세계를 오염시킨다.  
**결정:** Presentation과 Analysis는 불변 Snapshot·Read Model만 소비한다. 실험 개입은 별도 InterventionGateway를 사용한다.  
**검토한 대안:** Viewer가 core 객체를 직접 참조, editor 직접 상태 수정.  
**결과:** Snapshot 발행 지연과 read-model 변환 비용을 관리해야 한다.  
**구현 상태:** `RenderSnapshot v1`과 TypeScript runtime validation, 읽기 전용 Viewer 연결 완료.  
**재검토 조건:** 원격 Viewer protocol 또는 실험 API 추가.

## ADR-008 — Headless-first

**상태:** Accepted  
**배경:** 장기 실험, CI, 결정론 검증과 서버 실행은 렌더러 없이 완전한 세계 실행을 요구한다.  
**결정:** 시뮬레이션 코어와 Headless runner를 우선 구현하고 Viewer는 Snapshot 소비자로 둔다.  
**검토한 대안:** 게임 엔진 scene을 실행 중심으로 사용, Viewer 필수 의존.  
**결과:** 렌더링 없이도 모든 권위 기능과 저장·복원이 검증되어야 한다.  
**구현 상태:** Rust Headless runner, Save/Load, benchmark와 CI 완료.  
**재검토 조건:** 네트워크 분산 실행 또는 별도 simulation server 도입.

## 변경 규칙

- ADR 상태: Proposed, Accepted, Superseded, Rejected, Deprecated.
- Level 2 이상 변경은 새 ADR 또는 기존 ADR의 Superseded 처리가 필요하다.
- 이 레지스터의 결정은 Stage 0.1·0.2 프로젝트 헌법보다 우선하지 않는다.
