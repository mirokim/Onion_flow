/**
 * Plot Option Definitions for Plot Genre & Plot Structure nodes.
 *
 * Each option has an id (stored in node data), Korean label, English label,
 * description (injected into AI prompts), and an optgroup key for UI grouping.
 */

export interface PlotOption {
  id: string
  label: string       // Korean display name
  labelEn: string     // English display name
  description: string  // Korean description (used in AI prompt)
  group: string        // optgroup key
}

// ── Genre Option Groups ──

export const GENRE_GROUPS: { key: string; label: string }[] = [
  { key: 'classic', label: '고전 서사' },
  { key: 'genre', label: '장르 소설' },
  { key: 'eastern', label: '동양 장르' },
  { key: 'sf_fantasy', label: 'SF/판타지 세부' },
  { key: 'etc', label: '기타' },
]

export const PLOT_GENRE_OPTIONS: PlotOption[] = [
  // ── 고전 서사 ──
  { id: 'overcome', label: '극복 서사', labelEn: 'Overcoming the Monster', description: '주인공이 거대한 악/위협을 극복하는 서사', group: 'classic' },
  { id: 'hero_journey', label: '영웅의 여정', labelEn: "Hero's Journey", description: '일상→모험→시련→귀환의 영웅 서사 구조', group: 'classic' },
  { id: 'rags_to_riches', label: '입신양명', labelEn: 'Rags to Riches', description: '신분이나 지위의 극적인 상승 서사', group: 'classic' },
  { id: 'tragedy', label: '비극', labelEn: 'Tragedy', description: '주인공의 결함이나 운명으로 인한 몰락 서사', group: 'classic' },
  { id: 'comedy', label: '코미디', labelEn: 'Comedy', description: '혼란과 오해를 거쳐 행복한 결말에 이르는 서사', group: 'classic' },
  { id: 'rebirth', label: '재탄생', labelEn: 'Rebirth', description: '주인공이 변화/각성을 통해 새로운 삶을 얻는 서사', group: 'classic' },
  { id: 'voyage_return', label: '탐험과 귀환', labelEn: 'Voyage and Return', description: '미지의 세계로 떠나 경험 후 돌아오는 서사', group: 'classic' },
  { id: 'forbidden_love', label: '금지된 사랑', labelEn: 'Forbidden Love', description: '사회적/도덕적 금기를 넘는 사랑의 서사', group: 'classic' },
  { id: 'revenge', label: '복수 서사', labelEn: 'Revenge', description: '부당한 피해에 대한 복수와 그 대가를 다루는 서사', group: 'classic' },
  { id: 'mystery', label: '미스터리/탐정', labelEn: 'Mystery/Detective', description: '수수께끼를 풀어나가며 진실에 다가가는 서사', group: 'classic' },

  // ── 장르 소설 ──
  { id: 'fantasy', label: '판타지', labelEn: 'Fantasy', description: '마법과 초자연적 요소가 핵심인 가상 세계 서사', group: 'genre' },
  { id: 'sf', label: 'SF/과학소설', labelEn: 'Science Fiction', description: '과학 기술의 발전이 사회와 인간에게 미치는 영향을 다루는 서사', group: 'genre' },
  { id: 'romance', label: '로맨스', labelEn: 'Romance', description: '만남→갈등→화해→결합의 사랑 서사', group: 'genre' },
  { id: 'thriller', label: '스릴러', labelEn: 'Thriller', description: '긴장감과 서스펜스 중심의 위기 해결 서사', group: 'genre' },
  { id: 'horror', label: '호러', labelEn: 'Horror', description: '공포와 불안을 조성하며 생존/탈출을 다루는 서사', group: 'genre' },
  { id: 'historical', label: '역사물', labelEn: 'Historical Fiction', description: '실제 역사적 시대와 사건을 배경으로 한 서사', group: 'genre' },
  { id: 'slice_of_life', label: '일상물', labelEn: 'Slice of Life', description: '평범한 일상 속 소소한 감동과 성장을 다루는 서사', group: 'genre' },
  { id: 'action_adventure', label: '액션/모험', labelEn: 'Action/Adventure', description: '역동적인 액션과 모험을 중심으로 전개되는 서사', group: 'genre' },
  { id: 'drama', label: '드라마', labelEn: 'Drama', description: '인간 관계와 감정적 갈등을 사실적으로 다루는 서사', group: 'genre' },
  { id: 'noir', label: '누아르', labelEn: 'Noir', description: '범죄, 부패, 도덕적 모호함을 다루는 어둡고 비관적인 서사', group: 'genre' },
  { id: 'western', label: '서부극', labelEn: 'Western', description: '개척 시대 서부를 배경으로 한 모험/생존 서사', group: 'genre' },
  { id: 'satire', label: '풍자', labelEn: 'Satire', description: '사회나 인간의 결점을 날카롭게 비꼬는 서사', group: 'genre' },
  { id: 'psychological', label: '심리극', labelEn: 'Psychological', description: '인물의 내면 심리와 정신적 갈등을 깊이 파고드는 서사', group: 'genre' },
  { id: 'philosophical', label: '철학적 서사', labelEn: 'Philosophical', description: '존재, 윤리, 진리 등 철학적 주제를 탐구하는 서사', group: 'genre' },

  // ── 동양 장르 ──
  { id: 'martial_arts', label: '무협', labelEn: 'Martial Arts', description: '무술과 의리, 강호를 배경으로 한 동양 전통 서사', group: 'eastern' },
  { id: 'wuxia', label: '선협/수선', labelEn: 'Xianxia/Wuxia', description: '수련과 도를 닦으며 강해져가는 동양 판타지 서사', group: 'eastern' },
  { id: 'isekai', label: '이세계', labelEn: 'Isekai', description: '다른 세계로 전이되어 새로운 삶을 시작하는 서사', group: 'eastern' },
  { id: 'regression', label: '회귀', labelEn: 'Regression', description: '과거로 돌아가 인생을 다시 시작하는 서사', group: 'eastern' },
  { id: 'game_fantasy', label: '게임 판타지', labelEn: 'Game Fantasy', description: '게임 시스템/규칙이 존재하는 세계관의 서사', group: 'eastern' },

  // ── SF/판타지 세부 ──
  { id: 'epic_fantasy', label: '에픽 판타지', labelEn: 'Epic Fantasy', description: '거대한 세계관과 다수의 인물이 등장하는 대서사시적 판타지', group: 'sf_fantasy' },
  { id: 'dark_fantasy', label: '다크 판타지', labelEn: 'Dark Fantasy', description: '어둡고 잔혹한 분위기의 판타지 세계를 다루는 서사', group: 'sf_fantasy' },
  { id: 'urban_fantasy', label: '어반 판타지', labelEn: 'Urban Fantasy', description: '현대 도시를 배경으로 마법/초자연 요소가 공존하는 서사', group: 'sf_fantasy' },
  { id: 'magical_realism', label: '마술적 사실주의', labelEn: 'Magical Realism', description: '현실 세계에 마법적 요소가 자연스럽게 녹아든 서사', group: 'sf_fantasy' },
  { id: 'cyberpunk', label: '사이버펑크', labelEn: 'Cyberpunk', description: '고도 기술 사회의 어두운 면과 반체제적 인물을 다루는 서사', group: 'sf_fantasy' },
  { id: 'steampunk', label: '스팀펑크', labelEn: 'Steampunk', description: '증기 기관 중심의 대체 역사적 세계관을 다루는 서사', group: 'sf_fantasy' },
  { id: 'space_opera', label: '스페이스 오페라', labelEn: 'Space Opera', description: '광활한 우주를 배경으로 한 대규모 모험 서사', group: 'sf_fantasy' },
  { id: 'military_sf', label: '밀리터리 SF', labelEn: 'Military SF', description: '군사적 충돌과 전략을 중심으로 한 과학 소설 서사', group: 'sf_fantasy' },
  { id: 'mecha', label: '메카/로봇', labelEn: 'Mecha', description: '거대 로봇/기계를 중심으로 전개되는 액션 서사', group: 'sf_fantasy' },
  { id: 'dystopia', label: '디스토피아', labelEn: 'Dystopia', description: '억압적 사회에 대한 저항과 자유를 향한 서사', group: 'sf_fantasy' },

  // ── 기타 ──
  { id: 'post_apocalyptic', label: '포스트 아포칼립스', labelEn: 'Post-Apocalyptic', description: '문명 붕괴 이후 생존과 재건을 다루는 서사', group: 'etc' },
  { id: 'survival', label: '서바이벌', labelEn: 'Survival', description: '극한 환경에서 생존을 위해 분투하는 서사', group: 'etc' },
  { id: 'utopia', label: '유토피아', labelEn: 'Utopia', description: '이상적 사회를 그리거나 그 이면을 탐구하는 서사', group: 'etc' },
  { id: 'coming_of_age', label: '성장 서사', labelEn: 'Coming of Age', description: '주인공이 경험을 통해 정신적으로 성숙해가는 서사', group: 'etc' },
  { id: 'experimental', label: '실험적/초현실', labelEn: 'Experimental', description: '전통적 서사 규칙을 벗어난 실험적/초현실적 구조', group: 'etc' },
]

// ── Structure Options ──

export const PLOT_STRUCTURE_OPTIONS: PlotOption[] = [
  { id: 'linear', label: '선형 플롯', labelEn: 'Linear Plot', description: '시간 순서대로 전개되는 직선적 구조', group: 'structure' },
  { id: 'nonlinear', label: '비선형 플롯', labelEn: 'Nonlinear Plot', description: '시간 순서를 벗어나 교차/역행하는 구조 (플래시백, 플래시포워드)', group: 'structure' },
  { id: 'circular', label: '원형/순환 플롯', labelEn: 'Circular Plot', description: '결말이 시작과 연결되어 순환하는 구조', group: 'structure' },
  { id: 'episodic', label: '에피소딕 플롯', labelEn: 'Episodic Plot', description: '독립적인 에피소드가 느슨하게 연결되는 구조', group: 'structure' },
  { id: 'three_act', label: '3막 구조', labelEn: 'Three-Act Structure', description: '설정(1막)→대립(2막)→해결(3막)의 고전적 구조', group: 'structure' },
  { id: 'five_act', label: '5막 구조', labelEn: 'Five-Act Structure', description: '발단→상승→절정→하강→대단원의 5단계 구조', group: 'structure' },
  { id: 'freytag', label: '프레이태그 피라미드', labelEn: "Freytag's Pyramid", description: '도입→상승→클라이맥스→하강→결말의 피라미드형 구조', group: 'structure' },
  { id: 'kishotenketsu', label: '기승전결', labelEn: 'Kishotenketsu', description: '기(도입)→승(전개)→전(전환/반전)→결(결말)의 4단계 동아시아 서사 구조', group: 'structure' },
  { id: 'in_medias_res', label: '인 메디아스 레스', labelEn: 'In Medias Res', description: '이야기 중간부터 시작하여 과거를 회상하며 전개하는 구조', group: 'structure' },
  { id: 'frame_narrative', label: '액자식 구조', labelEn: 'Frame Narrative', description: '이야기 안에 이야기가 중첩되는 액자형 구조', group: 'structure' },
  { id: 'parallel', label: '병렬 구조', labelEn: 'Parallel Plot', description: '두 개 이상의 이야기가 동시에 진행되며 교차하는 구조', group: 'structure' },
  { id: 'spiral', label: '나선형 구조', labelEn: 'Spiral Plot', description: '같은 주제/사건을 반복하며 점점 깊이 파고드는 구조', group: 'structure' },
  { id: 'reverse_chronology', label: '역순 구조', labelEn: 'Reverse Chronology', description: '결말부터 시작하여 시간을 거슬러 올라가는 구조', group: 'structure' },
  { id: 'branching', label: '분기형 구조', labelEn: 'Branching Plot', description: '주요 선택 지점에서 이야기가 갈라지는 구조', group: 'structure' },
  { id: 'mosaic', label: '모자이크 구조', labelEn: 'Mosaic/Hyperlink', description: '독립적인 단편들이 모여 하나의 큰 그림을 이루는 구조', group: 'structure' },
  { id: 'quest', label: '퀘스트 구조', labelEn: 'Quest Structure', description: '목표를 향한 여정과 도전의 연쇄로 이루어진 구조', group: 'structure' },
  { id: 'save_the_cat', label: 'Save the Cat 비트', labelEn: 'Save the Cat Beat Sheet', description: '15개 비트로 구성된 현대 시나리오 작법 구조', group: 'structure' },
]
