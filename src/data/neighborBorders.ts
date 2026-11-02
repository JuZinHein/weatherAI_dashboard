/**
 * Regional coastlines and country boundaries surrounding Myanmar
 * (Bay of Bengal, Bangladesh, India, China Yunnan, Laos, Thailand, Andaman Sea)
 * Provides seamless cartographic context so the map fills the full screen gracefully.
 */

// Bay of Bengal western and northern coastline (India & Bangladesh)
export const BAY_OF_BENGAL_COAST: [number, number][] = [
  [80.3, 13.1], // Chennai
  [80.9, 15.9], // Andhra coast
  [83.3, 17.7], // Visakhapatnam
  [85.8, 19.8], // Puri / Odisha
  [87.0, 21.5], // Balasore
  [88.2, 21.6], // Sundarbans West
  [89.5, 21.8], // Sundarbans East
  [90.4, 22.0], // Meghna Estuary / Bangladesh
  [91.8, 22.3], // Chittagong
  [91.9, 21.4], // Cox's Bazar
  [92.3, 20.8], // Teknaf (border with Myanmar)
];

// Bangladesh - India northern and eastern border
export const BANGLADESH_BORDER: [number, number][] = [
  [92.3, 20.8],
  [92.2, 21.3],
  [92.1, 22.0],
  [92.3, 23.0],
  [92.0, 23.8],
  [92.2, 24.5], // Sylhet
  [91.5, 25.2], // Meghalaya border
  [89.8, 25.3],
  [88.8, 26.3], // Rangpur / Dinajpur
  [88.2, 25.5],
  [88.5, 24.0],
  [88.8, 22.5],
  [89.1, 21.7],
];

// Thailand & Malay Peninsula coastline & Gulf of Thailand
export const THAILAND_COASTLINE: [number, number][] = [
  [98.5, 9.9],  // Ranong / border
  [98.3, 9.2],  // Phang Nga
  [98.3, 7.9],  // Phuket
  [99.3, 7.1],  // Trang / Satun
  [100.1, 6.4], // Malaysia border
  // Gulf of Thailand side
  [100.6, 7.2], // Songkhla
  [99.9, 9.1],  // Surat Thani
  [99.2, 10.5], // Chumphon
  [99.8, 11.8], // Prachuap Khiri Khan
  [99.9, 13.0], // Phetchaburi
  [100.5, 13.5], // Bangkok Bay
  [100.9, 13.0], // Chonburi
  [101.3, 12.6], // Rayong
  [102.3, 11.6], // Trat (Cambodia border)
];

// Thailand - Laos - China regional border segments
export const REGIONAL_INLAND_BORDERS: [number, number][][] = [
  // India Northeast (Mizoram, Manipur, Nagaland, Arunachal)
  [
    [92.2, 24.5],
    [93.0, 25.0],
    [93.5, 25.6],
    [94.2, 26.2],
    [95.0, 27.2],
    [96.0, 28.0],
    [97.2, 28.5],
  ],
  // Thailand - Laos Mekong border
  [
    [100.1, 20.3], // Golden Triangle
    [100.5, 20.1],
    [101.1, 19.5],
    [101.2, 18.2],
    [102.1, 17.9],
    [102.6, 17.8], // Vientiane
    [103.5, 18.3],
    [104.7, 17.4],
    [104.8, 16.0],
  ],
  // China Yunnan border region
  [
    [97.5, 28.5],
    [98.8, 28.2],
    [99.5, 27.8],
    [100.2, 26.5],
    [101.0, 25.0],
    [101.8, 23.5],
    [102.2, 22.4],
  ],
  // Andaman & Nicobar ridge markers
  [
    [92.8, 13.2],
    [92.9, 12.5],
    [92.7, 11.6],
    [92.8, 10.5],
    [93.8, 7.5],
  ],
];
