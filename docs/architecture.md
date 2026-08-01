# Procedural City 아키텍처 v1.1

## 1. 생성 파이프라인

```text
사용자 시나리오
→ 문자열 시드 해싱
→ 결정론적 난수·가치 노이즈
→ 연속 지형·원본 표고 생성
→ Priority-Flood 배수 보정·D8 유역 누적
→ 하천·홍수 위험·수변 거리·개발 적합도 도출
→ 지형 비용 A* 간선도로·등고선 정렬 생활가로 생성
→ 도로·교차로·교량 메시
→ 다핵 중심지·대중교통 축 생성
→ 가로 전면을 따르는 필지 분할
→ 접근성·홍수·경사·수변 기반 토지 이용·밀도 점수화
→ 8종 복합 건축 매스·입면·옥상 생성
→ 대중교통·가로시설·녹색축 생성
→ 인구·일자리·녹지·접근성 지표
→ WebGL 버퍼 업로드
→ 시간대 기반 실시간 렌더링
```

## 2. 좌표와 스케일

- X, Z: 평면 도시 좌표
- Y: 표고 및 건축물 높이
- 1 WebGL 단위 = 1 m
- 기본 셀 크기 = 28 m
- 도시 범위 = `gridSize × 28 m`
- 건물 높이 = 층수 × 용도별 층고

v1.1은 도로 폭, 보도, 건물 높이, 역 접근 반경을 모두 미터 단위로 해석합니다.

## 3. 핵심 데이터 모델

```js
City {
  schemaVersion: 6,
  runtimeMode: 'v1.1-reality-engine',
  settings,
  terrain,
  hydrology,
  extent,
  centers,
  buildings[],
  parcels[],
  roads[],
  greenSpaces[],
  infrastructure,
  zoneCounts,
  metrics
}

Parcel {
  id,
  gridX, gridZ,
  x, y, z,
  width, depth,
  slope,
  waterDistance,
  floodRisk,
  buildability,
  frontageRoadId
}

Building {
  id,
  parcelId,
  x, y, z,
  width, depth, height,
  floors,
  rotation,
  zone,
  type,
  grossFloorArea
}

RoadSegment {
  start, end,
  polyline,
  class,
  width,
  lanes,
  sidewalk,
  bridge
}

Infrastructure {
  stations[],
  bridges,
  streetLights
}
```

## 4. 현실성 규칙

### 지형·수문

- 원본 지형의 시각적 표고는 보존하고, 별도 배수 표면만 Priority-Flood 방식으로 보정합니다.
- D8 하류 방향과 유역 누적량으로 하천 후보를 만들며, 고정된 장식용 강선을 사용하지 않습니다.
- 수변 거리, 토양 수분, 식생, 홍수 위험, 경사를 결합해 개발 적합도를 계산합니다.
- 높은 홍수 위험과 급경사 영역은 필지 및 건축 생성에서 제외하거나 저밀도로 제한합니다.

### 도로

- `arterial`, `collector`, `local` 3단계 위계이며 폭·차로·보도 치수가 서로 다릅니다.
- 간선도로는 경사·수계·홍수·식생 훼손 비용을 사용하는 A*로 중심지를 연결합니다.
- 생활가로는 지형 등고선 방향에 정렬된 두 가로군과 링형 집산도로로 구성합니다.
- 위계마다 폭, 보도 폭, 중앙분리대, 차선 표현이 다릅니다.
- 수공간 인접 구간은 교량 높이로 보간합니다.
- 주요 교차로에는 횡단보도와 교통 신호를 배치합니다.

### 용도

가로 전면 필지마다 다음 접근성·환경 점수를 합성합니다.

- CBD 접근성
- 부도심 접근성
- 산업 거점 접근성
- 공원 접근성
- 공공시설 거점 접근성
- 간선도로 접근성
- 수변 접근성
- 경사도
- 홍수 위험
- 대중교통 접근성

도시 유형은 각 점수의 가중치를 조정합니다.

### 건축

건물은 단일 직육면체가 아니라 포디움·타워·윙·중정 등 여러 매스로 구성되며, 유형별로 다음 값이 달라집니다.

- 대지 점유율
- 층수 범위
- 층고
- 포디움과 타워 비율
- 셋백
- 지붕 및 옥상 설비
- 창호와 발코니 표현
- 연면적 효율

## 5. 렌더링

WebGL2의 단일 정적 버퍼를 사용합니다.

```text
position 3 floats
normal   3 floats
color    3 floats
```

프래그먼트 셰이더는 재료 추정값을 바탕으로 다음을 계산합니다.

- 태양 방향 확산광
- 하늘 반구광
- 고도 기반 미세 명암
- 거리 안개
- 야간 창 조명 의사 발광
- 유리 프레넬과 하늘 반사
- 젖은 아스팔트 반사와 수면 잔물결
- ACES 계열 톤 매핑

현재는 정적 메시와 접지 음영 데칼을 사용하며, 실시간 그림자 맵·SSR·PBR 텍스처 패스는 사용하지 않습니다.

## 6. 성능 전략

- 도시 규모별 자동 세부도 3단계
- 큰 도시에서 창호·가로시설·조경 세부 수 감소
- 모든 정적 메시를 하나의 연속 버퍼로 업로드
- 지형 세그먼트 상한 설정
- 건물 유형별 반복 세부 요소 수 제한

다음 성능 개편에서는 Web Worker, 공간 타일, `drawElements`, 인스턴싱을 도입합니다.
