# 프로젝트 용어집

문서 버전: 1.0.0  
상태: Stage 0 기준본  
적용 범위: 코드, 스키마, 문서, 테스트, UI 분석 라벨

## 상태와 데이터

### Authoritative State — 권위 상태

세계의 실제 진행을 결정하는 유일한 기준 상태. 각 권위 상태에는 하나의 소유 모듈만 존재하며, 외부 모듈은 직접 수정할 수 없다. 저장 대상이다.

### World Truth — 실제 세계 상태

시뮬레이션 내부에서 실제로 성립하는 권위 상태의 총체. 행위자가 자동으로 알 수 있는 정보가 아니다.

### Epistemic State — 인식 상태

행위자 또는 집단이 관찰·기억·추론·전달을 통해 믿는 상태. 실제 세계 상태와 다를 수 있다. `Observation`, `MemoryRecord`, `BeliefRecord`가 여기에 속한다.

### Derived State — 파생 상태

권위 상태에서 다시 계산할 수 있는 값. 캐시하거나 저장할 수 있지만 권위 상태를 대신하지 않는다.

### Presentation State — 표현 상태

렌더링과 UI를 위한 상태. 보간, 애니메이션 힌트, 그래픽 LOD 등을 포함할 수 있으나 시뮬레이션 판정에 사용할 수 없다.

### Revision — 상태 개정 번호

권위 상태가 성공적으로 Commit될 때 증가하는 버전. 판정 중 읽은 상태와 Commit 시점 상태가 같은지 검증하는 데 사용한다.

### Tombstone — 묘비 레코드

파괴되거나 보관된 개체의 최소 역사 레코드. 과거 Event, Memory, Knowledge가 이미 사라진 개체를 계속 참조할 수 있게 한다.

## 실행 흐름

### Tick — 틱

권위 시뮬레이션 시간의 최소 고정 진행 단위. 렌더링 프레임과 독립적이며 `u64` 단조 증가 값을 기준으로 한다.

### Fixed Tick — 고정 틱

실제 프레임 시간과 무관하게 같은 의미와 순서로 실행되는 시뮬레이션 스텝.

### Phase — 단계

한 틱 내부의 결정론적 실행 구간. 환경, 생물, 인지, 판정, 물리, Commit, 학습, LOD, Snapshot 발행 등으로 나뉜다.

### Query — 질의

다른 모듈의 공개 읽기 계약. 권위 상태를 수정하지 않는다.

### Intent — 행동 의도

행위자가 시도하려는 행동의 표현. 성공 결과를 포함하지 않는다. 예: `MoveIntent`, `ConsumeIntent`.

### Command — 명령

검증·판정·실행을 요청하는 버전된 데이터 계약. 발행자, 시점, 대상, 정보 근거, 자원 요구, 결정론적 순서를 포함한다.

### Resolution — 판정

Command가 현재 상태와 제약에서 가능한지 검사하고, 성공·부분 성공·실패 및 변경안을 계산하는 단계. 권위 상태를 직접 바꾸지 않는다.

### Reservation — 예약

Command가 사용할 자원이나 상태를 일시적으로 확보하는 중간 상태. 실제 소비나 이전은 Commit 성공 후 발생한다.

### StateDelta — 상태 변경안

권위 상태에 적용하려는 버전된 변경 단위. 대상, 예상 revision, 원인, 전후 digest, 자원 흐름과 난수 추적을 포함한다.

### CommitBatch — 커밋 묶음

하나의 원자성 범위에서 함께 적용되어야 하는 StateDelta 집합.

### Commit — 커밋

검증된 StateDelta를 권위 상태에 원자적으로 적용하고 불변 조건을 재검사하는 단계.

### Event — 사건

이미 발생한 사실을 표현하는 불변 데이터. 원인 Command, 선행 Event, 대상, 위치, 전후 digest와 결과를 연결한다.

### Event Ledger — 사건 원장

Event를 추가 전용으로 저장하고 인과 관계와 역사 조회를 제공하는 권위 기록 계층.

### Intervention — 실험자 개입

자연 발생 사건과 구분되는 기록된 외부 개입. UI가 권위 상태를 직접 수정하지 않고 `InterventionGateway → Command → Resolution → Commit` 경로를 따른다.

## 결정론과 무결성

### Determinism — 결정론

동일 코드·설정·초기 상태·시드에서 정의된 범위 안에서 동일한 실행 결과를 재현하는 성질.

### Deterministic Digest — 결정론 digest

특정 틱의 권위 상태를 안정된 직렬화·순서 규칙으로 요약한 hash. 두 실행의 상태 연속성을 비교하는 데 사용한다.

### Random Stream — 난수 스트림

`RandomService`가 관리하는 독립적 난수 흐름. 시스템·지역·개체 등의 범위로 분리하며 시드 파생 규칙과 draw 위치를 저장한다.

### Invariant — 불변 조건

정상 세계 상태에서 항상 참이어야 하는 조건. 예: ID 유일성, 참조 무결성, 자원 회계, 사망 개체 행동 금지.

### Conservation Account — 보존 계정

물질·자원·에너지의 시작량, 생성, 유입, 소비, 유출, 손실, 종료량을 설명하는 회계 구조.

## Snapshot과 영속화

### Snapshot — 스냅샷

특정 틱의 읽기 전용 상태 표현. 권위 상태 자체가 아니며 렌더링, 분석 또는 저장 준비에 사용한다.

### RenderSnapshot

Viewer가 소비하는 버전된 읽기 계약. 현재 tick, seed, digest, LOD, Region, Entity, Event 표현을 포함한다.

### World Snapshot

복원 가능한 권위 상태의 체크포인트. 모듈별 상태 segment와 manifest로 구성될 수 있다.

### World Save

World Snapshot, Event 위치, 난수 상태, 구성 hash, 모듈 버전, intervention 기록을 결합한 복원 가능한 저장 패키지.

### Manifest — 매니페스트

저장 또는 실행 결과에 포함된 구성·버전·segment·checksum·환경 메타데이터의 색인.

### Migration — 마이그레이션

이전 스키마의 저장 데이터를 새로운 스키마로 변환하는 버전된 절차. 원본을 보존하고 변환 후 불변 조건과 digest를 검증한다.

## 공간과 LOD

### Region — 지역

연속 세계를 계산·저장·LOD 작업 단위로 분할하는 내부 공간 단위. 세계 자체가 분리된 맵이라는 뜻은 아니다.

### Cell — 셀

Terrain, Climate, Water 등 공간장 상태의 최소 주소 단위.

### LOD — Level of Detail / 시뮬레이션 해상도

계산량을 제어하기 위해 같은 세계 상태를 다른 세부 수준으로 표현하는 체계. 카메라 거리만으로 결정하지 않는다.

### LOD-A Detail

개체·물체 단위 상세 계산 상태.

### LOD-B Local Aggregate

가구·작업단·건물·군집 수준의 지역 집계 상태. 중요 개체는 개별 유지한다.

### LOD-C Regional Aggregate

인구 코호트, 자원 계정, 생산·소비·이동 흐름 등의 광역 집계 상태.

### LOD-D Dormant

변화가 적은 지역의 장기 추세·예약 사건·핵심 인과 링크만 유지하는 휴면 상태.

### Aggregation — 집계

세부 상태를 보존량과 분포를 유지하는 AggregateState로 변환하는 과정.

### Deaggregation — 세분화 복원

AggregateState와 reconstruction seed를 사용해 세부 상태를 복원하는 과정. 존재하지 않은 역사를 꾸며내서는 안 된다.

## 창발과 분석

### Emergence — 창발

직접 명령되거나 단일 임계값으로 생성되지 않고, 하위 상태와 상호작용의 누적에서 복합 패턴이 발생하는 현상.

### Emergent Classification — 창발 패턴 분류

분석 계층이 이미 발생한 상태를 도시형·국가형·시장형 패턴 등으로 사후 분류하는 것. 분류는 권위 상태를 자동 변경하지 않는다.

### Causal Graph — 인과 그래프

Event 간 원인과 결과 연결을 탐색하는 읽기 모델.

### Knowledge Lineage — 지식 계보

지식이 관찰, 추론, 모방, 교육, 왜곡, 반박을 통해 전승·변형된 관계 그래프.

## 성능과 실행 모드

### Interactive Mode

Viewer와 시뮬레이션을 함께 실행하며 상세 지역과 입력 응답성을 우선하는 모드.

### Accelerated Mode

렌더링을 유지할 수 있으나 실제 시간당 시뮬레이션 틱 처리량을 우선하는 모드.

### Headless Research Mode

렌더링 없이 장기 실험·반복 실행·재현성을 우선하는 모드.

### Soak Test — 장기 안정성 시험

많은 틱 또는 장시간 실행하며 crash, 메모리 증가, 참조 손상, Event 연속성, 불변 조건 위반을 검증하는 시험.

### Baseline — 기준선

같은 환경과 설정의 후속 실행을 비교하기 위해 보존한 성능 측정 원점. 현재 GitHub Actions 기준선은 H1 공식 성능 판정이 아니다.
