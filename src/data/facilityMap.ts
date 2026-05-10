// 문태고 시설 배치도 데이터 — 건물별/층별 실 정보.

export type RoomType = "교실" | "교무실" | "특별실" | "행정실" | "편의시설" | "기타";

export interface Room {
  room: string;
  name: string;
  type: RoomType;
  highlight?: boolean;
}

export interface Floor {
  floor: string;
  rooms: Room[];
}

export interface Building {
  id: string;
  name: string;
  floors: Floor[];
}

export const buildings: Building[] = [
  {
    id: "B",
    name: "B동",
    floors: [
      {
        floor: "5F",
        rooms: [
          { room: "B500", name: "천년의 날개", type: "특별실" },
          { room: "B501", name: "1-1", type: "교실" },
          { room: "B502", name: "1-2", type: "교실" },
          { room: "B503", name: "1-3", type: "교실" },
          { room: "B504", name: "1학년실 (교무실)", type: "교무실", highlight: true },
          { room: "B505", name: "1-4", type: "교실" },
          { room: "B506", name: "1-5", type: "교실" }
        ]
      },
      {
        floor: "4F",
        rooms: [
          { room: "B400", name: "음악실", type: "특별실" },
          { room: "B401", name: "1-6", type: "교실" },
          { room: "B402", name: "1-7", type: "교실" },
          { room: "B403", name: "공용학습실", type: "특별실" },
          { room: "B404", name: "공용학습실", type: "특별실" },
          { room: "B405", name: "2-6", type: "교실" },
          { room: "B406", name: "2-7", type: "교실" }
        ]
      },
      {
        floor: "3F",
        rooms: [
          { room: "B300", name: "디지로그 온실", type: "특별실" },
          { room: "B301", name: "2-1", type: "교실" },
          { room: "B302", name: "2-2", type: "교실" },
          { room: "B303", name: "2-3", type: "교실" },
          { room: "B304", name: "2학년실 (교무실)", type: "교무실", highlight: true },
          { room: "B305", name: "2-4", type: "교실" },
          { room: "B306", name: "2-5", type: "교실" }
        ]
      },
      {
        floor: "2F",
        rooms: [
          { room: "B200", name: "창의융합 AI실", type: "특별실" },
          { room: "B201", name: "지구과학실", type: "특별실" },
          { room: "B202", name: "방송실", type: "특별실" },
          { room: "B203", name: "생물실", type: "특별실" },
          { room: "B204", name: "서버실", type: "기타" },
          { room: "B205", name: "화학 준비실", type: "기타" },
          { room: "B206", name: "화학실", type: "특별실" }
        ]
      },
      {
        floor: "1F",
        rooms: [
          { room: "B101", name: "보건실", type: "편의시설", highlight: true },
          { room: "B102", name: "성적처리실 (교육평가부)", type: "행정실", highlight: true },
          { room: "B103", name: "교직원 협의회실", type: "행정실" },
          { room: "B104", name: "교무실", type: "교무실", highlight: true }
        ]
      }
    ]
  },
  {
    id: "A",
    name: "A동",
    floors: [
      {
        floor: "2F",
        rooms: [
          { room: "A201", name: "물품 보관실", type: "기타" },
          { room: "A202", name: "공용학습실", type: "특별실" },
          { room: "A203", name: "공용학습실", type: "특별실" },
          { room: "A204", name: "공용학습실", type: "특별실" },
          { room: "A205", name: "행정실 서고", type: "기타" },
          { room: "", name: "이사장실", type: "행정실" },
          { room: "", name: "법인실", type: "행정실" }
        ]
      },
      {
        floor: "1F",
        rooms: [
          { room: "A101", name: "체력단련실", type: "특별실" },
          { room: "A104", name: "학교운영위원회실", type: "행정실" },
          { room: "", name: "상담실", type: "편의시설", highlight: true },
          { room: "", name: "교장실", type: "행정실" },
          { room: "", name: "행정실", type: "행정실", highlight: true },
          { room: "", name: "대회의실", type: "특별실" }
        ]
      }
    ]
  },
  {
    id: "C",
    name: "C동",
    floors: [
      {
        floor: "4F",
        rooms: [
          { room: "C401", name: "홈베이스 (여)", type: "편의시설" },
          { room: "C402", name: "태랑칸", type: "특별실" }
        ]
      },
      {
        floor: "3F",
        rooms: [
          { room: "C301", name: "홈베이스 (남)", type: "편의시설" },
          { room: "C302", name: "공용학습실", type: "특별실" }
        ]
      },
      {
        floor: "2F",
        rooms: []
      },
      {
        floor: "1F",
        rooms: [
          { room: "", name: "나래품", type: "특별실" }
        ]
      }
    ]
  },
  {
    id: "library",
    name: "도서관",
    floors: [
      {
        floor: "4F",
        rooms: [
          { room: "", name: "공용학습실", type: "특별실" },
          { room: "", name: "세미나실", type: "특별실" },
          { room: "", name: "미디어 창작실", type: "특별실" },
          { room: "", name: "진로진학실", type: "행정실" },
          { room: "", name: "소강당", type: "특별실" }
        ]
      },
      {
        floor: "3F",
        rooms: [
          { room: "", name: "학습카페", type: "편의시설" }
        ]
      },
      {
        floor: "2F",
        rooms: [
          { room: "", name: "도서관 미디어센터", type: "특별실" }
        ]
      },
      {
        floor: "1F",
        rooms: [
          { room: "", name: "학생인성부실", type: "행정실", highlight: true },
          { room: "", name: "학생협의회실", type: "행정실" },
          { room: "", name: "미술실", type: "특별실" },
          { room: "", name: "학생회실", type: "행정실" }
        ]
      }
    ]
  },
  {
    id: "annex",
    name: "별관동",
    floors: [
      {
        floor: "3F",
        rooms: [
          { room: "", name: "3-1", type: "교실" },
          { room: "", name: "3-2", type: "교실" },
          { room: "", name: "3-3", type: "교실" },
          { room: "", name: "3-4", type: "교실" }
        ]
      },
      {
        floor: "2F",
        rooms: [
          { room: "", name: "3학년실", type: "교무실", highlight: true },
          { room: "", name: "3-5", type: "교실" },
          { room: "", name: "3-6", type: "교실" },
          { room: "", name: "3-7", type: "교실" },
          { room: "", name: "특별교실", type: "특별실" }
        ]
      },
      {
        floor: "1F",
        rooms: [
          { room: "", name: "3.1사랑", type: "교실" },
          { room: "", name: "세미나실", type: "특별실" },
          { room: "", name: "공용학습실", type: "특별실" },
          { room: "", name: "세미나실", type: "특별실" },
          { room: "", name: "진로진학실", type: "행정실" },
          { room: "", name: "미디어창작실", type: "특별실" }
        ]
      }
    ]
  }
];
