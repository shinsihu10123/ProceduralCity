# Procedural City 아키텍처 v0.3-alpha

## 1. 생성 파이프라인

```text
사용자 시나리오
→ 문자열 시드 해싱
→ 결정론적 난수·가치 노이즈
→ 지형·하천 모델
→ 도로 위계선 생성
→ 도로·교차로·교량 메시
→ CBD·부도심·산업·공원·공공 거점
→ 필지 적합도·경사도·수변 거리 계산
→ 토지 이용 점수화
→ 건축 유형·층수·매스 생성
→ 대중교통·가로시설·조경 생성
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

이전 버전의 추상적 셀 높이와 달리 v0.3은 도로 폭, 보도, 건물 높이, 역 접근 반경을 미터 단위로 해석합니다.

## 3. 핵심 데이터 모델

```js
City {
  schemaVersion,
  settings,
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
  waterDistance
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
  x, y, z,
  orientation,
  class,
  length,
  bridge
}

Infrastructure {
  stations[],
  bridges,
  streetLights
}
```

## 4. 현실성 규칙

### 지형

- 가치 노이즈를 여러 주파수로 합성합니다.
- 도시 중심부는 완만하게, 외곽은 상대적으로 크게 굴곡집니다.
- 하천 주변 지형은 수면 아래로 절삭합니다.
- 필지 중심의 수치 경사도를 계산하여 개발 여부에 반영합니다.

### 도로

- `arterial`, `collector`, `local` 3단계 위계입니다.
- 위계마다 폭, 보도 폭, 중앙분리대, 차선 표현이 다릅니다.
- 수공간 인접 구간은 교량 높이로 보간합니다.
- 주요 교차로에는 횡단보도와 교통 신호를 배치합니다.

### 용도

각 필지에 대해 다음 접근성 점수를 합성합니다.

- CBD 접근성
- 부도심 접근성
- 산업 거점 접근성
- 공원 접근성
- 공공시설 거점 접근성
- 간선도로 접근성
- 수변 접근성
- 경사도

도시 유형은 각 점수의 가중치를 조정합니다.

### 건축

건물 유형별로 다음 값이 달라집니다.

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

프래그먼트 셰이더는 다음을 계산합니다.

- 태양 방향 확산광
- 하늘 반구광
- 고도 기반 미세 명암
- 거리 안개
- 야간 창 조명 의사 발광

현재는 렌더링 복잡도를 낮추기 위해 실시간 그림자 맵과 반사 패스를 사용하지 않습니다.

## 6. 성능 전략

- 도시 규모별 자동 세부도 3단계
- 큰 도시에서 창호·가로시설·조경 세부 수 감소
- 모든 정적 메시를 하나의 연속 버퍼로 업로드
- 지형 세그먼트 상한 설정
- 건물 유형별 반복 세부 요소 수 제한

다음 성능 개편에서는 Web Worker, 공간 타일, `drawElements`, 인스턴싱을 도입합니다.
