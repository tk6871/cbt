// 자동 OCR이 도표·2열·분수 구조를 오인한 답안의 수동 검수 좌표입니다.
// 원본 이미지에서 번호와 답안 전체가 한 박스에 들어가는지 직접 확인한 값만 둡니다.
export const reviewedHvacAnswerSegments: Record<string, Record<number, Array<{ x: number; y: number; width: number; height: number }>>> = {
  "assets/hvac/assets/questions/2021_1/60.jpg": {
    "1": [{ "height": 5.01, "width": 75.38, "x": 8.09, "y": 46.01 }],
    "2": [
      { "height": 4.65, "width": 89.8, "x": 7.98, "y": 52.96 },
      { "height": 4.65, "width": 89.8, "x": 7.98, "y": 57.43 }
    ],
    "3": [
      { "height": 5.02, "width": 77.2, "x": 8.09, "y": 64.19 },
      { "height": 3.08, "width": 76.18, "x": 8.65, "y": 69.02 }
    ],
    "4": [
      { "height": 5.07, "width": 88.14, "x": 8.65, "y": 75.54 },
      { "height": 2.17, "width": 85.58, "x": 8.87, "y": 80.43 },
      { "height": 6.7, "width": 62.07, "x": 15.28, "y": 86.41 }
    ]
  },
  "assets/hvac/assets/questions/2021_2/40.jpg": {
    "4": [{ "height": 7.26, "width": 83.82, "x": 8.52, "y": 67.56 }]
  },
  "assets/hvac/assets/questions/2021_3/20.jpg": {
    "4": [
      { "height": 6.68, "width": 90.12, "x": 8.3, "y": 61.27 },
      { "height": 6.39, "width": 33.29, "x": 13.22, "y": 70.47 }
    ]
  },
  "assets/hvac/assets/questions/2022_1/40.jpg": {
    "4": [{ "height": 9.03, "width": 62.99, "x": 8.2, "y": 59.94 }]
  },
  "assets/hvac/assets/questions/2022_1/54.jpg": {
    "1": [{ "height": 12.53, "width": 22.6, "x": 7.77, "y": 46.32 }],
    "2": [{ "height": 11.31, "width": 26.66, "x": 59.27, "y": 45.9 }],
    "3": [
      { "height": 15.86, "width": 28.37, "x": 7.98, "y": 62.2 },
      { "height": 13.46, "width": 28.24, "x": 7.98, "y": 77.96 }
    ],
    "4": [
      { "height": 7.55, "width": 23.78, "x": 59.16, "y": 68.78 },
      { "height": 8.85, "width": 23.78, "x": 59.16, "y": 76.32 }
    ]
  },
  "assets/hvac/assets/questions/2022_1/60.jpg": {
    "1": [{ "height": 8.42, "width": 65.64, "x": 7.19, "y": 36.14 }],
    "2": [
      { "height": 3.8, "width": 79.18, "x": 7.19, "y": 49.73 },
      { "height": 7.07, "width": 79.18, "x": 7.19, "y": 53.26 }
    ],
    "3": [
      { "height": 4.08, "width": 79.18, "x": 7.19, "y": 65.49 },
      { "height": 8.46, "width": 80.4, "x": 6.42, "y": 69.29 }
    ],
    "4": [
      { "height": 6.82, "width": 80.09, "x": 6.63, "y": 80.13 },
      { "height": 7.1, "width": 80.09, "x": 6.63, "y": 86.68 }
    ]
  },
  "assets/hvac/assets/questions/2022_2/28.jpg": {
    "1": [
      { "x": 8.65, "y": 75.43, "width": 4.06, "height": 4.89 },
      { "height": 8.13, "width": 14.48, "x": 13.97, "y": 70.9 },
      { "height": 7.45, "width": 13.41, "x": 14.39, "y": 77.82 }
    ],
    "2": [
      { "x": 59.72, "y": 75.43, "width": 4.06, "height": 4.89 },
      { "height": 7.76, "width": 13.41, "x": 65.36, "y": 70.9 },
      { "height": 8.06, "width": 13.63, "x": 65.25, "y": 77.33 }
    ],
    "3": [
      { "x": 8.65, "y": 90.59, "width": 4.06, "height": 4.89 },
      { "height": 7.57, "width": 13.41, "x": 14.29, "y": 85.76 },
      { "height": 7.63, "width": 13.73, "x": 14.18, "y": 92.37 }
    ],
    "4": [
      { "x": 59.72, "y": 90.59, "width": 4.06, "height": 4.89 },
      { "height": 7.69, "width": 13.31, "x": 65.46, "y": 85.64 },
      { "height": 7.2, "width": 13.41, "x": 65.46, "y": 92.61 }
    ]
  },
  "assets/hvac/assets/questions/2022_2/60.jpg": {
    "1": [{ "height": 8.74, "width": 39.64, "x": 8.65, "y": 35.79 }],
    "2": [
      { "height": 4.1, "width": 62.71, "x": 8.65, "y": 50.27 },
      { "height": 5.83, "width": 4.01, "x": 8.73, "y": 54.31 },
      { "height": 7.47, "width": 57.86, "x": 14.07, "y": 54.31 }
    ],
    "3": [
      { "height": 5.3, "width": 30.08, "x": 14.07, "y": 65.82 },
      { "height": 5.03, "width": 4.01, "x": 8.84, "y": 66.09 },
      { "height": 4.86, "width": 4.01, "x": 8.84, "y": 71.12 },
      { "height": 5.96, "width": 30.08, "x": 14.07, "y": 71.12 }
    ],
    "4": [
      { "height": 7.26, "width": 47.82, "x": 14.18, "y": 81.12 },
      { "height": 5.62, "width": 3.58, "x": 8.94, "y": 82.76 },
      { "height": 4.37, "width": 53.31, "x": 8.65, "y": 88.25 }
    ]
  },
  "assets/hvac/assets/questions/2023_1/20.jpg": {
    "4": [
      { "height": 8.51, "width": 90.41, "x": 8.09, "y": 53.3 },
      { "height": 8.87, "width": 7.22, "x": 12.68, "y": 63.55 }
    ]
  },
  "assets/hvac/assets/questions/2023_1/60.jpg": {
    "1": [{ "height": 8.47, "width": 29.06, "x": 8.65, "y": 35.79 }],
    "2": [
      { "height": 3.83, "width": 27.14, "x": 8.65, "y": 50.27 },
      { "height": 7.95, "width": 28.58, "x": 7.88, "y": 53.83 }
    ],
    "3": [
      { "height": 6.86, "width": 22.92, "x": 7.56, "y": 64.45 },
      { "height": 6.58, "width": 22.92, "x": 7.56, "y": 71.04 }
    ],
    "4": [
      { "height": 7.96, "width": 32.32, "x": 8.09, "y": 80.57 },
      { "height": 4.37, "width": 30.98, "x": 8.65, "y": 88.25 }
    ]
  },
  "assets/hvac/assets/questions/2023_2/58.jpg": {
    "1": [{ "height": 8.06, "width": 9.37, "x": 6.31, "y": 56.33 }],
    "2": [{ "height": 6.08, "width": 10.57, "x": 57.72, "y": 56.91 }],
    "3": [
      { "height": 7.34, "width": 9.16, "x": 6.73, "y": 74.29 },
      { "height": 4.7, "width": 7.93, "x": 7.19, "y": 81.49 }
    ],
    "4": [{ "height": 12.43, "width": 12.26, "x": 57.82, "y": 81.77 }]
  },
  "assets/hvac/assets/questions/2023_3/60.jpg": {
    "1": [{ "height": 8.7, "width": 66.35, "x": 8.65, "y": 36.14 }],
    "2": [
      { "height": 3.26, "width": 79.91, "x": 8.76, "y": 50.27 },
      { "height": 8.45, "width": 81.15, "x": 7.98, "y": 53.26 }
    ],
    "3": [
      { "height": 6.82, "width": 81.36, "x": 7.88, "y": 64.65 },
      { "height": 7.36, "width": 81.36, "x": 7.88, "y": 71.2 }
    ],
    "4": [
      { "height": 7.64, "width": 80.48, "x": 8.65, "y": 80.95 },
      { "height": 4.35, "width": 80.02, "x": 8.65, "y": 88.32 }
    ]
  },
  "assets/hvac/assets/questions/2024_2/40.jpg": {
    "4": [{ "height": 7.26, "width": 75.17, "x": 8.3, "y": 57.65 }]
  },
  "assets/hvac/assets/questions/2024_2/60.jpg": {
    "1": [{ "height": 8.7, "width": 66.35, "x": 8.65, "y": 36.14 }],
    "2": [
      { "height": 3.26, "width": 79.91, "x": 8.76, "y": 50.27 },
      { "height": 7.34, "width": 80.02, "x": 8.65, "y": 53.26 }
    ],
    "3": [
      { "height": 3.26, "width": 79.91, "x": 8.76, "y": 66.58 },
      { "height": 8.99, "width": 81.36, "x": 7.88, "y": 69.57 }
    ],
    "4": [
      { "height": 7.64, "width": 80.48, "x": 8.65, "y": 80.95 },
      { "height": 4.35, "width": 80.02, "x": 8.65, "y": 88.32 }
    ]
  },
  "assets/hvac/assets/questions/2024_3/40.jpg": {
    "4": [
      { "height": 8.43, "width": 89.98, "x": 8.52, "y": 48.09 },
      { "height": 8.63, "width": 5.29, "x": 13.65, "y": 60.14 }
    ]
  },
  "assets/hvac/assets/questions/2025_1/45.jpg": {
    "1": [{ "x": 3.9, "y": 27.7, "width": 40.8, "height": 34.8 }],
    "2": [{ "x": 48.8, "y": 27.7, "width": 41.0, "height": 34.8 }],
    "3": [{ "x": 3.9, "y": 66.0, "width": 40.8, "height": 33.2 }],
    "4": [{ "x": 48.8, "y": 66.0, "width": 41.0, "height": 33.2 }]
  },
  "assets/hvac/assets/questions/2025_3/18.jpg": {
    "3": [
      { "height": 7.74, "width": 28.12, "x": 8.09, "y": 89.92 },
      { "height": 7.74, "width": 11.38, "x": 36.19, "y": 89.92 }
    ],
    "4": [{ "height": 8.21, "width": 36.6, "x": 59.05, "y": 89.61 }]
  },
  "assets/hvac/assets/questions/2025_3/20.jpg": {
    "4": [{ "height": 6.61, "width": 57.0, "x": 8.3, "y": 58.14 }]
  },
  "assets/hvac/assets/questions/2026_1/60.jpg": {
    "1": [{ "height": 5.09, "width": 74.59, "x": 6.52, "y": 45.74 }],
    "2": [
      { "height": 5.1, "width": 88.86, "x": 6.52, "y": 52.71 },
      { "height": 2.84, "width": 87.63, "x": 7.19, "y": 57.62 }
    ],
    "3": [
      { "height": 4.96, "width": 75.37, "x": 7.19, "y": 64.01 },
      { "height": 1.95, "width": 75.16, "x": 7.4, "y": 68.79 }
    ],
    "4": [
      { "height": 6.21, "width": 87.1, "x": 7.19, "y": 74.47 },
      { "height": 7.69, "width": 61.91, "x": 13.5, "y": 84.45 }
    ]
  },
  "assets/hvac/assets/questions/2026_2/60.jpg": {
    "1": [{ "height": 7.44, "width": 38.52, "x": 8.2, "y": 65.26 }],
    "2": [{ "height": 8.09, "width": 38.52, "x": 59.05, "y": 65.26 }],
    "3": [
      { "height": 9.07, "width": 38.41, "x": 8.2, "y": 77.3 },
      { "height": 4.87, "width": 36.97, "x": 8.76, "y": 86.04 }
    ],
    "4": [
      { "height": 8.75, "width": 38.41, "x": 59.16, "y": 77.62 },
      { "height": 4.87, "width": 36.75, "x": 59.83, "y": 86.04 }
    ]
  },
  "assets/hvac/assets/questions/2021_1/55.jpg": {
    "1": [{ "x": 9.23, "y": 64.9, "width": 29.55, "height": 6.07 }],
    "2": [{ "x": 9.03, "y": 73.42, "width": 30.08, "height": 6.95 }],
    "3": [{ "x": 9.13, "y": 82.81, "width": 29.97, "height": 6.21 }],
    "4": [{ "x": 9.23, "y": 91.93, "width": 29.66, "height": 6.07 }]
  },
  "assets/hvac/assets/questions/2021_2/30.jpg": {
    "1": [{ "x": 8.2, "y": 66.92, "width": 33.08, "height": 11.71 }],
    "2": [{ "x": 41.28, "y": 66.92, "width": 35.46, "height": 11.71 }],
    "3": [{ "x": 8.09, "y": 82.94, "width": 33.25, "height": 12.36 }],
    "4": [{ "x": 41.24, "y": 82.94, "width": 43.4, "height": 12.36 }]
  },
  "assets/hvac/assets/questions/2021_1/13.jpg": {
    "1": [{ "x": 7.29, "y": 91.14, "width": 19.45, "height": 3.15 }],
    "2": [{ "x": 43.66, "y": 91.14, "width": 19.45, "height": 3.15 }],
    "3": [{ "x": 7.05, "y": 95.2, "width": 19.94, "height": 3.38 }],
    "4": [{ "x": 43.41, "y": 95.2, "width": 20.04, "height": 3.38 }]
  },
  "assets/hvac/assets/questions/2022_1/45.jpg": {
    "1": [{ "x": 7.29, "y": 35, "width": 24.21, "height": 15.42 }],
    "2": [{ "x": 57.82, "y": 35, "width": 22.09, "height": 15.42 }],
    "3": [{ "x": 7.29, "y": 69.58, "width": 21.88, "height": 21.67 }],
    "4": [{ "x": 56.94, "y": 68.87, "width": 27.34, "height": 22.38 }]
  },
  "assets/hvac/assets/questions/2022_3/55.jpg": {
    "1": [
      { "x": 6.73, "y": 17.17, "width": 38.97, "height": 9.9 },
      { "x": 34.75, "y": 22.53, "width": 7.15, "height": 11.03 }
    ],
    "2": [
      { "x": 31.36, "y": 35.13, "width": 14.44, "height": 5.75 },
      { "x": 6.84, "y": 40.88, "width": 38.97, "height": 9.81 },
      { "x": 34.75, "y": 46.16, "width": 7.04, "height": 11.23 }
    ],
    "3": [
      { "x": 31.26, "y": 58.76, "width": 14.55, "height": 5.6 },
      { "x": 6.73, "y": 64.36, "width": 39.07, "height": 9.96 },
      { "x": 36.44, "y": 70.76, "width": 4.08, "height": 8.67 }
    ],
    "4": [{ "x": 7.19, "y": 79.6, "width": 38.58, "height": 14.52 }]
  },
  "assets/hvac/assets/questions/2023_2/41.jpg": {
    "1": [{ "x": 8.65, "y": 38.68, "width": 26.6, "height": 16.98 }],
    "2": [{ "x": 59.72, "y": 38.68, "width": 26.92, "height": 16.98 }],
    "3": [{ "x": 8.65, "y": 67.92, "width": 26.6, "height": 21.23 }],
    "4": [
      { "x": 69.95, "y": 66.21, "width": 16.94, "height": 22.74 },
      { "x": 59.59, "y": 73.28, "width": 4.76, "height": 15.67 }
    ]
  },
  "assets/hvac/assets/questions/2024_3/11.jpg": {
    "3": [
      { "x": 21.77, "y": 73.72, "width": 15.76, "height": 7.33 },
      { "x": 7.66, "y": 80.86, "width": 30.83, "height": 17.64 }
    ]
  },
  "assets/hvac/assets/questions/2024_3/55.jpg": {
    "1": [
      { "x": 8.65, "y": 43.27, "width": 25.32, "height": 8.57 },
      { "x": 15.6, "y": 51.84, "width": 3.1, "height": 6.53 }
    ],
    "2": [{ "x": 8.3, "y": 61.95, "width": 27.94, "height": 9.98 }],
    "3": [{ "x": 8.09, "y": 75.18, "width": 28.58, "height": 9.81 }],
    "4": [{ "x": 7.66, "y": 86.96, "width": 30.83, "height": 11.3 }]
  },
  "assets/hvac/assets/questions/2025_2/50.jpg": {
    "1": [{ "x": 8.65, "y": 51.72, "width": 57.91, "height": 9.08 }],
    "2": [{ "x": 8.65, "y": 64.02, "width": 52.67, "height": 9.2 }],
    "3": [
      { "x": 61.3, "y": 75.91, "width": 5.19, "height": 5.54 },
      { "x": 8.09, "y": 76.71, "width": 38.73, "height": 7.73 },
      { "x": 61.94, "y": 80.62, "width": 4.23, "height": 5.43 }
    ],
    "4": [{ "x": 8.65, "y": 88.85, "width": 52.67, "height": 9.2 }]
  },
  "assets/hvac/assets/questions/2026_1/13.jpg": {
    "1": [{ "x": 8.65, "y": 39.42, "width": 80.24, "height": 8.85 }],
    "2": [
      { "x": 33.76, "y": 49.94, "width": 10.04, "height": 2.46 },
      { "x": 8.65, "y": 52.35, "width": 81.41, "height": 8.45 },
      { "x": 40.38, "y": 61.93, "width": 47.33, "height": 0.62 },
      { "x": 2.03, "y": 63.21, "width": 51.92, "height": 2.46 }
    ],
    "3": [{ "x": 3.95, "y": 73.18, "width": 82.26, "height": 10.86 }],
    "4": [
      { "x": 30.34, "y": 85.55, "width": 10.15, "height": 2.63 },
      { "x": 3.95, "y": 88.13, "width": 83.44, "height": 8.4 }
    ]
  },
  "assets/hvac/assets/questions/2026_1/22.jpg": {
    "1": [{ "x": 8.55, "y": 8.3, "width": 37.29, "height": 45.53 }],
    "2": [{ "x": 50.43, "y": 8.3, "width": 35.68, "height": 45.53 }],
    "3": [{ "x": 8.55, "y": 54, "width": 37.29, "height": 44.72 }],
    "4": [{ "x": 50.43, "y": 54, "width": 35.68, "height": 44.72 }]
  },
  "assets/hvac/assets/questions/2021_1/57.jpg": {
    "2": [
      { "x": 56.94, "y": 64.8, "width": 9.37, "height": 4.34 },
      { "x": 43.62, "y": 66, "width": 4.08, "height": 6.76 },
      { "x": 49.76, "y": 69.08, "width": 23, "height": 8.93 }
    ]
  },
  "assets/hvac/assets/questions/2023_1/54.jpg": {
    "1": [
      { "x": 23.15, "y": 63.97, "width": 9.67, "height": 4.5 },
      { "x": 8.62, "y": 65.17, "width": 4.12, "height": 6.72 },
      { "x": 15.03, "y": 68.94, "width": 25.27, "height": 8.33 }
    ]
  },
  "assets/hvac/assets/questions/2024_2/57.jpg": {
    "2": [
      { "x": 64.87, "y": 74.56, "width": 7.15, "height": 3.93 },
      { "x": 57.79, "y": 75.99, "width": 4.08, "height": 4.4 },
      { "x": 63.81, "y": 77.33, "width": 7.89, "height": 7.42 },
      { "x": 65.51, "y": 85.05, "width": 7.78, "height": 4.05 }
    ],
    "4": [
      { "x": 65.51, "y": 89.1, "width": 7.78, "height": 3.71 },
      { "x": 57.79, "y": 90.53, "width": 4.08, "height": 4.4 },
      { "x": 63.39, "y": 91.76, "width": 10.43, "height": 6.74 }
    ]
  },
  "assets/hvac/assets/questions/2025_1/13.jpg": {
    "2": [
      { "x": 30.31, "y": 68.19, "width": 5.94, "height": 3.14 },
      { "x": 8.62, "y": 69.39, "width": 4.12, "height": 4.11 },
      { "x": 14.5, "y": 69.7, "width": 6.79, "height": 3.38 },
      { "x": 21.98, "y": 71.04, "width": 20.46, "height": 6.17 }
    ]
  },
  "assets/hvac/assets/questions/2025_2/12.jpg": {
    "1": [
      { "x": 8.62, "y": 52.75, "width": 4.12, "height": 8.58 },
      { "x": 13.43, "y": 52.02, "width": 26.23, "height": 17.76 }
    ]
  }
};
